<template>
  <a-modal 
    :open="visible" 
    title="Service 指标信息" 
    width="800px" 
    class="cluster-modal" 
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert 
      v-if="service" 
      class="modal-alert" 
      type="info" 
      show-icon
    >
      <template #message>
        <span>{{ service.name }} ({{ service.namespace }})</span>
      </template>
      <template #description>
        <div>Service性能指标和监控数据</div>
      </template>
    </a-alert>

    <a-spin :spinning="loading">
      <div v-if="metrics" class="metrics-content">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-statistic title="请求总数" :value="metrics.request_count" />
          </a-col>
          <a-col :span="12">
            <a-statistic title="请求速率" :value="metrics.request_rate" suffix="/秒" />
          </a-col>
        </a-row>
        <a-row :gutter="16" style="margin-top: 16px">
          <a-col :span="12">
            <a-statistic title="响应时间" :value="metrics.response_time" suffix="ms" />
          </a-col>
          <a-col :span="12">
            <a-statistic title="错误率" :value="metrics.error_rate" suffix="%" />
          </a-col>
        </a-row>
        <a-row :gutter="16" style="margin-top: 16px">
          <a-col :span="12">
            <a-statistic title="连接数" :value="metrics.connection_count" />
          </a-col>
          <a-col :span="12">
            <a-statistic title="入站带宽" :value="metrics.bandwidth_in" suffix="KB/s" />
          </a-col>
        </a-row>
        <a-row :gutter="16" style="margin-top: 16px">
          <a-col :span="12">
            <a-statistic title="出站带宽" :value="metrics.bandwidth_out" suffix="KB/s" />
          </a-col>
          <a-col :span="12">
            <div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">最后更新</div>
              <div>{{ formatDateTime(metrics.last_updated) }}</div>
            </div>
          </a-col>
        </a-row>
      </div>
      <a-empty v-else description="暂无指标数据" />
    </a-spin>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sService, K8sServiceMetrics } from '../../../api';

defineProps<{
  visible: boolean;
  service: K8sService | null;
  metrics: K8sServiceMetrics | null;
  loading?: boolean;
}>();

defineEmits<{
  close: [];
}>();

// 格式化日期时间
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};
</script>

<style scoped>
.metrics-content {
  padding: 16px 0;
}

.metrics-content .ant-statistic {
  text-align: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.metrics-content .ant-statistic-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.metrics-content .ant-statistic-content {
  font-size: 20px;
  font-weight: 600;
  color: #1677ff;
}
</style>
