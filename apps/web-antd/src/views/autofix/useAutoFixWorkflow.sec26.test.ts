import { defineComponent, h, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoFixWorkflow } from './useAutoFixWorkflow';

/**
 * SEC-25/26 复审：直接调用 confirmActions（绕过按钮禁用态），确认请求层面的防线。
 * - P3-1：approval 缺 pending_action_ids 时一律不允许确认、不发请求
 * - M3b：不在 pending_action_ids 里的 id 不发请求
 * - M3d：请求未返回前连调两次只发一个请求
 * 全部为假值。
 */
const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  confirmAutoFixWorkflow: vi.fn(),
  executeAutoFixWorkflow: vi.fn(),
  getAutoFixInfo: vi.fn(),
  getAutoFixReady: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
vi.mock('#/api/core/aiops/autofix', () => api);
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

const action = (id: string) => ({
  action_id: id,
  action_type: 'restart_deployment',
  description: `原计划动作 ${id}`,
  executable: true,
  risk_assessment: {
    allowed: false,
    namespace_allowed: true,
    permission_allowed: true,
    reasons: [],
    requires_human_confirmation: true,
    resource_exists: true,
    risk_level: 'high',
  },
});
function pending(
  blocked: string[],
  pendingIds?: string[] | undefined,
): Record<string, any> {
  const items = blocked.map((id) => action(id));
  const approval: Record<string, unknown> = {
    confirmation_required: true,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    retry_safe: false,
    state: 'pending',
  };
  if (pendingIds) approval.pending_action_ids = pendingIds;
  return {
    agents_used: [],
    approval,
    blocked_actions: items,
    candidate_actions: items,
    diagnosis: {},
    executed_actions: [],
    execution: {},
    messages: [],
    next_action: 'human_confirm',
    plan: { blocked_actions: items, plan_id: 'fake-plan-id' },
    review: {},
    status: 'needs_human_confirmation',
    timestamp: new Date().toISOString(),
  };
}

let wrapper: undefined | VueWrapper<any>;
async function setup(result: Record<string, any>) {
  api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
  const Harness = defineComponent({
    render: () => h('div'),
    setup() {
      return useAutoFixWorkflow();
    },
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
  sessionStorage.clear();
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline-credential' });
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'info').mockImplementation((() => {}) as any);
  api.getAutoFixInfo.mockResolvedValue({
    capabilities: [],
    endpoints: {},
    service: 's',
    status: 'ok',
  });
  api.getAutoFixReady.mockResolvedValue({ ready: true });
  api.confirmAutoFixWorkflow.mockResolvedValue({
    ...pending([], []),
    approval: {
      confirmation_required: false,
      expires_at: new Date().toISOString(),
      pending_action_ids: [],
      retry_safe: false,
      state: 'completed',
    },
    status: 'completed',
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

  it('p3-1：approval 缺 pending_action_ids：没有可确认动作，直接调用也不发请求', async () => {
    const vm = await setup(pending(['a1', 'a2']));
    expect(vm.confirmableBlockedActions).toEqual([]);
    expect(vm.canConfirmAll).toBe(false);
    await vm.confirmActions(['a1']);
    await vm.confirmActions(['a1', 'a2']);
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('数值型动作ID即使出现在待审批集合里也不能确认执行', async () => {
    const result = pending([], []);
    result.blocked_actions = [{ ...action('fixture'), action_id: 42 }];
    result.approval.pending_action_ids = [42];
    const vm = await setup(result);
    expect(vm.confirmableBlockedActions).toEqual([]);
    expect(vm.canConfirmAll).toBe(false);
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('m3b：id 不在 pending_action_ids 里（含混在合法 id 中、未知 id）：不发请求', async () => {
    const vm = await setup(pending(['a1', 'a2'], ['a1']));
    await vm.confirmActions(['a2']);
    await vm.confirmActions(['a1', 'a2']);
    await vm.confirmActions(['ghost-id']);
    await vm.confirmActions([]);
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('m3d：请求返回前连调两次 confirmActions：只发一个请求', async () => {
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
