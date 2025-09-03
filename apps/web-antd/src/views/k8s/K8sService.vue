<template>
  <div class="k8s-service-container">
    <!-- 页面头部 -->
    <K8sPageHeader
      title="服务管理"
      subtitle="管理和监控集群中的所有 Kubernetes Service 资源"
      :title-icon="ApiOutlined"
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
          创建服务
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
          placeholder="搜索服务名称、命名空间或IP"
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
        
        <a-select
          v-model:value="typeFilter"
          placeholder="服务类型"
          class="type-filter"
          allow-clear
          @change="onTypeFilterChange"
        >
          <a-select-option :value="ServiceTypeEnum.ClusterIP">ClusterIP</a-select-option>
          <a-select-option :value="ServiceTypeEnum.NodePort">NodePort</a-select-option>
          <a-select-option :value="ServiceTypeEnum.LoadBalancer">LoadBalancer</a-select-option>
          <a-select-option :value="ServiceTypeEnum.ExternalName">ExternalName</a-select-option>
        </a-select>
      </div>
      
      <div class="toolbar-right">
        <a-button @click="refreshAll" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新全部
        </a-button>
        
        <a-button 
          v-if="selectedRows.length > 0"
          type="primary" 
          danger 
          :disabled="!selectedRows.length"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 服务创建/编辑表单 -->
    <div v-if="showForm" class="form-section">
      <div class="form-header">
        <h3>{{ isEdit ? '编辑服务' : '创建服务' }}</h3>
        <a-button type="text" @click="closeForm">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </div>
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        class="service-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="服务名称" name="name">
              <a-input v-model:value="form.name" placeholder="请输入服务名称" :disabled="isEdit" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-input v-model:value="form.namespace" placeholder="请输入命名空间" :disabled="isEdit" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="服务类型" name="type">
              <a-select v-model:value="form.type" placeholder="请选择服务类型">
                <a-select-option :value="ServiceTypeEnum.ClusterIP">ClusterIP</a-select-option>
                <a-select-option :value="ServiceTypeEnum.NodePort">NodePort</a-select-option>
                <a-select-option :value="ServiceTypeEnum.LoadBalancer">LoadBalancer</a-select-option>
                <a-select-option :value="ServiceTypeEnum.ExternalName">ExternalName</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="选择器" name="selector">
              <a-input v-model:value="form.selector" placeholder="app=my-app" />
            </a-form-item>
          </a-col>
        </a-row>
        <div class="form-actions">
          <a-button @click="closeForm">取消</a-button>
          <a-button type="primary" @click="handleSubmit" :loading="submitLoading">
            {{ isEdit ? '更新' : '创建' }}
          </a-button>
        </div>
      </a-form>
    </div>

    <!-- 服务详情查看区域 -->
    <div v-if="showDetail" class="detail-section">
      <div class="detail-header">
        <h3>服务详情 - {{ currentService?.name }}</h3>
        <a-button type="text" @click="closeDetail">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </div>
      <a-tabs>
        <a-tab-pane key="endpoints" tab="端点信息">
          <div class="endpoints-content">
            <p v-if="!currentEndpoints.length">暂无端点数据</p>
            <div v-else>
              <div v-for="endpoint in currentEndpoints" :key="endpoint.ip" class="endpoint-item">
                {{ endpoint.ip }}:{{ endpoint.port }}
              </div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane key="yaml" tab="YAML配置">
          <div class="yaml-content">
            <pre v-if="serviceYaml" class="yaml-text">{{ serviceYaml }}</pre>
            <p v-else>加载中...</p>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 简化的服务表格 -->
    <div class="table-section">
      <a-table
        :dataSource="filteredServices"
        :columns="columns"
        :loading="loading"
        :row-selection="rowSelection"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: filteredServices.length,
          showSizeChanger: true,
          showQuickJumper: true
        }"
        @change="handleTableChange"
        rowKey="id"
        class="service-table"
      >
      <template #bodyCell="{ column, record }">
        <!-- 服务名称列 -->
        <template v-if="column.key === 'name'">
          <div class="service-name">
            <ApiOutlined />
            <span class="name">{{ record.name }}</span>
          </div>
        </template>

        <!-- 服务类型列 -->
        <template v-else-if="column.key === 'type'">
          <a-tag :color="getServiceTypeColor(record.type)">
            {{ formatServiceType(record.type) }}
          </a-tag>
        </template>

        <!-- 端口列 -->
        <template v-else-if="column.key === 'ports'">
          <div class="service-ports">
            {{ formatPorts(record.ports) }}
          </div>
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.key === 'actions'">
          <div class="table-actions">
            <a-button type="link" size="small" @click="showServiceDetail(record)">
              查看详情
            </a-button>
            <a-button type="link" size="small" @click="showEditForm(record)">
              编辑
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
  ApiOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  CloseOutlined,
  GlobalOutlined,
  ShareAltOutlined
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
  getServiceListApi,
  deleteServiceApi,
  getServiceYamlApi,
  type K8sService,
  ServiceTypeEnum
} from '#/api/core/k8s/k8s_service'

