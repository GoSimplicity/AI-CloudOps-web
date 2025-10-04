<template>
  <div>
    <!-- 时间线对话框 -->
    <a-modal 
      :open="timelineDialog.visible" 
      title=""
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="() => { timelineDialog.visible = false }" 
      class="timeline-dialog responsive-modal"
      centered
    >
      <template #title>
        <div class="timeline-dialog-header">
          <div class="header-info">
            <div class="header-icon">
              <IconComponent icon="timeline" />
            </div>
            <div class="header-text">
              <div class="header-title">工单时间线</div>
              <div class="header-subtitle">跟踪工单的整个生命周期</div>
            </div>
          </div>
          <div class="header-actions">
            <a-tooltip title="刷新时间线">
              <a-button type="text" size="small" @click="refreshTimeline">
                <IconComponent icon="refresh" />
              </a-button>
            </a-tooltip>
            <a-tooltip title="筛选操作">
              <a-dropdown>
                <a-button type="text" size="small">
                  <IconComponent icon="filter" />
                </a-button>
                <template #overlay>
                  <a-menu @click="handleFilterChange">
                    <a-menu-item key="all">全部操作</a-menu-item>
                    <a-menu-item key="important">重要操作</a-menu-item>
                    <a-menu-item key="user">用户操作</a-menu-item>
                    <a-menu-item key="system">系统操作</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-tooltip>
            <a-tooltip title="时间排序">
              <a-button type="text" size="small" @click="toggleTimeSort">
                <IconComponent :icon="timeSortOrder === 'desc' ? 'time-desc' : 'time-asc'" />
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </template>
      
      <div class="timeline-content">
        <!-- 时间线统计 -->
        <div class="timeline-stats">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon create">
                <IconComponent icon="create" />
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ getActionCount('create') }}</div>
                <div class="stat-label">创建操作</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon update">
                <IconComponent icon="update" />
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ getActionCount('update') }}</div>
                <div class="stat-label">更新操作</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon approve">
                <IconComponent icon="approve" />
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ getActionCount('approve') }}</div>
                <div class="stat-label">审批操作</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon total">
                <IconComponent icon="total" />
              </div>
              <div class="stat-text">
                <div class="stat-number">{{ timelineList.length }}</div>
                <div class="stat-label">总操作数</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <a-spin :spinning="loading" tip="加载时间线中...">
          <!-- 时间线列表 -->
          <div v-if="filteredTimelineList.length > 0" class="timeline-wrapper">
            <div class="timeline-line"></div>
            <div class="timeline-list">
              <div 
                v-for="(item, index) in filteredTimelineList" 
                :key="item.id" 
                class="timeline-item-wrapper"
                :class="{
                  'timeline-item-left': index % 2 === 0,
                  'timeline-item-right': index % 2 === 1,
                  'timeline-item-highlight': isImportantAction(item.action)
                }"
                :style="{ '--delay': index * 0.1 + 's' }"
              >
                <!-- 时间线节点 -->
                <div class="timeline-node" :class="getActionClass(item.action)">
                  <div class="timeline-node-inner">
                    <component :is="getTimelineIcon(item.action)" class="timeline-node-icon" />
                  </div>
                  <div class="timeline-node-pulse" v-if="isImportantAction(item.action)"></div>
                </div>
                
                <!-- 时间线内容 -->
                <div class="timeline-card">
                  <div class="timeline-card-header">
                    <div class="action-info">
                      <div class="action-type-badge" :class="getActionClass(item.action)">
                        <component :is="getTimelineIcon(item.action)" class="action-type-icon" />
                        {{ getActionText(item.action) }}
                      </div>
                      <div class="action-time">
                        <IconComponent icon="time" />
                        {{ formatRelativeTime(item.created_at) }}
                      </div>
                    </div>
                    <div class="card-actions">
                      <a-tooltip title="查看详情">
                        <a-button type="text" size="small" @click="showTimelineDetail(item)">
                          <IconComponent icon="detail" />
                        </a-button>
                      </a-tooltip>
                    </div>
                  </div>
                  
                  <div class="timeline-card-content">
                    <!-- 操作人信息 -->
                    <div class="operator-section">
                      <a-avatar 
                        :size="32" 
                        :style="{ backgroundColor: getAvatarColor(item.operator_name || '') }"
                        class="operator-avatar"
                      >
                        {{ getInitials(item.operator_name) }}
                      </a-avatar>
                      <div class="operator-info">
                        <div class="operator-name">{{ item.operator_name || '未知用户' }}</div>
                        <div class="operator-role">操作人</div>
                      </div>
                      <div class="action-status" :class="getActionStatusClass(item.action)">
                        {{ getActionStatusText(item.action) }}
                      </div>
                    </div>
                    
                    <!-- 评论内容 -->
                    <div v-if="item.comment" class="comment-section">
                      <div class="comment-label">
                        <IconComponent icon="comment" />
                        备注说明
                      </div>
                      <div class="comment-content">{{ item.comment }}</div>
                    </div>
                    
                    <!-- 详细数据 -->
                    <div v-if="item.action_detail && showDetails[item.id]" class="detail-section">
                      <div class="detail-label">
                        <IconComponent icon="data" />
                        详细数据
                      </div>
                      <div class="detail-content">
                        <pre class="json-content">{{ formatActionDetail(item.action_detail) }}</pre>
                      </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div v-if="item.action_detail" class="timeline-card-actions">
                      <a-button 
                        type="text" 
                        size="small" 
                        @click="toggleDetail(item.id)"
                        class="toggle-detail-btn"
                      >
                        <IconComponent :icon="showDetails[item.id] ? 'collapse' : 'expand'" />
                        {{ showDetails[item.id] ? '收起详情' : '展开详情' }}
                      </a-button>
                    </div>
                  </div>
                </div>
                
                <!-- 绝对时间 -->
                <div class="absolute-time">
                  {{ formatFullDateTime(item.created_at) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else-if="!loading" class="empty-timeline">
            <a-empty description="">
              <template #image>
                <div class="empty-icon">
                  <IconComponent icon="empty-timeline" />
                </div>
              </template>
              <template #description>
                <div class="empty-description">
                  <div class="empty-title">暂无时间线记录</div>
                  <div class="empty-subtitle">这个工单还没有操作记录</div>
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
      title="操作详情"
      :width="600"
      @cancel="() => { detailDialog.visible = false }"
      :footer="null"
      class="timeline-detail-dialog responsive-modal"
    >
      <div v-if="detailDialog.item" class="timeline-detail-content">
        <div class="detail-header">
          <div class="detail-action-badge" :class="getActionClass(detailDialog.item.action)">
            <component :is="getTimelineIcon(detailDialog.item.action)" />
            {{ getActionText(detailDialog.item.action) }}
          </div>
          <div class="detail-time">{{ formatFullDateTime(detailDialog.item.created_at) }}</div>
        </div>
        
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item label="操作人">{{ detailDialog.item.operator_name }}</a-descriptions-item>
          <a-descriptions-item label="操作时间">{{ formatFullDateTime(detailDialog.item.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="操作类型">{{ getActionText(detailDialog.item.action) }}</a-descriptions-item>
          <a-descriptions-item label="备注说明" v-if="detailDialog.item.comment">
            {{ detailDialog.item.comment }}
          </a-descriptions-item>
          <a-descriptions-item label="详细数据" v-if="detailDialog.item.action_detail">
            <pre class="detail-json">{{ formatActionDetail(detailDialog.item.action_detail) }}</pre>
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
  PlusOutlined,
  EditOutlined,
  SendOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  MessageOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'

import {
  type WorkorderInstanceTimelineItem,
  type ListWorkorderInstanceTimelineReq,
  TimelineAction,
  listWorkorderInstanceTimeline
} from '#/api/core/workorder/workorder_instance_time_line'

// 图标组件
const IconComponent = ({ icon }: { icon: string }) => {
  const iconMap: Record<string, string> = {
    timeline: '⏳',
    refresh: '🔄',
    filter: '🔍',
    'time-desc': '⬇️',
    'time-asc': '⬆️',
    create: '➕',
    update: '✏️',
    approve: '✅',
    total: '📊',
    time: '⏰',
    detail: '🔍',
    comment: '💬',
    data: '📊',
    expand: '⬇️',
    collapse: '⬆️',
    'empty-timeline': '📅'
  }
  return iconMap[icon] || ''
}

// 状态数据
const loading = ref(false)
const timelineList = ref<WorkorderInstanceTimelineItem[]>([])
const filterType = ref<string>('all')
const timeSortOrder = ref<'asc' | 'desc'>('desc')
const showDetails = ref<Record<number, boolean>>({})

// 详情对话框
const detailDialog = reactive({
  visible: false,
  item: null as WorkorderInstanceTimelineItem | null
})

// 时间线对话框
const timelineDialog = reactive({
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

const formatActionDetail = (detail: string) => {
  try {
    const parsed = JSON.parse(detail)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return detail
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

// 计算属性
const filteredTimelineList = computed(() => {
  let filtered = [...timelineList.value]
  
  // 筛选
  if (filterType.value !== 'all') {
    switch (filterType.value) {
      case 'important':
        filtered = filtered.filter(item => isImportantAction(item.action))
        break
      case 'user':
        filtered = filtered.filter(item => !isSystemAction(item.action))
        break
      case 'system':
        filtered = filtered.filter(item => isSystemAction(item.action))
        break
    }
  }
  
  // 排序
  filtered.sort((a, b) => {
    const dateA = new Date(a.created_at || '')
    const dateB = new Date(b.created_at || '')
    return timeSortOrder.value === 'desc' 
      ? dateB.getTime() - dateA.getTime() 
      : dateA.getTime() - dateB.getTime()
  })
  
  return filtered
})

// 新增方法
const isImportantAction = (action: string): boolean => {
  return [
    TimelineAction.Create as string,
    TimelineAction.Submit as string,
    TimelineAction.Approve as string,
    TimelineAction.Reject as string,
    TimelineAction.Complete as string,
    TimelineAction.Cancel as string
  ].includes(action)
}

const isSystemAction = (action: string): boolean => {
  return [
    TimelineAction.Notify as string,
    TimelineAction.Remind as string,
    TimelineAction.View as string
  ].includes(action)
}

const getActionCount = (type: string): number => {
  switch (type) {
    case 'create':
      return timelineList.value.filter(item => item.action === TimelineAction.Create).length
    case 'update':
      return timelineList.value.filter(item => item.action === TimelineAction.Update).length
    case 'approve':
      return timelineList.value.filter(item => 
        [TimelineAction.Approve as string, TimelineAction.Reject as string].includes(item.action)
      ).length
    default:
      return 0
  }
}

const getActionClass = (action: string): string => {
  const classMap: Record<string, string> = {
    [TimelineAction.Create]: 'action-create',
    [TimelineAction.Update]: 'action-update',
    [TimelineAction.Submit]: 'action-submit',
    [TimelineAction.Assign]: 'action-assign',
    [TimelineAction.Approve]: 'action-approve',
    [TimelineAction.Reject]: 'action-reject',
    [TimelineAction.Cancel]: 'action-cancel',
    [TimelineAction.Complete]: 'action-complete',
    [TimelineAction.Return]: 'action-return',
    [TimelineAction.Comment]: 'action-comment',
    [TimelineAction.View]: 'action-view',
    [TimelineAction.Attach]: 'action-attach',
    [TimelineAction.Notify]: 'action-notify',
    [TimelineAction.Remind]: 'action-remind'
  }
  return classMap[action] || 'action-default'
}

const getActionStatusClass = (action: string): string => {
  const statusClassMap: Record<string, string> = {
    [TimelineAction.Approve]: 'status-success',
    [TimelineAction.Complete]: 'status-success',
    [TimelineAction.Reject]: 'status-error',
    [TimelineAction.Cancel]: 'status-error',
    [TimelineAction.Submit]: 'status-processing',
    [TimelineAction.Assign]: 'status-processing'
  }
  return statusClassMap[action] || 'status-default'
}

const getActionStatusText = (action: string): string => {
  const statusTextMap: Record<string, string> = {
    [TimelineAction.Approve]: '已通过',
    [TimelineAction.Complete]: '已完成',
    [TimelineAction.Reject]: '已拒绝',
    [TimelineAction.Cancel]: '已取消',
    [TimelineAction.Submit]: '处理中',
    [TimelineAction.Assign]: '已分配'
  }
  return statusTextMap[action] || '正常'
}

// 交互方法
const toggleDetail = (itemId: number) => {
  showDetails.value[itemId] = !showDetails.value[itemId]
}

const showTimelineDetail = (item: WorkorderInstanceTimelineItem) => {
  detailDialog.item = item
  detailDialog.visible = true
}

const handleFilterChange = ({ key }: { key: string }) => {
  filterType.value = key
}

const toggleTimeSort = () => {
  timeSortOrder.value = timeSortOrder.value === 'desc' ? 'asc' : 'desc'
}

const refreshTimeline = async () => {
  if (timelineDialog.instanceId) {
    await loadTimeline(timelineDialog.instanceId)
  }
}

const getTimelineIcon = (action: string) => {
  const iconMap: Record<string, any> = {
    [TimelineAction.Create]: PlusOutlined,
    [TimelineAction.Update]: EditOutlined,
    [TimelineAction.Submit]: SendOutlined,
    [TimelineAction.Assign]: UserOutlined,
    [TimelineAction.Approve]: CheckCircleOutlined,
    [TimelineAction.Reject]: ExclamationCircleOutlined,
    [TimelineAction.Cancel]: StopOutlined,
    [TimelineAction.Complete]: CheckCircleOutlined,
    [TimelineAction.Return]: ExclamationCircleOutlined,
    [TimelineAction.Comment]: MessageOutlined,
    [TimelineAction.View]: FileTextOutlined,
    [TimelineAction.Attach]: PlusOutlined,
    [TimelineAction.Notify]: MessageOutlined,
    [TimelineAction.Remind]: ExclamationCircleOutlined
  }
  return iconMap[action] || EditOutlined
}

const getActionText = (action: string): string => {
  const textMap: Record<string, string> = {
    [TimelineAction.Create]: '创建工单',
    [TimelineAction.Update]: '更新工单',
    [TimelineAction.Submit]: '提交工单',
    [TimelineAction.Assign]: '分配处理人',
    [TimelineAction.Approve]: '审批通过',
    [TimelineAction.Reject]: '拒绝工单',
    [TimelineAction.Cancel]: '取消工单',
    [TimelineAction.Complete]: '完成工单',
    [TimelineAction.Return]: '退回工单',
    [TimelineAction.Comment]: '添加评论',
    [TimelineAction.View]: '查看工单',
    [TimelineAction.Attach]: '添加附件',
    [TimelineAction.Notify]: '发送通知',
    [TimelineAction.Remind]: '催办提醒'
  }
  return textMap[action] || action
}

// 加载时间线
const loadTimeline = async (instanceId: number) => {
  try {
    loading.value = true
    
    let allTimelines: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params: ListWorkorderInstanceTimelineReq = {
        page: currentPage,
        size: pageSize,
        instance_id: instanceId
      }

      const res = await listWorkorderInstanceTimeline(params)
      
      if (res && res.items && res.items.length > 0) {
        allTimelines = [...allTimelines, ...res.items];
        
        if (res.items.length < pageSize || allTimelines.length >= (res.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    timelineList.value = allTimelines;
    // 初始化详情展开状态
    allTimelines.forEach((item: WorkorderInstanceTimelineItem) => {
      if (item.action_detail) {
        showDetails.value[item.id] = false
      }
    });
  } catch (error: any) {
    message.error('加载时间线失败');

    timelineList.value = [];
  } finally {
    loading.value = false;
  }
}

// 主要方法
const showTimeline = async (instanceId: number) => {
  timelineDialog.instanceId = instanceId
  timelineDialog.visible = true
  filterType.value = 'all'
  timeSortOrder.value = 'desc'
  showDetails.value = {}
  await loadTimeline(instanceId)
}

// 导出方法供父组件调用
defineExpose({
  showTimeline
})
</script>

<style scoped>
/* 时间线对话框样式 */
.timeline-dialog :deep(.ant-modal) {
  border-radius: 16px;
  overflow: hidden;
}

.timeline-dialog :deep(.ant-modal-content) {
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.timeline-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

/* 时间线内容区域 */
.timeline-content {
  max-height: 80vh;
  overflow-y: auto;
  padding: 0;
}

/* 时间线统计 */
.timeline-stats {
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%);
  border-bottom: 1px solid #e8f0fe;
  position: sticky;
  top: 0;
  z-index: 10;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%);
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  transition: all 0.3s ease;
}

.stat-item:hover {
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

.stat-icon.create {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.stat-icon.update {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
}

.stat-icon.approve {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.stat-icon.total {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.stat-text {
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

/* 时间线包装器 */
.timeline-wrapper {
  position: relative;
  padding: 32px 24px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
}

.timeline-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(to bottom, #e8f4f8, #d9ecf5, #e8f4f8);
  border-radius: 2px;
  transform: translateX(-50%);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
}

.timeline-item-wrapper {
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

.timeline-item-left {
  flex-direction: row;
}

.timeline-item-right {
  flex-direction: row-reverse;
}

.timeline-item-highlight {
  z-index: 2;
}

.timeline-item-highlight .timeline-node {
  transform: scale(1.1);
}

.timeline-item-highlight .timeline-card {
  border-color: #667eea;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
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
}

.timeline-node-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.timeline-node-pulse {
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
.timeline-node.action-create {
  border-color: #52c41a;
  color: #52c41a;
}

.timeline-node.action-update {
  border-color: #1890ff;
  color: #1890ff;
}

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

.timeline-node.action-cancel {
  border-color: #8c8c8c;
  color: #8c8c8c;
}

.timeline-node.action-assign {
  border-color: #722ed1;
  color: #722ed1;
}

/* 时间线卡片 */
.timeline-card {
  flex: 1;
  max-width: 480px;
  background: white;
  border-radius: 16px;
  border: 1px solid #e8f0fe;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}

.timeline-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.timeline-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
  border-bottom: 1px solid #e8f0fe;
  gap: 16px;
}

.action-info {
  flex: 1;
  min-width: 0;
}

.action-type-badge {
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

.action-type-badge.action-create {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.action-type-badge.action-update {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
}

.action-type-badge.action-submit {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}

.action-type-badge.action-approve {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.action-type-badge.action-reject {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
}

.action-type-icon {
  font-size: 16px;
}

.action-time {
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
  color: #667eea;
  border-color: #d9ecf5;
  background: #f0f8ff;
}

/* 时间线卡片内容 */
.timeline-card-content {
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

.action-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.action-status.status-success {
  background: linear-gradient(135deg, #f6ffed, #d9f7be);
  color: #52c41a;
  border: 1px solid #d9f7be;
}

.action-status.status-error {
  background: linear-gradient(135deg, #fff2f0, #ffccc7);
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.action-status.status-processing {
  background: linear-gradient(135deg, #e6f7ff, #bae7ff);
  color: #1890ff;
  border: 1px solid #bae7ff;
}

.action-status.status-default {
  background: linear-gradient(135deg, #fafafa, #f0f0f0);
  color: #8c8c8c;
  border: 1px solid #f0f0f0;
}

/* 评论和详情部分 */
.comment-section,
.detail-section {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
}

.comment-section {
  background: linear-gradient(135deg, #f6ffed 0%, #ffffff 100%);
  border-color: #d9f7be;
}

.detail-section {
  background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
  border-color: #e8eaed;
}

.comment-label,
.detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
}

.comment-content {
  line-height: 1.6;
  color: #495057;
  font-size: 14px;
  word-break: break-all;
}

.detail-content {
  position: relative;
}

.json-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e8eaed;
  max-height: 200px;
  overflow-y: auto;
}

.timeline-card-actions {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8f0fe;
}

.toggle-detail-btn {
  color: #667eea;
  border: 1px solid #d9ecf5;
  background: #f0f8ff;
  border-radius: 8px;
  font-size: 13px;
  transition: all 0.3s ease;
}

.toggle-detail-btn:hover {
  background: #e6f4ff;
  border-color: #bae7ff;
  transform: translateY(-1px);
}

/* 绝对时间 */
.absolute-time {
  position: absolute;
  top: 8px;
  font-size: 11px;
  color: #8c8c8c;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.timeline-item-left .absolute-time {
  right: 100%;
  margin-right: 16px;
}

.timeline-item-right .absolute-time {
  left: 100%;
  margin-left: 16px;
}

/* 空状态 */
.empty-timeline {
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
.timeline-detail-dialog :deep(.ant-modal-content) {
  border-radius: 12px;
}

.timeline-detail-content {
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

.detail-time {
  font-size: 13px;
  color: #8c8c8c;
  background: #f8f9fa;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
}

.detail-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e8eaed;
  max-height: 300px;
  overflow-y: auto;
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
  .timeline-dialog-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    padding: 16px 20px;
  }
  
  .header-actions {
    align-self: stretch;
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .stat-item {
    padding: 12px;
  }
  
  .stat-number {
    font-size: 18px;
  }
  
  .timeline-wrapper {
    padding: 20px 16px;
  }
  
  .timeline-item-wrapper {
    flex-direction: column !important;
    align-items: center;
    gap: 16px;
  }
  
  .timeline-node {
    width: 40px;
    height: 40px;
  }
  
  .timeline-card {
    max-width: 100%;
    width: 100%;
  }
  
  .timeline-card-header {
    padding: 16px;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .timeline-card-content {
    padding: 16px;
  }
  
  .operator-section {
    padding: 12px;
    gap: 10px;
  }
  
  .absolute-time {
    position: static !important;
    margin: 0 !important;
    align-self: center;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .timeline-stats {
    padding: 16px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .timeline-wrapper {
    padding: 16px 12px;
  }
  
  .timeline-card-header {
    padding: 12px;
  }
  
  .timeline-card-content {
    padding: 12px;
  }
  
  .comment-section,
  .detail-section {
    padding: 12px;
    margin-top: 12px;
  }
  
  .json-content {
    font-size: 11px;
    padding: 8px;
    max-height: 150px;
  }
}

/* 滚动条样式 */
.timeline-content::-webkit-scrollbar,
.json-content::-webkit-scrollbar,
.detail-json::-webkit-scrollbar {
  width: 6px;
}

.timeline-content::-webkit-scrollbar-track,
.json-content::-webkit-scrollbar-track,
.detail-json::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.timeline-content::-webkit-scrollbar-thumb,
.json-content::-webkit-scrollbar-thumb,
.detail-json::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #c1c1c1, #a8a8a8);
  border-radius: 3px;
}

.timeline-content::-webkit-scrollbar-thumb:hover,
.json-content::-webkit-scrollbar-thumb:hover,
.detail-json::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #a8a8a8, #959595);
}
</style>
