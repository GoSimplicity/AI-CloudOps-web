import type { FormInstance } from 'ant-design-vue';

import { defineComponent, h } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, {
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
} from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import MonitorOnDutyGroup from './MonitorOnDutyGroup.vue';

const control = vi.hoisted(() => ({ session: { generation: 0, uid: '1' } }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({
    userInfo: {
      get userId() {
        return control.session.uid;
      },
    },
  }),
}));
vi.mock('#/store', async () => {
  const { reactive } = await import('vue');
  control.session = reactive(control.session);
  return {
    useAuthStore: () => ({
      getAuthGeneration: () => control.session.generation,
    }),
  };
});
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));
const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
const InlineDropdown = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.overlay?.()]),
});
function required<T>(value: null | T | undefined): T {
  if (value === undefined || value === null)
    throw new Error('测试前置条件缺失');
  return value;
}
const user = (id: number, username = `user-${id}`) => ({ id, username });
const group = (id: number | undefined, name = 'group-a') => ({
  create_user_name: 'operator',
  created_at: '',
  description: 'original',
  enable: 1,
  id,
  name,
  shift_days: 7,
  updated_at: '',
  user_id: 1,
  users: [user(7), user(8)],
});

const listPath = '/monitor/onduty_groups/list';
const createPath = '/monitor/onduty_groups/create';
const addTitle = '新增值班组';
const editTitle = '编辑值班组';
const detailTitle = '值班组详情';
type Confirmation = Parameters<typeof Modal.confirm>[0];
let rows: ReturnType<typeof group>[];
let wrapper: VueWrapper;
let unmounted: boolean;
const confirmations: Confirmation[] = [];
beforeEach(async () => {
  vi.clearAllMocks();
  control.session.uid = '1';
  control.session.generation = 0;
  rows = [group(11), group(22, 'group-b')];
  client.get.mockImplementation((path: string) => {
    if (path === listPath)
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === '/user/list')
      return Promise.resolve({ total: 2, items: [user(7), user(8)] });
    if (path.startsWith('/monitor/onduty_groups/detail/'))
      return Promise.resolve(rows.find((row) => path.endsWith(`/${row.id}`)));
    throw new Error('Unexpected offline endpoint');
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
  confirmations.length = 0;
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmations.push(options);
    return { destroy: vi.fn(), update: vi.fn() };
  });
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'success');
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
  wrapper = mount(MonitorOnDutyGroup, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: { ADropdown: InlineDropdown, Icon: true },
    },
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
function modal(title = addTitle) {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((component) => component.props('title') === title),
  );
}
function row(name = 'group-a') {
  return required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(name)),
  );
}
async function action(label: string, name = 'group-a') {
  await required(
    row(name)
      .findAll('button,.ant-menu-item')
      .find((button) => button.text().replaceAll(/\s/g, '') === label),
  ).trigger('click');
  await flushPromises();
}
async function add() {
  await wrapper.get('.btn-create').trigger('click');
  await flushPromises();
}
async function close(title = addTitle) {
  modal(title).vm.$emit('cancel');
  await flushPromises();
}
async function submit(title = addTitle) {
  modal(title).vm.$emit('ok');
  await flushPromises();
}
function input(placeholder: string, title = addTitle) {
  void title;
  return required(
    wrapper
      .findAllComponents(Input)
      .find((component) => component.props('placeholder') === placeholder),
  );
}
async function set(placeholder: string, value: string, title = addTitle) {
  input(placeholder, title).vm.$emit('update:value', value);
  await flushPromises();
}
async function fill(name = ' A ') {
  await set('请输入值班组名称', name);
  required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === '请搜索并选择值班成员'),
  ).vm.$emit('update:value', [8, 7]);
  await flushPromises();
}
function isValidator(value: unknown): value is Pick<FormInstance, 'validate'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'validate' in value &&
    typeof value.validate === 'function'
  );
}
function validator(mode: 'add' | 'edit' = 'add') {
  const value = wrapper.vm.$.refs[`${mode}FormRef`];
  if (!isValidator(value)) throw new Error('真实AntD表单引用缺失');
  return value;
}
function confirm() {
  return required(required(confirmations.at(-1)).onOk)();
}
function listReads() {
  return client.get.mock.calls.filter(([path]) => path === listPath).length;
}

