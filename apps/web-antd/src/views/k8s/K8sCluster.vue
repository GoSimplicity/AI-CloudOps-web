<template>
  <div class="k8s-cluster-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1>集群管理</h1>
      <div class="header-actions">
        <a-button type="primary" @click="modalVisible = true">
          <template #icon><PlusOutlined /></template>
          添加集群
        </a-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="overview-stats">
      <div class="overview-item">
        <span class="overview-number">{{ runningClusters }}</span>
        <span class="overview-label">运行中</span>
      </div>
      <div class="overview-item">
        <span class="overview-number">0</span>
        <span class="overview-label">节点数</span>
      </div>
      <div class="overview-item">
        <span class="overview-number">0</span>
        <span class="overview-label">Pod数</span>
      </div>
      <div class="overview-item">
        <span class="overview-number">0</span>
        <span class="overview-label">服务数</span>
      </div>
    </div>

    <!-- 仪表板图表区域 -->
    <div class="dashboard-section">
      <a-card title="集群统计仪表板" class="dashboard-card">
        <div class="dashboard-charts">
          <div class="chart-row">
            <!-- 集群状态分布饼图 -->
            <div class="chart-container">
              <div class="chart-title">
                <DashboardOutlined class="chart-icon" />
                集群状态分布
              </div>
              <div ref="clusterStatusChartRef" class="chart-content"></div>
            </div>
            
            <!-- 环境分布饼图 -->
            <div class="chart-container">
              <div class="chart-title">
                <EnvironmentOutlined class="chart-icon" />
                环境分布
              </div>
              <div ref="envDistributionChartRef" class="chart-content"></div>
            </div>
            
            <!-- 健康状态统计 -->
            <div class="chart-container">
              <div class="chart-title">
                <HeartOutlined class="chart-icon" />
                组件健康统计
              </div>
              <div ref="healthStatsChartRef" class="chart-content"></div>
            </div>
          </div>
          
          <div class="chart-row">
            <!-- 资源使用趋势 -->
            <div class="chart-container chart-wide">
              <div class="chart-title">
                <BarChartOutlined class="chart-icon" />
                集群资源使用率
              </div>
              <div ref="resourceUsageChartRef" class="chart-content"></div>
            </div>
          </div>
        </div>
        
        <div class="dashboard-actions">
          <a-button type="primary" @click="refreshDashboard" :loading="dashboardLoading">
            <template #icon><ReloadOutlined /></template>
            刷新仪表板
          </a-button>
        </div>
      </a-card>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索集群名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
        
        <a-select
          v-model:value="filterEnv"
          placeholder="选择环境"
          class="env-filter"
          allow-clear
          @change="onEnvFilterChange"
        >
          <a-select-option :value="Env.Prod">生产环境</a-select-option>
          <a-select-option :value="Env.Dev">开发环境</a-select-option>
          <a-select-option :value="Env.Stage">预发环境</a-select-option>
          <a-select-option :value="Env.Rc">测试环境</a-select-option>
          <a-select-option :value="Env.Press">灰度环境</a-select-option>
        </a-select>
        
        <a-select
          v-model:value="filterStatus"
          placeholder="选择状态"
          class="status-filter"
          allow-clear
          @change="onStatusFilterChange"
        >
          <a-select-option :value="ClusterStatus.Running">运行中</a-select-option>
          <a-select-option :value="ClusterStatus.Stopped">已停止</a-select-option>
          <a-select-option :value="ClusterStatus.Error">异常</a-select-option>
        </a-select>
      </div>
      
      <div class="toolbar-right">
        <a-button @click="refreshAll" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新全部
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="showBatchDeleteConfirm" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 集群表格 -->
    <div class="table-container">
      <a-table
        :dataSource="filteredClusters"
        :columns="columns"
        :loading="loading"
        :rowSelection="rowSelection"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: filteredClusters.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }"
        @change="handleTableChange"
        rowKey="id"
        size="small"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <!-- 集群名称列 -->
          <template v-if="column.key === 'name'">
            <div class="cluster-name">
              <ClusterOutlined />
              <span class="name">{{ record.name }}</span>
            </div>
          </template>

          <!-- 环境列 -->
          <template v-else-if="column.key === 'env'">
            <a-tag :color="getEnvColor(record.env)">
              {{ getEnvText(record.env) }}
            </a-tag>
          </template>

          <!-- 状态列 -->
          <template v-else-if="column.key === 'status'">
            <K8sStatusTag :status="getClusterStatusText(record.status)" />
          </template>

          <!-- 资源使用列 -->
          <template v-else-if="column.key === 'resources'">
            <div class="resource-usage" v-if="record.cluster_stats">
              <div class="resource-item">
                <span class="resource-label">CPU:</span>
                <span class="resource-value">{{ record.cluster_stats.cpu_usage || '0' }}%</span>
              </div>
              <div class="resource-item">
                <span class="resource-label">内存:</span>
                <span class="resource-value">{{ record.cluster_stats.memory_usage || '0' }}%</span>
              </div>
            </div>
            <span v-else class="no-data">-</span>
          </template>

          <!-- 节点数量列 -->
          <template v-else-if="column.key === 'nodes'">
            <div class="node-count" v-if="record.cluster_stats">
              <span class="ready">{{ record.cluster_stats.ready_nodes || 0 }}</span>
              <span class="separator">/</span>
              <span class="total">{{ record.cluster_stats.total_nodes || 0 }}</span>
            </div>
            <span v-else class="no-data">-</span>
          </template>

          <!-- 创建时间列 -->
          <template v-else-if="column.key === 'createdAt'">
            <div class="timestamp">
              <ClockCircleOutlined />
              <span>{{ formatRelativeTime(record.created_at) }}</span>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'actions'">
            <div class="table-actions">
              <a-tooltip title="查看统计">
                <a-button type="primary" ghost shape="circle" size="small" @click="showClusterStats(record)">
                  <template #icon><BarChartOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="刷新状态">
                <a-button type="primary" ghost shape="circle" size="small" @click="refreshCluster(record.id)">
                  <template #icon><SyncOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-dropdown>
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon><MoreOutlined /></template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="showEditModal(record)">
                      <EditOutlined />
                      编辑集群
                    </a-menu-item>
                    <a-menu-item key="health" @click="checkHealth(record)">
                      <HeartOutlined />
                      健康检查
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="delete" @click="confirmDelete(record)" danger>
                      <DeleteOutlined />
                      删除集群
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
            <a-empty description="暂无集群数据">
              <a-button type="primary" @click="showAddModal">新建集群</a-button>
            </a-empty>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建集群模态框 -->
    <ClusterCreateModal
      :visible="modalVisible && !isEdit"
      :loading="submitLoading"
      @close="closeModal"
      @create="handleCreate"
    />

    <!-- 编辑集群模态框 -->
    <!-- TODO: 创建编辑集群模态框 -->

    <!-- 集群统计抽屉 -->
    <ClusterStatsDrawer
      :visible="statsDrawerVisible"
      :cluster="currentCluster"
      :stats="currentStats"
      :loading="false"
      @close="closeStatsDrawer"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, nextTick } from 'vue'
