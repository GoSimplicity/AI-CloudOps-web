import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { Modal, Select } from 'ant-design-vue';
import { useAccessStore } from '@vben/stores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Instance from './Instance.vue';

const permissions = vi.hoisted(() => ({ edit: true }));
vi.mock('@vben/stores', async (original) => {
  const actual = await original<typeof import('@vben/stores')>();
  const { reactive } = await import('vue');
  const state = reactive({ accessToken: 'user-a' });
  return { ...actual, useAccessStore: () => state };
});

// FE-02：本文件验证业务行为，按「有按钮权限」渲染；权限判断本身见 utils/permission/*.test.ts
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({
    can: () => true,
    hasPerm: (code: string) =>
      code === '/api/workorder/instance/update/:id' ? permissions.edit : true,
  }),
}));
const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
const row = {
  id: 7,
  title: '待处理变更',
  serial_number: 'WO-7',
  description: '',
  status: 2,
  priority: 2,
  process_id: 1,
  operator_id: 1,
  operator_name: '验收用户',
  tags: [],
  form_data: {},
  created_at: '2026-10-23T10:00:00Z',
  updated_at: '2026-10-23T10:00:00Z',
};
const isMain = (url: string, options: any) =>
  url === '/workorder/instance/list' && Object.hasOwn(options.params, 'search');
