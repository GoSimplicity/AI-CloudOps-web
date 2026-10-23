import { defineComponent, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AutoFixWorkflow from './AutoFixWorkflow.vue';

const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
vi.mock('@vben/stores', () => ({ useUserStore: () => account.user, useAccessStore: () => account.access }));
const wrappers: VueWrapper[] = [];
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount(); });

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
        type: String,
        default: '',
      },
    },
    template: '<span class="icon-stub">{{ icon }}</span>',
  }),
}));

const ButtonStub = defineComponent({
  name: 'ButtonStub',
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
});

const InputStub = defineComponent({
  name: 'InputStub',
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  emits: ['update:value'],
  template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
});

const TextareaStub = defineComponent({
  name: 'TextareaStub',
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  emits: ['update:value'],
  template:
    '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>',
});

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  emits: ['change', 'update:value'],
  template:
    '<select :value="value" @change="$emit(\'update:value\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
});

const SelectOptionStub = defineComponent({
  name: 'SelectOptionStub',
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  template: '<option :value="value"><slot /></option>',
});

const CheckboxStub = defineComponent({
  name: 'CheckboxStub',
  props: {
    checked: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  template:
    '<input type="checkbox" :checked="checked" @change="$emit(\'change\', { target: { checked: $event.target.checked } })" />',
});

const AlertStub = defineComponent({
  name: 'AlertStub',
  props: {
    description: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
  },
  template: '<div class="alert-stub"><span>{{ message }}</span><span>{{ description }}</span><slot /></div>',
});

const DrawerStub = defineComponent({
  name: 'DrawerStub',
  props: {
    open: {
      type: Boolean,
      default: false,
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
      type: Array,
      default: () => [],
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

describe('AutoFixWorkflow.vue', () => {
  beforeEach(() => {
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
    expect(autofixMocks.getAutoFixReady).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('AutoFix Service');
    expect(wrapper.text()).toContain('ready');
    expect(wrapper.text()).toContain('langgraph');
    expect(wrapper.text()).toContain('诊断转换');
  });

  it('executes workflow and renders reviewer result', async () => {
    autofixMocks.executeAutoFixWorkflow.mockResolvedValue({
      agents_used: ['Coordinator', 'Reviewer'],
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
            resource_exists: true,
            requires_human_confirmation: true,
            reasons: ['需要密钥确认'],
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
      plan: {
        plan_id: 'autofix-default-payment-service-123',
      },
      status: 'needs_human_confirmation',
      approval: { state: 'pending', expires_at: '2099-01-01T00:00:00Z', retry_safe: false },
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
      },
      review: {
        approved: true,
        approved_action_ids: ['block-secret-check'],
        reason: '已执行 1 个经人工确认动作',
      },
      plan: {
        plan_id: 'autofix-default-payment-service-123',
      },
      status: 'completed',
      timestamp: '2026-06-06T10:31:00Z',
    });

    const wrapper = createWrapper();

    await flushPromises();

    await wrapper.find('select').setValue('imagepull');
    await wrapper.find('input[placeholder="例如 payment-service"]').setValue('payment-service');

    const runButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('执行工作流'));

    expect(runButton).toBeDefined();

    await runButton!.trigger('click');
    await flushPromises();

    expect(autofixMocks.executeAutoFixWorkflow).toHaveBeenCalledWith({
      deployment: 'payment-service',
      event:
        'ImagePullBackOff: failed to pull image，可能和镜像地址、Secret或网络连通性有关。',
      namespace: 'default',
      problem_description:
        'Deployment 镜像拉取失败，请检查镜像地址、镜像拉取密钥和网络连通性，并给出可控修复动作。',
    });
    expect(messageMocks.warning).toHaveBeenCalledWith('工作流已生成原计划，待执行动作需要明确审批');
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

    await confirmButton!.trigger('click');
    await flushPromises();

    expect(autofixMocks.confirmAutoFixWorkflow).toHaveBeenCalledWith({
      approved_action_ids: ['block-secret-check'],
      plan_id: 'autofix-default-payment-service-123',
    });
    expect(messageMocks.success).toHaveBeenCalledWith('已确认并执行所选原计划动作');
    expect(wrapper.text()).toContain('已执行 1 个经人工确认动作');
  });
});
