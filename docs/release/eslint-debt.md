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

## 阶段二：同声明导入与安全模板属性排序

基线为 `207c2ea`。只选择现有规则提供的 `sort-named-imports`/`sort-named-exports` 同声明成员修复，以及经逐标签检查的 `sort-vue-attributes` 修复；没有改变模块导入声明顺序。130个文件涉及277个 named 声明、2924个安全起始标签；另移除4条完整扫描已确认无效的 `eslint-disable-next-line`，增强后续规则检查。

模板选择保留950个复杂标签：拒绝动态属性参数、无参数 `v-bind`/`v-on`、重复属性或事件覆盖、立即调用/赋值/递增/new/await/展开等表达式。事件回调和函数体是延后执行，不作为渲染阶段立即执行。自定义指令、同标签多个潜在 runtime 指令、`onClick` 与 `@click` 的同键覆盖、`v-html`/`v-text` 与 `innerHTML`/`textContent` 覆盖均拒绝自动重排。没有批修对象字面量、模块导入顺序、类型声明或其它 suggestion 规则。

独立复查后保守撤回8个多 `v-model` 标签的排序，涉及6个文件；即使组件多 `v-model` 通常编译为props，仍保留原顺序。最终 AST 比对134个源文件：只规范化同声明 named 成员及同标签属性的排列；其余脚本结构、模块声明次序、表达式内容、模板子节点和样式一致。比较忽略位置、注释及相应既有 parser 诊断坐标，不忽略诊断内容。

| 检查 | 实际结果与边界 |
| --- | --- |
| 完整 ESLint JSON 扫描 | **13518 errors、6 warnings**；named-imports 952→0，Vue属性 5384→516。退出码1，仍非 lint 通过 |
| `pnpm test:unit --run` | 133文件2054项通过；其后仅保守撤回上述8标签排序和移除无效注释 |
| 撤回后的相关组件复验 | 角色、工单实例/表单、自动修复、CMDB五文件46项；Prometheus列表一文件37项，全部通过 |
| 类型检查、生产构建 | `pnpm --filter @vben/web-antd typecheck`、`pnpm build:antd` 通过（11项构建）；最后撤回恢复基线标签次序，没有扩大运行语义变更 |
| AST及差异检查 | 134源文件 AST 比对通过，`git diff --check` 通过 |

剩余主要项为对象排序7253、非空断言857、模块导入排序748、Vue属性连字符531、复杂模板属性排序516、定义前使用338、Vue闭合换行275、union排序249、catch变量命名178、对象类型排序155。6条warning为5处 `vue/no-v-html` 与1处模板变量遮蔽；没有关闭规则或假定转义即安全来隐藏它们。

## 阶段三：作用域内命名、无用绑定与测试类型边界

阶段二后的独立子阶段 `2e0339b` 先处理 Node 两测试文件：69处非空断言改为实际执行的必需值检查，74项测试与类型检查通过。以下全仓数值包含该已提交子阶段，不将它归入后续未提交文件。

本阶段按实施方向分别记录证据：

- 94个本人负责源文件：178处 catch/Promise 错误参数按安装规则的作用域 fixer 改名；70处无引用的简单 Identifier catch 参数移除；130个普通无转义静态测试标题只改首字母。动态 eval/Function/with 文本、解构参数及有转义标题不自动处理。安装的 rename fixer 保留对象 shorthand 的公开属性名并避免变量捕获。
- 同一批中的 AssistantQuery 模板：仅改解析器识别的一个 `v-for` 局部绑定及11处引用，`message`→`chatMessage`；Ant Design message API、类名字符串和其它作用域不改。独立 AST 验证按真实作用域绑定做 alpha 归一化，保留公开属性名、模板内容及其它运行结构；五个业务浏览器标题与后端精确白名单仍各匹配一次。
- 另外3个 Secret 测试文件由独立实施者处理103处非空断言：使用实际模块导出类型、去掉 `Record<string, any>` 兼容cast，以及在运行时校验必需值。它们同时包含本阶段已交接的安全标题/catch规范；不宣称此类类型/断言检查与原脚本纯 alpha 等价。该方向218项定向测试、类型检查通过。

