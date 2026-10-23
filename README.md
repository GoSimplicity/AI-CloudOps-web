# AI+CloudOps 前端

[English](README.en.md) | **简体中文**

**AI+CloudOps-web** 是 **AI+CloudOps** 平台的用户界面部分，旨在通过用户友好的界面提升运维效率和智能化水平。本项目专注于前端开发，与独立的后端服务无缝集成。

## 目录

- [AI+CloudOps 前端](#aicloudops-前端)
  - [目录](#目录)
  - [项目介绍](#项目介绍)
  - [快速开始](#快速开始)
    - [克隆项目](#克隆项目)
    - [安装依赖](#安装依赖)
    - [启用提交前密钥扫描](#启用提交前密钥扫描)
    - [配置环境变量](#配置环境变量)
    - [运行前端项目](#运行前端项目)
  - [项目结构](#项目结构)
  - [构建与部署](#构建与部署)
    - [构建生产版本](#构建生产版本)
    - [部署](#部署)
  - [许可证](#许可证)
  - [联系方式](#联系方式)
  - [致谢](#致谢)
  - [贡献指南](#贡献指南)

## 项目介绍

**AI+CloudOps-web** 是 **AI+CloudOps** 平台的用户界面部分，提供以下核心功能：

1. **用户与权限管理**：通过直观的界面管理用户、角色及权限，确保系统的安全和可控性。
2. **服务树与 CMDB**：可视化展示服务树结构和配置管理数据库（CMDB），实现运维资源的全面管理。
3. **工单系统**：支持工单的创建、分配、处理和追踪，提高问题解决效率。
4. **实时监控与告警**：集成 Prometheus，实时监控系统性能，结合 AI 技术进行异常预警和自动化响应。
5. **Kubernetes 管理**：提供 Kubernetes 集群的管理与监控界面，简化云端资源操作，并集成 AI 进行自动化优化和资源调度。

## 快速开始

### 克隆项目

```bash
git clone https://github.com/GoSimplicity/AI-CloudOps-web.git
cd AI-CloudOps-web
```

### 安装依赖

CI 和 Docker 使用 Node.js 22，最低要求 Node.js 20；使用锁定的 pnpm 9.9.0

```bash
corepack enable
corepack prepare pnpm@9.9.0 --activate
pnpm install --frozen-lockfile
```

安装过程会生成内部工作区包的构建入口；移动目录后重新执行安装

### 启用提交前密钥扫描

`pnpm install` 会通过 husky 把 `core.hooksPath` 设为 `.husky/_`，提交时依次执行 `.husky/pre-commit` → `.githooks/pre-commit` → gitleaks。安装依赖后运行以下脚本确认钩子真正生效

```bash
bash scripts/setup-git-hooks.sh
```

脚本在以下情况返回非 0：找不到 husky、`core.hooksPath` 不是 `.husky/_`、`.husky/pre-commit` 缺失、不可执行或内容与脚本内嵌的预期内容不逐字节一致（修改该文件时须同步修改 `scripts/setup-git-hooks.sh`）、未安装 gitleaks（从 [官方发布页](https://github.com/gitleaks/gitleaks/releases) 下载并校验 sha256）或版本低于 8.25.0 / 版本无法解析（pre-commit 钩子同样会拒绝提交）

注意事项

- 设置了 `HUSKY=0` 时 husky 不安装钩子，提交时若仍有 `HUSKY=0` 也会跳过全部钩子（包括 gitleaks），脚本会打印警告并失败；检查 shell 配置、IDE 环境和 `~/.config/husky/init.sh`
- `git commit --no-verify` 同样会跳过本地钩子
- 本地钩子只是第一道防线，**CI 的 gitleaks 工作流（`.github/workflows/gitleaks.yml`）是最终兜底**，任何 PR 和推送都会重新扫描；被 CI 拦下的密钥视为已泄露，必须轮换

### 配置环境变量

应用配置位于 `apps/web-antd/.env*`，开发环境默认通过 Vite 代理连接 `http://localhost:8889` 的 Go 后端

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `VITE_PORT` | `5666` | 开发服务器端口 |
| `VITE_GLOB_API_URL` | `/api` | Go 后端接口地址 |
| `VITE_GLOB_AIOPS_URL` | `/api/v1` | 经 Go 网关转发的 AIOps 接口地址 |
| `VITE_ROUTER_HISTORY` | `hash`（生产环境） | 路由模式 |

`VITE_*` 配置会发送至浏览器，不能存放服务端密钥，参见 [SECURITY.md](SECURITY.md)

### 运行前端项目

```bash
pnpm dev
# 连接其他后端地址
VITE_PROXY_TARGET=http://127.0.0.1:17889 pnpm dev
```

默认访问 [http://localhost:5666](http://localhost:5666)，开发服务器只绑定本机，代理同时支持 HTTP 与 WebSocket

## 项目结构

```text
AI-CloudOps-web/
├── apps/web-antd/        # 业务应用、路由、API、环境配置
├── packages/            # Vben 共享组件、请求、状态、工具
├── internal/            # Vite、TypeScript、样式和 lint 配置
├── scripts/             # 工作区工具
├── tests/e2e/           # Playwright 验收
├── docs/release/        # 页面迁移清单与验收标准
└── pnpm-lock.yaml       # 锁定依赖
```

## 构建与部署

### 构建生产版本

```bash
pnpm -F @vben/web-antd typecheck
pnpm test:unit --run
pnpm build:antd
```

产物位于 `apps/web-antd/dist/`，CI 使用这些命令及生产包登录页浏览器验收

```bash
CLOUDOPS_PREVIEW=true CLOUDOPS_ROUTER_HISTORY=hash pnpm test:e2e --grep "login is usable"
```

默认使用本机 Chrome，使用 Playwright Chromium 时设置 `PLAYWRIGHT_CHANNEL=chromium`

完整业务路由测试需要运行隔离后端并提供测试管理员，测试会真实登录、查询 API，不能对生产环境执行

```bash
VITE_PROXY_TARGET=http://127.0.0.1:17889 pnpm -F @vben/web-antd exec vite --mode development --port 5667
CLOUDOPS_WEB_URL=http://127.0.0.1:5667 CLOUDOPS_TEST_ENV_FILE=/absolute/path/to/isolated/.env pnpm test:e2e
```

### 部署

推荐使用 [后端仓库 deploy/release](https://github.com/GoSimplicity/AI-CloudOps/tree/main/deploy/release) 的整套 Compose，由 nginx 在同一来源下提供控制台和 API

前端可单独构建 Docker 镜像，容器通过端口 80 提供静态文件及健康检查

```bash
docker build -t cloudops-web .
```

启动脚本仅将公开的 `VITE_GLOB_*` 配置写入 `_app.config.js`；静态部署时应把 `/api`、`/api/v1` 和 WebSocket 转发至实际后端

## 许可证

本项目使用 [MIT 许可证](./LICENSE)，详情请查看 LICENSE 文件。

## 联系方式

如果有任何问题或建议，欢迎通过以下方式联系我：

- Email: [wzijian62@gmail.com](mailto:wzijian62@gmail.com)
- 微信：GoSimplicity（加我后可邀请进微信群交流）
- ![image](https://github.com/user-attachments/assets/e925e26b-82ce-4ef7-8455-859320cb2633)


## 致谢

感谢所有为本项目贡献代码、文档和建议的人！**AI+CloudOps 前端** 的发展离不开社区的支持和贡献。

## 贡献指南

欢迎向 **AI+CloudOps 前端** 项目贡献代码！请按照以下步骤进行：

1. **Fork 本仓库**  
   点击右上角的 Fork 按钮，将仓库 Fork 到您的 GitHub 账户。

2. **创建分支**  
   为您的功能或修复创建一个新的分支：

   ```bash
   git checkout -b feature/您的功能名称
   ```

3. **提交更改**  
   进行代码更改后，提交您的更改：

   ```bash
   git commit -m "描述您的更改"
   ```

4. **推送到分支**  
   将您的分支推送到 GitHub：

   ```bash
   git push origin feature/您的功能名称
   ```

5. **创建 Pull Request**  
   在 GitHub 上创建一个 Pull Request，描述您的更改和改进。

请确保您的代码遵循项目的代码规范，并通过所有测试。

---

欢迎使用 **AI+CloudOps** 云原生运维平台，期待您的参与和贡献！

## 1.0 验证与部署

使用 Node.js 22 和 `pnpm@9.9.0`，首次安装或移动目录后运行 `pnpm install --frozen-lockfile`，重新生成内部 workspace stub。

```sh
pnpm -F @vben/web-antd typecheck
pnpm test:unit --run
pnpm build:antd
```

`/api` 和 `/api/v1` 均通过 Go 后端认证。开发环境可设置 `VITE_PROXY_TARGET=http://127.0.0.1:8889`，前端不得配置 AIOps 服务端 API key。默认开发端口 5666。

```sh
VITE_PROXY_TARGET=http://127.0.0.1:17889 pnpm -F @vben/web-antd exec vite --mode development --port 5667
CLOUDOPS_WEB_URL=http://127.0.0.1:5667 CLOUDOPS_TEST_ENV_FILE=/absolute/path/to/isolated/.env pnpm test:e2e
```

浏览器回归默认使用本机 Chrome。CI 可安装 Playwright Chromium 后设置 `PLAYWRIGHT_CHANNEL=chromium`。全路由回归使用隔离环境账号，密码从环境变量或指定 env 文件读取，不录制 trace，不保存登录凭据。无账号时只运行登录页回归并跳过认证场景。

生产镜像固定 pnpm 版本，包含 HTTP 健康检查；入口脚本只接受 `VITE_GLOB_` 公共配置。此类变量会公开到浏览器，禁止传入密钥。建议通过后端仓库的反向代理统一提供静态文件和 API。

界面规则见 [DESIGN.md](DESIGN.md)。当前版本仅支持阿里云账号连接与同步；其他云的已有资产可查看。系统首页使用真实 CPU、内存、磁盘、负载采样，未采集值显示“待采集”，不生成历史数据。导出使用 UTF-8 CSV；审计与工单导出范围为当前页。账号由管理员分配，暂不提供短信、扫码、第三方和自助注册入口。

如果隔离环境有意不接入 AI 修复执行器或 Prometheus，可给 E2E 显式传入 `CLOUDOPS_EXPECT_UNAVAILABLE=/api/v1/autofix/ready,/api/v1/rca/metrics`。仅这些精确路径的 HTTP 503 会作为 `expected-unavailable` 写入测试注解，其他状态码和路径仍失败。此参数不能证明 AI 外部依赖已生产就绪。

受限网络可使用 `docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com .`；默认仍使用 npm 官方源，锁文件和 TLS 校验不变。构建使用独立 BuildKit pnpm store 缓存。

构建后必须验证真实生产包挂载，不能只检查 Vite 开发模式：

```sh
pnpm build:antd
CLOUDOPS_PREVIEW=true CLOUDOPS_ROUTER_HISTORY=hash pnpm test:e2e --grep "login is usable"
```

此检查自动启动本地 production preview，验证登录表单、窄屏、明暗切换及刷新持久化，并拒绝 `pageerror`。CI 使用 Chromium 执行相同检查，不需要或模拟后端。Rollup 使用自动分包，避免将 Ant Design 的互相依赖模块强制拆成多个初始化顺序不安全的 chunk。
