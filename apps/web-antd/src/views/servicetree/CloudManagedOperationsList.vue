<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { listManagedOperations, type ManagedCloudOperation, type ManagedCloudScope } from '#/api/core/tree/tree_cloud';
import CloudManagedOperationRecovery from './CloudManagedOperationRecovery.vue';
import { parseManagedMarker, type ManagedOperationMarker } from './managed-operation-marker';
import { validManagedOperation } from './managed-operation-contract';

const props = defineProps<{ scope: ManagedCloudScope; viewer: string; superAdmin: boolean; canList: boolean; canRead: boolean; canReview: boolean; refreshToken: number; authorize: () => Promise<boolean> }>();
const emit = defineEmits<{ blocked: [boolean]; busy: [boolean]; acknowledged: [string, number] }>();
const records = ref<ManagedCloudOperation[]>([]);
const total = ref(0);
const page = ref(1);
const size = 20;
const allOwners = ref(false);
const unconfirmedOnly = ref(true);
const loading = ref(false);
const error = ref('');
const selected = ref<ManagedCloudOperation | null>(null);
const selectedMarker = ref<ManagedOperationMarker | null>(null);
const resourceInput = ref('');
const reviewBusy = ref(false);
const scopeBlocked = ref(true);
let alive = true;
let generation = 0;
let request = 0;
const scopeKey = computed(() => `${props.viewer}:${props.scope.cloud_account_id}:${props.scope.cloud_account_region_id}:${props.scope.kind}`);
const rowKey = (row: ManagedCloudOperation) => `${row.owner_id}:${row.operation_id}`;
const labels: Record<string, string> = { running: '处理中', unknown: '结果未知', completed: '已保存结果', reviewed: '已核对' };
function clearSelection() { selected.value = null; selectedMarker.value = null; resourceInput.value = ''; reviewBusy.value = false; emit('busy', false); }
async function load(resetPage = false) {
 const epoch = generation, ticket = ++request;
 records.value = []; total.value = 0; error.value = ''; scopeBlocked.value = true; emit('blocked', true);
 if (!props.canList) return;
 if (resetPage) page.value = 1;
 loading.value = true;
 try {
  const response = await listManagedOperations({ ...props.scope, page: page.value, size, unconfirmed_only: unconfirmedOnly.value, ...(allOwners.value && props.superAdmin ? { all_owners: true } : {}) });
  if (!alive || epoch !== generation || ticket !== request || !props.canList) return;
  if (!response || !Array.isArray(response.items) || response.items.length > size || !Number.isSafeInteger(response.total) || response.total < response.items.length || typeof response.scope_blocked !== 'boolean') throw new Error('invalid list');
  const seen = new Set<string>();
  for (const row of response.items) {
   if (!validManagedOperation(row) || row.cloud_account_id !== props.scope.cloud_account_id || row.cloud_account_region_id !== props.scope.cloud_account_region_id || row.kind !== props.scope.kind || ((!props.superAdmin || !allOwners.value) && row.owner_id !== Number(props.viewer)) || seen.has(rowKey(row))) throw new Error('invalid operation scope');
   const unresolved = row.state === 'running' || row.state === 'unknown' || (row.state === 'completed' && row.result?.retry_safe === false);
   if ((unresolved && !response.scope_blocked) || (unconfirmedOnly.value && !unresolved)) throw new Error('inconsistent scope summary');
   seen.add(rowKey(row));
  }
  records.value = response.items; total.value = response.total; scopeBlocked.value = response.scope_blocked; emit('blocked', response.scope_blocked);
 } catch { if (alive && epoch === generation && ticket === request) error.value = '操作列表或范围状态读取失败，请刷新后重试'; }
 finally { if (alive && epoch === generation && ticket === request) loading.value = false; }
}
function choose(row: ManagedCloudOperation) {
 if (!props.canRead || reviewBusy.value || (!props.superAdmin && row.owner_id !== Number(props.viewer))) return;
 clearSelection(); selected.value = row;
 selectedMarker.value = parseManagedMarker(JSON.stringify({ version: 2, operation_id: row.operation_id, resource_ids: row.resource_ids }));
}
function useResourceIDs() {
 if (!selected.value || reviewBusy.value || resourceInput.value.length > 12000) return;
 const ids = resourceInput.value.split(/[\s,，]+/).filter(Boolean);
 const marker = parseManagedMarker(JSON.stringify({ version: 2, operation_id: selected.value.operation_id, resource_ids: ids }));
 if (!marker) { error.value = '请输入1至100个不重复的有效资源ID'; return; }
 error.value = ''; selectedMarker.value = marker;
}
function filtersChanged() { clearSelection(); void load(true); }
function changePage(next: number) { if (reviewBusy.value) return; page.value = next; clearSelection(); void load(); }
function acknowledged(id: string, ownerID: number) {
 if (!selected.value || selected.value.operation_id !== id || selected.value.owner_id !== ownerID) return;
 clearSelection(); emit('acknowledged', id, ownerID);
}
watch([scopeKey, () => props.superAdmin, () => props.canList, () => props.refreshToken], (next, previous) => {
 generation++; request++; records.value = []; total.value = 0; error.value = ''; loading.value = false; clearSelection();
 if (!previous || next[0] !== previous[0] || next[1] !== previous[1]) { allOwners.value = false; unconfirmedOnly.value = true; }
 void load(true);
}, { immediate: true, flush: 'sync' });
watch([() => props.canRead, () => props.canReview], () => { clearSelection(); }, { flush: 'sync' });
onBeforeUnmount(() => { alive = false; generation++; request++; });
</script>

