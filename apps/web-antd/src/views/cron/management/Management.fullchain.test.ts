import type { FormInstance } from 'ant-design-vue';

import axios, { type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const adapter: AxiosAdapter = async (config) => {
  requests.push(`${config.method?.toUpperCase()} ${config.url}`);
  const { status, data } = route(config);
  return { config, data, headers: {}, status, statusText: String(status) };
};
// requestClient 在 axios.create 时合并 defaults，必须在导入页面（进而导入 request.ts）之前设置
axios.defaults.adapter = adapter;
const { useCronJobPage } = await import('./Management');

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
    expect(notices.success).not.toHaveBeenCalled();
  });
});
