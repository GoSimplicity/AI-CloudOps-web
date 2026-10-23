import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { generateAccessible } from '../../../../packages/effects/access/src/accessible';

describe('异步权限路由账户归属', () => {
  it('旧菜单返回前账户已变化时不得向真实router注册旧路由', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] });
    const pending = Promise.withResolvers<any[]>();
    let current = true;
    const task = generateAccessible('backend', {
      router,
      routes: [],
      fetchMenuListAsync: () => pending.promise,
      assertCurrent: () => {
        if (!current) throw new Error('stale-owner');
      },
    } as any);
    const result = task.catch((error) => error);
    current = false;
    pending.resolve([
      {
        name: 'OldPrivateRoute',
        path: '/old-private',
        component: '',
        meta: { title: 'Old private menu' },
      },
    ]);
    expect(await result).toBeInstanceOf(Error);
    expect(router.hasRoute('OldPrivateRoute')).toBe(false);
  });
});
