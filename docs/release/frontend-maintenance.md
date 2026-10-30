# 前端维护验收

## 服务缓存与请求取消

服务信息页面恢复独立的“清除服务缓存”维护入口，使用精确权限 `aiops.assistant.clearCache`，点击时再校验权限和登录身份。此操作调用后端服务缓存接口，与聊天新建会话分开；只在响应 `cleared === true` 时提示成功，不自动重试写请求。重复点击、用户切换、退出和卸载时的迟到反馈由请求作用域隔离。失败只显示通用提示。

托管资源的地域和详情请求取消不再写页面错误；真实失败仍有可见错误。静态守卫快照新增这两项真实守卫，保留所有扫描与异常白名单约束。

验收：缓存真实控件10项；请求取消/失败4项；全量133文件2033测试通过，应用类型检查通过。服务信息桌面1440px、手机390px的隔离模拟浏览器验证布局和一次清理请求；所有API均拦截为夹具，无真实外部请求。

## Ant Design Table 4 插槽

Cron与18个Kubernetes页面移除158项弃用 `column.slots.customRender` 元数据，将157个具名渲染槽按所属表转换为 `bodyCell` 的 `column.key` 分支。未匹配列仍使用Ant Table的原字段/`customRender`回退；4个此前未引用的具名槽保持未激活。Service动态端口详情表单独迁移，Cluster已有bodyCell仅移除冗余元数据。

新增真实Ant Table渲染测试覆盖Service动态列、默认字段和customRender回退、Cron状态及动作、Secret权限详情。独立AST对照验证19个SFC编译和157分支语义一致。Cron桌面/390px模拟浏览器验证字段、状态、类型、详情动作与容器内横向滚动，无文档横向溢出。未访问真实Kubernetes集群。

## ESLint兼容

Unicorn55调用ESLint核心注释规则时未传入默认选项，在ESLint9.15之后会崩溃。配置显式传入原默认terms `todo/fixme/xxx`，保留error级别；不修改依赖或node_modules。5个真实配置回归验证空文件、普通注释、未来TODO和过期TODO，过期项仍报告原诊断；配置包lint通过。该结果不代表历史全仓lint问题全部解决。
