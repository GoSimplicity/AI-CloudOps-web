import type { FormInstance } from 'ant-design-vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Select } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import MonitorAlertRecord from './MonitorAlertRecord.vue';

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
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Missing record fixture');
  return value;
}
const record = (id: number) => ({
  create_user_name: 'fixture',
  enable: 1,
  expr: 'sum(up)',
  id,
  ip_address: 'localhost:9090',
  labels: ['team=ops'],
  name: `record-${id}`,
  pool_id: 51,
  user_id: 1,
});
let wrapper: VueWrapper;
let unmounted = false;
beforeEach(async () => {
  vi.clearAllMocks();
  control.allowed = true;
  control.session.uid = '1';
  control.session.generation = 0;
  client.get.mockImplementation((path: string) => {
    if (path === '/monitor/record_rules/list')
      return Promise.resolve({ total: 2, items: [record(101), record(202)] });
    if (path === '/monitor/scrape_pools/list')
      return Promise.resolve({
        total: 1,
        items: [{ id: 51, name: 'fixture-pool' }],
      });
    throw new Error('Unexpected offline endpoint');
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
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
  wrapper = mount(MonitorAlertRecord, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
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
function setup() {
  return required(Reflect.get(wrapper.vm.$, 'setupState'));
}
function state(name: string) {
  return required(Reflect.get(setup(), name));
}
function invoke(name: string, ...args: unknown[]) {
  const method = state(name);
  if (typeof method !== 'function') throw new Error('Missing record action');
  return method(...args);
}
async function open(mode: 'add' | 'edit' = 'add', id = 101) {
  if (mode === 'add') await wrapper.get('.btn-create').trigger('click');
  else invoke('showEditModal', record(id));
  await flushPromises();
}
function valid(mode: 'add' | 'edit' = 'add') {
  const model = state(mode === 'add' ? 'addForm' : 'editForm');
  Object.assign(model, {
    enable: 1,
    expr: 'sum(up)',
    ip_address: '',
    labels: ['team=ops'],
    name: 'ok',
    pool_id: 51,
  });
  return model;
}
function form(mode: 'add' | 'edit' = 'add'): FormInstance {
  return state(mode === 'add' ? 'addFormRef' : 'editFormRef');
}
function save(mode: 'add' | 'edit' = 'add') {
  return invoke(mode === 'add' ? 'handleAdd' : 'handleUpdate');
}

it.each(['add', 'edit'] as const)(
  'uses real validation and preserves %s payload with optional empty address',
  async (mode) => {
    await open(mode);
    const model = valid(mode);
    await save(mode);
    const writer = mode === 'add' ? client.post : client.put;
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith(
      mode === 'add'
        ? '/monitor/record_rules/create'
        : '/monitor/record_rules/update/101',
      {
        ...(mode === 'edit' ? { id: 101 } : {}),
        enable: 1,
        expr: 'sum(up)',
        ip_address: '',
        labels: ['team=ops'],
        name: 'ok',
        pool_id: 51,
      },
    );
    expect(Reflect.get(model, 'labels')).toEqual(['team=ops']);
  },
);
it('does not submit when the actual AntD form rejects an empty expression', async () => {
  await open();
  const model = valid();
  Reflect.set(model, 'expr', '');
  await save();
  await flushPromises();
  expect(client.post).not.toHaveBeenCalled();
  expect(state('submitLoading')).toBe(false);
  expect(document.body.textContent).toContain('请输入表达式');
});
it('does not bypass validation when its ref is missing', async () => {
  await open();
  valid();
  Reflect.set(setup(), 'addFormRef', undefined);
  await save();
  expect(client.post).not.toHaveBeenCalled();
});
it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '51', undefined])(
  'rejects invalid pool id %s before mutation',
  async (id) => {
    await open();
    Reflect.set(valid(), 'pool_id', id);
    await save();
    expect(client.post).not.toHaveBeenCalled();
  },
);
it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined])(
  'rejects invalid edit id %s instead of creating',
  async (id) => {
    await open('edit');
    valid('edit');
    Reflect.set(state('editForm'), 'id', id);
    await save('edit');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  },
);
it('does not reuse validation after fields change', async () => {
  await open();
  const model = valid();
  const validation = createDeferred<Record<string, unknown>>();
  vi.spyOn(form(), 'validate').mockReturnValueOnce(validation.promise);
  const pending = save();
  Reflect.set(model, 'name', 'changed');
  validation.resolve({});
  await pending;
  expect(client.post).not.toHaveBeenCalled();
  expect(state('submitLoading')).toBe(false);
});
it('does not transfer an old validation result to another window', async () => {
  await open();
  valid();
  const validation = createDeferred<Record<string, unknown>>();
  vi.spyOn(form(), 'validate').mockReturnValueOnce(validation.promise);
  const pending = save();
  invoke('closeAddModal');
  await open('edit', 202);
  valid('edit');
  validation.resolve({});
  await pending;
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
});
it.each(['owner', 'generation', 'permission'] as const)(
  'rejects pending validation after %s changes',
  async (change) => {
    await open();
    valid();
    const validation = createDeferred<Record<string, unknown>>();
    vi.spyOn(form(), 'validate').mockReturnValueOnce(validation.promise);
    const pending = save();
    if (change === 'owner') control.session.uid = '2';
    else if (change === 'generation') control.session.generation += 1;
    else control.allowed = false;
    validation.resolve({});
    await pending;
    expect(client.post).not.toHaveBeenCalled();
  },
);
it.each(['resolve', 'reject'] as const)(
  'does not let old %s clear a newer save or window',
  async (outcome) => {
    await open();
    valid();
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();
    client.post
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const old = save();
    await flushPromises();
    invoke('closeAddModal');
    await open();
    valid();
    const current = save();
    await flushPromises();
    expect(state('submitLoading')).toBe(true);
    if (outcome === 'resolve') first.resolve({});
    else first.reject(new Error('old-private-diagnostic'));
    await old;
    expect(state('submitLoading')).toBe(true);
    expect(state('isAddModalVisible')).toBe(true);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    second.resolve({});
    await current;
    expect(client.post).toHaveBeenCalledTimes(2);
  },
);
it('isolates labels from the submitted request and prevents double clicks', async () => {
  await open();
  const model = valid();
  const pending = createDeferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  const first = save();
  await flushPromises();
  await save();
  Reflect.get(model, 'labels').push('late=edit');
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.post.mock.calls[0]?.[1].labels).toEqual(['team=ops']);
  pending.resolve({});
  await first;
});
it('does not adopt old pool reads after the form is reopened', async () => {
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await open();
  invoke('closeAddModal');
  await open('edit');
  pending.resolve({ total: 1, items: [{ id: 99, name: 'stale' }] });
  await flushPromises();
  expect(state('poolOptions')).toEqual([{ id: 51, name: 'fixture-pool' }]);
});
it.each(['resolve', 'reject'] as const)(
  'ignores an old expression-check %s after another window opens',
  async (outcome) => {
    await open();
    valid();
    const pending = createDeferred<unknown>();
    client.post.mockReturnValueOnce(pending.promise);
    const check = invoke('validateAddExpression');
    await flushPromises();
    invoke('closeAddModal');
    await open('edit');
    if (outcome === 'resolve') pending.resolve({});
    else pending.reject(new Error('old-private-diagnostic'));
    await check;
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(state('validatingExpr')).toBe(false);
  },
);
it('preserves the real retry-button event contract', async () => {
  client.get.mockRejectedValueOnce(new Error('private-read-diagnostic'));
  await invoke('fetchRecordRules');
  await flushPromises();
  const before = client.get.mock.calls.filter(
    ([path]) => path === '/monitor/record_rules/list',
  ).length;
  const refresh = required(
    wrapper
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '重试'),
  );
  await refresh.trigger('click');
  await flushPromises();
  expect(
    client.get.mock.calls.filter(
      ([path]) => path === '/monitor/record_rules/list',
    ),
  ).toHaveLength(before + 1);
});
it('rejects all receipts after unmount', async () => {
  await open();
  valid();
  const pending = createDeferred<unknown>();
  client.post.mockReturnValueOnce(pending.promise);
  const submit = save();
  await flushPromises();
  wrapper.unmount();
  unmounted = true;
  pending.resolve({});
  await submit;
  expect(message.success).not.toHaveBeenCalled();
  expect(message.error).not.toHaveBeenCalled();
});

