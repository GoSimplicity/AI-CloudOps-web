/**
 * 按钮级权限码（FE-02）
 *
 * 来源：产品-面包《FE-02 危险按钮 ↔ 权限码对应清单》v4（/workspace/pm/permission-codes.md 第 6 节 JSON，
 * 核对基线 后端 main@188e907 / 前端 main@89c941a），逐条与 v4 JSON 一致（permission.test.ts 校验）。
 *
 * - key 为清单里的按钮 key，value 为权限码 = 后端路由模板路径（含 /api 或 /api/v1 前缀），
 *   即 GET /user/codes 原样返回的字符串。/user/codes 不带 HTTP 方法，前端只按字符串精确匹配，不拼方法。
 * - 按清单 6.1 分四个码集（两两不相交，并集 = 全部 75 个码）：
 *   - S1 = PERMISSION_CODES：主表 #1–#77（57 个码 / 77 个按钮）。含 4.2 节 6 个主范围待定按钮的临时码
 *     （Secret 明文 3 个、审计删除 2 个、Namespace 强制删除），依据验收标准「W2 先用清单里的临时码」；
 *   - S1b = S1B_PERMISSION_CODES：主表 #84 cordon、#85 uncordon、#87 batchCordon（和 #84 同码），
 *     2 个码 / 3 个按钮，v4 起始终生效（研发指挥官 2026-10-24 决定），不受 U3 开关影响；
 *   - S2 = FE02_SUPPLEMENT_PERMISSION_CODES：补表 #1–#4（views/k8s/cluster/**，2 个码 / 4 个按钮，W3 接入，本分支不接）；
 *   - S3 = U3_PERMISSION_CODES：主表 #78–#83、#86、#88–#99（14 个码 / 19 个按钮），v2 产品推荐纳入，
 *     属范围变更 U3，用户确认前不生效。
 * - 始终生效 = S1 ∪ S1b ∪ S2。U3_SCOPE_APPROVED 是 S3 的唯一开关（默认 false）：
 *   - false：S3 按钮不做权限码判断（保持现状显示，按钮背后的接口仍由后端鉴权）；
 *     测试账号 A 码集 = S1 ∪ S1b ∪ S2 = 61 个码 / 84 个按钮；
 *   - true：S3 按钮也按码判断，A 码集 = S1 ∪ S1b ∪ S2 ∪ S3 = 75 个码 / 103 个按钮。
 * - 测试账号 C（验收标准 v3）= A 去掉 cordon、uncordon 两个码 = 59 个；B = 空码集。
 */

/** U3（S3：清单 #78–#83、#86、#88–#99 产品推荐纳入）是否已获用户批准。获批后改为 true 即可生效。 */
export const U3_SCOPE_APPROVED: boolean = false;

