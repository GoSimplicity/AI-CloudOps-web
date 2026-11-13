export type SocketEventName = 'close' | 'error' | 'message' | 'open';

export type SocketListenerSnapshot = Record<SocketEventName, number>;

function isSocketEvent(type: string): type is SocketEventName {
  return (
    type === 'open' ||
    type === 'message' ||
    type === 'error' ||
    type === 'close'
  );
}

function isFunctionListener(
  listener: EventListenerOrEventListenerObject | null,
): listener is EventListener {
  return typeof listener === 'function';
}

/**
 * 按浏览器事件模型分发 WebSocket 事件。
 *
 * `onopen` / `onmessage` / `onerror` / `onclose` 是 EventHandler IDL：
 * 赋值会登记对应事件的监听，赋 null 只卸掉这一条。`addEventListener`
 * 登记的是同一事件的另一条监听，不会被 IDL 赋 null 清掉。
 * `close()` 只改变 readyState 并记录调用；关闭事件由测试显式分发，
 * 与规范里「排队任务后再 fire」一致，避免在 close() 的调用栈里重入。
 */
export class BrowserSocket extends EventTarget {
  static CLOSED = 3;

  static CLOSING = 2;

  static CONNECTING = 0;

  static OPEN = 1;

  private readonly buckets = new Map<SocketEventName, Set<EventListener>>();

  private readonly idl = new Map<SocketEventName, EventListener | null>();

  binaryType: BinaryType = 'blob';

  readonly closeInvocations: Array<{
    code?: number;
    listenerCount: number;
    reason?: string;
  }> = [];

  readonly protocols: string[];

  readyState = BrowserSocket.CONNECTING;

  readonly url: string;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    if (protocols === undefined) this.protocols = [];
    else if (Array.isArray(protocols)) this.protocols = [...protocols];
    else this.protocols = [protocols];
  }

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, listener, options);
    if (!isSocketEvent(type) || !isFunctionListener(listener)) return;
    const bucket = this.buckets.get(type) ?? new Set<EventListener>();
    // 同一捕获阶段的重复登记会被事件目标忽略；这里不使用捕获。
    if (bucket.has(listener)) return;
    bucket.add(listener);
    this.buckets.set(type, bucket);
  }

  close(code?: number, reason?: string) {
    this.noteClose(code, reason);
  }

  emitClose(code: number, wasClean: boolean) {
    this.readyState = BrowserSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code, wasClean }));
  }

  fail(code = 1006) {
    this.readyState = BrowserSocket.CLOSED;
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new CloseEvent('close', { code, wasClean: false }));
  }

  listenerCount(type: SocketEventName) {
    return this.buckets.get(type)?.size ?? 0;
  }

  listenerSnapshot(): SocketListenerSnapshot {
    return {
      close: this.listenerCount('close'),
      error: this.listenerCount('error'),
      message: this.listenerCount('message'),
      open: this.listenerCount('open'),
    };
  }

  noteClose(code?: number, reason?: string) {
    this.closeInvocations.push({
      code,
      listenerCount: this.listenerCount('close'),
      reason,
    });
    if (
      this.readyState === BrowserSocket.CLOSING ||
      this.readyState === BrowserSocket.CLOSED
    ) {
      return;
    }
    this.readyState = BrowserSocket.CLOSED;
  }

  open() {
    this.readyState = BrowserSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(type, listener, options);
    if (!isSocketEvent(type) || !isFunctionListener(listener)) return;
    this.buckets.get(type)?.delete(listener);
  }

  /** 模拟 EventHandler IDL：同一事件名上只有这一条监听，null 只卸掉它。 */
  setEventHandler(type: SocketEventName, listener: EventListener | null) {
    const previous = this.idl.get(type);
    if (previous) this.removeEventListener(type, previous);
    this.idl.set(type, listener);
    if (listener) this.addEventListener(type, listener);
  }

  unauthorized() {
    this.readyState = BrowserSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code: 4401, wasClean: true }));
  }

  get onclose() {
    return this.idl.get('close') ?? null;
  }

  set onclose(listener: EventListener | null) {
    this.setEventHandler('close', listener);
  }

  get onerror() {
    return this.idl.get('error') ?? null;
  }

  set onerror(listener: EventListener | null) {
    this.setEventHandler('error', listener);
  }

  get onmessage() {
    return this.idl.get('message') ?? null;
  }

  set onmessage(listener: EventListener | null) {
    this.setEventHandler('message', listener);
  }

  get onopen() {
    return this.idl.get('open') ?? null;
  }

  set onopen(listener: EventListener | null) {
    this.setEventHandler('open', listener);
  }
}
