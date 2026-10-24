import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import {
  confirmAutoFixWorkflow,
  executeAutoFixWorkflow,
  getAutoFixInfo,
  getAutoFixReady,
  type AutoFixInfoResponse,
  type AutoFixReadyResponse,
  type AutoFixWorkflowResponse,
} from '#/api/core/aiops/autofix';
import { useAiRequestScope } from '../assistant/useAiRequestScope';
import { reportAutoFixError } from './autofix-errors';

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
  const busy = computed(() => running.value || confirmLoading.value);
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
    (workflowResult.value?.blocked_actions || []).filter((action) => {
      const risk = action.risk_assessment;
      return (
        !!action.action_id &&
        pendingActionIds.value.has(action.action_id) &&
        action.executable === true &&
        risk?.namespace_allowed === true &&
        risk.permission_allowed === true &&
        risk.resource_exists === true
      );
    }),
  );
  const approvalIssue = computed(() => {
    if (!workflowResult.value) return '';
    const approval = workflowResult.value.approval;
    if (resultOwner.value !== scope.owner.value)
      return '此结果不属于当前账户，请重新诊断';
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
      confirmableBlockedActions.value.map((action) => action.action_id!),
    ),
  );

  function clearResult() {
    workflowResult.value = undefined;
    resultOwner.value = '';
    selectedBlockedActionIds.value = [];
    showRawDrawer.value = false;
  }
  function resetForOwner() {
    workflowLane.invalidate();
    infoLane.invalidate();
    clearResult();
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
    if (!isFormValid.value || busy.value) return;
    const ticket = workflowLane.begin();
    const request = {
      deployment: formData.deployment.trim() || undefined,
      event: formData.event || formData.problem_description,
      namespace: formData.namespace.trim(),
      problem_description: formData.problem_description.trim(),
    };
    clearResult();
    workflowError.value = '';
    running.value = true;
    try {
      const response = await executeAutoFixWorkflow(request);
      if (!workflowLane.current(ticket)) return;
      workflowResult.value = response;
      resultOwner.value = ticket.owner;
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
      workflowError.value = reportAutoFixError(error);
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
      workflowResult.value = response;
      resultOwner.value = ticket.owner;
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
      // 任何失败都清掉计划与选择：404 = 计划已失效（含服务重启），409 = 状态已变，
      // 进入执行后的异常会作废整份计划，不能在旧计划上重试
      clearResult();
      workflowError.value = reportAutoFixError(error);
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
      confirmableBlockedActions.value.map((action) => action.action_id!),
    );
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    loadServiceInfo(false);
    timer = setInterval(() => {
      now.value = Date.now();
    }, 30_000);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });
  return {
    templateKey,
    running,
    confirmLoading,
    infoLoading,
    showRawDrawer,
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
