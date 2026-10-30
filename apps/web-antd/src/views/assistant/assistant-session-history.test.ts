import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantSession from './AssistantSession.vue';
import { createAssistantAccountScope } from '#/utils/assistant-account-scope';

const state = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({ getSessionInfo: vi.fn() }));
vi.mock('@vben/stores', () => ({ useUserStore: () => state.user, useAccessStore: () => state.access }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('#/api/core/aiops/assistant', () => api);
let wrapper: VueWrapper;

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  state.user = reactive({ userInfo: { userId: '1' } }); state.access = reactive({ accessToken: 'fixture' });
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false,addListener:vi.fn(),removeListener:vi.fn()})));
});
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });

describe('服务端会话详情', () => {
  it('显示已保存对话和未知请求，本地只保存索引', async () => {
    api.getSessionInfo.mockResolvedValue({session_id:'owned', created_time:'2026-01-01T00:00:00Z', last_activity:'2026-01-01T00:00:00Z', message_count:2, mode:1, status:'unknown', revision:1, active_turn_id:'turn-fixture', active_question:'private-pending-canary', conversation_history:[{q:'private-question-canary',a:'private-answer-canary',mode:1}]});
    wrapper = mount(AssistantSession, {global:{plugins:[Antd],stubs:{Icon:true}}});
    await wrapper.find('input').setValue('owned');
    await wrapper.findAll('button').find(button => button.text() === '搜索')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('结果未知');
    expect(wrapper.text()).toContain('private-pending-canary');
    expect(wrapper.text()).toContain('private-answer-canary');
    await wrapper.findAll('button').find(button => button.text().includes('添加到历史'))!.trigger('click');
    expect(JSON.stringify(localStorage)).not.toContain('private-question-canary');
    expect(JSON.stringify(localStorage)).not.toContain('private-answer-canary');
    expect(JSON.stringify(localStorage)).not.toContain('private-pending-canary');
    state.user.userInfo = {userId:'2'};
    await flushPromises();
    expect(wrapper.text()).not.toContain('private-answer-canary');
  });
  it('加载旧本地索引时剔除遗留对话内容', async () => {
    const scope = createAssistantAccountScope(localStorage); scope.setOwner('1');
    scope.write('history', [{session_id:'old', mode:1, status:'idle', conversation_history:[{q:'legacy-private-canary',a:'secret',mode:1}]}]);
    wrapper = mount(AssistantSession, {global:{plugins:[Antd],stubs:{Icon:true}}});
    await flushPromises();
    expect(JSON.stringify(localStorage)).not.toContain('legacy-private-canary');
    expect(wrapper.text()).not.toContain('legacy-private-canary');
  });
});
