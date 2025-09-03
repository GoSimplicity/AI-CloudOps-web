<template>
  <a-tag :color="getStatusColor(status)" class="k8s-status-tag">
    <template #icon>
      <component :is="getStatusIcon(status)" />
    </template>
    {{ status }}
  </a-tag>
</template>

<script lang="ts" setup>
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  ClockCircleOutlined,
  StopOutlined,
  QuestionCircleOutlined 
} from '@ant-design/icons-vue'

interface Props {
  status: string
}

defineProps<Props>()

// 获取状态颜色
const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    'Running': 'green',
    'Succeeded': 'green',
    'Active': 'green',
    'Ready': 'green',
    'Bound': 'green',
    'Available': 'blue',
    'Pending': 'orange',
    'ContainerCreating': 'orange',
    'Terminating': 'orange',
    'Stopped': 'default',
    'Failed': 'red',
    'Error': 'red',
    'CrashLoopBackOff': 'red',
    'ImagePullBackOff': 'red',
    'Unknown': 'default',
    'NotReady': 'red'
  }
  return colorMap[status] || 'default'
}

// 获取状态图标
const getStatusIcon = (status: string) => {
  const iconMap: Record<string, any> = {
    'Running': CheckCircleOutlined,
    'Succeeded': CheckCircleOutlined,
    'Active': CheckCircleOutlined,
    'Ready': CheckCircleOutlined,
    'Bound': CheckCircleOutlined,
    'Available': ClockCircleOutlined,
    'Pending': ClockCircleOutlined,
    'ContainerCreating': ClockCircleOutlined,
    'Terminating': ClockCircleOutlined,
    'Stopped': StopOutlined,
    'Failed': ExclamationCircleOutlined,
    'Error': ExclamationCircleOutlined,
    'CrashLoopBackOff': ExclamationCircleOutlined,
    'ImagePullBackOff': ExclamationCircleOutlined,
    'Unknown': QuestionCircleOutlined,
    'NotReady': ExclamationCircleOutlined
  }
  return iconMap[status] || QuestionCircleOutlined
}
</script>

<style scoped>
.k8s-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: 4px;
}
</style>
