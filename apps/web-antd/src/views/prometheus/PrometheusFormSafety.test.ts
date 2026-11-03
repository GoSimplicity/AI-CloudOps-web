import { defineComponent, h } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import MonitorAlertRule from './MonitorAlertRule.vue';
import MonitorConfig from './MonitorConfig.vue';

type Kind = 'config' | 'rules';
const owner = vi.hoisted(() => ({ generation: 0, id: 1 }));
const formState = vi.hoisted(() => ({ missingValidate: false }));
const validate = vi.hoisted(() =>
  vi.fn<(model: unknown) => Promise<unknown>>(),
);
const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: owner.id } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => owner.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required form test fixture is unavailable');
  return value;
}
function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((value: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    reject(value: unknown) {
      required(rejectPromise)(value);
    },
    resolve(value: T) {
      required(resolvePromise)(value);
    },
  };
}
const Table = defineComponent({
  props: {
    columns: { default: () => [], type: Array },
    dataSource: { default: () => [], type: Array },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        props.dataSource.map((record, index) =>
          h(
            'div',
            { 'data-row-index': index },
            props.columns.flatMap(
              (column) => slots.bodyCell?.({ column, record }) ?? [],
            ),
          ),
        ),
      );
  },
});
const Dialog = defineComponent({
  emits: ['cancel', 'ok'],
  props: { confirmLoading: Boolean, open: Boolean, title: String },
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h(
            'section',
            {
              'data-busy': String(props.confirmLoading),
              'data-dialog': props.title,
            },
            [
              h(
                'button',
                { 'data-close': '', onClick: () => emit('cancel') },
                'close',
              ),
              h(
                'button',
                { 'data-save': '', onClick: () => emit('ok') },
                'save',
              ),
              slots.default?.(),
              slots.footer?.(),
            ],
          )
        : null;
  },
});
const Passthrough = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const Dropdown = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.overlay?.()]),
});
const Select = defineComponent({
  emits: ['update:value', 'dropdownVisibleChange'],
  name: 'FixtureSelect',
  props: ['value', 'placeholder', 'options', 'loading'],
  setup:
    (props, { slots }) =>
    () =>
      h(
        'div',
        { 'data-select': props.placeholder, 'data-value': String(props.value) },
        slots.default?.(),
      ),
});
const Option = defineComponent({
  props: ['value'],
  setup:
    (props, { slots }) =>
    () =>
      h(
        'span',
        { 'data-option-value': String(props.value) },
        slots.default?.(),
      ),
});
const Form = defineComponent({
  props: ['model'],
  setup(props, { expose, slots }) {
    expose(
      formState.missingValidate
        ? {}
        : { validate: () => validate(props.model) },
    );
    return () => h('div', slots.default?.());
  },
});

const titles = {
  config: { add: '新增监控配置', edit: '编辑监控配置' },
  rules: { add: '新建告警规则', edit: '编辑AlertRule' },
};
let wrapper: undefined | VueWrapper;
const rule = (id?: number, name = 'owned rule', poolId = 1, groupId = 1) => ({
  annotations: ['summary,local'],
  create_user_name: 'local fixture',
  enable: 2,
  expr: 'up',
  for_time: '10s',
  grafana_link: 'http://localhost/metrics',
  id,
  ip_address: '127.0.0.1:9090',
  labels: ['app,cloud'],
  name,
  pool_id: poolId,
  send_group_id: groupId,
  severity: 2,
  user_id: 1,
});
const config = (id?: number, name = 'owned config') => ({
  config_content: 'groups: []',
  config_hash: 'fixture',
  config_type: 1,
  created_at: '',
  id,
  instance_ip: '127.0.0.1',
  last_generated_time: 0,
  name,
  pool_id: 1,
  status: 1,
  updated_at: '',
});

