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
 * incr4（复审 P3-D / P2-1）：补 YAML 创建（Secret.ts:794）、表单更新（:846）两处写操作，共 6 处；
 * 每处补 400 / 422：恰好一条请求层通用文案，任何提示都不含后端原文（Secret 是敏感接口，400 不透出原文）。
 * incr5 F5：adapter 记下收到的请求；「取消：零提示」先确认请求确实发到了该操作的接口，零提示才有意义。
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
// 默认透传真实 API（走真实 requestClient）；个别用例直接让 API 拒绝「请求层没提示过」的错误
const overrides = vi.hoisted(() => ({ error: null as unknown }));
vi.mock('#/api/core/k8s/k8s_secret', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('#/api/core/k8s/k8s_secret')>();
  const wrap =
    <T extends (...args: any[]) => any>(fn: T) =>
    (...args: Parameters<T>) =>
      overrides.error ? Promise.reject(overrides.error) : fn(...args);
  return {
    ...real,
    createSecretApi: wrap(real.createSecretApi),
    createSecretByYamlApi: wrap(real.createSecretByYamlApi),
    deleteSecretApi: wrap(real.deleteSecretApi),
    updateSecretApi: wrap(real.updateSecretApi),
    updateSecretByYamlApi: wrap(real.updateSecretByYamlApi),
  };
});

type Mode =
  | 'badRequest'
  | 'business'
  | 'canceled'
  | 'network'
  | 'server'
  | 'unprocessable';
let mode: Mode = 'server';
/** adapter 收到的请求（方法 + 路径），每条用例开始前清空（incr5 F5） */
const sent: string[] = [];
// 假值：模拟后端 4xx 回显用户提交的 Secret 数据，不是真实密钥
const RAW_ECHO = 'BACKEND-RAW data.password=fake-password-for-test';
const adapter: AxiosAdapter = async (config) => {
  sent.push(`${String(config.method).toUpperCase()} ${config.url}`);
  if (mode === 'network')
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  if (mode === 'canceled') throw new axios.CanceledError(undefined, config, {});
  const [status, data] =
    mode === 'server'
      ? [502, { code: 502, data: null, message: 'upstream 原文' }]
      : mode === 'badRequest'
        ? [
            400,
            {
              code: 400,
              data: null,
              message: RAW_ECHO,
              error: { message: RAW_ECHO },
            },
          ]
        : mode === 'unprocessable'
          ? [
              422,
              {
                code: 422,
                data: null,
                message: RAW_ECHO,
                error: { message: RAW_ECHO },
              },
            ]
          : [
              200,
              { code: 1, data: null, message: 'Secret 已存在（后端原文）' },
            ];
  const response = {
    config,
    data,
    headers: {},
    status,
    statusText: String(status),
  };
  if (status >= 400)
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response,
    );
  return response;
};
// requestClient 在 axios.create 时合并 defaults，必须在导入页面（进而导入 request.ts）之前设置
axios.defaults.adapter = adapter;
const { useSecretPage } = await import('./Secret');
const { HTTP_ERROR_MESSAGE_KEY_PREFIX } = await import('#/api/request');
const { BUSINESS_ERROR_MESSAGE_KEY_PREFIX, createBusinessError } =
  await import('#/utils/permission/business-error');

const record = { cluster_id: 1, name: 's1', namespace: 'default' } as any;
const validForm = { validate: async () => ({}) } as any;

