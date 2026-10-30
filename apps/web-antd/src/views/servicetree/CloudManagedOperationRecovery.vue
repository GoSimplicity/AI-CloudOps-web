<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { getManagedOperation, reviewManagedOperation, type ManagedCloudOperation, type ManagedCloudScope } from '#/api/core/tree/tree_cloud';
import { validManagedOperation } from './managed-operation-contract';
import type { ManagedOperationMarker } from './managed-operation-marker';

const props = defineProps<{ marker: ManagedOperationMarker; scope: ManagedCloudScope; owner: string; canRead: boolean; canReview: boolean; operationOwner?: number; allowCrossOwner?: boolean; authorize: () => Promise<boolean> }>();
const initialOwner = props.owner;
const ownerMatches = computed(() => props.owner === initialOwner);
const effectiveOwner = computed(() => props.operationOwner ?? Number(props.owner));
const readAllowed = computed(() => ownerMatches.value && props.canRead && Number.isSafeInteger(effectiveOwner.value) && effectiveOwner.value > 0 && (effectiveOwner.value === Number(props.owner) || props.allowCrossOwner === true));
function ownerParameter() { return effectiveOwner.value === Number(props.owner) ? undefined : effectiveOwner.value; }
const emit = defineEmits<{ acknowledged: [string, number]; busy: [boolean] }>();
const view = ref<ManagedCloudOperation | null>(null);
const error = ref('');
const busy = ref(false);
const reviewOpen = ref(false);
const reason = ref('');
const verified = ref(false);
const uncertainReview = ref(false);
let generation = 0;
let alive = true;
const mayReview = computed(() => readAllowed.value && props.canReview && !busy.value && (view.value?.state === 'unknown' || (view.value?.state === 'completed' && view.value.result?.retry_safe === false) || !!error.value));
function valid(record: ManagedCloudOperation): boolean {
 if (!validManagedOperation(record) || record.owner_id !== effectiveOwner.value || record.operation_id !== props.marker.operation_id || record.cloud_account_id !== props.scope.cloud_account_id || record.cloud_account_region_id !== props.scope.cloud_account_region_id || record.kind !== props.scope.kind) return false;
 if (record.resource_ids.length && JSON.stringify([...record.resource_ids].sort()) !== JSON.stringify([...props.marker.resource_ids].sort())) return false;
 return record.state !== 'completed' || record.result?.status !== 'success' || record.result.count === props.marker.resource_ids.length;
}
function accept(record: ManagedCloudOperation) {
 if (!valid(record)) throw new Error('invalid operation');
 view.value = record;
 if (record.state === 'reviewed' || (record.state === 'completed' && record.result?.retry_safe === true && record.result.status !== 'unknown')) emit('acknowledged', record.operation_id, record.owner_id);
}
async function query() {
 if (!readAllowed.value || busy.value) return;
 const ticket = generation;
 busy.value = true; emit('busy', true); error.value = '';
 try {
  const record = await getManagedOperation(props.marker.operation_id, ownerParameter());
  if (alive && ticket === generation && readAllowed.value) accept(record);
 } catch { if (alive && ticket === generation) error.value = '操作结果未确认或记录不存在。请核对实际资源后记录人工处置，不能直接再次同步。'; }
 finally { if (alive) { busy.value = false; emit('busy', false); } }
}
function openReview() { if (!mayReview.value) return; reason.value = ''; verified.value = false; uncertainReview.value = false; reviewOpen.value = true; }
async function submit() {
 const trimmed = reason.value.trim();
 if (busy.value || !props.canReview || !readAllowed.value || !verified.value || uncertainReview.value) return;
 if ([...trimmed].length < 10 || [...trimmed].length > 1000) { error.value = '请填写10至1000字的核对依据'; return; }
 const ticket = generation;
 busy.value = true; emit('busy', true); error.value = '';
 try {
  if (!await props.authorize()) { if (alive && ticket === generation) error.value = '无法确认核对权限，本次未提交'; return; }
  if (!alive || ticket !== generation || !readAllowed.value || !props.canReview) return;
  await reviewManagedOperation(props.marker.operation_id, { ...props.scope, resource_ids: [...props.marker.resource_ids], resources_verified: true, reason: trimmed, ...(ownerParameter() === undefined ? {} : { owner_id: ownerParameter() }) });
  if (!alive || ticket !== generation || !readAllowed.value || !props.canReview) return;
  // Read the authoritative audit back. A successful POST response alone does
  // not clear the recovery pointer if its acknowledgement or read is uncertain.
  const record = await getManagedOperation(props.marker.operation_id, ownerParameter());
  if (!alive || ticket !== generation || !readAllowed.value || !props.canReview) return;
  if (!valid(record) || record.state !== 'reviewed') throw new Error('review not confirmed');
  accept(record); reviewOpen.value = false; reason.value = ''; verified.value = false;
 } catch { if (alive && ticket === generation) { uncertainReview.value = true; error.value = '核对结果尚未确认，请关闭对话框并查询操作，不要重复提交。'; } }
 finally { if (alive) { busy.value = false; emit('busy', false); } }
}
watch([() => props.owner, () => props.operationOwner, () => props.allowCrossOwner, () => props.scope.cloud_account_id, () => props.scope.cloud_account_region_id, () => props.scope.kind, () => props.marker.operation_id, () => props.marker.resource_ids.join('\0'), () => props.canRead, () => props.canReview], () => {
 generation++; view.value = null; error.value = ''; reviewOpen.value = false; reason.value = ''; verified.value = false;
 // Keep any real write locked until its promise settles; changes unmount or
 // invalidate this component and its owner must preserve the durable pointer.
}, { flush: 'sync' });
onBeforeUnmount(() => { alive = false; generation++; });
</script>

