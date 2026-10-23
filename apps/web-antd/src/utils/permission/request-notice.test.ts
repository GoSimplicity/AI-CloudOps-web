import { RequestOwnerChangedError } from '@vben/request';

import axios, { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import {
  createBusinessError,
  notifyBusinessError,
} from './business-error';
import {
  getRequestLayerNoticeKey,
  isCanceledRequest,
  looksNotifiedByRequestLayer,
  markRequestLayerNotice,
  markRequestLayerTrace,
  shouldNotifyPageError,
  shouldRecordPageError,
} from './request-notice';

/**
 * FE-02b：页面 catch 统一口径（与 cron 列表 handleListFailure 一致）
 * - 取消类（CanceledError / RequestOwnerChangedError / AbortError / ERR_CANCELED）→ 页面静默
 * - 请求层已提示 = 有标记（http-error key、403、已弹原文的业务错误）或按形状判断
 *   （只认经过 requestClient 通用错误拦截器的错误：带 response，或发出了请求但没有响应）→ 页面不再弹
 * - 其余（非请求错误、没发出请求的 axios 错误、没经过 requestClient 的错误）→ 页面弹自己的文案
 */
const httpError = (status: number) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    {} as any,
    {},
    { status, data: {}, headers: {}, statusText: '', config: {} as any } as any,
  );
/** 模拟经过 requestClient 通用错误拦截器（拦截器入口打的经过标记） */
const viaRequestLayer = <T>(error: T): T => {
  markRequestLayerTrace(error);
  return error;
};

describe('request-notice：页面 catch 是否还需要自己提示', () => {
  it('取消类：CanceledError、RequestOwnerChangedError 都算取消', () => {
    expect(isCanceledRequest(new axios.CanceledError(undefined, {} as any, {}))).toBe(true);
    expect(isCanceledRequest(new RequestOwnerChangedError())).toBe(true);
    expect(isCanceledRequest(new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}))).toBe(false);
    expect(isCanceledRequest(new Error('x'))).toBe(false);
    expect(isCanceledRequest(null)).toBe(false);
  });

  it.each([
    ['原生 AbortController / fetch 的 DOMException AbortError', () => new DOMException('The user aborted a request.', 'AbortError')],
    ['name 为 AbortError 的普通错误', () => Object.assign(new Error('aborted'), { name: 'AbortError' })],
    ['code 为 ERR_CANCELED 的 AxiosError（未带 __CANCEL__）', () => new AxiosError('canceled', AxiosError.ERR_CANCELED, {} as any, {})],
    ['code 为 ERR_CANCELED 的普通对象', () => ({ code: 'ERR_CANCELED' })],
  ])('incr3 P3-1：%s 算取消，页面不写错误状态、不提示', (_label, make) => {
    const error = make();
    expect(isCanceledRequest(error)).toBe(true);
    expect(shouldRecordPageError(error)).toBe(false);
    expect(shouldNotifyPageError(error)).toBe(false);
    // 即使经过了请求层也不算「已提示」
    expect(looksNotifiedByRequestLayer(viaRequestLayer(make()))).toBe(false);
  });

  it.each([
    ['HTTP 500（带 response）', () => httpError(500)],
    ['HTTP 404', () => httpError(404)],
    ['HTTP 403', () => httpError(403)],
    ['网络错误（有 request 无 response）', () => new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {})],
    ['超时 ECONNABORTED', () => new AxiosError('timeout of 1ms exceeded', AxiosError.ECONNABORTED, {} as any, {})],
    ['超时 ETIMEDOUT', () => new AxiosError('timeout of 1ms exceeded', AxiosError.ETIMEDOUT, {} as any, {})],
    ['RequestClient 包装后的 HTTP 错误（普通对象带 response）', () => ({ response: { status: 502 } })],
  ])('%s，经过 requestClient：按形状判断请求层已提示，页面不弹', (_label, make) => {
    const error = viaRequestLayer(make());
    expect(looksNotifiedByRequestLayer(error)).toBe(true);
    expect(shouldNotifyPageError(error)).toBe(false);
  });

  it.each([
    ['baseRequestClient 的 HTTP 500（无拦截器，带 response）', () => httpError(500)],
    ['baseRequestClient 的网络错误', () => new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {})],
    ['带 response 的普通对象（未经过 requestClient）', () => ({ response: { status: 502 } })],
    ['原生 fetch 的网络错误', () => new TypeError('Failed to fetch')],
  ])('incr3 P3-3：%s：没经过 requestClient，不算已提示，页面自己弹', (_label, make) => {
    const error = make();
    expect(looksNotifiedByRequestLayer(error)).toBe(false);
    expect(shouldNotifyPageError(error)).toBe(true);
    expect(shouldRecordPageError(error)).toBe(true);
  });

  it('incr3 P2-1：有 http-error 标记即算已提示（标记或形状判断，任一成立）', () => {
    const marked = { message: 'wrapped' };
    markRequestLayerNotice(marked, 'http-error:内部服务器错误');
    expect(getRequestLayerNoticeKey(marked)).toBe('http-error:内部服务器错误');
    expect(shouldNotifyPageError(marked)).toBe(false);
    // 与 SEC-26 http-error-notice.ts 同一个 Symbol.for 键：SEC-26 打的标记这边也认
    const fromSec26 = Object.assign(new Error('x'), {
      [Symbol.for('ai-cloudops.httpErrorNoticeKey')]: 'http-error:请求过于频繁，请稍后重试',
    });
    expect(getRequestLayerNoticeKey(fromSec26)).toBe('http-error:请求过于频繁，请稍后重试');
    expect(shouldNotifyPageError(fromSec26)).toBe(false);
    // 标记不可枚举，不影响序列化 / 展开
    expect(Object.keys(marked)).toEqual(['message']);
    expect(getRequestLayerNoticeKey(new Error('x'))).toBeUndefined();
    expect(getRequestLayerNoticeKey(undefined)).toBeUndefined();
    // 冻结对象打不上标记：不抛错，按未提示处理
    const frozen = Object.freeze({ response: { status: 500 } });
    expect(() => markRequestLayerNotice(frozen, 'k')).not.toThrow();
    expect(shouldNotifyPageError(frozen)).toBe(true);
  });

  it('已弹后端原文的业务错误、已标记的 403：页面不弹', () => {
    const business = createBusinessError(200, '参数非法');
    notifyBusinessError(business, () => {}, 'fallback');
    expect(shouldNotifyPageError(business)).toBe(false);
    // 统一 403 拦截器打上的已提示标记（Symbol.for，RequestClient 包装后仍保留）
    const forbidden = Object.assign(new Error('Error 403'), {
      [Symbol.for('ai-cloudops.permissionDenied')]: true,
    });
    expect(shouldNotifyPageError(forbidden)).toBe(false);
  });

  it('取消类：页面静默（不算请求层已提示，但也不弹）', () => {
    const canceled = viaRequestLayer(new axios.CanceledError(undefined, {} as any, {}));
    expect(looksNotifiedByRequestLayer(canceled)).toBe(false);
    expect(shouldNotifyPageError(canceled)).toBe(false);
    expect(shouldNotifyPageError(new RequestOwnerChangedError())).toBe(false);
  });

  it.each([
    ['普通 Error（非请求错误）', () => new Error('Network Error')],
    ['没有发出请求的 axios 错误', () => new AxiosError('bad option', AxiosError.ERR_BAD_OPTION)],
    ['表单校验错误', () => ({ errorFields: [{ name: ['name'] }] })],
    ['undefined', () => undefined],
  ])('%s：页面自己弹一条（经过请求层也一样）', (_label, make) => {
    for (const error of [make(), viaRequestLayer(make())]) {
      expect(looksNotifiedByRequestLayer(error)).toBe(false);
      expect(shouldNotifyPageError(error)).toBe(true);
    }
  });
});

