// K8s通用组件导出
export { default as K8sPageHeader } from './K8sPageHeader.vue'
export { default as K8sOverviewCards } from './K8sOverviewCards.vue'
export { default as K8sToolbar } from './K8sToolbar.vue'
export { default as K8sClusterSelector } from './K8sClusterSelector.vue'
export { default as K8sNamespaceSelector } from './K8sNamespaceSelector.vue'
export { default as K8sStatusTag } from './K8sStatusTag.vue'
export { default as K8sResourceActions } from './K8sResourceActions.vue'
export { default as K8sDataTable } from './K8sDataTable.vue'

// Service专用组件
export { default as ServiceYamlModal } from './ServiceYamlModal.vue'
export { default as ServiceDetailModal } from './ServiceDetailModal.vue'
export { default as ServiceEndpointsModal } from './ServiceEndpointsModal.vue'
export { default as ServiceMetricsModal } from './ServiceMetricsModal.vue'
export { default as ServiceEventsModal } from './ServiceEventsModal.vue'
export { default as ServiceEditModal } from './ServiceEditModal.vue'
export { default as ServiceCreateModal } from './ServiceCreateModal.vue'

// Service辅助组件  
// @ts-ignore
export { default as ServicePortConfig } from './ServicePortConfig.vue'
// @ts-ignore  
export { default as ServiceLabelsConfig } from './ServiceLabelsConfig.vue'
// @ts-ignore
export { default as ServiceYamlEditor } from './ServiceYamlEditor.vue'

// Deployment专用组件
// Deployment 相关组件
export { default as DeploymentYamlModal } from './DeploymentYamlModal.vue'
export { default as DeploymentScaleModal } from './DeploymentScaleModal.vue'
export { default as DeploymentMetricsModal } from './DeploymentMetricsModal.vue'
export { default as DeploymentEventsModal } from './DeploymentEventsModal.vue'
export { default as DeploymentPodsModal } from './DeploymentPodsModal.vue'
export { default as DeploymentHistoryModal } from './DeploymentHistoryModal.vue'

// StatefulSet 相关组件
export { default as StatefulSetYamlModal } from './StatefulSetYamlModal.vue'
export { default as StatefulSetScaleModal } from './StatefulSetScaleModal.vue'
export { default as StatefulSetMetricsModal } from './StatefulSetMetricsModal.vue'
export { default as StatefulSetEventsModal } from './StatefulSetEventsModal.vue'
export { default as StatefulSetPodsModal } from './StatefulSetPodsModal.vue'

// 组件类型定义
export interface K8sCluster {
  id: number
  name: string
  status: string
}

export type K8sNamespaceItem = string | { 
  name: string
  status?: string
  [key: string]: any 
}

export interface K8sOverviewCard {
  icon: any
  number: string | number
  label: string
  className?: string
}

export interface K8sActionItem {
  key: string
  label: string
  icon?: any
  disabled?: boolean
  danger?: boolean
  permission?: string
  condition?: () => boolean
}
