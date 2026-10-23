import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useAccessStore } from '@vben/stores';
import { useAppConfig } from '@vben/hooks';
import { Terminal, type IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { websocketProtocols, websocketUrl } from '#/utils/websocket-url';

export type SshConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
const MAX_FRAME_BYTES = 64 * 1024;
const MAX_PASTE_BYTES = 1024 * 1024;

export function useSshTerminal(
  viewport: Ref<HTMLElement | null>,
  options: { kind: () => 'cloud' | 'local'; resourceId: () => string },
) {
  const access = useAccessStore();
  const state = ref<SshConnectionState>('idle');
  const error = ref('');
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let socket: WebSocket | undefined;
  let connectionTimer: number | undefined;
  let inputSubscription: IDisposable | undefined;
  let sizeSubscription: IDisposable | undefined;
  let observer: ResizeObserver | undefined;
  let generation = 0;
  let mounted = false;

  const dimensions = () => ({
    cols: Math.max(1, Math.min(1000, Math.floor(terminal?.cols || 80))),
    rows: Math.max(1, Math.min(500, Math.floor(terminal?.rows || 25))),
  });
  function clearTimer() {
    if (connectionTimer !== undefined) window.clearTimeout(connectionTimer);
    connectionTimer = undefined;
  }
  function releaseSocket() {
    clearTimer();
    const previous = socket;
    socket = undefined;
    if (!previous) return;
    previous.onopen = previous.onclose = previous.onerror = previous.onmessage = null;
    if (previous.readyState === WebSocket.OPEN || previous.readyState === WebSocket.CONNECTING) {
      try { previous.close(1000, '关闭终端会话'); } catch { /* 连接可能已同时关闭 */ }
    }
  }
  function resize() {
    if (!socket || socket.readyState !== WebSocket.OPEN || state.value !== 'connected') return;
    const { cols, rows } = dimensions();
    socket.send(JSON.stringify({ op: 'resize', col_size: cols, row_size: rows }));
  }
  function fit() {
    if (!viewport.value?.isConnected) return;
    try { fitAddon?.fit(); } catch { /* 隐藏或正在卸载的面板等待下一次有效尺寸 */ }
  }
  function sendInput(data: string) {
    const current = socket;
    if (!current || current.readyState !== WebSocket.OPEN || state.value !== 'connected') return;
    const bytes = new TextEncoder().encode(data);
    if (bytes.byteLength > MAX_PASTE_BYTES) {
      error.value = '单次输入不能超过 1 MiB，本次输入未发送';
      return;
    }
    error.value = '';
    // SSH 接收字节流，码点跨帧不会丢失，不在浏览器回显或缓存到回车
    for (let offset = 0; offset < bytes.byteLength; offset += MAX_FRAME_BYTES) {
      if (current !== socket || current.readyState !== WebSocket.OPEN) return;
      current.send(bytes.slice(offset, offset + MAX_FRAME_BYTES));
    }
  }
  function ensureTerminal() {
    if (terminal) return true;
    if (!viewport.value) return false;
    try {
      terminal = new Terminal({
        cursorBlink: true, fontSize: 14, convertEol: false, screenReaderMode: true,
        fontFamily: 'SFMono-Regular, Consolas, monospace',
        scrollback: 3000,
        theme: { background: '#0d1117', foreground: '#e6edf3', cursor: '#e6edf3', selectionBackground: '#385d7a' },
      });
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(viewport.value);
      inputSubscription = terminal.onData(sendInput);
      sizeSubscription = terminal.onResize(resize);
      observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
      observer?.observe(viewport.value);
      fit();
      return true;
    } catch {
      terminal?.dispose();
      terminal = undefined;
      fitAddon = undefined;
      observer?.disconnect();
      observer = undefined;
      state.value = 'error';
      error.value = '终端初始化失败，请重试';
      return false;
    }
  }
  function connect() {
    const ticket = ++generation;
    releaseSocket();
    error.value = '';
    const id = options.resourceId();
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
      state.value = 'error';
      error.value = '资源 ID 无效，请从资源列表重新打开终端';
      return;
    }
    const token = access.accessToken;
    if (!token) {
      state.value = 'error';
      error.value = '登录凭证不可用，请重新登录';
      return;
    }
    if (!ensureTerminal()) return;
    terminal?.reset();
    fit();
    state.value = 'connecting';
    try {
      const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
      const path = options.kind() === 'local'
        ? `tree/local/terminal/${Number(id)}` : `tree/cloud/${Number(id)}/terminal`;
      const url = new URL(websocketUrl(apiURL, path, window.location.origin));
      const { cols, rows } = dimensions();
      url.searchParams.set('terminal_mode', 'pty-v1');
      url.searchParams.set('cols', String(cols));
      url.searchParams.set('rows', String(rows));
      const candidate = new WebSocket(url.toString(), websocketProtocols(token));
      candidate.binaryType = 'arraybuffer';
      socket = candidate;
      const current = () => ticket === generation && socket === candidate;
      connectionTimer = window.setTimeout(() => {
        if (!current()) return;
        state.value = 'error';
        error.value = '终端连接超时，请确认资源状态和登录状态后重试';
        releaseSocket();
      }, 20_000);
      candidate.onopen = () => {
        if (!current()) return;
        clearTimer();
        state.value = 'connected';
        resize();
        terminal?.focus();
      };
      candidate.onmessage = event => {
        if (!current()) return;
        if (typeof event.data === 'string') terminal?.write(event.data);
        else if (Object.prototype.toString.call(event.data) === '[object ArrayBuffer]') terminal?.write(new Uint8Array(event.data as ArrayBuffer));
        else if (ArrayBuffer.isView(event.data)) {
          terminal?.write(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength));
        }
      };
      candidate.onerror = () => {
        if (!current()) return;
        state.value = 'error';
        error.value = '终端连接失败，请确认资源的 SSH 配置、网络和登录状态';
        releaseSocket();
      };
      candidate.onclose = () => {
        if (!current()) return;
        clearTimer();
        socket = undefined;
        if (state.value === 'connecting') {
          state.value = 'error';
          error.value = '终端未能建立，请检查资源配置后重试';
        } else if (state.value !== 'error') state.value = 'disconnected';
      };
    } catch {
      releaseSocket();
      state.value = 'error';
      error.value = '无法建立终端连接，请重试';
    }
  }
  function disconnect() {
    generation++;
    releaseSocket();
    state.value = 'disconnected';
  }
  watch(() => access.accessToken, token => {
    if (token) return;
    disconnect();
    terminal?.reset();
    state.value = 'error';
    error.value = '登录已失效，终端会话已关闭';
  });
  watch([options.kind, options.resourceId], () => { if (mounted) connect(); });
  onMounted(() => {
    mounted = true;
    window.addEventListener('resize', fit);
    connect();
  });
  onBeforeUnmount(() => {
    mounted = false;
    disconnect();
    window.removeEventListener('resize', fit);
    observer?.disconnect();
    inputSubscription?.dispose();
    sizeSubscription?.dispose();
    terminal?.dispose();
    terminal = undefined;
    fitAddon = undefined;
  });
  return { state, error, connect, disconnect };
}
