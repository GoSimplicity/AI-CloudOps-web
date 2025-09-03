<template>
  <div class="k8s-daemonset-container">
    <!-- 页面头部 -->
    <K8sPageHeader
      title="守护进程集管理"
      subtitle="管理和监控集群中的所有 Kubernetes DaemonSet 资源"
      :title-icon="DatabaseOutlined"
      @refresh="refreshAll"
      :loading="loading"
    />

    <!-- 概览卡片 -->
    <K8sOverviewCards :cards="overviewCards" />

    <!-- 集群选择器 -->
    <div class="cluster-selector-section">
      <a-card class="cluster-card">
        <div class="cluster-selector-content">
          <div class="selector-label">
            <ClusterOutlined />
            <span>选择集群</span>
          </div>
          <K8sClusterSelector
            v-model:value="selectedCluster"
            :clusters="runningClusters"
            :loading="clustersLoading"
            @change="handleClusterChange"
            placeholder="请选择要管理的集群"
          />
        </div>
      </a-card>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索DaemonSet名称或命名空间"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
        
        <a-select
          v-model:value="namespaceFilter"
          placeholder="命名空间"
          class="namespace-filter"
          allow-clear
          @change="onNamespaceFilterChange"
        >
          <a-select-option v-for="ns in availableNamespaces" :key="ns" :value="ns">
            {{ ns }}
          </a-select-option>
        </a-select>
      </div>
      
      <div class="toolbar-right">
        <a-button @click="refreshAll" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新全部
        </a-button>
      </div>
    </div>

    <!-- 简化的DaemonSet表格 -->
    <div class="table-section">
      <a-table
        :dataSource="filteredDaemonSets"
        :columns="columns"
        :loading="loading"
        :row-selection="rowSelection"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: filteredDaemonSets.length,
          showSizeChanger: true,
          showQuickJumper: true
        }"
        @change="handleTableChange"
        rowKey="id"
        class="daemonset-table"
      >
        <template #bodyCell="{ column, record }">
          <!-- DaemonSet名称列 -->
          <template v-if="column.key === 'name'">
            <div class="daemonset-name">
              <DatabaseOutlined />
              <span class="name">{{ record.name }}</span>
            </div>
          </template>

          <!-- 节点状态列 -->
          <template v-else-if="column.key === 'nodes'">
            <div class="node-status">
              <span class="ready">{{ record.number_ready || 0 }}</span>
              <span class="separator">/</span>
              <span class="desired">{{ record.desired_number_scheduled || 0 }}</span>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'actions'">
            <div class="table-actions">
              <a-button type="link" size="small" @click="showDetail(record)">
                查看详情
              </a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">
                删除
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- DaemonSet详情查看区域 -->
    <div v-if="showDetailPanel" class="detail-section">
      <div class="detail-header">
        <h3>DaemonSet详情 - {{ currentDaemonSet?.name }}</h3>
        <a-button type="text" @click="closeDetail">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </div>
      <a-tabs>
        <a-tab-pane key="pods" tab="Pod列表">
          <div class="pods-content">
            <p>DaemonSet下的Pod信息将在这里显示</p>
          </div>
        </a-tab-pane>
        <a-tab-pane key="events" tab="事件日志">
          <div class="events-content">
            <p>DaemonSet事件日志将在这里显示</p>
          </div>
        </a-tab-pane>
        <a-tab-pane key="yaml" tab="YAML配置">
          <div class="yaml-content">
            <pre class="yaml-text"># DaemonSet YAML配置</pre>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import {
  ClusterOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  CloseOutlined,
  BarChartOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import {
  K8sPageHeader,
  K8sOverviewCards,
  K8sClusterSelector,
  // K8sStatusTag,
  // K8sDataTable
} from './components'
import {
  getClustersListApi,
  type K8sCluster,
  ClusterStatus
} from '#/api/core/k8s/k8s_cluster'
import {
  getDaemonSetListApi,
  // deleteDaemonSetApi,
  type K8sDaemonSet
} from '#/api/core/k8s/k8s_daemonset'

// 基本数据状态
const daemonSets = ref<K8sDaemonSet[]>([])
const clusters = ref<K8sCluster[]>([])
const loading = ref(false)
const clustersLoading = ref(false)
const selectedCluster = ref<number | undefined>()
const searchText = ref('')
const namespaceFilter = ref('')

