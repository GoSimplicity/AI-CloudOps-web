export function websocketUrl(apiBase: string, path: string, token: string, origin: string): string {
  const url = new URL(`${apiBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}
