import { createPinia, setActivePinia } from 'pinia';
import { useAccessStore, useUserStore } from '@vben/stores';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PERMISSION_CODES,
  type PermissionKey,
} from '#/constants/permission-codes';

import {
  checkPermission,
  getPermissionCode,
  isSuperAdmin,
  usePermission,
} from './index';
import {
  createPermissionDeniedError,
  isForbiddenResponse,
  isPermissionDeniedError,
} from './forbidden';

const ALL_KEYS = Object.keys(PERMISSION_CODES) as PermissionKey[];
const POD_DELETE = '/api/k8s/pod/:cluster_id/:namespace/:name/delete';

describe('权限码常量', () => {
  it('按钮 key 映射为后端路由模板路径（字符串，不带方法）', () => {
    expect(getPermissionCode('k8s.pod.delete')).toBe(POD_DELETE);
    expect(getPermissionCode('k8s.pod.exec')).toBe(
      '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/exec',
    );
    expect(getPermissionCode('aiops.autofix.run')).toBe(
      '/api/v1/autofix/workflow',
    );
    for (const key of ALL_KEYS) {
      expect(PERMISSION_CODES[key]).toMatch(/^\/api\//);
      expect(PERMISSION_CODES[key]).not.toMatch(/^(GET|POST|PUT|DELETE)\s/);
    }
  });

  it('8 个待定按钮和 k8s/cluster 按钮不在本单常量中', () => {
    for (const key of [
      'k8s.secret.viewPlain',
      'k8s.secret.copyPlain',
      'k8s.secret.viewYaml',
      'system.audit.delete',
      'system.audit.batchDelete',
      'k8s.namespace.forceDelete',
      'k8s.cluster.kubeconfigCopy',
      'k8s.cluster.kubeconfigDownload',
      'k8s.cluster.delete',
      'k8s.cluster.batchDelete',
    ]) {
      expect(PERMISSION_CODES).not.toHaveProperty(key);
    }
    expect(ALL_KEYS).toHaveLength(70);
  });
});

describe('checkPermission 纯函数', () => {
  it('拥有对应权限码时放行', () => {
    expect(checkPermission({ codes: [POD_DELETE] }, POD_DELETE)).toBe(true);
  });

  it('缺少权限码时拒绝，且不按方法前缀或前缀路径模糊匹配', () => {
    expect(checkPermission({ codes: [] }, POD_DELETE)).toBe(false);
    expect(checkPermission({ codes: null }, POD_DELETE)).toBe(false);
    expect(
      checkPermission({ codes: [`DELETE ${POD_DELETE}`] }, POD_DELETE),
    ).toBe(false);
    expect(checkPermission({ codes: ['/api/k8s/pod'] }, POD_DELETE)).toBe(
      false,
    );
  });

  it('多个权限码满足任意一个即可；空要求不放行普通用户', () => {
    expect(checkPermission({ codes: ['b'] }, ['a', 'b'])).toBe(true);
    expect(checkPermission({ codes: ['c'] }, ['a', 'b'])).toBe(false);
    expect(checkPermission({ codes: ['a'] }, [])).toBe(false);
  });

  it.each(['*', '/*'])('通配码 %s 全部放行', (wildcard) => {
    expect(checkPermission({ codes: [wildcard] }, POD_DELETE)).toBe(true);
  });

  it('超级管理员 / admin 角色在没有任何权限码时也放行', () => {
    expect(isSuperAdmin({ roles: ['super'] })).toBe(true);
    expect(isSuperAdmin({ roles: ['admin'] })).toBe(true);
    expect(isSuperAdmin({ roles: ['ops'] })).toBe(false);
    expect(isSuperAdmin({ username: 'admin' })).toBe(true);
    expect(isSuperAdmin({ username: 'Admin' })).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
    expect(checkPermission({ codes: [], roles: ['admin'] }, POD_DELETE)).toBe(
      true,
    );
    expect(checkPermission({ codes: [], roles: ['ops'] }, POD_DELETE)).toBe(
      false,
    );
  });
});

describe('P3-2 / P3-4 / P3-1 边界', () => {
  it('roles 不是数组时不报错、不放行（仍可按用户名 admin 放行）', () => {
    for (const roles of ['admin', { 0: 'admin' }, 1] as any[]) {
      expect(isSuperAdmin({ roles, username: 'ops' })).toBe(false);
      expect(isSuperAdmin({ roles, username: 'admin' })).toBe(true);
    }
  });

  it('业务码 403 只在 HTTP 2xx / 403 时认作无权限', () => {
    const body = { code: 403 };
    expect(isForbiddenResponse({ response: { status: 200, data: body } })).toBe(
      true,
    );
    expect(isForbiddenResponse({ response: { status: 403, data: 'x' } })).toBe(
      true,
    );
    for (const status of [400, 404, 500, 502, undefined]) {
      expect(isForbiddenResponse({ response: { status, data: body } })).toBe(
        false,
      );
    }
    expect(isForbiddenResponse(createPermissionDeniedError())).toBe(true);
  });

  it('HTTP 403 的错误即使标记丢失也视为已统一提示', () => {
    const wrapped = Object.defineProperty(new Error('Forbidden'), 'response', {
      value: { status: 403, data: 'Forbidden' },
    });
    expect(isPermissionDeniedError(wrapped)).toBe(true);
    expect(isPermissionDeniedError({ response: { status: 500 } })).toBe(false);
    expect(isPermissionDeniedError(new Error('x'))).toBe(false);
    expect(isPermissionDeniedError(null)).toBe(false);
  });
});

describe('usePermission 读取 store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('普通账号按 accessStore.accessCodes 精确匹配', () => {
    useAccessStore().setAccessCodes([getPermissionCode('cron.job.trigger')]);
    useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
    const { can, hasPerm } = usePermission();
    expect(can('cron.job.trigger')).toBe(true);
    expect(hasPerm('/api/cron/job/:id/trigger')).toBe(true);
    expect(can('cron.job.delete')).toBe(false);
  });

  it('普通账号无码时全部按钮判定为无权限', () => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
    const { can } = usePermission();
    expect(ALL_KEYS.filter((key) => can(key))).toEqual([]);
  });

  it.each([
    ['admin 角色', { roles: ['admin'], username: 'zhangsan' }],
    ['super 角色', { roles: ['super'], username: 'lisi' }],
    ['admin 用户名（/user/profile 不返回 roles）', { username: 'admin' }],
  ])('%s + codes 为空时全部按钮放行', (_, userInfo) => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo(userInfo as any);
    const { can } = usePermission();
    expect(ALL_KEYS.every((key) => can(key))).toBe(true);
  });

  it('权限码含后端全局通配 /* 时放行', () => {
    useAccessStore().setAccessCodes(['/*']);
    useUserStore().setUserInfo({ username: 'ops' } as any);
    const { can } = usePermission();
    expect(can('k8s.pod.exec')).toBe(true);
  });

  it('权限码变化后结果随之变化', () => {
    useUserStore().setUserInfo({ username: 'ops' } as any);
    const accessStore = useAccessStore();
    accessStore.setAccessCodes([]);
    const { can } = usePermission();
    expect(can('k8s.pod.delete')).toBe(false);
    accessStore.setAccessCodes([POD_DELETE]);
    expect(can('k8s.pod.delete')).toBe(true);
  });
});
