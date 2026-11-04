import type { WorkorderInstanceCommentItem } from '#/api/core/workorder/workorder_instance_comment';

export interface CommentReplyRow {
  comment: WorkorderInstanceCommentItem;
  parent: WorkorderInstanceCommentItem;
}

/** Keep server sibling order without recursive rendering or a depth limit. */
export function flattenCommentReplies(
  root: WorkorderInstanceCommentItem,
): CommentReplyRow[] {
  const rows: CommentReplyRow[] = [];
  const stack: CommentReplyRow[] = [];
  const visited = new Set<WorkorderInstanceCommentItem>([root]);
  const renderedIds = new Set<number>([root.id]);
  const pushChildren = (parent: WorkorderInstanceCommentItem) => {
    if (!Array.isArray(parent.children)) return;
    for (const child of parent.children.toReversed()) {
      stack.push({ comment: child, parent });
    }
  };
  pushChildren(root);
  while (stack.length > 0) {
    const row = stack.pop();
    if (!row || visited.has(row.comment)) continue;
    visited.add(row.comment);
    if (!renderedIds.has(row.comment.id)) {
      renderedIds.add(row.comment.id);
      rows.push(row);
    }
    // A duplicate ID must not hide otherwise unique descendants.
    pushChildren(row.comment);
  }
  return rows;
}
