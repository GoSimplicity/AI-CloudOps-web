import { describe, expect, it } from 'vitest';

import { clusterResourceKey, namespacedResourceKey } from './utils';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

describe('kubernetes 表格资源身份', () => {
  it('集群级同名资源仍使用不同选择键', () => {
    expect(clusterResourceKey({ cluster_id: 1, name: 'node' })).not.toBe(
      clusterResourceKey({ cluster_id: 2, name: 'node' }),
    );
  });
  it('跨命名空间及集群的同名资源不会共享选择键', () => {
    const records = [
      { cluster_id: 1, name: 'web', namespace: 'alpha' },
      { cluster_id: 1, name: 'web', namespace: 'beta' },
      { cluster_id: 2, name: 'web', namespace: 'alpha' },
    ];
    expect(
      new Set(records.map((record) => namespacedResourceKey(record))).size,
    ).toBe(3);
    expect(namespacedResourceKey({ ...required(records[0]) })).toBe(
      namespacedResourceKey(required(records[0])),
    );
  });
});
