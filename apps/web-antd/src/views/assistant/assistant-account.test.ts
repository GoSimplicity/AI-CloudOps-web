import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantQuery from './AssistantQuery.vue';
import AssistantSession from './AssistantSession.vue';
import { createAssistantAccountScope } from '#/utils/assistant-account-scope';

const state = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  assistantQuery: vi.fn(),
  getSessionInfo: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => state.user,
  useAccessStore: () => state.access,
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('#/api/core/aiops/assistant', () => api);
let wrapper: VueWrapper;
const setup = () => (wrapper.vm as any).$?.setupState;
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
function mountScreen(component: any) {
  wrapper = mount(component, {
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'credential' });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('独立助手页面账户隔离', () => {
  it('页面挂载只展示现有信息，不发问答或会话搜索请求', async () => {
    mountScreen(AssistantQuery);
    await flushPromises();
    expect(api.assistantQuery).not.toHaveBeenCalled();
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
    expect(wrapper.findAll('button').map(button => button.text().replace(/\s+/g, ''))).toContain('发送');
    wrapper.unmount();
    mountScreen(AssistantSession);
    await flushPromises();
    expect(api.getSessionInfo).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('本地会话历史');
  });
  it('读取失败的原因保持可见，明确重试后更新且不发送查询成功提示', async () => {
    const toast = vi.spyOn(message, 'success');
    api.getSessionInfo.mockRejectedValueOnce(new Error('会话已过期，请重新创建'));
    mountScreen(AssistantSession);
    await wrapper.find('input').setValue('expired-id');
    const button = wrapper.findAll('button').find(item => item.text() === '搜索')!;
    await button.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('会话已过期');
    api.getSessionInfo.mockResolvedValueOnce({ session_id: 'owned', status: 'active' });
    await button.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('owned');
    expect(toast).not.toHaveBeenCalled();
  });
  it('换账户同步清除上一账户的错误原因', async () => {
    api.getSessionInfo.mockRejectedValueOnce(new Error('账户1私有错误原因'));
    mountScreen(AssistantSession);
    await wrapper.find('input').setValue('one-private-id');
    await wrapper.findAll('button').find(item => item.text() === '搜索')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('账户1私有错误原因');
    state.user.userInfo = { userId: '2' };
    await nextTick();
    expect(wrapper.text()).not.toContain('账户1私有错误原因');
  });
  it('会话管理只恢复本人缓存，切换与退出同步清空当前资料', () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    scope.write('history', [{ session_id: 'one', message_count: 2 }]);
    scope.setOwner('2');
    scope.write('history', [{ session_id: 'two', message_count: 3 }]);
    mountScreen(AssistantSession);
    expect(setup().sessionHistory[0].session_id).toBe('one');
    setup().currentSession.session_id = 'one';
    state.user.userInfo = { userId: '2' };
    expect(setup().currentSession.session_id).toBeUndefined();
    expect(setup().sessionHistory[0].session_id).toBe('two');
    state.access.accessToken = '';
    expect(setup().sessionHistory).toEqual([]);
    expect(setup().searchSessionId).toBe('');
  });
  it('搜索乱序与账户往返不能把旧会话写回当前页面', async () => {
    const old = deferred();
    const fresh = deferred();
    api.getSessionInfo
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    mountScreen(AssistantSession);
    setup().searchSessionId = 'old';
    const oldTask = setup().searchSession();
    state.user.userInfo = { userId: '2' };
    state.user.userInfo = { userId: '1' };
    setup().searchSessionId = 'fresh';
    const freshTask = setup().searchSession();
    fresh.resolve({ session_id: 'fresh' });
    await freshTask;
    old.resolve({ session_id: 'old' });
    await oldTask;
    expect(setup().currentSession.session_id).toBe('fresh');
  });
  it.each([403, 404])(
    '会话查询 %s 后丢弃对应本地记录和旧详情',
    async (status) => {
      api.getSessionInfo.mockRejectedValue({
        response: { status },
        message: 'denied',
      });
      const scope = createAssistantAccountScope(localStorage);
      scope.setOwner('1');
      scope.write('history', [{ session_id: 'invalid' }]);
      mountScreen(AssistantSession);
      setup().currentSession.session_id = 'previous';
      setup().searchSessionId = 'invalid';
      await setup().searchSession();
      expect(setup().currentSession.session_id).toBeUndefined();
      expect(setup().sessionHistory).toEqual([]);
      expect(scope.read('history')).toEqual([]);
    },
  );
  it('问答页换账户取消旧请求，并拒绝迟到结果影响新提问', async () => {
    const old = deferred();
    const fresh = deferred();
    api.assistantQuery
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    mountScreen(AssistantQuery);
    setup().questionInput = 'one private';
    const oldTask = setup().sendMessage();
    await nextTick();
    const signal = api.assistantQuery.mock.calls[0]![1].signal;
    state.user.userInfo = { userId: '2' };
    expect(signal.aborted).toBe(true);
    expect(setup().chatHistory).toEqual([]);
    setup().questionInput = 'two';
    const freshTask = setup().sendMessage();
    await nextTick();
    old.resolve({ answer: 'one private response', session_id: 'old' });
    await oldTask;
    expect(setup().isLoading).toBe(true);
    expect(setup().currentSessionId).toBe('');
    fresh.resolve({ answer: 'two response', session_id: 'fresh' });
    await freshTask;
    expect(setup().currentSessionId).toBe('fresh');
    expect(JSON.stringify(setup().chatHistory)).not.toContain('one private');
    state.user.userInfo = null;
    expect(setup().chatHistory).toEqual([]);
    expect(setup().currentSessionId).toBe('');
  });
  it.each([403, 404])(
    '问答页 %s 清理旧 SID，下次按新会话请求',
    async (status) => {
      api.assistantQuery
        .mockRejectedValueOnce({ response: { status }, message: 'invalid' })
        .mockResolvedValueOnce({ answer: 'new', session_id: 'fresh' });
      mountScreen(AssistantQuery);
      setup().currentSessionId = 'invalid';
      setup().questionInput = 'old';
      await setup().sendMessage();
      expect(setup().currentSessionId).toBe('');
      expect(setup().chatHistory).toEqual([]);
      setup().questionInput = 'fresh';
      await setup().sendMessage();
      await flushPromises();
      expect(api.assistantQuery.mock.calls[1]![0].session_id).toBeUndefined();
      expect(setup().currentSessionId).toBe('fresh');
    },
  );
});
