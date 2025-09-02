<template>
  <a-modal
    :open="visible"
    title="StatefulSet Pod 列表"
    width="1200px"
    class="cluster-modal pods-modal"
    :footer="null"
    @cancel="$emit('close')"
  >
    <a-alert v-if="statefulSet" class="modal-alert" type="info" show-icon>
      <template #message>
        <span>{{ statefulSet.name }} ({{ statefulSet.namespace }})</span>
      </template>
      <template #description>
        <div>查看StatefulSet管理的Pod实例</div>
      </template>
    </a-alert>

    <div class="pods-container">
      <a-spin :spinning="loading" tip="正在加载Pod数据...">
        <div v-if="!loading && (!pods || pods.length === 0)" class="no-pods">
          <a-empty description="暂无Pod数据" />
        </div>

        <div v-else-if="pods && pods.length > 0" class="pods-content">
          <a-table
            :dataSource="pods"
            :columns="podColumns"
            :pagination="{ pageSize: 10, size: 'small' }"
            size="small"
            :scroll="{ x: 1000 }"
            row-key="name"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="pod-name">
                  <AppstoreOutlined style="color: #1677ff; margin-right: 6px;" />
                  <span>{{ record.name }}</span>
                </div>
              </template>
              
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getPodStatusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              
              <template v-else-if="column.key === 'ready'">
                <div class="ready-info">
                  <span>{{ record.readyContainers || 0 }}/{{ record.totalContainers || 0 }}</span>
                  <a-progress
                    :percent="getReadyPercent(record)"
                    size="small"
                    :show-info="false"
                    :status="getReadyPercent(record) === 100 ? 'success' : 'active'"
                    style="margin-top: 2px;"
                  />
                </div>
              </template>
              
              <template v-else-if="column.key === 'restarts'">
                <a-badge
                  :count="record.restarts || 0"
                  :number-style="{ backgroundColor: getRestartColor(record.restarts || 0) }"
                />
              </template>
              
              <template v-else-if="column.key === 'age'">
                <span class="pod-age">{{ formatPodAge(record.createdAt) }}</span>
              </template>
              
              <template v-else-if="column.key === 'node'">
                <div class="node-info">
                  <CloudServerOutlined style="color: #52c41a; margin-right: 4px;" />
                  <span>{{ record.nodeName || '-' }}</span>
                </div>
              </template>
              
              <template v-else-if="column.key === 'resources'">
                <div class="resource-info">
                  <div v-if="record.resources">
                    <div class="resource-item">
                      <span class="resource-label">CPU:</span>
                      <span class="resource-value">{{ record.resources.cpu || '-' }}</span>
                    </div>
                    <div class="resource-item">
                      <span class="resource-label">内存:</span>
                      <span class="resource-value">{{ record.resources.memory || '-' }}</span>
                    </div>
                  </div>
                  <span v-else>-</span>
                </div>
              </template>
            </template>
          </a-table>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import { AppstoreOutlined, CloudServerOutlined } from '@ant-design/icons-vue';
import type { K8sStatefulSet } from '../../../api';

interface Props {
  visible: boolean
  statefulSet: K8sStatefulSet | null
  pods: any[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: []
}>();

// Pod表格列定义
const podColumns = [
  {
    title: 'Pod 名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left' as const,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '就绪状态',
    dataIndex: 'ready',
    key: 'ready',
    width: 120,
  },
  {
    title: '重启次数',
    dataIndex: 'restarts',
    key: 'restarts',
    width: 100,
    align: 'center' as const,
    sorter: (a: any, b: any) => (a.restarts || 0) - (b.restarts || 0),
  },
  {
    title: '运行时间',
    dataIndex: 'age',
    key: 'age',
    width: 120,
    sorter: (a: any, b: any) => {
      const timeA = new Date(a.createdAt || '').getTime();
      const timeB = new Date(b.createdAt || '').getTime();
      return timeB - timeA;
    },
  },
  {
    title: '节点',
    dataIndex: 'node',
    key: 'node',
    width: 150,
  },
  {
    title: '资源使用',
    dataIndex: 'resources',
    key: 'resources',
    width: 140,
  },
];

// 获取Pod状态颜色
const getPodStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'running':
      return 'green';
    case 'pending':
      return 'orange';
    case 'failed':
      return 'red';
    case 'succeeded':
      return 'blue';
    case 'unknown':
      return 'default';
    default:
      return 'default';
  }
};

// 获取就绪百分比
const getReadyPercent = (pod: any) => {
  const ready = pod.readyContainers || 0;
  const total = pod.totalContainers || 1;
  return Math.round((ready / total) * 100);
};

// 获取重启次数颜色
const getRestartColor = (count: number) => {
  if (count === 0) return '#52c41a';
  if (count <= 3) return '#fa8c16';
  return '#ff4d4f';
};

// 格式化Pod运行时间
const formatPodAge = (createdAt: string) => {
  if (!createdAt) return '-';
  
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}秒`;
  if (diffMins < 60) return `${diffMins}分钟`;
  if (diffHours < 24) return `${diffHours}小时`;
  return `${diffDays}天`;
};
</script>

<style scoped>
.pods-container {
  min-height: 400px;
}

.no-pods {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.pods-content {
  padding: 8px 0;
}

.pod-name {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.ready-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.pod-age {
  font-size: 12px;
  color: #666;
}

.node-info {
  display: flex;
  align-items: center;
  font-size: 12px;
}

.resource-info {
  font-size: 12px;
}

.resource-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}

.resource-label {
  color: #666;
  margin-right: 4px;
}

.resource-value {
  color: #333;
  font-weight: 500;
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

:deep(.ant-progress-line) {
  width: 100%;
}
</style>
