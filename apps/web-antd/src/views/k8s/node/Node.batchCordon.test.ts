import { useAccessStore, useUserStore } from '@vben/stores';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { type AxiosAdapter, AxiosError } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTP_ERROR_MESSAGE_KEY_PREFIX, requestClient } from '#/api/request';
import {
  getAccountCPermissionCodes,
  getAccountPermissionCodes,
  PERMISSION_CODES,
  S1B_PERMISSION_CODES,
  U3_PERMISSION_CODES,
} from '#/constants/permission-codes';
import {
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import { BATCH_CORDON_CONCURRENCY } from './Node';
import Node from './Node.vue';

// 挂载完整 Node.vue（antd Table + Modal）在满载 CI 上单条可能超过默认 5s（复审 P3-7）
vi.setConfig({ testTimeout: 15_000 });

/**
 * Node「批量禁用调度」：后端只有单节点 cordon（internal/k8s/api/node.go:54
 * POST /node/:cluster_id/:node_name/cordon），前端逐个节点调用并汇总结果。
 * 挂载真实 Node.vue，权限走真实 usePermission；cordon 走真实 requestClient 拦截器链，
 * 只替换 axios adapter，断言实际发出的请求条数、URL 和并发数。
 */
const api = vi.hoisted(() => ({
  getK8sNodeList: vi.fn(),
  getClustersListApi: vi.fn(),
}));
vi.mock('#/api/core/k8s/k8s_node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_node')>()),
  getK8sNodeList: api.getK8sNodeList,
}));
vi.mock('#/api/core/k8s/k8s_cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/api/core/k8s/k8s_cluster')>()),
  getClustersListApi: api.getClustersListApi,
}));
// U3 开关：默认取源码里的值（false），个别用例打开
const u3 = vi.hoisted(() => ({ override: undefined as boolean | undefined }));
vi.mock('#/constants/permission-codes', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#/constants/permission-codes')>();
  return {
    ...actual,
    get U3_SCOPE_APPROVED() {
      return u3.override ?? actual.U3_SCOPE_APPROVED;
    },
  };
});

const BATCH_CORDON = S1B_PERMISSION_CODES['k8s.node.batchCordon'];
const CORDON = S1B_PERMISSION_CODES['k8s.node.cordon'];
const UNCORDON = S1B_PERMISSION_CODES['k8s.node.uncordon'];

type TestNode = {
  cluster_id: number;
  name: string;
  schedulable: number;
  status: number;
  taints: [];
};
const makeNodes = (count: number, unschedulable: string[] = []): TestNode[] =>
  Array.from({ length: count }, (_, i) => {
    const name = `node-${i + 1}`;
    return {
      name,
      cluster_id: 7,
      status: 1,
      schedulable: unschedulable.includes(name) ? 2 : 1,
      taints: [],
    };
  });
let NODES = makeNodes(3);

/** 真实发出的请求（axios adapter 层） */
type Reply = { data?: unknown; status: number };
let requests: { method: string; url: string }[] = [];
let inFlight = 0;
let maxInFlight = 0;
let replyFor: (url: string) => Reply = () => ({
  status: 200,
  data: { code: 0, data: null, message: 'ok' },
});
const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  requests.push({ method: String(config.method).toUpperCase(), url });
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 1));
  inFlight -= 1;
  const { status, data } = replyFor(url);
  const response = { config, data, headers: {}, status, statusText: '' } as any;
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config,
    {},
    response,
  );
};
const cordonUrl = (name: string) => `/k8s/node/7/${name}/cordon`;
const cordonRequests = () =>
  requests.filter((request) => request.url.endsWith('/cordon'));
const scheduleRequests = () =>
  requests.filter((request) => /\/(un)?cordon$/.test(request.url));
async function settle() {
  await vi.waitFor(() => expect(inFlight).toBe(0));
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2));
    await flushPromises();
  }
}

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

function rowBoxes() {
  return [
    ...document.body.querySelectorAll<HTMLInputElement>(
      '.ant-table-tbody .ant-checkbox-input',
    ),
  ];
}

/** 真实点击表格行首的勾选框 */
async function selectRows(count: number) {
  const boxes = rowBoxes();
  expect(boxes.length).toBe(NODES.length);
  for (const box of boxes.slice(0, count)) {
    box.click();
    await flushPromises();
  }
}

/** 真实点击表头全选 */
async function selectAll() {
  required(
    document.body.querySelector<HTMLInputElement>(
      '.ant-table-thead .ant-checkbox-input',
    ),
  ).click();
  await flushPromises();
}

