import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CloudManagedResources from './CloudManagedResources.vue';

const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  getManagedPermissions: vi.fn(), getManagedResources: vi.fn(), getManagedResourceDetail: vi.fn(), getManagedSyncHistory: vi.fn(), syncManagedResources: vi.fn(), resolveManagedHistory: vi.fn(),
  getCloudAccountListApi: vi.fn(), getCloudAccountDetailApi: vi.fn(),
}));
vi.mock('@vben/stores', () => ({ useUserStore: () => account.user, useAccessStore: () => account.access }));
vi.mock('#/api/core/tree/tree_account', async (original) => ({ ...(await original<typeof import('#/api/core/tree/tree_account')>()), getCloudAccountListApi: api.getCloudAccountListApi, getCloudAccountDetailApi: api.getCloudAccountDetailApi }));
vi.mock('#/api/core/tree/tree_cloud', async (original) => ({ ...(await original<typeof import('#/api/core/tree/tree_cloud')>()), getManagedPermissions: api.getManagedPermissions, getManagedResources: api.getManagedResources, getManagedResourceDetail: api.getManagedResourceDetail, getManagedSyncHistory: api.getManagedSyncHistory, syncManagedResources: api.syncManagedResources, resolveManagedHistory: api.resolveManagedHistory }));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: http }));
const codes = ['GET /api/tree/cloud/account/list', 'GET /api/tree/cloud/account/:id/detail', 'GET /api/tree/cloud/managed/list', 'GET /api/tree/cloud/managed/detail/:id', 'GET /api/tree/cloud/managed/history', 'POST /api/tree/cloud/managed/sync', 'POST /api/tree/cloud/managed/history/:id/resolve'];
const perms = (permissions = codes, super_admin = false) => ({ version: 2, super_admin, permissions });
const acct = { id: 7, name: '阿里账户', provider: 1, status: 1, regions: [{ id: 11, cloud_account_id: 7, region: 'cn-hangzhou', region_name: '杭州', status: 1 }, { id: 12, cloud_account_id: 7, region: 'cn-disabled', status: 2 }, { id: 13, cloud_account_id: 99, region: 'foreign', status: 1 }] };
const row = () => ({ id: 5, cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds', provider_id: 'rm-one', rds: { instance_id: 'rm-one', name: '数据库', region: 'cn-hangzhou', zone: 'cn-hangzhou-a', status: 'Running', engine: 'MySQL', engine_version: '8', instance_class: 'db' }, local_description: '', last_sync_time: '2026-10-29T00:00:00Z', password: 'private-ssh-marker' });
const historical = (status = 'success') => ({ id: 31, cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds', resource_ids: ['rm-one'], status, count: 1, new_count: 1, update_count: 0, operator_id: 7, started_at: '2026-10-29T00:00:00Z', retry_safe: status === 'unknown' ? false : undefined });
const deferred = () => { let resolve!: (v: any) => void; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let wrapper: VueWrapper | undefined;
async function start() { wrapper = mount(CloudManagedResources, { attachTo: document.body, global: { plugins: [Antd] } }); await flushPromises(); }
async function choose(aria: string, text: string) {
  const field = document.querySelector<HTMLElement>(`[aria-label="${aria}"]`); expect(field).not.toBeNull();
  await new DOMWrapper(field!.closest('.ant-select')!).find('.ant-select-selector').trigger('mousedown'); await flushPromises();
  const option = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find((item) => item.textContent?.trim() === text);
  expect(option, `missing ${text}`).toBeDefined(); option!.click(); await flushPromises();
}
async function selectScope() { await choose('托管资源账户', '阿里账户'); await choose('托管资源地域', '杭州'); }
async function click(text: string) { const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.replace(/\s/g, '') === text); expect(el, `missing ${text}`).toBeDefined(); el!.click(); await flushPromises(); }
async function fillIDs(value: string) { const input = document.querySelector<HTMLTextAreaElement>('#managed-resource-ids'); expect(input).not.toBeNull(); await new DOMWrapper(input!).setValue(value); }
const syncButton = () => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.replace(/\s/g, '') === '同步指定ID')!;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); account.user = reactive({ userInfo: { userId: '1' } }); account.access = reactive({ accessToken: 'token' });
  api.getManagedPermissions.mockResolvedValue(perms());
  api.getCloudAccountListApi.mockResolvedValue({ items: [acct, { id: 8, name: '其他云', provider: 2, status: 1 }, { id: 9, name: '禁用阿里', provider: 1, status: 2 }], total: 3 });
  api.getCloudAccountDetailApi.mockResolvedValue(acct); api.getManagedResources.mockResolvedValue({ items: [row()], total: 1 });
  api.getManagedResourceDetail.mockResolvedValue(row()); api.getManagedSyncHistory.mockResolvedValue({ items: [], total: 0 });
  api.syncManagedResources.mockResolvedValue({ status: 'success', history_id: 31, count: 1, new_count: 1, update_count: 0, retry_safe: true });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
  const getStyle = window.getComputedStyle; vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getStyle(element));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; localStorage.clear(); message.destroy(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('仅提供启用阿里账户与本账户启用地域，展示独立 RDS 字段', async () => {
  await start(); await selectScope();
  expect(api.getCloudAccountListApi).toHaveBeenCalledWith({ page: 1, size: 100, provider: 1, status: 1 });
  expect(api.getManagedResources).toHaveBeenCalledWith({ cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds', page: 1, size: 20 });
  expect(wrapper!.text()).toContain('数据库'); expect(wrapper!.text()).not.toContain('private-ssh-marker');
  await click('详情'); expect(document.body.textContent).toContain('数据库引擎：MySQL');
  expect(document.body.textContent).not.toContain('private-ssh-marker');
});
it('只同步指定ID并在提交前复核精确权限与历史', async () => {
  await start(); await selectScope(); await fillIDs('rm-one\nrm-two');
  expect(syncButton().disabled).toBe(false); await click('同步指定ID');
  expect(api.getManagedPermissions.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(api.getManagedSyncHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(api.syncManagedResources).toHaveBeenCalledWith({ cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds', resource_ids: ['rm-one', 'rm-two'] });
});
it('无精确授权和伪造通配符不得加载账户或同步', async () => {
  api.getManagedPermissions.mockResolvedValue(perms(['*', 'POST /api/tree/cloud/*'])); await start();
  expect(api.getCloudAccountListApi).not.toHaveBeenCalled(); expect(api.syncManagedResources).not.toHaveBeenCalled();
  expect(wrapper!.text()).toContain('缺少账户或地域读取权限');
});
it('确认前撤销 POST 权限不会派发同步', async () => {
  api.getManagedPermissions.mockResolvedValueOnce(perms()).mockResolvedValueOnce(perms(codes.filter((code) => code !== codes[5])));
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('结果未知会跨关闭和重开持续阻止同范围盲重试', async () => {
  api.syncManagedResources.mockResolvedValue({ status: 'unknown', history_id: 33, count: 0, new_count: 0, update_count: 0, retry_safe: false });
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID');
  expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('不能直接重试');
  wrapper!.unmount(); wrapper = undefined;
  await start(); await selectScope(); expect(syncButton().disabled).toBe(true);
  expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
});
it('未知历史或无法完整读取历史时不允许发起同步', async () => {
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope(); expect(syncButton().disabled).toBe(true); expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('历史总数超过扫描上限时 fail closed', async () => {
  api.getManagedSyncHistory.mockImplementation(async ({ page }) => ({ items: Array.from({ length: 100 }, (_, i) => ({ ...historical(), id: page * 100 + i })), total: 1001 }));
  await start(); await selectScope(); expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('无法完整核对同步历史');
});
it('缺少历史权限或状态存储不可用时不允许同步', async () => {
  api.getManagedPermissions.mockResolvedValue(perms(codes.filter((code) => code !== codes[4])));
  await start(); await selectScope(); expect(syncButton().disabled).toBe(true); expect(api.getManagedSyncHistory).not.toHaveBeenCalled();
});
it('状态存储不可用时不会派发同步', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  await start(); await selectScope(); await fillIDs('rm-one');
  expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('本机同步状态不可用');
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('审计不可用结果会锁定范围并避免声称已保存历史', async () => {
  api.syncManagedResources.mockResolvedValue({ status: 'failed', error_category: 'audit_unavailable', count: 0, new_count: 0, update_count: 0, retry_safe: false });
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID');
  expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('没有可确认的持久历史记录');
});
it('提交网络故障保守锁定且不泄露错误', async () => {
  api.syncManagedResources.mockRejectedValue(new Error('private-upstream-canary'));
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID');
  expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('同步结果未确认'); expect(document.body.textContent).not.toContain('private-upstream-canary');
});
it('重复或非法 ID 不到达后端', async () => {
  await start(); await selectScope(); await fillIDs('rm-one,rm-one'); await click('同步指定ID'); expect(api.syncManagedResources).not.toHaveBeenCalled();
  await fillIDs('../bad'); await click('同步指定ID'); expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('账户切换清除数据并拒绝迟到详情', async () => {
  const pending = deferred(); api.getManagedResourceDetail.mockReturnValue(pending.promise);
  await start(); await selectScope(); await click('详情');
  account.user.userInfo = { userId: '2' }; account.access.accessToken = 'new-token'; await flushPromises(); pending.resolve(row()); await flushPromises();
  expect(document.body.textContent).not.toContain('数据库引擎：MySQL'); expect(wrapper!.text()).not.toContain('rm-one');
});
it('同账户令牌轮换不解除在途锁', async () => {
  const pending = deferred(); api.syncManagedResources.mockReturnValue(pending.promise);
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID'); expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
  account.access.accessToken = 'rotated'; await flushPromises(); expect(syncButton().disabled).toBe(true);
  syncButton().click(); await flushPromises(); expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
  pending.resolve({ status: 'success', history_id: 31, count: 1, new_count: 1, update_count: 0, retry_safe: true }); await flushPromises();
});
it('切换账户时保存已派发操作的保守锁，旧回包不会写入新账户', async () => {
  const pending = deferred(); api.syncManagedResources.mockReturnValue(pending.promise);
  await start(); await selectScope(); await fillIDs('rm-one'); await click('同步指定ID');
  account.user.userInfo = { userId: '2' }; account.access.accessToken = 'other'; await flushPromises();
  pending.resolve({ status: 'unknown', history_id: 33, count: 0, new_count: 0, update_count: 0, retry_safe: false }); await flushPromises();
  expect(wrapper!.text()).not.toContain('历史记录 33');
  account.user.userInfo = { userId: '1' }; account.access.accessToken = 'token'; await flushPromises(); await selectScope();
  expect(syncButton().disabled).toBe(true); expect(api.syncManagedResources).toHaveBeenCalledTimes(1);
});
it('切换类型时旧历史回包不能解除新范围的未知锁', async () => {
  const old = deferred();
  api.getManagedSyncHistory.mockReturnValueOnce(old.promise).mockResolvedValue({ items: [{ ...historical('unknown'), kind: 'cache' }], total: 1 });
  await start(); await selectScope(); await choose('托管资源类型', '缓存实例');
  old.resolve({ items: [], total: 0 }); await flushPromises();
  expect(syncButton().disabled).toBe(true); expect(wrapper!.text()).toContain('不能直接重试');
});
it('API 方法与后端范围合同一致', async () => {
  const actual = await vi.importActual<typeof import('#/api/core/tree/tree_cloud')>('#/api/core/tree/tree_cloud');
  http.get.mockResolvedValue({}); http.post.mockResolvedValue({});
  const scope = { cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds' as const };
  await actual.getManagedPermissions(); await actual.getManagedResources({ ...scope, page: 1, size: 20 }); await actual.getManagedResourceDetail(5, scope); await actual.getManagedSyncHistory({ ...scope, page: 1, size: 100 }); await actual.syncManagedResources({ ...scope, resource_ids: ['rm-one'] });
  expect(http.get.mock.calls).toEqual([['/user/permissions'], ['/tree/cloud/managed/list', { params: { ...scope, page: 1, size: 20 } }], ['/tree/cloud/managed/detail/5', { params: scope }], ['/tree/cloud/managed/history', { params: { ...scope, page: 1, size: 100 } }]]);
  expect(http.post).toHaveBeenCalledWith('/tree/cloud/managed/sync', { ...scope, resource_ids: ['rm-one'] });
});

async function fillReview(reason = '已经核对云端资源及本地记录的实际状态') {
  await click('记录人工核对');
  const input = document.querySelector<HTMLTextAreaElement>('#managed-review-reason')!;
  await new DOMWrapper(input).setValue(reason);
  const checkbox = document.querySelector<HTMLInputElement>('.ant-modal input[type="checkbox"]')!;
  await new DOMWrapper(checkbox).setValue(true);
}
const reviewed = () => ({ ...historical('unknown'), retry_safe: true, resolved_at: '2026-10-30T01:00:00Z', resolved_by: 9, resolution_reason: '已经核对云端资源及本地记录的实际状态' });

it('人工核对需要独立精确权限', async () => {
  api.getManagedPermissions.mockResolvedValue(perms(codes.filter((code) => !code.endsWith('/resolve'))));
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope();
  expect(wrapper!.text()).not.toContain('记录人工核对');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
});
it('核对原始结果与操作依据后保存，且只清除对应历史的本地标记', async () => {
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', 'history:31');
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  api.resolveManagedHistory.mockImplementation(async () => { api.getManagedSyncHistory.mockResolvedValue({ items: [reviewed()], total: 1 }); });
  await start(); await selectScope(); expect(syncButton().disabled).toBe(true);
  await fillReview(); await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledWith(31, { cloud_account_id: 7, cloud_account_region_id: 11, kind: 'rds', resources_verified: true, reason: '已经核对云端资源及本地记录的实际状态' });
  expect(wrapper!.text()).toContain('结果未知'); expect(wrapper!.text()).toContain('已人工核对');
  expect(syncButton().disabled).toBe(false);
  expect(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')).toBeNull();
  expect(api.syncManagedResources).not.toHaveBeenCalled();
});
it('未关联历史的网络或审计未知标记不能因核对另一历史被清除', async () => {
  localStorage.setItem('cloudops-managed-unconfirmed:1:7:11:rds', 'pending');
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  api.resolveManagedHistory.mockImplementation(async () => { api.getManagedSyncHistory.mockResolvedValue({ items: [reviewed()], total: 1 }); });
  await start(); await selectScope(); await fillReview(); await click('保存核对记录');
  expect(syncButton().disabled).toBe(true);
  expect(localStorage.getItem('cloudops-managed-unconfirmed:1:7:11:rds')).toBe('pending');
});
it('没有明确确认或理由过短时不提交核对', async () => {
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope(); await click('记录人工核对');
  const button = [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button')].find((b) => b.textContent?.replace(/\s/g, '') === '保存核对记录')!;
  expect(button.disabled).toBe(true);
  await new DOMWrapper(document.querySelector<HTMLInputElement>('.ant-modal input[type="checkbox"]')!).setValue(true);
  await new DOMWrapper(document.querySelector<HTMLTextAreaElement>('#managed-review-reason')!).setValue('短');
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
});
it('核对响应中断后保持阻断并禁止在对话框重复提交', async () => {
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  api.resolveManagedHistory.mockRejectedValue(new Error('private-review-canary'));
  await start(); await selectScope(); await fillReview(); await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('核对结果未确认');
  expect(document.body.textContent).not.toContain('private-review-canary');
  const button = [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button')].find((b) => b.textContent?.replace(/\s/g, '') === '保存核对记录')!;
  expect(button.disabled).toBe(true); expect(syncButton().disabled).toBe(true);
});
it('核对在途令牌刷新不解锁，身份变化后丢弃迟到结果', async () => {
  const pending = deferred(); api.resolveManagedHistory.mockReturnValue(pending.promise);
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope(); await fillReview(); await click('保存核对记录');
  account.access.accessToken = 'refreshed-token'; await flushPromises(); await click('保存核对记录');
  expect(api.resolveManagedHistory).toHaveBeenCalledTimes(1);
  account.user.userInfo = { userId: '2' }; await flushPromises(); pending.resolve(null); await flushPromises();
  expect(document.querySelector('#managed-review-reason')).toBeNull();
  expect(wrapper!.text()).not.toContain('已人工核对');
});
it('保存前撤销核对权限会清除对话框且不提交', async () => {
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope(); await fillReview();
  api.getManagedPermissions.mockResolvedValue(perms(codes.filter((code) => !code.endsWith('/resolve'))));
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
  expect(document.querySelector('#managed-review-reason')).toBeNull();
});
it('核对前账户读取权限撤销后不会遗留在途锁', async () => {
  api.getManagedSyncHistory.mockResolvedValue({ items: [historical('unknown')], total: 1 });
  await start(); await selectScope(); await fillReview();
  api.getManagedPermissions.mockResolvedValue(perms([]));
  await click('保存核对记录');
  expect(api.resolveManagedHistory).not.toHaveBeenCalled();
  const state = (wrapper!.vm as unknown as { $: { setupState: { reviewing: boolean } } }).$.setupState;
  expect(state.reviewing).toBe(false);
});
