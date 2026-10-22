<template>
  <div class="rca-cache">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
          <DatabaseOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">缓存管理</h1>
            <p class="page-subtitle">Redis 缓存监控、配置和优化</p>
          </div>
        </div>
        <div class="header-actions">
          <a-button 
            type="primary" 
            size="large" 
            @click="refreshCacheStats"
            :loading="loadingStats"
            :disabled="loadingStats"
          >
            {{ loadingStats ? '获取中...' : '刷新状态' }}
          </a-button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <a-card v-if="loadingStats && !cacheStats" class="loading-state-card">
      <div class="cache-loading-content">
        <div class="loading-main-icon">
          <Icon icon="mdi:database-cog" class="pulse-animation" />
        </div>
        <h3 class="loading-title">正在获取缓存状态...</h3>
        <p class="loading-subtitle">系统正在检查Redis缓存的运行状态和配置</p>

        <!-- 检查步骤指示器 -->
        <div class="cache-check-steps">
          <div class="cache-step-item" :class="{ active: getCacheCheckStep() >= 1 }">
            <div class="cache-step-icon">
              <Icon v-if="getCacheCheckStep() > 1" icon="mdi:check" />
              <Icon v-else-if="getCacheCheckStep() === 1" icon="mdi:loading" class="rotate-animation" />
              <Icon v-else icon="mdi:circle-outline" />
            </div>
            <span class="cache-step-text">连接Redis服务</span>
          </div>
          <div class="cache-step-item" :class="{ active: getCacheCheckStep() >= 2 }">
            <div class="cache-step-icon">
              <Icon v-if="getCacheCheckStep() > 2" icon="mdi:check" />
              <Icon v-else-if="getCacheCheckStep() === 2" icon="mdi:loading" class="rotate-animation" />
              <Icon v-else icon="mdi:circle-outline" />
            </div>
            <span class="cache-step-text">获取统计信息</span>
          </div>
          <div class="cache-step-item" :class="{ active: getCacheCheckStep() >= 3 }">
            <div class="cache-step-icon">
              <Icon v-if="getCacheCheckStep() > 3" icon="mdi:check" />
              <Icon v-else-if="getCacheCheckStep() === 3" icon="mdi:loading" class="rotate-animation" />
              <Icon v-else icon="mdi:circle-outline" />
            </div>
            <span class="cache-step-text">分析缓存健康度</span>
          </div>
        </div>

        <a-alert 
          message="预计耗时 5-15秒" 
          type="info" 
          show-icon
          class="loading-tip"
        />
      </div>
    </a-card>

    <!-- 缓存概览卡片 -->
    <div class="overview-grid" v-if="cacheStats">
      <div class="overview-card status">
        <div class="card-icon">
          <CheckCircleOutlined v-if="cacheStats.healthy" />
          <ExclamationCircleOutlined v-else />
        </div>
        <div class="card-content">
          <div class="card-title">缓存状态</div>
          <div class="card-value" :class="cacheStats.healthy ? 'healthy' : 'unhealthy'">
            {{ cacheStats.healthy ? '健康' : '异常' }}
          </div>
        </div>
      </div>

      <div class="overview-card keys">
        <div class="card-icon">🔑</div>
        <div class="card-content">
          <div class="card-title">缓存键数量</div>
          <div class="card-value">{{ formatTotalKeys(cacheStats.total_keys) }}</div>
        </div>
      </div>

      <div class="overview-card hit-rate">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <div class="card-title">命中率</div>
          <div class="card-value">{{ formatHitRate(cacheStats.hit_rate) }}</div>
        </div>
      </div>

      <div class="overview-card memory">
        <div class="card-icon">💾</div>
        <div class="card-content">
          <div class="card-title">内存使用</div>
          <div class="card-value">{{ formatMemoryUsage(cacheStats.memory_usage) }}</div>
        </div>
      </div>
    </div>

    <!-- 缓存操作区域 -->
    <div class="operations-section">
      <div class="section-header">
        <h2>缓存操作</h2>
        <a-tag :color="cacheStats?.available ? '#10b981' : '#f59e0b'">
          {{ cacheStats?.available ? '可用' : '不可用' }}
        </a-tag>
      </div>

      <div class="operations-grid">
        <!-- 清除命名空间缓存 -->
        <div class="operation-card">
          <div class="operation-header">
            <h3>清除命名空间缓存</h3>
            <a-tag color="blue">按命名空间</a-tag>
          </div>
          <div class="operation-content">
            <a-input
              v-model:value="clearNamespaceForm.namespace"
              placeholder="输入要清除缓存的命名空间"
              class="operation-input"
            />
            <a-button 
              type="primary" 
              @click="handleClearNamespaceCache"
              :loading="clearingCache"
              :disabled="!clearNamespaceForm.namespace.trim()"
            >
              清除缓存
            </a-button>
          </div>
        </div>

        <!-- 清除操作缓存 -->
        <div class="operation-card">
          <div class="operation-header">
            <h3>清除操作缓存</h3>
            <a-tag color="green">按操作类型</a-tag>
          </div>
          <div class="operation-content">
            <a-select
              v-model:value="clearOperationForm.operation"
              placeholder="选择要清除缓存的操作类型"
              class="operation-select"
            >
              <a-select-option value="analyze">根因分析</a-select-option>
              <a-select-option value="diagnosis">快速诊断</a-select-option>
              <a-select-option value="events">事件模式</a-select-option>
              <a-select-option value="errors">错误摘要</a-select-option>
              <a-select-option value="metrics">指标数据</a-select-option>
              <a-select-option value="logs">日志数据</a-select-option>
            </a-select>
            <a-button 
              type="primary" 
              @click="handleClearOperationCache"
              :loading="clearingCache"
              :disabled="!clearOperationForm.operation"
            >
              清除缓存
            </a-button>
          </div>
        </div>

        <!-- 批量操作 -->
        <div class="operation-card">
          <div class="operation-header">
            <h3>批量操作</h3>
            <a-tag color="orange">批量处理</a-tag>
          </div>
          <div class="operation-content">
            <a-space direction="vertical" style="width: 100%;">
              <a-button 
                type="primary" 
                danger
                @click="showClearAllModal"
                :loading="clearingCache"
                block
              >
                清除所有缓存
              </a-button>
              <a-button 
                @click="refreshCacheStats"
                :loading="loadingStats"
                block
              >
                刷新缓存状态
              </a-button>
            </a-space>
          </div>
        </div>
      </div>
    </div>

    <!-- 缓存详情 -->
    <div class="details-section" v-if="cacheStats">
      <div class="section-header">
        <h2>缓存详情</h2>
        <a-tag color="#6366f1">
          最后更新: {{ formatTime(cacheStats.timestamp) }}
        </a-tag>
      </div>

      <div class="details-grid">
        <div class="detail-card">
          <h4>基本信息</h4>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="缓存前缀">
              {{ formatCachePrefix(cacheStats.cache_prefix) }}
            </a-descriptions-item>
            <a-descriptions-item label="默认TTL">
              {{ formatTTL(cacheStats.default_ttl) }}
            </a-descriptions-item>
            <a-descriptions-item label="可用状态">
              <a-tag :color="cacheStats.available ? 'green' : 'red'">
                {{ cacheStats.available ? '可用' : '不可用' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="健康状态">
              <a-tag :color="cacheStats.healthy ? 'green' : 'red'">
                {{ cacheStats.healthy ? '健康' : '异常' }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <div class="detail-card">
          <h4>性能指标</h4>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="命中率">
              <a-progress 
                :percent="getHitRatePercent(cacheStats.hit_rate)" 
                :stroke-color="getHitRateColor(cacheStats.hit_rate)"
                :show-info="false"
              />
              <span style="margin-left: 8px;">{{ formatHitRate(cacheStats.hit_rate) }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="缓存键数量">
              {{ formatTotalKeys(cacheStats.total_keys) }}
            </a-descriptions-item>
            <a-descriptions-item label="内存使用">
              {{ formatMemoryUsage(cacheStats.memory_usage) }}
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <div class="detail-card">
          <h4>系统信息</h4>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="最后检查时间">
              {{ formatTime(cacheStats.timestamp) }}
            </a-descriptions-item>
            <a-descriptions-item label="状态消息">
              {{ formatStatusMessage(cacheStats.message) }}
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </div>
    </div>

    <!-- 操作历史 -->
    <div class="history-section">
      <div class="section-header">
        <h2>操作历史</h2>
        <a-button @click="clearHistory" size="small">
          清空历史
        </a-button>
      </div>

      <div class="history-list">
        <div 
          v-for="(record, index) in operationHistory" 
          :key="index"
          class="history-item"
        >
          <div class="history-icon">
            <CheckCircleOutlined v-if="record.success" />
            <CloseCircleOutlined v-else />
          </div>
          <div class="history-content">
            <div class="history-title">{{ record.operation }}</div>
            <div class="history-details">
              <span class="history-time">{{ formatTime(record.timestamp) }}</span>
              <span class="history-message">{{ record.message }}</span>
              <span v-if="record.cleared_count" class="history-count">
                清除 {{ record.cleared_count }} 项
              </span>
            </div>
          </div>
        </div>

        <div v-if="operationHistory.length === 0" class="empty-history">
          暂无操作历史
        </div>
      </div>
    </div>

    <!-- 清除所有缓存确认模态框 -->
    <a-modal
      v-model:open="clearAllModalVisible"
      title="确认清除所有缓存"
      @ok="confirmClearAllCache"
      @cancel="clearAllModalVisible = false"
      :confirm-loading="clearingCache"
      ok-text="确认清除"
      cancel-text="取消"
      ok-type="danger"
    >
      <div class="clear-all-warning">
        <ExclamationCircleOutlined style="color: #ff4d4f; font-size: 24px; margin-right: 12px;" />
        <div>
          <p><strong>警告：</strong>此操作将清除所有RCA相关的缓存数据</p>
          <p>清除后，所有分析结果将需要重新计算，这可能会影响系统性能</p>
          <p>请确认您真的要执行此操作吗？</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  getCacheStats,
  clearAllCache,
  clearNamespaceCache,
  clearOperationCache,
  type RCACacheStatsResponse,
} from '#/api/core/aiops/rca';

// 响应式数据
const loadingStats = ref(false);
const clearingCache = ref(false);
const clearAllModalVisible = ref(false);
const cacheStats = ref<RCACacheStatsResponse | null>(null);
const cacheCheckStep = ref(0);

// 表单数据
const clearNamespaceForm = reactive({
  namespace: ''
});

const clearOperationForm = reactive({
  operation: ''
});

// 操作历史
const operationHistory = ref<Array<{
  operation: string;
  success: boolean;
  message: string;
  timestamp: string;
  cleared_count?: number;
}>>([]);

// 获取当前缓存检查步骤
const getCacheCheckStep = () => {
  return cacheCheckStep.value;
};

// 获取缓存统计
const refreshCacheStats = async () => {
  loadingStats.value = true;
  cacheCheckStep.value = 0;

  // 开始获取缓存状态提示
  message.loading('开始获取缓存状态，请稍候...', 1.5);

  try {
    // 步骤1: 连接Redis服务
    cacheCheckStep.value = 1;
    await new Promise(resolve => setTimeout(resolve, 300));

    // 步骤2: 获取统计信息
    cacheCheckStep.value = 2;
    await new Promise(resolve => setTimeout(resolve, 300));

    // 步骤3: 分析缓存健康度
    cacheCheckStep.value = 3;
    await new Promise(resolve => setTimeout(resolve, 300));

    const response = await getCacheStats();

    // 完成所有步骤
    cacheCheckStep.value = 4;

    cacheStats.value = response;

    // 根据缓存状态给出不同的反馈
    if (response.healthy && response.available) {
      message.success('缓存状态获取完成！所有指标正常');
    } else if (response.available) {
      message.success('缓存状态获取完成！');
      setTimeout(() => {
        message.warning('缓存状态存在异常，建议检查配置', 3);
      }, 500);
    } else {
      message.success('缓存状态获取完成！');
      setTimeout(() => {
        message.error('缓存服务不可用，请检查Redis连接', 5);
      }, 500);
    }
  } catch (error) {

    let errorMessage = '获取缓存状态失败';
    if (error instanceof Error) {
      if (error.message.includes('Network Error')) {
        errorMessage = '网络连接失败，请检查网络设置';
      } else if (error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.message.includes('500')) {
        errorMessage = 'Redis服务内部错误，请联系管理员';
      } else if (error.message.includes('404')) {
        errorMessage = '缓存服务不可用，请检查服务状态';
      }
    }
    message.error(errorMessage);
  } finally {
    loadingStats.value = false;
    cacheCheckStep.value = 0;
  }
};

// 清除命名空间缓存
const handleClearNamespaceCache = async () => {
  if (!clearNamespaceForm.namespace.trim()) {
    message.warning('请输入命名空间');
    return;
  }

  clearingCache.value = true;
  try {
    const response = await clearNamespaceCache({ namespace: clearNamespaceForm.namespace.trim() });

    if (response.success) {
      message.success(`命名空间 "${clearNamespaceForm.namespace}" 的缓存已清除`);

      // 添加到操作历史
      addToHistory('清除命名空间缓存', true, response.message, response.cleared_count);

      // 清空表单
      clearNamespaceForm.namespace = '';

      // 刷新缓存状态
      await refreshCacheStats();
    } else {
      message.error(response.message || '清除命名空间缓存失败');
      addToHistory('清除命名空间缓存', false, response.message || '操作失败');
    }
  } catch (error) {

    message.error('清除命名空间缓存失败，请稍后重试');
    addToHistory('清除命名空间缓存', false, '网络错误');
  } finally {
    clearingCache.value = false;
  }
};

// 清除操作缓存
const handleClearOperationCache = async () => {
  if (!clearOperationForm.operation) {
    message.warning('请选择操作类型');
    return;
  }

  clearingCache.value = true;
  try {
    const response = await clearOperationCache({ operation: clearOperationForm.operation });

    if (response.success) {
      message.success(`操作 "${clearOperationForm.operation}" 的缓存已清除`);

      // 添加到操作历史
      addToHistory('清除操作缓存', true, response.message, response.cleared_count);

      // 清空表单
      clearOperationForm.operation = '';

      // 刷新缓存状态
      await refreshCacheStats();
    } else {
      message.error(response.message || '清除操作缓存失败');
      addToHistory('清除操作缓存', false, response.message || '操作失败');
    }
  } catch (error) {

    message.error('清除操作缓存失败，请稍后重试');
    addToHistory('清除操作缓存', false, '网络错误');
  } finally {
    clearingCache.value = false;
  }
};

// 显示清除所有缓存模态框
const showClearAllModal = () => {
  clearAllModalVisible.value = true;
};

// 确认清除所有缓存
const confirmClearAllCache = async () => {
  clearingCache.value = true;
  try {
    const response = await clearAllCache();

    if (response.success) {
      message.success(`所有缓存已清除，共清除 ${response.cleared_count} 项`);

      // 添加到操作历史
      addToHistory('清除所有缓存', true, response.message, response.cleared_count);

      // 关闭模态框
      clearAllModalVisible.value = false;

      // 刷新缓存状态
      await refreshCacheStats();
    } else {
      message.error(response.message || '清除所有缓存失败');
      addToHistory('清除所有缓存', false, response.message || '操作失败');
    }
  } catch (error) {

    message.error('清除所有缓存失败，请稍后重试');
    addToHistory('清除所有缓存', false, '网络错误');
  } finally {
    clearingCache.value = false;
  }
};

// 添加到操作历史
const addToHistory = (
  operation: string, 
  success: boolean, 
  message: string, 
  clearedCount?: number
) => {
  operationHistory.value.unshift({
    operation,
    success,
    message,
    timestamp: new Date().toISOString(),
    cleared_count: clearedCount
  });

  // 限制历史记录数量
  if (operationHistory.value.length > 50) {
    operationHistory.value = operationHistory.value.slice(0, 50);
  }
};

// 清空操作历史
const clearHistory = () => {
  operationHistory.value = [];
  message.success('操作历史已清空');
};

// 格式化命中率
const formatHitRate = (hitRate?: number) => {
  if (hitRate === undefined || hitRate === null) return 'N/A';
  const percentage = hitRate;
  return `${percentage.toFixed(1)}%`;
};

// 获取命中率百分比
const getHitRatePercent = (hitRate?: number) => {
  if (hitRate === undefined || hitRate === null) return 0;
  return hitRate;
};

// 获取命中率颜色
const getHitRateColor = (hitRate?: number) => {
  if (hitRate === undefined || hitRate === null) return '#d9d9d9';
  const percentage = hitRate / 100;
  if (percentage >= 0.8) return '#52c41a';
  if (percentage >= 0.6) return '#1890ff';
  if (percentage >= 0.4) return '#faad14';
  return '#ff4d4f';
};

// 格式化TTL
const formatTTL = (ttl?: number) => {
  if (ttl === undefined || ttl === null) return 'N/A';
  if (ttl < 60) return `${ttl}秒`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}分钟`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}小时`;
  return `${Math.floor(ttl / 86400)}天`;
};

// 格式化缓存键数量
const formatTotalKeys = (totalKeys?: number) => {
  if (totalKeys === undefined || totalKeys === null) return 'N/A';
  return totalKeys;
};

// 格式化内存使用
const formatMemoryUsage = (memoryUsage?: string) => {
  if (memoryUsage === undefined || memoryUsage === null) return 'N/A';
  return memoryUsage;
};

// 格式化缓存前缀
const formatCachePrefix = (prefix?: string) => {
  if (!prefix) return 'N/A';
  return prefix;
};

// 格式化时间
const formatTime = (timestamp?: string) => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return timestamp;
  }
};

