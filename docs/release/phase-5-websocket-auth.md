# 第五阶段：终端 WebSocket 凭证传输

日期：2026-10-23

## 变更日志

- 本地 SSH、云主机 SSH 和 Pod 终端的 WebSocket URL 移除 JWT 查询参数，避免代理访问日志记录登录凭证
- `websocketUrl` 仅生成地址；`websocketProtocols` 统一提供 `cloudops-v1` 和 `cloudops-auth.<JWT>` 子协议
- Pod 终端使用应用实际 API 地址，编码命名空间、Pod、容器路径，重连读取当前登录令牌
- 移除没有调用者、通过 HTTP GET 将令牌拼入 URL 的旧 `connectTerminal` API
- 服务端通过认证子协议读取 JWT，并仅回显应用协议 `cloudops-v1`；需要配套已发布的后端协议支持

## 验证边界

URL/协议单元测试覆盖同源 HTTPS、独立 API 部署、协议内容和缺少凭证。客户端契约测试实际挂载两个 SSH 终端组件，并通过 Pod 终端真实连接入口调用 WebSocket 构造器，断言三个客户端均使用无查询凭证的 URL 和认证协议

这些客户端测试以测试 WebSocket 构造器替代网络，验证的是握手参数与客户端行为，不代表 SSH 主机或 Kubernetes 执行链路已端到端通过。真实 kind Pod WebSocket 由整体验收单独执行；测试不输出真实 JWT、密码或 kubeconfig

前端源代码已扫描，没有遗留 `?token=` 或向查询参数写入 token 的入口

TypeScript 检查、44 个文件 / 270 个单元测试及 11 项生产构建任务通过；生产 JavaScript 产物扫描未发现旧 token 查询拼接，并包含新的认证协议实现
