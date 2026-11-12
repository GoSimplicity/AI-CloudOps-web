import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
} from '#/utils/permission/forbidden';
import { markRequestLayerTrace } from '#/utils/permission/request-notice';

import { createDeferred } from '../../../../../../internal/test-utils/deferred';
import { useNamespacePage } from './Namespace';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('ant-design-vue', () => ({
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  Modal: { confirm: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('命名空间查询作用域', () => {
  it('清除集群选择时取消旧数据、分页、选择和待返回查询', async () => {
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    const response = createDeferred<{
      items: { cluster_id: number; name: string }[];
      total: number;
    }>();
    client.get.mockReturnValueOnce(response.promise);
    const pending = page.fetchNamespaces();
    page.total.value = 10;
    page.selectedRowKeys.value = ['old'];
    page.filterClusterId.value = undefined;
    page.clearNamespaces();
    response.resolve({ total: 1, items: [{ cluster_id: 1, name: 'stale' }] });
    await pending;
    expect(page.namespaces.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.selectedRowKeys.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });

  it('慢的旧集群响应不能覆盖新集群的命名空间', async () => {
    const page = useNamespacePage();
    const old = createDeferred<{
      items: { cluster_id: number; name: string }[];
      total: number;
    }>();
    page.filterClusterId.value = 1;
    client.get.mockReturnValueOnce(old.promise);
    const pending = page.fetchNamespaces();
    page.filterClusterId.value = 2;
    client.get.mockResolvedValueOnce({
      total: 1,
      items: [{ cluster_id: 2, name: 'current' }],
    });
    await page.fetchNamespaces();
    old.resolve({ total: 1, items: [{ cluster_id: 1, name: 'old' }] });
    await pending;
    expect(page.namespaces.value.map((namespace) => namespace.name)).toEqual([
      'current',
    ]);
  });

  it('查询失败清除旧记录并允许成功重试', async () => {
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    page.namespaces.value = [{ cluster_id: 1, name: 'old' }];
    page.total.value = 1;
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.fetchNamespaces();
    expect(page.loadError.value).toContain('获取命名空间列表失败');
    expect(page.namespaces.value).toEqual([]);
    expect(page.total.value).toBe(0);
    expect(page.loading.value).toBe(false);
    client.get.mockResolvedValueOnce({
      total: 1,
      items: [{ cluster_id: 1, name: 'current' }],
    });
    await page.fetchNamespaces();
    expect(page.loadError.value).toBe('');
    expect(page.namespaces.value).toHaveLength(1);
  });

  it('列表 403 已由统一提示，页面只保留错误状态不重复弹错', async () => {
    const { message } = await import('ant-design-vue');
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    client.get.mockRejectedValueOnce(await notifiedForbiddenError());
    await page.fetchNamespaces();
    expect(page.loadError.value).toContain('获取命名空间列表失败');
    expect(message.error).not.toHaveBeenCalled();
    client.get.mockRejectedValueOnce(new Error('unavailable'));
    await page.fetchNamespaces();
    expect(message.error).toHaveBeenCalledWith('获取命名空间列表失败，请重试');
  });

  it('fE-02b：HTTP 错误、网络错误已由请求层提示，页面只保留错误状态；取消类静默且不写错误状态', async () => {
    const axiosModule = await import('axios');
    const axios = axiosModule.default;
    const { AxiosError } = await import('axios');
    const { message } = await import('ant-design-vue');
    const page = useNamespacePage();
    page.filterClusterId.value = 1;
    // RequestClient 把 HTTP 错误包成带 response 的普通对象再抛给页面；
    // incr3 P3-3：带请求层痕迹（经过 requestClient 拦截器）才算请求层已提示
    client.get.mockRejectedValueOnce(
      markRequestLayerTrace({ response: { status: 500 } }),
    );
    await page.fetchNamespaces();
    client.get.mockRejectedValueOnce(
      markRequestLayerTrace(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      ),
    );
    await page.fetchNamespaces();
    expect(page.loadError.value).toContain('获取命名空间列表失败');
    // 拍板 3：取消不写 loadError（重新请求时已清空，保持空）
    client.get.mockRejectedValueOnce(
      new axios.CanceledError(undefined, {} as any, {}),
    );
    await page.fetchNamespaces();
    expect(page.loadError.value).toBe('');
    expect(message.error).not.toHaveBeenCalled();
  });
});

describe('命名空间标签与注解请求体', () => {
  const namespace = { cluster_id: 7, name: 'demo' };

  it('编辑删光标签和注解时请求体发送空数组', async () => {
    const page = useNamespacePage();
    page.labelFormRef.value = {} as NonNullable<
      (typeof page.labelFormRef)['value']
    >;
    page.currentOperationNamespace.value = namespace;
    page.labelFormModel.value = { annotations: {}, labels: {} };
    client.put.mockResolvedValueOnce({});
    await page.submitLabelForm();
    expect(client.put).toHaveBeenCalledWith(
      '/k8s/clusters/7/namespace/demo/update',
      {
        annotations: [],
        cluster_id: 7,
        labels: [],
        name: 'demo',
      },
    );
  });

  it('编辑标签和注解有值时请求体发送 KeyValueList', async () => {
    const page = useNamespacePage();
    page.labelFormRef.value = {} as NonNullable<
      (typeof page.labelFormRef)['value']
    >;
    page.currentOperationNamespace.value = namespace;
    page.labelFormModel.value = {
      annotations: { note: 'keep' },
      labels: { app: 'web' },
    };
    client.put.mockResolvedValueOnce({});
    await page.submitLabelForm();
    expect(client.put).toHaveBeenCalledWith(
      '/k8s/clusters/7/namespace/demo/update',
      {
        annotations: [{ key: 'note', value: 'keep' }],
        cluster_id: 7,
        labels: [{ key: 'app', value: 'web' }],
        name: 'demo',
      },
    );
  });

  it('创建未填写标签和注解时不传这两个字段', async () => {
    const page = useNamespacePage();
    page.filterClusterId.value = 7;
    page.createFormRef.value = {
      validate: vi.fn().mockResolvedValue(undefined),
    } as unknown as NonNullable<(typeof page.createFormRef)['value']>;
    page.createFormModel.value = {
      annotations: {},
      labels: {},
      name: 'demo',
    };
    client.post.mockResolvedValueOnce({});
    await page.submitCreateForm();
    expect(client.post).toHaveBeenCalledWith(
      '/k8s/clusters/7/namespace/create',
      {
        annotations: undefined,
        cluster_id: 7,
        labels: undefined,
        name: 'demo',
      },
    );
  });
});

/** 模拟请求拦截器链：业务 403 经统一提示拦截器后抛给页面的错误（已提示标记） */
async function notifiedForbiddenError() {
  const { rejected } = createForbiddenResponseInterceptor(() => {});
  return rejected(createPermissionDeniedError()).catch((error) => error);
}
