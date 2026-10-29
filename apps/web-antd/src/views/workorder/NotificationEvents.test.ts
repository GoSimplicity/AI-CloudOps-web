import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NotificationEvents from './NotificationEvents.vue';

const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  getCurrentPermissions: vi.fn(), listNotificationEvents: vi.fn(), getNotificationDeliveries: vi.fn(),
  getNotificationResolutions: vi.fn(), cancelNotificationEvent: vi.fn(), retryNotificationEvent: vi.fn(), resolveNotificationDelivery: vi.fn(),
}));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: http }));
vi.mock('@vben/stores', () => ({ useUserStore: () => account.user, useAccessStore: () => account.access }));
vi.mock('#/api/core/workorder/notification-events', () => ({
  ...api,
  notificationEventPermissions: {
    list: 'GET /api/workorder/notification/events', deliveries: 'GET /api/workorder/notification/events/:id/deliveries',
    resolutions: 'GET /api/workorder/notification/events/:id/resolutions', cancel: 'POST /api/workorder/notification/events/:id/cancel',
    retry: 'POST /api/workorder/notification/events/:id/retry', resolve: 'POST /api/workorder/notification/events/:id/resolve',
  },
}));
let wrapper: VueWrapper | undefined;
const allCodes = [
  'GET /api/workorder/notification/events', 'GET /api/workorder/notification/events/:id/deliveries',
  'GET /api/workorder/notification/events/:id/resolutions', 'POST /api/workorder/notification/events/:id/cancel',
  'POST /api/workorder/notification/events/:id/retry', 'POST /api/workorder/notification/events/:id/resolve',
];
const event = (status = 'pending') => ({ id: 10, parent_event_id: 5, instance_id: 8, event_type: 'instance_created', status, attempts: 1, next_attempt_at: '2026-10-29T12:00:00Z', secret: 'raw-secret-marker' });
const delivery = () => ({ id: 30, event_id: 10, notification_id: 4, channel: 'email', recipient_masked: 'a***@e***', recipient_hash: 'a'.repeat(64), status: 'uncertain', attempts: 1, content: 'raw-body-marker' });
const permission = (permissions = allCodes, super_admin = false) => ({ version: 2, super_admin, permissions });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function start() {
  wrapper = mount(NotificationEvents, { attachTo: document.body, global: { plugins: [Antd] } });
  await flushPromises();
}
async function click(text: string, selector = 'button') {
  const button = [...document.querySelectorAll<HTMLButtonElement>(selector)].find((item) => item.textContent?.replace(/\s/g, '') === text);
  expect(button, `missing ${text}`).toBeDefined(); button!.click(); await flushPromises();
}
async function enterReason(value = '已经核对发送记录') {
  const input = document.querySelector<HTMLTextAreaElement>('#notification-action-reason');
  expect(input).not.toBeNull(); await new DOMWrapper(input!).setValue(value);
}
beforeEach(() => {
  vi.resetAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'fixture-token' });
  api.getCurrentPermissions.mockResolvedValue(permission());
  api.listNotificationEvents.mockResolvedValue({ items: [event()], total: 1 });
  api.getNotificationDeliveries.mockResolvedValue([delivery()]);
  api.getNotificationResolutions.mockResolvedValue([{ id: 2, action: 'retry', operator_id: 7, created_at: '2026-10-29T12:00:00Z', reason: 'sensitive-audit-reason' }]);
  api.cancelNotificationEvent.mockResolvedValue(undefined); api.retryNotificationEvent.mockResolvedValue(undefined); api.resolveNotificationDelivery.mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
  const getStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getStyle(element));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; message.destroy(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('加载事件和脱敏详情，不展示消息、原始字段或审计原因', async () => {
  await start();
  expect(api.listNotificationEvents).toHaveBeenCalledWith({ page: 1, size: 20 });
  await click('详情');
  expect(document.body.textContent).toContain('a***@e***');
  expect(document.body.textContent).toContain('a'.repeat(64));
  for (const value of ['raw-secret-marker', 'raw-body-marker', 'sensitive-audit-reason']) expect(document.body.textContent).not.toContain(value);
});

it('分页按后端 page/size 查询，迟到的前一页结果不覆盖当前页', async () => {
  const stale = deferred();
  api.listNotificationEvents.mockResolvedValueOnce({ items: [event()], total: 40 }).mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ items: [{ ...event(), id: 22 }], total: 40 });
  await start();
  await click('刷新');
  const pageTwo = document.querySelector<HTMLLIElement>('.ant-pagination-item-2');
  expect(pageTwo).not.toBeNull(); pageTwo!.click(); await flushPromises();
  expect(api.listNotificationEvents).toHaveBeenLastCalledWith({ page: 2, size: 20 });
  stale.resolve({ items: [{ ...event(), id: 11 }], total: 40 }); await flushPromises();
  expect(wrapper!.text()).toContain('22');
  expect(wrapper!.text()).not.toContain('11');
});

