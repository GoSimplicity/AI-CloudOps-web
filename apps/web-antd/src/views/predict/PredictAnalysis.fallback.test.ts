import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PredictAnalysis from './PredictAnalysis.vue';

const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  predictCpu: vi.fn(),
  predictDisk: vi.fn(),
  predictMemory: vi.fn(),
  predictQps: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
vi.mock('#/api/core/aiops/predict', () => ({
  ...api,
  PredictionGranularity: { DAY: 'day', HOUR: 'hour', MINUTE: 'minute' },
}));
vi.mock('echarts/core', () => ({
  init: () => ({
    dispose: vi.fn(),
    isDisposed: () => false,
    resize: vi.fn(),
    setOption: vi.fn(),
  }),
  use: vi.fn(),
}));

let wrapper: undefined | VueWrapper;
const state = () =>
  (wrapper as VueWrapper).vm as unknown as {
    formData: { currentValue: null | number };
    startAnalysis: () => Promise<void>;
  };

function baseResult(extra: Record<string, unknown> = {}) {
  return {
    current_value: 10,
    pattern_analysis: {
      has_periodicity: false,
      seasonality: {
        daily_pattern: false,
        monthly_pattern: false,
        weekly_pattern: null,
      },
      volatility: 0,
    },
    predicted_data: [
      { predicted_value: 12, timestamp: '2026-10-23T00:00:00Z' },
    ],
    prediction_interpretation: {
      quantitative_metrics: {
        trend_analysis: { change_percentage: null, direction: 'stable' },
        value_statistics: { mean: null, median: 0 },
      },
    },
    resource_utilization: [],
    scaling_recommendations: [],
    ...extra,
  };
}

async function analyze(result: Record<string, unknown>) {
  api.predictQps.mockResolvedValueOnce(result);
  wrapper = mount(PredictAnalysis, {
    global: {
      config: { warnHandler: () => {} },
      plugins: [Antd],
      stubs: { Icon: true },
    },
  });
  state().formData.currentValue = 10;
  await state().startAnalysis();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  account.user = { userInfo: { userId: '1' } };
  account.access = { accessToken: 'offline' };
  vi.spyOn(message, 'success').mockImplementation(() => ({}) as never);
  vi.spyOn(message, 'warning').mockImplementation(() => ({}) as never);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('预测分析降级和缺测展示', () => {
  it('降级时显示原因，原因为空时使用默认可读文案', async () => {
    const degraded = await analyze(
      baseResult({
        fallback_mode: true,
        fallback_reason: '预测模型不可用',
      }),
    );
    const alert = degraded.get('.fallback-alert');
    expect(alert.text()).toContain('预测已降级');
    expect(alert.text()).toContain('预测模型不可用');

    degraded.unmount();
    const emptyReason = await analyze(
      baseResult({
        ai_fallback_reason: 'AI分析失败',
        fallback_mode: true,
        fallback_reason: null,
      }),
    );
    expect(emptyReason.get('.fallback-alert').text()).toContain('原因未知');
    expect(emptyReason.get('.fallback-alert').text()).not.toContain(
      'AI分析失败',
    );
    expect(emptyReason.find('.fallback-unknown').exists()).toBe(false);
  });

  it('fallback_mode 为 false 但原因不为空时显示降级和原文', async () => {
    const view = await analyze(
      baseResult({
        fallback_mode: false,
        fallback_reason: '调用方标记降级',
      }),
    );
    const alert = view.get('.fallback-alert');
    expect(alert.text()).toContain('预测已降级');
    expect(alert.text()).toContain('调用方标记降级');
    expect(alert.text()).not.toContain('原因未知');
    expect(view.find('.fallback-unknown').exists()).toBe(false);
  });

  it('fallback_mode 缺失或 null 且没有原因时显示灰色未知提示', async () => {
    for (const extra of [
      { ai_fallback_reason: 'AI分析失败' },
      {
        ai_fallback_reason: 'AI分析失败',
        fallback_mode: null,
        fallback_reason: '   ',
      },
    ]) {
      const view = await analyze(baseResult(extra));
      expect(view.find('.fallback-alert').exists()).toBe(false);
      const hint = view.get('.fallback-unknown');
      expect(hint.classes()).toContain('ant-typography-secondary');
      expect(hint.text()).toBe('降级状态未知');
      expect(view.text()).toContain('预测结果');
      view.unmount();
    }
  });

  it('fallback_mode 为 false 且没有原因时不显示降级或未知提示', async () => {
    const view = await analyze(
      baseResult({
        ai_fallback_reason: 'AI分析失败',
        fallback_mode: false,
        fallback_reason: '  ',
      }),
    );
    expect(view.find('.fallback-alert').exists()).toBe(false);
    expect(view.find('.fallback-unknown').exists()).toBe(false);
    expect(view.text()).toContain('预测结果');
    expect(view.text()).not.toContain('预测已降级');
    expect(view.text()).not.toContain('降级状态未知');
  });

  it('fallback_mode 缺失但原因不为空时显示降级和原文', async () => {
    const view = await analyze(
      baseResult({ fallback_reason: '  上游原文原因  ' }),
    );
    const alert = view.get('.fallback-alert');
    expect(alert.text()).toContain('预测已降级');
    expect(alert.text()).toContain('上游原文原因');
    expect(alert.text()).not.toContain('原因未知');
    expect(view.find('.fallback-unknown').exists()).toBe(false);
  });

  it('false 按布尔显示，null 和缺失显示破折号，0 仍显示 0', async () => {
    const view = await analyze(baseResult());
    const text = view.get('[aria-label="模式与量化指标"]').text();
    expect(text).toContain('周期性：否');
    expect(text).toContain('日周期：否');
    expect(text).toContain('周周期：—');
    expect(text).toContain('波动：0');
    expect(text).toContain('平均值：—');
    expect(text).toContain('中位数：0');
    expect(text).toContain('变化率：—');
  });

  it('导出 JSON 保留 null 和 false，不替换成展示文案', async () => {
    const payload = baseResult({
      fallback_mode: false,
      fallback_reason: null,
    });
    const view = await analyze(payload);
    const captured: string[] = [];
    const RealBlob = Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation((parts?: BlobPart[]) => {
      captured.push((parts ?? []).map(String).join(''));
      return new RealBlob(parts);
    });
    URL.createObjectURL ??= () => 'blob:local';
    URL.revokeObjectURL ??= () => {};
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const exportButton = view
      .findAll('button')
      .find((button) => button.text().includes('导出'));
    await exportButton?.trigger('click');
    const exported = captured[0] ?? '';
    expect(exported).toContain('"fallback_mode": false');
    expect(exported).toContain('"fallback_reason": null');
    expect(exported).toContain('"has_periodicity": false');
    expect(exported).toContain('"change_percentage": null');
    expect(exported).not.toContain('—');
    expect(exported).not.toContain('原因未知');
  });
});
