import type {
  AutoFixAction,
  AutoFixWorkflowResponse,
} from '#/api/core/aiops/autofix';

const statusColorMap: Record<string, string> = {
  blocked: 'red',
  completed: 'green',
  failed: 'red',
  needs_human_confirmation: 'orange',
  planned: 'blue',
  running: 'processing',
};

const riskColorMap: Record<string, string> = {
  high: 'red',
  low: 'green',
  medium: 'orange',
  none: 'default',
};

const statusLabelMap: Record<string, string> = {
  blocked: '已阻断',
  completed: '已完成',
  failed: '执行失败',
  needs_human_confirmation: '需要人工确认',
  planned: '已生成计划',
  running: '执行中',
};

const faultLabelMap: Record<string, string> = {
  crash_loop_backoff: 'CrashLoopBackOff',
  image_pull_failure: '镜像拉取失败',
  resource_insufficient: '资源不足',
  unknown: '待补充诊断',
};

const actionLabelMap: Record<string, string> = {
  adjust_resource_requests: '调整资源请求',
  check_image_pull_secret: '检查镜像密钥',
  check_image_reference: '检查镜像地址',
  check_network_connectivity: '检查网络连通性',
  inspect_configuration: '检查配置',
  inspect_events: '查看事件',
  inspect_logs: '查看日志',
  inspect_resource_quota: '检查资源配额',
  patch_image_pull_policy: '调整镜像拉取策略',
  restart_deployment: '重启Deployment',
  scale_deployment: '扩缩容Deployment',
};

const actionIconMap: Record<string, string> = {
  adjust_resource_requests: 'lucide:sliders-horizontal',
  check_image_pull_secret: 'lucide:key-round',
  check_image_reference: 'lucide:package-search',
  check_network_connectivity: 'lucide:network',
  inspect_configuration: 'lucide:file-cog',
  inspect_events: 'lucide:list-tree',
  inspect_logs: 'lucide:file-search',
  inspect_resource_quota: 'lucide:gauge',
  patch_image_pull_policy: 'lucide:package-check',
  restart_deployment: 'lucide:rotate-cw',
  scale_deployment: 'lucide:boxes',
};

export function getStatusTagColor(status?: string) {
  return statusColorMap[status || ''] || 'default';
}

export function getRiskTagColor(level?: string) {
  return riskColorMap[level || ''] || 'default';
}

export function getStatusLabel(status?: string) {
  return statusLabelMap[status || ''] || status || '未知';
}

export function getFaultLabel(faultType?: string) {
  return faultLabelMap[faultType || ''] || faultType || '未知故障';
}

export function getActionLabel(actionType?: string) {
  return actionLabelMap[actionType || ''] || actionType || '未知动作';
}

export function getActionIcon(actionType?: string) {
  return actionIconMap[actionType || ''] || 'lucide:wrench';
}

export function formatBoolean(value?: boolean | null) {
  if (value === true) return '是';
  if (value === false) return '否';
  return '未知';
}

export function normalizeWorkflowResult(
  raw: Partial<AutoFixWorkflowResponse>,
): AutoFixWorkflowResponse & { fault_type: string } {
  const plan = raw.plan || {};
  const execution = raw.execution || {};
  const review = raw.review || {};
  const candidateActions = raw.candidate_actions || plan.candidate_actions || [];
  const executedActions = raw.executed_actions || execution.executed_actions || [];
  const blockedActions = raw.blocked_actions || review.blocked_actions || execution.blocked_actions || [];

  return {
    approval: raw.approval,
    agents_used: raw.agents_used || [],
    blocked_actions: blockedActions,
    candidate_actions: candidateActions,
    diagnosis: raw.diagnosis || {},
    executed_actions: executedActions,
    execution,
    fault_type: plan.fault_type || 'unknown',
    messages: raw.messages || [],
    next_action: raw.next_action || '',
    plan,
    review,
    status: raw.status || 'unknown',
    timestamp: raw.timestamp || '',
    workflow_engine: raw.workflow_engine,
    workflow_nodes: raw.workflow_nodes || [],
  };
}

export function getAllowedActionCount(actions: AutoFixAction[]) {
  return actions.filter((action) => action.risk_assessment?.allowed).length;
}

function appendHighlights(target: string[], value: unknown) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) target.push(item.trim());
    }
    return;
  }
  if (typeof value === 'string' && value.trim()) target.push(value.trim());
}

export function getAiAnalysisHighlights(diagnosis?: Record<string, any>) {
  const highlights: string[] = [];
  const aiAnalysis = diagnosis?.ai_analysis || diagnosis?.diagnosis?.ai_analysis || {};
  const faultAnalysis = aiAnalysis?.faultAnalysis || aiAnalysis;

  appendHighlights(highlights, faultAnalysis?.faultType);
  appendHighlights(highlights, faultAnalysis?.fault_type);
  appendHighlights(highlights, faultAnalysis?.rootCause);
  appendHighlights(highlights, faultAnalysis?.root_cause);
  appendHighlights(highlights, faultAnalysis?.analysis);
  appendHighlights(highlights, faultAnalysis?.observations);
  appendHighlights(highlights, faultAnalysis?.symptoms);
  appendHighlights(highlights, faultAnalysis?.suspected_causes);
  appendHighlights(highlights, faultAnalysis?.suggestedActions);
  appendHighlights(highlights, faultAnalysis?.suggested_actions);
  appendHighlights(highlights, faultAnalysis?.missing_evidence);

  return [...new Set(highlights)].slice(0, 4);
}

export function getAiPlanHighlights(plan?: Record<string, any>) {
  const highlights: string[] = [];
  const aiPlanSummary = plan?.ai_plan_summary || {};

  appendHighlights(highlights, aiPlanSummary?.summary);
  appendHighlights(highlights, aiPlanSummary?.priority_actions);
  appendHighlights(highlights, aiPlanSummary?.recommended_order);
  appendHighlights(highlights, aiPlanSummary?.blocked_actions?.map((item: any) => item?.action_type));

  if (!highlights.length && plan?.summary) {
    appendHighlights(highlights, `候选 ${plan.summary.total_actions || 0} 个动作`);
    appendHighlights(highlights, `阻断 ${plan.summary.blocked_actions || 0} 个动作`);
  }

  return [...new Set(highlights)].slice(0, 4);
}

export function getAiReviewHighlights(review?: Record<string, any>) {
  const highlights: string[] = [];
  const aiReview = review?.ai_review || {};
  const reviewerConclusion = aiReview?.reviewer_conclusion || aiReview;

  appendHighlights(highlights, aiReview?.reason);
  appendHighlights(highlights, aiReview?.human_confirmation_note);
  appendHighlights(highlights, aiReview?.risk_summary);
  appendHighlights(highlights, reviewerConclusion?.reason);
  appendHighlights(highlights, reviewerConclusion?.human_confirmation_note);
  appendHighlights(highlights, reviewerConclusion?.risk_summary);
  appendHighlights(highlights, reviewerConclusion?.reasons);
  appendHighlights(highlights, reviewerConclusion?.blocked_action_types);

  return [...new Set(highlights)].slice(0, 4);
}
