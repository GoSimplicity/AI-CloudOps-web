import { createPinia, setActivePinia } from 'pinia';
import { useAccessStore, useUserStore } from '@vben/stores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** U3 开关：默认取常量文件的真实值，个别用例临时打开以验证「获批后」状态 */
const u3 = vi.hoisted(() => ({ override: undefined as boolean | undefined }));
vi.mock('#/constants/permission-codes', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#/constants/permission-codes')>();
  return {
    ...actual,
    get U3_SCOPE_APPROVED() {
      return u3.override ?? actual.U3_SCOPE_APPROVED;
    },
  };
});

import {
  ALL_PERMISSION_CODES,
  FE02_SUPPLEMENT_PERMISSION_CODES,
  getAccountPermissionCodes,
  PERMISSION_CODES,
  type PermissionKey,
  U3_PERMISSION_CODES,
  U3_SCOPE_APPROVED,
} from '#/constants/permission-codes';

import {
  checkPermission,
  getPermissionCode,
  isPermissionEnforced,
  isSuperAdmin,
  usePermission,
} from './index';
import {
  createPermissionDeniedError,
  isForbiddenResponse,
  isPermissionDeniedError,
} from './forbidden';

const ALL_KEYS = Object.keys(PERMISSION_CODES) as PermissionKey[];
const U3_KEYS = Object.keys(U3_PERMISSION_CODES) as PermissionKey[];
const POD_DELETE = '/api/k8s/pod/:cluster_id/:namespace/:name/delete';
const distinct = (group: Record<string, string>) =>
  new Set(Object.values(group));

afterEach(() => {
  u3.override = undefined;
});

