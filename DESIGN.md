# AI-CloudOps 1.0 界面约定

TASTE CONTRACT — AI-CloudOps
Map: Instrument
Stack: Vue 3.5.42 / Vben 5.2.2 / Ant Design Vue 4.2.3
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

## 列表页面共享骨架

页面通过 `OpsPage` 的 `title` / `description` 属性和 `actions` / `summary` / `filters` / 默认插槽组合，页面只提供业务控件及事件，标题、主操作间距、筛选面板和窄屏布局由共享组件维护

共享间距使用 `--ops-space-sm/md/lg/xl`，分别为 8/12/16/24px。筛选控件在窄屏独占一行，汇总卡片自动换列，横向滚动限制在表格内。分页汇总必须标明“本页”，服务端全量统计可用时才使用“总数”

路由迁移清单由 `pnpm update:layout` 解析真实路由导入及 Vue 模板生成；CI 执行 `pnpm check:layout` 防止清单与实现漂移。共享骨架覆盖只表示结构迁移，业务验收与视觉验收分别记录

移动端列表摘要采用两列紧凑卡片，卡片高度约 84px；保留可操作的筛选和表格首屏空间。640px 以下隐藏悬浮设置与助手浮窗，助手可从菜单进入。窄屏表格取消固定列，使用横向滚动，避免左右固定列覆盖数据；验收应检查控件中心命中和实际点击，不能只检查页面横向溢出
