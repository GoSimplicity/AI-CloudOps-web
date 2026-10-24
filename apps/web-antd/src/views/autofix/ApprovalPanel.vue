<script setup lang="ts">
import type { AutoFixAction } from '#/api/core/aiops/autofix';
import { getActionLabel } from './autofix-format';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();
defineProps<{
  actions: AutoFixAction[];
  selected: string[];
  busy: boolean;
  canConfirm: boolean;
  canConfirmAll?: boolean;
  issue: string;
  expiresAt?: string;
}>();
const emit = defineEmits<{
  toggle: [id: string, checked: boolean];
  confirm: [];
  confirmOne: [id: string];
  confirmAll: [];
}>();
// SEC-25/26 规则 4：逐项「确认此项」+ 批量「全部确认」；后端没有拒绝接口，不提供拒绝按钮
</script>
<template>
  <section class="confirm-panel" aria-label="原计划动作审批">
    <div class="confirm-panel-header">
      <strong>待明确审批的原计划动作</strong
      ><a-tag color="orange">{{ actions.length }}</a-tag>
    </div>
    <p v-if="expiresAt && Number.isFinite(Date.parse(expiresAt))" class="approval-expiry">
      审批有效期至 {{ new Date(expiresAt).toLocaleString() }}
    </p>
    <a-alert v-if="issue" :message="issue" type="warning" show-icon />
    <a-alert
      v-else-if="!actions.length"
      message="当前阻断动作的资源、权限或命名空间硬限制未满足，不能通过审批放行"
      type="warning"
      show-icon
    />
    <div class="confirm-action-list">
      <label
        v-for="action in actions"
        :key="action.action_id"
        class="confirm-action-item"
      >
        <a-checkbox
          :checked="selected.includes(action.action_id || '')"
          :disabled="busy || !!issue"
          @change="
            emit('toggle', action.action_id || '', $event.target.checked)
          "
        />
        <div class="confirm-action-content">
          <div class="confirm-action-title">
            {{ getActionLabel(action.action_type) }}
          </div>
          <div class="confirm-action-meta">
            <span>{{ action.description || '无动作说明' }}</span
            ><span
              >风险 {{ action.risk_assessment?.risk_level || '未知' }}</span
            >
          </div>
          <div
            v-if="action.risk_assessment?.reasons?.length"
            class="confirm-action-reasons"
          >
            {{ action.risk_assessment.reasons.join(' / ') }}
          </div>
        </div>
        <a-button
          v-if="can('aiops.autofix.confirm')"
          size="small"
          class="confirm-action-one"
          :disabled="busy || !!issue"
          @click.prevent.stop="emit('confirmOne', action.action_id || '')"
          >确认此项</a-button
        >
      </label>
    </div>
    <a-button v-if="can('aiops.autofix.confirm')"
      type="primary"
      :loading="busy"
      :disabled="!canConfirm"
      @click="emit('confirm')"
      >确认并继续执行</a-button
    >
    <a-button
      v-if="can('aiops.autofix.confirm') && actions.length > 0"
      :loading="busy"
      :disabled="!canConfirmAll"
      @click="emit('confirmAll')"
      >全部确认</a-button
    >
  </section>
</template>
<style scoped>
.confirm-panel {
  display: flex;
  flex-direction: column;
  gap: var(--ops-space-md);
  padding: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
}
.confirm-panel-header,
.confirm-action-item,
.confirm-action-meta {
  display: flex;
  align-items: center;
  gap: var(--ops-space-sm);
}
.confirm-action-item {
  align-items: flex-start;
  padding: var(--ops-space-sm) 0;
}
.confirm-action-list,
.confirm-action-content {
  min-width: 0;
}
.confirm-action-meta {
  flex-wrap: wrap;
  color: var(--ops-muted);
}
.confirm-action-reasons,
.approval-expiry {
  color: var(--ops-muted);
  overflow-wrap: anywhere;
}
.approval-expiry {
  margin: 0;
}
</style>
