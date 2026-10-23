import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClusterPage } from './Cluster';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('集群列表恢复与编辑保护', () => {
  it('查询失败清除旧列表和选择，成功重试后恢复', async () => {
    const page = useClusterPage();
    page.clusters.value = [
      { id: 1, name: 'example', restrict_namespace: [], status: 1 },
    ];
    page.selectedRowKeys.value = [1];
    page.total.value = 1;
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.fetchClusters();
    expect(page.clusters.value).toEqual([]);
    expect(page.selectedRowKeys.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.loadError.value).not.toBe('');
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    await page.fetchClusters();
    expect(page.loadError.value).toBe('');
  });

  it('详情加载失败不允许提交不完整的集群配置', async () => {
    const page = useClusterPage();
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.openEdit({
      id: 1,
      name: 'example',
      restrict_namespace: [],
      status: 1,
    });
    expect(page.isModalVisible.value).toBe(false);
    expect(page.editDetailLoading.value).toBe(false);
  });
});
