import { defineComponent, h, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import MonitorAlertEvent from './MonitorAlertEvent.vue';
import MonitorAlertRecord from './MonitorAlertRecord.vue';

const owner = vi.hoisted(() => ({ generation: 0, id: 1 }));
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
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required action test fixture is unavailable');
  return value;
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    reject(reason: unknown) {
      required(rejectPromise)(reason);
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
    loading: Boolean,
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { 'data-table-loading': String(props.loading) },
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
  emits: ['cancel'],
  props: { open: Boolean, title: String },
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h('section', { 'data-dialog': props.title }, [
            h(
              'button',
              { 'data-close-dialog': '', onClick: () => emit('cancel') },
              'close',
            ),
            slots.default?.(),
            slots.footer?.(),
          ])
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

let wrapper: undefined | VueWrapper;
const row = (id?: number, name = 'owned rule') => ({
  alert_name: name,
  create_user_name: 'local fixture',
  enable: 2,
  event_times: 1,
  expr: 'up',
  fingerprint: 'fixture',
  id,
  ip_address: '127.0.0.1:9090',
  labels: [],
  name,
  pool_id: 1,
  rule_id: 1,
  send_group_id: 1,
  status: 1,
  user_id: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  owner.id = 1;
  owner.generation = 0;
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
  kind: 'events' | 'records',
  rows: ReturnType<typeof row>[],
) {
  const path =
    kind === 'events'
      ? '/monitor/alert_events/list'
      : '/monitor/record_rules/list';
  client.get.mockImplementation((url: string) =>
    Promise.resolve(
      url === path
        ? { total: rows.length, items: rows }
        : { total: 0, items: [] },
    ),
  );
  wrapper = mount(kind === 'events' ? MonitorAlertEvent : MonitorAlertRecord, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        ADropdown: Dropdown,
        AModal: Dialog,
        ATable: Table,
        ATooltip: Passthrough,
        Icon: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
function tableRow(index = 0) {
  return required(wrapper).get(`[data-row-index="${index}"]`);
}
async function recordAction(label: string, index = 0) {
  const control = tableRow(index)
    .findAll('button, [role="menuitem"]')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  await required(control).trigger('click');
  await flushPromises();
}
async function eventAction(icon = 'mdi:bell-off-outline', index = 0) {
  const title =
    icon === 'mdi:hand-back-right-outline' ? '认领告警' : '屏蔽告警';
  const button = tableRow(index).get(`[title="${title}"] button`).element;
  if (!(button instanceof HTMLElement))
    throw new Error('Missing event action button');
  button.click();
  await flushPromises();
}
function confirm() {
  return required(required(vi.mocked(Modal.confirm).mock.calls.at(-1))[0].onOk);
}
function detail() {
  return required(wrapper).find('[data-dialog="记录规则详情"]');
}

it.each([
  undefined,
  0,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
])('rejects invalid event identifiers before confirmation: %s', async (id) => {
  await mountPage('events', [row(id)]);
  await eventAction();
  expect(Modal.confirm).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalled();
});

it.each(['查看', '启用', '删除'])(
  'rejects missing record identifiers before %s',
  async (action) => {
    await mountPage('records', [row()]);
    const initialReads = client.get.mock.calls.length;
    await recordAction(action);
    expect(client.get).toHaveBeenCalledTimes(initialReads);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
    expect(Modal.confirm).not.toHaveBeenCalled();
  },
);

it.each(['mdi:bell-off-outline', 'mdi:hand-back-right-outline'])(
  'does not borrow a new session for an old event confirmation: %s',
  async (icon) => {
    await mountPage('events', [row(7)]);
    await eventAction(icon);
    owner.generation += 1;
    await confirm()();
    expect(client.post).not.toHaveBeenCalled();
  },
);

it('does not send an old event confirmation after its row identifier changed', async () => {
  const record = row(7);
  await mountPage('events', [record]);
  await eventAction();
  record.id = 8;
  await confirm()();
  expect(client.post).not.toHaveBeenCalled();
});

it('keeps fresh list loading after a successful event mutation', async () => {
  await mountPage('events', [row(7)]);
  const refresh = deferred<unknown>();
  client.get.mockReturnValue(refresh.promise);
  await eventAction();
  await confirm()();
  await flushPromises();
  expect(client.post).toHaveBeenCalledWith('/monitor/alert_events/silence/7', {
    time: '2h',
    use_name: undefined,
  });
  expect(
    required(wrapper)
      .get('[data-table-loading]')
      .attributes('data-table-loading'),
  ).toBe('true');
  refresh.resolve({ total: 0, items: [] });
  await flushPromises();
  expect(
    required(wrapper)
      .get('[data-table-loading]')
      .attributes('data-table-loading'),
  ).toBe('false');
});

it.each(['resolve', 'reject'])(
  'ignores an event mutation completion after an account switch: %s',
  async (outcome) => {
    await mountPage('events', [row(7)]);
    const pending = deferred<unknown>();
    client.post.mockReturnValue(pending.promise);
    await eventAction();
    const operation = confirm()();
    owner.id = 2;
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('old owner failure'));
    await operation;
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(1);
  },
);

it('refuses an old record deletion confirmation after same-UID login generation changed', async () => {
  await mountPage('records', [row(7)]);
  await recordAction('删除');
  owner.generation += 1;
  await confirm()();
  expect(client.delete).not.toHaveBeenCalled();
});

it('does not let detail A overwrite detail B', async () => {
  const a = row(7, 'rule A');
  const b = row(8, 'rule B');
  await mountPage('records', [a, b]);
  const readA = deferred<unknown>();
  const readB = deferred<unknown>();
  client.get.mockImplementation((path: string) =>
    path.endsWith('/7') ? readA.promise : readB.promise,
  );
  await recordAction('查看', 0);
  await recordAction('查看', 1);
  readB.resolve(b);
  await flushPromises();
  expect(detail().text()).toContain('rule B');
  readA.resolve(a);
  await flushPromises();
  expect(detail().text()).toContain('rule B');
});

it('ignores a detail response after closing an earlier open window', async () => {
  const a = row(7, 'rule A');
  await mountPage('records', [a]);
  client.get.mockResolvedValue(a);
  await recordAction('查看');
  const read = deferred<unknown>();
  client.get.mockReturnValue(read.promise);
  await recordAction('查看');
  await detail().get('[data-close-dialog]').trigger('click');
  read.resolve(a);
  await flushPromises();
  expect(detail().exists()).toBe(false);
});

it('does not enable newly opened detail B when enabling A completes', async () => {
  const a = row(7, 'rule A');
  const b = row(8, 'rule B');
  await mountPage('records', [a, b]);
  client.get.mockImplementation((path: string) =>
    Promise.resolve(path.endsWith('/8') ? b : a),
  );
  await recordAction('查看', 0);
  const update = deferred<unknown>();
  client.put.mockReturnValue(update.promise);
  await recordAction('启用', 0);
  await recordAction('查看', 1);
  update.resolve({});
  await flushPromises();
  expect(detail().text()).toContain('rule B');
  expect(
    detail()
      .findAll('.ant-tag')
      .some((tag) => tag.text() === '已禁用'),
  ).toBe(true);
});

it('keeps a reopened same-record detail isolated from an older mutation', async () => {
  const record = row(7);
  await mountPage('records', [record]);
  client.get.mockResolvedValue({ ...record });
  await recordAction('查看');
  const update = deferred<unknown>();
  client.put.mockReturnValue(update.promise);
  await recordAction('启用');
  await detail().get('[data-close-dialog]').trigger('click');
  await recordAction('查看');
  update.resolve({});
  await flushPromises();
  expect(
    detail()
      .findAll('.ant-tag')
      .some((tag) => tag.text() === '已禁用'),
  ).toBe(true);
});

it.each(['resolve', 'reject'])(
  'ignores a record mutation receipt after same-UID reauthentication: %s',
  async (outcome) => {
    await mountPage('records', [row(7)]);
    const update = deferred<unknown>();
    client.put.mockReturnValue(update.promise);
    await recordAction('启用');
    owner.generation += 1;
    if (outcome === 'resolve') update.resolve({});
    else update.reject(new Error('old generation failure'));
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  },
);

it('refuses mutation when the authenticated user identifier is missing', async () => {
  await mountPage('events', [row(7)]);
  owner.id = 0;
  await eventAction();
  expect(Modal.confirm).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});

it('keeps a newly opened event detail when an older detail action completes', async () => {
  await mountPage('events', [row(7, 'event A'), row(8, 'event B')]);
  await recordAction('查看详情', 0);
  const pending = deferred<unknown>();
  client.post.mockReturnValue(pending.promise);
  await eventAction();
  const operation = confirm()();
  await required(wrapper)
    .get('[data-dialog="告警事件详情"] [data-close-dialog]')
    .trigger('click');
  await recordAction('查看详情', 1);
  pending.resolve({});
  await operation;
  await flushPromises();
  expect(
    required(wrapper).get('[data-dialog="告警事件详情"]').text(),
  ).toContain('event B');
  expect(message.success).not.toHaveBeenCalled();
});

it('does not send an old detail confirmation after closing and reopening the same event', async () => {
  await mountPage('events', [row(7)]);
  await recordAction('查看详情');
  await eventAction();
  await required(wrapper)
    .get('[data-dialog="告警事件详情"] [data-close-dialog]')
    .trigger('click');
  await recordAction('查看详情');
  await confirm()();
  expect(client.post).not.toHaveBeenCalled();
});

it('preserves successful cancellation-of-silence endpoint behavior', async () => {
  await mountPage('events', [row(7)]);
  await recordAction('取消屏蔽');
  await confirm()();
  expect(client.post).toHaveBeenCalledOnce();
  expect(client.post).toHaveBeenCalledWith('/monitor/alert_events/unsilence/7');
  expect(message.success).toHaveBeenCalledWith(
    '取消屏蔽告警 "owned rule" 成功',
  );
});

it('reports a current event failure and suppresses an aborted request', async () => {
  await mountPage('events', [row(7)]);
  client.post.mockRejectedValueOnce(new Error('local mutation failed'));
  await eventAction();
  await confirm()();
  expect(message.error).toHaveBeenCalledWith('local mutation failed');
  vi.mocked(message.error).mockClear();
  client.post.mockRejectedValueOnce(
    new DOMException('cancelled', 'AbortError'),
  );
  await eventAction();
  await confirm()();
  expect(message.error).not.toHaveBeenCalled();
});

it('rejects mismatched record detail identifiers rather than opening another record', async () => {
  await mountPage('records', [row(7)]);
  client.get.mockResolvedValue(row(8));
  await recordAction('查看');
  expect(detail().exists()).toBe(false);
  expect(message.error).toHaveBeenCalledWith(
    '记录规则详情标识无效，请刷新后重试',
  );
});

it.each(['resolve', 'reject'])(
  'does not reopen or notify a superseded record detail: %s',
  async (outcome) => {
    const a = row(7, 'rule A');
    const b = row(8, 'rule B');
    await mountPage('records', [a, b]);
    const readA = deferred<unknown>();
    client.get.mockImplementation((path: string) =>
      path.endsWith('/7') ? readA.promise : Promise.resolve(b),
    );
    await recordAction('查看', 0);
    await recordAction('查看', 1);
    if (outcome === 'resolve') readA.resolve(a);
    else readA.reject(new Error('old detail failure'));
    await flushPromises();
    expect(detail().text()).toContain('rule B');
    expect(message.error).not.toHaveBeenCalled();
  },
);

it('ignores a detail response after same-UID reauthentication', async () => {
  await mountPage('records', [row(7)]);
  const read = deferred<unknown>();
  client.get.mockReturnValue(read.promise);
  await recordAction('查看');
  owner.generation += 1;
  read.resolve(row(7));
  await flushPromises();
  expect(detail().exists()).toBe(false);
  expect(message.error).not.toHaveBeenCalled();
});

it.each(['latest-first', 'earlier-first'])(
  'keeps the current record response when mutation cleanup finishes in %s order',
  async (order) => {
    const record = reactive(row(7));
    await mountPage('records', [record]);
    client.get.mockResolvedValue({ ...record });
    await recordAction('查看');
    const earlier = deferred<unknown>();
    const latest = deferred<unknown>();
    client.put
      .mockReturnValueOnce(earlier.promise)
      .mockReturnValueOnce(latest.promise);
    await recordAction('启用');
    record.enable = 1;
    await flushPromises();
    await recordAction('禁用');
    if (order === 'earlier-first') {
      earlier.resolve({});
      await flushPromises();
      expect(message.success).not.toHaveBeenCalled();
    }
    latest.resolve({});
    await flushPromises();
    if (order === 'latest-first') {
      earlier.resolve({});
      await flushPromises();
    }
    expect(
      detail()
        .findAll('.ant-tag')
        .some((tag) => tag.text() === '已禁用'),
    ).toBe(true);
    expect(message.success).toHaveBeenCalledTimes(1);
    expect(message.error).not.toHaveBeenCalled();
  },
);

it.each(['resolve', 'reject'])(
  'ignores a record deletion receipt after account change: %s',
  async (outcome) => {
    await mountPage('records', [row(7)]);
    const pending = deferred<unknown>();
    client.delete.mockReturnValue(pending.promise);
    await recordAction('删除');
    const operation = confirm()();
    const reads = client.get.mock.calls.length;
    owner.id = 2;
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('old deletion failure'));
    await operation;
    expect(client.get).toHaveBeenCalledTimes(reads);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
  },
);

it.each(['resolve', 'reject'])(
  'consumes an event confirmation once across pending and completed calls: %s',
  async (outcome) => {
    await mountPage('events', [row(7)]);
    const pending = deferred<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    await eventAction();
    const onOk = confirm();
    const first = onOk();
    await onOk();
    expect(client.post).toHaveBeenCalledTimes(1);
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('local event failure'));
    await first;
    await onOk();
    expect(client.post).toHaveBeenCalledTimes(1);
    await flushPromises();
    await eventAction();
    await confirm()();
    expect(client.post).toHaveBeenCalledTimes(2);
  },
);

it.each(['resolve', 'reject'])(
  'consumes a deletion confirmation once across pending and completed calls: %s',
  async (outcome) => {
    const record = row(7);
    await mountPage('records', [record]);
    const pending = deferred<unknown>();
    client.delete.mockReturnValueOnce(pending.promise);
    await recordAction('删除');
    const onOk = confirm();
    const first = onOk();
    await onOk();
    expect(client.delete).toHaveBeenCalledTimes(1);
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('local deletion failure'));
    await first;
    await onOk();
    expect(client.delete).toHaveBeenCalledTimes(1);
  },
);

it.each(['latest-first', 'earlier-first'])(
  'keeps the newest event receipt when mutation cleanup finishes in %s order',
  async (order) => {
    await mountPage('events', [row(7)]);
    const earlier = deferred<unknown>();
    const latest = deferred<unknown>();
    client.post
      .mockReturnValueOnce(earlier.promise)
      .mockReturnValueOnce(latest.promise);
    await eventAction();
    const first = confirm()();
    await eventAction('mdi:hand-back-right-outline');
    const second = confirm()();
    if (order === 'earlier-first') {
      earlier.resolve({});
      await first;
      expect(message.success).not.toHaveBeenCalled();
    }
    latest.resolve({});
    await second;
    if (order === 'latest-first') {
      earlier.resolve({});
      await first;
    }
    expect(message.success).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith('认领告警 "owned rule" 成功');
    expect(message.error).not.toHaveBeenCalled();
  },
);
