import { reactive } from 'vue';

import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import CloudManagedResources from './CloudManagedResources.vue';

/** 必须存在的页面、DOM 和调用缺失时立即失败，保留原非空断言的测试前提。 */
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected cloud contract fixture to exist');
  }
  return value;
}

const account = vi.hoisted(() => ({ access: null as any, user: null as any }));
const api = vi.hoisted(() => ({
  getCloudAccountDetailApi: vi.fn(),
  getCloudAccountListApi: vi.fn(),
  getManagedOperation: vi.fn(),
  getManagedPermissions: vi.fn(),
  getManagedResourceDetail: vi.fn(),
  getManagedResources: vi.fn(),
  getManagedSyncHistory: vi.fn(),
  listManagedOperations: vi.fn(),
  resolveManagedHistory: vi.fn(),
  reviewManagedOperation: vi.fn(),
  syncManagedResources: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => account.access,
  useUserStore: () => account.user,
}));
vi.mock('#/api/core/tree/tree_account', async (original) => ({
  ...(await original<typeof import('#/api/core/tree/tree_account')>()),
  getCloudAccountDetailApi: api.getCloudAccountDetailApi,
  getCloudAccountListApi: api.getCloudAccountListApi,
}));
vi.mock('#/api/core/tree/tree_cloud', async (original) => ({
  ...(await original<typeof import('#/api/core/tree/tree_cloud')>()),
  getManagedOperation: api.getManagedOperation,
  getManagedPermissions: api.getManagedPermissions,
  getManagedResourceDetail: api.getManagedResourceDetail,
  getManagedResources: api.getManagedResources,
  getManagedSyncHistory: api.getManagedSyncHistory,
  listManagedOperations: api.listManagedOperations,
  resolveManagedHistory: api.resolveManagedHistory,
  reviewManagedOperation: api.reviewManagedOperation,
  syncManagedResources: api.syncManagedResources,
}));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: http }));

