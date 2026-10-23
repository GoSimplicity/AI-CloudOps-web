import { describe, expect, it } from 'vitest';

import { websocketProtocols, websocketUrl } from './websocket-url';

describe('terminal gateway authentication', () => {
  it('uses the deployed HTTPS origin without putting credentials in the URL', () => {
    expect(
      websocketUrl('/api', '/tree/local/terminal/42', 'https://ops.example'),
    ).toBe('wss://ops.example/api/tree/local/terminal/42');
  });

  it('honors an explicitly configured API deployment', () => {
    expect(
      websocketUrl(
        'https://api.example/api/',
        '/tree/cloud/42/terminal',
        'http://localhost',
      ),
    ).toBe('wss://api.example/api/tree/cloud/42/terminal');
  });

  it('authenticates using the application and credential subprotocols', () => {
    expect(websocketProtocols('test.jwt.signature')).toEqual([
      'cloudops-v1',
      'cloudops-auth.test.jwt.signature',
    ]);
  });

  it('rejects a missing credential instead of offering anonymous authentication', () => {
    expect(() => websocketProtocols('')).toThrow('WebSocket 登录凭证不能为空');
  });
});
