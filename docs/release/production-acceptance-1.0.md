# 1.0 本机生产 Web 产物联合验收

本记录验证本机隔离 Docker 环境中的生产构建产物，不代表生产环境发布。验收地址为 `http://127.0.0.1:18080`，使用真实 Chrome、同源 `/api` 和 `/api/v1`，生产路由为 Hash 模式。

## 固定产物与运行状态

| 服务 | 实际运行的源码提交 | 镜像 ID |
| --- | --- | --- |
| Web | `a7cd8c1d49e94b5c4866d5faf1212fd5b89d3099` | `sha256:20844ca8425826346eeeee49a239f65144e3f4b7bc1256a7d1757663de49784d` |
| Go backend | `1b6ef8c6bcc783637ef7f22285b4154bbdc713d9` | `sha256:db2031e27aed4098146a271d929a85b28252f71ca0295bd79bbd612da38c18e5` |
| AIOps / MCP | `4dc31ac7b6ec7d3b43f0828b2ed55a58cbd07fd2` | `sha256:d89ce8a19b20490cd6f304ccc50205d213542b87ec77952c86a6aa2999afd539` |

Web 使用 `/tmp/cloudops-build-snapshot.py web` 对已推送提交执行 `git archive` 后构建，未使用工作树。构建来源记录、镜像 revision 标签与运行容器镜像 ID 已交叉核对。只对 Web 执行 `docker compose ... up -d --no-deps --no-build --wait web`，该次更新未更换其他服务容器。浏览器验收在最终 Go 镜像切换并健康后开始；Web、backend、AIOps、MCP、gateway 在定向复验前后均健康，容器 ID 和镜像一致。

本提交仅修正 E2E 前置条件及记录结果，未改变页面或 API；上表 Web 产物的源码仍为 `a7cd8c1`，不能将本提交误写为已运行的镜像来源。

## 两轮实际结果

第一轮运行原 `console.spec.ts` 中 15 个只读用例，耗时 **177.30 秒，13 通过、2 失败**。随后仅修复两个过时的测试合同，定向复验 **47.49 秒，2 通过**。最终这 15 类场景均有通过记录，**并非 15 个用例在同一轮全部通过**。

两个失败的原因及修正：

- 值班日历缺少 `id` 时，当前页面留在原路由并明确显示“缺少值班组ID参数，请返回值班组列表重新选择”。旧 E2E 仍期待自动跳转。测试改为检查真实错误合同，路由检查使用软断言聚合，确保后续静态入口继续走查。
- 过期登录场景仅写入本地缓存的 `loginExpiredMode=modal`。生产 Hash 导航不重启应用，运行中的偏好仍为默认 `page`，因此真实 401 链正确返回完整登录页。测试在写缓存并导航后执行真实 `reload()`，使前置策略生效，再验证 401、refresh 401、重登对话框及真实 profile / 权限 / 列表恢复。未修改产品默认过期策略。

覆盖登录页与主题持久化；系统四列表；流程、模板、表单列表；账户菜单与诚实通知空态；真实 kind 的集群、命名空间、Deployment、Pod、Service、ConfigMap 及其余十类资源列表；九个监控列表；定时任务取消；助手旧无归属缓存隔离；助手四页、AutoFix、RCA 三页和预测两页的本地控件、移动布局及主题；过期登录恢复。Kubernetes 使用既有本机隔离集群及自有 namespace，未更改集群资源。

## 路由范围与副作用边界

AST 识别 58 个注册组件路由，第二轮静态总走查实际访问全部 **56 个静态入口，缺失 0 个**。其中值班日历缺少 ID 的错误态已验证，不将其称为有真实组 ID 的日历读取。

另外两个路由 `/terminal_connect`、`/web-terminal/:id` 属于 SSH 动态连接入口，使用此前独立 Local / Cloud SSH 验收证据。云包装此前通过真实 `ForConnection` 链连接隔离 OpenSSH，验证 PTY、`cloudops-v1`、无 URL token、算术输出、Ctrl+C 与断开；自建云 DB/metadata 记录已清理。**本轮没有重新执行动态 SSH，也未声称 58 个入口逐个执行命令**。

原 console 的六个有副作用或执行场景被显式排除：值班组创建/删除、YAML 模板与任务创建及 dry-run、通知配置创建/删除、工单审批流程、助手 query POST、Pod exec。其独立验收不计入本轮只读结果。

临时驱动保留原测试逻辑，只增加 API 只读守卫、路径/状态证据及独立截图目录。两轮合计守卫阻断 **0 次**；观测到的非 GET 请求仅为登录、登出及注入失败的 token 刷新，没有业务写入、模型查询、ready、通知发送、云 verify/sync/available-regions 请求。

允许的依赖不可用白名单保持原两项：`/api/v1/autofix/ready`、`/api/v1/rca/metrics` 的 HTTP 503。**本次两轮均未观测到 503，不依赖白名单通过**。非成功响应仅为过期登录用例按预期注入的列表 401 和 refresh 401，两轮各一组。

## 本机证据与重现方式

证据位于本机私有临时目录，不包含源代码中的凭据：

- `/tmp/cloudops-web-image-provenance.json`：Web 归档来源与镜像 ID
- `/tmp/cloudops-prod-web-i5j83gsl/`：首轮 15 例，13 通过、2 失败
- `/tmp/cloudops-prod-web-cua1ue7_/`：修正合同后的两例定向通过、完整静态入口走查
- `/tmp/cloudops-production-web-final-result.json`：合并结果、HTTP 状态、精确路由覆盖与运行容器健康
- `/tmp/cloudops-production-web-accept.py`：独立安全驱动；各轮目录含 `source-manifest.json`、`summary.json`、`*.network.json`、`runtime-before.json`、`runtime-after.json`、脱敏 `browser.log` 和显式截图

驱动使用私有 env 文件在进程内读取凭据，stdout/stderr 在内存中替换环境私密值后才写入 0600 日志；结果目录 0700，trace/video/自动失败截图关闭。测试不输出 Bearer 或密码，不改共享结果配置、布局清单或产品源码。私有 env、隔离集群夹具及运行容器均为重现前置条件，临时目录不能作为持久 CI 产物。

重现时使用 `CLOUDOPS_WEB_URL=http://127.0.0.1:18080`、`CLOUDOPS_ROUTER_HISTORY=hash`、`CLOUDOPS_TEST_ENV_FILE` 指向私有 env 文件，并设置既有隔离集群名称与 namespace。使用本地安全驱动的只读选择和输出脱敏，不能直接全量执行含 CRUD 的原 console。后端稳定窗口内先确认实际镜像及健康，再执行走查。
