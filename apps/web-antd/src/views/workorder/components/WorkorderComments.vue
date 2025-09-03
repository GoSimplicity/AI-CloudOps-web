<template>
  <div>
    <!-- 快速评论对话框 -->
    <a-modal 
      :open="commentDialog.visible" 
      title="添加评论" 
      :width="dialogWidth" 
      @ok="saveComment"
      @cancel="() => { commentDialog.visible = false }" 
      :destroy-on-close="true" 
      class="responsive-modal comment-modal"
      :confirm-loading="loading"
      ok-text="发布评论"
      cancel-text="取消"
    >
      <div class="comment-form-wrapper">
        <a-form :model="commentDialog.form" layout="vertical">
          <a-form-item label="评论内容" name="content" :rules="[{ required: true, message: '请输入评论内容' }]">
            <a-textarea 
              v-model:value="commentDialog.form.content" 
              :rows="5" 
              placeholder="分享你的想法或意见..."
              show-count
              :max-length="500"
              class="comment-textarea"
            />
          </a-form-item>
          <div class="comment-options">
            <a-checkbox v-model:checked="commentDialog.form.is_system" class="system-checkbox">
              <span class="checkbox-text">
                <IconComponent icon="system" /> 系统评论
              </span>
            </a-checkbox>
            <div class="quick-actions">
              <a-tooltip title="快速插入当前时间">
                <a-button size="small" type="text" @click="insertCurrentTime">
                  <IconComponent icon="time" />
                </a-button>
              </a-tooltip>
              <a-tooltip title="快速插入处理建议">
                <a-button size="small" type="text" @click="insertSuggestion">
                  <IconComponent icon="suggestion" />
                </a-button>
              </a-tooltip>
            </div>
          </div>
        </a-form>
      </div>
    </a-modal>

    <!-- 评论查看对话框 -->
    <a-modal 
      :open="commentsViewDialog.visible" 
      title=""
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="() => { commentsViewDialog.visible = false }" 
      class="comments-dialog responsive-modal"
      centered
    >
      <template #title>
        <div class="comments-dialog-header">
          <div class="header-info">
            <IconComponent icon="comment" class="header-icon" />
            <span class="header-title">工单评论</span>
            <a-badge :count="commentsList.length" class="comment-count" />
          </div>
          <div class="header-actions">
            <a-tooltip title="刷新评论">
              <a-button type="text" size="small" @click="refreshComments">
                <IconComponent icon="refresh" />
              </a-button>
            </a-tooltip>
            <a-tooltip title="排序方式">
              <a-dropdown>
                <a-button type="text" size="small">
                  <IconComponent icon="sort" />
                </a-button>
                <template #overlay>
                  <a-menu @click="handleSortChange">
                    <a-menu-item key="newest">最新优先</a-menu-item>
                    <a-menu-item key="oldest">最早优先</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-tooltip>
          </div>
        </div>
      </template>
      
      <div class="comments-content">
        <!-- 快速评论输入框 -->
        <div class="quick-comment-section">
          <!-- 引用预览卡片 -->
          <div v-if="quotedComment" class="quoted-comment-preview">
            <div class="quote-header">
              <div class="quote-info">
                <IconComponent icon="quote" />
                <span class="quote-label">引用 @{{ quotedComment.operator_name }} 的评论</span>
                <span class="quote-time">{{ formatRelativeTime(quotedComment.created_at) }}</span>
              </div>
              <a-button type="text" size="small" class="quote-close" @click="clearQuote">
                <IconComponent icon="close" />
              </a-button>
            </div>
            <div class="quote-content">
              <div class="quoted-text">{{ truncateText(quotedComment.content, 80) }}</div>
            </div>
          </div>
          
          <div class="quick-comment-input">
            <a-textarea
              ref="quickTextareaRef"
              v-model:value="quickCommentText"
              placeholder="快速添加评论..."
              :rows="2"
              class="quick-textarea"
              @keydown.ctrl.enter="submitQuickComment"
            />
            <div class="quick-comment-actions">
              <span class="keyboard-hint">Ctrl + Enter 快速发送</span>
              <a-button type="primary" size="small" @click="submitQuickComment" :loading="quickCommenting">
                <IconComponent icon="send" /> 发送
              </a-button>
            </div>
          </div>
        </div>

        <!-- 评论列表 -->
        <div v-if="commentsList.length === 0 && !loading" class="empty-comments">
          <a-empty description="">
            <template #image>
              <div class="empty-icon">
                <IconComponent icon="empty-comment" />
              </div>
            </template>
            <template #description>
              <div class="empty-description">
                <div class="empty-title">还没有评论</div>
                <div class="empty-subtitle">成为第一个评论的人吧</div>
              </div>
            </template>
          </a-empty>
        </div>
        
        <a-spin :spinning="loading" tip="加载评论中...">
          <div v-if="commentsList.length > 0" class="comments-list">
            <div v-for="(comment, index) in sortedComments" :key="comment.id" class="comment-item" :class="{ 'comment-highlight': comment.id === highlightCommentId }">
              <div class="comment-wrapper">
                <div class="comment-avatar">
                  <a-avatar 
                    :size="40" 
                    :style="{ backgroundColor: getAvatarColor(comment.operator_name || '') }"
                    class="user-avatar"
                  >
                    {{ getInitials(comment.operator_name) }}
                  </a-avatar>
                  <div v-if="comment.is_system === 1" class="system-badge">
                    <IconComponent icon="system" />
                  </div>
                </div>
                
                <div class="comment-body">
                  <div class="comment-header">
                    <div class="commenter-info">
                      <span class="commenter-name">{{ comment.operator_name }}</span>
                      <a-tag v-if="comment.is_system === 1" color="orange" size="small" class="system-tag">
                        <IconComponent icon="system" /> 系统
                      </a-tag>
                      <span class="comment-floor">#{{ index + 1 }}</span>
                    </div>
                    <div class="comment-meta">
                      <span class="comment-time">{{ formatRelativeTime(comment.created_at) }}</span>
                      <a-dropdown trigger="click" placement="bottomRight">
                        <a-button type="text" size="small" class="more-actions">
                          <IconComponent icon="more" />
                        </a-button>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item key="reply" @click="showReplyInput(comment.id)">
                              <IconComponent icon="reply" /> 回复
                            </a-menu-item>
                            <a-menu-item key="quote" @click="quoteComment(comment)">
                              <IconComponent icon="quote" /> 引用
                            </a-menu-item>
                            <a-menu-item key="copy" @click="copyComment(comment.content)">
                              <IconComponent icon="copy" /> 复制
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </div>
                  </div>
                  
                  <div class="comment-content">
                    <div class="comment-text" v-html="formatCommentContent(comment.content)"></div>
                  </div>
                  
                  <div class="comment-actions">
                    <a-button type="text" size="small" @click="showReplyInput(comment.id)" class="action-btn">
                      <IconComponent icon="reply" /> 回复
                    </a-button>
                    <a-button type="text" size="small" @click="likeComment(comment.id)" class="action-btn like-btn" :class="{ 'liked': isCommentLiked(comment.id) }">
                      <IconComponent icon="like" /> {{ getCommentLikes(comment.id) }}
                    </a-button>
                  </div>
                  
                  <!-- 回复输入框 -->
                  <div v-if="replyInputVisible[comment.id]" class="reply-input-section">
                    <div class="reply-input-wrapper">
                      <a-textarea
                        v-model:value="replyText[comment.id]"
                        :placeholder="`回复 ${comment.operator_name}...`"
                        :rows="3"
                        class="reply-textarea"
                        @keydown.ctrl.enter="submitReply(comment.id)"
                      />
                      <div class="reply-actions">
                        <a-button size="small" @click="cancelReply(comment.id)">取消</a-button>
                        <a-button type="primary" size="small" @click="submitReply(comment.id)" :loading="replySubmitting[comment.id]">
                          回复
                        </a-button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- 回复列表 -->
                  <div v-if="comment.children && comment.children.length > 0" class="comment-replies">
                    <div class="replies-header">
                      <IconComponent icon="replies" />
                      <span>{{ comment.children.length }} 条回复</span>
                      <a-button type="text" size="small" @click="toggleReplies(comment.id)">
                        {{ repliesExpanded[comment.id] ? '收起' : '展开' }}
                      </a-button>
                    </div>
                    
                    <div v-show="repliesExpanded[comment.id]" class="replies-list">
                      <div v-for="reply in comment.children" :key="reply.id" class="reply-item">
                        <div class="reply-avatar">
                          <a-avatar 
                            :size="32" 
                            :style="{ backgroundColor: getAvatarColor(reply.operator_name || '') }"
                          >
                            {{ getInitials(reply.operator_name) }}
                          </a-avatar>
                        </div>
                        <div class="reply-body">
                          <div class="reply-header">
                            <span class="replier-name">{{ reply.operator_name }}</span>
                            <span class="reply-time">{{ formatRelativeTime(reply.created_at) }}</span>
                          </div>
                          <div class="reply-content" v-html="formatCommentContent(reply.content)"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, defineEmits, defineExpose, nextTick, withDefaults, defineProps } from 'vue'
