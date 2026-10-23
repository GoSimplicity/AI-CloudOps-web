import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_CODES } from '#/constants/permission-codes';
import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
} from '#/utils/permission/forbidden';

import Node from './Node.vue';

/**
 * Node「批量禁用调度」：后端只有单节点 cordon（internal/k8s/api/node.go:54
 * POST /node/:cluster_id/:node_name/cordon），前端逐个节点调用并汇总结果。
 * 挂载真实 Node.vue，权限走真实 usePermission，只 mock 接口层。
 */
const api = vi.hoisted(() => ({
  getK8sNodeList: vi.fn(),
  cordonK8sNode: vi.fn(),
  getClustersListApi: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_node')>()),
  getK8sNodeList: api.getK8sNodeList,
  cordonK8sNode: api.cordonK8sNode,
}));
vi.mock('#/api/core/k8s/k8s_cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_cluster')>()),
  getClustersListApi: api.getClustersListApi,
}));

const BATCH_CORDON = PERMISSION_CODES['k8s.node.batchCordon'];
const NODES = ['node-1', 'node-2', 'node-3'].map((name) => ({
  name,
  cluster_id: 7,
  status: 1,
  schedulable: 1,
  taints: [],
}));

let wrapper: VueWrapper<any>;

function setSubject(codes: string[], username = 'ops') {
  useUserStore().setUserInfo({ roles: [], username } as any);
  useAccessStore().setAccessCodes(codes);
}

async function mountPage() {
  wrapper = mount(Node, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
}

/** 真实点击表格行首的勾选框 */
async function selectRows(count: number) {
  const boxes = [
    ...document.body.querySelectorAll<HTMLInputElement>(
      '.ant-table-tbody .ant-checkbox-input',
    ),
  ];
  expect(boxes.length).toBe(NODES.length);
  for (const box of boxes.slice(0, count)) {
    box.click();
    await flushPromises();
  }
}

function batchButton() {
  return document.body.querySelector<HTMLButtonElement>(
    'button[title="批量禁用调度"]',
  );
}

function bodyButton(text: string) {
  return [...document.body.querySelectorAll('button')].find((button) =>
    (button.textContent ?? '').replace(/\s/g, '').includes(text),
  ) as HTMLButtonElement | undefined;
}

async function runBatch() {
  batchButton()!.click();
  await flushPromises();
  expect(document.body.textContent).toContain('批量禁用调度');
  bodyButton('确认执行')!.click();
  await flushPromises();
}

async function notifiedForbiddenError() {
  const { rejected } = createForbiddenResponseInterceptor(() => {});
  return rejected(createPermissionDeniedError()).catch((error) => error);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  vi.spyOn(message, 'success');
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
  api.getClustersListApi.mockResolvedValue({
    items: [{ id: 7, name: 'c7' }],
    total: 1,
  });
  api.getK8sNodeList.mockResolvedValue({ items: NODES, total: NODES.length });
  api.cordonK8sNode.mockResolvedValue(undefined);
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Node 批量禁用调度（逐个调用单节点 cordon）', () => {
  it('权限码 k8s.node.batchCordon 取单节点 cordon 路由模板（清单 v2）', () => {
    expect(BATCH_CORDON).toBe('/api/k8s/node/:cluster_id/:node_name/cordon');
  });

  it('没有 batchCordon 码时选中节点后也不显示批量按钮', async () => {
    setSubject([]);
    await mountPage();
    await selectRows(2);
    expect(batchButton()).toBeNull();
  });

  it('有 batchCordon 码时选中节点后显示批量按钮；取消确认不发请求', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    expect(batchButton()).toBeNull();
    await selectRows(2);
    expect(batchButton()).not.toBeNull();
    batchButton()!.click();
    await flushPromises();
    bodyButton('取消')!.click();
    await flushPromises();
    expect(api.cordonK8sNode).not.toHaveBeenCalled();
  });

  it('全部成功：每个选中节点各调一次单节点 cordon，提示成功数并刷新列表', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(3);
    const listCalls = api.getK8sNodeList.mock.calls.length;
    await runBatch();
    expect(api.cordonK8sNode).toHaveBeenCalledTimes(3);
    for (const name of ['node-1', 'node-2', 'node-3']) {
      expect(api.cordonK8sNode).toHaveBeenCalledWith({
        cluster_id: 7,
        node_name: name,
      });
    }
    expect(message.success).toHaveBeenCalledWith(
      '批量禁用调度完成：3 个节点已禁用调度',
    );
    expect(message.success).not.toHaveBeenCalledWith('批量禁用调度操作已启动');
    expect(api.getK8sNodeList.mock.calls.length).toBe(listCalls + 1);
  });

  it('部分失败：提示部分成功并列出失败节点，不提示整体成功', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(3);
    api.cordonK8sNode.mockImplementation(async ({ node_name }) => {
      if (node_name === 'node-2') throw new Error('Error 500: boom');
    });
    await runBatch();
    expect(api.cordonK8sNode).toHaveBeenCalledTimes(3);
    expect(message.warning).toHaveBeenCalledWith(
      '批量禁用调度部分成功：成功 2 个，失败 1 个（node-2）',
    );
    expect(message.success).not.toHaveBeenCalled();
  });

  it('部分失败中含已统一提示的 403：仍给出部分成功汇总', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    api.cordonK8sNode
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(await notifiedForbiddenError());
    await runBatch();
    expect(message.warning).toHaveBeenCalledWith(
      '批量禁用调度部分成功：成功 1 个，失败 1 个（node-2）',
    );
  });

  it('全部失败且都已统一提示（403）：不再叠加批量失败提示，不刷新列表', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    const forbidden = await notifiedForbiddenError();
    api.cordonK8sNode.mockRejectedValue(forbidden);
    const listCalls = api.getK8sNodeList.mock.calls.length;
    await runBatch();
    expect(api.cordonK8sNode).toHaveBeenCalledTimes(2);
    expect(message.error).not.toHaveBeenCalled();
    expect(message.warning).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(api.getK8sNodeList.mock.calls.length).toBe(listCalls);
  });

  it('全部失败且未统一提示（如网络错误）：提示批量失败并列出节点，不静默', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    api.cordonK8sNode.mockRejectedValue(new Error('Network Error'));
    await runBatch();
    expect(message.error).toHaveBeenCalledWith(
      '批量禁用调度失败：2 个节点均未成功（node-1、node-2）',
    );
  });

  it('admin 放行：用户名 admin、权限码为空时显示批量按钮并可执行', async () => {
    setSubject([], 'admin');
    await mountPage();
    await selectRows(1);
    expect(batchButton()).not.toBeNull();
    await runBatch();
    expect(api.cordonK8sNode).toHaveBeenCalledWith({
      cluster_id: 7,
      node_name: 'node-1',
    });
  });
});
