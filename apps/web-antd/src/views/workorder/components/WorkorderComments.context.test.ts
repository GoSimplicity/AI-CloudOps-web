import type { WorkorderInstanceCommentItem } from '#/api/core/workorder/workorder_instance_comment';

import { defineComponent, KeepAlive, reactive, ref } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import WorkorderComments from './WorkorderComments.vue';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const owner = reactive({ generation: 0, token: 'local-fixture', uid: '1' });
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    get accessToken() {
      return owner.token;
    },
  }),
  useUserStore: () => ({
    get userInfo() {
      return { userId: owner.uid };
    },
  }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => owner.generation }),
}));
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Comment context fixture unavailable');
  return value;
}
function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    promise,
    reject: (reason: unknown) => required(reject)(reason),
    resolve: (value: T) => required(resolve)(value),
  };
}
function comment(id: number, instanceId: number): WorkorderInstanceCommentItem {
  return {
    content: `实例${instanceId}评论${id}`,
    created_at: '',
    id,
    instance_id: instanceId,
    is_system: 0,
    operator_id: 1,
    operator_name: '作者',
    status: 1,
    type: 'normal',
    updated_at: '',
  };
}
let wrapper: undefined | VueWrapper<InstanceType<typeof WorkorderComments>>;
beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  owner.uid = '1';
  owner.generation = 0;
  owner.token = 'local-fixture';
  client.get.mockResolvedValue([]);
  client.post.mockResolvedValue({});
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.stubGlobal('matchMedia', () => ({
    addListener() {},
    matches: false,
    removeListener() {},
  }));
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
  wrapper = mount(WorkorderComments, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function click(root: ParentNode, text: string) {
  required(
    [...root.querySelectorAll('button')].find((button) => {
      const label = button.textContent?.replaceAll(/\s/gu, '') ?? '';
      return label === text || label === `↩️${text}` || label === `📤${text}`;
    }),
  ).click();
}
async function closeView() {
  required(
    document.querySelector<HTMLButtonElement>(
      '.comments-dialog .ant-modal-close',
    ),
  ).click();
  await flushPromises();
}
function content() {
  return required(document.querySelector('.comments-content'));
}
async function open(id: number) {
  await required(wrapper).vm.showCommentsView(id);
  await flushPromises();
}

it('a关闭→B打开后迟到A读取成功不能覆盖合法B评论', async () => {
  const a = deferred<WorkorderInstanceCommentItem[]>();
  client.get.mockImplementation((url: string) =>
    url.endsWith('/42') ? a.promise : Promise.resolve([comment(430, 43)]),
  );
  const old = required(wrapper).vm.showCommentsView(42);
  await flushPromises();
  await closeView();
  await open(43);
  expect(content().textContent).toContain('实例43评论430');
  a.resolve([comment(420, 42)]);
  await old;
  await flushPromises();
  expect(content().textContent).toContain('实例43评论430');
  expect(content().textContent).not.toContain('实例42评论420');
});

async function fill(selector: string, value: string) {
  const input = required(document.querySelector<HTMLTextAreaElement>(selector));
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}
async function sendQuick(value: string) {
  await fill('.quick-textarea textarea, textarea.quick-textarea', value);
  click(content(), '发送');
  await flushPromises();
}
async function openForm(id: number) {
  required(wrapper).vm.showCommentDialog(id);
  await flushPromises();
}
async function sendForm(value: string) {
  await fill('.comment-modal textarea', value);
  click(required(document.querySelector('.comment-modal')), '发布评论');
  await flushPromises();
}
async function closeForm() {
  click(required(document.querySelector('.comment-modal')), '取消');
  await flushPromises();
}
function quickValue() {
  return required(
    document.querySelector<HTMLTextAreaElement>(
      '.quick-textarea textarea, textarea.quick-textarea',
    ),
  ).value;
}
function loading(selector: string) {
  return required(document.querySelector(selector)).classList.contains(
    'ant-btn-loading',
  );
}
async function sendReply(id: number, value: string) {
  const row = required(content().querySelector(`[data-comment-id="${id}"]`));
  click(row, '回复');
  await flushPromises();
  await fill(`[data-comment-id="${id}"] textarea`, value);
  click(required(row.querySelector('.reply-actions')), '回复');
  await flushPromises();
}

it('旧读取失败/finally不报错、不结束仍在加载的新实例', async () => {
  const a = deferred<WorkorderInstanceCommentItem[]>();
  const b = deferred<WorkorderInstanceCommentItem[]>();
  client.get.mockImplementation((url: string) =>
    url.endsWith('/42') ? a.promise : b.promise,
  );
  const old = required(wrapper).vm.showCommentsView(42);
  await flushPromises();
  await closeView();
  const current = required(wrapper).vm.showCommentsView(43);
  await flushPromises();
  a.reject(new Error('旧实例失败'));
  await old;
  await flushPromises();
  expect(message.error).not.toHaveBeenCalled();
  expect(content().querySelector('.ant-spin-spinning')).not.toBeNull();
  b.resolve([comment(430, 43)]);
  await current;
  await flushPromises();
  expect(content().textContent).toContain('实例43评论430');
  await vi.waitFor(() =>
    expect(content().querySelector('.ant-spin-spinning')).toBeNull(),
  );
});

it('相同实例关闭重开仍有不同代际', async () => {
  const oldRead = deferred<WorkorderInstanceCommentItem[]>();
  client.get
    .mockReturnValueOnce(oldRead.promise)
    .mockResolvedValue([comment(421, 42)]);
  const old = required(wrapper).vm.showCommentsView(42);
  await flushPromises();
  await closeView();
  await open(42);
  oldRead.resolve([comment(420, 42)]);
  await old;
  await flushPromises();
  expect(content().textContent).toContain('实例42评论421');
  expect(content().textContent).not.toContain('实例42评论420');
});

it('同窗快速评论和回复引起的并行刷新只有最新请求可写入', async () => {
  client.get.mockResolvedValueOnce([comment(420, 42)]);
  await open(42);
  const old = deferred<WorkorderInstanceCommentItem[]>();
  const current = deferred<WorkorderInstanceCommentItem[]>();
  client.get
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise);
  await sendQuick('第一条评论');
  await sendReply(420, '第二条回复');
  expect(client.get).toHaveBeenCalledTimes(3);
  current.resolve([comment(422, 42)]);
  await flushPromises();
  old.resolve([comment(421, 42)]);
  await flushPromises();
  expect(content().textContent).toContain('实例42评论422');
  expect(content().textContent).not.toContain('实例42评论421');
});

