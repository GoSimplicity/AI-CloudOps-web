import { $t } from '@vben/locales';

import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-02b：400 / 409 / 429 / 浏览器中止请求的请求层提示文案（应用层 request.ts 回调里改写，不改 packages）
 * - 409 →「数据已变化，请刷新后重试」，429 →「请求过于频繁，请稍后重试」（文案不带错误码，常量收口在
 *   constants/http-error-messages.ts，incr3 P2-1）
 * - incr3 P2-2：400 显示后端原文（去换行、截断到 200 字），原文为空用通用文案
 * - P3-C / incr3 P3-2：浏览器中止请求（xhr onabort / onloadend status 0：ECONNABORTED，没有 response，不是超时）
 *   不再显示「内部服务器错误」，按网络异常提示；不依赖 'Request aborted' 原文，axios 行为由 xhr 用例锁定
 * - 401 / 403 / 5xx、业务错误（HTTP 200 + code≠0，含 code 409 / 429）、取消类不受影响
 * - incr3 P2-1 / P3-3：请求层弹过的错误带 http-error key 标记（RequestClient 包装后仍在），页面据此不再叠加；
 *   baseRequestClient（无拦截器）的错误没有标记，页面照常提示
 */
const notices = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
const refreshTokenApi = vi.hoisted(() => vi.fn());
/** 可控的 XMLHttpRequest：锁定 axios xhr adapter 对浏览器中止请求的行为（incr3 P3-2） */
const fakeXhr = vi.hoisted(() => ({ mode: 'abort' as 'abort' | 'loadend-status-0' }));

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

import * as sharedMessages from '#/constants/http-error-messages';
import {
  getRequestLayerNoticeKey,
  shouldNotifyPageError,
} from '#/utils/permission/request-notice';

