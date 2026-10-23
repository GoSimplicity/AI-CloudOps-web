import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createRouterGuard } from './guard';
const state = vi.hoisted(() => ({
  access: null as any,
  user: null as any,
  generation: 0,
}));
const access = vi.hoisted(() => ({ generateAccess: vi.fn() }));
vi.mock('./access', () => access);
vi.mock('#/router/routes', () => ({
  coreRouteNames: ['Login'],
  dynamicRoutes: [],
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => state.generation }),
}));
vi.mock('@vben/preferences', () => ({
  preferences: {
    transition: { progress: false },
    app: { dynamicTitle: false },
  },
}));
vi.mock('#/locales', () => ({ $t: (value: string) => value }));
beforeEach(() => {
  vi.clearAllMocks();
  state.generation = 0;
  state.user = { userInfo: { userId: '1', roles: ['old-role'] } };
  state.access = {
    accessToken: 'old-token',
    isAccessChecked: false,
    setAccessMenus: vi.fn(),
    setAccessRoutes: vi.fn(),
    setIsAccessChecked: vi.fn(),
  };
});
describe('路由守卫账户归属', () => {
  it.each([true, false])(
    '账户变化后迟到权限生成%s不会回填旧菜单',
    async (success) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [],
      });
      const before = vi.spyOn(router, 'beforeEach');
      createRouterGuard(router);
      const guard = before.mock.calls[1]![0];
      const pending = Promise.withResolvers<any>();
      access.generateAccess.mockReturnValue(pending.promise);
      const task = Promise.resolve(
        guard.call(
          undefined,
          { name: 'Private', fullPath: '/private', meta: {} } as any,
          { query: {} } as any,
          vi.fn(),
        ),
      );
      state.generation++;
      state.user.userInfo = { userId: '2' };
      state.access.accessToken = 'next-token';
      if (success)
        pending.resolve({
          accessibleMenus: [{ name: 'Old private menu' }],
          accessibleRoutes: [],
        });
      else pending.reject(new Error('old generation failed'));
      expect(await task).toBe(false);
      expect(state.access.setAccessMenus).not.toHaveBeenCalled();
      expect(state.access.setIsAccessChecked).not.toHaveBeenCalled();
    },
  );
});
