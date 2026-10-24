/**
 * 页面 catch 的统一提示口径（FE-02b）
 *
 * 请求层（api/request.ts 的 requestClient / requestClientAIOps）已负责的提示：
 * - 403：统一「没有权限」提示（forbidden.ts）；
 * - 业务错误（HTTP 200 + code≠0）：弹后端原文一条（business-error.ts）；
 * - 带 response 的 HTTP 错误（4xx/5xx）：通用错误拦截器按 key `http-error:${文案}` 弹一条；
 * - 发出了请求但没有响应的 axios 错误（网络错误 / 超时 / 浏览器中止）：同上。
 * 取消类（axios 取消、账户切换取消旧请求 RequestOwnerChangedError、原生 AbortError）请求层不提示，页面也静默。
 *
 * 「请求层已提示」= 有标记 或 按形状判断（FE-02b incr3 P2-1 / P3-3）：
 * - 标记：通用错误拦截器弹 http-error 提示时在原始错误上记下 key（与 SEC-26 api/http-error-notice.ts
 *   同一个 Symbol.for 键，两边合并后互通）；RequestClient 包装错误时会复制自有 Symbol 属性；
 * - 形状：只认经过 requestClient 通用错误拦截器（有经过标记）的错误，再看是否带 response / 发出了请求。
 *   baseRequestClient（无拦截器）、原生 fetch 等没经过拦截器的错误不会被当作已提示而吞掉。
 *
 * 页面 catch 写法：
 * - 错误状态：`if (shouldRecordPageError(error)) loadError.value = 'xxx失败'`（取消类不写，FE-02b 拍板 3）；
 * - 提示：`if (shouldNotifyPageError(error)) message.error('xxx失败')`。
 * loading 等收尾照常在 finally / catch 里清，取消类只跳过错误状态的写入。
 */
import { RequestOwnerChangedError } from '@vben/request';

import axios from 'axios';

import { isPermissionDeniedError } from './forbidden';

/** 请求层弹 http-error 提示时记下的 message key（与 SEC-26 http-error-notice.ts 的 HTTP_ERROR_NOTICE_KEY 相同） */
const HTTP_ERROR_NOTICE_KEY = Symbol.for('ai-cloudops.httpErrorNoticeKey');
/** 错误经过了 requestClient / requestClientAIOps 的通用错误拦截器 */
const REQUEST_LAYER_TRACE = Symbol.for('ai-cloudops.requestLayerTrace');

function defineHidden(target: unknown, symbol: symbol, value: unknown): void {
  if (!target || typeof target !== 'object') return;
  try {
    Object.defineProperty(target, symbol, {
      configurable: true,
      enumerable: false,
      value,
      writable: true,
    });
  } catch {
    // 冻结对象等无法打标的情况：按未经过请求层处理（页面会自己提示，宁可多一条不吞提示）
  }
}

/** 通用错误拦截器入口调用：标记该错误经过了请求层 */
export function markRequestLayerTrace<T>(error: T): T {
  defineHidden(error, REQUEST_LAYER_TRACE, true);
  return error;
}

/** 通用错误拦截器弹 http-error 提示后调用：记下 key，页面可用同一 key 替换为带引导的文案 */
export function markRequestLayerNotice(error: unknown, key: string): void {
  markRequestLayerTrace(error);
  defineHidden(error, HTTP_ERROR_NOTICE_KEY, key);
}

/** 请求层弹过的 http-error 提示的 key；没弹过返回 undefined */
export function getRequestLayerNoticeKey(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const key = (error as Record<symbol, unknown>)[HTTP_ERROR_NOTICE_KEY];
  return typeof key === 'string' ? key : undefined;
}

function hasRequestLayerTrace(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as Record<symbol, unknown>)[REQUEST_LAYER_TRACE] === true
  );
}

/**
 * 取消的请求：axios 取消（CanceledError / isCancel / code ERR_CANCELED）、RequestOwnerChangedError
 * （继承 CanceledError）、原生 fetch / AbortController 的 AbortError
 */
export const isCanceledRequest = (error: any): boolean =>
  axios.isCancel(error) ||
  error instanceof RequestOwnerChangedError ||
  error?.name === 'AbortError' ||
  error?.code === 'ERR_CANCELED';

/**
 * 形状判断「请求层已提示」（启发式，原 isNotifiedByRequestLayer，incr3 改名）：
 * 只认经过 requestClient 通用错误拦截器的错误，且带 response（HTTP 错误，含 RequestClient 包装后的对象）
 * 或发出了请求但没有响应（网络错误 / 超时）。取消类不算。
 */
export const looksNotifiedByRequestLayer = (error: any): boolean =>
  hasRequestLayerTrace(error) &&
  !isCanceledRequest(error) &&
  (!!error?.response || (axios.isAxiosError(error) && !!error.request));

/** 请求层已提示：403 / 已提示的业务错误、有 http-error 标记，或按形状判断已提示 */
const isRequestLayerNotified = (error: any): boolean =>
  isPermissionDeniedError(error) ||
  getRequestLayerNoticeKey(error) !== undefined ||
  looksNotifiedByRequestLayer(error);

/** 页面 catch 是否还要自己弹提示：取消类静默，请求层已提示的不再叠加 */
export const shouldNotifyPageError = (error: any): boolean =>
  !isCanceledRequest(error) && !isRequestLayerNotified(error);

/**
 * 页面 catch 是否写错误状态（loadError / xxxError 等）：取消类不写，与 cron 列表 handleListFailure 一致。
 * 取消通常是用户已离开页面或被更新的请求取代，写入会留下过期的错误提示（FE-02b 拍板 3）
 */
export const shouldRecordPageError = (error: any): boolean =>
  !isCanceledRequest(error);
