import { defineComponent, h, type PropType, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, {
  CheckboxGroup,
  message,
  Modal,
  TreeSelect,
} from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import LocalResource from './LocalResourceManagement.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const session = reactive({ generation: 0, uid: '1' });
const permissions = reactive({ bind: true, detail: true, unbind: true });
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: session.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => session.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: () => true,
    hasPerm: (path: string) => {
      if (path === '/api/tree/local/bind/:id') return permissions.bind;
      if (path === '/api/tree/local/unbind/:id') return permissions.unbind;
      if (path === '/api/tree/local/detail/:id') return permissions.detail;
      return true;
    },
  }),
}));
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Binding test fixture is unavailable');
  return value;
}
const node = (id: number, is_leaf = 1) => ({
  create_user_id: 1,
  create_user_name: 'demo',
  created_at: '',
  description: '',
  id,
  is_leaf,
  level: 1,
  name: `node-${id}`,
  parent_id: 0,
  status: 1,
  updated_at: '',
});
const host = (id = 7) => ({
  auth_mode: 2,
  cpu: 1,
  created_at: '',
  description: '',
  disk: 1,
  environment: 'local',
  id,
  image_name: '',
  ip_addr: '192.0.2.7',
  memory: 1,
  name: `host-${id}`,
  os_name: '',
  os_type: 'linux',
  port: 22,
  status: 1,
  tags: [],
  tree_nodes: [node(11), node(12)],
  updated_at: '',
  username: 'demo',
});
const Table = defineComponent({
  props: {
    columns: { default: () => [], type: Array },
    dataSource: {
      default: () => [],
      type: Array as PropType<ReturnType<typeof host>[]>,
    },
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
  emits: ['cancel', 'close', 'ok', 'update:open'],
  props: {
    confirmLoading: Boolean,
    loading: Boolean,
    open: Boolean,
    title: String,
  },
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
                { 'data-ok': '', onClick: () => emit('ok') },
                'confirm',
              ),
              h(
                'button',
                {
                  'data-close': '',
                  onClick: () => {
                    emit('cancel');
                    emit('close');
                    emit('update:open', false);
                  },
                },
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
let wrapper: undefined | VueWrapper;
let rows: ReturnType<typeof host>[];
const bindTitle = '绑定服务树节点';
const unbindTitle = '管理服务树绑定';
beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(session, { generation: 0, uid: '1' });
  Object.assign(permissions, { bind: true, detail: true, unbind: true });
  rows = [host(), host(8)];
  client.get.mockImplementation((path: string) => {
    if (path === '/tree/local/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path === '/tree/node/list')
      return Promise.resolve({
        total: 1,
        items: [{ ...node(10, 2), children: [node(11), node(12)] }],
      });
    if (path.startsWith('/tree/local/detail/'))
      return Promise.resolve(
        rows.find((row) => row.id === Number(path.split('/').at(-1))),
      );
    throw new Error('Unexpected offline endpoint');
  });
  client.post.mockResolvedValue({});
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  vi.spyOn(message, 'success');
  vi.spyOn(Modal, 'confirm').mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  }));
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
  wrapper = mount(LocalResource, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        ADrawer: Dialog,
        ADropdown: Dropdown,
        AForm: Passthrough,
        AFormItem: Passthrough,
        AModal: Dialog,
        ATable: Table,
        ATooltip: Passthrough,
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
async function action(label: string, index = 0) {
  const button = required(
    required(wrapper)
      .get(`[data-row="${index}"]`)
      .findAll('button,[role="menuitem"]')
      .find((item) => item.text().replaceAll(/\s/g, '') === label),
  );
  await button.trigger('click');
  await flushPromises();
}
function dialog(title = bindTitle) {
  return required(wrapper).find(`[data-dialog="${title}"]`);
}

async function select(ids: unknown, mode: 'bind' | 'unbind' = 'bind') {
  const selector =
    mode === 'bind'
      ? required(wrapper).getComponent(TreeSelect)
      : required(wrapper).getComponent(CheckboxGroup);
  selector.vm.$emit('update:value', ids);
  await flushPromises();
}
async function submit(title = bindTitle) {
  await dialog(title).get('[data-ok]').trigger('click');
  await flushPromises();
}
async function close(title = bindTitle) {
  await dialog(title).get('[data-close]').trigger('click');
  await flushPromises();
}
function currentRow(index = 0) {
  return required(
    required(required(wrapper).getComponent(Table).props('dataSource'))[index],
  );
}

it('binds a real nonleaf directory ID and sends a detached array once', async () => {
  await action('绑定服务树');
  await select([10, 11]);
  const pending = createDeferred<object>();
  client.post.mockReturnValueOnce(pending.promise);
  await submit();
  await submit();
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.post).toHaveBeenCalledWith('/tree/local/bind/7', {
    id: 7,
    tree_node_ids: [10, 11],
  });
  await select([12]);
  expect(client.post.mock.calls[0]?.[1].tree_node_ids).toEqual([10, 11]);
  pending.resolve({});
  await flushPromises();
  expect(dialog().exists()).toBe(true);
  expect(message.success).not.toHaveBeenCalled();
  expect(dialog().attributes('data-busy')).toBe('false');
});
it('unbinds saved associations and accepts the Go empty success object', async () => {
  await action('解绑服务树');
  await select([12], 'unbind');
  await submit(unbindTitle);
  expect(client.post).toHaveBeenCalledWith('/tree/local/unbind/7', {
    id: 7,
    tree_node_ids: [12],
  });
  expect(dialog(unbindTitle).exists()).toBe(false);
  expect(message.success).toHaveBeenCalledWith('解绑成功');
});
describe.each(['bind', 'unbind'] as const)('%s ID boundary', (mode) => {
  it.each(
    [
      [],
      [0],
      [-1],
      [1.5],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      [Number.MAX_SAFE_INTEGER + 1],
      ['11'],
      [11, 11],
      [99],
      null,
      undefined,
    ].map((ids) => ({ ids })),
  )(
    'rejects malformed/missing/out-of-scope selections $ids without a write',
    async ({ ids }) => {
      await action(mode === 'bind' ? '绑定服务树' : '解绑服务树');
      await select(ids, mode);
      await submit(mode === 'bind' ? bindTitle : unbindTitle);
      expect(client.post).not.toHaveBeenCalled();
    },
  );
  it.each([
    'close',
    'reopen',
    'other-target',
    'other-mode',
    'owner',
    'generation',
    'unmount',
    'permission',
    'row-id',
    'associations',
    'selection',
    'edit',
    'detail',
  ] as const)('ignores late success after %s', async (transition) => {
    const title = mode === 'bind' ? bindTitle : unbindTitle;
    const pending = createDeferred<object>();
    client.post.mockReturnValueOnce(pending.promise);
    await action(mode === 'bind' ? '绑定服务树' : '解绑服务树');
    await select([11], mode);
    await submit(title);
    expect(client.post).toHaveBeenCalledTimes(1);
    if (transition === 'close') await close(title);
    if (transition === 'reopen') {
      await close(title);
      await action(mode === 'bind' ? '绑定服务树' : '解绑服务树');
      await select([12], mode);
    }
    if (transition === 'other-target') {
      await action(mode === 'bind' ? '绑定服务树' : '解绑服务树', 1);
      await select([12], mode);
    }
    if (transition === 'other-mode')
      await action(mode === 'bind' ? '解绑服务树' : '绑定服务树', 1);
    if (transition === 'owner') session.uid = '2';
    if (transition === 'generation') session.generation++;
    if (transition === 'unmount') {
      required(wrapper).unmount();
      wrapper = undefined;
    }
    if (transition === 'permission') permissions[mode] = false;
    if (transition === 'row-id') currentRow().id = 88;
    if (transition === 'associations') currentRow().tree_nodes = [node(12)];
    if (transition === 'selection') await select([12], mode);
    if (transition === 'edit') await action('编辑', 1);
    if (transition === 'detail') await action('查看', 1);
    await flushPromises();
    const reads = client.get.mock.calls.length;
    pending.resolve({});
    await flushPromises();
    expect(client.get).toHaveBeenCalledTimes(reads);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    if (transition === 'reopen' || transition === 'other-target') {
      const selector =
        mode === 'bind'
          ? required(wrapper).getComponent(TreeSelect)
          : required(wrapper).getComponent(CheckboxGroup);
      expect(selector.props().value).toEqual([12]);
      expect(dialog(title).exists()).toBe(true);
    }
  });
  it('old failure/finally cannot notify or clear a newer pending request', async () => {
    const first = createDeferred<object>();
    const second = createDeferred<object>();
    client.post
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const label = mode === 'bind' ? '绑定服务树' : '解绑服务树';
    const title = mode === 'bind' ? bindTitle : unbindTitle;
    await action(label);
    await select([11], mode);
    await submit(title);
    await close(title);
    await action(label, 1);
    await select([12], mode);
    await submit(title);
    first.reject(new Error('private-error-canary'));
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
    expect(dialog(title).attributes('data-busy')).toBe('true');
    second.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledTimes(1);
  });
});

it.each([
  0,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  '7',
  undefined,
])(
  'invalid saved host ID %j never opens a binding window or writes',
  async (id) => {
    Object.assign(currentRow(), { id });
    await action('绑定服务树');
    await action('解绑服务树');
    expect(dialog().exists()).toBe(false);
    expect(dialog(unbindTitle).exists()).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  },
);
it('changing a valid target ID after opening cannot retarget the write', async () => {
  await action('绑定服务树');
  await select([11]);
  currentRow().id = 88;
  await submit();
  expect(client.post).not.toHaveBeenCalled();
});
it('pending detail from before binding is invalidated when opening the binding window', async () => {
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await action('查看');
  await action('绑定服务树', 1);
  await select([11]);
  pending.resolve(host());
  await flushPromises();
  expect(dialog('服务器详情').exists()).toBe(false);
  expect(dialog().exists()).toBe(true);
  expect(client.post).not.toHaveBeenCalled();
});
it.each(['different-host', 'same-host-reopened', 'close'] as const)(
  'old post-bind detail refresh cannot replace %s detail scope',
  async (transition) => {
    await action('查看');
    const pending = createDeferred<unknown>();
    const original = client.get.getMockImplementation();
    let deferRefresh = true;
    client.get.mockImplementation((path: string) => {
      if (path === '/tree/local/detail/7' && deferRefresh)
        return pending.promise;
      return required(original)(path);
    });
    await action('绑定服务树');
    await select([11]);
    await submit();
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(dialog().exists()).toBe(false);
    deferRefresh = false;
    if (transition === 'close') await close('服务器详情');
    else {
      await close('服务器详情');
      await action('查看', transition === 'different-host' ? 1 : 0);
    }
    const reads = client.get.mock.calls.length;
    pending.resolve({
      ...host(),
      name: 'stale-detail-canary',
      tree_nodes: [node(99)],
    });
    await flushPromises();
    expect(required(wrapper).text()).not.toContain('stale-detail-canary');
    expect(client.get).toHaveBeenCalledTimes(reads);
    if (transition === 'close')
      expect(dialog('服务器详情').exists()).toBe(false);
    else
      expect(dialog('服务器详情').text()).toContain(
        transition === 'different-host' ? 'host-8' : 'host-7',
      );
  },
);
it('a mismatched post-bind detail ID cannot replace the captured saved target', async () => {
  await action('查看');
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === '/tree/local/detail/7'
      ? Promise.resolve(host(8))
      : required(original)(path),
  );
  await action('绑定服务树');
  await select([11]);
  await submit();
  expect(dialog('服务器详情').text()).toContain('host-7');
  expect(message.error).toHaveBeenCalledWith('刷新资源详情失败');
});
it('old post-bind list read cannot overwrite a newer binding result after the new request finishes first', async () => {
  const first = createDeferred<unknown>();
  const second = createDeferred<unknown>();
  const original = client.get.getMockImplementation();
  let listReads = 0;
  client.get.mockImplementation((path: string) => {
    if (path === '/tree/local/list')
      return ++listReads === 1 ? first.promise : second.promise;
    return required(original)(path);
  });
  await action('绑定服务树');
  await select([11]);
  await submit();
  await action('绑定服务树', 1);
  await select([12]);
  await submit();
  second.resolve({
    total: 1,
    items: [{ ...host(8), name: 'new-binding-result' }],
  });
  await flushPromises();
  first.resolve({
    total: 1,
    items: [{ ...host(), name: 'stale-list-canary' }],
  });
  await flushPromises();
  expect(required(wrapper).text()).toContain('new-binding-result');
  expect(required(wrapper).text()).not.toContain('stale-list-canary');
  expect(message.success).toHaveBeenCalledTimes(2);
});
it('owner directory epoch rejects an old read while a fresh directory remains pending', async () => {
  session.generation++;
  await flushPromises();
  const original = client.get.getMockImplementation();
  const old = createDeferred<unknown>();
  const fresh = createDeferred<unknown>();
  let treeReads = 0;
  client.get.mockImplementation((path: string) => {
    if (path === '/tree/node/list')
      return ++treeReads === 1 ? old.promise : fresh.promise;
    return required(original)(path);
  });
  required(wrapper)
    .getComponent(Table)
    .vm.$emit('change', { current: 1, pageSize: 10 });
  await flushPromises();
  await action('绑定服务树');
  session.generation++;
  await flushPromises();
  required(wrapper)
    .getComponent(Table)
    .vm.$emit('change', { current: 1, pageSize: 10 });
  await flushPromises();
  await action('绑定服务树');
  old.resolve({ items: [node(99)] });
  await flushPromises();
  expect(required(wrapper).getComponent(TreeSelect).props('loading')).toBe(
    true,
  );
  await select([99]);
  await submit();
  expect(client.post).not.toHaveBeenCalled();
  fresh.resolve({ items: [node(12, 2)] });
  await flushPromises();
  await select([12]);
  await submit();
  expect(client.post).toHaveBeenCalledWith('/tree/local/bind/7', {
    id: 7,
    tree_node_ids: [12],
  });
  expect(message.error).not.toHaveBeenCalled();
});

