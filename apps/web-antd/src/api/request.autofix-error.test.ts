import { $t } from '@vben/locales';

import { AxiosError, type AxiosAdapter } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SEC-25/26 规则 3：autofix 错误走真实 requestClientAIOps 拦截器链 + 页面 reportAutoFixError，
 * 每个错误界面上只剩一条提示（同一个 key），文案按 HTTP 状态映射。
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
  AUTOFIX_ERROR_TEXT,
  reportAutoFixError,
} from '#/views/autofix/autofix-errors';
import {
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';
import { BUSINESS_ERROR_MESSAGE_KEY_PREFIX } from '#/utils/permission/business-error';

import { resetHttpErrorNoticeTracking } from './http-error-notice';
import {
  HTTP_ERROR_MESSAGE_KEY_PREFIX,
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

function adapterOf(status: number, data: unknown): AxiosAdapter {
  return async (config) => reply(config, status, data);
}

/** 模拟页面：调 confirm，catch 里交给 reportAutoFixError */
async function confirmWith(adapter: AxiosAdapter) {
  try {
    await requestClientAIOps.post(
      '/autofix/workflow/confirm',
      { plan_id: 'fake-plan', approved_action_ids: ['fake-action'] },
      { adapter },
    );
  } catch (error) {
    return reportAutoFixError(error);
  }
  throw new Error('应当失败');
}

/** ant message 同 key 只保留最后一条：返回界面上最终可见的提示 */
function visibleNotices() {
  const byKey = new Map<string, string>();
  for (const [arg] of notices.error.mock.calls) {
    if (typeof arg === 'object' && arg) byKey.set(arg.key, arg.content);
    else byKey.set(`no-key:${String(arg)}`, String(arg));
  }
  return byKey;
}

/** 按调用顺序列出 message.error 弹出的文案（同 key 替换也算一次），用于确认「弹的是哪条」 */
function noticeContents() {
  return notices.error.mock.calls.map(([arg]) =>
    typeof arg === 'object' && arg ? arg.content : String(arg),
  );
}

/** 所有提示通道（error / warning / info / success）的全部调用参数，用于断言不含后端原文 */
function allNoticeCalls() {
  return [
    notices.error,
    notices.warning,
    notices.info,
    notices.success,
  ].flatMap((fn) => fn.mock.calls);
}

const ERROR_BODY = (code: string) => ({
  code: 1,
  message: `后端原文 ${code}`,
  error_code: code,
});

describe('autofix 错误提示 · 请求链路集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetHttpErrorNoticeTracking();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
  });

  it.each([
    [409, AUTOFIX_ERROR_TEXT.conflict],
    [404, AUTOFIX_ERROR_TEXT.expired],
    [400, AUTOFIX_ERROR_TEXT.invalid],
    [422, AUTOFIX_ERROR_TEXT.invalid],
    [502, AUTOFIX_ERROR_TEXT.unavailable],
    [503, AUTOFIX_ERROR_TEXT.unavailable],
    [504, AUTOFIX_ERROR_TEXT.unavailable],
  ])(
    '%s：界面只剩一条，文案为映射后的「%s」，key 沿用请求层 http-error',
    async (status, text) => {
      const inline = await confirmWith(
        adapterOf(status, ERROR_BODY('WORKFLOW_APPROVAL_ERROR')),
      );
      expect(inline).toBe(text);
      const visible = visibleNotices();
      expect(visible.size).toBe(1);
      const [key, content] = [...visible][0]!;
      expect(key.startsWith(HTTP_ERROR_MESSAGE_KEY_PREFIX)).toBe(true);
      expect(content).toBe(text);
    },
  );

  // incr8 后续 3：400 / 422 的后端原文（含 data.message、data.error.message）不出现在任何一次提示调用里
  // （不只看最终可见的那条：请求层先弹后端原文、页面再替换掉，也算透出）
  it.each([400, 422])(
    '%s：所有提示调用（error / warning / info / success）都不含后端原文',
    async (status) => {
      const inline = await confirmWith(
        adapterOf(status, {
          code: 1,
          message: '后端原文 fake-top-level-detail',
          error: { message: '后端原文 fake-nested-detail' },
          error_code: 'WORKFLOW_APPROVAL_ERROR',
        }),
      );
      expect(inline).toBe(AUTOFIX_ERROR_TEXT.invalid);
      expect(allNoticeCalls().length).toBeGreaterThan(0);
      const everything = JSON.stringify(allNoticeCalls());
      expect(everything).not.toContain('后端原文');
      expect(everything).not.toContain('fake-top-level-detail');
      expect(everything).not.toContain('fake-nested-detail');
      expect(everything).not.toContain('WORKFLOW_APPROVAL_ERROR');
      expect(noticeContents().at(-1)).toBe(AUTOFIX_ERROR_TEXT.invalid);
    },
  );

  it('500：只有请求层的通用错误一条，页面不追加', async () => {
    const inline = await confirmWith(
      adapterOf(500, ERROR_BODY('AUTOFIX_INTERNAL_ERROR')),
    );
    expect(inline).toBe(AUTOFIX_ERROR_TEXT.generic);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith({
      content: $t('fallback.http.internalServerError'),
      key: `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${$t('fallback.http.internalServerError')}`,
    });
    expect(noticeContents()).toEqual([$t('fallback.http.internalServerError')]);
  });

  it('403：只有权限提示一条', async () => {
    await confirmWith(adapterOf(403, ERROR_BODY('WORKFLOW_APPROVAL_ERROR')));
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]![0].key).toBe(
      PERMISSION_DENIED_MESSAGE_KEY,
    );
    expect(noticeContents()).toEqual([PERMISSION_DENIED_MESSAGE]);
  });

  it('HTTP 200 + code≠0：只有业务错误提示一条', async () => {
    const inline = await confirmWith(
      adapterOf(200, { code: 1, message: '业务失败', data: null }),
    );
    expect(inline).toBe(AUTOFIX_ERROR_TEXT.generic);
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]![0].key).toBe(
      `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}业务失败`,
    );
    expect(noticeContents()).toEqual(['业务失败']);
  });
});