<template>
 <section aria-label="托管操作列表" class="managed-operation-list">
  <h3>持久操作记录</h3>
  <a-alert v-if="!canList" type="warning" message="缺少操作列表权限，无法确认该范围的操作状态" show-icon />
  <template v-else>
   <a-space wrap>
    <a-checkbox v-model:checked="unconfirmedOnly" :disabled="reviewBusy" @change="filtersChanged">只看未确认操作</a-checkbox>
    <a-checkbox v-if="superAdmin" v-model:checked="allOwners" :disabled="reviewBusy" @change="filtersChanged">超级管理员：查看所有用户</a-checkbox>
    <a-button :loading="loading" :disabled="reviewBusy" @click="clearSelection(); load()">刷新操作列表</a-button>
   </a-space>
   <a-alert v-if="error" type="warning" :message="error" show-icon />
   <a-alert v-else-if="scopeBlocked" type="warning" message="服务端确认该范围仍有未确认操作；若本人列表没有记录，请联系超级管理员核对" show-icon />
   <a-table :data-source="records" :row-key="rowKey" :loading="loading" :pagination="false" size="small" :scroll="{ x: 640 }">
    <a-table-column title="所属用户" key="owner"><template #default="{ record }">{{ record.owner_id }}</template></a-table-column>
    <a-table-column title="操作 ID" key="operation"><template #default="{ record }">{{ record.operation_id }}</template></a-table-column>
    <a-table-column title="状态" key="state"><template #default="{ record }">{{ labels[record.state] ?? '未知' }}</template></a-table-column>
    <a-table-column title="操作" key="action"><template #default="{ record }"><a-button v-if="canRead" type="link" :disabled="reviewBusy" @click="choose(record)">查看或核对</a-button></template></a-table-column>
   </a-table>
   <a-pagination v-if="total > size" :current="page" :total="total" :page-size="size" :show-size-changer="false" @change="changePage" />
   <template v-if="selected">
    <p>已选用户 {{ selected.owner_id }} 的操作 {{ selected.operation_id }}</p>
    <template v-if="selected.state === 'reviewed' || (selected.state === 'completed' && selected.result?.retry_safe === true)">
     <a-descriptions :column="1" bordered size="small">
      <a-descriptions-item label="持久状态">{{ labels[selected.state] }}</a-descriptions-item>
      <a-descriptions-item v-if="selected.state === 'reviewed'" label="实际核对人">{{ selected.reviewed_by }}</a-descriptions-item>
      <a-descriptions-item v-if="selected.state === 'reviewed'" label="核对时间">{{ selected.reviewed_at }}</a-descriptions-item>
      <a-descriptions-item v-if="selected.state === 'reviewed'" label="核对前状态">{{ selected.previous_state === 'not_recorded' ? '当时没有操作记录' : selected.previous_state === 'running' ? '处理中或未确认' : '已保存结果' }}</a-descriptions-item>
      <a-descriptions-item v-if="selected.state === 'reviewed'" label="核对依据">{{ selected.review_reason }}</a-descriptions-item>
      <a-descriptions-item label="资源 ID">{{ selected.resource_ids.join(', ') || '未保存快照' }}</a-descriptions-item>
      <a-descriptions-item v-if="selected.result" label="原同步结果">{{ selected.result.status === 'success' ? '成功' : selected.result.status === 'failed' ? '失败' : selected.result.status === 'cancelled' ? '已取消' : '结果未知' }}；数量 {{ selected.result.count }}；历史 {{ selected.result.history_id ?? '未确认' }}</a-descriptions-item>
     </a-descriptions>
     <p v-if="!selected.result">本记录未保存原始同步结果，人工核对不表示同步成功。</p>
    </template>
    <template v-else-if="!selectedMarker">
     <a-alert type="info" message="该旧记录没有资源快照，请输入原请求的资源ID；服务端会验证原请求摘要，不会猜测关联" show-icon />
     <a-textarea v-model:value="resourceInput" aria-label="旧操作资源ID" :maxlength="12000" :rows="3" />
     <a-button @click="useResourceIDs">使用核对的资源ID</a-button>
    </template>
    <CloudManagedOperationRecovery v-else :key="`${viewer}:${selected.owner_id}:${selected.operation_id}`" :marker="selectedMarker" :scope="scope" :owner="viewer" :operation-owner="selected.owner_id" :allow-cross-owner="superAdmin" :can-read="canRead" :can-review="canReview" :authorize="authorize" @acknowledged="acknowledged" @busy="reviewBusy = $event; emit('busy', $event)" />
   </template>
  </template>
 </section>
</template>

<style scoped>
.managed-operation-list { display: grid; gap: var(--ops-space-md); }
.managed-operation-list p, .managed-operation-list :deep(.ant-descriptions-item-content) { overflow-wrap: anywhere; }
</style>
