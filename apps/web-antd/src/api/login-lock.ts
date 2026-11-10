/**
 * 登录接口 `/user/login` 的失败展示。
 *
 * 账号锁定与网关限流都是 HTTP 429。读到 Retry-After 时，提示原文 message，
 * 倒计时只用这个秒数（不足一分钟只显示秒），并禁用登录按钮。
 * 网关不暴露 CORS 头；429 读不到秒数，或正文不是 JSON 时，提示「请求过于频繁，请稍后再试」并按 1 秒倒计时。
 * 登录接口的 HTTP 503（JSON 或 HTML）都是服务暂不可用，不倒计时、不禁用按钮。
 * 失败响应的 data 固定为 {}，判断时不读这个字段。
 * 秒数在请求层包装、丢掉响应头之前记在 Symbol 上。
 */
import { $t } from '@vben/locales';

const LOGIN_RETRY_AFTER = Symbol.for('ai-cloudops.loginRetryAfterSeconds');

/** 读不到 Retry-After 时的默认等待，和 nginx 限流约定的 Retry-After: 1 一致 */
export const LOGIN_RETRY_DEFAULT_SECONDS = 1;

/** 只匹配登录接口本身，不匹配查询串里碰巧出现的路径 */
const LOGIN_ENDPOINT = /(?:^|\/)user\/login\/?$/i;

const UNAVAILABLE = 'unavailable';

export interface LoginLockState {
  /** 目前没有单独的静态提示，倒计时文案由剩余秒数格式化 */
  hint: string;
  /** 大于 0 时禁用登录按钮；503 与非登录错误为 0 */
  seconds: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function responseOf(error: unknown): {
  data?: unknown;
  headers?: unknown;
  status?: unknown;
} {
  if (!isRecord(error) || !isRecord(error.response)) return {};
  return error.response;
}

/** 响应正文。不是信封里的 data 字段 */
function responseBody(error: unknown): unknown {
  return responseOf(error).data;
}

function isLoginStatus(status: unknown): status is 429 | 503 {
  return status === 429 || status === 503;
}

/** JSON 对象才算后端信封。HTML 字符串、null、数组都按非 JSON 处理，避免去读 data */
export function isLoginJsonBody(body: unknown): boolean {
  return !!body && typeof body === 'object' && !Array.isArray(body);
}

export function isLoginRequest(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.config)) return false;
  const url = error.config.url;
  if (typeof url !== 'string') return false;
  let path: string;
  try {
    path = decodeURIComponent(url).trim();
  } catch {
    return false;
  }
  const pathname = path.split(/[#?]/)[0] ?? path;
  return LOGIN_ENDPOINT.test(pathname);
}

function headerValue(headers: unknown): unknown {
  if (!isRecord(headers)) return undefined;
  const get = headers.get;
  if (typeof get === 'function') {
    const viaGet = (get as (name: string) => unknown).call(
      headers,
      'Retry-After',
    );
    if (viaGet !== null && viaGet !== undefined && viaGet !== '') {
      return viaGet;
    }
  }
  if ('retry-after' in headers) return headers['retry-after'];
  if ('Retry-After' in headers) return headers['Retry-After'];
  return undefined;
}

/** 非负整数秒才算读到了 Retry-After。缺失和非法分开，避免把 0 秒当成没读到 */
export function parseRetryAfterSeconds(
  value: unknown,
): 'absent' | 'invalid' | number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === null || raw === undefined || raw === '') return 'absent';
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0) return 'invalid';
    return raw;
  }
  if (typeof raw !== 'string') return 'invalid';
  const text = raw.trim();
  if (!text) return 'absent';
  if (!/^\d+$/.test(text)) return 'invalid';
  const seconds = Number(text);
  if (!Number.isSafeInteger(seconds)) return 'invalid';
  return seconds;
}

function retryAfterOf(error: unknown): 'absent' | 'invalid' | number {
  return parseRetryAfterSeconds(headerValue(responseOf(error).headers));
}

