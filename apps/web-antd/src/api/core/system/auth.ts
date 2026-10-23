import type { AxiosResponse } from 'axios';

import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password: string;
    username: string;
  }

  /** 刷新token接口参数 */
  export interface RefreshTokenParams {
    refreshToken: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    desc: string;
    realName: string;
    userId: string;
    username: string;
  }

  export interface RefreshTokenResult {
    code: number;
    data: string;
    message: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/user/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi(data: AuthApi.RefreshTokenParams) {
  const response = await baseRequestClient.post<
    AxiosResponse<AuthApi.RefreshTokenResult>
  >('/user/refresh_token', data, {
    withCredentials: true,
  });
  const result = response.data;
  if (
    result.code !== 0 ||
    typeof result.data !== 'string' ||
    !result.data.trim()
  ) {
    throw new Error('刷新令牌失败，请重新登录');
  }
  return result.data;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/user/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/user/codes');
}
