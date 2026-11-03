import type { Notification as NotificationRecord } from '#/api/core/workorder/workorder_notification';

import { defineComponent, h } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Notification from './Notification.vue';

const context = vi.hoisted(() => ({
  allowed: true,
  generation: 0,
  missingSchedule: false,
  missingValidate: false,
  uid: '1',
}));
const validate = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: context.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => context.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: (permission: string) =>
      permission !== 'workorder.notification.delete' || context.allowed,
    hasPerm: () => true,
  }),
}));
vi.mock('./notification-schedule', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./notification-schedule')>();
  return {
    ...actual,
    buildNotificationSchedule: (
      ...args: Parameters<typeof actual.buildNotificationSchedule>
    ) =>
      context.missingSchedule
        ? undefined
        : actual.buildNotificationSchedule(...args),
  };
});

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected notification safety fixture');
  return value;
}
function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
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
                { 'data-save': '', onClick: () => emit('ok') },
                'save',
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
const Group = defineComponent({
  emits: ['update:value'],
  props: ['value'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const RadioGroup = defineComponent({
  emits: ['update:value'],
  props: ['value'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const NumberInput = defineComponent({
  emits: ['update:value'],
  props: ['value', 'id'],
  setup: (props) => () => h('div', { 'data-number': props.id }),
});
const Form = defineComponent({
  props: ['model'],
  setup: (_, { expose, slots }) => {
    expose({
      resetFields: () => {},
      ...(context.missingValidate ? {} : { validate: () => validate() }),
    });
    return () => h('div', slots.default?.());
  },
});

const record = (id: unknown = 7, name = 'owned notification') => ({
  channels: ['email'],
  created_at: '',
  description: '',
  event_types: ['instance_created'],
  id,
  is_default: 2,
  max_retries: 3,
  message_template: 'owned notice {title}',
  name,
  operator_id: 1,
  priority: 2,
  recipient_types: ['creator'],
  retry_interval: 5,
  status: 2,
  trigger_type: 'immediate',
  trigger_version: 1,
  updated_at: '',
});
let wrapper: undefined | VueWrapper;
const loadingCloses: Array<ReturnType<typeof vi.fn>> = [];
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(context, {
    allowed: true,
    generation: 0,
    missingSchedule: false,
    missingValidate: false,
    uid: '1',
  });
  loadingCloses.length = 0;
  validate.mockImplementation(() => Promise.resolve());
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
  vi.spyOn(Modal, 'confirm').mockReturnValue({
    destroy: vi.fn(),
    update: vi.fn(),
  });
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  const originalLoading = message.loading.bind(message);
  vi.spyOn(message, 'loading').mockImplementation((...args) => {
    const actual = originalLoading(...args);
    const close = vi.fn(() => actual());
    loadingCloses.push(close);
    return new Proxy(actual, { apply: () => close() });
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
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type NotificationFixture = Pick<NotificationRecord, 'scheduled_time'> &
  ReturnType<typeof record>;
async function start(rows: NotificationFixture[] = [record()]) {
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
        ACheckboxGroup: Group,
        ADropdown: Dropdown,
        AForm: Form,
        AFormItem: Passthrough,
        AInputNumber: NumberInput,
        AModal: Dialog,
        ARadioGroup: RadioGroup,
        ATable: Table,
        ATooltip: Passthrough,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
async function action(label: string, row = 0) {
  const control = required(wrapper)
    .get(`[data-row="${row}"]`)
    .findAll('button, [role="menuitem"]')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  await required(control).trigger('click');
  await flushPromises();
}
function confirmation() {
  return required(required(vi.mocked(Modal.confirm).mock.calls.at(-1))[0].onOk);
}
function formDialog(edit = false) {
  return required(wrapper).get(
    `[data-dialog="${edit ? '编辑通知配置' : '创建通知配置'}"]`,
  );
}
function group(kind: 'channels' | 'events' | 'recipients') {
  const indexes = { channels: 1, events: 0, recipients: 2 };
  return required(required(wrapper).findAllComponents(Group)[indexes[kind]]);
}
async function create() {
  await required(wrapper).get('[aria-label="创建通知配置"]').trigger('click');
  await flushPromises();
  await formDialog()
    .get('input[placeholder="请输入通知配置名称"]')
    .setValue('owned config');
  group('channels').vm.$emit('update:value', ['email']);
  await flushPromises();
}
async function save(edit = false) {
  await formDialog(edit).get('[data-save]').trigger('click');
  await flushPromises();
}

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
])('rejects invalid deletion identifiers: %s', async (id) => {
  const row = { ...record(), id };
  await start([row]);
  await action('删除');
  expect(Modal.confirm).not.toHaveBeenCalled();
  expect(client.delete).not.toHaveBeenCalled();
});

it('deletes the captured identifier with the established JSON body exactly once', async () => {
  await start();
  await action('删除');
  const onOk = confirmation();
  const pending = deferred<unknown>();
  client.delete.mockReturnValueOnce(pending.promise);
  const first = onOk();
  await onOk();
  expect(client.delete).toHaveBeenCalledOnce();
  expect(client.delete).toHaveBeenCalledWith(
    '/workorder/notification/delete/7',
    { data: { id: 7 } },
  );
  pending.resolve({});
  await first;
  await onOk();
  expect(client.delete).toHaveBeenCalledOnce();
  expect(required(loadingCloses[0])).toHaveBeenCalledOnce();
});

it.each([
  'owner',
  'same-user-login',
  'list',
  'permission',
  'target',
  'create',
  'detail',
  'unmount',
])(
  'invalidates an old deletion confirmation after %s changes',
  async (change) => {
    const row = record();
    await start([row]);
    await action('删除');
    const onOk = confirmation();
    if (change === 'owner') context.uid = '2';
    if (change === 'same-user-login') context.generation += 1;
    if (change === 'permission') context.allowed = false;
    if (change === 'list') {
      await required(wrapper)
        .get('.search-input .ant-input-search-button')
        .trigger('click');
      await flushPromises();
    }
    if (change === 'target') {
      const tableRows = required(
        required(wrapper).getComponent(Table).props('dataSource'),
      );
      const target = required(tableRows[0]);
      if (typeof target !== 'object' || target === null || !('id' in target))
        throw new Error('Missing notification row identity');
      target.id = 8;
    }
    if (change === 'create') await create();
    if (change === 'detail') await action('查看');
    if (change === 'unmount') required(wrapper).unmount();
    await onOk();
    expect(client.delete).not.toHaveBeenCalled();
  },
);

it.each(['resolve', 'reject'])(
  'ignores an old-owner deletion completion and closes only its own loading: %s',
  async (outcome) => {
    await start([record(7), record(8)]);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    client.delete
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await action('删除', 0);
    const old = confirmation()();
    context.generation += 1;
    await action('删除', 1);
    const fresh = confirmation()();
    if (outcome === 'resolve') first.resolve({});
    else first.reject(new Error('old deletion failure'));
    await old;
    expect(required(loadingCloses[0])).toHaveBeenCalledOnce();
    expect(required(loadingCloses[1])).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    second.resolve({});
    await fresh;
    expect(required(loadingCloses[1])).toHaveBeenCalledOnce();
    expect(message.success).toHaveBeenCalledOnce();
  },
);

it('does not submit when the actual form instance has no validation method', async () => {
  context.missingValidate = true;
  await start();
  await create();
  await save();
  expect(client.post).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalledWith('表单尚未就绪，请稍后重试');
});

it.each(['owner', 'same-user-login', 'fields', 'close-reopen'])(
  'does not borrow changed configuration state after validation: %s',
  async (change) => {
    await start();
    await create();
    const pending = deferred<unknown>();
    validate.mockReturnValueOnce(pending.promise);
    await formDialog().get('[data-save]').trigger('click');
    if (change === 'owner') context.uid = '2';
    if (change === 'same-user-login') context.generation += 1;
    if (change === 'fields')
      group('channels').vm.$emit('update:value', ['feishu']);
    if (change === 'close-reopen') {
      await formDialog().get('[data-close]').trigger('click');
      await create();
    }
    pending.resolve({});
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  },
);

it('allows only one validation and write per active submission', async () => {
  await start();
  await create();
  const check = deferred<unknown>();
  const write = deferred<unknown>();
  validate.mockReturnValueOnce(check.promise);
  client.post.mockReturnValueOnce(write.promise);
  await formDialog().get('[data-save]').trigger('click');
  await formDialog().get('[data-save]').trigger('click');
  expect(validate).toHaveBeenCalledOnce();
  check.resolve({});
  await flushPromises();
  await save();
  expect(client.post).toHaveBeenCalledOnce();
  write.resolve({});
  await flushPromises();
});

it('does not let an old validation clear the new window validation lock', async () => {
  await start();
  await create();
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  validate
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await formDialog().get('[data-save]').trigger('click');
  await formDialog().get('[data-close]').trigger('click');
  await create();
  await formDialog().get('[data-save]').trigger('click');
  first.resolve({});
  await flushPromises();
  await formDialog().get('[data-save]').trigger('click');
  expect(validate).toHaveBeenCalledTimes(2);
  expect(client.post).not.toHaveBeenCalled();
  second.resolve({});
  await flushPromises();
  expect(client.post).toHaveBeenCalledOnce();
});

it('rejects a missing validated schedule instead of defaulting an incomplete creation', async () => {
  context.missingSchedule = true;
  await start();
  await create();
  await save();
  expect(client.post).not.toHaveBeenCalled();
  expect(message.error).toHaveBeenCalledWith('通知触发配置无效，请重新确认');
});

it('keeps creation disabled and snapshots the validated arrays sent to the API', async () => {
  await start();
  await create();
  const pending = deferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  await save();
  const payload = required(client.post.mock.calls[0])[1];
  expect(payload).toMatchObject({
    channels: ['email'],
    recipient_types: ['creator'],
    status: 2,
    trigger_type: 'immediate',
  });
  group('channels').vm.$emit('update:value', ['feishu']);
  group('events').vm.$emit('update:value', ['instance_updated']);
  await flushPromises();
  expect(payload.channels).toEqual(['email']);
  expect(payload.event_types).toEqual([
    'instance_created',
    'instance_submitted',
  ]);
  pending.resolve({});
  await flushPromises();
  expect(message.success).not.toHaveBeenCalled();
});

it('sends changed delayed schedules with the established clear_trigger marker', async () => {
  await start();
  await action('编辑');
  required(required(wrapper).findAllComponents(RadioGroup)[0]).vm.$emit(
    'update:value',
    'delayed',
  );
  await flushPromises();
  const delay = required(
    required(wrapper)
      .findAllComponents(NumberInput)
      .find((item) => item.props('id') === 'notification-delay-minutes'),
  );
  delay.vm.$emit('update:value', 5);
  await flushPromises();
  await save(true);
  expect(client.put).toHaveBeenCalledWith(
    '/workorder/notification/update/7',
    expect.objectContaining({
      clear_trigger: true,
      delay_minutes: 5,
      trigger_type: 'delayed',
    }),
  );
});

it('omits unchanged scheduling and status fields from a legacy advanced update', async () => {
  await start([
    {
      ...record(),
      scheduled_time: '2030-01-01T00:00:00Z',
      status: 1,
      trigger_type: 'scheduled',
      trigger_version: 0,
    },
  ]);
  await action('编辑');
  await save(true);
  const payload = required(client.put.mock.calls[0])[1];
  expect(payload).not.toHaveProperty('clear_trigger');
  expect(payload).not.toHaveProperty('scheduled_time');
  expect(payload).not.toHaveProperty('trigger_type');
  expect(payload).not.toHaveProperty('status');
});

it.each(['resolve', 'reject'])(
  'ignores a stale save result after same-UID reauthentication: %s',
  async (outcome) => {
    await start();
    await create();
    const pending = deferred<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    await save();
    const reads = client.get.mock.calls.length;
    context.generation += 1;
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('old save failure'));
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(reads);
    expect(formDialog().attributes('data-busy')).toBe('false');
  },
);

it.each(['create', 'edit'])(
  'does not open an old detail over a newer %s window',
  async (mode) => {
    const first = record(7, 'detail A');
    const second = record(8, 'edit B');
    await start([first, second]);
    const pending = deferred<unknown>();
    client.get.mockReturnValueOnce(pending.promise);
    await action('查看', 0);
    await (mode === 'create' ? create() : action('编辑', 1));
    pending.resolve(first);
    await flushPromises();
    expect(
      required(wrapper).find('[data-dialog="通知配置详情"]').exists(),
    ).toBe(false);
    expect(formDialog(mode === 'edit').element.isConnected).toBe(true);
  },
);

it('refuses mismatched detail data and does not expose an old-owner detail result', async () => {
  await start();
  client.get.mockResolvedValueOnce(record(8));
  await action('查看');
  expect(required(wrapper).find('[data-dialog="通知配置详情"]').exists()).toBe(
    false,
  );
  vi.mocked(message.error).mockClear();
  const pending = deferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await action('查看');
  context.generation += 1;
  pending.resolve(record());
  await flushPromises();
  expect(required(wrapper).find('[data-dialog="通知配置详情"]').exists()).toBe(
    false,
  );
  expect(message.error).not.toHaveBeenCalled();
});

it('does not silently omit a changed schedule marker when validation returns no payload', async () => {
  context.missingSchedule = true;
  await start();
  await action('编辑');
  required(required(wrapper).findAllComponents(RadioGroup)[0]).vm.$emit(
    'update:value',
    'delayed',
  );
  await flushPromises();
  const delay = required(
    required(wrapper)
      .findAllComponents(NumberInput)
      .find((item) => item.props('id') === 'notification-delay-minutes'),
  );
  delay.vm.$emit('update:value', 5);
  await flushPromises();
  await save(true);
  expect(client.put).not.toHaveBeenCalled();
  expect(message.error).toHaveBeenCalledWith('通知触发配置无效，请重新确认');
});
