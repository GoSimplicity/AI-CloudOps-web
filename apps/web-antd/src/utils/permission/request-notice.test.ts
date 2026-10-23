import { RequestOwnerChangedError } from '@vben/request';

import axios, { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import {
  createBusinessError,
  notifyBusinessError,
} from './business-error';
import {
  isCanceledRequest,
  isNotifiedByRequestLayer,
  shouldNotifyPageError,
} from './request-notice';

/**
 * FE-02b：页面 catch 统一口径（与 cron 列表 handleListFailure 一致）
 * - 取消类（CanceledError / RequestOwnerChangedError）→ 页面静默
 * - 请求层已提示（403、已弹后端原文的业务错误、带 response 的 HTTP 错误、
 *   发出了请求但没有响应的网络错误 / 超时，含 ETIMEDOUT）→ 页面不再弹
 * - 其余（非请求错误、没发出请求的 axios 错误）→ 页面弹自己的文案
 */
const httpError = (status: number) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    {} as any,
    {},
    { status, data: {}, headers: {}, statusText: '', config: {} as any } as any,
  );

describe('request-notice：页面 catch 是否还需要自己提示', () => {
  it('取消类：CanceledError、RequestOwnerChangedError 都算取消', () => {
    expect(isCanceledRequest(new axios.CanceledError(undefined, {} as any, {}))).toBe(true);
    expect(isCanceledRequest(new RequestOwnerChangedError())).toBe(true);
    expect(isCanceledRequest(new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {}))).toBe(false);
    expect(isCanceledRequest(new Error('x'))).toBe(false);
    expect(isCanceledRequest(null)).toBe(false);
  });

  it.each([
    ['HTTP 500（带 response）', httpError(500)],
    ['HTTP 404', httpError(404)],
    ['HTTP 403', httpError(403)],
    ['网络错误（有 request 无 response）', new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as any, {})],
    ['超时 ECONNABORTED', new AxiosError('timeout of 1ms exceeded', AxiosError.ECONNABORTED, {} as any, {})],
    ['超时 ETIMEDOUT', new AxiosError('timeout of 1ms exceeded', AxiosError.ETIMEDOUT, {} as any, {})],
    ['RequestClient 包装后的 HTTP 错误（普通对象带 response）', { response: { status: 502 } }],
  ])('%s：请求层已提示，页面不弹', (_label, error) => {
    expect(isNotifiedByRequestLayer(error)).toBe(true);
    expect(shouldNotifyPageError(error)).toBe(false);
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
    const canceled = new axios.CanceledError(undefined, {} as any, {});
    expect(isNotifiedByRequestLayer(canceled)).toBe(false);
    expect(shouldNotifyPageError(canceled)).toBe(false);
    expect(shouldNotifyPageError(new RequestOwnerChangedError())).toBe(false);
  });

  it.each([
    ['普通 Error（非请求错误）', new Error('Network Error')],
    ['没有发出请求的 axios 错误', new AxiosError('bad option', AxiosError.ERR_BAD_OPTION)],
    ['表单校验错误', { errorFields: [{ name: ['name'] }] }],
    ['undefined', undefined],
  ])('%s：页面自己弹一条', (_label, error) => {
    expect(isNotifiedByRequestLayer(error)).toBe(false);
    expect(shouldNotifyPageError(error)).toBe(true);
  });
});