async function toggle(checked: boolean, name = 'group-a') {
  row(name).findComponent(Switch).vm.$emit('change', checked);
  await flushPromises();
}
function currentModel() {
  return required(wrapper.findComponent(Form).props('model'));
}
describe('值班组CRUD字段和异步归属', () => {
  it('真实必需Form阻止空表单并释放独立submitting', async () => {
    await add();
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
    expect(document.body.textContent).toContain('请选择至少一个值班成员');
  });
  it('接受1字名称/366周期、trim文本、保留成员顺序和{}成功合同', async () => {
    await add();
    await fill();
    wrapper.findComponent(InputNumber).vm.$emit('update:value', 366);
    await flushPromises();
    await submit();
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(createPath, {
      description: '',
      name: 'A',
      shift_days: 366,
      user_ids: [8, 7],
    });
    expect(message.success).toHaveBeenCalledWith('新增值班组成功');
    expect(modal().props('open')).toBe(false);
  });
  it('编辑保留完整原DTO与禁用状态', async () => {
    required(rows[0]).enable = 2;
    await action('编辑');
    await submit(editTitle);
    expect(client.put).toHaveBeenCalledWith(
      '/monitor/onduty_groups/update/11',
      {
        description: 'original',
        enable: 2,
        id: 11,
        name: 'group-a',
        shift_days: 7,
        user_ids: [7, 8],
      },
    );
    expect(modal(editTitle).props('open')).toBe(false);
  });
  it.each(['add', 'edit'] as const)(
    '%s缺少实际Form挂载时不外发',
    async (mode) => {
      if (mode === 'add')
        wrapper.get<HTMLButtonElement>('.btn-create').element.click();
      else
        required(
          row()
            .findAll<HTMLElement>('.ant-menu-item')
            .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
        ).element.click();
      modal(mode === 'add' ? addTitle : editTitle).vm.$emit('ok');
      await flushPromises();
      expect(message.error).toHaveBeenCalledWith('表单尚未就绪');
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
    },
  );
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, undefined])(
    '非法实体%s不能编辑详情删除启停',
    async (id) => {
      required(wrapper.findComponent(Table).props('dataSource')?.[0]).id = id;
      await action('编辑');
      await action('查看');
      await action('删除');
      await toggle(false);
      expect(modal(editTitle).props('open')).toBe(false);
      expect(modal(detailTitle).props('open')).toBe(false);
      expect(confirmations).toHaveLength(0);
      expect(client.put).not.toHaveBeenCalled();
      expect(
        client.get.mock.calls.some(([path]) => path.includes('/detail/')),
      ).toBe(false);
    },
  );
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    '周期%s不能发送',
    async (days) => {
      await add();
      await fill();
      currentModel().shift_days = days;
      await flushPromises();
      await submit();
      expect(client.post).not.toHaveBeenCalled();
    },
  );
  it.each(
    [[], [0], [-1], [1.5], [7, 7], [Number.MAX_SAFE_INTEGER + 1]].map(
      (ids) => ({ ids }),
    ),
  )('非法成员$ids不能发送', async ({ ids }) => {
    await add();
    await fill();
    currentModel().user_ids = ids;
    await flushPromises();
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });
  it.each(['name', 'description', 'shift_days', 'user_ids'])(
    'validate等待%s改变不能发送',
    async (field) => {
      await add();
      await fill();
      const pending = createDeferred<Record<string, unknown>>();
      vi.spyOn(validator(), 'validate').mockImplementation(
        () => pending.promise,
      );
      await submit();
      const model = currentModel();
      const values: Record<string, unknown> = {
        description: 'changed',
        name: 'changed',
        shift_days: 14,
        user_ids: [7],
      };
      model[field] = values[field];
      await flushPromises();
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(modal().props('confirmLoading')).toBe(false);
    },
  );
  it.each(['close', 'switch', 'account', 'generation', 'unmount'])(
    '校验等待%s隔离',
    async (change) => {
      await action('编辑');
      const pending = createDeferred<Record<string, unknown>>();
      vi.spyOn(validator('edit'), 'validate').mockImplementation(
        () => pending.promise,
      );
      await submit(editTitle);
      switch (change) {
        case 'account': {
          control.session.uid = '2';
          break;
        }
        case 'close': {
          await close(editTitle);
          break;
        }
        case 'generation': {
          control.session.generation++;
          break;
        }
        case 'switch': {
          await action('编辑', 'group-b');
          break;
        }
        default: {
          wrapper.unmount();
          unmounted = true;
        }
      }
      pending.resolve({});
      await flushPromises();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
    },
  );
  it('非法enable和超长文本均不发送', async () => {
    await action('编辑');
    currentModel().enable = 99;
    await submit(editTitle);
    expect(client.put).not.toHaveBeenCalled();
    await close(editTitle);
    await add();
    await fill('x'.repeat(51));
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    await set('请输入值班组名称', 'valid');
    currentModel().description = 'x'.repeat(256);
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });
  it.each(['resolve', 'reject'] as const)(
    '旧%s不关闭新窗口、不释放新busy或刷新列表',
    async (completion) => {
      const old = createDeferred<object>();
      const fresh = createDeferred<object>();
      client.post
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(fresh.promise);
      await add();
      await fill();
      await submit();
      await close();
      await add();
      await fill('B');
      await submit();
      const reads = listReads();
      if (completion === 'resolve') old.resolve({});
      else old.reject(new Error('private-error-canary'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(true);
      expect(wrapper.findComponent(Table).props('loading')).toBe(false);
      expect(listReads()).toBe(reads);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      fresh.resolve({});
      await flushPromises();
    },
  );
  it('发出后成员快照独立，字段变化后旧回执不关闭表单', async () => {
    const pending = createDeferred<object>();
    client.post.mockReturnValue(pending.promise);
    await add();
    await fill();
    await submit();
    currentModel().user_ids.push(99);
    await flushPromises();
    expect(client.post.mock.calls[0]?.[1].user_ids).toEqual([8, 7]);
    pending.resolve({});
    await flushPromises();
    expect(modal().props('open')).toBe(true);
    expect(modal().props('confirmLoading')).toBe(false);
  });
  it('相同记录启停串行，{}完成正确更新并释放该行busy', async () => {
    const pending = createDeferred<object>();
    client.put.mockReturnValueOnce(pending.promise);
    await toggle(false);
    await toggle(true);
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(row().findComponent(Switch).props('loading')).toBe(true);
    pending.resolve({});
    await flushPromises();
    expect(row().findComponent(Switch).props('checked')).toBe(false);
    expect(row().findComponent(Switch).props('loading')).toBe(false);
    await toggle(true);
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(row().findComponent(Switch).props('checked')).toBe(true);
  });
  it('不同记录可独立启停', async () => {
    const pending = createDeferred<object>();
    client.put.mockReturnValueOnce(pending.promise);
    await toggle(false);
    await toggle(false, 'group-b');
    expect(client.put).toHaveBeenCalledTimes(2);
    expect(row('group-b').findComponent(Switch).props('checked')).toBe(false);
    pending.resolve({});
    await flushPromises();
  });
  it.each(['owner', 'record', 'refresh'])(
    '启停期间%s变化旧回执无效',
    async (change) => {
      const pending = createDeferred<object>();
      client.put.mockReturnValueOnce(pending.promise);
      await toggle(false);
      if (change === 'owner') control.session.generation++;
      else if (change === 'record')
        required(wrapper.findComponent(Table).props('dataSource')?.[0]).name =
          'changed';
      else {
        client.get.mockResolvedValue({
          total: 1,
          items: [group(11, 'refreshed')],
        });
        await wrapper.get('.reset-btn').trigger('click');
      }
      await flushPromises();
      pending.resolve({});
      await flushPromises();
      expect(message.success).not.toHaveBeenCalled();
    },
  );
  it.each(['pending', 'success', 'failure'])(
    '删除%s后同callback只消费一次，新确认可重试',
    async (state) => {
      const pending = createDeferred<object>();
      client.delete.mockReturnValueOnce(pending.promise);
      await action('删除');
      const callback = required(required(confirmations.at(-1)).onOk);
      const request = callback();
      await flushPromises();
      if (state === 'success') pending.resolve({});
      else if (state === 'failure')
        pending.reject(new Error('private-error-canary'));
      await flushPromises();
      await callback();
      expect(client.delete).toHaveBeenCalledTimes(1);
      if (state === 'pending') {
        pending.resolve({});
        await request;
      }
      await action('删除');
      await confirm();
      expect(client.delete).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['window', 'generation', 'cancel', 'unmount'])(
    '删除确认%s之后不发API',
    async (change) => {
      await action('删除');
      const callback = required(required(confirmations.at(-1)).onOk);
      switch (change) {
        case 'cancel': {
          required(required(confirmations.at(-1)).onCancel)();
          break;
        }
        case 'generation': {
          control.session.generation++;
          break;
        }
        case 'window': {
          await add();
          break;
        }
        default: {
          wrapper.unmount();
          unmounted = true;
        }
      }
      await callback();
      expect(client.delete).not.toHaveBeenCalled();
    },
  );
  it('旧详情不重开或覆盖新编辑窗口，禁用状态正确展示', async () => {
    required(rows[0]).enable = 2;
    await action('查看');
    expect(document.body.textContent).toContain('禁用');
    const pending = createDeferred<object>();
    const original = client.get.getMockImplementation();
    client.get.mockImplementation((path: string) =>
      path.includes('/detail/') ? pending.promise : required(original)(path),
    );
    await action('查看');
    await action('编辑', 'group-b');
    pending.resolve(group(11));
    await flushPromises();
    expect(modal(detailTitle).props('open')).toBe(false);
    expect(input('请输入值班组名称', editTitle).props('value')).toBe('group-b');
  });
  it('成员目录过滤非法ID，旧窗口预加载不能覆盖重开同ID的新目录', async () => {
    const first = createDeferred<object>();
    const second = createDeferred<object>();
    const original = client.get.getMockImplementation();
    let firstRead = true;
    client.get.mockImplementation((path: string) => {
      if (path !== '/user/list') return required(original)(path);
      const request = firstRead ? first : second;
      firstRead = false;
      return request.promise;
    });
    await action('编辑');
    await close(editTitle);
    await action('编辑');
    first.resolve({ total: 1, items: [user(99, 'stale-user')] });
    await flushPromises();
    expect(
      required(
        wrapper
          .findAllComponents(Select)
          .find(
            (select) => select.props('placeholder') === '请搜索并选择值班成员',
          ),
      ).props('loading'),
    ).toBe(true);
    second.resolve({
      total: 4,
      items: [user(0), user(-1), user(1.5), user(9, 'fresh-user')],
    });
    await flushPromises();
    const options = required(
      required(
        wrapper
          .findAllComponents(Select)
          .find(
            (select) => select.props('placeholder') === '请搜索并选择值班成员',
          ),
      ).props('options'),
    );
    expect(options.map((option) => option.value)).toEqual([9, 7, 8]);
    expect(JSON.stringify(options)).not.toContain('stale-user');
  });
  it('身份切换只清理、不自动GET，旧列表失败不提示', async () => {
    const pending = createDeferred<object>();
    client.get.mockReturnValue(pending.promise);
    await wrapper.get('.reset-btn').trigger('click');
    const reads = client.get.mock.calls.length;
    control.session.generation++;
    await flushPromises();
    expect(client.get).toHaveBeenCalledTimes(reads);
    pending.reject(new Error('private-error-canary'));
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
    expect(wrapper.findComponent(Table).props('dataSource')).toEqual([]);
  });
  it('表单trim与后端长度按发送值一致，姓名两侧空格不改变成员排序', async () => {
    await add();
    await fill('  A  ');
    currentModel().description = `${' '.repeat(260)}ok`;
    await submit();
    expect(client.post).toHaveBeenCalledWith(createPath, {
      description: 'ok',
      name: 'A',
      shift_days: 7,
      user_ids: [8, 7],
    });
  });
});
