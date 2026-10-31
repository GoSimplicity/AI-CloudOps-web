import { $t } from '@vben/locales';

import axios, { type AxiosAdapter, AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-02b：400 / 409 / 429 / 浏览器中止请求的请求层提示文案（应用层 request.ts 回调里改写，不改 packages）
 * - 409 →「数据已变化，请刷新后重试」，429 →「请求过于频繁，请稍后重试」（文案不带错误码，常量收口在
 *   constants/http-error-messages.ts，incr3 P2-1）
 * - incr3 P2-2：400 显示后端原文（去换行、截断到 200 字），原文为空用通用文案；
 *   autofix 接口（/autofix/…）例外，仍不透出后端原文（与 SEC-26 规则 3 重叠时以 SEC-26 为准，窝窝头 2026-10-24）
 * - incr4 P2-1：敏感接口（autofix 与 Secret 相关路径）的 400 一律用通用文案，其它接口暂时保留后端原文；
 *   路径先 decodeURIComponent（解码失败按敏感接口处理，fail closed），认 `.json` 后缀与 `;` 参数（P3-B）
 * - incr5 F2 / F3：非敏感接口的 422 不透出后端原文（只有 400 透出）；路径只解码一次（双重编码不还原）
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
const fakeXhr = vi.hoisted(() => ({
  mode: 'abort' as 'abort' | 'loadend-status-0',
}));

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
  requestClientAIOps,
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
    await call(
      adapterOf(429, { code: 429, data: null, message: 'rate limited' }),
    );
    expectSingleHttpNotice('请求过于频繁，请稍后重试');
  });

  it('P3-C：浏览器中止请求（Request aborted / ECONNABORTED，无 response）：按网络异常提示一条', async () => {
    await call(async (config) => {
      throw new AxiosError(
        'Request aborted',
        AxiosError.ECONNABORTED,
        config,
        {},
      );
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
  ])(
    '其它状态码不受影响：HTTP %s 仍是原文案，不透出后端原文',
    async (status, key) => {
      await call(
        adapterOf(status, { code: status, data: null, message: '后端原文 x' }),
      );
      if (status === 401) {
        // 401 走登录过期 / 刷新令牌流程，不弹通用错误
        expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
          '后端原文 x',
        );
        return;
      }
      expectSingleHttpNotice($t(key));
    },
  );

  it('HTTP 403 不受影响：只有统一的无权限提示，不透出后端原文', async () => {
    await call(
      adapterOf(403, { code: 403, data: null, message: '后端原文 403' }),
    );
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      '后端原文 403',
    );
  });

  describe('incr3 P2-2：HTTP 400 显示后端原文', () => {
    it('有原文：只弹一条后端原文（key 同样按文案区分）', async () => {
      await call(
        adapterOf(400, { code: 400, data: null, message: '名称不能为空' }),
      );
      expectSingleHttpNotice('名称不能为空');
    });

    it('原文含换行：换成空格，首尾空白去掉', async () => {
      await call(
        adapterOf(400, {
          code: 400,
          data: null,
          message: '  第一行\r\n第二行\n\n第三行  ',
        }),
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
      [
        'message 不是字符串',
        { code: 400, data: null, message: { detail: 'x' } },
      ],
      ['响应体是 HTML 字符串', '<html>Bad Request</html>'],
      ['响应体为空', undefined],
    ])('%s：用通用的请求错误文案', async (_label, data) => {
      await call(adapterOf(400, data));
      expectSingleHttpNotice($t('fallback.http.badRequest'));
    });
  });

  describe('incr3 P2-2 例外：autofix 接口 400 不透出后端原文（以 SEC-26 规则 3 为准）', () => {
    const BACKEND = {
      code: 400,
      data: null,
      message: '后端原文 WORKFLOW_APPROVAL_ERROR',
    };

    it.each([
      [
        'POST /autofix/workflow',
        () =>
          requestClientAIOps.post(
            '/autofix/workflow',
            {},
            { adapter: adapterOf(400, BACKEND) },
          ),
      ],
      [
        'POST /autofix/workflow/confirm',
        () =>
          requestClientAIOps.post(
            '/autofix/workflow/confirm',
            {},
            { adapter: adapterOf(400, BACKEND) },
          ),
      ],
      [
        'GET /autofix/info',
        () =>
          requestClientAIOps.get('/autofix/info', {
            adapter: adapterOf(400, BACKEND),
          }),
      ],
      [
        'GET autofix/ready?x=1（无前导斜杠、带查询串）',
        () =>
          requestClientAIOps.get('autofix/ready?x=1', {
            adapter: adapterOf(400, BACKEND),
          }),
      ],
      [
        '绝对地址 …/api/v1/autofix/workflow',
        () =>
          requestClientAIOps.post(
            'http://127.0.0.1:9/api/v1/autofix/workflow',
            {},
            { adapter: adapterOf(400, BACKEND) },
          ),
      ],
    ])('%s：只弹一条通用的请求错误文案，不含后端原文', async (_label, run) => {
      await run().catch((error) => error);
      expectSingleHttpNotice($t('fallback.http.badRequest'));
      expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
        'WORKFLOW_APPROVAL_ERROR',
      );
    });

    it.each([
      [
        'aiops 其它接口 /rca/analyze',
        () =>
          requestClientAIOps.post(
            '/rca/analyze',
            {},
            { adapter: adapterOf(400, BACKEND) },
          ),
      ],
      [
        '主站路径只是包含 autofix 字样 /k8s/autofixer',
        () =>
          requestClient.post(
            '/k8s/autofixer',
            {},
            { adapter: adapterOf(400, BACKEND) },
          ),
      ],
    ])('对照：%s 仍显示后端原文', async (_label, run) => {
      await run().catch((error) => error);
      expectSingleHttpNotice(BACKEND.message);
    });

    it.each([
      [409, HTTP_CONFLICT_MESSAGE],
      [500, $t('fallback.http.internalServerError')],
      [503, $t('fallback.http.internalServerError')],
    ])(
      'autofix 接口的 409 / 5xx 不受影响（%s：仍是原有通用文案，不含后端原文）',
      async (status, text) => {
        await requestClientAIOps
          .post(
            '/autofix/workflow/confirm',
            {},
            { adapter: adapterOf(status, { ...BACKEND, code: status }) },
          )
          .catch((error) => error);
        expectSingleHttpNotice(text);
        expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
          'WORKFLOW_APPROVAL_ERROR',
        );
      },
    );
  });

  describe('incr4 P2-1 / P3-A / P3-B：敏感接口（autofix、Secret）400 一律通用文案', () => {
    // 假值：模拟后端 400 回显用户输入（例如 Secret data），不是真实密钥
    const RAW = '后端原文 SENSITIVE-RAW data=fake-value-not-a-secret';
    const BODY = { code: 400, data: null, message: RAW };
    const ERROR_ONLY_BODY = { error: { message: RAW } };
    const viaAiops = (url: string, body: unknown = BODY) =>
      requestClientAIOps
        .post(url, {}, { adapter: adapterOf(400, body) })
        .catch((error) => error);
    const viaMain = (url: string, body: unknown = BODY) =>
      requestClient
        .post(url, {}, { adapter: adapterOf(400, body) })
        .catch((error) => error);
    function expectGeneric400() {
      expectSingleHttpNotice($t('fallback.http.badRequest'));
      expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
        'SENSITIVE-RAW',
      );
    }

    it.each([
      ['M06 大小写 /AutoFix/info', '/AutoFix/info'],
      ['M10 裸 /autofix', '/autofix'],
      ['M08 /autofix?x=1', '/autofix?x=1'],
      ['M11 /autofix#h', '/autofix#h'],
      ['P3-B 整段编码 /api%2Fautofix%2Fworkflow', '/api%2Fautofix%2Fworkflow'],
      ['P3-B 段后编码 /api/autofix%2Fworkflow', '/api/autofix%2Fworkflow'],
      ['P3-B /autofix%2F', '/autofix%2F'],
      ['P3-B 小写编码 /api%2fautofix', '/api%2fautofix'],
      ['P3-B .json 后缀 /autofix.json', '/autofix.json'],
      ['P3-B .json 后缀带查询串 /autofix.json?x=1', '/autofix.json?x=1'],
      ['P3-B ; 参数 /autofix;v=1', '/autofix;v=1'],
      ['P3-B ; 参数在中间 /autofix;v=1/workflow', '/autofix;v=1/workflow'],
      ['P3-B 尾随空格 "/autofix "', '/autofix '],
      ['P3-B 编码的尾随空格 /autofix%20', '/autofix%20'],
    ])('autofix %s：400 只弹通用文案，不含后端原文', async (_label, url) => {
      await viaAiops(url);
      expectGeneric400();
    });

    it('M14 autofix 400 响应体只有 error.message：也不透出', async () => {
      await viaAiops('/autofix/workflow', ERROR_ONLY_BODY);
      expectGeneric400();
    });

    it.each([
      ['列表', '/k8s/secret/1/list'],
      ['详情', '/k8s/secret/1/default/s1/detail'],
      ['YAML 详情', '/k8s/secret/1/default/s1/detail/yaml'],
      ['表单创建', '/k8s/secret/1/create'],
      ['YAML 创建', '/k8s/secret/1/create/yaml'],
      ['表单更新', '/k8s/secret/1/default/s1/update'],
      ['YAML 更新', '/k8s/secret/1/default/s1/update/yaml'],
      ['删除', '/k8s/secret/1/default/s1/delete'],
      ['查看明文（sec26 reveal）', '/k8s/secret/1/default/s1/reveal'],
      ['复数 /k8s/secrets/…', '/k8s/secrets/1/list'],
      ['大小写 /K8S/Secret/…', '/K8S/Secret/1/list'],
      ['无前导斜杠', 'k8s/secret/1/list'],
      ['查询串', '/k8s/secret/1/list?page=1'],
      ['hash', '/k8s/secret#h'],
      ['绝对地址', 'http://127.0.0.1:9/api/k8s/secret/1/create'],
      [
        'P3-B 编码 /api/k8s%2Fsecret%2F1%2Fcreate',
        '/api/k8s%2Fsecret%2F1%2Fcreate',
      ],
      ['P3-B .json 后缀', '/k8s/secret.json'],
      ['P3-B ; 参数', '/k8s/secret;v=1/1/list'],
      ['P3-B 尾随空格', '/k8s/secret '],
    ])('Secret %s：400 只弹通用文案，不含后端原文', async (_label, url) => {
      await viaMain(url);
      expectGeneric400();
    });

    it('Secret 400 响应体只有 error.message：也不透出', async () => {
      await viaMain('/k8s/secret/1/create', ERROR_ONLY_BODY);
      expectGeneric400();
    });

    it.each([
      ['不完整的百分号编码', '/rca/analyze%'],
      ['非法 UTF-8 序列', '/k8s/pod/%E0%A4%A/logs'],
      ['非法转义', '/x/%ZZ'],
    ])(
      'P3-B 解码失败（%s）：fail closed，按敏感接口处理',
      async (_label, url) => {
        await viaMain(url);
        expectGeneric400();
      },
    );

    it.each([
      ['M01 /xautofix/', () => viaAiops('/xautofix/')],
      ['/autofix-tasks', () => viaAiops('/autofix-tasks')],
      ['/autofixes', () => viaAiops('/autofixes')],
      ['/k8s/secretary/1/list', () => viaMain('/k8s/secretary/1/list')],
      ['/k8s/secret-store/1/list', () => viaMain('/k8s/secret-store/1/list')],
      ['/k8s/configmap/1/create', () => viaMain('/k8s/configmap/1/create')],
      [
        '/k8s/ingress/1/create（body 里有 secret_name）',
        () => viaMain('/k8s/ingress/1/create'),
      ],
      [
        '/k8s/serviceaccount/1/default/sa/update',
        () => viaMain('/k8s/serviceaccount/1/default/sa/update'),
      ],
      [
        '编码后仍不是敏感段 /k8s%2Fconfigmap%2F1',
        () => viaMain('/k8s%2Fconfigmap%2F1'),
      ],
    ])('对照：%s 仍显示后端原文（非敏感接口暂时保留）', async (_label, run) => {
      await run();
      expectSingleHttpNotice(RAW);
    });

    // incr5 F2（复审 G05）：后端原文只在 400 透出；非敏感接口的 422 仍是请求层通用文案（packages 把 422 归到
    // internalServerError），响应体里的 message / error.message 都不透出
    it.each([
      ['message', BODY],
      ['error.message', ERROR_ONLY_BODY],
    ])(
      'incr5 F2：非敏感接口 422（原文在 %s）只弹通用文案，不透出后端原文',
      async (_label, body) => {
        await requestClient
          .post(
            '/k8s/configmap/1/create',
            {},
            { adapter: adapterOf(422, body) },
          )
          .catch((error) => error);
        expectSingleHttpNotice($t('fallback.http.internalServerError'));
        expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
          'SENSITIVE-RAW',
        );
      },
    );

    // incr5 F3（复审 D08）：路径只 decodeURIComponent 一次
    it('incr5 F3：只解码一次，%25ZZ 解一次得到 %ZZ 不算解码失败，非敏感接口仍显示后端原文', async () => {
      // 解两次会在第二次抛错、按 fail closed 改成通用文案
      await viaMain('/k8s/pod/1/%25ZZ/logs');
      expectSingleHttpNotice(RAW);
    });

    it('incr5 F3：只解码一次，双重编码 %252F 不还原成 /，secret 不是独立段（已知限制，见 pr-notes 8.2）', async () => {
      // 锁住现状而不是认可它：要支持双重编码时，连同这条用例与 pr-notes 8.2 一起改
      await viaMain('/k8s%252Fsecret%252F1%252Flist');
      expectSingleHttpNotice(RAW);
    });

    it('nit：ECONNABORTED、无 response、message 为大写 Timeout…（packages 判不成超时）：按网络异常提示，不落到内部服务器错误', async () => {
      await call(async (config) => {
        throw new AxiosError(
          'Timeout of 1ms exceeded',
          AxiosError.ECONNABORTED,
          config,
          {},
        );
      });
      expectSingleHttpNotice($t('fallback.http.networkError'));
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
      expect(HTTP_TOO_MANY_REQUESTS_MESSAGE).toBe(
        sharedMessages.HTTP_TOO_MANY_REQUESTS_MESSAGE,
      );
    });

    it.each([
      [409, HTTP_CONFLICT_MESSAGE],
      [429, HTTP_TOO_MANY_REQUESTS_MESSAGE],
      [500, $t('fallback.http.internalServerError')],
    ])(
      'HTTP %s：包装后的错误带 http-error key 标记，页面不再弹',
      async (status, text) => {
        const error = await call(
          adapterOf(status, { code: status, data: null, message: 'x' }),
        );
        expect(getRequestLayerNoticeKey(error)).toBe(
          `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
        );
        expect(shouldNotifyPageError(error)).toBe(false);
      },
    );

    it('网络错误（未包装的 AxiosError）同样带标记，页面不再弹', async () => {
      const error = await call(async (config) => {
        throw new AxiosError(
          'Network Error',
          AxiosError.ERR_NETWORK,
          config,
          {},
        );
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
      expect([...keys]).toEqual([
        `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${HTTP_CONFLICT_MESSAGE}`,
      ]);
    });

    it.each([
      [500, (config: any) => reply(config, 500, { code: 500, message: 'x' })],
      [
        '网络错误',
        (config: any) => {
          throw new AxiosError(
            'Network Error',
            AxiosError.ERR_NETWORK,
            config,
            {},
          );
        },
      ],
    ])(
      'baseRequestClient（无拦截器）%s：请求层没弹，也没有标记，页面照常提示',
      async (_label, impl) => {
        const error = await baseRequestClient
          .get('/x', { adapter: async (config) => impl(config) })
          .catch((error_: any) => error_);
        expect(notices.error).not.toHaveBeenCalled();
        expect(getRequestLayerNoticeKey(error)).toBeUndefined();
        expect(shouldNotifyPageError(error)).toBe(true);
      },
    );
  });

  it('超时（timeout，ECONNABORTED）不受影响：仍是请求超时文案', async () => {
    await call(async (config) => {
      throw new AxiosError(
        'timeout of 1ms exceeded',
        AxiosError.ECONNABORTED,
        config,
        {},
      );
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
