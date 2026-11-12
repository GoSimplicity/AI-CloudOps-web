import { defineComponent, h } from 'vue';

import {
  type DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Select } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigStatus,
  ConfigType,
  type MonitorConfigItem,
} from '#/api/core/prometheus/prometheus_config';

import MonitorConfig from './MonitorConfig.vue';

const SECRET_HINT =
  '保留 <secret> 表示沿用原凭据，要改就填真实值。修改 Alertmanager 发送目标，或凭据位于自定义配置段时，需要重新填写真实凭据，不能保留 <secret>。';
const HIDDEN_HINT =
  '原配置无法解析，内容已隐藏；不改内容直接保存会保留原配置，若在此填写新内容将整体替换原配置。';
const CREATE_SECRET_MESSAGE = '创建配置不能包含凭据占位符，请填写真实凭据';
const CREATE_HIDDEN_MESSAGE = '配置内容为隐藏占位，请填写完整配置';
const HIDDEN_CONTENT = '配置解析失败，已隐藏内容';
const SECRET_CONTENT =
  '\nreceivers:\n- name: local\n  authorization:\n    credentials: <secret> \n';
const PADDED_HIDDEN = ` \n${HIDDEN_CONTENT}\t`;

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
    throw new Error('Required config credential fixture is unavailable');
  return value;
}

