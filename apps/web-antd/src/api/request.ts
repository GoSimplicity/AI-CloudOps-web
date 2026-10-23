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

function createRequestClient(baseURL: string) {
  const ownerScope = createRequestOwnerScope(() => ({
    uid: useUserStore().userInfo?.userId || '',
    generation: useAuthStore().getAuthGeneration(),
    authenticated: !!useAccessStore().accessToken,
  }));
  const client = new RequestClient({ baseURL, requestOwnerScope: ownerScope });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
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
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken(): Promise<string> {
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
      message.error(msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL);
export const requestClientAIOps = createRequestClient(aiopsURL);

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
