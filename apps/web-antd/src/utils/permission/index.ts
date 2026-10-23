/**
 * 按钮级权限判断（FE-02）
 *
 * 所有危险按钮统一走这里：模板中写 v-if="can('k8s.pod.delete')"。
 * 权限码判断复用 @vben/access 的 hasAccessByCodes（读 accessStore.accessCodes，
 * 来源为登录时的 GET /user/codes），这里只在外面包一层放行规则：
 *
 * 1. 先看角色：userInfo.roles 含超级管理员 / admin 角色时直接放行；
 *    （字段：packages/@core/base/typings/src/basic.d.ts:24 BasicUserInfo.roles，
 *    router/guard.ts:111 也读这个字段）
 * 2. 用户名为 admin 时放行：后端 internal/middleware/auth.go:162-165 对 admin 直接放行，
 *    而当前 /user/profile 不返回 roles、admin 的 /user/codes 可能为空（待 SEC-07），
 *    不放行会导致 admin 看不到任何危险按钮；
 * 3. 权限码含 '*' 或 '/*'（后端全局通配，auth.go:78）时放行；
 * 4. 其余按权限码字符串精确匹配（不拼 HTTP 方法），传多个码时满足任一即可。
 *
 * S3 / U3（清单 v4：#78–#83、#86、#88–#99，范围变更待用户确认）：开关 U3_SCOPE_APPROVED 关闭时
 * can() 对这些 key 不做权限码判断、直接放行（保持现状显示，后端仍鉴权）；打开后与其它 key 一样按码判断。
 * S1b（Node 调度 #84 / #85 / #87）不在 U3 表里，始终按码判断。
 */
import { useAccess } from '@vben/access';
import { useUserStore } from '@vben/stores';

import {
  ALL_PERMISSION_CODES,
  isU3PermissionKey,
  type PermissionKey,
  U3_SCOPE_APPROVED,
} from '#/constants/permission-codes';

/** 视为超级管理员的角色值（Vben 约定 super，及 admin） */
export const SUPER_ADMIN_ROLES: readonly string[] = ['super', 'admin'];
/** 后端中间件直接放行的用户名（auth.go:162） */
export const SUPER_ADMIN_USERNAME = 'admin';
export const WILDCARD_PERMISSION_CODES: readonly string[] = ['*', '/*'];

export interface PermissionSubject {
  codes?: null | readonly string[];
  roles?: null | readonly string[];
  username?: null | string;
}

export function isSuperAdmin(
  subject: Pick<PermissionSubject, 'roles' | 'username'> | null | undefined,
) {
  if (!subject) return false;
  const roles = Array.isArray(subject.roles) ? subject.roles : [];
  if (roles.some((role) => SUPER_ADMIN_ROLES.includes(role))) return true;
  return subject.username === SUPER_ADMIN_USERNAME;
}

export function hasWildcardCode(codes?: null | readonly string[]) {
  return (codes ?? []).some((code) => WILDCARD_PERMISSION_CODES.includes(code));
}

function normalizeRequired(required: readonly string[] | string) {
  return (Array.isArray(required) ? required : [required]).filter(Boolean);
}

/** 按钮 key → 权限码 */
export function getPermissionCode(key: PermissionKey): string {
  return ALL_PERMISSION_CODES[key];
}

/**
 * 该 key 当前是否按权限码判断（清单 v4 6.1）：
 * - S1 / S1b（Node 调度三个按钮）/ S2 始终判断；
 * - S3（U3 表）只在 U3 获批后判断。
 */
export function isPermissionEnforced(
  key: PermissionKey,
  u3Approved: boolean = U3_SCOPE_APPROVED,
) {
  return u3Approved || !isU3PermissionKey(key);
}

/** 纯函数版本，便于在非组件环境与单测中使用 */
export function checkPermission(
  subject: PermissionSubject,
  required: readonly string[] | string,
) {
  if (isSuperAdmin(subject)) return true;
  if (hasWildcardCode(subject.codes)) return true;
  const owned = new Set(subject.codes ?? []);
  return normalizeRequired(required).some((code) => owned.has(code));
}

/**
 * 组件内使用。读取的是响应式 store，权限码或用户变化后按钮会自动重新渲染。
 * - can(key)：按清单按钮 key 判断（推荐）
 * - hasPerm(code)：直接按权限码判断
 */
export function usePermission() {
  const userStore = useUserStore();
  const { hasAccessByCodes } = useAccess();

  function hasPerm(required: readonly string[] | string) {
    const userInfo = userStore.userInfo;
    if (
      isSuperAdmin({ roles: userInfo?.roles, username: userInfo?.username })
    ) {
      return true;
    }
    if (hasAccessByCodes([...WILDCARD_PERMISSION_CODES])) return true;
    const codes = normalizeRequired(required);
    return codes.length > 0 && hasAccessByCodes(codes);
  }

  function can(key: PermissionKey) {
    if (!isPermissionEnforced(key)) return true;
    return hasPerm(getPermissionCode(key));
  }

  return { can, hasPerm };
}

export * from './forbidden';