const response = (url: string, options: any) => {
  if (url === '/workorder/instance/list')
    return Promise.resolve(
      isMain(url, options)
        ? { items: [{ ...row }], total: 91 }
        : {
            items: [],
            total:
              ({ 2: 20, 3: 30, 4: 40 } as Record<number, number>)[
                options.params.status
              ] ?? 91,
          },
    );
  return Promise.resolve({ items: [], total: 0 });
};
let wrapper: VueWrapper;
const query = async (keyword = '') => {
  await wrapper.get('.search-input input').setValue(keyword);
  await wrapper.get('.search-input .ant-input-search-button').trigger('click');
  await flushPromises();
};
beforeEach(() => {
  permissions.edit = true;
  useAccessStore().accessToken = 'user-a';
  vi.clearAllMocks();
  client.get.mockImplementation(response);
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
  wrapper = mount(Instance, {
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
describe('工单实例真实控件', () => {
  it('查询失败清除旧列表，并从可见错误恢复', async () => {
    await flushPromises();
    client.get.mockImplementation((url, options) =>
      isMain(url, options)
        ? Promise.reject(new Error('offline'))
        : response(url, options),
    );
    await query();
    expect(wrapper.find('.title-text').exists()).toBe(false);
    expect(wrapper.get('.list-error').text()).toContain('加载工单数据失败');
    client.get.mockImplementation(response);
    await wrapper.get('.list-error button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.title-text').text()).toBe(row.title);
  });
  it('本页状态统计明确标注口径且不额外请求四次全局计数', async () => {
    await flushPromises();
    const requests = client.get.mock.calls.filter(
      ([url]) => url === '/workorder/instance/list',
    );
    expect(requests).toHaveLength(1);
    expect(wrapper.get('.stats-row').text()).toContain('匹配工单数');
    expect(wrapper.get('.stats-row').text()).toContain('本页待处理');
    expect(wrapper.get('.stats-row').text()).toContain('91');
  });
  it('旧成功不能覆盖新筛选', async () => {
    await flushPromises();
    const pending = Promise.withResolvers<any>();
    client.get.mockImplementation((url, options) =>
      isMain(url, options)
        ? options.params.search === 'old'
          ? pending.promise
          : Promise.resolve({
              items: [{ ...row, title: '当前查询' }],
              total: 1,
            })
        : response(url, options),
    );
    await query('old');
    await query('new');
    pending.resolve({ items: [{ ...row, title: '旧查询' }], total: 91 });
    await flushPromises();
    expect(wrapper.get('.title-text').text()).toBe('当前查询');
  });
  it('旧失败不能清除新筛选', async () => {
    await flushPromises();
    const pending = Promise.withResolvers<any>();
    client.get.mockImplementation((url, options) =>
      isMain(url, options)
        ? options.params.search === 'old'
          ? pending.promise
          : Promise.resolve({
              items: [{ ...row, title: '当前查询' }],
              total: 1,
            })
        : response(url, options),
    );
    await query('old');
    await query('new');
    pending.reject(new Error('old failed'));
    await flushPromises();
    expect(wrapper.get('.title-text').text()).toBe('当前查询');
    expect(wrapper.find('.list-error').exists()).toBe(false);
  });
  it.each(['success', 'failure'])(
    '旧详情请求%s不能覆盖后打开的工单',
    async (outcome) => {
      await flushPromises();
      const pending = Promise.withResolvers<any>();
      client.get.mockImplementation((url, options) => {
        if (isMain(url, options))
          return Promise.resolve({
            items: [{ ...row }, { ...row, id: 8, title: '第二条工单' }],
            total: 2,
          });
        if (url === '/workorder/instance/detail/7') return pending.promise;
        if (url === '/workorder/instance/detail/8')
          return Promise.resolve({ ...row, id: 8, title: '当前详情' });
        if (url.includes('/actions/')) return Promise.resolve([]);
        return response(url, options);
      });
      await query('two');
      const view = wrapper
        .findAll('.action-buttons button')
        .filter((button) => button.text().replace(/\s/g, '') === '查看');
      await view[0]!.trigger('click');
      await flushPromises();
      await view[1]!.trigger('click');
      await flushPromises();
      if (outcome === 'success') pending.resolve({ ...row, title: '旧详情' });
      else pending.reject(new Error('old unavailable'));
      await flushPromises();
      expect(document.querySelector('.detail-dialog h2')?.textContent).toBe(
        '当前详情',
      );
    },
  );
  it('实例通知记录按数字状态显示成功，详情使用安全可读文本', async () => {
    await flushPromises();
    client.get.mockImplementation((url, options) =>
      url === '/workorder/notification/logs'
        ? Promise.resolve({
            items: [
              {
                id: 10,
                channel: 'email',
                recipient_addr: 'safe@example.test',
                status: 3,
                event_type: 'instance_created',
                send_at: '2026-10-23T10:00:00Z',
                subject: '<img data-private-probe="x">literal',
              },
            ],
            total: 1,
          })
        : response(url, options),
    );
    await wrapper.get('.ant-dropdown-trigger').trigger('click');
    await flushPromises();
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-dropdown-menu-item')).not.toBeNull(),
    );
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((el) => el.textContent?.includes('通知发送记录'))!
      .click();
    await flushPromises();
    expect(
      document.querySelector('.notification-logs-dialog')?.textContent,
    ).toContain('发送成功');
    expect(
      document.querySelector('.notification-logs-dialog')?.textContent,
    ).toContain('safe@example.test');
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.notification-logs-dialog button',
      ),
    ]
      .find((button) => button.textContent?.replace(/\s/g, '') === '查看详情')!
      .click();
    await flushPromises();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull(),
    );
    expect(
      document.querySelector('.ant-modal-confirm-content')?.textContent,
    ).toContain('<img data-private-probe="x">literal');
    expect(
      document.querySelector('.ant-modal-confirm-content [data-private-probe]'),
    ).toBeNull();
  });
  it('迟到编辑详情不能覆盖用户新打开的创建表单', async () => {
    await flushPromises();
    const pending = Promise.withResolvers<any>();
    client.get.mockImplementation((url, options) => {
      if (isMain(url, options))
        return Promise.resolve({ items: [{ ...row, status: 1 }], total: 1 });
      if (url === '/workorder/instance/detail/7') return pending.promise;
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(['edit']);
      return response(url, options);
    });
    await query('draft');
    await wrapper.get('.ant-dropdown-trigger').trigger('click');
    await flushPromises();
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent?.trim() === '编辑')!
      .click();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text().replace(/\s/g, '') === '创建工单')!
      .trigger('click');
    await flushPromises();
    pending.resolve({ ...row, title: '旧编辑内容', status: 1 });
    await flushPromises();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '创建工单',
    );
    expect(
      (document.querySelector('.instance-form-modal input') as HTMLInputElement)
        ?.value,
    ).toBe('');
  });
  it.each([
    ['流程', '/workorder/process/list', '请选择流程'],
    ['用户', '/user/list', '请选择处理人'],
  ])(
    '%s选择器滚动加载下一页而非重复第一页',
    async (_name, endpoint, placeholder) => {
      await flushPromises();
      client.get.mockImplementation((url, options) =>
        url === endpoint
          ? Promise.resolve({
              items: Array.from({ length: 20 }, (_, index) => ({
                id: index + (options.params.page - 1) * 20 + 1,
                name: `选项${index}`,
                username: `user${index}`,
              })),
              total: 40,
            })
          : response(url, options),
      );
      await wrapper
        .findAll('button')
        .find((button) => button.text().replace(/\s/g, '') === '创建工单')!
        .trigger('click');
      await flushPromises();
      const select = wrapper
        .findAllComponents(Select)
        .find((component) => component.props('placeholder') === placeholder)!;
      select.vm.$emit('dropdownVisibleChange', true);
      await flushPromises();
      select.vm.$emit('popupScroll', {
        target: { scrollTop: 90, scrollHeight: 100, clientHeight: 30 },
      });
      await flushPromises();
      expect(
        client.get.mock.calls.filter(([url]) => url === endpoint).at(-1)?.[1]
          .params.page,
      ).toBe(2);
      if (endpoint === '/workorder/process/list')
        expect(
          client.get.mock.calls.filter(([url]) => url === endpoint).at(-1)?.[1]
            .params.status,
        ).toBe(2);
    },
  );
  it('模板创建读取真实items，模板在选择器中可选', async () => {
    await flushPromises();
    client.get.mockImplementation((url, options) =>
      url === '/workorder/template/list'
        ? Promise.resolve({
            items: [{ id: 5, name: '真实可用模板', status: 1 }],
            total: 1,
          })
        : response(url, options),
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text().replace(/\s/g, '') === '从模板创建')!
      .trigger('click');
    await flushPromises();
    const select = wrapper
      .findAllComponents(Select)
      .find(
        (component) => component.props('placeholder') === '请选择工单模板',
      )!;
    await select.get('.ant-select-selector').trigger('mousedown');
    await flushPromises();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-select-dropdown')?.textContent,
      ).toContain('真实可用模板'),
    );
    expect(client.post).not.toHaveBeenCalled();
  });
  it('普通编辑不提交处理人变更，处理人字段交给独立分配操作', async () => {
    await flushPromises();
    client.get.mockImplementation((url, options) => {
      if (isMain(url, options))
        return Promise.resolve({
          items: [{ ...row, status: 1, assignee_id: 1 }],
          total: 1,
        });
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row, status: 1, assignee_id: 1 });
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(['edit']);
      return response(url, options);
    });
    client.put.mockResolvedValueOnce({});
    await query('draft');
    await wrapper.get('.ant-dropdown-trigger').trigger('click');
    await flushPromises();
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent?.trim() === '编辑')!
      .click();
    await flushPromises();
    const assignee = wrapper
      .findAllComponents(Select)
      .find((component) => component.props('placeholder') === '请选择处理人')!;
    expect(assignee.props('disabled')).toBe(true);
    document
      .querySelector<HTMLButtonElement>(
        '.instance-form-modal .ant-modal-footer .ant-btn-primary',
      )!
      .click();
    await flushPromises();
    const update = client.put.mock.calls.find(
      ([url]) => url === '/workorder/instance/update/7',
    );
    expect(update).toBeDefined();
    expect(update![1]).not.toHaveProperty('assignee_id');
    expect(update![1]).not.toHaveProperty('status');
  });
  it('服务端授权的步骤审批不因实例assignee字段为空而被前端隐藏', async () => {
    await flushPromises();
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row, assignee_id: undefined });
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(['approve']);
      return response(url, options);
    });
    await wrapper
      .findAll('.action-buttons button')
      .find((button) => button.text().replace(/\s/g, '') === '查看')!
      .trigger('click');
    await flushPromises();
    const approve = [
      ...document.querySelectorAll<HTMLButtonElement>('.detail-dialog button'),
    ].find((button) => button.textContent?.replace(/\s/g, '') === '审批通过');
    expect(approve).toBeDefined();
    approve!.click();
    await flushPromises();
    expect(
      [...document.querySelectorAll('.ant-modal-title')].some((title) =>
        title.textContent?.includes('审批'),
      ),
    ).toBe(true);
    expect(client.post).not.toHaveBeenCalled();
  });
  it('创建工单使用真实表单，取消不写入', async () => {
    await flushPromises();
    [...wrapper.findAll('button')]
      .find((button) => button.text().replace(/\s/g, '') === '创建工单')!
      .trigger('click');
    await flushPromises();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '创建工单',
    );
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ]
      .find((button) =>
        /^(取消|Cancel)$/.test(button.textContent?.replace(/\s/g, '') || ''),
      )!
      .click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });
});

