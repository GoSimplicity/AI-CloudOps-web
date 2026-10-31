import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SshTerminal from './SshTerminal.vue';

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
    rows = 37;
    input?: (data: string) => void;
    resized?: () => void;
    write = vi.fn();
    reset = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    loadAddon = vi.fn();
    dispose = vi.fn();
    inputDisposed = vi.fn();
    sizeDisposed = vi.fn();
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
class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState = 0;
  binaryType = '';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = Socket.CLOSED;
  });
  constructor(url: string, protocols: string[]) {
    transport.connections(url, protocols, this);
  }
  open() {
    this.readyState = Socket.OPEN;
    this.onopen?.();
  }
}
let wrapper: VueWrapper | undefined;
const latest = () => transport.connections.mock.calls.at(-1)![2] as Socket;
function render(resourceId = '42') {
  wrapper = mount(SshTerminal, {
    props: { kind: 'local', resourceId },
    attachTo: document.body,
  });
  return wrapper;
}
function reconnect() {
  return wrapper!
    .findAll('button')
    .find((button) => button.text().replace(/\s/g, '') === '重新连接')!;
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
      observe() {}
      disconnect() {}
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
    const [url, protocols] = transport.connections.mock.calls[0]!;
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
    terminal.input('中\r\x03\x1b[A\x7f\0');
    const binary = socket.send.mock.calls.filter(
      (call) => typeof call[0] !== 'string',
    );
    expect(new TextDecoder().decode(binary[0]![0])).toBe(
      '中\r\x03\x1b[A\x7f\0',
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
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      col_size: 120,
      op: 'resize',
      row_size: 42,
    });
    const bytes = new TextEncoder().encode('真实字节\r\n');
    socket.onmessage?.({ data: bytes.buffer });
    expect(Array.from(terminal.write.mock.calls[0][0] as Uint8Array)).toEqual(
      Array.from(bytes),
    );
  });

  it('重连读取最新令牌，旧socket迟到事件不影响新会话', async () => {
    render();
    const first = latest();
    first.open();
    const lateClose = first.onclose!;
    const lateMessage = first.onmessage!;
    access.accessToken = 'fresh.token.signature';
    await reconnect().trigger('click');
    const second = latest();
    second.open();
    lateClose();
    lateMessage({ data: 'OLD-OUTPUT' });
    await flushPromises();
    expect(transport.connections.mock.calls.at(-1)![1]).toContain(
      'cloudops-auth.fresh.token.signature',
    );
    expect(wrapper!.find('[role="status"]').text()).toContain('连接已建立');
    expect(transport.terminals[0].write).not.toHaveBeenCalledWith('OLD-OUTPUT');
    expect(first.close).toHaveBeenCalled();
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
    expect(wrapper!.text()).toContain('登录已失效');
    wrapper!.unmount();
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
    expect(wrapper!.text()).toContain('连接超时');
    await reconnect().trigger('click');
    const second = latest();
    second.open();
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('非法资源ID或无凭证不会创建连接', () => {
    render('-1');
    expect(transport.connections).not.toHaveBeenCalled();
    wrapper!.unmount();
    wrapper = undefined;
    access.accessToken = '';
    render();
    expect(transport.connections).not.toHaveBeenCalled();
  });
});
