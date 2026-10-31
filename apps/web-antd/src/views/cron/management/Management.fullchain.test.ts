import type { FormInstance } from 'ant-design-vue';

import { $t } from '@vben/locales';

import axios, { type AxiosAdapter, AxiosError } from 'axios';
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
// 登录代际可变：用例里在响应返回前切换账户，触发真实链路上的 RequestOwnerChangedError
const owner = vi.hoisted(() => ({ generation: 1 }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({
    getAuthGeneration: () => owner.generation,
    logout: vi.fn(),
  }),
}));
vi.mock('#/api/core', () => ({ refreshTokenApi: vi.fn() }));

const DISABLED_MESSAGE =
  '本地命令/脚本任务已停用（cron.allow_local_exec=false），请改用 HTTP 或 SSH 任务';

type Route = (config: any) => { data: unknown; status: number };
let route: Route = () => ({ status: 200, data: { code: 0, data: null } });
const requests: string[] = [];
// 写请求在传输层失败（没有 response）：网络错误 / 超时
let transportError: ((config: any) => AxiosError) | null = null;
// 列表加载（GET /cron/job/list）在传输层失败
let listTransportError: ((config: any) => AxiosError) | null = null;
// SSH 资源列表（GET /tree/local/list）在传输层失败
let sshTransportError: ((config: any) => AxiosError) | null = null;
// FE-02b：任意请求在传输层失败（按 config 决定，返回 null 表示不拦）
let anyTransportError: ((config: any) => Error | null) | null = null;
const adapter: AxiosAdapter = async (config) => {
  requests.push(`${config.method?.toUpperCase()} ${config.url}`);
  const injected = anyTransportError?.(config);
  if (injected) throw injected;
  if (transportError && config.method !== 'get') throw transportError(config);
  if (listTransportError && config.url === '/cron/job/list')
    throw listTransportError(config);
  if (sshTransportError && config.url === '/tree/local/list')
    throw sshTransportError(config);
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
const { looksNotifiedByRequestLayer, useCronJobPage } =
  await import('./Management');
const { HTTP_ERROR_MESSAGE_KEY_PREFIX, requestClient } =
  await import('#/api/request');

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

describe('hTTP 错误（带 response）只提示一次、不展示响应体原文（真实请求链路）', () => {
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

  it('判定边界：取消的请求、没有发出请求的错误、没经过 requestClient 的错误不算已提示', async () => {
    // 经过 requestClient 通用错误拦截器的网络错误：已提示
    const viaClient = await requestClient
      .get('/boundary', {
        adapter: async (config) => {
          throw new AxiosError(
            'Network Error',
            AxiosError.ERR_NETWORK,
            config,
            {},
          );
        },
      })
      .catch((error: unknown) => error);
    expect(looksNotifiedByRequestLayer(viaClient)).toBe(true);
    // incr3 P3-3：同样形状但没经过 requestClient（baseRequestClient / 直接 axios）不算
    expect(
      looksNotifiedByRequestLayer(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
      ),
    ).toBe(false);
    expect(
      looksNotifiedByRequestLayer(
        new axios.CanceledError(undefined, {} as any, {}),
      ),
    ).toBe(false);
    expect(
      looksNotifiedByRequestLayer(
        new AxiosError('bad option', AxiosError.ERR_BAD_OPTION),
      ),
    ).toBe(false);
    expect(looksNotifiedByRequestLayer(new Error('Network Error'))).toBe(false);
  });
});

/**
 * 列表加载双提示：网络错误 / 超时、HTTP 4xx/5xx 由请求层按固定 key 弹过一条，
 * fetchCronJobs 只保留页面错误状态（shouldNotifyPageError），不再叠加「网络连接失败」等提示；
 * 业务错误（HTTP 200 + code≠0）处理不变
 */
describe('列表加载失败只提示一次（真实请求链路）', () => {
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
    listTransportError = null;
  });

  const expectSingleRequestLayerNotice = (key: string) => {
    const text = $t(key);
    expect(text).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expect(notices.warning).not.toHaveBeenCalled();
    expect(notices.success).not.toHaveBeenCalled();
  };

  it.each([
    ['网络错误', networkError, 'fallback.http.networkError'],
    ['超时', timeoutError, 'fallback.http.requestTimeout'],
  ])(
    '列表加载遇到%s：只弹请求层一条，页面保留错误状态',
    async (_label, makeError, key) => {
      listTransportError = makeError;
      const page = useCronJobPage();
      await page.fetchCronJobs();
      expect(requests).toContain('GET /cron/job/list');
      expectSingleRequestLayerNotice(key);
      expect(notices.error).not.toHaveBeenCalledWith(
        '网络连接失败，请检查网络后重试',
      );
      expect(page.error.value).toBe('网络连接失败，请检查网络后重试');
      expect(page.cronJobs.value).toEqual([]);
      expect(page.loading.value).toBe(false);
    },
  );

  // incr3 P2-2：400 有后端 message 时请求层弹该 message（见下一条用例），这里 400 用空 message 走通用文案
  it.each([
    [
      500,
      'x',
      'fallback.http.internalServerError',
      '服务器内部错误，请稍后重试',
    ],
    [400, '', 'fallback.http.badRequest', '请求参数错误，请检查筛选条件'],
  ])(
    '列表加载返回 HTTP %s：只弹请求层一条，页面保留错误状态',
    async (status, backendMessage, key, pageError) => {
      route = () => ({
        status,
        data: { code: status, data: null, message: backendMessage },
      });
      const page = useCronJobPage();
      await page.fetchCronJobs();
      expectSingleRequestLayerNotice(key);
      expect(page.error.value).toBe(pageError);
    },
  );

  it('incr3 P2-2：列表加载返回 HTTP 400 且带后端 message：请求层只弹该 message 一条，页面保留错误状态', async () => {
    const text = 'page_size 不能超过 100';
    route = () => ({
      status: 400,
      data: { code: 400, data: null, message: text },
    });
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expect(notices.warning).not.toHaveBeenCalled();
    expect(page.error.value).toBe('请求参数错误，请检查筛选条件');
  });

  it('列表加载返回 HTTP 401：页面不再叠加「登录已过期」警告', async () => {
    route = () => ({
      status: 401,
      data: { code: 401, data: null, message: 'x' },
    });
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expectSingleRequestLayerNotice('fallback.http.unauthorized');
    expect(page.error.value).toBe('登录已过期，请重新登录');
  });

  it('业务错误（HTTP 200 + code≠0）处理不变：只弹后端原文一条，页面保留错误状态', async () => {
    const text = '列表查询失败：参数非法';
    route = () => ({
      status: 200,
      data: { code: 1, data: null, message: text },
    });
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expectSingleBackendNotice(text);
    expect(page.error.value).toBe('获取定时任务列表失败，请刷新重试');
  });
});