import { message } from 'ant-design-vue'
import {
  type WorkorderInstanceCommentItem,
  type CreateWorkorderInstanceCommentReq,
  type GetInstanceCommentsTreeReq,
  createWorkorderInstanceComment,
  getInstanceCommentsTree
} from '#/api/core/workorder/workorder_instance_comment'
import type { WorkorderInstanceItem } from '#/api/core/workorder/workorder_instance'

// 图标组件
const IconComponent = ({ icon }: { icon: string }) => {
  const iconMap: Record<string, string> = {
    system: '⚙️',
    time: '⏰',
    suggestion: '💡',
    comment: '💬',
    refresh: '🔄',
    sort: '🔀',
    send: '📤',
    'empty-comment': '💭',
    more: '⋯',
    reply: '↩️',
    quote: '❝',
    copy: '📋',
    like: '👍',
    replies: '💬',
    close: '✕'
  }
  return iconMap[icon] || ''
}

// 定义emits
const emit = defineEmits<{
  commentAdded: []
}>()

// 定义props
interface Props {
  instance?: WorkorderInstanceItem
}

const props = withDefaults(defineProps<Props>(), {
  instance: undefined
})

// 状态数据
const loading = ref(false)
const commentsList = ref<WorkorderInstanceCommentItem[]>([])
const quickCommenting = ref(false)
const quickCommentText = ref('')
const highlightCommentId = ref<number | null>(null)
const sortOrder = ref<'newest' | 'oldest'>('newest')