// 格式化状态消息
const formatStatusMessage = (message?: string) => {
  if (!message) return '无';
  return message;
};

// 生命周期
onMounted(() => {
  refreshCacheStats();
});
</script>

<style scoped>
.rca-cache {
padding: 24px;
background: var(--ops-ground);
min-height: 100vh;
}

/* 页面头部 */
.rca-cache .page-header {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
}

/* 加载状态 */
.loading-state-card {
margin-bottom: 24px;
border-radius: var(--ops-radius);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
border: 1px solid var(--ops-border);
text-align: center;
padding: 48px 24px;
}

.cache-loading-content {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.loading-main-icon {
  font-size: 80px;
  color: #1890ff;
  margin-bottom: 24px;
}

.pulse-animation {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.rotate-animation {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 8px;
}

.loading-subtitle {
  font-size: 14px;
  color: var(--ops-muted);
  margin-bottom: 32px;
}

.cache-check-steps {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 32px;
}

.cache-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: var(--ops-radius);
  transition: all 0.3s ease;
  opacity: 0.5;
}

.cache-step-item.active {
  opacity: 1;
  background: rgba(24, 144, 255, 0.05);
  border: 1px solid rgba(24, 144, 255, 0.2);
}

.cache-step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ops-ground);
  border: 2px solid var(--ops-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--ops-muted);
  transition: all 0.3s ease;
}