beforeEach(() => {
  vi.clearAllMocks();
  owner.id = 1;
  owner.generation = 0;
  formState.missingValidate = false;
  validate.mockImplementation(() => Promise.resolve());
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  vi.spyOn(Modal, 'confirm').mockReturnValue({
    destroy: vi.fn(),
    update: vi.fn(),
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const original = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    original(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountPage(
  kind: Kind,
  rows: unknown[] = [],
  realForm = false,
  respond?: (path: string) => Promise<unknown>,
) {
  const path =
    kind === 'rules' ? '/monitor/alert_rules/list' : '/monitor/configs/list';
  client.get.mockImplementation(
    respond ??
      ((url: string) => {
        if (url === path)
          return Promise.resolve({ total: rows.length, items: rows });
        if (url.endsWith('/list'))
          return Promise.resolve({
            total: 1,
            items: [{ id: 1, name: 'owned option' }],
          });
        return Promise.resolve({ id: 1, name: 'owned option' });
      }),
  );
  wrapper = mount(kind === 'rules' ? MonitorAlertRule : MonitorConfig, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        ADropdown: Dropdown,
        AForm: realForm ? false : Form,
        AFormItem: realForm ? false : Passthrough,
        AModal: Dialog,
        ASelect: realForm ? false : Select,
        ASelectOption: realForm ? false : Option,
        ATable: Table,
        ATooltip: Passthrough,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
function dialog(kind: Kind, mode: 'add' | 'edit' = 'add') {
  return required(wrapper).get(`[data-dialog="${titles[kind][mode]}"]`);
}
async function create(kind: Kind) {
  await required(wrapper).get('.btn-create').trigger('click');
  await flushPromises();
  return dialog(kind);
}
async function setSelect(placeholder: string, value: unknown) {
  const control = required(
    required(wrapper)
      .findAllComponents(Select)
      .find((item) => item.props('placeholder') === placeholder),
  );
  control.vm.$emit('update:value', value);
  await flushPromises();
}
async function fillAdd(kind: Kind) {
  if (kind === 'config') {
    await dialog(kind)
      .get('input[placeholder="请输入配置名称"]')
      .setValue('owned config');
    await setSelect('请选择实例池', 1);
    await setSelect('请选择配置类型', 1);
    await dialog(kind)
      .get('input[placeholder="请输入实例IP"]')
      .setValue('127.0.0.1');
    await dialog(kind)
      .get('textarea[placeholder="请输入配置内容"]')
      .setValue('groups: []');
  } else {
    await dialog(kind)
      .get('input[placeholder="请输入名称"]')
      .setValue('owned rule');
    await setSelect('请选择所属实例池', 1);
    await setSelect('请选择发送组', 1);
    await setSelect('请选择严重性', 2);
    await dialog(kind)
      .get('input[placeholder="请输入IP地址"]')
      .setValue('127.0.0.1');
    await dialog(kind).get('input[placeholder="端口"]').setValue('9090');
    await dialog(kind).get('[placeholder="请输入PromQL表达式"]').setValue('up');
  }
}
async function rowAction(label: string, index = 0) {
  const target = required(wrapper)
    .get(`[data-row-index="${index}"]`)
    .findAll('button, [role="menuitem"]')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  await required(target).trigger('click');
  await flushPromises();
}
function confirm() {
  return required(required(vi.mocked(Modal.confirm).mock.calls.at(-1))[0].onOk);
}

it.each<Kind>(['config', 'rules'])(
  'validates before creating %s and preserves its API contract',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    await dialog(kind).get('[data-save]').trigger('click');
    await flushPromises();
    expect(validate).toHaveBeenCalledOnce();
    expect(client.post).toHaveBeenCalledOnce();
    expect(client.post).toHaveBeenCalledWith(
      kind === 'rules'
        ? '/monitor/alert_rules/create'
        : '/monitor/configs/create',
      expect.objectContaining(
        kind === 'rules'
          ? {
              annotations: [],
              ip_address: '127.0.0.1:9090',
              labels: [],
              pool_id: 1,
              send_group_id: 1,
              severity: 2,
            }
          : { config_content: 'groups: []', config_type: 1, pool_id: 1 },
      ),
    );
    expect(
      required(wrapper).find(`[data-dialog="${titles[kind].add}"]`).exists(),
    ).toBe(false);
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not write %s when the actual form instance has no validator',
  async (kind) => {
    formState.missingValidate = true;
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    await dialog(kind).get('[data-save]').trigger('click');
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('表单尚未就绪，请稍后重试');
  },
);

it.each<Kind>(['config', 'rules'])(
  'refuses %s after validation rejects',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    validate.mockRejectedValueOnce(new Error('validation failed'));
    await dialog(kind).get('[data-save]').trigger('click');
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(dialog(kind).attributes('data-busy')).toBe('false');
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not send %s if its values changed while validation was pending',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await dialog(kind).get('[data-save]').trigger('click');
    await setSelect(kind === 'config' ? '请选择实例池' : '请选择所属实例池', 2);
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(dialog(kind).attributes('data-busy')).toBe('false');
  },
);

it.each<Kind>(['config', 'rules'])(
  'ignores old validation after the same %s create window is reopened',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await dialog(kind).get('[data-save]').trigger('click');
    await dialog(kind).get('[data-close]').trigger('click');
    await create(kind);
    await fillAdd(kind);
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(dialog(kind).element.isConnected).toBe(true);
    expect(dialog(kind).attributes('data-busy')).toBe('false');
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not borrow a new login generation during %s validation',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await dialog(kind).get('[data-save]').trigger('click');
    owner.generation += 1;
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
  },
);

it.each<Kind>(['config', 'rules'])(
  'prevents duplicate %s submissions while validation and the write are pending',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    const check = deferred<unknown>();
    const write = deferred<unknown>();
    validate.mockReturnValueOnce(check.promise);
    client.post.mockReturnValueOnce(write.promise);
    await dialog(kind).get('[data-save]').trigger('click');
    await dialog(kind).get('[data-save]').trigger('click');
    expect(validate).toHaveBeenCalledOnce();
    check.resolve({});
    await flushPromises();
    await dialog(kind).get('[data-save]').trigger('click');
    expect(client.post).toHaveBeenCalledOnce();
    write.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledOnce();
  },
);

it.each<Kind>(['config', 'rules'])(
  'keeps a new %s submission busy when an older request completes',
  async (kind) => {
    await mountPage(kind);
    await create(kind);
    await fillAdd(kind);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    client.post
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await dialog(kind).get('[data-save]').trigger('click');
    await flushPromises();
    await dialog(kind).get('[data-close]').trigger('click');
    await create(kind);
    await fillAdd(kind);
    await dialog(kind).get('[data-save]').trigger('click');
    await flushPromises();
    first.resolve({});
    await flushPromises();
    expect(dialog(kind).attributes('data-busy')).toBe('true');
    expect(message.success).not.toHaveBeenCalled();
    second.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledOnce();
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
])('rejects an invalid config pool selection: %s', async (poolId) => {
  await mountPage('config');
  await create('config');
  await fillAdd('config');
  await setSelect('请选择实例池', poolId);
  await dialog('config').get('[data-save]').trigger('click');
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalled();
});

it.each([undefined, 0, 6, -1, 1.5])(
  'rejects an invalid config enum selection: %s',
  async (type) => {
    await mountPage('config');
    await create('config');
    await fillAdd('config');
    await setSelect('请选择配置类型', type);
    await dialog('config').get('[data-save]').trigger('click');
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  },
);

it.each(['请选择所属实例池', '请选择发送组', '请选择严重性'])(
  'does not send a missing rule selection for %s',
  async (placeholder) => {
    await mountPage('rules');
    await create('rules');
    await fillAdd('rules');
    await setSelect(placeholder, undefined);
    await dialog('rules').get('[data-save]').trigger('click');
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalled();
  },
);

it.each<Kind>(['config', 'rules'])(
  'refuses missing %s row identifiers for edit and delete',
  async (kind) => {
    await mountPage(kind, [kind === 'rules' ? rule() : config()]);
    await rowAction('编辑');
    await rowAction('删除');
    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it.each<Kind>(['config', 'rules'])(
  'preserves validated %s edits and their selected identifiers',
  async (kind) => {
    await mountPage(kind, [kind === 'rules' ? rule(7) : config(7)]);
    await rowAction('编辑');
    await dialog(kind, 'edit').get('[data-save]').trigger('click');
    await flushPromises();
    expect(validate).toHaveBeenCalledOnce();
    expect(client.put).toHaveBeenCalledOnce();
    expect(client.put).toHaveBeenCalledWith(
      kind === 'rules'
        ? '/monitor/alert_rules/update/7'
        : '/monitor/configs/update/7',
      expect.objectContaining(
        kind === 'rules'
          ? {
              annotations: ['summary,local'],
              enable: 2,
              id: 7,
              labels: ['app,cloud'],
              pool_id: 1,
              send_group_id: 1,
              severity: 2,
            }
          : { config_type: 1, id: 7, pool_id: 1 },
      ),
    );
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not replace edit B after validation from edit A resolves: %s',
  async (kind) => {
    await mountPage(
      kind,
      kind === 'rules'
        ? [rule(7, 'row A'), rule(8, 'row B')]
        : [config(7, 'row A'), config(8, 'row B')],
    );
    await rowAction('编辑', 0);
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await dialog(kind, 'edit').get('[data-save]').trigger('click');
    await dialog(kind, 'edit').get('[data-close]').trigger('click');
    await rowAction('编辑', 1);
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
    expect(dialog(kind, 'edit').element.isConnected).toBe(true);
  },
);

it.each<Kind>(['config', 'rules'])(
  'consumes %s deletion confirmation once and refuses old-owner execution',
  async (kind) => {
    await mountPage(kind, [kind === 'rules' ? rule(7) : config(7)]);
    await rowAction('删除');
    const old = confirm();
    owner.generation += 1;
    await old();
    expect(client.delete).not.toHaveBeenCalled();
    await rowAction('删除');
    const onOk = confirm();
    const pending = deferred<unknown>();
    client.delete.mockReturnValueOnce(pending.promise);
    const first = onOk();
    await onOk();
    expect(client.delete).toHaveBeenCalledOnce();
    pending.resolve({});
    await first;
    await onOk();
    expect(client.delete).toHaveBeenCalledOnce();
  },
);

it('does not reopen configuration detail A over B after a slower response', async () => {
  const a = config(7, 'config A');
  const b = config(8, 'config B');
  await mountPage('config', [a, b]);
  const first = deferred<unknown>();
  client.get.mockImplementation((path: string) =>
    path.endsWith('/7') ? first.promise : Promise.resolve(b),
  );
  await rowAction('查看', 0);
  await rowAction('查看', 1);
  first.resolve(a);
  await flushPromises();
  expect(required(wrapper).get('[data-dialog="配置详情"]').text()).toContain(
    'config B',
  );
});

it('does not let slow rule association loading overwrite a later edit window', async () => {
  await mountPage('rules', [rule(7, 'rule A', 2), rule(8, 'rule B')]);
  const pending = deferred<unknown>();
  client.get.mockImplementation((path: string) =>
    path.endsWith('/2')
      ? pending.promise
      : Promise.resolve({ id: 1, name: 'owned option' }),
  );
  await rowAction('编辑', 0);
  await dialog('rules', 'edit').get('[data-close]').trigger('click');
  await rowAction('编辑', 1);
  pending.resolve({ id: 2, name: 'late option A' });
  await flushPromises();
  expect(
    dialog('rules', 'edit').get('input[placeholder="请输入名称"]').element,
  ).toHaveProperty('value', 'rule B');
  expect(dialog('rules', 'edit').text()).not.toContain('late option A');
});

it('does not show a stale PromQL check for a changed expression or reopened window', async () => {
  await mountPage('rules');
  await create('rules');
  await fillAdd('rules');
  const pending = deferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  const button = required(
    dialog('rules')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '验证表达式'),
  );
  await button.trigger('click');
  await dialog('rules')
    .get('[placeholder="请输入PromQL表达式"]')
    .setValue('up == 0');
  pending.resolve({});
  await flushPromises();
  expect(message.success).not.toHaveBeenCalled();
});

it.each<Kind>(['config', 'rules'])(
  'enforces real Ant Design required fields before creating %s',
  async (kind) => {
    await mountPage(kind, [], true);
    await create(kind);
    await dialog(kind).get('[data-save]').trigger('click');
    await vi.waitFor(() =>
      expect(
        dialog(kind).findAll('.ant-form-item-explain-error').length,
      ).toBeGreaterThan(0),
    );
    expect(client.post).not.toHaveBeenCalled();
  },
);

for (const kind of ['config', 'rules'] satisfies Kind[]) {
  for (const mode of ['add', 'edit'] satisfies Array<'add' | 'edit'>) {
    it.each(['resolve', 'reject'])(
      `${kind} ${mode} ignores an old-owner write receipt: %s`,
      async (outcome) => {
        await mountPage(kind, [kind === 'rules' ? rule(7) : config(7)]);
        if (mode === 'add') {
          await create(kind);
          await fillAdd(kind);
        } else await rowAction('编辑');
        const pending = deferred<unknown>();
        const writer = mode === 'add' ? client.post : client.put;
        writer.mockReturnValueOnce(pending.promise);
        await dialog(kind, mode).get('[data-save]').trigger('click');
        await flushPromises();
        const reads = client.get.mock.calls.length;
        owner.generation += 1;
        if (outcome === 'resolve') pending.resolve({});
        else pending.reject(new Error('old generation write failure'));
        await flushPromises();
        expect(client.get).toHaveBeenCalledTimes(reads);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
        expect(dialog(kind, mode).element.isConnected).toBe(true);
        expect(dialog(kind, mode).attributes('data-busy')).toBe('false');
      },
    );
  }
}

it.each<Kind>(['config', 'rules'])(
  'preserves the newer edit busy state after an earlier %s write receipt',
  async (kind) => {
    await mountPage(
      kind,
      kind === 'rules'
        ? [rule(7, 'row A'), rule(8, 'row B')]
        : [config(7, 'row A'), config(8, 'row B')],
    );
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    client.put
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await rowAction('编辑', 0);
    await dialog(kind, 'edit').get('[data-save]').trigger('click');
    await flushPromises();
    await dialog(kind, 'edit').get('[data-close]').trigger('click');
    await rowAction('编辑', 1);
    await dialog(kind, 'edit').get('[data-save]').trigger('click');
    await flushPromises();
    first.reject(new Error('old edit failure'));
    await flushPromises();
    expect(dialog(kind, 'edit').attributes('data-busy')).toBe('true');
    expect(message.error).not.toHaveBeenCalled();
    second.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledOnce();
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not send %s edits after the source row identifier changes during validation',
  async (kind) => {
    const record = kind === 'rules' ? rule(7) : config(7);
    await mountPage(kind, [record]);
    await rowAction('编辑');
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await dialog(kind, 'edit').get('[data-save]').trigger('click');
    record.id = 8;
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it.each<Kind>(['config', 'rules'])(
  'does not send %s deletion after the confirmed target changes',
  async (kind) => {
    const record = kind === 'rules' ? rule(7) : config(7);
    await mountPage(kind, [record]);
    await rowAction('删除');
    record.id = 8;
    await confirm()();
    expect(client.delete).not.toHaveBeenCalled();
  },
);

it('keeps Config options free of missing, fractional and nonpositive identifiers', async () => {
  await mountPage('config');
  owner.generation += 1;
  client.get.mockResolvedValue({
    total: 5,
    items: [
      { name: 'missing pool' },
      { id: 0, name: 'zero pool' },
      { id: -2, name: 'negative pool' },
      { id: 2.5, name: 'fractional pool' },
      { id: 9, name: 'valid pool' },
    ],
  });
  await create('config');
  const pool = required(
    required(wrapper)
      .findAllComponents(Select)
      .find((item) => item.props('placeholder') === '请选择实例池'),
  );
  expect(pool.text()).toContain('valid pool');
  expect(pool.text()).not.toContain('missing pool');
  expect(pool.text()).not.toContain('zero pool');
  expect(pool.text()).not.toContain('negative pool');
  expect(pool.text()).not.toContain('fractional pool');
});

it('does not inject an old-session rule association after same-UID reauthentication', async () => {
  await mountPage('rules', [rule(7, 'rule A', 2, 3)]);
  const pending = deferred<unknown>();
  client.get.mockImplementation((path: string) =>
    path.endsWith('/2')
      ? pending.promise
      : Promise.resolve({ id: 1, name: 'owned option' }),
  );
  await rowAction('编辑');
  owner.generation += 1;
  pending.reject(new Error('old pool failure'));
  await flushPromises();
  expect(message.error).not.toHaveBeenCalled();
  expect(
    client.get.mock.calls.some(
      ([path]) => path === '/monitor/send_groups/detail/3',
    ),
  ).toBe(false);
});

it('preserves selected rule association names when a slow first options page finishes', async () => {
  const options = deferred<unknown>();
  const record = rule(7, 'rule A', 2);
  await mountPage('rules', [record], false, (path) => {
    if (path === '/monitor/alert_rules/list')
      return Promise.resolve({ total: 1, items: [record] });
    if (path === '/monitor/alert_manager_pools/list') return options.promise;
    if (path === '/monitor/alert_manager_pools/detail/2')
      return Promise.resolve({ id: 2, name: 'selected pool' });
    if (path === '/monitor/send_groups/detail/1')
      return Promise.resolve({ id: 1, name: 'owned group' });
    return Promise.resolve({
      total: 1,
      items: [{ id: 1, name: 'owned group' }],
    });
  });
  await create('rules');
  const loadingPool = required(
    required(wrapper)
      .findAllComponents(Select)
      .find((item) => item.props('placeholder') === '请选择所属实例池'),
  );
  loadingPool.vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  expect(
    client.get.mock.calls.some(
      ([path]) => path === '/monitor/alert_manager_pools/list',
    ),
  ).toBe(true);
  await dialog('rules').get('[data-close]').trigger('click');
  await rowAction('编辑');
  const pool = required(
    required(wrapper)
      .findAllComponents(Select)
      .find((item) => item.props('placeholder') === '请选择所属实例池'),
  );
  expect(pool.text()).toContain('selected pool');
  options.resolve({ total: 2, items: [{ id: 1, name: 'first page pool' }] });
  await flushPromises();
  expect(pool.text()).toContain('selected pool');
  expect(pool.text()).toContain('first page pool');
});

it.each(['resolve', 'reject'])(
  'ignores an old PromQL result after its window was reopened with the same expression: %s',
  async (outcome) => {
    await mountPage('rules');
    await create('rules');
    await fillAdd('rules');
    const pending = deferred<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    const control = required(
      dialog('rules')
        .findAll('button')
        .find((item) => item.text().replaceAll(/\s/g, '') === '验证表达式'),
    );
    await control.trigger('click');
    await dialog('rules').get('[data-close]').trigger('click');
    await create('rules');
    await fillAdd('rules');
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('old expression failure'));
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  },
);

it('does not reopen Config detail after close or accept a mismatched identifier', async () => {
  const record = config(7);
  await mountPage('config', [record]);
  client.get.mockResolvedValue(record);
  await rowAction('查看');
  const pending = deferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await rowAction('查看');
  await required(wrapper)
    .get('[data-dialog="配置详情"] [data-close]')
    .trigger('click');
  pending.resolve(record);
  await flushPromises();
  expect(required(wrapper).find('[data-dialog="配置详情"]').exists()).toBe(
    false,
  );
  client.get.mockResolvedValue(config(8));
  await rowAction('查看');
  expect(required(wrapper).find('[data-dialog="配置详情"]').exists()).toBe(
    false,
  );
  expect(message.error).toHaveBeenCalledWith(
    '获取配置详情失败: 配置详情标识无效，请刷新后重试',
  );
});

it.each(['add', 'edit'] as const)(
  'invalidates pending Config detail when opening %s',
  async (mode) => {
    await mountPage('config', [config(7, 'detail A'), config(8, 'edit B')]);
    const pending = deferred<unknown>();
    client.get.mockReturnValueOnce(pending.promise);
    await rowAction('查看', 0);
    await (mode === 'add' ? create('config') : rowAction('编辑', 1));
    pending.resolve(config(7, 'detail A'));
    await flushPromises();
    expect(required(wrapper).find('[data-dialog="配置详情"]').exists()).toBe(
      false,
    );
    expect(dialog('config', mode).element.isConnected).toBe(true);
  },
);

it('does not let an old Config detail reopen after create closes and a fresh detail loads', async () => {
  const a = config(7, 'old detail A');
  const b = config(8, 'new detail B');
  await mountPage('config', [a, b]);
  const pending = deferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await rowAction('查看', 0);
  await create('config');
  await dialog('config').get('[data-close]').trigger('click');
  client.get.mockResolvedValueOnce(b);
  await rowAction('查看', 1);
  pending.resolve(a);
  await flushPromises();
  expect(required(wrapper).get('[data-dialog="配置详情"]').text()).toContain(
    'new detail B',
  );
});

for (const mode of ['add', 'edit'] as const) {
  it.each([
    undefined,
    null,
    0,
    3,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '1',
    '2',
  ])(
    `refuses invalid Config ${mode} status without writing: %s`,
    async (status) => {
      if (mode === 'add') {
        await mountPage('config');
        await create('config');
        await fillAdd('config');
        const control = required(wrapper).getComponent({ name: 'ASwitch' });
        control.vm.$emit('update:checked', status);
        await flushPromises();
      } else {
        await mountPage('config', [{ ...config(7), status }]);
        await rowAction('编辑');
      }
      await dialog('config', mode).get('[data-save]').trigger('click');
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      expect(message.warning).toHaveBeenCalledWith(
        '请选择有效的实例池、配置类型和状态',
      );
    },
  );
  it.each([1, 2])(
    `preserves valid Config ${mode} status %s`,
    async (status) => {
      if (mode === 'add') {
        await mountPage('config');
        await create('config');
        await fillAdd('config');
        const control = required(wrapper).getComponent({ name: 'ASwitch' });
        control.vm.$emit('update:checked', status);
        await flushPromises();
      } else {
        await mountPage('config', [{ ...config(7), status }]);
        await rowAction('编辑');
      }
      await dialog('config', mode).get('[data-save]').trigger('click');
      await flushPromises();
      const writer = mode === 'add' ? client.post : client.put;
      expect(writer).toHaveBeenCalledOnce();
      expect(writer).toHaveBeenCalledWith(
        mode === 'add'
          ? '/monitor/configs/create'
          : '/monitor/configs/update/7',
        expect.objectContaining({ status }),
      );
    },
  );
}
