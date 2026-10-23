<template>
  <OpsPage title="RCA 缓存管理" description="读取真实缓存状态；清理操作仅在明确提交后执行" class="rca-cache">
    <!-- 页面头部 -->
    <template #actions>
<a-button
            type="primary" 
            size="large" 
            @click="refreshCacheStats"
            :loading="loadingStats"
            :disabled="loadingStats"
          >
            {{ loadingStats ? '获取中...' : '刷新状态' }}
          </a-button>
    </template>
    <a-alert v-if="statsError" :message="statsError" type="error" show-icon role="alert" />
    <a-alert v-if="operationError" :message="operationError" type="error" show-icon role="alert" />

    <!-- 加载状态 -->
    <a-card v-if="loadingStats && !cacheStats" class="loading-container"><a-spin /><p>正在等待服务返回实际结果，请稍候</p></a-card>

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
            {{ !cacheStats.available ? '不可用' : cacheStats.healthy ? '健康' : '异常' }}
          </div>
        </div>
      </div>

      <div class="overview-card keys">
        <div class="card-icon"><Icon icon="lucide:key-round" /></div>
        <div class="card-content">
          <div class="card-title">缓存键数量</div>
          <div class="card-value">{{ formatTotalKeys(cacheStats.total_keys) }}</div>
        </div>
      </div>

      <div class="overview-card hit-rate">
        <div class="card-icon"><Icon icon="lucide:chart-column" /></div>
        <div class="card-content">
          <div class="card-title">命中率</div>
          <div class="card-value">{{ formatHitRate(cacheStats.hit_rate) }}</div>
        </div>
      </div>

      <div class="overview-card memory">
        <div class="card-icon"><Icon icon="lucide:hard-drive" /></div>
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
              v-model:value="clearNamespaceForm.namespace" :disabled="clearingCache"
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
              v-model:value="clearOperationForm.operation" :disabled="clearingCache"
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
                {{ !cacheStats.available ? '不可用' : cacheStats.healthy ? '健康' : '异常' }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <div class="detail-card">
          <h4>性能指标</h4>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="命中率">
              <a-progress v-if="Number.isFinite(cacheStats.hit_rate) && cacheStats.hit_rate! >= 0 && cacheStats.hit_rate! <= 100"
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
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { useRcaCache } from './useRcaCache';
import { CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
const { loadingStats, clearingCache, clearAllModalVisible, cacheStats, statsError, operationError, clearNamespaceForm, clearOperationForm, operationHistory, refreshCacheStats, handleClearNamespaceCache, handleClearOperationCache, showClearAllModal, confirmClearAllCache, clearHistory } = useRcaCache();

// 格式化命中率
const formatHitRate = (hitRate?: number) => {
  if (!Number.isFinite(hitRate) || hitRate! < 0 || hitRate! > 100) return '未知';
  const percentage = hitRate!;
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

</script>

<style scoped>

/* 页面头部 */

/* 加载状态 */
.loading-state-card {
margin-bottom: var(--ops-space-lg);
border-radius: var(--ops-radius);
box-shadow: none;
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
  margin-bottom: var(--ops-space-lg);
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
  transition: border-color var(--ops-duration) ease-out;
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
  transition: border-color var(--ops-duration) ease-out;
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








/* 概览卡片 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: var(--ops-space-lg);
}

.overview-card {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 24px;
  box-shadow: none;
  border: 1px solid var(--ops-border);
  display: flex;
  align-items: center;
  gap: 20px;
  transition: border-color var(--ops-duration) ease-out;
  cursor: pointer;
}

.overview-card:hover {
  box-shadow: none;
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
  margin-bottom: var(--ops-space-lg);
  box-shadow: none;
  border: 1px solid var(--ops-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ops-space-lg);
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
  transition: border-color var(--ops-duration) ease-out;
}

.operation-card:hover {
  box-shadow: none;
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
  transition: border-color var(--ops-duration) ease-out;
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
  box-shadow: none;
}

.operation-select:hover :deep(.ant-select-selector) {
  border-color: #40a9ff !important;
}

.operation-select.ant-select-focused :deep(.ant-select-selector) {
  border-color: #1890ff !important;
  box-shadow: none;
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
  margin-bottom: var(--ops-space-lg);
  box-shadow: none;
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
  transition: border-color var(--ops-duration) ease-out;
}

.cache-item:hover {
  box-shadow: none;
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
  margin-bottom: var(--ops-space-lg);
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
  box-shadow: none;
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
  transition: border-color var(--ops-duration) ease-out;
}

.history-item:hover {
  box-shadow: none;
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

@media (max-width: 575px) {
  .overview-grid, .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ops-space-sm); }
  .overview-card, .metric-card { min-width: 0; padding: var(--ops-space-md); }
  .card-value, .metric-value { overflow-wrap: anywhere; }
  .section-header { flex-wrap: wrap; gap: var(--ops-space-sm); }
}
</style>