it.each(['success', 'failure'])(
  '旧快速评论%s不清新草稿、不串刷新或toast/finally',
  async (outcome) => {
    const old = deferred<object>();
    const current = deferred<object>();
    client.post
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    await open(42);
    await sendQuick('旧实例草稿');
    await closeView();
    await open(43);
    await sendQuick('新实例草稿');
    if (outcome === 'success') old.resolve({});
    else old.reject(new Error('旧快速评论失败'));
    await flushPromises();
    expect(quickValue()).toBe('新实例草稿');
    expect(loading('.quick-comment-actions button')).toBe(true);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(required(wrapper).emitted('commentAdded')).toBeUndefined();
    current.resolve({});
    await flushPromises();
    expect(quickValue()).toBe('');
    expect(loading('.quick-comment-actions button')).toBe(false);
    expect(client.post.mock.calls.map((args) => args[1])).toEqual([
      { content: '旧实例草稿', instance_id: 42, is_system: 0 },
      { content: '新实例草稿', instance_id: 43, is_system: 0 },
    ]);
    expect(required(wrapper).emitted('commentAdded')).toHaveLength(1);
  },
);

it.each(['success', 'failure'])(
  '旧添加评论%s不关闭新表单/清busy或发布事件',
  async (outcome) => {
    const old = deferred<object>();
    const current = deferred<object>();
    client.post
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    await openForm(42);
    await sendForm('旧添加');
    await closeForm();
    await openForm(43);
    await sendForm('新添加');
    if (outcome === 'success') old.resolve({});
    else old.reject(new Error('旧添加失败'));
    await flushPromises();
    expect(
      required(
        document.querySelector<HTMLTextAreaElement>('.comment-modal textarea'),
      ).value,
    ).toBe('新添加');
    expect(loading('.comment-modal .ant-modal-footer .ant-btn-primary')).toBe(
      true,
    );
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(required(wrapper).emitted('commentAdded')).toBeUndefined();
    current.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledWith('评论添加成功');
    expect(required(wrapper).emitted('commentAdded')).toHaveLength(1);
    expect(client.post.mock.calls.map((args) => args[1])).toEqual([
      { content: '旧添加', instance_id: 42, is_system: 0 },
      { content: '新添加', instance_id: 43, is_system: 0 },
    ]);
  },
);

