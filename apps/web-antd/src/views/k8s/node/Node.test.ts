import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_CODES } from '#/constants/permission-codes';
import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import {
  TAINT_DUPLICATE_EFFECT_MESSAGE,
  TAINT_KEY_EXISTS_MESSAGE,
} from './Node';
import Node from './Node.vue';

// 挂载完整 Node.vue（antd Table + Modal）在满载 CI 上单条可能超过默认 5s（复审 P3-7）
vi.setConfig({ testTimeout: 15_000 });

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

/** 必须存在的测试控件或记录缺失时立即失败，并为后续操作收窄类型。 */
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected test fixture to exist');
  }
  return value;
}

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
  required(taintEntry()).click();
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
  required(saveButton()).click();
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

describe('fE-02 污点弹窗权限（c-1..c-9）', () => {
  it('c-1 常量文件中 k8s.node.taintAdd 与清单 v4 第 6 节一致（v2 引入）', () => {
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
    const row = required(
      required(modalRoot()).querySelector('.k8s-key-value-row'),
    );
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
    const row = required(
      required(modalRoot()).querySelector('.k8s-key-value-row'),
    );
    for (const input of row.querySelectorAll('input'))
      expect(input.disabled).toBe(false);
    expect(row.querySelector('.ant-select-disabled')).toBeNull();
  });

  it('c-5 只有 add 码时每行没有删除按钮', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    expect(required(modalRoot()).querySelector('.k8s-remove-btn')).toBeNull();
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
      content: PERMISSION_DENIED_MESSAGE,
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
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
    expect(wrapper.vm.isTaintModalVisible).toBe(true);
  });

  it('c-7 打开弹窗不做修改时「保存更改」禁用，修改 effect 后可用', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    expect(required(saveButton()).disabled).toBe(true);
    wrapper.vm.taintFormModel.taints[0].effect = 'NoExecute';
    await flushPromises();
    expect(required(saveButton()).disabled).toBe(false);
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
    required(bodyButton('删除')).click();
    await flushPromises();
    required(bodyButton('添加污点')).click();
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
    required(bodyButton('删除')).click();
    await flushPromises();
    required(bodyButton('添加污点')).click();
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

  it('p3-3 只有 add 码：已有污点行没有删除按钮，本次新增、未保存的行可以删除（只改表单，不调删除接口）', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    required(bodyButton('添加污点')).click();
    await flushPromises();
    const rows = () => [
      ...required(modalRoot()).querySelectorAll('.k8s-key-value-row'),
    ];
    expect(rows()).toHaveLength(2);
    expect(required(rows()[0]).querySelector('.k8s-remove-btn')).toBeNull();
    const removeNew = required(rows()[1]).querySelector<HTMLButtonElement>(
      '.k8s-remove-btn',
    );
    expect(removeNew).not.toBeNull();
    required(removeNew).click();
    await flushPromises();
    expect(rows()).toHaveLength(1);
    expect(wrapper.vm.taintFormModel.taintsToDelete).toEqual([]);
    expect(required(saveButton()).disabled).toBe(true);
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
  });

  it('p3-4 先删后加同一个 key：重新添加的行计入添加，先删再加各发一次', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    const order: string[] = [];
    api.deleteK8sNodeTaints.mockImplementationOnce(async () => {
      order.push('delete');
    });
    api.addK8sNodeTaints.mockImplementationOnce(async () => {
      order.push('add');
    });
    required(bodyButton('删除')).click();
    await flushPromises();
    required(bodyButton('添加污点')).click();
    await flushPromises();
    // 与原污点完全相同的 key/value/effect，也必须重新添加，否则保存后被删掉
    Object.assign(wrapper.vm.taintFormModel.taints.at(-1), EXISTING);
    await flushPromises();
    expect(required(saveButton()).disabled).toBe(false);
    await save();
    expect(order).toEqual(['delete', 'add']);
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: ['dedicated'] }),
    );
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [EXISTING] }),
    );
    expect(message.success).toHaveBeenCalledWith('节点污点更新成功');
  });

  it.each([
    ['只有 delete 码', (): string[] => [DELETE]],
    ['只有 add 码', (): string[] => [ADD]],
  ])(
    'p3-4 先删后加同一个 key 需要两个码：%s 时整单不发请求，提示无权限',
    async (_label, codes) => {
      setSubject(codes());
      await mountPage();
      await openTaintModal();
      // 通过状态构造「删了 dedicated 又加回 dedicated」
      wrapper.vm.taintFormModel.taintsToDelete.push('dedicated');
      wrapper.vm.taintFormModel.taints.splice(0, 1, { ...EXISTING });
      await flushPromises();
      await save();
      expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
      expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalledWith({
        content: PERMISSION_DENIED_MESSAGE,
        key: PERMISSION_DENIED_MESSAGE_KEY,
      });
      expect(wrapper.vm.isTaintModalVisible).toBe(true);
    },
  );

  it('admin 放行：用户名 admin、权限码为空时入口、添加、删除、编辑都可用', async () => {
    setSubject([], 'admin');
    await mountPage();
    expect(taintEntry()).not.toBeNull();
    await openTaintModal();
    expect(bodyButton('添加污点')).toBeTruthy();
    expect(
      required(modalRoot()).querySelector('.k8s-remove-btn'),
    ).not.toBeNull();
    for (const input of required(modalRoot()).querySelectorAll(
      '.k8s-key-value-row input',
    ))
      expect((input as HTMLInputElement).disabled).toBe(false);
  });
});

