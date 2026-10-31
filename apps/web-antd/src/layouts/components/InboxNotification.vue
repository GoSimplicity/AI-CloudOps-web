<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAccessStore, useUserStore } from '@vben/stores';
import { BellOutlined } from '@ant-design/icons-vue';
import {
  deleteInboxMessage,
  getInboxMessages,
  getInboxPermissions,
  getInboxUnreadCount,
  inboxPermissions as codes,
  markAllInboxRead,
  markInboxRead,
  type InboxMessage,
  type InboxPermissions,
} from '#/api/core/workorder/inbox';

const access = useAccessStore();
const user = useUserStore();
const owner = computed(() => ({
  authenticated: !!access.accessToken,
  id: user.userInfo?.userId,
}));
const authenticated = () =>
  owner.value.authenticated && /^[1-9]\d*$/.test(owner.value.id ?? '');
const permissions = ref<InboxPermissions | null>(null);
const open = ref(false);
const unreadCount = ref<number | null>(null);
const messages = ref<InboxMessage[]>([]);
const page = ref(1);
const size = 10;
const total = ref(0);
const unreadOnly = ref(false);
const loading = ref(false);
const busy = ref(false);
const permissionError = ref('');
const unreadError = ref('');
const listError = ref('');
const actionError = ref('');
let alive = true;
let generation = 0;
let listTicket = 0;
let countTicket = 0;
let permissionTicket = 0;
const current = (epoch: number) =>
  alive && epoch === generation && authenticated();
const allow = (code: string) =>
  !!permissions.value &&
  (permissions.value.super_admin === true ||
    permissions.value.permissions.includes(code));
const safeId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const dateText = (value: unknown) => {
  if (typeof value !== 'string') return '时间未知';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? '时间未知'
    : date.toLocaleString('zh-CN');
};
const messageText = (value: unknown) =>
  typeof value === 'string' ? value : '';

async function refreshPermissions(epoch: number) {
  const ticket = ++permissionTicket;
  try {
    const result = await getInboxPermissions();
    if (!current(epoch) || ticket !== permissionTicket) return false;
    if (
      !result ||
      result.version !== 2 ||
      typeof result.super_admin !== 'boolean' ||
      !Array.isArray(result.permissions) ||
      !result.permissions.every((item) => typeof item === 'string')
    )
      throw new Error('invalid permissions');
    permissions.value = result;
    permissionError.value = '';
    if (!allow(codes.list)) {
      listTicket++;
      messages.value = [];
      total.value = 0;
    }
    if (!allow(codes.unread)) {
      countTicket++;
      unreadCount.value = null;
    }
    return true;
  } catch {
    if (current(epoch) && ticket === permissionTicket) {
      permissions.value = null;
      messages.value = [];
      total.value = 0;
      unreadCount.value = null;
      permissionError.value = '无法确认站内消息权限，请重新登录或重试';
    }
    return false;
  }
}
async function refreshCount() {
  const epoch = generation;
  const ticket = ++countTicket;
  if (!current(epoch) || !allow(codes.unread)) return;
  try {
    const data = await getInboxUnreadCount();
    if (!current(epoch) || ticket !== countTicket || !allow(codes.unread))
      return;
    if (!Number.isSafeInteger(data?.unread) || data.unread < 0)
      throw new Error('invalid count');
    unreadCount.value = data.unread;
    unreadError.value = '';
  } catch {
    if (current(epoch) && ticket === countTicket) {
      unreadCount.value = null;
      unreadError.value = '未读数量获取失败';
    }
  }
}
async function refreshList() {
  const epoch = generation;
  const ticket = ++listTicket;
  if (!current(epoch) || !allow(codes.list)) return;
  loading.value = true;
  listError.value = '';
  try {
    const data = await getInboxMessages({
      page: page.value,
      size,
      ...(unreadOnly.value ? { unread: true } : {}),
    });
    if (!current(epoch) || ticket !== listTicket || !allow(codes.list)) return;
    if (
      !Array.isArray(data?.items) ||
      !Number.isSafeInteger(data.total) ||
      data.total < 0
    )
      throw new Error('invalid list');
    messages.value = data.items;
    total.value = data.total;
  } catch {
    if (current(epoch) && ticket === listTicket) {
      messages.value = [];
      total.value = 0;
      listError.value = '消息加载失败，请重试';
    }
  } finally {
    if (current(epoch) && ticket === listTicket) loading.value = false;
  }
}
async function refresh() {
  const epoch = generation;
  if (!current(epoch) || !(await refreshPermissions(epoch))) return;
  await Promise.all([refreshCount(), refreshList()]);
}
function handleOpen(value: boolean) {
  open.value = value;
  if (value && authenticated()) void refresh();
  if (!value) {
    listTicket++;
    loading.value = false;
  }
}
function changePage(next: number) {
  page.value = next;
  void refreshList();
}
function changeFilter() {
  page.value = 1;
  void refreshList();
}
async function perform(kind: 'read' | 'readAll' | 'delete', id?: number) {
  if (busy.value || !authenticated() || (kind !== 'readAll' && !safeId(id)))
    return;
  const epoch = generation;
  const code =
    kind === 'read'
      ? codes.read
      : kind === 'readAll'
        ? codes.readAll
        : codes.delete;
  busy.value = true;
  actionError.value = '';
  try {
    if (!(await refreshPermissions(epoch)) || !current(epoch) || !open.value)
      return;
    if (!allow(code)) {
      actionError.value = '当前用户没有该操作权限';
      return;
    }
    if (kind !== 'readAll' && !messages.value.some((item) => item.id === id))
      return;
    if (kind === 'read') await markInboxRead(id!);
    else if (kind === 'delete') await deleteInboxMessage(id!);
    else await markAllInboxRead();
    if (!current(epoch)) return;
    await Promise.all([refreshCount(), refreshList()]);
  } catch {
    if (current(epoch))
      actionError.value = '操作未确认，请刷新消息状态后再处理';
  } finally {
    if (current(epoch)) busy.value = false;
  }
}
watch(
  [() => owner.value.authenticated, () => owner.value.id],
  () => {
    generation++;
    listTicket++;
    countTicket++;
    permissionTicket++;
    permissions.value = null;
    open.value = false;
    unreadCount.value = null;
    messages.value = [];
    total.value = 0;
    page.value = 1;
    unreadOnly.value = false;
    loading.value = false;
    busy.value = false;
    permissionError.value = '';
    unreadError.value = '';
    listError.value = '';
    actionError.value = '';
    const epoch = generation;
    if (authenticated())
      void refreshPermissions(epoch).then((ok) => {
        if (ok && current(epoch)) void refreshCount();
      });
  },
  { immediate: true, flush: 'sync' },
);
const timer = setInterval(() => {
  if (authenticated() && allow(codes.unread)) void refreshCount();
}, 60_000);
onBeforeUnmount(() => {
  alive = false;
  generation++;
  listTicket++;
  countTicket++;
  permissionTicket++;
  clearInterval(timer);
});
</script>

