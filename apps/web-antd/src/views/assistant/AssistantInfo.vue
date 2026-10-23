<template>
  <OpsPage title="服务信息" description="查看初始化状态、能力说明与服务配置" class="info-container">
    <!-- 页面头部 -->
    <template #actions>
<a-button type="primary" @click="refreshInfo" :loading="loading || configLoading">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新信息
          </a-button>
    </template>

    <a-alert v-if="loadError" :message="loadError" type="error" show-icon role="alert">
      <template #action><a-button @click="refreshInfo" :loading="loading || configLoading">重试</a-button></template>
    </a-alert>
    <div class="info-content">
      <!-- 服务状态概览 -->
      <div class="status-overview">
        <a-card class="status-card">
          <div class="status-item">
            <div class="status-icon" :class="{ 'online': serviceInfo.status === 'initialized' }">
              <CheckCircleOutlined v-if="serviceInfo.status === 'initialized'" />
              <CloseCircleOutlined v-else />
            </div>
            <div class="status-content">
              <div class="status-title">初始化状态</div>
              <div class="status-value" :class="serviceInfo.status">
                {{ getStatusText(serviceInfo.status || '') }}
              </div>
            </div>
          </div>
        </a-card>
      </div>

      <!-- 服务基本信息 -->
      <a-card title="基本信息" class="info-card" :loading="loading">
        <a-descriptions :column="{ xs: 1, md: 2 }" bordered>
          <a-descriptions-item label="服务名称">
            <a-tag color="blue">{{ serviceInfo.service || '未知' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="服务版本">
            <a-tag color="green">{{ serviceInfo.version || '未知' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="服务描述">
            {{ serviceInfo.description || '暂无描述' }}
          </a-descriptions-item>
          <a-descriptions-item label="约束条件">
            <div v-if="serviceInfo.constraints">
              <a-tag v-for="(value, key) in serviceInfo.constraints" :key="key" class="constraint-tag">
                {{ key }}: {{ value }}
              </a-tag>
            </div>
            <span v-else class="text-muted">无特殊约束</span>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 服务能力 -->
      <a-card title="服务能力" class="info-card" :loading="loading">
        <div v-if="serviceInfo.capabilities && serviceInfo.capabilities.length > 0" class="capabilities-grid">
          <div v-for="capability in serviceInfo.capabilities" :key="capability" class="capability-item">
            <div class="capability-icon">
              <ThunderboltOutlined />
            </div>
            <div class="capability-text">{{ capability }}</div>
          </div>
        </div>
        <div v-else class="empty-capabilities">
          <a-empty description="暂无能力信息" />
        </div>
      </a-card>

      <!-- API 端点 -->
      <a-card title="API 端点" class="info-card" :loading="loading">
        <div v-if="serviceInfo.endpoints && Object.keys(serviceInfo.endpoints).length > 0">
          <div v-for="(url, name) in serviceInfo.endpoints" :key="name" class="endpoint-item">
            <div class="endpoint-header">
              <a-tag color="purple">{{ name }}</a-tag>
              <a-button type="link" size="small" @click="copyToClipboard(url)">
                <template #icon>
                  <CopyOutlined />
                </template>
                复制
              </a-button>
            </div>
            <div class="endpoint-url">{{ url }}</div>
          </div>
        </div>
        <div v-else class="empty-endpoints">
          <a-empty description="暂无端点信息" />
        </div>
      </a-card>

      <!-- 配置信息 -->
      <a-card title="配置参数" class="info-card" :loading="configLoading">
        <div v-if="configInfo.config && Object.keys(configInfo.config).length > 0">
          <a-collapse v-model:activeKey="activeConfigKeys" ghost>
            <a-collapse-panel v-for="(value, key) in configInfo.config" :key="key" :header="key">
              <div class="config-content">
                <pre class="config-value">{{ formatConfigValue(value) }}</pre>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
        <div v-else class="empty-config">
          <a-empty description="暂无配置信息" />
        </div>

        <div v-if="configInfo.version || configInfo.timestamp" class="config-meta">
          <a-divider />
          <div class="meta-info">
            <span v-if="configInfo.version" class="meta-item">
              <CalendarOutlined />
              版本: {{ configInfo.version }}
            </span>
            <span v-if="configInfo.timestamp" class="meta-item">
              <ClockCircleOutlined />
              更新时间: {{ formatTimestamp(configInfo.timestamp) }}
            </span>
          </div>
        </div>
      </a-card>
    </div>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { message } from 'ant-design-vue';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue';
import {
  getAssistantInfo,
  getAssistantConfig,
  type ServiceInfoResponse,
  type ServiceConfigResponse
} from '#/api/core/aiops/assistant';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

// 响应式数据
const loading = ref(false);
const configLoading = ref(false);
const infoError = ref('');
const configError = ref('');
const loadError = computed(() => infoError.value || configError.value);
let infoRequest = 0;
let configRequest = 0;
let disposed = false;
onBeforeUnmount(() => { disposed = true; infoRequest += 1; configRequest += 1; });
const activeConfigKeys = ref<string[]>([]);

// 服务信息
const serviceInfo = ref<Partial<ServiceInfoResponse>>({
  service: '',
  version: '',
  description: '',
  capabilities: [],
  endpoints: {},
  constraints: {},
  status: ''
});

// 配置信息
const configInfo = ref<Partial<ServiceConfigResponse>>({
  service: '',
  config: {},
  version: '',
  timestamp: ''
});

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'initialized': '已初始化',
    'not_initialized': '未初始化',
    'online': '在线',
    'offline': '离线',
    'error': '错误',
    'maintenance': '维护中'
  };
  return statusMap[status] || '未知';
};

// 格式化配置值
const formatConfigValue = (value: any) => {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

// 格式化时间戳
const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('复制成功');
  } catch (error) {
    if (shouldNotifyPageError(error)) message.error('复制失败');
  }
};

// 获取服务信息
const fetchServiceInfo = async () => {
  const request = ++infoRequest;
  infoError.value = '';
  try {
    loading.value = true;
    const response = await getAssistantInfo();
    const data = response as ServiceInfoResponse;

    // 更新服务信息
    if (disposed || request !== infoRequest) return;
    serviceInfo.value = data;
  } catch (error: any) {
    if (disposed || request !== infoRequest) return;
    serviceInfo.value = {};
    infoError.value = error instanceof Error ? error.message : '获取服务信息失败';
  } finally {
    if (!disposed && request === infoRequest) loading.value = false;
  }
};

// 获取配置信息
const fetchConfigInfo = async () => {
  const request = ++configRequest;
  configError.value = '';
  try {
    configLoading.value = true;
    const response = await getAssistantConfig();
    const data = response as ServiceConfigResponse;

    // 更新配置信息
    if (disposed || request !== configRequest) return;
    configInfo.value = data;
  } catch (error: any) {
    if (disposed || request !== configRequest) return;
    configInfo.value = {};
    activeConfigKeys.value = [];
    configError.value = error instanceof Error ? error.message : '获取配置信息失败';
  } finally {
    if (!disposed && request === configRequest) configLoading.value = false;
  }
};

// 刷新所有信息
const refreshInfo = async () => {
  await Promise.all([
    fetchServiceInfo(),
    fetchConfigInfo()
  ]);
};

// 页面初始化
onMounted(() => {
  refreshInfo();
});
</script>

<style scoped>

/* 页面头部 */








.info-content {
  .status-overview {
    margin-bottom: var(--ops-space-lg);

    .status-card {
      border-radius: var(--ops-radius);
      box-shadow: none;
      margin-bottom: var(--ops-space-lg);
      transition: border-color var(--ops-duration) ease-out;

      &:hover {
        box-shadow: none;
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 8px 16px;

        .status-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--ops-radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: hsl(var(--primary-foreground));

          &.online {
            background: #52c41a;
          }

          &:not(.online) {
            background: #ff4d4f;
          }
        }

        .status-content {
          flex: 1;

          .status-title {
            font-size: 14px;
            color: var(--ops-muted);
            margin-bottom: 4px;
            font-weight: 500;
          }

          .status-value {
            font-size: 20px;
            font-weight: 600;
            line-height: 1.2;

            &.online {
              color: #52c41a;
            }

            &.offline {
              color: #ff4d4f;
            }
          }
        }
      }
    }
  }

  .info-card {
    border-radius: var(--ops-radius);
    box-shadow: none;
    margin-bottom: var(--ops-space-lg);
    transition: border-color var(--ops-duration) ease-out;

    &:hover {
      box-shadow: none;
    }

    .constraint-tag {
      margin-bottom: 8px;
    }

    .text-muted {
      color: var(--ops-muted);
      font-style: italic;
    }
  }

  .capabilities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;

    .capability-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border: 1px solid var(--ops-border);
      border-radius: var(--ops-radius);
      transition: border-color var(--ops-duration) ease-out;

      &:hover {
        box-shadow: none;
      }

      .capability-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--ops-accent);
        color: hsl(var(--primary-foreground));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .capability-text {
        font-size: 14px;
        color: var(--ops-ink);
        font-weight: 500;
      }
    }
  }

  .empty-capabilities,
  .empty-endpoints,
  .empty-config {
    text-align: center;
    padding: 60px 0;
  }

  .endpoint-item {
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid var(--ops-border);
    border-radius: var(--ops-radius);
    transition: border-color var(--ops-duration) ease-out;

    &:hover {
      box-shadow: none;
    }

    &:last-child {
      margin-bottom: 0;
    }

    .endpoint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .endpoint-url {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      color: var(--ops-ink);
      background: var(--ops-ground);
      padding: 8px 12px;
      border-radius: var(--ops-radius);
      border: 1px solid var(--ops-border);
      word-break: break-all;
      line-height: 1.4;
    }
  }

  .config-content {
    .config-value {
      background: var(--ops-ground);
      border: 1px solid var(--ops-border);
      border-radius: var(--ops-radius);
      padding: 12px;
      margin: 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: var(--ops-ink);
      overflow-x: auto;
    }
  }

  .config-meta {
    .meta-info {
      display: flex;
      gap: 24px;
      align-items: center;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ops-muted);
        font-size: 12px;
        font-weight: 500;

        .anticon {
          font-size: 14px;
          color: var(--ops-accent);
        }
      }
    }
  }
}

@media (max-width: 768px) {







  .status-card {
    .status-item {
      gap: 16px;

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

  .capabilities-grid {
    grid-template-columns: 1fr;
    gap: 12px;

    .capability-item {
      .capability-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }

      .capability-text {
        font-size: 12px;
      }
    }
  }

  .endpoint-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .endpoint-url {
    font-size: 11px;
    padding: 8px 10px;
  }

  .config-value {
    font-size: 11px;
    padding: 10px;
  }

  .meta-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .meta-item {
      font-size: 11px;
    }
  }
}
</style>
