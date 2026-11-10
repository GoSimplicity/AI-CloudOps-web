import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { nextTick, reactive } from 'vue';

import { i18n } from '@vben/locales';

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rememberLoginRetryAfter } from '#/api/login-lock';
import { useAuthStore } from '#/store';

import Login from './login.vue';

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
    currentRoute: { value: { fullPath: '/auth/login' } },
    getRoutes: () => [],
    hasRoute: () => false,
    push: vi.fn(),
    removeRoute: vi.fn(),
    replace: vi.fn(),
  }),
}));
vi.mock('@vben/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => state.access,
  useTabbarStore: () => ({ $reset: vi.fn() }),
  useUserStore: () => state.user,
}));

function useLocale() {
  const shared = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'packages/locales/src/langs/zh-CN.json'),
      'utf8',
    ),
  );
  const app = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'apps/web-antd/src/locales/langs/zh-CN.json'),
      'utf8',
    ),
  );
  i18n.global.setLocaleMessage('zh-CN', shared);
  i18n.global.mergeLocaleMessage('zh-CN', app);
  i18n.global.locale.value = 'zh-CN';
  i18n.global.fallbackLocale.value = 'zh-CN';
}

function locked(
  seconds: string,
  message: string,
  data: null | Record<string, never>,
) {
  const error = {
    config: { url: '/user/login' },
    response: {
      data: { code: 1, data, message },
      headers: { 'Retry-After': seconds },
      status: 429,
    },
  };
  rememberLoginRetryAfter(error);
  return error;
}

describe('登录页倒计时', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T00:00:00Z'));
    useLocale();
    state.user = reactive({
      setUserInfo(info: unknown) {
        this.userInfo = info;
      },
      userInfo: null as unknown,
    });
    state.access = reactive({
      accessToken: null as null | string,
      refreshToken: null as null | string,
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

  it('倒计时期间登录按钮禁用，结束后恢复', async () => {
    api.loginApi.mockRejectedValueOnce(
      locked('65', '登录失败次数过多，请 2 分钟后再试', {}),
    );
    const wrapper = mount(Login, { global: { plugins: [i18n] } });
    await useAuthStore()
      .authLogin({
        password: 'test fixture',
        username: 'alice',
      })
      .catch(() => {});
    await nextTick();
    const button = wrapper.get('button.w-full');
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('请 1 分 5 秒后再试');
    expect(wrapper.text()).not.toContain('请 2 分钟后再试');

    await vi.advanceTimersByTimeAsync(65_000);
    await nextTick();
    expect(wrapper.get('button.w-full').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).not.toContain('后再试');
    wrapper.unmount();
  });

  it('retry-After 为 1 时按钮只在这一秒禁用，并显示秒', async () => {
    api.loginApi.mockRejectedValueOnce(
      locked('1', '请求过于频繁，请稍后再试', null),
    );
    const wrapper = mount(Login, { global: { plugins: [i18n] } });
    await useAuthStore()
      .authLogin({
        password: 'test fixture',
        username: 'alice',
      })
      .catch(() => {});
    await nextTick();
    expect(wrapper.get('button.w-full').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('请 1 秒后再试');
    expect(wrapper.text()).not.toContain('分钟');
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(wrapper.get('button.w-full').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
