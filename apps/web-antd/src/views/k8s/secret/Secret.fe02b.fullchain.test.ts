import { $t } from '@vben/locales';

import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-02b incr3（并入 SEC-26 遗留第 21 项）：Secret 页 YAML 更新 / 创建 / 删除 / 批量删除的 catch
 * 统一按 shouldNotifyPageError 决定页面是否自己提示（不再只看 isPermissionDeniedError）。
 * 走真实 requestClient 拦截器链（只替换网络层 adapter）：
 * - HTTP 5xx / 网络错误：请求层弹一条，页面不叠加 → 恰好一条；
 * - 业务错误（HTTP 200 + code≠0）经请求层弹后端原文一条，页面不叠加；
 * - 请求层没提示过的业务错误（未经 notifyBusinessError）：页面照常弹自己的文案；
 * - 取消：零提示。
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
    app: { enableRefreshToken: false, locale: 'zh-CN', loginExpiredMode: 'modal' },
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
// 默认透传真实 API（走真实 requestClient）；个别用例直接让 API 拒绝「请求层没提示过」的错误
const overrides = vi.hoisted(() => ({ error: null as unknown }));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => {
  const real = await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>();
  const wrap =
    <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) =>
      overrides.error ? Promise.reject(overrides.error) : fn(...args);
  return {
    ...real,
    createSecretApi: wrap(real.createSecretApi),
    deleteSecretApi: wrap(real.deleteSecretApi),
    updateSecretByYamlApi: wrap(real.updateSecretByYamlApi),
  };
});

type Mode = 'business' | 'canceled' | 'network' | 'server';
let mode: Mode = 'server';
const adapter: AxiosAdapter = async (config) => {
  if (mode === 'network') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  if (mode === 'canceled') throw new axios.CanceledError(undefined, config, {});
  const [status, data] =
    mode === 'server'
      ? [502, { code: 502, data: null, message: 'upstream 原文' }]
      : [200, { code: 1, data: null, message: 'Secret 已存在（后端原文）' }];
  const response = { config, data, headers: {}, status, statusText: String(status) };
  if (status >= 400)
    throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
  return response;
};
// requestClient 在 axios.create 时合并 defaults，必须在导入页面（进而导入 request.ts）之前设置
axios.defaults.adapter = adapter;
const { useSecretPage } = await import('./Secret');
const { HTTP_ERROR_MESSAGE_KEY_PREFIX } = await import('#/api/request');
const { BUSINESS_ERROR_MESSAGE_KEY_PREFIX, createBusinessError } = await import(
  '#/utils/permission/business-error'
);

const record = { cluster_id: 1, name: 's1', namespace: 'default' } as any;
const validForm = { validate: async () => ({}) } as any;

/** 四处写操作：返回执行入口与页面文案 */
const operations: [string, string, (page: ReturnType<typeof useSecretPage>) => Promise<unknown>][] = [
  [
    'YAML 更新',
    'Secret YAML 更新失败',
    async (page) => {
      page.yamlFormRef.value = validForm;
      page.currentOperationSecret.value = record;
      page.yamlFormModel.value.yaml = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: s1\n';
      await page.submitYamlForm();
    },
  ],
  [
    '表单创建',
    'Secret 创建失败',
    async (page) => {
      page.formRef.value = validForm;
      page.filterClusterId.value = 1;
      page.createFormModel.value.name = 's1';
      page.createFormModel.value.namespace = 'default';
      await page.submitCreateForm();
    },
  ],
  [
    '删除',
    'Secret 删除失败',
    async (page) => {
      page.deleteSecret(record);
      await confirm.mock.calls.at(-1)![0].onOk();
    },
  ],
  [
    '批量删除',
    '批量删除失败',
    async (page) => {
      page.selectedRows.value = [record];
      page.batchOperation('删除');
      await confirm.mock.calls.at(-1)![0].onOk();
    },
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  overrides.error = null;
});

describe.each(operations)('Secret %s 失败提示（incr3 / SEC-26 遗留 21）', (_name, pageText, run) => {
  it('HTTP 5xx：只有请求层一条，页面不叠加', async () => {
    mode = 'server';
    await run(useSecretPage());
    const text = $t('fallback.http.internalServerError');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({ content: text, key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}` });
  });

  it('网络错误：只有请求层一条，页面不叠加', async () => {
    mode = 'network';
    await run(useSecretPage());
    const text = $t('fallback.http.networkError');
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({ content: text, key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}` });
  });

  it('业务错误（经请求层弹后端原文）：只一条后端原文', async () => {
    mode = 'business';
    await run(useSecretPage());
    const text = 'Secret 已存在（后端原文）';
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({ content: text, key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${text}` });
  });

  it('请求层没提示过的业务错误：页面照常弹自己的文案一条', async () => {
    overrides.error = createBusinessError(200, '未经请求层的业务错误');
    await run(useSecretPage());
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith(pageText);
  });

  it('取消：零提示', async () => {
    mode = 'canceled';
    await run(useSecretPage());
    expect(notices.error).not.toHaveBeenCalled();
  });
});
