import type { WorkorderInstanceCommentItem } from '#/api/core/workorder/workorder_instance_comment';

import { expect, it } from 'vitest';

import { flattenCommentReplies } from './comment-thread';

function node(
  id: number,
  children: WorkorderInstanceCommentItem[] = [],
): WorkorderInstanceCommentItem {
  return {
    content: '',
    created_at: '',
    id,
    instance_id: 1,
    is_system: 0,
    operator_id: 1,
    operator_name: '',
    status: 1,
    type: 'normal',
    updated_at: '',
    children,
  };
}

it('迭代展开12000层合法历史，不截深度或递归溢出', () => {
  const root = node(1);
  let parent = root;
  for (let id = 2; id <= 12_000; id++) {
    const child = node(id);
    parent.children = [child];
    parent = child;
  }
  const rows = flattenCommentReplies(root);
  expect(rows).toHaveLength(11_999);
  expect(rows.at(-1)?.comment.id).toBe(12_000);
  expect(rows.at(-1)?.parent.id).toBe(11_999);
});

it('共享对象与环路不无限遍历，重复ID不隐藏独有后代', () => {
  const second = node(2);
  const third = node(3);
  const root = node(1, [second, node(2, [third]), node(4), second]);
  second.children = [root];
  const rows = flattenCommentReplies(root);
  expect(rows.map((row) => row.comment.id)).toEqual([2, 3, 4]);
  expect(rows.find((row) => row.comment.id === 3)?.parent.id).toBe(2);
});

it('空线程和缺省children为空，不改变API数据', () => {
  const root = node(1);
  delete root.children;
  expect(flattenCommentReplies(root)).toEqual([]);
  expect(root.children).toBeUndefined();
});
