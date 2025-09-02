<template>
  <a-modal 
    :open="visible" 
    title="Service 事件列表" 
    width="900px" 
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
        <div>Service相关事件记录</div>
      </template>
    </a-alert>

    <a-table 
      :data-source="events" 
      :columns="columns" 
      :loading="loading" 
      :pagination="{ pageSize: 10 }" 
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'first_time'">
          {{ formatDateTime(record.first_time) }}
        </template>
        <template v-if="column.key === 'last_time'">
          {{ formatDateTime(record.last_time) }}
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sService, K8sServiceEvent } from '../../../api';

defineProps<{
  visible: boolean;
  service: K8sService | null;
  events: K8sServiceEvent[];
  loading?: boolean;
}>();

defineEmits<{
  close: [];
}>();

// 表格列配置
const columns = [
  { title: '类型', dataIndex: 'type', key: 'type', width: '80px' },
  { title: '原因', dataIndex: 'reason', key: 'reason', width: '120px' },
  { title: '消息', dataIndex: 'message', key: 'message' },
  { title: '次数', dataIndex: 'count', key: 'count', width: '80px' },
  { title: '首次时间', key: 'first_time', width: '150px' },
  { title: '最后时间', key: 'last_time', width: '150px' },
  { title: '来源', dataIndex: 'source', key: 'source', width: '120px' }
];

// 格式化日期时间
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};
</script>