// 每条用例挂载完整托管资源页（真实 Select / Table / Modal）。渲染是 CPU 工作，
// 默认 testTimeout 5s 在工人与其他测试抢核时会被墙钟掐断。失败只表现为
// “Test timed out in 5000ms”，单独重跑断言成立，因此只放宽本文件的 testTimeout。
vi.setConfig({ testTimeout: 20_000 });
const codes = [
  'GET /api/tree/cloud/account/list',
  'GET /api/tree/cloud/account/:id/detail',
  'GET /api/tree/cloud/managed/list',
  'GET /api/tree/cloud/managed/detail/:id',
  'GET /api/tree/cloud/managed/history',
  'POST /api/tree/cloud/managed/sync',
  'POST /api/tree/cloud/managed/history/:id/resolve',
  'GET /api/tree/cloud/managed/operations/:operation_id',
  'POST /api/tree/cloud/managed/operations/:operation_id/resolve',
  'GET /api/tree/cloud/managed/operations',
];
const perms = (permissions = codes, super_admin = false) => ({
  permissions,
  super_admin,
  version: 2,
});
const acct = {
  id: 7,
  name: '阿里账户',
  provider: 1,
  regions: [
    {
      cloud_account_id: 7,
      id: 11,
      region: 'cn-hangzhou',
      region_name: '杭州',
      status: 1,
    },
    { cloud_account_id: 7, id: 12, region: 'cn-disabled', status: 2 },
    { cloud_account_id: 99, id: 13, region: 'foreign', status: 1 },
  ],
  status: 1,
};
const row = () => ({
  cloud_account_id: 7,
  cloud_account_region_id: 11,
  id: 5,
  kind: 'rds',
  last_sync_time: '2026-10-29T00:00:00Z',
  local_description: '',
  password: 'private-ssh-marker',
  provider_id: 'rm-one',
  rds: {
    engine: 'MySQL',
    engine_version: '8',
    instance_class: 'db',
    instance_id: 'rm-one',
    name: '数据库',
    region: 'cn-hangzhou',
    status: 'Running',
    zone: 'cn-hangzhou-a',
  },
});
const historical = (status = 'success') => ({
  cloud_account_id: 7,
  cloud_account_region_id: 11,
  count: 1,
  id: 31,
  kind: 'rds',
  new_count: 1,
  operator_id: 7,
  resource_ids: ['rm-one'],
  retry_safe: status === 'unknown' ? false : undefined,
  started_at: '2026-10-29T00:00:00Z',
  status,
  update_count: 0,
});
const deferred = () => {
  let resolve: ((value: unknown) => void) | undefined;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  if (resolve === undefined) {
    throw new Error('Deferred cloud fixture resolver was not initialized');
  }
  return { promise, resolve };
};
let wrapper: undefined | VueWrapper;
async function start() {
  wrapper = mount(CloudManagedResources, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function choose(aria: string, text: string) {
  const field = document.querySelector<HTMLElement>(`[aria-label="${aria}"]`);
  expect(field).not.toBeNull();
  await new DOMWrapper(required(required(field).closest('.ant-select')))
    .find('.ant-select-selector')
    .trigger('mousedown');
  await flushPromises();
  const option = [
    ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
  ].find((item) => item.textContent?.trim() === text);
  expect(option, `missing ${text}`).toBeDefined();
  required(option).click();
  await flushPromises();
}
async function selectScope() {
  await choose('托管资源账户', '阿里账户');
  await choose('托管资源地域', '杭州');
}
async function click(text: string) {
  const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replace(/\s/g, '') === text,
  );
  expect(el, `missing ${text}`).toBeDefined();
  required(el).click();
  await flushPromises();
}
async function fillIDs(value: string) {
  const input = document.querySelector<HTMLTextAreaElement>(
    '#managed-resource-ids',
  );
  expect(input).not.toBeNull();
  await new DOMWrapper(required(input)).setValue(value);
}
const syncButton = () =>
  required(
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.replace(/\s/g, '') === '同步指定ID',
    ),
  );
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'token' });
  api.getManagedPermissions.mockResolvedValue(perms());
  api.listManagedOperations.mockResolvedValue({
    scope_blocked: false,
    total: 0,
    items: [],
  });
  api.getCloudAccountListApi.mockResolvedValue({
    total: 3,
    items: [
      acct,
      { id: 8, name: '其他云', provider: 2, status: 1 },
      { id: 9, name: '禁用阿里', provider: 1, status: 2 },
    ],
  });
  api.getCloudAccountDetailApi.mockResolvedValue(acct);
  api.getManagedResources.mockResolvedValue({ total: 1, items: [row()] });
  api.getManagedResourceDetail.mockResolvedValue(row());
  api.getManagedSyncHistory.mockResolvedValue({ total: 0, items: [] });
  api.syncManagedResources.mockImplementation(async (request) => ({
    count: request.resource_ids.length,
    history_id: 31,
    new_count: request.resource_ids.length,
    operation_id: request.operation_id,
    retry_safe: true,
    status: 'success',
    update_count: 0,
  }));
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const getStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    getStyle(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  localStorage.clear();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('仅提供阿里账户及本账户地域，展示独立 RDS 字段', async () => {
  await start();
  await selectScope();
  expect(api.getCloudAccountListApi).toHaveBeenCalledWith({
    page: 1,
    provider: 1,
    size: 100,
  });
  expect(api.getManagedResources).toHaveBeenCalledWith({
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
    page: 1,
    size: 20,
  });
  expect(required(wrapper).text()).toContain('数据库');
  expect(required(wrapper).text()).not.toContain('private-ssh-marker');
  await click('详情');
  expect(document.body.textContent).toContain('数据库引擎：MySQL');
  expect(document.body.textContent).not.toContain('private-ssh-marker');
});
it('只同步指定ID并在提交前复核精确权限与历史', async () => {
  await start();
  await selectScope();
  await fillIDs('rm-one\nrm-two');
  expect(syncButton().disabled).toBe(false);
  await click('同步指定ID');
  expect(api.getManagedPermissions.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(api.getManagedSyncHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(api.syncManagedResources).toHaveBeenCalledWith({
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
    operation_id: expect.stringMatching(/^[\da-f-]{36}$/),
    resource_ids: ['rm-one', 'rm-two'],
  });
});
it('无精确授权和伪造通配符不得加载账户或同步', async () => {
  api.getManagedPermissions.mockResolvedValue(
    perms(['*', 'POST /api/tree/cloud/*']),
  );
  await start();
  expect(api.getCloudAccountListApi).not.toHaveBeenCalled();
  expect(api.syncManagedResources).not.toHaveBeenCalled();
  expect(required(wrapper).text()).toContain('缺少账户或地域读取权限');
});
it('确认前撤销 POST 权限不会派发同步', async () => {
  api.getManagedPermissions
    .mockResolvedValueOnce(perms())
    .mockResolvedValueOnce(perms(codes.filter((code) => code !== codes[5])));
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('结果未知会跨关闭和重开持续阻止同范围盲重试', async () => {
  api.syncManagedResources.mockImplementation(async (req) => ({
    count: 0,
    history_id: 33,
    new_count: 0,
    operation_id: req.operation_id,
    retry_safe: false,
    status: 'unknown',
    update_count: 0,
  }));
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('不能直接重试');
  required(wrapper).unmount();
  wrapper = undefined;
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
});
it('未知历史或无法完整读取历史时不允许发起同步', async () => {
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('历史总数超过扫描上限时 fail closed', async () => {
  api.getManagedSyncHistory.mockImplementation(async ({ page }) => ({
    total: 1001,
    items: Array.from({ length: 100 }, (_, i) => ({
      ...historical(),
      id: page * 100 + i,
    })),
  }));
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('无法完整核对同步历史');
});
it('缺少历史权限或状态存储不可用时不允许同步', async () => {
  api.getManagedPermissions.mockResolvedValue(
    perms(codes.filter((code) => code !== codes[4])),
  );
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(api.getManagedSyncHistory).not.toHaveBeenCalled();
});
it('状态存储不可用时不会派发同步', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  await start();
  await selectScope();
  await fillIDs('rm-one');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('本机同步状态不可用');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('审计不可用结果会锁定范围并避免声称已保存历史', async () => {
  api.syncManagedResources.mockImplementation(async (req) => ({
    count: 0,
    error_category: 'audit_unavailable',
    new_count: 0,
    operation_id: req.operation_id,
    retry_safe: false,
    status: 'failed',
    update_count: 0,
  }));
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('没有可确认的持久历史记录');
});
it('提交网络故障保守锁定且不泄露错误', async () => {
  api.syncManagedResources.mockRejectedValue(
    new Error('private-upstream-canary'),
  );
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('同步结果未确认');
  expect(document.body.textContent).not.toContain('private-upstream-canary');
});
it('重复或非法 ID 不到达后端', async () => {
  await start();
  await selectScope();
  await fillIDs('rm-one,rm-one');
  await click('同步指定ID');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
  await fillIDs('../bad');
  await click('同步指定ID');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('账户切换清除数据并拒绝迟到详情', async () => {
  const pending = deferred();
  api.getManagedResourceDetail.mockReturnValue(pending.promise);
  await start();
  await selectScope();
  await click('详情');
  account.user.userInfo = { userId: '2' };
  account.access.accessToken = 'new-token';
  await flushPromises();
  pending.resolve(row());
  await flushPromises();
  expect(document.body.textContent).not.toContain('数据库引擎：MySQL');
  expect(required(wrapper).text()).not.toContain('rm-one');
});
it('同账户令牌轮换不解除在途锁', async () => {
  const pending = deferred();
  api.syncManagedResources.mockReturnValue(pending.promise);
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
  account.access.accessToken = 'rotated';
  await flushPromises();
  expect(syncButton().disabled).toBe(true);
  syncButton().click();
  await flushPromises();
  expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
  pending.resolve({
    count: 1,
    history_id: 31,
    new_count: 1,
    retry_safe: true,
    status: 'success',
    update_count: 0,
  });
  await flushPromises();
});
it('切换账户时保存已派发操作的保守锁，旧回包不会写入新账户', async () => {
  const pending = deferred();
  api.syncManagedResources.mockReturnValue(pending.promise);
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  account.user.userInfo = { userId: '2' };
  account.access.accessToken = 'other';
  await flushPromises();
  pending.resolve({
    count: 0,
    history_id: 33,
    new_count: 0,
    retry_safe: false,
    status: 'unknown',
    update_count: 0,
  });
  await flushPromises();
  expect(required(wrapper).text()).not.toContain('历史记录 33');
  account.user.userInfo = { userId: '1' };
  account.access.accessToken = 'token';
  await flushPromises();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
});
it('切换类型时旧历史回包不能解除新范围的未知锁', async () => {
  const old = deferred();
  api.getManagedSyncHistory.mockReturnValueOnce(old.promise).mockResolvedValue({
    total: 1,
    items: [{ ...historical('unknown'), kind: 'cache' }],
  });
  await start();
  await selectScope();
  await choose('托管资源类型', '缓存实例');
  old.resolve({ total: 0, items: [] });
  await flushPromises();
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('不能直接重试');
});
it('aPI 方法与后端范围合同一致', async () => {
  const actual = await vi.importActual<
    typeof import('#/api/core/tree/tree_cloud')
  >('#/api/core/tree/tree_cloud');
  http.get.mockResolvedValue({});
  http.post.mockResolvedValue({});
  const scope = {
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds' as const,
  };
  await actual.getManagedPermissions();
  await actual.getManagedResources({ ...scope, page: 1, size: 20 });
  await actual.getManagedResourceDetail(5, scope);
  await actual.getManagedSyncHistory({ ...scope, page: 1, size: 100 });
  await actual.syncManagedResources({
    ...scope,
    operation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    resource_ids: ['rm-one'],
  });
  expect(http.get.mock.calls).toEqual([
    ['/user/permissions'],
    ['/tree/cloud/managed/list', { params: { ...scope, page: 1, size: 20 } }],
    ['/tree/cloud/managed/detail/5', { params: scope }],
    [
      '/tree/cloud/managed/history',
      { params: { ...scope, page: 1, size: 100 } },
    ],
  ]);
  expect(http.post).toHaveBeenCalledWith('/tree/cloud/managed/sync', {
    ...scope,
    operation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    resource_ids: ['rm-one'],
  });
  await actual.getManagedOperation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await actual.reviewManagedOperation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
    ...scope,
    reason: '已经核对云端资源与本地记录',
    resource_ids: ['rm-one'],
    resources_verified: true,
  });
  expect(http.get).toHaveBeenLastCalledWith(
    '/tree/cloud/managed/operations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  );
  expect(http.post).toHaveBeenLastCalledWith(
    '/tree/cloud/managed/operations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/resolve',
    {
      ...scope,
      reason: '已经核对云端资源与本地记录',
      resource_ids: ['rm-one'],
      resources_verified: true,
    },
  );
  await actual.listManagedOperations({
    ...scope,
    all_owners: true,
    page: 2,
    size: 20,
    unconfirmed_only: true,
  });
  expect(http.get).toHaveBeenLastCalledWith('/tree/cloud/managed/operations', {
    params: {
      ...scope,
      all_owners: true,
      page: 2,
      size: 20,
      unconfirmed_only: true,
    },
  });
  await actual.getManagedOperation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 8);
  expect(http.get).toHaveBeenLastCalledWith(
    '/tree/cloud/managed/operations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    { params: { owner_id: 8 } },
  );
});

async function fillReview(reason = '已经核对云端资源及本地记录的实际状态') {
  await click('记录人工核对');
  const input = required(
    document.querySelector<HTMLTextAreaElement>('#managed-review-reason'),
  );
  await new DOMWrapper(input).setValue(reason);
  const checkbox = required(
    document.querySelector<HTMLInputElement>(
      '.ant-modal input[type="checkbox"]',
    ),
  );
  await new DOMWrapper(checkbox).setValue(true);
}
const reviewed = () => ({
  ...historical('unknown'),
  resolution_reason: '已经核对云端资源及本地记录的实际状态',
  resolved_at: '2026-10-30T01:00:00Z',
  resolved_by: 9,
  retry_safe: true,
});

it('人工核对需要独立精确权限', async () => {
  api.getManagedPermissions.mockResolvedValue(
    perms(codes.filter((code) => !code.endsWith('/resolve'))),
  );
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  expect(required(wrapper).text()).not.toContain('记录人工核对');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
});
it('核对原始结果与操作依据后保存，且只清除对应历史的本地标记', async () => {
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', 'history:31');
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  api.resolveManagedHistory.mockImplementation(async () => {
    api.getManagedSyncHistory.mockResolvedValue({
      total: 1,
      items: [reviewed()],
    });
  });
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  await fillReview();
  await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledWith(31, {
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
    reason: '已经核对云端资源及本地记录的实际状态',
    resources_verified: true,
  });
  expect(required(wrapper).text()).toContain('结果未知');
  expect(required(wrapper).text()).toContain('已人工核对');
  expect(syncButton().disabled).toBe(false);
  expect(
    localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds'),
  ).toBeNull();
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('未关联历史的网络或审计未知标记不能因核对另一历史被清除', async () => {
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', 'pending');
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  api.resolveManagedHistory.mockImplementation(async () => {
    api.getManagedSyncHistory.mockResolvedValue({
      total: 1,
      items: [reviewed()],
    });
  });
  await start();
  await selectScope();
  await fillReview();
  await click('保存核对记录');
  expect(syncButton().disabled).toBe(true);
  expect(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')).toBe(
    'pending',
  );
});
it('没有明确确认或理由过短时不提交核对', async () => {
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  await click('记录人工核对');
  const button = required(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((b) => b.textContent?.replace(/\s/g, '') === '保存核对记录'),
  );
  expect(button.disabled).toBe(true);
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        '.ant-modal input[type="checkbox"]',
      ),
    ),
  ).setValue(true);
  await new DOMWrapper(
    required(
      document.querySelector<HTMLTextAreaElement>('#managed-review-reason'),
    ),
  ).setValue('短');
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
});
it('核对响应中断后保持阻断并禁止在对话框重复提交', async () => {
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  api.resolveManagedHistory.mockRejectedValue(
    new Error('private-review-canary'),
  );
  await start();
  await selectScope();
  await fillReview();
  await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('核对结果未确认');
  expect(document.body.textContent).not.toContain('private-review-canary');
  const button = required(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.ant-modal-footer button',
      ),
    ].find((b) => b.textContent?.replace(/\s/g, '') === '保存核对记录'),
  );
  expect(button.disabled).toBe(true);
  expect(syncButton().disabled).toBe(true);
});
it('核对在途令牌刷新不解锁，身份变化后丢弃迟到结果', async () => {
  const pending = deferred();
  api.resolveManagedHistory.mockReturnValue(pending.promise);
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  await fillReview();
  await click('保存核对记录');
  account.access.accessToken = 'refreshed-token';
  await flushPromises();
  await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledTimes(1);
  account.user.userInfo = { userId: '2' };
  await flushPromises();
  pending.resolve(null);
  await flushPromises();
  expect(document.querySelector('#managed-review-reason')).toBeNull();
  expect(required(wrapper).text()).not.toContain('已人工核对');
});
it('保存前撤销核对权限会清除对话框且不提交', async () => {
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  await fillReview();
  api.getManagedPermissions.mockResolvedValue(
    perms(codes.filter((code) => !code.endsWith('/resolve'))),
  );
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
  expect(document.querySelector('#managed-review-reason')).toBeNull();
});
it('核对前账户读取权限撤销后不会遗留在途锁', async () => {
  api.getManagedSyncHistory.mockResolvedValue({
    total: 1,
    items: [historical('unknown')],
  });
  await start();
  await selectScope();
  await fillReview();
  api.getManagedPermissions.mockResolvedValue(perms([]));
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
  const state = (
    required(wrapper).vm as unknown as {
      $: { setupState: { reviewing: boolean } };
    }
  ).$.setupState;
  expect(state.reviewing).toBe(false);
});
it('重新打开按稳定操作ID读取持久结果，不重新同步', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  localStorage.setItem(
    'cloudops-managed-unconfirmed:1:7:11:rds',
    JSON.stringify({ operation_id: id, resource_ids: ['rm-one'], version: 2 }),
  );
  api.getManagedOperation.mockResolvedValue({
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
    operation_id: id,
    owner_id: 1,
    resource_ids: ['rm-one'],
    result: {
      count: 1,
      history_id: 31,
      new_count: 1,
      operation_id: id,
      retry_safe: true,
      status: 'success',
      update_count: 0,
    },
    state: 'completed',
  });
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(api.getManagedOperation).not.toHaveBeenCalled();
  await click('查询本次操作');
  expect(api.getManagedOperation).toHaveBeenCalledWith(id, undefined);
  expect(api.syncManagedResources).not.toHaveBeenCalled();
  expect(
    localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds'),
  ).toBeNull();
  expect(syncButton().disabled).toBe(false);
});
it('没有操作读取权限时不能创建新同步', async () => {
  api.getManagedPermissions.mockResolvedValue(
    perms(codes.filter((code) => !code.includes('/operations/:operation_id'))),
  );
  await start();
  await selectScope();
  await fillIDs('rm-one');
  expect(syncButton().disabled).toBe(true);
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('同步响应操作ID不匹配时保持原请求指针而不是伪造成功', async () => {
  api.syncManagedResources.mockResolvedValue({
    count: 1,
    history_id: 31,
    new_count: 1,
    operation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    retry_safe: true,
    status: 'success',
    update_count: 0,
  });
  await start();
  await selectScope();
  await fillIDs('rm-one');
  await click('同步指定ID');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('同步结果未确认');
  const marker = JSON.parse(
    required(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')),
  );
  expect(marker.operation_id).toBe(
    required(api.syncManagedResources.mock.calls[0])[0].operation_id,
  );
  expect(marker.operation_id).not.toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});
it('迟到操作结果不能清除另一用户的指针', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const raw = JSON.stringify({
    operation_id: id,
    resource_ids: ['rm-one'],
    version: 2,
  });
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', raw);
  const pending = deferred();
  api.getManagedOperation.mockReturnValue(pending.promise);
  await start();
  await selectScope();
  await click('查询本次操作');
  account.user.userInfo = { userId: '2' };
  await flushPromises();
  pending.resolve({ operation_id: id, state: 'reviewed' });
  await flushPromises();
  expect(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')).toBe(
    raw,
  );
  expect(required(wrapper).text()).not.toContain('待核对操作');
});
it('停用地域可以查询历史但不能同步', async () => {
  await start();
  await choose('托管资源账户', '阿里账户');
  await choose('托管资源地域', 'cn-disabled（已停用）');
  await fillIDs('rm-one');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('该范围已停用');
  expect(api.getManagedSyncHistory).toHaveBeenCalledWith(
    expect.objectContaining({ cloud_account_region_id: 12 }),
  );
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('停用账户可以恢复其操作但不重新启用账户', async () => {
  api.getCloudAccountDetailApi.mockResolvedValue({
    ...acct,
    id: 9,
    regions: acct.regions
      .filter((r) => r.id === 11)
      .map((r) => ({ ...r, cloud_account_id: 9 })),
    status: 2,
  });
  await start();
  await choose('托管资源账户', '禁用阿里（已停用）');
  await choose('托管资源地域', '杭州');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('该范围已停用');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('服务端范围仍阻断时即使本人列表为空也不能同步', async () => {
  api.listManagedOperations.mockResolvedValue({
    scope_blocked: true,
    total: 0,
    items: [],
  });
  await start();
  await selectScope();
  await fillIDs('rm-one');
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('联系超级管理员');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('列表查询故障不得被空列表或旧汇总状态掩盖', async () => {
  api.listManagedOperations.mockRejectedValue(
    new Error('private-scope-canary'),
  );
  await start();
  await selectScope();
  expect(syncButton().disabled).toBe(true);
  expect(required(wrapper).text()).toContain('范围状态读取失败');
  expect(document.body.textContent).not.toContain('private-scope-canary');
});
it('超管核对其他owner同UUID操作不清除本人的本地指针', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const raw = JSON.stringify({
    operation_id: id,
    resource_ids: ['rm-one'],
    version: 2,
  });
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', raw);
  api.getManagedPermissions.mockResolvedValue(perms(codes, true));
  const other = {
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
    operation_id: id,
    owner_id: 2,
    resource_ids: ['rm-one'],
    state: 'unknown',
  };
  api.listManagedOperations.mockImplementation(async (params) => ({
    scope_blocked: true,
    total: params.all_owners ? 1 : 0,
    items: params.all_owners ? [other] : [],
  }));
  await start();
  await selectScope();
  const allOwners = required(
    [
      ...document.querySelectorAll<HTMLLabelElement>('.ant-checkbox-wrapper'),
    ].find((el) => el.textContent?.includes('超级管理员：查看所有用户')),
  );
  await new DOMWrapper(required(allOwners.querySelector('input'))).setValue(
    true,
  );
  await flushPromises();
  await click('查看或核对');
  api.getManagedOperation.mockResolvedValue(other);
  const list = required(wrapper).find('[aria-label="托管操作列表"]');
  await required(
    list
      .findAll('button')
      .find((b) => b.text().replaceAll(/\s/g, '') === '查询本次操作'),
  ).trigger('click');
  await flushPromises();
  await click('核对并阻断旧请求');
  await new DOMWrapper(
    required(
      document.querySelector<HTMLTextAreaElement>(
        '#managed-operation-review-reason',
      ),
    ),
  ).setValue('已经核对用户2的实际资源与本地状态');
  required(
    document.querySelector<HTMLInputElement>(
      '.ant-modal input[type="checkbox"]',
    ),
  ).click();
  await flushPromises();
  const audited = {
    ...other,
    previous_state: 'running',
    review_reason: '已经核对用户2的实际资源与本地状态',
    reviewed_at: '2026-10-30T01:00:00Z',
    reviewed_by: 1,
    state: 'reviewed',
  };
  api.reviewManagedOperation.mockResolvedValue(audited);
  api.getManagedOperation.mockResolvedValue(audited);
  required(
    document.querySelector<HTMLButtonElement>(
      '.ant-modal-footer .ant-btn-primary',
    ),
  ).click();
  await flushPromises();
  expect(api.reviewManagedOperation).toHaveBeenCalledWith(
    id,
    expect.objectContaining({ owner_id: 2 }),
  );
  expect(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')).toBe(
    raw,
  );
  expect(syncButton().disabled).toBe(true);
});

it.each([
  ['ERR_CANCELED', false],
  ['NETWORK_ERROR', true],
])('地域读取失败 %s 仅为实际请求错误显示提示', async (code, visible) => {
  api.getCloudAccountDetailApi.mockRejectedValue({ code });
  await start();
  await choose('托管资源账户', '阿里账户');
  expect(required(wrapper).text().includes('读取账户地域失败，请重试')).toBe(
    visible,
  );
});
it.each([
  ['ERR_CANCELED', false],
  ['NETWORK_ERROR', true],
])('详情读取失败 %s 仅为实际请求错误显示提示', async (code, visible) => {
  api.getManagedResourceDetail.mockRejectedValue({ code });
  await start();
  await selectScope();
  await click('详情');
  expect(required(wrapper).text().includes('资源详情读取失败')).toBe(visible);
});

it('匿名状态不读写未知操作标记，并保持阻塞', async () => {
  await start();
  account.user.userInfo = null;
  account.access.accessToken = null;
  await flushPromises();
  const getItem = vi.spyOn(Storage.prototype, 'getItem');
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
  const setup = Reflect.get(required(wrapper).vm.$, 'setupState');
  const read = Reflect.get(setup, 'readLocal');
  const clear = Reflect.get(setup, 'clearReviewedMarker');
  expect(read).toBeTypeOf('function');
  expect(clear).toBeTypeOf('function');
  const target = {
    cloud_account_id: 7,
    cloud_account_region_id: 11,
    kind: 'rds',
  };
  expect(read(target)).toBe(true);
  clear(target, []);
  expect(getItem).not.toHaveBeenCalled();
  expect(removeItem).not.toHaveBeenCalled();
  expect(Reflect.get(setup, 'localBlocked')).toBe(true);
  expect(Reflect.get(setup, 'pendingOperation')).toBeNull();
});
