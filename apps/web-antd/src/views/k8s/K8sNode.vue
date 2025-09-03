<template>
  <div class="k8s-node-container">
    <!-- 页面头部 -->
    <K8sPageHeader title="节点管理" subtitle="管理和监控集群中的所有 Kubernetes 节点" :title-icon="DesktopOutlined" @refresh="refreshAll"
      :loading="loading" />

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
          <K8sClusterSelector v-model:value="selectedCluster" :clusters="runningClusters" :loading="clustersLoading"
            @change="handleClusterChange" placeholder="请选择要管理的集群" />
        </div>
      </a-card>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search v-model:value="searchText" placeholder="搜索节点名称、IP或角色" class="search-input" @search="onSearch"
          allow-clear />

        <a-select v-model:value="statusFilter" placeholder="状态筛选" class="status-filter" allow-clear
          @change="onStatusFilterChange">
          <a-select-option value="Ready">
            <CheckCircleOutlined style="color: #52c41a" />
            正常
          </a-select-option>
          <a-select-option value="NotReady">
            <StopOutlined style="color: #f5222d" />
            异常
          </a-select-option>
        </a-select>

        <a-select v-model:value="roleFilter" placeholder="角色筛选" class="role-filter" allow-clear
          @change="onRoleFilterChange">
          <a-select-option value="master">Master</a-select-option>
          <a-select-option value="node">Worker</a-select-option>
        </a-select>
      </div>

      <div class="toolbar-right">
        <a-button @click="refreshAll" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新全部
        </a-button>

        <a-button type="primary" danger @click="showBatchDeleteConfirm" :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0">
          <template #icon>
            <DeleteOutlined />
          </template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 节点表格 -->
    <K8sDataTable :dataSource="filteredNodes" :columns="columns" :loading="loading" :rowSelection="rowSelection"
      :pagination="{
        current: currentPage,
        pageSize: pageSize,
        total: filteredNodes.length
      }" @change="handleTableChange" rowKey="name" :scroll="{ x: 1000 }" emptyText="暂无节点数据，请先选择一个集群">
      <template #bodyCell="{ column, record }">
        <!-- 节点名称列 -->
        <template v-if="column.key === 'name'">
          <div class="node-name">
            <DesktopOutlined />
            <span class="name">{{ record.name }}</span>
          </div>
        </template>

        <!-- 状态列 -->
        <template v-else-if="column.key === 'status'">
          <K8sStatusTag :status="getNodeStatus(record)" :text="getStatusText(record)" />
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.key === 'actions'">
          <div class="table-actions">
            <a-tooltip title="监控指标">
              <a-button type="primary" ghost shape="circle" size="small" @click="showNodeMetrics(record)">
                <template #icon>
                  <BarChartOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="事件日志">
              <a-button type="primary" ghost shape="circle" size="small" @click="showNodeEvents(record)">
                <template #icon>
                  <UnorderedListOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-dropdown>
              <a-button type="primary" ghost shape="circle" size="small">
                <template #icon>
                  <MoreOutlined />
                </template>
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="delete" @click="confirmDelete(record)" danger>
                    <DeleteOutlined />
                    删除节点
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </template>
      </template>

    </K8sDataTable>

    <!-- 节点详情查看区域 -->
    <div v-if="showDetail" class="detail-section">
      <div class="detail-header">
        <h3>节点详情 - {{ currentNode?.name }}</h3>
        <a-button type="text" @click="closeDetail">
          <template #icon>
            <CloseOutlined />
          </template>
        </a-button>
      </div>
      <a-tabs>
        <a-tab-pane key="metrics" tab="节点指标">
          <div class="metrics-content">
            <p>节点指标信息将在这里显示</p>
          </div>
        </a-tab-pane>
        <a-tab-pane key="events" tab="节点事件">
          <div class="events-content">
            <p v-if="!nodeEvents.length">暂无事件数据</p>
            <div v-else>
              <div v-for="event in nodeEvents" :key="event.id" class="event-item">
                {{ event.message }}
              </div>
            </div>
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
  DesktopOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  DeleteOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  WarningOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import {
  K8sPageHeader,
  K8sOverviewCards,
  K8sClusterSelector,
  K8sStatusTag
} from './components'
import {
  getClustersListApi,
  type K8sCluster,
  ClusterStatus
} from '#/api/core/k8s/k8s_cluster'
import {
  getK8sNodeList,
  deleteK8sNode,
  type K8sNode,
  type GetK8sNodeListReq,
  type DrainK8sNodeReq
} from '#/api/core/k8s/k8s_node'