import {
  baseRequestClient,
  HTTP_BAD_REQUEST_DETAIL_MAX_LENGTH,
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
    [503, 'fallback.http.internalServerError'],
    [404, 'fallback.http.notFound'],
    [401, 'fallback.http.unauthorized'],
  ])('其它状态码不受影响：HTTP %s 仍是原文案，不透出后端原文', async (status, key) => {
    await call(adapterOf(status, { code: status, data: null, message: '后端原文 x' }));
    if (status === 401) {
      // 401 走登录过期 / 刷新令牌流程，不弹通用错误
      expect(JSON.stringify(notices.error.mock.calls)).not.toContain('后端原文 x');
      return;
    }
    expectSingleHttpNotice($t(key));
  });

  it('HTTP 403 不受影响：只有统一的无权限提示，不透出后端原文', async () => {
    await call(adapterOf(403, { code: 403, data: null, message: '后端原文 403' }));
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain('后端原文 403');
  });

  describe('incr3 P2-2：HTTP 400 显示后端原文', () => {
    it('有原文：只弹一条后端原文（key 同样按文案区分）', async () => {
      await call(adapterOf(400, { code: 400, data: null, message: '名称不能为空' }));
      expectSingleHttpNotice('名称不能为空');
    });

    it('原文含换行：换成空格，首尾空白去掉', async () => {
      await call(
        adapterOf(400, { code: 400, data: null, message: '  第一行\r\n第二行\n\n第三行  ' }),
      );
      expectSingleHttpNotice('第一行 第二行 第三行');
    });

    it('原文超过 200 字：截断到 200 字（按字符，不切坏中文 / emoji）', async () => {
      expect(HTTP_BAD_REQUEST_DETAIL_MAX_LENGTH).toBe(200);
      const long = `${'参'.repeat(199)}😀尾部不应出现`;
      await call(adapterOf(400, { code: 400, data: null, message: long }));
      const text = `${'参'.repeat(199)}😀`;
      expect([...text]).toHaveLength(200);
      expectSingleHttpNotice(text);
    });

    it('兼容 data.error.message', async () => {
      await call(adapterOf(400, { error: { message: '参数 replicas 非法' } }));
      expectSingleHttpNotice('参数 replicas 非法');
    });

    it.each([
      ['message 为空串', { code: 400, data: null, message: '' }],
      ['message 只有空白 / 换行', { code: 400, data: null, message: ' \n\r ' }],
      ['没有 message', { code: 400, data: null }],
      ['message 不是字符串', { code: 400, data: null, message: { detail: 'x' } }],
      ['响应体是 HTML 字符串', '<html>Bad Request</html>'],
      ['响应体为空', undefined],
    ])('%s：用通用的请求错误文案', async (_label, data) => {
      await call(adapterOf(400, data));
      expectSingleHttpNotice($t('fallback.http.badRequest'));
    });
  });

  describe('incr3 P3-2：浏览器中止请求不依赖 Request aborted 原文', () => {
    it.each(['Request aborted', 'aborted', 'The operation was aborted', ''])(
      'ECONNABORTED、无 response、message=%j（不是超时）：按网络异常提示',
      async (text) => {
        await call(async (config) => {
          throw new AxiosError(text, AxiosError.ECONNABORTED, config, {});
        });
        expectSingleHttpNotice($t('fallback.http.networkError'));
      },
    );

    it.each(['abort', 'loadend-status-0'] as const)(
      'axios 1.20 xhr adapter 锁定（%s）：浏览器中止 → code ECONNABORTED、无 response、按网络异常提示',
      async (mode) => {
        fakeXhr.mode = mode;
        class FakeXMLHttpRequest {
          onabort: null | (() => void) = null;
          onerror: null | (() => void) = null;
          onloadend: null | (() => void) = null;
          ontimeout: null | (() => void) = null;
          readyState = 0;
          responseText = '';
          responseURL = '';
          status = 0;
          statusText = '';
          timeout = 0;
          abort() {}
          getAllResponseHeaders() {
            return '';
          }
          open() {
            this.readyState = 1;
          }
          send() {
            setTimeout(() => {
              this.readyState = 4;
              if (fakeXhr.mode === 'abort') this.onabort?.();
              else this.onloadend?.();
            });
          }
          setRequestHeader() {}
        }
        vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
        try {
          const error = await requestClient
            .get('/x', { adapter: 'xhr' })
            .catch((error_: any) => error_);
          expect(error?.code).toBe('ECONNABORTED');
          expect(error?.response).toBeUndefined();
          expect(String(error?.message)).not.toMatch(/timeout/i);
          expectSingleHttpNotice($t('fallback.http.networkError'));
        } finally {
          vi.unstubAllGlobals();
        }
      },
    );
  });

  describe('incr3 P2-1 / P3-3：请求层标记与页面判断', () => {
    it('409 / 429 文案常量收口在 constants/http-error-messages.ts，request.ts 转出同一常量', () => {
      expect(HTTP_CONFLICT_MESSAGE).toBe(sharedMessages.HTTP_CONFLICT_MESSAGE);
      expect(HTTP_TOO_MANY_REQUESTS_MESSAGE).toBe(sharedMessages.HTTP_TOO_MANY_REQUESTS_MESSAGE);
    });

    it.each([
      [409, HTTP_CONFLICT_MESSAGE],
      [429, HTTP_TOO_MANY_REQUESTS_MESSAGE],
      [500, $t('fallback.http.internalServerError')],
    ])('HTTP %s：包装后的错误带 http-error key 标记，页面不再弹', async (status, text) => {
      const error = await call(adapterOf(status, { code: status, data: null, message: 'x' }));
      expect(getRequestLayerNoticeKey(error)).toBe(`${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`);
      expect(shouldNotifyPageError(error)).toBe(false);
    });

    it('网络错误（未包装的 AxiosError）同样带标记，页面不再弹', async () => {
      const error = await call(async (config) => {
        throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
      });
      expect(getRequestLayerNoticeKey(error)).toBe(
        `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${$t('fallback.http.networkError')}`,
      );
      expect(shouldNotifyPageError(error)).toBe(false);
    });

    it('并发同文案（如 409 连发）：同一 key 合并为一条', async () => {
      await Promise.all([
        call(adapterOf(409, { code: 409, data: null, message: 'a' })),
        call(adapterOf(409, { code: 409, data: null, message: 'b' })),
      ]);
      const keys = new Set(notices.error.mock.calls.map(([arg]) => arg.key));
      expect([...keys]).toEqual([`${HTTP_ERROR_MESSAGE_KEY_PREFIX}${HTTP_CONFLICT_MESSAGE}`]);
    });

    it.each([
      [500, (config: any) => reply(config, 500, { code: 500, message: 'x' })],
      [
        '网络错误',
        (config: any) => {
          throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
        },
      ],
    ])('baseRequestClient（无拦截器）%s：请求层没弹，也没有标记，页面照常提示', async (_label, impl) => {
      const error = await baseRequestClient
        .get('/x', { adapter: async (config) => impl(config) })
        .catch((error_: any) => error_);
      expect(notices.error).not.toHaveBeenCalled();
      expect(getRequestLayerNoticeKey(error)).toBeUndefined();
      expect(shouldNotifyPageError(error)).toBe(true);
    });
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
