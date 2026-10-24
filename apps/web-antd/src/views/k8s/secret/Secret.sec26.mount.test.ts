import type { VueWrapper } from '@vue/test-utils';

import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SECRET_REVEAL_PERMISSION_CODE } from '#/constants/permission-codes';

import { EMPTY_VALUE_MESSAGE } from './secret-data';

/** SEC-25/26 Secret 页面挂载级断言（假值） */
vi.setConfig({ testTimeout: 15_000 });

const api = vi.hoisted(() => ({
  clusters: vi.fn(),
  namespaces: vi.fn(),
  secrets: vi.fn(),
  detail: vi.fn(),
  reveal: vi.fn(),
  update: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_cluster')>()),
  getClustersListApi: api.clusters,
}));
vi.mock('#/api/core/k8s/k8s_namespace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_namespace')>()),
  getNamespacesListApi: api.namespaces,
}));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>()),
  getSecretDetailsApi: api.detail,
  getSecretListApi: api.secrets,
  revealSecretApi: api.reveal,
  updateSecretApi: api.update,
}));

const FAKE = 'fake-mount-value-for-test';
const DETAIL = {
  cluster_id: 1,
  namespace: 'ns-a',
  name: 'secret-a',
  type: 'Opaque',
  labels: [],
  annotations: [],
  data: { token: '' },
  data_keys: [{ key: 'token', size: 25 }],
  redacted: true,
  string_data: {},
};

let wrapper: undefined | VueWrapper<any>;
const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
const all = (selector: string) => [
  ...document.body.querySelectorAll<HTMLElement>(selector),
];

