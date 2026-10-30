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
  createAssistantSession: vi.fn(),
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
  api.createAssistantSession.mockImplementation(async () => ({ session_id: state.user.userInfo?.userId === '2' ? 'fresh' : 'old' }));
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
    await flushPromises();
    const signal = api.assistantQuery.mock.calls[0]![1].signal;
    state.user.userInfo = { userId: '2' };
    expect(signal.aborted).toBe(true);
    expect(setup().chatHistory).toEqual([]);
    setup().questionInput = 'two';
    const freshTask = setup().sendMessage();
    await flushPromises();
    old.resolve({ answer: 'one private response', session_id: 'old', turn_id: api.assistantQuery.mock.calls[0]![0].turn_id });
    await oldTask;
    expect(setup().isLoading).toBe(true);
    expect(setup().currentSessionId).toBe('fresh');
    fresh.resolve({ answer: 'two response', session_id: 'fresh', turn_id: api.assistantQuery.mock.calls[1]![0].turn_id });
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
        .mockImplementationOnce(async (req) => ({ answer: 'new', session_id: req.session_id, turn_id: req.turn_id }));
      mountScreen(AssistantQuery);
      setup().currentSessionId = 'invalid';
      setup().questionInput = 'old';
      await setup().sendMessage();
      expect(setup().currentSessionId).toBe('');
      expect(setup().chatHistory).toEqual([]);
      setup().questionInput = 'fresh';
      await setup().sendMessage();
      await flushPromises();
      expect(api.createAssistantSession).toHaveBeenCalledTimes(1);
      expect(api.assistantQuery.mock.calls[1]![0].session_id).toBe('old');
      expect(setup().currentSessionId).toBe('old');
    },
  );
  it('查询状态未知时不重发，确认完成后用同一 turn_id 读取结果', async () => {
    api.assistantQuery.mockReset().mockRejectedValueOnce(new Error('interrupted'))
      .mockImplementationOnce(async (req) => ({ answer: '已恢复', session_id: req.session_id, turn_id: req.turn_id }));
    mountScreen(AssistantQuery);
    setup().questionInput = '核对问题';
    await setup().sendMessage();
    const request = api.assistantQuery.mock.calls[0]![0];
    expect(request.session_id).toBe('old');
    expect(request.turn_id).toBeTruthy();
    expect(setup().pendingTurn.turnId).toBe(request.turn_id);
    api.getSessionInfo.mockResolvedValueOnce({ session_id: 'old', status: 'unknown' });
    await setup().recoverTurn();
    expect(api.assistantQuery).toHaveBeenCalledTimes(1);
    api.getSessionInfo.mockResolvedValueOnce({ session_id: 'old', status: 'idle', last_turn_id: request.turn_id });
    await setup().recoverTurn();
    expect(api.assistantQuery).toHaveBeenCalledTimes(2);
    expect(api.assistantQuery.mock.calls[1]![0].turn_id).toBe(request.turn_id);
    expect(setup().pendingTurn).toBeNull();
    expect(wrapper.text()).toContain('已恢复');
  });
  it('重新打开只按当前账户的会话 ID 恢复服务端历史和未知状态', async () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    scope.write('query-session', { sessionId: 'owned-session' });
    api.getSessionInfo.mockResolvedValueOnce({ session_id: 'owned-session', status: 'unknown', mode: 1, last_activity: '2026-01-01T00:00:00Z',
      conversation_history: [{ q: '之前的问题', a: '之前的回答', mode: 1 }],
      active_turn_id: 'turn-id', active_question: '未确认问题', active_mode: 1 });
    mountScreen(AssistantQuery);
    await flushPromises();
    expect(wrapper.text()).toContain('之前的回答');
    expect(wrapper.text()).toContain('未确认问题');
    expect(setup().pendingTurn.turnId).toBe('turn-id');
    expect(api.assistantQuery).not.toHaveBeenCalled();
    state.user.userInfo = { userId: '2' };
    await flushPromises();
    expect(wrapper.text()).not.toContain('之前的回答');
    expect(setup().pendingTurn).toBeNull();
  });

  it('恢复会话时网络故障保留会话 ID 并允许重新查询', async () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    scope.write('query-session', { sessionId: 'retry-session' });
    api.getSessionInfo.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ session_id: 'retry-session', status: 'idle', mode: 1, conversation_history: [] });
    mountScreen(AssistantQuery);
    await flushPromises();
    expect(setup().currentSessionId).toBe('retry-session');
    expect(scope.read('query-session')).toEqual({ sessionId: 'retry-session' });
    expect(wrapper.text()).toContain('无法读取会话状态');
    await setup().restoreSession();
    expect(setup().sessionNotice).toBe('');
    expect(api.assistantQuery).not.toHaveBeenCalled();
  });

});
