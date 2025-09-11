<template>
  <div class="query-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="lucide:message-square" size="48" color="#1890ff" />
          </div>
          <div class="header-text">
            <h1 class="page-title">智能问答</h1>
            <p class="page-subtitle">基于RAG和MCP的智能对话助手</p>
          </div>
        </div>
        <div class="header-actions">
          <a-space>
            <a-button @click="clearSession" type="default">
              <Icon icon="lucide:trash-2" size="16" color="#8c8c8c" />
              清空会话
            </a-button>
            <a-button @click="exportSession" type="default">
              <Icon icon="lucide:download" size="16" color="#8c8c8c" />
              导出会话
            </a-button>
            <a-button @click="goToSessionManage" type="primary">
              <Icon icon="lucide:users" size="16" color="#ffffff" />
              会话管理
            </a-button>
          </a-space>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="page-content">
      <a-row :gutter="24">
        <!-- 聊天区域 -->
        <a-col :span="18">
          <div class="content-card">
            <div class="card-header">
              <div class="header-title">
                <Icon icon="lucide:message-circle" size="18" color="#1890ff" />
                对话
              </div>
            </div>

            <div class="card-content">
              <!-- 聊天历史 -->
              <div class="chat-history" ref="chatHistoryRef">
                <div v-if="chatHistory.length === 0" class="empty-state">
                  <Icon icon="lucide:message-circle" size="48" color="#bfbfbf" />
                  <p>开始您的第一次对话吧！</p>
                </div>

                <div v-for="(message, index) in chatHistory" :key="index" class="message-item">
                  <!-- 用户消息 -->
                  <div v-if="message.role === 'user'" class="user-message">
                    <div class="message-content">
                      <div class="message-text">{{ message.content }}</div>
                      <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                    </div>
                    <a-avatar class="message-avatar" style="background-color: #1890ff;">
                      <Icon icon="lucide:user" size="16" />
                    </a-avatar>
                  </div>

                  <!-- 助手消息 -->
                  <div v-else class="assistant-message">
                    <a-avatar class="message-avatar" style="background-color: #52c41a;">
                      <Icon icon="lucide:bot" size="16" />
                    </a-avatar>
                    <div class="message-content">
                      <div class="message-text" v-html="formatMarkdown(message.content)"></div>
                      <div class="message-time">{{ formatTime(message.timestamp) }}</div>

                      <!-- 来源文档 -->
                      <div v-if="message.sourceDocuments && message.sourceDocuments.length > 0"
                        class="source-documents">
                        <a-divider style="margin: 12px 0 8px 0;" />
                        <div class="source-title">
                          <Icon icon="lucide:file-text" size="14" color="#8c8c8c" />
                          参考文档
                        </div>
                        <div class="source-list">
                          <a-tag v-for="(doc, idx) in message.sourceDocuments.slice(0, 3)" :key="idx" color="blue"
                            class="source-tag" @click="showDocumentDetail(doc)">
                            {{ doc.title || `文档${idx + 1}` }}
                          </a-tag>
                        </div>
                      </div>

                      <!-- 推荐问题 -->
                      <div v-if="message.followUpQuestions && message.followUpQuestions.length > 0"
                        class="follow-up-questions">
                        <a-divider style="margin: 12px 0 8px 0;" />
                        <div class="follow-up-title">
                          <Icon icon="lucide:lightbulb" size="14" color="#8c8c8c" />
                          相关问题
                        </div>
                        <div class="question-list">
                          <a-button v-for="(question, idx) in message.followUpQuestions.slice(0, 3)" :key="idx"
                            type="link" size="small" @click="askFollowUpQuestion(question)" class="follow-up-btn">
                            {{ question }}
                          </a-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 加载中状态 -->
                <div v-if="isLoading" class="loading-message">
                  <a-avatar class="message-avatar" style="background-color: #52c41a;">
                    <Icon icon="lucide:bot" size="16" />
                  </a-avatar>
                  <div class="message-content">
                    <a-spin size="small" />
                    <span class="loading-text">正在思考中...</span>
                  </div>
                </div>
              </div>

              <!-- 输入区域 -->
              <div class="chat-input">
                <a-input-search v-model:value="questionInput" placeholder="请输入您的问题..." enter-button="发送" size="large"
                  :loading="isLoading" :disabled="isLoading" @search="sendMessage" @keydown.enter.prevent="sendMessage">
                  <template #enterButton>
                    <a-button type="primary" :loading="isLoading">
                      <Icon icon="lucide:send" size="16" />
                    </a-button>
                  </template>
                </a-input-search>
              </div>
            </div>
          </div>
        </a-col>

        <!-- 侧边栏 -->
        <a-col :span="6">
          <!-- 会话信息 -->
          <div class="content-card sidebar-card">
            <div class="card-header">
              <div class="header-title">
                <Icon icon="lucide:info" size="18" color="#1890ff" />
                会话信息
              </div>
            </div>

            <div class="card-content">
              <div class="info-item">
                <label class="form-label">会话ID</label>
                <div class="form-value">{{ currentSessionId || '新会话' }}</div>
              </div>

              <div class="info-item">
                <label class="form-label">助手模式</label>
                <a-select v-model:value="assistantMode" class="form-control" @change="onModeChange">
                  <a-select-option :value="1">RAG模式</a-select-option>
                  <a-select-option :value="2">MCP模式</a-select-option>
                </a-select>
              </div>

              <div class="info-item">
                <label class="form-label">网络搜索</label>
                <a-switch v-model:checked="useWebSearch" />
              </div>

              <div class="info-item">
                <label class="form-label">消息数量</label>
                <div class="form-value">{{ chatHistory.length }}</div>
              </div>
            </div>
          </div>

          <!-- 快捷问题 -->
          <div class="content-card sidebar-card">
            <div class="card-header">
              <div class="header-title">
                <Icon icon="lucide:zap" size="18" color="#1890ff" />
                快捷问题
              </div>
            </div>

            <div class="card-content">
              <div class="quick-questions">
                <a-button v-for="(question, index) in quickQuestions" :key="index" type="default" block
                  class="quick-question-btn" @click="askQuickQuestion(question)">
                  {{ question }}
                </a-button>
              </div>
            </div>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 文档详情弹窗 -->
    <a-modal v-model:open="documentModalVisible" title="文档详情" width="800px" :footer="null">
      <div v-if="selectedDocument">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="标题">{{ selectedDocument.title }}</a-descriptions-item>
          <a-descriptions-item label="来源">{{ selectedDocument.source }}</a-descriptions-item>
          <a-descriptions-item label="相关度">
            <a-progress :percent="Math.round((selectedDocument.score || 0) * 100)" size="small" />
          </a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <div class="document-content">
          <h4>内容摘要：</h4>
          <div v-html="formatMarkdown(selectedDocument.content || selectedDocument.page_content)"></div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { Icon } from '@iconify/vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { assistantQuery } from '#/api/core/aiops/assistant';
