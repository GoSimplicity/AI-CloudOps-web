import { reactive } from 'vue';

import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import RCADiagnosis from './RCADiagnosis.vue';

vi.mock('@vben/stores', () => ({
  useAccessStore: () => reactive({ accessToken: 'offline' }),
  useUserStore: () => reactive({ userInfo: { userId: '1' } }),
}));
const api = vi.hoisted(() => ({
  analyzeRootCause: vi.fn(),
  getErrorSummary: vi.fn(),
  getEventPatterns: vi.fn(),
  quickDiagnosis: vi.fn(),
}));
const messages = vi.hoisted(() => ({
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('#/api/core/aiops/rca', () => api);
vi.mock('ant-design-vue', () => ({ message: messages }));
vi.mock('echarts/core', () => ({
  init: () => ({
    clear: vi.fn(),
    dispose: vi.fn(),
    isDisposed: () => false,
    resize: vi.fn(),
    setOption: vi.fn(),
  }),
  use: vi.fn(),
}));

describe('rCA unavailable service', () => {
  it('removes a prior healthy result and reports failure when every endpoint fails', async () => {
    Object.values(api).forEach((fn) =>
      fn.mockRejectedValue(new Error('unavailable')),
    );
    const wrapper = shallowMount(RCADiagnosis, {
      global: { config: { warnHandler: () => {} } },
    });
    const state = (wrapper.vm as any).$.setupState;
    state.inputData.namespace = 'default';
    state.quickDiagnosisResult = {
      critical_issues: [],
      status: 'healthy',
      warnings: [],
    };
    await state.refreshAllDiagnosis();
    expect(state.quickDiagnosisResult).toBeNull();
    expect(state.hasInitialData).toBe(false);
    expect(state.diagnosisFailures.length).toBeGreaterThan(0);
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).toHaveBeenCalled();
    wrapper.unmount();
  });
});
