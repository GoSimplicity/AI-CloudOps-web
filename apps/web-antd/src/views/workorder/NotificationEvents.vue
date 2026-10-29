<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAccessStore, useUserStore } from '@vben/stores';
import { message } from 'ant-design-vue';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';
import {
  cancelNotificationEvent,
  getCurrentPermissions,
  getNotificationDeliveries,
  getNotificationResolutions,
  listNotificationEvents,
  notificationEventPermissions as codes,
  resolveNotificationDelivery,
  retryNotificationEvent,
  type CurrentPermissions,
  type NotificationDelivery,
  type NotificationEvent,
  type NotificationResolution,
} from '#/api/core/workorder/notification-events';

type Action = 'cancel' | 'retry' | 'delivered' | 'redeliver';
const user = useUserStore();
const access = useAccessStore();
const identity = computed(() => ({ authenticated: !!access.accessToken, userId: user.userInfo?.userId }));
const hasIdentity = () => identity.value.authenticated && /^[1-9]\d*$/.test(identity.value.userId ?? '');
const permissions = ref<CurrentPermissions | null>(null);
const events = ref<NotificationEvent[]>([]);
const deliveries = ref<NotificationDelivery[]>([]);
const resolutions = ref<NotificationResolution[]>([]);
const selected = ref<NotificationEvent | null>(null);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const filter = ref<string | undefined>();
const loading = ref(false);
const detailLoading = ref(false);
const failure = ref('');
const detailFailure = ref('');
const action = ref<Action | null>(null);
const actionEvent = ref<NotificationEvent | null>(null);
const actionDelivery = ref<NotificationDelivery | null>(null);
const reason = ref('');
const submitting = ref(false);
let alive = true;
let session = 0;
let listGeneration = 0;
let detailGeneration = 0;
let actionGeneration = 0;

const states: Record<string, string> = {
  pending: '等待', processing: '发送处理中', planned: '已生成排期', success: '已确认成功',
  skipped: '已跳过', cancelled: '已取消', failed: '失败', uncertain: '结果未知', sending: '发送中',
};
const eventStates = Object.fromEntries(Object.entries(states).filter(([value]) => value !== 'sending'));
const eventsNames: Record<string, string> = {
  instance_created: '创建', instance_updated: '更新', instance_deleted: '删除', instance_submitted: '提交',
  instance_assigned: '指派', instance_approved: '审批通过', instance_rejected: '拒绝',
  instance_completed: '完成', instance_cancelled: '取消', instance_returned: '退回', instance_commented: '评论',
};
const safeId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
const safeCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : '—';
const allowed = (code: string) => !!permissions.value && (permissions.value.super_admin === true || permissions.value.permissions.includes(code));
const current = (generation: number) => alive && generation === session && hasIdentity();
const validPermissions = (value: CurrentPermissions): boolean => value?.version === 2 && typeof value.super_admin === 'boolean' && Array.isArray(value.permissions) && value.permissions.every((code) => typeof code === 'string');
const dateText = (value: unknown) => {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('zh-CN');
};
const masked = (channel: unknown, value: unknown) => {
  if (typeof value !== 'string') return '暂无脱敏标识';
  if (channel === 'email' && /^(?:[\p{L}\p{N}]|\*)\*{3}@(?:[\p{L}\p{N}]|\*)\*{3}$/u.test(value)) return value;
  if (channel === 'feishu' && /^(ou_|on_|oc_)\*{3}(?:[a-zA-Z0-9]{4})?$/.test(value)) return value;
  if (channel === 'in_app' && /^用户\*{3}(?:[0-9]{4})?$/.test(value)) return value;
  return '暂无脱敏标识';
};
const hashText = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : '—';
const actionTitle: Record<Action, string> = { cancel: '取消待处理排期', retry: '重试失败事件', delivered: '确认已送达', redeliver: '确认重新投递' };
const actionWarning: Record<Action, string> = {
  cancel: '只能取消尚未领取的排期。发送中或结果未知时无法保证撤回，请先核对状态。',
  retry: '请先核对失败原因和已有投递记录。存在投递记录时后端会严格限制重试。',
  delivered: '请先在渠道侧确认此接收人已经收到消息，确认后不会自动重发。',
  redeliver: '结果未知时原发送可能已完成。请先核对渠道记录并确认原发送已停止，否则可能重复投递。',
};