import type { AssistantRequest, AssistantResponse } from '#/api/core/aiops/assistant';

// 路由
const router = useRouter();

// 响应式数据
const questionInput = ref('');
const isLoading = ref(false);
const currentSessionId = ref('');
const assistantMode = ref(1);
const useWebSearch = ref(false);
const chatHistoryRef = ref<HTMLElement>();

// 聊天历史
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourceDocuments?: any[];
  followUpQuestions?: string[];
  relevanceScore?: number;
}

const chatHistory = ref<ChatMessage[]>([]);

// 弹窗相关
const documentModalVisible = ref(false);
const selectedDocument = ref<any>(null);

// 快捷问题
const quickQuestions = ref([
  '如何使用智能助手？',
  '系统有哪些功能？',
  '如何管理会话？',
  '如何上传文档到知识库？',
  '系统的技术架构是什么？'
]);

// 发送消息
const sendMessage = async () => {
  if (!questionInput.value.trim() || isLoading.value) {
    return;
  }

  const question = questionInput.value.trim();
  questionInput.value = '';

  // 添加用户消息到历史
  const userMessage: ChatMessage = {
    role: 'user',
    content: question,
    timestamp: new Date().toISOString()
  };
  chatHistory.value.push(userMessage);

  // 滚动到底部
  await nextTick();
  scrollToBottom();

  try {
    isLoading.value = true;

    // 构建请求参数
    const request: AssistantRequest = {
      question,
      mode: assistantMode.value,
      use_web_search: useWebSearch.value,
      session_id: currentSessionId.value || undefined,
      chat_history: chatHistory.value.slice(0, -1).map(msg => ({
        [msg.role]: msg.content
      }))
    };

    // 发送请求
    const response = await assistantQuery(request);
    const data = response as AssistantResponse;

    // 更新会话ID
    if (data.session_id) {
      currentSessionId.value = data.session_id;
    }


    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: data.answer,
      timestamp: new Date().toISOString(),
      sourceDocuments: data.source_documents,
      followUpQuestions: data.follow_up_questions,
      relevanceScore: data.relevance_score
    };
    chatHistory.value.push(assistantMessage);

    // 滚动到底部
    await nextTick();
    scrollToBottom();

  } catch (error: any) {
    message.error(`发送失败: ${error.message}`);
    console.error('发送消息失败:', error);
  } finally {
    isLoading.value = false;
  }
};

