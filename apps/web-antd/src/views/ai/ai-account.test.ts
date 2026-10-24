import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiAssistant from './ai.vue';
import axios, { AxiosError } from 'axios';
import { RequestClient, RequestOwnerChangedError } from '@vben/request';
import { createAssistantAccountScope } from '#/utils/assistant-account-scope';

const state = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  assistantQuery: vi.fn(),
  clearAssistantCache: vi.fn(),
  refreshKnowledgeBase: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => state.user,
  useAccessStore: () => state.access,
}));
vi.mock('#/api/core/aiops/assistant', () => api);
let wrapper: VueWrapper;
const setup = () => (wrapper.vm as any).$?.setupState;
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (value: any) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'credential' });
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe('悬浮助手真实状态隔离', () => {
  it('换账号与退出立即清空显示/输入/SID，拒绝旧无归属键', async () => {
    localStorage.setItem(
      'aiAssistantChatState',
      JSON.stringify({
        sessionId: 'legacy',
        chatMessages: [{ content: 'legacy private' }],
      }),
    );
    const cache = createAssistantAccountScope(localStorage);
    cache.setOwner('1');
    cache.write('sessions', {
      sessions: [{ localId: 'local-one', name: 'first' }],
      currentLocalSessionId: 'local-one',
    });
    cache.write('chat', {
      sessionId: 'owner-one',
      chatMessages: [{ content: 'owner one private', type: 'user' }],
    });
    wrapper = mount(AiAssistant);
    expect(setup().sessionId).toBe('owner-one');
    expect(JSON.stringify(setup().chatMessages)).toContain('owner one private');
    setup().globalInputMessage = 'unsent secret';
    state.user.userInfo = { userId: '2' };
    expect(setup().sessionId).toBe('');
    expect(setup().globalInputMessage).toBe('');
    expect(JSON.stringify(setup().chatMessages)).not.toContain(
      'owner one private',
    );
    state.user.userInfo = null;
    expect(setup().sessions).toEqual([]);
    expect(setup().sessionId).toBe('');
    expect(JSON.stringify(setup().chatMessages)).not.toContain(
      'legacy private',
    );
  });
  it('旧请求即使无视 abort 后完成，也不能写入新账号或解锁新请求', async () => {
    const old = deferred();
    const fresh = deferred();
    api.assistantQuery
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    wrapper = mount(AiAssistant);
    const oldTask = setup().sendMessage('first private question');
    await nextTick();
    const oldSignal = api.assistantQuery.mock.calls[0]![1].signal;
    state.user.userInfo = { userId: '2' };
    expect(oldSignal.aborted).toBe(true);
    const freshTask = setup().sendMessage('second question');
    await nextTick();
    old.resolve({ answer: 'old private answer', session_id: 'old-sid' });
    await oldTask;
    expect(setup().sending).toBe(true);
    expect(setup().sessionId).toBe('');
    expect(JSON.stringify(setup().chatMessages)).not.toContain('old private');
    fresh.resolve({ answer: 'ok', session_id: 'new-sid' });
    await freshTask;
    expect(setup().sessionId).toBe('new-sid');
    expect(JSON.stringify(localStorage)).not.toContain('old private answer');
  });
  it.each([403, 404])(
    '真实请求客户端 HTTP %s 到达组件后清除旧会话',
    async (status) => {
      const client = new RequestClient({
        adapter: async (config) => {
          throw new AxiosError(
            'session denied',
            'ERR_BAD_RESPONSE',
            config,
            undefined,
            {
              data: { code: status, message: 'session denied' },
              status,
              statusText: 'Denied',
              headers: {},
              config,
            },
          );
        },
      });
      api.assistantQuery.mockImplementationOnce(() =>
        client.post('/assistant/query', {}),
      );
      wrapper = mount(AiAssistant);
      setup().sessionId = 'invalid';
      await setup().sendMessage('question');
      expect(setup().sessionId).toBe('');
      expect(setup().chatHistory).toEqual([]);
      expect(setup().sending).toBe(false);
    },
  );

  it.each([403, 404])(
    '会话 %s 清空旧内容/SID，下一次提问新建',
    async (status) => {
      api.assistantQuery
        .mockRejectedValueOnce({ response: { status } })
        .mockResolvedValueOnce({ answer: 'ok', session_id: 'fresh' });
      wrapper = mount(AiAssistant);
      setup().sessionId = 'invalid-sid';
      await setup().sendMessage('question');
      await flushPromises();
      expect(setup().sessionId).toBe('');
      expect(setup().sending).toBe(false);
      expect(setup().chatHistory).toEqual([]);
      await setup().sendMessage('new question');
      expect(api.assistantQuery.mock.calls[1]![0]).not.toHaveProperty(
        'session_id',
      );
      expect(setup().sessionId).toBe('fresh');
    },
  );

  it.each([
    ['CanceledError（停止生成）', () => new axios.CanceledError()],
    ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
  ])('FE-02b 拍板 3：提问被取消（%s）不写错误横幅；真实网络错误照常写', async (_label, make) => {
    api.assistantQuery
      .mockRejectedValueOnce(make())
      .mockRejectedValueOnce(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      );
    wrapper = mount(AiAssistant);
    await setup().sendMessage('question');
    await flushPromises();
    expect(setup().errorMessage).toBe('');
    expect(setup().sending).toBe(false);
    await setup().sendMessage('question again');
    await flushPromises();
    expect(setup().errorMessage).toBe('网络连接错误，请检查网络状态');
  });

  it.each([
    ['CanceledError（停止生成）', () => new axios.CanceledError()],
    ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
  ])('incr3 P3-6：提问被取消（%s）清空 lastFailedQuestion（重试按钮 v-if 依赖它），不留上一次失败的重试入口', async (_label, make) => {
    api.assistantQuery
      .mockRejectedValueOnce(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      )
      .mockRejectedValueOnce(make())
      .mockRejectedValueOnce(make());
    wrapper = mount(AiAssistant);
    await setup().sendMessage('first');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('first');

    await setup().sendMessage('second');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('');
    expect(setup().sending).toBe(false);

    // 首次即被取消：同样不记录
    await setup().sendMessage('third');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('');
  });
});
