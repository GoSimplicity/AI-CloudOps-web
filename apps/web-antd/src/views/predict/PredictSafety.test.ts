import { reactive } from 'vue';

import {
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PredictAnalysis from './PredictAnalysis.vue';
import PredictDashboard from './PredictDashboard.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  predictCpu: vi.fn(),
  predictDisk: vi.fn(),
  predictMemory: vi.fn(),
  predictQps: vi.fn(),
}));
const charts = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
vi.mock('#/api/core/aiops/predict', () => ({
  ...api,
  PredictionGranularity: { DAY: 'day', HOUR: 'hour', MINUTE: 'minute' },
}));
vi.mock('echarts/core', () => ({
  init: () => {
    const chart = {
      clear: vi.fn(),
      dispose: vi.fn(),
      isDisposed: () => false,
      resize: vi.fn(),
      setOption: vi.fn(),
    };
    charts.instances.push(chart);
    return chart;
  },
  use: vi.fn(),
}));
let wrapper: undefined | VueWrapper;
const state = () => (required(wrapper).vm as any).$.setupState;
function render(component: any, actual = false) {
  wrapper = (actual ? mount : shallowMount)(component, {
    global: {
      config: { warnHandler: () => {} },
      plugins: [Antd],
      stubs: { Icon: true },
    },
  });
  return wrapper;
}
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const point = (timestamp = '2026-10-23T00:00:00Z', predicted_value = 0) => ({
  predicted_value,
  timestamp,
});
const response = () => ({
  ai_insights: ['private-one'],
  current_value: 0,
  predicted_data: [point()],
  resource_utilization: [],
  scaling_recommendations: [],
});
function fillDashboard() {
  state().inputData = {
    currentCpu: 0,
    currentDisk: 0,
    currentMemory: 0,
    currentQps: 0,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  charts.instances = [];
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline' });
  Object.values(api).forEach((fn) =>
    fn.mockImplementation(async () => response()),
  );
  vi.spyOn(message, 'success');
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

describe('预测显式调用与结果完整性', () => {
  it.each([PredictAnalysis, PredictDashboard])(
    '挂载不调用预测或模型',
    async (component) => {
      render(component);
      await flushPromises();
      Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    },
  );
  it.each([PredictAnalysis, PredictDashboard])(
    '北京时间只转换一次',
    (component) => {
      render(component);
      expect(state().formatTime('2026-10-23T00:00:00Z')).toBe(
        new Date('2026-10-23T00:00:00Z').toLocaleString('zh-CN', {
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          month: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
        }),
      );
    },
  );
  it('分析失败清除旧结果并显示服务原因', async () => {
    render(PredictAnalysis);
    state().formData.currentValue = 0;
    state().predictionResult = response();
    api.predictQps.mockRejectedValueOnce(new Error('连续历史不足两小时'));
    await state().startAnalysis();
    expect(state().predictionResult).toBeNull();
    expect(state().predictionError).toContain('连续历史不足');
    expect(message.success).not.toHaveBeenCalled();
  });
  it('切换预测类型后旧结果不能写回', async () => {
    const old = deferred();
    api.predictQps.mockReturnValueOnce(old.promise);
    render(PredictAnalysis);
    state().formData.currentValue = 0;
    const task = state().startAnalysis();
    state().formData.predictionType = 'cpu';
    state().onPredictionTypeChange();
    old.resolve(response());
    await task;
    expect(state().predictionResult).toBeNull();
    expect(state().analyzing).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });
  it.each([PredictAnalysis, PredictDashboard])(
    '换账户拒绝迟到预测与洞察',
    async (component) => {
      const old = deferred();
      api.predictQps.mockReturnValueOnce(old.promise);
      render(component);
      let task;
      if (component === PredictAnalysis) {
        state().formData.currentValue = 0;
        task = state().startAnalysis();
      } else {
        fillDashboard();
        task = state().refreshAllPredictions();
      }
      account.user.userInfo = { userId: '2' };
      old.resolve(response());
      await task;
      if (component === PredictAnalysis)
        expect(state().predictionResult).toBeNull();
      else {
        expect(state().predictionCache).toEqual({});
        expect(state().aiInsights).toEqual([]);
        expect(state().hasInitialData).toBe(false);
      }
      expect(message.success).not.toHaveBeenCalled();
    },
  );
  it('看板更改时长或AI开关不会隐式调用预测', async () => {
    render(PredictDashboard);
    fillDashboard();
    state().hasInitialData = true;
    state().onTimeRangeChange();
    state().onAIToggle();
    await flushPromises();
    Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
  it('看板重置后旧请求不能恢复预测结果', async () => {
    const old = deferred();
    api.predictQps.mockReturnValueOnce(old.promise);
    render(PredictDashboard);
    fillDashboard();
    const task = state().refreshAllPredictions();
    state().resetForm();
    old.resolve(response());
    await task;
    expect(state().predictionCache).toEqual({});
    expect(state().hasInitialData).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('置信区间保留真实零且缺失为null，不用预测值填补', () => {
    render(PredictAnalysis);
    state().predictionResult = {
      ...response(),
      predicted_data: [
        {
          ...point(),
          confidence_lower: 0,
          confidence_upper: 0,
          predicted_value: 5,
        },
        { ...point('2026-10-23T01:00:00Z'), predicted_value: 8 },
      ],
    };
    state().confidenceChartRef = document.createElement('div');
    state().initConfidenceChart();
    const option = charts.instances.at(-1).setOption.mock.calls.at(-1)[0];
    expect(
      option.series.find((series: any) => series.name === '置信下限').data,
    ).toEqual([0, null]);
    expect(
      option.series.find((series: any) => series.name === '置信上限').data,
    ).toEqual([0, null]);
  });
  it('看板横轴来自实际观测时间，缺失序列不填零并区分QPS与百分比轴', async () => {
    render(PredictDashboard);
    await flushPromises();
    state().trendChartRef = document.createElement('div');
    state().initTrendChart();
    state().predictionCache = {
      cpu: {
        ...response(),
        predicted_data: [point('2020-01-02T01:00:00Z', 25)],
      },
      qps: {
        ...response(),
        predicted_data: [point('2020-01-02T00:00:00Z', 0)],
      },
    };
    state().updateTrendChart();
    const option = charts.instances.at(-1).setOption.mock.calls.at(-1)[0];
    expect(option.xAxis.data).toHaveLength(2);
    expect(option.xAxis.data[0]).toContain('01/02');
    expect(option.series).toHaveLength(2);
    expect(option.series[0].data).toEqual([0, null]);
    expect(option.series[1].data).toEqual([null, 25]);
    expect(option.series[0].yAxisIndex).toBe(0);
    expect(option.series[1].yAxisIndex).toBe(1);
  });
  it('挂载后立即离开不会迟到注册窗口监听器', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    render(PredictDashboard);
    required(wrapper).unmount();
    await flushPromises();
    expect(add.mock.calls.filter((call) => call[0] === 'resize')).toEqual([]);
  });
});

describe('预测置信度与降级边界', () => {
  it('null 扩缩容置信度显示未知，失败的 AI 文本不会当作洞察', async () => {
    api.predictQps.mockResolvedValueOnce({
      ...response(),
      ai_enhanced: false,
      ai_fallback_reason: 'AI分析未完成',
      fallback_mode: true,
      fallback_reason: '预测模型不可用',
      method: 'rule_based',
      model_accuracy: null,
      scaling_recommendations: [
        {
          action: 'scale_up',
          confidence: null,
          reason: '规则',
          trigger_time: '2026-10-23T00:00:00Z',
        },
      ],
    });
    render(PredictAnalysis, true);
    state().formData.currentValue = 0;
    await state().startAnalysis();
    await flushPromises();
    expect(required(wrapper).text()).toContain('模型准确率: 未知');
    expect(required(wrapper).text()).toContain('置信度: 未知');
    expect(required(wrapper).text()).not.toContain('private-one');
    expect(state().hasConfidenceBounds).toBe(false);
    expect(message.success).not.toHaveBeenCalled();
  });
  it('看板只汇总已完成的 AI 洞察，保留真实零置信度', async () => {
    api.predictQps.mockResolvedValueOnce({
      ...response(),
      ai_enhanced: false,
      ai_fallback_reason: 'AI分析未完成',
      scaling_recommendations: [
        {
          action: 'scale_up',
          confidence: 0,
          reason: '规则',
          trigger_time: '2026-10-23T00:00:00Z',
        },
      ],
    });
    render(PredictDashboard, true);
    fillDashboard();
    await state().refreshAllPredictions();
    await flushPromises();
    expect(required(wrapper).text()).toContain('置信度: 0.0%');
    expect(state().aiInsights).not.toContain('QPS：private-one');
    expect(message.success).not.toHaveBeenCalled();
  });
});
