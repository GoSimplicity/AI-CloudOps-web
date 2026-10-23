import { describe, expect, it } from 'vitest';

import {
  SECRET_DETAIL_PERMISSION_CODE,
  SECRET_UPDATE_PERMISSION_CODE,
} from './permission-codes';

/**
 * SEC-26 incr7 P3-D（m04）：Secret 路由码钉成字面值。
 * 后端 AI-CloudOps internal/k8s/api/secret.go RegisterRouters（k8sGroup = /api/k8s）：
 * - :54 `k8sGroup.GET("/secret/:cluster_id/:namespace/:name/detail", h.GetSecret)`
 * - :59 `k8sGroup.PUT("/secret/:cluster_id/:namespace/:name/update", h.UpdateSecret)`
 * 权限中间件按「完整路由模板」精确匹配，码写错一个字符，入口判断与后端鉴权就对不上。
 */
describe('Secret 路由码与后端路由模板一致（incr7 m04）', () => {
  it('更新：PUT /api/k8s/secret/:cluster_id/:namespace/:name/update（secret.go:59）', () => {
    expect(SECRET_UPDATE_PERMISSION_CODE).toBe(
      '/api/k8s/secret/:cluster_id/:namespace/:name/update',
    );
  });

  it('详情：GET /api/k8s/secret/:cluster_id/:namespace/:name/detail（secret.go:54）', () => {
    expect(SECRET_DETAIL_PERMISSION_CODE).toBe(
      '/api/k8s/secret/:cluster_id/:namespace/:name/detail',
    );
  });
});
