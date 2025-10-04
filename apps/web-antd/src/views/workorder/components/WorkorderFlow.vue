<template>
  <div>
    <!-- 流转记录对话框 -->
    <a-modal 
      :open="flowDialog.visible" 
      title=""
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="() => { flowDialog.visible = false }" 
      class="flow-dialog responsive-modal"
      centered
    >
      <template #title>
        <div class="flow-dialog-header">
          <div class="header-info">
            <div class="header-icon">
              <IconComponent icon="flow" />
            </div>
            <div class="header-text">
              <div class="header-title">工单流转记录</div>
              <div class="header-subtitle">追踪工单状态变更的完整历程</div>
            </div>
          </div>
          <div class="header-actions">
            <a-tooltip title="刷新流转记录">
              <a-button type="text" size="small" @click="refreshFlow">
                <IconComponent icon="refresh" />
              </a-button>
            </a-tooltip>
            <a-tooltip title="筛选流转类型">
              <a-dropdown>
                <a-button type="text" size="small">
                  <IconComponent icon="filter" />
                </a-button>
                <template #overlay>
                  <a-menu @click="handleFilterChange">
                    <a-menu-item key="all">全部流转</a-menu-item>
                    <a-menu-item key="approve">审批操作</a-menu-item>
                    <a-menu-item key="assign">分配操作</a-menu-item>
                    <a-menu-item key="status">状态变更</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-tooltip>
            <a-tooltip title="显示模式">
              <a-button type="text" size="small" @click="toggleViewMode">
                <IconComponent :icon="viewMode === 'timeline' ? 'list' : 'timeline'" />
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </template>
      
      <div class="flow-content">
        <!-- 流转统计 -->
        <div class="flow-stats">
          <div class="stats-row">
            <div class="stat-card approve">
              <div class="stat-icon">
                <IconComponent icon="approve" />
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ getFlowCount('approve') }}</div>
                <div class="stat-label">审批通过</div>
              </div>
            </div>
            <div class="stat-card reject">
              <div class="stat-icon">
                <IconComponent icon="reject" />
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ getFlowCount('reject') }}</div>
                <div class="stat-label">审批拒绝</div>
              </div>
            </div>
            <div class="stat-card assign">
              <div class="stat-icon">
                <IconComponent icon="assign" />
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ getFlowCount('assign') }}</div>
                <div class="stat-label">指派操作</div>
              </div>
            </div>
            <div class="stat-card total">
              <div class="stat-icon">
                <IconComponent icon="total" />
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ flowList.length }}</div>
                <div class="stat-label">总流转数</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <a-spin :spinning="loading" tip="加载流转记录中...">
          <!-- 时间线视图 -->
          <div v-if="viewMode === 'timeline' && filteredFlowList.length > 0" class="timeline-view">
            <div class="flow-timeline">
              <div 
                v-for="(item, index) in filteredFlowList" 
                :key="item.id" 
                class="flow-timeline-item"
                :class="{ 'important-flow': isImportantFlow(item.action) }"
                :style="{ '--delay': index * 0.15 + 's' }"
              >
                <!-- 时间线节点 -->
                <div class="timeline-node" :class="getFlowActionClass(item.action)">
                  <div class="node-icon">
                    <component :is="getFlowActionIcon(item.action)" />
                  </div>
                  <div class="node-pulse" v-if="isImportantFlow(item.action)"></div>
                </div>
                
                <!-- 流转卡片 -->
                <div class="flow-card">
                  <div class="flow-card-header">
                    <div class="flow-action-info">
                      <div class="action-badge" :class="getFlowActionClass(item.action)">
                        <component :is="getFlowActionIcon(item.action)" />
                        <span>{{ getFlowActionText(item.action) }}</span>
                      </div>
                      <div class="flow-time">
                        <IconComponent icon="time" />
                        {{ formatRelativeTime(item.created_at) }}
                      </div>
                    </div>
                    <div class="card-actions">
                      <a-tooltip title="查看详情">
                        <a-button type="text" size="small" @click="showFlowDetail(item)">
                          <IconComponent icon="detail" />
                        </a-button>
                      </a-tooltip>
                    </div>
                  </div>
                  
                  <div class="flow-card-content">
                    <!-- 操作人信息 -->
                    <div class="operator-section">
                      <a-avatar 
                        :size="36" 
                        :style="{ backgroundColor: getAvatarColor(item.operator_name || '') }"
                        class="operator-avatar"
                      >
                        {{ getInitials(item.operator_name) }}
                      </a-avatar>
                      <div class="operator-info">
                        <div class="operator-name">{{ item.operator_name || '系统操作' }}</div>
                        <div class="operator-role">
                          {{ item.is_system_action === 1 ? '系统自动' : '手动操作' }}
                        </div>
                      </div>
                      <div class="system-badge" v-if="item.is_system_action === 1">
                        <IconComponent icon="system" />
                        <span>系统</span>
                      </div>
                    </div>
                    
                    <!-- 状态变更 -->
                    <div class="status-change-section">
                      <div class="status-flow">
                        <div class="from-status" :class="getStatusBadgeClass(item.from_status)">
                          {{ getStatusText(item.from_status) }}
                        </div>
                        <div class="flow-arrow">
                          <IconComponent icon="arrow" />
                        </div>
                        <div class="to-status" :class="getStatusBadgeClass(item.to_status)">
                          {{ getStatusText(item.to_status) }}
                        </div>
                      </div>
                      <div class="change-summary">
                        状态从 <strong>{{ getStatusText(item.from_status) }}</strong> 变更为 
                        <strong>{{ getStatusText(item.to_status) }}</strong>
                      </div>
                    </div>
                    
                    <!-- 处理说明 -->
                    <div v-if="item.comment" class="comment-section">
                      <div class="comment-header">
                        <IconComponent icon="comment" />
                        <span>处理说明</span>
                      </div>
                      <div class="comment-content">{{ item.comment }}</div>
                    </div>
                  </div>
                  
                  <!-- 绝对时间戳 -->
                  <div class="absolute-timestamp">
                    {{ formatFullDateTime(item.created_at) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 列表视图 -->
          <div v-else-if="viewMode === 'list' && filteredFlowList.length > 0" class="list-view">
            <div class="flow-table">
              <div class="table-header">
                <div class="header-cell action">操作类型</div>
                <div class="header-cell operator">操作人</div>
                <div class="header-cell status">状态变更</div>
                <div class="header-cell time">操作时间</div>
                <div class="header-cell actions">操作</div>
              </div>
              <div class="table-body">
                <div 
                  v-for="(item, index) in filteredFlowList" 
                  :key="item.id"
                  class="table-row"
                  :style="{ '--delay': index * 0.1 + 's' }"
                >
                  <div class="body-cell action" data-label="操作类型">
                    <div class="action-badge-small" :class="getFlowActionClass(item.action)">
                      <component :is="getFlowActionIcon(item.action)" />
                      <span>{{ getFlowActionText(item.action) }}</span>
                    </div>
                  </div>
                  <div class="body-cell operator" data-label="操作人">
                    <div class="operator-info-small">
                      <a-avatar 
                        :size="24" 
                        :style="{ backgroundColor: getAvatarColor(item.operator_name || '') }"
                      >
                        {{ getInitials(item.operator_name) }}
                      </a-avatar>
                      <span>{{ item.operator_name || '系统' }}</span>
                      <a-tag v-if="item.is_system_action === 1" color="orange" size="small">
                        系统
                      </a-tag>
                    </div>
                  </div>
                  <div class="body-cell status" data-label="状态变更">
                    <div class="status-change-small">
                      <span class="from-status" :class="getStatusBadgeClass(item.from_status)">
                        {{ getStatusText(item.from_status) }}
                      </span>
                      <IconComponent icon="arrow" />
                      <span class="to-status" :class="getStatusBadgeClass(item.to_status)">
                        {{ getStatusText(item.to_status) }}
                      </span>
                    </div>
                  </div>
                  <div class="body-cell time" data-label="操作时间">
                    <div class="time-info">
                      <div class="relative-time">{{ formatRelativeTime(item.created_at) }}</div>
                      <div class="absolute-time">{{ formatDate(item.created_at) }}</div>
                    </div>
                  </div>
                  <div class="body-cell actions" data-label="操作">
                    <a-button type="text" size="small" @click="showFlowDetail(item)">
                      <IconComponent icon="detail" />
                      详情
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else-if="!loading" class="empty-flow">
            <a-empty description="">
              <template #image>
                <div class="empty-icon">
                  <IconComponent icon="empty-flow" />
                </div>
              </template>
              <template #description>
                <div class="empty-description">
                  <div class="empty-title">暂无流转记录</div>
                  <div class="empty-subtitle">该工单还没有状态变更记录</div>
                </div>
              </template>
            </a-empty>
          </div>
        </a-spin>
      </div>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :open="detailDialog.visible"
      title="流转详情"
      :width="600"
      @cancel="() => { detailDialog.visible = false }"
      :footer="null"
      class="flow-detail-dialog responsive-modal"
    >
      <div v-if="detailDialog.item" class="flow-detail-content">
        <div class="detail-header">
          <div class="detail-action-badge" :class="getFlowActionClass(detailDialog.item.action)">
            <component :is="getFlowActionIcon(detailDialog.item.action)" />
            {{ getFlowActionText(detailDialog.item.action) }}
          </div>
          <div class="detail-time">{{ formatFullDateTime(detailDialog.item.created_at) }}</div>
        </div>
        
        <a-descriptions bordered :column="1" size="small" class="flow-descriptions">
          <a-descriptions-item label="操作类型">
            <div class="description-value">
              {{ getFlowActionText(detailDialog.item.action) }}
              <a-tag v-if="detailDialog.item.is_system_action === 1" color="orange" size="small">
                系统操作
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="操作人">{{ detailDialog.item.operator_name || '系统' }}</a-descriptions-item>
          <a-descriptions-item label="操作时间">{{ formatFullDateTime(detailDialog.item.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="状态变更">
            <div class="status-change-detail">
              <span class="from-status" :class="getStatusBadgeClass(detailDialog.item.from_status)">
                {{ getStatusText(detailDialog.item.from_status) }}
              </span>
              <IconComponent icon="arrow" />
              <span class="to-status" :class="getStatusBadgeClass(detailDialog.item.to_status)">
                {{ getStatusText(detailDialog.item.to_status) }}
              </span>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="处理说明" v-if="detailDialog.item.comment">
            <div class="comment-detail">{{ detailDialog.item.comment }}</div>
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, defineExpose } from 'vue'
import { message } from 'ant-design-vue'
import {
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  StopOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue'

import {
  type WorkorderInstanceFlowItem,
  type ListWorkorderInstanceFlowReq,
  FlowAction,
  listWorkorderInstanceFlow
} from '#/api/core/workorder/workorder_instance_flow'

import { InstanceStatus } from '#/api/core/workorder/workorder_instance'

// 图标组件
const IconComponent = ({ icon }: { icon: string }) => {
  const iconMap: Record<string, string> = {
    flow: '🔄',
    refresh: '🔃',
    filter: '🔍',
    list: '📋',
    timeline: '⏰',
    approve: '✅',
    reject: '❌',
    assign: '👤',
    total: '📊',
    time: '⏰',
    detail: '🔍',
    system: '⚙️',
    arrow: '➡️',
    comment: '💬',
    'empty-flow': '🌀'
  }
  return iconMap[icon] || ''
}

// 状态数据
const loading = ref(false)
const flowList = ref<WorkorderInstanceFlowItem[]>([])
const filterType = ref<string>('all')
const viewMode = ref<'timeline' | 'list'>('timeline')

// 详情对话框
const detailDialog = reactive({
  visible: false,
  item: null as WorkorderInstanceFlowItem | null
})

// 流转记录对话框
const flowDialog = reactive({
  visible: false,
  instanceId: 0
})

// 响应式对话框宽度
const previewDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth
    if (width < 768) return '95%'
    if (width < 1024) return '90%'
    return '80%'
  }
  return '80%'
})

// 工具方法
const formatFullDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatRelativeTime = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`
  } else {
    return `${Math.floor(diff / day)}天前`
  }
}

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN')
}

// 计算属性
const filteredFlowList = computed(() => {
  let filtered = [...flowList.value]
  
  switch (filterType.value) {
    case 'approve':
      filtered = filtered.filter(item => 
        [FlowAction.Approve as string, FlowAction.Reject as string].includes(item.action)
      )
      break
    case 'assign':
      filtered = filtered.filter(item => item.action === FlowAction.Assign)
      break
    case 'status':
      filtered = filtered.filter(item => 
        item.from_status !== item.to_status
      )
      break
  }
  
  return filtered.sort((a, b) => {
    const dateA = new Date(a.created_at || '')
    const dateB = new Date(b.created_at || '')
    return dateB.getTime() - dateA.getTime()
  })
})

// 新增方法
const isImportantFlow = (action: string): boolean => {
  return [
    FlowAction.Approve as string,
    FlowAction.Reject as string,
    FlowAction.Submit as string,
    FlowAction.Complete as string,
    FlowAction.Cancel as string
  ].includes(action)
}

const getFlowCount = (type: string): number => {
  switch (type) {
    case 'approve':
      return flowList.value.filter(item => item.action === FlowAction.Approve).length
    case 'reject':
      return flowList.value.filter(item => item.action === FlowAction.Reject).length
    case 'assign':
      return flowList.value.filter(item => item.action === FlowAction.Assign).length
    default:
      return 0
  }
}

const getFlowActionClass = (action: string): string => {
  const classMap: Record<string, string> = {
    [FlowAction.Submit]: 'action-submit',
    [FlowAction.Approve]: 'action-approve',
    [FlowAction.Reject]: 'action-reject',
    [FlowAction.Assign]: 'action-assign',
    [FlowAction.Cancel]: 'action-cancel',
    [FlowAction.Complete]: 'action-complete',
    [FlowAction.Return]: 'action-return'
  }
  return classMap[action] || 'action-default'
}

const getStatusBadgeClass = (status: number): string => {
  const classMap: Record<number, string> = {
    [InstanceStatus.Draft]: 'status-draft',
    [InstanceStatus.Pending]: 'status-pending',
    [InstanceStatus.Processing]: 'status-processing',
    [InstanceStatus.Completed]: 'status-completed',
    [InstanceStatus.Rejected]: 'status-rejected',
    [InstanceStatus.Cancelled]: 'status-cancelled'
  }
  return classMap[status] || 'status-default'
}

// 交互方法
const showFlowDetail = (item: WorkorderInstanceFlowItem) => {
  detailDialog.item = item
  detailDialog.visible = true
}

const handleFilterChange = ({ key }: { key: string }) => {
  filterType.value = key
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'timeline' ? 'list' : 'timeline'
}

const refreshFlow = async () => {
  if (flowDialog.instanceId) {
    await loadFlow(flowDialog.instanceId)
  }
}

const getInitials = (name: string | undefined) => {
  if (!name) return ''
  return name
    .split('')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const getAvatarColor = (name: string | undefined) => {
  if (!name) return '#1890ff'

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

const getStatusText = (status: number): string => {
  const textMap = {
    [InstanceStatus.Draft]: '草稿',
    [InstanceStatus.Pending]: '待处理',
    [InstanceStatus.Processing]: '处理中',
    [InstanceStatus.Completed]: '已完成',
    [InstanceStatus.Rejected]: '已拒绝',
    [InstanceStatus.Cancelled]: '已取消'
  }
  return textMap[status as keyof typeof textMap] || '未知'
}

const getFlowActionIcon = (action: string) => {
  const iconMap: Record<string, any> = {
    [FlowAction.Submit]: SendOutlined,
    [FlowAction.Approve]: CheckCircleOutlined,
    [FlowAction.Reject]: ExclamationCircleOutlined,
    [FlowAction.Assign]: UserOutlined,
    [FlowAction.Cancel]: StopOutlined,
    [FlowAction.Complete]: CheckCircleOutlined,
    [FlowAction.Return]: ExclamationCircleOutlined
  }
  return iconMap[action] || PlayCircleOutlined
}

const getFlowActionText = (action: string): string => {
  const textMap: Record<string, string> = {
    [FlowAction.Submit]: '提交工单',
    [FlowAction.Approve]: '审批通过',
    [FlowAction.Reject]: '审批拒绝',
    [FlowAction.Assign]: '指派处理人',
    [FlowAction.Cancel]: '取消工单',
    [FlowAction.Complete]: '完成工单',
    [FlowAction.Return]: '退回工单'
  }
  return textMap[action] || action
}

// 加载流转记录
const loadFlow = async (instanceId: number) => {
  try {
    loading.value = true
    
    let allFlows: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params: ListWorkorderInstanceFlowReq = {
        page: currentPage,
        size: pageSize,
        instance_id: instanceId
      }

      const res = await listWorkorderInstanceFlow(params)
      
      if (res && res.items && res.items.length > 0) {
        allFlows = [...allFlows, ...res.items];
        
        if (res.items.length < pageSize || allFlows.length >= (res.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    if (allFlows.length > 0) {
      flowList.value = allFlows
    } else {
      flowList.value = []
    }
  } catch (error: any) {

    message.error(`加载流转记录失败: ${error.message || '未知错误'}`)
    flowList.value = []
  } finally {
    loading.value = false
  }
}

// 主要方法
const showFlow = async (instanceId: number) => {
  flowDialog.instanceId = instanceId
  flowDialog.visible = true
  filterType.value = 'all'
  viewMode.value = 'timeline'
  await loadFlow(instanceId)
}

// 导出方法供父组件调用
defineExpose({
  showFlow
})
</script>

<style scoped>
/* 流转对话框样式 */
.flow-dialog :deep(.ant-modal) {
  border-radius: 16px;
  overflow: hidden;
}

.flow-dialog :deep(.ant-modal-content) {
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.flow-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  color: white;
  border-radius: 16px 16px 0 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  font-size: 24px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.header-subtitle {
  font-size: 13px;
  opacity: 0.9;
  font-weight: 400;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .ant-btn {
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.header-actions .ant-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

/* 流转内容区域 */
.flow-content {
  max-height: 80vh;
  overflow-y: auto;
  padding: 0;
}

/* 流转统计 */
.flow-stats {
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%);
  border-bottom: 1px solid #e8f0fe;
  position: sticky;
  top: 0;
  z-index: 10;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%);
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: #d9ecf5;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
  flex-shrink: 0;
}

.stat-card.approve .stat-icon {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.stat-card.reject .stat-icon {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.stat-card.assign .stat-icon {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.stat-card.total .stat-icon {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
}

/* 时间线视图 */
.timeline-view {
  padding: 32px 24px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.flow-timeline {
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
}

.flow-timeline::before {
  content: '';
  position: absolute;
  left: 24px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(to bottom, #e8f4f8, #d9ecf5, #e8f4f8);
  border-radius: 2px;
}

.flow-timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  position: relative;
  animation: fadeInUp 0.6s ease-out;
  animation-delay: var(--delay);
  animation-fill-mode: both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.flow-timeline-item.important-flow {
  z-index: 2;
}

.flow-timeline-item.important-flow .timeline-node {
  transform: scale(1.1);
}

.flow-timeline-item.important-flow .flow-card {
  border-color: #52c41a;
  box-shadow: 0 8px 24px rgba(82, 196, 26, 0.15);
}

/* 时间线节点 */
.timeline-node {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 4px solid;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 5;
  flex-shrink: 0;
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.node-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.3;
  animation: pulseEffect 2s infinite;
}

@keyframes pulseEffect {
  0% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* 不同操作类型的节点样式 */
.timeline-node.action-submit {
  border-color: #faad14;
  color: #faad14;
}

.timeline-node.action-approve {
  border-color: #52c41a;
  color: #52c41a;
}

.timeline-node.action-reject {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.timeline-node.action-assign {
  border-color: #722ed1;
  color: #722ed1;
}

.timeline-node.action-cancel {
  border-color: #8c8c8c;
  color: #8c8c8c;
}

.timeline-node.action-complete {
  border-color: #52c41a;
  color: #52c41a;
}

.timeline-node.action-return {
  border-color: #faad14;
  color: #faad14;
}

/* 流转卡片 */
.flow-card {
  flex: 1;
  max-width: 600px;
  background: white;
  border-radius: 16px;
  border: 1px solid #e8f0fe;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}

.flow-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.flow-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
  border-bottom: 1px solid #e8f0fe;
  gap: 16px;
}

.flow-action-info {
  flex: 1;
  min-width: 0;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 12px;
}

.action-badge.action-submit {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.action-badge.action-approve {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.action-badge.action-reject {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.action-badge.action-assign {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.action-badge.action-cancel {
  background: linear-gradient(135deg, #8c8c8c, #a6a6a6);
}

.action-badge.action-complete {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.action-badge.action-return {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.flow-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #8c8c8c;
  background: #f0f8ff;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #e1f3ff;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.card-actions .ant-btn {
  border: 1px solid #e8f0fe;
  color: #8c8c8c;
}

.card-actions .ant-btn:hover {
  color: #52c41a;
  border-color: #d9f7be;
  background: #f6ffed;
}

/* 流转卡片内容 */
.flow-card-content {
  padding: 20px;
}

.operator-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f8ff 0%, #ffffff 100%);
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid #e1f3ff;
}

.operator-avatar {
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.operator-info {
  flex: 1;
  min-width: 0;
}

.operator-name {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.2;
}

.operator-role {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}

.system-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: linear-gradient(135deg, #fff7e6, #ffeaa7);
  color: #faad14;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #ffe7ba;
}

/* 状态变更 */
.status-change-section {
  margin-bottom: 16px;
}

.status-flow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.from-status,
.to-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.from-status.status-draft,
.to-status.status-draft {
  background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
  color: #666;
  border: 1px solid #d9d9d9;
}

.from-status.status-pending,
.to-status.status-pending {
  background: linear-gradient(135deg, #fff7e6, #ffe7ba);
  color: #faad14;
  border: 1px solid #ffe7ba;
}

.from-status.status-processing,
.to-status.status-processing {
  background: linear-gradient(135deg, #e6f7ff, #bae7ff);
  color: #1890ff;
  border: 1px solid #bae7ff;
}

.from-status.status-completed,
.to-status.status-completed {
  background: linear-gradient(135deg, #f6ffed, #d9f7be);
  color: #52c41a;
  border: 1px solid #d9f7be;
}

.from-status.status-rejected,
.to-status.status-rejected {
  background: linear-gradient(135deg, #fff2f0, #ffcccb);
  color: #ff4d4f;
  border: 1px solid #ffcccb;
}

.from-status.status-cancelled,
.to-status.status-cancelled {
  background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.flow-arrow {
  color: #52c41a;
  font-size: 16px;
}

.change-summary {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

/* 处理说明 */
.comment-section {
  padding: 16px;
  background: linear-gradient(135deg, #f6ffed 0%, #ffffff 100%);
  border-radius: 12px;
  border: 1px solid #d9f7be;
  margin-bottom: 16px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #52c41a;
  margin-bottom: 8px;
}

.comment-content {
  line-height: 1.6;
  color: #495057;
  font-size: 14px;
  word-break: break-all;
}

/* 绝对时间戳 */
.absolute-timestamp {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e8f0fe;
  border-radius: 12px;
  font-size: 11px;
  color: #8c8c8c;
  text-align: center;
  margin-top: 12px;
  backdrop-filter: blur(4px);
}

/* 列表视图 */
.list-view {
  padding: 24px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.flow-table {
  background: white;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 120px;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
  border-bottom: 1px solid #e8f0fe;
}

.header-cell {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.table-body {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 120px;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f2f5;
  transition: all 0.3s ease;
  animation: fadeInUp 0.4s ease-out;
  animation-delay: var(--delay);
  animation-fill-mode: both;
}

.table-row:hover {
  background: #f8fafb;
}

.table-row:last-child {
  border-bottom: none;
}

.body-cell {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.action-badge-small {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.action-badge-small.action-submit {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.action-badge-small.action-approve {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.action-badge-small.action-reject {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.action-badge-small.action-assign {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.operator-info-small {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-change-small {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-change-small .from-status,
.status-change-small .to-status {
  padding: 2px 6px;
  font-size: 11px;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.relative-time {
  font-size: 13px;
  color: #2c3e50;
  font-weight: 500;
}

.absolute-time {
  font-size: 11px;
  color: #8c8c8c;
}

/* 空状态 */
.empty-flow {
  text-align: center;
  padding: 80px 20px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.empty-icon {
  font-size: 64px;
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-description {
  color: #8c8c8c;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 14px;
  opacity: 0.8;
}

/* 详情对话框 */
.flow-detail-dialog :deep(.ant-modal-content) {
  border-radius: 12px;
}

.flow-detail-content {
  padding: 8px 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8f0fe;
}

.detail-action-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.detail-action-badge.action-submit {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.detail-action-badge.action-approve {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.detail-action-badge.action-reject {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.detail-action-badge.action-assign {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.detail-time {
  font-size: 13px;
  color: #8c8c8c;
  background: #f8f9fa;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
}

/* 状态变更详情 */
.status-change-detail {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-change-detail .from-status,
.status-change-detail .to-status {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.comment-detail {
  line-height: 1.6;
  color: #495057;
  font-size: 14px;
  word-break: break-all;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e8f0fe;
}

/* 响应式对话框 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.responsive-modal :deep(.ant-modal-body) {
  padding: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .flow-dialog-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    padding: 16px 20px;
  }
  
  .header-actions {
    align-self: stretch;
    justify-content: center;
  }
  
  .flow-stats {
    padding: 16px;
  }
  
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .stat-number {
    font-size: 18px;
  }
  
  .timeline-view {
    padding: 20px 16px;
  }
  
  .flow-timeline::before {
    left: 16px;
  }
  
  .flow-timeline-item {
    gap: 16px;
  }
  
  .timeline-node {
    width: 40px;
    height: 40px;
  }
  
  .flow-card {
    max-width: 100%;
  }
  
  .flow-card-header {
    padding: 16px;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .flow-card-content {
    padding: 16px;
  }
  
  .operator-section {
    padding: 12px;
    gap: 10px;
  }
  
  .status-flow {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .list-view {
    padding: 16px;
  }
  
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .table-header {
    display: none;
  }
  
  .table-row {
    flex-direction: column;
    padding: 12px;
    border: 1px solid #e8f0fe;
    border-radius: 8px;
    margin-bottom: 8px;
  }
  
  .body-cell {
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid #f0f2f5;
  }
  
  .body-cell:last-child {
    border-bottom: none;
  }
  
  .body-cell::before {
    content: attr(data-label);
    font-weight: 600;
    color: #2c3e50;
    font-size: 12px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .flow-stats {
    padding: 12px;
  }
  
  .stats-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .timeline-view {
    padding: 16px 12px;
  }
  
  .flow-timeline-item {
    gap: 12px;
  }
  
  .timeline-node {
    width: 36px;
    height: 36px;
  }
  
  .flow-card-header {
    padding: 12px;
  }
  
  .flow-card-content {
    padding: 12px;
  }
  
  .comment-section {
    padding: 12px;
    margin-bottom: 12px;
  }
  
  .status-flow {
    gap: 6px;
  }
  
  .from-status,
  .to-status {
    font-size: 11px;
    padding: 3px 8px;
  }
  
  .list-view {
    padding: 12px;
  }
  
  .table-row {
    padding: 8px;
  }
}

/* 滚动条样式 */
.flow-content::-webkit-scrollbar {
  width: 8px;
}

.flow-content::-webkit-scrollbar-track {
  background: #f1f3f4;
  border-radius: 4px;
}

.flow-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #c1c1c1, #a8a8a8);
  border-radius: 4px;
}

.flow-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #a8a8a8, #959595);
}
</style>