function storedFailure(error: object): 'unavailable' | number | undefined {
  if (!(LOGIN_RETRY_AFTER in error)) return undefined;
  const stored = (error as { [LOGIN_RETRY_AFTER]?: unknown })[
    LOGIN_RETRY_AFTER
  ];
  if (stored === UNAVAILABLE) return UNAVAILABLE;
  if (
    typeof stored === 'number' &&
    Number.isSafeInteger(stored) &&
    stored >= 0
  ) {
    return stored;
  }
  return undefined;
}

function defineHidden(target: object, value: 'unavailable' | number) {
  try {
    Object.defineProperty(target, LOGIN_RETRY_AFTER, {
      configurable: true,
      enumerable: false,
      value,
    });
  } catch {
    // 冻结对象写不上标记：调用方仍可按原始响应头判断
  }
}

function classifyLoginFailure(
  error: unknown,
): 'unavailable' | number | undefined {
  if (!isLoginRequest(error)) return undefined;
  const status = responseOf(error).status;
  if (!isLoginStatus(status)) return undefined;
  if (status === 503) return UNAVAILABLE;
  const retryAfter = retryAfterOf(error);
  if (typeof retryAfter === 'number') return retryAfter > 0 ? retryAfter : 0;
  return LOGIN_RETRY_DEFAULT_SECONDS;
}

/**
 * 登录 429 / 503 在离开拦截器之前调用。
 * 数字是倒计时秒数（含 429 默认的 1 秒）；`unavailable` 表示登录 503，不倒计时。
 */
export function rememberLoginRetryAfter(error: unknown) {
  if (!isRecord(error)) return;
  const failure = classifyLoginFailure(error);
  if (failure === undefined) return;
  defineHidden(error, failure);
}

/** 只读 message，不读 data。正文不是对象时返回空串，不抛错 */
export function readBackendMessage(body: unknown): string {
  if (!isLoginJsonBody(body)) return '';
  const message = (body as { message?: unknown }).message;
  if (typeof message !== 'string') return '';
  return message.replaceAll(/\s*[\n\r]\s*/g, ' ').trim();
}

function backendMessageOf(error: unknown): string {
  const fromBody = readBackendMessage(responseBody(error));
  if (fromBody) return fromBody;
  return readBackendMessage(error);
}

/** 把秒数换成倒计时。不足一分钟只显示秒 */
export function formatLoginLockCountdown(totalSeconds: number): string {
  const whole = Math.floor(totalSeconds);
  if (!Number.isSafeInteger(whole) || whole <= 0) return '';
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  if (minutes > 0) {
    return $t('authentication.loginRetryAfter', { minutes, seconds });
  }
  return $t('authentication.loginRetryAfterSeconds', { seconds });
}

function jsonRetryMessage(error: unknown, seconds: number): string {
  const message = backendMessageOf(error);
  if (message) return message;
  if (seconds < 60) return formatLoginLockCountdown(seconds);
  return $t('authentication.loginRateLimited');
}

/**
 * 登录 429 / 503 的请求层提示。其它接口返回 undefined，沿用原来的文案。
 * 有可读秒数且正文是 JSON 的 429 用后端 message；429 兜底用频率限制文案。
 * 登录 503 一律提示服务暂不可用，不看正文是不是 JSON。
 */
export function resolveLoginHttpErrorMessage(
  error: unknown,
): string | undefined {
  if (!isLoginRequest(error)) return undefined;
  const status = responseOf(error).status;
  if (!isLoginStatus(status)) return undefined;
  if (status === 503) return $t('authentication.loginUnavailable');
  const retryAfter = retryAfterOf(error);
  if (
    status === 429 &&
    typeof retryAfter === 'number' &&
    retryAfter > 0 &&
    isLoginJsonBody(responseBody(error))
  ) {
    return jsonRetryMessage(error, retryAfter);
  }
  return $t('authentication.loginTooManyRequests');
}

/** 登录失败后是否倒计时。不读 data 字段 */
export function readLoginLockState(error: unknown): LoginLockState {
  if (isRecord(error)) {
    const stored = storedFailure(error);
    if (stored === UNAVAILABLE) return { hint: '', seconds: 0 };
    if (typeof stored === 'number') return { hint: '', seconds: stored };
  }
  const failure = classifyLoginFailure(error);
  if (failure === UNAVAILABLE || failure === undefined) {
    return { hint: '', seconds: 0 };
  }
  return { hint: '', seconds: failure };
}