it('keeps the original record labels detached from edits', async () => {
  const original = record(101);
  invoke('showEditModal', original);
  await flushPromises();
  Reflect.get(state('editForm'), 'labels').push('edited=label');
  expect(original.labels).toEqual(['team=ops']);
});
it('rejects old validation after A-to-B-to-A principal changes', async () => {
  await open();
  valid();
  const validation = createDeferred<Record<string, unknown>>();
  vi.spyOn(form(), 'validate').mockReturnValueOnce(validation.promise);
  const pending = save();
  control.session.uid = '2';
  control.session.uid = '1';
  validation.resolve({});
  await pending;
  expect(client.post).not.toHaveBeenCalled();
  expect(state('isAddModalVisible')).toBe(false);
});
it('reports a current failure without echoing private diagnostics', async () => {
  await open();
  valid();
  client.post.mockRejectedValueOnce(new Error('private-upstream-diagnostic'));
  await save();
  expect(message.error).toHaveBeenCalledWith('新增记录失败');
  expect(state('isAddModalVisible')).toBe(true);
  expect(state('submitLoading')).toBe(false);
});

it('rejects the old pool result while the newer search is still debouncing', async () => {
  await open();
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  const read = invoke('loadPools');
  vi.useFakeTimers();
  invoke('handlePoolSearch', 'new-query');
  pending.resolve({ total: 1, items: [{ id: 99, name: 'old-query' }] });
  await read;
  expect(state('poolOptions')).toEqual([{ id: 51, name: 'fixture-pool' }]);
});

