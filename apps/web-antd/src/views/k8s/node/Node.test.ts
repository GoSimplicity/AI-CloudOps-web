import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_CODES } from '#/constants/permission-codes';
import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import Node from './Node.vue';

/**
 * FE-02 污点弹窗（fe02-scope-decisions.md (c) c-1..c-9）：挂载真实 Node.vue，
 * 权限走真实 usePermission（pinia 中的 userInfo / accessCodes），只 mock 接口层。
 */
const api = vi.hoisted(() => ({
  getK8sNodeList: vi.fn(),
  getK8sNodeDetail: vi.fn(),
  updateK8sNodeLabels: vi.fn(),
  drainK8sNode: vi.fn(),
  cordonK8sNode: vi.fn(),
  uncordonK8sNode: vi.fn(),
  getK8sNodeTaints: vi.fn(),
  addK8sNodeTaints: vi.fn(),
  deleteK8sNodeTaints: vi.fn(),
  checkK8sNodeTaintYaml: vi.fn(),
  getClustersListApi: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_node')>()),
  ...api,
}));
vi.mock('#/api/core/k8s/k8s_cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_cluster')>()),
  getClustersListApi: api.getClustersListApi,
}));

const LIST_CODE = '/api/k8s/node/:cluster_id/:node_name/taints/list';
const ADD = PERMISSION_CODES['k8s.node.taintAdd'];
const DELETE = PERMISSION_CODES['k8s.node.taintDelete'];
const EXISTING = { key: 'dedicated', value: 'gpu', effect: 'NoSchedule' };

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

function bodyButton(text: string) {
  return [...document.body.querySelectorAll('button')].find((button) =>
    (button.textContent ?? '').replace(/\s/g, '').includes(text),
  ) as HTMLButtonElement | undefined;
}

function taintEntry() {
  return document.body.querySelector<HTMLButtonElement>(
    'button[title="管理污点"]',
  );
}

async function openTaintModal() {
  taintEntry()!.click();
  await flushPromises();
}

function modalRoot() {
  return [...document.body.querySelectorAll('.ant-modal')].find((modal) =>
    (modal.textContent ?? '').includes('管理节点污点'),
  ) as HTMLElement | undefined;
}

function saveButton() {
  return [...(modalRoot()?.querySelectorAll('button') ?? [])].find((button) =>
    (button.textContent ?? '').replace(/\s/g, '').includes('保存更改'),
  ) as HTMLButtonElement | undefined;
}

async function save() {
  saveButton()!.click();
  await flushPromises();
}