// 快捷问题
const askQuickQuestion = (question: string) => {
  questionInput.value = question;
  sendMessage();
};

// 追问问题
const askFollowUpQuestion = (question: string) => {
  questionInput.value = question;
  sendMessage();
};

// 模式切换
const onModeChange = () => {
  const modeNames: Record<number, string> = { 1: 'RAG模式', 2: 'MCP模式' };
  message.info(`已切换到${modeNames[assistantMode.value]}`);
};

// 清空会话
const clearSession = () => {
  chatHistory.value = [];
  currentSessionId.value = '';
  message.success('会话已清空');
};

// 导出会话
const exportSession = () => {
  if (chatHistory.value.length === 0) {
    message.warning('没有会话内容可导出');
    return;
  }

  const sessionData = {
    session_id: currentSessionId.value,
    timestamp: new Date().toISOString(),
    mode: assistantMode.value,
    use_web_search: useWebSearch.value,
    messages: chatHistory.value
  };

  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-session-${currentSessionId.value || 'new'}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  message.success('会话导出成功');
};

// 跳转到会话管理
const goToSessionManage = () => {
  router.push('/assistant/session');
};

// 显示文档详情
const showDocumentDetail = (document: any) => {
  selectedDocument.value = document;
  documentModalVisible.value = true;
};

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化Markdown
const formatMarkdown = (content: string) => {
  const html = marked(content);
  return DOMPurify.sanitize(html as string);
};

// 滚动到底部
const scrollToBottom = () => {
  if (chatHistoryRef.value) {
    chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight;
  }
};

// 页面初始化
onMounted(() => {
  // 可以在这里加载历史会话或初始化操作
});
</script>

