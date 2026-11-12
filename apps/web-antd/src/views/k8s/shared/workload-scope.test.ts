import { RequestOwnerChangedError } from '@vben/request';

import { message } from 'ant-design-vue';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeferred } from '../../../../../../internal/test-utils/deferred';
import { useConfigMapPage } from '../configmap/ConfigMap';
import { useDeploymentPage } from '../deployment/Deployment';
import { usePodPage } from '../pod/Pod';
import { useServicePage } from '../service/Service';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
}));
vi.mock('xterm', () => ({ Terminal: class {} }));
vi.mock('xterm-addon-fit', () => ({ FitAddon: class {} }));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: class {} }));

const cases = [
  {
    create: () => {
      const state = useServicePage();
      return {
        clear: state.clearServices,
        fetch: state.fetchServices,
        state,
        items: state.services,
      };
    },
    name: 'Service',
  },
  {
    create: () => {
      const state = useConfigMapPage();
      return {
        clear: state.clearConfigMaps,
        fetch: state.fetchConfigMaps,
        state,
        items: state.configMaps,
      };
    },
    name: 'ConfigMap',
  },
  {
    create: () => {
      const state = useDeploymentPage();
      return {
        clear: state.clearDeployments,
        fetch: state.fetchDeployments,
        state,
        items: state.deployments,
      };
    },
    name: 'Deployment',
  },
  {
    create: () => {
      const state = usePodPage();
      return {
        clear: state.clearPods,
        fetch: state.fetchPods,
        state,
        items: state.pods,
      };
    },
    name: 'Pod',
  },
];
type Result = {
  items: { cluster_id: number; name: string; namespace: string }[];
  total: number;
};
beforeEach(() => vi.clearAllMocks());

for (const testCase of cases) {
  describe(`${testCase.name} 查询作用域`, () => {
    it('不同命名空间的迟到响应不能覆盖当前资源', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      page.state.filterNamespace.value = 'alpha';
      const old = createDeferred<Result>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.filterNamespace.value = 'beta';
      client.get.mockResolvedValueOnce({
        total: 1,
        items: [{ cluster_id: 1, name: 'current', namespace: 'beta' }],
      });
      await page.fetch();
      old.resolve({
        total: 1,
        items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
      });
      await pending;
      expect(page.items.value.map((item) => item.name)).toEqual(['current']);
      expect(page.state.loading.value).toBe(false);
    });

    it('清空集群后待返回请求不能恢复旧行和分页', async () => {
      const page = testCase.create();
      page.state.filterClusterId.value = 1;
      const old = createDeferred<Result>();
      client.get.mockReturnValueOnce(old.promise);
      const pending = page.fetch();
      page.state.selectedRowKeys.value = ['old'];
      page.state.filterClusterId.value = undefined;
      page.clear();
      old.resolve({
        total: 1,
        items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
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
        total: 1,
        items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
      });
      await page.fetch();
      client.get.mockRejectedValueOnce(new Error('unavailable'));
      await page.fetch();
      expect(page.state.loadError.value).not.toBe('');
      expect(page.items.value).toEqual([]);
      expect(page.state.total.value).toBe(0);
      client.get.mockResolvedValueOnce({ total: 0, items: [] });
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
          total: 1,
          items: [{ cluster_id: 1, name: 'old', namespace: 'alpha' }],
        });
        await page.fetch();
        expect(page.items.value).toHaveLength(1);
        page.state.selectedRowKeys.value = ['old'];

        const pending = createDeferred<Result>();
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
  { create: () => useDeploymentPage(), name: 'Deployment' },
  { create: () => usePodPage(), name: 'Pod' },
];
for (const testCase of selectorCases) {
  describe(`fE-02b 拍板 3：${testCase.name} 集群 / 命名空间下拉被取消不写错误状态`, () => {
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
    client.get.mockResolvedValue({ total: 0, items: [] });
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
    client.get.mockResolvedValue({ total: 0, items: [] });
    await state.fetchConfigMaps();
    expect(client.get).toHaveBeenLastCalledWith('/k8s/configmap/1/list', {
      params: expect.objectContaining({
        data_key: 'INDEX',
        namespace: 'alpha',
        search: 'content',
      }),
    });
  });
});
