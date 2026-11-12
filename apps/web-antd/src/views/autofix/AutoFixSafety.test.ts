import { nextTick, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_DENIED_MESSAGE } from '#/utils/permission/forbidden';

import AutoFixWorkflow from './AutoFixWorkflow.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const recoveryPermission = vi.hoisted(() => ({ allowed: true }));
// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({
    can: () => true,
    hasPerm: () => recoveryPermission.allowed,
  }),
}));

const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  confirmAutoFixWorkflow: vi.fn(),
  executeAutoFixWorkflow: vi.fn(),
  getAutoFixHistory: vi.fn(),
  getAutoFixInfo: vi.fn(),
  getAutoFixOperation: vi.fn(),
  getAutoFixPlan: vi.fn(),
  getAutoFixReady: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
vi.mock('#/api/core/aiops/autofix', () => api);
let wrapper: undefined | VueWrapper;
const action = () => ({
  action_id: 'restart',
  action_type: 'restart_deployment',
  description: '原计划动作',
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
function plan(reason = '账户1私有审批结论') {
  const item = action();
  return {
    agents_used: ['Reviewer'],
    approval: {
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      // 复审 P3-1：缺 pending_action_ids 时不允许确认，夹具按契约带上
      pending_action_ids: [item.action_id],
      retry_safe: false,
      state: 'pending',
    },
    blocked_actions: [item],
    candidate_actions: [item],
    diagnosis: {},
    executed_actions: [],
    execution: {},
    messages: [],
    plan: {
      blocked_actions: [item],
      candidate_actions: [item],
      plan_id: 'opaque-plan-one',
    },
    review: { approved: false, reason },
    status: 'needs_human_confirmation',
    timestamp: new Date().toISOString(),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  recoveryPermission.allowed = true;
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline-credential' });
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
  api.getAutoFixInfo.mockResolvedValue({
    capabilities: [],
    endpoints: {},
    service: '测试修复服务',
    status: 'initialized',
  });
  api.getAutoFixReady.mockResolvedValue({
    healthy: true,
    ready: true,
    status: 'ready',
  });
  api.executeAutoFixWorkflow.mockImplementation(async () => plan());
  api.confirmAutoFixWorkflow.mockImplementation(async () => ({
    ...plan('执行结论'),
    approval: {
      expires_at: new Date().toISOString(),
      retry_safe: false,
      state: 'completed',
    },
    blocked_actions: [],
    executed_actions: [{ action_id: 'restart', status: 'succeeded' }],
    status: 'completed',
  }));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  wrapper = mount(AutoFixWorkflow, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
}
function button(text: string) {
  return required(
    required(wrapper)
      .findAll('button')
      .find((item) => item.text().replace(/\s/g, '').includes(text)),
  );
}
async function fillAndRun() {
  await required(wrapper)
    .get('input[placeholder="例如 payment-service"]')
    .setValue('owned-api');
  await required(wrapper)
    .get('textarea[placeholder="描述当前故障现象、涉及资源和期望处理方式"]')
    .setValue('本次隔离验收的真实描述');
  await button('执行工作流').trigger('click');
  await flushPromises();
}
async function selectAndConfirm() {
  const checkbox = required(wrapper).find(
    '.confirm-panel input[type="checkbox"]',
  );
  if (checkbox.exists() && !checkbox.attributes('disabled'))
    await checkbox.setValue(true);
  await nextTick();
  const confirm = button('确认并继续执行');
  if (confirm) await confirm.trigger('click');
  await flushPromises();
}

describe('自动修复页面的显式调用和审批状态', () => {
  it('初始没有虚构故障输入且不会执行工作流', async () => {
    await start();
    expect(button('执行工作流').attributes('disabled')).toBeDefined();
    expect(api.getAutoFixReady).not.toHaveBeenCalled();
    expect(api.executeAutoFixWorkflow).not.toHaveBeenCalled();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
  it('身份切换立即清除旧计划和私有结论', async () => {
    await start();
    await fillAndRun();
    expect(required(wrapper).text()).toContain('账户1私有审批结论');
    account.user.userInfo = { userId: '2' };
    await nextTick();
    expect(required(wrapper).text()).not.toContain('账户1私有审批结论');
    expect(required(wrapper).find('.confirm-panel').exists()).toBe(false);
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
  });
  it('另一身份不能收到迟到的工作流结果', async () => {
    let complete!: (value: unknown) => void;
    api.executeAutoFixWorkflow.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await start();
    await fillAndRun();
    account.user.userInfo = { userId: '2' };
    await nextTick();
    complete(plan());
    await flushPromises();
    expect(required(wrapper).text()).not.toContain('账户1私有审批结论');
  });
  it.each([
    [403, PERMISSION_DENIED_MESSAGE],
    [404, '操作结果尚未确认'],
    [409, '操作结果尚未确认'],
    [502, '操作结果尚未确认'],
    [400, '操作结果尚未确认'],
    [500, '操作结果尚未确认'],
  ])(
    '确认返回%s后清除可重试计划与选择，按状态显示「%s」（不透出后端原文）',
    async (status, text) => {
      api.confirmAutoFixWorkflow.mockRejectedValueOnce(
        Object.assign(new Error('后端原文 WORKFLOW_APPROVAL_ERROR'), {
          response: { data: { error_code: 'WORKFLOW_APPROVAL_ERROR' }, status },
        }),
      );
      await start();
      await fillAndRun();
      await selectAndConfirm();
      expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
      expect(required(wrapper).find('.confirm-panel').exists()).toBe(false);
      const alert = required(wrapper).find('[role="alert"]').text();
      expect(alert).toContain(text);
      expect(alert).not.toContain('WORKFLOW_APPROVAL_ERROR');
      expect(message.success).not.toHaveBeenCalled();
    },
  );
  it('执行工作流 409：提示先核对而非盲目重试', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(
      Object.assign(new Error('后端原文'), { response: { status: 409 } }),
    );
    await start();
    await fillAndRun();
    expect(required(wrapper).find('[role="alert"]').text()).toContain(
      '操作结果尚未确认',
    );
  });
  it('失败后显式查询同一操作，恢复原计划并禁止自动重发', async () => {
    api.executeAutoFixWorkflow.mockRejectedValueOnce(new Error('offline'));
    await start();
    await fillAndRun();
    const id = required(api.executeAutoFixWorkflow.mock.calls[0])[0]
      .operation_id;
    expect(required(wrapper).text()).toContain('待核对');
    expect(required(wrapper).text()).toContain('不要重复执行');
    api.getAutoFixOperation.mockResolvedValueOnce({
      approval_state: 'pending',
      operation_id: id,
      plan_id: 'opaque-plan-one',
      result: plan(),
      state: 'pending',
    });
    await button('查询当前状态').trigger('click');
    await flushPromises();
    expect(required(wrapper).text()).toContain('待审批');
    expect(required(wrapper).find('.confirm-panel').exists()).toBe(true);
    expect(api.executeAutoFixWorkflow).toHaveBeenCalledTimes(1);
  });
  it('没有历史查询权限时明确提示，不发查询', async () => {
    recoveryPermission.allowed = false;
    await start();
    expect(required(wrapper).text()).toContain('没有操作历史查询权限');
    expect(api.getAutoFixHistory).not.toHaveBeenCalled();
    expect(api.getAutoFixOperation).not.toHaveBeenCalled();
  });

  it('硬权限失败的动作不提供可选审批框', async () => {
    const result = plan();
    required(result.blocked_actions[0]).risk_assessment.permission_allowed =
      false;
    api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
    await start();
    await fillAndRun();
    expect(
      required(wrapper).find('.confirm-panel input[type="checkbox"]').exists(),
    ).toBe(false);
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
  it('已过期审批不会向后端重发确认', async () => {
    const result = plan();
    result.approval.expires_at = new Date(Date.now() - 1000).toISOString();
    api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
    await start();
    await fillAndRun();
    await selectAndConfirm();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
  it('缺少审批元数据的旧结果不被当前客户端认领', async () => {
    const result: any = plan();
    delete result.approval;
    api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
    await start();
    await fillAndRun();
    await selectAndConfirm();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
  it('执行中禁用重置避免把在途动作伪装取消', async () => {
    let complete!: (value: unknown) => void;
    api.executeAutoFixWorkflow.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await start();
    await fillAndRun();
    expect(button('重置').attributes('disabled')).toBeDefined();
    complete(plan());
    await flushPromises();
  });
  it('状态加载失败清除旧健康与服务资料', async () => {
    await start();
    expect(required(wrapper).text()).toContain('测试修复服务');
    api.getAutoFixInfo.mockRejectedValueOnce(new Error('元数据不可用'));
    api.getAutoFixReady.mockRejectedValueOnce(new Error('就绪检查不可用'));
    await button('检查服务依赖').trigger('click');
    await flushPromises();
    expect(required(wrapper).text()).not.toContain('测试修复服务');
    expect(required(wrapper).find('[role="alert"]').exists()).toBe(true);
  });
  it('后端失败结果不显示工作流完成的成功提示', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce({
      ...plan(),
      status: 'failed',
    });
    await start();
    await fillAndRun();
    expect(message.success).not.toHaveBeenCalled();
  });
});