async function mountSecret() {
  const component = (await import('./Secret.vue')).default;
  wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await settle();
  return wrapper.vm as any;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
  useAccessStore().setAccessCodes([SECRET_REVEAL_PERMISSION_CODE]);
  api.clusters.mockResolvedValue({ items: [], total: 0 });
  api.namespaces.mockResolvedValue({ items: [], total: 0 });
  api.secrets.mockResolvedValue({ items: [], total: 0 });
  api.detail.mockResolvedValue({ ...DETAIL });
  api.reveal.mockResolvedValue({
    data: { token: btoa(FAKE) },
    string_data: {},
    keys: ['token'],
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('Secret 详情：脱敏展示 + 按键 reveal', () => {
  it('打开时不出现明文；点「查看」后才调 reveal 并展示；隐藏 / 关闭后明文从页面消失', async () => {
    const vm = await mountSecret();
    vm.currentSecretDetail = { ...DETAIL };
    vm.isDetailModalVisible = true;
    await settle();
    expect(document.body.textContent).toContain('25 bytes');
    expect(document.body.textContent).not.toContain(FAKE);
    expect(api.reveal).not.toHaveBeenCalled();

    all('.secret-data-keys button.secret-view-plain')[0]!.click();
    await settle();
    expect(api.reveal).toHaveBeenCalledWith({
      cluster_id: 1,
      namespace: 'ns-a',
      name: 'secret-a',
      keys: ['token'],
    });
    expect(all('.secret-data-plain')[0]?.textContent).toBe(FAKE);

    all('.secret-data-keys button.secret-hide-plain')[0]!.click();
    await settle();
    expect(document.body.textContent).not.toContain(FAKE);

    all('.secret-data-keys button.secret-view-plain')[0]!.click();
    await settle();
    vm.closeDetailModal();
    await settle();
    expect(vm.revealedValues).toEqual({});
    expect(document.body.textContent).not.toContain(FAKE);
  });
});

describe('Secret 编辑：data 行', () => {
  it('原有键输入框为空；改成空值时表单内提示「不支持设为空值，请删除该键」', async () => {
    const vm = await mountSecret();
    await vm.openEditModal({ ...DETAIL });
    await settle();
    const input = document.body.querySelector<HTMLInputElement>(
      '.secret-edit-data-row input[type="password"]',
    );
    expect(input).not.toBeNull();
    expect(input!.value).toBe('');
    expect(input!.placeholder).toBe('已脱敏，留空保留原值');
    expect(document.body.textContent).not.toContain(EMPTY_VALUE_MESSAGE);

    input!.value = FAKE;
    input!.dispatchEvent(new Event('input'));
    await settle();
    input!.value = '';
    input!.dispatchEvent(new Event('input'));
    await settle();
    expect(document.body.textContent).toContain(EMPTY_VALUE_MESSAGE);
    expect(document.body.textContent).toContain('撤销修改');
  });
});

describe('Secret 编辑：打开时重新拉详情（P2/P3-2）', () => {
  it('详情返回前：加密数据区加载中、不显示「暂无加密数据」、保存按钮禁用；返回后按最新键渲染', async () => {
    let resolve!: (value: unknown) => void;
    api.detail.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    const vm = await mountSecret();
    const opening = vm.openEditModal({
      ...DETAIL,
      data_keys: [{ key: 'stale-key', size: 1 }],
    });
    await settle();
    const okButton = () =>
      all('.ant-modal-footer button.ant-btn-primary').at(-1)!;
    expect(
      document.body.querySelector('.secret-edit-data .ant-spin-spinning'),
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain('暂无加密数据');
    expect(document.body.textContent).not.toContain('stale-key');
    expect(okButton().hasAttribute('disabled')).toBe(true);

    resolve({ ...DETAIL });
    await opening;
    await settle();
    expect(
      document.body.querySelector('.secret-edit-data .ant-spin-spinning'),
    ).toBeNull();
    expect(all('.secret-edit-data-row').map((row) => row.dataset.key)).toEqual([
      'token',
    ]);
    expect(okButton().hasAttribute('disabled')).toBe(false);
  });
});

describe('Secret 编辑：详情加载中「添加」按钮禁用（incr5）', () => {
  it('加载中 data / string_data / 标签 / 注解的「添加」都禁用、点了不生效；加载完可用', async () => {
    let resolve!: (value: unknown) => void;
    api.detail.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    const vm = await mountSecret();
    const opening = vm.openEditModal({ ...DETAIL });
    await settle();
    const inputs = () => all('.secret-edit-form .add-input-row input');
    const buttons = () => all('.secret-edit-form .add-input-row button');
    expect(inputs()).toHaveLength(4);
    expect(buttons()).toHaveLength(4);
    // 键名都填上，排除「键名为空」导致的禁用
    for (const [index, input] of inputs().entries()) {
      (input as HTMLInputElement).value = `fake-key-${index}`;
      input.dispatchEvent(new Event('input'));
    }
    await settle();
    for (const button of buttons()) {
      expect(button.hasAttribute('disabled')).toBe(true);
      button.click();
    }
    await settle();
    expect(vm.editDataRows).toEqual([]);
    expect(vm.editFormModel.string_data).toEqual({});
    expect(vm.editFormModel.labels).toEqual({});
    expect(vm.editFormModel.annotations).toEqual({});

    resolve({ ...DETAIL, data_keys: [], data: {} });
    await opening;
    await settle();
    for (const button of buttons()) {
      expect(button.hasAttribute('disabled')).toBe(false);
      button.click();
      await settle();
    }
    expect(vm.editDataRows.map((row: { key: string }) => row.key)).toEqual([
      'fake-key-0',
    ]);
    expect(Object.keys(vm.editFormModel.string_data)).toEqual(['fake-key-1']);
    expect(Object.keys(vm.editFormModel.labels)).toEqual(['fake-key-2']);
    expect(Object.keys(vm.editFormModel.annotations)).toEqual(['fake-key-3']);
  });
});

describe('Secret 编辑：详情加载中回车也不能添加（incr6 遗留第 18 条）', () => {
  const pressEnter = (input: HTMLElement) =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        keyCode: 13,
      }),
    );

  it('加载中在 data / string_data / 标签 / 注解的键名框里回车：什么都不加；加载完回车照常添加', async () => {
    let resolve!: (value: unknown) => void;
    api.detail.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    const vm = await mountSecret();
    const opening = vm.openEditModal({ ...DETAIL });
    await settle();
    const inputs = () => all('.secret-edit-form .add-input-row input');
    expect(inputs()).toHaveLength(4);
    for (const [index, input] of inputs().entries()) {
      (input as HTMLInputElement).value = `fake-key-${index}`;
      input.dispatchEvent(new Event('input'));
    }
    await settle();
    for (const input of inputs()) pressEnter(input);
    await settle();
    expect(vm.editDataLoading).toBe(true);
    expect(vm.editDataRows).toEqual([]);
    expect(vm.editFormModel.string_data).toEqual({});
    expect(vm.editFormModel.labels).toEqual({});
    expect(vm.editFormModel.annotations).toEqual({});

    resolve({ ...DETAIL, data_keys: [], data: {} });
    await opening;
    await settle();
    for (const input of inputs()) {
      pressEnter(input);
      await settle();
    }
    expect(vm.editDataRows.map((row: { key: string }) => row.key)).toEqual([
      'fake-key-0',
    ]);
    expect(Object.keys(vm.editFormModel.string_data)).toEqual(['fake-key-1']);
    expect(Object.keys(vm.editFormModel.labels)).toEqual(['fake-key-2']);
    expect(Object.keys(vm.editFormModel.annotations)).toEqual(['fake-key-3']);
  });
});

describe('Secret YAML 编辑：脱敏说明（P2-1）', () => {
  it('说明裸 <redacted> 保留原值、带引号会被拦截；不再提示「删除不改的键」', async () => {
    const vm = await mountSecret();
    vm.currentOperationSecret = { ...DETAIL };
    vm.isYamlModalVisible = true;
    await settle();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Secret 数据已脱敏');
    expect(text).not.toContain('删除不改的键');
    expect(text).not.toContain('含 <redacted> 的 YAML 不会提交');
    expect(text).toContain('保留集群中的原值');
    expect(text).toContain('整体覆盖');
  });

  it('第四轮：说明写在 | / > 块标量里的 <redacted> 也会被拦截', async () => {
    const vm = await mountSecret();
    vm.currentOperationSecret = { ...DETAIL };
    vm.isYamlModalVisible = true;
    await settle();
    const text = document.body.textContent ?? '';
    expect(text).toContain('块标量');
  });
});
