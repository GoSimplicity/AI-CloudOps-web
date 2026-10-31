import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useAccessStore } from '@vben/stores';
import { usePermission } from '#/utils/permission';
import { message } from 'ant-design-vue';
import {
  type AutoFixAction,
  type AutoFixInfoResponse,
  type AutoFixOperation,
  type AutoFixReadyResponse,
  type AutoFixWorkflowRequest,
  type AutoFixWorkflowResponse,
  confirmAutoFixWorkflow,
  executeAutoFixWorkflow,
  getAutoFixHistory,
  getAutoFixInfo,
  getAutoFixOperation,
  getAutoFixPlan,
  getAutoFixReady,
} from '#/api/core/aiops/autofix';
import { useAiRequestScope } from '../assistant/useAiRequestScope';
import { reportAutoFixOutcomeUncertain } from './autofix-errors';
import {
  readOperationId,
  removeOperationId,
  saveOperationId,
} from './operation-storage';

const templates = {
  crashloop: {
    event: 'CrashLoopBackOff: 容器启动后反复退出，需要检查日志、探针和配置。',
    problem_description:
      'Deployment 出现 CrashLoopBackOff，业务实例反复重启，请生成候选修复动作并评估自动执行风险。',
  },
  custom: { event: '', problem_description: '' },
  imagepull: {
    event:
      'ImagePullBackOff: failed to pull image，可能和镜像地址、Secret或网络连通性有关。',
    problem_description:
      'Deployment 镜像拉取失败，请检查镜像地址、镜像拉取密钥和网络连通性，并给出可控修复动作。',
  },
  resource: {
    event:
      'FailedScheduling: insufficient cpu or insufficient memory，当前资源不足导致Pod无法调度。',
    problem_description:
      'Deployment 资源不足，Pod调度失败或负载过高，请规划扩容副本或调整资源请求的修复动作。',
  },
};
export type AutoFixTemplateKey = keyof typeof templates;

