import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { markRequestLayerNotice } from '#/utils/permission/request-notice';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  id: 7,
  name: '发布通知',
  description: '',
  event_types: ['instance_created'],
  trigger_type: 'immediate',
  channels: ['email'],
  recipient_types: ['creator'],
  message_template: '工单通知：{title}/{recipient_name}',
  max_retries: 3,
  retry_interval: 5,
  status: 1,
  priority: 2,
  operator_id: 1,
  is_default: 2,
  created_at: '2026-10-23T10:00:00Z',
  updated_at: '2026-10-23T10:00:00Z',
};
let wrapper: VueWrapper;
const query = async () => {
  await wrapper.get('.search-input .ant-input-search-button').trigger('click');
  await flushPromises();
};
const menu = async (text: string) => {
  await wrapper.get('.ant-dropdown-trigger').trigger('click');
  await flushPromises();
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-dropdown-menu-item')).not.toBeNull(),
  );
  [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
    .find((el) => el.textContent?.includes(text))!
    .click();
  await flushPromises();
};
beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockImplementation((url: string) =>
    Promise.resolve(
      url === '/workorder/notification/list'
        ? { items: [{ ...fixture }], total: 33 }
        : { items: [], total: 0 },
    ),
  );
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
describe('通知配置真实控件', () => {
  it('分页使用后端page_size并如实区分本页统计，不编造今日发送数', async () => {
    await flushPromises();
    expect(client.get).toHaveBeenCalledWith('/workorder/notification/list', {
      params: expect.objectContaining({ page: 1, page_size: 10 }),
    });
    expect(wrapper.text()).toContain('本页启用');
    expect(wrapper.text()).not.toContain('今日发送');
  });
  it('查询失败清旧数据并从页面重试恢复', async () => {
    await flushPromises();
    expect(wrapper.text()).toContain('发布通知');
    client.get.mockRejectedValueOnce(new Error('offline'));
    await query();
    expect(wrapper.find('.name-text').exists()).toBe(false);
    expect(wrapper.get('.ant-alert').text()).toContain('加载通知配置失败');
    await wrapper.get('.ant-alert button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.name-text').text()).toBe('发布通知');
  });
  it('迟到查询不能覆盖新筛选', async () => {
    await flushPromises();
    const pending = Promise.withResolvers<any>();
    client.get.mockReturnValueOnce(pending.promise);
    await query();
    client.get.mockResolvedValueOnce({
      items: [{ ...fixture, id: 8, name: '当前查询' }],
      total: 1,
    });
    await query();
    pending.resolve({ items: [{ ...fixture, name: '旧查询' }], total: 33 });
    await flushPromises();
    expect(wrapper.get('.name-text').text()).toBe('当前查询');
  });
  it('发送记录使用notification_id，列表分页合同一致', async () => {
    await flushPromises();
    await menu('发送记录');
    expect(client.get).toHaveBeenCalledWith('/workorder/notification/logs', {
      params: expect.objectContaining({ notification_id: 7, page_size: 10 }),
    });
    expect(client.post).not.toHaveBeenCalled();
  });
  it('发送记录显示后端数字状态及真实地址和时间字段', async () => {
    await flushPromises();
    client.get.mockResolvedValueOnce({
      items: [
        {
          id: 12,
          channel: 'email',
          recipient_addr: 'safe@example.test',
          status: 3,
          send_at: '2026-10-23T10:00:00Z',
          error_message: '',
        },
      ],
      total: 1,
    });
    await menu('发送记录');
    const modal = document.querySelector('.ant-modal')!;
    expect(modal.textContent).toContain('safe@example.test');
    expect(modal.textContent).toContain('成功');
    expect(modal.textContent).toContain('2026-10-23');
  });
  it('测试发送要求明确接收地址，打开和取消不发送任何通知', async () => {
    await flushPromises();
    await menu('测试发送');
    expect(
      document.querySelector('.ant-modal input[placeholder="请输入接收地址"]'),
    ).not.toBeNull();
    expect(client.post).not.toHaveBeenCalled();
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ]
      .find((button) =>
        button.textContent?.replace(/\s/g, '').match(/^(取消|Cancel)$/),
      )!
      .click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  });
  it('测试发送只提交明确渠道与地址，处理中连续确认不会重复发送', async () => {
    await flushPromises();
    await menu('测试发送');
    const pending = Promise.withResolvers<any>();
    client.post.mockReturnValueOnce(pending.promise);
    const input = document.querySelector<HTMLInputElement>(
      '.ant-modal input[placeholder="请输入接收地址"]',
    )!;
    input.value = ' safe@example.test ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
    const send = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((button) => button.textContent?.replace(/\s/g, '') === '发送')!;
    send.click();
    send.click();
    await flushPromises();
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/notification/test/send',
      { notification_id: 7, channel: 'email', recipient: 'safe@example.test' },
    );
    pending.resolve({});
    await flushPromises();
  });
  it('手动发送保留原模板变量供用户审阅，不替换虚构人员和工单', async () => {
    await flushPromises();
    await menu('手动发送');
    expect(
      (document.querySelector('.ant-modal textarea') as HTMLTextAreaElement)
        .value,
    ).toBe(fixture.message_template);
    expect(document.querySelector('.ant-modal')?.textContent).toContain(
      '模板变量不会自动替换',
    );
    expect(client.post).not.toHaveBeenCalled();
  });
  it('删除确认发送与JSON绑定约定一致的id，不产生空body错误', async () => {
    await flushPromises();
    client.delete.mockResolvedValueOnce({});
    await menu('删除');
    await vi.waitFor(() => expect(document.querySelector('.ant-modal-confirm')).not.toBeNull());
    [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-confirm button')].find(button => button.textContent?.replace(/\s/g, '') === '删除')!.click();
    await flushPromises();
    expect(client.delete).toHaveBeenCalledWith(
      '/workorder/notification/delete/7',
      { data: { id: 7 } },
    );
  });
  it.each([
    ['请求层已提示的 HTTP 500（有 http-error 标记）', () => {
      const error = Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } });
      markRequestLayerNotice(error, 'http-error:内部服务器错误');
      return error;
    }, 0],
    ['403（已统一提示）', () => Object.assign(new Error('Error 403'), { [Symbol.for('ai-cloudops.permissionDenied')]: true }), 0],
    ['取消', () => Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }), 0],
    ['非请求错误', () => new Error('配置被占用 409'), 1],
  ] as const)('incr3：删除失败（%s）按 shouldNotifyPageError 决定是否弹页面文案', async (_label, make, times) => {
    await flushPromises();
    client.delete.mockRejectedValueOnce(make());
    const spy = vi.spyOn(message, 'error');
    await menu('删除');
    await vi.waitFor(() => expect(document.querySelector('.ant-modal-confirm')).not.toBeNull());
    [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-confirm button')].find(button => button.textContent?.replace(/\s/g, '') === '删除')!.click();
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(times);
    if (times) expect(spy).toHaveBeenCalledWith('配置正在使用中，无法删除');
  });
  it('复制配置进入可审核创建表单，取消不调用不存在的复制接口或写API', async () => {
    await flushPromises();
    await menu('复制配置');
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '创建通知配置',
    );
    expect(
      (document.querySelector('.ant-modal input') as HTMLInputElement)?.value,
    ).toContain('副本');
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ]
      .find((button) =>
        button.textContent?.replace(/\s/g, '').match(/^(取消|Cancel)$/),
      )!
      .click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });
});