/** 六处写操作：名称、页面文案、执行入口、应发出的请求（incr5 F5） */
const operations: [
  string,
  string,
  (page: ReturnType<typeof useSecretPage>) => Promise<unknown>,
  string,
][] = [
  [
    'YAML 更新',
    'Secret YAML 更新失败',
    async (page) => {
      // 合并 sec26 后还依赖（incr5 试合并 c9dc762 时核对）：yamlOpenSeq 在 validate 前后不变
      // （没调 showYamlModal / closeYamlModal）；YAML 里没有 data 段 → 占位符 / 写法 / 编码三道检查都放行。
      // isYamlLoading 只在「查看 YAML」加载期间禁用按钮，submitYamlForm 不读它，本用例不依赖。
      page.yamlFormRef.value = validForm;
      page.currentOperationSecret.value = record;
      page.yamlFormModel.value.yaml =
        'apiVersion: v1\nkind: Secret\nmetadata:\n  name: s1\n';
      await page.submitYamlForm();
    },
    'PUT /k8s/secret/1/default/s1/update/yaml',
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
    'POST /k8s/secret/1/create',
  ],
  [
    'YAML 创建',
    'Secret YAML 创建失败',
    async (page) => {
      page.createYamlFormRef.value = validForm;
      page.filterClusterId.value = 1;
      page.createYamlFormModel.value.yaml =
        'apiVersion: v1\nkind: Secret\nmetadata:\n  name: s1\n';
      await page.submitCreateYamlForm();
    },
    'POST /k8s/secret/1/create/yaml',
  ],
  [
    '表单更新',
    'Secret 更新失败',
    async (page) => {
      page.formRef.value = validForm;
      // 直接设当前操作对象，只测提交这一处 catch：sec26 的 openEditModal 会先拉详情，
      // 合并后详情请求也走同一个失败 adapter，弹窗会被关掉、提交走不到。
      // 依赖的内部状态（incr5 F5；每条用例都是新的 useSecretPage()，下面都是初始值）：
      // - fe02b：submitEditForm 只要求 formRef、currentOperationSecret 非空；editFormModel 的
      //   data / string_data / labels / annotations 为空对象 → 参数里都是 undefined；
      // - 合并 sec26 后还依赖：editDataLoading 为 false（没调 openEditModal 就不会置 true）；
      //   editOpenSeq 在 validate 前后不变（validForm.validate 不关弹窗）；editDataRows /
      //   editDataOriginalKeys 为空 → isDataEdited 为 false、data 发 null；没有 <redacted> 占位符。
      //   isYamlLoading 不在表单更新的路径上（submitEditForm 不读它），已在试合并 c9dc762 时核对。
      // 这些守卫改了（例如提交前强制要求打开过编辑），本用例会在「取消」那条的请求断言上先失败。
      page.currentOperationSecret.value = record;
      await page.submitEditForm();
    },
    'PUT /k8s/secret/1/default/s1/update',
  ],
  [
    '删除',
    'Secret 删除失败',
    async (page) => {
      page.deleteSecret(record);
      await confirm.mock.calls.at(-1)![0].onOk();
    },
    'DELETE /k8s/secret/1/default/s1/delete',
  ],
  [
    '批量删除',
    '批量删除失败',
    async (page) => {
      page.selectedRows.value = [record];
      page.batchOperation('删除');
      await confirm.mock.calls.at(-1)![0].onOk();
    },
    'DELETE /k8s/secret/1/default/s1/delete',
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  overrides.error = null;
  sent.length = 0;
});

describe.each(operations)(
  'Secret %s 失败提示（incr3 / SEC-26 遗留 21）',
  (_name, pageText, run, request) => {
    it('HTTP 5xx：只有请求层一条，页面不叠加', async () => {
      mode = 'server';
      await run(useSecretPage());
      const text = $t('fallback.http.internalServerError');
      expect(notices.error).toHaveBeenCalledTimes(1);
      expect(notices.error).toHaveBeenCalledWith({
        content: text,
        key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
      });
    });

    it('网络错误：只有请求层一条，页面不叠加', async () => {
      mode = 'network';
      await run(useSecretPage());
      const text = $t('fallback.http.networkError');
      expect(notices.error).toHaveBeenCalledTimes(1);
      expect(notices.error).toHaveBeenCalledWith({
        content: text,
        key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
      });
    });

    it('业务错误（经请求层弹后端原文）：只一条后端原文', async () => {
      mode = 'business';
      await run(useSecretPage());
      const text = 'Secret 已存在（后端原文）';
      expect(notices.error).toHaveBeenCalledTimes(1);
      expect(notices.error).toHaveBeenCalledWith({
        content: text,
        key: `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${text}`,
      });
    });

    it('请求层没提示过的业务错误：页面照常弹自己的文案一条', async () => {
      overrides.error = createBusinessError(200, '未经请求层的业务错误');
      await run(useSecretPage());
      expect(notices.error).toHaveBeenCalledTimes(1);
      expect(notices.error).toHaveBeenCalledWith(pageText);
    });

    it.each([
      ['badRequest', 400, 'fallback.http.badRequest'],
      ['unprocessable', 422, 'fallback.http.internalServerError'],
    ] as const)(
      'HTTP %s（%s）：恰好一条请求层通用文案，任何提示都不含后端原文',
      async (m, _status, textKey) => {
        mode = m;
        await run(useSecretPage());
        const text = $t(textKey);
        expect(notices.error).toHaveBeenCalledTimes(1);
        expect(notices.error).toHaveBeenCalledWith({
          content: text,
          key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${text}`,
        });
        const everything = JSON.stringify([
          notices.error.mock.calls,
          notices.warning.mock.calls,
          notices.info.mock.calls,
          notices.success.mock.calls,
        ]);
        expect(everything).not.toContain('BACKEND-RAW');
        expect(everything).not.toContain('fake-password-for-test');
      },
    );

    it('取消：请求确实发出后被取消，零提示', async () => {
      mode = 'canceled';
      await run(useSecretPage());
      // incr5 F5：请求到了 adapter（才被取消），不是在页面守卫里提前 return 造成的零提示
      expect(sent).toEqual([request]);
      for (const fn of [
        notices.error,
        notices.warning,
        notices.info,
        notices.success,
      ])
        expect(fn).not.toHaveBeenCalled();
    });
  },
);