// 基本数据状态
const services = ref<K8sService[]>([])
const clusters = ref<K8sCluster[]>([])
const loading = ref(false)
const clustersLoading = ref(false)
const selectedCluster = ref<number | undefined>()
const searchText = ref('')
const namespaceFilter = ref('')
const typeFilter = ref('')

// 表格选择相关
const selectedRowKeys = ref<string[]>([])
const selectedRows = ref<K8sService[]>([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)

// 表单相关
const availableNamespaces = ref<string[]>(['default', 'kube-system'])
const submitLoading = ref(false)
const currentService = ref<K8sService | null>(null)
const serviceYaml = ref('')
const showForm = ref(false)
const showDetail = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = ref({
  name: '',
  namespace: '',
  type: '',
  selector: '',
  ports: [] as any[],
  labels: '',
  annotations: ''
})
const rules = ref({})
const currentEndpoints = ref<any[]>([])

// 计算属性
const runningClusters = computed(() => 
  clusters.value.filter(c => c.status === ClusterStatus.Running)
)

const filteredServices = computed(() => {
  let result = services.value
  
  if (searchText.value) {
    result = result.filter(service => 
      service.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      service.namespace?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (namespaceFilter.value) {
    result = result.filter(service => service.namespace === namespaceFilter.value)
  }
  
  if (typeFilter.value) {
    result = result.filter(service => service.type === typeFilter.value)
  }
  
  return result
})

const clusterIPServices = computed(() => 
  services.value.filter(s => s.type === ServiceTypeEnum.ClusterIP).length
)

const nodePortServices = computed(() => 
  services.value.filter(s => s.type === ServiceTypeEnum.NodePort).length
)

const loadBalancerServices = computed(() => 
  services.value.filter(s => s.type === ServiceTypeEnum.LoadBalancer).length
)

const externalServices = computed(() => 
  services.value.filter(s => s.type === ServiceTypeEnum.ExternalName).length
)

const overviewCards = computed(() => [
  {
    label: '服务总数',
    value: services.value.length,
    icon: ApiOutlined,
    type: 'total'
  },
  {
    label: 'ClusterIP',
    value: clusterIPServices.value,
    icon: ShareAltOutlined,
    type: 'running'
  },
  {
    label: 'NodePort',
    value: nodePortServices.value,
    icon: GlobalOutlined,
    type: 'warning'
  },
  {
    label: '外部服务',
    value: loadBalancerServices.value + externalServices.value,
    icon: ClusterOutlined,
    type: 'total'
  }
])

// 表格行选择配置
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[], rows: K8sService[]) => {
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

const fetchServices = async () => {
  if (!selectedCluster.value) {
    services.value = []
    return
  }
  
  try {
    loading.value = true
    const response = await getServiceListApi({
      cluster_id: selectedCluster.value,
      page: currentPage.value,
      size: pageSize.value
    })
    services.value = (response as any)?.data?.list || (response as any)?.data || []
  } catch (error) {
    console.error('获取服务列表失败:', error)
    message.error('获取服务列表失败')
  } finally {
    loading.value = false
  }
}

const handleClusterChange = async () => {
  currentPage.value = 1
  await fetchServices()
}

// 搜索和过滤方法
const onSearch = () => {
  currentPage.value = 1
}

const onNamespaceFilterChange = () => {
  currentPage.value = 1
}

const onTypeFilterChange = () => {
  currentPage.value = 1
}

// 刷新方法
const refreshAll = async () => {
  await Promise.all([fetchClusters(), fetchServices()])
}

// 表格处理方法
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchServices()
}

// 工具函数
const formatServiceType = (serviceType: any) => serviceType
const getServiceTypeColor = (serviceType: any) => {
  console.log('服务类型:', serviceType)
  return 'blue'
}
const formatPorts = (ports: any) => ports?.join(', ') || ''

// 添加缺失的方法
const closeForm = () => {
  showForm.value = false
  isEdit.value = false
  form.value = {
    name: '',
    namespace: '',
    type: '',
    selector: '',
    ports: [],
    labels: '',
    annotations: ''
  }
}

const closeDetail = () => {
  showDetail.value = false
  currentService.value = null
  currentEndpoints.value = []
}

const updateService = async (serviceData: any) => {
  console.log('更新服务:', serviceData)
  // 这里应该调用更新API
}

const createService = async (serviceData: any) => {
  console.log('创建服务:', serviceData)
  // 这里应该调用创建API
}

// 删除服务方法
const handleDeleteService = async (serviceId: number) => {
  try {
    console.log('删除服务:', serviceId)
    if (selectedCluster.value) {
      const service = services.value.find(s => s.id === serviceId)
      if (service) {
        await deleteServiceApi(selectedCluster.value, service.namespace, service.name)
        message.success('服务删除成功')
      }
    }
    await fetchServices()
  } catch (error) {
    console.error('删除服务失败:', error)
    message.error('删除服务失败')
  }
}

// UI 操作方法
const showCreateForm = () => {
  isEdit.value = false
  form.value = {
    name: '',
    namespace: 'default',
    type: ServiceTypeEnum.ClusterIP,
    ports: [{ protocol: 'TCP', port: 80, target_port: 8080 }] as any[],
    selector: '',
    labels: '',
    annotations: ''
  }
  showForm.value = true
}

const showEditForm = (service: K8sService) => {
  isEdit.value = true
  currentService.value = service
  form.value = {
    name: service.name,
    namespace: service.namespace,
    type: service.type,
    ports: service.ports,
    selector: service.selector ? JSON.stringify(service.selector) : '',
    labels: service.labels ? JSON.stringify(service.labels) : '',
    annotations: service.annotations ? JSON.stringify(service.annotations) : ''
  }
  showForm.value = true
}

const showServiceDetail = async (service: K8sService) => {
  try {
    currentService.value = service
    if (selectedCluster.value) {
      const response = await getServiceYamlApi(selectedCluster.value, service.namespace, service.name)
      serviceYaml.value = response.yaml || '# YAML配置加载失败'
      showDetail.value = true
    }
  } catch (error) {
    console.error('获取Service YAML失败:', error)
    serviceYaml.value = '# YAML配置加载失败'
    showDetail.value = true
  }
}

const confirmDelete = (service: K8sService) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除服务 "${service.name}" 吗？`,
    onOk: () => handleDeleteService(service.id!)
  })
}

// 表格列配置
const columns = [
  {
    title: '服务名称',
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
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 120,
    align: 'center'
  },
  {
    title: '集群IP',
    dataIndex: 'cluster_ip',
    key: 'cluster_ip',
    width: 150
  },
  {
    title: '端口',
    key: 'ports',
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
const handleSubmit = async () => {
  try {
    await formRef.value?.validateFields()
    if (isEdit.value) {
      await updateService(form)
    } else {
      await createService(form)
    }
    closeForm()
    message.success(isEdit.value ? '服务更新成功' : '服务创建成功')
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}





// 页面初始化
onMounted(async () => {
  await fetchClusters()
})
</script>

<style scoped>
.k8s-service-container {
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

.namespace-filter,
.type-filter {
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

.endpoints-content {
  padding: 16px 0;
}

.endpoint-item {
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
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
  white-space: pre-wrap;
}

/* 表格区域 */
.table-section {
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.service-table {
  margin: 0;
}

.service-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-name .name {
  font-weight: 500;
  color: #1677ff;
}

.service-ports {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
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