.cache-step-item.active .cache-step-icon {
  background: #1890ff;
  border-color: #1890ff;
  color: hsl(var(--primary-foreground));
}

.cache-step-text {
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 500;
  text-align: center;
}

.cache-step-item.active .cache-step-text {
  color: #1890ff;
  font-weight: 600;
}

.loading-tip {
  margin-top: 24px;
}

.rca-cache .header-content {
display: flex;
justify-content: space-between;
align-items: center;
width: 100%;
}

.rca-cache .header-left {
display: flex;
align-items: center;
gap: 16px;
}

.rca-cache .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.rca-cache .header-text {
display: flex;
flex-direction: column;
}

.rca-cache .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--ops-ink);
}

.rca-cache .page-subtitle {
  color: var(--ops-muted);
  margin: 0;
  font-size: 12px;
  margin-top: 4px;
}

.rca-cache .header-actions {
display: flex;
gap: 12px;
align-items: center;
}

/* 概览卡片 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.overview-card {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-icon {
  font-size: 36px;
  color: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 8px;
}

.card-value {
  font-size: 24px;
  font-weight: 700;
  color: #1890ff;
  margin-bottom: 4px;
}

.card-description {
  font-size: 12px;
  color: var(--ops-muted);
}

.card-trend {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.trend-up {
  background: #fff2f0;
  color: #ff4d4f;
}

.trend-down {
  background: #f6ffed;
  color: #52c41a;
}

.trend-stable {
  background: var(--ops-border);
  color: var(--ops-muted);
}

.card-value.healthy {
  color: #52c41a;
}

.card-value.unhealthy {
  color: #ff4d4f;
}

/* 操作区域 */
.operations-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0;
}

