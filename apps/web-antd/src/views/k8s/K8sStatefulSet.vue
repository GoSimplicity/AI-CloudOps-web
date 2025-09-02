<template>
  <div class="statefulset-management-container">
    <!-- 页面头部 -->
    <K8sPageHeader
      title="Kubernetes StatefulSet 管理"
      subtitle="管理和监控集群中的有状态应用集合"
      :title-icon="DeploymentUnitOutlined"
    >
      <template #actions>
        <a-button type="primary" size="large" @click="showCreateModal">
          <template #icon><PlusOutlined /></template>
          创建 StatefulSet
        </a-button>
        <a-button type="primary" size="large" @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新数据
        </a-button>
      </template>
    </K8sPageHeader>

    <!-- 数据概览卡片 -->
    <K8sOverviewCards :cards="overviewCards" />

    <!-- 操作工具栏 -->
    <K8sToolbar
      v-model:selectedCluster="selectedCluster"
      v-model:selectedNamespace="selectedNamespace"
      v-model:searchText="searchText"
      :clusters="runningClusters"
      :namespaces="namespaces"
      :clustersLoading="clustersLoading"
      :namespacesLoading="namespacesLoading"
      :refreshLoading="loading"
      :selectedRows="selectedRows"
      :showBatchDelete="true"
      searchPlaceholder="搜索 StatefulSet 名称"
      @clusterChange="handleClusterChange"
      @namespaceChange="handleNamespaceChange"
      @search="refreshData"
      @refresh="refreshData"
      @batchDelete="handleBatchDelete"
    >
      <template #right>
        <div class="page-size-selector">
          <span class="selector-label">每页显示:</span>
          <a-select v-model:value="pageSize" size="small" style="width: 80px" @change="handlePageSizeChange">
            <a-select-option :value="12">12</a-select-option>
            <a-select-option :value="24">24</a-select-option>
            <a-select-option :value="48">48</a-select-option>
            <a-select-option :value="96">96</a-select-option>
          </a-select>
        </div>
      </template>
    </K8sToolbar>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredStatefulSets.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredStatefulSets.length }} 个StatefulSet</span>
          <div class="env-tags">
            <a-tag color="green">运行中 {{ runningCount }}</a-tag>
            <a-tag color="blue">Pod {{ readyReplicas }}/{{ desiredReplicas }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        :columns="columns"
        :data-source="filteredStatefulSets"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="uid"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }"
        @change="handleTableChange"
        class="cluster-table statefulsets-table"
      >
        <!-- StatefulSet名称列 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="statefulset-name">
              <DeploymentUnitOutlined />
              <span>{{ record.name }}</span>
            </div>
          </template>

          <!-- 服务名称列 -->
          <template v-else-if="column.key === 'serviceName'">
            <div class="service-name">
              <CloudServerOutlined />
              <span>{{ record.service_name || '-' }}</span>
            </div>
          </template>

          <!-- Pod状态列 -->
          <template v-else-if="column.key === 'podStatus'">
            <div class="pod-status-info">
              <a-progress
                :percent="getPodReadyPercentage(record)"
                size="small"
                :status="getPodReadyPercentage(record) === 100 ? 'success' : 'active'"
                style="width: 120px"
              />
              <span class="pod-numbers">
                {{ record.ready_replicas || 0 }}/{{ record.replicas || 0 }}
              </span>
            </div>
          </template>

          <!-- 状态列 -->
          <template v-else-if="column.key === 'status'">
            <K8sStatusTag :status="record.status" type="statefulset" />
          </template>

          <!-- 创建时间列 -->
          <template v-else-if="column.key === 'createdAt'">
            <div class="timestamp">
              <ClockCircleOutlined />
              <a-tooltip :title="formatDateTime(record.created_at)">
                <span>{{ formatDate(record.created_at) }}</span>
              </a-tooltip>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'action'">
            <div class="action-column">
              <a-tooltip title="查看详情">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewDetails(record)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="查看YAML">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewYaml(record)">
                  <template #icon><CodeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="扩缩容">
                <a-button type="primary" ghost shape="circle" size="small" @click="scaleStatefulSet(record)">
                  <template #icon><ExpandAltOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-dropdown>
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon><MoreOutlined /></template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="metrics" @click="viewMetrics(record)">
                      <BarChartOutlined />
                      查看指标
                    </a-menu-item>
                    <a-menu-item key="events" @click="viewEvents(record)">
                      <HistoryOutlined />
                      查看事件
                    </a-menu-item>
                    <a-menu-item key="pods" @click="viewPods(record)">
                      <AppstoreOutlined />
                      查看Pod
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="edit" @click="editStatefulSet(record)">
                      <EditOutlined />
                      编辑
                    </a-menu-item>
                    <a-menu-item key="delete" @click="deleteStatefulSet(record)" danger>
                      <DeleteOutlined />
                      删除
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <DeploymentUnitOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无StatefulSet数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- StatefulSet创建模态框 -->
    <ServiceCreateModal
      v-model:visible="isCreateModalVisible"
      :clusters="runningClusters"
      :clustersLoading="clustersLoading"
      :loading="createLoading"
      type="statefulset"
      @create="handleCreate"
    />

    <!-- StatefulSet编辑模态框 -->
    <ServiceEditModal
      v-model:visible="isEditModalVisible"
      :service="currentStatefulSet"
      :loading="updateLoading"
      type="statefulset"
      @update="handleUpdate"
    />

    <!-- YAML查看模态框 -->
    <StatefulSetYamlModal
      :visible="isYamlModalVisible"
      :statefulSet="currentStatefulSet"
      :yaml="yamlContent"
      :loading="yamlLoading"
      @close="closeYamlModal"
    />

    <!-- 扩缩容模态框 -->
    <StatefulSetScaleModal
      :visible="isScaleModalVisible"
      :statefulSet="currentStatefulSet"
      :loading="scaleLoading"
      @close="closeScaleModal"
      @scale="handleScale"
    />

    <!-- 指标展示模态框 -->
    <StatefulSetMetricsModal
      :visible="isMetricsModalVisible"
      :statefulSet="currentStatefulSet"
      :metrics="currentMetrics"
      :loading="metricsLoading"
      @close="closeMetricsModal"
    />

    <!-- 事件展示模态框 -->
    <StatefulSetEventsModal
      :visible="isEventsModalVisible"
      :statefulSet="currentStatefulSet"
      :events="currentEvents"
      :loading="eventsLoading"
      @close="closeEventsModal"
    />

    <!-- Pod列表模态框 -->
    <StatefulSetPodsModal
      :visible="isPodsModalVisible"
      :statefulSet="currentStatefulSet"
      :pods="currentPods"
      :loading="podsLoading"
      @close="closePodsModal"
    />

    <!-- 详情模态框 -->
    <ServiceDetailModal
      v-model:visible="isDetailModalVisible"
      :service="currentStatefulSet"
      type="statefulset"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import {
  DeploymentUnitOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  CodeOutlined,
  ExpandAltOutlined,
  MoreOutlined,
  BarChartOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useStatefulSetManagement } from './composables/useStatefulSetManagement'