it.each(['success', 'failure'])(
  '旧回复%s不清同实例重开后的新回复草稿/busy',
  async (outcome) => {
    const old = deferred<object>();
    const current = deferred<object>();
    client.get.mockResolvedValue([comment(420, 42)]);
    client.post
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    await open(42);
    await sendReply(420, '旧回复');
    await closeView();
    await open(42);
    await sendReply(420, '新回复');
    if (outcome === 'success') old.resolve({});
    else old.reject(new Error('旧回复失败'));
    await flushPromises();
    expect(
      required(
        document.querySelector<HTMLTextAreaElement>(
          '[data-comment-id="420"] textarea',
        ),
      ).value,
    ).toBe('新回复');
    expect(
      loading('[data-comment-id="420"] .reply-actions .ant-btn-primary'),
    ).toBe(true);
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(2);
    current.resolve({});
    await flushPromises();
    expect(message.success).toHaveBeenCalledWith('回复成功');
    expect(required(wrapper).emitted('commentAdded')).toHaveLength(1);
  },
);

it('回复取消后重开同节点，旧操作不认领新编辑器', async () => {
  const old = deferred<object>();
  client.post.mockReturnValueOnce(old.promise);
  client.get.mockResolvedValue([comment(420, 42)]);
  await open(42);
  await sendReply(420, '旧回复');
  const row = required(content().querySelector('[data-comment-id="420"]'));
  click(required(row.querySelector('.reply-actions')), '取消');
  await flushPromises();
  click(row, '回复');
  await flushPromises();
  await fill('[data-comment-id="420"] textarea', '新编辑器');
  old.resolve({});
  await flushPromises();
  expect(required(row.querySelector('textarea')).value).toBe('新编辑器');
  expect(message.success).not.toHaveBeenCalled();
  expect(client.get).toHaveBeenCalledTimes(1);
});

it.each(['quick', 'form', 'reply'])(
  '同窗%s新输入不会被旧提交回执清空，自己的busy正常结束',
  async (kind) => {
    const pending = deferred<object>();
    client.post.mockReturnValueOnce(pending.promise);
    client.get.mockResolvedValue([comment(420, 42)]);
    let selector: string;
    if (kind === 'form') {
      await openForm(42);
      await sendForm('已发送');
      selector = '.comment-modal textarea';
    } else if (kind === 'reply') {
      await open(42);
      await sendReply(420, '已发送');
      selector = '[data-comment-id="420"] textarea';
    } else {
      await open(42);
      await sendQuick('已发送');
      selector = '.quick-textarea textarea, textarea.quick-textarea';
    }
    await fill(selector, '继续写的新草稿');
    pending.resolve({});
    await flushPromises();
    expect(
      required(document.querySelector<HTMLTextAreaElement>(selector)).value,
    ).toBe('继续写的新草稿');
    expect(message.success).not.toHaveBeenCalled();
    expect(required(wrapper).emitted('commentAdded')).toBeUndefined();
    expect(document.querySelector('.ant-btn-loading')).toBeNull();
  },
);

it.each(['uid', 'same-uid-generation', 'logout'])(
  '%s变化同步清两窗草稿，无自动请求，迟到结果忽略',
  async (change) => {
    const old = deferred<WorkorderInstanceCommentItem[]>();
    client.get.mockReturnValueOnce(old.promise);
    const pending = required(wrapper).vm.showCommentsView(42);
    await flushPromises();
    await fill(
      '.quick-textarea textarea, textarea.quick-textarea',
      '旧主体草稿',
    );
    await openForm(42);
    await fill('.comment-modal textarea', '旧主体表单');
    if (change === 'uid') owner.uid = '2';
    else if (change === 'same-uid-generation') owner.generation++;
    else owner.token = '';
    await flushPromises();
    old.resolve([comment(420, 42)]);
    await pending;
    await flushPromises();
    expect(document.body.textContent).not.toContain('实例42评论420');
    expect(document.body.textContent).not.toContain('旧主体草稿');
    expect(
      [...document.querySelectorAll('textarea')].map((node) => node.value),
    ).not.toContain('旧主体表单');
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.post).not.toHaveBeenCalled();
  },
);

it('普通token轮换不废弃当前主体草稿', async () => {
  client.get.mockResolvedValue([comment(420, 42)]);
  await open(42);
  await fill('.quick-textarea textarea, textarea.quick-textarea', '继续编辑');
  owner.token = 'rotated-local-fixture';
  await flushPromises();
  expect(quickValue()).toBe('继续编辑');
  expect(content().textContent).toContain('实例42评论420');
});