/** 请求只由明确操作触发，审批状态与当前可信账户共同决定可操作范围 */
export function useAutoFixWorkflow() {
  const { can, hasPerm } = usePermission();
  const access = useAccessStore();
  const templateKey = ref<AutoFixTemplateKey>('custom');
  const running = ref(false);
  const confirmLoading = ref(false);
  const infoLoading = ref(false);
  const showRawDrawer = ref(false);
  const serviceInfo = ref<AutoFixInfoResponse>();
  const readyInfo = ref<AutoFixReadyResponse>();
  const workflowResult = ref<AutoFixWorkflowResponse>();
  const selectedBlockedActionIds = ref<string[]>([]);
  const workflowError = ref('');
  const recoveryError = ref('');
  const historyError = ref('');
  const currentOperationId = ref('');
  const currentPlanId = ref('');
  const operationState = ref<
    | 'none'
    | 'unverified'
    | 'not_found'
    | 'pending'
    | 'running'
    | 'completed'
    | 'uncertain'
    | 'invalidated'
  >('none');
  const operationDetail = ref<AutoFixOperation>();
  const operationHistory = ref<AutoFixOperation[]>([]);
  const historyLoading = ref(false);
  const historyLoaded = ref(false);
  const recoveryLoading = ref(false);
  let retrySnapshot: AutoFixWorkflowRequest | undefined;
  let resultSource: 'workflow' | 'confirm' | 'operation' | 'plan' | '' = '';
  const infoError = ref('');
  const resultOwner = ref('');
  const now = ref(Date.now());
  const formData = reactive({
    deployment: '',
    event: '',
    namespace: 'default',
    problem_description: '',
  });
  const scope = useAiRequestScope(resetForOwner);
  const workflowLane = scope.createLane();
  const infoLane = scope.createLane();
  const recoveryLane = scope.createLane();
  const historyLane = scope.createLane();
  const busy = computed(
    () => running.value || confirmLoading.value || recoveryLoading.value,
  );
  const canStartWorkflow = computed(
    () =>
      !['unverified', 'running', 'uncertain'].includes(operationState.value),
  );
  const canReadHistory = computed(() =>
    hasPerm('/api/v1/autofix/workflow/history'),
  );
  const canReadOperation = computed(() =>
    hasPerm('/api/v1/autofix/workflow/operations/:operation_id'),
  );
  const canReadPlan = computed(() =>
    hasPerm('/api/v1/autofix/workflow/plans/:plan_id'),
  );
  const isFormValid = computed(
    () =>
      !!scope.owner.value &&
      !!formData.namespace.trim() &&
      !!formData.problem_description.trim(),
  );
  // SEC-25/26：只允许确认 pending_action_ids 里的动作（confirm 只接受当前待确认项）；
  // 复审 P3-1：缺这个字段时一律视为没有可确认的动作，不发请求
  const pendingActionIds = computed(() => {
    const ids = workflowResult.value?.approval?.pending_action_ids;
    return new Set(Array.isArray(ids) ? ids : []);
  });
  const confirmableBlockedActions = computed(() =>
    (workflowResult.value?.blocked_actions || []).filter(
      (action): action is { action_id: string } & AutoFixAction => {
        const risk = action.risk_assessment;
        return (
          typeof action.action_id === 'string' &&
          !!action.action_id &&
          pendingActionIds.value.has(action.action_id) &&
          action.executable === true &&
          risk?.namespace_allowed === true &&
          risk.permission_allowed === true &&
          risk.resource_exists === true
        );
      },
    ),
  );
  const approvalIssue = computed(() => {
    if (!workflowResult.value) return '';
    const approval = workflowResult.value.approval;
    if (resultOwner.value !== scope.owner.value)
      return '此结果不属于当前账户，请重新诊断';
    if (!workflowResult.value.plan?.plan_id)
      return '计划标识缺失，无法确认动作';
    // pending 由 status + approval 字段共同决定（规则 3）
    if (
      !approval ||
      approval.state !== 'pending' ||
      approval.confirmation_required === false
    )
      return '当前结果没有有效的待审批元数据，请核对后重新诊断';
    const expiry = Date.parse(approval.expires_at);
    if (!Number.isFinite(expiry) || now.value >= expiry)
      return '审批已过期，请先核对目标实际状态，再重新诊断';
    return '';
  });
  function canConfirmActions(ids: string[]) {
    return (
      workflowResult.value?.status === 'needs_human_confirmation' &&
      !approvalIssue.value &&
      !busy.value &&
      can('aiops.autofix.confirm') &&
      ids.length > 0 &&
      ids.every((id) =>
        confirmableBlockedActions.value.some(
          (action) => action.action_id === id,
        ),
      )
    );
  }
  const canConfirmWorkflow = computed(() =>
    canConfirmActions(selectedBlockedActionIds.value),
  );
  const canConfirmAll = computed(() =>
    canConfirmActions(
      confirmableBlockedActions.value.map((action) => action.action_id),
    ),
  );

  function clearResult() {
    workflowResult.value = undefined;
    resultOwner.value = '';
    resultSource = '';
    selectedBlockedActionIds.value = [];
    showRawDrawer.value = false;
  }
  function resetForOwner() {
    workflowLane.invalidate();
    infoLane.invalidate();
    recoveryLane.invalidate();
    historyLane.invalidate();
    clearResult();
    currentOperationId.value = '';
    currentPlanId.value = '';
    operationState.value = 'none';
    operationDetail.value = undefined;
    operationHistory.value = [];
    retrySnapshot = undefined;
    recoveryLoading.value = false;
    historyLoading.value = false;
    historyLoaded.value = false;
    recoveryError.value = '';
    historyError.value = '';
    running.value = false;
    confirmLoading.value = false;
    infoLoading.value = false;
    serviceInfo.value = undefined;
    readyInfo.value = undefined;
    workflowError.value = '';
    infoError.value = '';
    templateKey.value = 'custom';
    Object.assign(formData, {
      deployment: '',
      event: '',
      namespace: 'default',
      problem_description: '',
    });
  }
  function restoreOperationId() {
    const id = readOperationId(scope.owner.value);
    if (id) {
      currentOperationId.value = id;
      operationState.value = 'unverified';
    }
  }
  watch(() => scope.owner.value, restoreOperationId, { flush: 'sync' });
  watch(
    () => access.accessToken,
    () => {
      resetForOwner();
      restoreOperationId();
    },
    { flush: 'sync' },
  );
  watch(
    () => [
      can('aiops.autofix.run'),
      can('aiops.autofix.confirm'),
      canReadHistory.value,
      canReadOperation.value,
      canReadPlan.value,
    ],
    (current, previous) => {
      if (!previous) return;
      if (
        (previous[0] && !current[0] && running.value) ||
        (previous[1] && !current[1] && confirmLoading.value)
      ) {
        workflowLane.invalidate();
        running.value = false;
        confirmLoading.value = false;
        clearResult();
        operationState.value = 'unverified';
        recoveryError.value = '权限发生变化，请由有权限的人员核对操作状态。';
      }
      if (!current[1]) selectedBlockedActionIds.value = [];
      if (
        (resultSource === 'workflow' && previous[0] && !current[0]) ||
        (resultSource === 'confirm' && previous[1] && !current[1]) ||
        (resultSource === 'operation' && previous[3] && !current[3]) ||
        (resultSource === 'plan' && previous[4] && !current[4])
      ) {
        clearResult();
        operationState.value = 'unverified';
        recoveryError.value = '权限发生变化，请由有权限的人员核对操作状态。';
      }
      if ((previous[3] && !current[3]) || (previous[4] && !current[4])) {
        recoveryLane.invalidate();
        recoveryLoading.value = false;
        if (operationDetail.value) operationState.value = 'unverified';
        operationDetail.value = undefined;
      }
      if (previous[2] && !current[2]) {
        historyLane.invalidate();
        historyLoading.value = false;
        operationHistory.value = [];
        historyLoaded.value = false;
      }
    },
    { flush: 'sync' },
  );

  function applyOperation(
    record: AutoFixOperation,
    owner: string,
    source: 'operation' | 'plan',
  ) {
    clearResult();
    operationDetail.value = record;
    currentPlanId.value = record.plan_id || '';
    recoveryError.value = '';
    if (record.state === 'pending') {
      const result = record.result;
      if (
        record.approval_state !== 'pending' ||
        !result ||
        result.status !== 'needs_human_confirmation' ||
        result.approval?.state !== 'pending' ||
        result.plan?.plan_id !== record.plan_id
      ) {
        operationState.value = 'uncertain';
        recoveryError.value = '待审批结果不完整，请人工核对，不要重复执行。';
        return;
      }
      operationState.value = 'pending';
      workflowResult.value = result;
      resultOwner.value = owner;
      resultSource = source;
      now.value = Date.now();
    } else if (record.state === 'building' || record.state === 'executing') {
      operationState.value = 'running';
      recoveryError.value = '操作仍在处理，不能再次提交或确认。';
    } else if (
      record.state === 'completed' &&
      ['completed', 'planned'].includes(record.execution_summary?.status || '')
    ) {
      operationState.value = 'completed';
    } else if (record.state === 'invalidated') {
      operationState.value = 'invalidated';
      recoveryError.value = '该计划已失效，请核对后重新诊断。';
    } else {
      operationState.value = 'uncertain';
      recoveryError.value =
        '执行结果不确定，请人工核对目标状态，不要重复执行。';
    }
  }
  async function checkOperation() {
    if (busy.value || !scope.owner.value) return;
    const operationId = currentOperationId.value;
    const planId = currentPlanId.value;
    if (!operationId && !planId) return;
    if (operationId ? !canReadOperation.value : !canReadPlan.value) {
      recoveryError.value =
        '没有查询此操作状态的权限，请联系管理员；不要重复执行。';
      return;
    }
    const ticket = recoveryLane.begin();
    recoveryLoading.value = true;
    recoveryError.value = '';
    try {
      const record = operationId
        ? await getAutoFixOperation(operationId)
        : await getAutoFixPlan(planId);
      if (!recoveryLane.current(ticket)) return;
      if (
        (operationId && record.operation_id !== operationId) ||
        (planId && record.plan_id !== planId)
      )
        throw new Error('响应标识不匹配');
      applyOperation(record, ticket.owner, operationId ? 'operation' : 'plan');
    } catch (error: any) {
      if (!recoveryLane.current(ticket)) return;
      clearResult();
      operationDetail.value = undefined;
      if (
        error?.response?.status === 404 &&
        operationId &&
        !planId &&
        !['running', 'uncertain'].includes(operationState.value)
      ) {
        operationState.value = 'not_found';
        recoveryError.value = retrySnapshot
          ? '尚未找到该操作；可手动重试原请求，操作 ID 保持不变。'
          : '尚未找到该操作。刷新后原输入未保存，请核对并重新填写，再手动重试同一操作 ID。';
      } else if (error?.response?.status === 403) {
        operationState.value = 'unverified';
        recoveryError.value =
          '没有查询此操作状态的权限，请联系管理员；不要重复执行。';
      } else if (error?.response?.status === 404 && planId) {
        operationState.value = 'uncertain';
        recoveryError.value =
          '已存在的计划无法查询，请人工核对目标状态，不要重复执行。';
      } else {
        operationState.value = 'unverified';
        recoveryError.value =
          '无法确认操作状态，请核对权限和服务，不要重复执行。';
      }
    } finally {
      if (recoveryLane.current(ticket)) recoveryLoading.value = false;
    }
  }
  async function loadHistory() {
    if (!scope.owner.value || !canReadHistory.value) {
      historyError.value = '没有查看操作历史的权限。';
      return;
    }
    const ticket = historyLane.begin();
    historyLoading.value = true;
    historyError.value = '';
    try {
      const response = await getAutoFixHistory();
      if (!historyLane.current(ticket)) return;
      if (!Array.isArray(response?.items))
        throw new Error('invalid history response');
      operationHistory.value = response.items;
      historyLoaded.value = true;
    } catch (error: any) {
      if (!historyLane.current(ticket)) return;
      operationHistory.value = [];
      historyLoaded.value = false;
      historyError.value =
        error?.response?.status === 403
          ? '没有查看操作历史的权限，请联系管理员。'
          : '操作历史读取失败，请稍后查询。';
    } finally {
      if (historyLane.current(ticket)) historyLoading.value = false;
    }
  }
  function canOpenHistory(item: AutoFixOperation) {
    if (!canReadPlan.value || busy.value) return false;
    if (!['unverified', 'running', 'uncertain'].includes(operationState.value))
      return true;
    return !!(
      (currentOperationId.value &&
        item.operation_id === currentOperationId.value) ||
      (currentPlanId.value && item.plan_id === currentPlanId.value)
    );
  }
  async function openHistoryPlan(item: AutoFixOperation) {
    if (busy.value || !scope.owner.value) return;
    if (!canReadPlan.value) {
      historyError.value = '没有查看计划详情的权限，请联系管理员。';
      return;
    }
    if (!canOpenHistory(item)) {
      historyError.value = '请先核对当前操作，再查看其他计划。';
      return;
    }
    const ticket = recoveryLane.begin();
    recoveryLoading.value = true;
    historyError.value = '';
    try {
      const record = await getAutoFixPlan(item.plan_id);
      if (!recoveryLane.current(ticket)) return;
      if (record.plan_id !== item.plan_id) throw new Error('响应标识不匹配');
      currentOperationId.value = record.operation_id || '';
      if (record.operation_id)
        saveOperationId(ticket.owner, record.operation_id);
      retrySnapshot = undefined;
      applyOperation(record, ticket.owner, 'plan');
    } catch (error: any) {
      if (!recoveryLane.current(ticket)) return;
      historyError.value =
        error?.response?.status === 403
          ? '没有查看计划详情的权限，请联系管理员。'
          : '计划详情读取失败，请稍后查询。';
    } finally {
      if (recoveryLane.current(ticket)) recoveryLoading.value = false;
    }
  }
  function acknowledgeUncertain(
    owner: string,
    operationId: string,
    planId: string,
  ) {
    if (
      busy.value ||
      operationState.value !== 'uncertain' ||
      scope.owner.value !== owner ||
      currentOperationId.value !== operationId ||
      currentPlanId.value !== planId
    )
      return;
    // This only clears the local pointer; the server retains its immutable record.
    removeOperationId(scope.owner.value);
    currentOperationId.value = '';
    currentPlanId.value = '';
    operationState.value = 'none';
    operationDetail.value = undefined;
    retrySnapshot = undefined;
    recoveryError.value = '';
  }

  function applyTemplate() {
    const template = templates[templateKey.value];
    formData.event = template.event;
    formData.problem_description = template.problem_description;
  }
  function resetForm() {
    if (busy.value) return;
    workflowLane.invalidate();
    clearResult();
    workflowError.value = '';
    templateKey.value = 'custom';
    Object.assign(formData, {
      deployment: '',
      event: '',
      namespace: 'default',
      problem_description: '',
    });
  }
  function toggleBlockedAction(id: string, checked: boolean) {
    if (
      busy.value ||
      approvalIssue.value ||
      !confirmableBlockedActions.value.some((action) => action.action_id === id)
    )
      return;
    selectedBlockedActionIds.value = checked
      ? [...new Set([...selectedBlockedActionIds.value, id])]
      : selectedBlockedActionIds.value.filter((value) => value !== id);
  }
  async function loadServiceInfo(checkDependencies = true) {
    if (!scope.owner.value) return;
    const ticket = infoLane.begin();
    infoLoading.value = true;
    infoError.value = '';
    try {
      const [info, ready] = await Promise.allSettled([
        getAutoFixInfo(),
        checkDependencies ? getAutoFixReady() : Promise.resolve(undefined),
      ]);
      if (!infoLane.current(ticket)) return;
      serviceInfo.value = info.status === 'fulfilled' ? info.value : undefined;
      readyInfo.value = ready.status === 'fulfilled' ? ready.value : undefined;
      if (info.status === 'rejected' || ready.status === 'rejected')
        infoError.value = '部分服务信息读取失败，可通过刷新服务重试';
    } finally {
      if (infoLane.current(ticket)) infoLoading.value = false;
    }
  }
  async function runWorkflow() {
    if (
      !isFormValid.value ||
      busy.value ||
      !canStartWorkflow.value ||
      !can('aiops.autofix.run')
    )
      return;
    const request = {
      deployment: formData.deployment.trim() || undefined,
      event: formData.event || formData.problem_description,
      namespace: formData.namespace.trim(),
      problem_description: formData.problem_description.trim(),
    };
    let operationId =
      operationState.value === 'not_found' ? currentOperationId.value : '';
    if (
      operationId &&
      retrySnapshot &&
      JSON.stringify({ ...retrySnapshot, operation_id: undefined }) !==
        JSON.stringify(request)
    ) {
      recoveryError.value =
        '输入已变化；请恢复原输入后重试同一操作，或先核对后开始新操作。';
      return;
    }
    if (!operationId) {
      try {
        operationId = crypto.randomUUID();
      } catch {
        recoveryError.value = '无法生成操作标识，本次未提交。';
        return;
      }
    }
    if (!saveOperationId(scope.owner.value, operationId)) {
      recoveryError.value = '无法保存操作标识，本次未提交；请启用会话存储。';
      return;
    }
    const ticket = workflowLane.begin();
    currentOperationId.value = operationId;
    currentPlanId.value = '';
    operationState.value = 'unverified';
    operationDetail.value = undefined;
    retrySnapshot = { ...request, operation_id: operationId };
    recoveryError.value = '';
    clearResult();
    workflowError.value = '';
    running.value = true;
    try {
      const response = await executeAutoFixWorkflow({
        ...request,
        operation_id: operationId,
      });
      if (!workflowLane.current(ticket)) return;
      if (response.operation_id && response.operation_id !== operationId) {
        operationState.value = 'uncertain';
        recoveryError.value = '响应操作标识不一致，请人工核对。';
        return;
      }
      if (
        response.status === 'completed' &&
        response.execution?.status &&
        response.execution.status !== 'completed'
      ) {
        operationState.value = 'uncertain';
        recoveryError.value = '执行状态不一致，请人工核对。';
        return;
      }
      workflowResult.value = response;
      currentPlanId.value = response.plan?.plan_id || '';
      operationState.value =
        response.status === 'needs_human_confirmation'
          ? 'pending'
          : ['completed', 'planned'].includes(response.status)
            ? 'completed'
            : 'uncertain';
      resultOwner.value = ticket.owner;
      resultSource = 'workflow';
      now.value = Date.now();
      if (response.status === 'needs_human_confirmation')
        message.warning('工作流已生成原计划，待执行动作需要明确审批');
      else if (response.status === 'completed')
        message.success('工作流执行完成');
      else if (response.status === 'planned')
        message.info('已生成计划，尚未执行修复动作');
      else workflowError.value = '工作流未确认执行成功，请核对目标实际状态';
    } catch (error) {
      if (!workflowLane.current(ticket)) return;
      clearResult();
      // 规则 3：按 HTTP 状态映射文案，不透出后端原文 / error_code
      operationState.value = 'unverified';
      workflowError.value = reportAutoFixOutcomeUncertain(error);
    } finally {
      if (workflowLane.current(ticket)) running.value = false;
    }
  }
  /**
   * 规则 4：逐项 / 批量确认共用。没有拒绝接口（后端未提供），不选的动作保持待确认直到过期。
   * 部分确认后后端仍返回 needs_human_confirmation + 新的 pending_action_ids。
   */
  async function confirmActions(ids: string[]) {
    now.value = Date.now();
    if (!canConfirmActions(ids)) return;
    const planId = workflowResult.value?.plan?.plan_id;
    if (!planId) return;
    const ticket = workflowLane.begin();
    const actionIds = [...ids];
    confirmLoading.value = true;
    workflowError.value = '';
    try {
      const response = await confirmAutoFixWorkflow({
        approved_action_ids: actionIds,
        plan_id: planId,
      });
      if (!workflowLane.current(ticket)) return;
      if (
        response.status === 'completed' &&
        response.execution?.status !== 'completed'
      ) {
        clearResult();
        currentPlanId.value = planId;
        operationState.value = 'uncertain';
        recoveryError.value = '审批执行状态不一致，请人工核对。';
        return;
      }
      workflowResult.value = response;
      currentPlanId.value = response.plan?.plan_id || planId;
      operationState.value =
        response.status === 'needs_human_confirmation'
          ? 'pending'
          : response.status === 'completed'
            ? 'completed'
            : 'uncertain';
      resultOwner.value = ticket.owner;
      resultSource = 'confirm';
      selectedBlockedActionIds.value = [];
      now.value = Date.now();
      if (response.status === 'needs_human_confirmation')
        message.warning('所选原动作已完成，剩余动作仍需明确审批');
      else if (response.status === 'completed')
        message.success('已确认并执行所选原计划动作');
      else {
        clearResult();
        workflowError.value =
          '审批执行结果未确认成功，请人工核对实际状态，勿盲目重试';
      }
    } catch (error) {
      if (!workflowLane.current(ticket)) return;
      // 任何失败都清掉计划与选择：404 = 计划不存在或已失效，409 = 状态已变，
      // 进入执行后的异常会作废整份计划，不能在旧计划上重试
      clearResult();
      currentPlanId.value = planId;
      operationState.value = 'unverified';
      workflowError.value = reportAutoFixOutcomeUncertain(error);
    } finally {
      if (workflowLane.current(ticket)) confirmLoading.value = false;
    }
  }
  function confirmWorkflowExecution() {
    return confirmActions(selectedBlockedActionIds.value);
  }
  function confirmSingleAction(id: string) {
    return confirmActions([id]);
  }
  function confirmAllActions() {
    return confirmActions(
      confirmableBlockedActions.value.map((action) => action.action_id),
    );
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    restoreOperationId();
    loadServiceInfo(false);
    timer = setInterval(() => {
      now.value = Date.now();
    }, 30_000);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    retrySnapshot = undefined;
    clearResult();
    Object.assign(formData, {
      deployment: '',
      event: '',
      namespace: 'default',
      problem_description: '',
    });
  });
  return {
    templateKey,
    running,
    confirmLoading,
    infoLoading,
    showRawDrawer,
    operationOwner: scope.owner,
    currentOperationId,
    currentPlanId,
    operationState,
    operationDetail,
    operationHistory,
    recoveryError,
    historyError,
    recoveryLoading,
    historyLoading,
    historyLoaded,
    canStartWorkflow,
    canReadHistory,
    canReadOperation,
    canReadPlan,
    checkOperation,
    loadHistory,
    openHistoryPlan,
    canOpenHistory,
    acknowledgeUncertain,
    serviceInfo,
    readyInfo,
    workflowResult,
    selectedBlockedActionIds,
    workflowError,
    infoError,
    formData,
    busy,
    isFormValid,
    confirmableBlockedActions,
    approvalIssue,
    canConfirmWorkflow,
    canConfirmAll,
    applyTemplate,
    resetForm,
    toggleBlockedAction,
    loadServiceInfo,
    runWorkflow,
    confirmWorkflowExecution,
    confirmActions,
    confirmSingleAction,
    confirmAllActions,
  };
}