<template>
  <a-popover
    :open="open"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="inbox-popover"
    :overlay-style="{ width: 'min(420px, calc(100vw - 16px))' }"
    @open-change="handleOpen"
  >
    <template #content>
      <section class="inbox" aria-label="站内消息列表">
        <header class="inbox-header">
          <div>
            <strong>站内消息</strong
            ><span class="inbox-count">{{
              unreadCount === null ? '未读数未知' : `未读 ${unreadCount}`
            }}</span>
          </div>
          <a-space>
            <a-button size="small" :disabled="busy" @click="refresh">
              刷新 </a-button
            ><a-button
              v-if="allow(codes.readAll)"
              size="small"
              :loading="busy"
              :disabled="unreadCount === 0"
              @click="perform('readAll')"
            >
              全部已读
            </a-button>
          </a-space>
        </header>
        <a-alert
          v-if="permissionError"
          type="warning"
          :message="permissionError"
          show-icon
        />
        <a-alert
          v-else-if="!allow(codes.list)"
          type="info"
          message="当前用户无站内消息列表权限"
          show-icon
        />
        <template v-else>
          <a-alert
            v-if="unreadError"
            type="warning"
            :message="unreadError"
            show-icon
          />
          <a-alert
            v-if="listError"
            type="error"
            :message="listError"
            show-icon
          />
          <a-alert
            v-if="actionError"
            type="error"
            :message="actionError"
            show-icon
          />
          <a-checkbox v-model:checked="unreadOnly" @change="changeFilter">
            仅未读
          </a-checkbox>
          <a-spin :spinning="loading">
            <div
              v-if="!messages.length && !listError && !loading"
              class="inbox-empty"
            >
              暂无消息
            </div>
            <ul v-else class="inbox-list">
              <li v-for="item in messages" :key="item.id" class="inbox-item">
                <div class="inbox-item-header">
                  <strong>{{ messageText(item.subject) || '工单通知' }}</strong
                  ><a-tag v-if="!item.read_at" color="blue">未读</a-tag>
                </div>
                <p class="inbox-content">{{ messageText(item.content) }}</p>
                <div class="inbox-footer">
                  <span>{{ dateText(item.created_at) }}</span><a-space>
                    <a-button
                      v-if="!item.read_at && allow(codes.read)"
                      type="link"
                      size="small"
                      :disabled="busy || !safeId(item.id)"
                      @click="perform('read', item.id)"
                    >
                      标记已读
                    </a-button>
                    <a-popconfirm
                      v-if="allow(codes.delete)"
                      title="删除这条消息？"
                      ok-text="删除"
                      cancel-text="取消"
                      :disabled="busy || !safeId(item.id)"
                      @confirm="perform('delete', item.id)"
                    >
                      <a-button
                        type="link"
                        size="small"
                        danger
                        :disabled="busy || !safeId(item.id)"
                      >
                        删除
                      </a-button>
                    </a-popconfirm>
                  </a-space>
                </div>
              </li>
            </ul>
          </a-spin>
          <a-pagination
            v-if="total > size"
            size="small"
            :current="page"
            :page-size="size"
            :total="total"
            :show-size-changer="false"
            @change="changePage"
          />
        </template>
      </section>
    </template>
    <a-badge :count="unreadCount ?? 0" :overflow-count="99" :offset="[-3, 3]">
      <a-button
        type="text"
        aria-label="站内消息"
        :title="unreadCount === null ? '未读数量未知' : `未读 ${unreadCount}`"
      >
        <template #icon><BellOutlined /></template>
      </a-button>
    </a-badge>
  </a-popover>
</template>

<style scoped>
.inbox {
  width: 100%;
  display: grid;
  gap: 10px;
}
.inbox-header,
.inbox-item-header,
.inbox-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.inbox-count {
  margin-left: 8px;
  color: var(--ops-muted);
  font-size: 12px;
}
.inbox-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(50vh, 420px);
  overflow-y: auto;
}
.inbox-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--ops-border);
}
.inbox-item-header strong {
  overflow-wrap: anywhere;
}
.inbox-content {
  margin: 6px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.inbox-footer {
  color: var(--ops-muted);
  font-size: 12px;
}
.inbox-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--ops-muted);
}
</style>

<style>
@media (max-width: 600px) {
  .inbox-popover {
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    top: 54px !important;
    width: auto !important;
  }
  .inbox-popover .ant-popover-arrow {
    display: none;
  }
}
</style>
