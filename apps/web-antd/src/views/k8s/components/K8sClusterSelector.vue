<template>
  <a-select
    v-model:value="selectedValue"
    placeholder="选择集群"
    class="env-filter cluster-selector"
    :loading="loading"
    @change="handleChange"
  >
    <template #suffixIcon>
      <ClusterOutlined />
    </template>
    <a-select-option 
      v-for="cluster in filteredClusters" 
      :key="cluster?.id || cluster?.name || Math.random()" 
      :value="cluster.id"
      v-show="cluster?.id !== undefined && cluster?.id !== null"
    >
      <span class="cluster-option">
        <CloudServerOutlined />
        {{ cluster?.name || 'Unknown' }}
        <a-tag 
          v-if="showStatus && cluster?.status" 
          :color="getStatusColor(cluster.status)" 
          size="small"
        >
          {{ getStatusText(cluster.status) }}
        </a-tag>
      </span>
    </a-select-option>
  </a-select>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ClusterOutlined, CloudServerOutlined } from '@ant-design/icons-vue'

interface Cluster {
  id: number
  name: string
  status: string | number
}

interface Props {
  clusters: Cluster[]
  loading?: boolean
  showStatus?: boolean
  onlyRunning?: boolean
  modelValue?: number | string
}

interface Emits {
  (e: 'update:modelValue', value: number | string): void
  (e: 'change', value: number | string, cluster?: Cluster): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showStatus: true,
  onlyRunning: false
})

const emit = defineEmits<Emits>()

const selectedValue = ref(props.modelValue)

const filteredClusters = computed(() => {
  // 确保 clusters 是数组且过滤掉无效项
  const validClusters = Array.isArray(props.clusters) 
    ? props.clusters.filter((cluster: any) => cluster && cluster.id !== null && cluster.id !== undefined)
    : []
  
  if (props.onlyRunning) {
    // 支持数字状态值 (ClusterStatus.Running = 1) 和字符串状态值
    return validClusters.filter(cluster => 
      cluster.status === 'Running' || cluster.status === 1 || cluster.status === 'running'
    )
  }
  return validClusters
})

const getStatusColor = (status: string | number) => {
  switch (status) {
    case 'Running':
    case 1:
      return 'green'
    case 'Stopped':
    case 2:
      return 'red'
    case 'Starting':
    case 3:
      return 'blue'
    case 'Stopping':
      return 'orange'
    default:
      return 'gray'
  }
}

const getStatusText = (status: string | number) => {
  switch (status) {
    case 'Running':
    case 1:
      return '运行中'
    case 'Stopped':
    case 2:
      return '已停止'
    case 'Starting':
    case 3:
      return '启动中'
    case 'Stopping':
      return '停止中'
    default:
      return '未知'
  }
}

const handleChange = (value: number | string) => {
  selectedValue.value = value
  emit('update:modelValue', value)
  // 确保比较时类型一致
  const clusterId = typeof value === 'string' ? parseInt(value) : value
  const cluster = props.clusters.find(c => c.id === clusterId)
  emit('change', value, cluster)
}

// 监听外部modelValue变化
watch(() => props.modelValue, (newValue) => {
  selectedValue.value = newValue
})
</script>

<style scoped>
.env-filter,
.cluster-selector {
  width: 160px;
}

.cluster-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-option svg {
  color: #1890ff;
}
</style>
