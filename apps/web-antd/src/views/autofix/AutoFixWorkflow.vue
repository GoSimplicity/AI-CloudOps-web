<template>
  <OpsPage title="自动修复工作流" description="诊断、规划与逐项审批，只执行已验证的原计划动作" class="autofix-workflow">
    <template #actions>
<a-space class="action-toolbar" :size="10">
            <a-button class="tool-button" @click="loadServiceInfo()" :loading="infoLoading">
              检查服务依赖
            </a-button>
            <a-button class="tool-button" @click="showRawDrawer = true" :disabled="!workflowResult">
              原始结果
            </a-button>
            <a-button v-if="can('aiops.autofix.run')"
              class="tool-button tool-button-primary"
              type="primary"
              @click="runWorkflow"
              :loading="running"
              :disabled="!isFormValid || busy"
            >
              执行工作流
            </a-button>
          </a-space>
    </template>
    <a-alert v-if="workflowError" :message="workflowError" type="error" show-icon role="alert" />
    <a-alert v-if="infoError" :message="infoError" type="warning" show-icon role="alert" />

    <a-row :gutter="[24, 24]">
      <a-col :xs="24" :lg="7">
        <WorkflowInput v-model:namespace="formData.namespace" v-model:deployment="formData.deployment" v-model:event="formData.event" v-model:description="formData.problem_description" v-model:template-key="templateKey" :busy="busy" :valid="isFormValid" @run="runWorkflow" @reset="resetForm" @template-change="applyTemplate" />

        <a-card title="服务状态" class="side-card">
          <a-skeleton v-if="infoLoading && !serviceInfo" active :paragraph="{ rows: 4 }" />
          <template v-else>
            <div class="service-status">
              <a-tag :color="readyInfo?.healthy ? 'green' : 'orange'">
                {{ readyInfo?.status || serviceInfo?.status || 'unknown' }}
              </a-tag>
              <span class="service-name">{{ serviceInfo?.service || '自动修复' }}</span>
            </div>
            <div class="service-desc">
              <div class="service-meta-item">
                <span class="service-meta-label">工作流引擎</span>
                <span class="service-meta-value">{{ serviceInfo?.workflow_engine || '未读取' }}</span>
              </div>
              <div class="service-meta-item service-meta-item-stack">
                <span class="service-meta-label">能力</span>
                <div class="service-capabilities">
                  <a-tag v-for="item in serviceInfo?.capabilities || []" :key="item" color="blue">
                    {{ item }}
                  </a-tag>
                </div>
              </div>
            </div>
          </template>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="17">
        <a-row :gutter="[16, 16]" class="summary-grid">
          <a-col :xs="12" :xl="6">
            <div class="summary-card status">
              <div class="summary-icon"><Icon icon="lucide:activity" width="22" /></div>
              <div>
                <div class="summary-label">工作流状态</div>
                <div class="summary-value">
                  <a-tag :color="getStatusTagColor(normalizedResult?.status)">
                    {{ getStatusLabel(normalizedResult?.status) }}
                  </a-tag>
                </div>
              </div>
            </div>
          </a-col>
          <a-col :xs="12" :xl="6">
            <div class="summary-card fault">
              <div class="summary-icon"><Icon icon="lucide:alert-triangle" width="22" /></div>
              <div>
                <div class="summary-label">故障类型</div>
                <div class="summary-value">{{ getFaultLabel(normalizedResult?.fault_type) }}</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="12" :xl="6">
            <div class="summary-card action">
              <div class="summary-icon"><Icon icon="lucide:list-checks" width="22" /></div>
              <div>
                <div class="summary-label">候选 / 放行动作</div>
                <div class="summary-value">{{ candidateActions.length }} / {{ allowedActionCount }}</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="12" :xl="6">
            <div class="summary-card blocked">
              <div class="summary-icon"><Icon icon="lucide:shield-alert" width="22" /></div>
              <div>
                <div class="summary-label">阻断动作</div>
                <div class="summary-value">{{ blockedActions.length }}</div>
              </div>
            </div>
          </a-col>
        </a-row>

        <a-row :gutter="[16, 16]" class="ai-insight-grid">
          <a-col :xs="24" :xl="8">
            <a-card title="AI分析" class="insight-card">
              <div v-if="aiAnalysisHighlights.length" class="insight-list">
                <div v-for="item in aiAnalysisHighlights" :key="item" class="insight-item">
                  {{ item }}
                </div>
              </div>
              <a-empty v-else description="执行后展示 AI 诊断分析" />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="8">
            <a-card title="AI计划摘要" class="insight-card">
              <div v-if="aiPlanHighlights.length" class="insight-list">
                <div v-for="item in aiPlanHighlights" :key="item" class="insight-item">
                  {{ item }}
                </div>
              </div>
              <a-empty v-else description="执行后展示 AI 计划摘要" />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="8">
            <a-card title="AI复核要点" class="insight-card">
              <div v-if="aiReviewHighlights.length" class="insight-list">
                <div v-for="item in aiReviewHighlights" :key="item" class="insight-item">
                  {{ item }}
                </div>
              </div>
              <a-empty v-else description="执行后展示 AI 风险复核" />
            </a-card>
          </a-col>
        </a-row>

        <a-card class="workflow-card" title="多智能体协作">
          <template #extra>
            <a-tag color="purple">{{ normalizedResult?.workflow_engine || 'LangGraph' }}</a-tag>
          </template>
          <a-steps :current="currentAgentStep" size="small" responsive>
            <a-step v-for="agent in workflowAgents" :key="agent.name" :title="agent.title" :description="agent.description">
              <template #icon>
                <Icon :icon="agent.icon" width="18" />
              </template>
            </a-step>
          </a-steps>

          <div class="agent-messages" v-if="visibleAgentMessages.length">
            <div v-for="(item, index) in visibleAgentMessages" :key="`${item.agent}-${index}`" class="agent-message">
              <div class="agent-message-icon"><Icon icon="lucide:bot" width="16" /></div>
              <div class="agent-message-content">
                <strong>{{ item.agent }}</strong>
                <span>{{ item.content || item.action || '已处理当前阶段' }}</span>
              </div>
            </div>
          </div>
          <a-empty v-else description="执行后展示智能体调度过程" />
        </a-card>

        <a-card class="result-card" title="候选修复动作与风险评估">
          <template #extra>
            <a-space>
              <a-tag color="green">允许 {{ allowedActionCount }}</a-tag>
              <a-tag color="red">阻断 {{ blockedActions.length }}</a-tag>
            </a-space>
          </template>
          <a-table
            :columns="actionColumns"
            :scroll="{ x: 840 }"
            :data-source="candidateActions"
            :locale="{ emptyText: '暂无候选动作' }"
            :pagination="false"
            row-key="action_id"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <div class="action-cell">
                  <Icon :icon="getActionIcon(record.action_type)" width="16" />
                  <div>
                    <div class="action-name">{{ getActionLabel(record.action_type) }}</div>
                    <div class="action-desc">{{ record.description || '-' }}</div>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'risk'">
                <a-tag :color="getRiskTagColor(record.risk_assessment?.risk_level)">
                  {{ record.risk_assessment?.risk_level || 'unknown' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'allowed'">
                <a-tag :color="record.risk_assessment?.allowed ? 'green' : 'orange'">
                  {{ record.risk_assessment?.allowed ? '允许执行' : '需要确认' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'riskDetails'">
                <div class="risk-details">
                  <span>资源 {{ formatBoolean(record.risk_assessment?.resource_exists) }}</span>
                  <span>权限 {{ formatBoolean(record.risk_assessment?.permission_allowed) }}</span>
                  <span>回滚 {{ formatBoolean(record.risk_assessment?.rollback_available) }}</span>
                </div>
                <div v-if="record.risk_assessment?.reasons?.length" class="risk-reasons">
                  {{ record.risk_assessment.reasons.join(' / ') }}
                </div>
              </template>
            </template>
          </a-table>
        </a-card>

        <a-row :gutter="[16, 16]" class="bottom-section">
          <a-col :xs="24" :xl="12">
            <a-card title="执行结果" class="execution-card">
              <div v-if="executedActions.length" class="execution-list">
                <div v-for="action in executedActions" :key="action.action_id || action.action_type" class="execution-item">
                  <div class="execution-left">
                    <Icon :icon="getActionIcon(action.action_type)" width="18" />
                    <div>
                      <div class="execution-title">{{ getActionLabel(action.action_type) }}</div>
                      <div class="execution-meta">{{ action.status || 'succeeded' }}</div>
                    </div>
                  </div>
                  <a-tag :color="action.status === 'failed' ? 'red' : 'green'">
                    {{ action.status || 'succeeded' }}
                  </a-tag>
                </div>
              </div>
              <a-empty v-else description="暂无执行动作；高风险动作会停留在人工确认阶段" />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="12">
            <a-card title="Reviewer结论" class="review-card">
              <template v-if="normalizedResult">
                <a-alert
                  :message="reviewApproved ? '允许自动执行' : '需要人工确认或补充诊断'"
                  :description="reviewReason"
                  :type="reviewApproved ? 'success' : 'warning'"
                  show-icon
                />
                <ApprovalPanel v-if="normalizedResult.status === 'needs_human_confirmation'" :actions="confirmableBlockedActions" :selected="selectedBlockedActionIds" :busy="busy" :can-confirm="canConfirmWorkflow" :issue="approvalIssue" :expires-at="workflowResult?.approval?.expires_at" @toggle="toggleBlockedAction" @confirm="confirmWorkflowExecution" />
              </template>
              <a-empty v-else description="执行工作流后展示风险复核结论" />
            </a-card>
          </a-col>
        </a-row>
      </a-col>
    </a-row>

    <a-drawer v-model:open="showRawDrawer" title="自动修复工作流原始响应" width="720">
      <pre class="raw-json">{{ rawResultText }}</pre>
    </a-drawer>
  </OpsPage>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import OpsPage from '#/components/ops/OpsPage.vue';
import WorkflowInput from './WorkflowInput.vue';
import ApprovalPanel from './ApprovalPanel.vue';
import { useAutoFixWorkflow } from './useAutoFixWorkflow';

import { Icon } from '@iconify/vue';

import type { AutoFixAction, AutoFixWorkflowMessage } from '#/api/core/aiops/autofix';

import {
  formatBoolean,
  getActionIcon,
  getActionLabel,
  getAllowedActionCount,
  getAiAnalysisHighlights,
  getAiPlanHighlights,
  getAiReviewHighlights,
  getFaultLabel,
  getRiskTagColor,
  getStatusLabel,
  getStatusTagColor,
  normalizeWorkflowResult,
} from './autofix-format';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

const workflowAgents = [
  { description: '识别任务类型', icon: 'lucide:route', name: 'Coordinator', title: 'Coordinator' },
  { description: '分析事件和日志', icon: 'lucide:search', name: 'Analyzer', title: 'Analyzer' },
  { description: '规划修复步骤', icon: 'lucide:list-checks', name: 'Planner', title: 'Planner' },
  { description: '复核风险边界', icon: 'lucide:shield-check', name: 'Reviewer', title: 'Reviewer' },
  { description: '人工确认高风险动作', icon: 'lucide:user-check', name: 'HumanConfirm', title: 'HumanConfirm' },
  { description: '执行允许动作', icon: 'lucide:terminal', name: 'Executor', title: 'Executor' },
];

const { templateKey, running, infoLoading, showRawDrawer, serviceInfo, readyInfo, workflowResult, selectedBlockedActionIds, workflowError, infoError, formData, busy, isFormValid, confirmableBlockedActions, approvalIssue, canConfirmWorkflow, applyTemplate, resetForm, toggleBlockedAction, loadServiceInfo, runWorkflow, confirmWorkflowExecution } = useAutoFixWorkflow();
const normalizedResult = computed(() => (workflowResult.value ? normalizeWorkflowResult(workflowResult.value) : null));
const candidateActions = computed<AutoFixAction[]>(() => normalizedResult.value?.candidate_actions || []);
const blockedActions = computed<AutoFixAction[]>(() => normalizedResult.value?.blocked_actions || []);
const executedActions = computed<AutoFixAction[]>(() => normalizedResult.value?.executed_actions || []);
const allowedActionCount = computed(() => getAllowedActionCount(candidateActions.value));
const agentMessages = computed<AutoFixWorkflowMessage[]>(() => normalizedResult.value?.messages || []);
const visibleAgentMessages = computed<AutoFixWorkflowMessage[]>(() =>
  agentMessages.value.map((item) => ({
    ...item,
    content: item.content || item.action || '',
  })),
);
const reviewApproved = computed(() => Boolean(normalizedResult.value?.review?.approved));
const reviewReason = computed(() => normalizedResult.value?.review?.reason || '暂无Reviewer结论');
const rawResultText = computed(() => JSON.stringify(workflowResult.value || {}, null, 2));
const aiAnalysisHighlights = computed(() => getAiAnalysisHighlights(normalizedResult.value?.diagnosis));
const aiPlanHighlights = computed(() => getAiPlanHighlights(normalizedResult.value?.plan));
const aiReviewHighlights = computed(() => getAiReviewHighlights(normalizedResult.value?.review));
const currentAgentStep = computed(() => {
  const used = normalizedResult.value?.agents_used || [];
  if (!used.length) return 0;
  const last = used[used.length - 1];
  return Math.max(0, workflowAgents.findIndex((agent) => agent.name === last));
});

const actionColumns = [
  { dataIndex: 'action_type', key: 'action', title: '动作', width: 260 },
  { dataIndex: ['risk_assessment', 'risk_level'], key: 'risk', title: '风险', width: 100 },
  { dataIndex: ['risk_assessment', 'allowed'], key: 'allowed', title: '执行门禁', width: 130 },
  { key: 'riskDetails', title: '风险评估明细', width: 350 },
];

</script>

<style scoped>









.autofix-workflow .action-toolbar {
  align-items: center;
}

.autofix-workflow .tool-button,
.autofix-workflow .config-action-button {
  min-width: 96px;
  height: 40px;
  padding-inline: 14px;
  border-radius: var(--ops-radius);
}

.autofix-workflow .tool-button-primary,
.autofix-workflow .config-action-button-primary {
  box-shadow: none;
}

.config-card,
.side-card,
.workflow-card,
.result-card,
.execution-card,
.review-card {
  margin-bottom: 24px;
  border-radius: var(--ops-radius);
  box-shadow: none;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.service-name {
  color: var(--ops-muted);
  font-weight: 500;
}

.service-desc {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-meta-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}

.service-meta-item-stack {
  align-items: flex-start;
  flex-direction: column;
}

.service-meta-label {
  flex-shrink: 0;
  color: var(--ops-muted);
  font-size: 12px;
  line-height: 1.4;
}

.service-meta-value {
  color: var(--ops-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.service-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-grid {
  margin-bottom: 8px;
}

.ai-insight-grid {
  margin-bottom: 8px;
}

.summary-card {
  display: flex;
  align-items: flex-start;
  min-height: 80px;
  min-width: 0;
  padding: var(--ops-space-md);
  gap: var(--ops-space-sm);
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}
.summary-card > div:last-child { min-width: 0; }
.summary-icon { flex-shrink: 0; color: var(--ops-muted); }
.summary-card.status .summary-icon { color: var(--ops-accent); }
.summary-value { overflow-wrap: anywhere; }
.summary-value :deep(.ant-tag) { margin: 0; white-space: normal; }

.summary-label {
  margin-bottom: 6px;
  color: var(--ops-muted);
  font-size: 12px;
}

.summary-value {
  color: var(--ops-ink);
  font-size: 18px;
  font-weight: 600;
}

.agent-messages {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.agent-message {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  gap: 10px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}

.agent-message-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--ops-accent);
  background: var(--ops-ground);
  border-radius: 6px;
}

.agent-message-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--ops-muted);
  font-size: 12px;
  gap: 4px;
}

.agent-message-content strong {
  color: var(--ops-ink);
  font-size: 13px;
}

.insight-card {
  height: 100%;
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  padding: 12px;
  color: var(--ops-ink);
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  font-size: 12px;
  line-height: 1.5;
}

.action-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.action-name {
  color: var(--ops-ink);
  font-weight: 500;
}

.action-desc {
  max-width: 360px;
  margin-top: 2px;
  color: var(--ops-muted);
  font-size: 12px;
  line-height: 1.4;
}

.risk-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--ops-muted);
  font-size: 12px;
}

.risk-reasons {
  margin-top: 4px;
  color: #fa8c16;
  font-size: 12px;
}

.bottom-section {
  margin-top: 0;
}

.execution-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.execution-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}

.execution-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.execution-title {
  color: var(--ops-ink);
  font-weight: 500;
}

.execution-meta {
  margin-top: 2px;
  color: var(--ops-muted);
  font-size: 12px;
}

.confirm-panel {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ops-border);
}

.confirm-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.confirm-panel-title {
  color: var(--ops-ink);
  font-size: 13px;
  font-weight: 600;
}

.confirm-action-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirm-action-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}

.confirm-action-content {
  min-width: 0;
}

.confirm-action-title {
  color: var(--ops-ink);
  font-size: 13px;
  font-weight: 600;
}

.confirm-action-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 4px;
  color: var(--ops-muted);
  font-size: 12px;
  line-height: 1.5;
}

.confirm-action-reasons {
  margin-top: 4px;
  color: #fa8c16;
  font-size: 12px;
  line-height: 1.5;
}

.confirm-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.raw-json {
  padding: 16px;
  margin: 0;
  overflow: auto;
  color: var(--ops-ink);
  background: #f7f8fa;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 768px) {


  .autofix-workflow .header-actions,
  .autofix-workflow .header-actions :deep(.ant-space) {
    width: 100%;
  }


  .config-actions {
    justify-content: flex-start;
  }

  .confirm-toolbar {
    justify-content: flex-start;
  }

  .autofix-workflow .tool-button,
  .autofix-workflow .config-action-button {
    min-width: 88px;
  }
}
</style>
