import { type AxiosAdapter, AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W1 发版前修复：Pod 日志 SSE 与终端 exec WS 的令牌刷新与重连
 * - 每次重连读最新令牌；401 / 握手失败先走统一刷新（单飞），成功后重连
 * - 刷新失败停止重连，只提示一条重新登录（固定 key），复用登录过期处理
 * - 退避 + 上限
 */
const notices = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const refreshTokenApi = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => {
  const store = {
    accessToken: 'old-token' as null | string,
    refreshToken: 'refresh',
    isAccessChecked: true,
    setAccessToken: (token: null | string) => {
      store.accessToken = token;
    },
    setLoginExpired: vi.fn(),
  };
  return store;
});

vi.mock('ant-design-vue', () => ({
  message: notices,
  Modal: { confirm: vi.fn() },
}));
vi.mock('xterm', () => ({ Terminal: vi.fn() }));
vi.mock('xterm-addon-fit', () => ({ FitAddon: vi.fn() }));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: vi.fn() }));
vi.mock('xterm/css/xterm.css', () => ({}));
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ aiopsURL: '/api/v1', apiURL: '/api' }),
}));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      enableRefreshToken: true,
      locale: 'zh-CN',
      loginExpiredMode: 'modal',
    },
  },
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => access,
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => 1, logout }),
}));
vi.mock('#/api/core', () => ({ refreshTokenApi }));

import {
  LOGIN_EXPIRED_MESSAGE,
  LOGIN_EXPIRED_MESSAGE_KEY,
  requestClient,
} from '#/api/request';

import { effectScope } from 'vue';

import {
  STREAM_MAX_RECONNECT_ATTEMPTS,
  STREAM_UNAUTHORIZED_REFRESH_RESET_MS,
  usePodPage,
} from './Pod';

const LOG_PARAMS = {
  cluster_id: 1,
  container: 'app',
  namespace: 'default',
  pod_name: 'web-0',
} as any;
const EXEC_PARAMS = { ...LOG_PARAMS, shell: '/bin/sh' } as any;

/** 先跑完已排队的微任务与到期的定时器 */
async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0);
}

/** 不结束的 SSE 流（连上后一直挂着） */
function openStream() {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: hello\n\n'));
      },
    }),
    { status: 200 },
  );
}

/** fetch 桩：按 Authorization 头决定响应，记录每次请求带的头 */
function stubFetch(respond: (authorization: string) => Response) {
  const authorizations: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const authorization = String(
      (init.headers as Record<string, string>).Authorization,
    );
    authorizations.push(authorization);
    return respond(authorization);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { authorizations, fetchMock };
}

class FakeWebSocket {
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onopen: ((event: any) => void) | null = null;
  readyState = 0;
  send = vi.fn();
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWebSocket.instances.push(this);
  }
  /** 握手失败：浏览器只给 error + 1006，拿不到 HTTP 状态 */
  fail(code = 1006) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.(new Event('error'));
    this.onclose?.({ code, wasClean: false });
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
}

function lastSocket() {
  return FakeWebSocket.instances.at(-1)!;
}

function expectSingleLoginExpiredNotice() {
  expect(notices.warning).toHaveBeenCalledTimes(1);
  expect(notices.warning).toHaveBeenCalledWith({
    content: LOGIN_EXPIRED_MESSAGE,
    key: LOGIN_EXPIRED_MESSAGE_KEY,
  });
  // 复用 HTTP 的登录过期处理（modal 模式：打开重新登录弹窗）
  expect(access.setLoginExpired).toHaveBeenCalledTimes(1);
  expect(access.setLoginExpired).toHaveBeenCalledWith(true);
}

