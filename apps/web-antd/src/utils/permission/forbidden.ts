/**
 * 后端无权限（HTTP 403）统一提示（FE-02）
 *
 * 后端无权限统一走 base.ForbiddenError：HTTP 状态码 403，响应体 code 同为 403。
 * 这里只负责：识别 403 → 标记错误 → 弹出唯一一种提示；
 * 同时让通用错误拦截器跳过已标记的错误，避免同一请求弹两次。
 */
import { hasBusinessErrorNotified } from './business-error';

export const PERMISSION_DENIED_MESSAGE = '没有权限执行此操作，请联系管理员';
/** 同 key 的 message 会合并为一条，并发多个 403 也只显示一条提示 */
export const PERMISSION_DENIED_MESSAGE_KEY = 'permission-denied';
export const FORBIDDEN_STATUS = 403;

/** 已统一提示过的错误标记（不可枚举，不影响页面原有的 error 判断） */
/**
 * 用 Symbol 作已提示标记：RequestClient.request 会把 HTTP 错误换成
 * Object.assign({}, response.data) 的新对象再抛给页面，可枚举的 Symbol
 * 属性会被 Object.assign 一并拷贝，而不会出现在 JSON / Object.keys 中。
 */
const PERMISSION_DENIED_FLAG = Symbol.for('ai-cloudops.permissionDenied');
/** 业务码 403 标记：HTTP 200 + code 403 时由响应解构拦截器打上 */
const BUSINESS_FORBIDDEN_FLAG = '__businessForbidden';

function defineFlag(
  target: unknown,
  flag: string | symbol,
  enumerable = false,
) {
  if (target && typeof target === 'object') {
    Object.defineProperty(target, flag, {
      configurable: true,
      enumerable,
      value: true,
    });
  }
}

export function isForbiddenResponse(error: any) {
  const status = error?.response?.status;
  if (status === FORBIDDEN_STATUS) return true;
  if (error?.[BUSINESS_FORBIDDEN_FLAG] === true) return true;
  // 业务码 403 只在 HTTP 2xx 时认（HTTP 403 已在上面判断），
  // 避免 500 等其它状态的响应体里恰好带 code 403 被误判为无权限
  return (
    error?.response?.data?.code === FORBIDDEN_STATUS &&
    typeof status === 'number' &&
    status >= 200 &&
    status < 300
  );
}

function hasPermissionDeniedFlag(error: any) {
  return !!error && error[PERMISSION_DENIED_FLAG] === true;
}

/**
 * 页面 catch 中可用它判断错误是否已被请求层统一提示过，从而跳过自己的提示。
 * - 除已提示标记外，HTTP 状态为 403 的错误也视为已提示：经 requestClient 发出的
 *   HTTP 403 必定经过统一提示拦截器，而 403 响应体不是对象时，RequestClient
 *   会把它包成 new Error(data)，标记可能随之丢失。
 * - 已由请求层弹过后端原文的业务错误（code≠0，见 business-error.ts）同样返回 true。
 *   函数名沿用 FE-02 时的命名，页面守卫无需改动。
 */
export function isPermissionDeniedError(error: any) {
  return (
    hasPermissionDeniedFlag(error) ||
    error?.response?.status === FORBIDDEN_STATUS ||
    hasBusinessErrorNotified(error)
  );
}

/** 后端 403 原文（仅供排查，不可枚举，不用于界面提示） */
const FORBIDDEN_BACKEND_MESSAGE = Symbol.for(
  'ai-cloudops.forbiddenBackendMessage',
);

/**
 * 业务码为 403 的响应（HTTP 200）也统一视为无权限。
 * 后端 body 为 `{code:403,message:"无权限访问该接口"}`（后端事实，不变）；
 * 前端统一改写为 PERMISSION_DENIED_MESSAGE，error.message 不带后端原文，
 * 避免页面按 error.message 取文案时透传后端 message（permission-codes.md v3 第 1 节）。
 */
export function createPermissionDeniedError(detail?: string) {
  const error = new Error(
    `Error ${FORBIDDEN_STATUS}: ${PERMISSION_DENIED_MESSAGE}`,
  );
  defineFlag(error, BUSINESS_FORBIDDEN_FLAG);
  setBackendMessage(error, detail ?? '');
  return error;
}

/** 取后端 403 原文（排查用，不用于界面提示）；不是 403 错误时返回空串 */
export function getForbiddenBackendMessage(error: any): string {
  return typeof error?.[FORBIDDEN_BACKEND_MESSAGE] === 'string'
    ? error[FORBIDDEN_BACKEND_MESSAGE]
    : '';
}

function setBackendMessage(target: object, detail: string) {
  Object.defineProperty(target, FORBIDDEN_BACKEND_MESSAGE, {
    configurable: true,
    enumerable: false,
    value: detail,
  });
}

/**
 * HTTP 403：把响应体里的后端 message 改写为统一文案（原文另存，排查用）。
 * RequestClient 会用 response.data 构造抛给页面的错误对象，
 * 不改写的话页面拿到的 error.message / response.data.message 就是后端原文。
 */
function maskForbiddenResponseBody(error: any) {
  const response = error?.response;
  if (!response || typeof response !== 'object') return;
  const data = response.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string') {
      if (data.message === PERMISSION_DENIED_MESSAGE) return;
      setBackendMessage(error, data.message);
      data.message = PERMISSION_DENIED_MESSAGE;
    }
  } else if (typeof data === 'string' && data !== PERMISSION_DENIED_MESSAGE) {
    setBackendMessage(error, data);
    response.data = PERMISSION_DENIED_MESSAGE;
  }
}

export type PermissionDeniedNotifier = (content: string, key: string) => void;

/**
 * 响应拦截器：需注册在通用错误提示拦截器之前。
 * 只处理 403，其它错误原样抛出；同一个错误对象只提示一次
 * （例如 401 刷新后重放的请求再次 403，内外两层拦截链不会重复提示）。
 */
export function createForbiddenResponseInterceptor(
  notify: PermissionDeniedNotifier,
) {
  return {
    rejected: (error: any) => {
      if (isForbiddenResponse(error) && !hasPermissionDeniedFlag(error)) {
        defineFlag(error, PERMISSION_DENIED_FLAG);
        // 同时标记响应体，使 RequestClient 包装后抛给页面的错误对象也带上标记
        defineFlag(error?.response?.data, PERMISSION_DENIED_FLAG, true);
        maskForbiddenResponseBody(error);
        notify(PERMISSION_DENIED_MESSAGE, PERMISSION_DENIED_MESSAGE_KEY);
      }
      return Promise.reject(error);
    },
  };
}
