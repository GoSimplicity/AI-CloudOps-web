import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { message } from 'ant-design-vue';
import { defineComponent, h, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoFixWorkflow } from './useAutoFixWorkflow';

/**
 * SEC-25/26 复审：直接调用 confirmActions（绕过按钮禁用态），确认请求层面的防线。
 * - P3-1：approval 缺 pending_action_ids 时一律不允许确认、不发请求
 * - M3b：不在 pending_action_ids 里的 id 不发请求
 * - M3d：请求未返回前连调两次只发一个请求
 * 全部为假值。
 */
const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  getAutoFixInfo: vi.fn(),
  getAutoFixReady: vi.fn(),
  executeAutoFixWorkflow: vi.fn(),
  confirmAutoFixWorkflow: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => account.user,
  useAccessStore: () => account.access,
}));
vi.mock('#/api/core/aiops/autofix', () => api);

const action = (id: string) => ({
  action_id: id,
  action_type: 'restart_deployment',
  executable: true,
  description: `原计划动作 ${id}`,
  risk_assessment: {
    allowed: false,
    requires_human_confirmation: true,
    permission_allowed: true,
    namespace_allowed: true,
    resource_exists: true,
    risk_level: 'high',
    reasons: [],
  },
});
function pending(
  blocked: string[],
  pendingIds: string[] | undefined,
): Record<string, any> {
  const items = blocked.map((id) => action(id));
  const approval: Record<string, unknown> = {
    state: 'pending',
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    retry_safe: false,
    confirmation_required: true,
  };
  if (pendingIds) approval.pending_action_ids = pendingIds;
  return {
    status: 'needs_human_confirmation',
    next_action: 'human_confirm',
    plan: { plan_id: 'fake-plan-id', blocked_actions: items },
    candidate_actions: items,
    blocked_actions: items,
    review: {},
    agents_used: [],
    diagnosis: {},
    execution: {},
    executed_actions: [],
    messages: [],
    timestamp: new Date().toISOString(),
    approval,
  };
}

let wrapper: undefined | VueWrapper<any>;
async function setup(result: Record<string, any>) {
  api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
  const Harness = defineComponent({
    setup() {
      return useAutoFixWorkflow();
    },
    render: () => h('div'),
  });
  wrapper = mount(Harness);
  const vm = wrapper.vm as any;
  await flushPromises();
  vm.formData.namespace = 'ns-fake';
  vm.formData.problem_description = '假的问题描述';
  await vm.runWorkflow();
  await flushPromises();
  expect(vm.workflowResult?.status).toBe('needs_human_confirmation');
  return vm;
}

beforeEach(() => {
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline-credential' });
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'info').mockImplementation((() => {}) as any);
  api.getAutoFixInfo.mockResolvedValue({
    service: 's',
    status: 'ok',
    capabilities: [],
    endpoints: {},
  });
  api.getAutoFixReady.mockResolvedValue({ ready: true });
  api.confirmAutoFixWorkflow.mockResolvedValue({
    ...pending([], []),
    status: 'completed',
    approval: {
      state: 'completed',
      expires_at: new Date().toISOString(),
      retry_safe: false,
      confirmation_required: false,
      pending_action_ids: [],
    },
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

describe('confirmActions 直接调用（复审 P3-1 / M3b / M3d）', () => {
  it('对照：pending 里的 id 正常发一次确认请求', async () => {
    const vm = await setup(pending(['a1', 'a2'], ['a1', 'a2']));
    await vm.confirmActions(['a1']);
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      approved_action_ids: ['a1'],
      plan_id: 'fake-plan-id',
    });
  });

  it('P3-1：approval 缺 pending_action_ids：没有可确认动作，直接调用也不发请求', async () => {
    const vm = await setup(pending(['a1', 'a2'], undefined));
    expect(vm.confirmableBlockedActions).toEqual([]);
    expect(vm.canConfirmAll).toBe(false);
    await vm.confirmActions(['a1']);
    await vm.confirmActions(['a1', 'a2']);
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('M3b：id 不在 pending_action_ids 里（含混在合法 id 中、未知 id）：不发请求', async () => {
    const vm = await setup(pending(['a1', 'a2'], ['a1']));
    await vm.confirmActions(['a2']);
    await vm.confirmActions(['a1', 'a2']);
    await vm.confirmActions(['ghost-id']);
    await vm.confirmActions([]);
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('M3d：请求返回前连调两次 confirmActions：只发一个请求', async () => {
    const vm = await setup(pending(['a1', 'a2'], ['a1', 'a2']));
    let resolve!: (value: unknown) => void;
    api.confirmAutoFixWorkflow.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    );
    const first = vm.confirmActions(['a1']);
    const second = vm.confirmActions(['a1']);
    const third = vm.confirmActions(['a2']);
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
    resolve({ ...pending(['a2'], ['a2']) });
    await Promise.all([first, second, third]);
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
  });
});