.operations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;
}

.operation-card {
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: 20px;
  transition: all 0.3s ease;
}

.operation-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.operation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.operation-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0;
}

.operation-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.operation-input {
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--ops-border);
  transition: all 0.3s ease;
}

.operation-select {
  width: 100%;
}

.operation-select :deep(.ant-select-selector) {
  height: 36px !important;
  border-radius: 6px !important;
  border: 1px solid var(--ops-border) !important;
  transition: all 0.3s ease !important;
}

.operation-select :deep(.ant-select-selection-item) {
  line-height: 34px !important;
}

.operation-input:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.operation-select:hover :deep(.ant-select-selector) {
  border-color: #40a9ff !important;
}

.operation-select.ant-select-focused :deep(.ant-select-selector) {
  border-color: #1890ff !important;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
}

.operation-input:hover {
  border-color: #40a9ff;
}

/* 确保下拉菜单在最上层 */
.operation-select :deep(.ant-select-dropdown) {
  z-index: 1050 !important;
}

/* 详情区域 */
.details-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.detail-card {
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: 20px;
}

.detail-card h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--ops-ink);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ops-border);
}

.details-tabs :deep(.ant-tabs-nav) {
  padding: 0 24px;
  margin-bottom: 0;
}

.tab-content {
  padding: 24px;
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

/* 滚动条样式 */
.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-thumb {
  background: var(--ops-border);
  border-radius: 3px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 缓存项样式 */
.cache-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.cache-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-color: #1890ff;
}

.cache-key {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: var(--ops-ink);
  word-break: break-all;
}

.cache-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.cache-size {
  font-size: 12px;
  color: var(--ops-muted);
}

.cache-ttl {
  font-size: 12px;
  color: var(--ops-muted);
}

.cache-actions-btns {
  display: flex;
  gap: 8px;
}

.cache-action-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
}

