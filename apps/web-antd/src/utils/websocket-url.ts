export function websocketUrl(
  apiBase: string,
  path: string,
  origin: string,
): string {
  const url = new URL(
    `${apiBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
    origin,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/** 浏览器通过子协议携带登录凭证，避免访问日志记录带凭证的 URL */
export function websocketProtocols(token: string): string[] {
  if (!token) {
    throw new Error('WebSocket 登录凭证不能为空');
  }
  return ['cloudops-v1', `cloudops-auth.${token}`];
}