<template>
 <section v-if="ownerMatches" aria-label="托管操作恢复">
  <p>所属用户：{{ effectiveOwner }}</p>
  <p>待核对操作：{{ marker.operation_id }}</p>
  <p>资源：{{ marker.resource_ids.join(', ') }}</p>
  <a-alert v-if="!readAllowed" type="warning" message="缺少操作查询权限，不能确认结果" show-icon />
  <a-button :disabled="!readAllowed || busy" :loading="busy" @click="query">查询本次操作</a-button>
  <a-button v-if="mayReview" :disabled="busy" @click="openReview">核对并阻断旧请求</a-button>
  <p v-if="view">{{ view.state === 'running' ? '仍在处理中，请稍后查询' : view.state === 'unknown' ? '结果未知，不能重复执行' : view.state === 'reviewed' ? '已记录人工核对' : view.result?.retry_safe === false ? '结果仍未确认，需人工核对，不能重复执行' : '已读取持久结果' }}</p>
  <a-alert v-if="error" type="warning" :message="error" show-icon />
  <a-modal :open="reviewOpen" title="核对本次操作" ok-text="保存操作核对" :confirm-loading="busy" :closable="!busy" :mask-closable="false" :cancel-button-props="{ disabled: busy }" :ok-button-props="{ disabled: !verified || uncertainReview || !readAllowed || !canReview }" @cancel="reviewOpen = false" @ok="submit">
   <template v-if="reviewOpen">
    <p>先核对实际资源及本地数据。本操作会保存审计并阻止该 ID 的旧请求执行，不会重新同步，也不会将未知结果改为成功。</p>
    <p>所属用户：{{ effectiveOwner }}；当前操作者：{{ owner }}</p>
    <p class="operation-reference">操作 ID：{{ marker.operation_id }}</p>
    <p>范围：账户 {{ scope.cloud_account_id }}，地域 {{ scope.cloud_account_region_id }}，类型 {{ scope.kind }}</p>
    <p class="operation-reference">资源 ID：{{ marker.resource_ids.join(', ') }}</p>
    <label for="managed-operation-review-reason">核对依据与结果</label>
    <a-textarea id="managed-operation-review-reason" v-model:value="reason" :rows="4" :maxlength="1000" :disabled="busy" />
    <a-checkbox v-model:checked="verified" :disabled="busy">已核对该操作的全部资源与本地状态</a-checkbox>
    <a-alert v-if="error" type="warning" :message="error" show-icon />
   </template>
  </a-modal>
 </section>
</template>

<style scoped>
.operation-reference { overflow-wrap: anywhere; }
</style>