// 表格选择相关
const selectedRowKeys = ref<string[]>([])
const selectedRows = ref<K8sDaemonSet[]>([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const availableNamespaces = ref<string[]>(['default', 'kube-system'])

// 详情显示相关
const showDetailPanel = ref(false)
const currentDaemonSet = ref<K8sDaemonSet | null>(null)

// 计算属性
const runningClusters = computed(() => 
  clusters.value.filter(c => c.status === ClusterStatus.Running)
)

const filteredDaemonSets = computed(() => {
  let result = daemonSets.value
  
  if (searchText.value) {
    result = result.filter(daemonSet => 
      daemonSet.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      daemonSet.namespace?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (namespaceFilter.value) {
    result = result.filter(daemonSet => daemonSet.namespace === namespaceFilter.value)
  }
  
  return result
})

const overviewCards = computed(() => [
  {
    label: 'DaemonSet总数',
    value: daemonSets.value.length,
    icon: DatabaseOutlined,
    type: 'total'
  },
  {
    label: '运行中',
    value: daemonSets.value.filter(d => (d.number_ready || 0) === (d.desired_number_scheduled || 0)).length,
    icon: PlayCircleOutlined,
    type: 'running'
  },
  {
    label: '期望节点数',
    value: daemonSets.value.reduce((total, d) => total + (d.desired_number_scheduled || 0), 0),
    icon: BarChartOutlined,
    type: 'warning'
  },
  {
    label: '就绪节点数',
    value: daemonSets.value.reduce((total, d) => total + (d.number_ready || 0), 0),
    icon: ClusterOutlined,
    type: 'total'
  }
])

// 表格行选择配置
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[], rows: K8sDaemonSet[]) => {
    selectedRowKeys.value = keys
    selectedRows.value = rows
  }
}))

// 基本操作方法
const fetchClusters = async () => {
  try {
    clustersLoading.value = true
    const response = await getClustersListApi()
    clusters.value = response.data?.list || []
  } catch (error) {
    console.error('获取集群列表失败:', error)
    message.error('获取集群列表失败')
  } finally {
    clustersLoading.value = false
  }
}

const fetchDaemonSets = async () => {
  if (!selectedCluster.value) {
    daemonSets.value = []
    return
  }
  
  try {
    loading.value = true
    const response = await getDaemonSetListApi({
      cluster_id: selectedCluster.value,
      page: currentPage.value,
      size: pageSize.value
    })
    daemonSets.value = response.data?.list || []
  } catch (error) {
    console.error('获取DaemonSet列表失败:', error)
    message.error('获取DaemonSet列表失败')
  } finally {
    loading.value = false
  }
}

const handleClusterChange = async () => {
  currentPage.value = 1
  await fetchDaemonSets()
}

const onSearch = () => {
  currentPage.value = 1
}

const onNamespaceFilterChange = () => {
  currentPage.value = 1
}

const refreshAll = async () => {
  await Promise.all([fetchClusters(), fetchDaemonSets()])
}

const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchDaemonSets()
}

// 表格列配置
const columns = [
  {
    title: 'DaemonSet名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left'
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 120
  },
  {
    title: '节点状态',
    key: 'nodes',
    width: 100,
    align: 'center'
  },
  {
    title: '镜像',
    dataIndex: 'image',
    key: 'image',
    ellipsis: true,
    width: 200
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: 150
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right'
  }
]

// UI 操作方法
const showDetail = (record: any) => {
  showDetailPanel.value = true
  currentDaemonSet.value = record
}

const closeDetail = () => {
  showDetailPanel.value = false
}

// 确认删除DaemonSet
const confirmDelete = (daemonSet: any) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除DaemonSet "${daemonSet.name}" 吗？`,
    onOk: () => console.log('删除DaemonSet:', daemonSet.id)
  })
}

// 页面初始化
onMounted(async () => {
  // 初始化数据
})
</script>

<style scoped>
.k8s-daemonset-container {
  padding: 16px;
  background-color: #f8f9fa;
  min-height: 100vh;
}

/* 简化的页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #e8e8e8;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 24px;
  color: #1677ff;
}

.page-title {
  margin: 0;
  font-size: 20px;
  color: #262626;
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: #8c8c8c;
}

.header-right {
  display: flex;
  gap: 8px;
}

/* 简化的概览信息 */
.overview-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.overview-item {
  flex: 1;
  min-width: 120px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  text-align: center;
  border: 1px solid #e8e8e8;
}

.overview-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #1677ff;
  margin-bottom: 4px;
}

.overview-label {
  font-size: 14px;
  color: #666;
}

/* 简化的集群选择器 */
.cluster-selector-section {
  margin-bottom: 16px;
}

.selector-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.selector-icon {
  color: #1677ff;
}

.selector-label {
  font-weight: 500;
  color: #333;
}

.cluster-selector {
  min-width: 200px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.search-input {
  width: 280px;
}

.namespace-filter {
  width: 120px;
}

/* 详情区域 */
.detail-section {
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-header h3 {
  margin: 0;
  color: #262626;
}

.pods-content, .events-content {
  padding: 16px 0;
}

.yaml-content {
  padding: 16px 0;
}

.yaml-text {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  overflow-x: auto;
}

/* 表格区域 */
.table-section {
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.daemonset-table {
  margin: 0;
}

.daemonset-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.daemonset-name .name {
  font-weight: 500;
  color: #1677ff;
}

.node-status {
  font-weight: 500;
}

.node-status .ready {
  color: #52c41a;
}

.node-status .separator {
  color: #999;
  margin: 0 2px;
}

.node-status .desired {
  color: #666;
}

.table-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .overview-section {
    gap: 8px;
  }
  
  .overview-item {
    min-width: calc(50% - 4px);
  }
  
  .toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .toolbar-left {
    flex-wrap: wrap;
  }
  
  .search-input {
    width: 100%;
  }
}
</style>
