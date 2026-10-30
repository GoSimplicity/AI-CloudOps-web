<template>
  <OpsPage title="智能问答" description="明确发送问题后调用模型；会话按当前账户隔离" class="query-container">
    <!-- 页面头部 -->
    <template #actions>
<a-space wrap>
            <a-button @click="clearSession" type="default">
              <Icon icon="lucide:trash-2" size="16" class="muted-icon" />
              清空会话
            </a-button>
            <a-button @click="exportSession" type="default">
              <Icon icon="lucide:download" size="16" class="muted-icon" />
              导出会话
            </a-button>
            <a-button @click="goToSessionManage" type="primary">
              <Icon icon="lucide:users" size="16"  />
              会话管理
            </a-button>
          </a-space>
    </template>

    <!-- 主要内容区域 -->
    <div class="page-content">
      <a-row :gutter="[16, 16]">
        <!-- 聊天区域 -->
        <a-col :xs="24" :xl="18">
          <div class="content-card">
            <div class="card-header">
              <div class="header-title">
                <Icon icon="lucide:message-circle" size="18" class="accent-icon" />
                对话
              </div>
            </div>

            <div class="card-content">
              <!-- 聊天历史 -->
              <div class="chat-history" ref="chatHistoryRef">
                <div v-if="chatHistory.length === 0" class="empty-state">
                  <Icon icon="lucide:message-circle" size="48" class="muted-icon" />
                  <p>开始您的第一次对话吧！</p>
                </div>

                <div v-for="(message, index) in chatHistory" :key="index" class="message-item">
                  <!-- 用户消息 -->
                  <div v-if="message.role === 'user'" class="user-message">
                    <div class="message-content">
                      <div class="message-text">{{ message.content }}</div>
                      <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                    </div>
                    <a-avatar class="message-avatar" style="background-color: var(--ops-accent);">
                      <Icon icon="lucide:user" size="16" />
                    </a-avatar>
                  </div>

                  <!-- 助手消息 -->
                  <div v-else class="assistant-message">
                    <a-avatar class="message-avatar" style="background-color: var(--ops-accent);">
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
                          <Icon icon="lucide:file-text" size="14" class="muted-icon" />
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
                          <Icon icon="lucide:lightbulb" size="14" class="muted-icon" />
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
                  <a-avatar class="message-avatar" style="background-color: var(--ops-accent);">
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
                <a-alert v-if="sessionNotice && !pendingTurn" type="warning" show-icon :message="sessionNotice">
                  <template #action><a-button size="small" :loading="isLoading" @click="restoreSession">重新查询</a-button></template>
                </a-alert>
                <a-alert v-if="pendingTurn" type="warning" show-icon message="本次回复尚未确认，请先查询并恢复已完成的回复，或清空会话。">
                  <template #description>待核对问题：{{ pendingTurn.question }}</template>
                  <template #action><a-button size="small" :loading="isLoading" @click="recoverTurn">查询并恢复</a-button></template>
                </a-alert>
                <a-input-search v-model:value="questionInput" placeholder="请输入您的问题..." enter-button="发送" size="large"
                  :loading="isLoading" :disabled="isLoading || !!pendingTurn || !!sessionNotice" @search="sendMessage" @keydown.enter.prevent="sendMessage">

                </a-input-search>
              </div>
            </div>
          </div>
        </a-col>

        <!-- 侧边栏 -->
        <a-col :xs="24" :xl="6">
          <!-- 会话信息 -->
          <div class="content-card sidebar-card">
            <div class="card-header">
              <div class="header-title">
                <Icon icon="lucide:info" size="18" class="accent-icon" />
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
                <a-select v-model:value="assistantMode" class="form-control" :disabled="isLoading || !!pendingTurn" @change="onModeChange">
                  <a-select-option :value="1">RAG模式</a-select-option>
                  <a-select-option :value="2">MCP模式</a-select-option>
                </a-select>
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
                <Icon icon="lucide:zap" size="18" class="accent-icon" />
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
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { ref, nextTick, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { Icon } from '@iconify/vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAccessStore, useUserStore } from '@vben/stores';
import { assistantOwner, createAssistantAccountScope } from '#/utils/assistant-account-scope';
import { assistantQuery, createAssistantSession, getSessionInfo } from '#/api/core/aiops/assistant';
import type { AssistantRequest, AssistantResponse, SessionInfoResponse } from '#/api/core/aiops/assistant';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

// 路由
const router = useRouter();
const accessStore = useAccessStore();
const userStore = useUserStore();
const accountScope = createAssistantAccountScope(localStorage);
let abortController: AbortController | undefined;

// 响应式数据
const questionInput = ref('');
const isLoading = ref(false);
const currentSessionId = ref('');
const assistantMode = ref(1);
const chatHistoryRef = ref<HTMLElement>();
const pendingTurn = ref<null | { question: string; mode: number; turnId: string; sessionId: string }>(null);
const sessionNotice = ref('');

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

// 未确认的请求只能查询状态，已完成后才用同一 turn_id 读取结果。
const appendAnswer = (data: AssistantResponse) => {
  chatHistory.value.push({
    role: 'assistant', content: data.answer, timestamp: new Date().toISOString(),
    sourceDocuments: data.source_documents, followUpQuestions: data.follow_up_questions,
    relevanceScore: data.relevance_score,
  });
  pendingTurn.value = null;
};

const sendMessage = async () => {
  const question = questionInput.value.trim();
  if (!question || isLoading.value || pendingTurn.value || sessionNotice.value || !assistantOwner(userStore.userInfo, accessStore.accessToken)) return;
  if (!globalThis.crypto?.randomUUID) { message.error('当前环境无法安全生成请求 ID'); return; }
  const ticket = accountScope.ticket();
  const turnId = globalThis.crypto.randomUUID();
  const mode = assistantMode.value;
  isLoading.value = true;
  abortController = new AbortController();
  const signal = abortController.signal;
  let sent = false;
  try {
    if (!currentSessionId.value) {
      const session = await createAssistantSession({ signal });
      if (!accountScope.current(ticket)) return;
      if (!session?.session_id) throw new Error('会话创建失败');
      currentSessionId.value = session.session_id;
      accountScope.write('query-session', { sessionId: session.session_id });
    }
    const sessionId = currentSessionId.value;
    pendingTurn.value = { question, mode, turnId, sessionId };
    questionInput.value = '';
    chatHistory.value.push({ role: 'user', content: question, timestamp: new Date().toISOString() });
    await nextTick();
    if (!accountScope.current(ticket)) return;
    scrollToBottom();
    const request: AssistantRequest = { question, mode, session_id: sessionId, turn_id: turnId };
    sent = true;
    const data = await assistantQuery(request, { signal }) as AssistantResponse;
    if (!accountScope.current(ticket)) return;
    if (typeof data?.answer !== 'string' || data.session_id !== sessionId || data.turn_id !== turnId) throw new Error('响应格式无效');
    appendAnswer(data);
    await nextTick();
    scrollToBottom();
  } catch (error: any) {
    if (!accountScope.current(ticket)) return;
    if ([403, 404].includes(error?.response?.status)) {
      chatHistory.value = [];
      currentSessionId.value = '';
      pendingTurn.value = null;
      accountScope.write('query-session', null);
      selectedDocument.value = null;
      documentModalVisible.value = false;
    } else if (!sent) {
      pendingTurn.value = null;
    }
    if (shouldNotifyPageError(error)) message.error(sent ? '请求结果尚未确认，请查询会话状态' : '会话创建失败，请重试');
  } finally {
    if (accountScope.current(ticket)) { isLoading.value = false; abortController = undefined; }
  }
};

const recoverTurn = async () => {
  const pending = pendingTurn.value;
  if (!pending || isLoading.value || !assistantOwner(userStore.userInfo, accessStore.accessToken)) return;
  const ticket = accountScope.ticket();
  isLoading.value = true;
  abortController = new AbortController();
  try {
    const info = await getSessionInfo(pending.sessionId) as SessionInfoResponse;
    if (!accountScope.current(ticket)) return;
    if (info.status !== 'idle' || info.last_turn_id !== pending.turnId) {
      message.warning('该请求尚未确认完成，请稍后查询或新建会话');
      return;
    }
    const data = await assistantQuery({ question: pending.question, mode: pending.mode,
      session_id: pending.sessionId, turn_id: pending.turnId }, { signal: abortController.signal }) as AssistantResponse;
    if (!accountScope.current(ticket)) return;
    if (typeof data?.answer !== 'string' || data.session_id !== pending.sessionId || data.turn_id !== pending.turnId) {
      message.error('恢复结果格式异常，请核对会话'); return;
    }
    appendAnswer(data);
  } catch (error) {
    if (accountScope.current(ticket) && shouldNotifyPageError(error)) message.error('无法确认会话状态，请稍后重试');
  } finally {
    if (accountScope.current(ticket)) { isLoading.value = false; abortController = undefined; }
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
  accountScope.invalidate();
  abortController?.abort();
  abortController = undefined;
  isLoading.value = false;
  chatHistory.value = [];
  currentSessionId.value = '';
  pendingTurn.value = null;
  sessionNotice.value = '';
  accountScope.write('query-session', null);
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

// 只在本地保存会话 ID，实际历史和未确认状态按当前用户从服务端读取。
const restoreSession = async () => {
  const pointer = accountScope.read<{ sessionId?: unknown }>('query-session');
  if (typeof pointer?.sessionId !== 'string' || !pointer.sessionId) return;
  const ticket = accountScope.ticket();
  isLoading.value = true;
  try {
    const info = await getSessionInfo(pointer.sessionId) as SessionInfoResponse;
    if (!accountScope.current(ticket)) return;
    if (info.session_id !== pointer.sessionId || !['idle', 'running', 'unknown'].includes(info.status) || (info.mode !== 1 && info.mode !== 2)) throw new Error('invalid session');
    if (info.conversation_history != null && (!Array.isArray(info.conversation_history) || info.conversation_history.length > 25 || info.conversation_history.some((entry) => typeof entry?.q !== 'string' || typeof entry?.a !== 'string'))) throw new Error('invalid history');
    currentSessionId.value = info.session_id;
    assistantMode.value = info.mode;
    sessionNotice.value = '';
    chatHistory.value = (info.conversation_history ?? []).flatMap((entry) => [
      { role: 'user' as const, content: entry.q, timestamp: info.last_activity },
      { role: 'assistant' as const, content: entry.a, timestamp: info.last_activity },
    ]);
    if (info.status !== 'idle') {
      if (info.active_turn_id && info.active_question && (info.active_mode === 1 || info.active_mode === 2)) {
        pendingTurn.value = { question: info.active_question, mode: info.active_mode, turnId: info.active_turn_id, sessionId: info.session_id };
      } else {
        sessionNotice.value = '会话有未确认的请求，请清空会话后继续';
      }
    }
  } catch (error: any) {
    if (accountScope.current(ticket)) {
      if ([403, 404].includes(error?.response?.status)) {
        accountScope.write('query-session', null);
        currentSessionId.value = '';
        sessionNotice.value = '';
        message.warning('会话不可访问或已过期，请新建会话');
      } else {
        currentSessionId.value = pointer.sessionId;
        sessionNotice.value = '无法读取会话状态，请重新查询或清空会话';
      }
    }
  } finally {
    if (accountScope.current(ticket)) isLoading.value = false;
  }
};

watch(() => assistantOwner(userStore.userInfo, accessStore.accessToken), (owner) => {
  accountScope.setOwner(owner);
  abortController?.abort();
  abortController = undefined;
  isLoading.value = false;
  questionInput.value = '';
  currentSessionId.value = '';
  pendingTurn.value = null;
  sessionNotice.value = '';
  chatHistory.value = [];
  selectedDocument.value = null;
  documentModalVisible.value = false;
  if (owner) void restoreSession();
}, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { accountScope.invalidate(); abortController?.abort(); });
</script>

<style scoped>

/* 页面头部 */








/* 内容区域 */
.page-content {
  .content-card {
    background: var(--bg-color-white, var(--ops-surface));
    border-radius: var(--ops-radius);
    box-shadow: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: min(720px, 75dvh);
    min-height: 420px;
    border: 1px solid var(--ops-border);
  }

  .sidebar-card {
    height: auto;
    min-height: 0;
    margin-bottom: var(--ops-space-lg);

    &:last-child {
      margin-bottom: 0;
    }
  }

  .card-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color, var(--ops-border));
    background: var(--bg-color-light, var(--ops-ground));
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-color-primary, var(--ops-ink));
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
      color: var(--ops-muted);

      p {
        margin: 16px 0 0 0;
        font-size: 14px;
      }
    }

    .message-item {
      margin-bottom: var(--ops-space-lg);

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
          color: hsl(var(--primary-foreground));
          padding: 12px 16px;
          border-radius: var(--ops-radius);
          border-bottom-right-radius: 4px;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.5;
        }

        .message-time {
          text-align: right;
          font-size: 12px;
          color: var(--ops-muted);
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
          background: var(--bg-color-light, var(--ops-ground));
          color: var(--text-color-primary, var(--ops-ink));
          padding: 12px 16px;
          border-radius: var(--ops-radius);
          border-bottom-left-radius: 4px;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid var(--border-color, var(--ops-border));

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
            background: var(--ops-ground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
          }

          :deep(pre) {
            background: var(--ops-ground);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
          }
        }

        .message-time {
          font-size: 12px;
          color: var(--ops-muted);
          margin-top: 4px;
        }

        .source-documents {
          .source-title {
            font-size: 12px;
            color: var(--text-color-secondary, var(--ops-muted));
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
            transition: border-color var(--ops-duration) ease-out;

            &:hover {
            }
          }
        }

        .follow-up-questions {
          .follow-up-title {
            font-size: 12px;
            color: var(--text-color-secondary, var(--ops-muted));
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
        color: var(--text-color-secondary, var(--ops-muted));
        font-size: 14px;
      }
    }
  }

  .chat-input {
    padding: 16px 24px;
    background: var(--bg-color-light, var(--ops-ground));
    border-top: 1px solid var(--border-color, var(--ops-border));
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
  color: var(--text-color-secondary, var(--ops-muted));
  margin-bottom: 4px;
}

