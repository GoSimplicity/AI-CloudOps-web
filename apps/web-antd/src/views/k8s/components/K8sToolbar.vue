<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <!-- 集群选择器 -->
      <K8sClusterSelector
        v-if="showClusterSelector"
        v-model="selectedCluster"
        :clusters="clusters"
        :loading="clustersLoading"
        :only-running="onlyRunningClusters"
        @change="(value: string | number, cluster?: any) => handleClusterChange(value, cluster)"
      />
      <!-- 命名空间选择器 -->
      <K8sNamespaceSelector
        v-if="showNamespaceSelector"
        v-model="selectedNamespace"
        :namespaces="namespaces"
        :loading="namespacesLoading"
        @change="handleNamespaceChange"
      />
      <!-- 状态筛选 -->
      <a-select
        v-if="showStatusFilter"
        v-model:value="statusFilter"
        placeholder="状态筛选"
        class="env-filter"
        allow-clear
        @change="handleStatusChange"
      >
        <template #suffixIcon><FilterOutlined /></template>
        <a-select-option 
          v-for="option in statusOptions" 
          :key="option.value" 
          :value="option.value"
        >
          {{ option.label }}
        </a-select-option>
      </a-select>
      <!-- 搜索框 -->
      <a-input-search
        v-if="showSearch"
        v-model:value="searchText"
        :placeholder="searchPlaceholder"
        class="search-input"
        @search="handleSearch"
        allow-clear
      />
      <!-- 自定义左侧插槽 -->
      <slot name="left" />
    </div>
    <div class="toolbar-right">
      <!-- 视图切换 -->
      <div v-if="showViewToggle" class="view-toggle">
        <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
          <a-radio-button value="table">
            <TableOutlined />
          </a-radio-button>
          <a-radio-button value="card">
            <AppstoreOutlined />
          </a-radio-button>
        </a-radio-group>
      </div>
      <!-- 刷新按钮 -->
      <a-button 
        v-if="showRefresh"
        @click="handleRefresh" 
        :loading="refreshLoading"
      >
        <template #icon><ReloadOutlined /></template>
      </a-button>
      <!-- 批量删除按钮 -->
      <a-button 
        v-if="showBatchDelete && selectedRows.length > 0"
        type="primary" 
        danger 
        @click="handleBatchDelete"
      >
        <template #icon><DeleteOutlined /></template>
        删除 ({{ selectedRows.length }})
      </a-button>
      <!-- 自定义右侧插槽 -->
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined, 
  DeleteOutlined,
  FilterOutlined
} from '@ant-design/icons-vue'
import K8sClusterSelector from './K8sClusterSelector.vue'
import K8sNamespaceSelector from './K8sNamespaceSelector.vue'

interface Cluster {
  id: number
  name: string
  status: string
}

type NamespaceItem = string | { name: string; status?: string; [key: string]: any }

interface Props {
  // 集群相关
  showClusterSelector?: boolean
  clusters?: Cluster[]
  clustersLoading?: boolean
  onlyRunningClusters?: boolean
  selectedCluster?: number
  
  // 命名空间相关
  showNamespaceSelector?: boolean
  namespaces?: NamespaceItem[]
  namespacesLoading?: boolean
  selectedNamespace?: string
  
  // 搜索相关
  showSearch?: boolean
  searchText?: string
  searchPlaceholder?: string
  
  // 状态筛选相关
  showStatusFilter?: boolean
  statusFilter?: string
  statusOptions?: { label: string; value: string }[]
  
  // 视图相关
  showViewToggle?: boolean
  viewMode?: string
  
  // 操作相关
  showRefresh?: boolean
  refreshLoading?: boolean
  showBatchDelete?: boolean
  selectedRows?: any[]
}

interface Emits {
  (e: 'update:selectedCluster', value: number): void
  (e: 'update:selectedNamespace', value: string): void
  (e: 'update:searchText', value: string): void
  (e: 'update:statusFilter', value: string): void
  (e: 'update:viewMode', value: string): void
  (e: 'clusterChange', value: number, cluster?: Cluster): void
  (e: 'namespaceChange', value: string, namespace?: NamespaceItem): void
  (e: 'search', value: string): void
  (e: 'statusChange', value: string): void
  (e: 'refresh'): void
  (e: 'batchDelete'): void
}

const props = withDefaults(defineProps<Props>(), {
  showClusterSelector: true,
  showNamespaceSelector: true,
  showSearch: true,
  showStatusFilter: false,
  showViewToggle: false,
  showRefresh: true,
  showBatchDelete: false,
  clusters: () => [],
  namespaces: () => [],
  selectedRows: () => [],
  statusOptions: () => [
    { label: '运行中', value: 'Running' },
    { label: '更新中', value: 'Updating' },
    { label: '异常', value: 'Error' }
  ],
  clustersLoading: false,
  namespacesLoading: false,
  refreshLoading: false,
  onlyRunningClusters: true,
  searchPlaceholder: '搜索资源名称',
  viewMode: 'table'
})

const emit = defineEmits<Emits>()

// 响应式数据
const selectedCluster = ref(props.selectedCluster)
const selectedNamespace = ref(props.selectedNamespace)
const searchText = ref(props.searchText)
const statusFilter = ref(props.statusFilter)
const viewMode = ref(props.viewMode)

// 处理集群变化
const handleClusterChange = (value: string | number, cluster?: Cluster) => {
  const clusterId = typeof value === 'string' ? parseInt(value) : value
  selectedCluster.value = clusterId
  emit('update:selectedCluster', clusterId)
  emit('clusterChange', clusterId, cluster)
}

// 处理命名空间变化
const handleNamespaceChange = (value: string, namespace?: NamespaceItem) => {
  selectedNamespace.value = value
  emit('update:selectedNamespace', value)
  emit('namespaceChange', value, namespace)
}

// 处理搜索
const handleSearch = (value: string) => {
  emit('search', value)
}

// 处理状态筛选
const handleStatusChange = (value: string) => {
  statusFilter.value = value
  emit('update:statusFilter', value)
  emit('statusChange', value)
}

// 处理刷新
const handleRefresh = () => {
  emit('refresh')
}

// 处理批量删除
const handleBatchDelete = () => {
  emit('batchDelete')
}

// 监听外部props变化
watch(() => props.selectedCluster, (newValue) => {
  selectedCluster.value = newValue
})

watch(() => props.selectedNamespace, (newValue) => {
  selectedNamespace.value = newValue
})

watch(() => props.searchText, (newValue) => {
  searchText.value = newValue
})

watch(() => props.statusFilter, (newValue) => {
  statusFilter.value = newValue
})

watch(() => props.viewMode, (newValue) => {
  viewMode.value = newValue
})

// 监听内部变化，同步到外部
watch(searchText, (newValue) => {
  emit('update:searchText', newValue || '')
})

watch(statusFilter, (newValue) => {
  emit('update:statusFilter', newValue || '')
})

watch(viewMode, (newValue) => {
  emit('update:viewMode', newValue)
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  flex-wrap: wrap;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 320px;
}

.view-toggle {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
    gap: 12px;
  }
  
  .toolbar-left {
    justify-content: flex-start;
  }
  
  .toolbar-right {
    justify-content: flex-end;
  }
  
  .search-input {
    min-width: 150px;
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .search-input {
    min-width: unset;
  }
}
</style>
