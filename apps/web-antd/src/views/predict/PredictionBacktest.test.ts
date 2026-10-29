import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { reactive, ref } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PredictionBacktest from './PredictionBacktest.vue';

const fixtures = vi.hoisted(() => ({ user: null as any, access: null as any, allowed: null as any, run: vi.fn() }));
vi.mock('@vben/stores', () => ({ useUserStore: () => fixtures.user, useAccessStore: () => fixtures.access }));
vi.mock('#/utils/permission', () => ({ usePermission: () => ({ hasPerm: () => fixtures.allowed.value }) }));
vi.mock('#/api/core/aiops/prediction-backtest', () => ({ runPredictionBacktest: fixtures.run }));

let wrapper: VueWrapper;
const record = { issued_at: '2026-01-01T00:00:00Z', target_at: '2026-01-01T01:00:00Z', observed_at: '2026-01-01T01:00:00Z', forecast: 4, actual: 5 };
const response = { sample_count: 1, horizon_seconds: 3600, mae: 1, rmse: 1, bias: 1, wape: null, evidence: '证据限制', calibration: { method: 'test', window: 200, minimum_history: 20, evaluated_count: 0, observed_coverage: null, residual_lower: null, residual_upper: null, reference_time: record.observed_at } };
function render() { wrapper = mount(PredictionBacktest, { global: { plugins: [Antd] } }); }
async function submit() { await wrapper.find('button').trigger('click'); await flushPromises(); }
beforeEach(() => {
  fixtures.user = reactive({ userInfo: { userId: '1' } });
  fixtures.access = reactive({ accessToken: 'offline' });
  fixtures.allowed = ref(true);
  fixtures.run.mockReset().mockResolvedValue(response);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });

it('只在显式提交后计算，缺失覆盖率显示未知', async () => {
  render();
  expect(fixtures.run).not.toHaveBeenCalled();
  await wrapper.find('textarea').setValue(JSON.stringify([record]));
  await submit();
  expect(fixtures.run).toHaveBeenCalledWith([record]);
  expect(wrapper.text()).toContain('样本 1 条');
  expect(wrapper.text()).toContain('未知');
  expect(wrapper.text()).toContain('证据限制');
});
it('无权限和无效 JSON 均不请求', async () => {
  fixtures.allowed.value = false;
  render();
  expect(wrapper.text()).toContain('没有回测权限');
  expect(fixtures.run).not.toHaveBeenCalled();
  fixtures.allowed.value = true;
  await flushPromises();
  await wrapper.find('textarea').setValue('{broken');
  await submit();
  expect(wrapper.text()).toContain('有效的 JSON');
  expect(fixtures.run).not.toHaveBeenCalled();
});
it('身份变化使在途响应失效且清除输入', async () => {
  let resolve!: (value: unknown) => void;
  fixtures.run.mockReturnValue(new Promise((done) => { resolve = done; }));
  render();
  await wrapper.find('textarea').setValue(JSON.stringify([record]));
  await wrapper.find('button').trigger('click');
  fixtures.user.userInfo = { userId: '2' };
  resolve(response);
  await flushPromises();
  expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
  expect(wrapper.text()).not.toContain('样本 1 条');
});
it('异常结果不显示为成功', async () => {
  fixtures.run.mockResolvedValue({ ...response, mae: null });
  render();
  await wrapper.find('textarea').setValue(JSON.stringify([record]));
  await submit();
  expect(wrapper.text()).toContain('结果格式异常');
  expect(wrapper.text()).not.toContain('样本 1 条');
});