最终整合验证（全部写入方已freeze后执行）：

| 检查 | 结果 |
| --- | --- |
| `pnpm test:unit --run` | 133文件、2054项通过 |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| `pnpm build:antd` | 11项构建通过 |
| 完整 ESLint JSON 扫描 | **12917 errors、5 warnings**，退出码1，仍非 lint 通过 |
| 作用域/语义核对 | 94个本人负责源文件 AST 核对通过；Secret3文件另有类型和运行期检查证据；5个业务标题精确保持 |

相对阶段二完整扫描：非空断言857→685（Node69+Secret103）、catch命名178→0、optional catch71→1、标题147→17、模板遮蔽1→0。保留的一条optional catch由整文件保守动态引用文本过滤拒绝；独立核对仅是 `Function` 类型注解，后续可人工处理，不能声称存在真实 eval。17个标题含暂未处理的Node测试标题及两条转义字符串，不冒用插件可能破坏转义的fix。

格式规则没有一律下降：本阶段按现有 Prettier 规范排版的文件中，既有空else块与其它排版产生 `empty-brace-spaces` 4→38、Vue闭合换行275→284，Prettier41→19。记录真实结果，后续应消除无意义空分支并处理规范冲突；不通过关规则或忽略文件隐藏它们。5条warning均为 `vue/no-v-html`，仍待按实际渲染与清洗合同处理。本轮不执行真实外部业务或上线。

## 阶段四：删除无作用分支与收紧存在性检查

基线为 `7b80723`。在独立文件所有权下完成以下修改，所有写入方freeze后再执行最终全仓检查：

- 16个本人负责文件：删除11处真正空且无注释的else、40个无语句的独立块；仅允许直接位于Program/Block语句列表或SwitchCase列表的目标，保留后续非空块的独立作用域。不删除条件表达式、then分支、函数/catch必要body；保守排除可能改变dangling-else的结构。AST重新解析并只归一化这些no-op节点，确认没有ASI合并、条件或求值分支变化。
- 手工修改16个测试标题的第一个原始字符，包括一个TemplateLiteral的固定前缀；插值和后续转义不动。Notification唯一unused Identifier catch经过真实AST确认没有eval/Function调用，按无引用绑定处理。此前保守的纯文本Function命中来自类型注解。
- 独立实施者处理Secret生产入口10处非空断言，保留代理异常、零字符/EOF等已有拒绝合同，并补零长度读取回归；其范围5文件，模块11文件474项测试及类型检查通过。Secret转义标题只改原始首字符，转义保持。
- 另一实施者处理3个Cloud合同测试141处非空断言，使用实际存在性guard；resolver保留兼容的new Promise与显式undefined校验，没有引入新的Node运行门槛。121项测试、类型检查通过。

| 最终检查 | 实际结果 |
| --- | --- |
| 完整 ESLint JSON 扫描 | **12620 errors、5 warnings**，退出码1，仍非 lint 通过 |
| `pnpm test:unit --run` | 133文件、2055项通过 |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| `pnpm build:antd` | 11项构建通过 |
| AST与业务门禁核对 | 本人16文件no-op/固定前缀证明通过，其余两个方向分别核对guard；5个精确业务浏览器标题保持 |

主要变化：非空断言685→534、`no-empty`59→8、`no-lone-blocks`40→0、空brace38→9、标题17→0、optional catch1→0、Prettier19→10。Vue闭合换行284→286，继续如实保留规范冲突。剩余空if条件可能求值，未为消除告警而删掉；也没有增加无意义语句或注释来隐藏空分支。5条HTML渲染warning仍未关闭。本轮仅本地修改、检查与Git交付，不上线。