it('严格拒绝无精确权限和伪造通配码', async () => {
  api.getCurrentPermissions.mockResolvedValue(permission([allCodes[0]!, 'POST /api/workorder/*', '*']));
  await start();
  expect(document.body.textContent).not.toContain('取消排期');
  expect(document.body.textContent).not.toContain('详情');
  expect(api.getNotificationDeliveries).not.toHaveBeenCalled();
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
});

it('超管依据信任的 v2 标志通行，取消需填写原因并确认', async () => {
  api.getCurrentPermissions.mockResolvedValue(permission(['*'], true));
  await start();
  await click('取消排期');
  expect(document.body.textContent).toContain('无法保证撤回');
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
  await enterReason();
  await click('确认', '.ant-modal-footer button');
  expect(api.getCurrentPermissions).toHaveBeenCalledTimes(2);
  expect(api.cancelNotificationEvent).toHaveBeenCalledWith(10, '已经核对发送记录');
});

it('原因不足或超过字节上限时不查询权限也不发起操作', async () => {
  await start(); await click('取消排期'); await enterReason('短'); await click('确认', '.ant-modal-footer button');
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
  expect(api.getCurrentPermissions).toHaveBeenCalledTimes(1);
  await enterReason('核'.repeat(200)); await click('确认', '.ant-modal-footer button');
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
  expect(api.getCurrentPermissions).toHaveBeenCalledTimes(1);
});

it('确认前撤权时重新查询权限，不发送取消请求', async () => {
  api.getCurrentPermissions.mockResolvedValueOnce(permission()).mockResolvedValueOnce(permission(allCodes.filter((code) => code !== allCodes[3])));
  await start(); await click('取消排期'); await enterReason(); await click('确认', '.ant-modal-footer button');
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
});

it('写操作出错不暴露后端异常原文，且提示先核对', async () => {
  const notify = vi.spyOn(message, 'error');
  api.cancelNotificationEvent.mockRejectedValue(new Error('secret-upstream-exception'));
  await start(); await click('取消排期'); await enterReason(); await click('确认', '.ant-modal-footer button');
  expect(notify).toHaveBeenCalledWith('操作未确认，请刷新状态并核对后再处理');
  expect(document.body.textContent).not.toContain('secret-upstream-exception');
});

it('确认权限失败时清空已展示的详情与列表', async () => {
  api.listNotificationEvents.mockResolvedValue({ items: [event('failed')], total: 1 });
  api.getCurrentPermissions.mockResolvedValueOnce(permission()).mockRejectedValueOnce(new Error('private-token'));
  await start(); await click('详情'); await click('重试事件'); await enterReason(); await click('确认', '.ant-modal-footer button');
  expect(api.retryNotificationEvent).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain('a***@e***');
  expect(document.body.textContent).not.toContain('private-token');
});

it('不确定结果逐接收人确认，重投需显式操作和原因', async () => {
  api.listNotificationEvents.mockResolvedValue({ items: [event('uncertain')], total: 1 });
  await start(); await click('详情'); await click('重新投递');
  expect(document.body.textContent).toContain('可能重复投递');
  await enterReason('已确认渠道未送达'); await click('确认', '.ant-modal-footer button');
  expect(api.resolveNotificationDelivery).toHaveBeenCalledWith(10, 30, 'retry', '已确认渠道未送达');
});

it('确认送达采用 delivered 合同并识别短飞书脱敏标识', async () => {
  api.listNotificationEvents.mockResolvedValue({ items: [event('uncertain')], total: 1 });
  api.getNotificationDeliveries.mockResolvedValue([{ ...delivery(), channel: 'feishu', recipient_masked: 'ou_***' }]);
  await start(); await click('详情');
  expect(document.body.textContent).toContain('ou_***');
  await click('确认送达'); await enterReason('渠道核对已经送达'); await click('确认', '.ant-modal-footer button');
  expect(api.resolveNotificationDelivery).toHaveBeenCalledWith(10, 30, 'delivered', '渠道核对已经送达');
});

