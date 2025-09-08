<template>
  <div class="ai-assistant-container">
    <!-- 优化的悬浮按钮 -->
    <div class="assistant-float-button" @click="toggleFloatWindow" :class="{ 'active': isFloatWindowVisible }">
      <div class="float-button-icon">
        <MessageCircle :size="24" />
      </div>

      <!-- 浮动提示 -->
      <div class="tooltip-content" v-if="!isFloatWindowVisible">
        <Sparkles :size="16" />
        <span>AI-CloudOps助手</span>
      </div>
    </div>

    <!-- 悬浮窗 -->
    <div v-if="isFloatWindowVisible" class="ai-float-window" :style="floatWindowStyle" ref="floatWindow">
      <!-- 悬浮窗头部 -->
      <div class="float-window-header" @mousedown="startDrag">
        <div class="header-title">
          <div class="title-icon">
            <Bot :size="20" />
          </div>
          <div class="title-content">
            <span class="title-text">AI-CloudOps助手</span>
            <span class="title-subtitle">智能运维助手</span>
          </div>
        </div>

        <div class="header-actions">
          <button class="action-button minimize-btn" @click="minimizeWindow" title="最小化">
            <Minus :size="16" />
          </button>
          <button class="action-button resize-btn" @click="toggleWindowSize" :title="isExpanded ? '缩小' : '放大'">
            <Minimize2 v-if="isExpanded" :size="16" />
            <Maximize2 v-else :size="16" />
          </button>
          <button class="action-button clear-btn" @click="clearChat" title="清空聊天">
            <Trash2 :size="16" />
          </button>
          <button class="action-button refresh-btn" @click="refreshKnowledge" title="刷新知识库" :disabled="isRefreshing">
            <RefreshCw :size="16" :class="{ 'spinning': isRefreshing }" />
          </button>
          <button class="action-button close-btn" @click="closeWindow" title="关闭">
            <X :size="16" />
          </button>
        </div>
      </div>

      <!-- 状态栏 -->
      <div class="status-bar">
        <div class="status-left">
          <div class="status-indicator">
            <div class="status-dot" :class="{ 'online': isConnected }"></div>
            <span class="status-text">
              {{ connectionStatus }}
            </span>
          </div>
          
          <!-- 模式切换器 -->
          <div class="mode-switcher">
            <button 
              class="mode-button" 
              :class="{ 'active': currentMode === 1 }"
              @click="switchMode('rag')"
              title="RAG模式 - 基于知识库回答"
            >
              <FileText :size="12" />
              RAG
            </button>
            <button 
              class="mode-button" 
              :class="{ 'active': currentMode === 2 }"
              @click="switchMode('mcp')"
              title="MCP模式 - 工具调用模式"
            >
              <Zap :size="12" />
              MCP
            </button>
          </div>
        </div>
        
        <div class="message-count">
          {{ Math.max(0, chatMessages.length - 1) }} 条对话
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="error-banner">
        <AlertCircle :size="16" />
        <span>{{ errorMessage }}</span>
        <button @click="errorMessage = ''" class="error-close">
          <X :size="14" />
        </button>
      </div>

      <!-- 消息内容区域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div v-for="(msg, index) in chatMessages" :key="`msg-${index}-${msg.time}`" :class="['message', msg.type]">
          <div class="message-wrapper">
            <div class="avatar">
              <div class="avatar-container" :class="msg.type === 'ai' ? 'ai-avatar' : 'user-avatar'">
                <Bot v-if="msg.type === 'ai'" :size="18" />
                <User v-else :size="18" />
              </div>
            </div>
            <div class="content">
              <div class="message-header">
                <span class="name">{{ msg.type === 'user' ? '您' : 'AI助手' }}</span>
                <span class="time">{{ msg.time }}</span>
              </div>

              <!-- AI思考状态 -->
              <div v-if="msg.type === 'ai' && !msg.content && sending" class="typing-content">
                <div class="typing-animation">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="typing-info">
                  <span class="typing-text">AI正在思考中...</span>
                  <div class="typing-details">
                    <span class="mode-badge" :class="currentMode === 1 ? 'rag' : 'mcp'">
                      {{ currentMode === 1 ? 'RAG模式' : 'MCP模式' }}
                    </span>
                    <span class="session-info" v-if="sessionId">
                      会话: {{ sessionId.slice(-8) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 正常消息内容 -->
              <div v-else class="text" v-html="renderMarkdown(msg.content || '')"></div>

              <!-- 消息来源显示 -->
              <div v-if="msg.sources && msg.sources.length > 0" class="message-sources">
                <div class="sources-header">
                  <FileText :size="14" />
                  <span>参考来源</span>
                </div>
                <div class="sources-list">
                  <div v-for="(source, idx) in msg.sources" :key="`source-${idx}`" class="source-item">
                    <div class="source-title">文档 {{ idx + 1 }}</div>
                    <div class="source-preview">{{ source.content ? source.content.substring(0, 100) + '...' : '内容不可用' }}</div>
                    <div v-if="source.score !== undefined" class="source-score">
                      相关性: {{ (source.score * 100).toFixed(1) }}%
                    </div>
                  </div>
                </div>
              </div>

              <!-- 后续问题推荐 -->
              <div v-if="msg.followUpQuestions && msg.followUpQuestions.length > 0" class="follow-up-questions">
                <div class="follow-up-header">
                  <HelpCircle :size="14" />
                  <span>您可能还想问</span>
                </div>
                <div class="follow-up-list">
                  <button 
                    v-for="(question, idx) in msg.followUpQuestions" 
                    :key="`followup-${idx}`" 
                    class="follow-up-question"
                    @click="sendQuickMessage(question)"
                    :disabled="sending"
                  >
                    {{ question }}
                  </button>
                </div>
              </div>

              <div class="message-actions" v-if="msg.type === 'ai' && msg.content">
                <button class="message-action-btn" @click="copyMessage(msg.content)" title="复制">
                  <Copy :size="12" />
                </button>
                <button class="message-action-btn" @click="toggleLike(index)" title="点赞">
                  <ThumbsUp :size="12" :class="{ 'liked': msg.liked }" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions" v-if="!sending && !isMinimized">
        <div class="quick-action-buttons">
          <button v-for="action in quickActions" :key="action.text" class="quick-action-btn"
            @click="sendQuickMessage(action.text)">
            <component :is="action.icon" :size="12" />
            {{ action.text }}
          </button>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input" v-if="!isMinimized">
        <div class="textarea-container">
          <div class="input-wrapper">
            <textarea v-model="globalInputMessage" placeholder="请输入您的问题..." :disabled="sending"
              @keydown="handleEnterKey" class="message-input" rows="1" ref="messageInput"></textarea>

            <div class="input-actions">
              <!-- 高级选项按钮 -->
              <button class="advanced-options-btn" @click="showAdvancedOptions = !showAdvancedOptions" title="高级选项"
                :class="{ 'active': showAdvancedOptions }">
                <Settings2 :size="16" />
              </button>

              <button class="send-button" :disabled="!globalInputMessage.trim() || sending" @click="handleSearch"
                :class="{ 'loading': sending }">
                <Send :size="16" v-if="!sending" />
                <div v-else class="loading-spinner"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- 高级选项 -->
        <div v-if="showAdvancedOptions" class="advanced-options">
          <div class="option-item">
            <label class="option-label">
              <input type="checkbox" v-model="useWebSearch" class="option-checkbox" />
              <span>启用网络搜索</span>
            </label>
          </div>
          <div class="option-item">
            <label class="option-label">
              <span>最大上下文文档数：</span>
              <select v-model="maxContextDocs" class="option-select">
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
              </select>
            </label>
          </div>
        </div>

        <div class="input-hints">
          <span class="hint-item">Shift+Enter发送</span>
          <div class="mode-info">
            <span class="mode-indicator" :class="currentMode === 1 ? 'rag' : 'mcp'">
              {{ currentMode === 1 ? 'RAG模式' : 'MCP模式' }}
            </span>
          </div>
          <span class="shortcut-hint">
            <span class="shortcut-key">Ctrl + /</span>
            快速打开
          </span>
        </div>
      </div>

      <!-- 调整大小的拖拽手柄 -->
      <div class="resize-handle" @mousedown="startResize" v-if="!isExpanded && !isMinimized"></div>
    </div>

    <!-- 遮罩层 -->
    <div v-if="isFloatWindowVisible" class="float-window-overlay" @click="closeWindow"></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue';
import {
  MessageCircle,
  Sparkles,
  Bot,
  User,
  Trash2,
  X,
  Copy,
  ThumbsUp,
  Send,
  HelpCircle,
  Settings,
  Zap,
  FileText,
  Minus,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  Settings2
} from 'lucide-vue-next';
import { message } from 'ant-design-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  assistantQuery,
  clearAssistantCache,
  refreshKnowledgeBase
} from '#/api/core/aiops/assistant';

// 状态管理
const isFloatWindowVisible = ref(false);
const isMinimized = ref(false);
const isExpanded = ref(false);
const isDragging = ref(false);
const isResizing = ref(false);
const globalInputMessage = ref('');
const sending = ref(false);
const isConnected = ref(false);
const isRefreshing = ref(false);
const errorMessage = ref('');
const showAdvancedOptions = ref(false);
const messagesContainer = ref(null);
const floatWindow = ref(null);
const messageInput = ref(null);
const sessionId = ref('');

// 模式管理 - 1=RAG模式，2=MCP模式
const currentMode = ref(1); // 默认为RAG模式
const chatHistory = ref([]); // 聊天历史记录

// 高级选项
const useWebSearch = ref(false);
const maxContextDocs = ref(5);

// 连接状态计算属性
const connectionStatus = computed(() => {
  if (sending.value) return '正在处理...';
  if (isRefreshing.value) return '刷新知识库中...';
  if (!sessionId.value) return '准备就绪';
  return isConnected.value ? '已连接' : '准备就绪';
});

// 模式切换函数
const switchMode = (mode) => {
  const modeNum = mode === 'rag' ? 1 : 2;
  if (currentMode.value === modeNum) return;
  
  currentMode.value = modeNum;
  message.info(`已切换到${mode === 'rag' ? 'RAG' : 'MCP'}模式`);
  
  // 清空聊天历史，重新开始会话
  sessionId.value = '';
  chatHistory.value = [];
  isConnected.value = false;
};

// 消息提示
const showSuccess = (msg) => {
  message.success(msg);
};

const showError = (msg, duration = 5000) => {
  errorMessage.value = msg;
  setTimeout(() => {
    errorMessage.value = '';
  }, duration);
};

// 重试机制
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`重试第 ${attempt} 次，${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// 错误分类处理
const handleApiError = (error, context = '') => {
  const status = error?.response?.status;
  const errorData = error?.response?.data;
  const errorMsg = errorData?.message || error?.message || '未知错误';
  
  console.error(`${context} 错误:`, { status, errorData, error });

  if (status === 429) {
    showError('请求频率过高，请稍后再试', 3000);
    return 'rate_limit';
  } else if (status === 401 || status === 403) {
    showError('认证失败，正在重新建立连接...');
    // 清除会话状态
    sessionId.value = '';
    chatHistory.value = [];
    isConnected.value = false;
    return 'auth_error';
  } else if (status === 404) {
    showError('服务不可用，请检查服务器状态');
    return 'service_unavailable';
  } else if (status >= 500) {
    showError(`服务器错误: ${errorMsg}`);
    return 'server_error';
  } else if (error.code === 'NETWORK_ERROR' || !status) {
    showError('网络连接错误，请检查网络状态');
    return 'network_error';
  } else {
    showError(`${context}: ${errorMsg}`);
    return 'unknown_error';
  }
};

// 悬浮窗位置和大小
const windowPosition = reactive({
  x: 100,
  y: 100
});

const windowSize = reactive({
  width: 380,
  height: 600
});

const dragStart = reactive({
  x: 0,
  y: 0,
  windowX: 0,
  windowY: 0
});

const resizeStart = reactive({
  x: 0,
  y: 0,
  startWidth: 0,
  startHeight: 0
});

// 计算悬浮窗样式
const floatWindowStyle = computed(() => ({
  left: `${windowPosition.x}px`,
  top: `${windowPosition.y}px`,
  width: `${windowSize.width}px`,
  height: isMinimized.value ? '60px' : `${windowSize.height}px`,
  transform: isExpanded.value ? 'none' : undefined,
  position: 'fixed',
  ...(isExpanded.value ? {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80vw',
    height: '80vh',
    maxWidth: '800px',
    maxHeight: '700px'
  } : {})
}));

// 快捷操作
const quickActions = [
  { text: '云服务器状态', icon: Settings },
  { text: '性能监控', icon: Zap },
  { text: '日志分析', icon: FileText },
  { text: 'Markdown演示', icon: FileText },
  { text: '帮助文档', icon: HelpCircle }
];

// 聊天消息接口定义
const chatMessages = reactive([
  {
    content: '👋 您好！我是AI-CloudOps助手，专注于为您提供智能运维服务。\n\n我可以帮助您：\n• 🔍 监控云服务器状态\n• 📊 分析性能指标\n• 🛠️ 故障诊断与修复\n• 📋 生成运维报告\n\n请问有什么我可以为您服务的吗？',
    type: 'ai',
    time: formatTime(new Date())
  }
]);

// 悬浮窗控制
const toggleFloatWindow = () => {
  isFloatWindowVisible.value = !isFloatWindowVisible.value;
  if (isFloatWindowVisible.value) {
    nextTick(() => {
      scrollToBottom();
    });
  } else {
    resetWindow();
  }
};

const closeWindow = () => {
  isFloatWindowVisible.value = false;
  resetWindow();
};

const minimizeWindow = () => {
  isMinimized.value = !isMinimized.value;
};

const toggleWindowSize = () => {
  isExpanded.value = !isExpanded.value;
};

const resetWindow = () => {
  isMinimized.value = false;
  isExpanded.value = false;
  sending.value = false;
  sessionId.value = '';
  errorMessage.value = '';
  showAdvancedOptions.value = false;
  currentMode.value = 1; // 重置为默认RAG模式
  chatHistory.value = [];
  isConnected.value = false;
  initChatMessages();
};

// 拖拽功能
const startDrag = (e) => {
  if (isExpanded.value) return;

  isDragging.value = true;
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragStart.windowX = windowPosition.x;
  dragStart.windowY = windowPosition.y;

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
};

const onDrag = (e) => {
  if (!isDragging.value) return;

  const deltaX = e.clientX - dragStart.x;
  const deltaY = e.clientY - dragStart.y;

  windowPosition.x = Math.max(0, Math.min(window.innerWidth - windowSize.width, dragStart.windowX + deltaX));
  windowPosition.y = Math.max(0, Math.min(window.innerHeight - (isMinimized.value ? 60 : windowSize.height), dragStart.windowY + deltaY));
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// 调整大小功能
const startResize = (e) => {
  if (isExpanded.value || isMinimized.value) return;

  isResizing.value = true;
  resizeStart.x = e.clientX;
  resizeStart.y = e.clientY;
  resizeStart.startWidth = windowSize.width;
  resizeStart.startHeight = windowSize.height;

  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
};

const onResize = (e) => {
  if (!isResizing.value) return;

  const deltaX = e.clientX - resizeStart.x;
  const deltaY = e.clientY - resizeStart.y;

  windowSize.width = Math.max(320, Math.min(600, resizeStart.startWidth + deltaX));
  windowSize.height = Math.max(400, Math.min(800, resizeStart.startHeight + deltaY));
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
};



// 初始化聊天记录
const initChatMessages = () => {
  chatMessages.length = 0;
  chatMessages.push({
    content: '👋 您好！我是AI-CloudOps助手，专注于为您提供智能运维服务。\n\n我可以帮助您：\n• 🔍 监控云服务器状态\n• 📊 分析性能指标\n• 🛠️ 故障诊断与修复\n• 📋 生成运维报告\n\n请问有什么我可以为您服务的吗？',
    type: 'ai',
    time: formatTime(new Date())
  });
};

// 发送消息
const sendMessage = async (value) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    showError('请输入消息内容');
    return;
  }

  globalInputMessage.value = '';

  // 添加用户消息到聊天记录
  const userMessage = {
    content: trimmedValue,
    type: 'user',
    time: formatTime(new Date())
  };
  chatMessages.push(userMessage);

  // 添加用户消息到聊天历史
  chatHistory.value.push({
    role: 'user',
    content: trimmedValue
  });


  const aiMessagePlaceholder = {
    content: '',
    type: 'ai',
    time: formatTime(new Date()),
    sources: [],
    followUpQuestions: []
  };
  chatMessages.push(aiMessagePlaceholder);

  sending.value = true;
  await nextTick();
  scrollToBottom();

  try {
    // 构建查询参数 - 使用新的接口结构
    const queryParams = {
      question: trimmedValue,
      mode: currentMode.value,
      chat_history: chatHistory.value.slice(-10), // 只保留最近10轮对话
      use_web_search: useWebSearch.value
    };

    // 如果有session_id，则传递给后端
    if (sessionId.value) {
      queryParams.session_id = sessionId.value;
    }

    console.log('发送查询请求:', queryParams);

    const response = await assistantQuery(queryParams);
    console.log('查询响应:', response);

    if (response?.answer) {

      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage) {
        lastMessage.content = response.answer;

        // 添加消息来源（处理新的数据结构）
        if (response.source_documents && response.source_documents.length > 0) {
          lastMessage.sources = response.source_documents;
        }

        // 添加后续问题推荐
        if (response.follow_up_questions && response.follow_up_questions.length > 0) {
          lastMessage.followUpQuestions = response.follow_up_questions;
        }

        // 处理评分信息（如果API返回）
        if (response.relevance_score !== undefined && response.relevance_score !== null) {
          lastMessage.relevanceScore = response.relevance_score;
        }

        if (response.recall_rate !== undefined && response.recall_rate !== null) {
          lastMessage.recallRate = response.recall_rate;
        }
      }

      // 保存/更新会话ID
      if (response.session_id) {
        if (!sessionId.value) {
          console.log('创建新会话，ID:', response.session_id);
          showSuccess('会话已建立');
        }
        sessionId.value = response.session_id;
        isConnected.value = true;
      }


      chatHistory.value.push({
        role: 'assistant',
        content: response.answer
      });

    } else {
      throw new Error('AI响应格式不正确');
    }
  } catch (error) {

    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.type === 'ai' && !chatMessages[chatMessages.length - 1]?.content) {
      chatMessages.pop();
    }

    // 移除用户消息从聊天历史
    if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1]?.role === 'user') {
      chatHistory.value.pop();
    }

    // 使用新的错误处理机制
    const errorType = handleApiError(error, 'AI查询');
    
    // 根据错误类型决定是否重试
    if (errorType === 'network_error' || errorType === 'server_error') {
      // 对于网络错误和服务器错误，提供重试选项
      setTimeout(() => {
        if (confirm('查询失败，是否重试？')) {
          sendMessage(trimmedValue);
        }
      }, 1000);
    }
  } finally {
    sending.value = false;
    await nextTick();
    scrollToBottom();
  }
};

// 刷新知识库
const refreshKnowledge = async () => {
  if (isRefreshing.value) return;

  try {
    isRefreshing.value = true;
    console.log('正在刷新知识库...');

    // 使用重试机制
    const response = await retryWithBackoff(async () => {
      return await refreshKnowledgeBase();
    });

    console.log('刷新知识库响应:', response);

    if (response?.refreshed !== false) {
      const docsCount = response?.documents_count;
      const vectorCount = response?.vector_count;
      let successMsg = '知识库刷新成功';
      
      if (docsCount !== undefined) {
        successMsg += `，处理文档 ${docsCount} 个`;
      }
      if (vectorCount !== undefined) {
        successMsg += `，向量 ${vectorCount} 个`;
      }
      
      showSuccess(successMsg);
    } else {
      throw new Error(response?.message || '刷新知识库失败');
    }
  } catch (error) {
    handleApiError(error, '刷新知识库');
  } finally {
    isRefreshing.value = false;
  }
};

// 清空聊天
const clearChat = async () => {
  if (chatMessages.length <= 1) {
    message.error('暂无聊天记录');
    return;
  }

  if (!confirm('确定要清空所有聊天记录和缓存吗？此操作不可恢复。')) {
    return;
  }

  try {
    // 清除服务器缓存（如果有会话）
    if (sessionId.value) {
      try {
        const response = await clearAssistantCache();
        console.log('清除缓存响应:', response);
        showSuccess('服务器缓存已清除');
      } catch (error) {
        console.warn('清除服务器缓存失败:', error);
        // 继续清空本地记录
      }
    }

    // 清空本地状态
    sessionId.value = '';
    chatHistory.value = [];
    isConnected.value = false;
    initChatMessages();

    message.success('聊天记录已清空');
  } catch (error) {
    console.error('清空聊天错误:', error);
    // 即使出错也要清空本地记录
    sessionId.value = '';
    chatHistory.value = [];
    isConnected.value = false;
    initChatMessages();
    message.warning('清空完成，但可能存在部分错误');
  }
};

// 快捷消息发送
const sendQuickMessage = (text) => {
  if (text === 'Markdown演示') {
    // 显示Markdown演示内容
    const demoContent = `# Markdown演示

## 支持的功能

### 文本格式
- **粗体文本**
- *斜体文本* 
- ~~删除线~~
- \`行内代码\`

### 列表
1. 有序列表项目1
2. 有序列表项目2
3. 有序列表项目3

- 无序列表项目A
- 无序列表项目B
- 无序列表项目C

### 代码块

\`\`\`javascript
// JavaScript 代码示例
function hello(name) {
  console.log(\`Hello, \${name}!\`);
  return "Welcome to AI-CloudOps";
}

// 调用函数
hello("World");
\`\`\`

\`\`\`python
# Python 代码示例
def calculate_performance(cpu_usage, memory_usage):
    """计算系统性能指标"""
    if cpu_usage > 80 or memory_usage > 90:
        return "高负载"
    elif cpu_usage > 60 or memory_usage > 70:
        return "中等负载"
    else:
        return "正常"

# 使用示例
result = calculate_performance(75, 65)
print(f"系统状态: {result}")
\`\`\`

### 引用
> 这是一个引用块示例。AI-CloudOps 致力于提供最智能的运维解决方案。

### 表格
| 服务器 | CPU使用率 | 内存使用率 | 状态 |
|--------|-----------|------------|------|
| Web-01 | 45% | 60% | 正常 |
| Web-02 | 78% | 85% | 告警 |
| DB-01 | 35% | 50% | 正常 |

### 链接
访问 [AI-CloudOps官网](https://ai-cloudops.com) 了解更多信息。

---

*现在您可以尝试发送任何Markdown格式的内容，系统将完美渲染！*`;

    const demoMessage = {
      content: demoContent,
      type: 'ai',
      time: formatTime(new Date()),
      sources: [],
      followUpQuestions: [
        '如何监控服务器状态？',
        '告警阈值如何设置？',
        '性能优化建议'
      ]
    };
    
    chatMessages.push(demoMessage);
    nextTick(() => {
      scrollToBottom();
    });
    return;
  }
  
  globalInputMessage.value = text;
  handleSearch();
};

