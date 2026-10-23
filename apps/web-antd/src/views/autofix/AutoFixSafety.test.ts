import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AutoFixWorkflow from './AutoFixWorkflow.vue';

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
let wrapper: VueWrapper | undefined;
const action = () => ({
  action_id: 'restart',
  action_type: 'restart_deployment',
  executable: true,
  description: '原计划动作',
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
function plan(reason = '账户1私有审批结论') {
  const item = action();
  return {
    status: 'needs_human_confirmation',
    plan: {
      plan_id: 'opaque-plan-one',
      candidate_actions: [item],
      blocked_actions: [item],
    },
    candidate_actions: [item],
    blocked_actions: [item],
    review: { approved: false, reason },
    agents_used: ['Reviewer'],
    diagnosis: {},
    execution: {},
    executed_actions: [],
    messages: [],
    timestamp: new Date().toISOString(),
    approval: {
      state: 'pending',
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      retry_safe: false,
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline-credential' });
  vi.spyOn(message, 'success');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
  api.getAutoFixInfo.mockResolvedValue({
    service: '测试修复服务',
    status: 'initialized',
    capabilities: [],
    endpoints: {},
  });
  api.getAutoFixReady.mockResolvedValue({
    ready: true,
    healthy: true,
    status: 'ready',
  });
  api.executeAutoFixWorkflow.mockImplementation(async () => plan());
  api.confirmAutoFixWorkflow.mockImplementation(async () => ({
    ...plan('执行结论'),
    status: 'completed',
    blocked_actions: [],
    executed_actions: [{ action_id: 'restart', status: 'succeeded' }],
    approval: {
      state: 'completed',
      expires_at: new Date().toISOString(),
      retry_safe: false,
    },
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
  return wrapper!
    .findAll('button')
    .find((item) => item.text().replace(/\s/g, '').includes(text))!;
}
async function fillAndRun() {
  await wrapper!
    .get('input[placeholder="例如 payment-service"]')
    .setValue('owned-api');
  await wrapper!
    .get('textarea[placeholder="描述当前故障现象、涉及资源和期望处理方式"]')
    .setValue('本次隔离验收的真实描述');
  await button('执行工作流').trigger('click');
  await flushPromises();
}
async function selectAndConfirm() {
  const checkbox = wrapper!.find('.confirm-panel input[type="checkbox"]');
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
    expect(api.executeAutoFixWorkflow).not.toHaveBeenCalled();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });
  it('身份切换立即清除旧计划和私有结论', async () => {
    await start();
    await fillAndRun();
    expect(wrapper!.text()).toContain('账户1私有审批结论');
    account.user.userInfo = { userId: '2' };
    await nextTick();
    expect(wrapper!.text()).not.toContain('账户1私有审批结论');
    expect(wrapper!.find('.confirm-panel').exists()).toBe(false);
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
    expect(wrapper!.text()).not.toContain('账户1私有审批结论');
  });
  it.each([403, 404, 409])(
    '确认返回%s后清除可重试计划与选择',
    async (status) => {
      api.confirmAutoFixWorkflow.mockRejectedValueOnce(
        Object.assign(new Error('请人工核对实际状态，不能盲目重试'), {
          response: { status },
        }),
      );
      await start();
      await fillAndRun();
      await selectAndConfirm();
      expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
      expect(wrapper!.find('.confirm-panel').exists()).toBe(false);
      expect(wrapper!.find('[role="alert"]').text()).toContain('不能盲目重试');
      expect(message.success).not.toHaveBeenCalled();
    },
  );
  it('硬权限失败的动作不提供可选审批框', async () => {
    const result = plan();
    result.blocked_actions[0]!.risk_assessment.permission_allowed = false;
    api.executeAutoFixWorkflow.mockResolvedValueOnce(result);
    await start();
    await fillAndRun();
    expect(
      wrapper!.find('.confirm-panel input[type="checkbox"]').exists(),
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
    expect(wrapper!.text()).toContain('测试修复服务');
    api.getAutoFixInfo.mockRejectedValueOnce(new Error('元数据不可用'));
    api.getAutoFixReady.mockRejectedValueOnce(new Error('就绪检查不可用'));
    await button('刷新服务').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).not.toContain('测试修复服务');
    expect(wrapper!.find('[role="alert"]').exists()).toBe(true);
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
