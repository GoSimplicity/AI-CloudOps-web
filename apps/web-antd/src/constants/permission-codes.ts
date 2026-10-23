/**
 * 按钮级权限码（FE-02）
 *
 * 来源：产品-面包《FE-02 危险按钮 ↔ 权限码对应清单》第 6 节 JSON（/workspace/pm/permission-codes.md，
 * 核对基线 后端 main@188e907 / 前端 main@89c941a）。
 *
 * - key 为清单里的按钮 key，value 为权限码 = 后端路由模板路径（含 /api 或 /api/v1 前缀），
 *   即 GET /user/codes 原样返回的字符串。/user/codes 不带 HTTP 方法，前端只按字符串精确匹配，不拼方法。
 * - 只收录清单中状态为「已对上（matched）」的 FE-02 主范围按钮。
 * - 未收录（本单不处理）：
 *   1. 第 4.2 节 8 个待定按钮：k8s.secret.viewPlain / copyPlain / viewYaml、system.audit.delete /
 *      batchDelete、k8s.namespace.forceDelete、k8s.cluster.kubeconfigCopy / kubeconfigDownload；
 *   2. views/k8s/cluster/** 的 k8s.cluster.delete / batchDelete（FE-02 补，W3）。
 */
export const PERMISSION_CODES = {
  // ===== 系统管理 =====
  'system.user.delete': '/api/user/:id/delete',
  'system.role.delete': '/api/role/delete/:id',
  'system.api.delete': '/api/apis/delete/:id',
  // ===== 任务调度 =====
  'cron.job.delete': '/api/cron/job/:id/delete',
  'cron.job.batchDelete': '/api/cron/job/:id/delete',
  'cron.job.trigger': '/api/cron/job/:id/trigger',
  // ===== K8s =====
  'k8s.pod.delete': '/api/k8s/pod/:cluster_id/:namespace/:name/delete',
  'k8s.pod.batchDelete': '/api/k8s/pod/:cluster_id/:namespace/:name/delete',
  'k8s.deployment.delete':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/delete',
  'k8s.deployment.batchDelete':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/delete',
  'k8s.statefulset.delete':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/delete',
  'k8s.statefulset.batchDelete':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/delete',
  'k8s.daemonset.delete':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/delete',
  'k8s.daemonset.batchDelete':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/delete',
  'k8s.service.delete': '/api/k8s/service/:cluster_id/:namespace/:name/delete',
  'k8s.service.batchDelete':
    '/api/k8s/service/:cluster_id/:namespace/:name/delete',
  'k8s.ingress.delete': '/api/k8s/ingress/:cluster_id/:namespace/:name/delete',
  'k8s.ingress.batchDelete':
    '/api/k8s/ingress/:cluster_id/:namespace/:name/delete',
  'k8s.configmap.delete':
    '/api/k8s/configmap/:cluster_id/:namespace/:name/delete',
  'k8s.configmap.batchDelete':
    '/api/k8s/configmap/:cluster_id/:namespace/:name/delete',
  'k8s.secret.delete': '/api/k8s/secret/:cluster_id/:namespace/:name/delete',
  'k8s.secret.batchDelete':
    '/api/k8s/secret/:cluster_id/:namespace/:name/delete',
  'k8s.pv.delete': '/api/k8s/pv/:cluster_id/:name/delete',
  'k8s.pv.batchDelete': '/api/k8s/pv/:cluster_id/:name/delete',
  'k8s.pvc.delete': '/api/k8s/pvc/:cluster_id/:namespace/:name/delete',
  'k8s.pvc.batchDelete': '/api/k8s/pvc/:cluster_id/:namespace/:name/delete',
  'k8s.role.delete': '/api/k8s/role/:cluster_id/:namespace/:name/delete',
  'k8s.role.batchDelete': '/api/k8s/role/:cluster_id/:namespace/:name/delete',
  'k8s.rolebinding.delete':
    '/api/k8s/rolebinding/:cluster_id/:namespace/:name/delete',
  'k8s.rolebinding.batchDelete':
    '/api/k8s/rolebinding/:cluster_id/:namespace/:name/delete',
  'k8s.clusterrolebinding.delete':
    '/api/k8s/clusterrolebinding/:cluster_id/:name/delete',
  'k8s.clusterrolebinding.batchDelete':
    '/api/k8s/clusterrolebinding/:cluster_id/:name/delete',
  'k8s.template.delete': '/api/k8s/yaml_template/:cluster_id/:id/delete',
  'k8s.template.batchDelete': '/api/k8s/yaml_template/:cluster_id/:id/delete',
  'k8s.task.delete': '/api/k8s/yaml_task/:cluster_id/:id/delete',
  'k8s.task.batchDelete': '/api/k8s/yaml_task/:cluster_id/:id/delete',
  'k8s.namespace.delete':
    '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
  'k8s.namespace.batchDelete':
    '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
  'k8s.node.taintDelete': '/api/k8s/node/:cluster_id/:node_name/taints/delete',
  'k8s.task.apply': '/api/k8s/yaml_task/:cluster_id/:id/apply',
  'k8s.task.batchApply': '/api/k8s/yaml_task/:cluster_id/:id/apply',
  'k8s.pod.exec':
    '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/exec',
  // ===== 监控 =====
  'monitor.alertPool.delete': '/api/monitor/alert_manager_pools/delete/:id',
  'monitor.recordRule.delete': '/api/monitor/record_rules/delete/:id',
  'monitor.alertRule.delete': '/api/monitor/alert_rules/delete/:id',
  'monitor.config.delete': '/api/monitor/configs/delete/:id',
  'monitor.onDutyGroup.delete': '/api/monitor/onduty_groups/delete/:id',
  'monitor.scrapeJob.delete': '/api/monitor/scrape_jobs/delete/:id',
  'monitor.scrapePool.delete': '/api/monitor/scrape_pools/delete/:id',
  'monitor.sendGroup.delete': '/api/monitor/send_groups/delete/:id',
  // ===== 工单 =====
  'workorder.category.delete': '/api/workorder/category/delete/:id',
  'workorder.formDesign.delete': '/api/workorder/form-design/delete/:id',
  'workorder.instance.delete': '/api/workorder/instance/delete/:id',
  'workorder.notification.delete': '/api/workorder/notification/delete/:id',
  'workorder.process.delete': '/api/workorder/process/delete/:id',
  'workorder.template.delete': '/api/workorder/template/delete/:id',
  // ===== 服务树 =====
  'tree.cloudAccount.delete': '/api/tree/cloud/account/:id/delete',
  'tree.cloudResource.delete': '/api/tree/cloud/:id/delete',
  'tree.cloudResource.terminal': '/api/tree/cloud/:id/terminal',
  'tree.local.delete': '/api/tree/local/delete/:id',
  'tree.local.terminal': '/api/tree/local/terminal/:id',
  'tree.node.delete': '/api/tree/node/delete/:id',
  'tree.node.removeMember': '/api/tree/node/member/remove/:id',
  // ===== AIOps =====
  'aiops.autofix.run': '/api/v1/autofix/workflow',
  'aiops.autofix.confirm': '/api/v1/autofix/workflow/confirm',
  'aiops.rca.clearAll': '/api/v1/rca/cache/clear',
  'aiops.rca.clearNamespace': '/api/v1/rca/cache/clear/namespace',
  'aiops.rca.clearOperation': '/api/v1/rca/cache/clear/operation',
  'aiops.assistant.clearCache': '/api/v1/assistant/clear-cache',
  'aiops.assistant.refreshKnowledge': '/api/v1/assistant/refresh',
} as const;

/** 按钮 key，例如 'k8s.pod.delete' */
export type PermissionKey = keyof typeof PERMISSION_CODES;

/** 权限码（后端路由模板路径） */
export type PermissionCode = (typeof PERMISSION_CODES)[PermissionKey];
