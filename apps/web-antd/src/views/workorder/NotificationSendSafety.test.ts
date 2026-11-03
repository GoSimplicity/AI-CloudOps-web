import { defineComponent, h, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Notification from './Notification.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const validation = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const settings = vi.hoisted(() => ({ missingValidate: false }));
const session = reactive({ generation: 0, uid: '1' });
const permissions = reactive({ manual: true, status: true, test: true });
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: session.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => session.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: (key: string) => {
      if (key === 'workorder.notification.manualSend')
        return permissions.manual;
      if (key === 'workorder.notification.testSend') return permissions.test;
      return true;
    },
    hasPerm: () => permissions.status,
  }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Notification send fixture is unavailable');
  return value;
}
function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error: unknown) => void) | undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    promise,
    reject(error: unknown) {
      required(reject)(error);
    },
    resolve(value: T) {
      required(resolve)(value);
    },
  };
}
const Table = defineComponent({
  props: {
    columns: { default: () => [], type: Array },
    dataSource: { default: () => [], type: Array },
  },
  setup:
    (props, { slots }) =>
    () =>
      h(
        'div',
        props.dataSource.map((record, index) =>
          h(
            'div',
            { 'data-row': index },
            props.columns.flatMap(
              (column) => slots.bodyCell?.({ column, record }) ?? [],
            ),
          ),
        ),
      ),
});
const Dialog = defineComponent({
  emits: ['ok', 'cancel'],
  props: { confirmLoading: Boolean, open: Boolean, title: String },
  setup:
    (props, { emit, slots }) =>
    () =>
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
                { 'data-submit': '', onClick: () => emit('ok') },
                'submit',
              ),
              h(
                'button',
                { 'data-close': '', onClick: () => emit('cancel') },
                'close',
              ),
              slots.default?.(),
              slots.footer?.(),
            ],
          )
        : null,
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
const Form = defineComponent({
  props: ['model'],
  setup: (_, { expose, slots }) => {
    expose({
      resetFields: () => {},
      ...(settings.missingValidate ? {} : { validate: () => validation() }),
    });
    return () => h('div', slots.default?.());
  },
});
const Group = defineComponent({
  emits: ['update:value'],
  props: ['value'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const Select = defineComponent({
  emits: ['update:value', 'change'],
  props: ['value', 'ariaLabel'],
  setup:
    (props, { slots }) =>
    () =>
      h('div', { 'data-select': props.ariaLabel }, slots.default?.()),
});
const Option = defineComponent({
  props: ['value'],
  setup:
    (_, { slots }) =>
    () =>
      h('span', slots.default?.()),
});
let wrapper: undefined | VueWrapper;
const record = (id: unknown = 7) => ({
  channels: ['email'],
  created_at: '',
  description: '',
  event_types: ['instance_created'],
  id,
  is_default: 2,
  max_retries: 3,
  message_template: '原始通知 {title}/{recipient_name}',
  name: 'owned config',
  operator_id: 1,
  priority: 2,
  recipient_types: ['creator'],
  retry_interval: 5,
  status: 2,
  subject_template: '原始主题 {title}',
  trigger_type: 'immediate',
  trigger_version: 1,
  updated_at: '',
});
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(session, { generation: 0, uid: '1' });
  Object.assign(permissions, { manual: true, status: true, test: true });
  settings.missingValidate = false;
  validation.mockImplementation(() => Promise.resolve());
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
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
  const original = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    original(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start(rows = [record()], realForm = false) {
  client.get.mockImplementation((path: string) => {
    if (path === '/workorder/notification/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path.startsWith('/workorder/notification/detail/'))
      return Promise.resolve(
        rows.find((row) => row.id === Number(path.split('/').at(-1))),
      );
    return Promise.resolve({ total: 0, items: [] });
  });
  wrapper = mount(Notification, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        ACheckboxGroup: realForm ? false : Group,
        ADropdown: Dropdown,
        AForm: realForm ? false : Form,
        AFormItem: realForm ? false : Passthrough,
        AModal: Dialog,
        ASelect: Select,
        ASelectOption: Option,
        ATable: Table,
        ATooltip: Passthrough,
      },
    },
  });
  await flushPromises();
}
function rowElement(index = 0) {
  return required(wrapper).get(`[data-row="${index}"]`);
}
async function action(text: string, index = 0) {
  const control = rowElement(index)
    .findAll('button, [role="menuitem"]')
    .find((item) => item.text().replaceAll(/\s/g, '') === text);
  await required(control).trigger('click');
  await flushPromises();
}
function dialog(kind: 'manual' | 'test') {
  return required(wrapper).get(
    `[data-dialog="${kind === 'manual' ? '手动发送通知' : '测试发送'}"]`,
  );
}
function exists(kind: 'manual' | 'test') {
  return required(wrapper)
    .find(`[data-dialog="${kind === 'manual' ? '手动发送通知' : '测试发送'}"]`)
    .exists();
}
async function fill(kind: 'manual' | 'test', recipient = 'safe@example.test') {
  await dialog(kind)
    .get(
      `input[placeholder="${kind === 'manual' ? '请输入邮箱或飞书接收地址' : '请输入接收地址'}"]`,
    )
    .setValue(recipient);
}
async function submit(kind: 'manual' | 'test') {
  await dialog(kind).get('[data-submit]').trigger('click');
  await flushPromises();
}
function selectTestChannel(value: unknown) {
  const select = required(
    required(wrapper)
      .findAllComponents(Select)
      .find((item) => item.props('ariaLabel') === '测试发送渠道'),
  );
  select.vm.$emit('update:value', value);
}
function statusSwitch(index = 0) {
  const row = rowElement(index);
  return required(
    required(wrapper)
      .findAllComponents({ name: 'ASwitch' })
      .find((item) => row.element.contains(item.element)),
  );
}
function currentRow(index = 0) {
  const rows = required(
    required(wrapper).getComponent(Table).props('dataSource'),
  );
  const target = required(rows[index]);
  if (target === null || typeof target !== 'object' || !('id' in target))
    throw new Error('Missing notification row');
  return target;
}
async function toggle(checked: unknown, index = 0) {
  statusSwitch(index).vm.$emit('change', checked);
  await flushPromises();
}

it('test sending keeps the established recipient-only payload and blocks repeated confirmation', async () => {
  await start();
  await action('测试发送');
  await fill('test', ' safe@example.test ');
  const pending = deferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  await submit('test');
  await submit('test');
  expect(client.post).toHaveBeenCalledOnce();
  expect(client.post).toHaveBeenCalledWith(
    '/workorder/notification/test/send',
    { channel: 'email', notification_id: 7, recipient: 'safe@example.test' },
  );
  pending.resolve({});
  await flushPromises();
  expect(exists('test')).toBe(false);
  expect(message.success).toHaveBeenCalledOnce();
});

it.each([
  undefined,
  null,
  0,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  '7',
])(
  'invalid test target %s cannot open an outbound confirmation',
  async (id) => {
    await start([{ ...record(), id }]);
    await action('测试发送');
    expect(exists('test')).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  },
);

it.each(['id', 'list', 'channel'])(
  'test send rechecks captured %s before dispatch',
  async (change) => {
    await start();
    await action('测试发送');
    await fill('test');
    if (change === 'id') currentRow().id = 8;
    if (change === 'channel') selectTestChannel('webhook');
    if (change === 'list') {
      await required(wrapper)
        .get('.search-input .ant-input-search-button')
        .trigger('click');
      await flushPromises();
    }
    await submit('test');
    expect(client.post).not.toHaveBeenCalled();
  },
);

it.each(['manual', 'test'] as const)(
  '%s window closes on same-UID epoch change without issuing a request',
  async (kind) => {
    await start();
    await action(kind === 'manual' ? '手动发送' : '测试发送');
    await fill(kind);
    const reads = client.get.mock.calls.length;
    session.generation += 1;
    await flushPromises();
    expect(exists(kind)).toBe(false);
    expect(client.get).toHaveBeenCalledTimes(reads);
    expect(client.post).not.toHaveBeenCalled();
  },
);

for (const kind of ['manual', 'test'] as const) {
  it.each(['resolve', 'reject'])(
    `${kind}: stale send receipt cannot clear a newer window or its busy flag: %s`,
    async (outcome) => {
      await start([record(7), record(8)]);
      await action(kind === 'manual' ? '手动发送' : '测试发送', 0);
      await fill(kind);
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      client.post
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      await submit(kind);
      session.generation += 1;
      await flushPromises();
      await action(kind === 'manual' ? '手动发送' : '测试发送', 1);
      await fill(kind, 'fresh@example.test');
      await submit(kind);
      if (outcome === 'resolve') first.resolve({});
      else first.reject(new Error('old delivery failure'));
      await flushPromises();
      expect(dialog(kind).attributes('data-busy')).toBe('true');
      expect(message.success).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      second.resolve({});
      await flushPromises();
      expect(exists(kind)).toBe(false);
      expect(message.success).toHaveBeenCalledOnce();
    },
  );
  it(`${kind}: permission loss invalidates a prepared request`, async () => {
    await start();
    await action(kind === 'manual' ? '手动发送' : '测试发送');
    await fill(kind);
    permissions[kind] = false;
    await flushPromises();
    expect(exists(kind)).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  });
  it(`${kind}: unmount ignores the pending API result`, async () => {
    await start();
    await action(kind === 'manual' ? '手动发送' : '测试发送');
    await fill(kind);
    const pending = deferred<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    await submit(kind);
    required(wrapper).unmount();
    pending.resolve({});
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  });
}

it('manual sending executes the real form validator and preserves unexpanded template variables', async () => {
  await start();
  await action('手动发送');
  await fill('manual', ' safe@example.test ');
  await submit('manual');
  expect(validation).toHaveBeenCalledOnce();
  expect(client.post).toHaveBeenCalledWith('/workorder/notification/send', {
    channels: ['email'],
    content: '原始通知 {title}/{recipient_name}',
    recipient: 'safe@example.test',
    subject: '原始主题 {title}',
  });
  const payload = required(client.post.mock.calls[0])[1];
  expect(payload).not.toHaveProperty('notification_id');
  expect(exists('manual')).toBe(false);
});

it('manual sending fails closed without a form validation method', async () => {
  settings.missingValidate = true;
  await start();
  await action('手动发送');
  await fill('manual');
  await submit('manual');
  expect(client.post).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalledWith('发送表单尚未就绪，请稍后重试');
});

it('manual sending honors real Ant Design email validation without contacting a sender', async () => {
  await start([record()], true);
  await action('手动发送');
  await fill('manual', 'not-an-email');
  await submit('manual');
  await vi.waitFor(() =>
    expect(
      dialog('manual')
        .findAll('.ant-form-item-explain-error')
        .some((item) => item.text().includes('有效的邮箱')),
    ).toBe(true),
  );
  expect(client.post).not.toHaveBeenCalled();
});

it.each(['recipient', 'channels', 'close-reopen', 'owner'])(
  'manual validation does not dispatch after %s changes',
  async (change) => {
    await start();
    await action('手动发送');
    await fill('manual');
    const pending = deferred<unknown>();
    validation.mockReturnValueOnce(pending.promise);
    await submit('manual');
    if (change === 'recipient') await fill('manual', 'changed@example.test');
    if (change === 'channels')
      required(required(wrapper).findAllComponents(Group)[0]).vm.$emit(
        'update:value',
        ['feishu'],
      );
    if (change === 'owner') session.uid = '2';
    if (change === 'close-reopen') {
      await dialog('manual').get('[data-close]').trigger('click');
      await action('手动发送');
      await fill('manual');
    }
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  },
);

it('an older manual validation cannot release the newer window validation lock', async () => {
  await start();
  await action('手动发送');
  await fill('manual');
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  validation
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await submit('manual');
  await dialog('manual').get('[data-close]').trigger('click');
  await action('手动发送');
  await fill('manual');
  await submit('manual');
  first.resolve({});
  await flushPromises();
  await submit('manual');
  expect(validation).toHaveBeenCalledTimes(2);
  expect(client.post).not.toHaveBeenCalled();
  second.resolve({});
  await flushPromises();
  expect(client.post).toHaveBeenCalledOnce();
});

it('manual API payload is detached from edits made while sending and cannot hide edited content', async () => {
  await start();
  await action('手动发送');
  await fill('manual');
  const pending = deferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  await submit('manual');
  const payload = required(client.post.mock.calls[0])[1];
  required(required(wrapper).findAllComponents(Group)[0]).vm.$emit(
    'update:value',
    ['feishu'],
  );
  await dialog('manual').get('textarea').setValue('new unsent content');
  pending.resolve({});
  await flushPromises();
  expect(payload.channels).toEqual(['email']);
  expect(payload.content).toBe('原始通知 {title}/{recipient_name}');
  expect(exists('manual')).toBe(true);
  expect(message.success).not.toHaveBeenCalled();
});

it('status updates keep the narrow status-only API body and are single-flight per ID', async () => {
  await start();
  const pending = deferred<unknown>();
  client.put.mockReturnValueOnce(pending.promise);
  await toggle(true);
  await toggle(false);
  expect(client.put).toHaveBeenCalledOnce();
  expect(client.put).toHaveBeenCalledWith('/workorder/notification/update/7', {
    status: 1,
  });
  client.get.mockResolvedValue({
    total: 1,
    items: [{ ...record(), status: 1 }],
  });
  pending.resolve({});
  await flushPromises();
  expect(statusSwitch().props('checked')).toBe(true);
  expect(statusSwitch().props('loading')).toBe(false);
  const payload = required(client.put.mock.calls[0])[1];
  expect(payload).not.toHaveProperty('clear_trigger');
  expect(payload).not.toHaveProperty('trigger_type');
});

it.each([undefined, null, 0, -1, 1.5, Number.NaN, '7'])(
  'invalid status ID %s does not create an update',
  async (id) => {
    await start([{ ...record(), id }]);
    await toggle(true);
    expect(client.put).not.toHaveBeenCalled();
  },
);

it('status updates reject nonboolean values and a missing update permission', async () => {
  await start();
  await toggle('true');
  expect(client.put).not.toHaveBeenCalled();
  permissions.status = false;
  await flushPromises();
  await toggle(true);
  expect(client.put).not.toHaveBeenCalled();
});

it.each(['resolve', 'reject'])(
  'old status completion cannot clear a new same-ID actor ticket: %s',
  async (outcome) => {
    await start();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    client.put
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await toggle(true);
    session.uid = '2';
    await flushPromises();
    await toggle(true);
    expect(client.put).toHaveBeenCalledTimes(2);
    if (outcome === 'resolve') first.resolve({});
    else first.reject(new Error('old status failure'));
    await flushPromises();
    expect(statusSwitch().props('loading')).toBe(true);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    second.resolve({});
    await flushPromises();
    expect(statusSwitch().props('loading')).toBe(false);
    expect(message.success).toHaveBeenCalledOnce();
  },
);

it.each(['list', 'detail', 'permission'])(
  'status completion is scoped to its original %s context',
  async (change) => {
    await start([record(7), record(8)]);
    const pending = deferred<unknown>();
    client.put.mockReturnValueOnce(pending.promise);
    await toggle(true);
    if (change === 'list') {
      await required(wrapper)
        .get('.search-input .ant-input-search-button')
        .trigger('click');
      await flushPromises();
    }
    if (change === 'detail') await action('查看', 1);
    if (change === 'permission') {
      permissions.status = false;
      await flushPromises();
    }
    const reads = client.get.mock.calls.length;
    pending.resolve({});
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(reads);
  },
);

it.each(['manual', 'test'] as const)(
  '%s receipts stay obsolete after UID A→B→A even without a counter increment',
  async (kind) => {
    await start();
    await action(kind === 'manual' ? '手动发送' : '测试发送');
    await fill(kind);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    client.post
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await submit(kind);
    session.uid = '2';
    await flushPromises();
    session.uid = '1';
    await flushPromises();
    await action(kind === 'manual' ? '手动发送' : '测试发送');
    await fill(kind);
    await submit(kind);
    first.resolve({});
    await flushPromises();
    expect(dialog(kind).attributes('data-busy')).toBe('true');
    expect(message.success).not.toHaveBeenCalled();
    second.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledOnce();
  },
);

it('status action tickets stay distinct across UID A→B→A with the same visible row', async () => {
  await start();
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  client.put
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await toggle(true);
  session.uid = '2';
  await flushPromises();
  session.uid = '1';
  await flushPromises();
  await toggle(true);
  first.resolve({});
  await flushPromises();
  expect(statusSwitch().props('loading')).toBe(true);
  expect(message.success).not.toHaveBeenCalled();
  second.resolve({});
  await flushPromises();
  expect(statusSwitch().props('loading')).toBe(false);
  expect(message.success).toHaveBeenCalledOnce();
});

it('test sending refuses a channel removed from its captured configuration', async () => {
  await start();
  await action('测试发送');
  await fill('test');
  const target = currentRow();
  if (!('channels' in target) || !Array.isArray(target.channels))
    throw new Error('Missing configured channel fixture');
  target.channels.splice(0, target.channels.length);
  await submit('test');
  expect(client.post).not.toHaveBeenCalled();
});

it('a detail status receipt does not change a closed and reopened same-ID detail', async () => {
  await start();
  await action('查看');
  const detail = required(wrapper).get('[data-dialog="通知配置详情"]');
  const control = required(
    required(wrapper)
      .findAllComponents({ name: 'ASwitch' })
      .find((item) => detail.element.contains(item.element)),
  );
  const pending = deferred<unknown>();
  client.put.mockReturnValueOnce(pending.promise);
  control.vm.$emit('change', true);
  await flushPromises();
  await detail.get('[data-close]').trigger('click');
  await action('查看');
  const reads = client.get.mock.calls.length;
  pending.resolve({});
  await flushPromises();
  expect(message.success).not.toHaveBeenCalled();
  expect(client.get).toHaveBeenCalledTimes(reads);
  const freshDetail = required(wrapper).get('[data-dialog="通知配置详情"]');
  const fresh = required(
    required(wrapper)
      .findAllComponents({ name: 'ASwitch' })
      .find((item) => freshDetail.element.contains(item.element)),
  );
  expect(fresh.props('checked')).toBe(false);
  expect(fresh.props('loading')).toBe(false);
});