// 回复相关状态
const replyInputVisible = ref<Record<number, boolean>>({})
const replyText = ref<Record<number, string>>({})
const replySubmitting = ref<Record<number, boolean>>({})
const repliesExpanded = ref<Record<number, boolean>>({})

// 点赞相关（模拟数据，实际应该从后端获取）
const commentLikes = ref<Record<number, number>>({})
const userLikedComments = ref<Set<number>>(new Set())

// 评论对话框
const commentDialog = reactive({
  visible: false,
  form: {
    instance_id: 0,
    content: '',
    is_system: 0
  } as CreateWorkorderInstanceCommentReq
})

// 评论查看对话框
const commentsViewDialog = reactive({
  visible: false,
  instanceId: 0
})

// 响应式对话框宽度
const dialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth
    if (width < 768) return '95%'
    if (width < 1024) return '80%'
    return '600px'
  }
  return '600px'
})

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
    minute: '2-digit'
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
  const week = 7 * day
  const month = 30 * day
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`
  } else if (diff < week) {
    return `${Math.floor(diff / day)}天前`
  } else if (diff < month) {
    return `${Math.floor(diff / week)}周前`
  } else {
    return formatFullDateTime(dateStr)
  }
}

const formatCommentContent = (content: string) => {
  // 简单的内容格式化，可以扩展支持更多格式
  return content
    .replace(/\n/g, '<br>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
    .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
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
const sortedComments = computed(() => {
  const sorted = [...commentsList.value].sort((a, b) => {
    const dateA = new Date(a.created_at || '')
    const dateB = new Date(b.created_at || '')
    return sortOrder.value === 'newest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime()
  })
  return sorted
})

// 主要方法
const showCommentDialog = (instanceId: number) => {
  commentDialog.form = {
    instance_id: instanceId,
    content: '',
    is_system: 0
  }
  commentDialog.visible = true
}

// 快速评论
const submitQuickComment = async () => {
  if (!quickCommentText.value.trim()) {
    message.warning('请输入评论内容')
    return
  }
  
  try {
    quickCommenting.value = true
    const commentData: CreateWorkorderInstanceCommentReq = {
      instance_id: commentsViewDialog.instanceId,
      content: quickCommentText.value,
      is_system: 0
    }
    
    await createWorkorderInstanceComment(commentData)
    
    quickCommentText.value = ''
    quotedComment.value = null // 清除引用状态
    message.success('评论发布成功')
    await refreshComments()
    emit('commentAdded')
  } catch (error: any) {
    message.error(`发布评论失败: ${error.message || '未知错误'}`)
  } finally {
    quickCommenting.value = false
  }
}

// 快速操作
const insertCurrentTime = () => {
  const currentTime = new Date().toLocaleString('zh-CN')
  commentDialog.form.content += `\n处理时间: ${currentTime}\n`
}

const insertSuggestion = () => {
  commentDialog.form.content += '\n建议: '
}

// 回复相关方法
const showReplyInput = (commentId: number) => {
  replyInputVisible.value[commentId] = true
  replyText.value[commentId] = ''
  nextTick(() => {
    // 聚焦到回复输入框
  })
}

const cancelReply = (commentId: number) => {
  replyInputVisible.value[commentId] = false
  replyText.value[commentId] = ''
}

const submitReply = async (commentId: number) => {
  if (!replyText.value[commentId]?.trim()) {
    message.warning('请输入回复内容')
    return
  }
  
  try {
    replySubmitting.value[commentId] = true
    
    // 创建回复评论
    const replyData: CreateWorkorderInstanceCommentReq = {
      instance_id: commentsViewDialog.instanceId,
      content: replyText.value[commentId].trim(),
      parent_id: commentId,
      type: 'normal',
      is_system: 0
    }
    
    await createWorkorderInstanceComment(replyData)
    
    message.success('回复成功')
    replyInputVisible.value[commentId] = false
    replyText.value[commentId] = ''
    await refreshComments()
    
    // 触发父组件的评论添加事件
    emit('commentAdded')
  } catch (error: any) {
    message.error(`回复失败: ${error.message || '未知错误'}`)
  } finally {
    replySubmitting.value[commentId] = false
  }
}

// 切换回复展开/收起
const toggleReplies = (commentId: number) => {
  repliesExpanded.value[commentId] = !repliesExpanded.value[commentId]
}

// 点赞功能
const likeComment = (commentId: number) => {
  if (userLikedComments.value.has(commentId)) {
    userLikedComments.value.delete(commentId)
    commentLikes.value[commentId] = (commentLikes.value[commentId] || 0) - 1
  } else {
    userLikedComments.value.add(commentId)
    commentLikes.value[commentId] = (commentLikes.value[commentId] || 0) + 1
  }
}

const isCommentLiked = (commentId: number) => {
  return userLikedComments.value.has(commentId)
}

const getCommentLikes = (commentId: number) => {
  return commentLikes.value[commentId] || 0
}

// 引用评论相关状态
const quotedComment = ref<WorkorderInstanceCommentItem | null>(null)
const quickTextareaRef = ref()

// 其他功能 - 优化后的引用评论功能
const quoteComment = async (comment: WorkorderInstanceCommentItem) => {
  // 格式化引用内容
  const quotedContent = formatQuotedContent(comment)
  
  // 设置引用内容到快速评论框
  if (quickCommentText.value.trim()) {
    // 如果已经有内容，追加引用
    quickCommentText.value = `${quickCommentText.value}\n\n${quotedContent}`
  } else {
    // 如果没有内容，直接设置引用
    quickCommentText.value = quotedContent
  }
  
  // 设置当前引用的评论
  quotedComment.value = comment
  
  // 自动滚动到快速评论输入框并聚焦
  await nextTick()
  scrollToQuickComment()
  focusQuickComment()
  
  // 显示成功反馈
  message.success(`已引用 ${comment.operator_name} 的评论`)
}

// 格式化引用内容
const formatQuotedContent = (comment: WorkorderInstanceCommentItem): string => {
  const userName = comment.operator_name || '匿名用户'
  const timeStr = formatRelativeTime(comment.created_at)
  
  // 截断长内容
  let content = comment.content || ''
  const maxLength = 100
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '...'
  }
  
  // 处理多行内容，每行都加上引用符号
  const quotedLines = content.split('\n').map(line => `> ${line}`).join('\n')
  
  return `**引用 @${userName} 在 ${timeStr} 的评论：**\n${quotedLines}\n\n`
}

// 滚动到快速评论输入框
const scrollToQuickComment = () => {
  const quickCommentElement = document.querySelector('.quick-comment-section')
  if (quickCommentElement) {
    quickCommentElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    })
  }
}

// 聚焦快速评论输入框
const focusQuickComment = () => {
  nextTick(() => {
    if (quickTextareaRef.value) {
      quickTextareaRef.value.focus()
      // 将光标移动到末尾
      const textarea = quickTextareaRef.value.$el.querySelector('textarea')
      if (textarea) {
        const length = textarea.value.length
        textarea.setSelectionRange(length, length)
      }
    }
  })
}

// 清除引用
const clearQuote = () => {
  quotedComment.value = null
  // 清除引用内容（只清除引用部分，保留用户自己的内容）
  if (quickCommentText.value) {
    // 简单的处理方式：清除以 "**引用" 开头的内容块
    const lines = quickCommentText.value.split('\n')
    let filteredLines: string[] = []
    let inQuoteBlock = false
    
    for (const line of lines) {
      if (line.startsWith('**引用 @')) {
        inQuoteBlock = true
        continue
      }
      if (inQuoteBlock && line.trim() === '') {
        inQuoteBlock = false
        continue
      }
      if (inQuoteBlock && line.startsWith('>')) {
        continue
      }
      if (!inQuoteBlock) {
        filteredLines.push(line)
      }
    }
    
    quickCommentText.value = filteredLines.join('\n').trim()
  }
}

// 文本截断工具函数
const truncateText = (text: string, maxLength: number): string => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const copyComment = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    message.success('内容已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

// 排序和刷新
const handleSortChange = ({ key }: { key: string }) => {
  sortOrder.value = key as 'newest' | 'oldest'
}

const refreshComments = async () => {
  if (commentsViewDialog.instanceId) {
    await loadComments(commentsViewDialog.instanceId)
  }
}

// 加载评论
const loadComments = async (instanceId: number) => {
  try {
    loading.value = true
    const params: GetInstanceCommentsTreeReq = { id: instanceId }
    const res = await getInstanceCommentsTree(params)
    
    if (res) {
      commentsList.value = res
      // 初始化回复展开状态
      res.forEach((comment: WorkorderInstanceCommentItem) => {
        if (comment.children && comment.children.length > 0) {
          repliesExpanded.value[comment.id] = false
        }
      })
    } else {
      commentsList.value = []
    }
  } catch (error: any) {
    console.error('Failed to load comments:', error)
    message.error(`加载评论失败: ${error.message || '未知错误'}`)
    commentsList.value = []
  } finally {
    loading.value = false
  }
}

const saveComment = async () => {
  try {
    if (!commentDialog.form.content.trim()) {
      message.error('请输入评论内容')
      return
    }

    loading.value = true
    await createWorkorderInstanceComment(commentDialog.form)
    
    message.success('评论添加成功')
    commentDialog.visible = false
    emit('commentAdded')
  } catch (error: any) {
    message.error(`添加评论失败: ${error.message || '未知错误'}`)
    console.error('Failed to create comment:', error)
  } finally {
    loading.value = false
  }
}

const showCommentsView = async (instanceId: number) => {
  commentsViewDialog.instanceId = instanceId
  commentsViewDialog.visible = true
  quickCommentText.value = ''
  await loadComments(instanceId)
}

// 导出方法供父组件调用
defineExpose({
  showCommentDialog,
  showCommentsView
})
</script>

<style scoped>
/* 评论对话框样式增强 */
.comment-modal :deep(.ant-modal-header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px 12px 0 0;
  border: none;
}

.comment-modal :deep(.ant-modal-title) {
  color: white;
  font-weight: 700;
  font-size: 18px;
}

.comment-modal :deep(.ant-modal-close) {
  color: white;
}

.comment-modal :deep(.ant-modal-close:hover) {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
}

.comment-form-wrapper {
  padding: 8px 0;
}

.comment-textarea {
  border-radius: 8px;
  border: 2px solid #e8f0fe;
  transition: all 0.3s ease;
}

.comment-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.comment-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px;
  background: #f8fafb;
  border-radius: 8px;
  border: 1px solid #e8f0fe;
}

.system-checkbox .checkbox-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #2c3e50;
}

.quick-actions {
  display: flex;
  gap: 4px;
}

/* 评论查看对话框 */
.comments-dialog :deep(.ant-modal) {
  border-radius: 12px;
  overflow: hidden;
}

.comments-dialog :deep(.ant-modal-content) {
  border-radius: 12px;
}

.comments-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
}

.comment-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .ant-btn {
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.header-actions .ant-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 评论内容区域 */
.comments-content {
  max-height: 70vh;
  overflow-y: auto;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
  padding: 0;
}

/* 快速评论区域 */
.quick-comment-section {
  padding: 20px;
  background: #ffffff;
  border-bottom: 1px solid #e8f0fe;
  position: sticky;
  top: 0;
  z-index: 10;
}

/* 引用预览卡片 */
.quoted-comment-preview {
  margin-bottom: 16px;
  background: linear-gradient(135deg, #f0f8ff 0%, #ffffff 100%);
  border: 2px solid #d9ecf5;
  border-radius: 12px;
  overflow: hidden;
  animation: slideInDown 0.3s ease;
}

@keyframes slideInDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.quote-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.08);
  border-bottom: 1px solid #e1ecf4;
}

.quote-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.quote-label {
  font-weight: 600;
  color: #667eea;
  font-size: 13px;
  white-space: nowrap;
}

.quote-time {
  font-size: 12px;
  color: #8c8c8c;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}

.quote-close {
  color: #8c8c8c;
  border: none;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.quote-close:hover {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}

.quote-content {
  padding: 12px 16px;
}

.quoted-text {
  font-size: 13px;
  color: #5a6c7d;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid #667eea;
  font-style: italic;
}

.quick-comment-input {
  border: 2px solid #e8f0fe;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  transition: all 0.3s ease;
}

.quick-comment-input:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.quick-textarea {
  border: none;
  box-shadow: none;
  resize: none;
  padding: 16px;
  font-size: 14px;
}

.quick-textarea:focus {
  box-shadow: none;
}

.quick-comment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafb;
  border-top: 1px solid #e8f0fe;
}

.keyboard-hint {
  font-size: 12px;
  color: #8c8c8c;
}

/* 评论列表 */
.comments-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.comment-item {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e8f0fe;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.comment-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.comment-highlight {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.comment-wrapper {
  display: flex;
  padding: 20px;
  gap: 16px;
}

.comment-avatar {
  position: relative;
  flex-shrink: 0;
}

.user-avatar {
  border: 3px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.user-avatar:hover {
  transform: scale(1.05);
}

.system-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #faad14, #ffc53d);
  border-radius: 50%;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.commenter-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.commenter-name {
  font-weight: 700;
  color: #2c3e50;
  font-size: 16px;
}

.system-tag {
  background: linear-gradient(135deg, #faad14, #ffc53d);
  border: none;
  color: white;
  font-weight: 600;
}

.comment-floor {
  background: linear-gradient(135deg, #e8f0fe, #f0f8ff);
  color: #667eea;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #d9ecf5;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-time {
  font-size: 13px;
  color: #8c8c8c;
  background: #f8f9fa;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  white-space: nowrap;
}

.more-actions {
  color: #8c8c8c;
  border: none;
}

.more-actions:hover {
  background: #f0f8ff;
  color: #667eea;
}

.comment-content {
  margin: 16px 0;
}

.comment-text {
  line-height: 1.7;
  color: #2c3e50;
  font-size: 15px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafb 0%, #ffffff 100%);
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  position: relative;
}

.comment-text :deep(.mention) {
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.comment-text :deep(.hashtag) {
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
}

.action-btn {
  color: #8c8c8c;
  border: 1px solid #e8f0fe;
  border-radius: 8px;
  font-size: 13px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: #f0f8ff;
  color: #667eea;
  border-color: #d9ecf5;
}

.like-btn.liked {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
  border-color: #ffcccb;
}

/* 回复输入区域 */
.reply-input-section {
  margin-top: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f8ff 0%, #ffffff 100%);
  border-radius: 12px;
  border: 1px solid #d9ecf5;
}

.reply-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reply-textarea {
  border: 1px solid #d9ecf5;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.reply-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 回复列表 */
.comment-replies {
  margin-top: 16px;
  padding-left: 20px;
  border-left: 3px solid #e8f0fe;
  position: relative;
}

.replies-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #8c8c8c;
  font-size: 13px;
  font-weight: 600;
}

.replies-header .ant-btn {
  font-size: 12px;
  height: auto;
  padding: 2px 8px;
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reply-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e8f0fe;
  transition: all 0.3s ease;
}

.reply-item:hover {
  background: #f8fafb;
  border-color: #d9ecf5;
}

.reply-avatar {
  flex-shrink: 0;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.replier-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.reply-time {
  font-size: 12px;
  color: #8c8c8c;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 6px;
}

.reply-content {
  line-height: 1.6;
  color: #495057;
  font-size: 14px;
}

/* 空状态 */
.empty-comments {
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

/* 响应式对话框 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.responsive-modal :deep(.ant-modal-body) {
  padding: 0;
}

/* 加载动画 */
@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.comment-item {
  animation: slideInUp 0.4s ease-out;
}

.reply-item {
  animation: slideInUp 0.3s ease-out;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .comments-dialog-header {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .comment-wrapper {
    padding: 16px;
    gap: 12px;
  }
  
  .user-avatar {
    width: 32px !important;
    height: 32px !important;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .commenter-info {
    gap: 8px;
  }
  
  .comment-text {
    padding: 16px;
    font-size: 14px;
  }
  
  .quick-comment-section {
    padding: 16px;
  }
  
  .quick-textarea {
    padding: 12px;
  }
  
  .comments-list {
    padding: 16px;
    gap: 16px;
  }
  
  .reply-item {
    padding: 12px;
  }
  
  .reply-avatar .ant-avatar {
    width: 28px !important;
    height: 28px !important;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .comment-wrapper {
    flex-direction: column;
    gap: 8px;
  }
  
  .comment-avatar {
    align-self: flex-start;
  }
  
  .comment-text {
    padding: 12px;
    font-size: 13px;
  }
  
  .reply-item {
    flex-direction: column;
    gap: 8px;
  }
  
  .quick-comment-actions {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .keyboard-hint {
    text-align: center;
  }
}

/* 滚动条样式 */
.comments-content::-webkit-scrollbar {
  width: 6px;
}

.comments-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.comments-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #c1c1c1, #a8a8a8);
  border-radius: 3px;
}

.comments-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #a8a8a8, #959595);
}
</style>
