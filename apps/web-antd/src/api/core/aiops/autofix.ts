import { requestClientAIOps } from '#/api/request';

export interface AutoFixRiskAssessment {
  affects_multiple_replicas?: boolean;
  allowed?: boolean;
  namespace_allowed?: boolean;
  permission_allowed?: boolean | null;
  reasons?: string[];
  requires_human_confirmation?: boolean;
  resource_exists?: boolean;
  risk_level?: 'high' | 'low' | 'medium' | 'none' | string;
  rollback_available?: boolean;
}

export interface AutoFixAction {
  action_id?: string;
  action_type?: string;
  description?: string;
  executable?: boolean;
  parameters?: Record<string, any>;
  result?: Record<string, any> | null;
  risk_assessment?: AutoFixRiskAssessment;
  status?: string;
  target?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
}

export interface AutoFixPlan {
  allowed_actions?: AutoFixAction[];
  blocked_actions?: AutoFixAction[];
  candidate_actions?: AutoFixAction[];
  created_at?: string;
  deployment?: string;
  fault_type?: string;
  namespace?: string;
  plan_id?: string;
  resource_exists?: boolean;
  summary?: Record<string, any>;
}

export interface AutoFixWorkflowMessage {
  action?: string;
  agent?: string;
  content?: string;
  level?: string;
  timestamp?: string;
}

export interface AutoFixWorkflowRequest {
  deployment?: string;
  diagnosis?: Record<string, any>;
  event?: string;
  namespace?: string;
  problem_description: string;
}

export interface AutoFixWorkflowConfirmRequest {
  approved_action_ids: string[];
  plan_id: string;
}

/**
 * 审批元数据（aiops bb8c2ff autofix_service.py:419-439）。
 * pending = status 'needs_human_confirmation' + state 'pending'（+ confirmation_required 不为 false）。
 */
export interface AutoFixApproval {
  confirm_endpoint?: string;
  confirmation_required?: boolean;
  expires_at: string;
  pending_action_ids?: string[];
  retry_safe: boolean;
  state: string;
}

export interface AutoFixWorkflowResponse {
  approval?: AutoFixApproval;
  agents_used: string[];
  blocked_actions: AutoFixAction[];
  candidate_actions: AutoFixAction[];
  diagnosis: Record<string, any>;
  executed_actions: AutoFixAction[];
  execution: Record<string, any>;
  messages: AutoFixWorkflowMessage[];
  next_action: string;
  plan: AutoFixPlan;
  review: Record<string, any>;
  status: string;
  timestamp: string;
  workflow_engine?: string;
  workflow_nodes?: string[];
}

export interface AutoFixInfoResponse {
  capabilities: string[];
  components?: Record<string, boolean>;
  constraints?: Record<string, any>;
  description: string;
  endpoints: Record<string, string>;
  features?: string[];
  service: string;
  status: string;
  version: string;
  workflow_engine?: string;
  workflow_nodes?: string[];
}

export interface AutoFixReadyResponse {
  healthy?: boolean;
  initialized?: boolean;
  message?: string;
  ready: boolean;
  service: string;
  status?: string;
  timestamp: string;
}

export async function executeAutoFixWorkflow(data: AutoFixWorkflowRequest) {
  return requestClientAIOps.post<AutoFixWorkflowResponse>('/autofix/workflow', data);
}

export async function confirmAutoFixWorkflow(data: AutoFixWorkflowConfirmRequest) {
  return requestClientAIOps.post<AutoFixWorkflowResponse>('/autofix/workflow/confirm', data);
}

export async function getAutoFixInfo() {
  return requestClientAIOps.get<AutoFixInfoResponse>('/autofix/info');
}

export async function getAutoFixReady() {
  return requestClientAIOps.get<AutoFixReadyResponse>('/autofix/ready');
}