it('old refresh finally cannot clear loading or selection of a newer in-flight binding', async () => {
  const refresh = createDeferred<unknown>();
  const nextWrite = createDeferred<object>();
  const original = client.get.getMockImplementation();
  let firstList = true;
  client.get.mockImplementation((path: string) => {
    if (path === '/tree/local/list' && firstList) {
      firstList = false;
      return refresh.promise;
    }
    return required(original)(path);
  });
  client.post.mockResolvedValueOnce({}).mockReturnValueOnce(nextWrite.promise);
  await action('绑定服务树');
  await select([11]);
  await submit();
  await action('绑定服务树', 1);
  await select([12]);
  await submit();
  refresh.resolve({ total: 1, items: [host()] });
  await flushPromises();
  expect(dialog().attributes('data-busy')).toBe('true');
  expect(required(wrapper).getComponent(TreeSelect).props('value')).toEqual([
    12,
  ]);
  nextWrite.resolve({});
  await flushPromises();
  expect(dialog().exists()).toBe(false);
});
it('closing a window suppresses its later directory error without a write or automatic retry', async () => {
  session.generation++;
  await flushPromises();
  required(wrapper)
    .getComponent(Table)
    .vm.$emit('change', { current: 1, pageSize: 10 });
  await flushPromises();
  const pending = createDeferred<unknown>();
  const original = client.get.getMockImplementation();
  client.get.mockImplementation((path: string) =>
    path === '/tree/node/list' ? pending.promise : required(original)(path),
  );
  await action('绑定服务树');
  await close();
  const reads = client.get.mock.calls.length;
  pending.reject(new Error('private-directory-error'));
  await flushPromises();
  expect(client.get).toHaveBeenCalledTimes(reads);
  expect(message.error).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});
