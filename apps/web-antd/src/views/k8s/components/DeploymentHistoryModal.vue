<template>
  <a-modal
    :open="visible"
    title="历史版本"
    width="800px"
    :footer="null"
    class="cluster-modal"
    @cancel="$emit('close')"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>查看历史版本记录</div>
      </template>
    </a-alert>

    <a-table 
      :data-source="history" 
      :columns="columns"
      :loading="loading"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'date'">
          {{ formatDateTime(record.date) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button 
            type="primary" 
            size="small" 
            @click="handleRollback(record.revision)"
            :loading="loading"
          >
            回滚
          </a-button>
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sDeployment, K8sDeploymentHistory } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  history: K8sDeploymentHistory[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: []
  rollback: [revision: number]
}>();

// 表格列配置
const columns = [
  { title: '版本', dataIndex: 'revision', key: 'revision', width: '15%' },
  { title: '变更信息', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '创建时间', dataIndex: 'date', key: 'date', width: '25%' },
  { title: '操作', key: 'action', width: '15%' }
];

// 日期时间格式化
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

const handleRollback = (revision: number) => {
  emit('rollback', revision);
};
</script>

<style scoped>
.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}
</style>
