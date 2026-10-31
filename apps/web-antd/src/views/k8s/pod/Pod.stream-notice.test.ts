import { effectScope } from 'vue';

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
const cleanup = vi.hoisted(() => ({
  input: vi.fn(),
  observer: vi.fn(),
  resize: vi.fn(),
  terminal: vi.fn(),
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
vi.mock('xterm', () => ({
  Terminal: class {
    cols = 120;
    rows = 30;
    dispose = cleanup.terminal;
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: cleanup.input }));
    onResize = vi.fn(() => ({ dispose: cleanup.resize }));
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
      disconnect = cleanup.observer;
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

describe('terminal teardown failure isolation', () => {
  it.each(['observer', 'input', 'terminal', 'socket', 'resize'])(
    '%s failure does not skip remaining cleanup or retain connection state',
    async (site) => {
      const page = await openTerminal();
      const socket = lastSocket();
      socket.open();
      page.terminalLoading.value = true;
      notices.log.length = 0;
      const fail = () => {
        throw new Error('PRIVATE_TEARDOWN_FAILURE');
      };
      switch (site) {
        case 'input': {
          cleanup.input.mockImplementationOnce(fail);
          break;
        }
        case 'observer': {
          cleanup.observer.mockImplementationOnce(fail);
          break;
        }
        case 'resize': {
          cleanup.resize.mockImplementationOnce(fail);
          break;
        }
        case 'socket': {
          socket.close.mockImplementationOnce(fail);
          break;
        }
        case 'terminal': {
          cleanup.terminal.mockImplementationOnce(fail);
          break;
        }
      }
      expect(() => page.disconnectTerminal()).not.toThrow();
      expect(cleanup.observer).toHaveBeenCalledTimes(1);
      expect(cleanup.input).toHaveBeenCalledTimes(1);
      expect(cleanup.resize).toHaveBeenCalledTimes(1);
      expect(cleanup.terminal).toHaveBeenCalledTimes(1);
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(page.terminal.value).toBeNull();
      expect(page.fitAddon.value).toBeNull();
      expect(page.terminalConnection.value).toBeNull();
      expect(page.isTerminalConnected.value).toBe(false);
      expect(page.terminalLoading.value).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(notices.log).toEqual([]);
      // 失效引用已清空：第二次关闭不重复释放，也不能重新连接。
      page.disconnectTerminal();
      await flush(10_000);
      expect(cleanup.observer).toHaveBeenCalledTimes(1);
      expect(cleanup.input).toHaveBeenCalledTimes(1);
      expect(cleanup.resize).toHaveBeenCalledTimes(1);
      expect(cleanup.terminal).toHaveBeenCalledTimes(1);
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(FakeWebSocket.instances).toHaveLength(1);
    },
  );

  it('does not inspect a throwing error message getter during terminal replacement', async () => {
    const page = usePodPage();
    expect(await page.initializeTerminal()).toBe(true);
    const previous = page.terminal.value;
    const failure = new Error('fixture disposal failure');
    const readMessage = vi.fn(() => {
      throw new Error('PRIVATE_DISPOSE_MESSAGE');
    });
    Object.defineProperty(failure, 'message', { get: readMessage });
    cleanup.terminal.mockImplementationOnce(() => {
      throw failure;
    });
    expect(await page.initializeTerminal()).toBe(true);
    expect(readMessage).not.toHaveBeenCalled();
    expect(page.terminal.value).not.toBe(previous);
    expect(page.terminal.value).not.toBeNull();
    expect(notices.error).not.toHaveBeenCalled();
    page.disconnectTerminal();
  });

  it.each([
    { clean: true, code: 1000, reconnect: false, refresh: false },
    { clean: true, code: 1003, reconnect: false, refresh: false },
    { clean: false, code: 1003, reconnect: true, refresh: false },
    { clean: false, code: 1006, reconnect: true, refresh: false },
    { clean: true, code: 4401, reconnect: true, refresh: true },
  ])(
    'close code $code clean=$clean preserves actual routing',
    async ({ clean, code, reconnect, refresh }) => {
      const page = usePodPage();
      const closed = vi.fn();
      const conn = page.execK8sPodWebSocket(
        {
          cluster_id: 1,
          container: 'app',
          namespace: 'default',
          pod_name: 'fixture',
        },
        vi.fn(),
        vi.fn(),
        vi.fn(),
        closed,
      );
      const socket = lastSocket();
      socket.open();
      socket.onclose?.({ code, wasClean: clean });
      // 旧连接的迟到回调不能对已换代连接重复作决定。
      socket.onclose?.({ code, wasClean: clean });
      await flush(1000);
      expect(refreshTokenApi).toHaveBeenCalledTimes(refresh ? 1 : 0);
      expect(FakeWebSocket.instances).toHaveLength(reconnect ? 2 : 1);
      expect(closed).toHaveBeenCalledTimes(reconnect ? 0 : 1);
      conn.close();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('resize cleanup failure on socket close still schedules normal reconnection', async () => {
    const page = await openTerminal();
    const socket = lastSocket();
    socket.open();
    cleanup.resize.mockImplementationOnce(() => {
      throw new Error('PRIVATE_RESIZE_CLEANUP');
    });
    expect(() =>
      socket.onclose?.({ code: 1006, wasClean: false }),
    ).not.toThrow();
    await flush(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    page.disconnectTerminal();
    expect(vi.getTimerCount()).toBe(0);
    expect(notices.log.flat().some((value) => value.includes('PRIVATE_'))).toBe(
      false,
    );
  });
});

it('scope disposal isolates terminal and log close failures and clears owned state', () => {
  const scope = effectScope();
  const page = scope.run(() => usePodPage());
  if (!page) {
    throw new Error('Expected owned Pod page scope');
  }
  const closeTerminal = vi.fn(() => {
    throw new Error('PRIVATE_TERMINAL_CLOSE');
  });
  const closeLogs = vi.fn(() => {
    throw new Error('PRIVATE_LOG_CLOSE');
  });
  page.terminalConnection.value = {
    close: closeTerminal,
    sendCommand: vi.fn(),
  };
  page.logsStreamConnection.value = { close: closeLogs };
  page.isTerminalConnected.value = true;
  page.terminalLoading.value = true;
  page.isLogsStreaming.value = true;
  expect(() => scope.stop()).not.toThrow();
  expect(closeTerminal).toHaveBeenCalledTimes(1);
  expect(closeLogs).toHaveBeenCalledTimes(1);
  expect(page.terminalConnection.value).toBeNull();
  expect(page.logsStreamConnection.value).toBeNull();
  expect(page.isTerminalConnected.value).toBe(false);
  expect(page.terminalLoading.value).toBe(false);
  expect(page.isLogsStreaming.value).toBe(false);
  expect(notices.log).toEqual([]);
});