function checkedNames() {
  return rowBoxes()
    .map((box, index) => (box.checked ? required(NODES[index]).name : null))
    .filter(Boolean);
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
  required(batchButton()).click();
  await flushPromises();
  expect(document.body.textContent).toContain('批量禁用调度');
  required(bodyButton('确认执行')).click();
  await flushPromises();
  await settle();
}

function rowScheduleButton(rowIndex: number) {
  const row = document.body.querySelectorAll(
    '.ant-table-tbody tr.ant-table-row',
  )[rowIndex];
  return (
    row?.querySelector<HTMLButtonElement>('button[data-action="schedule"]') ??
    null
  );
}

const forbidden403: Reply = {
  status: 403,
  data: { code: 403, data: null, message: '无权限访问该接口' },
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  u3.override = undefined;
  NODES = makeNodes(3);
  requests = [];
  inFlight = 0;
  maxInFlight = 0;
  replyFor = () => ({
    status: 200,
    data: { code: 0, data: null, message: 'ok' },
  });
  (requestClient as any).instance.defaults.adapter = adapter;
  vi.spyOn(message, 'error');
  vi.spyOn(message, 'warning');
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'info');
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
  api.getK8sNodeList.mockImplementation(async () => ({
    items: NODES.map((node) => ({ ...node })),
    total: NODES.length,
  }));
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  u3.override = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('node 批量禁用调度（逐个调用单节点 cordon）', () => {
  it('权限码 k8s.node.batchCordon 取单节点 cordon 路由模板，属 S1b（清单 v4 #87），始终按码判断', () => {
    expect(BATCH_CORDON).toBe('/api/k8s/node/:cluster_id/:node_name/cordon');
    expect('k8s.node.batchCordon' in PERMISSION_CODES).toBe(false);
    expect('k8s.node.batchCordon' in U3_PERMISSION_CODES).toBe(false);
  });

  it('u3 未获批（默认）：没有 cordon 码时选中节点也隐藏批量按钮（P2-A，与 a21af97 一致）', async () => {
    setSubject([]);
    await mountPage();
    await selectRows(2);
    expect(batchButton()).toBeNull();
  });

  it('u3 未获批（默认）且有 cordon 码：选中后显示批量按钮', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    expect(batchButton()).toBeNull();
    await selectRows(2);
    expect(batchButton()).not.toBeNull();
  });

  it('全部成功：选 3 个可调度节点发 3 个 POST，URL 逐一对应，提示成功数并刷新列表', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(3);
    const listCalls = api.getK8sNodeList.mock.calls.length;
    await runBatch();
    expect(cordonRequests()).toHaveLength(3);
    expect(cordonRequests()).toEqual(
      ['node-1', 'node-2', 'node-3'].map((name) => ({
        method: 'POST',
        url: cordonUrl(name),
      })),
    );
    expect(message.success).toHaveBeenCalledWith(
      '批量禁用调度完成：3 个节点已禁用调度',
    );
    expect(message.success).not.toHaveBeenCalledWith('批量禁用调度操作已启动');
    expect(api.getK8sNodeList.mock.calls.length).toBe(listCalls + 1);
    expect(checkedNames()).toEqual([]);
  });

  it('混选：已禁用调度的节点跳过不发请求，汇总里列出跳过的节点', async () => {
    NODES = makeNodes(4, ['node-2', 'node-4']);
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectAll();
    await runBatch();
    expect(cordonRequests().map((request) => request.url)).toEqual([
      cordonUrl('node-1'),
      cordonUrl('node-3'),
    ]);
    expect(message.success).toHaveBeenCalledWith(
      '批量禁用调度完成：2 个节点已禁用调度，跳过 2 个已禁用调度的节点（node-2、node-4）',
    );
  });

  it('选中的全是已禁用调度节点：不发请求，提示无需操作', async () => {
    NODES = makeNodes(2, ['node-1', 'node-2']);
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectAll();
    await runBatch();
    expect(cordonRequests()).toHaveLength(0);
    expect(message.info).toHaveBeenCalledWith(
      '选中的 2 个节点均已禁用调度，无需操作',
    );
  });

  it('部分失败：提示部分成功并列出失败节点；失败节点保持勾选、成功的取消勾选', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(3);
    replyFor = (url) =>
      url === cordonUrl('node-2')
        ? { status: 500, data: { code: 1, data: null, message: 'boom' } }
        : { status: 200, data: { code: 0, data: null, message: 'ok' } };
    await runBatch();
    expect(cordonRequests()).toHaveLength(3);
    expect(message.warning).toHaveBeenCalledWith(
      '批量禁用调度部分成功：成功 2 个，失败 1 个（node-2）',
    );
    expect(message.success).not.toHaveBeenCalled();
    await flushPromises();
    expect(checkedNames()).toEqual(['node-2']);
    expect(batchButton()?.textContent).toContain('批量操作 (1)');
  });

  it('部分失败中含 403：403 只弹统一文案，仍给出部分成功汇总', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    replyFor = (url) =>
      url === cordonUrl('node-2')
        ? forbidden403
        : { status: 200, data: { code: 0, data: null, message: 'ok' } };
    await runBatch();
    expect(message.warning).toHaveBeenCalledWith(
      '批量禁用调度部分成功：成功 1 个，失败 1 个（node-2）',
    );
    expect(JSON.stringify((message.error as any).mock.calls)).not.toContain(
      '无权限访问该接口',
    );
  });

  it('全部 403：每个节点都发了请求，只有统一提示，不再叠加批量失败提示，不刷新列表', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    replyFor = () => forbidden403;
    const listCalls = api.getK8sNodeList.mock.calls.length;
    await runBatch();
    expect(cordonRequests()).toHaveLength(2);
    const errorCalls = (message.error as any).mock.calls.map(
      ([arg]: [any]) => arg,
    );
    expect(
      errorCalls.every(
        (arg: any) => arg?.key === PERMISSION_DENIED_MESSAGE_KEY,
      ),
    ).toBe(true);
    expect(message.warning).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
    expect(api.getK8sNodeList.mock.calls.length).toBe(listCalls);
    expect(checkedNames()).toEqual(['node-1', 'node-2']);
  });

  it('全部失败且未统一提示（如 500）：提示批量失败并列出节点，不静默', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    replyFor = () => ({
      status: 500,
      data: { code: 1, data: null, message: 'boom' },
    });
    await runBatch();
    expect(message.error).toHaveBeenCalledWith(
      '批量禁用调度失败：2 个节点均未成功（node-1、node-2）',
    );
  });

  it(`50 个节点全部 500：发 50 个请求，并发不超过 ${BATCH_CORDON_CONCURRENCY}；通用提示最多 1 条（固定 key）+ 汇总 1 条`, async () => {
    NODES = makeNodes(50);
    setSubject([BATCH_CORDON]);
    await mountPage();
    // 页面默认每页 10 条；切到每页 50 条（页面自带选项）后全选当前页
    (wrapper.vm as any).pageSize = 50;
    await flushPromises();
    await selectAll();
    const selected = Number(
      /批量操作 \((\d+)\)/.exec(batchButton()?.textContent ?? '')?.[1],
    );
    expect(selected).toBe(50);
    replyFor = () => ({
      status: 500,
      data: { code: 1, data: null, message: 'boom' },
    });
    await runBatch();
    expect(cordonRequests()).toHaveLength(selected);
    expect(new Set(cordonRequests().map((request) => request.url)).size).toBe(
      selected,
    );
    expect(maxInFlight).toBeLessThanOrEqual(BATCH_CORDON_CONCURRENCY);
    expect(maxInFlight).toBeGreaterThan(1);
    const errorArgs = (message.error as any).mock.calls.map(
      ([arg]: [any]) => arg,
    );
    const genericKeys = new Set(
      errorArgs
        .filter(
          (arg: any) =>
            typeof arg?.key === 'string' &&
            arg.key.startsWith(HTTP_ERROR_MESSAGE_KEY_PREFIX),
        )
        .map((arg: any) => arg.key),
    );
    expect(genericKeys.size).toBeLessThanOrEqual(1);
    const summaries = errorArgs.filter(
      (arg: any) =>
        typeof arg === 'string' && arg.startsWith('批量禁用调度失败'),
    );
    expect(summaries).toHaveLength(1);
    // 其余提示都带固定 key（同 key 的 ant message 只保留一条）
    expect(
      errorArgs.filter((arg: any) => typeof arg === 'string'),
    ).toHaveLength(1);
  });

  it('admin 放行：用户名 admin、权限码为空时显示批量按钮并可执行', async () => {
    setSubject([], 'admin');
    await mountPage();
    await selectRows(1);
    expect(batchButton()).not.toBeNull();
    await runBatch();
    expect(cordonRequests()).toEqual([
      { method: 'POST', url: cordonUrl('node-1') },
    ]);
  });
});

