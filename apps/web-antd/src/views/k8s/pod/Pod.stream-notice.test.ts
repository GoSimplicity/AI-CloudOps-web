import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 第一层复审 v4（窝窝头答复 5）：页面层提示
 * - 刷新失败（或刷新后仍未授权）只保留「登录已过期，请重新登录」，
 *   不再提示「实时日志连接已停止」「终端连接已断开」「终端连接出现问题」
 * - 「终端连接出现问题」每次连接流程只提示一次，不是每次握手失败都提示
 * - 其他已有提示不变
 */
const notices = vi.hoisted(() => {
  // 按出现顺序记录所有提示
  const log: [string, string][] = [];
  const record = (type: string) =>
    vi.fn((arg: any) => {
      log.push([type, typeof arg === 'string' ? arg : arg?.content]);
    });
  return {
    error: record('error'),
    info: record('info'),
    log,
    success: record('success'),
    warning: record('warning'),
  };
});
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
vi.mock('xterm', () => ({
  Terminal: class {
    cols = 120;
    rows = 30;
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onResize = vi.fn(() => ({ dispose: vi.fn() }));
    open = vi.fn();
    write = vi.fn();
    writeln = vi.fn();
  },
}));
vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: class {} }));
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
} from '#/api/request';

import { STREAM_MAX_RECONNECT_ATTEMPTS, usePodPage } from './Pod';

const POD = {
  cluster_id: 1,
  name: 'web-0',
  namespace: 'default',
} as any;

async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0);
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
  /** 握手失败：浏览器只给 error + 1006 */
  fail(code = 1006) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.(new Event('error'));
    this.onclose?.({ code, wasClean: false });
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  /** 连上后服务端用 4401 关闭 */
  unauthorized() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: 4401, wasClean: true });
  }
}

const lastSocket = () => FakeWebSocket.instances.at(-1)!;
const allNotices = () => notices.log;
const LOGIN_EXPIRED_ONLY = [['warning', LOGIN_EXPIRED_MESSAGE]];

async function openTerminal() {
  const page = usePodPage();
  page.currentOperationPod.value = POD;
  page.execFormRef.value = { validate: vi.fn(async () => ({})) } as any;
  page.execFormModel.value.container = 'app';
  page.isExecModalVisible.value = true;
  await page.connectToTerminal();
  await flush();
  return page;
}

function startLogs() {
  const page = usePodPage();
  page.currentOperationPod.value = POD;
  page.logsFormModel.value.container = 'app';
  page.isLogsModalVisible.value = true;
  page.startLogsStream();
  // startLogsStream 开头会先调 stopLogsStream，固定提示「实时日志流已停止」（已有行为，不在本次范围）
  notices.log.length = 0;
  return page;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  notices.log.length = 0;
  access.accessToken = 'old-token';
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn();
      observe = vi.fn();
    },
  );
  document.body.innerHTML = '<div id="terminal-container"></div>';
  refreshTokenApi.mockResolvedValue('new-token');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('终端：刷新失败只提示登录过期', () => {
  it('握手失败 + 刷新失败：只有「登录已过期，请重新登录」', async () => {
    refreshTokenApi.mockRejectedValue(new Error('刷新令牌失败，请重新登录'));
    await openTerminal();
    lastSocket().fail();
    await flush(60_000);

    expect(allNotices()).toEqual(LOGIN_EXPIRED_ONLY);
    expect(notices.warning).toHaveBeenCalledWith({
      content: LOGIN_EXPIRED_MESSAGE,
      key: LOGIN_EXPIRED_MESSAGE_KEY,
    });
  });

  it('刷新后握手收到 4401：只有「登录已过期，请重新登录」', async () => {
    await openTerminal();
    lastSocket().fail();
    await flush();
    lastSocket().fail(4401);
    await flush(60_000);

    // 第一次握手失败在刷新成功后补报，「终端连接出现问题」只出现这一次
    expect(allNotices()).toEqual([
      ['error', '终端连接出现问题'],
      ['warning', LOGIN_EXPIRED_MESSAGE],
    ]);
  });

  it('p2-C：连上后反复 4401：只提示一次登录过期，不提示「终端连接已断开」', async () => {
    await openTerminal();
    for (let i = 0; i < 10; i++) {
      const socket = lastSocket();
      if (socket.readyState !== 0) break;
      socket.open();
      socket.unauthorized();
      await flush(30_000);
    }

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(allNotices()).toEqual([
      ['success', '终端连接已建立'],
      ['success', '终端连接已建立'],
      ['warning', LOGIN_EXPIRED_MESSAGE],
    ]);
  });
});

describe('终端：其他提示', () => {
  it(`握手一直失败直到重连上限：「终端连接出现问题」只提示一次，最终照常提示「终端连接已断开」`, async () => {
    await openTerminal();
    for (let i = 0; i < 20; i++) {
      const socket = lastSocket();
      if (socket.readyState === 0) socket.fail();
      await flush(30_000);
    }

    expect(FakeWebSocket.instances).toHaveLength(
      1 + STREAM_MAX_RECONNECT_ATTEMPTS,
    );
    expect(allNotices()).toEqual([
      ['error', '终端连接出现问题'],
      ['info', '终端连接已断开'],
    ]);
  });

  it('重新点连接是新的连接流程：会再提示一次「终端连接出现问题」', async () => {
    const page = await openTerminal();
    lastSocket().fail();
    await flush();
    lastSocket().open();
    page.terminalConnection.value?.close();
    await page.connectToTerminal();
    await flush();
    lastSocket().fail();
    await flush();

    expect(
      notices.error.mock.calls.filter(([text]) => text === '终端连接出现问题'),
    ).toHaveLength(2);
  });

  it('连上后正常关闭：照常提示「终端连接已断开」', async () => {
    await openTerminal();
    lastSocket().open();
    lastSocket().readyState = FakeWebSocket.CLOSED;
    lastSocket().onclose?.({ code: 1000, wasClean: true });
    await flush();

    expect(allNotices()).toEqual([
      ['success', '终端连接已建立'],
      ['info', '终端连接已断开'],
    ]);
  });
});

describe('实时日志：刷新失败只提示登录过期', () => {
  it('401 + 刷新失败：只有「登录已过期，请重新登录」，不提示「实时日志连接已停止」', async () => {
    refreshTokenApi.mockRejectedValue(new Error('刷新令牌失败，请重新登录'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('token expired', { status: 401 })),
    );
    startLogs();
    await flush(60_000);

    expect(allNotices()).toEqual(LOGIN_EXPIRED_ONLY);
  });

  it('刷新后仍 401：只有「登录已过期，请重新登录」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('token expired', { status: 401 })),
    );
    startLogs();
    await flush(60_000);

    expect(refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(allNotices()).toEqual(LOGIN_EXPIRED_ONLY);
  });

  it('非登录问题（500）重连到上限：照常提示「实时日志连接已停止」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    startLogs();
    for (let i = 0; i < 10; i++) await flush(30_000);

    expect(allNotices()).toEqual([['info', '📡 实时日志连接已停止']]);
  });
});
