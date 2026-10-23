/**
 * 该文件可自行根据业务逻辑进行调整
 */
import { useAppConfig } from '@vben/hooks';
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

import { refreshTokenApi } from './core';
import { markHttpErrorNotified } from './http-error-notice';

/** 通用错误提示的 message key 前缀，key 按文案区分 */
export const HTTP_ERROR_MESSAGE_KEY_PREFIX = 'http-error:';

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
      // 业务码 403 同样按无权限处理，由下方统一提示
      if (code === FORBIDDEN_STATUS) {
        throw createPermissionDeniedError(msg);
      }
      // 其它业务错误打上标记，由下方通用错误拦截器弹后端原文并标记已提示
      throw createBusinessError(status, msg);
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
      // 固定 key：同一文案的并发错误（如批量操作碰上 500 / 网络错误）合并为一条
      const key = `${HTTP_ERROR_MESSAGE_KEY_PREFIX}${msg}`;
      const handle = message.error({ content: msg, key });
      // 记下 key 和弹出者，页面需要更具体的文案时先确认这条提示归自己，再用同一个 key 替换
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