/** 模拟请求拦截器链：后端 403 经统一提示拦截器后抛给页面的错误（已提示标记） */
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
    items: [{ id: 1, name: 'c1' }],
    total: 1,
  });
  api.getK8sNodeList.mockResolvedValue({
    items: [
      {
        name: 'node-1',
        cluster_id: 1,
        status: 1,
        schedulable: 1,
        taints: [EXISTING],
      },
    ],
    total: 1,
  });
  api.getK8sNodeTaints.mockResolvedValue({ taints: [EXISTING] });
  api.addK8sNodeTaints.mockResolvedValue(undefined);
  api.deleteK8sNodeTaints.mockResolvedValue(undefined);
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FE-02 污点弹窗权限（c-1..c-9）', () => {
  it('c-1 常量文件中 k8s.node.taintAdd 与清单 v2 第 6 节一致', () => {
    expect(PERMISSION_CODES['k8s.node.taintAdd']).toBe(
      '/api/k8s/node/:cluster_id/:node_name/taints/add',
    );
    expect(PERMISSION_CODES['k8s.node.taintDelete']).toBe(
      '/api/k8s/node/:cluster_id/:node_name/taints/delete',
    );
  });

  it('c-2 只有 taints/list 码时节点行没有「管理污点」入口；有 add 或 delete 任一码时出现', async () => {
    setSubject([LIST_CODE]);
    await mountPage();
    expect(document.body.textContent).toContain('node-1');
    expect(taintEntry()).toBeNull();
    wrapper.unmount();
    document.body.innerHTML = '';

    setSubject([DELETE]);
    await mountPage();
    expect(taintEntry()).not.toBeNull();
    wrapper.unmount();
    document.body.innerHTML = '';

    setSubject([ADD]);
    await mountPage();
    expect(taintEntry()).not.toBeNull();
  });

  it('c-3 只有 delete 码时弹窗里没有「添加污点」；有 add 码时有', async () => {
    setSubject([DELETE]);
    await mountPage();
    await openTaintModal();
    expect(modalRoot()).toBeTruthy();
    expect(bodyButton('添加污点')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';

    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    expect(bodyButton('添加污点')).toBeTruthy();
  });

  it('c-4 只有 delete 码时已有污点的 key/value/effect 只读，只能删除', async () => {
    setSubject([DELETE]);
    await mountPage();
    await openTaintModal();
    const row = modalRoot()!.querySelector('.k8s-key-value-row')!;
    const inputs = row.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const input of inputs) expect(input.disabled).toBe(true);
    expect(row.querySelector('.ant-select-disabled')).not.toBeNull();
    expect(bodyButton('删除')).toBeTruthy();
  });

  it('c-4 有 add 码时已有污点可编辑', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    const row = modalRoot()!.querySelector('.k8s-key-value-row')!;
    for (const input of row.querySelectorAll('input'))
      expect(input.disabled).toBe(false);
    expect(row.querySelector('.ant-select-disabled')).toBeNull();
  });

  it('c-5 只有 add 码时每行没有删除按钮', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    expect(modalRoot()!.querySelector('.k8s-remove-btn')).toBeNull();
  });

  it('c-6 只有 delete 码时手动塞入新增污点后点保存：不发任何请求，提示无权限，弹窗保持打开', async () => {
    setSubject([DELETE]);
    await mountPage();
    await openTaintModal();
    // 模拟在 devtools 里改状态：同时有删除（有权限）和新增（无权限）
    wrapper.vm.taintFormModel.taintsToDelete.push('dedicated');
    wrapper.vm.taintFormModel.taints.push({
      key: 'evil',
      value: '1',
      effect: 'NoExecute',
    });
    await flushPromises();
    await save();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith({
      content: '无权限访问该接口',
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
    expect(message.success).not.toHaveBeenCalled();
    expect(wrapper.vm.isTaintModalVisible).toBe(true);
  });

  it('c-6 只有 add 码时手动塞入待删除的 key 后点保存：不发任何请求，弹窗保持打开', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    wrapper.vm.taintFormModel.taintsToDelete.push('dedicated');
    await flushPromises();
    await save();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith({
      content: '无权限访问该接口',
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
    expect(wrapper.vm.isTaintModalVisible).toBe(true);
  });

  it('c-7 打开弹窗不做修改时「保存更改」禁用，修改 effect 后可用', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    expect(saveButton()!.disabled).toBe(true);
    wrapper.vm.taintFormModel.taints[0].effect = 'NoExecute';
    await flushPromises();
    expect(saveButton()!.disabled).toBe(false);
    // 修改已有污点不能改到原始值（否则检测不到变化）
    expect(wrapper.vm.taintFormModel.originalTaints[0].effect).toBe(
      'NoSchedule',
    );
  });

  it('c-8 后端 403：只走统一提示，不再弹「污点更新失败」', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    api.addK8sNodeTaints.mockRejectedValueOnce(await notifiedForbiddenError());
    wrapper.vm.taintFormModel.taints[0].value = 'cpu';
    await flushPromises();
    await save();
    expect(api.addK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(message.error).not.toHaveBeenCalledWith('污点更新失败');
    expect(message.success).not.toHaveBeenCalled();
  });

  it('c-9 先删后加：删除成功、添加 403 时提示部分成功并写明添加失败，刷新列表，不提示整体成功', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    const order: string[] = [];
    api.deleteK8sNodeTaints.mockImplementationOnce(async () => {
      order.push('delete');
    });
    const forbidden = await notifiedForbiddenError();
    api.addK8sNodeTaints.mockImplementationOnce(async () => {
      order.push('add');
      throw forbidden;
    });
    // 删除已有污点，再新增一个
    bodyButton('删除')!.click();
    await flushPromises();
    bodyButton('添加污点')!.click();
    await flushPromises();
    wrapper.vm.taintFormModel.taints.at(-1).key = 'new-key';
    await flushPromises();
    const listCalls = api.getK8sNodeList.mock.calls.length;
    await save();
    expect(order).toEqual(['delete', 'add']);
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: ['dedicated'] }),
    );
    expect(message.warning).toHaveBeenCalledWith(
      expect.stringContaining('部分成功'),
    );
    expect(message.warning).toHaveBeenCalledWith(
      expect.stringContaining('添加/修改污点失败'),
    );
    expect(message.success).not.toHaveBeenCalledWith('节点污点更新成功');
    expect(message.error).not.toHaveBeenCalledWith('污点更新失败');
    expect(api.getK8sNodeList.mock.calls.length).toBeGreaterThan(listCalls);
  });

  it('c-9 删除和添加都成功时提示整体成功', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    bodyButton('删除')!.click();
    await flushPromises();
    bodyButton('添加污点')!.click();
    await flushPromises();
    wrapper.vm.taintFormModel.taints.at(-1).key = 'new-key';
    await flushPromises();
    await save();
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({
        taints: [{ key: 'new-key', value: '', effect: 'NoSchedule' }],
      }),
    );
    expect(message.success).toHaveBeenCalledWith('节点污点更新成功');
  });

  it('admin 放行：用户名 admin、权限码为空时入口、添加、删除、编辑都可用', async () => {
    setSubject([], 'admin');
    await mountPage();
    expect(taintEntry()).not.toBeNull();
    await openTaintModal();
    expect(bodyButton('添加污点')).toBeTruthy();
    expect(modalRoot()!.querySelector('.k8s-remove-btn')).not.toBeNull();
    for (const input of modalRoot()!.querySelectorAll(
      '.k8s-key-value-row input',
    ))
      expect((input as HTMLInputElement).disabled).toBe(false);
  });
});
