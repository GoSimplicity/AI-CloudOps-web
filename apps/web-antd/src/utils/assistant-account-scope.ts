/** 助手缓存只接受认证资料中的稳定 UID，不认领历史无归属数据 */
export function assistantOwner(
  userInfo: { userId?: unknown } | null,
  token: unknown,
) {
  const id = userInfo?.userId;
  return typeof token === 'string' &&
    token.trim() &&
    (typeof id === 'string' || typeof id === 'number') &&
    String(id).trim() &&
    String(id) !== '0'
    ? String(id).trim()
    : '';
}

export function createAssistantAccountScope(storage: Storage) {
  for (const key of [
    'aiAssistantChatState',
    'aiAssistantSessions',
    'assistant-session-history',
  ]) {
    try {
      storage.removeItem(key);
    } catch {
      /* 浏览器禁用存储时仍保持内存隔离 */
    }
  }
  let owner = '';
  let generation = 0;
  let request = 0;
  const keyFor = (name: string) =>
    `cloudops-assistant:v1:${encodeURIComponent(owner)}:${name}`;
  return {
    setOwner(next: string) {
      owner = next;
      generation++;
      request++;
    },
    invalidate() {
      request++;
    },
    identity() {
      return { owner, generation };
    },
    sameOwner(ticket: { owner: string; generation: number }) {
      return (
        !!owner && ticket.owner === owner && ticket.generation === generation
      );
    },
    ticket() {
      return { owner, generation, request: ++request };
    },
    current(ticket: { owner: string; generation: number; request: number }) {
      return (
        !!owner &&
        ticket.owner === owner &&
        ticket.generation === generation &&
        ticket.request === request
      );
    },
    read<T>(name: string): T | undefined {
      if (!owner) return undefined;
      try {
        const raw = storage.getItem(keyFor(name));
        if (!raw) return undefined;
        const data = JSON.parse(raw);
        return data?.owner === owner ? (data.value as T) : undefined;
      } catch {
        return undefined;
      }
    },
    write(name: string, value: unknown) {
      if (!owner) return;
      try {
        storage.setItem(keyFor(name), JSON.stringify({ owner, value }));
      } catch {
        /* 存储失败不影响会话 */
      }
    },
  };
}
