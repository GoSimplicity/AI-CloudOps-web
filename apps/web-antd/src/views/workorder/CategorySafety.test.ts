import type { FormInstance } from 'ant-design-vue';

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

import Category from './Category.vue';

const control = vi.hoisted(() => ({ allowed: true, auth: { generation: 0 } }));
vi.mock('#/store/auth', async () => {
  const { reactive } = await import('vue');
  control.auth = reactive(control.auth);
  return {
    useAuthStore: () => ({ getAuthGeneration: () => control.auth.generation }),
  };
});
vi.mock('#/utils/permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/permission')>()),
  usePermission: () => ({
    can: () => control.allowed,
    hasPerm: () => control.allowed,
  }),
}));
const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));

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
const category = (id: number | undefined, name = 'category-a') => ({
  created_at: '2026-11-03T00:00:00Z',
  description: 'original-description',
  id,
  name,
  operator_id: 1,
  operator_name: 'operator',
  status: 1,
  updated_at: '2026-11-03T00:00:00Z',
});
const account = (userId = '1') => ({
  avatar: '',
  realName: '',
  userId,
  username: 'operator',
});
type Confirmation = Parameters<typeof Modal.confirm>[0];
const confirmations: Confirmation[] = [];
let rows: ReturnType<typeof category>[];
let wrapper: VueWrapper;
let unmounted = false;

beforeEach(async () => {
  vi.clearAllMocks();
  control.auth.generation = 0;
  control.allowed = true;
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo(account());
  rows = [category(101), category(202, 'category-b')];
  client.get.mockImplementation((url: string) =>
    Promise.resolve(
      url === '/workorder/category/list'
        ? { total: rows.length, items: rows }
        : category(
            Number(url.split('/').at(-1)),
            url.endsWith('/101') ? 'category-a' : 'category-b',
          ),
    ),
  );
  client.put.mockResolvedValue(null);
  client.post.mockResolvedValue(null);
  client.delete.mockResolvedValue(null);
  confirmations.length = 0;
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmations.push(options);
    return { destroy: vi.fn(), update: vi.fn() };
  });
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
  wrapper = mount(Category, {
    attachTo: document.body,
    global: { plugins: [Antd, pinia] },
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

function modal(title: string) {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === title),
  );
}
function row(name = 'category-a') {
  return required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(name)),
  );
}
async function rowAction(action: '查看' | '编辑', name?: string) {
  await required(
    row(name)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === action),
  ).trigger('click');
  await flushPromises();
}
async function create() {
  await wrapper.get('.ops-page__actions button').trigger('click');
  await flushPromises();
}
async function close(title: string) {
  modal(title).vm.$emit('cancel');
  await flushPromises();
}
async function fill(name = 'new-category') {
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>('.ant-modal input[id$="name"]'),
    ),
  ).setValue(name);
}
async function submit() {
  const active = wrapper
    .findAllComponents(Modal)
    .find((modal) =>
      ['创建分类', '编辑分类'].includes(String(modal.props('title'))),
    );
  required(active).vm.$emit('ok');
  await flushPromises();
}
async function menu(action: '删除' | '禁用', name?: string) {
  const button = required(
    row(name)
      .findAll('button')
      .find((button) => button.text().includes('更多')),
  );
  await button.trigger('mouseenter');
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-dropdown-menu')).not.toBeNull(),
  );
  const item = required(
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
      (item) => item.textContent?.includes(action),
    ),
  );
  item.click();
  await flushPromises();
}
function confirm() {
  return required(required(confirmations.at(-1)).onOk)();
}

function isValidationControl(
  value: unknown,
): value is Pick<FormInstance, 'validate'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'validate' in value &&
    typeof value.validate === 'function'
  );
}
function validationControl() {
  const control = wrapper.vm.$.refs.formRef;
  if (!isValidationControl(control)) throw new Error('真实表单校验接口缺失');
  return control;
}