describe('权限码常量（permission-codes.md v3 第 6 / 6.1 节）', () => {
  it('按钮 key 映射为后端路由模板路径（字符串，不带方法）', () => {
    expect(getPermissionCode('k8s.pod.delete')).toBe(POD_DELETE);
    expect(getPermissionCode('k8s.pod.exec')).toBe(
      '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/exec',
    );
    expect(getPermissionCode('aiops.autofix.run')).toBe(
      '/api/v1/autofix/workflow',
    );
    for (const key of Object.keys(ALL_PERMISSION_CODES) as PermissionKey[]) {
      expect(ALL_PERMISSION_CODES[key]).toMatch(/^\/api\//);
      expect(ALL_PERMISSION_CODES[key]).not.toMatch(/^(GET|POST|PUT|DELETE)\s/);
    }
  });

  it('S1 / S2 / S3 按钮数与码数和清单一致，三个码集两两不相交', () => {
    // S1：主表 #1–#77（含 6 个主范围待定按钮的临时码）
    expect(Object.keys(PERMISSION_CODES)).toHaveLength(77);
    expect(distinct(PERMISSION_CODES).size).toBe(57);
    // S2：补表 #1–#4（views/k8s/cluster/**）
    expect(Object.keys(FE02_SUPPLEMENT_PERMISSION_CODES)).toHaveLength(4);
    expect(distinct(FE02_SUPPLEMENT_PERMISSION_CODES).size).toBe(2);
    // S3：主表 #78–#99（U3）
    expect(U3_KEYS).toHaveLength(22);
    expect(distinct(U3_PERMISSION_CODES).size).toBe(16);
    // 合计 103 个按钮 / 75 个码
    expect(Object.keys(ALL_PERMISSION_CODES)).toHaveLength(103);
    expect(distinct(ALL_PERMISSION_CODES).size).toBe(75);
    const groups = [
      distinct(PERMISSION_CODES),
      distinct(FE02_SUPPLEMENT_PERMISSION_CODES),
      distinct(U3_PERMISSION_CODES),
    ];
    for (const [i, a] of groups.entries()) {
      for (const b of groups.slice(i + 1)) {
        expect([...a].filter((code) => b.has(code))).toEqual([]);
      }
    }
  });

  it('待定按钮用清单里的临时码（验收标准「W2 先用清单里的临时码」）', () => {
    expect(PERMISSION_CODES).toMatchObject({
      'system.audit.delete': '/api/audit/:id',
      'system.audit.batchDelete': '/api/audit/batch-delete',
      'k8s.namespace.forceDelete':
        '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
      'k8s.secret.viewPlain':
        '/api/k8s/secret/:cluster_id/:namespace/:name/detail',
      'k8s.secret.copyPlain':
        '/api/k8s/secret/:cluster_id/:namespace/:name/detail',
      'k8s.secret.viewYaml':
        '/api/k8s/secret/:cluster_id/:namespace/:name/detail/yaml',
    });
    expect(FE02_SUPPLEMENT_PERMISSION_CODES).toMatchObject({
      'k8s.cluster.kubeconfigCopy': '/api/k8s/cluster/:cluster_id/detail',
      'k8s.cluster.kubeconfigDownload': '/api/k8s/cluster/:cluster_id/detail',
    });
  });

  it('Node 调度三个按钮属于 U3，码为单节点 cordon / uncordon', () => {
    expect(U3_PERMISSION_CODES).toMatchObject({
      'k8s.node.cordon': '/api/k8s/node/:cluster_id/:node_name/cordon',
      'k8s.node.uncordon': '/api/k8s/node/:cluster_id/:node_name/uncordon',
      'k8s.node.batchCordon': '/api/k8s/node/:cluster_id/:node_name/cordon',
    });
    expect(PERMISSION_CODES).not.toHaveProperty('k8s.node.batchCordon');
  });

  it('U3 开关默认关闭；测试账号 A 码集：U3 获批前 59，获批后 75', () => {
    expect(U3_SCOPE_APPROVED).toBe(false);
    expect(getAccountPermissionCodes()).toHaveLength(59);
    expect(getAccountPermissionCodes(false)).toHaveLength(59);
    expect(getAccountPermissionCodes(true)).toHaveLength(75);
    // 获批后 = 本清单全部码
    expect(new Set(getAccountPermissionCodes(true))).toEqual(
      new Set(Object.values(ALL_PERMISSION_CODES)),
    );
  });

  it('U3 开关关闭时 U3 key 不按码判断，打开后与其它 key 一样判断', () => {
    expect(U3_KEYS.some((key) => isPermissionEnforced(key))).toBe(false);
    expect(ALL_KEYS.every((key) => isPermissionEnforced(key))).toBe(true);
    expect(U3_KEYS.every((key) => isPermissionEnforced(key, true))).toBe(true);
    u3.override = true;
    expect(U3_KEYS.every((key) => isPermissionEnforced(key))).toBe(true);
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

  it('U3 未获批：普通账号无码时 U3 按钮保持现状可见，主范围按钮仍隐藏', () => {
    useAccessStore().setAccessCodes([]);
    useUserStore().setUserInfo({ roles: ['ops'], username: 'ops' } as any);
    const { can } = usePermission();
    expect(U3_KEYS.every((key) => can(key))).toBe(true);
    expect(can('k8s.node.taintDelete')).toBe(false);
  });

  it('U3 获批：无码隐藏、有码显示、admin 放行', () => {
    u3.override = true;
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    userStore.setUserInfo({ roles: ['ops'], username: 'ops' } as any);
    accessStore.setAccessCodes([]);
    const { can } = usePermission();
    expect(U3_KEYS.filter((key) => can(key))).toEqual([]);
    accessStore.setAccessCodes([getPermissionCode('k8s.node.uncordon')]);
    expect(can('k8s.node.uncordon')).toBe(true);
    expect(can('k8s.node.cordon')).toBe(false);
    accessStore.setAccessCodes([]);
    userStore.setUserInfo({ username: 'admin' } as any);
    expect(U3_KEYS.every((key) => can(key))).toBe(true);
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
