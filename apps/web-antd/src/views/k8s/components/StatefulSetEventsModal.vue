<template>
  <a-modal
    :open="visible"
    title="StatefulSet 事件"
    width="1000px"
    class="cluster-modal events-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="statefulSet" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ statefulSet.name }} ({{ statefulSet.namespace }})</span>
      </template>
      <template #description>
        <div>查看StatefulSet相关的系统事件</div>
      </template>
    </a-alert>

    <div class="events-container">
      <a-spin :spinning="loading" tip="正在加载事件数据...">
        <div v-if="!loading && (!events || events.length === 0)" class="no-events">
          <a-empty description="暂无事件数据" />
        </div>

        <div v-else-if="events && events.length > 0" class="events-content">
          <a-table
            :dataSource="events"
            :columns="eventColumns"
            :pagination="{ pageSize: 10, size: 'small' }"
            size="small"
            :scroll="{ x: 800 }"
            row-key="uid"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <a-tag :color="getEventTypeColor(record.type)">
                  {{ record.type }}
                </a-tag>
              </template>
              
              <template v-else-if="column.key === 'reason'">
                <span class="event-reason">{{ record.reason }}</span>
              </template>
              
              <template v-else-if="column.key === 'message'">
                <div class="event-message">
                  <a-tooltip :title="record.message">
                    <span>{{ truncateMessage(record.message) }}</span>
                  </a-tooltip>
                </div>
              </template>
              
              <template v-else-if="column.key === 'firstTime'">
                <span class="event-time">{{ formatEventTime(record.firstTime) }}</span>
              </template>
              
              <template v-else-if="column.key === 'count'">
                <a-badge :count="record.count || 1" :number-style="{ backgroundColor: getCountColor(record.count || 1) }" />
              </template>
            </template>
          </a-table>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import type { K8sStatefulSet } from '../../../api';

interface Props {
  visible: boolean
  statefulSet: K8sStatefulSet | null
  events: any[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: []
}>();

// 事件表格列定义
const eventColumns = [
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 120,
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '首次时间',
    dataIndex: 'firstTime',
    key: 'firstTime',
    width: 120,
    sorter: (a: any, b: any) => new Date(a.firstTime).getTime() - new Date(b.firstTime).getTime(),
    sortDirections: ['descend', 'ascend'] as const,
    defaultSortOrder: 'descend' as const,
  },
  {
    title: '次数',
    dataIndex: 'count',
    key: 'count',
    width: 80,
    align: 'center' as const,
  },
];

// 获取事件类型颜色
const getEventTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'normal':
      return 'green';
    case 'warning':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'blue';
  }
};

// 获取计数颜色
const getCountColor = (count: number) => {
  if (count > 10) return '#ff4d4f';
  if (count > 5) return '#fa8c16';
  return '#52c41a';
};

// 截断消息
const truncateMessage = (message: string) => {
  if (!message) return '';
  return message.length > 100 ? message.substring(0, 100) + '...' : message;
};

// 格式化事件时间
const formatEventTime = (timeString: string) => {
  if (!timeString) return '-';
  const date = new Date(timeString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
</script>

<style scoped>
.events-container {
  min-height: 400px;
}

.no-events {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.events-content {
  padding: 8px 0;
}

.event-reason {
  font-weight: 500;
  color: #1677ff;
}

.event-message {
  line-height: 1.4;
  color: #666;
}

.event-time {
  font-size: 12px;
  color: #999;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

:deep(.ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 500;
}

:deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f5f5f5;
}

:deep(.ant-badge-count) {
  font-size: 12px;
  height: 18px;
  line-height: 18px;
  min-width: 18px;
  padding: 0 6px;
}
</style>
