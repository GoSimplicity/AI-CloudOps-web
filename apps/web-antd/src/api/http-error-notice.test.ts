import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBusinessError,
  notifyBusinessError,
} from '#/utils/permission/business-error';

import {
  claimHttpErrorNotice,
  getHttpErrorNoticeKey,
  isNotifiedByRequestLayer,
  markHttpErrorNoticeReplaced,
  markHttpErrorNotified,
  resetHttpErrorNoticeTracking,
} from './http-error-notice';

afterEach(() => {
  resetHttpErrorNoticeTracking();
  vi.useRealTimers();
});

/** 模拟 message.error 的返回值：手动触发「提示已关闭」 */
function closableHandle() {
  let close = () => {};
  const handle = {
    then(onClose: () => void) {
      close = onClose;
    },
  };
  return { close: () => close(), handle };
}

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

describe('claim 认领（incr6 P3-3）', () => {
  it('m3a：不是这条提示弹出者的错误不能认领（旧提示关闭后同 key 被别的错误重新弹出并已替换）', () => {
    const key = 'http-error:假的网络异常';
    const first = new Error('fake first failure');
    const firstNotice = closableHandle();
    markHttpErrorNotified(first, key, firstNotice.handle);
    // first 那条提示关闭，同 key 被 second 重新弹出，second 的页面已换成具体文案
    firstNotice.close();
    const second = new Error('fake second failure');
    markHttpErrorNotified(second, key, closableHandle().handle);
    expect(claimHttpErrorNotice(second)).toBe(key);
    markHttpErrorNoticeReplaced(second);
    // first 仍带着同一个 key，但当前可见的这条不是它弹的：不能认领，否则会覆盖 second 页面的文案
    expect(getHttpErrorNoticeKey(first)).toBe(key);
    expect(claimHttpErrorNotice(first)).toBeUndefined();
  });
});

describe('nOTICE_STALE_MS 兜底过期（incr6 P3-3）', () => {
  it('m5：onClose 没回调时，10s 内仍可认领，超过 10s 视为已关闭', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const key = 'http-error:假的服务器错误';
    const error = new Error('fake server failure');
    markHttpErrorNotified(error, key);
    vi.advanceTimersByTime(9999);
    expect(claimHttpErrorNotice(error)).toBe(key);
    vi.advanceTimersByTime(1);
    // 恰好 10_000ms：还没过期（判断是 >）
    expect(claimHttpErrorNotice(error)).toBe(key);
    vi.advanceTimersByTime(1);
    expect(claimHttpErrorNotice(error)).toBeUndefined();
    // 过期后记录已清掉：再 mark 一次是新提示，可以认领
    markHttpErrorNotified(error, key);
    expect(claimHttpErrorNotice(error)).toBe(key);
  });
  it('incr7 m25：过期即删除记录——之后系统时钟回拨，旧记录也不会「复活」被认领', () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(start);
    const key = 'http-error:假的服务器错误';
    const error = new Error('fake server failure');
    markHttpErrorNotified(error, key);
    vi.advanceTimersByTime(10_001);
    expect(claimHttpErrorNotice(error)).toBeUndefined();
    // 时钟回拨（NTP 校时等）：记录若只是被跳过而没删除，这里会重新变成「未过期」
    vi.setSystemTime(start);
    expect(claimHttpErrorNotice(error)).toBeUndefined();
  });
});
