import type { VueWrapper } from '@vue/test-utils';

import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SECRET_DETAIL_PERMISSION_CODE,
  SECRET_REVEAL_PERMISSION_CODE,
} from '#/constants/permission-codes';

/**
 * SEC-25/26 第 4 条（窝窝头复审）：详情与明文分层。
 * - 「查看详情」由详情码（普通权限体系，角色 / 通配按旧规则）控制；
 * - 每个键的「查看 / 复制」只给精确 reveal 码或用户名 admin（显式授权门禁）。
 * 全部假值。
 */
vi.setConfig({ testTimeout: 15_000 });

const api = vi.hoisted(() => ({
  clusters: vi.fn(),
  namespaces: vi.fn(),
  secrets: vi.fn(),
  detail: vi.fn(),
  reveal: vi.fn(),
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
  getSecretListApi: api.secrets,
  getSecretDetailsApi: api.detail,
  revealSecretApi: api.reveal,
}));

const FAKE = 'fake-layer-value-for-test';

let wrapper: undefined | VueWrapper<any>;
const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
const all = (selector: string) => [
  ...document.body.querySelectorAll<HTMLElement>(selector),
];
const detailButtons = () => all('.ant-table-tbody button[title="查看详情"]');

function setSubject(userInfo: Record<string, unknown>, codes: string[]) {
  useUserStore().setUserInfo(userInfo as any);
  useAccessStore().setAccessCodes(codes);
}

async function mountSecret() {
  const component = (await import('./Secret.vue')).default;
  wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await settle();
}

/** 真实点击行内「查看详情」，走 getSecretDetailsApi */
async function openDetailByClick() {
  const buttons = detailButtons();
  expect(buttons).toHaveLength(1);
  buttons[0]!.click();
  await settle();
  expect(api.detail).toHaveBeenCalledTimes(1);
  const text = document.body.textContent ?? '';
  expect(text).toContain('加密数据内容');
  expect(text).toContain('敏感数据已脱敏');
  expect(text).toContain('token');
  expect(text).toContain('25 bytes');
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
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  api.clusters.mockResolvedValue({
    items: [{ id: 1, name: 'c1', status: 1 }],
    total: 1,
  });
  api.namespaces.mockResolvedValue({
    items: [{ cluster_id: 1, name: 'ns-a' }],
    total: 1,
  });
  api.secrets.mockResolvedValue({
    items: [{ cluster_id: 1, namespace: 'ns-a', name: 'secret-a', type: 1 }],
    total: 1,
  });
  api.detail.mockResolvedValue({
    cluster_id: 1,
    namespace: 'ns-a',
    name: 'secret-a',
    type: 1,
    data: { token: '' },
    data_keys: [{ key: 'token', size: 25 }],
    redacted: true,
  });
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Secret 详情与明文分层（第 4 条）', () => {
  it('只有详情码：能打开详情、只见脱敏内容、没有查看 / 复制按钮、不调 reveal', async () => {
    setSubject({ roles: ['ops'], username: 'ops' }, [
      SECRET_DETAIL_PERMISSION_CODE,
    ]);
    await mountSecret();
    await openDetailByClick();
    expect(all('.secret-data-keys .secret-view-plain')).toHaveLength(0);
    expect(all('.secret-data-keys .secret-hide-plain')).toHaveLength(0);
    expect(all('.secret-data-keys .secret-copy-plain')).toHaveLength(0);
    expect(all('.secret-data-plain')).toHaveLength(0);
    expect(document.body.textContent).not.toContain(FAKE);
    expect(api.reveal).not.toHaveBeenCalled();
  });

  it('详情码 + reveal 码：能打开详情，查看 / 复制按钮都在，点「查看」才调 reveal', async () => {
    setSubject({ roles: ['ops'], username: 'ops' }, [
      SECRET_DETAIL_PERMISSION_CODE,
      SECRET_REVEAL_PERMISSION_CODE,
    ]);
    await mountSecret();
    await openDetailByClick();
    expect(all('.secret-data-keys .secret-copy-plain')).toHaveLength(1);
    expect(api.reveal).not.toHaveBeenCalled();
    const view = all('.secret-data-keys .secret-view-plain');
    expect(view).toHaveLength(1);
    view[0]!.click();
    await settle();
    expect(api.reveal).toHaveBeenCalledTimes(1);
    expect(all('.secret-data-plain')[0]?.textContent).toBe(FAKE);
  });

  it('两者都没有：没有「查看详情」入口，不调详情也不调 reveal', async () => {
    setSubject({ roles: ['ops'], username: 'ops' }, []);
    await mountSecret();
    expect(all('.ant-table-tbody tr').length).toBeGreaterThan(0);
    expect(detailButtons()).toHaveLength(0);
    expect(api.detail).not.toHaveBeenCalled();
    expect(api.reveal).not.toHaveBeenCalled();
  });

  it('只有 reveal 码（无详情码）：没有「查看详情」入口', async () => {
    setSubject({ roles: ['ops'], username: 'ops' }, [
      SECRET_REVEAL_PERMISSION_CODE,
    ]);
    await mountSecret();
    expect(detailButtons()).toHaveLength(0);
  });

  it('admin 角色（非 admin 用户名）+ 空码：详情按旧规则放行，但没有查看 / 复制按钮', async () => {
    setSubject({ roles: ['admin'], username: 'zhangsan' }, []);
    await mountSecret();
    await openDetailByClick();
    expect(all('.secret-data-keys .secret-view-plain')).toHaveLength(0);
    expect(all('.secret-data-keys .secret-copy-plain')).toHaveLength(0);
    expect(api.reveal).not.toHaveBeenCalled();
  });

  it('用户名 admin + 空码：详情与查看 / 复制都放行（auth.go:170）', async () => {
    setSubject({ username: 'admin' }, []);
    await mountSecret();
    await openDetailByClick();
    expect(all('.secret-data-keys .secret-view-plain')).toHaveLength(1);
    expect(all('.secret-data-keys .secret-copy-plain')).toHaveLength(1);
  });
});
