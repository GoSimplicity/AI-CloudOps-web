<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAccessStore, useUserStore } from '@vben/stores';
import { message } from 'ant-design-vue';
import {
  getCloudAccountDetailApi,
  getCloudAccountListApi,
  type CloudAccount,
  type CloudAccountRegion,
} from '#/api/core/tree/tree_account';
import {
  getManagedPermissions,
  getManagedResourceDetail,
  getManagedResources,
  getManagedSyncHistory,
  managedPermissions as codes,
  syncManagedResources,
  resolveManagedHistory,
  type ManagedCloudHistory,
  type ManagedCloudKind,
  type ManagedCloudResource,
  type ManagedCloudScope,
  type ManagedCloudSyncResult,
  type ManagedPermissions,
} from '#/api/core/tree/tree_cloud';
import CloudManagedOperationsList from './CloudManagedOperationsList.vue';
import CloudManagedOperationRecovery from './CloudManagedOperationRecovery.vue';
import {
  parseManagedMarker,
  saveManagedMarker,
  removeManagedMarker,
  type ManagedOperationMarker,
} from './managed-operation-marker';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

const access = useAccessStore();
const user = useUserStore();
const owner = computed(() => ({
  authenticated: !!access.accessToken,
  id: user.userInfo?.userId,
}));
const authenticated = () =>
  owner.value.authenticated && /^[1-9]\d*$/.test(owner.value.id ?? '');
const permissions = ref<ManagedPermissions | null>(null);
const accounts = ref<CloudAccount[]>([]);
const regions = ref<CloudAccountRegion[]>([]);
const accountId = ref<number>();
const regionId = ref<number>();
const selectedAccountEnabled = ref(false);
const kind = ref<ManagedCloudKind>('rds');
const idsText = ref('');
const records = ref<ManagedCloudResource[]>([]);
const history = ref<ManagedCloudHistory[]>([]);
const selected = ref<ManagedCloudResource | null>(null);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const loading = ref(false);
const regionLoading = ref(false);
const syncing = ref(false);
const reviewing = ref(false);
const reviewEntry = ref<ManagedCloudHistory | null>(null);
const reviewReason = ref('');
const reviewVerified = ref(false);
const reviewError = ref('');
const reviewUncertain = ref(false);
const historyLoading = ref(false);
const error = ref('');
const regionError = ref('');
const historyError = ref('');
const detailError = ref('');
const result = ref<ManagedCloudSyncResult | null>(null);
const historyBlocked = ref(true);
const localBlocked = ref(true);
const pendingOperation = ref<ManagedOperationMarker | null>(null);
const operationPointerBusy = ref(false);
const operationListBusy = ref(false);
const operationBusy = computed(
  () => operationPointerBusy.value || operationListBusy.value,
);
const scopeOperationsBlocked = ref(true);
const operationRefresh = ref(0);
watch(
  () => pendingOperation.value?.operation_id,
  () => {
    operationPointerBusy.value = false;
  },
  { flush: 'sync' },
);
const storageUnavailable = ref(false);
let alive = true;
let session = 0;
let selection = 0;
let listTicket = 0;
let detailTicket = 0;
let permissionTicket = 0;
let historyTicket = 0;
const safeId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9-]{1,99}$/;
const can = (code: string) =>
  !!permissions.value &&
  (permissions.value.super_admin === true ||
    permissions.value.permissions.includes(code));
const current = (epoch: number, scope?: number) =>
  alive &&
  epoch === session &&
  authenticated() &&
  (scope === undefined || scope === selection);
const scope = computed<ManagedCloudScope | null>(() =>
  safeId(accountId.value) && safeId(regionId.value)
    ? {
        cloud_account_id: accountId.value,
        cloud_account_region_id: regionId.value,
        kind: kind.value,
      }
    : null,
);
const scopeAllowed = computed(
  () =>
    !!scope.value &&
    can(codes.accountList) &&
    can(codes.accountDetail) &&
    accounts.value.some((a) => a.id === accountId.value) &&
    regions.value.some((r) => r.id === regionId.value),
);
const canSync = computed(
  () =>
    scopeAllowed.value &&
    selectedAccountEnabled.value &&
    regions.value.some((r) => r.id === regionId.value && r.status === 1) &&
    can(codes.sync) &&
    can(codes.history) &&
    can(codes.operationRead) &&
    can(codes.operationList) &&
    !scopeOperationsBlocked.value &&
    !operationBusy.value &&
    !historyLoading.value &&
    !historyBlocked.value &&
    !localBlocked.value &&
    !syncing.value &&
    !reviewing.value,
);
const validPermissions = (value: ManagedPermissions) =>
  value?.version === 2 &&
  typeof value.super_admin === 'boolean' &&
  Array.isArray(value.permissions) &&
  value.permissions.every((item) => typeof item === 'string');
