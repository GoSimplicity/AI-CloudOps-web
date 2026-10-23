import type { LoginAndRegisterParams } from '@vben/common-ui';
import type { UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@vben/constants';
import {
  resetAllStores,
  useAccessStore,
  useTabbarStore,
  useUserStore,
} from '@vben/stores';

import { resetStaticRoutes } from '@vben/utils';
import { routes } from '#/router/routes';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  let authGeneration = 0;

  function clearAccountAccess() {
    accessStore.setIsAccessChecked(false);
    accessStore.setAccessCodes([]);
    accessStore.setAccessMenus([]);
    accessStore.setAccessRoutes([]);
    useTabbarStore().$reset();
    resetStaticRoutes(router, routes);
  }

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   * @param onSuccess
   */
  async function authLogin(
    params: LoginAndRegisterParams,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    const generation = ++authGeneration;
    userStore.setUserInfo(null);
    clearAccountAccess();
    accessStore.setAccessToken(null);
    accessStore.setRefreshToken(null);
    try {
      loginLoading.value = true;
      const { accessToken, refreshToken } = await loginApi(params);
      if (generation !== authGeneration) throw new Error('登录已取消');
      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);
        if (refreshToken) {
          accessStore.setRefreshToken(refreshToken);
        }
        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);

        if (generation !== authGeneration) throw new Error('登录已取消');
        userInfo = fetchUserInfoResult;
        const basicUserInfo = {
          ...userInfo,
          realName: userInfo.real_name || '',
          userId: String(userInfo.id || ''),
        };
        userStore.setUserInfo(basicUserInfo);
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
          await router.replace(router.currentRoute.value.fullPath);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(userInfo.homePath || DEFAULT_HOME_PATH);
        }

        if (userInfo?.real_name) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.real_name}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      if (generation === authGeneration) loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true, callApi: boolean = true) {
    const generation = ++authGeneration;
    userStore.setUserInfo(null);
    clearAccountAccess();
    // 只有在非令牌过期的情况下才调用 logout API
    if (callApi) {
      try {
        await logoutApi();
      } catch (error) {
        // 如果 logout API 失败，记录错误但继续执行本地清理
        console.warn(
          'Logout API failed, proceeding with local cleanup:',
          error,
        );
      }
    }

    if (generation !== authGeneration) return;
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登陆页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    const generation = authGeneration;
    const owner = userStore.userInfo?.userId;
    userInfo = await getUserInfoApi();
    if (
      generation !== authGeneration ||
      (owner && owner !== userStore.userInfo?.userId) ||
      !accessStore.accessToken
    ) {
      throw new Error('账户已变化，忽略过期资料');
    }
    const basicUserInfo = {
      ...userInfo,
      realName: userInfo.real_name || '',
      userId: String(userInfo.id || ''),
    };
    userStore.setUserInfo(basicUserInfo);
    return userInfo;
  }

  function $reset() {
    authGeneration++;
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    getAuthGeneration: () => authGeneration,
    loginLoading,
    logout,
  };
});
