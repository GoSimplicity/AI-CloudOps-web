import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeploymentPage } from '../deployment/Deployment';
import { usePodPage } from '../pod/Pod';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  Modal: { confirm: vi.fn() },
}));
vi.mock('xterm', () => ({ Terminal: class {} }));
vi.mock('xterm-addon-fit', () => ({ FitAddon: class {} }));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: class {} }));

const cases = [
  {
    name: 'Deployment',
    create: () => {
      const state = useDeploymentPage();
      return {
        state,
        items: state.deployments,
        fetch: state.fetchDeployments,
        clear: state.clearDeployments,
      };
    },
  },
  {
    name: 'Pod',
    create: () => {
      const state = usePodPage();
      return {
        state,
        items: state.pods,
        fetch: state.fetchPods,
        clear: state.clearPods,
      };
    },
  },
];
type Result = {
  items: { name: string; namespace: string; cluster_id: number }[];
  total: number;
};
beforeEach(() => vi.clearAllMocks());

for (const testCase of cases) {
  describe(`${testCase.name} 查询作用域`, () => {
    it('不同命名空间的迟到响应不能覆盖当前资源', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      page.state.filterNamespace.value = 'alpha';
      const old = Promise.withResolvers<Result>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.filterNamespace.value = 'beta';
      client.get.mockResolvedValueOnce({
        items: [{ name: 'current', namespace: 'beta', cluster_id: 1 }],
        total: 1,
      });
      await page.fetch();
      old.resolve({
        items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
      });
      await pending;
      expect(page.items.value.map((item) => item.name)).toEqual(['current']);
      expect(page.state.loading.value).toBe(false);
    });

    it('清空集群后待返回请求不能恢复旧行和分页', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      const old = Promise.withResolvers<Result>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.selectedRowKeys.value = ['old'];
      page.state.filterClusterId.value = undefined;
      page.clear();
      old.resolve({
        items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
      });
      await pending;
      expect(page.items.value).toEqual([]);
      expect(page.state.total.value).toBe(0);
      expect(page.state.selectedRowKeys.value).toEqual([]);
      expect(page.state.loading.value).toBe(false);
    });

    it('失败显示错误、清旧记录并支持重试恢复', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      client.get.mockResolvedValueOnce({
        items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
        total: 1,
      });
      await page.fetch();
      client.get.mockRejectedValueOnce(new Error('unavailable'));
      await page.fetch();
      expect(page.state.loadError.value).not.toBe('');
      expect(page.items.value).toEqual([]);
      expect(page.state.total.value).toBe(0);
      client.get.mockResolvedValueOnce({ items: [], total: 0 });
      await page.fetch();
      expect(page.state.loadError.value).toBe('');
    });
  });
}
