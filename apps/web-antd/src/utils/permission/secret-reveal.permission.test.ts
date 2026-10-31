import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_PERMISSION_CODES } from '#/constants/permission-codes';

import {
  checkExplicitGrant,
  checkKeyPermission,
  EXPLICIT_GRANT_PERMISSION_KEYS,
  SECRET_REVEAL_PERMISSION_CODE,
  usePermission,
} from './index';

/**
 * SEC-25/26 规则 1：reveal 门禁与后端一致（AI-CloudOps@ed683ef internal/middleware/auth.go）
 * - :49-54 explicitGrantRoutes + :199-206：reveal 只认逐字相等的路由码，通配 / 参数段不覆盖；
 * - 角色不自动放行（后端按角色绑定的 API 判断，没有 super/admin 角色特判）；
 * - :170 仅用户名 admin 直接放行。
 */
const REVEAL = '/api/k8s/secret/:cluster_id/:namespace/:name/reveal';

describe('Secret reveal 权限码', () => {
  it('查看明文 / 复制明文改为 reveal 路由码，YAML 仍是 detail/yaml', () => {
    expect(SECRET_REVEAL_PERMISSION_CODE).toBe(REVEAL);
    expect(ALL_PERMISSION_CODES['k8s.secret.viewPlain']).toBe(REVEAL);
    expect(ALL_PERMISSION_CODES['k8s.secret.copyPlain']).toBe(REVEAL);
    expect(ALL_PERMISSION_CODES['k8s.secret.viewYaml']).toBe(
      '/api/k8s/secret/:cluster_id/:namespace/:name/detail/yaml',
    );
    expect([...EXPLICIT_GRANT_PERMISSION_KEYS].sort()).toEqual([
      'k8s.secret.copyPlain',
      'k8s.secret.viewPlain',
    ]);
  });
});

describe('checkExplicitGrant（纯函数）', () => {
  it('精确码放行', () => {
    expect(
      checkExplicitGrant({ codes: [REVEAL], username: 'ops' }, REVEAL),
    ).toBe(true);
  });
  it.each([
    ['*'],
    ['/*'],
    ['/api/k8s/*'],
    ['/api/k8s/secret/:cluster_id/:namespace/:name/:action'],
    ['/api/k8s/secret/:cluster_id/:namespace/:name/detail'],
    ['/api/k8s/secret/1/ns-a/secret-a/reveal'],
  ])('通配 / 参数段 / 具体路径 %s 不放行', (code) => {
    expect(checkExplicitGrant({ codes: [code], username: 'ops' }, REVEAL)).toBe(
      false,
    );
  });
  it.each([['super'], ['admin']])('角色 %s 没有精确码不放行', (role) => {
    expect(
      checkExplicitGrant(
        { codes: ['*'], roles: [role], username: 'ops' },
        REVEAL,
      ),
    ).toBe(false);
  });
  it('用户名 admin 放行（auth.go:170）', () => {
    expect(checkExplicitGrant({ codes: [], username: 'admin' }, REVEAL)).toBe(
      true,
    );
  });
  it('checkKeyPermission 对 reveal key 走显式授权，对普通 key 仍保留原放行规则', () => {
    const superRole = { codes: [], roles: ['super'], username: 'ops' };
    expect(checkKeyPermission(superRole, 'k8s.secret.viewPlain')).toBe(false);
    expect(checkKeyPermission(superRole, 'k8s.secret.copyPlain')).toBe(false);
    expect(checkKeyPermission(superRole, 'k8s.secret.viewYaml')).toBe(true);
    const wildcard = { codes: ['*'], username: 'ops' };
    expect(checkKeyPermission(wildcard, 'k8s.secret.viewPlain')).toBe(false);
    expect(checkKeyPermission(wildcard, 'k8s.pod.delete')).toBe(true);
  });
});

describe('usePermission().can / hasPerm 走真实 store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  function subject(
    info: { roles?: string[]; username: string },
    codes: string[],
  ) {
    useUserStore().setUserInfo(info as any);
    useAccessStore().setAccessCodes(codes);
  }
  it('admin / super 角色 + 通配码，非 admin 用户名：reveal 按钮不显示', () => {
    subject({ roles: ['admin', 'super'], username: 'ops' }, ['*', '/*']);
    const { can, hasPerm } = usePermission();
    expect(can('k8s.secret.viewPlain')).toBe(false);
    expect(can('k8s.secret.copyPlain')).toBe(false);
    expect(hasPerm(REVEAL)).toBe(false);
    // 普通按钮的角色放行不受影响
    expect(can('k8s.secret.viewYaml')).toBe(true);
  });
  it('精确 reveal 码：显示', () => {
    subject({ roles: ['ops'], username: 'ops' }, [REVEAL]);
    const { can, hasPerm } = usePermission();
    expect(can('k8s.secret.viewPlain')).toBe(true);
    expect(can('k8s.secret.copyPlain')).toBe(true);
    expect(hasPerm(REVEAL)).toBe(true);
  });
  it('用户名 admin、码集为空：显示', () => {
    subject({ roles: [], username: 'admin' }, []);
    expect(usePermission().can('k8s.secret.viewPlain')).toBe(true);
  });
});
