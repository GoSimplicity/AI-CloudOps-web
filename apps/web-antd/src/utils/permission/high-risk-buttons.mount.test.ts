import type { Component } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ALL_PERMISSION_CODES,
  type PermissionKey,
  SECRET_DETAIL_PERMISSION_CODE,
} from '#/constants/permission-codes';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

/**
 * FE-02 v3 一审 P3-1：高危按钮挂载级断言（码集口径见清单 v4 6.1）。
 * permission-coverage.test 只按源码字符串找 can('key')，写在注释里或写成 `can(x) || true` 也能通过；
 * 这里挂载真实页面组件、走真实 usePermission，给一个非 admin、没有对应码的账号断言按钮不渲染，
 * 给上该码后断言按钮渲染。Node 禁用 / 启用 / 批量禁用调度的挂载断言在 views/k8s/node/Node.batchCordon.test.ts。
 */

// 挂载完整页面（antd Table + Modal）在满载 CI 上单条可能超过默认 5s
vi.setConfig({ testTimeout: 15_000 });

const api = vi.hoisted(() => ({
  auditLogs: vi.fn(),
  clusters: vi.fn(),
  deployments: vi.fn(),
  namespaces: vi.fn(),
  pods: vi.fn(),
  secretDetail: vi.fn(),
  secrets: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_cluster')>()),
  getClustersListApi: api.clusters,
}));
vi.mock('#/api/core/k8s/k8s_namespace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_namespace')>()),
  getNamespacesListApi: api.namespaces,
}));
vi.mock('#/api/core/k8s/k8s_pod', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_pod')>()),
  getK8sPodList: api.pods,
}));
vi.mock('#/api/core/k8s/k8s_deployment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_deployment')>()),
  getDeploymentListApi: api.deployments,
}));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>()),
  getSecretDetailsApi: api.secretDetail,
  getSecretListApi: api.secrets,
}));
vi.mock('#/api/core/system/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/system/audit')>()),
  getAuditStatisticsApi: vi.fn(async () => ({})),
  getAuditTypesApi: vi.fn(async () => []),
  listAuditLogsApi: api.auditLogs,
}));
vi.mock('#/api/core/system/user', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/system/user')>()),
  getUserDetailApi: vi.fn(async () => ({ id: 1, username: 'ops' })),
}));

const pages = {
  Deployment: () => import('#/views/k8s/deployment/Deployment.vue'),
  Namespace: () => import('#/views/k8s/namespace/Namespace.vue'),
  Pod: () => import('#/views/k8s/pod/Pod.vue'),
  Secret: () => import('#/views/k8s/secret/Secret.vue'),
  SystemAudit: () => import('#/views/dashboard/SystemAudit.vue'),
};

let wrapper: undefined | VueWrapper<any>;

/** 不属于清单按钮 key 的路由码（SEC-25/26 第 4 条：Secret 详情码），直接以码字符串参与 */
type Gate = PermissionKey | typeof SECRET_DETAIL_PERMISSION_CODE;

function codeOf(gate: Gate): string {
  return gate === SECRET_DETAIL_PERMISSION_CODE
    ? gate
    : ALL_PERMISSION_CODES[gate];
}

function setSubject(keys: Gate[]) {
  useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
  useAccessStore().setAccessCodes(keys.map((key) => codeOf(key)));
}

