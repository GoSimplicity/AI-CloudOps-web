import type { FormInstance } from 'ant-design-vue';

import { defineComponent, h } from 'vue';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal, Select, Table } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorSend from './MonitorSend.vue';

const control = vi.hoisted(() => ({
  allowed: true,
  session: { generation: 0, uid: '1' },
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: control.session.uid } }),
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

// Isolate popup timing while using each row's real menu and actual Form/Select controls.
const InlineDropdown = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.overlay?.()]),
});
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
const user = (id: number, username = `user-${id}`) => ({ id, username });
const pool = (id: number | undefined, name = 'alert-pool-71') => ({ id, name });
const group = (id: number | undefined, name = 'sender-a', poolId = 71) => ({
  create_user_name: 'operator',
  created_at: '',
  enable: 1,
  fei_shu_qun_robot_token: 'fixture-bot-token',
  first_upgrade_users: [user(4)],
  id,
  name,
  name_zh: name,
  need_upgrade: 1,
  notify_methods: ['email', 'feishu', 'legacy-channel'],
  on_duty_group_id: 0,
  pool_id: poolId,
  repeat_interval: '5m',
  second_upgrade_users: [user(5)],
  send_resolved: 1,
  static_receive_user_names: [],
  static_receive_users: [user(3)],
  updated_at: '',
  upgrade_minutes: 10,
  user_id: 1,
});
type Query = { params?: { page?: number; search?: string; size?: number } };
type Confirmation = Parameters<typeof Modal.confirm>[0];
const confirmations: Confirmation[] = [];
let rows: ReturnType<typeof group>[];
let alertPools: ReturnType<typeof pool>[];
let wrapper: VueWrapper;
let unmounted = false;

beforeEach(async () => {
  vi.clearAllMocks();
  control.allowed = true;
  control.session.uid = '1';
  control.session.generation = 0;
  rows = [group(101), group(202, 'sender-b', 72)];
  alertPools = [pool(71), pool(72, 'alert-pool-72')];
  client.get.mockImplementation((path: string) => {
    if (path === '/monitor/send_groups/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === '/monitor/alert_manager_pools/list')
      return Promise.resolve({ total: alertPools.length, items: alertPools });
    // Different keyspaces make accidentally reusing the former Scrape API observable.
    if (path === '/monitor/scrape_pools/list')
      return Promise.resolve({ total: 1, items: [pool(11, 'scrape-only-11')] });
    if (path === '/monitor/onduty_groups/list')
      return Promise.resolve({
        total: 1,
        items: [{ id: 81, name: 'duty-81' }],
      });
    if (path === '/user/list')
      return Promise.resolve({ total: 3, items: [user(3), user(4), user(5)] });
    if (path.startsWith('/monitor/alert_manager_pools/detail/'))
      return Promise.resolve(
        pool(Number(path.split('/').at(-1)), 'saved-alert-pool'),
      );
    if (path.startsWith('/monitor/send_groups/detail/'))
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
  wrapper = mount(MonitorSend, {
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
  vi.useRealTimers();
});

function modal(title = '创建发送组') {
  return required(
    wrapper
      .findAllComponents(Modal)
      .find((modal) => modal.props('title') === title),
  );
}
function row(name = 'sender-a') {
  return required(
    wrapper.findAll('tbody tr').find((row) => row.text().includes(name)),
  );
}
async function create() {
  await wrapper.get('.btn-create').trigger('click');
  await flushPromises();
}
async function edit(name?: string) {
  await required(
    row(name)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  ).trigger('click');
  await flushPromises();
}
async function view(name?: string) {
  await required(
    row(name)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '查看'),
  ).trigger('click');
  await flushPromises();
}
async function close(title = '创建发送组') {
  modal(title).vm.$emit('cancel');
  await flushPromises();
}
async function submit(title = '创建发送组') {
  modal(title).vm.$emit('ok');
  await flushPromises();
}
function select(placeholder: string) {
  return required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === placeholder),
  );
}
async function fill(name = 'new-sender') {
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[placeholder="请输入发送组名称"]',
      ),
    ),
  ).setValue(name);
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[placeholder="请输入发送组中文名称"]',
      ),
    ),
  ).setValue(name);
  select('请搜索并选择AlertManager池').vm.$emit('update:value', 71);
  await flushPromises();
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
  const value = wrapper.vm.$.refs.formRef;
  if (!isValidationControl(value))
    throw new Error('真实发送组表单校验接口缺失');
  return value;
}
function listReads() {
  return client.get.mock.calls.filter(
    ([path]) => path === '/monitor/send_groups/list',
  ).length;
}
async function refresh() {
  await wrapper
    .get('.ops-page__filters .ant-input-search-button')
    .trigger('click');
  await flushPromises();
}
async function deleteRow(name?: string) {
  await required(
    row(name)
      .findAll('.ant-menu-item')
      .find((item) => item.text().includes('删除')),
  ).trigger('click');
  await flushPromises();
}
function confirm() {
  return required(required(confirmations.at(-1)).onOk)();
}
async function poolOptionText() {
  await select('请搜索并选择AlertManager池')
    .get('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  return [
    ...document.querySelectorAll<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    ),
  ]
    .map((item) => item.textContent)
    .join('|');
}