<style scoped>
.query-container {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

/* 页面头部 */
.query-container .page-header {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.query-container .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.query-container .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.query-container .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.query-container .header-text {
  display: flex;
  flex-direction: column;
}

.query-container .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.query-container .page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 14px;
  margin-top: 4px;
}

.query-container .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 内容区域 */
.page-content {
  .content-card {
    background: var(--bg-color-white, #ffffff);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);
  }

  .sidebar-card {
    height: auto;
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .card-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color, #f0f0f0);
    background: var(--bg-color-light, #fafafa);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-color-primary, #262626);
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-history {
    flex: 1;
    padding: 16px 24px;
    overflow-y: auto;

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: var(--text-color-tertiary, #bfbfbf);

      p {
        margin: 16px 0 0 0;
        font-size: 14px;
      }
    }

    .message-item {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .user-message {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 12px;

      .message-content {
        max-width: 70%;

        .message-text {
          background: var(--primary-color, #1890ff);
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 16px;
          border-bottom-right-radius: 4px;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.5;
        }

        .message-time {
          text-align: right;
          font-size: 12px;
          color: var(--text-color-tertiary, #bfbfbf);
          margin-top: 4px;
        }
      }
    }

    .assistant-message {
      display: flex;
      justify-content: flex-start;
      align-items: flex-start;
      gap: 12px;

      .message-content {
        max-width: 70%;

        .message-text {
          background: var(--bg-color-light, #fafafa);
          color: var(--text-color-primary, #262626);
          padding: 12px 16px;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid var(--border-color, #f0f0f0);

          :deep(h1),
          :deep(h2),
          :deep(h3),
          :deep(h4),
          :deep(h5),
          :deep(h6) {
            margin: 8px 0 4px 0;
            font-weight: 600;
          }

          :deep(p) {
            margin: 8px 0;
            line-height: 1.6;
          }

          :deep(ul),
          :deep(ol) {
            margin: 8px 0;
            padding-left: 20px;
          }

          :deep(code) {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
          }

          :deep(pre) {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
          }
        }

        .message-time {
          font-size: 12px;
          color: var(--text-color-tertiary, #bfbfbf);
          margin-top: 4px;
        }

        .source-documents {
          .source-title {
            font-size: 12px;
            color: var(--text-color-secondary, #8c8c8c);
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 4px;
          }

          .source-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }

          .source-tag {
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              transform: translateY(-1px);
            }
          }
        }

        .follow-up-questions {
          .follow-up-title {
            font-size: 12px;
            color: var(--text-color-secondary, #8c8c8c);
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 4px;
          }

          .question-list {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
          }

          .follow-up-btn {
            padding: 2px 0;
            height: auto;
            font-size: 13px;
            text-align: left;
          }
        }
      }
    }

    .loading-message {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 12px;

      .message-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .loading-text {
        color: var(--text-color-secondary, #8c8c8c);
        font-size: 14px;
      }
    }
  }

  .chat-input {
    padding: 16px 24px;
    background: var(--bg-color-light, #fafafa);
    border-top: 1px solid var(--border-color, #f0f0f0);
  }
}

/* 侧边栏样式 */
.sidebar-card .card-content {
  padding: 16px 24px;
}

.info-item {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-secondary, #8c8c8c);
  margin-bottom: 4px;
}

.form-value {
  font-size: 13px;
  color: var(--text-color-primary, #262626);
  word-break: break-all;
}

.form-control {
  width: 100%;
}

.quick-questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-question-btn {
  height: auto;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  white-space: normal;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

/* 文档详情弹窗 */
.document-content {
  max-height: 400px;
  overflow-y: auto;

  h4 {
    margin: 0 0 12px 0;
    color: var(--text-color-primary, #262626);
    font-weight: 600;
  }

  :deep(p) {
    line-height: 1.6;
    margin: 8px 0;
  }

  :deep(code) {
    background: #f5f5f5;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .page-content {
    :deep(.ant-col:first-child) {
      width: 100% !important;
      flex: 0 0 100% !important;
      max-width: 100% !important;
    }

    :deep(.ant-col:last-child) {
      display: none;
    }
  }
}

/* 滚动条样式 */
.chat-history::-webkit-scrollbar {
  width: 6px;
}

.chat-history::-webkit-scrollbar-track {
  background: var(--bg-color-light, #fafafa);
  border-radius: 3px;
}

.chat-history::-webkit-scrollbar-thumb {
  background: var(--border-color-dark, #d9d9d9);
  border-radius: 3px;
}

.chat-history::-webkit-scrollbar-thumb:hover {
  background: var(--text-color-tertiary, #bfbfbf);
}
</style>