async function mountPage(page: keyof typeof pages) {
  const component = ((await pages[page]()) as { default: Component }).default;
  wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  for (let i = 0; i < 5; i += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const all = (selector: string) => [
  ...document.body.querySelectorAll<HTMLElement>(selector),
];
const rowButtons = (title: string) =>
  all(`.ant-table-tbody button[title="${title}"]`);
const buttonsByText = (text: string, scope = 'body') =>
  all(`${scope} button`).filter((button) =>
    (button.textContent ?? '').replaceAll(/\s/g, '').includes(text),
  );

/** 真实点击表格第一行的勾选框 */
async function selectFirstRow() {
  const box = document.body.querySelector<HTMLInputElement>(
    '.ant-table-tbody .ant-checkbox-input',
  );
  expect(box).not.toBeNull();
  required(box).click();
  await flushPromises();
}

/** 打开 Secret 详情弹窗并填入脱敏详情（值为空，只有 data_keys） */
async function openRedactedSecretDetail() {
  const vm = required(wrapper).vm as any;
  vm.currentSecretDetail = {
    annotations: [],
    cluster_id: 1,
    data: { token: '' },
    data_keys: [{ key: 'token', size: 16 }],
    labels: [],
    name: 'secret-a',
    namespace: 'ns-a',
    redacted: true,
    string_data: {},
    type: 1,
  };
  vm.isDetailModalVisible = true;
  for (let i = 0; i < 3; i += 1) await flushPromises();
  expect(document.body.textContent).toContain('加密数据内容');
  expect(document.body.textContent).toContain('token');
  expect(document.body.textContent).toContain('16 bytes');
}

type Case = {
  /** 返回被测按钮的渲染结果 */
  find: () => HTMLElement[];
  /** 被测按钮 key（或非清单路由码） */
  key: Gate;
  /** 用例名 */
  name: string;
  page: keyof typeof pages;
  /** 挂载后到达按钮所在界面的操作（勾选行、打开详情） */
  prepare?: () => Promise<void>;
  /** 打开按钮所在界面所需的其它码（不含被测 key） */
  prerequisite?: Gate[];
};

const CASES: Case[] = [
  {
    find: () => rowButtons('删除'),
    key: 'k8s.pod.delete',
    name: 'Pod 行内删除',
    page: 'Pod',
  },
  {
    find: () => all('button[title="批量删除选中的 Pod"]'),
    key: 'k8s.pod.batchDelete',
    name: 'Pod 批量删除',
    page: 'Pod',
    prepare: selectFirstRow,
  },
  {
    find: () => rowButtons('删除'),
    key: 'k8s.deployment.delete',
    name: 'Deployment 行内删除',
    page: 'Deployment',
  },
  {
    find: () => all('button[title="批量删除选中的 Deployment"]'),
    key: 'k8s.deployment.batchDelete',
    name: 'Deployment 批量删除',
    page: 'Deployment',
    prepare: selectFirstRow,
  },
  {
    find: () => rowButtons('删除'),
    key: 'k8s.namespace.delete',
    name: '命名空间行内删除',
    page: 'Namespace',
  },
  {
    find: () => rowButtons('强制删除'),
    key: 'k8s.namespace.forceDelete',
    name: '命名空间强制删除（Terminating）',
    page: 'Namespace',
  },
  {
    find: () => all('button[title="批量删除选中的命名空间"]'),
    key: 'k8s.namespace.batchDelete',
    name: '命名空间批量删除',
    page: 'Namespace',
    prepare: selectFirstRow,
  },
  {
    find: () => rowButtons('查看详情'),
    key: SECRET_DETAIL_PERMISSION_CODE,
    // SEC-25/26 第 4 条：详情入口改由详情码控制（不再用 viewPlain/reveal 码）
    name: 'Secret 查看详情（详情码）',
    page: 'Secret',
  },
  {
    find: () => rowButtons('查看 YAML'),
    key: 'k8s.secret.viewYaml',
    name: 'Secret 查看 YAML',
    page: 'Secret',
  },
  {
    find: () => buttonsByText('复制内容', '.secret-data-keys'),
    key: 'k8s.secret.copyPlain',
    name: 'Secret 复制明文（详情弹窗内）',
    page: 'Secret',
    // SEC-25/26：copyPlain 与 viewPlain 同为 reveal 码，这里直接把详情弹窗置为打开并填入脱敏详情
    // （只有键名与字节数），只验证复制按钮本身的门禁；详情里不应出现任何明文。
    prepare: openRedactedSecretDetail,
  },
  {
    find: () => all('.secret-data-keys button.secret-view-plain'),
    key: 'k8s.secret.viewPlain',
    name: 'Secret 按键查看明文（详情弹窗内，调 reveal）',
    page: 'Secret',
    prepare: openRedactedSecretDetail,
  },
  {
    find: () => buttonsByText('删除', '.ant-table-tbody'),
    key: 'system.audit.delete',
    name: '审计行内删除',
    page: 'SystemAudit',
  },
  {
    find: () => buttonsByText('批量删除'),
    key: 'system.audit.batchDelete',
    name: '审计批量删除',
    page: 'SystemAudit',
    prepare: selectFirstRow,
  },
];

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    computedStyle(element),
  );
  api.clusters.mockResolvedValue({
    total: 1,
    items: [{ id: 1, name: 'c1', status: 1 }],
  });
  api.namespaces.mockResolvedValue({
    total: 1,
    items: [{ cluster_id: 1, name: 'ns-a', status: 'Terminating' }],
  });
  api.pods.mockResolvedValue({
    total: 1,
    items: [{ cluster_id: 1, name: 'pod-a', namespace: 'ns-a', status: 1 }],
  });
  api.deployments.mockResolvedValue({
    total: 1,
    items: [{ cluster_id: 1, name: 'deploy-a', namespace: 'ns-a', status: 1 }],
  });
  api.secrets.mockResolvedValue({
    total: 1,
    items: [{ cluster_id: 1, name: 'secret-a', namespace: 'ns-a', type: 1 }],
  });
  api.secretDetail.mockResolvedValue({
    cluster_id: 1,
    data: { token: '' },
    data_keys: [{ key: 'token', size: 16 }],
    name: 'secret-a',
    namespace: 'ns-a',
    redacted: true,
    type: 1,
  });
  api.auditLogs.mockResolvedValue({
    total: 1,
    items: [{ endpoint: '/api/x', id: 11, method: 'DELETE', user_id: 1 }],
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('高危按钮挂载级门禁（非 admin 账号）', () => {
  describe.each(CASES)('$name（$key）', (item) => {
    it('没有该码：按钮不渲染', async () => {
      setSubject(item.prerequisite ?? []);
      await mountPage(item.page);
      await item.prepare?.();
      expect(item.find()).toHaveLength(0);
    });

    it('有该码：按钮渲染', async () => {
      setSubject([...(item.prerequisite ?? []), item.key]);
      await mountPage(item.page);
      await item.prepare?.();
      expect(item.find().length).toBeGreaterThan(0);
    });
  });
});

describe('secret 查看详情与明文分层（SEC-25/26 第 4 条）', () => {
  it('只有 reveal 码（viewPlain/copyPlain）：不渲染「查看详情」', async () => {
    setSubject(['k8s.secret.viewPlain', 'k8s.secret.copyPlain']);
    await mountPage('Secret');
    expect(rowButtons('查看详情')).toHaveLength(0);
  });

  it('只有详情码：渲染「查看详情」，详情内没有查看 / 复制明文按钮', async () => {
    setSubject([SECRET_DETAIL_PERMISSION_CODE]);
    await mountPage('Secret');
    expect(rowButtons('查看详情')).toHaveLength(1);
    await openRedactedSecretDetail();
    expect(all('.secret-data-keys button.secret-view-plain')).toHaveLength(0);
    expect(buttonsByText('复制内容', '.secret-data-keys')).toHaveLength(0);
  });
});
