import { useUserStore } from '@vben/stores';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal, Select } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultProcessDefinition } from '#/api/core/workorder/workorder_process';

import ProcessBasicConfig from './components/ProcessBasicConfig.vue';
import Process from './Process.vue';

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
const record = (id: number | undefined, name = 'process-a', status = 1) => ({
  category_id: 5,
  created_at: '2026-11-03T00:00:00Z',
  definition: createDefaultProcessDefinition(),
  description: 'record-description',
  form_design_id: 11,
  id,
  is_default: 2,
  name,
  operator_id: 1,
  operator_name: 'operator',
  status,
  tags: ['original-tag'],
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
let rows: ReturnType<typeof record>[];
let wrapper: VueWrapper;
let unmounted = false;

beforeEach(async () => {
  vi.clearAllMocks();
  control.auth.generation = 0;
  control.allowed = true;
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo(account());
  rows = [record(101), record(202, 'process-b')];
  client.get.mockImplementation((path: string) => {
    if (path === '/workorder/process/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === '/workorder/category/list')
      return Promise.resolve({
        total: 1,
        items: [{ id: 5, name: 'category-five', status: 1 }],
      });
    if (path === '/workorder/form-design/list')
      return Promise.resolve({
        total: 1,
        items: [{ id: 11, name: 'form-eleven', status: 2 }],
      });
    return Promise.resolve(rows.find((row) => path.endsWith(`/${row.id}`)));
  });
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
  wrapper = mount(Process, {
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

function modal(title = '创建流程') {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === title),
  );
}
function row(name = 'process-a') {
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
  await wrapper.get('.btn-create').trigger('click');
  await flushPromises();
}
async function close(title = '创建流程') {
  modal(title).vm.$emit('cancel');
  await flushPromises();
}
async function setSelect(placeholder: string, value: number | undefined) {
  const select = required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === placeholder),
  );
  select.vm.$emit('update:value', value);
  await flushPromises();
}
async function fill(name = 'new-process') {
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        '.ant-modal input[placeholder="请输入流程名称"]',
      ),
    ),
  ).setValue(name);
  await setSelect('请选择关联表单', 11);
}
async function submit(title = '创建流程') {
  modal(title).vm.$emit('ok');
  await flushPromises();
}
async function menu(action: string, name?: string) {
  const button = required(
    row(name)
      .findAll('button')
      .find((button) => button.text().includes('更多')),
  );
  await button.trigger('mouseenter');
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-dropdown-menu')).not.toBeNull(),
  );
  required(
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
      (item) => item.textContent?.includes(action),
    ),
  ).click();
  await flushPromises();
}
function confirm() {
  return required(required(confirmations.at(-1)).onOk)();
}
function isValidationControl(
  value: unknown,
): value is { validate: () => Promise<boolean> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'validate' in value &&
    typeof value.validate === 'function'
  );
}
function validationControl() {
  const value = wrapper.vm.$.refs.basicConfigRef;
  if (!isValidationControl(value)) throw new Error('真实基础配置校验接口缺失');
  return value;
}
function listReads() {
  return client.get.mock.calls.filter(
    ([path]) => path === '/workorder/process/list',
  ).length;
}
async function refresh() {
  await wrapper.get('.ops-page__filters button').trigger('click');
  await flushPromises();
}