describe('u3 获批（开关打开）后按码收紧', () => {
  beforeEach(() => {
    u3.override = true;
  });

  it('没有 batchCordon 码：选中节点后也不显示批量按钮', async () => {
    setSubject([]);
    await mountPage();
    await selectRows(2);
    expect(batchButton()).toBeNull();
  });

  it('有 batchCordon 码：选中后显示批量按钮；取消确认不发请求', async () => {
    setSubject([BATCH_CORDON]);
    await mountPage();
    expect(batchButton()).toBeNull();
    await selectRows(2);
    expect(batchButton()).not.toBeNull();
    required(batchButton()).click();
    await flushPromises();
    required(bodyButton('取消')).click();
    await flushPromises();
    expect(cordonRequests()).toHaveLength(0);
  });

  it('admin 放行', async () => {
    setSubject([], 'admin');
    await mountPage();
    await selectRows(1);
    expect(batchButton()).not.toBeNull();
  });
});

describe('行内禁用/启用调度按钮（toggleNodeSchedule）', () => {
  beforeEach(() => {
    NODES = makeNodes(2, ['node-2']); // node-1 可调度，node-2 已禁用调度
  });

  it('cordon / uncordon 码取各自的单节点路由模板（清单 v4 S1b #84 / #85）', () => {
    expect(CORDON).toBe('/api/k8s/node/:cluster_id/:node_name/cordon');
    expect(UNCORDON).toBe('/api/k8s/node/:cluster_id/:node_name/uncordon');
  });

  // P2-A：Node 调度按钮不受 U3 开关豁免，开关关 / 开结果一致
  describe.each([
    ['U3 未获批（默认）', undefined],
    ['U3 获批', true],
  ] as const)('%s', (_label, override) => {
    beforeEach(() => {
      u3.override = override;
    });

    it('无码：两行都不渲染', async () => {
      setSubject([]);
      await mountPage();
      expect(rowScheduleButton(0)).toBeNull();
      expect(rowScheduleButton(1)).toBeNull();
    });

    it('只有 cordon 码：只有可调度节点显示「禁用调度」', async () => {
      setSubject([CORDON]);
      await mountPage();
      expect(rowScheduleButton(0)?.getAttribute('title')).toBe('禁用调度');
      expect(rowScheduleButton(1)).toBeNull();
    });

    it('只有 uncordon 码：只有已禁用调度节点显示「启用调度」', async () => {
      setSubject([UNCORDON]);
      await mountPage();
      expect(rowScheduleButton(0)).toBeNull();
      expect(rowScheduleButton(1)?.getAttribute('title')).toBe('启用调度');
    });

    it('两个码都有：两行都显示', async () => {
      setSubject([CORDON, UNCORDON]);
      await mountPage();
      expect(rowScheduleButton(0)?.getAttribute('title')).toBe('禁用调度');
      expect(rowScheduleButton(1)?.getAttribute('title')).toBe('启用调度');
    });

    it('admin 放行：两行都显示', async () => {
      setSubject([], 'admin');
      await mountPage();
      expect(rowScheduleButton(0)).not.toBeNull();
      expect(rowScheduleButton(1)).not.toBeNull();
    });
  });
});

