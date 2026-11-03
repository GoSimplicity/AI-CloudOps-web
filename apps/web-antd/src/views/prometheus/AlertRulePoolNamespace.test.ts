import { defineComponent, h, type PropType, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import MonitorAlertRule from './MonitorAlertRule.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const owner = reactive({ generation: 0, uid: 1 });
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: owner.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => owner.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({ can: () => true }),
}));
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Pool namespace fixture is missing');
  return value;
}
const rule = (id: number, pool_id: number) => ({
  annotations: [],
  enable: 1,
  expr: 'up',
  for_time: '1m',
  id,
  ip_address: '127.0.0.1:9090',
  labels: [],
  name: `rule-${id}`,
  pool_id,
  send_group_id: 3,
  severity: 2,
  user_id: 1,
});
const scrape = (id = 7, name = `scrape-${id}`) => ({
  id,
  name,
  remote_timeout_seconds: 5,
  scrape_interval: 30,
  scrape_timeout: 10,
  support_alert: 1,
  support_record: 2,
  user_id: 1,
});
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
  props: { open: Boolean, title: String },
  setup:
    (props, { emit, slots }) =>
    () =>
      props.open
        ? h('section', { 'data-dialog': props.title }, [
            h('button', { 'data-save': '', onClick: () => emit('ok') }, 'save'),
            h(
              'button',
              { 'data-close': '', onClick: () => emit('cancel') },
              'close',
            ),
            slots.default?.(),
            slots.footer?.(),
          ])
        : null,
});
const Passthrough = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const Form = defineComponent({
  props: {
    model: {
      required: true,
      type: Object as PropType<Record<string, unknown>>,
    },
  },
  setup: (_, { expose, slots }) => {
    expose({ validate: () => Promise.resolve() });
    return () => h('div', slots.default?.());
  },
});
const Select = defineComponent({
  emits: ['update:value', 'dropdownVisibleChange', 'search', 'popupScroll'],
  name: 'PoolFixtureSelect',
  props: {
    filterOption: Boolean,
    loading: Boolean,
    placeholder: String,
    showSearch: Boolean,
    value: { default: undefined },
  },
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
      h('span', { 'data-option': String(props.value) }, slots.default?.()),
});
let wrapper: undefined | VueWrapper;
let rows: ReturnType<typeof rule>[];
const listPath = '/monitor/scrape_pools/list';
const detailPath = '/monitor/scrape_pools/detail/';
const addTitle = '新建告警规则';
const editTitle = '编辑AlertRule';
beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(owner, { generation: 0, uid: 1 });
  rows = [rule(31, 7), rule(32, 8), rule(33, 99)];
  client.get.mockImplementation((path: string) => {
    if (path === '/monitor/alert_rules/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === listPath)
      return Promise.resolve({ total: 1, items: [scrape()] });
    if (path === `${detailPath}7`) return Promise.resolve(scrape());
    if (path === `${detailPath}8`) return Promise.resolve(scrape(8));
    if (path === `${detailPath}99`)
      return Promise.reject(new Error('Unknown scrape ID'));
    if (path === '/monitor/send_groups/detail/3')
      return Promise.resolve({ id: 3, name: 'group-3' });
    if (path === '/monitor/send_groups/list')
      return Promise.resolve({ total: 1, items: [{ id: 3, name: 'group-3' }] });
    if (path.startsWith('/monitor/alert_manager_pools/'))
      return Promise.resolve({
        id: 99,
        name: 'unrelated-alertmanager-99',
        total: 1,
        items: [{ id: 99, name: 'unrelated-alertmanager-99' }],
      });
    throw new Error('Unexpected offline namespace endpoint');
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
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
  const original = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    original(element),
  );
  wrapper = mount(MonitorAlertRule, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        AForm: Form,
        AFormItem: Passthrough,
        AModal: Dialog,
        ASelect: Select,
        ASelectOption: Option,
        ATable: Table,
      },
    },
  });
  await flushPromises();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function add() {
  await required(wrapper).get('.btn-create').trigger('click');
  await flushPromises();
}
function dialog(title = editTitle) {
  return required(wrapper).get(`[data-dialog="${title}"]`);
}
function pool() {
  return required(
    required(wrapper)
      .findAllComponents(Select)
      .find((select) => select.props('placeholder') === '请选择所属实例池'),
  );
}
async function edit(index = 0) {
  await required(
    required(wrapper)
      .get(`[data-row="${index}"]`)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  ).trigger('click');
  await flushPromises();
}
function model() {
  return required(wrapper).getComponent(Form).props('model');
}
function noAlertManagerReads() {
  expect(
    client.get.mock.calls.some(([path]) =>
      path.startsWith('/monitor/alert_manager_pools/'),
    ),
  ).toBe(false);
}
it('new selection loads Scrape7, sends pool_id unchanged, and never reads available Alert99', async () => {
  await add();
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  expect(client.get).toHaveBeenCalledWith(listPath, {
    params: { page: 1, size: 20 },
  });
  expect(pool().text()).toContain('scrape-7');
  expect(pool().text()).not.toContain('unrelated-alertmanager-99');
  pool().vm.$emit('update:value', 7);
  Object.assign(model(), {
    expr: 'up',
    for_time: '1m',
    name: 'explicit-scrape',
    send_group_id: 3,
    severity: 2,
  });
  await dialog(addTitle).get('[data-save]').trigger('click');
  await flushPromises();
  expect(client.post).toHaveBeenCalledWith(
    '/monitor/alert_rules/create',
    expect.objectContaining({
      expr: 'up',
      for_time: '1m',
      pool_id: 7,
      send_group_id: 3,
    }),
  );
  noAlertManagerReads();
});
it('off-page selected pool loads its Scrape detail and survives a first page with different IDs', async () => {
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === listPath
      ? Promise.resolve({ total: 21, items: [scrape(8)] })
      : required(original)(path),
  );
  await edit();
  expect(client.get).toHaveBeenCalledWith(`${detailPath}7`);
  expect(model().pool_id).toBe(7);
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  expect(pool().text()).toContain('scrape-7');
  expect(pool().find('[data-option="7"]').exists()).toBe(true);
  noAlertManagerReads();
});
it('remote search and its pagination use scrape routes and preserve the selected scrape label', async () => {
  await edit();
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === listPath
      ? Promise.resolve({ total: 40, items: [scrape(8, 'searched-scrape')] })
      : required(original)(path),
  );
  expect(pool().props('showSearch')).toBe(true);
  expect(pool().props('filterOption')).toBe(false);
  pool().vm.$emit('search', 'searched');
  await flushPromises();
  expect(client.get).toHaveBeenCalledWith(listPath, {
    params: { page: 1, search: 'searched', size: 20 },
  });
  expect(pool().text()).toContain('scrape-7');
  expect(pool().text()).toContain('searched-scrape');
  pool().vm.$emit('popupScroll', {
    target: { clientHeight: 100, scrollHeight: 100, scrollTop: 100 },
  });
  await flushPromises();
  expect(client.get).toHaveBeenCalledWith(listPath, {
    params: { page: 2, search: 'searched', size: 20 },
  });
  noAlertManagerReads();
});
it('a legacy Alert99 ID is not silently converted or labeled from the unrelated AlertManager table', async () => {
  await edit(2);
  expect(client.get).toHaveBeenCalledWith(`${detailPath}99`);
  expect(model().pool_id).toBe(99);
  expect(pool().text()).not.toContain('unrelated-alertmanager-99');
  expect(client.put).not.toHaveBeenCalled();
  noAlertManagerReads();
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  pool().vm.$emit('update:value', 7);
  await dialog().get('[data-save]').trigger('click');
  await flushPromises();
  expect(client.put).toHaveBeenCalledWith(
    '/monitor/alert_rules/update/33',
    expect.objectContaining({ pool_id: 7 }),
  );
});
it('stale scrape detail cannot replace the next edit target', async () => {
  const pending = createDeferred<unknown>();
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === `${detailPath}7` ? pending.promise : required(original)(path),
  );
  await edit();
  await edit(1);
  pending.resolve(scrape(7, 'stale-detail'));
  await flushPromises();
  expect(model().id).toBe(32);
  expect(model().pool_id).toBe(8);
  expect(pool().text()).not.toContain('stale-detail');
  noAlertManagerReads();
});
it('newer scrape search results own the list even if the earlier search finishes last', async () => {
  await add();
  const first = createDeferred<unknown>();
  const second = createDeferred<unknown>();
  const original = client.get.getMockImplementation();
  let calls = 0;
  client.get.mockImplementation((path: string) => {
    if (path === listPath)
      return ++calls === 1 ? first.promise : second.promise;
    return required(original)(path);
  });
  pool().vm.$emit('search', 'old');
  await flushPromises();
  pool().vm.$emit('search', 'new');
  await flushPromises();
  second.resolve({ total: 1, items: [scrape(8, 'fresh-search')] });
  await flushPromises();
  first.resolve({ total: 1, items: [scrape(7, 'stale-search')] });
  await flushPromises();
  expect(pool().text()).toContain('fresh-search');
  expect(pool().text()).not.toContain('stale-search');
  noAlertManagerReads();
});
it('owner transition invalidates old scrape options and does not borrow its labels', async () => {
  await add();
  const pending = createDeferred<unknown>();
  const original = client.get.getMockImplementation();
  let first = true;
  client.get.mockImplementation((path: string) => {
    if (path === listPath && first) {
      first = false;
      return pending.promise;
    }
    return required(original)(path);
  });
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  await dialog(addTitle).get('[data-close]').trigger('click');
  owner.uid = 2;
  await add();
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  pending.resolve({ total: 1, items: [scrape(99, 'old-owner-pool')] });
  await flushPromises();
  expect(pool().text()).toContain('scrape-7');
  expect(pool().text()).not.toContain('old-owner-pool');
  noAlertManagerReads();
});
it('a mismatched scrape detail response cannot supply a selected label or rewrite pool_id', async () => {
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === `${detailPath}7`
      ? Promise.resolve(scrape(99, 'wrong-id'))
      : required(original)(path),
  );
  await edit();
  expect(model().pool_id).toBe(7);
  expect(pool().text()).not.toContain('wrong-id');
  expect(client.put).not.toHaveBeenCalled();
  noAlertManagerReads();
});

it('an off-page selected pool does not consume a result slot and suppress the next page', async () => {
  await edit();
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === listPath
      ? Promise.resolve({
          total: 21,
          items: Array.from({ length: 20 }, (_, index) => scrape(100 + index)),
        })
      : required(original)(path),
  );
  pool().vm.$emit('dropdownVisibleChange', true);
  await flushPromises();
  expect(pool().findAll('[data-option]')).toHaveLength(21);
  pool().vm.$emit('popupScroll', {
    target: { clientHeight: 100, scrollHeight: 100, scrollTop: 100 },
  });
  await flushPromises();
  expect(client.get).toHaveBeenCalledWith(listPath, {
    params: { page: 2, size: 20 },
  });
  noAlertManagerReads();
});
