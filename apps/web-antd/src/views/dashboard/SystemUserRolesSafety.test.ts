import { useUserStore } from '@vben/stores';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SystemUser from './SystemUser.vue';

const control = vi.hoisted(() => ({
  auth: { generation: 0 },
  permissions: { assign: true, read: true, revoke: true },
}));
vi.mock('#/store/auth', async () => {
  const { reactive } = await import('vue');
  control.auth = reactive(control.auth);
  return {
    useAuthStore: () => ({ getAuthGeneration: () => control.auth.generation }),
  };
});
vi.mock('#/utils/permission', async (importOriginal) => {
  const original = await importOriginal<typeof import('#/utils/permission')>();
  const { reactive } = await import('vue');
  control.permissions = reactive(control.permissions);
  return {
    ...original,
    usePermission: () => ({
      can: () => true,
      hasPerm: (code: string) => {
        if (code === '/api/role/assign_users')
          return control.permissions.assign;
        if (code === '/api/role/revoke_users')
          return control.permissions.revoke;
        return control.permissions.read;
      },
    }),
  };
});

const api = vi.hoisted(() => ({
  assignRolesToUserApi: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
  getUserDetailApi: vi.fn(),
  getUserList: vi.fn(),
  getUserRolesApi: vi.fn(),
  getUserStatistics: vi.fn(),
  listRolesApi: vi.fn(),
  registerApi: vi.fn(),
  revokeRolesFromUserApi: vi.fn(),
  updateUserInfo: vi.fn(),
}));
vi.mock('#/api/core/system/user', () => api);
vi.mock('#/api/core/system/system', () => api);

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('测试前置条件缺失');
  return value;
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    promise,
    reject(error: Error) {
      required(reject)(error);
    },
    resolve(value: T) {
      required(resolve)(value);
    },
  };
}

const role = (id: number | undefined, name = 'role-extra') => ({
  id,
  name,
  status: 1,
});
const user = (id: number | undefined, username = 'user-a') => ({
  account_type: 1,
  enable: 1,
  id,
  roles: [],
  username,
});
const account = (userId = '1') => ({
  avatar: '',
  realName: '',
  userId,
  username: 'operator',
});
const assignedA = () => ({ items: [role(11, 'role-a')] });
const assignedB = () => ({ items: [role(22, 'role-b')] });

let wrapper: VueWrapper;
let unmounted = false;

beforeEach(async () => {
  vi.clearAllMocks();
  control.auth.generation = 0;
  Object.assign(control.permissions, {
    assign: true,
    read: true,
    revoke: true,
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo(account());
  api.getUserList.mockResolvedValue({
    total: 2,
    items: [user(101), user(202, 'user-b')],
  });
  api.getUserStatistics.mockResolvedValue({
    active_user_count: 2,
    admin_count: 1,
  });
  api.listRolesApi.mockResolvedValue({
    total: 3,
    items: [role(11, 'role-a'), role(22, 'role-b'), role(33)],
  });
  api.getUserRolesApi.mockImplementation((id: number) =>
    Promise.resolve(id === 101 ? assignedA() : assignedB()),
  );
  api.assignRolesToUserApi.mockResolvedValue(null);
  api.revokeRolesFromUserApi.mockResolvedValue(null);
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
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
  unmounted = false;
  wrapper = mount(SystemUser, {
    attachTo: document.body,
    global: { plugins: [Antd, pinia], stubs: { Icon: true } },
  });
  await flushPromises();
});

afterEach(() => {
  if (!unmounted) wrapper.unmount();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openRoles(username = 'user-a') {
  const row = required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(username)),
  );
  await required(
    row
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '角色'),
  ).trigger('click');
  await flushPromises();
}

function rolesModal() {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === '角色管理'),
  );
}

async function closeRoles() {
  rolesModal().vm.$emit('update:open', false);
  await flushPromises();
}

