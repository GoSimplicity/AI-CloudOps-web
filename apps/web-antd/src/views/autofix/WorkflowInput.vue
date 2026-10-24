<script setup lang="ts">
import type { AutoFixTemplateKey } from './useAutoFixWorkflow';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();
const namespace = defineModel<string>('namespace', { required: true });
const deployment = defineModel<string>('deployment', { required: true });
const event = defineModel<string>('event', { required: true });
const description = defineModel<string>('description', { required: true });
const templateKey = defineModel<AutoFixTemplateKey>('templateKey', {
  required: true,
});
defineProps<{ busy: boolean; valid: boolean }>();
const emit = defineEmits<{ run: []; reset: []; templateChange: [] }>();
</script>
<template>
  <a-card title="修复输入" class="config-card">
    <a-form layout="vertical">
      <a-form-item label="命名空间" required
        ><a-input
          v-model:value="namespace"
          placeholder="default"
          :disabled="busy"
      /></a-form-item>
      <a-form-item label="Deployment"
        ><a-input
          v-model:value="deployment"
          placeholder="例如 payment-service"
          :disabled="busy"
      /></a-form-item>
      <a-form-item label="故障类型模板">
        <a-select
          v-model:value="templateKey"
          :disabled="busy"
          @change="emit('templateChange')"
        >
          <a-select-option value="custom">自定义</a-select-option>
          <a-select-option value="crashloop">CrashLoopBackOff</a-select-option>
          <a-select-option value="resource">资源不足</a-select-option>
          <a-select-option value="imagepull">镜像拉取失败</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="问题描述" required
        ><a-textarea
          v-model:value="description"
          :disabled="busy"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          placeholder="描述当前故障现象、涉及资源和期望处理方式"
      /></a-form-item>
      <a-form-item label="事件/诊断补充"
        ><a-textarea
          v-model:value="event"
          :disabled="busy"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="可粘贴 K8s Event、Pod 状态、错误日志摘要"
      /></a-form-item>
    </a-form>
    <a-space wrap>
      <a-button :disabled="busy" @click="emit('reset')">重置</a-button>
      <a-button
        v-if="can('aiops.autofix.run')"
        type="primary"
        :loading="busy"
        :disabled="!valid || busy"
        @click="emit('run')"
        >执行自动修复</a-button
      >
    </a-space>
  </a-card>
</template>