it('未知主体/未认证/非法instance均不外发', async () => {
  for (const id of [0, -1, 1.5, Number.NaN, Infinity]) {
    await open(id);
    await openForm(id);
  }
  owner.uid = '';
  await open(42);
  await openForm(42);
  owner.uid = '1';
  owner.token = '';
  await open(42);
  await openForm(42);
  expect(client.get).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});

it('卸载使旧提交失效，不发toast或事件/刷新', async () => {
  const pending = deferred<object>();
  client.post.mockReturnValueOnce(pending.promise);
  await open(42);
  await sendQuick('将卸载');
  const current = required(wrapper);
  current.unmount();
  wrapper = undefined;
  pending.resolve({});
  await flushPromises();
  expect(message.success).not.toHaveBeenCalled();
  expect(client.get).toHaveBeenCalledTimes(1);
  expect(current.emitted('commentAdded')).toBeUndefined();
});

it('快速评论重复CtrlEnter不重复提交，正常返回保留原body并成功刷新', async () => {
  const pending = deferred<object>();
  client.post.mockReturnValueOnce(pending.promise);
  await open(42);
  await sendQuick(' 原文保留 ');
  const input = required(
    document.querySelector('.quick-textarea textarea, textarea.quick-textarea'),
  );
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      key: 'Enter',
    }),
  );
  await flushPromises();
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.post).toHaveBeenCalledWith(
    '/workorder/instance/comment/create',
    { content: ' 原文保留 ', instance_id: 42, is_system: 0 },
  );
  pending.resolve({});
  await flushPromises();
  expect(quickValue()).toBe('');
  expect(client.get).toHaveBeenLastCalledWith(
    '/workorder/instance/comment/tree/42',
  );
  expect(required(wrapper).emitted('commentAdded')).toHaveLength(1);
});

it('keepAlive停用后旧提交不发toast/事件，重新激活保持清窗', async () => {
  const pending = deferred<object>();
  client.post.mockReturnValueOnce(pending.promise);
  const Host = defineComponent({
    components: { KeepAlive, WorkorderComments },
    setup: () => ({ shown: ref(true) }),
    template: '<KeepAlive><WorkorderComments v-if="shown" /></KeepAlive>',
  });
  const host = mount(Host, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  try {
    const child = host.findComponent(WorkorderComments);
    await child.vm.showCommentsView(42);
    await flushPromises();
    await sendQuick('将停用');
    host.vm.shown = false;
    await flushPromises();
    pending.resolve({});
    await flushPromises();
    host.vm.shown = true;
    await flushPromises();
    expect(message.success).not.toHaveBeenCalled();
    expect(child.emitted('commentAdded')).toBeUndefined();
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('将停用');
  } finally {
    host.unmount();
  }
});

it('引用nextTick迟到不聚焦/提示新实例窗口', async () => {
  client.get
    .mockResolvedValueOnce([comment(420, 42)])
    .mockResolvedValueOnce([comment(430, 43)]);
  await open(42);
  required(content().querySelector<HTMLButtonElement>('.more-actions')).click();
  await flushPromises();
  const quote = required(
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
      (item) => item.textContent?.includes('引用'),
    ),
  );
  quote.click();
  const current = required(wrapper).vm.showCommentsView(43);
  await current;
  await flushPromises();
  expect(message.success).not.toHaveBeenCalled();
  expect(quickValue()).toBe('');
  expect(content().textContent).toContain('实例43评论430');
});

it('既有自定义header/刷新/排序可见，两次手动刷新只采纳最新读取', async () => {
  await open(42);
  const header = required(document.querySelector('.comments-dialog-header'));
  expect(header.textContent).toContain('工单评论');
  expect(header.querySelectorAll('button')).toHaveLength(2);
  const old = deferred<WorkorderInstanceCommentItem[]>();
  const current = deferred<WorkorderInstanceCommentItem[]>();
  client.get
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise);
  click(header, '🔄');
  click(header, '🔄');
  await flushPromises();
  expect(client.get).toHaveBeenCalledTimes(3);
  current.resolve([comment(422, 42)]);
  await flushPromises();
  old.resolve([comment(421, 42)]);
  await flushPromises();
  expect(content().textContent).toContain('实例42评论422');
  expect(content().textContent).not.toContain('实例42评论421');
});
