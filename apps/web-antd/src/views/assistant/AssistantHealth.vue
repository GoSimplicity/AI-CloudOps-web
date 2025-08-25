<template>
  <div class="health-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <HeartOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">健康检查</h1>
            <p class="page-subtitle">智能助手服务健康状态监控</p>
          </div>
        </div>
        <div class="header-actions">
          <a-space>
            <a-button @click="checkHealth" :loading="healthLoading">
              健康检查
            </a-button>
            <a-button @click="checkReady" :loading="readyLoading">
              就绪检查
            </a-button>
            <a-button type="primary" danger @click="clearCache" :loading="cacheLoading">
              清除缓存
            </a-button>
          </a-space>
        </div>
      </div>
    </div>

    <div class="health-content">
      <!-- 状态概览 -->
      <div class="status-overview">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-card class="status-card health-card">
              <div class="status-item">
                <div class="status-icon" :class="getHealthStatusClass(healthInfo.status || '')">
                  <HeartOutlined v-if="healthInfo.status === 'healthy'" />
                  <ExclamationCircleOutlined v-else-if="healthInfo.status === 'degraded'" />
                  <CloseCircleOutlined v-else />
                </div>
                <div class="status-content">
                  <div class="status-title">健康状态</div>
                  <div class="status-value" :class="getHealthStatusClass(healthInfo.status || '')">
                    {{ getHealthStatusText(healthInfo.status || '') }}
                  </div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="status-card ready-card">
              <div class="status-item">
                <div class="status-icon" :class="{ 'ready': readyInfo.ready }">
                  <CheckCircleOutlined v-if="readyInfo.ready" />
                  <CloseCircleOutlined v-else />
                </div>
                <div class="status-content">
                  <div class="status-title">就绪状态</div>
                  <div class="status-value" :class="{ 'ready': readyInfo.ready }">
                    {{ readyInfo.ready ? '就绪' : '未就绪' }}
                  </div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="status-card uptime-card">
              <div class="status-item">
                <div class="status-icon uptime">
                  <ClockCircleOutlined />
                </div>
                <div class="status-content">
                  <div class="status-title">运行时间</div>
                  <div class="status-value uptime">
                    {{ formatUptime(healthInfo.uptime) }}
                  </div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </div>

      <!-- 详细信息 -->
      <a-row :gutter="24">
        <!-- 健康详情 -->
        <a-col :span="12">
          <a-card title="健康详情" class="detail-card" :loading="healthLoading">
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="服务名称">
                <a-tag color="blue">{{ healthInfo.service || '未知' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="服务版本">
                <a-tag color="green">{{ healthInfo.version || '未知' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="检查时间">
                {{ healthInfo.last_check_time ? formatTime(healthInfo.last_check_time) : '暂无数据' }}
              </a-descriptions-item>
              <a-descriptions-item label="运行时长">
                {{ formatUptime(healthInfo.uptime) }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 依赖项状态 -->
            <div v-if="healthInfo.dependencies && Object.keys(healthInfo.dependencies).length > 0"
              class="dependencies-section">
              <a-divider orientation="left">依赖项状态</a-divider>
              <div class="dependencies-list">
                <div v-for="(status, name) in healthInfo.dependencies" :key="name" class="dependency-item">
                  <div class="dependency-name">{{ name }}</div>
                  <div class="dependency-status">
                    <a-tag :color="status ? 'success' : 'error'">
                      <CheckCircleOutlined v-if="status" />
                      <CloseCircleOutlined v-else />
                      {{ status ? '正常' : '异常' }}
                    </a-tag>
                  </div>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>

        <!-- 就绪详情 -->
        <a-col :span="12">
          <a-card title="就绪详情" class="detail-card" :loading="readyLoading">
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="服务名称">
                <a-tag color="blue">{{ readyInfo.service || '未知' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="就绪状态">
                <a-tag :color="readyInfo.ready ? 'success' : 'error'">
                  {{ readyInfo.ready ? '就绪' : '未就绪' }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="检查时间">
                {{ readyInfo.timestamp ? formatTime(readyInfo.timestamp) : '暂无数据' }}
              </a-descriptions-item>
              <a-descriptions-item label="状态消息">
                {{ readyInfo.message || '无消息' }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
      </a-row>

      <!-- 操作区域 -->
      <a-card title="系统操作" class="operation-card">
        <a-row :gutter="16">
          <a-col :span="8">
            <div class="operation-item">
              <div class="operation-icon">
                <ClearOutlined />
              </div>
              <div class="operation-content">
                <div class="operation-title">清除缓存</div>
                <div class="operation-desc">清理系统缓存，提升性能</div>
                <a-button type="primary" danger @click="clearCache" :loading="cacheLoading" size="small">
                  立即清除
                </a-button>
              </div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="operation-item">
              <div class="operation-icon">
                <ReloadOutlined />
              </div>
              <div class="operation-content">
                <div class="operation-title">刷新状态</div>
                <div class="operation-desc">重新检查所有状态信息</div>
                <a-button type="primary" @click="refreshAllStatus" :loading="refreshing" size="small">
                  立即刷新
                </a-button>
              </div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="operation-item">
              <div class="operation-icon">
                <DownloadOutlined />
              </div>
              <div class="operation-content">
                <div class="operation-title">导出报告</div>
                <div class="operation-desc">导出健康检查报告</div>
                <a-button type="default" @click="exportReport" size="small">
                  导出报告
                </a-button>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-card>

      <!-- 缓存操作结果 -->
      <a-card v-if="cacheInfo.cleared !== undefined" title="缓存操作结果" class="cache-result-card">
        <a-result :status="cacheInfo.cleared ? 'success' : 'error'" :title="cacheInfo.cleared ? '缓存清理成功' : '缓存清理失败'"
          :sub-title="cacheInfo.message">
          <template #extra>
            <a-descriptions :column="2" size="small">
              <a-descriptions-item label="清理时间">
                {{ cacheInfo.timestamp ? formatTime(cacheInfo.timestamp) : '未知' }}
              </a-descriptions-item>
              <a-descriptions-item label="清理项数">
                {{ cacheInfo.cache_keys_cleared || 0 }}
              </a-descriptions-item>
            </a-descriptions>
          </template>
        </a-result>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  HeartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue';
import {
  assistantHealth,
  assistantReady,
  clearAssistantCache,
  type ServiceHealthResponse,
  type ServiceReadyResponse,
  type ClearCacheResponse
} from '#/api/core/assistant';

// 响应式数据
const healthLoading = ref(false);
const readyLoading = ref(false);
const cacheLoading = ref(false);
const refreshing = ref(false);

// 健康信息
const healthInfo = reactive<Partial<ServiceHealthResponse>>({
  status: '',
  service: '',
  version: '',
  dependencies: {},
  last_check_time: '',
  uptime: 0
});

// 就绪信息
const readyInfo = reactive<Partial<ServiceReadyResponse>>({
  ready: false,
  service: '',
  timestamp: '',
  message: ''
});

// 缓存信息
const cacheInfo = reactive<Partial<ClearCacheResponse>>({
  cleared: undefined,
  cache_keys_cleared: 0,
  timestamp: '',
  message: ''
});

// 自动刷新定时器
let autoRefreshTimer: NodeJS.Timeout | null = null;

// 获取健康状态样式类
const getHealthStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    'healthy': 'healthy',
    'degraded': 'degraded',
    'unhealthy': 'unhealthy'
  };
  return classMap[status] || 'unknown';
};

// 获取健康状态文本
const getHealthStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    'healthy': '健康',
    'degraded': '降级',
    'unhealthy': '不健康'
  };
  return textMap[status] || '未知';
};

// 格式化运行时间
const formatUptime = (uptime?: number) => {
  if (!uptime) return '未知';

  const days = Math.floor(uptime / (24 * 3600));
  const hours = Math.floor((uptime % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  if (days > 0) {
    return `${days}天${hours}小时${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
};

// 格式化时间
const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

// 健康检查
const checkHealth = async () => {
  try {
    healthLoading.value = true;
    const response = await assistantHealth();
    const data = response as ServiceHealthResponse;

    Object.assign(healthInfo, data);
    message.success('健康检查完成');
  } catch (error: any) {
    message.error(`健康检查失败: ${error.message}`);
    console.error('健康检查失败:', error);
  } finally {
    healthLoading.value = false;
  }
};

// 就绪检查
const checkReady = async () => {
  try {
    readyLoading.value = true;
    const response = await assistantReady();
    const data = response as ServiceReadyResponse;

    Object.assign(readyInfo, data);
    message.success('就绪检查完成');
  } catch (error: any) {
    message.error(`就绪检查失败: ${error.message}`);
    console.error('就绪检查失败:', error);
  } finally {
    readyLoading.value = false;
  }
};

// 清除缓存
const clearCache = async () => {
  try {
    cacheLoading.value = true;
    const response = await clearAssistantCache();
    const data = response as ClearCacheResponse;

    Object.assign(cacheInfo, data);

    if (data.cleared) {
      message.success('缓存清理成功');
    } else {
      message.error('缓存清理失败');
    }
  } catch (error: any) {
    message.error(`缓存清理失败: ${error.message}`);
    console.error('缓存清理失败:', error);
  } finally {
    cacheLoading.value = false;
  }
};

// 刷新所有状态
const refreshAllStatus = async () => {
  refreshing.value = true;
  try {
    await Promise.all([
      checkHealth(),
      checkReady()
    ]);
    message.success('状态刷新完成');
  } finally {
    refreshing.value = false;
  }
};

// 导出报告
const exportReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    health: healthInfo,
    ready: readyInfo,
    cache: cacheInfo
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  message.success('报告导出成功');
};

// 启动自动刷新
const startAutoRefresh = () => {
  autoRefreshTimer = setInterval(() => {
    if (!healthLoading.value && !readyLoading.value && !refreshing.value) {
      refreshAllStatus();
    }
  }, 30000); // 30秒刷新一次
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};

// 页面初始化
onMounted(() => {
  refreshAllStatus();
  startAutoRefresh();
});

// 页面销毁
onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.health-container {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

/* 页面头部 */
.health-container .page-header {
  background: #fff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.health-container .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.health-container .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.health-container .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.health-container .header-text {
  display: flex;
  flex-direction: column;
}

.health-container .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.health-container .page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.health-container .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.health-content {
  .status-overview {
    margin-bottom: 24px;

    .status-card {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;

        .status-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #fff;

          &.healthy,
          &.ready {
            background: #52c41a;
          }

          &.degraded {
            background: #fa8c16;
          }

          &.unhealthy {
            background: #ff4d4f;
          }

          &.uptime {
            background: #1890ff;
          }

          &:not(.healthy):not(.ready):not(.degraded):not(.uptime) {
            background: #ff4d4f;
          }
        }

        .status-content {
          flex: 1;

          .status-title {
            font-size: 14px;
            color: var(--ant-text-color-secondary);
            margin-bottom: 4px;
            font-weight: 500;
          }

          .status-value {
            font-size: 20px;
            font-weight: 600;
            line-height: 1.2;

            &.healthy,
            &.ready {
              color: #52c41a;
            }

            &.degraded {
              color: #fa8c16;
            }

            &.unhealthy {
              color: #ff4d4f;
            }

            &.uptime {
              color: #1890ff;
            }

            &:not(.healthy):not(.ready):not(.degraded):not(.uptime) {
              color: #ff4d4f;
            }
          }
        }
      }
    }
  }

  .detail-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .dependencies-section {
      margin-top: 16px;

      .dependencies-list {
        .dependency-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;

          &:hover {
            background: #f1f5f9;
          }

          &:last-child {
            margin-bottom: 0;
          }

          .dependency-name {
            font-weight: 500;
            color: #334155;
            font-size: 14px;
          }
        }
      }
    }
  }

  .operation-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .operation-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;

      &:hover {
        background: #f1f5f9;
      }

      .operation-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: #1890ff;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .operation-content {
        flex: 1;

        .operation-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .operation-desc {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 8px;
          line-height: 1.4;
        }
      }
    }
  }

  .cache-result-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }
}

@media (max-width: 768px) {
  .health-container {
    padding: 16px;
  }

  .health-container .page-header {
    padding: 20px;
    margin-bottom: 16px;
  }

  .health-container .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .health-container .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .health-container .page-title {
    font-size: 20px;
  }

  .health-container .page-subtitle {
    font-size: 13px;
  }

  .health-container .header-icon {
    font-size: 36px;
  }

  .status-card {
    .status-item {
      gap: 12px;
      padding: 16px;

      .status-icon {
        width: 48px;
        height: 48px;
        font-size: 20px;
      }

      .status-content {
        .status-value {
          font-size: 18px;
        }
      }
    }
  }

  .operation-item {
    flex-direction: column;
    text-align: center;
    gap: 12px;
    padding: 12px;

    .operation-content {
      .operation-title {
        font-size: 14px;
      }

      .operation-desc {
        font-size: 12px;
      }
    }
  }

  .dependencies-section {
    .dependency-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      text-align: left;
      padding: 10px 12px;
    }
  }
}
</style>