/**
 * c-5 边界（v3 收尾）：本次新增的行 key 与已保存污点相同时，撤销这一行
 * 不能被当成删除已保存的污点。按 UI 实际操作：点「添加污点」，在新行里输入同一个 key。
 */
describe('c-5 新增行与已保存污点同 key：撤销新增行', () => {
  const rows = () => [
    ...required(modalRoot()).querySelectorAll<HTMLElement>(
      '.k8s-key-value-row',
    ),
  ];

  async function typeInto(row: HTMLElement, index: number, text: string) {
    const input = required(
      row.querySelectorAll<HTMLInputElement>('input')[index],
    );
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
  }

  async function addRowWithSameKey(value: string) {
    required(bodyButton('添加污点')).click();
    await flushPromises();
    const added = required(rows().at(-1));
    await typeInto(added, 0, EXISTING.key);
    await typeInto(added, 1, value);
  }

  it.each([
    ['只有 add 码', 'value/effect 相同', (): string[] => [ADD], EXISTING.value],
    ['只有 add 码', 'value 不同', (): string[] => [ADD], 'cpu'],
    [
      'add + delete 码',
      'value/effect 相同',
      (): string[] => [ADD, DELETE],
      EXISTING.value,
    ],
    ['add + delete 码', 'value 不同', (): string[] => [ADD, DELETE], 'cpu'],
  ])(
    '%s，新增行 %s：新增行可撤销，撤销后已保存的污点保留，不发任何请求、不提示无权限',
    async (_codesLabel, _valueLabel, codes, value) => {
      setSubject(codes());
      await mountPage();
      await openTaintModal();
      await addRowWithSameKey(value);
      expect(wrapper.vm.taintFormModel.taints).toEqual([
        EXISTING,
        { ...EXISTING, value },
      ]);
      // 已保存的行：只有 add 码时没有删除按钮；新增行始终可撤销
      expect(
        required(rows()[0]).querySelector('.k8s-remove-btn') === null,
      ).toBe(!codes().includes(DELETE));
      const undo = required(rows()[1]).querySelector<HTMLButtonElement>(
        '.k8s-remove-btn',
      );
      expect(undo).not.toBeNull();
      required(undo).click();
      await flushPromises();

      expect(rows()).toHaveLength(1);
      expect(wrapper.vm.taintFormModel.taints).toEqual([EXISTING]);
      expect(wrapper.vm.taintFormModel.taintsToDelete).toEqual([]);
      expect(required(saveButton()).disabled).toBe(true);
      // 直接调用保存（绕过禁用）也不能发请求或提示无权限
      await wrapper.vm.submitTaintForm();
      await flushPromises();
      expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
      expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    },
  );

  it('只有 add 码，新增行 value 不同且不撤销：等于修改已有污点，提示需先删除，不发请求（窝窝头答复 2）', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    await addRowWithSameKey('cpu');
    await save();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith({
      content: TAINT_KEY_EXISTS_MESSAGE,
      key: TAINT_KEY_EXISTS_MESSAGE,
    });
    expect(modalRoot()).toBeTruthy();
  });

  it('add + delete 码：已保存的行改了 key 再删除，按它原来的 key 删除（行身份，不看当前输入）', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    await typeInto(required(rows()[0]), 0, 'renamed');
    required(
      required(rows()[0]).querySelector<HTMLButtonElement>('.k8s-remove-btn'),
    ).click();
    await flushPromises();
    expect(wrapper.vm.taintFormModel.taintsToDelete).toEqual([EXISTING.key]);
    await save();
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: [EXISTING.key] }),
    );
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
  });

  it('add + delete 码：删除已保存的行（不是新增行）仍按 key 删除', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    await addRowWithSameKey('cpu');
    required(
      required(rows()[0]).querySelector<HTMLButtonElement>('.k8s-remove-btn'),
    ).click();
    await flushPromises();
    expect(wrapper.vm.taintFormModel.taintsToDelete).toEqual([EXISTING.key]);
    await save();
    // 先删后加同一个 key（P3-4）：删除已保存的 dedicated，再加回新值
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: [EXISTING.key] }),
    );
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [{ ...EXISTING, value: 'cpu' }] }),
    );
  });
});

/**
 * 第一层复审 v4：P3-1（已保存行 key 只读 + 逻辑兜底不留孤儿）、P3-2（后端 mergeTaints 按 key 整体替换，
 * 某个 key 要发就把这个 key 当前所有行一起发）、窝窝头答复 2（新增行与已保存污点同 key）
 */