const safeText = (value: unknown) =>
  typeof value === 'string' && value.length <= 500 ? value : '—';
const dateText = (value: unknown) => {
  if (typeof value !== 'string') return '—';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleString('zh-CN');
};
const kindName: Record<ManagedCloudKind, string> = {
  rds: 'RDS 数据库',
  clb: '传统型负载均衡 CLB',
  cache: 'Tair / Redis / Memcache',
};
const stateName: Record<string, string> = {
  running: '处理中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
  unknown: '结果未知',
};

function keyFor(target: ManagedCloudScope, userId: string) {
  return `cloudops-managed-unconfirmed:${userId}:${target.cloud_account_id}:${target.cloud_account_region_id}:${target.kind}`;
}
function readLocal(target: ManagedCloudScope): boolean {
  try {
    storageUnavailable.value = false;
    const raw = localStorage.getItem(keyFor(target, owner.value.id!));
    pendingOperation.value = parseManagedMarker(raw);
    return raw !== null;
  } catch {
    pendingOperation.value = null;
    storageUnavailable.value = true;
    return true;
  }
}
async function refreshPermissions(epoch: number) {
  const ticket = ++permissionTicket;
  try {
    const next = await getManagedPermissions();
    if (!current(epoch) || ticket !== permissionTicket) return false;
    if (!validPermissions(next)) throw new Error('invalid permissions');
    permissions.value = next;
    if (!can(codes.resolve)) {
      reviewEntry.value = null;
      reviewReason.value = '';
      reviewVerified.value = false;
    }
    if (!can(codes.accountList) || !can(codes.accountDetail)) {
      accounts.value = [];
      regions.value = [];
      accountId.value = undefined;
      regionId.value = undefined;
      clearScope();
    }
    if (!can(codes.list)) {
      listTicket++;
      records.value = [];
      total.value = 0;
    }
    if (!can(codes.detail)) {
      detailTicket++;
      selected.value = null;
    }
    if (!can(codes.history)) {
      historyTicket++;
      history.value = [];
      historyBlocked.value = true;
    }
    return true;
  } catch {
    if (current(epoch) && ticket === permissionTicket) {
      permissions.value = null;
      accounts.value = [];
      regions.value = [];
      records.value = [];
      history.value = [];
      selected.value = null;
      historyBlocked.value = true;
      error.value = '无法确认当前用户权限，请重新登录或重试';
    }
    return false;
  }
}
async function loadAccounts() {
  const epoch = session;
  if (!current(epoch) || !can(codes.accountList)) return;
  try {
    const all: CloudAccount[] = [];
    let expected = -1;
    for (let p = 1; p <= 10; p++) {
      const data = await getCloudAccountListApi({
        page: p,
        size: 100,
        provider: 1,
      });
      if (!current(epoch) || !can(codes.accountList)) return;
      if (
        !Array.isArray(data?.items) ||
        !Number.isSafeInteger(data.total) ||
        data.total < 0 ||
        (expected >= 0 && data.total !== expected)
      )
        throw new Error('invalid page');
      expected = data.total;
      all.push(...data.items);
      if (all.length > expected || data.items.length > 100)
        throw new Error('account list inconsistent');
      if (all.length === expected) {
        accounts.value = all.filter(
          (a) =>
            safeId(a.id) &&
            a.provider === 1 &&
            (a.status === 1 || a.status === 2),
        );
        return;
      }
      if (!data.items.length || all.length >= 1000)
        throw new Error('account list incomplete');
    }
    throw new Error('account list incomplete');
  } catch {
    if (current(epoch)) {
      accounts.value = [];
      error.value = '读取账户失败或数量超过上限，请重试';
    }
  }
}
function clearScope() {
  pendingOperation.value = null;
  operationPointerBusy.value = false;
  operationListBusy.value = false;
  scopeOperationsBlocked.value = true;
  reviewEntry.value = null;
  reviewReason.value = '';
  reviewVerified.value = false;
  reviewError.value = '';
  selection++;
  listTicket++;
  detailTicket++;
  historyTicket++;
  records.value = [];
  history.value = [];
  selected.value = null;
  total.value = 0;
  page.value = 1;
  result.value = null;
  idsText.value = '';
  historyBlocked.value = true;
  localBlocked.value = true;
  error.value = '';
  historyError.value = '';
  detailError.value = '';
  loading.value = false;
  historyLoading.value = false;
}
async function chooseAccount(value?: number) {
  clearScope();
  selectedAccountEnabled.value = false;
  regionId.value = undefined;
  regions.value = [];
  regionError.value = '';
  if (
    !safeId(value) ||
    !accounts.value.some((a) => a.id === value) ||
    !can(codes.accountDetail)
  )
    return;
  const epoch = session,
    ticket = selection;
  regionLoading.value = true;
  try {
    const account = await getCloudAccountDetailApi(value);
    if (
      !current(epoch, ticket) ||
      accountId.value !== value ||
      !can(codes.accountDetail)
    )
      return;
    if (
      account.id !== value ||
      account.provider !== 1 ||
      (account.status !== 1 && account.status !== 2) ||
      !Array.isArray(account.regions)
    )
      throw new Error('account unavailable');
    selectedAccountEnabled.value = account.status === 1;
    regions.value = account.regions.filter(
      (region) =>
        safeId(region.id) &&
        region.cloud_account_id === value &&
        (region.status === 1 || region.status === 2),
    );
  } catch (error) {
    if (shouldRecordPageError(error) && current(epoch, ticket))
      regionError.value = '读取账户地域失败，请重试';
  } finally {
    if (current(epoch, ticket)) regionLoading.value = false;
  }
}
async function loadRecords() {
  const target = scope.value,
    epoch = session,
    selectionAtStart = selection,
    ticket = ++listTicket;
  if (!target || !current(epoch, selectionAtStart) || !can(codes.list)) return;
  loading.value = true;
  try {
    const data = await getManagedResources({
      ...target,
      page: page.value,
      size: pageSize,
    });
    if (
      !current(epoch, selectionAtStart) ||
      ticket !== listTicket ||
      !can(codes.list)
    )
      return;
    if (
      !Array.isArray(data?.items) ||
      !Number.isSafeInteger(data.total) ||
      data.total < 0
    )
      throw new Error('invalid list');
    if (
      data.items.length > pageSize ||
      data.items.some(
        (item) =>
          !safeId(item.id) ||
          item.cloud_account_id !== target.cloud_account_id ||
          item.cloud_account_region_id !== target.cloud_account_region_id ||
          item.kind !== target.kind,
      )
    )
      throw new Error('invalid result scope');
    records.value = data.items;
    total.value = data.total;
  } catch {
    if (current(epoch, selectionAtStart) && ticket === listTicket) {
      records.value = [];
      total.value = 0;
      error.value = '资源列表读取失败，请重试';
    }
  } finally {
    if (current(epoch, selectionAtStart) && ticket === listTicket)
      loading.value = false;
  }
}
function isReviewed(entry: ManagedCloudHistory): boolean {
  return (
    typeof entry.resolved_at === 'string' &&
    !Number.isNaN(Date.parse(entry.resolved_at)) &&
    safeId(entry.resolved_by) &&
    typeof entry.resolution_reason === 'string' &&
    entry.resolution_reason.trim().length >= 10 &&
    entry.retry_safe === true
  );
}
function clearReviewedMarker(
  target: ManagedCloudScope,
  entries: ManagedCloudHistory[],
) {
  try {
    const marker = localStorage.getItem(keyFor(target, owner.value.id!));
    if (
      entries.some(
        (item) => marker === `history:${item.id}` && isReviewed(item),
      )
    ) {
      localStorage.removeItem(keyFor(target, owner.value.id!));
    }
    localBlocked.value = readLocal(target);
  } catch {
    storageUnavailable.value = true;
    localBlocked.value = true;
  }
}
async function loadHistory() {
  const target = scope.value,
    epoch = session,
    selectedScope = selection,
    ticket = ++historyTicket;
  if (!target || !current(epoch, selectedScope) || !can(codes.history)) {
    historyBlocked.value = true;
    return false;
  }
  historyLoading.value = true;
  historyBlocked.value = true;
  historyError.value = '';
  try {
    const all: ManagedCloudHistory[] = [];
    const seen = new Set<number>();
    let expected = -1;
    for (let p = 1; p <= 10; p++) {
      const data = await getManagedSyncHistory({
        ...target,
        page: p,
        size: 100,
      });
      if (
        !current(epoch, selectedScope) ||
        ticket !== historyTicket ||
        !can(codes.history)
      )
        return false;
      if (
        !Array.isArray(data?.items) ||
        !Number.isSafeInteger(data.total) ||
        data.total < 0 ||
        (expected >= 0 && expected !== data.total)
      )
        throw new Error('invalid history');
      expected = data.total;
      if (
        data.items.length > 100 ||
        data.items.some(
          (item) =>
            !safeId(item.id) ||
            seen.has(item.id) ||
            item.cloud_account_id !== target.cloud_account_id ||
            item.cloud_account_region_id !== target.cloud_account_region_id ||
            item.kind !== target.kind ||
            !['running', 'success', 'failed', 'cancelled', 'unknown'].includes(
              item.status,
            ) ||
            (item.retry_safe !== undefined &&
              typeof item.retry_safe !== 'boolean'),
        )
      )
        throw new Error('invalid history scope');
      for (const item of data.items) {
        if (seen.has(item.id)) throw new Error('duplicate history');
        seen.add(item.id);
      }
      all.push(...data.items);
      if (all.length > expected) throw new Error('history count inconsistent');
      if (all.length === expected) {
        history.value = all.slice(0, 20);
        historyBlocked.value = all.some(
          (item) =>
            !isReviewed(item) &&
            (item.status === 'unknown' ||
              item.status === 'running' ||
              item.retry_safe === false ||
              (['failed', 'cancelled'].includes(item.status) &&
                item.retry_safe !== true)),
        );
        clearReviewedMarker(target, all);
        return true;
      }
      if (!data.items.length || all.length >= 1000)
        throw new Error('history incomplete');
    }
    throw new Error('history incomplete');
  } catch {
    if (current(epoch, selectedScope) && ticket === historyTicket) {
      history.value = [];
      historyBlocked.value = true;
      historyError.value = '无法完整核对同步历史，暂不能同步';
    }
    return false;
  } finally {
    if (current(epoch, selectedScope) && ticket === historyTicket)
      historyLoading.value = false;
  }
}
function refreshScope() {
  operationRefresh.value++;
  const target = scope.value;
  if (!target) return;
  localBlocked.value = readLocal(target);
  void loadRecords();
  void loadHistory();
}
function chooseRegion() {
  clearScope();
  refreshScope();
}
function chooseKind() {
  clearScope();
  refreshScope();
}
function changePage(next: number) {
  page.value = next;
  void loadRecords();
}
async function showDetail(item: ManagedCloudResource) {
  const target = scope.value,
    epoch = session,
    ticket = ++detailTicket,
    selectionAtStart = selection;
  if (!target || !safeId(item.id) || !can(codes.detail)) return;
  detailError.value = '';
  selected.value = null;
  try {
    const data = await getManagedResourceDetail(item.id, target);
    if (
      !current(epoch, selectionAtStart) ||
      ticket !== detailTicket ||
      !can(codes.detail)
    )
      return;
    if (
      data.id !== item.id ||
      data.cloud_account_id !== target.cloud_account_id ||
      data.cloud_account_region_id !== target.cloud_account_region_id ||
      data.kind !== target.kind
    )
      throw new Error('invalid scope');
    selected.value = data;
  } catch (error) {
    if (
      shouldRecordPageError(error) &&
      current(epoch, selectionAtStart) &&
      ticket === detailTicket
    )
      detailError.value = '资源详情读取失败';
  }
}
function closeDetail() {
  detailTicket++;
  selected.value = null;
}
async function sync() {
  const target = scope.value,
    epoch = session,
    selectionAtStart = selection,
    userId = owner.value.id;
  if (!target || !userId || !canSync.value) return;
  if (idsText.value.length > 12000) {
    message.warning('资源 ID 文本不能超过12000字符');
    return;
  }
  const ids = idsText.value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !idPattern.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    message.warning('请输入1至100个不重复的有效资源 ID');
    return;
  }
  syncing.value = true;
  result.value = null;
  try {
    if (
      !(await refreshPermissions(epoch)) ||
      !current(epoch, selectionAtStart) ||
      !scopeAllowed.value ||
      !can(codes.sync) ||
      !can(codes.history) ||
      !can(codes.operationRead) ||
      !can(codes.operationList)
    )
      return;
    // Recheck history immediately before dispatch; a failed check always blocks.
    if (
      !(await loadHistory()) ||
      !current(epoch, selectionAtStart) ||
      historyBlocked.value ||
      readLocal(target)
    ) {
      if (current(epoch, selectionAtStart))
        localBlocked.value = readLocal(target);
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      error.value = '当前环境无法安全生成操作 ID，本次未提交';
      return;
    }
    const marker: ManagedOperationMarker = {
      version: 2,
      operation_id: globalThis.crypto.randomUUID(),
      resource_ids: ids,
    };
    if (!saveManagedMarker(localStorage, keyFor(target, userId), marker)) {
      localBlocked.value = true;
      storageUnavailable.value = true;
      return;
    }
    localBlocked.value = readLocal(target);
    const response = await syncManagedResources({
      ...target,
      resource_ids: ids,
      operation_id: marker.operation_id,
    });
    if (!current(epoch, selectionAtStart)) return;
    if (
      !response ||
      response.operation_id !== marker.operation_id ||
      !['success', 'failed', 'cancelled', 'unknown'].includes(
        response.status,
      ) ||
      typeof response.retry_safe !== 'boolean' ||
      !Number.isSafeInteger(response.count) ||
      !Number.isSafeInteger(response.new_count) ||
      !Number.isSafeInteger(response.update_count) ||
      response.count < 0 ||
      response.count > 100 ||
      response.new_count < 0 ||
      response.update_count < 0 ||
      response.new_count + response.update_count > response.count
    )
      throw new Error('invalid result');
    if (
      response.status === 'success' &&
      (!response.retry_safe ||
        !safeId(response.history_id) ||
        !!response.error_category ||
        response.count !== ids.length ||
        response.new_count + response.update_count !== response.count)
    )
      throw new Error('inconsistent success');
    result.value = response;
    if (
      response.status !== 'unknown' &&
      response.retry_safe === true &&
      !['audit_unavailable', 'commit_unknown_audit_unavailable'].includes(
        response.error_category ?? '',
      )
    ) {
      removeManagedMarker(
        localStorage,
        keyFor(target, userId),
        marker.operation_id,
      );
      localBlocked.value = readLocal(target);
    }
    if (response.status === 'success') message.success('指定资源同步完成');
    else if (response.status === 'unknown' || response.retry_safe === false)
      message.warning('同步结果未确认，请先核对历史，不能直接重试');
    else message.warning('同步未完成，请查看历史');
    await Promise.all([loadRecords(), loadHistory()]);
    operationRefresh.value++;
  } catch (err) {
    if (current(epoch, selectionAtStart)) {
      localBlocked.value = true;
      error.value = '同步结果未确认，请先核对历史，不能直接重试';
      if (shouldNotifyPageError(err)) message.error(error.value);
    }
  } finally {
    if (current(epoch)) syncing.value = false;
  }
}
async function acknowledgeOperation(
  operationID: string,
  operationOwner: number,
) {
  const target = scope.value,
    epoch = session,
    selectedScope = selection,
    userId = owner.value.id;
  if (!target || !userId) return;
  if (!(await loadHistory()) || !current(epoch, selectedScope)) return;
  if (
    operationOwner === Number(userId) &&
    pendingOperation.value?.operation_id === operationID
  ) {
    removeManagedMarker(localStorage, keyFor(target, userId), operationID);
    localBlocked.value = readLocal(target);
    if (!localBlocked.value) {
      error.value = '';
      message.success('已核对持久操作记录；新的同步仍需明确发起');
    }
  }
  operationRefresh.value++;
  void loadRecords();
}
function onStorage(event: StorageEvent) {
  const target = scope.value;
  if (target && owner.value.id && event.key === keyFor(target, owner.value.id))
    localBlocked.value = readLocal(target);
}
window.addEventListener('storage', onStorage);
function openReview(entry: ManagedCloudHistory) {
  if (
    !can(codes.resolve) ||
    syncing.value ||
    reviewing.value ||
    isReviewed(entry)
  )
    return;
  reviewEntry.value = entry;
  reviewReason.value = '';
  reviewVerified.value = false;
  reviewError.value = '';
  reviewUncertain.value = false;
}
async function submitReview() {
  const entry = reviewEntry.value,
    target = scope.value,
    epoch = session,
    selectedScope = selection;
  if (
    !entry ||
    !target ||
    reviewing.value ||
    reviewUncertain.value ||
    !reviewVerified.value ||
    !can(codes.resolve)
  )
    return;
  const reason = reviewReason.value.trim();
  if ([...reason].length < 10 || [...reason].length > 1000) {
    reviewError.value = '请填写10至1000字的核对理由';
    return;
  }
  reviewing.value = true;
  reviewError.value = '';
  try {
    if (
      !(await refreshPermissions(epoch)) ||
      !current(epoch, selectedScope) ||
      !can(codes.resolve) ||
      !can(codes.history)
    )
      return;
    await resolveManagedHistory(entry.id, {
      ...target,
      resources_verified: true,
      reason,
    });
    if (!current(epoch, selectedScope)) return;
    if (!(await loadHistory()) || !current(epoch, selectedScope)) {
      if (current(epoch, selectedScope)) reviewUncertain.value = true;
      return;
    }
    if (
      !history.value.some((item) => item.id === entry.id && isReviewed(item))
    ) {
      reviewUncertain.value = true;
      reviewError.value = '尚未读取到持久核对记录，请先刷新历史，不要重复提交';
      return;
    }
    reviewEntry.value = null;
    operationRefresh.value++;
    message.success('核对记录已保存，原同步结果保持不变');
  } catch {
    if (current(epoch, selectedScope)) {
      reviewUncertain.value = true;
      reviewError.value = '核对结果未确认，请先刷新历史；请勿盲目重复提交';
    }
  } finally {
    if (current(epoch)) reviewing.value = false;
  }
}
watch(
  [() => owner.value.authenticated, () => owner.value.id],
  () => {
    session++;
    selection++;
    listTicket++;
    detailTicket++;
    permissionTicket++;
    historyTicket++;
    reviewEntry.value = null;
    reviewReason.value = '';
    reviewVerified.value = false;
    reviewError.value = '';
    reviewing.value = false;
    permissions.value = null;
    accounts.value = [];
    regions.value = [];
    accountId.value = undefined;
    regionId.value = undefined;
    selectedAccountEnabled.value = false;
    kind.value = 'rds';
    records.value = [];
    history.value = [];
    selected.value = null;
    total.value = 0;
    result.value = null;
    idsText.value = '';
    pendingOperation.value = null;
    operationPointerBusy.value = false;
    operationListBusy.value = false;
    scopeOperationsBlocked.value = true;
    historyBlocked.value = true;
    localBlocked.value = true;
    storageUnavailable.value = false;
    syncing.value = false;
    loading.value = false;
    historyLoading.value = false;
    regionLoading.value = false;
    error.value = '';
    regionError.value = '';
    historyError.value = '';
    detailError.value = '';
    const epoch = session;
    if (authenticated())
      void refreshPermissions(epoch).then((ok) => {
        if (ok && current(epoch)) void loadAccounts();
      });
  },
  { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => {
  alive = false;
  session++;
  selection++;
  listTicket++;
  detailTicket++;
  permissionTicket++;
  historyTicket++;
  window.removeEventListener('storage', onStorage);
});
</script>

<template>
  <section class="managed-resources" aria-label="托管资源管理">
    <h2>托管资源</h2>
    <a-alert
      type="info"
      show-icon
      message="当前仅支持阿里云 RDS、传统型 CLB 与 Tair/Redis/Memcache 的指定 ID 增量同步；不支持全量删除、ALB/NLB 或其他厂商。"
    />
    <a-alert v-if="error" type="error" :message="error" show-icon />
    <a-alert
      v-if="!can(codes.accountList) || !can(codes.accountDetail)"
      type="warning"
      message="当前用户缺少账户或地域读取权限"
      show-icon
    />
    <div class="managed-filters">
      <a-select
        v-model:value="accountId"
        aria-label="托管资源账户"
        placeholder="选择阿里云账户（停用可核对）"
        :disabled="
          syncing ||
          reviewing ||
          operationBusy ||
          !can(codes.accountList) ||
          !can(codes.accountDetail)
        "
        :options="
          accounts.map((a) => ({
            value: a.id,
            label: a.status === 2 ? `${a.name}（已停用）` : a.name,
          }))
        "
        @change="chooseAccount"
      />
      <a-select
        v-model:value="regionId"
        aria-label="托管资源地域"
        placeholder="选择地域（停用可核对）"
        :disabled="
          syncing || reviewing || operationBusy || regionLoading || !accountId
        "
        :loading="regionLoading"
        :options="
          regions.map((r) => ({
            value: r.id,
            label: `${r.region_name || r.region}${r.status === 2 ? '（已停用）' : ''}`,
          }))
        "
        @change="chooseRegion"
      />
      <a-select
        v-model:value="kind"
        aria-label="托管资源类型"
        :disabled="syncing || reviewing || operationBusy"
        @change="chooseKind"
      >
        <a-select-option value="rds">RDS 数据库</a-select-option
        ><a-select-option value="clb">传统型负载均衡 CLB</a-select-option
        ><a-select-option value="cache">缓存实例</a-select-option>
      </a-select>
    </div>
    <a-alert v-if="regionError" type="error" :message="regionError" show-icon />
    <a-alert
      v-if="accountId && !regionLoading && !regions.length && !regionError"
      type="info"
      message="该账户没有配置地域"
      show-icon
    />
    <template v-if="scope">
      <a-alert
        v-if="
          !selectedAccountEnabled ||
          !regions.some((r) => r.id === regionId && r.status === 1)
        "
        type="info"
        message="该范围已停用，可查询和记录核对，不能发起同步"
        show-icon
      />
      <div class="managed-sync">
        <label for="managed-resource-ids"
          >资源 ID（1–100 个，以换行或逗号分隔）</label
        >
        <a-textarea
          id="managed-resource-ids"
          v-model:value="idsText"
          :maxlength="12000"
          :disabled="syncing || reviewing || operationBusy"
          :rows="3"
          placeholder="例如 rm-example"
        />
        <a-button
          type="primary"
          :loading="syncing"
          :disabled="!canSync"
          @click="sync"
        >
          同步指定 ID
        </a-button>
      </div>
      <CloudManagedOperationsList
        :scope="scope"
        :viewer="String(owner.id)"
        :super-admin="permissions?.super_admin === true"
        :can-list="can(codes.operationList)"
        :can-read="can(codes.operationRead)"
        :can-review="can(codes.operationReview)"
        :refresh-token="operationRefresh"
        :authorize="
          async () =>
            (await refreshPermissions(session)) &&
            can(codes.operationRead) &&
            can(codes.operationReview)
        "
        @blocked="scopeOperationsBlocked = $event"
        @busy="operationListBusy = $event"
        @acknowledged="acknowledgeOperation"
      />
      <CloudManagedOperationRecovery
        v-if="pendingOperation"
        :key="`${owner.id}:${pendingOperation.operation_id}`"
        :marker="pendingOperation"
        :scope="scope"
        :owner="String(owner.id)"
        :can-read="can(codes.operationRead)"
        :can-review="can(codes.operationReview)"
        :authorize="
          async () =>
            (await refreshPermissions(session)) &&
            can(codes.operationRead) &&
            can(codes.operationReview)
        "
        @acknowledged="acknowledgeOperation"
        @busy="operationPointerBusy = $event"
      />
      <a-alert
        v-if="!can(codes.operationRead)"
        type="warning"
        message="缺少操作查询权限，无法安全发起同步"
        show-icon
      />
      <a-alert
        v-if="!can(codes.history)"
        type="warning"
        message="缺少同步历史权限，无法安全发起同步"
        show-icon
      />
      <a-alert
        v-else-if="historyError"
        type="warning"
        :message="historyError"
        show-icon
      />
      <a-alert
        v-else-if="historyBlocked || localBlocked"
        type="warning"
        show-icon
        :message="
          storageUnavailable
            ? '本机同步状态不可用，暂不能安全同步'
            : '该范围存在未确认操作，请先核对资源与历史；当前不能直接重试。'
        "
      />
      <a-alert
        v-if="result"
        :type="result.status === 'success' ? 'success' : 'warning'"
        show-icon
        :message="
          result.status === 'success'
            ? `已同步 ${result.count} 项`
            : '同步未完成或结果未知，请核对历史'
        "
        :description="
          result.history_id
            ? `历史记录 ${result.history_id}`
            : '没有可确认的持久历史记录'
        "
      />
      <div class="managed-header">
        <h3>{{ kindName[kind] }}</h3>
        <a-button
          :loading="loading || historyLoading"
          :disabled="syncing || reviewing || operationBusy"
          @click="refreshScope"
        >
          刷新资源与历史
        </a-button>
      </div>
      <a-alert
        v-if="!can(codes.list)"
        type="info"
        message="当前用户无托管资源列表权限"
        show-icon
      />
      <a-table
        v-else
        :data-source="records"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 700 }"
      >
        <a-table-column title="资源 ID" key="provider_id">
          <template #default="{ record }">
            {{
              idPattern.test(record.provider_id ?? '')
                ? record.provider_id
                : '—'
            }}
          </template>
        </a-table-column>
        <a-table-column title="名称" key="name">
          <template #default="{ record }">
            {{
              safeText(
                record.rds?.name ?? record.clb?.name ?? record.cache?.name,
              )
            }}
          </template>
        </a-table-column>
        <a-table-column title="状态" key="status">
          <template #default="{ record }">
            {{
              safeText(
                record.rds?.status ??
                  record.clb?.status ??
                  record.cache?.status,
              )
            }}
          </template>
        </a-table-column>
        <a-table-column title="最近同步" key="time">
          <template #default="{ record }">
            {{ dateText(record.last_sync_time) }}
          </template>
        </a-table-column>
        <a-table-column title="操作" key="action">
          <template #default="{ record }">
            <a-button
              v-if="can(codes.detail)"
              type="link"
              :disabled="!safeId(record.id)"
              @click="showDetail(record)"
            >
              详情
            </a-button>
          </template>
        </a-table-column>
      </a-table>
      <a-pagination
        v-if="total > pageSize"
        :current="page"
        :total="total"
        :page-size="pageSize"
        :show-size-changer="false"
        @change="changePage"
      />
      <a-alert
        v-if="detailError"
        type="error"
        :message="detailError"
        show-icon
      />
      <h3>最近同步历史</h3>
      <a-spin v-if="can(codes.history)" :spinning="historyLoading">
        <p v-if="!history.length && !historyLoading && !historyError">
          暂无历史
        </p>
        <ul v-else class="managed-history">
          <li v-for="entry in history" :key="entry.id">
            {{ dateText(entry.started_at) }} ·
            {{ stateName[entry.status] ?? '未知状态' }} ·
            {{
              Array.isArray(entry.resource_ids)
                ? entry.resource_ids
                    .filter((id) => idPattern.test(id))
                    .join(', ')
                : '—'
            }}
            ·
            {{
              isReviewed(entry)
                ? '已人工核对'
                : entry.retry_safe === false
                  ? '不可直接重试'
                  : '请按结果核对'
            }}
            <template v-if="isReviewed(entry)">
              · {{ dateText(entry.resolved_at) }} · 操作人
              {{ entry.resolved_by }} · {{ entry.resolution_reason }}
            </template>
            <a-button
              v-else-if="
                can(codes.resolve) &&
                (!entry.operation_id ||
                  entry.operation_id !== pendingOperation?.operation_id) &&
                ['unknown', 'running', 'success'].includes(entry.status)
              "
              type="link"
              :disabled="syncing || reviewing || operationBusy"
              @click="openReview(entry)"
            >
              记录人工核对
            </a-button>
          </li>
        </ul>
      </a-spin>
    </template>
    <a-modal
      :open="!!reviewEntry"
      title="记录人工核对"
      ok-text="保存核对记录"
      :confirm-loading="reviewing"
      :closable="!reviewing"
      :mask-closable="false"
      :cancel-button-props="{ disabled: reviewing }"
      :ok-button-props="{
        disabled: !reviewVerified || reviewUncertain || !can(codes.resolve),
      }"
      @ok="submitReview"
      @cancel="reviewEntry = null"
    >
      <template v-if="reviewEntry">
        <p>
          请先核对云端实际资源与本地记录。此操作只保存核对依据，不会重新同步或将原结果改为成功。
        </p>
        <p>
          历史 {{ reviewEntry?.id }}：{{
            reviewEntry?.resource_ids?.join(', ')
          }}
        </p>
        <label for="managed-review-reason">核对依据与结果</label>
        <a-textarea
          id="managed-review-reason"
          v-model:value="reviewReason"
          :disabled="reviewing"
          :rows="4"
          :maxlength="1000"
        />
        <a-checkbox v-model:checked="reviewVerified" :disabled="reviewing">
          已核对实际资源与本地状态
        </a-checkbox>
        <a-alert
          v-if="reviewError"
          type="warning"
          :message="reviewError"
          show-icon
        />
      </template>
    </a-modal>
    <a-drawer
      :open="!!selected"
      title="托管资源详情"
      width="min(600px, 100vw)"
      @close="closeDetail"
    >
      <template v-if="selected">
        <p>
          资源 ID：{{
            idPattern.test(selected.provider_id ?? '')
              ? selected.provider_id
              : '—'
          }}
        </p>
        <template v-if="selected.kind === 'rds' && selected.rds">
          <p>
            数据库引擎：{{ safeText(selected.rds.engine) }}
            {{ safeText(selected.rds.engine_version) }}
          </p>
          <p>实例规格：{{ safeText(selected.rds.instance_class) }}</p>
          <p>可用区：{{ safeText(selected.rds.zone) }}</p>
        </template>
        <template v-else-if="selected.kind === 'clb' && selected.clb">
          <p>地址类型：{{ safeText(selected.clb.address_type) }}</p>
          <p>VPC：{{ safeText(selected.clb.vpc_id) }}</p>
        </template>
        <template v-else-if="selected.kind === 'cache' && selected.cache">
          <p>缓存类型：{{ safeText(selected.cache.instance_type) }}</p>
          <p>引擎版本：{{ safeText(selected.cache.engine_version) }}</p>
          <p>实例规格：{{ safeText(selected.cache.instance_class) }}</p>
        </template>
      </template>
    </a-drawer>
  </section>
</template>

<style scoped>
.managed-resources {
  display: grid;
  gap: var(--ops-space-md);
  margin: var(--ops-space-lg) 0;
}
.managed-resources h2,
.managed-resources h3 {
  margin: 0;
}
.managed-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ops-space-sm);
}
.managed-sync {
  display: grid;
  gap: var(--ops-space-xs);
  justify-items: start;
}
.managed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ops-space-sm);
}
.managed-history {
  margin: 0;
  padding-left: 20px;
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  .managed-filters {
    grid-template-columns: 1fr;
  }
}
</style>
