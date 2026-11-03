import type { FormInstance } from 'ant-design-vue';

import { defineComponent, h } from 'vue';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { Form, Input, message, Modal, Table } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import MonitorAlertPool from './MonitorAlertPool.vue';

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
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true }),
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
const pool = (id: number | undefined, name = 'pool-a') => ({
  alert_manager_instances: ['127.0.0.1:9093'],
  create_user_name: 'operator',
  created_at: '',
  group_by: ['service,api', 'region,cn'],
  group_interval: '',
  group_wait: '',
  id,
  name,
  receiver: 'receiver-a',
  repeat_interval: '',
  resolve_timeout: '',
  user_id: 7,
});
const user = (id: number, username = `user-${id}`) => ({ id, username });
const listPath = '/monitor/alert_manager_pools/list';
const createPath = '/monitor/alert_manager_pools/create';
const addTitle = '新增AlertManager实例池';
const editTitle = '编辑AlertManager实例池';
const detailTitle = '实例池详情';
const userTitle = '选择兜底接收者';
type Confirmation = Parameters<typeof Modal.confirm>[0];
let rows: ReturnType<typeof pool>[];
let wrapper: VueWrapper;
let unmounted: boolean;
const confirmations: Confirmation[] = [];
beforeEach(async () => {
  vi.clearAllMocks();
  control.session.uid = '1';
  control.session.generation = 0;
  rows = [pool(11), pool(22, 'pool-b')];
  client.get.mockImplementation((path: string) => {
    if (path === listPath)
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === '/user/list')
      return Promise.resolve({ total: 2, items: [user(7), user(8)] });
    if (path.startsWith('/monitor/alert_manager_pools/detail/'))
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
  wrapper = mount(MonitorAlertPool, {
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
function row(name = 'pool-a') {
  return required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(name)),
  );
}
async function action(label: string, name = 'pool-a') {
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
async function fill(name = 'A') {
  await set('请输入实例池名称', name);
  await set('请输入AlertManager实例IP', 'host:9093');
  await set('请选择兜底接收者', 'recipient');
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
async function chooseUsers(title = addTitle) {
  void title;
  await required(
    new DOMWrapper(document.body)
      .findAll('button')
      .find((button) =>
        button.text().replaceAll(/\s/g, '').includes('选择用户'),
      ),
  ).trigger('click');
  await flushPromises();
}
function listReads() {
  return client.get.mock.calls.filter(([path]) => path === listPath).length;
}

describe('alertManager实例池真实表单与窗口隔离', () => {
  it('使用真实必填验证，缺字段不发送', async () => {
    await add();
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('请输入实例池名称');
    await set('请输入实例池名称', 'A');
    await set('请输入AlertManager实例IP', 'host:9093');
    await submit();
    expect(client.post).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('请选择兜底接收者');
  });
  it('允许单字符名称并保留空时长及后端创建DTO，不发送伪造用户字段', async () => {
    await add();
    await fill();
    await submit();
    expect(client.post).toHaveBeenCalledWith(createPath, {
      alert_manager_instances: ['host:9093'],
      group_by: [],
      group_interval: '',
      group_wait: '',
      name: 'A',
      receiver: 'recipient',
      repeat_interval: '',
      resolve_timeout: '',
    });
    expect(modal().props('open')).toBe(false);
  });
  it.each([
    ['请输入实例池名称', 'x'.repeat(51)],
    ['请选择兜底接收者', 'x'.repeat(101)],
  ])('拒绝超长%s', async (field, value) => {
    await add();
    await fill();
    await set(field, value);
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });
  it('编辑保留所有DTO字段、标签顺序、空时长及用户名文本', async () => {
    await action('编辑');
    await submit(editTitle);
    expect(client.put).toHaveBeenCalledWith(
      '/monitor/alert_manager_pools/update/11',
      {
        alert_manager_instances: ['127.0.0.1:9093'],
        group_by: ['service,api', 'region,cn'],
        group_interval: '',
        group_wait: '',
        id: 11,
        name: 'pool-a',
        receiver: 'receiver-a',
        repeat_interval: '',
        resolve_timeout: '',
      },
    );
  });
  it.each(['add', 'edit'] as const)(
    '%s在真实Form尚未挂载的同一事件周期不提交',
    async (mode) => {
      if (mode === 'add')
        wrapper.get<HTMLButtonElement>('.btn-create').element.click();
      else
        required(
          row()
            .findAll<HTMLButtonElement>('button')
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
    '非法实体ID %s不能详情、编辑、删除',
    async (id) => {
      required(wrapper.findComponent(Table).props('dataSource')?.[0]).id = id;
      await action('编辑');
      expect(modal(editTitle).props('open')).toBe(false);
      await action('查看');
      expect(modal(detailTitle).props('open')).toBe(false);
      await action('删除');
      expect(confirmations).toHaveLength(0);
      expect(
        client.get.mock.calls.some(([path]) => path.includes('/detail/')),
      ).toBe(false);
    },
  );
  it.each([
    '请输入实例池名称',
    '请输入AlertManager实例IP',
    '请选择兜底接收者',
    '例如: 5s',
    '请输入标签Key',
    '请输入标签Value',
  ])('校验等待时字段%s变化不能发送，解除当前busy', async (field) => {
    await add();
    await fill();
    const pending = createDeferred<Record<string, unknown>>();
    vi.spyOn(validator(), 'validate').mockImplementation(() => pending.promise);
    await submit();
    await set(field, 'changed');
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
  });
  it('编辑等待时目标ID变化不能发送、更不能回退为新增', async () => {
    await action('编辑');
    const pending = createDeferred<Record<string, unknown>>();
    vi.spyOn(validator('edit'), 'validate').mockImplementation(
      () => pending.promise,
    );
    await submit(editTitle);
    required(wrapper.findComponent(Form).props('model')).id = 0;
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });
  it.each(['close', 'account', 'generation', 'unmount'])(
    'validate等待期间%s阻断写入',
    async (change) => {
      await add();
      await fill();
      const pending = createDeferred<Record<string, unknown>>();
      vi.spyOn(validator(), 'validate').mockImplementation(
        () => pending.promise,
      );
      await submit();
      switch (change) {
        case 'account': {
          control.session.uid = '2';
          break;
        }
        case 'close': {
          await close();
          break;
        }
        case 'generation': {
          control.session.generation += 1;
          break;
        }
        default: {
          wrapper.unmount();
          unmounted = true;
        }
      }
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
    },
  );
  it.each(['resolve', 'reject'] as const)(
    '旧写入%s不关闭新窗口或解除新busy、不刷新或提示',
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
      const notices = vi.mocked(message.success).mock.calls.length;
      if (completion === 'resolve') old.resolve({});
      else old.reject(new Error('private-error-canary'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(true);
      expect(listReads()).toBe(reads);
      expect(message.success).toHaveBeenCalledTimes(notices);
      expect(message.error).not.toHaveBeenCalled();
      fresh.resolve({});
      await flushPromises();
      expect(modal().props('open')).toBe(false);
    },
  );
  it('发送快照与之后编辑的动态实例/标签独立', async () => {
    const pending = createDeferred<object>();
    client.put.mockReturnValue(pending.promise);
    await action('编辑');
    await submit(editTitle);
    await set('请输入AlertManager实例IP', 'different', editTitle);
    await set('请输入标签Key', 'new-label', editTitle);
    expect(client.put.mock.calls[0]?.[1]).toMatchObject({
      alert_manager_instances: ['127.0.0.1:9093'],
      group_by: ['service,api', 'region,cn'],
    });
    pending.resolve({});
    await flushPromises();
  });
  it('旧详情不能覆盖后打开的编辑窗口', async () => {
    const pending = createDeferred<ReturnType<typeof pool>>();
    client.get.mockImplementation((path: string) =>
      path.includes('/detail/')
        ? pending.promise
        : Promise.resolve({ total: 2, items: rows }),
    );
    await action('查看');
    expect(modal(detailTitle).props('open')).toBe(true);
    await action('编辑', 'pool-b');
    pending.resolve(pool(11));
    await flushPromises();
    expect(modal(detailTitle).props('open')).toBe(false);
    expect(input('请输入实例池名称', editTitle).props('value')).toBe('pool-b');
  });
  it('详情不接受另一个ID的响应，且固定错误文案', async () => {
    client.get.mockImplementation((path: string) =>
      path.includes('/detail/')
        ? Promise.resolve(pool(99))
        : Promise.resolve({ total: 2, items: rows }),
    );
    await action('查看');
    expect(modal(detailTitle).props('open')).toBe(false);
    expect(message.error).toHaveBeenCalledWith('获取实例池详情失败');
  });
  it.each(['close', 'generation', 'unmount'])(
    '详情等待%s不重开窗口或提示旧错误',
    async (change) => {
      const pending = createDeferred<object>();
      client.get.mockImplementation((path: string) =>
        path.includes('/detail/')
          ? pending.promise
          : Promise.resolve({ total: 2, items: rows }),
      );
      await action('查看');
      if (change === 'close') await close(detailTitle);
      else if (change === 'generation') control.session.generation += 1;
      else {
        wrapper.unmount();
        unmounted = true;
      }
      pending.reject(new Error('private-error-canary'));
      await flushPromises();
      expect(message.error).not.toHaveBeenCalled();
      if (!unmounted) expect(modal(detailTitle).props('open')).toBe(false);
    },
  );
  it('用户选择保留username文本且不使用显示名称或用户ID作为receiver', async () => {
    await add();
    await fill();
    await chooseUsers();
    const table = required(wrapper.findAllComponents(Table).at(-1));
    expect(table.props('dataSource')).toHaveLength(2);
    await new DOMWrapper(
      required(
        document.querySelector(
          '.user-selection-content button.ant-btn-primary',
        ),
      ),
    ).trigger('click');
    await flushPromises();
    await submit();
    expect(client.post.mock.calls[0]?.[1].receiver).toBe('user-7');
  });
  it('用户查询乱序与旧finally不能覆盖新查询或解除busy', async () => {
    const first = createDeferred<object>();
    const second = createDeferred<object>();
    const original = client.get.getMockImplementation();
    client.get.mockImplementation((path: string) =>
      path === '/user/list' ? first.promise : required(original)(path),
    );
    await add();
    await chooseUsers();
    client.get.mockImplementation((path: string) =>
      path === '/user/list' ? second.promise : required(original)(path),
    );
    await new DOMWrapper(
      required(
        document.querySelector(
          '.user-selection-content .ant-input-search-button',
        ),
      ),
    ).trigger('click');
    await flushPromises();
    first.resolve({ total: 1, items: [user(99, 'stale-user')] });
    await flushPromises();
    expect(
      required(wrapper.findAllComponents(Table).at(-1)).props('loading'),
    ).toBe(true);
    expect(document.body.textContent).not.toContain('stale-user');
    second.resolve({ total: 1, items: [user(8, 'current-user')] });
    await flushPromises();
    expect(document.body.textContent).toContain('current-user');
  });
  it('用户目录切换表单后旧结果不展示，不覆盖新receiver', async () => {
    const pending = createDeferred<object>();
    const original = client.get.getMockImplementation();
    client.get.mockImplementation((path: string) =>
      path === '/user/list' ? pending.promise : required(original)(path),
    );
    await add();
    await chooseUsers();
    await action('编辑', 'pool-b');
    pending.resolve({ total: 1, items: [user(99, 'stale-user')] });
    await flushPromises();
    expect(modal(userTitle).props('open')).toBe(false);
    expect(input('请选择兜底接收者', editTitle).props('value')).toBe(
      'receiver-a',
    );
  });
  it.each(['pending', 'success', 'failure'])(
    '删除确认%s之后同一callback只消费一次，新确认可以重试',
    async (state) => {
      const pending = createDeferred<object>();
      client.delete.mockReturnValueOnce(pending.promise);
      await action('删除');
      const oldCallback = required(required(confirmations.at(-1)).onOk);
      const first = oldCallback();
      await flushPromises();
      if (state === 'success') pending.resolve({});
      else if (state === 'failure')
        pending.reject(new Error('private-error-canary'));
      await flushPromises();
      await oldCallback();
      expect(client.delete).toHaveBeenCalledTimes(1);
      if (state === 'pending') {
        pending.resolve({});
        await first;
      }
      await action('删除');
      await confirm();
      expect(client.delete).toHaveBeenCalledTimes(2);
      if (state === 'failure')
        expect(message.error).toHaveBeenCalledWith('删除实例池失败');
    },
  );
  it.each(['window', 'generation', 'cancel', 'unmount'])(
    '删除确认%s后不可发送',
    async (change) => {
      await action('删除');
      const callback = required(required(confirmations.at(-1)).onOk);
      switch (change) {
        case 'cancel': {
          required(required(confirmations.at(-1)).onCancel)();
          break;
        }
        case 'generation': {
          control.session.generation += 1;
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
  it('列表加载失败固定文案，不展示原始错误；切owner后旧列表无效', async () => {
    const pending = createDeferred<object>();
    client.get.mockReturnValue(pending.promise);
    await wrapper.get('.reset-btn').trigger('click');
    const reads = client.get.mock.calls.length;
    control.session.generation += 1;
    await flushPromises();
    expect(client.get).toHaveBeenCalledTimes(reads);
    pending.reject(new Error('private-error-canary'));
    await flushPromises();
    expect(document.body.textContent).not.toContain('private-error-canary');
    expect(message.error).not.toHaveBeenCalled();
  });
  it.each(['resolve', 'reject'] as const)(
    '发送期间修改当前字段时旧%s不丢弃新输入、可继续提交',
    async (completion) => {
      const pending = createDeferred<object>();
      client.post.mockReturnValueOnce(pending.promise);
      await add();
      await fill();
      await submit();
      await set('请输入实例池名称', 'new-input');
      if (completion === 'resolve') pending.resolve({});
      else pending.reject(new Error('private-error-canary'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(false);
      expect(input('请输入实例池名称').props('value')).toBe('new-input');
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      await submit();
      expect(client.post).toHaveBeenCalledTimes(2);
    },
  );
  it('空实例数组即使没有动态字段仍被运行时必需合同拒绝', async () => {
    await action('编辑');
    const model = required(wrapper.findComponent(Form).props('model'));
    model.alert_manager_instances = [];
    await flushPromises();
    await submit(editTitle);
    expect(client.put).not.toHaveBeenCalled();
  });
  it('用户目录过滤非法ID和非用户名，旧行回调不能选入重开窗口', async () => {
    const original = client.get.getMockImplementation();
    client.get.mockImplementation((path: string) =>
      path === '/user/list'
        ? Promise.resolve({
            total: 6,
            items: [
              user(0),
              user(-1),
              user(1.5),
              user(9, ''),
              user(10, 'x'.repeat(101)),
              user(7),
            ],
          })
        : required(original)(path),
    );
    await add();
    await fill();
    await chooseUsers();
    expect(
      required(wrapper.findAllComponents(Table).at(-1)).props('dataSource'),
    ).toHaveLength(1);
    const old = new DOMWrapper(
      required(
        document.querySelector(
          '.user-selection-content button.ant-btn-primary',
        ),
      ),
    );
    await close(userTitle);
    await action('编辑', 'pool-b');
    await chooseUsers(editTitle);
    await old.trigger('click');
    await flushPromises();
    expect(input('请选择兜底接收者', editTitle).props('value')).toBe(
      'receiver-a',
    );
    expect(modal(userTitle).props('open')).toBe(true);
  });
  it('用户目录关闭重开后旧结果不覆盖新目录，旧错误不提示', async () => {
    const old = createDeferred<object>();
    const fresh = createDeferred<object>();
    const original = client.get.getMockImplementation();
    let first = true;
    client.get.mockImplementation((path: string) => {
      if (path !== '/user/list') return required(original)(path);
      const request = first ? old : fresh;
      first = false;
      return request.promise;
    });
    await add();
    await chooseUsers();
    await close(userTitle);
    await chooseUsers();
    old.reject(new Error('private-error-canary'));
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
    expect(
      required(wrapper.findAllComponents(Table).at(-1)).props('loading'),
    ).toBe(true);
    fresh.resolve({ total: 1, items: [user(8, 'fresh-user')] });
    await flushPromises();
    expect(document.body.textContent).toContain('fresh-user');
  });
  it('同UID重登清除用户选项、表单、列表；旧选项回执无效', async () => {
    const pending = createDeferred<object>();
    const original = client.get.getMockImplementation();
    client.get.mockImplementation((path: string) =>
      path === '/user/list' ? pending.promise : required(original)(path),
    );
    await add();
    await fill();
    await chooseUsers();
    control.session.generation += 1;
    await flushPromises();
    pending.resolve({ total: 1, items: [user(8, 'private-old-owner')] });
    await flushPromises();
    expect(modal(userTitle).props('open')).toBe(false);
    expect(modal().props('open')).toBe(false);
    expect(document.body.textContent).not.toContain('private-old-owner');
    await add();
    expect(input('请选择兜底接收者').props('value')).toBe('');
  });
  it('删除请求已发送后切换窗口，旧失败不影响新窗口', async () => {
    const pending = createDeferred<object>();
    client.delete.mockReturnValue(pending.promise);
    await action('删除');
    const request = confirm();
    await flushPromises();
    await add();
    const reads = listReads();
    pending.reject(new Error('private-error-canary'));
    await request;
    await flushPromises();
    expect(modal().props('open')).toBe(true);
    expect(message.error).not.toHaveBeenCalled();
    expect(listReads()).toBe(reads);
  });
  it('表单当前API失败仅显示固定文案并释放busy', async () => {
    client.post.mockRejectedValue(new Error('private-error-canary'));
    await add();
    await fill();
    await submit();
    expect(message.error).toHaveBeenCalledWith('新增实例池失败');
    expect(document.body.textContent).not.toContain('private-error-canary');
    expect(modal().props('confirmLoading')).toBe(false);
  });
});
