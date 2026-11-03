import { defineComponent, h, reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import LocalResource from './LocalResourceManagement.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
const validation = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const options = vi.hoisted(() => ({ missingValidation: false }));
const session = reactive({ generation: 0, uid: '1' });
const permissions = reactive({
  create: true,
  delete: true,
  detail: true,
  edit: true,
  terminal: true,
});
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('vue-router', () => ({ useRouter: () => navigation }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: session.uid } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => session.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: (key: string) =>
      key === 'tree.local.delete' ? permissions.delete : permissions.terminal,
    hasPerm: (path: string) => {
      if (path.includes('/update/')) return permissions.edit;
      if (path.includes('/detail/')) return permissions.detail;
      return permissions.create;
    },
  }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required local resource fixture is unavailable');
  return value;
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
  emits: ['cancel', 'close', 'update:open'],
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
const Form = defineComponent({
  props: ['model'],
  setup: (_, { expose, slots }) => {
    expose({
      clearValidate: () => {},
      resetFields: () => {},
      ...(options.missingValidation ? {} : { validate: () => validation() }),
    });
    return () => h('div', slots.default?.());
  },
});
const RadioGroup = defineComponent({
  emits: ['update:value', 'change'],
  props: ['value'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const NumberInput = defineComponent({
  emits: ['update:value'],
  props: ['value', 'placeholder'],
  setup: (props) => () => h('div', { 'data-number': props.placeholder }),
});
let wrapper: undefined | VueWrapper;
const resource = (id: unknown = 7, name = 'owned host') => ({
  auth_mode: 2,
  cpu: 1,
  created_at: '',
  description: 'original description',
  disk: 1,
  environment: 'local',
  id,
  image_name: '',
  ip_addr: '192.0.2.5',
  memory: 1,
  name,
  os_name: '',
  os_type: 'linux',
  port: 22,
  status: 1,
  tags: [{ key: 'team', value: 'ops' }],
  tree_nodes: [],
  updated_at: '',
  username: 'operator',
});
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(session, { generation: 0, uid: '1' });
  Object.assign(permissions, {
    create: true,
    delete: true,
    detail: true,
    edit: true,
    terminal: true,
  });
  options.missingValidation = false;
  validation.mockImplementation(() => Promise.resolve());
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
  vi.spyOn(Modal, 'confirm').mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  }));
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
async function start(rows = [resource()], realForm = false) {
  client.get.mockImplementation((path: string) => {
    if (path === '/tree/local/list')
      return Promise.resolve({ total: rows.length, items: rows });
    if (path.startsWith('/tree/local/detail/'))
      return Promise.resolve(
        rows.find((row) => row.id === Number(path.split('/').at(-1))),
      );
    return Promise.resolve({ total: 0, items: [] });
  });
  wrapper = mount(LocalResource, {
    attachTo: document.body,
    global: {
      plugins: [Antd],
      stubs: {
        ADrawer: Dialog,
        ADropdown: Dropdown,
        AForm: realForm ? false : Form,
        AFormItem: realForm ? false : Passthrough,
        AInputNumber: NumberInput,
        AModal: Dialog,
        ARadioGroup: RadioGroup,
        ATable: Table,
        ATooltip: Passthrough,
      },
    },
  });
  await flushPromises();
}
function dialog(edit = true) {
  return required(wrapper).get(
    `[data-dialog="${edit ? '编辑服务器' : '添加服务器'}"]`,
  );
}
async function action(label: string, index = 0) {
  const element = required(wrapper)
    .get(`[data-row="${index}"]`)
    .findAll('button, [role="menuitem"]')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  await required(element).trigger('click');
  await flushPromises();
}
async function create() {
  const button = required(
    required(wrapper)
      .findAll('button')
      .find((item) => item.text().includes('添加服务器')),
  );
  await button.trigger('click');
  await flushPromises();
}
async function save(edit = true) {
  const button = required(
    dialog(edit)
      .findAll('button')
      .find(
        (item) =>
          item.text().replaceAll(/\s/g, '') === (edit ? '更新' : '添加'),
      ),
  );
  await button.trigger('click');
  await flushPromises();
}
function model() {
  const value = required(required(wrapper).getComponent(Form).props('model'));
  if (typeof value !== 'object')
    throw new Error('Expected resource form model');
  return value;
}
function row(index = 0) {
  const items = required(
    required(wrapper).getComponent(Table).props('dataSource'),
  );
  const value = required(items[index]);
  if (typeof value !== 'object' || value === null || !('id' in value))
    throw new Error('Expected saved resource row');
  return value;
}
function confirmation(index = -1) {
  return required(vi.mocked(Modal.confirm).mock.calls.at(index)?.[0]);
}
async function accept(index = -1) {
  const fn = confirmation(index).onOk;
  if (typeof fn !== 'function') throw new Error('Missing delete confirmation');
  await fn();
}
async function mode(value: unknown) {
  const radio = required(required(wrapper).findAllComponents(RadioGroup)[0]);
  radio.vm.$emit('update:value', value);
  radio.vm.$emit('change');
  await flushPromises();
}
async function changePassword(value: string) {
  await dialog().get('input[type="password"]').setValue(value);
}

it('normal metadata updates retain blank credentials and explicit clears', async () => {
  await start();
  await action('编辑');
  await dialog().get('textarea[placeholder="服务器用途描述"]').setValue('');
  Reflect.set(model(), 'tags', []);
  await save();
  expect(client.put).toHaveBeenCalledOnce();
  const [path, payload] = required(client.put.mock.calls[0]);
  expect(path).toBe('/tree/local/update/7');
  expect(payload.description).toBe('');
  expect(payload.tags).toEqual([]);
  expect(payload).not.toHaveProperty('password');
  expect(payload).not.toHaveProperty('key');
  expect(payload.id).toBe(7);
});

it('does not bypass validation if the real form ref has no validate method', async () => {
  options.missingValidation = true;
  await start();
  await action('编辑');
  await save();
  expect(client.put).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalledWith('表单尚未就绪，请稍后重试');
});

it('honors actual Ant Design required fields before creation', async () => {
  await start([resource()], true);
  await create();
  await save(false);
  await vi.waitFor(() =>
    expect(
      dialog(false).findAll('.ant-form-item-explain-error').length,
    ).toBeGreaterThan(0),
  );
  expect(client.post).not.toHaveBeenCalled();
});

it('does not dispatch a credential snapshot when the draft changes during validation', async () => {
  await start([{ ...resource(), auth_mode: 1 }]);
  await action('编辑');
  await changePassword('fixture-old');
  const pending = createDeferred<unknown>();
  validation.mockReturnValueOnce(pending.promise);
  await save();
  await changePassword('fixture-new');
  pending.resolve({});
  await flushPromises();
  expect(client.put).not.toHaveBeenCalled();
});

it.each(['owner', 'generation', 'permission', 'target', 'close-reopen'])(
  'does not dispatch old validation after %s changes',
  async (change) => {
    await start([resource(7), resource(8)]);
    await action('编辑', 0);
    const pending = createDeferred<unknown>();
    validation.mockReturnValueOnce(pending.promise);
    await save();
    if (change === 'owner') session.uid = '2';
    if (change === 'generation') session.generation += 1;
    if (change === 'permission') permissions.edit = false;
    if (change === 'target') row().id = 8;
    if (change === 'close-reopen') {
      await dialog().get('[data-close]').trigger('click');
      await action('编辑', 1);
    }
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it('single-flight validation and mutation do not duplicate resource writes', async () => {
  await start();
  await action('编辑');
  const check = createDeferred<unknown>();
  const write = createDeferred<unknown>();
  validation.mockReturnValueOnce(check.promise);
  client.put.mockReturnValueOnce(write.promise);
  await save();
  await save();
  expect(validation).toHaveBeenCalledOnce();
  check.resolve({});
  await flushPromises();
  await save();
  expect(client.put).toHaveBeenCalledOnce();
  write.resolve({});
  await flushPromises();
});

it.each(['resolve', 'reject'])(
  'old writes do not close or unlock a newer form: %s',
  async (outcome) => {
    await start([resource(7), resource(8)]);
    await action('编辑', 0);
    const first = createDeferred<unknown>();
    const second = createDeferred<unknown>();
    client.put
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await save();
    await dialog().get('[data-close]').trigger('click');
    await action('编辑', 1);
    await save();
    if (outcome === 'resolve') first.resolve({});
    else first.reject(new Error('old resource write failed'));
    await flushPromises();
    expect(
      required(
        dialog()
          .findAll('button')
          .find((item) => item.text().replaceAll(/\s/g, '') === '更新'),
      ).classes(),
    ).toContain('ant-btn-loading');
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    second.resolve({});
    await flushPromises();
  },
);

it('clears unsaved SSH values on close and owner invalidation', async () => {
  await start([{ ...resource(), auth_mode: 1 }]);
  await action('编辑');
  await changePassword('fixture-draft');
  const old = model();
  await dialog().get('[data-close]').trigger('click');
  expect(Reflect.get(old, 'password') === '').toBe(true);
  expect(Reflect.get(old, 'key') === '').toBe(true);
  await action('编辑');
  await changePassword('fixture-draft');
  const current = model();
  const reads = client.get.mock.calls.length;
  session.generation += 1;
  await flushPromises();
  expect(Reflect.get(current, 'password') === '').toBe(true);
  expect(required(wrapper).find('[data-dialog="编辑服务器"]').exists()).toBe(
    false,
  );
  expect(client.get).toHaveBeenCalledTimes(reads);
});

it('rotates only explicitly entered active-mode credentials', async () => {
  await start([{ ...resource(), auth_mode: 1 }]);
  await action('编辑');
  await changePassword('fixture-rotation');
  await save();
  const payload = required(client.put.mock.calls[0])[1];
  expect(payload.password === 'fixture-rotation').toBe(true);
  expect(payload).not.toHaveProperty('key');
});

it('switching authentication mode requires a fresh active credential', async () => {
  await start();
  await action('编辑');
  await mode(1);
  await save();
  expect(client.put).not.toHaveBeenCalled();
  expect(message.warning).toHaveBeenCalledWith('更改认证方式时请提供新的凭据');
  await changePassword('fixture-rotation');
  await save();
  expect(client.put).toHaveBeenCalledOnce();
  const payload = required(client.put.mock.calls[0])[1];
  expect(payload.auth_mode).toBe(1);
  expect(payload.password === 'fixture-rotation').toBe(true);
  expect(payload).not.toHaveProperty('key');
});

it.each([
  undefined,
  null,
  0,
  -1,
  1.5,
  Number.NaN,
  Number.MAX_SAFE_INTEGER + 1,
  '7',
])(
  'invalid saved resource ID %s cannot edit, delete, navigate, or load detail',
  async (id) => {
    await start([{ ...resource(), id }]);
    const reads = client.get.mock.calls.length;
    await action('编辑');
    await action('删除');
    await action('查看');
    await action('连接终端');
    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(reads);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  },
);

it.each([undefined, 0, 3, '2'])(
  'invalid authentication mode %s cannot be submitted',
  async (value) => {
    await start();
    await action('编辑');
    await mode(value);
    await save();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it.each([undefined, 0, 65_536, 22.5, Number.NaN, '22'])(
  'invalid SSH port %s cannot be submitted',
  async (port) => {
    await start();
    await action('编辑');
    required(required(wrapper).findAllComponents(NumberInput)[0]).vm.$emit(
      'update:value',
      port,
    );
    await flushPromises();
    await save();
    expect(client.put).not.toHaveBeenCalled();
  },
);

it.each(['create', 'edit'])(
  'pending details cannot overwrite a newer %s window',
  async (kind) => {
    await start([resource(7), resource(8)]);
    const pending = createDeferred<unknown>();
    client.get.mockReturnValueOnce(pending.promise);
    await action('查看', 0);
    await (kind === 'create' ? create() : action('编辑', 1));
    pending.resolve(resource(7));
    await flushPromises();
    expect(required(wrapper).find('[data-dialog="服务器详情"]').exists()).toBe(
      false,
    );
    expect(dialog(kind === 'edit').element.isConnected).toBe(true);
  },
);

it('detail A does not replace later detail B or accept mismatched IDs', async () => {
  await start([resource(7, 'host A'), resource(8, 'host B')]);
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await action('查看', 0);
  await action('查看', 1);
  pending.resolve(resource(7, 'host A'));
  await flushPromises();
  expect(required(wrapper).get('[data-dialog="服务器详情"]').text()).toContain(
    'host B',
  );
  client.get.mockResolvedValueOnce(resource(9));
  await action('查看', 0);
  expect(
    required(wrapper).get('[data-dialog="服务器详情"]').text(),
  ).not.toContain('host A');
});

it('deletion confirmation uses the captured saved ID once', async () => {
  await start();
  await action('删除');
  const pending = createDeferred<unknown>();
  client.delete.mockReturnValueOnce(pending.promise);
  const fn = required(confirmation().onOk);
  const first = fn();
  await fn();
  expect(client.delete).toHaveBeenCalledOnce();
  expect(client.delete).toHaveBeenCalledWith('/tree/local/delete/7');
  pending.resolve({});
  await first;
  await fn();
  expect(client.delete).toHaveBeenCalledOnce();
});

it.each(['owner', 'generation', 'permission', 'target', 'window', 'cancel'])(
  'deletion confirmation is refused after %s changes',
  async (change) => {
    await start();
    await action('删除');
    const fn = required(confirmation().onOk);
    if (change === 'owner') session.uid = '2';
    if (change === 'generation') session.generation += 1;
    if (change === 'permission') permissions.delete = false;
    if (change === 'target') row().id = 8;
    if (change === 'window') await create();
    if (change === 'cancel') confirmation().onCancel?.();
    await fn();
    expect(client.delete).not.toHaveBeenCalled();
  },
);

it('old deletion receipts do not refresh a new confirmation context', async () => {
  await start([resource(7), resource(8)]);
  await action('删除', 0);
  const pending = createDeferred<unknown>();
  client.delete.mockReturnValueOnce(pending.promise);
  const old = required(confirmation().onOk)();
  await action('删除', 1);
  const reads = client.get.mock.calls.length;
  pending.resolve({});
  await old;
  expect(client.get).toHaveBeenCalledTimes(reads);
  expect(message.success).not.toHaveBeenCalled();
  await accept();
  expect(client.delete).toHaveBeenCalledTimes(2);
});

it('terminal navigation uses only the saved resource ID despite unsaved SSH edits', async () => {
  await start();
  await action('编辑');
  await mode(1);
  await changePassword('fixture-unsaved');
  await dialog()
    .get('input[placeholder="192.168.1.100"]')
    .setValue('192.0.2.99');
  await action('连接终端');
  expect(navigation.push).toHaveBeenCalledWith({
    name: 'WebTerminal',
    params: { id: 7 },
  });
  expect(client.put).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});

it('owner transitions invalidate pending details without restoring private drafts', async () => {
  await start();
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await action('查看');
  session.generation += 1;
  pending.resolve(resource());
  await flushPromises();
  expect(required(wrapper).find('[data-dialog="服务器详情"]').exists()).toBe(
    false,
  );
  expect(message.error).not.toHaveBeenCalled();
});

it('unmount invalidates an in-flight detail without reopening UI, notifying, or reading again', async () => {
  await start();
  const pending = createDeferred<unknown>();
  client.get.mockReturnValueOnce(pending.promise);
  await action('查看');
  const reads = client.get.mock.calls.length;
  required(wrapper).unmount();
  wrapper = undefined;
  pending.resolve(resource());
  await flushPromises();
  expect(document.querySelector('[data-dialog="服务器详情"]')).toBeNull();
  expect(client.get).toHaveBeenCalledTimes(reads);
  expect(message.error).not.toHaveBeenCalled();
  expect(message.success).not.toHaveBeenCalled();
  expect(message.warning).not.toHaveBeenCalled();
});

it('does not publish an old post-delete reload after another confirmation opens', async () => {
  await start([resource(7), resource(8)]);
  await action('删除', 0);
  const refresh = createDeferred<unknown>();
  client.get.mockReturnValueOnce(refresh.promise);
  const old = required(confirmation().onOk)();
  await flushPromises();
  confirmation().onCancel?.();
  await action('删除', 1);
  refresh.resolve({ total: 1, items: [resource(99, 'late delete reload')] });
  await old;
  await flushPromises();
  expect(required(wrapper).text()).not.toContain('late delete reload');
  expect(
    required(required(wrapper).getComponent(Table).props('dataSource')).length,
  ).toBe(2);
});
