# AI-CloudOps 1.0 界面约定

TASTE CONTRACT — AI-CloudOps
Map: Instrument
Stack: Vue 3.5.3 / Vben 5.2.2 / Ant Design Vue 4.2.3
Type: 中文使用本机 PingFang SC / Microsoft YaHei；数据使用 SFMono-Regular / Consolas，等宽数字。离线部署不依赖字体CDN。
Ground: 日间 #f2f4f6 / #ffffff，正文 #18232f；夜间沿用 Vben 深色背景变量。
Accent: hsl(205 84% 39%)，沿用控制台蓝色品牌，成功/警告/危险各自独立。
Density: 4px基准，正文14px，表格紧凑，页面间距16px。
Shape: 控件与面板2px圆角，1px边界，面板不使用投影。
Motion: 120ms状态变化；尊重 prefers-reduced-motion。
Signature: 表格行悬停扫描线；系统指标仅显示采集值，缺少历史留空。
Copy: 中文运维操作语气，明确动作、范围、结果；禁止虚构成功状态。
Never: 渐变背景、玻璃面板、装饰性入场、随机指标、用0代替未知。

## 实现

`src/styles/console.css` 提供应用级中性色、焦点和表格规范；`app.vue` 通过 ConfigProvider 统一 Ant Design tokens，沿用 Vben 明暗主题联动。页面 scoped 样式中的常见固定中性色改为语义变量，避免暗色模式白底黑字残留。终端和图表独立色域保留。

列表导出必须说明“当前页”，仅导出屏幕已加载的数据。CSV按RFC4180转义并防止公式注入。敏感字段不纳入导出。

官方依据：Ant Design Vue 4.2.3 ConfigProvider 源码 https://github.com/vueComponent/ant-design-vue/blob/4.2.3/components/config-provider/index.tsx ，主题算法与token按该版本接口配置。

## 验证范围

登录页已在真实 Chrome 中检查浅色、深色和390px窄屏。后台需要隔离环境账号进行真实路由检查；仅构建通过不代表外部Kubernetes、云账号或通知渠道可用。缺少真实资源时页面应展示空态，不伪造业务成功。