import {
  ClusterOutlined,
  ReloadOutlined,
  DeleteOutlined,
  BarChartOutlined,
  SyncOutlined,
  MoreOutlined,
  EditOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import * as echarts from 'echarts'
import { 
  ClusterCreateModal, 
  ClusterStatsDrawer,
  K8sStatusTag
} from './components'
import { 
  Env, 
  ClusterStatus,
  type K8sCluster,
  type ClusterStats,
  getClustersListApi,
  createClusterApi,
  deleteClusterApi,
  refreshClusterApi,
  checkClusterHealthApi,
  getClusterStatsApi
} from '#/api/core/k8s/k8s_cluster'

// 基本数据状态
const clusters = ref<K8sCluster[]>([])
const loading = ref(false)
const modalVisible = ref(false)
const searchText = ref('')
const filterEnv = ref<string>('')
const filterStatus = ref<string>('')
const dashboardLoading = ref(false)

// 表格选择相关
const selectedRowKeys = ref<number[]>([])
const selectedRows = ref<K8sCluster[]>([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 模态框相关
const isEdit = ref(false)
const submitLoading = ref(false)
const currentEditCluster = ref<K8sCluster | null>(null)

// 统计抽屉相关
const statsDrawerVisible = ref(false)
const currentCluster = ref<K8sCluster | undefined>(undefined)
const currentStats = ref<ClusterStats | undefined>(undefined)

// 计算属性
const filteredClusters = computed(() => {
  let result = clusters.value
  
  // 搜索过滤
  if (searchText.value) {
    result = result.filter(cluster => 
      cluster.name.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  // 环境过滤
  if (filterEnv.value) {
    result = result.filter(cluster => cluster.env?.toString() === filterEnv.value)
  }
  
  // 状态过滤
  if (filterStatus.value) {
    result = result.filter(cluster => cluster.status?.toString() === filterStatus.value)
  }
  
  return result
})

const runningClusters = computed(() => 
  clusters.value.filter(c => c.status === ClusterStatus.Running).length
)

const errorClusters = computed(() => 
  clusters.value.filter(c => c.status === ClusterStatus.Error).length
)

// 表格行选择配置
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: number[], rows: K8sCluster[]) => {
    selectedRowKeys.value = keys
    selectedRows.value = rows
  }
}))

// 基本操作方法
const fetchClusters = async () => {
  try {
    loading.value = true
    const response = await getClustersListApi({
      page: currentPage.value,
      size: pageSize.value
    })
    clusters.value = response.data?.list || []
  } catch (error) {
    console.error('获取集群列表失败:', error)
    message.error('获取集群列表失败')
  } finally {
    loading.value = false
  }
}

const showAddModal = () => {
  isEdit.value = false
  currentEditCluster.value = null
  modalVisible.value = true
}

const showEditModal = (cluster: K8sCluster) => {
  isEdit.value = true
  currentEditCluster.value = cluster
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
  isEdit.value = false
  currentEditCluster.value = null
}

// 搜索和过滤方法
const onSearch = () => {
  currentPage.value = 1
}

const onEnvFilterChange = () => {
  currentPage.value = 1
}

const onStatusFilterChange = () => {
  currentPage.value = 1
}

// 刷新方法
const refreshAll = async () => {
  await fetchClusters()
}

const refreshCluster = async (clusterId: number) => {
  try {
    await refreshClusterApi(clusterId)
    message.success('集群状态刷新成功')
    await fetchClusters()
  } catch (error) {
    console.error('刷新集群状态失败:', error)
    message.error('刷新集群状态失败')
  }
}

// 表格处理方法
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
}

