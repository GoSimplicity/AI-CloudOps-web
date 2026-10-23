import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNamespacePage } from './Namespace';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  Modal: { confirm: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('命名空间查询作用域', () => {
  it('清除集群选择时取消旧数据、分页、选择和待返回查询', async () => {
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    const response = Promise.withResolvers<{
      items: { name: string; cluster_id: number }[];
      total: number;
    }>();
    client.get.mockReturnValueOnce(response.promise);
    const pending = page.fetchNamespaces();
    page.total.value = 10;
    page.selectedRowKeys.value = ['old'];
    page.filterClusterId.value = undefined;
    page.clearNamespaces();
    response.resolve({ items: [{ name: 'stale', cluster_id: 1 }], total: 1 });
    await pending;
    expect(page.namespaces.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.selectedRowKeys.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });

  it('慢的旧集群响应不能覆盖新集群的命名空间', async () => {
    const page = useNamespacePage();
    const old = Promise.withResolvers<{
      items: { name: string; cluster_id: number }[];
      total: number;
    }>();
    page.filterClusterId.value = 1;
    client.get.mockReturnValueOnce(old.promise);
    const pending = page.fetchNamespaces();
    page.filterClusterId.value = 2;
    client.get.mockResolvedValueOnce({
      items: [{ name: 'current', cluster_id: 2 }],
      total: 1,
    });
    await page.fetchNamespaces();
    old.resolve({ items: [{ name: 'old', cluster_id: 1 }], total: 1 });
    await pending;
    expect(page.namespaces.value.map((namespace) => namespace.name)).toEqual([
      'current',
    ]);
  });

  it('查询失败清除旧记录并允许成功重试', async () => {
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    page.namespaces.value = [{ name: 'old', cluster_id: 1 }];
    page.total.value = 1;
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.fetchNamespaces();
    expect(page.loadError.value).toContain('获取命名空间列表失败');
    expect(page.namespaces.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.loading.value).toBe(false);
    client.get.mockResolvedValueOnce({
      items: [{ name: 'current', cluster_id: 1 }],
      total: 1,
    });
    await page.fetchNamespaces();
    expect(page.loadError.value).toBe('');
    expect(page.namespaces.value).toHaveLength(1);
  });
});
