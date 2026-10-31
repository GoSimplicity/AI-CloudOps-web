/**
 * 该文件可自行根据业务逻辑进行调整
 */
import { useAppConfig } from '@vben/hooks';
import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  createRequestOwnerScope,
  isCancel,
  errorMessageResponseInterceptor,
  RequestClient,
  RequestOwnerChangedError,
} from '@vben/request';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import {
  HTTP_CONFLICT_MESSAGE,
  HTTP_TOO_MANY_REQUESTS_MESSAGE,
} from '#/constants/http-error-messages';
import { useAuthStore } from '#/store';
import {
  createBusinessError,
  notifyBusinessError,
} from '#/utils/permission/business-error';
import {
  createForbiddenResponseInterceptor,
  createPermissionDeniedError,
  FORBIDDEN_STATUS,
  isPermissionDeniedError,
} from '#/utils/permission/forbidden';
import {
  markRequestLayerNotice,
  markRequestLayerTrace,
} from '#/utils/permission/request-notice';

import { refreshTokenApi } from './core';
import { markHttpErrorNotified } from './http-error-notice';

/** 通用错误提示的 message key 前缀，key 按文案区分 */
export const HTTP_ERROR_MESSAGE_KEY_PREFIX = 'http-error:';

/** HTTP 409 / 429 的通用提示（FE-02b）：常量收口在 constants/http-error-messages.ts，这里转出保持原导入路径可用 */
export { HTTP_CONFLICT_MESSAGE, HTTP_TOO_MANY_REQUESTS_MESSAGE };

/** HTTP 400 显示后端原文时的最大长度（FE-02b incr3 P2-2） */
export const HTTP_BAD_REQUEST_DETAIL_MAX_LENGTH = 200;

/** 后端 400 原文：取 data.message（兼容 data.error.message），去换行、截断；没有可用原文返回空串 */
function readBadRequestDetail(data: any): string {
  const raw =
    typeof data?.message === 'string'
      ? data.message
      : typeof data?.error?.message === 'string'
        ? data.error.message
        : '';
  const text = raw.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return [...text].slice(0, HTTP_BAD_REQUEST_DETAIL_MAX_LENGTH).join('');
}

/**
 * 敏感接口（incr4 P2-1）：400 一律用通用文案，不透出后端原文。
 * - autofix：SEC-26 规则 3，autofix 错误提示不透出后端 message（窝窝头 2026-10-24）；
 * - Secret：后端 400 可能回显用户提交的 Secret 数据（复审 P2-1）。
 * 路径判断（incr4 P3-B）只看 error.config.url，不看 baseURL、也不区分 client：
 * 1. decodeURIComponent 一次（认 %2F 编码的斜杠、%20 等）后再 trim（原文首尾空白与编码的 %20 都去掉）；
 *    解码失败（不完整或非法的百分号编码）按敏感接口处理（fail closed）；
 * 2. 敏感段必须是独立路径段：前面是开头或 `/`，后面是 `/`、`?`、`#`、`;` 或结尾，可带 `.json` 后缀，大小写不敏感；
 *    所以 `/k8s/autofixer`、`/autofix-tasks`、`/k8s/secretary` 不算；
 * 3. 查询串、hash 里出现 `/autofix`、`/secret` 也会命中（偏保守，少透出）；
 * 4. 只解码一次，双重编码（%252F）不认；没有 url 的错误按非敏感处理（现有调用都带 url）。
 */
const URL_DECODE_FAILED = Symbol('url-decode-failed');

function readRequestPath(
  error: any,
): string | typeof URL_DECODE_FAILED | undefined {
  const url = error?.config?.url;
  if (typeof url !== 'string') return undefined;
  try {
    return decodeURIComponent(url).trim();
  } catch {
    return URL_DECODE_FAILED;
  }
}

const sensitiveSegmentPattern = (segment: string) =>
  new RegExp(String.raw`(?:^|/)${segment}(?:\.json)?(?=[/?#;]|$)`, 'i');