// 批量删除确认
const showBatchDeleteConfirm = () => {
  Modal.confirm({
    title: '批量删除确认',
    content: `确定要删除选中的 ${selectedRows.value.length} 个集群吗？`,
    onOk: async () => {
      try {
        await Promise.all(
          selectedRows.value.map(cluster => deleteClusterApi(cluster.id!))
        )
        message.success('批量删除成功')
        selectedRowKeys.value = []
        selectedRows.value = []
        await fetchClusters()
      } catch (error) {
        console.error('批量删除失败:', error)
        message.error('批量删除失败')
      }
    }
  })
}

// 显示集群统计
const showClusterStats = async (cluster: K8sCluster) => {
  try {
    currentCluster.value = cluster
    statsDrawerVisible.value = true
    const response = await getClusterStatsApi(cluster.id!)
    currentStats.value = response.data
  } catch (error) {
    console.error('获取集群统计失败:', error)
    message.error('获取集群统计失败')
  }
}

const closeStatsDrawer = () => {
  statsDrawerVisible.value = false
  currentCluster.value = undefined
  currentStats.value = undefined
}

// 概览卡片数据已简化到模板中

// 表格列配置
const columns = [
  {
    title: '集群名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left'
  },
  {
    title: '环境',
    dataIndex: 'env',
    key: 'env',
    width: 100,
    align: 'center'
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center'
  },
  {
    title: '资源使用',
    key: 'resources',
    width: 140,
    align: 'center'
  },
  {
    title: '节点',
    key: 'nodes',
    width: 100,
    align: 'center'
  },
  {
    title: 'API地址',
    dataIndex: 'api_server',
    key: 'api_server',
    width: 200,
    ellipsis: true
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: 150,
    align: 'center'
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right'
  }
]

