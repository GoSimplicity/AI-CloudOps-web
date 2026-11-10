import { reactive } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readLoginLockState, rememberLoginRetryAfter } from '#/api/login-lock';

import { useAuthStore } from './auth';

const navigation = vi.hoisted(() => ({
  currentRoute: { value: { fullPath: '/auth/login' } },
  push: vi.fn(),
  removeRoute: vi.fn(),
  replace: vi.fn(),
  tabReset: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getAccessCodesApi: vi.fn(),
  getUserInfoApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));
const state = vi.hoisted(() => ({ access: null as any, user: null as any }));

vi.mock('#/router/routes', () => ({ routes: [] }));
vi.mock('#/api', () => api);
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    ...navigation,
    getRoutes: () => [],
    hasRoute: () => false,
    removeRoute: navigation.removeRoute,
  }),
}));
vi.mock('@vben/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => state.access,
  useTabbarStore: () => ({ $reset: navigation.tabReset }),
  useUserStore: () => state.user,
}));

function loginFailure(options: {
  body: unknown;
  headers?: Record<string, string>;
  status: number;
}) {
  const error = {
    config: { url: '/user/login' },
    response: {
      data: options.body,
      headers: options.headers ?? {},
      status: options.status,
    },
  };
  rememberLoginRetryAfter(error);
  return error;
}

describe('登录按钮倒计时', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T00:00:00Z'));
    vi.clearAllMocks();
    state.user = reactive({
      setUserInfo(info: unknown) {
        this.userInfo = info;
      },
      userInfo: { userId: 'previous' } as unknown,
    });
    state.access = reactive({
      accessToken: 'credential' as null | string,
      refreshToken: 'old refresh',
      setAccessCodes: vi.fn(),
      setAccessMenus: vi.fn(),
      setAccessRoutes: vi.fn(),
      setAccessToken(token: null | string) {
        this.accessToken = token;
      },
      setIsAccessChecked: vi.fn(),
      setLoginExpired: vi.fn(),
      setRefreshToken: vi.fn(),
    });
  });

  afterEach(() => {
    useAuthStore().$reset();
    vi.useRealTimers();
  });

  it('retry-After 为 1 时只禁用约 1 秒，到点后可以再登录', async () => {
    const error = loginFailure({
      body: { code: 1, data: {}, message: '请求过于频繁，请稍后再试' },
      headers: { 'Retry-After': '1' },
      status: 429,
    });
    api.loginApi.mockRejectedValueOnce(error);
    const auth = useAuthStore();
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toBe(error);
    expect(auth.loginLockRemainingSeconds).toBe(1);
    expect(formatSeconds(auth.loginLockRemainingSeconds)).toBe('请 1 秒后再试');
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).resolves.toEqual({ userInfo: null });
    expect(api.loginApi).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(auth.loginLockRemainingSeconds).toBe(0);
    api.loginApi.mockRejectedValueOnce(new Error('invalid login'));
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toThrow('invalid login');
    expect(api.loginApi).toHaveBeenCalledTimes(2);
  });

  it('锁定秒数走完后恢复，不用 message 里的向上取整分钟', async () => {
    const error = loginFailure({
      body: {
        code: 1,
        data: null,
        message: '登录失败次数过多，请 2 分钟后再试',
      },
      headers: { 'Retry-After': '2' },
      status: 429,
    });
    expect(readLoginLockState(error).seconds).toBe(2);
    api.loginApi.mockRejectedValueOnce(error);
    const auth = useAuthStore();
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toBe(error);
    expect(auth.loginLockRemainingSeconds).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(auth.loginLockRemainingSeconds).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(auth.loginLockRemainingSeconds).toBe(0);
  });

  it('没有 Retry-After 的 429 默认禁用 1 秒后恢复', async () => {
    const error = loginFailure({
      body: '<html>429</html>',
      status: 429,
    });
    api.loginApi.mockRejectedValueOnce(error);
    const auth = useAuthStore();
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toBe(error);
    expect(auth.loginLockRemainingSeconds).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(auth.loginLockRemainingSeconds).toBe(0);
  });

  it('redis 不可用时不禁用登录', async () => {
    const error = loginFailure({
      body: { code: 1, data: {}, message: '登录服务暂不可用，请稍后重试' },
      status: 503,
    });
    api.loginApi.mockRejectedValue(error);
    const auth = useAuthStore();
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toBe(error);
    expect(auth.loginLockRemainingSeconds).toBe(0);
    await expect(
      auth.authLogin({ password: 'test fixture', username: 'alice' }),
    ).rejects.toBe(error);
    expect(api.loginApi).toHaveBeenCalledTimes(2);
  });
});

function formatSeconds(seconds: number) {
  return seconds < 60 ? `请 ${seconds} 秒后再试` : '';
}
