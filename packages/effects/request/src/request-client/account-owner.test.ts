import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  access: null as any,
  user: null as any,
  revision: 0,
}));
const api = vi.hoisted(() => ({ refreshTokenApi: vi.fn() }));
vi.mock('../../../hooks/src/index.ts', () => ({
  useAppConfig: () => ({ apiURL: '/api', aiopsURL: '/api/v1' }),
}));
vi.mock('../../../../preferences/src/index.ts', () => ({
  preferences: {
    app: {
      enableRefreshToken: true,
      loginExpiredMode: 'modal',
      locale: 'zh-CN',
    },
  },
}));
vi.mock('../../../../stores/src/index.ts', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
}));
vi.mock('#/store/index.ts', () => ({
  useAuthStore: () => ({
    getAuthGeneration: () => state.revision,
    logout: vi.fn(),
  }),
}));
vi.mock('#/api/core/index.ts', () => api);
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
let mock: MockAdapter;
let client: (typeof import('#/api/request'))['requestClient'];
const switchAccount = (id: string, token: string) => {
  state.revision++;
  state.user.userInfo = { userId: id };
  state.access.accessToken = token;
  state.access.refreshToken = `refresh-${id}`;
};
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  state.revision = 0;
  state.user = {
    userInfo: { userId: '1' },
    setUserInfo(info: unknown) {
      this.userInfo = info;
    },
  };
  state.access = {
    accessToken: 'credential-one',
    refreshToken: 'refresh-one',
    loginExpired: false,
    isAccessChecked: true,
    setAccessToken(value: string) {
      this.accessToken = value;
    },
    setLoginExpired(value: boolean) {
      this.loginExpired = value;
    },
  };
  mock = new MockAdapter(axios);
  client = (await import('#/api/request')).requestClient;
});
afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
});

