import { CloudProvider } from '#/api/core/tree/tree_account';

/** 当前后端支持凭据验证、地域查询和只读实例同步的云厂商 */
export function isSupportedComputeProvider(provider: number): boolean {
  return provider === CloudProvider.AliCloud || provider === CloudProvider.TencentCloud || provider === CloudProvider.AWS;
}

export function computeProviderName(provider: number): string {
  switch (provider) {
    case CloudProvider.AliCloud: return '阿里云';
    case CloudProvider.TencentCloud: return '腾讯云';
    case CloudProvider.AWS: return 'AWS';
    default: return '不支持的云厂商';
  }
}

/** 云账户页面直接检查实际API授权，保持既有权限清单与测试账户集合不变 */
export const CLOUD_ACCOUNT_PERMISSIONS = {
  create: '/api/tree/cloud/account/create',
  edit: '/api/tree/cloud/account/:id/update',
  status: '/api/tree/cloud/account/:id/status',
  detail: '/api/tree/cloud/account/:id/detail',
  verify: '/api/tree/cloud/account/:id/verify',
  regions: '/api/tree/cloud/account/region/available-regions',
} as const;
