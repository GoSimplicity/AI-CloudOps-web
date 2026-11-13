import { reactive } from 'vue';

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserSocket } from '#/testing/browser-socket';

import SshTerminal from './SshTerminal.vue';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

const transport = vi.hoisted(() => ({
  connections: vi.fn(),
  terminals: [] as any[],
}));
const access = reactive({ accessToken: 'fixture.token.signature' });
vi.mock('@vben/stores', () => ({ useAccessStore: () => access }));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('xterm', () => ({
  Terminal: class {
    cols = 96;
    dispose = vi.fn();
    focus = vi.fn();
    input?: (data: string) => void;
    inputDisposed = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    reset = vi.fn();
    resized?: () => void;
    rows = 37;
    sizeDisposed = vi.fn();
    write = vi.fn();
    constructor() {
      transport.terminals.push(this);
    }
    onData(callback: (data: string) => void) {
      this.input = callback;
      return { dispose: this.inputDisposed };
    }
    onResize(callback: () => void) {
      this.resized = callback;
      return { dispose: this.sizeDisposed };
    }
  },
}));
vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
class Socket extends BrowserSocket {
  override close = vi.fn((code?: number, reason?: string) => {
    this.noteClose(code, reason);
  });
  send = vi.fn();
  constructor(url: string, protocols: string[]) {
    super(url, protocols);
    transport.connections(url, protocols, this);
  }
}
let wrapper: undefined | VueWrapper;
const latest = () =>
  required(transport.connections.mock.calls.at(-1))[2] as Socket;