/**
 * 验收标准 v3 FE-02「cordon 类不受 U3 开关影响」：U3 获批前（默认开关），
 * B（空码）和 C（A 去掉 cordon / uncordon，59 个码）看不到批量 / 行内调度按钮，
 * 直接调用对应函数也不发 cordon / uncordon 请求；A（61 个码）可用，行内各 1 次、批量 N 次。
 */
describe('测试账号 A / B / C（U3 未获批）：Node 调度按钮', () => {
  beforeEach(() => {
    NODES = makeNodes(3, ['node-3']); // node-1、node-2 可调度，node-3 已禁用调度
  });

  async function confirmIfShown(okText: string) {
    const ok = bodyButton(okText);
    if (ok) {
      ok.click();
      await flushPromises();
    }
    await settle();
  }

  it('账号码数：A 61、C 59，C 只比 A 少 cordon / uncordon', () => {
    expect(getAccountPermissionCodes()).toHaveLength(61);
    expect(getAccountCPermissionCodes()).toHaveLength(59);
    expect(getAccountCPermissionCodes()).not.toContain(CORDON);
    expect(getAccountCPermissionCodes()).not.toContain(UNCORDON);
  });

  describe.each([
    ['B（空码）', (): string[] => []],
    ['C（59 个码）', (): string[] => getAccountCPermissionCodes()],
  ])('%s', (_label, codes) => {
    it('行内「禁用调度」「启用调度」都不渲染；选中节点后也没有批量按钮', async () => {
      setSubject(codes());
      await mountPage();
      expect(rowScheduleButton(0)).toBeNull();
      expect(rowScheduleButton(1)).toBeNull();
      expect(rowScheduleButton(2)).toBeNull();
      await selectRows(3);
      expect(batchButton()).toBeNull();
    });

    it('直接调用行内 cordon / uncordon 函数：不弹确认、不发请求，提示无权限', async () => {
      setSubject(codes());
      await mountPage();
      wrapper.vm.toggleNodeSchedule({ ...required(NODES[0]) });
      await flushPromises();
      await confirmIfShown('确认禁用');
      wrapper.vm.toggleNodeSchedule({ ...required(NODES[2]) });
      await flushPromises();
      await confirmIfShown('确认启用');
      expect(scheduleRequests()).toEqual([]);
      expect(message.error).toHaveBeenCalledWith({
        content: PERMISSION_DENIED_MESSAGE,
        key: PERMISSION_DENIED_MESSAGE_KEY,
      });
    });

    it('直接调用批量禁用调度函数：不弹确认、不发请求，提示无权限', async () => {
      setSubject(codes());
      await mountPage();
      await selectRows(2);
      wrapper.vm.batchOperation('禁用调度');
      await flushPromises();
      await confirmIfShown('确认执行');
      expect(scheduleRequests()).toEqual([]);
      expect(message.error).toHaveBeenCalledWith({
        content: PERMISSION_DENIED_MESSAGE,
        key: PERMISSION_DENIED_MESSAGE_KEY,
      });
    });
  });

  describe('a（61 个码）', () => {
    beforeEach(() => {
      setSubject(getAccountPermissionCodes());
    });

    it('可调度节点「禁用调度」确认后发 1 次 cordon', async () => {
      await mountPage();
      expect(rowScheduleButton(0)?.getAttribute('title')).toBe('禁用调度');
      required(rowScheduleButton(0)).click();
      await flushPromises();
      await confirmIfShown('确认禁用');
      expect(scheduleRequests()).toEqual([
        { method: 'POST', url: cordonUrl('node-1') },
      ]);
    });

    it('不可调度节点「启用调度」确认后发 1 次 uncordon', async () => {
      await mountPage();
      expect(rowScheduleButton(2)?.getAttribute('title')).toBe('启用调度');
      required(rowScheduleButton(2)).click();
      await flushPromises();
      await confirmIfShown('确认启用');
      expect(scheduleRequests()).toEqual([
        { method: 'POST', url: '/k8s/node/7/node-3/uncordon' },
      ]);
    });

    it('选中 N 个可调度节点批量禁用调度，发 N 次 cordon', async () => {
      await mountPage();
      await selectRows(2);
      await runBatch();
      expect(scheduleRequests()).toEqual(
        ['node-1', 'node-2'].map((name) => ({
          method: 'POST',
          url: cordonUrl(name),
        })),
      );
    });
  });
});