/** S1：FE-02 主范围 #1–#77 */
export const PERMISSION_CODES = {
  // 系统管理/用户
  // #1
  'system.user.delete': '/api/user/:id/delete',
  // 系统管理/角色
  // #2
  'system.role.delete': '/api/role/delete/:id',
  // 系统管理/API
  // #3
  'system.api.delete': '/api/apis/delete/:id',
  // 系统管理/审计日志
  // #4（待确认（SEC-13/D4 计划下线接口），临时码）
  'system.audit.delete': '/api/audit/:id',
  // #5（待确认（SEC-13/D4 计划下线接口），临时码）
  'system.audit.batchDelete': '/api/audit/batch-delete',
  // 任务调度/任务管理
  // #6
  'cron.job.delete': '/api/cron/job/:id/delete',
  // #7
  'cron.job.batchDelete': '/api/cron/job/:id/delete',
  // #8
  'cron.job.trigger': '/api/cron/job/:id/trigger',
  // K8s/Pod
  // #9
  'k8s.pod.delete': '/api/k8s/pod/:cluster_id/:namespace/:name/delete',
  // #10
  'k8s.pod.batchDelete': '/api/k8s/pod/:cluster_id/:namespace/:name/delete',
  // K8s/Deployment
  // #11
  'k8s.deployment.delete':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/delete',
  // #12
  'k8s.deployment.batchDelete':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/delete',
  // K8s/StatefulSet
  // #13
  'k8s.statefulset.delete':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/delete',
  // #14
  'k8s.statefulset.batchDelete':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/delete',
  // K8s/DaemonSet
  // #15
  'k8s.daemonset.delete':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/delete',
  // #16
  'k8s.daemonset.batchDelete':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/delete',
  // K8s/Service
  // #17
  'k8s.service.delete': '/api/k8s/service/:cluster_id/:namespace/:name/delete',
  // #18
  'k8s.service.batchDelete':
    '/api/k8s/service/:cluster_id/:namespace/:name/delete',
  // K8s/Ingress
  // #19
  'k8s.ingress.delete': '/api/k8s/ingress/:cluster_id/:namespace/:name/delete',
  // #20
  'k8s.ingress.batchDelete':
    '/api/k8s/ingress/:cluster_id/:namespace/:name/delete',
  // K8s/ConfigMap
  // #21
  'k8s.configmap.delete':
    '/api/k8s/configmap/:cluster_id/:namespace/:name/delete',
  // #22
  'k8s.configmap.batchDelete':
    '/api/k8s/configmap/:cluster_id/:namespace/:name/delete',
  // K8s/Secret
  // #23
  'k8s.secret.delete': '/api/k8s/secret/:cluster_id/:namespace/:name/delete',
  // #24
  'k8s.secret.batchDelete':
    '/api/k8s/secret/:cluster_id/:namespace/:name/delete',
  // K8s/PV
  // #25
  'k8s.pv.delete': '/api/k8s/pv/:cluster_id/:name/delete',
  // #26
  'k8s.pv.batchDelete': '/api/k8s/pv/:cluster_id/:name/delete',
  // K8s/PVC
  // #27
  'k8s.pvc.delete': '/api/k8s/pvc/:cluster_id/:namespace/:name/delete',
  // #28
  'k8s.pvc.batchDelete': '/api/k8s/pvc/:cluster_id/:namespace/:name/delete',
  // K8s/Role
  // #29
  'k8s.role.delete': '/api/k8s/role/:cluster_id/:namespace/:name/delete',
  // #30
  'k8s.role.batchDelete': '/api/k8s/role/:cluster_id/:namespace/:name/delete',
  // K8s/RoleBinding
  // #31
  'k8s.rolebinding.delete':
    '/api/k8s/rolebinding/:cluster_id/:namespace/:name/delete',
  // #32
  'k8s.rolebinding.batchDelete':
    '/api/k8s/rolebinding/:cluster_id/:namespace/:name/delete',
  // K8s/ClusterRoleBinding
  // #33
  'k8s.clusterrolebinding.delete':
    '/api/k8s/clusterrolebinding/:cluster_id/:name/delete',
  // #34
  'k8s.clusterrolebinding.batchDelete':
    '/api/k8s/clusterrolebinding/:cluster_id/:name/delete',
  // K8s/YAML 模板
  // #35
  'k8s.template.delete': '/api/k8s/yaml_template/:cluster_id/:id/delete',
  // #36
  'k8s.template.batchDelete': '/api/k8s/yaml_template/:cluster_id/:id/delete',
  // K8s/YAML 任务
  // #37
  'k8s.task.delete': '/api/k8s/yaml_task/:cluster_id/:id/delete',
  // #38
  'k8s.task.batchDelete': '/api/k8s/yaml_task/:cluster_id/:id/delete',
  // K8s/Namespace
  // #39
  'k8s.namespace.delete':
    '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
  // #40（待后端确认（与普通删除同接口），临时码）
  'k8s.namespace.forceDelete':
    '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
  // #41
  'k8s.namespace.batchDelete':
    '/api/k8s/clusters/:cluster_id/namespace/:name/delete',
  // K8s/Node
  // #42
  'k8s.node.taintDelete': '/api/k8s/node/:cluster_id/:node_name/taints/delete',
  // K8s/YAML 任务
  // #43
  'k8s.task.apply': '/api/k8s/yaml_task/:cluster_id/:id/apply',
  // #44
  'k8s.task.batchApply': '/api/k8s/yaml_task/:cluster_id/:id/apply',
  // K8s/Pod
  // #45
  'k8s.pod.exec':
    '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/exec',
  // K8s/Secret
  // #46 SEC-25/26：明文改走 reveal 接口，码为 reveal 路由模板（AI-CloudOps@ed683ef
  // internal/model/k8s_secret.go:107 K8sSecretRevealRoute）。显式授权码，只认精确匹配，见 utils/permission
  'k8s.secret.viewPlain': '/api/k8s/secret/:cluster_id/:namespace/:name/reveal',
  // #47 同 #46（复制明文同样先调 reveal）
  'k8s.secret.copyPlain': '/api/k8s/secret/:cluster_id/:namespace/:name/reveal',
  // #48（待后端补齐（SEC-19 独立明文权限），临时码）
  'k8s.secret.viewYaml':
    '/api/k8s/secret/:cluster_id/:namespace/:name/detail/yaml',
  // 监控/AlertManager 实例池
  // #49
  'monitor.alertPool.delete': '/api/monitor/alert_manager_pools/delete/:id',
  // 监控/预聚合规则
  // #50
  'monitor.recordRule.delete': '/api/monitor/record_rules/delete/:id',
  // 监控/告警规则
  // #51
  'monitor.alertRule.delete': '/api/monitor/alert_rules/delete/:id',
  // 监控/监控配置
  // #52
  'monitor.config.delete': '/api/monitor/configs/delete/:id',
  // 监控/值班组
  // #53
  'monitor.onDutyGroup.delete': '/api/monitor/onduty_groups/delete/:id',
  // 监控/采集任务
  // #54
  'monitor.scrapeJob.delete': '/api/monitor/scrape_jobs/delete/:id',
  // 监控/采集池
  // #55
  'monitor.scrapePool.delete': '/api/monitor/scrape_pools/delete/:id',
  // 监控/发送组
  // #56
  'monitor.sendGroup.delete': '/api/monitor/send_groups/delete/:id',
  // 工单/分类
  // #57
  'workorder.category.delete': '/api/workorder/category/delete/:id',
  // 工单/表单设计
  // #58
  'workorder.formDesign.delete': '/api/workorder/form-design/delete/:id',
  // 工单/工单实例
  // #59
  'workorder.instance.delete': '/api/workorder/instance/delete/:id',
  // 工单/通知配置
  // #60
  'workorder.notification.delete': '/api/workorder/notification/delete/:id',
  // 工单/流程
  // #61
  'workorder.process.delete': '/api/workorder/process/delete/:id',
  // 工单/模板
  // #62
  'workorder.template.delete': '/api/workorder/template/delete/:id',
  // 服务树/云账号
  // #63
  'tree.cloudAccount.delete': '/api/tree/cloud/account/:id/delete',
  // 服务树/云资源
  // #64
  'tree.cloudResource.delete': '/api/tree/cloud/:id/delete',
  // #65
  'tree.cloudResource.terminal': '/api/tree/cloud/:id/terminal',
  // 服务树/本地资源
  // #66
  'tree.local.delete': '/api/tree/local/delete/:id',
  // #67
  'tree.local.terminal': '/api/tree/local/terminal/:id',
  // 服务树/节点
  // #68
  'tree.node.delete': '/api/tree/node/delete/:id',
  // #69
  'tree.node.removeMember': '/api/tree/node/member/remove/:id',
  // AIOps/自动修复
  // #70
  'aiops.autofix.run': '/api/v1/autofix/workflow',
  // #71
  'aiops.autofix.confirm': '/api/v1/autofix/workflow/confirm',
  // AIOps/RCA 缓存
  // #72
  'aiops.rca.clearAll': '/api/v1/rca/cache/clear',
  // #73
  'aiops.rca.clearNamespace': '/api/v1/rca/cache/clear/namespace',
  // #74
  'aiops.rca.clearOperation': '/api/v1/rca/cache/clear/operation',
  // AIOps/AI 助手浮窗
  // #75
  'aiops.assistant.clearCache': '/api/v1/assistant/clear-cache',
  // AIOps/知识库
  // #76
  'aiops.assistant.refreshKnowledge': '/api/v1/assistant/refresh',
  // K8s/Node
  // #77
  'k8s.node.taintAdd': '/api/k8s/node/:cluster_id/:node_name/taints/add',
} as const;

