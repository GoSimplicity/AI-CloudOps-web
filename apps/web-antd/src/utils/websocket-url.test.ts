import { describe, expect, it } from 'vitest';
import { websocketUrl } from './websocket-url';
describe('terminal gateway URL', () => {
  it('uses the deployed HTTPS origin and encodes credentials', () => {
    expect(websocketUrl('/api', '/tree/local/terminal/42', 'a+b&c', 'https://ops.example')).toBe('wss://ops.example/api/tree/local/terminal/42?token=a%2Bb%26c');
  });
  it('honors an explicitly configured API deployment', () => {
    expect(websocketUrl('https://api.example/api/', '/tree/cloud/42/terminal', 'test', 'http://localhost')).toBe('wss://api.example/api/tree/cloud/42/terminal?token=test');
  });
});
