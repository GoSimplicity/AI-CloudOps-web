import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoFixWorkflow } from './useAutoFixWorkflow';

const account = vi.hoisted(() => ({
  user: null as any,
  access: null as any,
  permissions: null as any,
}));
const api = vi.hoisted(() => ({
  getAutoFixInfo: vi.fn(),
  getAutoFixReady: vi.fn(),
  executeAutoFixWorkflow: vi.fn(),
  confirmAutoFixWorkflow: vi.fn(),
  getAutoFixHistory: vi.fn(),
  getAutoFixOperation: vi.fn(),
  getAutoFixPlan: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => account.user,
  useAccessStore: () => account.access,
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: (key: string) =>
      key === 'aiops.autofix.confirm'
        ? account.permissions.confirm
        : account.permissions.run,
    hasPerm: (code: string) => account.permissions[code] ?? false,
  }),
}));
vi.mock('#/api/core/aiops/autofix', () => api);
vi.mock('ant-design-vue', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));
const operationPermission = '/api/v1/autofix/workflow/operations/:operation_id';
const planPermission = '/api/v1/autofix/workflow/plans/:plan_id';
const historyPermission = '/api/v1/autofix/workflow/history';
const planId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const pendingResult = () => ({
  status: 'needs_human_confirmation',
  plan: { plan_id: planId },
  approval: {
    state: 'pending',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    pending_action_ids: ['a'],
    confirmation_required: true,
  },
  blocked_actions: [
    {
      action_id: 'a',
      executable: true,
      risk_assessment: {
        namespace_allowed: true,
        permission_allowed: true,
        resource_exists: true,
      },
    },
  ],
  candidate_actions: [],
  diagnosis: {},
  execution: {},
  executed_actions: [],
  messages: [],
  review: {},
  agents_used: [],
  timestamp: '',
});
const operation = (id: string, state = 'pending') => ({
  operation_id: id,
  plan_id: planId,
  state,
  approval_state: state === 'pending' ? 'pending' : 'consumed',
  result: state === 'pending' ? pendingResult() : null,
  execution_summary: state === 'completed' ? { status: 'completed' } : null,
});
const Harness = defineComponent({
  setup: () => useAutoFixWorkflow(),
  render: () => h('div'),
});
let wrapper: VueWrapper<any> | undefined;
async function mountHarness() {
  wrapper = mount(Harness);
  await flushPromises();
  return wrapper.vm as any;
}
function reject(status: number) {
  return Object.assign(new Error('private-backend-canary'), {
    response: { status },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'token-a' });
  account.permissions = reactive({
    run: true,
    confirm: true,
    [operationPermission]: true,
    [planPermission]: true,
    [historyPermission]: true,
  });
  api.getAutoFixInfo.mockResolvedValue({});
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('自动修复跨刷新恢复', () => {
  it('请求失败只保存操作ID；刷新后不重发，查询后恢复当前用户的待审批计划', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    let vm = await mountHarness();
    vm.formData.problem_description = 'private-diagnosis-canary';
    vm.formData.event = 'private-event-canary';
    await vm.runWorkflow();
    const sent = api.executeAutoFixWorkflow.mock.calls[0]![0];
    expect(sent.operation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(vm.operationState).toBe('unverified');
    expect(vm.canStartWorkflow).toBe(false);
    const stored = JSON.stringify(sessionStorage);
    expect(stored).toContain(sent.operation_id);
    expect(stored).not.toContain('private-diagnosis-canary');
    expect(stored).not.toContain('private-event-canary');
    wrapper!.unmount();
    wrapper = undefined;
    vm = await mountHarness();
    expect(vm.currentOperationId).toBe(sent.operation_id);
    expect(vm.operationState).toBe('unverified');
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
    api.getAutoFixOperation.mockResolvedValueOnce(operation(sent.operation_id));
    await vm.checkOperation();
    expect(vm.operationState).toBe('pending');
    expect(vm.workflowResult.plan.plan_id).toBe(planId);
    expect(vm.confirmableBlockedActions).toHaveLength(1);
  });

  it('服务明确404后仅允许手动以相同ID重试原输入', async () => {
    api.executeAutoFixWorkflow
      .mockRejectedValueOnce(reject(503))
      .mockResolvedValueOnce(pendingResult());
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const first = api.executeAutoFixWorkflow.mock.calls[0]![0];
    api.getAutoFixOperation.mockRejectedValueOnce(reject(404));
    await vm.checkOperation();
    expect(vm.operationState).toBe('not_found');
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
    vm.formData.problem_description = 'changed';
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(2);
    expect(api.executeAutoFixWorkflow.mock.calls[1]![0]).toEqual(first);
  });

  it.each(['building', 'executing', 'uncertain'])(
    '服务状态%s不能自动重发或暴露审批',
    async (state) => {
      api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
      const vm = await mountHarness();
      vm.formData.problem_description = 'original';
      await vm.runWorkflow();
      const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
      api.getAutoFixOperation.mockResolvedValueOnce(operation(id, state));
      await vm.checkOperation();
      expect(['running', 'uncertain']).toContain(vm.operationState);
      await vm.runWorkflow();
      await vm.confirmAllActions();
      expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
      expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
    },
  );

  it('缺少状态权限时不发查询，并提示人工核对', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    account.permissions[operationPermission] = false;
    await vm.checkOperation();
    expect(api.getAutoFixOperation).not.toHaveBeenCalled();
    expect(vm.recoveryError).toContain('权限');
    expect(vm.canStartWorkflow).toBe(false);
  });

  it('切换身份与令牌拒绝迟到状态，不暴露上一账户计划', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    const old = deferred<any>();
    api.getAutoFixOperation.mockReturnValueOnce(old.promise);
    const task = vm.checkOperation();
    account.access.accessToken = 'token-b';
    account.user.userInfo = { userId: '2' };
    old.resolve(operation(id));
    await task;
    expect(vm.workflowResult).toBeUndefined();
    expect(vm.currentOperationId).toBe('');
    expect(vm.operationDetail).toBeUndefined();
  });

  it('同用户令牌刷新期间保留在途操作ID并禁止再次提交', async () => {
    const old = deferred<any>();
    api.executeAutoFixWorkflow.mockReturnValueOnce(old.promise);
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    const task = vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    account.access.accessToken = 'refreshed-token';
    expect(vm.currentOperationId).toBe(id);
    expect(vm.operationState).toBe('unverified');
    expect(vm.canStartWorkflow).toBe(false);
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
    old.resolve(pendingResult());
    await task;
    expect(vm.workflowResult).toBeUndefined();
    expect(vm.currentOperationId).toBe(id);
  });

  it('同一用户会话令牌变化也拒绝迟到响应并要求重新查询', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    const old = deferred<any>();
    api.getAutoFixOperation.mockReturnValueOnce(old.promise);
    const task = vm.checkOperation();
    account.access.accessToken = 'refreshed-token';
    old.resolve(operation(id));
    await task;
    expect(vm.currentOperationId).toBe(id);
    expect(vm.operationState).toBe('unverified');
    expect(vm.workflowResult).toBeUndefined();
  });

  it('旧会话打开的核对确认不能清除新账户的未决操作', async () => {
    const vm = await mountHarness();
    vm.currentOperationId = '11111111-1111-4111-8111-111111111111';
    vm.currentPlanId = planId;
    vm.operationState = 'uncertain';
    const owner = vm.operationOwner;
    const oldId = vm.currentOperationId;
    const oldPlan = vm.currentPlanId;
    account.user.userInfo = { userId: '2' };
    vm.currentOperationId = '22222222-2222-4222-8222-222222222222';
    vm.currentPlanId = planId;
    vm.operationState = 'uncertain';
    vm.acknowledgeUncertain(owner, oldId, oldPlan);
    expect(vm.currentOperationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(vm.operationState).toBe('uncertain');
  });

  it('历史响应缺少列表时不能误报暂无记录', async () => {
    const vm = await mountHarness();
    api.getAutoFixHistory.mockResolvedValueOnce({});
    await vm.loadHistory();
    expect(vm.historyLoaded).toBe(false);
    expect(vm.historyError).toContain('读取失败');
  });

  it('历史详情只由用户显式读取，身份切换后丢弃迟到结果', async () => {
    const vm = await mountHarness();
    const old = deferred<any>();
    api.getAutoFixHistory.mockReturnValueOnce(old.promise);
    const task = vm.loadHistory();
    account.user.userInfo = { userId: '2' };
    old.resolve({ items: [operation('11111111-1111-4111-8111-111111111111')] });
    await task;
    expect(vm.operationHistory).toEqual([]);
    expect(api.getAutoFixPlan).not.toHaveBeenCalled();
  });

  it('刷新后404允许手动复用原操作ID，浏览器不保留正文', async () => {
    api.executeAutoFixWorkflow
      .mockRejectedValueOnce(reject(503))
      .mockResolvedValueOnce(pendingResult());
    let vm = await mountHarness();
    vm.formData.problem_description = 'private-original';
    await vm.runWorkflow();
    const first = api.executeAutoFixWorkflow.mock.calls[0]![0];
    wrapper!.unmount();
    wrapper = undefined;
    vm = await mountHarness();
    expect(vm.formData.problem_description).toBe('');
    api.getAutoFixOperation.mockRejectedValueOnce(reject(404));
    await vm.checkOperation();
    vm.formData.problem_description = 'private-original';
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow.mock.calls[1]![0]).toEqual(first);
    expect(JSON.stringify(sessionStorage)).not.toContain('private-original');
  });

  it('已知计划确认失败后再遇404必须人工核对，不能重发', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce(pendingResult());
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    api.confirmAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    await vm.confirmAllActions();
    api.getAutoFixOperation.mockRejectedValueOnce(reject(404));
    await vm.checkOperation();
    expect(vm.operationState).toBe('uncertain');
    expect(vm.canStartWorkflow).toBe(false);
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
  });

  it('未知当前操作时不能通过查看其他历史记录绕过核对', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    await vm.openHistoryPlan({
      ...operation('22222222-2222-4222-8222-222222222222'),
      plan_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    expect(api.getAutoFixPlan).not.toHaveBeenCalled();
    expect(vm.historyError).toContain('先核对');
  });

  it('完成记录缺少可信执行摘要时显示不确定', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    api.getAutoFixOperation.mockResolvedValueOnce({
      ...operation(id, 'completed'),
      execution_summary: { status: 'failed' },
    });
    await vm.checkOperation();
    expect(vm.operationState).toBe('uncertain');
  });

  it('无法保存操作ID时不提交', async () => {
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('disabled');
    });
    await vm.runWorkflow();
    expect(api.executeAutoFixWorkflow).not.toHaveBeenCalled();
    expect(vm.recoveryError).toContain('未提交');
  });

  it('审批权限撤销后直接调用也不能确认', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce(pendingResult());
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    account.permissions.confirm = false;
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('恢复后撤销详情权限立即清除原计划和可确认动作', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    api.getAutoFixOperation.mockResolvedValueOnce(operation(id));
    await vm.checkOperation();
    expect(vm.workflowResult).toBeDefined();
    account.permissions[operationPermission] = false;
    expect(vm.workflowResult).toBeUndefined();
    expect(vm.operationState).toBe('unverified');
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('待审批响应缺失或不匹配时不提供执行动作', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(reject(503));
    const vm = await mountHarness();
    vm.formData.problem_description = 'original';
    await vm.runWorkflow();
    const id = api.executeAutoFixWorkflow.mock.calls[0]![0].operation_id;
    api.getAutoFixOperation.mockResolvedValueOnce({
      ...operation(id),
      result: { ...pendingResult(), plan: { plan_id: 'different' } },
    });
    await vm.checkOperation();
    expect(vm.operationState).toBe('uncertain');
    expect(vm.workflowResult).toBeUndefined();
    await vm.confirmAllActions();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
});
