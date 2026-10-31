import { type AxiosAdapter, AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock('ant-design-vue', () => ({ message: notices }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: 'token',
    refreshToken: 'refresh',
    isAccessChecked: true,
    setAccessToken: vi.fn(),
    setLoginExpired: vi.fn(),
  }),
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 1, logout: vi.fn() }),
}));
vi.mock('./core', () => ({ refreshTokenApi: vi.fn() }));

import {
  createForbiddenResponseInterceptor,
  isPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import { requestClient } from './request';

function replyWith(status: number, data: unknown): AxiosAdapter {
  return async (config) => {
    const response = {
      config,
      data,
      headers: {},
      status,
      statusText: String(status),
    } as any;
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      String(status),
      config as any,
      {},
      response,
    );
  };
}

describe('请求层 403 统一提示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HTTP 403 只弹一次统一提示', async () => {
    const error = await requestClient
      .delete('/k8s/pod/delete', {
        adapter: replyWith(403, {
          code: 403,
          data: {},
          message: '无权限访问该接口',
        }),
      })
      .catch((error_) => error_);

    expect(isPermissionDeniedError(error)).toBe(true);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
  });

  it('HTTP 200 + 业务码 403 也统一提示一次', async () => {
    const error = await requestClient
      .post('/x', {}, { adapter: replyWith(200, { code: 403, message: 'no' }) })
      .catch((error_) => error_);

    expect(isPermissionDeniedError(error)).toBe(true);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]?.[0]).toMatchObject({
      content: PERMISSION_DENIED_MESSAGE,
    });
  });

  it('并发多个 403 使用同一个 key，界面上合并为一条', async () => {
    await Promise.allSettled(
      [1, 2, 3].map(() =>
        requestClient.get('/y', {
          adapter: replyWith(403, { code: 403, message: 'no' }),
        }),
      ),
    );
    const keys = new Set(
      notices.error.mock.calls.map((call) => (call[0] as any).key),
    );
    expect(keys).toEqual(new Set([PERMISSION_DENIED_MESSAGE_KEY]));
  });

  it('非 403 错误仍走原有通用提示', async () => {
    const error = await requestClient
      .get('/z', { adapter: replyWith(404, { code: 404, message: 'nf' }) })
      .catch((error_) => error_);

    expect(isPermissionDeniedError(error)).toBe(false);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]?.[0]).not.toBe(
      PERMISSION_DENIED_MESSAGE,
    );
    expect(notices.error.mock.calls[0]?.[0]).toMatchObject({
      key: expect.stringMatching(/^http-error:/),
    });
  });

  it('页面 catch 用 isPermissionDeniedError 跳过自身提示后，全程只有一条', async () => {
    try {
      await requestClient.delete('/workorder/notification/delete/1', {
        adapter: replyWith(403, { code: 403, message: 'forbidden' }),
      });
    } catch (error: any) {
      // 模拟页面里的写法（如 workorder/Notification.vue 删除失败分支）
      if (!isPermissionDeniedError(error)) notices.error('删除失败');
    }
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]?.[0]).toMatchObject({
      content: PERMISSION_DENIED_MESSAGE,
    });
  });

  it('同一个错误对象重复经过拦截器（如 401 刷新后重放）只提示一次', async () => {
    const notify = vi.fn();
    const { rejected } = createForbiddenResponseInterceptor(notify);
    const error = { response: { status: 403, data: { code: 403 } } };
    await rejected(error).catch(() => {});
    await rejected(error).catch(() => {});
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('非 403 不触发统一权限提示', async () => {
    const notify = vi.fn();
    const { rejected } = createForbiddenResponseInterceptor(notify);
    await rejected({ response: { status: 500, data: { code: 1 } } }).catch(
      () => {},
    );
    expect(notify).not.toHaveBeenCalled();
  });
});