describe('复审 v4 P3-1 / P3-2：污点按 key 整组提交', () => {
  const rows = () => [
    ...required(modalRoot()).querySelectorAll<HTMLElement>(
      '.k8s-key-value-row',
    ),
  ];
  const keyInput = (row: HTMLElement) => required(row.querySelector('input'));

  async function typeInto(row: HTMLElement, index: number, text: string) {
    const input = required(
      row.querySelectorAll<HTMLInputElement>('input')[index],
    );
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
  }

  async function addRow(taint: { effect: string; key: string; value: string }) {
    required(bodyButton('添加污点')).click();
    await flushPromises();
    await typeInto(required(rows().at(-1)), 0, taint.key);
    await typeInto(required(rows().at(-1)), 1, taint.value);
    wrapper.vm.taintFormModel.taints.at(-1).effect = taint.effect;
    await flushPromises();
  }

  const NO_EXECUTE = { ...EXISTING, effect: 'NoExecute' };

  function savedTaints(taints: (typeof EXISTING)[]) {
    api.getK8sNodeTaints.mockResolvedValue({ taints });
  }

  it.each([
    ['只有 add 码', [ADD]],
    ['add + delete 码', [ADD, DELETE]],
  ])('p3-1 %s：已保存行的 key 输入框只读，新增行可编辑', async (_l, codes) => {
    setSubject(codes);
    await mountPage();
    await openTaintModal();
    required(bodyButton('添加污点')).click();
    await flushPromises();
    expect(keyInput(required(rows()[0])).readOnly).toBe(true);
    expect(keyInput(required(rows()[1])).readOnly).toBe(false);
    // value 仍可修改（taintAdd 码覆盖「添加/修改污点」）
    expect(
      required(required(rows()[0]).querySelectorAll('input')[1]).readOnly,
    ).toBe(false);
  });

  it('p3-1 兜底，add + delete 码：已保存行的 key 被改（a→b）不删行，保存时先删 a 再加 b，不留孤儿', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    await typeInto(required(rows()[0]), 0, 'renamed');
    await save();
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: [EXISTING.key] }),
    );
    expect(api.addK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [{ ...EXISTING, key: 'renamed' }] }),
    );
  });

  it('p3-1 兜底，只有 add 码：已保存行的 key 被改，需要删除原 key → 整单不发、提示无权限', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    await typeInto(required(rows()[0]), 0, 'renamed');
    await save();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith({
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
  });

  it('p3-2 只有 add 码：同 key 两个 effect，只改其中一行的 value，两行一起发', async () => {
    savedTaints([EXISTING, NO_EXECUTE]);
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    await typeInto(required(rows()[1]), 1, 'cpu');
    await save();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.addK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({
        taints: [EXISTING, { ...NO_EXECUTE, value: 'cpu' }],
      }),
    );
  });

  it('p3-2 add + delete 码：同 key 两个 effect 删掉一行，先按 key 删除再把剩下的一行加回', async () => {
    savedTaints([EXISTING, NO_EXECUTE]);
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    required(
      required(rows()[0]).querySelector<HTMLButtonElement>('.k8s-remove-btn'),
    ).click();
    await flushPromises();
    await save();
    expect(api.deleteK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taint_keys: [EXISTING.key] }),
    );
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [NO_EXECUTE] }),
    );
  });

  it('p3-2：新增一个无关 key，只发这一行，不带上其他 key', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    const zone = { key: 'zone', value: 'a', effect: 'NoSchedule' };
    await addRow(zone);
    await save();
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [zone] }),
    );
  });

  it('答复 2，只有 add 码：新增行与已保存污点同 key、不同 effect，也拦下，不发请求', async () => {
    setSubject([ADD]);
    await mountPage();
    await openTaintModal();
    await addRow(NO_EXECUTE);
    await save();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith({
      content: TAINT_KEY_EXISTS_MESSAGE,
      key: TAINT_KEY_EXISTS_MESSAGE,
    });
  });

  it('答复 2，add + delete 码：新增行与已保存污点同 key、不同 effect → 这个 key 的所有行一起发 add，不发删除', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    await addRow(NO_EXECUTE);
    await save();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.addK8sNodeTaints).toHaveBeenCalledTimes(1);
    expect(api.addK8sNodeTaints).toHaveBeenCalledWith(
      expect.objectContaining({ taints: [EXISTING, NO_EXECUTE] }),
    );
    expect(message.error).not.toHaveBeenCalled();
  });

  it('add + delete 码：新增行与已保存污点同 key 同 effect（只是 value 不同）→ 提示重复，不发请求', async () => {
    setSubject([ADD, DELETE]);
    await mountPage();
    await openTaintModal();
    await addRow({ ...EXISTING, value: 'cpu' });
    await save();
    expect(api.addK8sNodeTaints).not.toHaveBeenCalled();
    expect(api.deleteK8sNodeTaints).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith({
      content: TAINT_DUPLICATE_EFFECT_MESSAGE,
      key: TAINT_DUPLICATE_EFFECT_MESSAGE,
    });
  });
});
