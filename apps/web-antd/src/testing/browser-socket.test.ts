import { describe, expect, it, vi } from 'vitest';

import { BrowserSocket } from './browser-socket';

describe('浏览器 WebSocket 替身', () => {
  it('同一次 error 事件同时交给 onerror 和 addEventListener', () => {
    const socket = new BrowserSocket('ws://fixture.invalid/socket');
    const fromProperty = vi.fn();
    const fromListener = vi.fn();
    socket.setEventHandler('error', fromProperty);
    expect(socket.onerror).toBe(fromProperty);
    socket.addEventListener('error', fromListener);

    const event = new Event('error');
    socket.dispatchEvent(event);

    expect(fromProperty).toHaveBeenCalledTimes(1);
    expect(fromListener).toHaveBeenCalledTimes(1);
    expect(fromProperty.mock.calls[0]?.[0]).toBe(event);
    expect(fromListener.mock.calls[0]?.[0]).toBe(event);
    expect(socket.listenerCount('error')).toBe(2);
  });

  it('onerror = null 只移除 IDL 监听，单独的 addEventListener 仍会收到 error', () => {
    const socket = new BrowserSocket('ws://fixture.invalid/socket');
    const fromProperty = vi.fn();
    const fromListener = vi.fn();
    socket.setEventHandler('error', fromProperty);
    socket.addEventListener('error', fromListener);
    socket.setEventHandler('error', null);

    socket.dispatchEvent(new Event('error'));

    expect(fromProperty).not.toHaveBeenCalled();
    expect(fromListener).toHaveBeenCalledTimes(1);
    expect(socket.listenerCount('error')).toBe(1);
  });

  it('removeEventListener 使用同一函数引用后，再次分发不再调用', () => {
    const socket = new BrowserSocket('ws://fixture.invalid/socket');
    const listener = vi.fn();
    socket.addEventListener('message', listener);
    socket.dispatchEvent(new MessageEvent('message', { data: 'once' }));
    socket.removeEventListener('message', listener);
    socket.dispatchEvent(new MessageEvent('message', { data: 'twice' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ data: 'once' });
    expect(socket.listenerCount('message')).toBe(0);
  });

  it('close 只记录调用，不在调用栈里同步派发 close', () => {
    const socket = new BrowserSocket('ws://fixture.invalid/socket');
    const listener = vi.fn();
    socket.addEventListener('close', listener);
    socket.close(1000, '关闭终端会话');

    expect(listener).not.toHaveBeenCalled();
    expect(socket.readyState).toBe(BrowserSocket.CLOSED);
    expect(socket.closeInvocations).toEqual([
      {
        code: 1000,
        listenerCount: 1,
        reason: '关闭终端会话',
      },
    ]);
  });
});