// 图表引用
const clusterStatusChartRef = ref<HTMLElement>()
const envDistributionChartRef = ref<HTMLElement>()
const healthStatsChartRef = ref<HTMLElement>()
const resourceUsageChartRef = ref<HTMLElement>()

// 获取环境颜色
const getEnvColor = (env: Env) => {
  const colorMap = {
    [Env.Prod]: 'red',
    [Env.Dev]: 'blue',
    [Env.Stage]: 'orange',
    [Env.Rc]: 'green',
    [Env.Press]: 'purple'
  }
  return colorMap[env] || 'default'
}

// 获取环境文本
const getEnvText = (env: Env | string) => {
  const envValue = typeof env === 'string' ? parseInt(env) : env
  const textMap = {
    [Env.Prod]: '生产环境',
    [Env.Dev]: '开发环境',
    [Env.Stage]: '预发环境',
    [Env.Rc]: '测试环境',
    [Env.Press]: '灰度环境'
  }
  return textMap[envValue as Env] || '未知环境'
}

// 获取集群状态文本
const getClusterStatusText = (status: ClusterStatus) => {
  const statusMap = {
    [ClusterStatus.Running]: 'Running',
    [ClusterStatus.Stopped]: 'Stopped', 
    [ClusterStatus.Error]: 'Failed'
  }
  return statusMap[status] || 'Unknown'
}

// 格式化相对时间
const formatRelativeTime = (timestamp: string) => {
  if (!timestamp) return ''
  const now = new Date()
  const time = new Date(timestamp)
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)
  
  if (diffInSeconds < 60) return '刚刚'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
  return `${Math.floor(diffInSeconds / 86400)}天前`
}

// 处理集群创建
const handleCreate = async (clusterData: any) => {
  try {
    submitLoading.value = true
    await createClusterApi(clusterData)
    message.success('集群创建成功')
    closeModal()
    await fetchClusters()
  } catch (error) {
    console.error('创建集群失败:', error)
    message.error('创建集群失败')
  } finally {
    submitLoading.value = false
  }
}

