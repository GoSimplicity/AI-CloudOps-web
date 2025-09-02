<template>
  <a-modal
    :open="visible"
    title="Deployment 事件"
    width="900px"
    class="cluster-modal events-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="deployment" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ deployment.name }} ({{ deployment.namespace }})</span>
      </template>
      <template #description>
        <div>查看相关事件日志</div>
      </template>
    </a-alert>
    
    <a-spin :spinning="loading">
      <div v-if="events.length > 0" class="events-content">
        <a-table 
          :data-source="events" 
          :columns="columns"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="record.type === 'Warning' ? 'orange' : 'green'">
                {{ record.type }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'time'">
              <div class="time-info">
                <div>首次: {{ formatDateTime(record.first_time) }}</div>
                <div>最后: {{ formatDateTime(record.last_time) }}</div>
              </div>
            </template>
          </template>
        </a-table>
      </div>
      
      <a-empty v-else description="暂无事件数据">
        <template #image>
          <UnorderedListOutlined style="font-size: 64px; color: #d9d9d9;" />
        </template>
      </a-empty>
    </a-spin>
  </a-modal>
</template>

<script lang="ts" setup>
import { UnorderedListOutlined } from '@ant-design/icons-vue';
import type { K8sDeployment } from '../../../api';

interface Props {
  visible: boolean
  deployment: K8sDeployment | null
  events: any[]
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
  { title: '类型', dataIndex: 'type', key: 'type', width: '12%' },
  { title: '原因', dataIndex: 'reason', key: 'reason', width: '18%' },
  { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '次数', dataIndex: 'count', key: 'count', width: '10%' },
  { title: '首次/最后发生时间', key: 'time', width: '20%' }
];

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

.events-content {
  padding: 16px 0;
}

.time-info {
  font-size: 12px;
  line-height: 1.4;
}

.time-info > div {
  margin-bottom: 2px;
}
</style>