describe('分类操作目标与异步窗口安全', () => {
  it('创建保留name/description/status合同并刷新列表', async () => {
    await create();
    await fill();
    await submit();
    expect(client.post).toHaveBeenCalledWith('/workorder/category/create', {
      description: '',
      name: 'new-category',
      status: 1,
    });
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(modal('创建分类').props('open')).toBe(false);
  });

  it('编辑使用已确认ID及原始status，不回退创建', async () => {
    await rowAction('编辑');
    await fill('edited-category');
    await submit();
    expect(client.put).toHaveBeenCalledWith('/workorder/category/update/101', {
      description: 'original-description',
      id: 101,
      name: 'edited-category',
      status: 1,
    });
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    '详情a迟到%s不能覆盖b或清除其loading',
    async (settle) => {
      const a = deferred<ReturnType<typeof category>>();
      const b = deferred<ReturnType<typeof category>>();
      client.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      await rowAction('查看');
      await rowAction('查看', 'category-b');
      if (settle === 'resolve')
        a.resolve(category(101, 'stale-private-category'));
      else a.reject(new Error('private-error-canary'));
      await flushPromises();
      expect(document.body.textContent).not.toContain('stale-private-category');
      expect(document.querySelector('.ant-spin-spinning')).not.toBeNull();
      expect(message.error).not.toHaveBeenCalled();
      b.resolve(category(202, 'fresh-category'));
      await flushPromises();
      expect(document.querySelector('.detail-content')?.textContent).toContain(
        'fresh-category',
      );
    },
  );

  it.each(['close', 'create', 'account', 'generation', 'unmount'] as const)(
    '编辑读取pending后%s不能被旧结果打开',
    async (boundary) => {
      const read = deferred<ReturnType<typeof category>>();
      client.get.mockReturnValueOnce(read.promise);
      await rowAction('编辑');
      if (boundary === 'close') await close('编辑分类');
      if (boundary === 'create') await create();
      if (boundary === 'account') useUserStore().setUserInfo(account('2'));
      if (boundary === 'generation') control.auth.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      read.resolve(category(101, 'stale-private-category'));
      await flushPromises();
      expect(document.body.textContent).not.toContain('stale-private-category');
      if (!unmounted)
        expect(
          modal(boundary === 'create' ? '创建分类' : '编辑分类').props('open'),
        ).toBe(boundary === 'create');
    },
  );

  it.each([
    undefined,
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('非法ID %s 不读取/更新/确认删除', async (id) => {
    rows = [category(id)];
    await wrapper
      .get('.ops-page__filters .ant-input-search-button')
      .trigger('click');
    await flushPromises();
    client.get.mockClear();
    await rowAction('查看');
    await rowAction('编辑');
    await menu('禁用');
    await menu('删除');
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(Modal.confirm).not.toHaveBeenCalled();
  });

  it.each([undefined, 202])(
    '详情返回缺失或错误ID %s 时阻止提交',
    async (id) => {
      client.get.mockResolvedValueOnce(category(id, 'mismatched-category'));
      await rowAction('编辑');
      await submit();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
      expect(
        document.querySelector('.ant-alert-message')?.textContent,
      ).toContain('详情读取失败');
    },
  );

  it('校验pending期间关闭并重开表单，不发送旧数据', async () => {
    await create();
    await fill('old-category');
    const validation = deferred<Record<string, unknown>>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      validation.promise,
    );
    await submit();
    await close('创建分类');
    await create();
    await fill('fresh-category');
    validation.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal('创建分类').props('open')).toBe(true);
    expect(
      required(
        document.querySelector<HTMLInputElement>(
          '.ant-modal input[id$="name"]',
        ),
      ).value,
    ).toBe('fresh-category');
  });

  it('校验pending期间修改字段，已校验的旧值不能授权新值提交', async () => {
    await create();
    await fill('old-category');
    const validation = deferred<Record<string, unknown>>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      validation.promise,
    );
    await submit();
    await fill('changed-category');
    validation.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal('创建分类').props('confirmLoading')).toBe(false);
  });

  it.each(['resolve', 'reject'] as const)(
    '旧保存%s不关闭新窗口或清新提交loading',
    async (settle) => {
      const old = deferred<null>();
      const fresh = deferred<null>();
      await create();
      await fill('old-category');
      client.post.mockReturnValueOnce(old.promise);
      await submit();
      await close('创建分类');
      await create();
      await fill('fresh-category');
      client.post.mockReturnValueOnce(fresh.promise);
      await submit();
      if (settle === 'resolve') old.resolve(null);
      else old.reject(new Error('private-save-canary'));
      await flushPromises();
      expect(modal('创建分类').props('open')).toBe(true);
      expect(modal('创建分类').props('confirmLoading')).toBe(true);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      fresh.resolve(null);
      await flushPromises();
      expect(modal('创建分类').props('open')).toBe(false);
    },
  );

  it('删除确认快照不会重读被变更的record ID或名称，重复确认只发一次', async () => {
    const pending = deferred<null>();
    client.delete.mockReturnValueOnce(pending.promise);
    await menu('删除');
    required(rows[0]).id = 202;
    required(rows[0]).name = 'changed-category';
    const running = confirm();
    await confirm();
    expect(client.delete).toHaveBeenCalledTimes(1);
    expect(client.delete).toHaveBeenCalledWith(
      '/workorder/category/delete/101',
    );
    rows = [category(101), category(202, 'category-b')];
    pending.resolve(null);
    await running;
    expect(message.success).toHaveBeenCalledWith('分类 "category-a" 已删除');
    await confirm();
    expect(client.delete).toHaveBeenCalledTimes(1);
  });

  it('删除失败后的同一确认回调保持消费，新确认才允许重试', async () => {
    client.delete.mockRejectedValueOnce(new Error('private-delete-canary'));
    await menu('删除');
    const firstConfirmation = required(required(confirmations.at(-1)).onOk);
    await firstConfirmation();
    await firstConfirmation();
    expect(client.delete).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('删除分类失败');
    await menu('删除');
    await confirm();
    expect(client.delete).toHaveBeenCalledTimes(2);
  });

  it.each(['create', 'account', 'generation', 'unmount'] as const)(
    '删除确认后%s使旧确认失效且不请求API',
    async (boundary) => {
      await menu('删除');
      if (boundary === 'create') await create();
      if (boundary === 'account') useUserStore().setUserInfo(account('2'));
      if (boundary === 'generation') control.auth.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      const result = required(vi.mocked(Modal.confirm).mock.results.at(-1));
      if (result.type !== 'return') throw new Error('确认窗口未正常创建');
      expect(result.value.destroy).toHaveBeenCalledTimes(1);
      await confirm();
      expect(client.delete).not.toHaveBeenCalled();
    },
  );

  it('取消确认会销毁本页确认窗口并使旧onOk失效', async () => {
    await menu('删除');
    required(required(confirmations.at(-1)).onCancel)();
    await confirm();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('启停保留name/description/status payload，旧owner回执不刷新', async () => {
    const pending = deferred<null>();
    client.put.mockReturnValueOnce(pending.promise);
    await menu('禁用');
    expect(client.put).toHaveBeenCalledWith('/workorder/category/update/101', {
      description: 'original-description',
      id: 101,
      name: 'category-a',
      status: 2,
    });
    useUserStore().setUserInfo(account('2'));
    pending.resolve(null);
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('保存后刷新回执不能覆盖之后的新列表', async () => {
    const old = deferred<{
      items: ReturnType<typeof category>[];
      total: number;
    }>();
    const fresh = deferred<{
      items: ReturnType<typeof category>[];
      total: number;
    }>();
    await create();
    await fill();
    client.get.mockReturnValueOnce(old.promise);
    await submit();
    client.get.mockReturnValueOnce(fresh.promise);
    await wrapper
      .get('.ops-page__filters .ant-input-search-button')
      .trigger('click');
    old.resolve({ total: 1, items: [category(303, 'stale-private-category')] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('stale-private-category');
    expect(wrapper.find('.ant-spin-spinning').exists()).toBe(true);
    fresh.resolve({ total: 1, items: [category(404, 'fresh-category')] });
    await flushPromises();
    expect(wrapper.text()).toContain('fresh-category');
  });
});