/**
 * 列表加载 incr5：其他 4xx（404 / 409 / 429）、ETIMEDOUT 只由请求层提示一次；
 * 取消的请求、账户切换（RequestOwnerChangedError）页面静默，零条提示
 */
describe('列表加载：其他 4xx、ETIMEDOUT 只提示一次，取消类静默（真实请求链路）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    owner.generation = 1;
    rejectWrites();
  });
  afterEach(() => {
    listTransportError = null;
    owner.generation = 1;
  });

  const expectSingleRequestLayerNotice = (key: string) => {
    const text = $t(key);
    expect(text).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expect(notices.warning).not.toHaveBeenCalled();
    expect(notices.success).not.toHaveBeenCalled();
  };
  const expectSilent = () => {
    expect(notices.error).not.toHaveBeenCalled();
    expect(notices.warning).not.toHaveBeenCalled();
    expect(notices.info).not.toHaveBeenCalled();
    expect(notices.success).not.toHaveBeenCalled();
  };

  // FE-02b：409 / 429 在应用层改写为专门文案（api/request.ts）
  it.each([
    [404, 'fallback.http.notFound'],
    [409, '数据已变化，请刷新后重试'],
    [429, '请求过于频繁，请稍后重试'],
  ])(
    '列表加载返回 HTTP %s：只弹请求层一条，页面保留错误状态',
    async (status, key) => {
      route = () => ({
        status,
        data: { code: status, data: null, message: 'x' },
      });
      const page = useCronJobPage();
      await page.fetchCronJobs();
      expect(requests).toContain('GET /cron/job/list');
      expectSingleRequestLayerNotice(key);
      expect(notices.error).not.toHaveBeenCalledWith(
        '获取定时任务列表失败，请刷新重试',
      );
      expect(page.error.value).toBe('获取定时任务列表失败，请刷新重试');
      expect(page.loading.value).toBe(false);
    },
  );

  it('列表加载超时（ETIMEDOUT）：只弹请求层一条，页面错误状态为网络错误', async () => {
    listTransportError = (config) =>
      new AxiosError(
        `timeout of ${config.timeout ?? 0}ms exceeded`,
        AxiosError.ETIMEDOUT,
        config,
        {},
      );
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expect(requests).toContain('GET /cron/job/list');
    expectSingleRequestLayerNotice('fallback.http.requestTimeout');
    expect(page.error.value).toBe('网络连接失败，请检查网络后重试');
    expect(page.cronJobs.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });

  it('列表请求被取消（CanceledError）：零条提示，不写错误状态', async () => {
    listTransportError = (config) =>
      new axios.CanceledError(undefined, config, {});
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expect(requests).toContain('GET /cron/job/list');
    expectSilent();
    expect(page.error.value).toBeNull();
    expect(page.cronJobs.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });

  it('响应返回前切换账户（RequestOwnerChangedError）：零条提示，不写错误状态', async () => {
    route = () => {
      // 请求发出后账户切换：响应拦截器 ownerScope.response 抛 RequestOwnerChangedError
      owner.generation = 2;
      return {
        status: 200,
        data: { code: 0, data: { items: [job(1, 3)], total: 1 } },
      };
    };
    const page = useCronJobPage();
    await page.fetchCronJobs();
    expect(requests).toContain('GET /cron/job/list');
    expectSilent();
    expect(page.error.value).toBeNull();
    expect(page.cronJobs.value).toEqual([]);
    expect(page.loading.value).toBe(false);
  });
});

