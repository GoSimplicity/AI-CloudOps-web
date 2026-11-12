import { effectScope, reactive, ref, watch } from 'vue';

import { resetAllStores } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkloadHistoryScope } from '../views/k8s/shared/use-workload-rollback-scope';
import { useAuthStore } from './auth';

const state = vi.hoisted(() => ({ access: null as any, user: null as any }));
const navigation = vi.hoisted(() => ({
  currentRoute: { value: { fullPath: '/private' } },
  push: vi.fn(),
  removeRoute: vi.fn(),
  replace: vi.fn(),
  tabReset: vi.fn(),
}));
vi.mock('#/router/routes', () => ({ routes: [] }));
const api = vi.hoisted(() => ({
  getAccessCodesApi: vi.fn(),
  getUserInfoApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    ...navigation,
    getRoutes: () => [{ name: 'PreviousPrivate' }],
    hasRoute: () => true,
    removeRoute: navigation.removeRoute,
  }),
}));
vi.mock('@vben/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => state.access,
  useTabbarStore: () => ({ $reset: navigation.tabReset }),
  useUserStore: () => state.user,
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
    setUserInfo(info: any) {
      this.userInfo = info;
    },
    userInfo: { userId: 'previous' },
  });
  state.access = reactive({
    accessCodes: ['previous-code'],
    accessMenus: [{ name: 'previous-menu' }],
    accessRoutes: [{ name: 'previous-route' }],
    accessToken: 'credential',
    isAccessChecked: true,
    refreshToken: 'old refresh',
    setAccessCodes: vi.fn((value) => (state.access.accessCodes = value)),
    setAccessMenus: vi.fn((value) => (state.access.accessMenus = value)),
    setAccessRoutes: vi.fn((value) => (state.access.accessRoutes = value)),
    setAccessToken(token: string) {
      this.accessToken = token;
    },
    setIsAccessChecked: vi.fn(
      (value) => (state.access.isAccessChecked = value),
    ),
    setLoginExpired: vi.fn(),
    setRefreshToken: vi.fn((value: string) => {
      state.access.refreshToken = value;
    }),
  });
});
describe('认证资料作用域', () => {
  it('新登录开始即清除旧权限码和菜单检查状态', async () => {
    api.loginApi.mockRejectedValue(new Error('invalid login'));
    await expect(
      useAuthStore().authLogin({ password: 'test fixture', username: 'next' }),
    ).rejects.toThrow();
    expect(state.access.accessCodes).toEqual([]);
    expect(state.access.accessMenus).toEqual([]);
    expect(state.access.accessRoutes).toEqual([]);
    expect(state.access.isAccessChecked).toBe(false);
    expect(navigation.removeRoute).toHaveBeenCalledWith('PreviousPrivate');
    expect(navigation.tabReset).toHaveBeenCalled();
  });
  it('过期弹窗重新登录也重新经过当前路由权限守卫', async () => {
    state.access.loginExpired = true;
    api.loginApi.mockResolvedValue({ accessToken: 'next credential' });
    api.getUserInfoApi.mockResolvedValue({ id: 2 });
    api.getAccessCodesApi.mockResolvedValue(['new-code']);
    await useAuthStore().authLogin({
      password: 'test fixture',
      username: 'next',
    });
    expect(navigation.replace).toHaveBeenCalledWith('/private');
    expect(state.access.isAccessChecked).toBe(false);
    expect(state.access.accessCodes).toEqual(['new-code']);
  });

  it('迟到的退出响应不能清空重新登录的账号', async () => {
    const pending = deferred();
    api.logoutApi.mockReturnValue(pending.promise);
    api.loginApi.mockResolvedValue({ accessToken: 'new credential' });
    api.getUserInfoApi.mockResolvedValue({ id: 2 });
    api.getAccessCodesApi.mockResolvedValue([]);
    const auth = useAuthStore();
    const oldLogout = auth.logout(false);
    await auth.authLogin({ password: 'test fixture', username: 'second' });
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
      password: 'test fixture',
      username: 'first',
    });
    const rejected = expect(oldLogin).rejects.toThrow('登录已取消');
    await auth.authLogin({ password: 'test fixture', username: 'second' });
    old.resolve({ accessToken: 'old credential' });
    await rejected;
    expect(state.access.accessToken).toBe('new credential');
    expect(state.user.userInfo.userId).toBe('2');
  });
  it('发起新登录前清除前账户凭证，失败也不沿用旧refresh令牌', async () => {
    api.loginApi.mockRejectedValue(new Error('invalid login'));
    await expect(
      useAuthStore().authLogin({ password: 'test fixture', username: 'next' }),
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

const epochScopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => {
  for (const scope of epochScopes.splice(0)) scope.stop();
});

interface HistoryResult {
  items: Array<{ date: string; message: string; revision: number }>;
}
function controlledHistory() {
  let complete: ((value: HistoryResult) => void) | undefined;
  const promise = new Promise<HistoryResult>((resolve) => {
    complete = resolve;
  });
  return {
    complete(value: HistoryResult) {
      if (!complete) throw new Error('History fixture resolver is unavailable');
      complete(value);
    },
    promise,
  };
}
function historyFixture(read: () => Promise<HistoryResult>) {
  const scope = effectScope();
  epochScopes.push(scope);
  const state = {
    cluster: ref(7),
    history: ref<HistoryResult['items']>([]),
    namespace: ref('owned-namespace'),
    read,
    target: ref<{
      cluster_id: number;
      name: string;
      namespace: string;
      uid: string;
    } | null>(null),
    visible: ref(false),
  };
  const history = scope.run(() => useWorkloadHistoryScope(state));
  if (!history) throw new Error('History fixture scope did not initialize');
  const record = {
    cluster_id: 7,
    name: 'owned-workload',
    namespace: 'owned-namespace',
    uid: 'owned-resource',
  };
  return { history, record, state };
}
const historyResult = (): HistoryResult => ({
  items: [{ date: '', message: 'owned history', revision: 2 }],
});

it('真实Pinia包装的generation getter返回数字且能被同步watch跟踪', () => {
  const auth = useAuthStore();
  const values: number[] = [];
  const scope = effectScope();
  epochScopes.push(scope);
  scope.run(() =>
    watch(
      () => auth.getAuthGeneration(),
      (value) => values.push(value),
      { flush: 'sync' },
    ),
  );
  expect(auth.getAuthGeneration()).toBe(0);
  expect(typeof auth.getAuthGeneration()).toBe('number');
  expect(auth.$state).not.toHaveProperty('authGeneration');
  auth.$reset();
  auth.$reset();
  expect(values).toEqual([1, 2]);
  expect(state.user.userInfo.userId).toBe('previous');
  expect(state.access.accessToken).toBe('credential');
  expect(api.loginApi).not.toHaveBeenCalled();
  expect(api.logoutApi).not.toHaveBeenCalled();
  expect(api.getUserInfoApi).not.toHaveBeenCalled();
});

it('登录和退出仍先递增generation再清原账号及令牌', async () => {
  const auth = useAuthStore();
  const transitions: Array<{
    generation: number;
    tokenPresent: boolean;
    uid: null | string;
  }> = [];
  const scope = effectScope();
  epochScopes.push(scope);
  scope.run(() =>
    watch(
      () => auth.getAuthGeneration(),
      (generation) =>
        transitions.push({
          generation,
          tokenPresent: !!state.access.accessToken,
          uid: state.user.userInfo?.userId ?? null,
        }),
      { flush: 'sync' },
    ),
  );
  api.loginApi.mockResolvedValue({ accessToken: 'next credential' });
  api.getUserInfoApi.mockResolvedValue({ id: 2 });
  api.getAccessCodesApi.mockResolvedValue([]);
  api.logoutApi.mockResolvedValue({});
  await auth.authLogin({ password: 'test fixture', username: 'next' });
  expect(transitions).toEqual([
    { generation: 1, tokenPresent: true, uid: 'previous' },
  ]);
  await auth.logout(false);
  expect(transitions).toEqual([
    { generation: 1, tokenPresent: true, uid: 'previous' },
    { generation: 2, tokenPresent: true, uid: '2' },
  ]);
  expect(state.user.userInfo).toBeNull();
  expect(resetAllStores).toHaveBeenCalledOnce();
});

it('真实getter在reset时同步触发清理且不改变既有reset外部合同', () => {
  const auth = useAuthStore();
  auth.loginLoading = true;
  const callbacks: Array<{
    generation: number;
    loading: boolean;
    uid: string;
  }> = [];
  const scope = effectScope();
  epochScopes.push(scope);
  scope.run(() =>
    watch(
      () => auth.getAuthGeneration(),
      (generation) =>
        callbacks.push({
          generation,
          loading: auth.loginLoading,
          uid: state.user.userInfo.userId,
        }),
      { flush: 'sync' },
    ),
  );
  auth.$reset();
  expect(callbacks).toEqual([
    { generation: 1, loading: true, uid: 'previous' },
  ]);
  expect(auth.loginLoading).toBe(false);
  expect(state.user.userInfo.userId).toBe('previous');
  expect(state.access.accessToken).toBe('credential');
});

it('令牌正常轮换不会发布新的generation或触发owner清理', () => {
  const auth = useAuthStore();
  const changed = vi.fn();
  const scope = effectScope();
  epochScopes.push(scope);
  scope.run(() =>
    watch(() => auth.getAuthGeneration(), changed, { flush: 'sync' }),
  );
  state.access.setAccessToken('rotated credential');
  expect(auth.getAuthGeneration()).toBe(0);
  expect(changed).not.toHaveBeenCalled();
});

it('真实同UID epoch变化立即清除已加载的history窗口', async () => {
  state.user.userInfo = { userId: '1' };
  const auth = useAuthStore();
  const read = vi.fn(async () => historyResult());
  const fixture = historyFixture(read);
  await fixture.history.show(fixture.record);
  expect(fixture.state.visible.value).toBe(true);
  expect(fixture.history.isCurrent()).toBe(true);
  auth.$reset();
  expect(state.user.userInfo.userId).toBe('1');
  expect(fixture.state.visible.value).toBe(false);
  expect(fixture.state.history.value).toEqual([]);
  expect(fixture.state.target.value).toBeNull();
  expect(fixture.history.loading.value).toBe(false);
  expect(fixture.history.isCurrent()).toBe(false);
  expect(read).toHaveBeenCalledOnce();
});

it('真实同UID epoch变化立即清除在途history，旧完成不清新的loading', async () => {
  state.user.userInfo = { userId: '1' };
  const auth = useAuthStore();
  const first = controlledHistory();
  const second = controlledHistory();
  const read = vi
    .fn<() => Promise<HistoryResult>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const fixture = historyFixture(read);
  const old = fixture.history.show(fixture.record);
  expect(fixture.history.loading.value).toBe(true);
  auth.$reset();
  expect(fixture.history.loading.value).toBe(false);
  expect(fixture.state.target.value).toBeNull();
  expect(fixture.state.visible.value).toBe(false);
  const fresh = fixture.history.show(fixture.record);
  first.complete(historyResult());
  await old;
  expect(fixture.history.loading.value).toBe(true);
  expect(fixture.state.history.value).toEqual([]);
  second.complete(historyResult());
  await fresh;
  expect(fixture.history.loading.value).toBe(false);
  expect(fixture.state.visible.value).toBe(true);
  expect(fixture.history.isCurrent()).toBe(true);
});
