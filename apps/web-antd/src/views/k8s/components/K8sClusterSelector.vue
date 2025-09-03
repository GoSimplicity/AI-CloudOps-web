<template>
  <a-select
    :value="value"
    :placeholder="placeholder"
    :loading="loading"
    :disabled="disabled"
    class="k8s-cluster-selector"
    @change="handleChange"
    allow-clear
  >
    <template #suffixIcon>
      <ClusterOutlined />
    </template>
    <a-select-option
      v-for="cluster in clusters"
      :key="cluster.id"
      :value="cluster.id!"
    >
      <div class="cluster-option">
        <div class="cluster-info">
          <CloudServerOutlined class="cluster-icon" />
          <span class="cluster-name">{{ cluster.name }}</span>
        </div>
        <div class="cluster-meta">
          <a-tag 
            v-if="cluster.env"
            :color="getEnvColor(cluster.env)" 
            size="small"
          >
            {{ getEnvText(cluster.env) }}
          </a-tag>
          <a-tag 
            :color="getStatusColor(cluster.status)" 
            size="small"
          >
            {{ getStatusText(cluster.status) }}
          </a-tag>
        </div>
      </div>
    </a-select-option>
  </a-select>
</template>

<script lang="ts" setup>
import { 
  ClusterOutlined, 
  CloudServerOutlined 
} from '@ant-design/icons-vue'
import { 
  Env, 
  ClusterStatus,
  type K8sCluster
} from '#/api/core/k8s/k8s_cluster'

interface Props {
  value?: number
  clusters: K8sCluster[]
  loading?: boolean
  disabled?: boolean
  placeholder?: string
}

interface Emits {
  (e: 'update:value', value: number): void
  (e: 'change', value: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleChange = (value: number) => {
  emit('update:value', value)
  emit('change', value)
}

const getEnvColor = (env: Env | undefined) => {
  if (!env) return 'default'
  const colorMap = {
    [Env.Prod]: 'red',
    [Env.Dev]: 'blue', 
    [Env.Stage]: 'orange',
    [Env.Rc]: 'green',
    [Env.Press]: 'purple'
  }
  return colorMap[env] || 'default'
}

const getEnvText = (env: Env | undefined) => {
  if (!env) return '未知'
  const textMap = {
    [Env.Prod]: '生产',
    [Env.Dev]: '开发',
    [Env.Stage]: '预发',
    [Env.Rc]: '测试', 
    [Env.Press]: '灰度'
  }
  return textMap[env] || '未知'
}

const getStatusColor = (status: ClusterStatus) => {
  const colorMap = {
    [ClusterStatus.Running]: 'green',
    [ClusterStatus.Stopped]: 'default',
    [ClusterStatus.Error]: 'red'
  }
  return colorMap[status] || 'default'
}

const getStatusText = (status: ClusterStatus) => {
  const textMap = {
    [ClusterStatus.Running]: '运行中',
    [ClusterStatus.Stopped]: '已停止',
    [ClusterStatus.Error]: '异常'
  }
  return textMap[status] || '未知'
}
</script>

<style scoped>
.k8s-cluster-selector {
  min-width: 280px;
}

.cluster-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.cluster-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-icon {
  color: #1677ff;
}

.cluster-name {
  font-weight: 500;
  color: #262626;
}

.cluster-meta {
  display: flex;
  gap: 4px;
}
</style>