/**
 * SSH 资源列表（fetchSshResources）与任务列表同一口径：5xx、网络错误只由请求层提示一次，
 * 业务错误只弹后端原文一条
 */
describe('sSH 资源列表加载失败只提示一次（真实请求链路）', () => {
  const SSH_PAGE_TEXT = '获取SSH资源列表失败，请稍后重试';
  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    rejectWrites();
  });
  afterEach(() => {
    sshTransportError = null;
  });

  const expectSingleRequestLayerNotice = (key: string) => {
    const text = $t(key);
    expect(text).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expect(notices.error).not.toHaveBeenCalledWith(SSH_PAGE_TEXT);
    expect(notices.warning).not.toHaveBeenCalled();
  };

  it('sSH 资源列表返回 HTTP 500：只弹请求层一条', async () => {
    route = () => ({
      status: 500,
      data: { code: 500, data: null, message: 'x' },
    });
    const page = useCronJobPage();
    await page.fetchSshResources();
    expect(requests).toContain('GET /tree/local/list');
    expectSingleRequestLayerNotice('fallback.http.internalServerError');
    expect(page.sshResources.value).toEqual([]);
    expect(page.sshResourcesLoading.value).toBe(false);
  });

  it('sSH 资源列表网络错误：只弹请求层一条', async () => {
    sshTransportError = (config) =>
      new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
    const page = useCronJobPage();
    await page.fetchSshResources();
    expect(requests).toContain('GET /tree/local/list');
    expectSingleRequestLayerNotice('fallback.http.networkError');
    expect(page.sshResources.value).toEqual([]);
  });

  it('sSH 资源列表业务错误（HTTP 200 + code≠0）：只弹后端原文一条', async () => {
    const text = 'SSH 资源查询失败：树节点不存在';
    route = () => ({
      status: 200,
      data: { code: 1, data: null, message: text },
    });
    const page = useCronJobPage();
    await page.fetchSshResources();
    expect(requests).toContain('GET /tree/local/list');
    expectSingleBackendNotice(text);
    expect(notices.warning).not.toHaveBeenCalled();
    expect(page.sshResources.value).toEqual([]);
  });
});

/**
 * FE-02b：Management.ts 其余 catch（详情、编辑取详情、删除、启停、校验、创建 / 更新 / 立即执行）
 * 与列表同一口径：取消类静默；请求层已提示（HTTP 错误、网络错误 / 超时含 ETIMEDOUT、业务错误）
 * 页面不再叠加；业务错误只弹后端原文一条
 */
