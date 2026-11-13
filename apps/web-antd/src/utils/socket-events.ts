type SocketHandlers = {
  close?: (event: CloseEvent) => void;
  error?: (event: Event) => void;
  message?: (event: MessageEvent) => void;
  open?: (event: Event) => void;
};

/**
 * 给这一个 WebSocket 登记 open/message/error/close。
 * 返回的函数用同一函数引用卸掉这四条监听，可重复调用。
 */
export function bindSocketEvents(socket: WebSocket, handlers: SocketHandlers) {
  const remove: Array<() => void> = [];
  const onOpen = handlers.open;
  if (onOpen) {
    socket.addEventListener('open', onOpen);
    remove.push(() => {
      socket.removeEventListener('open', onOpen);
    });
  }
  const onMessage = handlers.message;
  if (onMessage) {
    socket.addEventListener('message', onMessage);
    remove.push(() => {
      socket.removeEventListener('message', onMessage);
    });
  }
  const onError = handlers.error;
  if (onError) {
    socket.addEventListener('error', onError);
    remove.push(() => {
      socket.removeEventListener('error', onError);
    });
  }
  const onClose = handlers.close;
  if (onClose) {
    socket.addEventListener('close', onClose);
    remove.push(() => {
      socket.removeEventListener('close', onClose);
    });
  }
  return () => {
    for (const detach of remove) detach();
    remove.length = 0;
  };
}