import {
  K8sPageHeader,
  K8sOverviewCards,
  K8sToolbar,
  K8sStatusTag,
  ServiceCreateModal,
  ServiceEditModal,
  ServiceDetailModal,
  StatefulSetYamlModal,
  StatefulSetScaleModal,
  StatefulSetMetricsModal,
  StatefulSetEventsModal,
  StatefulSetPodsModal
} from './components'

// 使用StatefulSet管理组合函数
const {
  // 数据状态
  statefulSets,
  filteredStatefulSets,
  runningClusters,
  namespaces,
  selectedRows,
  currentStatefulSet,
  currentMetrics,
  currentEvents,
  currentPods,
  yamlContent,
  
  // 加载状态
  loading,
  clustersLoading,
  namespacesLoading,
  createLoading,
  updateLoading,
  yamlLoading,
  scaleLoading,
  metricsLoading,
  eventsLoading,
  podsLoading,
  
  // 模态框状态
  isCreateModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  isScaleModalVisible,
  isMetricsModalVisible,
  isEventsModalVisible,
  isPodsModalVisible,
  
  // 筛选状态
  selectedCluster,
  selectedNamespace,
  searchText,
  pageSize,
  currentPage,
  
  // 方法
  refreshData,
  handleClusterChange,
  handleNamespaceChange,
  handlePageSizeChange,
  handleTableChange,
  handleBatchDelete,
  showCreateModal,
  handleCreate,
  editStatefulSet,
  handleUpdate,
  deleteStatefulSet,
  viewDetails,
  viewYaml,
  closeYamlModal,
  scaleStatefulSet,
  closeScaleModal,
  handleScale,
  viewMetrics,
  closeMetricsModal,
  viewEvents,
  closeEventsModal,
  viewPods,
  closePodsModal
} = useStatefulSetManagement()

