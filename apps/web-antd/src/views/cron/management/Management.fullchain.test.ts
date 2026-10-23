import type { FormInstance } from 'ant-design-vue';

import { $t } from '@vben/locales';

import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUSINESS_ERROR_MESSAGE_KEY_PREFIX } from '#/utils/permission/business-error';

/**
 * SEC-03A × Commit 0：cron.allow_local_exec=false 时后端返回 HTTP 200 + code 1 + 原文
 * （后端 sched/rel01-cron-ddl internal/cron/api/local_exec_contract_test.go），
 * 走真实 requestClient 拦截器链（只替换网络层 adapter），页面用 getBackendErrorMessage 写法，
 * 创建 / 更新 / 立即执行各自恰好弹一条后端原文。
 */
const notices = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
const confirm = vi.hoisted(() => vi.fn());
vi.mock('ant-design-vue', () => ({ message: notices, Modal: { confirm } }));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      enableRefreshToken: false,
      locale: 'zh-CN',
      loginExpiredMode: 'modal',
    },
  },
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: 'token',
    isAccessChecked: true,
    setAccessToken: () => {},
    setLoginExpired: () => {},
  }),
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 1, logout: vi.fn() }),
}));
vi.mock('#/api/core', () => ({ refreshTokenApi: vi.fn() }));

const DISABLED_MESSAGE =
  '本地命令/脚本任务已停用（cron.allow_local_exec=false），请改用 HTTP 或 SSH 任务';

type Route = (config: any) => { data: unknown; status: number };
let route: Route = () => ({ status: 200, data: { code: 0, data: null } });
const requests: string[] = [];
// 写请求在传输层失败（没有 response）：网络错误 / 超时
let transportError: ((config: any) => AxiosError) | null = null;
const adapter: AxiosAdapter = async (config) => {
  requests.push(`${config.method?.toUpperCase()} ${config.url}`);
  if (transportError && config.method !== 'get') throw transportError(config);
  const { status, data } = route(config);
  const response = {
    config,
    data,
    headers: {},
    status,
    statusText: String(status),
  };
  // 与真实 adapter 一致：非 2xx 以 AxiosError（带 response）拒绝
  if (status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response,
    );
  }
  return response;
};
// requestClient 在 axios.create 时合并 defaults，必须在导入页面（进而导入 request.ts）之前设置
axios.defaults.adapter = adapter;
const { isNotifiedByRequestLayer, useCronJobPage } =
  await import('./Management');
const { HTTP_ERROR_MESSAGE_KEY_PREFIX } = await import('#/api/request');

const job = (id: number, job_type: number) =>
  ({
    id,
    name: `job-${id}`,
    max_retry: 0,
    status: 1,
    job_type,
    schedule: '@every 1h',
  }) as any;

function passValidation(page: ReturnType<typeof useCronJobPage>) {
  page.formRef.value = {
    validate: () => Promise.resolve({}),
  } as unknown as FormInstance;
}

function rejectWrites(text = DISABLED_MESSAGE) {
  route = (config) => {
    if (config.method === 'get') {
      const url: string = config.url ?? '';
      if (/\/cron\/job\/\d+\/detail/.test(url) || /\/cron\/job\/\d+$/.test(url))
        return { status: 200, data: { code: 0, data: job(9, 3) } };
      return {
        status: 200,
        data: {
          code: 0,
          data: { items: [], total: 0, allow_local_exec: false },
        },
      };
    }
    return { status: 200, data: { code: 1, data: null, message: text } };
  };
}

function failWritesWithHttp(status: number, text: string) {
  rejectWrites();
  const base = route;
  route = (config) =>
    config.method === 'get'
      ? base(config)
      : { status, data: { code: status, data: null, message: text } };
}

function expectSingleBackendNotice(text = DISABLED_MESSAGE) {
  expect(notices.error).toHaveBeenCalledTimes(1);
  expect(notices.error).toHaveBeenCalledWith({
    content: text,
    key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${text}`,
  });
  expect(notices.success).not.toHaveBeenCalled();
}

describe('cron 开关关闭 × 业务错误只提示一次（真实请求链路）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    rejectWrites();
  });

  it('开关关闭：创建命令行任务返回 code 1，全程只弹一条后端原文', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    page.createFormModel.value.job_type = 2;
    passValidation(page);
    await page.submitCreateForm();
    expect(requests).toContain('POST /cron/job/create');
    expectSingleBackendNotice();
    // 失败时创建弹窗保持打开
    expect(page.isCreateModalVisible.value).toBe(true);
  });

  it('开关关闭：更新任务返回 code 1，全程只弹一条后端原文', async () => {
    const page = useCronJobPage();
    await page.openEditModal(job(9, 3));
    expect(page.isEditModalVisible.value).toBe(true);
    page.editFormModel.value.job_type = 4;
    passValidation(page);
    await page.submitEditForm();
    expect(requests).toContain('PUT /cron/job/9/update');
    expectSingleBackendNotice();
  });

  it('开关关闭：立即执行返回 code 1，全程只弹一条后端原文', async () => {
    const page = useCronJobPage();
    page.triggerJob(job(10, 3));
    await confirm.mock.calls[0]?.[0].onOk();
    expect(requests.some((r) => r.startsWith('POST /cron/job/10/'))).toBe(true);
    expectSingleBackendNotice();
  });

  it('后端 message 为空：回退通用提示一条，不静默', async () => {
    rejectWrites('');
    const page = useCronJobPage();
    page.triggerJob(job(11, 3));
    await confirm.mock.calls[0]?.[0].onOk();
    expect(notices.error).toHaveBeenCalledTimes(1);
    // 回退文案来自请求层通用错误拦截器（packages/effects/request 的 HTTP 500 默认文案），
    // 不是空串，也不是页面自己的「定时任务触发失败」
    const fallback = $t('fallback.http.internalServerError');
    expect(fallback).not.toBe('');
    expect(notices.error).toHaveBeenCalledWith({
      content: fallback,
      key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${fallback}`,
    });
    expect(notices.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ content: '定时任务触发失败' }),
    );
    expect(notices.success).not.toHaveBeenCalled();
  });
});

