import { shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import RCADiagnosis from './RCADiagnosis.vue';
vi.mock('@vben/stores', () => ({ useUserStore: () => reactive({ userInfo: { userId: '1' } }), useAccessStore: () => reactive({ accessToken: 'offline' }) }));
const api = vi.hoisted(() => ({ quickDiagnosis: vi.fn(), getEventPatterns: vi.fn(), getErrorSummary: vi.fn(), analyzeRootCause: vi.fn() }));
const messages = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock('#/api/core/aiops/rca', () => api);
vi.mock('ant-design-vue', () => ({ message: messages }));
vi.mock('echarts/core', () => ({ use: vi.fn(), init: () => ({ setOption: vi.fn(), clear: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: () => false }) }));

describe('RCA unavailable service', () => {
  it('removes a prior healthy result and reports failure when every endpoint fails', async () => {
    Object.values(api).forEach(fn => fn.mockRejectedValue(new Error('unavailable')));
    const wrapper = shallowMount(RCADiagnosis, { global: { config: { warnHandler: () => {} } } });
    const state = (wrapper.vm as any).$.setupState;
    state.inputData.namespace = 'default';
    state.quickDiagnosisResult = { status: 'healthy', critical_issues: [], warnings: [] };
    await state.refreshAllDiagnosis();
    expect(state.quickDiagnosisResult).toBeNull();
    expect(state.hasInitialData).toBe(false);
    expect(state.diagnosisFailures.length).toBeGreaterThan(0);
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).toHaveBeenCalled();
    wrapper.unmount();
  });
});
