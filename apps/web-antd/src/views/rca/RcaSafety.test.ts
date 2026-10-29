import {
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RCAAnalysis from './RCAAnalysis.vue';
import RCADiagnosis from './RCADiagnosis.vue';
import RCACache from './RCACache.vue';

const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  analyzeRootCause: vi.fn(),
  getAllPrometheusMetrics: vi.fn(),
  quickDiagnosis: vi.fn(),
  getEventPatterns: vi.fn(),
  getErrorSummary: vi.fn(),
  getCacheStats: vi.fn(),
  clearAllCache: vi.fn(),
  clearNamespaceCache: vi.fn(),
  clearOperationCache: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => account.user,
  useAccessStore: () => account.access,
}));
vi.mock('#/api/core/aiops/rca', () => api);
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: () => ({
    setOption: vi.fn(),
    clear: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    isDisposed: () => false,
  }),
}));
let wrapper: VueWrapper | undefined;
const state = () => (wrapper!.vm as any).$.setupState;
function render(component: any, actual = false) {
  wrapper = (actual ? mount : shallowMount)(component, {
    global: {
      plugins: [Antd],
      stubs: { Icon: true },
      config: { warnHandler: () => {} },
    },
  });
  return wrapper;
}
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { resolve, promise };
}
beforeEach(() => {
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline' });
  api.getAllPrometheusMetrics.mockResolvedValue([]);
  api.getCacheStats.mockResolvedValue({
    healthy: true,
    available: true,
    total_keys: 0,
    hit_rate: 0,
    timestamp: '2026-10-23T00:00:00Z',
  });
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RCA请求与账户边界', () => {
  it('挂载分析/诊断页不调用模型或诊断入口', async () => {
    render(RCAAnalysis);
    await flushPromises();
    wrapper!.unmount();
    render(RCADiagnosis);
    await flushPromises();
    expect(api.analyzeRootCause).not.toHaveBeenCalled();
    expect(api.quickDiagnosis).not.toHaveBeenCalled();
  });
  it('缓存统计直接读取真实请求，不使用计时器伪造阶段', async () => {
    render(RCACache);
    await flushPromises();
    expect(api.getCacheStats).toHaveBeenCalledTimes(1);
    expect(state().cacheStats.total_keys).toBe(0);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('缓存读取失败清空旧健康状态并保留真实原因', async () => {
    render(RCACache);
    await flushPromises();
    state().cacheStats = { healthy: true, available: true };
    api.getCacheStats.mockRejectedValueOnce(new Error('缓存连接已断开'));
    await state().refreshCacheStats();
    expect(state().cacheStats).toBeNull();
    expect(state().statsError).toContain('缓存连接已断开');
    expect(message.success).not.toHaveBeenCalled();
  });
  it('未知或超范围命中率不会显示成合法零值', () => {
    render(RCACache);
    expect(state().formatHitRate(0)).toBe('0.0%');
    expect(state().formatHitRate(Number.NaN)).toBe('未知');
    expect(state().formatHitRate(-1)).toBe('未知');
    expect(state().formatHitRate(101)).toBe('未知');
  });
  it('取消清除全部缓存不会写API', async () => {
    render(RCACache, true);
    await flushPromises();
    state().showClearAllModal();
    await nextTick();
    const cancel = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.replace(/\s/g, '') === '取消',
    );
    expect(cancel).toBeTruthy();
    cancel!.click();
    await flushPromises();
    expect(api.clearAllCache).not.toHaveBeenCalled();
    expect(api.clearNamespaceCache).not.toHaveBeenCalled();
    expect(api.clearOperationCache).not.toHaveBeenCalled();
  });
  it('根因分析失败不会继续展示先前成功结果', async () => {
    render(RCAAnalysis);
    await flushPromises();
    state().formData.namespace = 'default';
    state().analysisResult = { namespace: 'old-private', root_causes: [] };
    api.analyzeRootCause.mockRejectedValueOnce(new Error('数据不足，不能分析'));
    await state().startAnalysis();
    expect(state().analysisResult).toBeNull();
    expect(state().analysisError).toContain('数据不足');
    expect(message.success).not.toHaveBeenCalled();
  });
  it('指标目录失败会清空上一份列表', async () => {
    render(RCAAnalysis);
    await flushPromises();
    state().availableMetrics = [{ label: 'old', value: 'old' }];
    api.getAllPrometheusMetrics.mockRejectedValueOnce(
      new Error('prometheus不可达'),
    );
    await state().loadAvailableMetrics();
    expect(state().availableMetrics).toEqual([]);
    expect(state().metricsError).toContain('prometheus不可达');
  });
  it('根因分析换账户拒绝迟到结果并清除旧资料', async () => {
    const old = deferred();
    api.analyzeRootCause.mockReturnValueOnce(old.promise);
    render(RCAAnalysis);
    await flushPromises();
    state().formData.namespace = 'default';
    const task = state().startAnalysis();
    account.user.userInfo = { userId: '2' };
    old.resolve({ namespace: 'private-one', root_causes: [] });
    await task;
    expect(state().analysisResult).toBeNull();
    expect(state().analyzing).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('诊断换账户拒绝迟到结果并停止自动刷新', async () => {
    const old = deferred();
    api.quickDiagnosis.mockReturnValueOnce(old.promise);
    api.getEventPatterns.mockResolvedValueOnce({ patterns: [] });
    render(RCADiagnosis);
    state().inputData.namespace = 'default';
    state().autoRefresh = true;
    state().startAutoRefresh();
    const task = state().refreshAllDiagnosis();
    account.user.userInfo = { userId: '2' };
    old.resolve({ status: 'healthy', critical_issues: [], warnings: [] });
    await task;
    expect(state().quickDiagnosisResult).toBeNull();
    expect(state().hasInitialData).toBe(false);
    expect(state().autoRefresh).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('缓存换账户拒绝迟到统计、关闭确认并清除操作历史', async () => {
    const old = deferred();
    api.getCacheStats.mockReturnValueOnce(old.promise);
    render(RCACache);
    state().operationHistory = [{ operation: 'private-one' }];
    state().clearAllModalVisible = true;
    account.user.userInfo = { userId: '2' };
    old.resolve({ healthy: true, available: true, total_keys: 42 });
    await flushPromises();
    expect(state().cacheStats).toBeNull();
    expect(state().operationHistory).toEqual([]);
    expect(state().clearAllModalVisible).toBe(false);
  });
  it('缓存清理的旧账户响应不能写入新账户历史或触发新统计', async () => {
    render(RCACache);
    await flushPromises();
    const old = deferred();
    api.clearAllCache.mockReturnValueOnce(old.promise);
    state().showClearAllModal();
    const task = state().confirmClearAllCache();
    account.user.userInfo = { userId: '2' };
    old.resolve({ success: true, message: 'old-private', cleared_count: 5 });
    await task;
    expect(state().operationHistory).toEqual([]);
    expect(state().cacheStats).toBeNull();
    expect(api.getCacheStats).toHaveBeenCalledTimes(1);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('诊断时间取实际响应，缺失时不制造当前时间', () => {
    render(RCADiagnosis);
    expect(state().getCurrentTime()).toBe('未知');
    state().quickDiagnosisResult = { timestamp: '2020-01-02T03:04:05Z' };
    expect(state().getCurrentTime()).toBe(
      new Date('2020-01-02T03:04:05Z').toLocaleString('zh-CN'),
    );
  });
});

describe('RCA采集状态', () => {
  const result = (status: string, coverage: number | null) => ({
    status, namespace: 'default', analysis_id: 'fixture-id', timestamp: '2026-10-23T00:00:00Z', time_window_hours: 2,
    confidence_score: 0.9, root_causes: [], anomalies: {}, correlations: [], recommendations: [],
    collection: { coverage, sources: { metrics: { status: 'success', count: 3 }, events: { status: 'empty', count: 0 }, logs: { status: 'partial', count: 1 } } },
  });
  it('完成时呈现覆盖率及空数据，与采集失败区分', async () => {
    api.analyzeRootCause.mockResolvedValueOnce(result('completed', 1));
    render(RCAAnalysis, true);
    await flushPromises();
    await state().startAnalysis();
    await flushPromises();
    expect(wrapper!.text()).toContain('分析完成');
    expect(wrapper!.text()).toContain('100.0%');
    expect(wrapper!.text()).toContain('采集成功，数据为空');
    expect(wrapper!.text()).toContain('部分采集失败');
    expect(message.success).toHaveBeenCalled();
  });
  it('降级时空覆盖率显示未知，并保留可用结果', async () => {
    api.analyzeRootCause.mockResolvedValueOnce(result('degraded', null));
    render(RCAAnalysis, true);
    await flushPromises();
    await state().startAnalysis();
    await flushPromises();
    expect(wrapper!.text()).toContain('分析降级');
    expect(wrapper!.text()).toContain('采集覆盖率：未知');
    expect(wrapper!.text()).toContain('置信度');
    expect(message.success).not.toHaveBeenCalled();
  });
  it('失败和未知状态不能显示置信度、根因或成功提示', async () => {
    for (const status of ['failed', 'unexpected']) {
      api.analyzeRootCause.mockResolvedValueOnce({ ...result(status, null), root_causes: [{ description: '不可用的根因' }] });
      render(RCAAnalysis, true);
      await flushPromises();
      await state().startAnalysis();
      await flushPromises();
      expect(wrapper!.text()).toContain(status === 'failed' ? '分析失败' : '状态未知');
      expect(wrapper!.text()).not.toContain('不可用的根因');
      expect(wrapper!.text()).not.toContain('置信度');
      expect(message.success).not.toHaveBeenCalled();
      wrapper!.unmount();
    }
  });
  it('快速诊断失败不能把空问题列表显示成无异常', async () => {
    api.quickDiagnosis.mockResolvedValueOnce({ ...result('failed', 0), critical_issues: [], warnings: [] });
    api.getEventPatterns.mockResolvedValueOnce({ patterns: [] });
    render(RCADiagnosis, true);
    await flushPromises();
    await state().refreshAllDiagnosis();
    await flushPromises();
    expect(wrapper!.text()).toContain('分析失败');
    expect(wrapper!.text()).toContain('结果不可用');
    expect(wrapper!.text()).not.toContain('本次未见关键问题');
    expect(message.success).not.toHaveBeenCalled();
  });
});
