import { beforeEach, describe, expect, it } from 'vitest';
import {
  assistantOwner,
  createAssistantAccountScope,
} from './assistant-account-scope';

beforeEach(() => localStorage.clear());
describe('助手缓存账户隔离', () => {
  it('只有已认证的稳定 UID 能读写，旧无归属历史不认领', () => {
    for (const key of [
      'aiAssistantChatState',
      'aiAssistantSessions',
      'assistant-session-history',
    ])
      localStorage.setItem(key, 'sensitive legacy');
    const scope = createAssistantAccountScope(localStorage);
    expect(localStorage.length).toBe(0);
    scope.write('chat', 'anonymous');
    expect(scope.read('chat')).toBeUndefined();
    expect(assistantOwner({ userId: 0 }, 'token')).toBe('');
    expect(assistantOwner({ userId: 1 }, '')).toBe('');
    expect(assistantOwner({ userId: 1 }, 'token')).toBe('1');
  });
  it('两 UID 缓存互不覆盖，退出拒绝读写，重新登录仅恢复本人历史', () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    scope.write('chat', { message: 'first user' });
    scope.setOwner('2');
    expect(scope.read('chat')).toBeUndefined();
    scope.write('chat', { message: 'second user' });
    scope.setOwner('');
    expect(scope.read('chat')).toBeUndefined();
    scope.write('chat', 'logged out');
    scope.setOwner('1');
    expect(scope.read('chat')).toEqual({ message: 'first user' });
    scope.setOwner('2');
    expect(scope.read('chat')).toEqual({ message: 'second user' });
  });
  it('拒绝错误 owner 的缓存和乱序/账户往返后的请求结果', () => {
    const scope = createAssistantAccountScope(localStorage);
    scope.setOwner('1');
    localStorage.setItem(
      'cloudops-assistant:v1:1:chat',
      JSON.stringify({ owner: '2', value: 'other' }),
    );
    expect(scope.read('chat')).toBeUndefined();
    const old = scope.ticket();
    const current = scope.ticket();
    expect(scope.current(old)).toBe(false);
    expect(scope.current(current)).toBe(true);
    scope.setOwner('2');
    scope.setOwner('1');
    expect(scope.current(current)).toBe(false);
    const canceled = scope.ticket();
    scope.invalidate();
    expect(scope.current(canceled)).toBe(false);
  });
});