.view-btn {
  border: 1px solid #1890ff;
  background: var(--ops-surface);
  color: #1890ff;
}

.view-btn:hover {
  background: #1890ff;
  color: hsl(var(--primary-foreground));
}

.delete-btn {
  border: 1px solid #ff4d4f;
  background: var(--ops-surface);
  color: #ff4d4f;
}

.delete-btn:hover {
  background: #ff4d4f;
  color: hsl(var(--primary-foreground));
}

/* 缓存值预览 */
.cache-value-preview {
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: 6px;
  padding: 16px;
  margin-top: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: var(--ops-muted);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 缓存统计 */
.cache-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--ops-muted);
  text-transform: uppercase;
  font-weight: 500;
}

/* 历史区域 */
.history-section {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ops-border);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  transition: all 0.3s ease;
}

.history-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.history-icon {
  font-size: 20px;
  color: #52c41a;
}

.history-icon :deep(.anticon-close-circle) {
  color: #ff4d4f;
}

.history-content {
  flex: 1;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 8px;
}

.history-details {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.history-time {
  font-size: 12px;
  color: var(--ops-muted);
}

.history-message {
  font-size: 12px;
  color: var(--ops-muted);
  flex: 1;
}

.history-count {
  font-size: 12px;
  color: #1890ff;
  font-weight: 500;
}

.empty-history {
  text-align: center;
  padding: 40px;
  color: #bfbfbf;
  font-size: 14px;
}

/* 警告样式 */
.clear-all-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  margin-bottom: 16px;
}