describe('真实应用请求客户端账户归属', () => {
  it('同一tick切换账户前发起的写请求不得使用新账户凭证', async () => {
    mock.onPost('/queued-write').reply(200, { code: 0, data: 'sent' });
    const result = client
      .post('/queued-write', { owner: 'one' })
      .catch((error) => error);
    switchAccount('2', 'credential-two');
    expect(axios.isCancel(await result)).toBe(true);
    expect(mock.history.post).toHaveLength(0);
  });
  it('迟到200不把前账户数据交给调用方', async () => {
    const pending = Promise.withResolvers<[number, object]>();
    mock.onGet('/private').reply(() => pending.promise);
    const result = client.get('/private').then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await vi.waitFor(() => expect(mock.history.get).toHaveLength(1));
    switchAccount('2', 'credential-two');
    pending.resolve([200, { code: 0, data: { private: 'owner-one' } }]);
    const settled = await result;
    expect(settled).toHaveProperty('error');
    expect(axios.isCancel('error' in settled ? settled.error : undefined)).toBe(
      true,
    );
    expect(JSON.stringify(settled)).not.toContain('owner-one');
    expect(state.access.accessToken).toBe('credential-two');
  });
  it('迟到401不会刷新、重放旧请求或注销新账户', async () => {
    const pending = Promise.withResolvers<[number, object]>();
    mock.onPost('/private-write').replyOnce(() => pending.promise);
    mock.onPost('/private-write').reply(200, { code: 0, data: 'replayed' });
    api.refreshTokenApi.mockResolvedValue('unexpected-refresh');
    const result = client.post('/private-write', { private: 'owner-one' }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await vi.waitFor(() => expect(mock.history.post).toHaveLength(1));
    switchAccount('2', 'credential-two');
    pending.resolve([401, { message: 'expired' }]);
    expect(await result).toHaveProperty('error');
    expect(api.refreshTokenApi).not.toHaveBeenCalled();
    expect(mock.history.post).toHaveLength(1);
    expect(state.access.accessToken).toBe('credential-two');
    expect(state.access.loginExpired).toBe(false);
  });
  it.each(['success', 'failure'])(
    '旧账户刷新挂起并%s时，新账户可独立刷新且不被覆盖',
    async (outcome) => {
      const oldRefresh = Promise.withResolvers<string>();
      api.refreshTokenApi
        .mockReturnValueOnce(oldRefresh.promise)
        .mockResolvedValueOnce('fresh-two');
      mock.onGet('/old').reply(401);
      mock
        .onGet('/new')
        .reply((config) =>
          config.headers?.Authorization === 'Bearer fresh-two'
            ? [200, { code: 0, data: 'owner-two' }]
            : [401],
        );
      const old = client.get('/old').catch((error) => error);
      await vi.waitFor(() =>
        expect(api.refreshTokenApi).toHaveBeenCalledTimes(1),
      );
      switchAccount('2', 'credential-two');
      const fresh = client.get('/new').then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      try {
        await vi.waitFor(() =>
          expect(api.refreshTokenApi).toHaveBeenCalledTimes(2),
        );
        expect(await fresh).toEqual({ value: 'owner-two' });
        expect(state.access.accessToken).toBe('fresh-two');
      } finally {
        if (outcome === 'failure')
          oldRefresh.reject(new Error('old refresh failed'));
        else oldRefresh.resolve('stale-one');
        await old;
        await fresh;
      }
      expect(state.access.accessToken).toBe('fresh-two');
      expect(state.access.loginExpired).toBe(false);
    },
  );
  it('同UID退出重登后旧响应仍失效', async () => {
    const pending = Promise.withResolvers<[number, object]>();
    mock.onGet('/same-id').reply(() => pending.promise);
    const result = client.get('/same-id').then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await vi.waitFor(() => expect(mock.history.get).toHaveLength(1));
    switchAccount('1', 'new-session-one');
    pending.resolve([200, { code: 0, data: 'old-session-data' }]);
    expect(await result).toHaveProperty('error');
  });
  it('未认证请求不得用遗留refresh令牌恢复退出账户', async () => {
    state.user.userInfo = null;
    state.access.accessToken = null;
    api.refreshTokenApi.mockResolvedValue('must-not-restore');
    mock.onGet('/inactive').reply(401);
    await expect(client.get('/inactive')).rejects.toBeDefined();
    expect(api.refreshTokenApi).not.toHaveBeenCalled();
    expect(state.access.accessToken).toBeNull();
  });
  it('复制旧请求配置重放时在注入新凭证前拒绝', async () => {
    mock.onPost('/write').reply(200, { code: 0, data: 'ok' });
    await client.post('/write', { private: 'owner-one' });
    const config = mock.history.post[0]!;
    switchAccount('2', 'credential-two');
    await expect(client.request('/write', { ...config })).rejects.toBeDefined();
    expect(mock.history.post).toHaveLength(1);
    expect(state.access.accessToken).toBe('credential-two');
  });
  it('同代际初始化资料先返回时，权限请求仍可完成', async () => {
    state.user.userInfo = null;
    const pending = Promise.withResolvers<[number, object]>();
    mock.onGet('/bootstrap-codes').reply(() => pending.promise);
    const result = client.get('/bootstrap-codes');
    await vi.waitFor(() => expect(mock.history.get).toHaveLength(1));
    state.user.userInfo = { userId: '1' };
    pending.resolve([200, { code: 0, data: ['allowed'] }]);
    expect(await result).toEqual(['allowed']);
  });
  it('普通刷新令牌保持同一账户并成功重放', async () => {
    api.refreshTokenApi.mockResolvedValue('fresh-one');
    mock
      .onGet('/same-owner')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer fresh-one'
          ? [200, { code: 0, data: 'same owner' }]
          : [401],
      );
    expect(await client.get('/same-owner')).toBe('same owner');
    expect(state.user.userInfo.userId).toBe('1');
    expect(state.revision).toBe(0);
  });
});