it('拒绝不安全的脱敏标识，并对事件失败提供重试', async () => {
  api.listNotificationEvents.mockResolvedValue({ items: [event('failed')], total: 1 });
  api.getNotificationDeliveries.mockResolvedValue([{ ...delivery(), recipient_masked: 'alice@example.test SECRET*', attempts: 'private-attempt-field' }]);
  await start(); await click('详情');
  expect(document.body.textContent).not.toContain('alice@example.test');
  expect(document.body.textContent).not.toContain('private-attempt-field');
  expect(document.body.textContent).toContain('暂无脱敏标识');
  await click('重试事件'); await enterReason('已经修复并核对'); await click('确认', '.ant-modal-footer button');
  expect(api.retryNotificationEvent).toHaveBeenCalledWith(10, '已经修复并核对');
});

it('身份变化时清除旧结果并丢弃迟到详情', async () => {
  const pending = deferred(); api.getNotificationDeliveries.mockReturnValue(pending.promise);
  await start(); await click('详情');
  account.user.userInfo = { userId: '2' }; account.access.accessToken = 'second-token';
  await flushPromises(); pending.resolve([delivery()]); await flushPromises();
  expect(document.body.textContent).not.toContain('a***@e***');
  expect(document.body.textContent).not.toContain('raw-body-marker');
});

it('身份在确认授权过程中变化，不对新身份提交旧操作', async () => {
  const pending = deferred(); api.getCurrentPermissions.mockResolvedValueOnce(permission()).mockReturnValueOnce(pending.promise).mockResolvedValue(permission());
  await start(); await click('取消排期'); await enterReason();
  const ok = [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button')].find((item) => item.textContent?.replace(/\s/g, '') === '确认');
  ok!.click(); await flushPromises();
  account.user.userInfo = { userId: '2' }; account.access.accessToken = 'second-token';
  await flushPromises(); pending.resolve(permission()); await flushPromises();
  expect(api.cancelNotificationEvent).not.toHaveBeenCalled();
});

it('同一账户轮换令牌不会解除在途操作锁或重复提交', async () => {
  const pending = deferred(); api.cancelNotificationEvent.mockReturnValue(pending.promise);
  await start(); await click('取消排期'); await enterReason();
  const ok = [...document.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button')].find((item) => item.textContent?.replace(/\s/g, '') === '确认')!;
  ok.click(); await flushPromises();
  expect(api.cancelNotificationEvent).toHaveBeenCalledTimes(1);
  account.access.accessToken = 'refreshed-token'; await flushPromises();
  ok.click(); await flushPromises();
  expect(api.cancelNotificationEvent).toHaveBeenCalledTimes(1);
  pending.resolve(undefined); await flushPromises();
});

it('权限接口格式错误时关闭数据和操作', async () => {
  api.getCurrentPermissions.mockResolvedValue({ version: 1, super_admin: true, permissions: ['*'] });
  await start();
  expect(api.listNotificationEvents).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('无法确认当前用户权限');
});

it('API 按后端合同发送精确路径和请求体', async () => {
  const actual = await vi.importActual<typeof import('#/api/core/workorder/notification-events')>('#/api/core/workorder/notification-events');
  http.get.mockResolvedValue({}); http.post.mockResolvedValue({});
  await actual.getCurrentPermissions();
  await actual.listNotificationEvents({ page: 2, size: 20, status: 'uncertain' });
  await actual.getNotificationDeliveries(10);
  await actual.getNotificationResolutions(10);
  await actual.cancelNotificationEvent(10, 'verified');
  await actual.retryNotificationEvent(10, 'verified');
  await actual.resolveNotificationDelivery(10, 30, 'delivered', 'verified');
  expect(http.get.mock.calls).toEqual([
    ['/user/permissions'], ['/workorder/notification/events', { params: { page: 2, size: 20, status: 'uncertain' } }],
    ['/workorder/notification/events/10/deliveries'], ['/workorder/notification/events/10/resolutions'],
  ]);
  expect(http.post.mock.calls).toEqual([
    ['/workorder/notification/events/10/cancel', { reason: 'verified' }],
    ['/workorder/notification/events/10/retry', { reason: 'verified' }],
    ['/workorder/notification/events/10/resolve', { delivery_id: 30, action: 'delivered', reason: 'verified' }],
  ]);
});
