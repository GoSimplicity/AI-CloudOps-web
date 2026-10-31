import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import {
  clearAllCache,
  clearNamespaceCache,
  clearOperationCache,
  getCacheStats,
  type RCACacheStatsResponse,
  type RCAClearCacheResponse,
} from '#/api/core/aiops/rca';

import { useAiRequestScope } from '../assistant/useAiRequestScope';

export function useRcaCache() {
  const loadingStats = ref(false);
  const clearingCache = ref(false);
  const clearAllModalVisible = ref(false);
  const cacheStats = ref<RCACacheStatsResponse | null>(null);
  const statsError = ref('');
  const operationError = ref('');
  const clearNamespaceForm = reactive({ namespace: '' });
  const clearOperationForm = reactive({ operation: '' });
  const operationHistory = ref<
    Array<{
      operation: string;
      success: boolean;
      message: string;
      timestamp: string;
      cleared_count?: number;
    }>
  >([]);
  const scope = useAiRequestScope(() => {
    statsLane.invalidate();
    writeLane.invalidate();
    loadingStats.value = false;
    clearingCache.value = false;
    clearAllModalVisible.value = false;
    cacheStats.value = null;
    statsError.value = '';
    operationError.value = '';
    operationHistory.value = [];
    clearNamespaceForm.namespace = '';
    clearOperationForm.operation = '';
  });
  const statsLane = scope.createLane();
  const writeLane = scope.createLane();
  async function refreshCacheStats() {
    if (!scope.owner.value) return;
    const ticket = statsLane.begin();
    loadingStats.value = true;
    statsError.value = '';
    try {
      const response = await getCacheStats();
      if (!statsLane.current(ticket)) return;
      if (
        !response ||
        typeof response.available !== 'boolean' ||
        typeof response.healthy !== 'boolean'
      )
        throw new Error('缓存状态响应格式无效');
      cacheStats.value = response;
      if (!response.available)
        statsError.value =
          response.message || '缓存服务不可用，请检查依赖后刷新';
    } catch (error) {
      if (!statsLane.current(ticket)) return;
      cacheStats.value = null;
      statsError.value =
        error instanceof Error
          ? error.message
          : '缓存状态读取失败，可通过刷新状态重试';
    } finally {
      if (statsLane.current(ticket)) loadingStats.value = false;
    }
  }
  async function runClear(
    operation: string,
    request: () => Promise<RCAClearCacheResponse>,
    onSuccess: () => void,
  ) {
    if (!scope.owner.value || clearingCache.value) return;
    const ticket = writeLane.begin();
    clearingCache.value = true;
    operationError.value = '';
    try {
      const response = await request();
      if (!writeLane.current(ticket)) return;
      if (!response.success)
        throw new Error(response.message || '缓存清理未完成');
      operationHistory.value.unshift({
        operation,
        success: true,
        message: response.message || '清理完成',
        timestamp: new Date().toISOString(),
        cleared_count: response.cleared_count,
      });
      operationHistory.value = operationHistory.value.slice(0, 50);
      onSuccess();
      message.success(response.message || '缓存清理完成');
      await refreshCacheStats();
    } catch (error) {
      if (!writeLane.current(ticket)) return;
      operationError.value =
        error instanceof Error
          ? error.message
          : '缓存清理失败，请核对实际状态后重试';
      operationHistory.value.unshift({
        operation,
        success: false,
        message: operationError.value,
        timestamp: new Date().toISOString(),
      });
      operationHistory.value = operationHistory.value.slice(0, 50);
    } finally {
      if (writeLane.current(ticket)) clearingCache.value = false;
    }
  }
  async function handleClearNamespaceCache() {
    const namespace = clearNamespaceForm.namespace.trim();
    if (!namespace) {
      message.warning('请输入命名空间');
      return;
    }
    await runClear(
      '清除命名空间缓存',
      () => clearNamespaceCache({ namespace }),
      () => {
        clearNamespaceForm.namespace = '';
      },
    );
  }
  async function handleClearOperationCache() {
    const operation = clearOperationForm.operation;
    if (!operation) {
      message.warning('请选择操作类型');
      return;
    }
    await runClear(
      '清除操作缓存',
      () => clearOperationCache({ operation }),
      () => {
        clearOperationForm.operation = '';
      },
    );
  }
  function showClearAllModal() {
    if (scope.owner.value && !clearingCache.value)
      clearAllModalVisible.value = true;
  }
  async function confirmClearAllCache() {
    if (!clearAllModalVisible.value) return;
    await runClear('清除所有缓存', clearAllCache, () => {
      clearAllModalVisible.value = false;
    });
  }
  function clearHistory() {
    operationHistory.value = [];
  }
  onMounted(refreshCacheStats);
  return {
    loadingStats,
    clearingCache,
    clearAllModalVisible,
    cacheStats,
    statsError,
    operationError,
    clearNamespaceForm,
    clearOperationForm,
    operationHistory,
    refreshCacheStats,
    handleClearNamespaceCache,
    handleClearOperationCache,
    showClearAllModal,
    confirmClearAllCache,
    clearHistory,
  };
}