const Dialog = defineComponent({
  emits: ['cancel', 'ok'],
  props: {
    confirmLoading: Boolean,
    okButtonProps: { default: undefined, type: Object },
    open: Boolean,
    title: String,
  },
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h('section', { 'data-dialog': props.title }, [
            h(
              'button',
              { 'data-close': '', onClick: () => emit('cancel') },
              'close',
            ),
            h(
              'button',
              {
                'data-save': '',
                disabled: Boolean(props.okButtonProps?.disabled),
                onClick: () => emit('ok'),
              },
              'save',
            ),
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

function config(content: string): MonitorConfigItem {
  return {
    config_content: content,
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
}

let wrapper: undefined | VueWrapper;
let listed: MonitorConfigItem;
let detailed: MonitorConfigItem;

beforeEach(() => {
  vi.resetAllMocks();
  owner.id = 1;
  owner.generation = 0;
  listed = config('groups: []');
  detailed = config('groups: []');
  client.get.mockImplementation((url: string) => {
    if (url === '/monitor/configs/list')
      return Promise.resolve({ total: 1, items: [listed] });
    if (url === '/monitor/configs/detail/7') return Promise.resolve(detailed);
    return Promise.resolve({
      total: 1,
      items: [{ id: 1, name: 'owned pool' }],
    });
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  vi.spyOn(message, 'warning');
  vi.spyOn(message, 'success');
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
async function openEditFromList() {
  await mountPage();
  const edit = required(
    required(wrapper)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  );
  await edit.trigger('click');
  await flushPromises();
  return required(wrapper).get('[data-dialog="编辑监控配置"]');
}
async function openEditFromDetail() {
  await mountPage();
  const view = required(
    required(wrapper)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '查看'),
  );
  await view.trigger('click');
  await flushPromises();
  const detail = required(wrapper).get('[data-dialog="配置详情"]');
  const edit = required(
    detail
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '编辑'),
  );
  await edit.trigger('click');
  await flushPromises();
  return required(wrapper).get('[data-dialog="编辑监控配置"]');
}
async function openCreate() {
  await mountPage();
  await required(wrapper).get('.btn-create').trigger('click');
  await flushPromises();
  return required(wrapper).get('[data-dialog="新增监控配置"]');
}
async function fillCreate(content: string) {
  const dialog = await openCreate();
  await dialog
    .get('input[placeholder="请输入配置名称"]')
    .setValue('new config');
  await dialog.get('input[placeholder="请输入实例IP"]').setValue('custom_key');
  await dialog.get('textarea[placeholder="请输入配置内容"]').setValue(content);
  const page = required(wrapper);
  for (const [placeholder, value] of [
    ['请选择配置类型', ConfigType.WebhookFile],
    ['请选择实例池', 1],
  ] as const) {
    const select = required(
      page
        .findAllComponents(Select)
        .find((control) => control.props('placeholder') === placeholder),
    );
    select.vm.$emit('update:value', value);
  }
  await flushPromises();
  return dialog;
}
type DialogRoot = Pick<DOMWrapper<Element>, 'find' | 'get' | 'text'>;

async function save(dialog: DialogRoot) {
  await dialog.get('[data-save]').trigger('click');
  await flushPromises();
}
function putBody() {
  return required(client.put.mock.calls.at(-1))[1] as {
    config_content: string;
    name: string;
  };
}
function contentBox(dialog: DialogRoot) {
  return dialog.get<HTMLTextAreaElement>(
    'textarea[placeholder="请输入配置内容"]',
  );
}

describe('监控配置凭据占位', () => {
  it('编辑内容含 <secret> 时在编辑框旁显示 info 提示', async () => {
    listed = config(SECRET_CONTENT);
    const dialog = await openEditFromList();
    const alert = dialog.get('.ant-alert-info');
    expect(alert.text()).toContain(SECRET_HINT);
    expect(alert.text()).toContain('<secret>');
    expect(alert.text()).toContain(
      '修改 Alertmanager 发送目标，或凭据位于自定义配置段时，需要重新填写真实凭据，不能保留 <secret>',
    );
    expect(dialog.find('.ant-alert-warning').exists()).toBe(false);
    expect(contentBox(dialog).element.value).toBe(SECRET_CONTENT);
  });

  it('编辑内容不含 <secret> 时不显示凭据提示', async () => {
    const dialog = await openEditFromList();
    expect(dialog.find('.ant-alert-info').exists()).toBe(false);
    expect(dialog.text()).not.toContain(SECRET_HINT);
    expect(dialog.find('.ant-alert-warning').exists()).toBe(false);
  });

  it('去掉 <secret> 后 info 提示消失', async () => {
    listed = config(SECRET_CONTENT);
    const dialog = await openEditFromList();
    expect(dialog.find('.ant-alert-info').exists()).toBe(true);
    await contentBox(dialog).setValue('receivers: []\n');
    expect(dialog.find('.ant-alert-info').exists()).toBe(false);
  });

  it('列表编辑提交内容与原文逐字节一致', async () => {
    listed = config(SECRET_CONTENT);
    const dialog = await openEditFromList();
    await save(dialog);
    expect(client.put).toHaveBeenCalledOnce();
    expect(client.put).toHaveBeenCalledWith(
      '/monitor/configs/update/7',
      expect.objectContaining({ config_content: SECRET_CONTENT }),
    );
    expect(putBody().config_content).toBe(SECRET_CONTENT);
    expect(putBody().config_content.includes('<secret>')).toBe(true);
    expect(message.warning).not.toHaveBeenCalled();
  });

  it('自定义段里的 <secret> 编辑时不拦截，请求原样发出', async () => {
    const content = 'extra:\n  bearer_token: <secret>\n';
    listed = config(content);
    const dialog = await openEditFromList();
    expect(dialog.get('.ant-alert-info').text()).toContain(SECRET_HINT);
    await save(dialog);
    expect(client.put).toHaveBeenCalledOnce();
    expect(putBody().config_content).toBe(content);
    expect(message.warning).not.toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('更新配置成功');
  });

  it('详情入口用详情内容填编辑框，提交与详情原文逐字节一致', async () => {
    listed = config('groups: []');
    detailed = config(SECRET_CONTENT);
    const dialog = await openEditFromDetail();
    expect(dialog.get('.ant-alert-info').text()).toContain(SECRET_HINT);
    expect(contentBox(dialog).element.value).toBe(SECRET_CONTENT);
    await save(dialog);
    expect(putBody().config_content).toBe(SECRET_CONTENT);
    expect(putBody().config_content).not.toBe(listed.config_content);
  });

  it('把 <secret> 换成新值后按输入原样提交', async () => {
    listed = config(SECRET_CONTENT);
    const dialog = await openEditFromList();
    const replacement = SECRET_CONTENT.replace('<secret>', 'replaced-value');
    await contentBox(dialog).setValue(replacement);
    await save(dialog);
    expect(putBody().config_content).toBe(replacement);
    expect(putBody().config_content.includes('<secret>')).toBe(false);
  });

  it('解析失败占位显示 warning，原样提交仍然发出且内容一致', async () => {
    listed = config(PADDED_HIDDEN);
    const dialog = await openEditFromList();
    expect(dialog.get('.ant-alert-warning').text()).toContain(HIDDEN_HINT);
    expect(dialog.find('.ant-alert-info').exists()).toBe(false);
    expect(dialog.get('[data-save]').attributes('disabled')).toBeUndefined();
    await save(dialog);
    expect(client.put).toHaveBeenCalledOnce();
    expect(putBody().config_content).toBe(PADDED_HIDDEN);
    expect(message.warning).not.toHaveBeenCalled();
  });

  it('只改名称时隐藏占位内容仍原样提交', async () => {
    listed = config(HIDDEN_CONTENT);
    const dialog = await openEditFromList();
    await dialog
      .get('input[placeholder="请输入配置名称"]')
      .setValue('renamed config');
    await save(dialog);
    expect(client.put).toHaveBeenCalledOnce();
    expect(putBody()).toEqual(
      expect.objectContaining({
        config_content: HIDDEN_CONTENT,
        name: 'renamed config',
      }),
    );
  });

  it('把隐藏占位改成新内容后提交新内容', async () => {
    listed = config(HIDDEN_CONTENT);
    const dialog = await openEditFromList();
    const replacement = 'receivers: []\n';
    await contentBox(dialog).setValue(replacement);
    expect(dialog.find('.ant-alert-warning').exists()).toBe(false);
    await save(dialog);
    expect(putBody().config_content).toBe(replacement);
  });

  it('创建内容含 <secret> 时提交前拦截', async () => {
    const dialog = await fillCreate(SECRET_CONTENT);
    await save(dialog);
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(CREATE_SECRET_MESSAGE);
    expect(message.success).not.toHaveBeenCalled();
    expect(
      required(wrapper).find('[data-dialog="新增监控配置"]').exists(),
    ).toBe(true);
  });

  it('创建内容去掉首尾空白后是隐藏占位时拦截', async () => {
    const dialog = await fillCreate(PADDED_HIDDEN);
    await save(dialog);
    expect(client.post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(CREATE_HIDDEN_MESSAGE);
    expect(message.success).not.toHaveBeenCalled();
  });

  it('创建内容只是包含隐藏文案而不是整段占位时仍可提交', async () => {
    const content = `${HIDDEN_CONTENT}\nreceivers: []\n`;
    await fillCreate(content);
    await save(required(wrapper).get('[data-dialog="新增监控配置"]'));
    expect(client.post).toHaveBeenCalledOnce();
    expect(client.post.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ config_content: content }),
    );
    expect(message.warning).not.toHaveBeenCalled();
  });
});
