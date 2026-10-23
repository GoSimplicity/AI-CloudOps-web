import { $t } from '@vben/locales';

import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-02b：409 / 429 / Request aborted 的请求层提示文案（应用层 request.ts 回调里改写，不改 packages）
 * - 409 →「数据已变化，请刷新后重试」，429 →「请求过于频繁，请稍后重试」（文案不带错误码）
 * - P3-C：浏览器中止请求（xhr onabort：AxiosError 'Request aborted' / ECONNABORTED，没有 response）
 *   不再显示「内部服务器错误」，按网络异常提示
 * - 其它状态码、业务错误（HTTP 200 + code≠0，含 code 409 / 429）、取消类不受影响
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

import { BUSINESS_ERROR_MESSAGE_KEY_PREFIX } from '#/utils/permission/business-error';

import {
  HTTP_CONFLICT_MESSAGE,
  HTTP_ERROR_MESSAGE_KEY_PREFIX,
  HTTP_TOO_MANY_REQUESTS_MESSAGE,
  requestClient,
} from './request';

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

const adapterOf =
  (status: number, data: unknown): AxiosAdapter =>
  async (config) =>
    reply(config, status, data);

async function call(adapter: AxiosAdapter) {
  return requestClient.post('/x', {}, { adapter }).catch((error) => error);
}

function expectSingleHttpNotice(text: string) {
  expect(notices.error).toHaveBeenCalledTimes(1);
  expect(notices.error).toHaveBeenCalledWith({
    content: text,
    key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
  });
}

describe('FE-02b：409 / 429 / Request aborted 请求层文案', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
  });

  it('文案常量：不带错误码', () => {
    expect(HTTP_CONFLICT_MESSAGE).toBe('数据已变化，请刷新后重试');
    expect(HTTP_TOO_MANY_REQUESTS_MESSAGE).toBe('请求过于频繁，请稍后重试');
    for (const text of [HTTP_CONFLICT_MESSAGE, HTTP_TOO_MANY_REQUESTS_MESSAGE])
      expect(text).not.toMatch(/\d{3}/);
  });

  it('HTTP 409：只弹一条「数据已变化，请刷新后重试」，不弹内部服务器错误', async () => {
    const error = await call(
      adapterOf(409, { code: 409, data: null, message: 'version conflict' }),
    );
    expect(error?.response?.status).toBe(409);
    expectSingleHttpNotice('数据已变化，请刷新后重试');
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      $t('fallback.http.internalServerError'),
    );
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      'version conflict',
    );
  });

  it('HTTP 429：只弹一条「请求过于频繁，请稍后重试」', async () => {
    await call(adapterOf(429, { code: 429, data: null, message: 'rate limited' }));
    expectSingleHttpNotice('请求过于频繁，请稍后重试');
  });

  it('P3-C：浏览器中止请求（Request aborted / ECONNABORTED，无 response）：按网络异常提示一条', async () => {
    await call(async (config) => {
      throw new AxiosError('Request aborted', AxiosError.ECONNABORTED, config, {});
    });
    const text = $t('fallback.http.networkError');
    expect(text).not.toBe('');
    expectSingleHttpNotice(text);
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      $t('fallback.http.internalServerError'),
    );
  });

  it.each([
    [500, 'fallback.http.internalServerError'],
    [502, 'fallback.http.internalServerError'],
    [404, 'fallback.http.notFound'],
    [400, 'fallback.http.badRequest'],
  ])('其它状态码不受影响：HTTP %s 仍是原文案', async (status, key) => {
    await call(adapterOf(status, { code: status, data: null, message: 'x' }));
    expectSingleHttpNotice($t(key));
  });

  it('超时（timeout，ECONNABORTED）不受影响：仍是请求超时文案', async () => {
    await call(async (config) => {
      throw new AxiosError('timeout of 1ms exceeded', AxiosError.ECONNABORTED, config, {});
    });
    expectSingleHttpNotice($t('fallback.http.requestTimeout'));
  });

  it.each([409, 429])(
    '业务错误（HTTP 200 + code %s）不受影响：只弹后端原文一条',
    async (code) => {
      const text = `后端原文 ${code}`;
      await call(adapterOf(200, { code, data: null, message: text }));
      expect(notices.error).toHaveBeenCalledTimes(1);
      expect(notices.error).toHaveBeenCalledWith({
        content: text,
        key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${text}`,
      });
    },
  );

  it('取消的请求仍然零提示', async () => {
    await call(async (config) => {
      throw new axios.CanceledError(undefined, config, {});
    });
    expect(notices.error).not.toHaveBeenCalled();
  });
});
