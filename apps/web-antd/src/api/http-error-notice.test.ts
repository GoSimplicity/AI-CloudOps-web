import { afterEach, describe, expect, it } from 'vitest';

import {
  createBusinessError,
  notifyBusinessError,
} from '#/utils/permission/business-error';

import {
  claimHttpErrorNotice,
  getHttpErrorNoticeKey,
  isNotifiedByRequestLayer,
  markHttpErrorNotified,
  markHttpErrorNoticeReplaced,
  resetHttpErrorNoticeTracking,
} from './http-error-notice';

afterEach(() => {
  resetHttpErrorNoticeTracking();
});

describe('isNotifiedByRequestLayer（复审 P3-3）', () => {
  it('通用 http-error 提示过的错误（含网络错误）视为已提示', () => {
    const error = new Error('fake network failure');
    expect(isNotifiedByRequestLayer(error)).toBe(false);
    markHttpErrorNotified(error, 'http-error:网络异常');
    expect(isNotifiedByRequestLayer(error)).toBe(true);
  });

  it('403 与已弹过后端原文的业务错误视为已提示', () => {
    expect(isNotifiedByRequestLayer({ response: { status: 403 } })).toBe(true);
    const business = createBusinessError(200, '假的业务错误');
    notifyBusinessError(business, () => {}, '');
    expect(isNotifiedByRequestLayer(business)).toBe(true);
  });

  it('未经请求层提示的错误、非对象：返回 false', () => {
    expect(isNotifiedByRequestLayer(new Error('local'))).toBe(false);
    expect(isNotifiedByRequestLayer(undefined)).toBe(false);
    expect(isNotifiedByRequestLayer('x')).toBe(false);
    expect(getHttpErrorNoticeKey('x')).toBeUndefined();
  });
});

describe('冻结 / 不可扩展的错误对象（复审 P3-6）', () => {
  it.each([
    ['Object.freeze', () => Object.freeze(new Error('frozen'))],
    ['Object.seal', () => Object.seal(new Error('sealed'))],
    ['Object.preventExtensions', () => Object.preventExtensions({ x: 1 })],
  ])('%s：标记不抛错，降级为不记录', (_, make) => {
    const error = make();
    expect(() =>
      markHttpErrorNotified(error, 'http-error:假文案'),
    ).not.toThrow();
    expect(getHttpErrorNoticeKey(error)).toBeUndefined();
    expect(isNotifiedByRequestLayer(error)).toBe(false);
    expect(claimHttpErrorNotice(error)).toBeUndefined();
    expect(() => markHttpErrorNoticeReplaced(error)).not.toThrow();
  });

  it('没记录上的冻结错误不占用同 key 提示：后来的普通错误仍可替换', () => {
    const key = 'http-error:假文案';
    markHttpErrorNotified(Object.freeze(new Error('frozen')), key);
    const normal = new Error('normal');
    markHttpErrorNotified(normal, key);
    expect(claimHttpErrorNotice(normal)).toBe(key);
  });
});