async function refreshPermissions(generation: number): Promise<boolean> {
  try {
    const result = await getCurrentPermissions();
    if (!current(generation)) return false;
    if (!validPermissions(result)) throw new Error('invalid permissions');
    permissions.value = result;
    if (!allowed(codes.list)) { events.value = []; total.value = 0; }
    if (!allowed(codes.deliveries)) closeDetails();
    else if (!allowed(codes.resolutions)) resolutions.value = [];
    return true;
  } catch {
    if (current(generation)) {
      permissions.value = null;
      events.value = []; total.value = 0; closeDetails();
      failure.value = '无法确认当前用户权限，请重新登录或重试';
    }
    return false;
  }
}

async function loadList() {
  const generation = session;
  const ticket = ++listGeneration;
  if (!current(generation) || !allowed(codes.list)) return;
  loading.value = true;
  failure.value = '';
  try {
    const result = await listNotificationEvents({ page: page.value, size: pageSize, ...(filter.value ? { status: filter.value } : {}) });
    if (!current(generation) || ticket !== listGeneration || !allowed(codes.list)) return;
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error('invalid result');
    events.value = result.items;
    total.value = result.total;
  } catch {
    if (current(generation) && ticket === listGeneration) { events.value = []; total.value = 0; failure.value = '事件列表加载失败，请重试'; }
  } finally {
    if (current(generation) && ticket === listGeneration) loading.value = false;
  }
}

async function openDetails(event: NotificationEvent) {
  if (!safeId(event.id) || !allowed(codes.deliveries)) return;
  const generation = session;
  const ticket = ++detailGeneration;
  selected.value = event;
  deliveries.value = [];
  resolutions.value = [];
  detailFailure.value = '';
  detailLoading.value = true;
  try {
    const [deliveryResult, resolutionResult] = await Promise.all([
      getNotificationDeliveries(event.id),
      allowed(codes.resolutions) ? getNotificationResolutions(event.id) : Promise.resolve([]),
    ]);
    if (!current(generation) || ticket !== detailGeneration || selected.value?.id !== event.id || !allowed(codes.deliveries)) return;
    if (!Array.isArray(deliveryResult) || !Array.isArray(resolutionResult)) throw new Error('invalid result');
    deliveries.value = deliveryResult;
    resolutions.value = allowed(codes.resolutions) ? resolutionResult : [];
  } catch {
    if (current(generation) && ticket === detailGeneration) detailFailure.value = '投递详情加载失败，请重试';
  } finally {
    if (current(generation) && ticket === detailGeneration) detailLoading.value = false;
  }
}

function closeDetails() {
  detailGeneration++;
  selected.value = null;
  deliveries.value = [];
  resolutions.value = [];
  detailLoading.value = false;
}
function openAction(kind: Action, event: NotificationEvent, delivery?: NotificationDelivery) {
  const code = kind === 'cancel' ? codes.cancel : kind === 'retry' ? codes.retry : codes.resolve;
  if (!allowed(code) || !safeId(event.id) || submitting.value) return;
  if (kind === 'cancel' && (!safeId(event.parent_event_id) || event.status !== 'pending')) return;
  if (kind === 'retry' && event.status !== 'failed') return;
  if ((kind === 'delivered' || kind === 'redeliver') && (!delivery || !safeId(delivery.id) || !['failed', 'uncertain'].includes(event.status) || !['failed', 'uncertain', 'sending'].includes(delivery.status))) return;
  actionGeneration++;
  action.value = kind;
  actionEvent.value = event;
  actionDelivery.value = delivery ?? null;
  reason.value = '';
}
function closeAction() {
  if (submitting.value) return;
  actionGeneration++;
  action.value = null;
  actionEvent.value = null;
  actionDelivery.value = null;
  reason.value = '';
}
async function submitAction() {
  const kind = action.value;
  const target = actionEvent.value;
  const delivery = actionDelivery.value;
  const text = reason.value.trim();
  if (!kind || !target || submitting.value || !safeId(target.id)) return;
  if (Array.from(text).length < 5 || new TextEncoder().encode(text).length > 500) { message.error('请填写 5 至 500 字节的核对原因'); return; }
  const generation = session;
  const ticket = actionGeneration;
  submitting.value = true;
  try {
    if (!await refreshPermissions(generation) || !current(generation) || ticket !== actionGeneration) return;
    const code = kind === 'cancel' ? codes.cancel : kind === 'retry' ? codes.retry : codes.resolve;
    if (!allowed(code)) { message.error('当前用户没有该操作的精确权限'); return; }
    if (kind === 'cancel') await cancelNotificationEvent(target.id, text);
    else if (kind === 'retry') await retryNotificationEvent(target.id, text);
    else {
      if (!delivery || !safeId(delivery.id)) return;
      await resolveNotificationDelivery(target.id, delivery.id, kind === 'delivered' ? 'delivered' : 'retry', text);
    }
    if (!current(generation) || ticket !== actionGeneration) return;
    message.success('操作已记录');
    action.value = null; actionEvent.value = null; actionDelivery.value = null; reason.value = '';
    await loadList();
    if (selected.value?.id === target.id) {
      const refreshed = events.value.find((event) => event.id === target.id);
      if (refreshed) await openDetails(refreshed);
      else closeDetails();
    }
  } catch (error) {
    if (current(generation) && ticket === actionGeneration) {
      failure.value = '操作未确认，请刷新状态并核对后再处理';
      if (shouldNotifyPageError(error)) message.error(failure.value);
    }
  } finally {
    if (current(generation) && ticket === actionGeneration) submitting.value = false;
  }
}
function changePage(next: number) { page.value = next; void loadList(); }
function changeFilter() { page.value = 1; closeDetails(); void loadList(); }