/** autofix 接口：独立的 autofix 段（/autofix、/autofix/…、…/api/v1/autofix/…） */
const AUTOFIX_SEGMENT_PATTERN = sensitiveSegmentPattern('autofix');
/** Secret 接口：独立的 secret / secrets 段（/k8s/secret/…，含 sec26 的 …/reveal；复数为 K8s 原生写法） */
const SECRET_SEGMENT_PATTERN = sensitiveSegmentPattern('secrets?');
const MANAGED_CLOUD_PATTERN = /(?:^|\/)tree\/cloud\/managed(?=[/?#;]|$)/i;
const NOTIFICATION_ACCESS_PATTERN =
  /(?:^|\/)(?:workorder\/notification\/(?:events|inbox)|user\/permissions)(?=[/?#;]|$)/i;

function matchesSensitivePath(error: any, pattern: RegExp): boolean {
  const path = readRequestPath(error);
  if (path === URL_DECODE_FAILED) return true;
  return typeof path === 'string' && pattern.test(path);
}

export function isAutofixRequest(error: any): boolean {
  return matchesSensitivePath(error, AUTOFIX_SEGMENT_PATTERN);
}

export function isSecretRequest(error: any): boolean {
  return matchesSensitivePath(error, SECRET_SEGMENT_PATTERN);
}

function isNotificationAccessRequest(error: any): boolean {
  const path = readRequestPath(error);
  if (typeof path === 'string') return NOTIFICATION_ACCESS_PATTERN.test(path);
  return (
    path === URL_DECODE_FAILED &&
    typeof error?.config?.url === 'string' &&
    NOTIFICATION_ACCESS_PATTERN.test(error.config.url)
  );
}

function isManagedCloudRequest(error: any): boolean {
  const path = readRequestPath(error);
  if (typeof path === 'string') return MANAGED_CLOUD_PATTERN.test(path);
  return (
    path === URL_DECODE_FAILED &&
    typeof error?.config?.url === 'string' &&
    MANAGED_CLOUD_PATTERN.test(error.config.url)
  );
}

export function isSensitiveRequest(error: any): boolean {
  return (
    isAutofixRequest(error) ||
    isSecretRequest(error) ||
    isNotificationAccessRequest(error) ||
    isManagedCloudRequest(error)
  );
}

/**
 * 按错误改写通用错误拦截器给出的文案（只用于 HTTP / 传输层错误，业务错误不经过这里）：
 * - 400：显示后端原文（去换行、截断到 200 字），原文为空时用通用文案（FE-02b incr3 P2-2）；
 *   敏感接口除外（isSensitiveRequest：autofix 与 Secret 相关路径，仍用通用文案，incr4 P2-1）；
 * - 409 / 429：专门文案（不带错误码）；
 * - 浏览器中止请求（xhr onabort / onloadend status 0 → AxiosError code ECONNABORTED，没有 response）：
 *   packages 里既不算网络错误也不算超时，落到「内部服务器错误」；这里按网络异常提示。
 *   只看 code 与「不是超时」，不依赖 'Request aborted' 原文（incr3 P3-2，axios 1.20 行为由用例锁定）；
 *   「是不是超时」与 packages 一致，大小写敏感地找 'timeout'（incr4 nit），packages 没判成超时的都按网络异常；
 * - 其余（401/403/5xx 等）保持原文案。
 */
export function resolveHttpErrorMessage(msg: string, error: any): string {
  const status = error?.response?.status;
  if (status === 400) {
    if (isSensitiveRequest(error)) return msg;
    return readBadRequestDetail(error.response.data) || msg;
  }
  if (status === 409) return HTTP_CONFLICT_MESSAGE;
  if (status === 429) return HTTP_TOO_MANY_REQUESTS_MESSAGE;
  if (
    !error?.response &&
    error?.code === 'ECONNABORTED' &&
    !String(error?.message ?? '').includes('timeout')
  ) {
    return $t('fallback.http.networkError');
  }
  return msg;
}

const { apiURL, aiopsURL: configuredAiopsURL } = useAppConfig(
  import.meta.env,
  import.meta.env.PROD,
);

function resolveAiopsURL(aiopsURL: string) {
  if (import.meta.env.PROD) {
    return aiopsURL;
  }

  try {
    const parsed = new URL(aiopsURL);
    if (
      ['127.0.0.1', 'localhost'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/api/v1')
    ) {
      return '/api/v1';
    }
  } catch {
    return aiopsURL;
  }

  return aiopsURL;
}

const aiopsURL = resolveAiopsURL(configuredAiopsURL);

/** 长连接（日志 SSE、终端 WS）刷新失败时的重新登录提示，固定 key 合并为一条 */
export const LOGIN_EXPIRED_MESSAGE = '登录已过期，请重新登录';
export const LOGIN_EXPIRED_MESSAGE_KEY = 'auth:login-expired';

/**
 * 同一登录代际只发一个刷新请求：HTTP 401 拦截器、日志 SSE、终端 WS 共用同一个 promise，
 * 避免并发刷新时旧的 refreshToken 被后一次刷新顶掉
 */
const sharedRefreshes = new Map<string, Promise<string>>();

function refreshGenerationKey() {
  return `${useUserStore().userInfo?.userId || ''}:${useAuthStore().getAuthGeneration()}`;
}

function shareRefresh(run: () => Promise<string>): Promise<string> {
  const key = refreshGenerationKey();
  const pending = sharedRefreshes.get(key);
  if (pending) return pending;
  const refresh = Promise.resolve()
    .then(run)
    .finally(() => {
      if (sharedRefreshes.get(key) === refresh) sharedRefreshes.delete(key);
    });
  sharedRefreshes.set(key, refresh);
  return refresh;
}

let pendingReAuthenticate: null | Promise<void> = null;

/**
 * 重新认证逻辑（登录过期处理）：并发调用合并为一次
 */
function reAuthenticate(): Promise<void> {
  if (pendingReAuthenticate) return pendingReAuthenticate;
  pendingReAuthenticate = (async () => {
    console.warn('Access token or refresh token is invalid or expired.');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();

    // 清除 accessToken
    accessStore.setAccessToken(null);

    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      // 执行登出，但不调用远程 API 避免循环认证问题
      await authStore.logout(true, false);
    }
  })().finally(() => {
    pendingReAuthenticate = null;
  });
  return pendingReAuthenticate;
}

let mainClientRefresh: (() => Promise<string>) | null = null;

/**
 * 长连接的登录过期处理：只提示一条（固定 key），并复用 HTTP 的登录过期处理
 */
export async function notifyStreamLoginExpired(): Promise<void> {
  message.warning({
    content: LOGIN_EXPIRED_MESSAGE,
    key: LOGIN_EXPIRED_MESSAGE_KEY,
  });
  await reAuthenticate();
}

/**
 * 日志 SSE、终端 WS 遇到 401 或握手失败时调用：走与 HTTP 相同的刷新流程（单飞）。
 * 成功返回新 token；失败返回 null，并已提示重新登录（账户已切换时不提示、也不清理新账户凭证）
 */
export async function refreshAccessTokenForStream(): Promise<null | string> {
  if (!preferences.app.enableRefreshToken || !mainClientRefresh) {
    await notifyStreamLoginExpired();
    return null;
  }
  try {
    return await mainClientRefresh();
  } catch (error) {
    if (error instanceof RequestOwnerChangedError) return null;
    await notifyStreamLoginExpired();
    return null;
  }
}

function createRequestClient(baseURL: string) {
  const ownerScope = createRequestOwnerScope(() => ({
    uid: useUserStore().userInfo?.userId || '',
    generation: useAuthStore().getAuthGeneration(),
    authenticated: !!useAccessStore().accessToken,
  }));
  const client = new RequestClient({ baseURL, requestOwnerScope: ownerScope });

  const doReAuthenticate = reAuthenticate;

  /**
   * 刷新token逻辑
   */
  function doRefreshToken(): Promise<string> {
    return shareRefresh(refreshTokenOnce);
  }

  async function refreshTokenOnce(): Promise<string> {
    const accessStore = useAccessStore();

    // 检查 refreshToken 是否存在
    const refreshToken = accessStore.refreshToken;
    const owner = ownerScope.capture();
    if (!refreshToken) {
      console.error('Refresh token is missing or null.');
      throw new Error('Refresh token is missing or null.'); // 抛出异常，确保不会返回 null
    }

    try {
      // 调用 refreshTokenApi，确保传入 refreshToken
      const newToken = await refreshTokenApi({ refreshToken });
      // 检查 newToken 是否为 undefined 或 null
      if (!newToken) {
        console.error('New token is null or undefined.');
        throw new Error('New token is null or undefined.');
      }
      // 更新 accessToken
      ownerScope.assert(owner);
      accessStore.setAccessToken(newToken);

      // 返回新的 token
      return newToken;
    } catch (error) {
      if (!isCancel(error)) console.warn('Access token refresh failed');
      throw error;
    }
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: (config) => {
      ownerScope.bindRequest(config);
      const accessStore = useAccessStore();

      const currentToken = accessStore.accessToken;
      config.headers.Authorization = formatToken(currentToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  client.addResponseInterceptor(ownerScope.response);

  // response数据解构
  client.addResponseInterceptor({
    fulfilled: (response) => {
      const { data: responseData, status, config } = response;

      // 如果是blob响应（文件下载），直接返回blob数据
      if (config?.responseType === 'blob' && responseData instanceof Blob) {
        return responseData;
      }

      // 处理常规JSON响应
      const { code, data, message: msg } = responseData;
      if (status >= 200 && status < 400 && code === 0) {
        return data;
      }
      const eventRequest = isNotificationAccessRequest({ config });
      const managedRequest = isManagedCloudRequest({ config });
      // 业务码 403 同样按无权限处理，由下方统一提示
      if (code === FORBIDDEN_STATUS) {
        throw createPermissionDeniedError(
          eventRequest || managedRequest ? '没有权限执行此操作' : msg,
        );
      }
      // 其它业务错误打上标记，由下方通用错误拦截器弹后端原文并标记已提示
      const safeMessage = eventRequest
        ? '通知事件操作未完成，请先核对当前状态'
        : managedRequest
          ? '托管资源操作未完成，请先核对当前状态'
          : msg;
      throw createBusinessError(status, safeMessage);
    },
  });

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      ownerScope,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 无权限（403）统一提示：同一请求只提示一次，并发 403 通过固定 key 合并为一条
  client.addResponseInterceptor(
    createForbiddenResponseInterceptor((content, key) =>
      message.error({ content, key }),
    ),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  // 业务错误（code≠0）弹后端原文，取代通用的「内部服务器错误」，同文案同 key 合并；
  // 已由 403 拦截器提示过的错误不再重复提示
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error: any) => {
      // 标记经过了请求层（页面 looksNotifiedByRequestLayer 只认经过这里的错误，incr3 P3-3）
      markRequestLayerTrace(error);
      if (
        notifyBusinessError(
          error,
          (content, key) => message.error({ content, key }),
          msg,
        )
      ) {
        return;
      }
      if (isPermissionDeniedError(error)) return;
      if (isNotificationAccessRequest(error) || isManagedCloudRequest(error)) {
        const content = isNotificationAccessRequest(error)
          ? '通知事件操作未完成，请先核对当前状态'
          : '托管资源操作未完成，请先核对当前状态';
        const key = `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${content}`;
        const handle = message.error({ content, key });
        markRequestLayerNotice(error, key);
        markHttpErrorNotified(error, key, handle);
        return;
      }
      // 400 / 409 / 429 / 浏览器中止请求改写文案（FE-02b，见 resolveHttpErrorMessage）
      const content = resolveHttpErrorMessage(msg, error);
      // 固定 key：同一文案的并发错误（如批量操作碰上 500 / 网络错误）合并为一条
      const key = `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${content}`;
      const handle = message.error({ content, key });
      markRequestLayerNotice(error, key);
      // Preserve notice ownership so Secret/autofix can replace only their own message.
      markHttpErrorNotified(error, key, handle);
    }),
  );

  return { client, doRefreshToken };
}

const mainClient = createRequestClient(apiURL);
mainClientRefresh = mainClient.doRefreshToken;

export const requestClient = mainClient.client;
export const requestClientAIOps = createRequestClient(aiopsURL).client;

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
