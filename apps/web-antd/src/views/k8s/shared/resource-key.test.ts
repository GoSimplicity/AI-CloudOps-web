import { describe, expect, it } from 'vitest';
import { clusterResourceKey, namespacedResourceKey } from './utils';

describe('Kubernetes 表格资源身份', () => {
  it('集群级同名资源仍使用不同选择键', () => {
    expect(clusterResourceKey({ cluster_id: 1, name: 'node' })).not.toBe(
      clusterResourceKey({ cluster_id: 2, name: 'node' }),
    );
  });
  it('跨命名空间及集群的同名资源不会共享选择键', () => {
    const records = [
      { cluster_id: 1, namespace: 'alpha', name: 'web' },
      { cluster_id: 1, namespace: 'beta', name: 'web' },
      { cluster_id: 2, namespace: 'alpha', name: 'web' },
    ];
    expect(new Set(records.map(namespacedResourceKey)).size).toBe(3);
    expect(namespacedResourceKey({ ...records[0]! })).toBe(
      namespacedResourceKey(records[0]!),
    );
  });
});
