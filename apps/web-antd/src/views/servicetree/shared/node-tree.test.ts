import { describe, expect, it } from 'vitest';
import { filterNodeTree, flattenNodeTree } from './node-tree';

const child = { id: 2, name: 'Payments', children: [] };
const root = {
  id: 1,
  name: 'Production',
  children: [child, { id: 3, name: 'Other' }],
};
describe('服务树查询与统计', () => {
  it('子节点命中保留祖先与目标分支，不修改原树', () => {
    const filtered = filterNodeTree([root], 'PAYments');
    expect(filtered[0]?.name).toBe('Production');
    expect(filtered[0]?.children.map((node) => node.name)).toEqual([
      'Payments',
    ]);
    expect(root.children).toHaveLength(2);
    expect(filterNodeTree([root], 'missing')).toEqual([]);
  });
  it('父节点匹配保留完整分支，空搜索不丢数据', () => {
    expect(filterNodeTree([root], 'production')).toEqual([root]);
    expect(filterNodeTree([root], '  ')).toEqual([root]);
  });
  it('统计所有层级并去重重复节点', () => {
    expect(
      flattenNodeTree([root, child])
        .map((node) => node.id)
        .sort(),
    ).toEqual([1, 2, 3]);
  });
});