// 其他功能函数
const handleSearch = () => {
  const msg = globalInputMessage.value.trim();
  if (!msg || sending.value) return;
  sendMessage(msg);
};

const copyMessage = async (content) => {
  try {
    await navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  } catch (err) {
    message.error('复制失败');
  }
};

const toggleLike = (index) => {
  if (chatMessages[index]) {
    chatMessages[index].liked = !chatMessages[index].liked;
    message.success(chatMessages[index].liked ? '已点赞' : '已取消点赞');
  }
};

// 简单的代码高亮函数
const highlightCode = (code, lang) => {
  const keywords = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'import', 'export', 'class', 'extends'],
    python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'with', 'as'],
    bash: ['echo', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'grep', 'find', 'sudo', 'chmod', 'chown'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'JOIN', 'GROUP BY', 'ORDER BY']
  };

  let highlightedCode = escapeHtml(code);
  
  if (keywords[lang]) {
    keywords[lang].forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      highlightedCode = highlightedCode.replace(regex, `<span class="code-keyword">${keyword}</span>`);
    });
  }

  // 高亮字符串
  highlightedCode = highlightedCode.replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="code-string">$1$2$1</span>');
  
  // 高亮注释
  if (lang === 'javascript' || lang === 'java' || lang === 'cpp') {
    highlightedCode = highlightedCode.replace(/(\/\/.*$)/gm, '<span class="code-comment">$1</span>');
    highlightedCode = highlightedCode.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="code-comment">$1</span>');
  } else if (lang === 'python' || lang === 'bash') {
    highlightedCode = highlightedCode.replace(/(#.*$)/gm, '<span class="code-comment">$1</span>');
  } else if (lang === 'sql') {
    highlightedCode = highlightedCode.replace(/(--.*$)/gm, '<span class="code-comment">$1</span>');
  }

  return highlightedCode;
};

// 配置 marked 选项
marked.setOptions({
  breaks: true, // 支持换行
  gfm: true, // 启用GitHub风格的Markdown
  headerIds: false, // 禁用header id生成
  mangle: false, // 禁用header mangle
  sanitize: false, // 交给DOMPurify处理
  highlight: function(code, lang) {
    const highlightedCode = highlightCode(code, lang);
    const escapedCode = escapeHtml(code);
    return `<pre class="language-${lang || 'text'}" data-code="${escapedCode}">
      <div class="code-header">
        <span class="code-lang">${lang || 'text'}</span>
        <button class="code-copy-btn" onclick="copyCode(this)" title="复制代码">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="m5 15-4-4 4-4"></path>
          </svg>
        </button>
      </div>
      <code>${highlightedCode}</code>
    </pre>`;
  }
});

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const renderMarkdown = (content) => {
  if (!content) return '';
  
  try {
    // 使用 marked 解析 Markdown
    const html = marked(content);
    // 使用 DOMPurify 清理 HTML，防止 XSS 攻击
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'del', 's', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'div', 'span', 'button', 'svg', 'rect', 'path', 'polyline'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
        'data-code', 'onclick', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
        'x', 'y', 'rx', 'ry', 'd', 'points'
      ],
      ALLOWED_CLASSES: {
        'span': ['code-keyword', 'code-string', 'code-comment', 'code-number', 'code-operator', 'code-lang'],
        'pre': [/^language-/],
        'div': ['code-header'],
        'button': ['code-copy-btn']
      },
      ALLOW_DATA_ATTR: true
    });
  } catch (error) {
    console.error('Markdown 渲染错误:', error);
    // 如果解析失败，返回原始内容（转义HTML）
    return escapeHtml(content).replace(/\n/g, '<br>');
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth'
    });
  }
};