// 确认删除集群
const confirmDelete = (cluster: K8sCluster) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除集群 "${cluster.name}" 吗？`,
    onOk: () => deleteCluster(cluster.id!)
  })
}

// 删除集群方法
const deleteCluster = async (clusterId: number) => {
  try {
    await deleteClusterApi(clusterId)
    message.success('集群删除成功')
    await fetchClusters()
  } catch (error) {
    console.error('删除集群失败:', error)
    message.error('删除集群失败')
  }
}

// 检查集群健康状态
const checkHealth = async (cluster: K8sCluster) => {
  try {
    const health = await checkClusterHealthApi(cluster.id!)
    if (health) {
      message.success('健康检查完成')
    }
  } catch (error) {
    console.error('健康检查失败:', error)
    message.error('健康检查失败')
  }
}

// 刷新仪表板
const refreshDashboard = async () => {
  dashboardLoading.value = true
  try {
    await fetchClusters()
    await nextTick()
    initCharts()
  } finally {
    dashboardLoading.value = false
  }
}

// 初始化图表
const initCharts = async () => {
  await nextTick()
  
  // 集群状态分布图表
  if (clusterStatusChartRef.value) {
    const chart = echarts.init(clusterStatusChartRef.value)
    const statusData = [
      { name: '运行中', value: runningClusters.value },
      { name: '异常', value: errorClusters.value },
      { name: '其他', value: clusters.value.length - runningClusters.value - errorClusters.value }
    ].filter(item => item.value > 0)

    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '70%',
        data: statusData,
        itemStyle: {
          borderRadius: 5,
          borderColor: '#fff',
          borderWidth: 2
        }
      }]
    })
  }

  // 环境分布图表
  if (envDistributionChartRef.value) {
    const chart = echarts.init(envDistributionChartRef.value)
    const envData = Object.values(Env)
      .filter(env => typeof env === 'number')
      .map(env => ({
        name: getEnvText(env as Env),
        value: clusters.value.filter((c: K8sCluster) => c.env === env).length
      })).filter(item => item.value > 0)

    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '70%',
        data: envData,
        itemStyle: {
          borderRadius: 5,
          borderColor: '#fff',
          borderWidth: 2
        }
      }]
    })
  }

  // 资源使用图表
  if (resourceUsageChartRef.value) {
    const chart = echarts.init(resourceUsageChartRef.value)
    const clusterNames = clusters.value.map((c: K8sCluster) => c.name)
    const cpuData = clusters.value.map((_: K8sCluster) => {
      // 模拟数据，实际应该从cluster_stats获取
      return Math.floor(Math.random() * 80) + 10
    })
    const memoryData = clusters.value.map((_: K8sCluster) => {
      // 模拟数据，实际应该从cluster_stats获取
      return Math.floor(Math.random() * 80) + 10
    })

    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['CPU使用率', '内存使用率'] },
      xAxis: {
        type: 'category',
        data: clusterNames,
        axisLabel: { rotate: 45 }
      },
      yAxis: { type: 'value', max: 100 },
      series: [
        {
          name: 'CPU使用率',
          type: 'bar',
          data: cpuData,
          itemStyle: { color: '#1890ff' }
        },
        {
          name: '内存使用率',
          type: 'bar',
          data: memoryData,
          itemStyle: { color: '#52c41a' }
        }
      ]
    })
  }
}

// 页面初始化
onMounted(async () => {
  await fetchClusters()
  await initCharts()
})
</script>

<style scoped>
.k8s-cluster-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
}

.overview-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  
  .overview-item {
    flex: 1;
    padding: 20px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e8e8e8;
    text-align: center;
    
    .overview-number {
      display: block;
      font-size: 32px;
      font-weight: bold;
      color: #1890ff;
      margin-bottom: 8px;
    }
    
    .overview-label {
      font-size: 14px;
      color: #666;
    }
  }
}

.dashboard-section {
  margin-bottom: 20px;
}

.dashboard-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dashboard-charts {
  margin-bottom: 20px;
}

.chart-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-container {
  flex: 1;
  min-height: 300px;
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
}

.chart-wide {
  flex: 2;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.chart-icon {
  color: #1677ff;
}

.chart-content {
  height: 250px;
}

.dashboard-actions {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
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
  width: 300px;
}

.env-filter,
.status-filter {
  width: 120px;
}

.table-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cluster-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-name .name {
  font-weight: 500;
  color: #1677ff;
}

.resource-usage {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resource-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.resource-label {
  color: #666;
}

.resource-value {
  font-weight: 500;
  color: #1677ff;
}

.node-count {
  font-weight: 500;
}

.node-count .ready {
  color: #52c41a;
}

.node-count .separator {
  color: #999;
  margin: 0 2px;
}

.node-count .total {
  color: #666;
}

.no-data {
  color: #999;
  font-style: italic;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
}

.table-actions {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.empty-state {
  padding: 40px 0;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .chart-row {
    flex-direction: column;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .k8s-cluster-container {
    padding: 12px;
  }
  
  .table-container {
    padding: 12px;
  }
  
  .search-input {
    width: 200px;
  }
}
</style>
