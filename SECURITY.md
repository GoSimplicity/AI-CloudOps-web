# 前端安全说明

前端只持有用户会话令牌。AIOps API key、云账号 Secret Key 与服务端凭据不能写入 `VITE_GLOB_*`，这些变量会公开到浏览器。所有 API 与终端 WebSocket 默认通过同源 Go 网关授权。

2026-10-22 使用 npm 官方审计接口检查 workspace：安全升级后报告 0 critical、80 high、44 moderate、8 low。这里包含 `internal/vite-config` 等构建工具的 dependencies，不能据此宣称部署镜像包含全部报告链路，也不能宣称审计已清零。

本轮修复了浏览器可达的 Axios、DOMPurify、lodash 与 Vue 补丁版本，移除了没有 npm 修复版本且仅用于导出的 xlsx，删除了未使用的 markdown-it/highlight 依赖。评论HTML先转义再格式化，CSV进行公式注入防护。构建与测试重新验证升级兼容性。

尚存告警需要持续维护：

- Vite 5、Nitro、Rollup、glob与构建解析器等属于开发/构建链；生产镜像只复制静态 dist，不复制 Node 或 node_modules。开发服务仅绑定回环地址，禁止直接对公网提供 Vite。
- ECharts GHSA-fgmj-fm8m-jvvx 针对 `series.type = 'lines'` 的默认HTML tooltip，本项目使用 `line`、`bar`、`pie`，未启用受影响的 `lines` 图。该结论是当前使用路径检查，不是依赖已修复；未来增加地图连线图前应升级到 ECharts 6.1+ 并做图表兼容回归。
- 构建工具链整体大版本升级需要独立兼容验证，不能为了让审计数字归零强制覆盖不兼容依赖。

依据：[ECharts 官方安全公告](https://lists.apache.org/thread/1g6xk7gd9vg1c6zyqqt2lnko10zomc3o)、[DOMPurify 官方文档](https://github.com/cure53/DOMPurify)、[Axios 变更记录](https://github.com/axios/axios/blob/v1.x/CHANGELOG.md)。

复查命令：`pnpm audit --prod --registry=https://registry.npmjs.org`。镜像源不一定提供审计接口。