async function roleButton(
  action: 'assign' | 'revoke',
  name = action === 'assign' ? 'role-extra' : 'role-a',
) {
  if (action === 'assign') {
    required(
      [...document.querySelectorAll<HTMLElement>('.ant-tabs-tab')].find((tab) =>
        tab.textContent?.includes('可分配角色'),
      ),
    ).click();
    await flushPromises();
  }
  const item = required(
    [...document.querySelectorAll<HTMLElement>('.role-item')].find((item) =>
      item.textContent?.includes(name),
    ),
  );
  return new DOMWrapper(
    required(item.querySelector<HTMLButtonElement>('button')),
  );
}

async function clickRole(action: 'assign' | 'revoke', name?: string) {
  const button = await roleButton(action, name);
  await button.trigger('click');
  await flushPromises();
}

function mutation(action: 'assign' | 'revoke') {
  return action === 'assign'
    ? api.assignRolesToUserApi
    : api.revokeRolesFromUserApi;
}

describe('用户角色窗口与操作归属', () => {
  it.each(['assign', 'revoke'] as const)(
    '当前窗口正常%s保留准确用户/角色并刷新角色、列表及统计',
    async (action) => {
      await openRoles();
      api.getUserRolesApi.mockResolvedValueOnce({
        items: action === 'assign' ? [role(11, 'role-a'), role(33)] : [],
      });
      await clickRole(action);
      expect(mutation(action)).toHaveBeenCalledTimes(1);
      expect(mutation(action)).toHaveBeenCalledWith({
        role_ids: [action === 'assign' ? 33 : 11],
        user_id: 101,
      });
      expect(api.getUserRolesApi).toHaveBeenLastCalledWith(101);
      expect(api.getUserList).toHaveBeenCalledTimes(2);
      expect(api.getUserStatistics).toHaveBeenCalledTimes(2);
      expect(message.success).toHaveBeenCalledWith(
        action === 'assign' ? '角色分配成功' : '角色移除成功',
      );
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'a角色读取迟到%s不能覆盖B或清除B的loading',
    async (settle) => {
      const a = deferred<ReturnType<typeof assignedA>>();
      const b = deferred<ReturnType<typeof assignedB>>();
      api.getUserRolesApi
        .mockReturnValueOnce(a.promise)
        .mockReturnValueOnce(b.promise);
      await openRoles();
      await openRoles('user-b');
      if (settle === 'resolve') a.resolve(assignedA());
      else a.reject(new Error('private-read-canary'));
      await flushPromises();
      expect(rolesModal().props('open')).toBe(true);
      expect(document.querySelector('.role-header')?.textContent).toContain(
        'user-b',
      );
      expect(document.querySelector('.role-name')).toBeNull();
      expect(document.querySelector('.ant-spin-spinning')).not.toBeNull();
      expect(message.error).not.toHaveBeenCalled();
      b.resolve(assignedB());
      await flushPromises();
      expect(document.querySelector('.role-name')?.textContent).toBe('role-b');
    },
  );

  it.each(['close', 'account', 'generation', 'unmount'] as const)(
    '读取pending后%s不能被迟到回执重开窗口',
    async (boundary) => {
      const read = deferred<ReturnType<typeof assignedA>>();
      api.getUserRolesApi.mockReturnValueOnce(read.promise);
      await openRoles();
      if (boundary === 'close') await closeRoles();
      if (boundary === 'account') useUserStore().setUserInfo(account('2'));
      if (boundary === 'generation') control.auth.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      read.resolve(assignedA());
      await flushPromises();
      if (!unmounted) expect(rolesModal().props('open')).toBe(false);
      expect(document.querySelector('.role-name')).toBeNull();
      expect(message.error).not.toHaveBeenCalled();
    },
  );

  it.each(['assign', 'revoke'] as const)(
    'a的%s成功不能刷新B、切回A或清B的新操作loading',
    async (action) => {
      const a = deferred<null>();
      const b = deferred<null>();
      await openRoles();
      mutation(action).mockReturnValueOnce(a.promise);
      await clickRole(action);
      await openRoles('user-b');
      api.revokeRolesFromUserApi.mockReturnValueOnce(b.promise);
      await clickRole('revoke', 'role-b');
      const reads = api.getUserRolesApi.mock.calls.length;
      a.resolve(null);
      await flushPromises();
      expect(api.getUserRolesApi).toHaveBeenCalledTimes(reads);
      expect(api.getUserList).toHaveBeenCalledTimes(1);
      expect(api.getUserStatistics).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.role-header')?.textContent).toContain(
        'user-b',
      );
      expect(document.querySelector('.ant-btn-loading')).not.toBeNull();
      expect(message.success).not.toHaveBeenCalled();
      b.resolve(null);
      await flushPromises();
      expect(api.getUserRolesApi).toHaveBeenLastCalledWith(202);
    },
  );

  it.each(['assign', 'revoke'] as const)(
    'a的%s失败不会向B弹错误或修改其窗口',
    async (action) => {
      const pending = deferred<null>();
      await openRoles();
      mutation(action).mockReturnValueOnce(pending.promise);
      await clickRole(action);
      await openRoles('user-b');
      pending.reject(new Error('private-operation-canary'));
      await flushPromises();
      expect(document.querySelector('.role-name')?.textContent).toBe('role-b');
      expect(message.error).not.toHaveBeenCalled();
      expect(api.getUserList).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['close', 'account', 'generation', 'unmount'] as const)(
    '分配pending后%s不发送后续读取或刷新',
    async (boundary) => {
      const pending = deferred<null>();
      await openRoles();
      api.assignRolesToUserApi.mockReturnValueOnce(pending.promise);
      await clickRole('assign');
      if (boundary === 'close') await closeRoles();
      if (boundary === 'account') useUserStore().setUserInfo(account('2'));
      if (boundary === 'generation') control.auth.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      pending.resolve(null);
      await flushPromises();
      expect(api.getUserRolesApi).toHaveBeenCalledTimes(1);
      expect(api.getUserList).toHaveBeenCalledTimes(1);
      expect(api.getUserStatistics).toHaveBeenCalledTimes(1);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    },
  );

  it('关闭后重开同用户也隔离旧读取', async () => {
    const oldRead = deferred<ReturnType<typeof assignedA>>();
    api.getUserRolesApi.mockReturnValueOnce(oldRead.promise);
    await openRoles();
    await closeRoles();
    api.getUserRolesApi.mockResolvedValueOnce({
      items: [role(44, 'fresh-role')],
    });
    await openRoles();
    oldRead.resolve(assignedA());
    await flushPromises();
    expect(document.querySelector('.role-name')?.textContent).toBe(
      'fresh-role',
    );
  });

  it.each([
    undefined,
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('非法用户ID %s 不读取角色', async (id) => {
    api.getUserList.mockResolvedValueOnce({ total: 1, items: [user(id)] });
    await required(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('刷新')),
    ).trigger('click');
    await flushPromises();
    await openRoles();
    expect(api.getUserRolesApi).not.toHaveBeenCalled();
    expect(rolesModal().props('open')).toBe(false);
  });

  it.each([
    undefined,
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('非法角色ID %s 不发送变更', async (id) => {
    api.getUserRolesApi.mockResolvedValueOnce({
      items: [role(id, 'bad-role')],
    });
    await openRoles();
    await clickRole('revoke', 'bad-role');
    expect(api.revokeRolesFromUserApi).not.toHaveBeenCalled();
  });

  it('读取失败不会继续展示旧角色或允许分配', async () => {
    api.getUserRolesApi.mockRejectedValueOnce(new Error('private-read-canary'));
    await openRoles();
    expect(document.querySelector('.ant-alert-message')?.textContent).toContain(
      '读取失败',
    );
    expect(document.querySelector('.role-name')).toBeNull();
    expect(message.error).toHaveBeenCalledWith('获取用户角色失败');
    expect(api.assignRolesToUserApi).not.toHaveBeenCalled();
  });

  it.each(['assign', 'revoke'] as const)(
    '同窗%s未完成时拒绝重复点击',
    async (action) => {
      const pending = deferred<null>();
      await openRoles();
      mutation(action).mockReturnValueOnce(pending.promise);
      const button = await roleButton(action);
      await button.trigger('click');
      await button.trigger('click');
      expect(mutation(action)).toHaveBeenCalledTimes(1);
      pending.resolve(null);
      await flushPromises();
    },
  );

  it.each(['assign', 'revoke'] as const)(
    '%s权限撤销时不刷新，loading结束后可重新授权操作',
    async (action) => {
      const pending = deferred<null>();
      await openRoles();
      mutation(action).mockReturnValueOnce(pending.promise);
      await clickRole(action);
      control.permissions[action] = false;
      pending.resolve(null);
      await flushPromises();
      expect(message.success).not.toHaveBeenCalled();
      expect(api.getUserRolesApi).toHaveBeenCalledTimes(1);
      control.permissions[action] = true;
      await clickRole(action);
      expect(mutation(action)).toHaveBeenCalledTimes(2);
    },
  );

  it('角色读取权限撤销立即清空并关闭窗口', async () => {
    await openRoles();
    control.permissions.read = false;
    await flushPromises();
    expect(rolesModal().props('open')).toBe(false);
    expect(document.querySelector('.role-name')).toBeNull();
  });

  it('缺少登录owner时不打开角色或发送请求', async () => {
    useUserStore().setUserInfo(null);
    await openRoles();
    expect(api.getUserRolesApi).not.toHaveBeenCalled();
    expect(rolesModal().props('open')).toBe(false);
  });

  it('换owner后角色目录重新读取且旧目录不会复用', async () => {
    useUserStore().setUserInfo(account('2'));
    api.listRolesApi.mockResolvedValueOnce({
      total: 1,
      items: [role(77, 'fresh-catalog-role')],
    });
    await openRoles();
    await roleButton('assign', 'fresh-catalog-role');
    expect(api.listRolesApi).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.role-list')?.textContent).not.toContain(
      'role-extra',
    );
  });

  it('分配后A角色刷新迟到不清B的新读取loading或启动列表刷新', async () => {
    const a = deferred<ReturnType<typeof assignedA>>();
    const b = deferred<ReturnType<typeof assignedB>>();
    await openRoles();
    api.getUserRolesApi
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    await clickRole('assign');
    await openRoles('user-b');
    a.resolve(assignedA());
    await flushPromises();
    expect(document.querySelector('.role-name')).toBeNull();
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull();
    expect(api.getUserList).toHaveBeenCalledTimes(1);
    expect(api.getUserStatistics).toHaveBeenCalledTimes(1);
    b.resolve(assignedB());
    await flushPromises();
    expect(document.querySelector('.role-name')?.textContent).toBe('role-b');
  });

  it('角色操作刷新统计期间切B，同owner的旧统计也不能写入', async () => {
    const statistics = deferred<{
      active_user_count: number;
      admin_count: number;
    }>();
    await openRoles();
    api.getUserStatistics.mockReturnValueOnce(statistics.promise);
    await clickRole('revoke');
    await openRoles('user-b');
    statistics.resolve({ active_user_count: 8765, admin_count: 8765 });
    await flushPromises();
    expect(wrapper.text()).not.toContain('8765');
  });

  it('角色操作刷新用户列表期间关窗，旧结果不能覆盖新列表或清新loading', async () => {
    const oldList = deferred<{
      items: ReturnType<typeof user>[];
      total: number;
    }>();
    const newList = deferred<{
      items: ReturnType<typeof user>[];
      total: number;
    }>();
    await openRoles();
    api.getUserList.mockReturnValueOnce(oldList.promise);
    await clickRole('revoke');
    await closeRoles();
    api.getUserList.mockReturnValueOnce(newList.promise);
    await required(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('刷新')),
    ).trigger('click');
    oldList.resolve({ total: 1, items: [user(909, 'stale-private-user')] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('stale-private-user');
    expect(wrapper.find('.ant-spin-spinning').exists()).toBe(true);
    newList.resolve({ total: 1, items: [user(303, 'fresh-user')] });
    await flushPromises();
    expect(wrapper.text()).toContain('fresh-user');
  });

  it('角色操作刷新统计期间换owner，迟到统计不能写入新scope', async () => {
    const statistics = deferred<{
      active_user_count: number;
      admin_count: number;
    }>();
    await openRoles();
    api.getUserStatistics.mockReturnValueOnce(statistics.promise);
    await clickRole('revoke');
    useUserStore().setUserInfo(account('2'));
    statistics.resolve({ active_user_count: 9876, admin_count: 9876 });
    await flushPromises();
    expect(wrapper.text()).not.toContain('9876');
  });
});