/**
 * 第一层复审 v4 P3-4：确认框 UI 不动，打开后权限被收回，点确定时 onOk 再复核一次，不发请求
 */
describe('复审 v4 P3-4：确认框打开后权限被收回，点确定不发请求', () => {
  beforeEach(() => {
    NODES = makeNodes(2, ['node-2']); // node-1 可调度，node-2 已禁用调度
  });

  function expectDeniedOnce() {
    expect(scheduleRequests()).toHaveLength(0);
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith({
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
  }

  it.each([
    ['行内禁用调度', 0, CORDON, '确认禁用'],
    ['行内启用调度', 1, UNCORDON, '确认启用'],
  ])('%s', async (_label, rowIndex, code, okText) => {
    setSubject([code]);
    await mountPage();
    required(rowScheduleButton(rowIndex)).click();
    await flushPromises();
    expect(bodyButton(okText)).toBeTruthy();
    useAccessStore().setAccessCodes([]);
    await flushPromises();
    required(bodyButton(okText)).click();
    await flushPromises();
    await settle();
    expectDeniedOnce();
  });

  it('批量禁用调度', async () => {
    NODES = makeNodes(3);
    setSubject([BATCH_CORDON]);
    await mountPage();
    await selectRows(2);
    required(batchButton()).click();
    await flushPromises();
    expect(bodyButton('确认执行')).toBeTruthy();
    useAccessStore().setAccessCodes([]);
    await flushPromises();
    required(bodyButton('确认执行')).click();
    await flushPromises();
    await settle();
    expectDeniedOnce();
  });

  it('权限未被收回：同样的操作正常发请求（对照）', async () => {
    setSubject([CORDON]);
    await mountPage();
    required(rowScheduleButton(0)).click();
    await flushPromises();
    required(bodyButton('确认禁用')).click();
    await flushPromises();
    await settle();
    expect(scheduleRequests()).toHaveLength(1);
  });
});
