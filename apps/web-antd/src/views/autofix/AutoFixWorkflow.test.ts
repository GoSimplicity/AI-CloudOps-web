import { defineComponent, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AutoFixWorkflow from './AutoFixWorkflow.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});

const autofixMocks = vi.hoisted(() => ({
  confirmAutoFixWorkflow: vi.fn(),
  executeAutoFixWorkflow: vi.fn(),
  getAutoFixInfo: vi.fn(),
  getAutoFixReady: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('#/api/core/aiops/autofix', () => ({
  confirmAutoFixWorkflow: autofixMocks.confirmAutoFixWorkflow,
  executeAutoFixWorkflow: autofixMocks.executeAutoFixWorkflow,
  getAutoFixInfo: autofixMocks.getAutoFixInfo,
  getAutoFixReady: autofixMocks.getAutoFixReady,
}));

vi.mock('ant-design-vue', () => ({
  message: {
    error: messageMocks.error,
    success: messageMocks.success,
    warning: messageMocks.warning,
  },
}));

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'Icon',
    props: {
      icon: {
        default: '',
        type: String,
      },
    },
    template: '<span class="icon-stub">{{ icon }}</span>',
  }),
}));

const ButtonStub = defineComponent({
  emits: ['click'],
  name: 'ButtonStub',
  props: {
    disabled: {
      default: false,
      type: Boolean,
    },
  },
  template:
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
});

const InputStub = defineComponent({
  emits: ['update:value'],
  name: 'InputStub',
  props: {
    value: {
      default: '',
      type: String,
    },
  },
  template:
    '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
});

const TextareaStub = defineComponent({
  emits: ['update:value'],
  name: 'TextareaStub',
  props: {
    value: {
      default: '',
      type: String,
    },
  },
  template:
    '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>',
});

const SelectStub = defineComponent({
  emits: ['change', 'update:value'],
  name: 'SelectStub',
  props: {
    value: {
      default: '',
      type: String,
    },
  },
  template:
    '<select :value="value" @change="$emit(\'update:value\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
});

const SelectOptionStub = defineComponent({
  name: 'SelectOptionStub',
  props: {
    value: {
      default: '',
      type: String,
    },
  },
  template: '<option :value="value"><slot /></option>',
});

const CheckboxStub = defineComponent({
  emits: ['change'],
  name: 'CheckboxStub',
  props: {
    checked: {
      default: false,
      type: Boolean,
    },
  },
  template:
    '<input type="checkbox" :checked="checked" @change="$emit(\'change\', { target: { checked: $event.target.checked } })" />',
});

const AlertStub = defineComponent({
  name: 'AlertStub',
  props: {
    description: {
      default: '',
      type: String,
    },
    message: {
      default: '',
      type: String,
    },
  },
  template:
    '<div class="alert-stub"><span>{{ message }}</span><span>{{ description }}</span><slot /></div>',
});

const DrawerStub = defineComponent({
  name: 'DrawerStub',
  props: {
    open: {
      default: false,
      type: Boolean,
    },
  },
  template: '<div v-if="open"><slot /></div>',
});

const PassThroughStub = defineComponent({
  name: 'PassThroughStub',
  template: '<div><slot /></div>',
});

const TableStub = defineComponent({
  name: 'TableStub',
  props: {
    dataSource: {
      default: () => [],
      type: Array,
    },
  },
  template: '<div class="table-stub">rows:{{ dataSource.length }}</div>',
});