/**
 * SEC-25/26 第 6 条（窝窝头复审）：请求层的 http-error key 按文案共用（FE-02 去重）。
 * autofix 只能替换「确实由当前错误弹出、且没有被别的未处理错误共用」的那条提示。
 */
describe('autofix 错误提示 · 共用 key 不串改', () => {
  const GENERIC = () => $t('fallback.http.internalServerError');
  const GENERIC_KEY = () => `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${GENERIC()}`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetHttpErrorNoticeTracking();
    access.accessToken = 'token';
    refreshTokenApi.mockResolvedValue('new-token');
  });

  async function otherRequestFails() {
    await requestClient
      .get('/k8s/fake-other', { adapter: adapterOf(500, ERROR_BODY('X')) })
      .catch(() => undefined);
  }

  function autofixContents() {
    return notices.error.mock.calls
      .map(([arg]) => arg?.content)
      .filter((content) =>
        (Object.values(AUTOFIX_ERROR_TEXT) as string[]).includes(content),
      );
  }

  it('非 autofix 请求先弹了同 key 提示，autofix 随后失败：不替换成 autofix 文案，行内仍给具体文案', async () => {
    await otherRequestFails();
    const inline = await confirmWith(
      adapterOf(409, ERROR_BODY('WORKFLOW_APPROVAL_ERROR')),
    );
    expect(inline).toBe(AUTOFIX_ERROR_TEXT.conflict);
    const visible = visibleNotices();
    expect(visible.size).toBe(1);
    expect(visible.get(GENERIC_KEY())).toBe(GENERIC());
    expect(autofixContents()).toEqual([]);
    // incr8 后续 2：次数 + 内容——两次都是请求层的通用文案，没有第三次替换成 autofix 文案
    expect(notices.error).toHaveBeenCalledTimes(2);
    expect(noticeContents()).toEqual([GENERIC(), GENERIC()]);
  });

  it('autofix 先失败、页面处理前非 autofix 请求也失败（并发）：同样不替换', async () => {
    const autofixError = await requestClientAIOps
      .post(
        '/autofix/workflow/confirm',
        { plan_id: 'fake-plan', approved_action_ids: ['fake-action'] },
        { adapter: adapterOf(502, ERROR_BODY('X')) },
      )
      .catch((error) => error);
    await otherRequestFails();
    expect(reportAutoFixError(autofixError)).toBe(
      AUTOFIX_ERROR_TEXT.unavailable,
    );
    const visible = visibleNotices();
    expect(visible.size).toBe(1);
    expect(visible.get(GENERIC_KEY())).toBe(GENERIC());
    expect(autofixContents()).toEqual([]);
    expect(notices.error).toHaveBeenCalledTimes(2);
    expect(noticeContents()).toEqual([GENERIC(), GENERIC()]);
  });

  it('Promise.all 真并发：非 autofix 的提示不被改写', async () => {
    const [autofixError] = await Promise.all([
      requestClientAIOps
        .post(
          '/autofix/workflow/confirm',
          { plan_id: 'fake-plan', approved_action_ids: ['fake-action'] },
          { adapter: adapterOf(409, ERROR_BODY('X')) },
        )
        .catch((error) => error),
      otherRequestFails(),
    ]);
    reportAutoFixError(autofixError);
    expect(visibleNotices().get(GENERIC_KEY())).toBe(GENERIC());
    expect(autofixContents()).toEqual([]);
    expect(notices.error).toHaveBeenCalledTimes(2);
    expect(noticeContents()).toEqual([GENERIC(), GENERIC()]);
  });

  it('非 autofix 的提示已关闭后，autofix 自己的错误照常替换为一条', async () => {
    notices.error.mockImplementationOnce(() => Promise.resolve());
    await otherRequestFails();
    await Promise.resolve();
    await confirmWith(adapterOf(409, ERROR_BODY('X')));
    const visible = visibleNotices();
    expect(visible.size).toBe(1);
    expect(visible.get(GENERIC_KEY())).toBe(AUTOFIX_ERROR_TEXT.conflict);
    // 内容：非 autofix 的通用文案（已关闭）→ autofix 请求层通用文案 → 替换为 autofix 具体文案
    expect(notices.error).toHaveBeenCalledTimes(3);
    expect(noticeContents()).toEqual([
      GENERIC(),
      GENERIC(),
      AUTOFIX_ERROR_TEXT.conflict,
    ]);
  });

  it('autofix 连续两次同类错误：仍只有一个 key（不堆叠），显示最后一次的具体文案', async () => {
    await confirmWith(adapterOf(409, ERROR_BODY('X')));
    await confirmWith(adapterOf(404, ERROR_BODY('X')));
    const keys = new Set(notices.error.mock.calls.map(([arg]) => arg?.key));
    expect(keys.size).toBe(2);
    // 404 走 notFound 文案、409 走 internalServerError：两条各自一个 key，再来一次 409 不新增
    await confirmWith(adapterOf(409, ERROR_BODY('X')));
    const after = new Set(notices.error.mock.calls.map(([arg]) => arg?.key));
    expect(after).toEqual(keys);
    expect(visibleNotices().get(GENERIC_KEY())).toBe(
      AUTOFIX_ERROR_TEXT.conflict,
    );
    // 最后一次 409：请求层通用文案 → 替换为 autofix 具体文案（不是 404 的 expired）
    expect(noticeContents().slice(-2)).toEqual([
      GENERIC(),
      AUTOFIX_ERROR_TEXT.conflict,
    ]);
  });
});
