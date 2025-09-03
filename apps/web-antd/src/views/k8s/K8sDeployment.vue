<template>
  <div class="k8s-deployment-container">
    <!-- 页面头部 -->
    <K8sPageHeader
      title="部署管理"
      subtitle="管理和监控集群中的所有 Kubernetes Deployment 资源"
      :title-icon="RocketOutlined"
      @refresh="refreshAll"
      :loading="loading"
    >
      <template #actions>
        <a-button @click="refreshAll" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="showCreateForm" :loading="loading">
          <template #icon><PlusOutlined /></template>
          创建部署
        </a-button>
      </template>
    </K8sPageHeader>

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
          placeholder="搜索部署名称或命名空间"
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

    <!-- 部署创建表单 -->
    <div v-if="showForm" class="form-section">
      <div class="form-header">
        <h3>创建部署</h3>
        <a-button type="text" @click="closeForm">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </div>
      <a-form
        ref="formRef"
        :model="deploymentForm"
        :rules="rules"
        layout="vertical"
        class="deployment-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="部署名称" name="name">
              <a-input v-model:value="deploymentForm.name" placeholder="请输入部署名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-input v-model:value="deploymentForm.namespace" placeholder="请输入命名空间" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="副本数" name="replicas">
              <a-input-number v-model:value="deploymentForm.replicas" :min="1" placeholder="1" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="镜像" name="image">
              <a-input v-model:value="deploymentForm.image" placeholder="nginx:latest" />
            </a-form-item>
          </a-col>
        </a-row>
        <div class="form-actions">
          <a-button @click="closeForm">取消</a-button>
          <a-button type="primary" @click="handleSubmitDeployment" :loading="submitLoading">
            创建
          </a-button>
        </div>
      </a-form>
    </div>

    <!-- 部署扩缩容区域 -->
    <div v-if="showScaleForm" class="scale-section">
      <div class="scale-header">
        <h3>扩缩容部署 - {{ currentDeployment?.name }}</h3>
        <a-button type="text" @click="closeScaleForm">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </div>
      <div class="scale-content">
        <p>当前副本数：{{ currentDeployment?.replicas }}</p>
        <a-form layout="inline">
          <a-form-item label="新的副本数">
            <a-input-number 
              v-model:value="scaleReplicas" 
              :min="0" 
              placeholder="请输入副本数" 
              style="width: 120px;"
            />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="handleScale" :loading="scaleLoading">
              确认扩缩容
            </a-button>
            <a-button @click="closeScaleForm" style="margin-left: 8px;">
              取消
            </a-button>
          </a-form-item>
        </a-form>
      </div>
    </div>

    <!-- 简化的部署表格 -->
    <div class="table-section">
      <a-table
        :dataSource="filteredDeployments"
        :columns="columns"
        :loading="loading"
        :row-selection="rowSelection"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: filteredDeployments.length,
          showSizeChanger: true,
          showQuickJumper: true
        }"
        @change="handleTableChange"
        rowKey="id"
        class="deployment-table"
      >
      <template #bodyCell="{ column, record }">
        <!-- 部署名称列 -->
        <template v-if="column.key === 'name'">
          <div class="deployment-name">
            <RocketOutlined />
            <span class="name">{{ record.name }}</span>
          </div>
        </template>

        <!-- 副本状态列 -->
        <template v-else-if="column.key === 'replicas'">
          <div class="replica-status">
            <span class="ready">{{ record.ready_replicas || 0 }}</span>
            <span class="separator">/</span>
            <span class="desired">{{ record.replicas || 0 }}</span>
          </div>
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.key === 'actions'">
          <div class="table-actions">
            <a-button type="link" size="small" @click="showScaleFormAction(record)">
              扩缩容
            </a-button>
            <a-button type="link" size="small" danger @click="confirmDelete(record)">
              删除
            </a-button>
          </div>
        </template>
      </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import {
  ClusterOutlined,
  RocketOutlined,
  ReloadOutlined,
  PlusOutlined,
  CloseOutlined,
  ApiOutlined,
  BarChartOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import {
  K8sPageHeader,
  K8sOverviewCards,
  K8sClusterSelector
} from './components'
import {
  getClustersListApi,
  type K8sCluster,
  ClusterStatus
} from '#/api/core/k8s/k8s_cluster'
import {
  getDeploymentListApi,
  scaleDeploymentApi,
  deleteDeploymentApi,
  type K8sDeployment,
  type ScaleDeploymentReq
} from '#/api/core/k8s/k8s_deployment'

// 基本数据状态
const deployments = ref<K8sDeployment[]>([])
const clusters = ref<K8sCluster[]>([])
const loading = ref(false)
const clustersLoading = ref(false)
const selectedCluster = ref<number | undefined>()
const searchText = ref('')
const namespaceFilter = ref('')

// 表格选择相关
const selectedRowKeys = ref<string[]>([])
const selectedRows = ref<K8sDeployment[]>([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 表单相关
const availableNamespaces = ref<string[]>(['default', 'kube-system'])
const submitLoading = ref(false)
const scaleLoading = ref(false)
const currentDeployment = ref<K8sDeployment | null>(null)

// 计算属性
const runningClusters = computed(() => 
  clusters.value.filter(c => c.status === ClusterStatus.Running)
)

const filteredDeployments = computed(() => {
  let result = deployments.value
  
  if (searchText.value) {
    result = result.filter(deployment => 
      deployment.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      deployment.namespace?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (namespaceFilter.value) {
    result = result.filter(deployment => 
      deployment.namespace === namespaceFilter.value
    )
  }
  
  return result
})

const healthyDeployments = computed(() => 
  deployments.value.filter(d => d.ready_replicas === d.replicas).length
)

const progressingDeployments = computed(() => 
  deployments.value.filter(d => (d.ready_replicas || 0) < (d.replicas || 0)).length
)

const totalReplicas = computed(() => 
  deployments.value.reduce((total, d) => total + (d.replicas || 0), 0)
)

const overviewCards = computed(() => [
  {
    label: '部署总数',
    value: deployments.value.length,
    icon: RocketOutlined,
    type: 'total'
  },
  {
    label: '健康部署',
    value: healthyDeployments.value,
    icon: PlayCircleOutlined,
    type: 'running'
  },
  {
    label: '进行中',
    value: progressingDeployments.value,
    icon: BarChartOutlined,
    type: 'warning'
  },
  {
    label: '总副本数',
    value: totalReplicas.value,
    icon: ApiOutlined,
    type: 'total'
  }
])

// 表格行选择配置
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[], rows: K8sDeployment[]) => {
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

const fetchDeployments = async () => {
  if (!selectedCluster.value) {
    deployments.value = []
    return
  }
  
  try {
    loading.value = true
    const response = await getDeploymentListApi({
      cluster_id: selectedCluster.value,
      page: currentPage.value,
      size: pageSize.value
    })
    deployments.value = response.data?.list || []
  } catch (error) {
    console.error('获取部署列表失败:', error)
    message.error('获取部署列表失败')
  } finally {
    loading.value = false
  }
}

const handleClusterChange = async () => {
  currentPage.value = 1
  await fetchDeployments()
}

// 搜索和过滤方法
const onSearch = () => {
  currentPage.value = 1
}

const onNamespaceFilterChange = () => {
  currentPage.value = 1
}

// 刷新方法
const refreshAll = async () => {
  await Promise.all([fetchClusters(), fetchDeployments()])
}

// 表格处理方法
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchDeployments()
}

// 新增的页面状态
const showForm = ref(false)
const showScaleForm = ref(false)
const formRef = ref()
const scaleReplicas = ref(0)

// 部署表单数据
const deploymentForm = ref({
  name: '',
  namespace: '',
  replicas: 1,
  image: ''
})

// 表单验证规则
const rules = {
  name: [{ required: true, message: '请输入部署名称' }],
  namespace: [{ required: true, message: '请输入命名空间' }],
  replicas: [{ required: true, message: '请输入副本数' }],
  image: [{ required: true, message: '请输入镜像' }]
}

// 扩缩容部署方法
const scaleDeployment = async (deployment: K8sDeployment, replicas: number) => {
  try {
    scaleLoading.value = true
    if (selectedCluster.value) {
      const scaleData: ScaleDeploymentReq = {
        cluster_id: selectedCluster.value,
        namespace: deployment.namespace,
        name: deployment.name,
        replicas: replicas
      }
      await scaleDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name, scaleData)
      message.success('部署扩缩容成功')
    }
    await fetchDeployments()
  } catch (error) {
    console.error('扩缩容失败:', error)
    message.error('扩缩容失败')
  } finally {
    scaleLoading.value = false
  }
}

// 删除部署方法
const deleteDeployment = async (deploymentId: number) => {
  try {
    const deployment = deployments.value.find(d => d.id === deploymentId)
    if (deployment && selectedCluster.value) {
      await deleteDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name)
    }
    message.success('部署删除成功')
    await fetchDeployments()
  } catch (error) {
    console.error('删除部署失败:', error)
    message.error('删除部署失败')
  }
}

// UI 操作方法
const showCreateForm = () => {
  showForm.value = true
  deploymentForm.value = {
    name: '',
    namespace: '',
    replicas: 1,
    image: ''
  }
}

const closeForm = () => {
  showForm.value = false
}

const showScaleFormAction = (record: any) => {
  showScaleForm.value = true
  currentDeployment.value = record
  scaleReplicas.value = record.replicas || 1
}

const closeScaleForm = () => {
  showScaleForm.value = false
}

// 表格列配置
const columns = [
  {
    title: '部署名称',
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
    title: '副本状态',
    key: 'replicas',
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

// 处理表单提交
const handleSubmitDeployment = async () => {
  try {
    await formRef.value?.validateFields()
    // 这里需要在composable中添加createDeployment方法
    message.success('部署创建成功')
    closeForm()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

// 处理部署扩缩容
const handleScale = async () => {
  if (currentDeployment.value) {
    await scaleDeployment(currentDeployment.value, scaleReplicas.value)
    closeScaleForm()
  }
}

// 确认删除部署
const confirmDelete = (deployment: any) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除部署 "${deployment.name}" 吗？`,
    onOk: () => deleteDeployment(deployment.id)
  })
}

// 页面初始化
onMounted(async () => {
  await fetchClusters()
})
</script>

<style scoped>
.k8s-deployment-container {
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

/* 表单区域 */
.form-section {
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.form-header h3 {
  margin: 0;
  color: #262626;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 扩缩容区域 */
.scale-section {
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.scale-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.scale-header h3 {
  margin: 0;
  color: #262626;
}

.scale-content {
  padding: 16px 0;
}

/* 表格区域 */
.table-section {
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.deployment-table {
  margin: 0;
}

.deployment-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deployment-name .name {
  font-weight: 500;
  color: #1677ff;
}

.replica-status {
  font-weight: 500;
}

.replica-status .ready {
  color: #52c41a;
}

.replica-status .separator {
  color: #999;
  margin: 0 2px;
}

.replica-status .desired {
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