describe('流程目标、校验与异步归属', () => {
  it('创建保留完整DTO字段及默认定义', async () => {
    await create();
    await fill();
    await submit();
    expect(client.post).toHaveBeenCalledWith('/workorder/process/create', {
      category_id: undefined,
      definition: createDefaultProcessDefinition(),
      description: '',
      form_design_id: 11,
      is_default: 2,
      name: 'new-process',
      status: 1,
      tags: [],
    });
    expect(modal().props('open')).toBe(false);
    expect(listReads()).toBe(2);
  });

  it('编辑使用详情的准确ID且不创建新流程', async () => {
    await rowAction('编辑');
    await fill('edited-process');
    await submit('编辑流程');
    expect(client.put).toHaveBeenCalledWith(
      '/workorder/process/update/101',
      expect.objectContaining({
        category_id: 5,
        form_design_id: 11,
        id: 101,
        is_default: 2,
        name: 'edited-process',
        status: 1,
        tags: ['original-tag'],
      }),
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each([
    ['create', undefined],
    ['edit', undefined],
  ] as const)(
    '全局structuredClone不可用时%s仍按真实表单校验并成功提交',
    async (mode, unavailableApi) => {
      vi.stubGlobal('structuredClone', unavailableApi);
      if (mode === 'create') {
        await create();
        await fill('compatible-process');
      } else {
        await rowAction('编辑');
        await fill('compatible-process');
      }
      await submit(mode === 'create' ? '创建流程' : '编辑流程');
      const writer = mode === 'create' ? client.post : client.put;
      expect(writer).toHaveBeenCalledTimes(1);
      expect(writer).toHaveBeenCalledWith(
        mode === 'create'
          ? '/workorder/process/create'
          : '/workorder/process/update/101',
        expect.objectContaining({
          definition: createDefaultProcessDefinition(),
          form_design_id: 11,
          is_default: 2,
          name: 'compatible-process',
          status: 1,
          tags: mode === 'create' ? [] : ['original-tag'],
        }),
      );
      expect(message.success).toHaveBeenCalledWith(
        `流程 "compatible-process" ${mode === 'create' ? '已创建' : '已更新'}`,
      );
      expect(
        modal(mode === 'create' ? '创建流程' : '编辑流程').props('open'),
      ).toBe(false);
    },
  );

  it.each([
    ['发布', 1, 2, 2],
    ['归档', 2, 3, 2],
    ['激活', 3, 1, 2],
    ['设为默认', 2, 2, 1],
  ] as const)(
    '%s仅改变对应status/default，保留其它payload',
    async (action, from, to, isDefault) => {
      rows = [record(101, 'process-a', from), record(202, 'process-b')];
      await refresh();
      await menu(action);
      expect(client.put).toHaveBeenCalledWith('/workorder/process/update/101', {
        category_id: 5,
        definition: createDefaultProcessDefinition(),
        description: 'record-description',
        form_design_id: 11,
        id: 101,
        is_default: isDefault,
        name: 'process-a',
        status: to,
        tags: ['original-tag'],
      });
    },
  );

  it.each(['resolve', 'reject'] as const)(
    '详情a迟到%s不能覆盖编辑b/新loading',
    async (settle) => {
      const a = deferred<ReturnType<typeof record>>();
      const b = deferred<ReturnType<typeof record>>();
      client.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      await rowAction('查看');
      await rowAction('编辑', 'process-b');
      if (settle === 'resolve') a.resolve(record(101, 'stale-private-process'));
      else a.reject(new Error('private-read-canary'));
      await flushPromises();
      expect(modal('流程详情').props('open')).toBe(false);
      expect(modal('编辑流程').props('open')).toBe(true);
      expect(document.querySelector('.ant-spin-spinning')).not.toBeNull();
      expect(document.body.textContent).not.toContain('stale-private-process');
      expect(message.error).not.toHaveBeenCalled();
      b.resolve(record(202, 'fresh-process'));
      await flushPromises();
      expect(
        required(
          document.querySelector<HTMLInputElement>(
            '.ant-modal input[placeholder="请输入流程名称"]',
          ),
        ).value,
      ).toBe('fresh-process');
    },
  );

  it.each(['close', 'create', 'account', 'generation', 'unmount'] as const)(
    '编辑详情pending后%s不能迟到重开',
    async (boundary) => {
      const detail = deferred<ReturnType<typeof record>>();
      client.get.mockReturnValueOnce(detail.promise);
      await rowAction('编辑');
      if (boundary === 'close') await close('编辑流程');
      if (boundary === 'create') await create();
      if (boundary === 'account') useUserStore().setUserInfo(account('2'));
      if (boundary === 'generation') control.auth.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      detail.resolve(record(101, 'stale-private-process'));
      await flushPromises();
      expect(document.body.textContent).not.toContain('stale-private-process');
      if (!unmounted)
        expect(
          modal(boundary === 'create' ? '创建流程' : '编辑流程').props('open'),
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
  ])('非法流程ID %s 不读取/发布/默认/确认删除', async (id) => {
    rows = [record(id)];
    await refresh();
    client.get.mockClear();
    await rowAction('查看');
    await rowAction('编辑');
    await menu('发布');
    await menu('设为默认');
    await menu('删除');
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(Modal.confirm).not.toHaveBeenCalled();
  });

  it.each([undefined, 202])(
    '编辑详情缺失或错配ID %s 不能回退创建',
    async (id) => {
      client.get.mockResolvedValueOnce(record(id));
      await rowAction('编辑');
      await submit('编辑流程');
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
    },
  );

  it('缺少子组件校验接口时不发送创建请求', async () => {
    wrapper.unmount();
    wrapper = mount(Process, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { ProcessBasicConfig: true } },
    });
    await flushPromises();
    await create();
    await submit();
    expect(message.warning).toHaveBeenCalledWith('表单尚未就绪，请稍后重试');
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each(['false', 'reject'] as const)('校验返回%s时不写入', async (value) => {
    await create();
    await fill();
    if (value === 'false')
      vi.spyOn(validationControl(), 'validate').mockResolvedValueOnce(false);
    else
      vi.spyOn(validationControl(), 'validate').mockImplementationOnce(
        async () => {
          throw new Error('validator unavailable');
        },
      );
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
  });

  it('校验pending期间字段改变不借用旧校验结果', async () => {
    await create();
    await fill('old-process');
    const validation = deferred<boolean>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      validation.promise,
    );
    await submit();
    await fill('changed-process');
    validation.resolve(true);
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
  });

  it('校验pending关闭重开不能发送旧表单或清新loading', async () => {
    await create();
    await fill('old-process');
    const old = deferred<boolean>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(old.promise);
    await submit();
    await close();
    await create();
    await fill('fresh-process');
    const fresh = deferred<boolean>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      fresh.promise,
    );
    await submit();
    old.resolve(true);
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(true);
    fresh.resolve(true);
    await flushPromises();
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/process/create',
      expect.objectContaining({ name: 'fresh-process' }),
    );
  });

  it('同UID重新登录隔离pending校验与旧表单', async () => {
    await create();
    await fill();
    const pending = deferred<boolean>();
    vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
      pending.promise,
    );
    await submit();
    control.auth.generation++;
    pending.resolve(true);
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('open')).toBe(false);
  });

  it.each(['resolve', 'reject'] as const)(
    '旧保存%s不能关闭新创建窗口或清新loading',
    async (outcome) => {
      const old = deferred<null>();
      const fresh = deferred<null>();
      await create();
      await fill('old-process');
      client.post.mockReturnValueOnce(old.promise);
      await submit();
      await close();
      await create();
      await fill('fresh-process');
      client.post.mockReturnValueOnce(fresh.promise);
      await submit();
      if (outcome === 'resolve') old.resolve(null);
      else old.reject(new Error('private-write-canary'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(true);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      fresh.resolve(null);
      await flushPromises();
      expect(modal().props('open')).toBe(false);
    },
  );

  it('提交请求深复制definition和tags，不被随后编辑改写', async () => {
    const pending = deferred<null>();
    await rowAction('编辑');
    client.put.mockReturnValueOnce(pending.promise);
    await submit('编辑流程');
    const sent = required(client.put.mock.calls.at(-1))[1];
    const before = JSON.stringify(sent);
    const replacement = createDefaultProcessDefinition();
    required(replacement.steps[0]).name = 'changed-step';
    await new DOMWrapper(
      required(
        document.querySelector<HTMLTextAreaElement>(
          '.ant-modal textarea[placeholder="请粘贴流程设计的JSON定义"]',
        ),
      ),
    ).setValue(JSON.stringify(replacement));
    required(
      wrapper
        .findAllComponents(Select)
        .find(
          (select) => select.props('placeholder') === '输入标签后按回车添加',
        ),
    ).vm.$emit('update:value', ['changed-tag']);
    await flushPromises();
    expect(JSON.stringify(sent)).toBe(before);
    pending.resolve(null);
    await flushPromises();
    expect(modal('编辑流程').props('open')).toBe(true);
  });

  it('合法校验不能放行非法关联表单ID', async () => {
    await create();
    await fill();
    await setSelect('请选择关联表单', -1);
    vi.spyOn(validationControl(), 'validate').mockResolvedValueOnce(true);
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each([
    { form_design_id: 0 },
    { category_id: -1 },
    { status: 99 },
    { is_default: 99 },
  ])(
    '编辑详情非法关联ID或枚举 %o 时禁止保存且不能转为创建',
    async (invalid) => {
      client.get.mockResolvedValueOnce({ ...record(101), ...invalid });
      await rowAction('编辑');
      await submit('编辑流程');
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
      expect(
        document.querySelector('.ant-alert-message')?.textContent,
      ).toContain('详情读取失败');
    },
  );

  it.each(['create', 'edit'] as const)(
    '%s请求发出后同UID重新登录不消费旧成功回执',
    async (mode) => {
      if (mode === 'create') {
        await create();
        await fill();
      } else await rowAction('编辑');
      const pending = deferred<null>();
      const writer = mode === 'create' ? client.post : client.put;
      writer.mockReturnValueOnce(pending.promise);
      await submit(mode === 'create' ? '创建流程' : '编辑流程');
      const count = listReads();
      control.auth.generation++;
      pending.resolve(null);
      await flushPromises();
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      expect(listReads()).toBe(count);
      expect(
        modal(mode === 'create' ? '创建流程' : '编辑流程').props('open'),
      ).toBe(false);
    },
  );

  it('删除确认pending/成功/失败后的同一回调均one-shot，新确认可重试', async () => {
    await menu('删除');
    const callback = required(required(confirmations.at(-1)).onOk);
    const pending = deferred<null>();
    client.delete.mockReturnValueOnce(pending.promise);
    const running = callback();
    await callback();
    expect(client.delete).toHaveBeenCalledTimes(1);
    pending.reject(new Error('private-delete-canary'));
    await running;
    await callback();
    expect(client.delete).toHaveBeenCalledTimes(1);
    await menu('删除');
    await confirm();
    await confirm();
    expect(client.delete).toHaveBeenCalledTimes(2);
  });

  it.each([
    'create',
    'account',
    'generation',
    'target',
    'cancel',
    'unmount',
  ] as const)('删除确认后%s使旧callback失效', async (boundary) => {
    await menu('删除');
    if (boundary === 'create') await create();
    if (boundary === 'account') useUserStore().setUserInfo(account('2'));
    if (boundary === 'generation') control.auth.generation++;
    if (boundary === 'target') required(rows[0]).id = 909;
    if (boundary === 'cancel')
      required(required(confirmations.at(-1)).onCancel)();
    if (boundary === 'unmount') {
      wrapper.unmount();
      unmounted = true;
    }
    await confirm();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('发布pending后换owner不提示成功或加载新scope列表', async () => {
    const pending = deferred<null>();
    client.put.mockReturnValueOnce(pending.promise);
    await menu('发布');
    const count = listReads();
    useUserStore().setUserInfo(account('2'));
    pending.resolve(null);
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(listReads()).toBe(count);
  });

  it('旧状态操作finally不能清除新表单的提交loading', async () => {
    const old = deferred<null>();
    client.put.mockReturnValueOnce(old.promise);
    await menu('发布');
    await create();
    await fill();
    const fresh = deferred<null>();
    client.post.mockReturnValueOnce(fresh.promise);
    await submit();
    old.resolve(null);
    await flushPromises();
    expect(modal().props('confirmLoading')).toBe(true);
    expect(message.success).not.toHaveBeenCalled();
    fresh.resolve(null);
    await flushPromises();
  });

  it('旧关联页回执换owner后不覆盖新窗口表单', async () => {
    const pending = deferred<{
      items: { id: number; name: string }[];
      total: number;
    }>();
    const fallback = required(client.get.getMockImplementation());
    let categoryCalls = 0;
    client.get.mockImplementation((path: string, ...args) => {
      if (path === '/workorder/category/list' && ++categoryCalls === 2)
        return pending.promise;
      return fallback(path, ...args);
    });
    await create();
    const oldChild = wrapper.getComponent(ProcessBasicConfig);
    await close();
    useUserStore().setUserInfo(account('2'));
    await create();
    expect(wrapper.getComponent(ProcessBasicConfig).vm.$.uid).not.toBe(
      oldChild.vm.$.uid,
    );
    expect(oldChild.vm.$.isUnmounted).toBe(true);
    await fill('fresh-process');
    pending.resolve({
      total: 1,
      items: [{ id: 999, name: 'stale-private-option' }],
    });
    await flushPromises();
    expect(
      required(
        document.querySelector<HTMLInputElement>(
          '.ant-modal input[placeholder="请输入流程名称"]',
        ),
      ).value,
    ).toBe('fresh-process');
    expect(document.body.textContent).not.toContain('stale-private-option');
  });

  it('保存刷新列表的旧回执不覆盖新搜索结果或loading', async () => {
    const old = deferred<{
      items: ReturnType<typeof record>[];
      total: number;
    }>();
    const fresh = deferred<{
      items: ReturnType<typeof record>[];
      total: number;
    }>();
    await create();
    await fill();
    client.get.mockReturnValueOnce(old.promise);
    await submit();
    client.get.mockReturnValueOnce(fresh.promise);
    await refresh();
    old.resolve({ total: 1, items: [record(303, 'stale-private-process')] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('stale-private-process');
    expect(wrapper.find('.ant-spin-spinning').exists()).toBe(true);
    fresh.resolve({ total: 1, items: [record(404, 'fresh-process')] });
    await flushPromises();
    expect(wrapper.text()).toContain('fresh-process');
  });
});
