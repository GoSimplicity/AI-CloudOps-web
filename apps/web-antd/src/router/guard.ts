import type { Router } from 'vue-router';

import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { useTitle } from '@vueuse/core';

import { $t } from '#/locales';
import { coreRouteNames, dynamicRoutes } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach(async (to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行
    // 总是记录已加载路径，避免页面重复刷新
    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }

    // 动态修改标题
    if (preferences.app.dynamicTitle) {
      const { title } = to.meta;
      // useTitle(`${$t(title)} - ${preferences.app.name}`);
      useTitle(`${$t(title)} - ${preferences.app.name}`);
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) || DEFAULT_HOME_PATH,
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          query: { redirect: encodeURIComponent(to.fullPath) },
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    const generation = authStore.getAuthGeneration();
    const owner = userStore.userInfo?.userId;
    const isCurrent = () =>
      generation === authStore.getAuthGeneration() &&
      !!accessStore.accessToken &&
      (!owner || owner === userStore.userInfo?.userId);
    const assertCurrent = () => {
      if (!isCurrent()) throw new Error('账户已变化，忽略过期权限路由');
    };
    try {
      const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
      assertCurrent();
      const { accessibleMenus, accessibleRoutes } = await generateAccess({
        roles: userInfo.roles ?? [],
        router,
        routes: dynamicRoutes,
        assertCurrent,
      });
      assertCurrent();
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);
      const redirectPath = (from.query.redirect ?? to.fullPath) as string;
      return {
        ...router.resolve(decodeURIComponent(redirectPath)),
        replace: true,
      };
    } catch (error) {
      if (!isCurrent()) return false;
      throw error;
    }
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