describe('request-notice：页面 catch 是否写错误状态（FE-02b 拍板 3）', () => {
  it.each([
    ['CanceledError', () => new axios.CanceledError()],
    ['RequestOwnerChangedError', () => new RequestOwnerChangedError()],
    ['axios.Cancel 风格对象（__CANCEL__）', () => ({ __CANCEL__: true })],
  ])('%s：取消类不写错误状态（与 cron 列表 handleListFailure 返回 null 一致）', (_label, make) => {
    expect(shouldRecordPageError(make())).toBe(false);
  });

  it.each([
    ['HTTP 500', () => httpError(500)],
    ['HTTP 403', () => httpError(403)],
    ['包装后的 { response }', () => ({ response: { status: 502 } })],
    [
      '网络错误',
      () => new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}),
    ],
    [
      'ETIMEDOUT',
      () => new AxiosError('timeout', AxiosError.ETIMEDOUT, {} as any, {}),
    ],
    ['已提示的业务错误', () => {
      const error = createBusinessError(200, '后端原文');
      notifyBusinessError(error, () => {}, 'fallback');
      return error;
    }],
    ['普通 Error', () => new Error('boom')],
    ['undefined', () => undefined],
  ])('%s：真实失败照常写错误状态', (_label, make) => {
    expect(shouldRecordPageError(make())).toBe(true);
  });

  it('与 shouldNotifyPageError 的关系：不写状态的一定不提示', () => {
    for (const error of [new axios.CanceledError(), new RequestOwnerChangedError()]) {
      expect(shouldRecordPageError(error)).toBe(false);
      expect(shouldNotifyPageError(error)).toBe(false);
    }
  });
});
