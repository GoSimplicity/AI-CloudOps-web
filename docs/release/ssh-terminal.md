# SSH 终端统一与真实 PTY 验收

本地与云资源终端页面使用同一个 SshTerminal 和连接 composable，外层复用 OpsPage，终端配色独立保留。终端 DOM 在连接前即挂载，避免旧云终端连接成功后仍无可用挂载点

- 显式声明 `terminal_mode=pty-v1&cols=...&rows=...`，认证仍仅用子协议；不在 URL 放令牌
- 原始按键按 UTF-8 编码为二进制帧，不在浏览器回显或缓存至回车；长粘贴按64KiB分帧，单次超过1MiB在发送前拒绝
- resize 使用独立文本 JSON 控制帧；服务器二进制输出原样交给 xterm，支持无障碍文本与跨帧 UTF-8
- 重连使用最新令牌，旧连接迟到事件不覆盖新状态；退出登录立即关闭并清理显示，卸载释放连接、尺寸观察器和输入订阅
- 连接建立有20秒期限；不再用一分钟前端闲置计时器中断已建立会话。主题及窗口变化保留连接和历史
- 按钮增加中文无障碍名称，390px操作可换行，终端内滚动不产生页面横向溢出

## 本轮已执行

- 7项SSH交互单测及5项既有三客户端契约通过；app类型检查通过，含本批源码的全仓494项单测、11项构建任务通过
- 私有Docker网络中启动自有OpenSSH，无发布端口，临时客户端密钥仅保存在权限0600的临时目录与服务端加密字段；使用已有ssh.yaml只读挂载经自有容器可信导出的host key
- 通过真实Go同源网关进行SSH：算术结果437、`stty size`验证42行120列、Ctrl+C中断sleep15并在5秒内执行下一条命令，认证子协议为cloudops-v1
- 真实Chrome 4.1秒端到端通过：键盘输入得到493、Ctrl+C后得到341、实际二进制Ctrl+C帧、390px尺寸同步、浅色/深色切换保留历史且仅一条WebSocket连接、关闭连接与运行时错误零项
- 首轮执行已经通过命令/中断/resize，但最后按钮定位因图标英文加入无障碍名称失败；已补中文aria-label并完整复验通过，未把失败轮当作完成

截图位于 `.cache/ui-verification/ssh-desktop-light.png` 与 `ssh-mobile-dark.png`。夹具容器、资源登记、临时密钥和信任文件由本轮结束时精确清理。当前是本地OpenSSH实测，云终端复用前端组件并有真实SSH协议fixture回归，没有连接用户生产主机或真实云账号

可重复浏览器检查需要显式提供 `CLOUDOPS_TEST_SSH_RESOURCE_ID` 和 `CLOUDOPS_TEST_ENV_FILE`，且仅允许localhost/127.0.0.1入口，运行 `pnpm exec playwright test tests/e2e/ssh-terminal.spec.ts`；默认CI没有自有OpenSSH夹具时跳过该外部集成用例，底层交互单测与Go真实协议smoke仍强制执行
