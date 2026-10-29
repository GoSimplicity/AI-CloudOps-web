import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { Modal } from 'ant-design-vue';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Notification from './Notification.vue';

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));
const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
const fixture = {
  id: 17,
  name: '接收范围验收',
  channels: ['email'],
  recipient_types: ['creator'],
  event_types: ['instance_created'],
  trigger_type: 'immediate',
  message_template: '真实工单 {title}',
  status: 2,
  priority: 2,
  is_default: 2,
  max_retries: 3,
  retry_interval: 5,
  created_at: '2026-10-23T10:00:00Z',
  updated_at: '2026-10-23T10:00:00Z',
};
let wrapper: VueWrapper;
const checkbox = (name: string) =>
  [
    ...document.querySelectorAll<HTMLLabelElement>(
      '.ant-modal .ant-checkbox-wrapper',
    ),
  ].find((label) => label.textContent?.trim() === name)!;
const setInput = async (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(selector)!;
  expect(input).not.toBeNull();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
};
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.ant-modal button')].find(
    (button) => button.textContent?.replace(/\s/g, '') === name,
  )!;
const save = async () => {
  document
    .querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')!
    .click();
  await flushPromises();
};
const edit = async (record: object) => {
  client.get.mockResolvedValueOnce({ items: [record], total: 1 });
  await wrapper.get('.ant-input-search-button').trigger('click');
  await flushPromises();
  await wrapper
    .findAll('.action-buttons button')
    .find((button) => button.text().replace(/\s/g, '') === '编辑')!
    .trigger('click');
  await flushPromises();
};
const copy = async () => {
  await wrapper.get('.ant-dropdown-trigger').trigger('click');
  await flushPromises();
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-dropdown-menu-item')).not.toBeNull(),
  );
  [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
    .find((item) => item.textContent?.includes('复制配置'))!
    .click();
  await flushPromises();
};
beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockImplementation((url) =>
    Promise.resolve(
      url === '/workorder/notification/list'
        ? { items: [{ ...fixture }], total: 1 }
        : { items: [], total: 0 },
    ),
  );
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  wrapper = mount(Notification, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
});
afterEach(() => {
  Modal.destroyAll();
  wrapper.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('通知接收范围与状态合同', () => {
  it('复制禁用配置后创建请求保留禁用状态', async () => {
    await flushPromises();
    await copy();
    await save();
    await vi.waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/notification/create',
      expect.objectContaining({ status: 2 }),
    );
  });
  it('创建表单显示状态并默认禁用', async () => {
    await flushPromises();
    await wrapper.get('[aria-label="创建通知配置"]').trigger('click');
    await flushPromises();
    const state = document.querySelector('[aria-label="通知启用状态"]');
    expect(state).not.toBeNull();
    expect(state?.getAttribute('aria-checked')).toBe('false');
    expect(checkbox('部门用户')).toBeDefined();
    expect(checkbox('自定义地址')).toBeDefined();
  });
  it('部门接收人选择保留正整数ID数组', async () => {
    await flushPromises();
    await edit({
      ...fixture,
      recipient_types: ['dept'],
      recipient_depts: ['12'],
    });
    expect(checkbox('部门用户')?.querySelector('input')?.checked).toBe(true);
    await save();
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.put).toHaveBeenCalledWith(
      '/workorder/notification/update/17',
      expect.objectContaining({
        recipient_types: ['dept'],
        recipient_depts: ['12'],
      }),
    );
  });
  it('自定义地址可读取修改并与渠道一起往返，显式0重试不丢', async () => {
    await flushPromises();
    await edit({
      ...fixture,
      max_retries: 0,
      recipient_types: ['custom'],
      recipient_addresses: [
        {
          channel: 'email',
          address: 'original@example.test',
          name: '原接收人',
        },
      ],
    });
    await setInput('[aria-label="自定义接收地址1"]', ' next@example.test ');
    await save();
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.put).toHaveBeenCalledWith(
      '/workorder/notification/update/17',
      expect.objectContaining({
        max_retries: 0,
        recipient_addresses: [
          { channel: 'email', address: 'next@example.test', name: '原接收人' },
        ],
      }),
    );
  });
  it('取消地址编辑不污染列表原配置，重新编辑仍读原值', async () => {
    await flushPromises();
    const record = {
      ...fixture,
      recipient_types: ['custom'],
      recipient_addresses: [
        { channel: 'email', address: 'original@example.test', name: '' },
      ],
    };
    await edit(record);
    await setInput('[aria-label="自定义接收地址1"]', 'not-saved@example.test');
    button('Cancel').click();
    await flushPromises();
    await edit(record);
    expect(
      (
        document.querySelector(
          '[aria-label="自定义接收地址1"]',
        ) as HTMLInputElement
      ).value,
    ).toBe('original@example.test');
    expect(client.put).not.toHaveBeenCalled();
  });
  it('自定义类型没有地址时阻止提交，不用内部用户ID冒充外部地址', async () => {
    await flushPromises();
    await edit({
      ...fixture,
      recipient_types: ['custom'],
      recipient_addresses: [],
    });
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(document.querySelector('.recipient-error')?.textContent).toContain(
      '1至100',
    );
  });
  it('非数字部门ID在表单内显示错误，不发送更新', async () => {
    await flushPromises();
    await edit({
      ...fixture,
      recipient_types: ['dept'],
      recipient_depts: ['not-an-id'],
    });
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(
      document.querySelector('.ant-form-item-explain-error')?.textContent,
    ).toContain('正整数');
  });
  it('地址渠道必须在通知channels中，不隐式推断渠道', async () => {
    await flushPromises();
    await edit({
      ...fixture,
      recipient_types: ['custom'],
      recipient_addresses: [{ channel: 'feishu', address: 'ou_owned' }],
    });
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(document.querySelector('.recipient-error')?.textContent).toContain(
      '已选择',
    );
  });
  it('复制自定义地址不丢接收范围和禁用状态', async () => {
    await flushPromises();
    client.get.mockResolvedValueOnce({
      items: [
        {
          ...fixture,
          recipient_types: ['custom'],
          recipient_addresses: [
            { channel: 'email', address: 'owner@example.test', name: '负责人' },
          ],
        },
      ],
      total: 1,
    });
    await wrapper.get('.ant-input-search-button').trigger('click');
    await flushPromises();
    await copy();
    await save();
    await vi.waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/notification/create',
      expect.objectContaining({
        status: 2,
        recipient_types: ['custom'],
        recipient_addresses: [
          { channel: 'email', address: 'owner@example.test', name: '负责人' },
        ],
      }),
    );
  });
  it('处理中连续保存只发送一次创建，取消入口禁用', async () => {
    await flushPromises();
    await copy();
    const pending = Promise.withResolvers<any>();
    client.post.mockReturnValueOnce(pending.promise);
    try {
      const confirm = document.querySelector<HTMLButtonElement>(
        '.ant-modal-footer .ant-btn-primary',
      )!;
      confirm.click();
      confirm.click();
      await flushPromises();
      await vi.waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
      expect(button('Cancel').disabled).toBe(true);
    } finally {
      pending.resolve({});
      await flushPromises();
    }
  });
  it('创建延迟通知将延迟与有限重复参数发送到后端', async () => {
    await flushPromises();
    await copy();
    const delayed = document.querySelector<HTMLInputElement>('.ant-modal input[type="radio"][value="delayed"]')!;
    delayed.click();
    await flushPromises();
    await setInput('#notification-delay-minutes', '15');
    await setInput('#notification-repeat-interval', '10');
    await setInput('#notification-repeat-count', '3');
    await save();
    await vi.waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
    expect(client.post.mock.calls[0]![1]).toEqual(expect.objectContaining({ trigger_type: 'delayed', delay_minutes: 15, repeat_interval: 10, repeat_count: 3 }));
  });
  it('历史高级配置未更改触发参数时不会偷偷重新提交排期或状态', async () => {
    await flushPromises();
    await edit({ ...fixture, status: 1, trigger_type: 'scheduled', scheduled_time: '2030-01-01T00:00:00Z', trigger_version: 0 });
    expect(document.querySelector<HTMLInputElement>('.ant-modal input[type="radio"][value="scheduled"]')?.disabled).toBe(false);
    expect(document.querySelector('.ant-modal')?.textContent).toContain('历史高级规则尚未验证');
    await save();
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    const payload = client.put.mock.calls[0]![1];
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('trigger_type');
    expect(payload).not.toHaveProperty('scheduled_time');
    expect(payload).not.toHaveProperty('clear_trigger');
  });
  it('未修改旧触发参数时普通编辑不会悄悄清除历史字段', async () => {
    await flushPromises();
    await edit({ ...fixture, scheduled_time: '2030-01-01T00:00:00Z', repeat_interval: 30, trigger_condition: { previous: true } });
    await save();
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    const payload = client.put.mock.calls[0]![1];
    for (const key of ['trigger_type', 'scheduled_time', 'repeat_interval', 'trigger_condition', 'clear_trigger']) expect(payload).not.toHaveProperty(key);
  });
  it('历史未支持渠道不能在编辑时被悄悄删除，需明确移除后保存', async () => {
    await flushPromises();
    await edit({ ...fixture, channels: ['email', 'sms'] });
    expect(document.querySelector('.ant-modal')?.textContent).toContain(
      '此配置含当前服务未支持的渠道',
    );
    await save();
    expect(client.put).not.toHaveBeenCalled();
    button('移除不支持渠道').click();
    await flushPromises();
    await save();
    await vi.waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.put.mock.calls[0]![1].channels).toEqual(['email']);
  });
  it.each(['0', '1e3'])('部门ID %s不被数值转换误当有效ID', async (id) => {
    await flushPromises();
    await edit({
      ...fixture,
      recipient_types: ['dept'],
      recipient_depts: [id],
    });
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(
      document.querySelector('.ant-form-item-explain-error')?.textContent,
    ).toContain('正整数');
  });
});