it('keeps the authoritative selected pool name outside the current page and later searches', async () => {
  client.get.mockResolvedValueOnce({
    total: 20,
    items: [{ id: 1, name: 'page-one' }],
  });
  invoke('showEditModal', { ...record(101), pool_name: 'authoritative-51' });
  await flushPromises();
  const select = required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('value') === 51),
  );
  expect(select.get('.ant-select-selection-item').text()).toContain(
    'authoritative-51',
  );
  client.get.mockResolvedValueOnce({
    total: 1,
    items: [{ id: 2, name: 'search-result' }],
  });
  await invoke('loadPools');
  await flushPromises();
  expect(select.get('.ant-select-selection-item').text()).toContain(
    'authoritative-51',
  );
  expect(Reflect.get(state('editForm'), 'pool_id')).toBe(51);
});
it('retains a same-owner fetched pool label when reopening an older record without pool_name', async () => {
  await open('edit');
  invoke('closeEditModal');
  client.get.mockResolvedValueOnce({
    total: 20,
    items: [{ id: 1, name: 'page-one' }],
  });
  await open('edit');
  const select = required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('value') === 51),
  );
  expect(select.get('.ant-select-selection-item').text()).toContain(
    'fixture-pool',
  );
});
it('does not borrow a previous owners cached pool name for the same numeric id', async () => {
  await open('edit');
  control.session.uid = '2';
  client.get.mockResolvedValueOnce({
    total: 20,
    items: [{ id: 1, name: 'new-owner-page' }],
  });
  invoke('showEditModal', record(101));
  await flushPromises();
  expect(state('poolOptions')).toEqual([{ id: 1, name: 'new-owner-page' }]);
  const select = required(
    wrapper
      .findAllComponents(Select)
      .find((select) => select.props('value') === 51),
  );
  expect(select.get('.ant-select-selection-item').text()).not.toContain(
    'fixture-pool',
  );
});