describe('列表按需读取当前用户可用动作', () => {
  const currentMenu = () =>
    document.querySelector<HTMLElement>(
      '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu',
    );
  const openMenu = async () => {
    await wrapper.get('.ant-dropdown-trigger').trigger('click');
    await flushPromises();
  };
  const closeMenu = async () => {
    await wrapper.get('.ant-dropdown-trigger').trigger('click');
    await flushPromises();
  };

  it('只在展开时请求该行；不同用户在列表和详情看到一致动作', async () => {
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(
          useAccessStore().accessToken === 'user-a'
            ? ['approve', 'edit']
            : ['reject'],
        );
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row });
      return response(url, options);
    });
    await flushPromises();
    expect(
      client.get.mock.calls.filter(([url]) =>
        url.includes('/instance/actions/'),
      ),
    ).toHaveLength(0);
    await openMenu();
    expect(currentMenu()?.textContent).toContain('审批通过');
    expect(currentMenu()?.textContent).toContain('编辑');
    expect(currentMenu()?.textContent).not.toContain('拒绝工单');
    expect(
      client.get.mock.calls.filter(
        ([url]) => url === '/workorder/instance/actions/7',
      ),
    ).toHaveLength(1);
    useAccessStore().accessToken = 'user-b';
    await flushPromises();
    expect(currentMenu()?.textContent).not.toContain('审批通过');
    expect(currentMenu()?.textContent).not.toContain('编辑');
    await closeMenu();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('拒绝工单');
    expect(currentMenu()?.textContent).not.toContain('审批通过');
    await closeMenu();
    await wrapper
      .findAll('.action-buttons button')
      .find((button) => button.text().replace(/\s/g, '') === '查看')!
      .trigger('click');
    await flushPromises();
    const detail = document.querySelector('.detail-dialog');
    expect(detail?.textContent?.replace(/\s/g, '')).toContain('拒绝');
    expect(detail?.textContent?.replace(/\s/g, '')).not.toContain('审批通过');
  });

  it('身份切换后关闭已打开的旧用户详情和操作', async () => {
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(['approve']);
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row });
      return response(url, options);
    });
    await flushPromises();
    await wrapper
      .findAll('.action-buttons button')
      .find((button) => button.text().replace(/\s/g, '') === '查看')!
      .trigger('click');
    await flushPromises();
    expect(
      document.querySelector('.detail-dialog')?.textContent?.replace(/\s/g, ''),
    ).toContain('审批通过');
    useAccessStore().accessToken = 'user-b';
    await flushPromises();
    const dialog = document.querySelector<HTMLElement>('.detail-dialog');
    expect(!dialog || dialog.style.display === 'none').toBe(true);
  });

  it('即使actions有edit，没有更新接口权限也不显示列表或详情编辑', async () => {
    permissions.edit = false;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return Promise.resolve(['edit', 'submit']);
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row });
      return response(url, options);
    });
    await flushPromises();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('提交工单');
    expect(currentMenu()?.textContent).not.toContain('编辑');
    await closeMenu();
    await wrapper
      .findAll('.action-buttons button')
      .find((button) => button.text().replace(/\s/g, '') === '查看')!
      .trigger('click');
    await flushPromises();
    expect(document.querySelector('.detail-dialog')?.textContent).not.toContain(
      '编辑',
    );
  });

  it('关闭菜单或换账号后迟到响应不能显示旧用户动作', async () => {
    const pending = Promise.withResolvers<string[]>();
    let callCount = 0;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return ++callCount === 1
          ? pending.promise
          : Promise.resolve(['reject']);
      return response(url, options);
    });
    await flushPromises();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('正在读取');
    await closeMenu();
    useAccessStore().accessToken = 'user-b';
    await openMenu();
    expect(currentMenu()?.textContent).toContain('拒绝工单');
    pending.resolve(['approve']);
    await flushPromises();
    expect(currentMenu()?.textContent).toContain('拒绝工单');
    expect(currentMenu()?.textContent).not.toContain('审批通过');
  });

  it('同一工单关闭再打开，旧详情动作响应不能覆盖新结果', async () => {
    const pending = Promise.withResolvers<string[]>();
    let actionCalls = 0;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return ++actionCalls === 1
          ? pending.promise
          : Promise.resolve(['reject']);
      if (url === '/workorder/instance/detail/7')
        return Promise.resolve({ ...row });
      return response(url, options);
    });
    await flushPromises();
    const view = () =>
      wrapper
        .findAll('.action-buttons button')
        .find((button) => button.text().replace(/\s/g, '') === '查看')!;
    await view().trigger('click');
    await flushPromises();
    const close = [
      ...document.querySelectorAll<HTMLButtonElement>('.detail-dialog button'),
    ].find((button) => button.textContent?.replace(/\s/g, '') === '关闭');
    expect(close).toBeTruthy();
    close!.click();
    await flushPromises();
    await view().trigger('click');
    await flushPromises();
    pending.resolve(['approve']);
    await flushPromises();
    const content = document
      .querySelector('.detail-dialog')
      ?.textContent?.replace(/\s/g, '');
    expect(content).toContain('拒绝');
    expect(content).not.toContain('审批通过');
  });

  it('点击审批后切换账号，迟到权限检查不能打开审批弹窗', async () => {
    const pending = Promise.withResolvers<string[]>();
    let callCount = 0;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return ++callCount === 1
          ? Promise.resolve(['approve'])
          : pending.promise;
      return response(url, options);
    });
    await flushPromises();
    await openMenu();
    const approval = [
      ...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'),
    ].find((item) => item.textContent?.includes('审批通过'));
    expect(approval).toBeTruthy();
    approval!.click();
    await flushPromises();
    useAccessStore().accessToken = 'user-b';
    pending.resolve(['approve']);
    await flushPromises();
    expect(
      [...document.querySelectorAll('.ant-modal-title')].some((item) =>
        item.textContent?.includes('审批'),
      ),
    ).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  });

  it('取消请求不写错误且不误报无可用动作，关闭重开可重试', async () => {
    let callCount = 0;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return ++callCount === 1
          ? Promise.reject(
              Object.assign(new Error('cancelled'), { code: 'ERR_CANCELED' }),
            )
          : Promise.resolve(['approve']);
      return response(url, options);
    });
    await flushPromises();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('操作未读取');
    expect(currentMenu()?.textContent).not.toContain('操作读取失败');
    expect(currentMenu()?.textContent).not.toContain('当前无可用流转操作');
    expect(currentMenu()?.textContent).not.toContain('审批通过');
    await closeMenu();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('审批通过');
  });

  it('读取失败不显示动作，关闭重开可以重试', async () => {
    let callCount = 0;
    client.get.mockImplementation((url, options) => {
      if (url === '/workorder/instance/actions/7')
        return ++callCount === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(['approve']);
      return response(url, options);
    });
    await flushPromises();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('操作读取失败');
    expect(currentMenu()?.textContent).not.toContain('审批通过');
    await closeMenu();
    await openMenu();
    expect(currentMenu()?.textContent).toContain('审批通过');
  });
});
