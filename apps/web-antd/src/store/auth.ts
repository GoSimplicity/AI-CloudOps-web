import type { LoginAndRegisterParams } from '@vben/common-ui';
import type { UserInfo } from '@vben/types';

import { onScopeDispose, ref } from 'vue';
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
import { readLoginLockState } from '#/api/login-lock';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const authGeneration = ref(0);
  /** Retry-After 剩余秒数。大于 0 时登录按钮禁用，到 0 后恢复 */
  const loginLockRemainingSeconds = ref(0);
  /** 不倒计时时的页面提示。登录 429 的兜底改走 1 秒倒计时，这里通常为空 */
  const loginLockHint = ref('');
  let loginLockedUntil = 0;
  let loginLockTimer: ReturnType<typeof setInterval> | undefined;

  function clearLoginLockTimer() {
    if (loginLockTimer === undefined) return;
    clearInterval(loginLockTimer);
    loginLockTimer = undefined;
  }

  function syncLoginLock() {
    const remaining = Math.ceil((loginLockedUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      loginLockedUntil = 0;
      loginLockRemainingSeconds.value = 0;
      clearLoginLockTimer();
      return;
    }
    loginLockRemainingSeconds.value = remaining;
  }

  function startLoginLock(seconds: number) {
    loginLockHint.value = '';
    loginLockedUntil = Date.now() + seconds * 1000;
    syncLoginLock();
    if (loginLockTimer !== undefined) return;
    // 用截止时间换算剩余秒，间隔只负责刷新，避免定时器漂移改掉 Retry-After
    loginLockTimer = setInterval(syncLoginLock, 250);
  }

  function clearLoginLock() {
    loginLockedUntil = 0;
    loginLockRemainingSeconds.value = 0;
    loginLockHint.value = '';
    clearLoginLockTimer();
  }

  function applyLoginLock(error: unknown) {
    const next = readLoginLockState(error);
    if (next.seconds > 0) {
      startLoginLock(next.seconds);
      return;
    }
    if (next.hint) loginLockHint.value = next.hint;
  }

  onScopeDispose(clearLoginLockTimer);

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
    if (loginLockRemainingSeconds.value > 0) return { userInfo: null };
    loginLockHint.value = '';
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    const generation = ++authGeneration.value;
    userStore.setUserInfo(null);
    clearAccountAccess();
    accessStore.setAccessToken(null);
    accessStore.setRefreshToken(null);
    try {
      loginLoading.value = true;
      const { accessToken, refreshToken } = await loginApi(params);
      if (generation !== authGeneration.value) throw new Error('登录已取消');
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

        if (generation !== authGeneration.value) throw new Error('登录已取消');
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
    } catch (error) {
      applyLoginLock(error);
      throw error;
    } finally {
      if (generation === authGeneration.value) loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true, callApi: boolean = true) {
    const generation = ++authGeneration.value;
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

    if (generation !== authGeneration.value) return;
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
    const generation = authGeneration.value;
    const owner = userStore.userInfo?.userId;
    userInfo = await getUserInfoApi();
    if (
      generation !== authGeneration.value ||
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
    authGeneration.value++;
    loginLoading.value = false;
    clearLoginLock();
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    getAuthGeneration: () => authGeneration.value,
    loginLoading,
    loginLockHint,
    loginLockRemainingSeconds,
    logout,
  };
});
