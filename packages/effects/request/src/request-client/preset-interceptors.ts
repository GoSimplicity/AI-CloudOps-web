import type { RequestClient } from './request-client';
import type { MakeErrorMessageFn, ResponseInterceptorConfig } from './types';

import { $t } from '@vben/locales';

import axios from 'axios';
import {
  RequestOwnerChangedError,
  type RequestOwnerScope,
} from './owner-scope';

export const authenticateResponseInterceptor = ({
  client,
  doReAuthenticate,
  doRefreshToken,
  enableRefreshToken,
  formatToken,
  ownerScope,
}: {
  client: RequestClient;
  doReAuthenticate: () => Promise<void>;
  doRefreshToken: () => Promise<string>;
  enableRefreshToken: boolean;
  formatToken: (token: string) => null | string;
  ownerScope?: RequestOwnerScope;
}): ResponseInterceptorConfig => {
  // 每个登录代际共享刷新，新账户不等待前账户的刷新请求
  const refreshes = new Map<string, Promise<string>>();
  return {
    rejected: async (error) => {
      const { config, response } = error;
      if (response?.status !== 401) throw error;
      ownerScope?.assertRequest(config);
      if (ownerScope && !ownerScope.canRefresh(config)) throw error;
      if (!enableRefreshToken || config.__isRetryRequest) {
        await doReAuthenticate();
        throw error;
      }
      config.__isRetryRequest = true;
      const key = ownerScope?.refreshKey(config) ?? 'default';
      let pending = refreshes.get(key);
      if (!pending) {
        const refresh = Promise.resolve()
          .then(doRefreshToken)
          .then((token) => {
            ownerScope?.assertRequest(config);
            if (typeof token !== 'string' || !token.trim())
              throw new Error('刷新令牌为空');
            return token;
          })
          .catch(async (refreshError) => {
            // 过期刷新不得清除或重放新账户的凭证与请求
            ownerScope?.assertRequest(config);
            if (!(refreshError instanceof RequestOwnerChangedError))
              await doReAuthenticate();
            throw refreshError;
          })
          .finally(() => {
            if (refreshes.get(key) === refresh) refreshes.delete(key);
          });
        refreshes.set(key, refresh);
        pending = refresh;
      }
      const token = await pending;
      ownerScope?.assertRequest(config);
      config.headers.Authorization = formatToken(token);
      return client.request(config.url, { ...config });
    },
  };
};

export const errorMessageResponseInterceptor = (
  makeErrorMessage?: MakeErrorMessageFn,
): ResponseInterceptorConfig => {
  return {
    rejected: (error: any) => {
      if (axios.isCancel(error) || error instanceof RequestOwnerChangedError) {
        return Promise.reject(error);
      }

      const err: string = error?.toString?.() ?? '';
      let errMsg = '';
      if (err?.includes('Network Error')) {
        errMsg = $t('fallback.http.networkError');
      } else if (error?.message?.includes?.('timeout')) {
        errMsg = $t('fallback.http.requestTimeout');
      }
      if (errMsg) {
        makeErrorMessage?.(errMsg, error);
        return Promise.reject(error);
      }

      let errorMessage = error?.response?.data?.error?.message ?? '';
      const status = error?.response?.status;

      switch (status) {
        case 400: {
          errorMessage = $t('fallback.http.badRequest');
          break;
        }
        case 401: {
          errorMessage = $t('fallback.http.unauthorized');
          break;
        }
        case 403: {
          errorMessage = $t('fallback.http.forbidden');
          break;
        }
        case 404: {
          errorMessage = $t('fallback.http.notFound');
          break;
        }
        case 408: {
          errorMessage = $t('fallback.http.requestTimeout');
          break;
        }
        default: {
          errorMessage = $t('fallback.http.internalServerError');
        }
      }
      makeErrorMessage?.(errorMessage, error);
      return Promise.reject(error);
    },
  };
};