/** S2：FE-02 补（views/k8s/cluster/**，W3） */
export const FE02_SUPPLEMENT_PERMISSION_CODES = {
  // K8s/集群（FE-02 补）
  // #1
  'k8s.cluster.delete': '/api/k8s/cluster/:cluster_id/delete',
  // #2
  'k8s.cluster.batchDelete': '/api/k8s/cluster/:cluster_id/delete',
  // #3（待确认（FE-03 移除），临时码）
  'k8s.cluster.kubeconfigCopy': '/api/k8s/cluster/:cluster_id/detail',
  // #4（待确认（FE-03 移除），临时码）
  'k8s.cluster.kubeconfigDownload': '/api/k8s/cluster/:cluster_id/detail',
} as const;

/** S1b：Node 调度 #84 / #85 / #87，始终按码判断（清单 v4） */
export const S1B_PERMISSION_CODES = {
  // K8s/Node
  // #84
  'k8s.node.cordon': '/api/k8s/node/:cluster_id/:node_name/cordon',
  // #85
  'k8s.node.uncordon': '/api/k8s/node/:cluster_id/:node_name/uncordon',
  // #87（和 #84 同码）
  'k8s.node.batchCordon': '/api/k8s/node/:cluster_id/:node_name/cordon',
} as const;

/** S3：U3 产品推荐纳入 #78–#83、#86、#88–#99，U3_SCOPE_APPROVED 为 true 时才按码判断 */
export const U3_PERMISSION_CODES = {
  // K8s/Deployment
  // #78
  'k8s.deployment.restart':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/restart',
  // #79
  'k8s.deployment.batchRestart':
    '/api/k8s/deployment/:cluster_id/:namespace/:name/restart',
  // K8s/StatefulSet
  // #80
  'k8s.statefulset.restart':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/restart',
  // #81
  'k8s.statefulset.batchRestart':
    '/api/k8s/statefulset/:cluster_id/:namespace/:name/restart',
  // K8s/DaemonSet
  // #82
  'k8s.daemonset.restart':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/restart',
  // #83
  'k8s.daemonset.batchRestart':
    '/api/k8s/daemonset/:cluster_id/:namespace/:name/restart',
  // K8s/Node
  // #86
  'k8s.node.drain': '/api/k8s/node/:cluster_id/:node_name/drain',
  // 任务调度/任务管理
  // #88
  'cron.job.enable': '/api/cron/job/:id/enable',
  // #89
  'cron.job.disable': '/api/cron/job/:id/disable',
  // #90
  'cron.job.batchEnable': '/api/cron/job/:id/enable',
  // #91
  'cron.job.batchDisable': '/api/cron/job/:id/disable',
  // K8s/Pod
  // #92
  'k8s.pod.portForward':
    '/api/k8s/pod/:cluster_id/:namespace/:name/port-forward',
  // #93
  'k8s.pod.fileUpload':
    '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/files/upload',
  // #94
  'k8s.pod.fileDownload':
    '/api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/files/download',
  // AIOps/知识库
  // #95
  'aiops.assistant.uploadKnowledge': '/api/v1/assistant/upload-knowledge-file',
  // 系统管理/角色
  // #96
  'system.role.revokeApi': '/api/role/revoke-apis',
  // 系统管理/用户
  // #97
  'system.user.revokeRole': '/api/role/revoke_users',
  // 工单/通知配置
  // #98
  'workorder.notification.testSend': '/api/workorder/notification/test/send',
  // #99
  'workorder.notification.manualSend': '/api/workorder/notification/send',
} as const;