function render(resourceId = '42') {
  wrapper = mount(SshTerminal, {
    attachTo: document.body,
    props: { kind: 'local', resourceId },
  });
  return wrapper;
}
function reconnect() {
  return required(
    required(wrapper)
      .findAll('button')
      .find((button) => button.text().replaceAll(/\s/g, '') === '重新连接'),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  transport.terminals.length = 0;
  access.accessToken = 'fixture.token.signature';
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect() {}
      observe() {}
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
describe('sSH PTY交互合同', () => {
  it('干净URL声明PTY与初始尺寸，凭证仅在认证子协议，二进制输入保留控制按键', async () => {
    render();
    const [url, protocols] = required(transport.connections.mock.calls[0]);
    expect(new URL(url).search).toBe('?terminal_mode=pty-v1&cols=96&rows=37');
    expect(url).not.toContain(access.accessToken);
    expect(protocols).toEqual([
      'cloudops-v1',
      `cloudops-auth.${access.accessToken}`,
    ]);
    const socket = latest();
    socket.open();
    expect(socket.binaryType).toBe('arraybuffer');
    const terminal = transport.terminals[0];
    terminal.input('中\r\u0003\u001B[A\u007F\0');
    const binary = socket.send.mock.calls.find(
      (call) => typeof call[0] !== 'string',
    );
    expect(new TextDecoder().decode(required(binary)[0])).toBe(
      '中\r\u0003\u001B[A\u007F\0',
    );
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('长中文粘贴按字节分片并完整还原，超大输入零发送', () => {
    render();
    const socket = latest();
    socket.open();
    const terminal = transport.terminals[0];
    const text = '中😀\0'.repeat(12_000);
    terminal.input(text);
    const chunks = socket.send.mock.calls
      .filter((call) => typeof call[0] !== 'string')
      .map((call) => call[0] as Uint8Array);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.byteLength <= 64 * 1024)).toBe(true);
    const all = new Uint8Array(
      chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.byteLength;
    }
    expect(new TextDecoder().decode(all)).toBe(text);
    socket.send.mockClear();
    terminal.input('x'.repeat(1024 * 1024 + 1));
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('resize是独立文本控制帧，输出按原始字节交给xterm', () => {
    render();
    const socket = latest();
    socket.open();
    const terminal = transport.terminals[0];
    terminal.cols = 120;
    terminal.rows = 42;
    terminal.resized();
    expect(JSON.parse(required(socket.send.mock.calls.at(-1))[0])).toEqual({
      col_size: 120,
      op: 'resize',
      row_size: 42,
    });
    const bytes = new TextEncoder().encode('真实字节\r\n');
    socket.dispatchEvent(new MessageEvent('message', { data: bytes.buffer }));
    expect([...(terminal.write.mock.calls[0][0] as Uint8Array)]).toEqual([
      ...bytes,
    ]);
  });

  it('重连先卸下旧监听再 close，旧连接迟到事件不影响新会话', async () => {
    render();
    const first = latest();
    first.open();
    expect(first.listenerSnapshot()).toEqual({
      close: 1,
      error: 1,
      message: 1,
      open: 1,
    });
    access.accessToken = 'fresh.token.signature';
    await reconnect().trigger('click');
    expect(first.close).toHaveBeenCalledWith(1000, '关闭终端会话');
    expect(first.closeInvocations[0]?.listenerCount).toBe(0);
    expect(first.listenerSnapshot()).toEqual({
      close: 0,
      error: 0,
      message: 0,
      open: 0,
    });
    const second = latest();
    second.open();
    first.dispatchEvent(new MessageEvent('message', { data: 'OLD-OUTPUT' }));
    first.dispatchEvent(new CloseEvent('close'));
    first.dispatchEvent(new Event('error'));
    first.dispatchEvent(new Event('open'));
    await flushPromises();
    expect(required(transport.connections.mock.calls.at(-1))[1]).toContain(
      'cloudops-auth.fresh.token.signature',
    );
    expect(required(wrapper).find('[role="status"]').text()).toContain(
      '连接已建立',
    );
    expect(transport.terminals[0].write).not.toHaveBeenCalledWith('OLD-OUTPUT');
    expect(second.listenerSnapshot()).toEqual({
      close: 1,
      error: 1,
      message: 1,
      open: 1,
    });
  });

  it('退出立即关闭并清空显示，卸载释放输入订阅与终端', async () => {
    render();
    const socket = latest();
    socket.open();
    const terminal = transport.terminals[0];
    access.accessToken = '';
    await flushPromises();
    expect(socket.close).toHaveBeenCalled();
    expect(terminal.reset).toHaveBeenCalledTimes(2);
    expect(required(wrapper).text()).toContain('登录已失效');
    required(wrapper).unmount();
    wrapper = undefined;
    expect(terminal.inputDisposed).toHaveBeenCalledOnce();
    expect(terminal.sizeDisposed).toHaveBeenCalledOnce();
    expect(terminal.dispose).toHaveBeenCalledOnce();
  });

  it('连接超时可重试，已连接会话不会被一分钟前端定时器中断', async () => {
    render();
    const first = latest();
    vi.advanceTimersByTime(20_000);
    await flushPromises();
    expect(first.close).toHaveBeenCalled();
    expect(required(wrapper).text()).toContain('连接超时');
    await reconnect().trigger('click');
    const second = latest();
    second.open();
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('连接失败先卸监听再 close，随后的 close 不改写失败原因', async () => {
    render();
    const socket = latest();
    socket.dispatchEvent(new Event('error'));
    await flushPromises();
    expect(socket.close).toHaveBeenCalledWith(1000, '关闭终端会话');
    expect(socket.closeInvocations[0]?.listenerCount).toBe(0);
    expect(socket.listenerSnapshot()).toEqual({
      close: 0,
      error: 0,
      message: 0,
      open: 0,
    });
    socket.dispatchEvent(
      new CloseEvent('close', { code: 1006, wasClean: false }),
    );
    expect(required(wrapper).text()).toContain('终端连接失败');
    expect(required(wrapper).text()).not.toContain('终端未能建立');
  });

  it('卸载后旧连接不再接收输出', async () => {
    render();
    const socket = latest();
    socket.open();
    const terminal = transport.terminals[0];
    required(wrapper).unmount();
    wrapper = undefined;
    expect(socket.listenerSnapshot()).toEqual({
      close: 0,
      error: 0,
      message: 0,
      open: 0,
    });
    socket.dispatchEvent(
      new MessageEvent('message', { data: 'after-unmount' }),
    );
    expect(terminal.write).not.toHaveBeenCalledWith('after-unmount');
  });

  it('非法资源ID或无凭证不会创建连接', () => {
    render('-1');
    expect(transport.connections).not.toHaveBeenCalled();
    required(wrapper).unmount();
    wrapper = undefined;
    access.accessToken = '';
    render();
    expect(transport.connections).not.toHaveBeenCalled();
  });
});
