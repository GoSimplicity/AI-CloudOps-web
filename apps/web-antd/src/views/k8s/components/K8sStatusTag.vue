<template>
  <a-tag 
    :color="statusColor" 
    :class="['k8s-status-tag', statusClass]"
  >
    <component 
      v-if="statusIcon" 
      :is="statusIcon" 
      class="status-icon"
    />
    {{ statusText }}
  </a-tag>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  WarningOutlined
} from '@ant-design/icons-vue'

type StatusType = 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown' | 'terminating' | 'creating' | 'updating'

interface Props {
  status: string
  type?: StatusType
  showIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: true
})

// 状态颜色映射
const statusColorMap: Record<string, string> = {
  // Pod状态
  'Running': 'green',
  'Pending': 'orange',
  'Succeeded': 'green',
  'Failed': 'red',
  'Unknown': 'gray',
  'Terminating': 'orange',
  'ContainerCreating': 'blue',
  'PodInitializing': 'blue',
  'CrashLoopBackOff': 'red',
  'ImagePullBackOff': 'red',
  'ErrImagePull': 'red',
  'CreateContainerConfigError': 'red',
  'InvalidImageName': 'red',
  'CreateContainerError': 'red',
  
  // Deployment状态
  'Available': 'green',
  'Progressing': 'blue',
  'ReplicaFailure': 'red',
  
  // Service状态
  'Active': 'green',
  'Inactive': 'gray',
  
  // Node状态
  'Ready': 'green',
  'NotReady': 'red',
  'SchedulingDisabled': 'orange',
  
  // 集群状态
  'Healthy': 'green',
  'Unhealthy': 'red',
  'Warning': 'orange',
  
  // 通用状态
  'Online': 'green',
  'Offline': 'red',
  'Starting': 'blue',
  'Stopping': 'orange',
  'Error': 'red',
  'Info': 'blue',
  'Success': 'green'
}

// 状态文本映射
const statusTextMap: Record<string, string> = {
  'Running': '运行中',
  'Pending': '等待中',
  'Succeeded': '成功',
  'Failed': '失败',
  'Unknown': '未知',
  'Terminating': '终止中',
  'ContainerCreating': '创建中',
  'PodInitializing': '初始化中',
  'CrashLoopBackOff': '崩溃重启',
  'ImagePullBackOff': '镜像拉取失败',
  'ErrImagePull': '镜像拉取错误',
  'CreateContainerConfigError': '容器配置错误',
  'InvalidImageName': '无效镜像名',
  'CreateContainerError': '容器创建错误',
  'Available': '可用',
  'Progressing': '进行中',
  'ReplicaFailure': '副本失败',
  'Active': '活跃',
  'Inactive': '非活跃',
  'Ready': '就绪',
  'NotReady': '未就绪',
  'SchedulingDisabled': '调度禁用',
  'Healthy': '健康',
  'Unhealthy': '不健康',
  'Warning': '警告',
  'Online': '在线',
  'Offline': '离线',
  'Starting': '启动中',
  'Stopping': '停止中',
  'Error': '错误',
  'Info': '信息',
  'Success': '成功'
}

// 状态图标映射
const statusIconMap: Record<string, Component> = {
  'Running': CheckCircleOutlined,
  'Succeeded': CheckCircleOutlined,
  'Available': CheckCircleOutlined,
  'Active': CheckCircleOutlined,
  'Ready': CheckCircleOutlined,
  'Healthy': CheckCircleOutlined,
  'Online': CheckCircleOutlined,
  'Success': CheckCircleOutlined,
  
  'Failed': ExclamationCircleOutlined,
  'Error': ExclamationCircleOutlined,
  'Unhealthy': ExclamationCircleOutlined,
  'NotReady': ExclamationCircleOutlined,
  'CrashLoopBackOff': ExclamationCircleOutlined,
  'ImagePullBackOff': ExclamationCircleOutlined,
  'ErrImagePull': ExclamationCircleOutlined,
  'ReplicaFailure': ExclamationCircleOutlined,
  
  'Pending': ClockCircleOutlined,
  'Unknown': ClockCircleOutlined,
  'Progressing': ClockCircleOutlined,
  'ContainerCreating': ClockCircleOutlined,
  'PodInitializing': ClockCircleOutlined,
  'Starting': ClockCircleOutlined,
  
  'Terminating': StopOutlined,
  'Stopping': StopOutlined,
  'Inactive': StopOutlined,
  'Offline': StopOutlined,
  'SchedulingDisabled': StopOutlined,
  
  'Warning': WarningOutlined
}

const statusColor = computed(() => {
  return statusColorMap[props.status] || 'default'
})

const statusText = computed(() => {
  return statusTextMap[props.status] || props.status
})

const statusIcon = computed(() => {
  if (!props.showIcon) return null
  return statusIconMap[props.status] || null
})

const statusClass = computed(() => {
  return `status-${props.status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
})
</script>

<style scoped>
.k8s-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
}

.status-icon {
  font-size: 12px;
}

/* 特定状态的额外样式 */
.k8s-status-tag.status-running,
.k8s-status-tag.status-succeeded,
.k8s-status-tag.status-healthy {
  background-color: #f6ffed;
  border-color: #b7eb8f;
  color: #389e0d;
}

.k8s-status-tag.status-failed,
.k8s-status-tag.status-error {
  background-color: #fff2f0;
  border-color: #ffccc7;
  color: #cf1322;
}

.k8s-status-tag.status-pending,
.k8s-status-tag.status-progressing {
  background-color: #fff7e6;
  border-color: #ffd591;
  color: #d46b08;
}

.k8s-status-tag.status-unknown {
  background-color: #f5f5f5;
  border-color: #d9d9d9;
  color: #595959;
}
</style>
