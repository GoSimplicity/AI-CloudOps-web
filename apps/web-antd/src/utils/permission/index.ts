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
 * 2. 用户名为 admin 时放行：后端 internal/middleware/auth.go:170（@ed683ef）对 admin 直接放行，
 *    而当前 /user/profile 不返回 roles、admin 的 /user/codes 可能为空（待 SEC-07），
 *    不放行会导致 admin 看不到任何危险按钮；
 * 3. 权限码含 '*' 或 '/*'（后端全局通配，auth.go:78）时放行；
 * 4. 其余按权限码字符串精确匹配（不拼 HTTP 方法），传多个码时满足任一即可。
 *
 * S3 / U3（清单 v4：#78–#83、#86、#88–#99，范围变更待用户确认）：开关 U3_SCOPE_APPROVED 关闭时
 * can() 对这些 key 不做权限码判断、直接放行（保持现状显示，后端仍鉴权）；打开后与其它 key 一样按码判断。
 * S1b（Node 调度 #84 / #85 / #87）不在 U3 表里，始终按码判断。
 *
 * 显式授权（SEC-25/26，Secret 明文 reveal）：后端对 reveal 路由只认逐字相等的授权路径，
 * 不认通配 / 参数段（AI-CloudOps@ed683ef internal/middleware/auth.go:49-54 explicitGrantRoutes、
 * :199-206 精确匹配分支），也没有按角色放行；唯一例外是 :170 用户名 admin 直接放行。
 * 所以 reveal 相关 key / 码不走上面的 1、3 两条：只认精确码，外加用户名 admin。按钮只是 UX，最终以后端为准。
 */
import { useAccess } from '@vben/access';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  ALL_PERMISSION_CODES,
  isU3PermissionKey,
  type PermissionKey,
  SECRET_REVEAL_PERMISSION_CODE,
  U3_SCOPE_APPROVED,
} from '#/constants/permission-codes';

export { SECRET_REVEAL_PERMISSION_CODE } from '#/constants/permission-codes';

/** 视为超级管理员的角色值（Vben 约定 super，及 admin） */
export const SUPER_ADMIN_ROLES: readonly string[] = ['super', 'admin'];
/** 后端中间件直接放行的用户名（AI-CloudOps@ed683ef internal/middleware/auth.go:170） */
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

/** 只接受显式授权的 key（后端 explicitGrantRoutes 里的 reveal 路由） */
export const EXPLICIT_GRANT_PERMISSION_KEYS: readonly PermissionKey[] = [
  'k8s.secret.viewPlain',
  'k8s.secret.copyPlain',
];
/** 只接受显式授权的码 */
export const EXPLICIT_GRANT_PERMISSION_CODES: readonly string[] = [
  SECRET_REVEAL_PERMISSION_CODE,
];

export function isExplicitGrantKey(key: PermissionKey) {
  return EXPLICIT_GRANT_PERMISSION_KEYS.includes(key);
}

function isExplicitGrantCode(code: string) {
  return EXPLICIT_GRANT_PERMISSION_CODES.includes(code);
}

/**
 * 显式授权判断（纯函数）：与后端一致，不看角色、不认通配码。
 * 唯一例外：用户名 admin 放行 —— 对应 AI-CloudOps@ed683ef internal/middleware/auth.go:170
 * `if user.Username == "admin"`（该分支在 explicitGrantRoutes 判断之前，后端对 admin 也放行 reveal）。
 */
export function checkExplicitGrant(
  // roles 故意不参与判断（后端 auth.go 没有角色特判）；接收完整 subject 便于调用方直接传入
  subject: PermissionSubject,
  required: string,
) {
  if (subject.username === SUPER_ADMIN_USERNAME) return true;
  return (subject.codes ?? []).includes(required);
}

/** 纯函数版本，便于在非组件环境与单测中使用 */
export function checkPermission(
  subject: PermissionSubject,
  required: readonly string[] | string,
) {
  const codes = normalizeRequired(required);
  // 显式授权码不吃角色 / 通配放行
  if (codes.some((code) => isExplicitGrantCode(code))) {
    return codes.some((code) => checkExplicitGrant(subject, code));
  }
  if (isSuperAdmin(subject)) return true;
  if (hasWildcardCode(subject.codes)) return true;
  const owned = new Set(subject.codes ?? []);
  return codes.some((code) => owned.has(code));
}

/** 按按钮 key 判断（纯函数，含 U3 开关），与 usePermission().can 同口径 */
export function checkKeyPermission(
  subject: PermissionSubject,
  key: PermissionKey,
  u3Approved: boolean = U3_SCOPE_APPROVED,
) {
  if (!isPermissionEnforced(key, u3Approved)) return true;
  return checkPermission(subject, getPermissionCode(key));
}

/**
 * 组件内使用。读取的是响应式 store，权限码或用户变化后按钮会自动重新渲染。
 * - can(key)：按清单按钮 key 判断（推荐）
 * - hasPerm(code)：直接按权限码判断
 */
export function usePermission() {
  const userStore = useUserStore();
  const accessStore = useAccessStore();
  const { hasAccessByCodes } = useAccess();

  function hasPerm(required: readonly string[] | string) {
    const userInfo = userStore.userInfo;
    const codes = normalizeRequired(required);
    // 显式授权码（reveal）：只认精确码 + 用户名 admin，跳过下面的角色 / 通配放行
    if (codes.some((code) => isExplicitGrantCode(code))) {
      return codes.some((code) =>
        checkExplicitGrant(
          { codes: accessStore.accessCodes, username: userInfo?.username },
          code,
        ),
      );
    }
    if (
      isSuperAdmin({ roles: userInfo?.roles, username: userInfo?.username })
    ) {
      return true;
    }
    if (hasAccessByCodes([...WILDCARD_PERMISSION_CODES])) return true;
    return codes.length > 0 && hasAccessByCodes(codes);
  }

  function can(key: PermissionKey) {
    if (!isPermissionEnforced(key)) return true;
    return hasPerm(getPermissionCode(key));
  }

  return { can, hasPerm };
}

export * from './forbidden';
