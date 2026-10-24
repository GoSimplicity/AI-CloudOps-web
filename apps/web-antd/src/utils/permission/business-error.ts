/**
 * 业务错误（HTTP 2xx/3xx 但响应体 code≠0）统一提示
 *
 * 后端业务失败统一走 base.ErrorWithMessage：HTTP 200 + code 1 + message。
 * 响应解构拦截器把它转成带标记的错误，通用错误拦截器据此弹出后端 message 原文，
 * 并标记「已提示」；页面 catch 用 isPermissionDeniedError 判断已提示后跳过自身提示，
 * 保证每个业务错误恰好提示一次：页面不弹、没有 catch 时也不会静默。
 */

/** 业务错误标记，值为后端 message 原文 */
const BUSINESS_ERROR_FLAG = Symbol.for('ai-cloudops.businessError');
/** 已由请求层提示过的业务错误标记 */
const BUSINESS_ERROR_NOTIFIED_FLAG = Symbol.for(
  'ai-cloudops.businessErrorNotified',
);
/**
 * message key 前缀：key 按文案区分，同一文案的并发错误合并为一条，
 * 不同文案各自一条，互不覆盖。
 */
export const BUSINESS_ERROR_MESSAGE_KEY_PREFIX = 'business-error:';

export type BusinessErrorNotifier = (content: string, key: string) => void;

function defineValue(target: object, flag: symbol, value: unknown) {
  Object.defineProperty(target, flag, {
    configurable: true,
    enumerable: false,
    value,
  });
}

/**
 * 创建业务错误。message 保持原格式 `Error <HTTP状态>: <后端 message>`，
 * 兼容按该格式取后端原文的页面（如定时任务 getBackendErrorMessage）。
 */
export function createBusinessError(status: number, detail: unknown) {
  const error = new Error(`Error ${status}: ${detail}`);
  defineValue(
    error,
    BUSINESS_ERROR_FLAG,
    typeof detail === 'string' ? detail : '',
  );
  return error;
}

export function isBusinessError(error: any) {
  return !!error && typeof error === 'object' && BUSINESS_ERROR_FLAG in error;
}

/** 后端 message 原文；不是业务错误时返回空串 */
export function getBusinessErrorMessage(error: any): string {
  return isBusinessError(error) ? String(error[BUSINESS_ERROR_FLAG] ?? '') : '';
}

export function hasBusinessErrorNotified(error: any) {
  return !!error && error[BUSINESS_ERROR_NOTIFIED_FLAG] === true;
}

/**
 * 业务错误统一提示：弹后端原文（为空时用 fallback，不静默），并标记已提示。
 * 同一个错误对象只提示一次（如 401 刷新后重放，内外两层拦截链）。
 * 返回 true 表示该错误是业务错误、已由这里负责提示，调用方不要再弹通用提示。
 */
export function notifyBusinessError(
  error: any,
  notify: BusinessErrorNotifier,
  fallback: string,
): boolean {
  if (!isBusinessError(error)) return false;
  if (hasBusinessErrorNotified(error)) return true;
  const content = getBusinessErrorMessage(error).trim() || fallback;
  defineValue(error, BUSINESS_ERROR_NOTIFIED_FLAG, true);
  notify(content, `${BUSINESS_ERROR_MESSAGE_KEY_PREFIX}${content}`);
  return true;
}
