<template>
  <a-modal
    :open="visible"
    title="Deployment Pod 列表"
    width="1100px"
    class="cluster-modal pods-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>查看所有Pod实例信息</div>
      </template>
    </a-alert>
    
    <a-spin :spinning="loading">
      <div v-if="pods.length > 0" class="pods-content">
        <a-table 
          :data-source="pods" 
          :columns="columns"
          :pagination="{ pageSize: 10 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="getPodStatusColor(record.status)">
                {{ record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'ready'">
              <span>{{ record.ready_containers || 0 }}/{{ record.total_containers || 0 }}</span>
            </template>
            <template v-else-if="column.key === 'created_at'">
              {{ formatDateTime(record.created_at) }}
            </template>
          </template>
        </a-table>
      </div>
      
      <a-empty v-else description="暂无Pod数据">
        <template #image>
          <AppstoreOutlined style="font-size: 64px; color: #d9d9d9;" />
        </template>
      </a-empty>
    </a-spin>
  </a-modal>
</template>

<script lang="ts" setup>
import { AppstoreOutlined } from '@ant-design/icons-vue';
import type { K8sDeployment } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  pods: any[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

defineEmits<{
  close: []
}>();

// 表格列配置
const columns = [
  { title: 'Pod名称', dataIndex: 'name', key: 'name', width: '25%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '12%' },
  { title: '就绪', dataIndex: 'ready', key: 'ready', width: '10%' },
  { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: '12%' },
  { title: '节点', dataIndex: 'node', key: 'node', width: '18%' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '18%' }
];

// 获取Pod状态颜色
const getPodStatusColor = (status: string) => {
  switch (status) {
    case 'Running':
      return 'green';
    case 'Pending':
      return 'orange';
    case 'Failed':
      return 'red';
    case 'Succeeded':
      return 'blue';
    default:
      return 'default';
  }
};

// 日期时间格式化
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};
</script>

<style scoped>
.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.pods-content {
  padding: 16px 0;
}
</style>