watch([() => identity.value.authenticated, () => identity.value.userId], () => {
  session++; listGeneration++; detailGeneration++; actionGeneration++;
  permissions.value = null; events.value = []; total.value = 0; selected.value = null;
  deliveries.value = []; resolutions.value = []; action.value = null; actionEvent.value = null;
  actionDelivery.value = null; reason.value = ''; submitting.value = false; loading.value = false; detailLoading.value = false;
  page.value = 1; failure.value = ''; detailFailure.value = '';
  const generation = session;
  if (hasIdentity()) void refreshPermissions(generation).then((ok) => { if (ok && current(generation)) void loadList(); });
}, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { alive = false; session++; listGeneration++; detailGeneration++; actionGeneration++; });
</script>

<template>
  <section class="notification-events" aria-label="通知事件管理">
    <div class="events-heading">
      <div><h2>投递事件</h2><p>查看排期、投递结果和人工处置记录。</p></div>
      <a-space>
        <a-select v-model:value="filter" allow-clear placeholder="全部状态" aria-label="筛选事件状态" style="width: 150px" @change="changeFilter">
          <a-select-option v-for="(label, value) in eventStates" :key="value" :value="value">{{ label }}</a-select-option>
        </a-select>
        <a-button :loading="loading" :disabled="!allowed(codes.list)" @click="loadList">刷新</a-button>
      </a-space>
    </div>
    <a-alert v-if="failure" type="error" :message="failure" show-icon />
    <a-alert v-else-if="!allowed(codes.list)" type="info" message="当前用户无事件列表权限" show-icon />
    <template v-else>
      <a-table :data-source="events" :loading="loading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 850 }">
        <a-table-column key="id" title="事件 ID"><template #default="{ record }">{{ safeId(record.id) ? record.id : '—' }}</template></a-table-column>
        <a-table-column key="instance" title="工单 ID"><template #default="{ record }">{{ safeId(record.instance_id) ? record.instance_id : '—' }}</template></a-table-column>
        <a-table-column key="event" title="事件"><template #default="{ record }">{{ eventsNames[record.event_type] ?? '其他事件' }}</template></a-table-column>
        <a-table-column key="status" title="状态"><template #default="{ record }">{{ states[record.status] ?? '未知状态' }}</template></a-table-column>
        <a-table-column key="scheduled" title="下次处理"><template #default="{ record }">{{ dateText(record.next_attempt_at) }}</template></a-table-column>
        <a-table-column key="operation" title="操作" :width="235"><template #default="{ record }">
          <a-space>
            <a-button v-if="allowed(codes.deliveries)" type="link" size="small" :disabled="!safeId(record.id)" @click="openDetails(record)">详情</a-button>
            <a-button v-if="allowed(codes.cancel) && record.status === 'pending' && safeId(record.parent_event_id)" type="link" size="small" @click="openAction('cancel', record)">取消排期</a-button>
            <a-button v-if="allowed(codes.retry) && record.status === 'failed'" type="link" size="small" @click="openAction('retry', record)">重试事件</a-button>
          </a-space>
        </template></a-table-column>
      </a-table>
      <a-pagination class="events-pagination" :current="page" :page-size="pageSize" :total="total" :show-size-changer="false" @change="changePage" />
    </template>
    <a-drawer :open="!!selected" title="投递详情" width="min(680px, 100vw)" @close="closeDetails">
      <a-alert type="warning" message="结果未知不代表失败，请核对渠道记录后再处理。" show-icon />
      <p v-if="selected">事件 {{ selected.id }} · {{ states[selected.status] ?? '未知状态' }}</p>
      <a-alert v-if="detailFailure" type="error" :message="detailFailure" show-icon />
      <a-spin :spinning="detailLoading">
        <a-table :data-source="deliveries" :pagination="false" row-key="id" size="small" :scroll="{ x: 600 }">
          <a-table-column key="channel" title="渠道"><template #default="{ record }">{{ record.channel === 'email' ? '邮件' : record.channel === 'feishu' ? '飞书' : record.channel === 'in_app' ? '站内消息' : '其他' }}</template></a-table-column>
          <a-table-column key="recipient" title="接收人"><template #default="{ record }"><div>{{ masked(record.channel, record.recipient_masked) }}</div><small class="hash">{{ hashText(record.recipient_hash) }}</small></template></a-table-column>
          <a-table-column key="status" title="状态"><template #default="{ record }">{{ states[record.status] ?? '未知状态' }}</template></a-table-column>
          <a-table-column key="attempts" title="次数"><template #default="{ record }">{{ safeCount(record.attempts) }}</template></a-table-column>
          <a-table-column key="actions" title="处置"><template #default="{ record }">
            <a-space v-if="selected && allowed(codes.resolve) && ['uncertain', 'failed'].includes(selected.status) && ['uncertain', 'sending', 'failed'].includes(record.status)">
              <a-button type="link" size="small" @click="openAction('delivered', selected, record)">确认送达</a-button>
              <a-button type="link" size="small" @click="openAction('redeliver', selected, record)">重新投递</a-button>
            </a-space>
          </template></a-table-column>
        </a-table>
        <div v-if="allowed(codes.resolutions)" class="audit-list">
          <h3>处置记录</h3>
          <p v-if="!resolutions.length">暂无处置记录</p>
          <div v-for="entry in resolutions" :key="entry.id">{{ dateText(entry.created_at) }} · 操作人 {{ safeId(entry.operator_id) ? entry.operator_id : '—' }} · {{ ({ delivered: '确认送达', retry: '重新投递', retry_event: '重试事件', retry_schedule: '恢复排期', cancel_scheduled: '取消排期' } as Record<string, string>)[entry.action] ?? '其他操作' }}</div>
        </div>
      </a-spin>
    </a-drawer>
    <a-modal :open="!!action" :z-index="1100" :title="action ? actionTitle[action] : ''" ok-text="确认" cancel-text="取消" :confirm-loading="submitting" :closable="!submitting" :mask-closable="!submitting" :keyboard="!submitting" @cancel="closeAction" @ok="submitAction">
      <a-alert v-if="action" type="warning" :message="actionWarning[action]" show-icon />
      <label class="reason-label" for="notification-action-reason">核对原因（请勿填写密钥或消息正文）</label>
      <a-textarea id="notification-action-reason" v-model:value="reason" :disabled="submitting" :maxlength="500" :rows="3" />
    </a-modal>
  </section>
</template>

<style scoped>
.notification-events { display: grid; gap: var(--ops-space-md); }
.events-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--ops-space-md); flex-wrap: wrap; }
.events-heading h2, .audit-list h3 { margin: 0 0 4px; }
.events-heading p { margin: 0; color: var(--ops-muted); }
.events-pagination { justify-self: end; margin-top: var(--ops-space-sm); }
.hash { display: block; max-width: 200px; overflow-wrap: anywhere; color: var(--ops-muted); }
.audit-list { margin-top: var(--ops-space-lg); display: grid; gap: 6px; }
.reason-label { display: block; margin: var(--ops-space-md) 0 var(--ops-space-xs); }
</style>
