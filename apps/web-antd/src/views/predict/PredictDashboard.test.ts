import { shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PredictDashboard from './PredictDashboard.vue';

vi.mock('@vben/stores', () => ({
  useUserStore: () => reactive({ userInfo: { userId: '1' } }),
  useAccessStore: () => reactive({ accessToken: 'offline' }),
}));
const api = vi.hoisted(() => ({
  predictQps: vi.fn(),
  predictCpu: vi.fn(),
  predictMemory: vi.fn(),
  predictDisk: vi.fn(),
}));
const messages = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock('#/api/core/aiops/predict', () => api);
vi.mock('ant-design-vue', () => ({ message: messages }));
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

describe('prediction refresh failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(api).forEach((fn) =>
      fn.mockRejectedValue(new Error('unavailable')),
    );
  });
  it('clears previous successful values and never reports success when all predictions fail', async () => {
    const wrapper = shallowMount(PredictDashboard, {
      global: { config: { warnHandler: () => {} } },
    });
    const state = (wrapper.vm as any).$.setupState;
    state.inputData = {
      currentQps: 0,
      currentCpu: 20,
      currentMemory: 30,
      currentDisk: 40,
    };
    state.predictionCache = { qps: { current_value: 99 } };
    await state.refreshAllPredictions();
    expect(state.predictionCache).toEqual({});
    expect(state.hasInitialData).toBe(false);
    expect(state.predictionFailures).toHaveLength(4);
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).toHaveBeenCalled();
    wrapper.unmount();
  });
  it('keeps only successful metrics and marks partial failures', async () => {
    api.predictCpu.mockResolvedValue({ current_value: 20, predicted_data: [] });
    const wrapper = shallowMount(PredictDashboard, {
      global: { config: { warnHandler: () => {} } },
    });
    const state = (wrapper.vm as any).$.setupState;
    state.inputData = {
      currentQps: 10,
      currentCpu: 20,
      currentMemory: 30,
      currentDisk: 40,
    };
    await state.refreshAllPredictions();
    expect(Object.keys(state.predictionCache)).toEqual(['cpu']);
    expect(state.hasInitialData).toBe(true);
    expect(state.predictionFailures).toHaveLength(3);
    expect(messages.success).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
