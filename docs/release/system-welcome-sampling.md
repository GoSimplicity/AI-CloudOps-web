# 系统欢迎页采样契约

欢迎页仅读取后端运行主机，不代表 Kubernetes、所有云资源或整个平台健康。页面继续保留四项指标、本页采样小图、主机信息、网络与性能图、阈值提示及资源使用详情，路由仍为 `/system_welcome`。

- `GET /api/system/info` 返回最多缓存五分钟的主机信息，`GET /api/system/metrics` 返回即时采集的完整 System 扁平字段；当前元数据优先采用即时 metrics，info仅作缺失时补充
- 手动刷新和轮询都只使用这两个 GET，统一更新派生值、当前图表和本页最近30次采样；不再需要写缓存的 POST refresh
- Go 当前 `getLinuxNetworkTraffic` / `getMacOSNetworkTraffic` 已返回累计 MiB，图表直接展示接收/发送计数，不再除1024²，不把累计值称为实时速率
- CPU/内存/磁盘的有限0..100、负载的有限非负数均保留真实零；缺失、NaN、超范围以及失败响应显示未知，未知资源不画零进度条
- 读取失败清除相应旧快照，metrics失败不能拿cached info中的旧数值充当实时采样；告警只依据本次有效字段，不生成“全系统正常”事件
- 采集时间取API `last_update_time`，另行标注页面实际读取时间和浏览器当前时间，避免把显示时钟当采集时刻
- 激活时立即读一次，每30秒尝试读取；上一轮未结束则跳过，不排队重叠。KeepAlive离开停止轮询/时钟/图表监听、废弃迟到结果，返回后重新采样；卸载释放全部图表与监听
- 图表使用当前主题的实际解析颜色，主题切换仅更新配色，不发网络请求

单测覆盖有值/真实零、空数据、部分/全部失败、无效字段、即时元数据、派生图刷新、累计单位、未完成请求抑制、KeepAlive旧请求、卸载与主题生命周期。默认全为离线API替身；独立浏览器测试只允许本机GET采样与登录，不调用云、模型、通知或业务写。

本机只读证据：`/tmp/cloudops-welcome-contract-result.json` 与 `/tmp/cloudops-welcome-contract-check.log`；访问两个真实系统端点均HTTP200/code0，正文不包含凭据。Go源目前没有逐字段采集可用性标志，采集器内部失败时可能保留数值默认零；前端能区分缺失/无效字段，无法从一个合法零值还原后端采集是否失败，因此状态文案严格限定为“可用采样未超阈值”。

浏览器命令（凭据仅从私有文件读取）：

```sh
CLOUDOPS_TEST_ENV_FILE=/absolute/private/release/.env pnpm exec playwright test tests/e2e/system-welcome-sampling.spec.ts --workers=1
```

真实浏览器第1轮通过（Chrome，5.2秒）：两个系统端点均HTTP200、刷新只GET、桌面浅色与390px深色、四统计卡两列且宽<200px/高<160px、主题按钮命中、零系统POST及AI API、无pageerror。目视发现累计网络图重复轴端单位裁切，已移除重复轴端标签（说明及tooltip仍标MiB）；每核心负载轴最小上限2，避免低负载被自动缩放夸大，超出时向上扩展且不截断真实值。

截图：`.cache/ui-verification/system-welcome-desktop-light.png`、`.cache/ui-verification/system-welcome-mobile-dark.png`。最终第2轮通过（Chrome，6.0秒）：裁切已消除且低负载不被视觉放大；追加浏览器本地拦截的503与200/null故障注入后，旧数值/正常状态/性能图清除。故障注入不修改后端，只验证页面失败和空态；真实采样截图在故障注入之前取得。两轮均无pageerror、系统POST或AI接口调用，不需要第3轮。
