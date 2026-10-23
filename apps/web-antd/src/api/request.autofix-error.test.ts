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
import { PERMISSION_DENIED_MESSAGE_KEY } from '#/utils/permission/forbidden';
import { BUSINESS_ERROR_MESSAGE_KEY_PREFIX } from '#/utils/permission/business-error';

import { HTTP_ERROR_MESSAGE_KEY_PREFIX, requestClientAIOps } from './request';

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

const ERROR_BODY = (code: string) => ({
  code: 1,
  message: `后端原文 ${code}`,
  error_code: code,
});

describe('autofix 错误提示 · 请求链路集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('403：只有权限提示一条', async () => {
    await confirmWith(adapterOf(403, ERROR_BODY('WORKFLOW_APPROVAL_ERROR')));
    expect(notices.error).toHaveBeenCalledTimes(1);
    expect(notices.error.mock.calls[0]![0].key).toBe(
      PERMISSION_DENIED_MESSAGE_KEY,
    );
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
  });
});