describe('HTTP 错误（带 response）只提示一次、不展示响应体原文（真实请求链路）', () => {
  const BODY_MESSAGE = 'dial tcp 10.0.0.8:3306: connect: connection refused';
  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    failWritesWithHttp(500, BODY_MESSAGE);
  });

  const expectSingleHttpNotice = () => {
    const fallback = $t('fallback.http.internalServerError');
    expect(fallback).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: fallback,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${fallback}`,
    });
    // 页面不再叠加响应体原文或自己的失败文案
    expect(notices.error).not.toHaveBeenCalledWith(BODY_MESSAGE);
    expect(JSON.stringify(notices.error.mock.calls)).not.toContain(
      BODY_MESSAGE,
    );
    expect(notices.success).not.toHaveBeenCalled();
  };

  it('创建返回 HTTP 500：只弹请求层通用文案一条', async () => {
    const page = useCronJobPage();
    page.openCreateModal();
    page.createFormModel.value.job_type = 3;
    passValidation(page);
    await page.submitCreateForm();
    expect(requests).toContain('POST /cron/job/create');
    expectSingleHttpNotice();
    expect(page.isCreateModalVisible.value).toBe(true);
  });

  it('更新返回 HTTP 500：只弹请求层通用文案一条', async () => {
    const page = useCronJobPage();
    await page.openEditModal(job(9, 3));
    passValidation(page);
    await page.submitEditForm();
    expect(requests).toContain('PUT /cron/job/9/update');
    expectSingleHttpNotice();
  });

  it('立即执行返回 HTTP 500：只弹请求层通用文案一条', async () => {
    const page = useCronJobPage();
    page.triggerJob(job(10, 3));
    await confirm.mock.calls[0]?.[0].onOk();
    expect(requests.some((r) => r.startsWith('POST /cron/job/10/'))).toBe(true);
    expectSingleHttpNotice();
  });
});

/**
 * 复审 v4 P3-3：发出了请求但没有响应的 axios 错误（网络错误 / 超时），请求层通用错误拦截器
 * （packages/effects/request preset-interceptors.ts errorMessageResponseInterceptor）已按固定 key
 * 弹过一条，页面不再叠加「定时任务创建失败」等提示
 */
describe('网络错误 / 超时（有 request 无 response）只提示一次（真实请求链路）', () => {
  // 与浏览器 xhr adapter 一致：带 request、不带 response
  const networkError = (config: any) =>
    new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  const timeoutError = (config: any) =>
    new AxiosError(
      `timeout of ${config.timeout ?? 0}ms exceeded`,
      AxiosError.ECONNABORTED,
      config,
      {},
    );

  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    rejectWrites();
  });
  afterEach(() => {
    transportError = null;
  });

  const expectSingleTransportNotice = (key: string) => {
    const text = $t(key);
    expect(text).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expect(notices.success).not.toHaveBeenCalled();
  };

  describe.each([
    ['网络错误', networkError, 'fallback.http.networkError'],
    ['超时', timeoutError, 'fallback.http.requestTimeout'],
  ])('%s', (_label, makeError, key) => {
    beforeEach(() => {
      transportError = makeError;
    });

    it('创建：只弹请求层一条', async () => {
      const page = useCronJobPage();
      page.openCreateModal();
      page.createFormModel.value.job_type = 3;
      passValidation(page);
      await page.submitCreateForm();
      expect(requests).toContain('POST /cron/job/create');
      expectSingleTransportNotice(key);
      expect(page.isCreateModalVisible.value).toBe(true);
    });

    it('更新：只弹请求层一条', async () => {
      const page = useCronJobPage();
      await page.openEditModal(job(9, 3));
      passValidation(page);
      await page.submitEditForm();
      expect(requests).toContain('PUT /cron/job/9/update');
      expectSingleTransportNotice(key);
    });

    it('立即执行：只弹请求层一条', async () => {
      const page = useCronJobPage();
      page.triggerJob(job(10, 3));
      await confirm.mock.calls[0]?.[0].onOk();
      expect(requests.some((r) => r.startsWith('POST /cron/job/10/'))).toBe(
        true,
      );
      expectSingleTransportNotice(key);
    });
  });

  it('判定边界：取消的请求、没有发出请求的错误不算已提示', () => {
    expect(
      isNotifiedByRequestLayer(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      ),
    ).toBe(true);
    expect(
      isNotifiedByRequestLayer(
        new axios.CanceledError(undefined, {} as any, {}),
      ),
    ).toBe(false);
    expect(
      isNotifiedByRequestLayer(
        new AxiosError('bad option', AxiosError.ERR_BAD_OPTION),
      ),
    ).toBe(false);
    expect(isNotifiedByRequestLayer(new Error('Network Error'))).toBe(false);
  });
});
