import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InboxNotification from './InboxNotification.vue';

const account = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  getInboxPermissions: vi.fn(),
  getInboxUnreadCount: vi.fn(),
  getInboxMessages: vi.fn(),
  markInboxRead: vi.fn(),
  markAllInboxRead: vi.fn(),
  deleteInboxMessage: vi.fn(),
}));
const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => account.user,
  useAccessStore: () => account.access,
}));
vi.mock('#/api/request', () => ({ requestClient: http }));
vi.mock('#/api/core/workorder/inbox', () => ({
  ...api,
  inboxPermissions: {
    list: 'GET /api/workorder/notification/inbox',
    unread: 'GET /api/workorder/notification/inbox/unread',
    read: 'POST /api/workorder/notification/inbox/:id/read',
    readAll: 'POST /api/workorder/notification/inbox/read-all',
    delete: 'DELETE /api/workorder/notification/inbox/:id',
  },
}));
const codes = [
  'GET /api/workorder/notification/inbox',
  'GET /api/workorder/notification/inbox/unread',
  'POST /api/workorder/notification/inbox/:id/read',
  'POST /api/workorder/notification/inbox/read-all',
  'DELETE /api/workorder/notification/inbox/:id',
];
const perms = (permissions = codes, super_admin = false) => ({
  version: 2,
  super_admin,
  permissions,
});
const record = (id = 11) => ({
  id,
  event_id: 3,
  notification_id: 4,
  instance_id: 5,
  event_type: 'instance_created',
  subject: '测试消息',
  content: '<img src=x onerror=alert(1)>',
  read_at: null,
  created_at: '2026-10-29T10:00:00Z',
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let wrapper: VueWrapper | undefined;
async function start() {
  wrapper = mount(InboxNotification, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function open() {
  await wrapper!.find('[aria-label="站内消息"]').trigger('click');
  await flushPromises();
  await vi.waitFor(
    () => expect(document.querySelector('.inbox')).not.toBeNull(),
    { timeout: 2000 },
  );
}
async function click(text: string, selector = 'button') {
  const find = () =>
    [...document.querySelectorAll<HTMLButtonElement>(selector)].find(
      (item) => item.textContent?.replace(/\s/g, '') === text,
    );
  await vi.waitFor(() => expect(find()).toBeDefined(), { timeout: 2000 });
  const button = find();
  expect(button, `missing ${text}`).toBeDefined();
  button!.click();
  await flushPromises();
}
beforeEach(() => {
  vi.resetAllMocks();
  account.user = reactive({ userInfo: { userId: '1' } });
  account.access = reactive({ accessToken: 'fixture' });
  api.getInboxPermissions.mockResolvedValue(perms());
  api.getInboxUnreadCount.mockResolvedValue({ unread: 1 });
  api.getInboxMessages.mockResolvedValue({ items: [record()], total: 1 });
  api.markInboxRead.mockResolvedValue(undefined);
  api.markAllInboxRead.mockResolvedValue(undefined);
  api.deleteInboxMessage.mockResolvedValue(undefined);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
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
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('挂载读取未读数，打开读取消息，正文仅以文本展示', async () => {
  await start();
  expect(api.getInboxUnreadCount).toHaveBeenCalledTimes(1);
  expect(api.getInboxMessages).not.toHaveBeenCalled();
  await open();
  expect(api.getInboxMessages).toHaveBeenCalledWith({ page: 1, size: 10 });
  expect(document.body.textContent).toContain('测试消息');
  expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(document.querySelector('.inbox-content img')).toBeNull();
});
it('单条已读、全部已读与确认删除走独立API并刷新', async () => {
  await start();
  await open();
  await click('标记已读');
  expect(api.markInboxRead).toHaveBeenCalledWith(11);
  await click('全部已读');
  expect(api.markAllInboxRead).toHaveBeenCalledTimes(1);
  await click('删除');
  expect(api.deleteInboxMessage).not.toHaveBeenCalled();
  await click('删除', '.ant-popconfirm-buttons button');
  expect(api.deleteInboxMessage).toHaveBeenCalledWith(11);
  expect(api.getInboxMessages.mock.calls.length).toBeGreaterThanOrEqual(4);
});
it('无精确权限不读取列表和不展示写操作，伪造通配码无效', async () => {
  api.getInboxPermissions.mockResolvedValue(perms([codes[1]!, '*']));
  await start();
  await open();
  expect(api.getInboxUnreadCount).toHaveBeenCalled();
  expect(api.getInboxMessages).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('当前用户无站内消息列表权限');
  expect(api.markInboxRead).not.toHaveBeenCalled();
});
it('写入前重新确认权限，撤权不执行', async () => {
  api.getInboxPermissions
    .mockResolvedValueOnce(perms())
    .mockResolvedValueOnce(perms())
    .mockResolvedValueOnce(perms(codes.filter((x) => x !== codes[2])));
  await start();
  await open();
  await click('标记已读');
  expect(api.markInboxRead).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('当前用户没有该操作权限');
});
it('刷新失败提示真实错误状态，不把失败伪装成空消息', async () => {
  api.getInboxUnreadCount.mockRejectedValue(new Error('private-unread-error'));
  api.getInboxMessages.mockRejectedValue(new Error('private-list-error'));
  await start();
  await open();
  expect(document.body.textContent).toContain('未读数未知');
  expect(document.body.textContent).toContain('未读数量获取失败');
  expect(document.body.textContent).toContain('消息加载失败，请重试');
  expect(document.body.textContent).not.toContain('暂无消息');
  expect(document.body.textContent).not.toContain('private-list-error');
});
it('用户切换清空旧消息，迟到响应不能显示给新用户', async () => {
  api.getInboxUnreadCount
    .mockResolvedValueOnce({ unread: 1 })
    .mockResolvedValueOnce({ unread: 1 })
    .mockResolvedValue({ unread: 2 });
  const pending = deferred();
  api.getInboxMessages.mockReturnValueOnce(pending.promise);
  await start();
  await open();
  account.user.userInfo = { userId: '2' };
  account.access.accessToken = 'other';
  await flushPromises();
  pending.resolve({
    items: [{ ...record(), subject: 'old-private-content' }],
    total: 1,
  });
  await flushPromises();
  expect(document.body.textContent).not.toContain('old-private-content');
  expect(
    wrapper!.find('[aria-label="站内消息"]').attributes('title'),
  ).toContain('未读 2');
});
it('用户切换或关闭面板时取消未发出的授权确认', async () => {
  const pending = deferred();
  api.getInboxPermissions
    .mockResolvedValueOnce(perms())
    .mockResolvedValueOnce(perms())
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(perms());
  await start();
  await open();
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((item) => item.textContent?.replace(/\s/g, '') === '标记已读')!;
  button.click();
  await flushPromises();
  account.user.userInfo = { userId: '2' };
  account.access.accessToken = 'other';
  await flushPromises();
  pending.resolve(perms());
  await flushPromises();
  expect(api.markInboxRead).not.toHaveBeenCalled();
});
it('同一用户token轮换不解除在途请求锁', async () => {
  const pending = deferred();
  api.markInboxRead.mockReturnValue(pending.promise);
  await start();
  await open();
  await click('标记已读');
  expect(api.markInboxRead).toHaveBeenCalledTimes(1);
  account.access.accessToken = 'rotated';
  await flushPromises();
  await click('标记已读');
  expect(api.markInboxRead).toHaveBeenCalledTimes(1);
  pending.resolve(undefined);
  await flushPromises();
});
it('未读筛选与分页参数一致，旧请求不会覆盖新结果', async () => {
  api.getInboxMessages.mockResolvedValue({ items: [record()], total: 21 });
  await start();
  await open();
  const checkbox = document.querySelector<HTMLInputElement>(
    '.inbox input[type="checkbox"]',
  );
  expect(checkbox).not.toBeNull();
  checkbox!.click();
  await flushPromises();
  expect(api.getInboxMessages).toHaveBeenLastCalledWith({
    page: 1,
    size: 10,
    unread: true,
  });
  const page2 = document.querySelector<HTMLElement>(
    '.inbox .ant-pagination-item-2',
  );
  expect(page2).not.toBeNull();
  page2!.click();
  await flushPromises();
  expect(api.getInboxMessages).toHaveBeenLastCalledWith({
    page: 2,
    size: 10,
    unread: true,
  });
});
it('aPI方法不接受用户ID，操作主体由服务端JWT确定', async () => {
  const actual = await vi.importActual<
    typeof import('#/api/core/workorder/inbox')
  >('#/api/core/workorder/inbox');
  http.get.mockResolvedValue({});
  http.post.mockResolvedValue({});
  http.delete.mockResolvedValue({});
  await actual.getInboxPermissions();
  await actual.getInboxUnreadCount();
  await actual.getInboxMessages({ page: 2, size: 10, unread: true });
  await actual.markInboxRead(11);
  await actual.markAllInboxRead();
  await actual.deleteInboxMessage(11);
  expect(http.get.mock.calls).toEqual([
    ['/user/permissions'],
    ['/workorder/notification/inbox/unread'],
    [
      '/workorder/notification/inbox',
      { params: { page: 2, size: 10, unread: true } },
    ],
  ]);
  expect(http.post.mock.calls).toEqual([
    ['/workorder/notification/inbox/11/read'],
    ['/workorder/notification/inbox/read-all'],
  ]);
  expect(http.delete.mock.calls).toEqual([
    ['/workorder/notification/inbox/11'],
  ]);
});
