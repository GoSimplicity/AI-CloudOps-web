import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';
import { resetAllStores } from '@vben/stores';
const state = vi.hoisted(() => ({ user: null as any, access: null as any }));
const api = vi.hoisted(() => ({
  getUserInfoApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  getAccessCodesApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    currentRoute: { value: { fullPath: '/' } },
  }),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => state.user,
  useAccessStore: () => state.access,
  resetAllStores: vi.fn(),
}));
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  state.user = reactive({
    userInfo: { userId: 'previous' },
    setUserInfo(info: any) {
      this.userInfo = info;
    },
  });
  state.access = reactive({
    accessToken: 'credential',
    setAccessToken(token: string) {
      this.accessToken = token;
    },
    refreshToken: 'old refresh',
    setRefreshToken: vi.fn((value: string) => {
      state.access.refreshToken = value;
    }),
    setAccessCodes: vi.fn(),
    setLoginExpired: vi.fn(),
  });
});
describe('认证资料作用域', () => {
  it('迟到的退出响应不能清空重新登录的账号', async () => {
    const pending = deferred();
    api.logoutApi.mockReturnValue(pending.promise);
    api.loginApi.mockResolvedValue({ accessToken: 'new credential' });
    api.getUserInfoApi.mockResolvedValue({ id: 2 });
    api.getAccessCodesApi.mockResolvedValue([]);
    const auth = useAuthStore();
    const oldLogout = auth.logout(false);
    await auth.authLogin({ username: 'second', password: 'test fixture' });
    pending.resolve({});
    await oldLogout;
    expect(state.user.userInfo.userId).toBe('2');
    expect(resetAllStores).not.toHaveBeenCalled();
  });
  it('登录响应乱序时旧凭证不能覆盖当前登录', async () => {
    const old = deferred();
    api.loginApi
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ accessToken: 'new credential' });
    api.getUserInfoApi.mockResolvedValue({ id: 2 });
    api.getAccessCodesApi.mockResolvedValue([]);
    const auth = useAuthStore();
    const oldLogin = auth.authLogin({
      username: 'first',
      password: 'test fixture',
    });
    const rejected = expect(oldLogin).rejects.toThrow('登录已取消');
    await auth.authLogin({ username: 'second', password: 'test fixture' });
    old.resolve({ accessToken: 'old credential' });
    await rejected;
    expect(state.access.accessToken).toBe('new credential');
    expect(state.user.userInfo.userId).toBe('2');
  });
  it('发起新登录前清除前账户凭证，失败也不沿用旧refresh令牌', async () => {
    api.loginApi.mockRejectedValue(new Error('invalid login'));
    await expect(
      useAuthStore().authLogin({ username: 'next', password: 'test fixture' }),
    ).rejects.toThrow('invalid login');
    expect(state.access.accessToken).toBeNull();
    expect(state.access.refreshToken).toBeNull();
    expect(state.user.userInfo).toBeNull();
  });
  it('使用真实 profile id 映射缓存 UID', async () => {
    api.getUserInfoApi.mockResolvedValue({ id: 42, real_name: 'User' });
    await useAuthStore().fetchUserInfo();
    expect(state.user.userInfo.userId).toBe('42');
  });
  it('退出开始即清空资料，网络未完成时不保留本人敏感界面', async () => {
    const pending = deferred();
    api.logoutApi.mockReturnValue(pending.promise);
    const task = useAuthStore().logout(false);
    expect(state.user.userInfo).toBeNull();
    pending.resolve({});
    await task;
  });
  it('退出后的迟到 profile 不得恢复旧账号', async () => {
    const pending = deferred();
    api.getUserInfoApi.mockReturnValue(pending.promise);
    const auth = useAuthStore();
    const task = auth.fetchUserInfo();
    const rejected = expect(task).rejects.toThrow('账户已变化');
    await auth.logout(false, false);
    pending.resolve({ id: 1 });
    await rejected;
    expect(state.user.userInfo).toBeNull();
  });
  it('同UID普通令牌轮换不丢弃正在加载的profile', async () => {
    state.user.userInfo = { userId: '1' };
    const pending = deferred();
    api.getUserInfoApi.mockReturnValue(pending.promise);
    const task = useAuthStore().fetchUserInfo();
    state.access.accessToken = 'fresh credential';
    pending.resolve({ id: 1, real_name: 'Same owner' });
    await task;
    expect(state.user.userInfo.userId).toBe('1');
  });
  it('其他 UID 的迟到 profile 不得覆盖新账户', async () => {
    const pending = deferred();
    api.getUserInfoApi.mockReturnValue(pending.promise);
    const task = useAuthStore().fetchUserInfo();
    const rejected = expect(task).rejects.toThrow('账户已变化');
    state.access.accessToken = 'next credential';
    state.user.userInfo = { userId: 'next' };
    pending.resolve({ id: 1 });
    await rejected;
    expect(state.user.userInfo.userId).toBe('next');
  });
});
