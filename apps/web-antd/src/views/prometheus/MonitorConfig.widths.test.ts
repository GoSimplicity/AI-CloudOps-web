import { defineComponent, h } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Select } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  ConfigStatus,
  ConfigType,
  type MonitorConfigItem,
} from '#/api/core/prometheus/prometheus_config';

import { createDeferred } from '../../../../../internal/test-utils/deferred';
import MonitorConfig from './MonitorConfig.vue';

type Mode = 'add' | 'edit';
const owner = vi.hoisted(() => ({
  create: true,
  generation: 0,
  id: 1,
  known: true,
  update: true,
}));
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
  usePermission: () => ({
    can: () => true,
    hasPerm: (code: string) =>
      owner.known &&
      (code === '/api/monitor/configs/create'
        ? owner.create
        : code === '/api/monitor/configs/update/:id' && owner.update),
  }),
}));
vi.mock('@iconify/vue', () => ({ Icon: () => null }));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required config width fixture is unavailable');
  return value;
}

// Modal/Table shells are isolated. Form/FormItem/Input/Select and validation are real AntD.
const Dialog = defineComponent({
  emits: ['cancel', 'ok'],
  props: { confirmLoading: Boolean, open: Boolean, title: String },
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h('section', { 'data-dialog': props.title }, [
            h(
              'button',
              { 'data-close': '', onClick: () => emit('cancel') },
              'close',
            ),
            h('button', { 'data-save': '', onClick: () => emit('ok') }, 'save'),
            slots.default?.(),
          ])
        : null;
  },
});

const Table = defineComponent({
  props: {
    columns: { default: () => [], type: Array },
    dataSource: { default: () => [], type: Array },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        props.dataSource.map((row) =>
          h(
            'div',
            props.columns.flatMap(
              (column) => slots.bodyCell?.({ column, record: row }) ?? [],
            ),
          ),
        ),
      );
  },
});

const record: MonitorConfigItem = {
  config_content: 'groups: []',
  config_hash: 'fixture',
  config_type: ConfigType.WebhookFile,
  created_at: '2026-11-04T00:00:00Z',
  id: 7,
  instance_ip: 'existing_custom_key',
  last_generated_time: 0,
  name: 'existing config',
  pool_id: 1,
  status: ConfigStatus.Active,
  updated_at: '2026-11-04T00:00:00Z',
};
const ipv6 = 'ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255';
const maxGroup = '9223372036854775807';
const groupOneKey = `${ipv6}_1`;
const maxGroupKey = `${ipv6}_${maxGroup}`;
const validCases = [
  ['one character', 'n', 'k'],
  [
    'generated name106/key47',
    `webhook_${'p'.repeat(50)}_1_${ipv6}`,
    groupOneKey,
  ],
  [
    'generated name124/key65',
    `webhook_${'p'.repeat(50)}_${maxGroup}_${ipv6}`,
    maxGroupKey,
  ],
  [
    'generated name174',
    `webhook_${'p'.repeat(100)}_${maxGroup}_${ipv6}`,
    maxGroupKey,
  ],
  ['name255', '配'.repeat(255), 'custom/sql_key'],
  ['emoji name255', '😀'.repeat(255), 'custom/sql_key'],
  ['key128', 'config', 'k'.repeat(128)],
  ['emoji key128', 'config', '😀'.repeat(128)],
  ['raw whitespace and Unicode', ' 配置 原样 ', ' SQL/custom[]💾 '],
] as const;
const invalidCases = [
  ['name256', 'n'.repeat(256), 'custom_key'],
  ['emoji name256', '😀'.repeat(256), 'custom_key'],
  ['key129', 'config', 'k'.repeat(129)],
  ['emoji key129', 'config', '😀'.repeat(129)],
  ['empty name', '', 'custom_key'],
  ['empty key', 'config', ''],
] as const;

