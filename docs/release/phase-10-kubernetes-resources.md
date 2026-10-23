# 第十阶段：Kubernetes 资源、YAML 页面与集中验收

日期：2026-10-23

## 变更日志

- 按真实注册路由统一节点、StatefulSet、DaemonSet、Ingress、Secret、PVC、Role、RoleBinding、PV、ClusterRoleBinding，以及 YAML 模板和任务十二页骨架；保留现有资源操作、表单、YAML、批量选择和分页
- 资源与目录查询添加请求序号及集群/命名空间快照，失败清除旧行、总数与选择，提供可操作重试；清空集群后迟到结果不能恢复旧数据
- 命名空间级资源以 cluster/namespace/name 标识，集群级资源以 cluster/name 标识，避免跨作用域选择冲突
- 保留 Role、RoleBinding、ClusterRoleBinding 已发布的本页标签过滤行为，并明确控件与分页的本页口径，不把本页匹配数当作全局总数
- YAML 任务使用服务端真实 name 参数过滤，修复原先发送 search 导致的无效搜索；模板名最大 50、任务创建最大 50/修改最大 255，与当前 Go 验证契约对齐
- 长集群名称省略并保留完整标题；装饰图标退出按钮读屏名称；移除例行切换/筛选成功提示，灰阶文本与表面改用共享主题变量

## 验证口径

新增五十个资源/目录查询回归，覆盖十二类资源的旧成功/旧失败、失败清空与恢复、清空作用域，以及任务模板目录乱序和真实 name 参数；另补集群级资源身份冲突回归

冻结的完整工作树（同时包含并行完成的 CMDB 与 AI 支持页面）通过应用 TypeScript、60 个文件 / 451 个单元测试和 11 项生产构建任务。十二页设计检测无输出，桌面节点与 390px RoleBinding 截图已目视检查

真实 Chrome 对隔离 kind 的前十页逐一验证 API 200、作用域选择、真实节点及其它资源的真实空态、创建表单取消、明暗主题与 390px 关键控件命中、无整页横向溢出，并断言零 Kubernetes 写入请求。截图位于 .cache/ui-verification/k8s-node-desktop.png 和 k8s-rolebinding-mobile.png

YAML 模板/任务首轮真实验收发现冷启动缺少 cl_k8s_yaml_template / cl_k8s_yaml_task，后端 35c9d65 补迁移后已重新完成真实 Chrome 闭环（6.8 秒）：通过页面创建唯一模板与任务、勾选 DryRun 并执行成功，查询实际 ConfigMap 确认资源未落地，最终精确清理测试模板与任务。没有修改保留 kind 资源。专项位于 tests/e2e/console.spec.ts

## 并行页面集中浏览器验收

Prometheus 九个列表真实 API、搜索/重置、创建取消零写入、390px 两列统计及主题控件命中通过；第十页值班日历通过唯一临时值班组的真实详情、未来计划、历史搜索、前后月切换和窄屏验收，该测试组已精确删除。定时任务页通过真实内置任务只读列表、创建默认重投次数 3、取消零写入与桌面/移动验收，没有触发任何内置任务
