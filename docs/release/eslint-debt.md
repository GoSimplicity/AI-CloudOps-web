# ESLint 技术债分阶段处理

日期：2026-10-31（Asia/Shanghai）。以下是本轮实际执行结果，不用忽略文件、基线抑制或降低规则级别冒充全仓通过。历史候选镜像不包含本轮之后的源码变化。

## 阶段一：布局规范与格式脆弱测试

基线为 `d0f098e`。完整扫描1075个文件：34750 errors、439 warnings。执行 `pnpm exec eslint . --fix --fix-type layout --format json` 后，233个已有文件按现有规则规范化；随后修复两项被格式展开暴露的测试问题。最终完整扫描为 **19338 errors、10 warnings**，仍非全仓 lint 通过。

本阶段没有改变 ESLint 配置、添加忽略或关闭规则，没有运行 suggestion/problem 类型的自动修复。layout 包括 Prettier、Vue 换行/间距和7处 `define-macros-order`；不是“所有脚本AST逐字相同”。宏移动仅涉及类型式 `defineProps`/`defineEmits` 及其别名：无 `withDefaults`、解构默认值；`defineModel` 相互顺序和其它真实初始化调用顺序保留，`defineExpose` 原位置保留。引号属性、分号、模板闭合和编译器保留的文本边缘空白也有规范化，不以这些机械差异推断业务流程变化。

测试加固：

- 错误提示扫描器原来逐行识别 `if + 赋值`，跨行后误报。现在按 TypeScript AST 检查真实赋值和正向 if 守卫；保留74处逐文件守卫快照及既有变异夹具，新增跨行、else/延后回调绕过反例。
- AST 同时发现旧逐行扫描漏掉托管资源6处既有失败关闭状态。使用独立 `MANAGED_FAIL_CLOSED_EXCEPTIONS`，精确限定文件、函数、字段和次数；不归入“非请求错误”白名单。权限/数据完整性无法确认时清空旧数据，历史/同步/人工核对未知时必须保持阻塞。同字段移到其它函数、额外 catch 或次数变化仍拒绝，有专门反例及真实组件回归。
- Cron 本地执行门禁测试按显示文本 trim 边缘空白，仍验证选项禁用、默认 HTTP 和开关说明，不删除行为断言。

执行与结果：

| 检查 | 结果 |
| --- | --- |
| `pnpm test:unit --run` | 最终133文件、2054项全部通过；首次格式后2049通过/2失败的结果没有被隐去，见上述两项测试加固 |
| `pnpm exec vitest run <scanner/localExec/CloudManagedResources>` | 3文件65项通过 |
| `pnpm --filter @vben/web-antd typecheck` | 通过（测试加固后再次执行） |
| `pnpm build:antd` | 11项构建通过；之后仅调整测试与文档，没有修改产品代码 |
| `pnpm exec eslint . --format json` | 执行成功完成扫描，退出码1；19338 errors/10 warnings，不算通过 |

最终剩余主要规则：

| 规则 | 数量 |
| --- | ---: |
| `perfectionist/sort-objects` | 7253 |
| `perfectionist/sort-vue-attributes` | 5384 |
| `perfectionist/sort-named-imports` | 952 |
| `@typescript-eslint/no-non-null-assertion` | 857 |
| `perfectionist/sort-imports` | 748 |
| `vue/attribute-hyphenation` | 531 |
| `no-use-before-define` | 338 |
| `vue/html-closing-bracket-newline` | 275 |
| `perfectionist/sort-union-types` | 249 |
| `unicorn/catch-error-name` | 178 |

后续优先处理可明确证明保持行为的声明/属性排序，再处理类型与运行逻辑告警。不能对含调用、spread、计算属性和依赖的对象盲目重排求值顺序；只有全仓实际零 error/零 warning 后才接入严格门禁。本轮未访问生产或真实云/模型/通知服务，没有部署。
