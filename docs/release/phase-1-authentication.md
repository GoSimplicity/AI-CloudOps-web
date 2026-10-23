# 第一阶段：前端认证可靠性与可复现基线

日期：2026-10-23

## 变更日志

- 修复并发 API 请求收到 401 后刷新失败仍以空令牌重放的问题，等待中的请求使用同一刷新错误结束，不再追加无效请求
- 修复排队请求缺少重试标识的问题，每个请求最多在刷新成功后重放一次，避免重复刷新
- 按 Go 后端实际的 `{ code, data, message }` 结构声明刷新响应类型，拒绝业务失败和空令牌，移除令牌提取中的 `any`
- 新增认证刷新集成单测与 API 契约单测，验证并发成功、并发失败、重试上限、业务失败和无效令牌
- 更正中文 README 的仓库地址、目录、运行时、开发端口、环境变量、构建产物和部署路径

## 验证命令

```bash
pnpm install --frozen-lockfile
pnpm -F @vben/web-antd typecheck
pnpm test:unit --run
pnpm build:antd
CLOUDOPS_PREVIEW=true CLOUDOPS_ROUTER_HISTORY=hash pnpm test:e2e --grep "login is usable"
```

本阶段实测结果（Node.js 24.21.0、pnpm 9.9.0、macOS）：

- 锁文件安装通过，未修改依赖锁文件
- 应用 TypeScript 检查通过
- 单元测试 38 个文件、253 个用例通过，其中新增 8 个认证回归用例
- 生产构建 11 个任务全部成功
- Chrome 对生产包的登录页验证通过，覆盖 390px 窄屏、主题切换与刷新持久化、横向溢出及运行时错误检查
- `git diff --check` 通过

构建仍提示已有的 CJS Vite API 弃用、Browserslist 数据过期和超过 1000 kB 的分包，需要在后续依赖与性能阶段处理

业务路由与真实服务的端到端验证仍依赖隔离后端、测试管理员和外部数据源；生产包登录页验证不代表这些业务链路通过

页面统一仍按 [frontend-refactor.md](frontend-refactor.md) 和 [layout-inventory.json](layout-inventory.json) 推进，现有清单为 59 个路由、3 个共享骨架迁移，不据此宣称 1.0 已完成
