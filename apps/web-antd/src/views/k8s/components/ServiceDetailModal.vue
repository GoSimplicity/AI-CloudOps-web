<template>
  <a-modal 
    :open="visible" 
    title="Service 详情" 
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
        <div>Service详情信息</div>
      </template>
    </a-alert>

    <a-spin :spinning="loading">
      <div v-if="service" class="details-content">
        <div class="detail-item">
          <span class="label">名称:</span>
          <span class="value">{{ service.name }}</span>
        </div>
        <div class="detail-item">
          <span class="label">命名空间:</span>
          <span class="value">{{ service.namespace }}</span>
        </div>
        <div class="detail-item">
          <span class="label">类型:</span>
          <span class="value">{{ service.type }}</span>
        </div>
        <div class="detail-item">
          <span class="label">集群IP:</span>
          <span class="value">{{ service.cluster_ip }}</span>
        </div>
        <div class="detail-item">
          <span class="label">端口:</span>
          <span class="value">
            <a-tag 
              v-for="port in service.ports" 
              :key="`${port.port}-${port.protocol}`" 
              color="blue"
              size="small"
            >
              {{ port.port }}/{{ port.protocol }}
            </a-tag>
          </span>
        </div>
        <div class="detail-item">
          <span class="label">端点:</span>
          <span class="value">{{ service.endpoints?.length || 0 }}</span>
        </div>
        <div class="detail-item">
          <span class="label">创建时间:</span>
          <span class="value">
            <ClockCircleOutlined />
            {{ formatDate(service.created_at) }}
          </span>
        </div>
        <div v-if="service.labels && Object.keys(service.labels).length > 0" class="detail-item">
          <span class="label">标签:</span>
          <span class="value">
            <a-tag 
              v-for="(value, key) in service.labels" 
              :key="key" 
              style="margin-right: 4px;"
            >
              {{ key }}: {{ value }}
            </a-tag>
          </span>
        </div>
        <div v-if="service.annotations && Object.keys(service.annotations).length > 0" class="detail-item">
          <span class="label">注解:</span>
          <span class="value">
            <a-tag 
              v-for="(value, key) in service.annotations" 
              :key="key" 
              style="margin-right: 4px;"
            >
              {{ key }}: {{ value }}
            </a-tag>
          </span>
        </div>
      </div>
      <a-empty v-else description="暂无详情数据" />
    </a-spin>
  </a-modal>
</template>

<script lang="ts" setup>
import { ClockCircleOutlined } from '@ant-design/icons-vue';
import type { K8sService } from '../../../api';

defineProps<{
  visible: boolean;
  service: K8sService | null;
  loading?: boolean;
}>();

defineEmits<{
  close: [];
}>();

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
</script>

<style scoped>
.details-content {
  padding: 16px 0;
}

.detail-item {
  display: flex;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.detail-item .label {
  font-weight: 500;
  color: #666;
  min-width: 100px;
  margin-right: 16px;
}

.detail-item .value {
  flex: 1;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-item .value .anticon {
  color: #1677ff;
}
</style>
