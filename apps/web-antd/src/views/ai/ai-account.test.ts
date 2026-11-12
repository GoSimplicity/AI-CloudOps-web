import { reactive } from 'vue';

import { RequestClient, RequestOwnerChangedError } from '@vben/request';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import axios, { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAssistantAccountScope } from '#/utils/assistant-account-scope';

import AiAssistant from './ai.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const state = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  assistantQuery: vi.fn(),
  clearAssistantCache: vi.fn(),
  createAssistantSession: vi.fn(),
  getSessionInfo: vi.fn(),
  refreshKnowledgeBase: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
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
  return { promise, reject, resolve };
};
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'credential' });
  api.createAssistantSession.mockImplementation(async () => ({
    session_id: state.user.userInfo?.userId === '2' ? 'new-sid' : 'first-sid',
  }));
  api.getSessionInfo.mockImplementation(async (session_id: string) => ({
    conversation_history: [],
    mode: 1,
    session_id,
    status: 'idle',
  }));
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
        chatMessages: [{ content: 'legacy private' }],
        sessionId: 'legacy',
      }),
    );
    const cache = createAssistantAccountScope(localStorage);
    cache.setOwner('1');
    cache.write('sessions', {
      currentLocalSessionId: 'local-one',
      sessions: [{ localId: 'local-one', name: 'first' }],
    });
    cache.write('chat', {
      chatMessages: [{ content: 'owner one private', type: 'user' }],
      sessionId: 'owner-one',
    });
    api.getSessionInfo.mockResolvedValueOnce({
      conversation_history: [
        { a: 'owned answer', mode: 1, q: 'owner one private' },
      ],
      mode: 1,
      session_id: 'owner-one',
      status: 'idle',
    });
    wrapper = mount(AiAssistant);
    await flushPromises();
    expect(setup().sessionId).toBe('owner-one');
    expect(JSON.stringify(setup().chatMessages)).toContain('owner one private');
    expect(JSON.stringify(localStorage)).not.toContain('owner one private');
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
    await flushPromises();
    const oldSignal = required(api.assistantQuery.mock.calls[0])[1].signal;
    state.user.userInfo = { userId: '2' };
    expect(oldSignal.aborted).toBe(true);
    const freshTask = setup().sendMessage('second question');
    await flushPromises();
    const oldParams = required(api.assistantQuery.mock.calls[0])[0];
    const freshParams = required(api.assistantQuery.mock.calls[1])[0];
    old.resolve({
      answer: 'old private answer',
      session_id: oldParams.session_id,
      turn_id: oldParams.turn_id,
    });
    await oldTask;
    expect(setup().sending).toBe(true);
    expect(setup().sessionId).toBe('new-sid');
    expect(JSON.stringify(setup().chatMessages)).not.toContain('old private');
    fresh.resolve({
      answer: 'ok',
      session_id: freshParams.session_id,
      turn_id: freshParams.turn_id,
    });
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
              config,
              data: { code: status, message: 'session denied' },
              headers: {},
              status,
              statusText: 'Denied',
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
        .mockImplementationOnce(async (params) => ({
          answer: 'ok',
          session_id: params.session_id,
          turn_id: params.turn_id,
        }));
      api.createAssistantSession.mockResolvedValueOnce({ session_id: 'fresh' });
      wrapper = mount(AiAssistant);
      setup().sessionId = 'invalid-sid';
      await setup().sendMessage('question');
      await flushPromises();
      expect(setup().sessionId).toBe('');
      expect(setup().sending).toBe(false);
      expect(setup().chatHistory).toEqual([]);
      await setup().sendMessage('new question');
      expect(required(api.assistantQuery.mock.calls[1])[0].session_id).toBe(
        'fresh',
      );
      expect(setup().sessionId).toBe('fresh');
    },
  );

  it.each([
    ['CanceledError（停止生成）', () => new axios.CanceledError()],
    ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
  ])('请求取消（%s）及网络中断均保留待核对状态', async (_label, make) => {
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
    expect(setup().pendingTurn).not.toBeNull();
    expect(setup().sessionNotice).toContain('尚未确认');
    setup().createNewSession(true);
    await setup().sendMessage('question again');
    await flushPromises();
    expect(setup().sessionNotice).toContain('尚未确认');
  });

  it.each([
    ['CanceledError（停止生成）', () => new axios.CanceledError()],
    ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
  ])('取消（%s）后不出现未经核对的重试入口', async (_label, make) => {
    api.assistantQuery
      .mockRejectedValueOnce(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      )
      .mockRejectedValueOnce(make())
      .mockRejectedValueOnce(make());
    wrapper = mount(AiAssistant);
    await setup().sendMessage('first');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('');
    expect(setup().pendingTurn).not.toBeNull();

    setup().createNewSession(true);
    await setup().sendMessage('second');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('');
    expect(setup().sending).toBe(false);
    expect(setup().pendingTurn).not.toBeNull();

    // 首次即被取消：同样不记录
    setup().createNewSession(true);
    await setup().sendMessage('third');
    await flushPromises();
    expect(setup().lastFailedQuestion).toBe('');
  });
});
