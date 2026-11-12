import { reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
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

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } });
  state.access = reactive({ accessToken: 'fixture' });
  api.createAssistantSession.mockResolvedValue({ session_id: 'session-one' });
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe('悬浮助手持久会话恢复', () => {
  it('网络异常后只核查；已完成时用相同 turn_id 取回结果', async () => {
    api.assistantQuery.mockRejectedValueOnce(new Error('offline'));
    wrapper = mount(AiAssistant);
    await setup().sendMessage('private-question-canary');
    const first = required(api.assistantQuery.mock.calls[0])[0];
    expect(first.session_id).toBe('session-one');
    expect(first.turn_id).toMatch(/^[\da-f-]{36}$/);
    expect(setup().pendingTurn.turnId).toBe(first.turn_id);
    expect(JSON.stringify(localStorage)).not.toContain(
      'private-question-canary',
    );
    api.getSessionInfo.mockResolvedValueOnce({
      active_mode: 1,
      active_question: first.question,
      active_turn_id: first.turn_id,
      conversation_history: [],
      mode: 1,
      session_id: 'session-one',
      status: 'unknown',
    });
    await setup().recoverTurn();
    expect(api.assistantQuery).toHaveBeenCalledTimes(1);
    expect(setup().sessionNotice).toContain('未知');
    api.getSessionInfo.mockResolvedValueOnce({
      conversation_history: [
        { a: 'private-answer-canary', mode: 1, q: first.question },
      ],
      last_turn_id: first.turn_id,
      mode: 1,
      session_id: 'session-one',
      status: 'idle',
    });
    api.assistantQuery.mockResolvedValueOnce({
      answer: 'private-answer-canary',
      session_id: 'session-one',
      turn_id: first.turn_id,
    });
    await setup().recoverTurn();
    expect(required(api.assistantQuery.mock.calls[1])[0]).toEqual(first);
    expect(setup().pendingTurn).toBeNull();
    expect(JSON.stringify(setup().chatMessages)).toContain(
      'private-answer-canary',
    );
    expect(JSON.stringify(localStorage)).not.toContain('private-answer-canary');
  });

  it('刷新只凭当前 owner 的 session 指针恢复历史，unknown 禁止新请求', async () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    scope.write('sessions', {
      currentLocalSessionId: 'local-one',
      sessions: [
        {
          createdAt: 1,
          localId: 'local-one',
          name: 'one',
          serverId: 'session-one',
        },
      ],
    });
    scope.write('chat', {
      chatHistory: [{ content: 'legacy-private-canary' }],
      sessionId: 'session-one',
    });
    api.getSessionInfo.mockResolvedValue({
      active_mode: 1,
      active_question: 'pending-private',
      active_turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      conversation_history: [
        { a: 'server-answer', mode: 1, q: 'old-question' },
      ],
      mode: 1,
      session_id: 'session-one',
      status: 'unknown',
    });
    wrapper = mount(AiAssistant);
    await flushPromises();
    expect(JSON.stringify(setup().chatMessages)).toContain('server-answer');
    expect(setup().pendingTurn.question).toBe('pending-private');
    expect(JSON.stringify(localStorage)).not.toContain('legacy-private-canary');
    expect(JSON.stringify(localStorage)).not.toContain('server-answer');
    await setup().sendMessage('must-not-run');
    expect(api.assistantQuery).not.toHaveBeenCalled();
    state.user.userInfo = { userId: '2' };
    expect(setup().sessionId).toBe('');
    expect(JSON.stringify(setup().chatMessages)).not.toContain('server-answer');
  });
});
