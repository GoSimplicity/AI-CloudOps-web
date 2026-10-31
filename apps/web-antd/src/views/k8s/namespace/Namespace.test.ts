import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
} from '#/utils/permission/forbidden';
import { markRequestLayerTrace } from '#/utils/permission/request-notice';

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
      items: { cluster_id: number; name: string }[];
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
      items: { cluster_id: number; name: string }[];
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
    const axios = (await import('axios')).default;
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

/** 模拟请求拦截器链：业务 403 经统一提示拦截器后抛给页面的错误（已提示标记） */
async function notifiedForbiddenError() {
  const { rejected } = createForbiddenResponseInterceptor(() => {});
  return rejected(createPermissionDeniedError()).catch((error) => error);
}
