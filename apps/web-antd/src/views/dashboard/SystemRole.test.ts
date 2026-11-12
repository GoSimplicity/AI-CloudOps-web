import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
} from '#/utils/permission/forbidden';

import SystemRole from './SystemRole.vue';

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

const api = vi.hoisted(() => ({
  assignApisToRoleApi: vi.fn(),
  createRoleApi: vi.fn(),
  deleteRoleApi: vi.fn(),
  getRoleApisApi: vi.fn(),
  getRoleDetailApi: vi.fn(),
  listApisApi: vi.fn(),
  listRolesApi: vi.fn(),
  revokeApisFromRoleApi: vi.fn(),
  updateRoleApi: vi.fn(),
}));
vi.mock('#/api/core/system/system', () => api);
vi.mock('#/api/core/system/api', () => api);

let wrapper: VueWrapper;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'error');
  api.listRolesApi.mockResolvedValue({ total: 0, items: [] });
  api.listApisApi.mockResolvedValue({ total: 0, items: [] });
  api.createRoleApi.mockResolvedValue({ id: 1 });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  wrapper = mount(SystemRole, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
});
afterEach(() => {
  wrapper.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function button(text: string) {
  return required(
    wrapper
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '').includes(text)),
  );
}

describe('角色列表真实控件交互', () => {
  it('搜索和重置通过共享筛选面板触发 API', async () => {
    await flushPromises();
    await wrapper.get('.ops-page__filters input').setValue('值班');
    await button('搜索').trigger('click');
    await flushPromises();
    expect(api.listRolesApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: '值班' }),
    );
    await button('重置').trigger('click');
    await flushPromises();
    expect(api.listRolesApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: '' }),
    );
  });

  it('主操作打开新建表单，取消不会发送创建请求', async () => {
    await flushPromises();
    await button('新建角色').trigger('click');
    await flushPromises();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '新建角色',
    );
    const cancel = required(
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.ant-modal-footer button',
        ),
      ].find((button) =>
        /^(?:取消|Cancel)$/.test(button.textContent?.replace(/\s/g, '') || ''),
      ),
    );
    cancel.click();
    await flushPromises();
    expect(api.createRoleApi).not.toHaveBeenCalled();
  });

  it('新建表单校验通过后提交输入并刷新列表', async () => {
    await flushPromises();
    await button('新建角色').trigger('click');
    await flushPromises();
    await new DOMWrapper(
      required(
        document.querySelector<HTMLInputElement>('.ant-modal input[id$=name]'),
      ),
    ).setValue('值班员');
    await new DOMWrapper(
      required(
        document.querySelector<HTMLInputElement>('.ant-modal input[id$=code]'),
      ),
    ).setValue('oncall');
    const submit = required(
      document.querySelector<HTMLButtonElement>(
        '.ant-modal-footer .ant-btn-primary',
      ),
    );
    submit.click();
    await vi.waitFor(() =>
      expect(api.createRoleApi).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'oncall', name: '值班员', status: 1 }),
      ),
    );
    await flushPromises();
    expect(api.listRolesApi).toHaveBeenCalledTimes(2);
  });

  it('查询失败时清空旧结果且提供错误反馈', async () => {
    await flushPromises();
    api.listRolesApi.mockResolvedValueOnce({
      total: 1,
      items: [
        {
          apis: [],
          code: 'oncall',
          id: 12,
          is_system: 0,
          name: '值班员',
          status: 1,
          users: [],
        },
      ],
    });
    await button('刷新').trigger('click');
    await flushPromises();
    expect(wrapper.get('.role-name').text()).toBe('值班员');
    api.listRolesApi.mockRejectedValueOnce(new Error('角色服务不可用'));
    await button('刷新').trigger('click');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith('角色服务不可用');
    expect(wrapper.find('.ant-empty-description').exists()).toBe(true);
    expect(wrapper.find('.role-name').exists()).toBe(false);
  });

  it('列表 403 已由统一提示，页面不再重复弹错但仍清空旧结果', async () => {
    await flushPromises();
    vi.mocked(message.error).mockClear();
    api.listRolesApi.mockRejectedValueOnce(await notifiedForbiddenError());
    await button('刷新').trigger('click');
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
    expect(wrapper.find('.role-name').exists()).toBe(false);
  });
});

/** 模拟请求拦截器链：业务 403 经统一提示拦截器后抛给页面的错误（已提示标记） */
async function notifiedForbiddenError() {
  const { rejected } = createForbiddenResponseInterceptor(() => {});
  return rejected(createPermissionDeniedError()).catch((error) => error);
}