function callbacks() {
  return {
    onClose: vi.fn(),
    onError: vi.fn(),
    onMessage: vi.fn(),
    onOpen: vi.fn(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  access.accessToken = 'old-token';
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  refreshTokenApi.mockResolvedValue('new-token');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Pod 日志 SSE：令牌刷新与重连', () => {
  it('令牌过期（401）：刷新一次，用新令牌重连成功', async () => {
    const { authorizations } = stubFetch((authorization) =>
      authorization === 'Bearer new-token'
        ? openStream()
        : new Response('token expired', { status: 401 }),
    );
    const cb = callbacks();
    const { streamK8sPodLogs } = usePodPage();
    const conn = streamK8sPodLogs(
      LOG_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    await flush();

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(refreshTokenApi).toHaveBeenCalledWith({ refreshToken: 'refresh' });
    expect(authorizations).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(cb.onOpen).toHaveBeenCalledTimes(1);
    expect(cb.onMessage).toHaveBeenCalledWith('hello');
    expect(notices.warning).not.toHaveBeenCalled();
    conn.close();
  });

  it('流断开后重连读最新令牌，而不是建流时的令牌', async () => {
    const encoder = new TextEncoder();
    let first = true;
    const { authorizations } = stubFetch(() => {
      if (!first) return openStream();
      first = false;
      // 第一条流读完一段后结束（服务端断开）
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: a\n\n'));
            controller.close();
          },
        }),
        { status: 200 },
      );
    });
    const { streamK8sPodLogs } = usePodPage();
    const conn = streamK8sPodLogs(LOG_PARAMS, vi.fn());
    await flush();
    // 断开期间别处刷新了令牌
    access.accessToken = 'rotated-token';
    await flush(1000);

    expect(authorizations).toEqual([
      'Bearer old-token',
      'Bearer rotated-token',
    ]);
    expect(refreshTokenApi).not.toHaveBeenCalled();
    conn.close();
  });

  it('刷新失败：停止重连，只提示一条重新登录', async () => {
    refreshTokenApi.mockRejectedValue(new Error('刷新令牌失败，请重新登录'));
    const { fetchMock } = stubFetch(
      () => new Response('token expired', { status: 401 }),
    );
    const cb = callbacks();
    const { streamK8sPodLogs } = usePodPage();
    streamK8sPodLogs(
      LOG_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    await flush();
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    expectSingleLoginExpiredNotice();
  });

  it('刷新后仍 401：不再刷新，停止重连并只提示一条', async () => {
    const { fetchMock } = stubFetch(
      () => new Response('token expired', { status: 401 }),
    );
    const cb = callbacks();
    const { streamK8sPodLogs } = usePodPage();
    streamK8sPodLogs(
      LOG_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    await flush();
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    expectSingleLoginExpiredNotice();
  });

  it(`重连有上限：连续失败 ${STREAM_MAX_RECONNECT_ATTEMPTS} 次后停止，且按退避间隔`, async () => {
    const { fetchMock } = stubFetch(
      () => new Response('boom', { status: 500 }),
    );
    const cb = callbacks();
    const { streamK8sPodLogs } = usePodPage();
    streamK8sPodLogs(
      LOG_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 第 1 次重连在 1s 后
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 第 2 次在 2s 后
    await flush(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flush(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    for (let i = 0; i < 10; i++) await flush(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1 + STREAM_MAX_RECONNECT_ATTEMPTS);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(refreshTokenApi).not.toHaveBeenCalled();
  });
});

describe('Pod 终端 exec WS：令牌刷新与重连', () => {
  it('握手失败：刷新一次，用新令牌重连成功', async () => {
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    const conn = execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    expect(lastSocket().protocols).toEqual([
      'cloudops-v1',
      'cloudops-auth.old-token',
    ]);
    lastSocket().fail();
    await flush();

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(lastSocket().protocols).toEqual([
      'cloudops-v1',
      'cloudops-auth.new-token',
    ]);
    lastSocket().open();
    expect(cb.onOpen).toHaveBeenCalledTimes(1);
    // 握手失败的错误在刷新成功后补报一次（是否提示由调用方决定）
    expect(cb.onError).toHaveBeenCalledTimes(1);
    expect(cb.onClose).not.toHaveBeenCalled();
    expect(notices.warning).not.toHaveBeenCalled();
    conn.close();
  });

  it('连上后断开：重连读最新令牌', async () => {
    const { execK8sPodWebSocket } = usePodPage();
    const conn = execK8sPodWebSocket(EXEC_PARAMS, vi.fn());
    lastSocket().open();
    access.accessToken = 'rotated-token';
    lastSocket().onclose?.({ code: 1006, wasClean: false });
    await flush(1000);

    expect(refreshTokenApi).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(lastSocket().protocols).toContain('cloudops-auth.rotated-token');
    conn.close();
  });

  it('刷新失败：停止重连，只提示一条重新登录', async () => {
    refreshTokenApi.mockRejectedValue(new Error('刷新令牌失败，请重新登录'));
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    lastSocket().fail();
    await flush();
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    // 握手失败的 onerror 不再报给调用方：刷新失败只提示登录过期（窝窝头答复 5）
    expect(cb.onError).not.toHaveBeenCalled();
    expectSingleLoginExpiredNotice();
  });

  it('刷新后收到 4401：不再刷新，停止重连并只提示一条', async () => {
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    lastSocket().fail();
    await flush();
    lastSocket().fail(4401);
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    expectSingleLoginExpiredNotice();
  });

  it('复审 v4 P2-C：连上后收到 4401，反复循环：刷新只调 1 次、onClose 只调 1 次，并提示重新登录', async () => {
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    // 服务端每次都先接受连接，随后用 4401 关闭（令牌在会话中失效）
    for (let i = 0; i < 10; i++) {
      const socket = lastSocket();
      if (socket.readyState !== 0) break;
      socket.open();
      socket.readyState = FakeWebSocket.CLOSED;
      socket.onclose?.({ code: 4401, wasClean: true });
      await flush(30_000);
    }

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(cb.onOpen).toHaveBeenCalledTimes(2);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    expectSingleLoginExpiredNotice();
  });

  it('复审 v4 P2-C：连上后收到 4401 且刷新失败：停止重连，onClose 1 次，只提示一条重新登录', async () => {
    refreshTokenApi.mockRejectedValue(new Error('刷新令牌失败，请重新登录'));
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    lastSocket().open();
    lastSocket().onclose?.({ code: 4401, wasClean: true });
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledWith('login-expired');
    expectSingleLoginExpiredNotice();
  });

  describe('复审 P3-A：4401 刷新后连接稳定 5 分钟才允许再次刷新', () => {
    /** 连上 → 4401 → 刷新并重连上（第 2 条连接已 open） */
    async function openThen4401ThenReconnect() {
      const cb = callbacks();
      const page = usePodPage();
      const conn = page.execK8sPodWebSocket(
        EXEC_PARAMS,
        cb.onMessage,
        cb.onError,
        cb.onOpen,
        cb.onClose,
      );
      lastSocket().open();
      lastSocket().onclose?.({ code: 4401, wasClean: true });
      await flush();
      expect(refreshTokenApi).toHaveBeenCalledTimes(1);
      expect(FakeWebSocket.instances).toHaveLength(2);
      lastSocket().open();
      return { cb, conn };
    }

    it('门槛为 5 分钟常量', () => {
      expect(STREAM_UNAUTHORIZED_REFRESH_RESET_MS).toBe(5 * 60 * 1000);
    });

    it('a) 重连后保持 2 小时再收到 4401：再刷新一次（共 2 次），不提示登录过期', async () => {
      const { cb, conn } = await openThen4401ThenReconnect();
      await flush(2 * 60 * 60 * 1000);
      lastSocket().onclose?.({ code: 4401, wasClean: true });
      await flush();

      expect(refreshTokenApi).toHaveBeenCalledTimes(2);
      expect(FakeWebSocket.instances).toHaveLength(3);
      expect(lastSocket().protocols).toContain('cloudops-auth.new-token');
      lastSocket().open();
      expect(cb.onOpen).toHaveBeenCalledTimes(3);
      expect(cb.onClose).not.toHaveBeenCalled();
      expect(notices.warning).not.toHaveBeenCalled();
      expect(access.setLoginExpired).not.toHaveBeenCalled();
      conn.close();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('b) 重连后不到 5 分钟（4 分 59 秒）又收到 4401：停止，刷新只 1 次，登录过期提示 1 条', async () => {
      const { cb } = await openThen4401ThenReconnect();
      await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS - 1000);
      lastSocket().onclose?.({ code: 4401, wasClean: true });
      await flush(60_000);

      expect(refreshTokenApi).toHaveBeenCalledTimes(1);
      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(cb.onClose).toHaveBeenCalledTimes(1);
      expect(cb.onClose).toHaveBeenCalledWith('login-expired');
      expectSingleLoginExpiredNotice();
      // stopReconnect 已清掉计时器
      expect(vi.getTimerCount()).toBe(0);
    });

    it('b2) 「稳定」要求连续：4 分钟时断开重连，再过 4 分钟收到 4401 仍停止', async () => {
      const { cb } = await openThen4401ThenReconnect();
      await flush(4 * 60 * 1000);
      lastSocket().onclose?.({ code: 1006, wasClean: false });
      await flush(1000);
      expect(FakeWebSocket.instances).toHaveLength(3);
      lastSocket().open();
      await flush(4 * 60 * 1000);
      lastSocket().onclose?.({ code: 4401, wasClean: true });
      await flush(60_000);

      expect(refreshTokenApi).toHaveBeenCalledTimes(1);
      expect(cb.onClose).toHaveBeenCalledWith('login-expired');
      expectSingleLoginExpiredNotice();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('c) 主动断开（close）后没有残留计时器', async () => {
      const { conn } = await openThen4401ThenReconnect();
      expect(vi.getTimerCount()).toBe(1);
      conn.close();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('c) 服务端正常关闭（onclose）后没有残留计时器', async () => {
      const { cb } = await openThen4401ThenReconnect();
      expect(vi.getTimerCount()).toBe(1);
      lastSocket().onclose?.({ code: 1000, wasClean: true });
      expect(cb.onClose).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('c) 组件卸载后没有残留计时器', async () => {
      const scope = effectScope();
      const page = scope.run(() => usePodPage())!;
      page.terminalConnection.value = page.execK8sPodWebSocket(
        EXEC_PARAMS,
        vi.fn(),
      );
      lastSocket().open();
      lastSocket().onclose?.({ code: 4401, wasClean: true });
      await flush();
      expect(refreshTokenApi).toHaveBeenCalledTimes(1);
      lastSocket().open();
      expect(vi.getTimerCount()).toBe(1);
      scope.stop();
      expect(vi.getTimerCount()).toBe(0);
    });

    describe('FE-02b：5 分钟边界与多轮重置', () => {
      /** 当前连接收到 4401 后等刷新、重连完成 */
      async function receive4401() {
        lastSocket().onclose?.({ code: 4401, wasClean: true });
        await flush();
      }

      it('d1) 恰好稳定 5:00（门槛整点）后收到 4401：允许再刷新一次，不提示登录过期', async () => {
        const { cb, conn } = await openThen4401ThenReconnect();
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS);
        // 门槛整点计时器已触发并清掉标记，不再残留
        expect(vi.getTimerCount()).toBe(0);
        await receive4401();

        expect(refreshTokenApi).toHaveBeenCalledTimes(2);
        expect(FakeWebSocket.instances).toHaveLength(3);
        expect(cb.onClose).not.toHaveBeenCalled();
        expect(notices.warning).not.toHaveBeenCalled();
        expect(access.setLoginExpired).not.toHaveBeenCalled();
        conn.close();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('d2) 差 1 毫秒到 5:00（4:59.999）收到 4401：停止，刷新只 1 次，登录过期提示 1 条', async () => {
        const { cb } = await openThen4401ThenReconnect();
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS - 1);
        expect(vi.getTimerCount()).toBe(1);
        lastSocket().onclose?.({ code: 4401, wasClean: true });
        await flush(60_000);

        expect(refreshTokenApi).toHaveBeenCalledTimes(1);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(cb.onClose).toHaveBeenCalledTimes(1);
        expect(cb.onClose).toHaveBeenCalledWith('login-expired');
        expectSingleLoginExpiredNotice();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('d3) 多轮：每轮都稳定满 5:00 再收到 4401，连续 3 轮都能刷新；每轮重连后重新计时', async () => {
        const { cb, conn } = await openThen4401ThenReconnect();
        for (let round = 1; round <= 3; round++) {
          // 每条新连接 open 后都重新挂上 1 个计时器
          expect(vi.getTimerCount()).toBe(1);
          await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS);
          await receive4401();
          expect(refreshTokenApi).toHaveBeenCalledTimes(1 + round);
          expect(FakeWebSocket.instances).toHaveLength(2 + round);
          lastSocket().open();
        }

        expect(cb.onOpen).toHaveBeenCalledTimes(5);
        expect(cb.onClose).not.toHaveBeenCalled();
        expect(notices.warning).not.toHaveBeenCalled();
        expect(access.setLoginExpired).not.toHaveBeenCalled();
        conn.close();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('d4) 重置后标记会重新武装：第 2 轮刷新重连后不到 5:00 又收到 4401，停止并只提示一条', async () => {
        const { cb } = await openThen4401ThenReconnect();
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS);
        await receive4401();
        expect(refreshTokenApi).toHaveBeenCalledTimes(2);
        lastSocket().open();
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS - 1);
        lastSocket().onclose?.({ code: 4401, wasClean: true });
        await flush(60_000);

        expect(refreshTokenApi).toHaveBeenCalledTimes(2);
        expect(FakeWebSocket.instances).toHaveLength(3);
        expect(cb.onClose).toHaveBeenCalledTimes(1);
        expect(cb.onClose).toHaveBeenCalledWith('login-expired');
        expectSingleLoginExpiredNotice();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('d5) 多轮中途断线：满 5:00 前断线重连，计时从新连接 open 重新算；新连接满 5:00 后 4401 仍可刷新', async () => {
        const { cb, conn } = await openThen4401ThenReconnect();
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS - 1);
        lastSocket().onclose?.({ code: 1006, wasClean: false });
        await flush(1000);
        expect(FakeWebSocket.instances).toHaveLength(3);
        lastSocket().open();
        // 新连接只过 4:59.999：仍未满门槛
        await flush(STREAM_UNAUTHORIZED_REFRESH_RESET_MS - 1);
        expect(vi.getTimerCount()).toBe(1);
        await flush(1);
        expect(vi.getTimerCount()).toBe(0);
        await receive4401();

        expect(refreshTokenApi).toHaveBeenCalledTimes(2);
        expect(FakeWebSocket.instances).toHaveLength(4);
        expect(cb.onClose).not.toHaveBeenCalled();
        expect(notices.warning).not.toHaveBeenCalled();
        conn.close();
        expect(vi.getTimerCount()).toBe(0);
      });
    });
  });

  it(`重连有上限：刷新后握手仍失败，最多重连 ${STREAM_MAX_RECONNECT_ATTEMPTS} 次`, async () => {
    const cb = callbacks();
    const { execK8sPodWebSocket } = usePodPage();
    execK8sPodWebSocket(
      EXEC_PARAMS,
      cb.onMessage,
      cb.onError,
      cb.onOpen,
      cb.onClose,
    );
    for (let i = 0; i < 20; i++) {
      const socket = lastSocket();
      if (socket.readyState === 0) socket.fail();
      await flush(30_000);
    }

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(
      1 + STREAM_MAX_RECONNECT_ATTEMPTS,
    );
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    // 不是登录过期：结束原因为空，调用方照常提示连接已断开
    expect(cb.onClose).toHaveBeenCalledWith(undefined);
    expect(notices.warning).not.toHaveBeenCalled();
  });
});

describe('并发：SSE、WS 与 HTTP 401 只发一个刷新请求', () => {
  it('三路同时遇到令牌过期：refreshTokenApi 只调用一次，各自用新令牌恢复', async () => {
    let resolveRefresh!: (token: string) => void;
    refreshTokenApi.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { authorizations } = stubFetch((authorization) =>
      authorization === 'Bearer new-token'
        ? openStream()
        : new Response('token expired', { status: 401 }),
    );
    const httpAuthorizations: string[] = [];
    const adapter: AxiosAdapter = async (config) => {
      const authorization = String(config.headers?.Authorization);
      httpAuthorizations.push(authorization);
      const response = {
        config,
        data:
          authorization === 'Bearer new-token'
            ? { code: 0, data: 'ok', message: '' }
            : { code: 401, message: 'token expired' },
        headers: {},
        status: authorization === 'Bearer new-token' ? 200 : 401,
        statusText: '',
      } as any;
      if (response.status === 200) return response;
      throw new AxiosError('401', '401', config, {}, response);
    };

    const sse = callbacks();
    const ws = callbacks();
    const page = usePodPage();
    const logConn = page.streamK8sPodLogs(
      LOG_PARAMS,
      sse.onMessage,
      sse.onError,
      sse.onOpen,
      sse.onClose,
    );
    const execConn = page.execK8sPodWebSocket(
      EXEC_PARAMS,
      ws.onMessage,
      ws.onError,
      ws.onOpen,
      ws.onClose,
    );
    lastSocket().fail();
    const http = requestClient.get('/k8s/pod/list', { adapter });
    await flush();

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    resolveRefresh('new-token');
    await expect(http).resolves.toBe('ok');
    await flush();

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(authorizations).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(httpAuthorizations).toEqual([
      'Bearer old-token',
      'Bearer new-token',
    ]);
    expect(lastSocket().protocols).toContain('cloudops-auth.new-token');
    expect(sse.onOpen).toHaveBeenCalledTimes(1);
    expect(notices.warning).not.toHaveBeenCalled();
    logConn.close();
    execConn.close();
  });
});
