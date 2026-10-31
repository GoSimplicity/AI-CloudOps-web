import type { FormInstance } from 'ant-design-vue';

import { mount, type VueWrapper } from '@vue/test-utils';
import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePodPage } from '#/views/k8s/pod/Pod';
import TerminalConnect from '#/views/servicetree/TerminalConnect.vue';
import WebTerminal from '#/views/servicetree/WebTerminal.vue';

const { connections, access } = vi.hoisted(() => ({
  connections: vi.fn(),
  access: { accessToken: 'test.jwt.signature' },
}));
vi.mock('@vben/stores', () => ({ useAccessStore: () => access }));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '42' }, query: { id: '42' } }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('#/api/request', () => ({
  requestClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('xterm', () => ({
  Terminal: class {
    cols = 120;
    rows = 30;
    reset = vi.fn();
    write = vi.fn();
    writeln = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onResize = vi.fn(() => ({ dispose: vi.fn() }));
    dispose = vi.fn();
  },
}));
vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: class {} }));

class TestSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState = TestSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn();
  constructor(url: string, protocols: string[]) {
    connections(url, protocols, this);
  }
}
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  access.accessToken = 'test.jwt.signature';
  vi.stubGlobal('WebSocket', TestSocket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function expectHandshake(path: string, search = '') {
  expect(connections).toHaveBeenCalledTimes(1);
  const [url, protocols] = connections.mock.calls[0]!;
  expect(new URL(url).pathname).toBe(path);
  expect(new URL(url).search).toBe(search);
  expect(url.includes(access.accessToken)).toBe(false);
  expect(protocols).toEqual([
    'cloudops-v1',
    `cloudops-auth.${access.accessToken}`,
  ]);
}

describe('三个终端客户端的握手契约', () => {
  it('本地主机终端仅通过子协议发送凭证', () => {
    wrapper = mount(WebTerminal);
    expectHandshake(
      '/api/tree/local/terminal/42',
      '?terminal_mode=pty-v1&cols=120&rows=30',
    );
  });

  it('云主机终端仅通过子协议发送凭证', () => {
    wrapper = mount(TerminalConnect, {
      global: { config: { warnHandler: () => {} } },
    });
    expectHandshake(
      '/api/tree/cloud/42/terminal',
      '?terminal_mode=pty-v1&cols=120&rows=30',
    );
  });

  it('pod 终端通过实际连接入口遵守同一握手契约', async () => {
    const page = usePodPage();
    document.body.innerHTML = '<div id="terminal-container"></div>';
    page.currentOperationPod.value = {
      cluster_id: 1,
      name: 'web-pod',
      namespace: 'example',
      uid: 'uid',
      labels: '{}',
      annotations: '{}',
      status: 'Running',
      phase: 'Running',
      node_name: 'node',
      pod_ip: '',
      host_ip: '',
      qos_class: 'Burstable',
      restart_count: 0,
      ready: '1/1',
      service_account: 'default',
      restart_policy: 'Always',
      dns_policy: 'ClusterFirst',
      conditions: '[]',
      containers: '[]',
      init_containers: '[]',
      volumes: '[]',
      created_at: '',
      owner_references: '[]',
      resource_version: '1',
      generation: 1,
      spec: '{}',
    };
    page.execFormRef.value = {
      validate: vi.fn().mockResolvedValue(undefined),
    } as unknown as FormInstance;
    page.execFormModel.value.container = 'main';
    page.execFormModel.value.shell = '/bin/sh';
    await page.connectToTerminal();
    expectHandshake(
      '/api/k8s/pod/1/example/web-pod/containers/main/exec',
      '?shell=sh',
    );
    const socket = connections.mock.calls[0]![2];
    socket.readyState = WebSocket.OPEN;
    socket.onopen();
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      col_size: 120,
      op: 'resize',
      row_size: 30,
    });
    page.terminalConnection.value?.sendCommand('echo safe');
    expect(JSON.parse(socket.send.mock.calls.at(-1)[0])).toEqual({
      data: 'echo safe',
      op: 'stdin',
    });
    const longPaste = 'a'.repeat(65_535) + '中文😀\0'.repeat(12_000);
    const beforePaste = socket.send.mock.calls.length;
    const onData = vi.mocked(page.terminal.value!.onData).mock.calls[0]![0];
    onData(longPaste);
    const frames = socket.send.mock.calls
      .slice(beforePaste)
      .map(([frame]: [string]) => JSON.parse(frame));
    expect(frames.length).toBeGreaterThan(1);
    expect(
      frames.every(
        (frame: { data: string; op: string }) =>
          frame.op === 'stdin' &&
          new TextEncoder().encode(frame.data).byteLength <= 65_536,
      ),
    ).toBe(true);
    expect(frames.map((frame: { data: string }) => frame.data).join('')).toBe(
      longPaste,
    );
    const firstInput = vi.mocked(page.terminal.value!.onData).mock.results[0]!
      .value;
    socket.onclose({ code: 1006, wasClean: false });
    expect(page.isTerminalConnected.value).toBe(false);
    expect(page.terminalLoading.value).toBe(true);
    access.accessToken = 'fresh.jwt.signature';
    vi.advanceTimersByTime(3000);
    const latest = connections.mock.calls.at(-1)!;
    expect(latest[1]).toEqual([
      'cloudops-v1',
      'cloudops-auth.fresh.jwt.signature',
    ]);
    const reconnected = latest[2];
    reconnected.readyState = WebSocket.OPEN;
    reconnected.onopen();
    expect(firstInput.dispose).toHaveBeenCalledTimes(1);
    socket.onclose({ code: 1000, wasClean: true });
    expect(page.isTerminalConnected.value).toBe(true);
    page.disconnectTerminal();
  });

  it('pod 页面作用域销毁时关闭终端与日志流', () => {
    const scope = effectScope();
    const page = scope.run(() => usePodPage())!;
    const closeTerminal = vi.fn();
    const closeLogs = vi.fn();
    page.terminalConnection.value = {
      close: closeTerminal,
      sendCommand: vi.fn(),
    };
    page.logsStreamConnection.value = { close: closeLogs };
    page.isTerminalConnected.value = true;
    scope.stop();
    expect(closeTerminal).toHaveBeenCalledTimes(1);
    expect(closeLogs).toHaveBeenCalledTimes(1);
    expect(page.isTerminalConnected.value).toBe(false);
    expect(page.logsStreamConnection.value).toBeNull();
  });

  it('没有登录凭证时不创建连接', () => {
    access.accessToken = '';
    wrapper = mount(WebTerminal);
    expect(connections).not.toHaveBeenCalled();
  });
});