.clear-all-warning p {
  margin: 0 0 8px 0;
  color: var(--ops-muted);
  line-height: 1.5;
}

.clear-all-warning p:last-child {
  margin-bottom: 0;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .rca-cache {
    padding: 16px;
  }

  .rca-cache .page-header {
    padding: 20px;
    margin-bottom: 16px;
  }

  .rca-cache .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .rca-cache .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .rca-cache .page-title {
    font-size: 20px;
  }

  .rca-cache .page-subtitle {
    font-size: 13px;
  }

  .rca-cache .header-icon {
    font-size: 36px;
  }

  .overview-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .operations-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .details-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 576px) {
  .rca-cache {
    padding: 12px;
  }

  .rca-cache .page-header {
    padding: 16px;
  }

  .rca-cache .page-title {
    font-size: 18px;
  }

  .rca-cache .header-icon {
    font-size: 32px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .operation-card {
    padding: 16px;
  }

  .detail-card {
    padding: 16px;
  }

  .cache-check-steps {
    flex-direction: column;
    gap: 16px;
  }

  .cache-step-item {
    flex-direction: row;
    gap: 12px;
    padding: 12px;
  }

  .cache-step-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .loading-main-icon {
    font-size: 60px;
  }

  .loading-title {
    font-size: 20px;
  }
}
</style>
