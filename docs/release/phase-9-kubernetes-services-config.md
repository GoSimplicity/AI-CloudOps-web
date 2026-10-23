# 第九阶段：Service、ConfigMap 与资源身份

日期：2026-10-23

## 变更日志

- 依据实际路由迁移 Service、ConfigMap 至 OpsPage，统一标题、主操作、筛选、错误、空态和表格，保留详情、创建、编辑、YAML、端点及删除入口
- 查询失败清除旧行、分页和选择并提供重试；资源及命名空间请求隔离集群/命名空间和请求序号，迟到结果不能恢复旧资源
- ConfigMap 查询补传已有 namespace/search，接通后端 data_key；Service 接通既有状态枚举 status。配套 Go cb4ac0b 在分页前过滤，避免只在当前页造出错误总数
- Service、ConfigMap、Deployment、Pod 使用 cluster/namespace/name 复合行键，跨命名空间同名资源不会共享批量选择状态
- 已迁移 Kubernetes 行操作统一语义颜色、边框和悬停状态，窄屏保留紧凑可点击按钮及横向表格滚动
- 统一清单同步并行完成的监控采集池、采集任务、发送组及告警实例池、记录规则、事件六页，此清单仅记录骨架覆盖，不代替监控业务验收

## 验证口径

新增九个 Kubernetes 回归：两类列表的作用域、清空、失败重试六例，实际过滤请求契约两例，以及跨集群/命名空间同名资源键冲突一例。含监控首批三个页面的已提交测试，冻结源码后全仓 TypeScript、53 个文件 / 329 个单元测试、11 项生产构建任务通过

真实 Chrome 在隔离 kind 中验证 Service web、ConfigMap web-content 查询、详情、创建表单取消、名称空结果/恢复；Service 停止/运行状态、ConfigMap 不存在的数据键/大写 INDEX 包含匹配真实改变后端结果；390px 明暗主题、详情按钮命中及无整页横向溢出通过。另回归复合行键后的 Deployment/Pod 列表及真实 Pod printf 终端，三例最终分别通过，未修改保留资源

桌面与窄屏目视检查截图：.cache/ui-verification/k8s-service-desktop.png、k8s-configmap-mobile.png。当前已提交共享骨架覆盖 21 / 58 个真实路由；其它资源页面继续按批迁移

清单工具新增 --staged，用于在精确暂存后读取本次 Git 快照，排除其它并行模块未提交视图；默认 CI 的 AST 检查口径保持一致。监控第二批附带的 25 项专项测试和 TypeScript 由对应模块执行并通过，冻结全仓构建记录对应首批源码状态