const handleEnterKey = (e) => {
  if (e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
};

function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 键盘快捷键
const handleKeydown = (e) => {
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    toggleFloatWindow();
  }
};

// 监听器
watch(chatMessages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

// 全局复制代码函数
window.copyCode = function(button) {
  const pre = button.closest('pre');
  const code = pre.getAttribute('data-code');
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      const originalText = button.innerHTML;
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      `;
      button.style.color = '#10b981';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.color = '';
      }, 2000);
    }).catch(() => {
      message.error('复制失败');
    });
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);

  // 设置初始位置
  windowPosition.x = window.innerWidth - windowSize.width - 50;
  windowPosition.y = 100;
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<style scoped>

.ai-assistant-container {
  position: relative;
  z-index: 9999;
}


.assistant-float-button {
  position: fixed;
  bottom: 80px;
  right: 30px;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
  z-index: 10000;
}

.assistant-float-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.assistant-float-button.active {
  background: linear-gradient(135deg, #10b981, #059669);
}

.float-button-icon {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tooltip-content {
  position: absolute;
  right: 70px;
  top: 50%;
  transform: translateY(-50%);
  background: #1f2937;
  color: #f3f4f6;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.assistant-float-button:hover .tooltip-content {
  opacity: 1;
}

.tooltip-content::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-left-color: #1f2937;
}


.float-window-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 9998;
}


.ai-float-window {
  position: fixed;
  background: #1f2937;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid #374151;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}


.float-window-header {
  background: linear-gradient(135deg, #2d3748, #1a202c);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #374151;
  cursor: move;
  user-select: none;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f3f4f6;
}

.title-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.title-content {
  display: flex;
  flex-direction: column;
}

.title-text {
  font-weight: 600;
  font-size: 16px;
  line-height: 1.2;
}

.title-subtitle {
  font-size: 12px;
  color: #9ca3af;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  color: #f3f4f6;
  background: rgba(255, 255, 255, 0.1);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn:hover {
  background: #ef4444;
  color: white;
}


.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #2d3748;
  border-bottom: 1px solid #374151;
  font-size: 12px;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  transition: all 0.3s ease;
}

.status-dot.online {
  background: #10b981;
}

.status-text {
  color: #d1d5db;
  font-weight: 500;
}


.mode-switcher {
  display: flex;
  background: #374151;
  border-radius: 6px;
  border: 1px solid #4a5568;
  overflow: hidden;
}

.mode-button {
  background: transparent;
  border: none;
  color: #9ca3af;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.mode-button:hover {
  color: #f3f4f6;
  background: rgba(255, 255, 255, 0.05);
}

.mode-button.active {
  color: white;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.mode-button:not(:last-child) {
  border-right: 1px solid #4a5568;
}

.message-count {
  color: #9ca3af;
  font-weight: 500;
}


.mode-info {
  display: flex;
  align-items: center;
}

.mode-indicator {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
  transition: all 0.2s ease;
}

.mode-indicator.rag {
  color: #3b82f6;
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.mode-indicator.mcp {
  color: #10b981;
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}


.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
}

.error-close {
  background: none;
  border: none;
  color: #991b1b;
  cursor: pointer;
  margin-left: auto;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.2s;
}

.error-close:hover {
  background: rgba(239, 68, 68, 0.1);
}


.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 200px;
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}


.message {
  margin-bottom: 16px;
  opacity: 0;
  animation: messageSlideIn 0.3s ease-out forwards;
}

.message-wrapper {
  display: flex;
  gap: 12px;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar-container {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.ai-avatar {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.name {
  font-weight: 600;
  font-size: 14px;
  color: #f3f4f6;
}

.time {
  font-size: 12px;
  color: #9ca3af;
}

.text {
  background: #2d3748;
  padding: 12px 16px;
  border-radius: 10px;
  color: #f3f4f6;
  line-height: 1.6;
  font-size: 14px;
  word-break: break-word;
  border: 1px solid #374151;
}

.message.user .text {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border-color: #2563eb;
}

/* Markdown 内容样式 */
.text :deep(h1),
.text :deep(h2),
.text :deep(h3),
.text :deep(h4),
.text :deep(h5),
.text :deep(h6) {
  margin: 16px 0 8px 0;
  font-weight: 600;
  line-height: 1.4;
  color: #f3f4f6;
}

.text :deep(h1) { font-size: 24px; border-bottom: 2px solid #374151; padding-bottom: 8px; }
.text :deep(h2) { font-size: 20px; border-bottom: 1px solid #374151; padding-bottom: 6px; }
.text :deep(h3) { font-size: 18px; }
.text :deep(h4) { font-size: 16px; }
.text :deep(h5) { font-size: 14px; }
.text :deep(h6) { font-size: 13px; color: #9ca3af; }

.text :deep(p) {
  margin: 8px 0;
  line-height: 1.6;
}

.text :deep(ul),
.text :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.text :deep(ul) {
  list-style-type: disc;
}

.text :deep(ol) {
  list-style-type: decimal;
}

.text :deep(li) {
  margin-bottom: 4px;
  line-height: 1.6;
}

.text :deep(ul li) {
  list-style-type: disc;
}

.text :deep(ol li) {
  list-style-type: decimal;
}

.text :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 4px solid #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: #e5e7eb;
}

.text :deep(code) {
  background: #111827;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
  font-size: 13px;
  color: #93c5fd;
  border: 1px solid #374151;
}

.text :deep(pre) {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 0;
  margin: 12px 0;
  overflow-x: auto;
  position: relative;
}

.text :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #1f2937;
  border-bottom: 1px solid #374151;
  border-radius: 8px 8px 0 0;
}

.text :deep(.code-lang) {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.text :deep(.code-copy-btn) {
  background: transparent;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #9ca3af;
  padding: 4px 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.text :deep(.code-copy-btn:hover) {
  color: #3b82f6;
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.text :deep(pre code) {
  background: transparent;
  padding: 16px;
  border: none;
  font-size: 13px;
  line-height: 1.5;
  color: #e5e7eb;
  white-space: pre;
  display: block;
  overflow-x: auto;
}

.text :deep(pre.language-javascript) { border-left: 4px solid #f7df1e; }
.text :deep(pre.language-python) { border-left: 4px solid #3776ab; }
.text :deep(pre.language-bash) { border-left: 4px solid #4eaa25; }
.text :deep(pre.language-json) { border-left: 4px solid #ff6b6b; }
.text :deep(pre.language-yaml) { border-left: 4px solid #cb171e; }
.text :deep(pre.language-sql) { border-left: 4px solid #336791; }

/* 代码高亮样式 */
.text :deep(.code-keyword) {
  color: #c792ea;
  font-weight: 600;
}

.text :deep(.code-string) {
  color: #a5d6ff;
}

.text :deep(.code-comment) {
  color: #636f88;
  font-style: italic;
}

.text :deep(.code-number) {
  color: #fd9170;
}

.text :deep(.code-operator) {
  color: #89ddff;
}

.text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  border: 1px solid #374151;
  border-radius: 6px;
  overflow: hidden;
}

.text :deep(th),
.text :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #374151;
}

.text :deep(th) {
  background: #374151;
  font-weight: 600;
  color: #f3f4f6;
}

.text :deep(td) {
  background: #2d3748;
}

.text :deep(tr:last-child td) {
  border-bottom: none;
}

.text :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #374151, transparent);
  margin: 16px 0;
}

.text :deep(a) {
  color: #60a5fa;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.text :deep(a:hover) {
  color: #93c5fd;
  border-bottom-color: #60a5fa;
}

.text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}

.text :deep(strong) {
  font-weight: 600;
  color: #f9fafb;
}

.text :deep(em) {
  font-style: italic;
  color: #e5e7eb;
}

.text :deep(del) {
  text-decoration: line-through;
  color: #9ca3af;
}

.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.message-action-btn {
  border: none;
  background: transparent;
  color: #9ca3af;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.message-action-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.message-action-btn .liked {
  color: #3b82f6;
}


.typing-content {
  background: linear-gradient(135deg, #2d3748, #1a202c);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  gap: 16px;
  animation: pulse-subtle 2s infinite;
}

.typing-animation {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-animation span {
  height: 6px;
  width: 6px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 50%;
  display: block;
  animation: typing 1.4s infinite ease-in-out;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.typing-animation span:nth-child(1) {
  animation-delay: 0s;
}

.typing-animation span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-animation span:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.typing-text {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}

.typing-details {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.mode-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.mode-badge.mcp {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.session-info {
  color: #9ca3af;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  opacity: 0.8;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8) translateY(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.3) translateY(-2px);
    opacity: 1;
  }
}

@keyframes pulse-subtle {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }
  50% {
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
  }
}

/* 消息来源样式 */
.message-sources {
  margin-top: 12px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #60a5fa;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-item {
  background: rgba(59, 130, 246, 0.05);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.15);
}

.source-title {
  font-weight: 500;
  color: #e5e7eb;
  font-size: 13px;
  margin-bottom: 2px;
}

.source-preview {
  font-size: 12px;
  color: #d1d5db;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 8px;
  border-radius: 4px;
  line-height: 1.4;
  font-style: italic;
  margin-bottom: 4px;
}

.source-score {
  font-size: 11px;
  color: #10b981;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  display: inline-block;
}

/* 后续问题推荐样式 */
.follow-up-questions {
  margin-top: 12px;
  padding: 12px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.follow-up-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #34d399;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

.follow-up-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.follow-up-question {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1.4;
}

.follow-up-question:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
  transform: translateY(-1px);
}

.follow-up-question:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 快捷操作 */
.quick-actions {
  padding: 12px 16px;
  border-bottom: 1px solid #374151;
  background: #2d3748;
}

.quick-action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.quick-action-btn {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.quick-action-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

/* 输入区域 */
.chat-input {
  padding: 16px;
  background: #2d3748;
  border-top: 1px solid #374151;
}

.input-wrapper {
  background: #374151;
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid #4a5568;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: #3b82f6;
  background: #2d3748;
}

.message-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f3f4f6;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  min-height: 20px;
  max-height: 80px;
  font-family: inherit;
}

.message-input::placeholder {
  color: #9ca3af;
}

.input-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 高级选项按钮 */
.advanced-options-btn {
  background: transparent;
  border: 1px solid #4a5568;
  color: #9ca3af;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.advanced-options-btn:hover,
.advanced-options-btn.active {
  color: #3b82f6;
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

/* 高级选项面板 */
.advanced-options {
  background: #374151;
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  font-size: 14px;
}

.option-item {
  margin-bottom: 8px;
}

.option-item:last-child {
  margin-bottom: 0;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d1d5db;
  cursor: pointer;
}

.option-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.option-select {
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #f3f4f6;
  padding: 4px 8px;
  font-size: 12px;
  margin-left: auto;
}

.send-button {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

/* 刷新按钮动画 */
.refresh-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 输入提示 */
.input-hints {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding: 0 4px;
}

.hint-item {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.shortcut-key {
  background: #374151;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #d1d5db;
  font-size: 11px;
  font-weight: 600;
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nw-resize;
  background: linear-gradient(-45deg, transparent 30%, #4a5568 30%, #4a5568 40%, transparent 40%, transparent 60%, #4a5568 60%, #4a5568 70%, transparent 70%);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .ai-float-window {
    width: calc(100vw - 20px) !important;
    height: calc(100vh - 20px) !important;
    left: 10px !important;
    top: 10px !important;
  }

  .assistant-float-button {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
  }

  .header-actions {
    gap: 4px;
  }

  .action-button {
    width: 28px;
    height: 28px;
  }

  .status-left {
    gap: 8px;
  }

  .mode-button {
    padding: 3px 6px;
    font-size: 10px;
  }
}
</style>
