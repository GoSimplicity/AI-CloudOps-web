import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiAssistant from './ai.vue';
import { createAssistantAccountScope } from '#/utils/assistant-account-scope';

const state = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({ assistantQuery: vi.fn(), createAssistantSession: vi.fn(), getSessionInfo: vi.fn(), refreshKnowledgeBase: vi.fn() }));
vi.mock('@vben/stores', () => ({ useUserStore: () => state.user, useAccessStore: () => state.access }));
vi.mock('#/api/core/aiops/assistant', () => api);
let wrapper: VueWrapper;
const setup = () => (wrapper.vm as any).$?.setupState;

beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks();
  state.user = reactive({userInfo:{userId:'1'}}); state.access = reactive({accessToken:'fixture'});
  api.createAssistantSession.mockResolvedValue({session_id:'session-one'});
});
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); });

describe('悬浮助手持久会话恢复', () => {
  it('网络异常后只核查；已完成时用相同 turn_id 取回结果', async () => {
    api.assistantQuery.mockRejectedValueOnce(new Error('offline'));
    wrapper = mount(AiAssistant);
    await setup().sendMessage('private-question-canary');
    const first = api.assistantQuery.mock.calls[0]![0];
    expect(first.session_id).toBe('session-one'); expect(first.turn_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setup().pendingTurn.turnId).toBe(first.turn_id);
    expect(JSON.stringify(localStorage)).not.toContain('private-question-canary');
    api.getSessionInfo.mockResolvedValueOnce({session_id:'session-one',status:'unknown',mode:1,active_turn_id:first.turn_id,active_question:first.question,active_mode:1,conversation_history:[]});
    await setup().recoverTurn();
    expect(api.assistantQuery).toHaveBeenCalledTimes(1);
    expect(setup().sessionNotice).toContain('未知');
    api.getSessionInfo.mockResolvedValueOnce({session_id:'session-one',status:'idle',mode:1,last_turn_id:first.turn_id,conversation_history:[{q:first.question,a:'private-answer-canary',mode:1}]});
    api.assistantQuery.mockResolvedValueOnce({answer:'private-answer-canary',session_id:'session-one',turn_id:first.turn_id});
    await setup().recoverTurn();
    expect(api.assistantQuery.mock.calls[1]![0]).toEqual(first);
    expect(setup().pendingTurn).toBeNull();
    expect(JSON.stringify(setup().chatMessages)).toContain('private-answer-canary');
    expect(JSON.stringify(localStorage)).not.toContain('private-answer-canary');
  });

  it('刷新只凭当前 owner 的 session 指针恢复历史，unknown 禁止新请求', async () => {
    const scope = createAssistantAccountScope(localStorage); scope.setOwner('1');
    scope.write('sessions',{sessions:[{localId:'local-one',name:'one',createdAt:1,serverId:'session-one'}],currentLocalSessionId:'local-one'});
    scope.write('chat',{sessionId:'session-one',chatHistory:[{content:'legacy-private-canary'}]});
    api.getSessionInfo.mockResolvedValue({session_id:'session-one',status:'unknown',mode:1,active_turn_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',active_question:'pending-private',active_mode:1,conversation_history:[{q:'old-question',a:'server-answer',mode:1}]});
    wrapper = mount(AiAssistant); await flushPromises();
    expect(JSON.stringify(setup().chatMessages)).toContain('server-answer');
    expect(setup().pendingTurn.question).toBe('pending-private');
    expect(JSON.stringify(localStorage)).not.toContain('legacy-private-canary');
    expect(JSON.stringify(localStorage)).not.toContain('server-answer');
    await setup().sendMessage('must-not-run');
    expect(api.assistantQuery).not.toHaveBeenCalled();
    state.user.userInfo = {userId:'2'};
    expect(setup().sessionId).toBe('');
    expect(JSON.stringify(setup().chatMessages)).not.toContain('server-answer');
  });
});
