interface NodeShape {
  id: number;
  name: string;
  children?: NodeShape[];
}

// 搜索后代时保留祖先路径，匹配父节点时保留其完整分支
export function filterNodeTree<T extends NodeShape>(nodes: T[], search: string): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap(node => {
    if (node.name.toLowerCase().includes(needle)) return [node];
    const children = filterNodeTree(node.children ?? [], needle);
    return children.length ? [{ ...node, children }] : [];
  });
}

// 树响应的统计覆盖所有可见层级，同一节点不会重复计数
export function flattenNodeTree<T extends NodeShape>(nodes: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<number>();
  const pending: NodeShape[] = [...nodes];
  while (pending.length) {
    const node = pending.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node as T);
    pending.push(...(node.children ?? []));
  }
  return result;
}
