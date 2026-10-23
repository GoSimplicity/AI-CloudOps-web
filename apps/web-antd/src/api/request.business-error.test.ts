import { $t } from '@vben/locales';

import { AxiosError, type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 业务错误（HTTP 200 + code≠0）只提示一次：走真实 requestClient 拦截器链
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
  BUSINESS_ERROR_MESSAGE_KEY_PREFIX,
  getBusinessErrorMessage,
  isBusinessError,
} from '#/utils/permission/business-error';
import {
  isPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

import { requestClient } from './request';

const BACKEND_MESSAGE = '本地执行已禁用，请联系管理员开启 allow_local_exec';

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

function adapterOf(status: number, data: unknown): AxiosAdapter {
  return async (config) => reply(config, status, data);
}

function businessAdapter(text = BACKEND_MESSAGE) {
  return adapterOf(200, { code: 1, data: null, message: text });
}

function expectSingleBusinessNotice(text = BACKEND_MESSAGE) {
  expect(notices.error).toHaveBeenCalledTimes(1);
  expect(notices.error).toHaveBeenCalledWith({
    content: text,
    key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${text}`,
  });
}

describe('业务错误（code≠0）统一提示 · 请求链路集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
  });

  it('1. code≠0 且页面 catch 自己弹提示（按 isPermissionDeniedError 守卫）：全程只弹一条后端原文', async () => {
    try {
      await requestClient.post(
        '/cron/job/create',
        {},
        {
          adapter: businessAdapter(),
        },
      );
    } catch (error: any) {
      // 与已扫过的页面写法一致
      if (!isPermissionDeniedError(error)) notices.error('创建任务失败');
    }
    expectSingleBusinessNotice();
    // 不再出现通用的「内部服务器错误」
    expect(notices.error).not.toHaveBeenCalledWith(
      $t('fallback.http.internalServerError'),
    );
  });

  it.each([
    [
      '没有 catch',
      async () => {
        await requestClient.post('/x', {}, { adapter: businessAdapter() });
      },
    ],
    [
      '空 catch',
      async () => {
        try {
          await requestClient.post('/x', {}, { adapter: businessAdapter() });
        } catch {}
      },
    ],
    [
      '只打日志的 catch',
      async () => {
        try {
          await requestClient.post('/x', {}, { adapter: businessAdapter() });
        } catch (error) {
          console.debug('ignored', error);
        }
      },
    ],
  ])(
    '2. code≠0 且页面不提示（%s）：仍恰好弹一条，内容是后端原文',
    async (_kind, page) => {
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
      await page().catch(() => {});
      expectSingleBusinessNotice();
      debug.mockRestore();
    },
  );

  it('2. 后端 message 为空时回退通用提示，不静默', async () => {
    await requestClient
      .post('/x', {}, { adapter: adapterOf(200, { code: 1, message: '' }) })
      .catch(() => {});
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]?.[0]).toMatchObject({
      content: $t('fallback.http.internalServerError'),
    });
  });

  it('错误对象保持 `Error <status>: <原文>` 格式并带业务标记（兼容按前缀取原文的页面）', async () => {
    const error = await requestClient
      .post('/x', {}, { adapter: businessAdapter() })
      .catch((error_) => error_);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(`Error 200: ${BACKEND_MESSAGE}`);
    expect(error.message.replace(/^Error \d{3}: /, '')).toBe(BACKEND_MESSAGE);
    expect(isBusinessError(error)).toBe(true);
    expect(getBusinessErrorMessage(error)).toBe(BACKEND_MESSAGE);
    expect(isPermissionDeniedError(error)).toBe(true);
    // 标记不可枚举，不影响页面对错误对象的序列化 / 遍历
    expect(Object.keys(error)).toEqual([]);
  });

  it('3. HTTP 500 的提示保持原样（通用「内部服务器错误」，字符串形式）', async () => {
    const error = await requestClient
      .get('/x', { adapter: adapterOf(500, { code: 1, message: 'boom' }) })
      .catch((error_) => error_);
    expect(isBusinessError(error)).toBe(false);
    expect(isPermissionDeniedError(error)).toBe(false);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith(
      $t('fallback.http.internalServerError'),
    );
  });

  it('3. 网络错误的提示保持原样', async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config as any);
    };
    const error = await requestClient
      .get('/x', { adapter })
      .catch((error_) => error_);
    expect(isBusinessError(error)).toBe(false);
    expect(isPermissionDeniedError(error)).toBe(false);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith(
      $t('fallback.http.networkError'),
    );
  });

  it.each([
    ['HTTP 403', 403, { code: 403, message: '无权限访问该接口' }],
    ['HTTP 200 + 业务码 403', 200, { code: 403, message: 'no' }],
  ])('4. %s 行为不变：只弹一条统一无权限提示', async (_kind, status, body) => {
    const error = await requestClient
      .get('/x', { adapter: adapterOf(status, body) })
      .catch((error_) => error_);
    expect(isBusinessError(error)).toBe(false);
    expect(isPermissionDeniedError(error)).toBe(true);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
  });

  it('5. 并发两个不同文案的业务错误：各弹一条、key 不同，互不覆盖', async () => {
    await Promise.allSettled([
      requestClient.post(
        '/a',
        {},
        { adapter: businessAdapter('任务名已存在') },
      ),
      requestClient.post(
        '/b',
        {},
        { adapter: businessAdapter('Cron 表达式无效') },
      ),
    ]);
    expect(notices.error).toHaveBeenCalledTimes(2);
    const keys = notices.error.mock.calls.map((call) => (call[0] as any).key);
    expect(new Set(keys)).toEqual(
      new Set([
        `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}任务名已存在`,
        `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}Cron 表达式无效`,
      ]),
    );
  });

  it('5. 并发两个相同文案的业务错误：共用同一个 key，界面上合并为一条', async () => {
    await Promise.allSettled([
      requestClient.post('/a', {}, { adapter: businessAdapter() }),
      requestClient.post('/b', {}, { adapter: businessAdapter() }),
    ]);
    const keys = new Set(
      notices.error.mock.calls.map((call) => (call[0] as any).key),
    );
    expect(keys).toEqual(
      new Set([`${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${BACKEND_MESSAGE}`]),
    );
  });

  it('cron 场景：创建任务返回 code≠0（本地执行已禁用），页面按 getBackendErrorMessage 写法处理，全程只弹一条后端原文', async () => {
    // 与 sched/w2-huajuan-cron 的 Management.ts getBackendErrorMessage 同一写法
    const getBackendErrorMessage = (error: any, fallback: string) => {
      const raw = error?.response?.data?.message ?? error?.message;
      if (typeof raw !== 'string' || !raw.trim()) return fallback;
      return raw.replace(/^Error \d{3}: /, '') || fallback;
    };
    let pageText = '';
    try {
      await requestClient.post(
        '/cron/job/create',
        { job_type: 2 },
        {
          adapter: businessAdapter(),
        },
      );
    } catch (error: any) {
      pageText = getBackendErrorMessage(error, '创建任务失败');
      if (!isPermissionDeniedError(error)) notices.error(pageText);
    }
    // 页面仍能取到后端原文（兼容），但不会再弹第二条
    expect(pageText).toBe(BACKEND_MESSAGE);
    expectSingleBusinessNotice();
  });

  it.each([
    [
      'HTTP 200 + code 1',
      adapterOf(200, { code: 1, message: BACKEND_MESSAGE }),
    ],
    ['HTTP 200 + code 1 且 message 为空', adapterOf(200, { code: 1 })],
    ['HTTP 200 + code 403', adapterOf(200, { code: 403, message: 'no' })],
    ['HTTP 400', adapterOf(400, { code: 400, message: 'bad' })],
    ['HTTP 403', adapterOf(403, { code: 403, message: 'no' })],
    ['HTTP 404', adapterOf(404, { code: 404, message: 'nf' })],
    ['HTTP 500', adapterOf(500, { code: 1, message: 'boom' })],
    ['HTTP 502（响应体为字符串）', adapterOf(502, 'Bad Gateway')],
    [
      '网络错误',
      (async (config) => {
        throw new AxiosError('Network Error', 'ERR_NETWORK', config as any);
      }) as AxiosAdapter,
    ],
    [
      '超时',
      (async (config) => {
        throw new AxiosError(
          'timeout of 1000ms exceeded',
          'ECONNABORTED',
          config as any,
        );
      }) as AxiosAdapter,
    ],
  ])(
    '没有任何错误落到无提示：%s 且页面空 catch 时恰好弹一条',
    async (_kind, adapter) => {
      try {
        await requestClient.get('/x', { adapter });
      } catch {}
      expect(notices.error).toHaveBeenCalledTimes(1);
    },
  );

  it('401 → 刷新 token → 重放返回业务错误：内外两层拦截链只提示一次', async () => {
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      return calls === 1
        ? reply(config, 401, { code: 401, message: 'token expired' })
        : reply(config, 200, { code: 1, message: BACKEND_MESSAGE });
    };
    const error = await requestClient
      .post('/x', {}, { adapter })
      .catch((error_) => error_);
    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(isBusinessError(error)).toBe(true);
    expectSingleBusinessNotice();
  });
});
