import { RequestOwnerChangedError } from '@vben/request';

import axios from 'axios';
import { message } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeploymentPage } from '../deployment/Deployment';
import { usePodPage } from '../pod/Pod';
import { useServicePage } from '../service/Service';
import { useConfigMapPage } from '../configmap/ConfigMap';

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
    name: 'Service',
    create: () => {
      const state = useServicePage();
      return {
        state,
        items: state.services,
        fetch: state.fetchServices,
        clear: state.clearServices,
      };
    },
  },
  {
    name: 'ConfigMap',
    create: () => {
      const state = useConfigMapPage();
      return {
        state,
        items: state.configMaps,
        fetch: state.fetchConfigMaps,
        clear: state.clearConfigMaps,
      };
    },
  },
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

    it.each([
      [
        'CanceledError',
        () => new axios.CanceledError(undefined, {} as any, {}),
      ],
      ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
    ])(
      'fE-02b 拍板 3：列表请求被取消（%s）不写 loadError、不提示；真实失败照常写',
      async (_label, make) => {
        const page = testCase.create();
        page.state.filterClusterId.value = 1;
        client.get.mockRejectedValueOnce(make());
        await page.fetch();
        expect(page.state.loadError.value).toBe('');
        expect(message.error).not.toHaveBeenCalled();

        client.get.mockRejectedValueOnce(new Error('unavailable'));
        await page.fetch();
        expect(page.state.loadError.value).not.toBe('');
      },
    );

    it.each([
      [
        'CanceledError',
        () => new axios.CanceledError(undefined, {} as any, {}),
      ],
      ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
      ['AbortError', () => new DOMException('aborted', 'AbortError')],
    ])(
      'incr3 P3-8：已有数据后列表请求被取消（%s）：清空旧列表与分页、loading 复位、不写错误、不提示',
      async (_label, make) => {
        const page = testCase.create();
        page.state.filterClusterId.value = 1;
        client.get.mockResolvedValueOnce({
          items: [{ name: 'old', namespace: 'alpha', cluster_id: 1 }],
          total: 1,
        });
        await page.fetch();
        expect(page.items.value).toHaveLength(1);
        page.state.selectedRowKeys.value = ['old'];

        const pending = Promise.withResolvers<Result>();
        client.get.mockReturnValueOnce(pending.promise);
        const request = page.fetch();
        expect(page.state.loading.value).toBe(true);
        pending.reject(make());
        await request;
        expect(page.items.value).toEqual([]);
        expect(page.state.total.value).toBe(0);
        expect(page.state.selectedRowKeys.value).toEqual([]);
        expect(page.state.loading.value).toBe(false);
        expect(page.state.loadError.value).toBe('');
        expect(message.error).not.toHaveBeenCalled();
      },
    );
  });
}

const selectorCases = [
  { name: 'Deployment', create: () => useDeploymentPage() },
  { name: 'Pod', create: () => usePodPage() },
];
for (const testCase of selectorCases) {
  describe(`FE-02b 拍板 3：${testCase.name} 集群 / 命名空间下拉被取消不写错误状态`, () => {
    it.each([
      [
        'CanceledError',
        () => new axios.CanceledError(undefined, {} as any, {}),
      ],
      ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
    ])(
      '集群列表取消（%s）：clustersError 保持初始值；真实失败照常写',
      async (_label, make) => {
        const page = testCase.create();
        client.get.mockRejectedValueOnce(make());
        await page.fetchClusters();
        expect(page.clustersError.value).toBe('');
        expect(page.clustersLoading.value).toBe(false);
        expect(message.error).not.toHaveBeenCalled();

        client.get.mockRejectedValueOnce(new Error('unavailable'));
        await page.fetchClusters();
        expect(page.clustersError.value).toBe('获取集群列表失败，请重试');
      },
    );

    it.each([
      [
        'CanceledError',
        () => new axios.CanceledError(undefined, {} as any, {}),
      ],
      ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
    ])(
      '命名空间列表取消（%s）：namespacesError 保持初始值；真实失败照常写',
      async (_label, make) => {
        const page = testCase.create();
        page.filterClusterId.value = 1;
        client.get.mockRejectedValueOnce(make());
        await page.fetchNamespaces();
        expect(page.namespacesError.value).toBe('');
        expect(page.namespacesLoading.value).toBe(false);
        expect(message.error).not.toHaveBeenCalled();

        client.get.mockRejectedValueOnce(new Error('unavailable'));
        await page.fetchNamespaces();
        expect(page.namespacesError.value).toBe('获取命名空间列表失败，请重试');
      },
    );
  });
}

describe('资源过滤请求契约', () => {
  it('service 状态、名称和命名空间发送到后端分页前过滤', async () => {
    const state = useServicePage();
    state.filterClusterId.value = 1;
    state.filterNamespace.value = 'alpha';
    state.searchText.value = 'web';
    state.filterStatus.value = 2;
    client.get.mockResolvedValue({ items: [], total: 0 });
    await state.fetchServices();
    expect(client.get).toHaveBeenLastCalledWith('/k8s/service/1/list', {
      params: expect.objectContaining({
        namespace: 'alpha',
        search: 'web',
        status: 2,
      }),
    });
  });
  it('configMap 名称、命名空间与数据键真实传给 API', async () => {
    const state = useConfigMapPage();
    state.filterClusterId.value = 1;
    state.filterNamespace.value = 'alpha';
    state.searchText.value = 'content';
    state.filterDataKey.value = 'INDEX';
    client.get.mockResolvedValue({ items: [], total: 0 });
    await state.fetchConfigMaps();
    expect(client.get).toHaveBeenLastCalledWith('/k8s/configmap/1/list', {
      params: expect.objectContaining({
        namespace: 'alpha',
        search: 'content',
        data_key: 'INDEX',
      }),
    });
  });
});
