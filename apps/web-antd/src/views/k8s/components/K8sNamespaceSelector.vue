<template>
  <a-select
    v-model:value="selectedValue"
    placeholder="选择命名空间"
    class="env-filter namespace-selector"
    :loading="loading"
    @change="handleChange"
  >
    <template #suffixIcon>
      <PartitionOutlined />
    </template>
    <a-select-option 
      v-for="ns in filteredNamespaces" 
      :key="getNamespaceKey(ns)"
      :value="getNamespaceValue(ns)"
      v-show="ns !== undefined && ns !== null && (typeof ns === 'string' ? ns !== '' : getNamespaceName(ns) !== '')"
    >
      <span class="namespace-option">
        <AppstoreOutlined />
        {{ getNamespaceName(ns) || 'Unknown' }}
        <a-tag 
          v-if="showStatus && getNamespaceStatus(ns)" 
          :color="getStatusColor(getNamespaceStatus(ns))" 
          size="small"
        >
          {{ getNamespaceStatus(ns) }}
        </a-tag>
      </span>
    </a-select-option>
  </a-select>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { PartitionOutlined, AppstoreOutlined } from '@ant-design/icons-vue'

type NamespaceItem = string | { name: string; status?: string; [key: string]: any }

interface Props {
  namespaces: NamespaceItem[]
  loading?: boolean
  showStatus?: boolean
  modelValue?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string, namespace?: NamespaceItem): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showStatus: false
})

const emit = defineEmits<Emits>()

const selectedValue = ref(props.modelValue)

const filteredNamespaces = computed(() => {
  // 确保 namespaces 是数组且过滤掉无效项
  return Array.isArray(props.namespaces) 
    ? props.namespaces.filter((item: any) => item && (item.name || item))
    : []
})

const getNamespaceKey = (namespace: NamespaceItem): string => {
  return typeof namespace === 'string' ? namespace : namespace.name
}

const getNamespaceValue = (namespace: NamespaceItem): string => {
  return typeof namespace === 'string' ? namespace : namespace.name
}

const getNamespaceName = (namespace: NamespaceItem): string => {
  return typeof namespace === 'string' ? namespace : namespace.name
}

const getNamespaceStatus = (namespace: NamespaceItem): string | undefined => {
  return typeof namespace === 'string' ? undefined : namespace.status
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'Active':
      return 'green'
    case 'Terminating':
      return 'orange'
    case 'Inactive':
      return 'red'
    default:
      return 'blue'
  }
}

const handleChange = (value: string) => {
  selectedValue.value = value
  emit('update:modelValue', value)
  const namespace = props.namespaces.find(ns => getNamespaceValue(ns) === value)
  emit('change', value, namespace)
}

// 监听外部modelValue变化
watch(() => props.modelValue, (newValue) => {
  selectedValue.value = newValue
})
</script>

<style scoped>
.env-filter,
.namespace-selector {
  width: 160px;
}

.namespace-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.namespace-option svg {
  color: #52c41a;
}
</style>
