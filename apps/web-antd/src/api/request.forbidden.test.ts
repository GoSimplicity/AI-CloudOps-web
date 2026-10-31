import { type AxiosAdapter, AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-02 P3-5：403 统一提示走完整请求链路（真实 requestClient 拦截器）的集成测试
 */
const notices = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
const refreshTokenApi = vi.hoisted(() => vi.fn());

vi.mock('ant-design-vue', () => ({ message: notices }));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      enableRefreshToken: true,
      locale: 'zh-CN',
      loginExpiredMode: 'modal',
    },
  },
}));
const access = vi.hoisted(() => {
  const store = {
    accessToken: 'token' as null | string,
    refreshToken: 'refresh',
    isAccessChecked: true,
    setAccessToken: (token: null | string) => {
      store.accessToken = token;
    },
    setLoginExpired: () => {},
  };
  return store;
});
vi.mock('@vben/stores', () => ({
  useAccessStore: () => access,
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 1, logout: vi.fn() }),
}));
vi.mock('./core', () => ({ refreshTokenApi }));

import {
  getForbiddenBackendMessage,
  isPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import { requestClient } from './request';

function reply(config: any, status: number, data: unknown) {
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
    config,
    {},
    response,
  );
}

/** 依次返回给定的响应，并记录每次请求的 Authorization 头 */
function sequence(...replies: [number, unknown][]) {
  const authorizations: string[] = [];
  const adapter: AxiosAdapter = async (config) => {
    authorizations.push(String(config.headers?.Authorization));
    const [status, data] = replies[authorizations.length - 1]!;
    return reply(config, status, data);
  };
  return { adapter, authorizations };
}

function expectSinglePermissionNotice() {
  expect(notices.error).toHaveBeenCalledTimes(1);
  expect(notices.error).toHaveBeenCalledWith({
    content: PERMISSION_DENIED_MESSAGE,
    key: PERMISSION_DENIED_MESSAGE_KEY,
  });
}

describe('403 统一提示 · 请求链路集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
  });

  it.each([
    ['对象', { code: 403, data: {}, message: '无权限访问该接口' }],
    ['字符串', 'Forbidden'],
  ])(
    '401 → 刷新 token → 重放 → 403（响应体为%s）：只提示一次且错误带已提示标记',
    async (_kind, body) => {
      const { adapter, authorizations } = sequence(
        [401, { code: 401, message: 'token expired' }],
        [403, body],
      );
      const error = await requestClient
        .delete('/cron/job/1/delete', { adapter })
        .catch((error_) => error_);

      expect(refreshTokenApi).toHaveBeenCalledTimes(1);
      expect(authorizations).toEqual(['Bearer token', 'Bearer new-token']);
      expect(error.response.status).toBe(403);
      expect(isPermissionDeniedError(error)).toBe(true);
      // 标记本身（不依赖 status 兜底）也要保留下来
      expect((error as any)[Symbol.for('ai-cloudops.permissionDenied')]).toBe(
        true,
      );
      expectSinglePermissionNotice();
    },
  );

  it('403 响应体为字符串：只提示一次，按 status 判断的页面 catch 跳过自身提示', async () => {
    const { adapter } = sequence([403, 'Forbidden']);
    try {
      await requestClient.get('/cron/job/list', { adapter });
    } catch (error: any) {
      // 与 views/cron/management/Management.ts 的写法一致：按 status 分支
      if (error?.response?.status === 403) {
        if (!isPermissionDeniedError(error))
          notices.error('没有权限访问定时任务功能');
      } else {
        notices.error('获取定时任务列表失败，请刷新重试');
      }
      expect(error).toBeInstanceOf(Error);
      // 字符串响应体同样改写为统一文案，不透传后端原文
      expect(error.message).toBe(PERMISSION_DENIED_MESSAGE);
      expect(getForbiddenBackendMessage(error)).toBe('Forbidden');
      expect(isPermissionDeniedError(error)).toBe(true);
    }
    expectSinglePermissionNotice();
  });

  it('HTTP 200 + 业务码 403：完整链路只弹一次统一提示，页面守卫跳过自身提示', async () => {
    const { adapter } = sequence([
      200,
      { code: 403, data: null, message: '无权限访问该接口' },
    ]);
    let caught: any;
    try {
      await requestClient.post('/cron/job/1/trigger', {}, { adapter });
    } catch (error: any) {
      caught = error;
      if (!isPermissionDeniedError(error)) notices.error('触发任务失败');
    }
    expect(caught).toBeInstanceOf(Error);
    // 统一文案：error.message 也不带后端原文，页面按 message 取文案时不会透传
    expect(caught.message).toBe(`Error 403: ${PERMISSION_DENIED_MESSAGE}`);
    expect(caught.message).not.toContain('无权限访问该接口');
    expect(getForbiddenBackendMessage(caught)).toBe('无权限访问该接口');
    expect(isPermissionDeniedError(caught)).toBe(true);
    expectSinglePermissionNotice();
  });

  it.each([
    ['HTTP 403', 403],
    ['HTTP 200 + 业务码 403', 200],
  ])(
    '%s：任何提示都不出现后端 403 原文，只出现统一文案',
    async (_kind, status) => {
      const { adapter } = sequence([
        status,
        { code: 403, data: null, message: '无权限访问该接口' },
      ]);
      const caught: any = await requestClient
        .delete('/k8s/node/7/node-1/taints/delete', { adapter })
        .catch((error: any) => error);
      expect(isPermissionDeniedError(caught)).toBe(true);
      // 错误对象本身也不带后端原文：即使页面未加守卫、直接弹 error.message 也只会是统一文案
      expect(String(caught.message)).not.toContain('无权限访问该接口');
      expect(
        String(caught.response?.data?.message ?? caught.message),
      ).not.toContain('无权限访问该接口');
      expect(getForbiddenBackendMessage(caught)).toBe('无权限访问该接口');
      const all = JSON.stringify([
        notices.error.mock.calls,
        notices.warning.mock.calls,
        notices.info.mock.calls,
        notices.success.mock.calls,
      ]);
      expect(all).not.toContain('无权限访问该接口');
      expect(PERMISSION_DENIED_MESSAGE).toBe(
        '没有权限执行此操作，请联系管理员',
      );
      expectSinglePermissionNotice();
    },
  );

  it('HTTP 500 响应体里带 code 403 不当作无权限（只在 2xx / 403 时认业务码）', async () => {
    const { adapter } = sequence([500, { code: 403, message: 'upstream' }]);
    const error = await requestClient
      .get('/x', { adapter })
      .catch((error_) => error_);
    expect(isPermissionDeniedError(error)).toBe(false);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]?.[0]).not.toMatchObject({
      content: PERMISSION_DENIED_MESSAGE,
    });
  });
});