// 基本数据状态
const nodes = ref<K8sNode[]>([])
const clusters = ref<K8sCluster[]>([])
const loading = ref(false)
const clustersLoading = ref(false)
const selectedCluster = ref<number | undefined>()
const searchText = ref('')
const statusFilter = ref('')
const roleFilter = ref('')

// 表格选择相关
const selectedRowKeys = ref<string[]>([])
const selectedRows = ref<K8sNode[]>([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 详情显示相关
const showDetail = ref(false)
const currentNode = ref<K8sNode | null>(null)
const nodeEvents = ref<any[]>([])

// 计算属性
const runningClusters = computed(() =>
  clusters.value.filter(c => c.status === ClusterStatus.Running)
)

const filteredNodes = computed(() => {
  let result = nodes.value

  // 搜索过滤
  if (searchText.value) {
    result = result.filter(node =>
      node.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      node.internal_ip?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  // 状态过滤
  if (statusFilter.value) {
    result = result.filter(node => {
      const status = getNodeStatus(node)
      return status === statusFilter.value
    })
  }

  // 角色过滤
  if (roleFilter.value) {
    result = result.filter(node =>
      node.roles?.some(role => role.toLowerCase().includes(roleFilter.value.toLowerCase()))
    )
  }

  return result
})

const healthyNodes = computed(() =>
  nodes.value.filter(node => getNodeStatus(node) === 'Ready').length
)

const warningNodes = computed(() =>
  nodes.value.filter(node => getNodeStatus(node) === 'NotReady').length
)

const errorNodes = computed(() =>
  nodes.value.filter(node => getNodeStatus(node) === 'Unknown').length
)

const totalResources = computed(() => ({
  cpu: nodes.value.reduce((total, node) => total + (node.cpu?.total ? parseInt(node.cpu.total) : 0), 0),
  memory: nodes.value.reduce((total, node) => total + (node.memory?.total ? parseInt(node.memory.total) : 0), 0)
}))

// 概览卡片数据
const overviewCards = computed(() => [
  {
    label: '节点总数',
    value: nodes.value.length,
    icon: DesktopOutlined,
    type: 'total'
  },
  {
    label: '健康节点',
    value: healthyNodes.value,
    icon: CheckCircleOutlined,
    type: 'running'
  },
  {
    label: '问题节点',
    value: warningNodes.value + errorNodes.value,
    icon: WarningOutlined,
    type: 'error'
  },
  {
    label: '总CPU (m)',
    value: totalResources.value.cpu,
    icon: ClusterOutlined,
    type: 'total'
  }
])

// 表格行选择配置
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[], rows: K8sNode[]) => {
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

const fetchNodes = async () => {
  if (!selectedCluster.value) {
    nodes.value = []
    return
  }

  try {
    loading.value = true
    const params: GetK8sNodeListReq = {
      cluster_id: selectedCluster.value,
      page: currentPage.value,
      size: pageSize.value
    }
    const response = await getK8sNodeList(params)
    nodes.value = response.data?.list || []
  } catch (error) {
    console.error('获取节点列表失败:', error)
    message.error('获取节点列表失败')
  } finally {
    loading.value = false
  }
}

const handleClusterChange = async () => {
  currentPage.value = 1
  await fetchNodes()
}

// 搜索和过滤方法
const onSearch = () => {
  currentPage.value = 1
}

const onStatusFilterChange = () => {
  currentPage.value = 1
}

const onRoleFilterChange = () => {
  currentPage.value = 1
}

// 刷新方法
const refreshAll = async () => {
  await Promise.all([fetchClusters(), fetchNodes()])
}

// 表格处理方法
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchNodes()
}

// 批量删除确认
const showBatchDeleteConfirm = () => {
  Modal.confirm({
    title: '批量删除确认',
    content: `确定要删除选中的 ${selectedRows.value.length} 个节点吗？`,
    onOk: async () => {
      try {
        await Promise.all(
          selectedRows.value.map(node => {
            const drainParams: DrainK8sNodeReq = {
              cluster_id: selectedCluster.value!,
              node_name: node.name,
              force: 1,
              ignore_daemon_sets: 1,
              delete_local_data: 1,
              grace_period_seconds: 30,
              timeout_seconds: 300
            }
            return deleteK8sNode(drainParams)
          })
        )
        message.success('批量删除成功')
        selectedRowKeys.value = []
        selectedRows.value = []
        await fetchNodes()
      } catch (error) {
        console.error('批量删除失败:', error)
        message.error('批量删除失败')
      }
    }
  })
}

// 节点操作方法
const showNodeMetrics = (node: K8sNode) => {
  currentNode.value = node
  showDetail.value = true
  console.log('显示节点指标:', node.name)
}

const showNodeEvents = (node: K8sNode) => {
  currentNode.value = node
  showDetail.value = true
  console.log('显示节点事件:', node.name)
}

const closeDetail = () => {
  showDetail.value = false
  currentNode.value = null
}

// 获取节点状态
const getNodeStatus = (node: K8sNode) => {
  if (!node.conditions || node.conditions.length === 0) return 'Unknown'
  const readyCondition = node.conditions.find(c => c.type === 'Ready')
  return readyCondition?.status === 'True' ? 'Ready' : 'NotReady'
}

const getStatusText = (node: K8sNode) => {
  return getNodeStatus(node)
}



// 概览卡片数据（第二个定义，重命名避免冲突）
// const overviewCardsSecond = computed(() => [
//   {
//     number: nodes.value.length,
//     label: '节点总数',
//     color: 'blue',
//     icon: DesktopOutlined
//   },
//   {
//     number: healthyNodes.value,
//     label: '健康节点',
//     color: 'green',
//     icon: CheckCircleOutlined
//   },
//   {
//     number: warningNodes.value + errorNodes.value,
//     label: '问题节点',
//     color: 'orange',
//     icon: WarningOutlined
//   },
//   {
//     number: totalResources.value.cpu,
//     label: '总CPU (m)',
//     color: 'purple',
//     icon: ClusterOutlined
//   }
// ])

// 表格列配置
const columns = [
  {
    title: '节点名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left'
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    align: 'center'
  },
  {
    title: '角色',
    dataIndex: 'roles',
    key: 'roles',
    width: 120
  },
  {
    title: 'IP地址',
    dataIndex: 'internal_ip',
    key: 'ip',
    width: 150
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

// 确认删除节点
const confirmDelete = (node: K8sNode) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除节点 "${node.name}" 吗？`,
    onOk: async () => {
      try {
        const drainParams: DrainK8sNodeReq = {
          cluster_id: selectedCluster.value!,
          node_name: node.name,
          force: 1,
          ignore_daemon_sets: 1,
          delete_local_data: 1,
          grace_period_seconds: 30,
          timeout_seconds: 300
        }
        await deleteK8sNode(drainParams)
        message.success('节点驱逐成功')
        await fetchNodes()
      } catch (error) {
        console.error('删除节点失败:', error)
        message.error('删除节点失败')
      }
    }
  })
}



// 页面初始化
onMounted(async () => {
  await fetchClusters()
})
</script>

<style scoped>
.k8s-node-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.cluster-selector-section {
  margin-bottom: 20px;
}

.cluster-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cluster-selector-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #333;
  min-width: 80px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.status-filter,
.role-filter {
  width: 120px;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-name .name {
  font-weight: 500;
  color: #1677ff;
}

.table-actions {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.detail-section {
  margin-top: 20px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.metrics-content,
.events-content {
  padding: 16px 0;
}

.event-item {
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #595959;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style>