/** 全部按钮 key → 权限码（S1 ∪ S1b ∪ S2 ∪ S3） */
/** Secret 明文 reveal 路由码（SEC-25/26，显式授权码，只认精确匹配） */
export const SECRET_REVEAL_PERMISSION_CODE =
  PERMISSION_CODES['k8s.secret.viewPlain'];

export const ALL_PERMISSION_CODES = {
  ...PERMISSION_CODES,
  ...S1B_PERMISSION_CODES,
  ...FE02_SUPPLEMENT_PERMISSION_CODES,
  ...U3_PERMISSION_CODES,
} as const;

/** 按钮 key，例如 'k8s.pod.delete' */
export type PermissionKey = keyof typeof ALL_PERMISSION_CODES;

/** 权限码（后端路由模板路径） */
export type PermissionCode = (typeof ALL_PERMISSION_CODES)[PermissionKey];

export type U3PermissionKey = keyof typeof U3_PERMISSION_CODES;

export function isU3PermissionKey(key: string): key is U3PermissionKey {
  return Object.prototype.hasOwnProperty.call(U3_PERMISSION_CODES, key);
}

/**
 * 测试账号 A 的 /user/codes 码集（清单 v4 6.1）：
 * U3 获批前 S1 ∪ S1b ∪ S2 = 61，获批后 S1 ∪ S1b ∪ S2 ∪ S3 = 75。
 */
export function getAccountPermissionCodes(
  u3Approved: boolean = U3_SCOPE_APPROVED,
): string[] {
  const groups: Record<string, string>[] = [
    PERMISSION_CODES,
    S1B_PERMISSION_CODES,
    FE02_SUPPLEMENT_PERMISSION_CODES,
  ];
  if (u3Approved) groups.push(U3_PERMISSION_CODES);
  return [...new Set(groups.flatMap((group) => Object.values(group)))];
}

/**
 * 测试账号 C 的码集（验收标准 v3 FE-02）：A 去掉 S1b 的 cordon、uncordon 两个码，
 * U3 获批前 59 个。用来区分“只缺 cordon 码”和“什么码都没有”（B）。
 */
export function getAccountCPermissionCodes(
  u3Approved: boolean = U3_SCOPE_APPROVED,
): string[] {
  const s1b = new Set<string>(Object.values(S1B_PERMISSION_CODES));
  return getAccountPermissionCodes(u3Approved).filter((code) => !s1b.has(code));
}