function createWrapper() {
  const wrapper = mount(AutoFixWorkflow, {
    global: {
      stubs: {
        'a-alert': AlertStub,
        'a-button': ButtonStub,
        'a-card': PassThroughStub,
        'a-checkbox': CheckboxStub,
        'a-col': PassThroughStub,
        'a-descriptions': PassThroughStub,
        'a-descriptions-item': PassThroughStub,
        'a-drawer': DrawerStub,
        'a-empty': PassThroughStub,
        'a-form': PassThroughStub,
        'a-form-item': PassThroughStub,
        'a-input': InputStub,
        'a-row': PassThroughStub,
        'a-select': SelectStub,
        'a-select-option': SelectOptionStub,
        'a-skeleton': PassThroughStub,
        'a-space': PassThroughStub,
        'a-step': PassThroughStub,
        'a-steps': PassThroughStub,
        'a-table': TableStub,
        'a-tag': PassThroughStub,
        'a-textarea': TextareaStub,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe('autoFixWorkflow.vue', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    account.user = reactive({ userInfo: { userId: '1' } });
    account.access = reactive({ accessToken: 'offline-token' });
    autofixMocks.getAutoFixInfo.mockResolvedValue({
      capabilities: ['诊断转换', '风险评估'],
      description: '自动修复服务',
      endpoints: {
        info: '/autofix/info',
        ready: '/autofix/ready',
        workflow: '/autofix/workflow',
      },
      service: 'AutoFix Service',
      status: 'running',
      version: '1.0.0',
      workflow_engine: 'langgraph',
    });
    autofixMocks.getAutoFixReady.mockResolvedValue({
      healthy: true,
      ready: true,
      service: 'AutoFix Service',
      status: 'ready',
      timestamp: '2026-06-06T10:20:00Z',
    });
  });

  it('loads service status on mount', async () => {
    const wrapper = createWrapper();

    await flushPromises();

    expect(autofixMocks.getAutoFixInfo).toHaveBeenCalledTimes(1);
    expect(autofixMocks.getAutoFixReady).not.toHaveBeenCalled();
    await required(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('检查服务依赖')),
    ).trigger('click');
    await flushPromises();
    expect(autofixMocks.getAutoFixReady).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('AutoFix Service');
    expect(wrapper.text()).toContain('ready');
    expect(wrapper.text()).toContain('langgraph');
    expect(wrapper.text()).toContain('诊断转换');
  });

  it('executes workflow and renders reviewer result', async () => {
    autofixMocks.executeAutoFixWorkflow.mockResolvedValue({
      agents_used: ['Coordinator', 'Reviewer'],
      approval: {
        expires_at: '2099-01-01T00:00:00Z',
        // 复审 P3-1：缺 pending_action_ids 时不允许确认，夹具按契约带上
        pending_action_ids: ['block-secret-check'],
        retry_safe: false,
        state: 'pending',
      },
      blocked_actions: [
        {
          action_id: 'block-secret-check',
          action_type: 'check_image_pull_secret',
          description: '检查镜像密钥',
          executable: true,
          risk_assessment: {
            allowed: false,
            namespace_allowed: true,
            permission_allowed: true,
            reasons: ['需要密钥确认'],
            requires_human_confirmation: true,
            resource_exists: true,
            risk_level: 'high',
          },
        },
      ],
      messages: [
        {
          action: '阻断高风险动作',
          agent: 'Reviewer',
        },
      ],
      plan: {
        plan_id: 'autofix-default-payment-service-123',
      },
      review: {
        approved: false,
        blocked_actions: [
          {
            action_id: 'block-secret-check',
            action_type: 'check_image_pull_secret',
          },
        ],
        reason: '镜像密钥未确认',
      },
      status: 'needs_human_confirmation',
      timestamp: '2026-06-06T10:30:00Z',
    });

    autofixMocks.confirmAutoFixWorkflow.mockResolvedValue({
      agents_used: ['Coordinator', 'Reviewer', 'HumanConfirm', 'Executor'],
      blocked_actions: [],
      executed_actions: [
        {
          action_id: 'block-secret-check',
          action_type: 'check_image_pull_secret',
          status: 'succeeded',
        },
      ],
      execution: {
        executed_actions: [
          {
            action_id: 'block-secret-check',
            action_type: 'check_image_pull_secret',
            status: 'succeeded',
          },
        ],
        status: 'completed',
      },
      plan: {
        plan_id: 'autofix-default-payment-service-123',
      },
      review: {
        approved: true,
        approved_action_ids: ['block-secret-check'],
        reason: '已执行 1 个经人工确认动作',
      },
      status: 'completed',
      timestamp: '2026-06-06T10:31:00Z',
    });

    const wrapper = createWrapper();

    await flushPromises();

    await wrapper.find('select').setValue('imagepull');
    await wrapper
      .find('input[placeholder="例如 payment-service"]')
      .setValue('payment-service');

    const runButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('执行工作流'));

    expect(runButton).toBeDefined();

    await required(runButton).trigger('click');
    await flushPromises();

    expect(autofixMocks.executeAutoFixWorkflow).toHaveBeenCalledWith({
      deployment: 'payment-service',
      event:
        'ImagePullBackOff: failed to pull image，可能和镜像地址、Secret或网络连通性有关。',
      namespace: 'default',
      operation_id: expect.any(String),
      problem_description:
        'Deployment 镜像拉取失败，请检查镜像地址、镜像拉取密钥和网络连通性，并给出可控修复动作。',
    });
    expect(messageMocks.warning).toHaveBeenCalledWith(
      '工作流已生成原计划，待执行动作需要明确审批',
    );
    expect(wrapper.text()).toContain('需要人工确认或补充诊断');
    expect(wrapper.text()).toContain('镜像密钥未确认');
    expect(wrapper.text()).toContain('Reviewer');

    const checkbox = wrapper.find('input[type="checkbox"]');
    expect(checkbox.exists()).toBe(true);
    await checkbox.setValue(true);
    await flushPromises();

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('确认并继续执行'));
    expect(confirmButton).toBeDefined();

    await required(confirmButton).trigger('click');
    await flushPromises();

    expect(autofixMocks.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      approved_action_ids: ['block-secret-check'],
      plan_id: 'autofix-default-payment-service-123',
    });
    expect(messageMocks.success).toHaveBeenCalledWith(
      '已确认并执行所选原计划动作',
    );
    expect(wrapper.text()).toContain('已执行 1 个经人工确认动作');
  });
});
