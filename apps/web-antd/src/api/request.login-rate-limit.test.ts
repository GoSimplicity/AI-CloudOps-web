import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { i18n } from '@vben/locales';

import { type AxiosAdapter, AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUSINESS_ERROR_MESSAGE_KEY_PREFIX } from '#/utils/permission/business-error';

import { formatLoginLockCountdown, readLoginLockState } from './login-lock';
import { HTTP_ERROR_MESSAGE_KEY_PREFIX, requestClient } from './request';

/**
 * 登录防爆破：只改 /user/login 的 429 / 503。
 * 账号锁定带真实剩余秒数；nginx 限流是 JSON 429 且 Retry-After: 1。
 * 429 没有秒数或正文不是 JSON 时提示「请求过于频繁，请稍后再试」并倒计时 1 秒。
 * 登录 503（JSON 或 HTML）提示服务暂不可用，不倒计时。
 * 不读取信封里的 data。
 */
const notices = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
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
    isAccessChecked: true,
    refreshToken: 'refresh',
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

function useLocale(lang: 'en-US' | 'zh-CN') {
  const shared = JSON.parse(
    readFileSync(
      resolve(process.cwd(), `packages/locales/src/langs/${lang}.json`),
      'utf8',
    ),
  );
  const app = JSON.parse(
    readFileSync(
      resolve(process.cwd(), `apps/web-antd/src/locales/langs/${lang}.json`),
      'utf8',
    ),
  );
  i18n.global.setLocaleMessage(lang, shared);
  i18n.global.mergeLocaleMessage(lang, app);
  i18n.global.locale.value = lang;
  i18n.global.fallbackLocale.value = lang;
}

function reply(
  config: unknown,
  status: number,
  data: unknown,
  headers: unknown = {},
) {
  const response = {
    config,
    data,
    headers,
    status,
    statusText: String(status),
  };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config as never,
    {},
    response as never,
  );
}

async function post(
  url: string,
  status: number,
  data: unknown,
  headers: unknown = {},
) {
  const adapter: AxiosAdapter = async (config) =>
    reply(config, status, data, headers) as never;
  return requestClient
    .post(url, { password: 'test fixture', username: 'alice' }, { adapter })
    .catch((error: unknown) => error);
}

function expectNotice(text: string, keyPrefix = HTTP_ERROR_MESSAGE_KEY_PREFIX) {
  expect(notices.error).toHaveBeenCalledTimes(1);
  expect(notices.error).toHaveBeenCalledWith({
    content: text,
    key: `${keyPrefix}${text}`,
  });
}

describe('登录 429 / 503', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
    useLocale('zh-CN');
  });

  it.each([null, {}])(
    '账号锁定 429（data=%j）提示后端 message，倒计时用 Retry-After 秒数',
    async (data) => {
      const error = await post(
        '/user/login',
        429,
        { code: 1, data, message: '登录失败次数过多，请 2 分钟后再试' },
        { 'Retry-After': '90' },
      );
      expectNotice('登录失败次数过多，请 2 分钟后再试');
      expect(readLoginLockState(error)).toEqual({ hint: '', seconds: 90 });
      expect(formatLoginLockCountdown(90)).toBe('请 1 分 30 秒后再试');
      expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
        '请求过于频繁，请稍后重试',
      );
    },
  );

  it('retry-After 为 1 时原样提示后端 message，倒计时只按 1 秒', async () => {
    const error = await post(
      '/user/login',
      429,
      { code: 1, data: {}, message: '登录失败次数过多，请 1 分钟后再试' },
      new AxiosHeaders({ 'Retry-After': '1' }),
    );
    expectNotice('登录失败次数过多，请 1 分钟后再试');
    expect(readLoginLockState(error).seconds).toBe(1);
    expect(formatLoginLockCountdown(1)).toBe('请 1 秒后再试');
    expect(formatLoginLockCountdown(1)).not.toMatch(/分钟/);
  });

  it.each([{}, null])(
    'nginx JSON 429（Retry-After 1，data=%j）短暂禁用，文案不含分钟',
    async (data) => {
      const error = await post(
        '/user/login',
        429,
        { code: 1, data, message: '请求过于频繁，请稍后再试' },
        { 'retry-after': '1' },
      );
      expectNotice('请求过于频繁，请稍后再试');
      expect(readLoginLockState(error).seconds).toBe(1);
      expect(formatLoginLockCountdown(1)).not.toMatch(/分钟/);
    },
  );

  it('429 没有 Retry-After 时提示频率限制并默认 1 秒', async () => {
    const error = await post('/user/login', 429, {
      code: 1,
      data: {},
      message: '登录失败次数过多，请 3 分钟后再试',
    });
    expectNotice('请求过于频繁，请稍后再试');
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain('3 分钟');
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it('429 的 HTML 正文不抛错，并默认倒计时 1 秒', async () => {
    const error = await post(
      '/user/login',
      429,
      '<html><body>429 Too Many Requests</body></html>',
    );
    expectNotice('请求过于频繁，请稍后再试');
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain('<html');
    expect(readLoginLockState(error).seconds).toBe(1);
  });

  it.each([{}, null])(
    'redis 不可用的 JSON 503（data=%j）提示服务暂不可用，不倒计时',
    async (data) => {
      const error = await post('/user/login', 503, {
        code: 1,
        data,
        message: '登录服务暂不可用，请稍后重试',
      });
      expectNotice('登录服务暂不可用，请稍后重试');
      expect(readLoginLockState(error).seconds).toBe(0);
    },
  );

  it('登录 503 的 HTML 提示服务暂不可用，不倒计时', async () => {
    const error = await post(
      '/user/login',
      503,
      '<html><body>503 Service Unavailable</body></html>',
      { 'Retry-After': '30' },
    );
    expectNotice('登录服务暂不可用，请稍后重试');
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      '503 Service',
    );
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      '请求过于频繁',
    );
    expect(readLoginLockState(error).seconds).toBe(0);
  });

  it('英文环境下 503 走 i18n，而不是后端中文', async () => {
    useLocale('en-US');
    await post('/user/login', 503, {
      code: 1,
      data: {},
      message: '登录服务暂不可用，请稍后重试',
    });
    expectNotice('Login is temporarily unavailable. Please try again later.');
  });

  it.each([{}, null])(
    '普通密码错误（data=%j）只提示一次，不锁定',
    async (data) => {
      const error = await post('/user/login', 200, {
        code: 1,
        data,
        message: '用户名或密码错误',
      });
      expectNotice('用户名或密码错误', BUSINESS_ERROR_MESSAGE_KEY_PREFIX);
      expect(readLoginLockState(error).seconds).toBe(0);
      expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
        '请求过于频繁',
      );
    },
  );

  it('其它接口的 429 仍是通用频率限制文案', async () => {
    const error = await post(
      '/k8s/nodes',
      429,
      { code: 1, data: {}, message: '登录失败次数过多，请 2 分钟后再试' },
      { 'Retry-After': '90' },
    );
    expectNotice('请求过于频繁，请稍后重试');
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      '登录失败次数过多',
    );
    expect(readLoginLockState(error).seconds).toBe(0);
  });

  it('其它接口的 503 不受登录文案影响', async () => {
    await post('/k8s/nodes', 503, {
      code: 1,
      data: null,
      message: '登录服务暂不可用，请稍后重试',
    });
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      '登录服务暂不可用',
    );
  });
});