// 计算属性
const totalItems = computed(() => filteredStatefulSets.value.length)

const runningCount = computed(() => 
  statefulSets.value.filter(s => s.status === 'Running').length
)

const desiredReplicas = computed(() => 
  statefulSets.value.reduce((sum, s) => sum + (s.replicas || 0), 0)
)

const readyReplicas = computed(() => 
  statefulSets.value.reduce((sum, s) => sum + (s.ready_replicas || 0), 0)
)

// 概览卡片数据
const overviewCards = computed(() => [
  {
    title: 'StatefulSet 总数',
    value: statefulSets.value.length,
    icon: DeploymentUnitOutlined,
    color: 'blue'
  },
  {
    title: '运行中',
    value: runningCount.value,
    icon: 'CheckCircleOutlined',
    color: 'green'
  },
  {
    title: '期望 Pod 数',
    value: desiredReplicas.value,
    icon: 'NodeIndexOutlined',
    color: 'orange'
  },
  {
    title: '就绪 Pod 数',
    value: readyReplicas.value,
    icon: 'DatabaseOutlined',
    color: 'purple'
  }
])

// 表格列配置
const columns = [
  {
    title: 'StatefulSet 名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    sorter: (a: any, b: any) => a.name.localeCompare(b.name),
    fixed: 'left'
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 150,
    sorter: (a: any, b: any) => a.namespace.localeCompare(b.namespace)
  },
  {
    title: '服务名称',
    dataIndex: 'service_name',
    key: 'serviceName',
    width: 150
  },
  {
    title: 'Pod状态',
    dataIndex: 'podStatus',
    key: 'podStatus',
    width: 180,
    sorter: (a: any, b: any) => {
      const aReady = (a.ready_replicas || 0) / (a.replicas || 1)
      const bReady = (b.ready_replicas || 0) / (b.replicas || 1)
      return aReady - bReady
    }
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    sorter: (a: any, b: any) => a.status.localeCompare(b.status)
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: 150,
    sorter: (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    fixed: 'right'
  }
]

// 表格行选择配置
const rowSelection = {
  selectedRowKeys: computed(() => selectedRows.value.map(row => row.uid)),
  onChange: (selectedRowKeys: string[], selectedRowsData: any[]) => {
    selectedRows.value = selectedRowsData
  }
}

// 获取Pod就绪百分比
const getPodReadyPercentage = (record: any) => {
  const ready = record.ready_replicas || 0
  const total = record.replicas || 1
  return Math.round((ready / total) * 100)
}

// 时间格式化函数
const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

// 组件挂载时初始化数据
onMounted(() => {
  refreshData()
})
</script>
