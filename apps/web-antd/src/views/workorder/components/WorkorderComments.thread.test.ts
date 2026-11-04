import type { WorkorderInstanceCommentItem } from '#/api/core/workorder/workorder_instance_comment';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message } from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import WorkorderComments from './WorkorderComments.vue';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));

function comment(
  id: number,
  children: WorkorderInstanceCommentItem[] = [],
): WorkorderInstanceCommentItem {
  for (const child of children) child.parent_id = id;
  return {
    content: `第${id}层正文`,
    created_at: '2026-11-05T00:00:00Z',
    id,
    instance_id: 42,
    is_system: 0,
    operator_id: id,
    operator_name: `作者${id}`,
    parent_id: 0,
    status: 1,
    type: 'normal',
    updated_at: '2026-11-05T00:00:00Z',
    children,
  };
}
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Comment fixture is unavailable');
  return value;
}
function clickButton(root: ParentNode, text: string) {
  const button = required(
    [...root.querySelectorAll('button')].find(
      (node) =>
        node.textContent?.replaceAll(/\s/gu, '').replace(/^↩️/u, '') ===
        text.replaceAll(/\s/gu, ''),
    ),
  );
  button.click();
}
let wrapper: undefined | VueWrapper<InstanceType<typeof WorkorderComments>>;
beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
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
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function show(items: WorkorderInstanceCommentItem[]) {
  client.get.mockResolvedValue(items);
  wrapper = mount(WorkorderComments, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await wrapper.vm.showCommentsView(42);
  await flushPromises();
  return required(document.querySelector('.comments-content'));
}

it('三层评论展开后显示孙回复而不遗漏正文', async () => {
  const root = await show([comment(1, [comment(2, [comment(3)])])]);
  clickButton(root, '展开');
  await flushPromises();
  expect(root.textContent).toContain('第3层正文');
  expect(root.querySelectorAll<HTMLElement>('.reply-item')).toHaveLength(2);
});

function fiveLevels() {
  return comment(1, [comment(2, [comment(3, [comment(4, [comment(5)])])])]);
}
async function expand(root: ParentNode) {
  clickButton(root, '展开');
  await flushPromises();
}
function row(root: ParentNode, id: number) {
  return required(root.querySelector<HTMLElement>(`[data-comment-id="${id}"]`));
}
async function reply(root: ParentNode, id: number, content: string) {
  const target = row(root, id);
  clickButton(target, '回复');
  await flushPromises();
  const input = required(target.querySelector('textarea'));
  input.value = content;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
  clickButton(required(target.querySelector('.reply-actions')), '回复');
  await flushPromises();
}

it('五层与各层siblings保持服务端DFS次序，显示全部回复数', async () => {
  const root = await show([
    comment(1, [
      comment(2, [comment(3, [comment(4, [comment(5)])])]),
      comment(6, [comment(7)]),
    ]),
    comment(8, [comment(9)]),
  ]);
  const first = row(root, 1);
  await expand(first);
  expect(
    [...first.querySelectorAll<HTMLElement>('.reply-item')].map(
      (node) => node.dataset.commentId,
    ),
  ).toEqual(['2', '3', '4', '5', '6', '7']);
  expect(first.textContent).toContain('6 条回复');
  expect(row(root, 8).textContent).toContain('1 条回复');
  expect(row(root, 5).textContent).toContain('第5层正文');
  expect(client.get).toHaveBeenCalledWith(
    '/workorder/instance/comment/tree/42',
  );
});

it.each([1, 2, 3, 5])(
  '第%s层回复保留instance_id与被回复节点parent_id',
  async (id) => {
    const root = await show([fiveLevels()]);
    await expand(root);
    await reply(root, id, '  明确回复目标  ');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/instance/comment/create',
      {
        content: '明确回复目标',
        instance_id: 42,
        is_system: 0,
        parent_id: id,
        type: 'normal',
      },
    );
    expect(required(wrapper).emitted('commentAdded')).toHaveLength(1);
  },
);

it('父评论提示可在扁平线程中定位并聚焦原父节点', async () => {
  const root = await show([fiveLevels()]);
  await expand(root);
  const third = row(root, 3);
  expect(third.querySelector('.reply-parent-link')?.textContent).toContain(
    '作者2',
  );
  const link = required(
    third.querySelector<HTMLButtonElement>('[aria-label="定位父评论 #2"]'),
  );
  link.click();
  await flushPromises();
  expect(document.activeElement).toBe(row(root, 2));
  expect(row(root, 2).classList.contains('comment-highlight')).toBe(true);
});

it('展开收起作用于整条线程，不改变后代节点', async () => {
  const root = await show([fiveLevels()]);
  const list = required(root.querySelector<HTMLElement>('.replies-list'));
  expect(list.style.display).toBe('none');
  await expand(root);
  expect(list.style.display).not.toBe('none');
  clickButton(root, '收起');
  await flushPromises();
  expect(list.style.display).toBe('none');
  expect(list.querySelectorAll<HTMLElement>('.reply-item')).toHaveLength(4);
});

it('深层正文与父作者仍按现有纯文本formatter安全显示', async () => {
  const leaf = comment(5);
  leaf.content =
    '<img src=x onerror="commentCanary()"><script>commentCanary()</script> @tester #ops';
  const parent = comment(4, [leaf]);
  parent.operator_name = '<img src=x onerror="commentCanary()">';
  const canary = vi.fn();
  vi.stubGlobal('commentCanary', canary);
  const root = await show([comment(1, [comment(2, [comment(3, [parent])])])]);
  await expand(root);
  const target = row(root, 5);
  expect(target.querySelector('.reply-content')?.textContent).toBe(
    leaf.content,
  );
  expect(target.querySelector('.mention')?.textContent).toBe('@tester');
  expect(target.querySelector('.hashtag')?.textContent).toBe('#ops');
  expect(target.querySelectorAll('img,script,iframe')).toHaveLength(0);
  expect(target.querySelector('.reply-parent-link')?.textContent).toContain(
    parent.operator_name,
  );
  expect(canary).not.toHaveBeenCalled();
});

it('403拒绝深层回复不清输入、不发成功事件', async () => {
  const root = await show([fiveLevels()]);
  await expand(root);
  client.post.mockRejectedValue(
    Object.assign(new Error('权限不足'), { response: { status: 403 } }),
  );
  await reply(root, 5, '保留尚未发送的内容');
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(required(wrapper).emitted('commentAdded')).toBeUndefined();
  expect(message.success).not.toHaveBeenCalled();
  expect(required(row(root, 5).querySelector('textarea')).value).toBe(
    '保留尚未发送的内容',
  );
});

it('深层取消或空白回复不调用创建API', async () => {
  const root = await show([fiveLevels()]);
  await expand(root);
  await reply(root, 5, '   ');
  expect(client.post).not.toHaveBeenCalled();
  clickButton(required(row(root, 5).querySelector('.reply-actions')), '取消');
  await flushPromises();
  expect(row(root, 5).querySelector('textarea')).toBeNull();
});

it('空态保留且不创建评论', async () => {
  const root = await show([]);
  expect(root.textContent).toContain('还没有评论');
  expect(root.querySelectorAll('.comment-item,.reply-item')).toHaveLength(0);
  expect(client.post).not.toHaveBeenCalled();
});