.form-value {
  font-size: 13px;
  color: var(--text-color-primary, var(--ops-ink));
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
  transition: border-color var(--ops-duration) ease-out;

  &:hover {
    box-shadow: none;
  }
}

/* 文档详情弹窗 */
.document-content {
  max-height: 400px;
  overflow-y: auto;

  h4 {
    margin: 0 0 12px 0;
    color: var(--text-color-primary, var(--ops-ink));
    font-weight: 600;
  }

  :deep(p) {
    line-height: 1.6;
    margin: 8px 0;
  }

  :deep(code) {
    background: var(--ops-ground);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
}

/* 滚动条样式 */
.chat-history::-webkit-scrollbar {
  width: 6px;
}

.chat-history::-webkit-scrollbar-track {
  background: var(--bg-color-light, var(--ops-ground));
  border-radius: 3px;
}

.chat-history::-webkit-scrollbar-thumb {
  background: var(--border-color-dark, var(--ops-border));
  border-radius: 3px;
}

.chat-history::-webkit-scrollbar-thumb:hover {
  background: var(--ops-muted);
}
.accent-icon { color: var(--ops-accent); }
.muted-icon { color: var(--ops-muted); }
.session-error { margin-bottom: var(--ops-space-lg); }
@media (max-width: 575px) {
  .page-content .chat-history, .page-content .chat-input, .sidebar-card .card-content { padding: var(--ops-space-md); }
  .message-content { min-width: 0; overflow-wrap: anywhere; }
  .session-actions :deep(.ant-space) { flex-wrap: wrap; }
}
</style>