describe('发送组真实目录、验证与操作范围', () => {
  it('选择AlertManager池71而非采集池11，并保留创建布尔映射/可选0关联', async () => {
    await create();
    const options = await poolOptionText();
    expect(options).toContain('alert-pool-71');
    expect(options).not.toContain('scrape-only-11');
    expect(
      client.get.mock.calls.some(
        ([path]) => path === '/monitor/scrape_pools/list',
      ),
    ).toBe(false);
    await fill();
    await submit();
    expect(client.post).toHaveBeenCalledWith('/monitor/send_groups/create', {
      enable: 2,
      fei_shu_qun_robot_token: '',
      first_upgrade_users: [],
      name: 'new-sender',
      name_zh: 'new-sender',
      need_upgrade: 2,
      notify_methods: [],
      on_duty_group_id: 0,
      pool_id: 71,
      repeat_interval: '30s',
      second_upgrade_users: [],
      send_resolved: 2,
      static_receive_users: [],
      upgrade_minutes: 0,
    });
    expect(modal().props('open')).toBe(false);
  });

  it('编辑保留接收人username、未知已保存渠道、token和全部状态字段', async () => {
    await edit();
    await submit('编辑发送组');
    expect(client.put).toHaveBeenCalledWith('/monitor/send_groups/update/101', {
      enable: 1,
      fei_shu_qun_robot_token: 'fixture-bot-token',
      first_upgrade_users: [user(4)],
      id: 101,
      name: 'sender-a',
      name_zh: 'sender-a',
      need_upgrade: 1,
      notify_methods: ['email', 'feishu', 'legacy-channel'],
      on_duty_group_id: 0,
      pool_id: 71,
      repeat_interval: '5m',
      second_upgrade_users: [user(5)],
      send_resolved: 1,
      static_receive_users: [user(3)],
      upgrade_minutes: 10,
    });
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each(['x', 'short888', 'long-fixture-token', ''])(
    '详情token长度(%s)均不明文展示，编辑与payload保持原值',
    async (token) => {
      rows = [{ ...group(101), fei_shu_qun_robot_token: token }];
      await refresh();
      await view();
      const label = required(
        [
          ...document.querySelectorAll<HTMLElement>(
            '.ant-descriptions-item-label',
          ),
        ].find((label) => label.textContent?.includes('飞书Token')),
      );
      expect(label.nextElementSibling?.textContent?.trim()).toBe(
        token ? '********' : '未配置',
      );
      await close('发送组详情');
      await edit();
      expect(
        required(
          document.querySelector<HTMLInputElement>(
            'input[placeholder="请输入飞书群机器人Token"]',
          ),
        ).value,
      ).toBe(token);
      await submit('编辑发送组');
      expect(client.put).toHaveBeenCalledWith(
        '/monitor/send_groups/update/101',
        expect.objectContaining({ fei_shu_qun_robot_token: token }),
      );
    },
  );

  it('必填真实校验失败时不请求且释放自身busy', async () => {
    await create();
    await submit();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-form-item-explain-error'),
      ).not.toBeNull(),
    );
    expect(client.post).not.toHaveBeenCalled();
    expect(modal().props('confirmLoading')).toBe(false);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('校验resolved也不能提交非法必需pool_id %s', async (id) => {
    await create();
    await fill();
    select('请搜索并选择AlertManager池').vm.$emit('update:value', id);
    await flushPromises();
    vi.spyOn(validationControl(), 'validate').mockResolvedValueOnce({});
    await submit();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('选项不暴露缺失/零/负/小数pool标识', async () => {
    alertPools = [
      pool(undefined, 'missing-pool'),
      pool(0, 'zero-pool'),
      pool(-1, 'negative-pool'),
      pool(1.5, 'fractional-pool'),
      pool(71),
    ];
    await create();
    const text = await poolOptionText();
    expect(text).toContain('alert-pool-71');
    for (const name of [
      'missing-pool',
      'zero-pool',
      'negative-pool',
      'fractional-pool',
    ])
      expect(text).not.toContain(name);
  });

  it.each([undefined, 0, -1, Number.NaN])(
    '非法编辑ID %s 不打开写窗口也不创建',
    async (id) => {
      rows = [group(id)];
      await refresh();
      await edit();
      expect(modal().props('open')).toBe(false);
      expect(message.warning).toHaveBeenCalledWith(
        '发送组或账号标识无效，请刷新后重试',
      );
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null])(
    '全局structuredClone不可用(%s)仍能创建并通过真实Form',
    async (unavailableApi) => {
      vi.stubGlobal('structuredClone', unavailableApi);
      await create();
      await fill();
      await submit();
      expect(client.post).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['name', 'pool', 'channels'] as const)(
    '校验pending时%s变化不能借旧验证提交',
    async (field) => {
      await create();
      await fill();
      const pending = deferred<Record<string, unknown>>();
      vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
        pending.promise,
      );
      await submit();
      if (field === 'name') await fill('changed-sender');
      if (field === 'pool')
        select('请搜索并选择AlertManager池').vm.$emit('update:value', 72);
      if (field === 'channels')
        select('请选择通知方式').vm.$emit('update:value', ['feishu']);
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(modal().props('confirmLoading')).toBe(false);
    },
  );

  it.each(['close', 'edit-b', 'account', 'generation', 'unmount'] as const)(
    '校验pending后%s旧操作不能发API',
    async (boundary) => {
      await create();
      await fill();
      const pending = deferred<Record<string, unknown>>();
      vi.spyOn(validationControl(), 'validate').mockReturnValueOnce(
        pending.promise,
      );
      await submit();
      if (boundary === 'close') await close();
      if (boundary === 'edit-b') await edit('sender-b');
      if (boundary === 'account') control.session.uid = '2';
      if (boundary === 'generation') control.session.generation++;
      if (boundary === 'unmount') {
        wrapper.unmount();
        unmounted = true;
      }
      pending.resolve({});
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    '旧保存%s不关闭同模式重开的新窗口/清其busy',
    async (outcome) => {
      const old = deferred<object>();
      const fresh = deferred<object>();
      await create();
      await fill('old-sender');
      client.post.mockReturnValueOnce(old.promise);
      await submit();
      await close();
      await create();
      await fill('fresh-sender');
      client.post.mockReturnValueOnce(fresh.promise);
      await submit();
      const reads = listReads();
      if (outcome === 'resolve') old.resolve({});
      else old.reject(new Error('private-save-canary'));
      await flushPromises();
      expect(modal().props('open')).toBe(true);
      expect(modal().props('confirmLoading')).toBe(true);
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      expect(listReads()).toBe(reads);
      fresh.resolve({});
      await flushPromises();
    },
  );

  it('提交snapshot不被后来修改接收人或渠道数组改写', async () => {
    const pending = deferred<object>();
    await edit();
    client.put.mockReturnValueOnce(pending.promise);
    await submit('编辑发送组');
    const sent = required(client.put.mock.calls.at(-1))[1];
    const before = JSON.stringify(sent);
    select('请选择通知方式').vm.$emit('update:value', ['feishu']);
    select('请搜索并选择静态接收用户').vm.$emit('update:value', [4]);
    await flushPromises();
    expect(JSON.stringify(sent)).toBe(before);
    pending.resolve({});
    await flushPromises();
    expect(modal('编辑发送组').props('open')).toBe(true);
  });

  it('saved off-page AlertManager池正确详情保留名称且不自动改pool_id', async () => {
    alertPools = [pool(11, 'other-alert-11')];
    const fallback = required(client.get.getMockImplementation());
    const pending = deferred<{
      items: ReturnType<typeof pool>[];
      total: number;
    }>();
    client.get.mockImplementation((path: string, query?: Query) =>
      path === '/monitor/alert_manager_pools/list' && query?.params?.size === 20
        ? pending.promise
        : fallback(path, query),
    );
    // Refresh catalog under a new session so the off-page saved pool is not in the prior cache.
    control.session.generation++;
    await flushPromises();
    await refresh();
    await edit();
    expect(client.get).toHaveBeenCalledWith(
      '/monitor/alert_manager_pools/detail/71',
    );
    pending.resolve({ total: 1, items: [pool(11, 'other-alert-11')] });
    await flushPromises();
    expect(await poolOptionText()).toContain('saved-alert-pool');
    expect(select('请搜索并选择AlertManager池').props('value')).toBe(71);
  });

  it('saved详情错ID或旧窗口响应不会注入b的池选项', async () => {
    const fallback = required(client.get.getMockImplementation());
    const pending = deferred<ReturnType<typeof pool>>();
    alertPools = [pool(11, 'other-alert-11')];
    control.session.generation++;
    await flushPromises();
    await refresh();
    client.get.mockImplementation((path: string, query?: Query) =>
      path === '/monitor/alert_manager_pools/detail/71'
        ? pending.promise
        : fallback(path, query),
    );
    await edit();
    await edit('sender-b');
    pending.resolve(pool(999, 'stale-private-pool'));
    await flushPromises();
    expect(select('请搜索并选择AlertManager池').props('value')).toBe(72);
    expect(await poolOptionText()).not.toContain('stale-private-pool');
    expect(message.error).not.toHaveBeenCalled();
  });

  it('新窗口请求不被旧pool loading短路，旧回执不清新loading', async () => {
    const fallback = required(client.get.getMockImplementation());
    const a = deferred<{ items: ReturnType<typeof pool>[]; total: number }>();
    const b = deferred<{ items: ReturnType<typeof pool>[]; total: number }>();
    let calls = 0;
    client.get.mockImplementation((path: string, query?: Query) => {
      if (
        path === '/monitor/alert_manager_pools/list' &&
        query?.params?.size === 20
      )
        return ++calls === 1 ? a.promise : b.promise;
      return fallback(path, query);
    });
    await create();
    await edit('sender-b');
    expect(calls).toBe(2);
    a.resolve({ total: 1, items: [pool(99, 'stale-private-pool')] });
    await flushPromises();
    expect(select('请搜索并选择AlertManager池').props('loading')).toBe(true);
    b.resolve({ total: 1, items: [pool(72, 'fresh-pool')] });
    await flushPromises();
    expect(await poolOptionText()).not.toContain('stale-private-pool');
  });

  it('旧详情a不能在编辑b后重开或改b字段', async () => {
    const pending = deferred<ReturnType<typeof group>>();
    client.get.mockReturnValueOnce(pending.promise);
    await view();
    await edit('sender-b');
    pending.resolve(group(101, 'stale-private-sender'));
    await flushPromises();
    expect(modal('发送组详情').props('open')).toBe(false);
    expect(modal('编辑发送组').props('open')).toBe(true);
    expect(
      required(
        document.querySelector<HTMLInputElement>(
          'input[placeholder="请输入发送组名称"]',
        ),
      ).value,
    ).toBe('sender-b');
  });

  it('删除确认对pending/失败/成功均one-shot，新确认可重试', async () => {
    await deleteRow();
    const callback = required(required(confirmations.at(-1)).onOk);
    const pending = deferred<object>();
    client.delete.mockReturnValueOnce(pending.promise);
    const running = callback();
    await callback();
    expect(client.delete).toHaveBeenCalledTimes(1);
    pending.reject(new Error('private-delete-canary'));
    await running;
    await callback();
    expect(client.delete).toHaveBeenCalledTimes(1);
    await deleteRow();
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
  ] as const)('删除确认后%s使旧回调失效', async (boundary) => {
    await deleteRow();
    if (boundary === 'create') await create();
    if (boundary === 'account') control.session.uid = '2';
    if (boundary === 'generation') control.session.generation++;
    if (boundary === 'target') {
      const data = wrapper.getComponent(Table).props('dataSource');
      required(required(data)[0]).id = 909;
    }
    if (boundary === 'cancel')
      required(required(confirmations.at(-1)).onCancel)();
    if (boundary === 'unmount') {
      wrapper.unmount();
      unmounted = true;
    }
    await confirm();
    expect(client.delete).not.toHaveBeenCalled();
  });
});
