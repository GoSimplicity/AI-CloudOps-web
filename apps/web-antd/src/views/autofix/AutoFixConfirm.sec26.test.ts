import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AutoFixWorkflow from './AutoFixWorkflow.vue';

/**
 * SEC-25/26 规则 3（pending 判定）/ 规则 4（逐项 + 批量确认，无拒绝按钮，404 计划已失效）。
 * 按「有按钮权限」渲染；权限判断见 utils/permission/*.test.ts。
 */
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

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

let wrapper: undefined | VueWrapper;
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
function pending(ids: string[], approval: Record<string, unknown> = {}) {
  const items = ids.map((id) => action(id));
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
    approval: {
      state: 'pending',
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      retry_safe: false,
      confirmation_required: true,
      confirm_endpoint: '/api/v1/autofix/workflow/confirm',
      pending_action_ids: ids,
      ...approval,
    },
  };
}
const completed = () => ({
  ...pending([]),
  status: 'completed',
  execution: { status: 'completed' },
  next_action: 'finish',
  blocked_actions: [],
  approval: {
    state: 'completed',
    expires_at: new Date().toISOString(),
    retry_safe: false,
    confirmation_required: false,
    pending_action_ids: [],
  },
});

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'offline-credential' });
  vi.spyOn(message, 'success').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'warning').mockImplementation((() => {}) as any);
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
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
    service: 's',
    status: 'ok',
    capabilities: [],
    endpoints: {},
  });
  api.getAutoFixReady.mockResolvedValue({ ready: true });
  api.executeAutoFixWorkflow.mockResolvedValue(pending(['a1', 'a2']));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function startAndRun() {
  wrapper = mount(AutoFixWorkflow, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
  await wrapper
    .get('input[placeholder="例如 payment-service"]')
    .setValue('owned-api');
  await wrapper
    .get('textarea[placeholder="描述当前故障现象、涉及资源和期望处理方式"]')
    .setValue('测试用故障描述');
  await button('执行工作流')!.trigger('click');
  await flushPromises();
}
function buttons(text: string) {
  return wrapper!
    .findAll('button')
    .filter((item) => item.text().replace(/\s/g, '').includes(text));
}
function button(text: string) {
  return buttons(text)[0];
}

describe('规则 4：逐项确认 / 批量确认', () => {
  it('每个待确认动作有「确认此项」，另有「全部确认」；没有拒绝按钮', async () => {
    await startAndRun();
    expect(buttons('确认此项')).toHaveLength(2);
    expect(buttons('全部确认')).toHaveLength(1);
    expect(buttons('拒绝')).toHaveLength(0);
    expect(buttons('驳回')).toHaveLength(0);
    // 原有按钮保留
    expect(buttons('确认并继续执行')).toHaveLength(1);
  });

  it('逐项确认：只提交这一项；部分确认后仍为 pending，剩余项继续可确认', async () => {
    api.confirmAutoFixWorkflow.mockResolvedValueOnce(pending(['a2']));
    await startAndRun();
    await buttons('确认此项')[0]!.trigger('click');
    await flushPromises();
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      plan_id: 'fake-plan-id',
      approved_action_ids: ['a1'],
    });
    expect(buttons('确认此项')).toHaveLength(1);
    expect(wrapper!.text()).toContain('原计划动作 a2');
    expect(message.warning).toHaveBeenCalled();
  });

  it('全部确认：一次提交全部可确认项', async () => {
    api.confirmAutoFixWorkflow.mockResolvedValueOnce(completed());
    await startAndRun();
    await button('全部确认')!.trigger('click');
    await flushPromises();
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledTimes(1);
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      plan_id: 'fake-plan-id',
      approved_action_ids: ['a1', 'a2'],
    });
    expect(message.success).toHaveBeenCalled();
    expect(wrapper!.find('.confirm-panel').exists()).toBe(false);
  });

  it('404：结果不确定时提示先核对并清掉计划', async () => {
    api.confirmAutoFixWorkflow.mockRejectedValueOnce(
      Object.assign(new Error('审批计划不存在'), { response: { status: 404 } }),
    );
    await startAndRun();
    await buttons('确认此项')[0]!.trigger('click');
    await flushPromises();
    expect(wrapper!.find('[role="alert"]').text()).toContain(
      '操作结果尚未确认',
    );
    expect(wrapper!.find('.confirm-panel').exists()).toBe(false);
    expect(buttons('确认此项')).toHaveLength(0);
  });
});

describe('规则 3：pending 由 status + approval 字段共同决定', () => {
  it('approval.confirmation_required=false：不当作待确认，不发确认请求', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce(
      pending(['a1'], { confirmation_required: false }),
    );
    await startAndRun();
    const confirmOne = button('确认此项');
    if (confirmOne) await confirmOne.trigger('click');
    const all = button('全部确认');
    if (all) await all.trigger('click');
    await flushPromises();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('approval.state 不是 pending：不发确认请求', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce(
      pending(['a1'], { state: 'completed' }),
    );
    await startAndRun();
    const all = button('全部确认');
    if (all) await all.trigger('click');
    await flushPromises();
    expect(api.confirmAutoFixWorkflow).not.toHaveBeenCalled();
  });

  it('只有 pending_action_ids 里的动作可确认', async () => {
    api.executeAutoFixWorkflow.mockResolvedValueOnce({
      ...pending(['a1', 'a2']),
      approval: { ...pending(['a1']).approval },
    });
    api.confirmAutoFixWorkflow.mockResolvedValueOnce(completed());
    await startAndRun();
    expect(buttons('确认此项')).toHaveLength(1);
    await button('全部确认')!.trigger('click');
    await flushPromises();
    expect(api.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      plan_id: 'fake-plan-id',
      approved_action_ids: ['a1'],
    });
  });
});
