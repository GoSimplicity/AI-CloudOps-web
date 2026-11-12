import { reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssistantInfo from './AssistantInfo.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const state = vi.hoisted(() => ({
  access: null as any,
  allowed: true,
  user: null as any,
}));
const api = vi.hoisted(() => ({
  clearAssistantCache: vi.fn(),
  getAssistantConfig: vi.fn(),
  getAssistantInfo: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
}));
vi.mock('#/api/core/aiops/assistant', () => api);
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => state.allowed }),
}));
let wrapper: undefined | VueWrapper;
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};
async function screen() {
  wrapper = mount(AssistantInfo, {
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
}
function clearButton() {
  return required(wrapper)
    .findAll('button')
    .find((button) => button.text().replace(/\s/g, '') === '清除服务缓存');
}
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
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
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
  wrapper = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('助手服务缓存维护', () => {
  it('没有权限不显示入口，权限撤销后已有按钮也不能提交', async () => {
    state.allowed = false;
    await screen();
    expect(clearButton()).toBeUndefined();
    required(wrapper).unmount();
    state.allowed = true;
    await screen();
    const button = required(clearButton());
    state.allowed = false;
    await button.trigger('click');
    expect(api.clearAssistantCache).not.toHaveBeenCalled();
  });
  it('仅提交一次，明确成功后才提示，且不影响会话', async () => {
    const pending = deferred();
    api.clearAssistantCache.mockReturnValue(pending.promise);
    await screen();
    await required(clearButton()).trigger('click');
    await required(clearButton()).trigger('click');
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
    expect(message.success).not.toHaveBeenCalled();
    pending.resolve({ cleared: true });
    await flushPromises();
    expect(message.success).toHaveBeenCalledWith('服务缓存已清除');
    expect(required(clearButton()).attributes('disabled')).toBeUndefined();
  });
  it.each([{}, { cleared: false }])('拒绝未确认响应 %j', async (result) => {
    api.clearAssistantCache.mockResolvedValue(result);
    await screen();
    await required(clearButton()).trigger('click');
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      '未确认服务缓存清理成功，请核查服务状态后再操作',
    );
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
  });
  it('失败使用通用提示，不泄露服务错误，也不自动重试', async () => {
    api.clearAssistantCache.mockRejectedValue(new Error('private diagnostic'));
    await screen();
    await required(clearButton()).trigger('click');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith(
      '未确认服务缓存清理成功，请核查服务状态后再操作',
    );
    expect(api.clearAssistantCache).toHaveBeenCalledTimes(1);
  });
  it('取消请求不提示失败', async () => {
    api.clearAssistantCache.mockRejectedValue({ code: 'ERR_CANCELED' });
    await screen();
    await required(clearButton()).trigger('click');
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
  });
  it.each(['owner', 'logout', 'unmount'])(
    '%s 之后废弃迟到成功',
    async (change) => {
      const pending = deferred();
      api.clearAssistantCache.mockReturnValue(pending.promise);
      await screen();
      await required(clearButton()).trigger('click');
      if (change === 'owner') state.user.userInfo = { userId: '2' };
      if (change === 'logout') state.access.accessToken = '';
      if (change === 'unmount') required(wrapper).unmount();
      await flushPromises();
      pending.resolve({ cleared: true });
      await flushPromises();
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    },
  );
  it('切换用户后旧失败不能覆盖新操作状态', async () => {
    const old = deferred();
    const current = deferred();
    api.clearAssistantCache
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    await screen();
    await required(clearButton()).trigger('click');
    state.user.userInfo = { userId: '2' };
    await flushPromises();
    await required(clearButton()).trigger('click');
    old.reject(new Error('old failure'));
    await flushPromises();
    expect(required(clearButton()).attributes('disabled')).toBeDefined();
    expect(message.error).not.toHaveBeenCalled();
    current.resolve({ cleared: true });
    await flushPromises();
    expect(message.success).toHaveBeenCalledTimes(1);
  });
});
