import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantInfo from './AssistantInfo.vue';

const state = vi.hoisted(() => ({ user: null as any, access: null as any, allowed: true }));
const api = vi.hoisted(() => ({ clearAssistantCache: vi.fn(), getAssistantInfo: vi.fn(), getAssistantConfig: vi.fn() }));
vi.mock('@vben/stores', () => ({ useUserStore: () => state.user, useAccessStore: () => state.access }));
vi.mock('#/api/core/aiops/assistant', () => api);
vi.mock('#/utils/permission', () => ({ usePermission: () => ({ can: () => state.allowed }) }));
let wrapper: VueWrapper | undefined;
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function screen() {
  wrapper = mount(AssistantInfo, { global: { plugins: [Antd], stubs: { Icon: true } } });
  await flushPromises();
}
function clearButton() { return wrapper!.findAll('button').find((button) => button.text().replace(/\s/g, '') === '清除服务缓存')!; }
beforeEach(() => {
  vi.clearAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'fixture' });
  state.allowed = true;
  api.getAssistantInfo.mockResolvedValue({ status: 'initialized' });
  api.getAssistantConfig.mockResolvedValue({ config: {} });
  api.clearAssistantCache.mockResolvedValue({ cleared: true });
  vi.spyOn(message, 'success').mockImplementation(() => undefined as any);
  vi.spyOn(message, 'error').mockImplementation(() => undefined as any);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => style(element));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('助手服务缓存维护', () => {
  it('没有权限不显示入口，权限撤销后已有按钮也不能提交', async () => {
    state.allowed = false;
    await screen();
    expect(clearButton()).toBeUndefined();
    wrapper!.unmount();
    state.allowed = true;
    await screen();
    const button = clearButton();
    state.allowed = false;
    await button.trigger('click');
    expect(api.clearAssistantCache).not.toHaveBeenCalled();
  });
  it('仅提交一次，明确成功后才提示，且不影响会话', async () => {
    const pending = deferred();
    api.clearAssistantCache.mockReturnValue(pending.promise);
    await screen();
    await clearButton().trigger('click');
    await clearButton().trigger('click');
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
    expect(message.success).not.toHaveBeenCalled();
    pending.resolve({ cleared: true });
    await flushPromises();
    expect(message.success).toHaveBeenCalledWith('服务缓存已清除');
    expect(clearButton().attributes('disabled')).toBeUndefined();
  });
  it.each([{}, { cleared: false }])('拒绝未确认响应 %j', async (result) => {
    api.clearAssistantCache.mockResolvedValue(result);
    await screen();
    await clearButton().trigger('click');
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('未确认服务缓存清理成功，请核查服务状态后再操作');
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
  });
  it('失败使用通用提示，不泄露服务错误，也不自动重试', async () => {
    api.clearAssistantCache.mockRejectedValue(new Error('private diagnostic'));
    await screen();
    await clearButton().trigger('click');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith('未确认服务缓存清理成功，请核查服务状态后再操作');
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
  });
  it('取消请求不提示失败', async () => {
    api.clearAssistantCache.mockRejectedValue({ code: 'ERR_CANCELED' });
    await screen();
    await clearButton().trigger('click');
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
  });
  it.each(['owner', 'logout', 'unmount'])('%s 之后废弃迟到成功', async (change) => {
    const pending = deferred();
    api.clearAssistantCache.mockReturnValue(pending.promise);
    await screen();
    await clearButton().trigger('click');
    if (change === 'owner') state.user.userInfo = { userId: '2' };
    if (change === 'logout') state.access.accessToken = '';
    if (change === 'unmount') wrapper!.unmount();
    await flushPromises();
    pending.resolve({ cleared: true });
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  });
  it('切换用户后旧失败不能覆盖新操作状态', async () => {
    const old = deferred();
    const current = deferred();
    api.clearAssistantCache.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await screen();
    await clearButton().trigger('click');
    state.user.userInfo = { userId: '2' };
    await flushPromises();
    await clearButton().trigger('click');
    old.reject(new Error('old failure'));
    await flushPromises();
    expect(clearButton().attributes('disabled')).toBeDefined();
    expect(message.error).not.toHaveBeenCalled();
    current.resolve({ cleared: true });
    await flushPromises();
    expect(message.success).toHaveBeenCalledTimes(1);
  });
});
