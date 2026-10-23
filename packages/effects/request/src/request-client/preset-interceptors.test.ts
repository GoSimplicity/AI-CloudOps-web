import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticateResponseInterceptor } from './preset-interceptors';
import { RequestClient } from './request-client';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

describe('并发请求的令牌刷新', () => {
  let mock: MockAdapter;
  let client: RequestClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new RequestClient();
  });

  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  function configure(doRefreshToken: () => Promise<string>) {
    const doReAuthenticate = vi.fn().mockResolvedValue(undefined);
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    );
    return doReAuthenticate;
  }

  it('多个 401 共用一次刷新，并使用新令牌重放', async () => {
    const refresh = Promise.withResolvers<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    const reAuthenticate = configure(doRefreshToken);
    mock
      .onGet('/resource')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer fresh'
          ? [200, { ok: true }]
          : [401],
      );

    const requests = [
      client.get('/resource'),
      client.get('/resource'),
      client.get('/resource'),
    ];
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(2));
    refresh.resolve('fresh');

    const responses = await Promise.all(requests);
    expect(responses.every((response) => response.data.ok)).toBe(true);
    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(reAuthenticate).not.toHaveBeenCalled();
    expect(mock.history.get).toHaveLength(6);
  });

  it('刷新失败时所有等待请求均拒绝，不发送空令牌重试', async () => {
    const refresh = Promise.withResolvers<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    const reAuthenticate = configure(doRefreshToken);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.onGet('/resource').reply(401);
    const results = Promise.allSettled([
      client.get('/resource'),
      client.get('/resource'),
      client.get('/resource'),
    ]);
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(2));
    const failure = new Error('refresh expired');
    refresh.reject(failure);

    const settled = await results;
    for (const result of settled) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toBe(failure);
    }
    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(reAuthenticate).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(3);
    expect(client.refreshTokenQueue).toHaveLength(0);
    expect(client.isRefreshing).toBe(false);
  });

  it('排队请求重试仍为 401 时不再次刷新', async () => {
    const refresh = Promise.withResolvers<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    configure(doRefreshToken);
    mock.onGet('/resource').reply(401);
    const results = Promise.allSettled([
      client.get('/resource'),
      client.get('/resource'),
    ]);
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(1));
    refresh.resolve('fresh');

    expect(
      (await results).every((result) => result.status === 'rejected'),
    ).toBe(true);
    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(4);
  });
});