let wrapper: undefined | VueWrapper;
beforeEach(() => {
  vi.resetAllMocks();
  owner.id = 1;
  owner.generation = 0;
  owner.create = true;
  owner.update = true;
  owner.known = true;
  client.get.mockImplementation((url: string) => {
    if (url === '/monitor/configs/list')
      return Promise.resolve({ total: 1, items: [record] });
    if (url === '/monitor/configs/detail/7') return Promise.resolve(record);
    return Promise.resolve({
      total: 1,
      items: [{ id: 1, name: 'owned pool' }],
    });
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  vi.stubGlobal('matchMedia', () => ({
    addListener() {},
    matches: false,
    removeListener() {},
  }));
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
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

async function mountPage() {
  wrapper = mount(MonitorConfig, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { AModal: Dialog, ATable: Table } },
  });
  await flushPromises();
}
async function start(mode: Mode) {
  await mountPage();
  if (mode === 'add')
    await required(wrapper).get('.btn-create').trigger('click');
  else {
    const edit = required(
      required(wrapper)
        .findAll('button')
        .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
    );
    await edit.trigger('click');
  }
  await flushPromises();
  return required(wrapper).get('[data-dialog]');
}
async function fill(mode: Mode, name: string, key: string) {
  const dialog = await start(mode);
  await dialog.get('input[placeholder="请输入配置名称"]').setValue(name);
  await dialog.get('input[placeholder="请输入实例IP"]').setValue(key);
  await dialog
    .get('textarea[placeholder="请输入配置内容"]')
    .setValue('groups: []');
  for (const [placeholder, value] of [
    ['请选择配置类型', ConfigType.WebhookFile],
    ['请选择实例池', 1],
  ] as const) {
    const select = required(
      required(wrapper)
        .findAllComponents(Select)
        .find((control) => control.props('placeholder') === placeholder),
    );
    select.vm.$emit('update:value', value);
  }
  await flushPromises();
  return dialog;
}
async function save() {
  await required(wrapper).get('[data-save]').trigger('click');
  await flushPromises();
}

it('uses real generator and Unicode codepoint width fixtures', () => {
  expect(ipv6.length).toBe(45);
  expect(groupOneKey.length).toBe(47);
  expect(maxGroupKey.length).toBe(65);
  expect(required(validCases[1])[1].length).toBe(106);
  expect(required(validCases[2])[1].length).toBe(124);
  expect(required(validCases[3])[1].length).toBe(174);
  expect('😀'.repeat(128).length).toBe(256);
  expect([...'😀'.repeat(128)]).toHaveLength(128);
});

for (const mode of ['add', 'edit'] as const) {
  it.each(validCases)(
    `${mode} submits %s without trimming or truncating`,
    async (_label, name, key) => {
      await fill(mode, name, key);
      await save();
      const method = mode === 'add' ? client.post : client.put;
      expect(method).toHaveBeenCalledOnce();
      expect(method).toHaveBeenCalledWith(
        mode === 'add'
          ? '/monitor/configs/create'
          : '/monitor/configs/update/7',
        expect.objectContaining({
          config_content: 'groups: []',
          config_type: ConfigType.WebhookFile,
          instance_ip: key,
          name,
          pool_id: 1,
          status: ConfigStatus.Active,
        }),
      );
    },
  );

  it.each(invalidCases)(
    `${mode} blocks %s through the real Form.validate path`,
    async (_label, name, key) => {
      await fill(mode, name, key);
      await save();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      expect(
        required(wrapper).findAll('.ant-form-item-explain-error').length,
      ).toBeGreaterThan(0);
    },
  );

  it.each(['owner', 'generation'] as const)(
    `${mode} rejects width-valid input after %s changes during validation`,
    async (boundary) => {
      await fill(mode, '配'.repeat(255), '😀'.repeat(128));
      const pending = required(wrapper).get('[data-save]').trigger('click');
      if (boundary === 'owner') owner.id = 2;
      else owner.generation++;
      await pending;
      await flushPromises();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
    },
  );
}

it('hides create/update entry points when permissions are unknown', async () => {
  owner.known = false;
  await mountPage();
  expect(required(wrapper).find('.btn-create').exists()).toBe(false);
  expect(
    required(wrapper)
      .findAll('button')
      .some((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  ).toBe(false);
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
});
for (const mode of ['add', 'edit'] as const) {
  it(`${mode} stops a real pending validation when its permission is revoked`, async () => {
    await fill(mode, 'valid name', 'valid_custom_key');
    const pending = required(wrapper).get('[data-save]').trigger('click');
    if (mode === 'add') owner.create = false;
    else owner.update = false;
    await pending;
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(required(wrapper).find('[data-dialog]').exists()).toBe(true);
  });
}

function pageState() {
  const state: unknown = Reflect.get(required(wrapper).vm.$, 'setupState');
  if (state === null || typeof state !== 'object')
    throw new Error('Expected config page state fixture');
  return state;
}
for (const mode of ['add', 'edit'] as const) {
  it(`${mode} denies a stale entry callback without closing the other window`, async () => {
    const previousMode = mode === 'add' ? 'edit' : 'add';
    const dialog = await fill(
      previousMode,
      'keep existing input',
      'keep_existing_key',
    );
    const previousTitle = dialog.attributes('data-dialog');
    if (mode === 'add') owner.create = false;
    else owner.update = false;
    const entry: unknown = Reflect.get(
      pageState(),
      mode === 'add' ? 'showAddModal' : 'showEditModal',
    );
    if (typeof entry !== 'function')
      throw new Error('Expected config entry fixture');
    if (mode === 'add') entry();
    else entry(record);
    await flushPromises();
    expect(required(wrapper).findAll('[data-dialog]')).toHaveLength(1);
    expect(
      required(wrapper).get('[data-dialog]').attributes('data-dialog'),
    ).toBe(previousTitle);
    expect(
      required(wrapper).get<HTMLInputElement>(
        'input[placeholder="请输入配置名称"]',
      ).element.value,
    ).toBe('keep existing input');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it(`${mode} keeps its window and suppresses success after permission is revoked during the API request`, async () => {
    await fill(mode, 'valid name', 'valid_custom_key');
    const pending = createDeferred<unknown>();
    const method = mode === 'add' ? client.post : client.put;
    method.mockReturnValueOnce(pending.promise);
    const success = vi.spyOn(message, 'success');
    await save();
    expect(method).toHaveBeenCalledOnce();
    if (mode === 'add') owner.create = false;
    else owner.update = false;
    pending.resolve({});
    await flushPromises();
    expect(required(wrapper).find('[data-dialog]').exists()).toBe(true);
    expect(success).not.toHaveBeenCalled();
  });
}

it('keeps a read-only detail window without exposing its update button', async () => {
  owner.update = false;
  await mountPage();
  const view = required(
    required(wrapper)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '查看'),
  );
  await view.trigger('click');
  await flushPromises();
  const detail = required(wrapper).get('[data-dialog="配置详情"]');
  expect(detail.text()).toContain(record.name);
  expect(
    detail
      .findAll('button')
      .some((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  ).toBe(false);
  expect(client.post).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
});
