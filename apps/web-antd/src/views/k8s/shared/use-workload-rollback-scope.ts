import type { Ref } from 'vue';
import { getCurrentScope, onScopeDispose, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

interface RollbackResource {
  cluster_id?: unknown;
  name?: unknown;
  namespace?: unknown;
  uid?: unknown;
}

interface RollbackScopeState {
  cluster: Readonly<Ref<unknown>>;
  namespace: Readonly<Ref<unknown>>;
  target: Readonly<Ref<null | RollbackResource | undefined>>;
  visible: Readonly<Ref<boolean>>;
}

interface RollbackTicket {
  authGeneration: number;
  clusterId: number;
  confirmation: number;
  filterCluster: unknown;
  filterNamespace: unknown;
  name: string;
  namespace: string;
  revision: number;
  scopeRevision: number;
  uid: string;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function resourceName(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value === '.' ||
    value === '..' ||
    /[#%/?\\]/.test(value)
  )
    return false;
  // 字段直接进入API路径；拒绝ASCII空白/控制，不在这里重建完整DNS命名规则。
  return ![...value].some((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && (code <= 32 || code === 127);
  });
}

function ownerUid(): string {
  const value = useUserStore().userInfo?.userId;
  if (typeof value === 'number')
    return positiveInteger(value) ? String(value) : '';
  return typeof value === 'string' && value.trim() && value.trim() !== '0'
    ? value.trim()
    : '';
}

/** 确认框只能提交打开时的历史窗口、资源及登录会话；迟到结果不再操作新窗口。 */
export function useWorkloadRollbackScope(state: RollbackScopeState) {
  let active = true;
  let scopeRevision = 0;
  let confirmation = 0;
  let submittedConfirmation = 0;

  watch(
    [
      state.visible,
      state.target,
      state.cluster,
      state.namespace,
      () => state.target.value?.cluster_id,
      () => state.target.value?.name,
      () => state.target.value?.namespace,
      () => state.target.value?.uid,
      ownerUid,
      () => useAuthStore().getAuthGeneration(),
    ],
    () => {
      scopeRevision++;
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => {
    active = false;
    scopeRevision++;
  });

  function sameOwnerAndFilters(ticket: RollbackTicket) {
    return (
      active &&
      ticket.uid === ownerUid() &&
      ticket.authGeneration === useAuthStore().getAuthGeneration() &&
      ticket.filterCluster === state.cluster.value &&
      ticket.filterNamespace === state.namespace.value
    );
  }

  function current(ticket: RollbackTicket) {
    return (
      state.visible.value &&
      ticket.scopeRevision === scopeRevision &&
      ticket.confirmation === confirmation &&
      sameOwnerAndFilters(ticket)
    );
  }

  function capture(revision: unknown): RollbackTicket | undefined {
    const target = state.target.value;
    const uid = ownerUid();
    const authGeneration = useAuthStore().getAuthGeneration();
    if (!active || !state.visible.value || !target || !uid) return;
    if (!Number.isSafeInteger(authGeneration) || authGeneration < 0) return;

    // 仅缺失的记录 ID 可以借用筛选集群；显式非法 ID 不得被回退掩盖。
    const clusterId = target.cluster_id ?? state.cluster.value;
    if (!positiveInteger(clusterId)) {
      message.error('无效的集群ID，请重新选择集群');
      return;
    }
    if (
      !positiveInteger(revision) ||
      !resourceName(target.namespace) ||
      !resourceName(target.name)
    ) {
      message.error('回滚目标或版本无效，请重新打开版本历史后重试');
      return;
    }
    return {
      authGeneration,
      clusterId,
      confirmation: ++confirmation,
      filterCluster: state.cluster.value,
      filterNamespace: state.namespace.value,
      name: target.name,
      namespace: target.namespace,
      revision,
      scopeRevision,
      uid,
    };
  }

  function begin(ticket: RollbackTicket) {
    if (!current(ticket) || submittedConfirmation === ticket.confirmation)
      return false;
    submittedConfirmation = ticket.confirmation;
    return true;
  }

  function cancel(ticket: RollbackTicket) {
    if (ticket.confirmation === confirmation) confirmation++;
  }

  return { begin, cancel, capture, current, sameOwnerAndFilters };
}

interface WorkloadRevision {
  date: string;
  message: string;
  revision: number;
}

interface HistoryScopeState<Resource extends RollbackResource> {
  cluster: Readonly<Ref<unknown>>;
  history: Ref<WorkloadRevision[]>;
  namespace: Readonly<Ref<unknown>>;
  read: (
    cluster: number,
    namespace: string,
    name: string,
  ) => Promise<{ items?: WorkloadRevision[] } | null | undefined>;
  target: Ref<null | Resource>;
  visible: Ref<boolean>;
}

/** 历史读取与回滚确认共享同一业务窗口，旧版本列表不得被新目标认领。 */
export function useWorkloadHistoryScope<Resource extends RollbackResource>(
  state: HistoryScopeState<Resource>,
) {
  const loading = ref(false);
  let active = true;
  let request = 0;
  let loaded = false;
  let stopOwnerWatch: ReturnType<typeof watch> | undefined;
  let ticket:
    | {
        clusterId: number;
        filterCluster: unknown;
        filterNamespace: unknown;
        name: string;
        namespace: string;
        owner: string;
        request: number;
        target: Resource;
        uid: unknown;
      }
    | undefined;

  function owner() {
    const uid = ownerUid();
    const generation = useAuthStore().getAuthGeneration();
    return uid && Number.isSafeInteger(generation) && generation >= 0
      ? JSON.stringify([uid, generation])
      : '';
  }

  function sameTarget(current: NonNullable<typeof ticket>) {
    return (
      state.target.value === current.target &&
      current.target.cluster_id === current.clusterId &&
      current.target.name === current.name &&
      current.target.namespace === current.namespace &&
      current.target.uid === current.uid
    );
  }

  function current(currentTicket: NonNullable<typeof ticket>) {
    return (
      active &&
      ticket === currentTicket &&
      currentTicket.request === request &&
      currentTicket.owner === owner() &&
      currentTicket.filterCluster === state.cluster.value &&
      currentTicket.filterNamespace === state.namespace.value &&
      sameTarget(currentTicket)
    );
  }

  function close() {
    request++;
    const previous = ticket;
    ticket = undefined;
    loaded = false;
    state.visible.value = false;
    state.history.value = [];
    loading.value = false;
    // 其它详情/YAML窗口也复用该ref，关闭历史不能清掉它们的新目标。
    if (previous && state.target.value === previous.target)
      state.target.value = null;
  }

  watch(
    [state.cluster, state.namespace],
    () => {
      if (ticket) close();
    },
    { flush: 'sync' },
  );
  watch(
    [
      state.target,
      () => state.target.value?.cluster_id,
      () => state.target.value?.name,
      () => state.target.value?.namespace,
      () => state.target.value?.uid,
    ],
    () => {
      if (ticket && !sameTarget(ticket)) close();
    },
    { flush: 'sync' },
  );
  watch(
    state.visible,
    (visible) => {
      if (!visible && loaded) close();
    },
    { flush: 'sync' },
  );
  if (getCurrentScope()) {
    onScopeDispose(() => {
      active = false;
      stopOwnerWatch?.();
      close();
    });
  }

  async function show(record: Resource) {
    if (!active) return;
    const sessionOwner = owner();
    if (!sessionOwner) return;
    const clusterId = record.cluster_id ?? state.cluster.value;
    if (!positiveInteger(clusterId)) {
      message.error('无效的集群ID，请重新选择集群');
      return;
    }
    if (!resourceName(record.name) || !resourceName(record.namespace)) {
      message.error('回滚目标或版本无效，请重新打开版本历史后重试');
      return;
    }
    // 延后注册只读身份watch：其它列表操作无需提前初始化历史会话依赖。
    stopOwnerWatch ??= watch(owner, close, { flush: 'sync' });
    close();
    state.target.value = { ...record, cluster_id: clusterId };
    const currentTicket = {
      clusterId,
      filterCluster: state.cluster.value,
      filterNamespace: state.namespace.value,
      name: record.name,
      namespace: record.namespace,
      owner: sessionOwner,
      request: ++request,
      target: state.target.value,
      uid: record.uid,
    };
    ticket = currentTicket;
    loading.value = true;
    try {
      const result = await state.read(
        clusterId,
        currentTicket.namespace,
        currentTicket.name,
      );
      if (!current(currentTicket)) return;
      state.history.value = result?.items || [];
      loaded = true;
      state.visible.value = true;
    } catch (error) {
      if (current(currentTicket) && shouldNotifyPageError(error))
        message.error('获取版本历史失败');
    } finally {
      if (current(currentTicket)) loading.value = false;
    }
  }

  function isCurrent() {
    return !!ticket && loaded && state.visible.value && current(ticket);
  }

  return { close, isCurrent, loading, show };
}
