<template>
  <div class="session-container">
    <div class="session-header">
      <div class="header-content">
        <h1 class="page-title">
          <MessageOutlined class="title-icon" />
          会话管理
        </h1>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="clearAllHistory" :disabled="sessionHistory.length === 0">
          <template #icon><DeleteOutlined /></template>
          清空历史
        </a-button>
      </div>
    </div>

    <div class="session-content">
      <!-- 会话搜索 -->
      <a-card title="会话搜索" class="search-card">
        <div class="search-area">
          <a-input-group compact>
            <a-input
              v-model:value="searchSessionId"
              placeholder="请输入会话ID进行搜索"
              style="width: calc(100% - 100px)"
              @pressEnter="searchSession"
            />
            <a-button type="primary" @click="searchSession" :loading="searching">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
          </a-input-group>
        </div>
      </a-card>

      <!-- 会话详情 -->
      <a-card v-if="currentSession.session_id" title="会话详情" class="session-detail-card">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="会话ID">
            <a-typography-text copyable>{{ currentSession.session_id }}</a-typography-text>
          </a-descriptions-item>
          <a-descriptions-item label="会话状态">
            <a-tag :color="getStatusColor(currentSession.status)">
              {{ getStatusText(currentSession.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ currentSession.created_time ? formatTime(currentSession.created_time) : '未知' }}
          </a-descriptions-item>
          <a-descriptions-item label="最后活动">
            {{ currentSession.last_activity ? formatTime(currentSession.last_activity) : '未知' }}
          </a-descriptions-item>
          <a-descriptions-item label="消息数量">
            <a-badge :count="currentSession.message_count || 0" :number-style="{ backgroundColor: '#52c41a' }" />
          </a-descriptions-item>
          <a-descriptions-item label="运行模式">
            <a-tag :color="getModeColor(currentSession.mode)">
              {{ getModeText(currentSession.mode) }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <div class="session-actions">
          <a-space>
            <a-button @click="refreshSession" :loading="searching">
              <template #icon><ReloadOutlined /></template>
              刷新会话
            </a-button>
            <a-button @click="addToHistory" type="dashed">
              <template #icon><PlusOutlined /></template>
              添加到历史
            </a-button>
            <a-button @click="exportSession" type="default">
              <template #icon><DownloadOutlined /></template>
              导出会话
            </a-button>
          </a-space>
        </div>
      </a-card>

      <!-- 会话历史 -->
      <a-card title="会话历史" class="history-card">
        <div v-if="sessionHistory.length === 0" class="empty-history">
          <a-empty description="暂无会话历史记录">
            <template #image>
              <HistoryOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
          </a-empty>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="(session, index) in sessionHistory" 
            :key="session.session_id"
            class="history-item"
            @click="loadHistorySession(session)"
          >
            <div class="history-content">
              <div class="history-header">
                <div class="session-info">
                  <span class="session-id">{{ session.session_id.slice(0, 8) }}...</span>
                  <a-tag :color="getStatusColor(session.status)" size="small">
                    {{ getStatusText(session.status) }}
                  </a-tag>
                  <a-tag :color="getModeColor(session.mode)" size="small">
                    {{ getModeText(session.mode) }}
                  </a-tag>
                </div>
                <div class="history-actions">
                  <a-button 
                    type="text" 
                    size="small" 
                    @click.stop="removeFromHistory(index)"
                    danger
                  >
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </div>
              </div>
              <div class="history-meta">
                <div class="meta-item">
                  <ClockCircleOutlined />
                  <span>{{ formatTime(session.last_activity) }}</span>
                </div>
                <div class="meta-item">
                  <MessageOutlined />
                  <span>{{ session.message_count }} 条消息</span>
                </div>
                <div class="meta-item">
                  <CalendarOutlined />
                  <span>{{ formatTime(session.created_time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-card>

      <!-- 快速操作 -->
      <a-card title="快速操作" class="quick-actions-card">
        <a-row :gutter="16">
          <a-col :span="8">
            <div class="quick-action-item">
              <div class="action-icon">
                <PlusCircleOutlined />
              </div>
              <div class="action-content">
                <div class="action-title">创建新会话</div>
                <div class="action-desc">开始新的对话会话</div>
                <a-button type="primary" @click="createNewSession" size="small">
                  立即创建
                </a-button>
              </div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="quick-action-item">
              <div class="action-icon">
                <FileTextOutlined />
              </div>
              <div class="action-content">
                <div class="action-title">批量导出</div>
                <div class="action-desc">导出所有历史会话</div>
                <a-button 
                  type="default" 
                  @click="exportAllSessions" 
                  size="small"
                  :disabled="sessionHistory.length === 0"
                >
                  导出全部
                </a-button>
              </div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="quick-action-item">
              <div class="action-icon">
                <BarChartOutlined />
              </div>
              <div class="action-content">
                <div class="action-title">统计分析</div>
                <div class="action-desc">查看会话使用统计</div>
                <a-button type="default" @click="showStatistics" size="small">
                  查看统计
                </a-button>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-card>

      <!-- 统计信息 -->
      <a-card v-if="showStats" title="会话统计" class="statistics-card">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-statistic
              title="总会话数"
              :value="sessionStats.totalSessions"
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix><MessageOutlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="总消息数"
              :value="sessionStats.totalMessages"
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix><CommentOutlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="RAG模式会话"
              :value="sessionStats.ragSessions"
              :value-style="{ color: '#fa8c16' }"
            >
              <template #prefix><DatabaseOutlined /></template>
            </a-statistic>
          </a-col>
          <a-col :span="6">
            <a-statistic
              title="MCP模式会话"
              :value="sessionStats.mcpSessions"
              :value-style="{ color: '#722ed1' }"
            >
              <template #prefix><ApiOutlined /></template>
            </a-statistic>
          </a-col>
        </a-row>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { useRouter } from 'vue-router';
import {
  SearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  CalendarOutlined,
  PlusCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
  CommentOutlined,
  DatabaseOutlined,
  ApiOutlined
} from '@ant-design/icons-vue';
import { 
  getSessionInfo,
  type SessionInfoResponse
} from '#/api/core/assistant';

// 响应式数据
const router = useRouter();
const searching = ref(false);
const searchSessionId = ref('');
const showStats = ref(false);

// 当前会话信息
const currentSession = reactive<Partial<SessionInfoResponse>>({
  session_id: '',
  created_time: '',
  last_activity: '',
  message_count: 0,
  mode: 1,
  status: ''
});

// 会话历史记录 (本地存储)
const sessionHistory = ref<SessionInfoResponse[]>([]);

// 会话统计
const sessionStats = computed(() => {
  const total = sessionHistory.value.length;
  const totalMessages = sessionHistory.value.reduce((sum, session) => sum + (session.message_count || 0), 0);
  const ragSessions = sessionHistory.value.filter(session => session.mode === 1).length;
  const mcpSessions = sessionHistory.value.filter(session => session.mode === 2).length;
  
  return {
    totalSessions: total,
    totalMessages,
    ragSessions,
    mcpSessions
  };
});

// 获取状态颜色
const getStatusColor = (status?: string) => {
  const colorMap: Record<string, string> = {
    'active': 'green',
    'inactive': 'orange',
    'ended': 'red',
    'error': 'red'
  };
  return colorMap[status || ''] || 'default';
};

// 获取状态文本
const getStatusText = (status?: string) => {
  const textMap: Record<string, string> = {
    'active': '活跃',
    'inactive': '不活跃',
    'ended': '已结束',
    'error': '错误'
  };
  return textMap[status || ''] || '未知';
};

// 获取模式颜色
const getModeColor = (mode?: number) => {
  return mode === 1 ? 'blue' : mode === 2 ? 'purple' : 'default';
};

// 获取模式文本
const getModeText = (mode?: number) => {
  return mode === 1 ? 'RAG模式' : mode === 2 ? 'MCP模式' : '未知模式';
};

// 格式化时间
const formatTime = (timestamp?: string) => {
  if (!timestamp) return '未知';
  return new Date(timestamp).toLocaleString();
};

// 搜索会话
const searchSession = async () => {
  if (!searchSessionId.value.trim()) {
    message.warning('请输入会话ID');
    return;
  }

  try {
    searching.value = true;
    const response = await getSessionInfo(searchSessionId.value.trim());
    const data = response as SessionInfoResponse;
    
    // 更新当前会话信息
    Object.assign(currentSession, data);
    
    message.success('会话信息获取成功');
  } catch (error: any) {
    message.error(`获取会话信息失败: ${error.message}`);
    console.error('获取会话信息失败:', error);
  } finally {
    searching.value = false;
  }
};

// 刷新当前会话
const refreshSession = async () => {
  if (!currentSession.session_id) {
    message.warning('请先搜索一个会话');
    return;
  }
  
  searchSessionId.value = currentSession.session_id;
  await searchSession();
};

// 添加到历史记录
const addToHistory = () => {
  if (!currentSession.session_id) {
    message.warning('没有当前会话信息');
    return;
  }
  
  // 检查是否已存在
  const exists = sessionHistory.value.find(session => session.session_id === currentSession.session_id);
  if (exists) {
    message.warning('该会话已在历史记录中');
    return;
  }
  
  // 添加到历史记录
  sessionHistory.value.unshift({ ...currentSession } as SessionInfoResponse);
  saveHistoryToStorage();
  message.success('已添加到历史记录');
};

// 从历史记录中移除
const removeFromHistory = (index: number) => {
  sessionHistory.value.splice(index, 1);
  saveHistoryToStorage();
  message.success('已从历史记录中移除');
};

// 清空所有历史记录
const clearAllHistory = () => {
  sessionHistory.value = [];
  saveHistoryToStorage();
  message.success('历史记录已清空');
};

// 加载历史会话
const loadHistorySession = (session: SessionInfoResponse) => {
  Object.assign(currentSession, session);
  searchSessionId.value = session.session_id;
  message.success('历史会话已加载');
};

// 导出当前会话
const exportSession = () => {
  if (!currentSession.session_id) {
    message.warning('没有当前会话信息');
    return;
  }
  
  const blob = new Blob([JSON.stringify(currentSession, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-${currentSession.session_id}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  message.success('会话导出成功');
};

// 导出所有会话
const exportAllSessions = () => {
  if (sessionHistory.value.length === 0) {
    message.warning('没有会话历史记录');
    return;
  }
  
  const exportData = {
    timestamp: new Date().toISOString(),
    sessions: sessionHistory.value,
    statistics: sessionStats.value
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-sessions-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  message.success('所有会话导出成功');
};

// 创建新会话
const createNewSession = () => {
  router.push('/assistant/query');
};

// 显示统计信息
const showStatistics = () => {
  showStats.value = !showStats.value;
};

// 保存历史记录到本地存储
const saveHistoryToStorage = () => {
  localStorage.setItem('assistant-session-history', JSON.stringify(sessionHistory.value));
};

// 从本地存储加载历史记录
const loadHistoryFromStorage = () => {
  try {
    const stored = localStorage.getItem('assistant-session-history');
    if (stored) {
      sessionHistory.value = JSON.parse(stored);
    }
  } catch (error) {
    console.error('加载历史记录失败:', error);
  }
};

// 页面初始化
onMounted(() => {
  loadHistoryFromStorage();
});
</script>

<style scoped>
.session-container {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ant-border-color, #d9d9d9);

  .header-content {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      background: linear-gradient(90deg, #1890ff, #52c41a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }
}

.title-icon {
  font-size: 28px;
  color: #1890ff;
}

.session-content {
  .search-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .search-area {
      max-width: 600px;
    }
  }

  .session-detail-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .session-actions {
      margin-top: 24px;
      text-align: right;
    }
  }

  .history-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .empty-history {
      text-align: center;
      padding: 60px 0;
    }

    .history-list {
      .history-item {
        margin-bottom: 16px;
        padding: 16px;
        border: 1px solid var(--ant-border-color-split);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        &:last-child {
          margin-bottom: 0;
        }

        .history-content {
          .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;

            .session-info {
              display: flex;
              align-items: center;
              gap: 12px;

              .session-id {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-weight: 600;
                color: #1890ff;
                font-size: 14px;
              }
            }
          }

          .history-meta {
            display: flex;
            gap: 24px;
            color: var(--ant-text-color-secondary);
            font-size: 12px;

            .meta-item {
              display: flex;
              align-items: center;
              gap: 6px;
              font-weight: 500;

              .anticon {
                font-size: 14px;
                color: #1890ff;
              }
            }
          }
        }
      }
    }
  }

  .quick-actions-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .quick-action-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      border: 1px solid var(--ant-border-color-split);
      border-radius: 8px;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      .action-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1890ff, #36cfc9);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }

      .action-content {
        flex: 1;

        .action-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--ant-text-color);
          margin-bottom: 8px;
        }

        .action-desc {
          font-size: 14px;
          color: var(--ant-text-color-secondary);
          margin-bottom: 12px;
          line-height: 1.4;
        }
      }
    }
  }

  .statistics-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }
}

@media (max-width: 768px) {
  .session-container {
    padding: 16px;
  }
  
  .session-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }

  .search-area {
    max-width: none;
  }

  .history-meta {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;

    .meta-item {
      gap: 8px;
    }
  }

  .quick-action-item {
    flex-direction: column;
    text-align: center;
    gap: 12px;

    .action-content {
      .action-title {
        font-size: 14px;
      }

      .action-desc {
        font-size: 12px;
      }
    }
  }
}
</style>
