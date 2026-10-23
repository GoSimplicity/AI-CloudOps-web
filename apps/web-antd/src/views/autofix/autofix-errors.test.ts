import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  markHttpErrorNotified,
  resetHttpErrorNoticeTracking,
} from '#/api/http-error-notice';
import {
  createBusinessError,
  notifyBusinessError,
} from '#/utils/permission/business-error';
import { PERMISSION_DENIED_MESSAGE } from '#/utils/permission/forbidden';

import {
  AUTOFIX_ERROR_TEXT,
  describeAutoFixError,
  reportAutoFixError,
} from './autofix-errors';

/** SEC-25/26 规则 3/4：autofix 错误只按 HTTP 状态分类，不依赖 error_code */
const httpError = (status: number, body: Record<string, unknown> = {}) =>
  Object.assign(new Error('后端原文不应出现在界面'), {
    response: { status, data: body },
  });

beforeEach(() => {
  resetHttpErrorNoticeTracking();
  vi.spyOn(message, 'error').mockImplementation((() => {}) as any);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('describeAutoFixError：状态码 → 文案', () => {
  it.each([
    [409, AUTOFIX_ERROR_TEXT.conflict],
    [404, AUTOFIX_ERROR_TEXT.expired],
    [502, AUTOFIX_ERROR_TEXT.unavailable],
    [503, AUTOFIX_ERROR_TEXT.unavailable],
    [504, AUTOFIX_ERROR_TEXT.unavailable],
    [400, AUTOFIX_ERROR_TEXT.invalid],
    [422, AUTOFIX_ERROR_TEXT.invalid],
    [500, AUTOFIX_ERROR_TEXT.generic],
  ])('%s → 对应文案', (status, text) => {
    expect(describeAutoFixError(httpError(status)).text).toBe(text);
  });

  it('文案固定：409「状态已变，请刷新」、404「计划已失效，请重新生成」、5xx 网关类含「稍后重试」', () => {
    expect(AUTOFIX_ERROR_TEXT.conflict).toBe('状态已变，请刷新');
    expect(AUTOFIX_ERROR_TEXT.expired).toBe('计划已失效，请重新生成');
    expect(AUTOFIX_ERROR_TEXT.unavailable).toContain('稍后重试');
    expect(AUTOFIX_ERROR_TEXT.invalid).toContain('参数');
  });

  it('不依赖 error_code：同一状态不同 error_code 文案相同；文案里不出现错误码', () => {
    const codes = [
      'WORKFLOW_APPROVAL_ERROR',
      'AUTOFIX_INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
      'AUTOFIX_ERROR',
    ];
    for (const status of [400, 404, 409, 422, 500, 502, 503, 504]) {
      const texts = new Set(
        codes.map(
          (code) =>
            describeAutoFixError(
              httpError(status, { error_code: code, message: code }),
            ).text,
        ),
      );
      expect(texts.size).toBe(1);
      for (const code of codes) expect([...texts][0]).not.toContain(code);
    }
    for (const text of Object.values(AUTOFIX_ERROR_TEXT))
      expect(text).not.toMatch(/[A-Z_]{4,}|\d{3}/);
  });

  it('500 只给通用错误，不透出后端 message', () => {
    const result = describeAutoFixError(
      httpError(500, { message: '内部细节 traceback' }),
    );
    expect(result.text).toBe(AUTOFIX_ERROR_TEXT.generic);
    expect(result.text).not.toContain('traceback');
  });

  it('403 / 业务错误 / 网络错误：只有行内文案', () => {
    expect(describeAutoFixError(httpError(403)).text).toBe(
      PERMISSION_DENIED_MESSAGE,
    );
    expect(describeAutoFixError(createBusinessError(200, 'x')).text).toBe(
      AUTOFIX_ERROR_TEXT.generic,
    );
    expect(describeAutoFixError(new Error('Network Error')).text).toBe(
      AUTOFIX_ERROR_TEXT.generic,
    );
  });
});

describe('reportAutoFixError：每个错误只一条提示', () => {
  it.each([400, 404, 409, 422, 502, 503, 504])(
    '%s：复用请求层的 http-error key 替换通用提示，不新增第二条',
    (status) => {
      const error = httpError(status);
      markHttpErrorNotified(error, 'http-error:通用提示');
      const text = reportAutoFixError(error);
      expect(message.error).toHaveBeenCalledTimes(1);
      expect(message.error).toHaveBeenCalledWith({
        content: text,
        key: 'http-error:通用提示',
      });
    },
  );

  it('500：请求层已弹通用错误，页面不再弹', () => {
    const error = httpError(500);
    markHttpErrorNotified(error, 'http-error:通用提示');
    expect(reportAutoFixError(error)).toBe(AUTOFIX_ERROR_TEXT.generic);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('403 与已提示的业务错误：页面不再弹', () => {
    reportAutoFixError(httpError(403));
    const business = createBusinessError(200, '业务失败');
    notifyBusinessError(business, () => {}, '');
    reportAutoFixError(business);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('请求层没提示过的（例如被 mock 的接口）：页面补一条', () => {
    reportAutoFixError(httpError(409));
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith(
      expect.objectContaining({ content: AUTOFIX_ERROR_TEXT.conflict }),
    );
  });
});

describe('reportAutoFixError：共用 key 时不串改（第 6 条）', () => {
  it.each([
    ['其它错误先弹', true],
    ['autofix 先弹', false],
  ])('%s：同 key 被另一个未处理错误共用时，不替换、不新增', (_, otherFirst) => {
    const other = httpError(500);
    const own = httpError(409);
    if (otherFirst) markHttpErrorNotified(other, 'http-error:通用提示');
    markHttpErrorNotified(own, 'http-error:通用提示');
    if (!otherFirst) markHttpErrorNotified(other, 'http-error:通用提示');
    expect(reportAutoFixError(own)).toBe(AUTOFIX_ERROR_TEXT.conflict);
    expect(message.error).not.toHaveBeenCalled();
  });

  it('key 不同的其它错误不影响替换', () => {
    markHttpErrorNotified(httpError(500), 'http-error:另一条');
    const own = httpError(409);
    markHttpErrorNotified(own, 'http-error:通用提示');
    reportAutoFixError(own);
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith({
      content: AUTOFIX_ERROR_TEXT.conflict,
      key: 'http-error:通用提示',
    });
  });
});