describe('fE-02b：其余操作 catch 统一口径（真实请求链路）', () => {
  const PAGE_TEXTS = [
    '获取任务详情失败',
    '定时任务删除失败',
    '定时任务启用失败',
    '定时任务禁用失败',
    '调度表达式验证失败',
    '定时任务创建失败',
    '定时任务更新失败',
    '定时任务触发失败',
  ];
  const DETAIL = /\/cron\/job\/\d+\/detail$/;

  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    owner.generation = 1;
    rejectWrites();
  });
  afterEach(() => {
    anyTransportError = null;
    owner.generation = 1;
  });

  const expectNoPageText = () => {
    const calls = JSON.stringify(notices.error.mock.calls);
    for (const text of PAGE_TEXTS) expect(calls).not.toContain(text);
  };
  const expectSingleRequestLayerNotice = (key: string) => {
    const text = $t(key);
    expect(text).not.toBe('');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: text,
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
    });
    expectNoPageText();
    expect(notices.success).not.toHaveBeenCalled();
  };
  const expectSilent = () => {
    expect(notices.error).not.toHaveBeenCalled();
    expect(notices.warning).not.toHaveBeenCalled();
    expect(notices.info).not.toHaveBeenCalled();
    expect(notices.success).not.toHaveBeenCalled();
  };

  /** 各操作：发起 → 等结束；match 为要让它失败的请求 */
  const ops: Array<
    [string, RegExp, (page: ReturnType<typeof useCronJobPage>) => Promise<void>]
  > = [
    ['查看详情', DETAIL, (page) => page.showJobDetail(job(9, 3))],
    ['编辑取详情', DETAIL, (page) => page.openEditModal(job(9, 3))],
    [
      '删除',
      /\/cron\/job\/9\/delete$/,
      async (page) => {
        page.deleteJob(job(9, 3));
        await confirm.mock.calls[0]?.[0].onOk();
      },
    ],
    ['启用', /\/cron\/job\/9\/enable$/, (page) => page.enableJob(job(9, 3))],
    ['禁用', /\/cron\/job\/9\/disable$/, (page) => page.disableJob(job(9, 3))],
    [
      '校验调度表达式',
      /\/cron\/validate-schedule$/,
      async (page) => {
        page.createFormModel.value.schedule = '@every 1h';
        await page.validateScheduleExpression();
      },
    ],
    [
      '创建',
      /\/cron\/job\/create$/,
      async (page) => {
        page.openCreateModal();
        page.createFormModel.value.job_type = 3;
        passValidation(page);
        await page.submitCreateForm();
      },
    ],
    [
      '更新',
      /\/cron\/job\/9\/update$/,
      async (page) => {
        await page.openEditModal(job(9, 3));
        passValidation(page);
        await page.submitEditForm();
      },
    ],
    [
      '立即执行',
      /\/cron\/job\/9\/trigger$/,
      async (page) => {
        page.triggerJob(job(9, 3));
        await confirm.mock.calls[0]?.[0].onOk();
      },
    ],
  ];

  describe.each(ops)('%s', (_label, match, run) => {
    const failOn = (make: (config: any) => Error) => {
      anyTransportError = (config) =>
        match.test(config.url ?? '') ? make(config) : null;
    };

    it('hTTP 500：只弹请求层一条，页面不叠加', async () => {
      const base = route;
      route = (config) =>
        match.test(config.url ?? '')
          ? { status: 500, data: { code: 500, data: null, message: 'x' } }
          : base(config);
      const page = useCronJobPage();
      await run(page);
      expect(requests.some((r) => match.test(r))).toBe(true);
      expectSingleRequestLayerNotice('fallback.http.internalServerError');
    });

    it('网络错误：只弹请求层一条', async () => {
      failOn(
        (config) =>
          new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}),
      );
      const page = useCronJobPage();
      await run(page);
      expectSingleRequestLayerNotice('fallback.http.networkError');
    });

    it('超时（ETIMEDOUT）：只弹请求层一条', async () => {
      failOn(
        (config) =>
          new AxiosError(
            `timeout of ${config.timeout ?? 0}ms exceeded`,
            AxiosError.ETIMEDOUT,
            config,
            {},
          ),
      );
      const page = useCronJobPage();
      await run(page);
      expectSingleRequestLayerNotice('fallback.http.requestTimeout');
    });

    it('请求被取消（CanceledError）：零条提示', async () => {
      failOn((config) => new axios.CanceledError(undefined, config, {}));
      const page = useCronJobPage();
      await run(page);
      expect(requests.some((r) => match.test(r))).toBe(true);
      expectSilent();
    });

    it('响应返回前切换账户（RequestOwnerChangedError）：零条提示', async () => {
      const base = route;
      route = (config) => {
        if (match.test(config.url ?? '')) owner.generation = 2;
        return base(config);
      };
      const page = useCronJobPage();
      await run(page);
      expect(requests.some((r) => match.test(r))).toBe(true);
      expectSilent();
    });

    it('业务错误（HTTP 200 + code≠0）：只弹后端原文一条', async () => {
      const text = '后端拒绝：任务状态已变化';
      const base = route;
      route = (config) =>
        match.test(config.url ?? '')
          ? { status: 200, data: { code: 1, data: null, message: text } }
          : base(config);
      const page = useCronJobPage();
      await run(page);
      expectSingleBackendNotice(text);
      expectNoPageText();
    });
  });
});
