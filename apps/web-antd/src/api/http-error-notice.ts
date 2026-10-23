/**
 * 请求层「已按 http-error key 提示过」的标记（SEC-25/26 规则 3）。
 *
 * 通用错误拦截器对非 2xx 响应弹出 fallback 文案（key = `http-error:<文案>`），并把这个 key
 * 记在错误对象上（不可枚举 Symbol，RequestClient 包装失败对象时会保留）。页面需要更具体的文案时，
 * 用同一个 key 调 message.error 替换那一条，而不是再弹第二条。
 */
const HTTP_ERROR_NOTICE_KEY = Symbol.for('ai-cloudops.httpErrorNoticeKey');

export function markHttpErrorNotified(error: unknown, key: string) {
  if (!error || typeof error !== 'object') return;
  Object.defineProperty(error, HTTP_ERROR_NOTICE_KEY, {
    configurable: true,
    enumerable: false,
    value: key,
  });
}

/** 请求层提示时用的 message key；没有提示过返回 undefined */
export function getHttpErrorNoticeKey(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const key = (error as Record<symbol, unknown>)[HTTP_ERROR_NOTICE_KEY];
  return typeof key === 'string' ? key : undefined;
}
