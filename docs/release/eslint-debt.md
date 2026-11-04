# ESLint 技术债分阶段处理

日期：2026-10-31（Asia/Shanghai）。以下按阶段记录真实执行结果，历史候选镜像不包含本轮之后的源码变化。当前规则口径：阶段八仅在Vue文件的Prettier工作流中关闭重复的 `vue/html-closing-bracket-newline`，`prettier/prettier`继续error；独立 `vue()` 配置保留原error，语义、安全和TODO校验不变。其它阶段的“未调整规则”只描述各阶段当时的修改，不代表全程没有规则职责调整。

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

剩余主要项为对象排序7253、非空断言857、模块导入排序748、Vue属性连字符531、复杂模板属性排序516、定义前使用338、Vue闭合换行275、union排序249、catch变量命名178、对象类型排序155。6条warning为5处 `vue/no-v-html` 与1处模板变量遮蔽；本阶段未调整规则，也未用转义假设替代HTML安全验证。

## 阶段三：作用域内命名、无用绑定与测试类型边界

阶段二后的独立子阶段 `2e0339b` 先处理 Node 两测试文件：69处非空断言改为实际执行的必需值检查，74项测试与类型检查通过。以下全仓数值包含该已提交子阶段，不将它归入后续未提交文件。

本阶段按实施方向分别记录证据：

- 94个作用域命名与布局范围源文件：178处 catch/Promise 错误参数按安装规则的作用域 fixer 改名；70处无引用的简单 Identifier catch 参数移除；130个普通无转义静态测试标题只改首字母。动态 eval/Function/with 文本、解构参数及有转义标题不自动处理。安装的 rename fixer 保留对象 shorthand 的公开属性名并避免变量捕获。
- 同一批中的 AssistantQuery 模板：仅改解析器识别的一个 `v-for` 局部绑定及11处引用，`message`→`chatMessage`；Ant Design message API、类名字符串和其它作用域不改。独立 AST 验证按真实作用域绑定做 alpha 归一化，保留公开属性名、模板内容及其它运行结构；五个业务浏览器标题与后端精确白名单仍各匹配一次。
- Secret测试模块的3个文件处理103处非空断言：使用实际模块导出类型、去掉 `Record<string, any>` 兼容cast，以及在运行时校验必需值。它们同时包含本阶段的安全标题/catch规范；不宣称此类类型/断言检查与原脚本纯 alpha 等价。该方向218项定向测试、类型检查通过。

最终整合验证（全部写入方已freeze后执行）：

| 检查 | 结果 |
| --- | --- |
| `pnpm test:unit --run` | 133文件、2054项通过 |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| `pnpm build:antd` | 11项构建通过 |
| 完整 ESLint JSON 扫描 | **12917 errors、5 warnings**，退出码1，仍非 lint 通过 |
| 作用域/语义核对 | 94个作用域命名与布局范围源文件 AST 核对通过；Secret3文件另有类型和运行期检查证据；5个业务标题精确保持 |

相对阶段二完整扫描：非空断言857→685（Node69+Secret103）、catch命名178→0、optional catch71→1、标题147→17、模板遮蔽1→0。保留的一条optional catch由整文件保守动态引用文本过滤拒绝；独立核对仅是 `Function` 类型注解，后续可人工处理，不能声称存在真实 eval。17个标题含暂未处理的Node测试标题及两条转义字符串，不冒用插件可能破坏转义的fix。

格式规则没有一律下降：本阶段按现有 Prettier 规范排版的文件中，既有空else块与其它排版产生 `empty-brace-spaces` 4→38、Vue闭合换行275→284，Prettier41→19。记录真实结果，后续应消除无意义空分支并处理规范冲突；本阶段未用规则抑制处理冲突；重复格式职责后续由阶段八经实证收敛。5条warning均为 `vue/no-v-html`，仍待按实际渲染与清洗合同处理。本轮不执行真实外部业务或上线。

## 阶段四：删除无作用分支与收紧存在性检查

基线为 `7b80723`。按模块完成以下修改，最后在同一工作区统一执行全仓检查：

- 16个无作用分支与标题规范文件：删除11处真正空且无注释的else、40个无语句的独立块；仅允许直接位于Program/Block语句列表或SwitchCase列表的目标，保留后续非空块的独立作用域。不删除条件表达式、then分支、函数/catch必要body；保守排除可能改变dangling-else的结构。AST重新解析并只归一化这些no-op节点，确认没有ASI合并、条件或求值分支变化。
- 手工修改16个测试标题的第一个原始字符，包括一个TemplateLiteral的固定前缀；插值和后续转义不动。Notification唯一unused Identifier catch经过真实AST确认没有eval/Function调用，按无引用绑定处理。此前保守的纯文本Function命中来自类型注解。
- Secret生产入口模块处理10处非空断言，保留代理异常、零字符/EOF等已有拒绝合同，并补零长度读取回归；其范围5文件，模块11文件474项测试及类型检查通过。Secret转义标题只改原始首字符，转义保持。
- 3个Cloud合同测试处理141处非空断言，使用实际存在性guard；resolver保留兼容的new Promise与显式undefined校验，没有引入新的Node运行门槛。121项测试、类型检查通过。

| 最终检查 | 实际结果 |
| --- | --- |
| 完整 ESLint JSON 扫描 | **12620 errors、5 warnings**，退出码1，仍非 lint 通过 |
| `pnpm test:unit --run` | 133文件、2055项通过 |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| `pnpm build:antd` | 11项构建通过 |
| AST与业务门禁核对 | 16个无作用分支与标题规范文件的no-op/固定前缀证明通过，其余两个方向分别核对guard；5个精确业务浏览器标题保持 |

主要变化：非空断言685→534、`no-empty`59→8、`no-lone-blocks`40→0、空brace38→9、标题17→0、optional catch1→0、Prettier19→10。Vue闭合换行284→286，继续如实保留规范冲突。剩余空if条件可能求值，未为消除告警而删掉；也没有增加无意义语句或注释来隐藏空分支。5条HTML渲染warning仍未关闭。本轮仅本地修改、检查与Git交付，不上线。

## 阶段五：经实际编译和断言语义验证的安全排序

提交 `feb5e8d` 包含79个安全排序文件，固定对照 `0727057`：43个type-import位置修复、54个简单union、23个纯property类型体及16个静态expected对象/分区修复。25个相关测试文件386项通过。Pod.vue另一个本地上传状态union排序归入Pod关闭可靠性提交 `e3b4d0c`，不计入这79个文件。

- 模块导入只接受所有value/side-effect声明次序与内容保持一致的候选，不重新安排运行模块的加载顺序。
- 不修改普通production `.ts` 的type字段或union，避免影响其它Vue组件间接消费的Props；测试类型只选简单literal/primitive或无重载/调用/index签名的唯一静态property。
- “类型会擦除”不足以证明Vue安全：`boolean|string`与`string|boolean`会生成不同构造器顺序。SFC候选使用安装的Vue compiler-sfc 3.5.42真实compileScript，再严格比对运行JS AST，保留props字段及构造器数组顺序；10个实际运行输出不同的候选拒绝、未写。Boolean/String反例确认验证器确实拒绝变化。
- 79文件聚合运行AST证明通过，涵盖34个SFC实际编译；所有SFC模板及style逐字相同。唯一允许的运行AST差异是以下限定的Vitest静态expected键顺序。
- 只处理作用域绑定确实来自vitest import的expect，且仅toEqual/toStrictEqual的完整静态数据expected树。拒绝动态值、computed、重复键、spread、调用、getter、new、赋值/递增及快照/捕获断言上下文，不改其它值对象、序列化对象或数组次序。79文件实际没有局部undefined绑定。
- 安装的@vitest/expect 2.1.9源码及运行fixture确认：上述两种比较沿actual keys递归，静态expected键次序不改变结果或actual getter读取序；失败展示次序可能变化，未用快照消费此变化。toMatchObject的subset比较则会沿expected keys读取，实测会改变getter读取序，因此全部排除。

工单4测试87处（`0d8df80`）、页面4测试68处（`ba556ca`）非空断言为独立测试子阶段；Pod关闭可靠性为`e3b4d0c`。这些改动和后续前端运行边界改动不应混称为安全排序。曾在中间工作区观察到2123项通过及12256/5的全仓结果；它包含当时未提交的运行代码，也早于后续Task回执race补充，不作为本提交完整验收依据。

## 阶段六：前端运行代码存在性与异步回执边界

11个前端运行文件清理25处非空断言，覆盖YAML Task/Template、请求owner/错误标记、树数据、通知调度、预测序列、终端输入及工作流等模块。另有相关回归文件与两个新增Task/Template测试文件；这些是前端运行边界，不能误称后端Cron改动，也不纳入阶段五运行JS等价声明。

对YAML Task/Template进行了四类独立回查并补足反例：

1. **请求标识**：已有资源的详情、编辑、删除、执行和批量ID，以及Task创建使用的模板ID，拒绝缺失、0、NaN、无穷及unsafe整数，错误场景在写请求前终止。新建Template沿用服务端分配ID合同。
2. **详情回执**：owner、cluster、target、generation、visible及detailRevision共同约束success/catch/finally；同集群A→B、关闭重开、旧成功/失败迟到均不覆盖新详情或新loading。
3. **提交及执行回执**：创建/编辑/执行各有当前请求版本和目标上下文；formRef身份、模态关闭重开及共享submitLoading由当前提交控制，旧回执不重置新模态、清理新loading或展示过时成功/失败。
4. **批量确认**：确认前固定目标集合，确认时复核owner/cluster、选中keys和rows；选中目标集合或ID变化会拒绝派发，迟到回执不清除新选择。

最后Task/Template/resource-scope三个文件131项定向测试通过；早期定向轮次存在重叠，不相加为独立覆盖。其它相关模块也分别执行了回归，最终以全部写入停止后的一次全量结果收口。

| 最终检查 | 实际结果 |
| --- | --- |
| `pnpm test:unit --run` | 135文件、**2153项全部通过** |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| `pnpm build:antd` | 11项构建通过 |
| `pnpm exec eslint . --format json` | **12256 errors、5 warnings**，退出码1，仍非lint通过 |
| 差异及范围 | 模块行为回归与安全排序编译证明分别记录，没有把运行逻辑修改说成纯格式等价 |

这些是本地Fake/Mock及组件/类型/编译验证，没有连接真实Kubernetes、生产环境或执行上线；忽略过期UI回执也不等于撤销已经发出的远端动作。

## 阶段七：Secret 切换回调的空分支收尾

仅删除 `Secret.vue` 中 `handleClusterChange` 的空 `else {}`；条件、清空旧列表以及读取命名空间/Secret 的分支原样保留，没有新增行为或规则例外。

- Secret 模块11文件474项测试与应用类型检查通过。
- 重新执行完整 ESLint 扫描：**12254 errors、5 warnings**，退出码1；`no-empty` 已为0。仍未宣称全仓 lint 通过。
- 前一运行逻辑阶段的完整2153项测试和11项构建保留原范围，本次采用模块复验，没有把它们伪写为本次重跑结果。没有执行真实Kubernetes或生产操作。


## 阶段八：统一Vue闭合换行的格式校验职责

真实根配置可复现：Prettier已格式化的inline链接有2条Vue闭合换行错误，却没有Prettier错误；应用Vue规则提供的fix后，Prettier重新恢复原格式。Vue实际SSR渲染确认原始/格式化内容的inline文本及空白相同。该布局用于保留inline whitespace，不能靠反复改产品模板解决两个formatter的回摆。

最小配置改动仅在 `prettier()` 的Vue文件override中把 `vue/html-closing-bracket-newline` 设为off；全局 `prettier/prettier`仍为error，Vue独立配置仍保留原error。没有引入整套冲突屏蔽、修改Prettier的whitespaceSensitivity、增加ignore或改动产品源文件。格式由Prettier强制，语义、安全和TODO规则照常执行。

新增7项回归通过真实根ESLint配置及安装插件验证：旧规则fix回摆、格式化后的重复fix固定点、坏闭合格式仍触发Prettier error、未格式化源码仍失败、实际Vue SSR文本不变，以及语义/HTML/TODO规则仍启用。新旧兼容测试共12项通过，配置与新测试文件定向ESLint为0 errors/0 warnings。

| 最后验证 | 实际结果 |
| --- | --- |
| `pnpm test:unit --run` | 136文件、**2160项全部通过** |
| `pnpm --filter @vben/web-antd typecheck` | 通过 |
| 完整 ESLint JSON 扫描 | **11968 errors、5 warnings**，退出码1，仍非lint通过 |
| 变化范围 | 相对阶段七12254，去除286条已实证与Prettier冲突的重复闭合换行诊断；未降低业务/安全规则 |

该阶段只修改lint配置与回归测试，没有重复构建产品；此前11项构建保留原阶段证据，不伪写为本次重跑。

## 当前剩余技术债

最后完整扫描为11968 errors、5 warnings；主要剩余对象排序7234、模块导入排序685、非空断言354、Vue属性连字符531、复杂Vue属性排序516、定义前使用338、union排序193、对象类型排序126等。5条warning均为HTML渲染相关。对象插入顺序、模块加载顺序、Vue类型宏及复杂表达式具有实际语义，仍需逐模块验证；不能盲目重排或降低语义/安全校验来清计数。已实证的重复格式职责仅按阶段八指定范围去重。没有宣称全仓ESLint清零、真实Kubernetes已验或已上线。


## 阶段九：去除测试中无效的类型标记

TypeScript 检查确认 `SshTerminal.test.ts` 的6处断言作用于既有 any 值，不产生类型收窄。仅删除这些 `!`，没有新增 any、as、缺失值回退或运行时 helper；编译 JavaScript 保持不变，随后一处正常排版调整的运行 AST 也保持相同。

- 相关7项测试通过，应用类型检查通过；排版调整后再次验证7项。
- 完整 ESLint 实扫为**11962 errors、5 warnings**；相对上一阶段只减少6条非空断言，逐规则未增加其它诊断，非空断言354→348。
- 本次没有重跑前述2160项全套或产品构建，不偷换其验证范围；没有真实SSH/云操作或上线。


## 阶段十：测试前置条件显式检查（2026-11-03）

10个自动修复、Cron、CMDB、SSH与Secret测试文件消除124处非空断言。Secret测试直接使用真实模块类型，去掉宽泛兼容cast；其余使用局部必需值检查，前置条件缺失仍立即失败，不删除或放宽原业务断言。

- 10文件188项定向测试、应用类型检查通过。
- 定向ESLint逐规则比对仅减少124处非空断言，其它诊断不变；仍未全仓lint通过。
- 本阶段没有修改产品代码、共享规则或外部服务。


## 阶段十一：SFC结构与组件命名（2026-11-03）

49个Vue文件规范化45处区块顺序、133处已导入组件的PascalCase拼写，共178项修复。没有重排脚本初始化、模板子节点、样式或业务表达式；暂保留另阶段拥有写权的工单文件。

- 使用项目实际Vue 3.5.42 compiler-sfc，逐文件比较修改前后的compileScript及compileTemplate输出：TypeScript打印归一化后运行代码相同；块属性、自定义块与样式逐字相同。
- 当前整合工作区137文件2171项全量单元测试与应用类型检查通过；该工作区同时包含阶段十二的11项清理回归，不把2171全部算作本阶段新增测试。
- 49文件定向ESLint完成扫描，所选规则减少178项；ProcessDesign同文件剩1条区块顺序留待下一轮。其它lint债未隐藏，未修改规则或ignore。

## 阶段十二：清理失败保留原错误与定时器类型（2026-11-03）

四个业务E2E的finally原来直接抛清理错误，可能覆盖先前的业务失败。新增`withFixtureCleanup`：始终等待清理，单一失败保留原对象，双失败用AggregateError保留业务与清理两者，包括throw undefined/null。四个E2E原业务和清理body逐节点AST核对一致，资源归属、停用状态和异主资源拒绝守卫保留，业务标题没有改变。

- helper11项、相关FormDesign/Instance组件27项测试通过；当前整合工作区全量2171项通过。
- 新helper及测试定向ESLint为0 errors/0 warnings；no-unsafe-finally消除7处，仍保留其它既有E2E lint债。
- 工单4文件的8个NodeJS.Timeout改为ReturnType<typeof setTimeout>；真实Vue脚本编译的JavaScript逐字相同，模板/样式不变；应用类型检查通过。
- Playwright仅执行`--list`，收集29项成功；四个修改后的浏览器场景需后续固定三仓CI实际验收，不能将收集成功说成业务验收通过。未访问生产或真实云。


## 阶段十三：应用测试非空断言收尾（2026-11-03）

其余38个应用测试文件的152处非空断言已清除，apps/web-antd/src中的测试不再含NonNullExpression。148处使用显式存在性检查，4处m.index已由TypeScript证明为number，仅删除冗余标记。没有引入any/as、缺失值回退或删除业务断言。

- 首次全测发现AssistantInfoCache的按钮查询也用于“不存在”负向断言，不能让查询helper强制存在。已保留该查询可返回undefined，仅在正向点击/属性读取处校验；10项定向及完整2171项复验通过。首次2170通过/1失败没有当成成功。
- 最终137文件2171项全量单测、应用类型检查通过；38文件AST归一化核对原业务body/断言保留。
- 真实ESLint逐规则比较仅减少152处非空断言，其它计数不变；未宣称全仓lint通过。没有外部业务访问或部署。

## 阶段十四：E2E前置值与严格类型（2026-11-03）

9个业务spec的71处非空断言清零：69处Node侧使用`requireFixtureValue`，2处浏览器localStorage读取在evaluate闭包内部校验，避免将Node helper带入浏览器。保留业务标题、skip条件、真实API及资源归属守卫，并修复两处既有nullable namespace参数类型错误。

- 所有原业务语句与测试标题经AST核对保留，新增检查仅拒绝缺失前置值，不输出前置值内容。
- helper7项回归通过，合并既有cleanup helper共18项通过；新helper/test定向lint零错误和警告。
- 9spec与依赖helper在strict/noUncheckedIndexedAccess/ES2022/Bundler的真实TypeScript program中零诊断。
- 同一配置下定向ESLint555→484，唯一规则变化为71处非空断言清除；Playwright收集29项/9文件，仍不把收集当实际浏览器验收。
- 当前产品构建11项通过；浏览器改动需以新固定三仓源码CI实际验收。没有改skip以绕过测试或访问生产。

## 阶段十五：剩余SFC顺序与请求测试检查（2026-11-03）

- FormDesign、Instance、ProcessDesign剩余3处SFC区块顺序统一；使用真实Vue脚本及模板编译证明运行代码相同，样式/块属性不变。至此block-order和组件模板命名这两类历史错误已清除。
- SystemWelcome与MonitorOnDutyGroupTable的4处类型排列规范化，只接受简单union/无重复属性签名；实际compileScript再TypeScript输出JavaScript保持相同，bindings/模板/样式不变。另10个文件因Vue运行时props顺序会变化而拒绝批修，保留可见技术债。
- 请求账户隔离测试最后1处非空断言改为明确前置请求配置存在性检查，缺失直接失败，不再把缺失配置spread成空对象后继续测试。
- 相关5文件54项测试与应用类型检查通过。产品11项构建已覆盖这些SFC修改；最后账户改动仅为测试，未重复构建。全仓lint将由下一阶段统一实扫确认，不以局部检查宣称全绿。未访问生产。

## 阶段十六：已清规则的CI回归门禁（2026-11-03）

新增`pnpm check:eslint-boundaries`并接入Verify工作流。使用真实根ESLint配置扫描全仓，严格拒绝已清四类：`@typescript-eslint/no-non-null-assertion`、`no-empty`、`no-undef`、`no-unsafe-finally`。任意解析/工具错误、无配置诊断或空扫描也失败关闭；不输出诊断正文或源码。其它遗留诊断保持原规则和计数，脚本明确声明不能代表full lint通过，没有建立旧错误白名单、债务基线、ignore或关闭规则。

- 真实门禁扫描1085文件，四类现有启用范围诊断0，解析/工具失败0；完整结果仍**11430 errors、5 warnings**。
- 13项回归验证真实配置中各类拒绝、parser/tool异常、空扫描与配置缺失；新脚本/test定向lint零错误/警告。
- 整合全量139文件2191项单元测试通过。此前11项产品构建证据保持原范围，本阶段只修改工具、CI及回归。
- **覆盖边界**：现有JS/TS配置关闭no-undef，需各自类型/运行检查补充；SFC尚未启用TS非空断言规则。额外TS AST盘点发现33个Vue脚本仍106处NonNullExpression，此门禁不代表全代码不存在该语法，下一阶段按模块修复后再统一SFC规则。


## 阶段十七：声明式组件属性拼写统一（2026-11-03）

28个非Prometheus SFC的473处属性规范为连字符，仅选择应用实际注册的AntD组件且真实声明的14种props。跳过v-model、onX处理器、未知或局部遮蔽组件、无声明props的TableColumn占位组件及过期位置；没有调整模板求值次序。脚本/样式字节相同，模板AST只允许目标prop拼写差异，真实模板重新编译无错。

- 初审用实际Vue SSR验证14prop各10种输入的规范化结果相同；独立复查实际AntD4.2.6六组件在JSDOM挂载、初始化及两次响应式更新，真实patchFlag=8/dynamicProps路径的props和DOM一致。清除按钮/Select标签、Modal取消、Table行数、Descriptions样式均有行为断言；没有声称真实浏览器焦点/动画已经验收。
- 全量139文件2191项单元测试、应用类型检查、11项产品构建通过。
- 28文件真实ESLint逐规则比较唯一变化为attribute-hyphenation507→34，减少473；其他规则不增不减。全仓仍有遗留lint债，后续统一扫描记录，未改规则。

## 阶段十八：快捷键存在性与响应式（2026-11-03）

全局搜索和用户菜单3处SFC脚本非空断言改为明确的响应式布尔getter，快捷键引用不存在时保持未激活，不以强制断言继续传递。保留搜索、退出、锁屏各自的现有偏好开关及回调。

- 布局包现有3文件8项测试、应用类型检查通过。
- 用项目实际VueUse11.3.0和Vue3.5.42在JSDOM验证Ctrl+K、Cmd+K、Alt+Q、Alt+L：两次按下/释放、重复keydown不重触发、旧/新watch source回调次数一致、effectScope清理后不再响应。缺失ref不触发。模拟事件按浏览器独立事件任务逐次flush；首次探针未flush修饰键事件导致两种写法均不触发，修正探针后复验通过，不算产品回归。
- 这3项此前不在SFC TS规则作用域内；属于修复语法盘点盲点，不冒记成完整ESLint现有错误下降。没有更改热键库或引入依赖。

## 阶段十九：预测与RCA数值/索引检查（2026-11-03）

4个SFC脚本清除13处原TS规则未覆盖的非空断言：准确率、成本和缓存命中率先明确number及有限/范围边界，再格式化或比较；保留零值、阈值和未知展示合同。看板在清除旧状态之前捕获并确认4个指标的非null快照，API使用已收窄标量；预测和诊断的结果索引先检查指标/步骤标签存在，内部定义不匹配时明确失败，不写undefined键或标签。

- 预测/RCA共8文件53项测试通过，应用类型检查通过；最后仅调整纯快照解构的字段顺序后两项复验也通过。
- 四文件真实ESLint逐规则计数与HEAD完全相同，没有新增诊断或规则调整。这13处属于SFC语法盲点收敛，不能记作现有lint诊断下降。
- 未对全量或产品构建做重复声明；下一次整合冻结后统一执行。没有真实模型/RCA服务访问。


## 阶段二十：有界静态表格列配置排序（2026-11-03）

28页266个纯标量列对象按现有规则排序，列数组次序和值保持不变。仅接const直接数组、脚本没有其它引用、模板直接绑定真实a-table且现有slot只读column.key/dataIndex的白名单；排除Prometheus、三个回滚页面、含sorter函数的ClusterRoleBinding及其它动态/外逸配置。

- 安装AntD4.2.6会把原列对象通过__originColumn__交给slot，因此对象键次序并非普遍无语义。逐页确认当前slot不枚举键；实际28页原/新真实列、代表行及当前完整slot的SSR HTML相同，Object.keys负对照确实产生差异。页面helper/权限为隔离fixture，没有初始化外部API，不当作业务端到端。
- 主代理再次运行源码及SFC编译AST证明，只有选定对象属性排列差异；模板与样式字节相同。真实ESLint减少426条sort-objects，其余逐文件规则计数完全不变。
- 13相关文件356项测试和应用类型检查通过；SSR原/新均出现4条已有fixed-left列警告，保留数组次序而未顺带改列布局。没有宣称本阶段全量或浏览器已复跑。

## 阶段二十一：告警确认与记录规则回执隔离（2026-11-03）

MonitorAlertEvent/MonitorAlertRecord清除10处SFC脚本隐藏非空断言，并修复实际操作竞态：正safe-int ID及账号必需；确认绑定原用户与authGeneration，旧确认不能借新身份执行；详情读取按窗口世代拒绝乱序/同记录关重开，写回仅更新原ID及原窗口。同记录新旧写入各有ticket，旧成功/失败不覆盖新动作或新详情。动作不再finally清空列表请求的loading。

主代理复查补一次性确认消费：同一onOk在pending/成功/失败后均不能再次外发；新确认可以重试。mutation Map仅在finally匹配自身ticket时删除，不动更新的ticket，不累计已完成记录，也不在finally return/throw。

- 新42项真实组件/延迟Promise场景+原列表37项+请求通知scanner23项，最终102项通过；应用类型检查通过。
- 当前失败提示、Abort静默、账号切换/sameUID重登、A/B及同记录详情世代、旧删除回执、完成顺序和列表loading独立均覆盖；2010个Unicode/长字符串头像颜色新旧一致。
- 模板/样式字节相同、旧模块import相对次序保留；生产ESLint132→128且逐规则只下降，新测试零错误/警告，四protected类别0。没有扩大SFC全局TS规则或调用真实Prometheus。

## 阶段二十二：设计器字段完整性与收件箱ID（2026-11-03）

FormDesign/ProcessDesign/InboxNotification清除6处隐藏的SFC非空断言。收件箱按具体操作分支再次收窄合法ID，readAll独立；流程设计computed先捕获已选步骤再遍历，避免回调重复强读可空ref。

表单移动修复真实数据完整性问题：旧逻辑只校验目标位置，负数/过期/小数原索引可能把undefined写回有效字段。现在源/步长须safe-int且源/目标均存在，确认后才交换完整字段和推进导入版本；无效移动不写草稿。

- 新增真实下移控件保存顺序及六种非法/过期索引不丢字段回归；与流程设计/收件箱共3文件22项通过。
- 应用类型检查通过，没有新增as/非空断言替代。实际API创建/已读/删除仍由隔离替身接收，没有真实写入或部署。
- 全量及构建待下一次所有写入方冻结后统一复验，未将局部结果称为全量通过。

## 阶段二十三：用户角色窗口及权限回执（2026-11-03）

SystemUser角色读取/分配/移除清除4处隐藏非空断言。窗口打开先清旧角色并显示loading；合法用户/角色safe-int、UID/authGeneration、窗口/读取/action世代及实时权限共同绑定目标。A/B详情、关闭重开、sameUID重登、卸载或权限撤回后的旧成功/失败不填新窗口；读取失败阻断角色写入。动作串行，后续角色刷新、列表/统计及loading各由原操作/请求持有，不重读currentUser作为已发动作参数。

- 新43项真实SFC+AntD延迟场景，连同SystemRole与请求通知scanner共71项通过；应用类型检查通过。
- 生产文件ESLint79→76且其它规则无新增，新测试0 errors/0 warnings；4项SFC语法未在旧规则作用域，未错误计入诊断减少。
- 故意NaN ID负例会产生Vue invalid-key warning，保留真实记录，不宣称测试输出零warning。没有真实权限变更；其它用户CRUD工作流不在本阶段重写范围。

## 阶段二十四：Kubernetes回滚与版本历史闭环（2026-11-03）

Deployment/DaemonSet/StatefulSet回滚不再从确认时已变化的ref重读目标：捕获合法cluster/revision、原样name/namespace、UID/authGeneration、筛选条件及历史窗口世代，重复/取消/过期确认不外发，迟到回执不关闭或刷新新窗口。保持三类API各自原请求字段差异。

审查发现仅确认隔离不足：旧历史A可迟到显示为B的revision，因此同阶段限定修改三个业务.ts的history show/close链，复用共享历史scope。历史读取清旧数据、绑定原目标及会话，乱序/同资源关重开/卸载不更新新窗口；独立historyLoading不影响其它CRUD，sameUID重登后旧已加载历史不能用于新确认。三个.ts其它CRUD AST核对未改。

历史读取与回滚捕获共同拒绝非法路径段：非空且原样无首尾空白，禁止斜杠、反斜杠、?#%、ASCII空白/控制及DEL、单独点或双点；不是完整Kubernetes DNS命名schema。错误不回显目标值。

- 新399项真实SFC/history/Fake客户端回归及相邻资源/表格/scanner等119项，共518项通过；应用类型检查通过。
- 路径矩阵覆盖name/namespace及三类页面、正常点号/横线合同；目标/账号/会话/筛选/窗口切换、旧成功/失败/finally、重复与取消确认均验证。
- 新共享模块/测试ESLint0/0，6生产文件逐规则计数不增加，差异检查通过。本阶段未扩大SFC全局TS规则，13处原script非空断言清除。
- 已发出的远端操作不能靠忽略UI回执追溯撤销；测试全部Fake，没有连接真实K8s、执行真实回滚或上线。全量与构建另待统一冻结复验。

## 阶段二十五：统一同色盘头像函数（2026-11-03）

五个已有相同色盘页面复用`utils/avatar-color.ts`，删除重复数组/哈希实现，收敛FormManagement、LocalResourceManagement、TreeNodeManager三处隐藏非空断言；已修告警两页也使用同一纯函数，不改变其动作逻辑。只合并这五个已验证完全相同的色盘，不把其它业务色盘强制混同。

兼容性保留UTF-16 code unit哈希，使用ES2015已有的charAt/codePointAt读取单个code unit，不能改为for-of整码点而改变emoji颜色；没有引入String.at的新浏览器要求。固定中文/组合emoji/空串/长名字等9项颜色合同通过，另和五个原函数做10050次Unicode/长字符串结果比较一致。

- 模板/样式字节相同；首次普通Prettier引入的顺带模板换行已撤回，只保留脚本函数/导入重构。
- 相关5文件123项测试及应用类型检查通过；helper与新测试ESLint0/0，五生产文件逐规则唯一变化为prefer-code-point5→0，没有增加其它诊断或规则豁免。
- 未重复声明产品构建/全量已跑，下一次检查点统一验证；没有真实服务调用。

## 阶段二十六：工单分类交互与保存快照（2026-11-03）

Category按合法safe-int ID、UID/authGeneration及交互票据隔离view/edit/启停/delete；详情响应必须匹配目标ID，打开窗口即提供可取消loading，读取未完成不能提交。表单在validate前捕获引用、模式、ID及字段快照，每个await后复核；旧成功/错误/finally不操作新窗口，列表刷新/分页读取各有请求归属。

删除确认绑定原ID/name，只消费一次；主代理复查纠正失败catch重置消费标记的遗漏，pending/成功/失败后同一callback都不再外发，新确认可重试。本页确认框在新交互、取消、换账号及卸载时仅销毁本页实例。修复防抖onCleanup，避免卸载后旧timer发起读取；头像复用公共函数。

- 新31项真实SFC+AntD/Mock回归，连原Process/scanner共58项通过；应用类型检查通过。
- 生产ESLint33→26且其它规则无增，新测试0/0；清除6处隐藏SFC语法，未扩大规则作用域。
- 有意NaN ID反例有Vue invalid-key warning，未隐藏。Process尚未修改、真实工单API未访问，全量/构建另待整合检查点。

## 阶段二十七：监控配置与告警规则表单闭环（2026-11-03）

MonitorConfig补齐原先模板存在但脚本未声明的FormInstance引用并强制validate；MonitorAlertRule不再以optional validate在缺ref时继续。关联/目标safe-int、类型/级别/状态等明确enum在外发前验证；窗口busy、防重及owner/authGeneration/字段fingerprint覆盖验证等待、关闭重开与每个await回执。Rule同步填表再门禁关联预加载，选中项与慢分页合并；PromQL提示仅写原窗口及原表达式；delete确认一次消费。保持已有API路径、enableSwitch/labels及字段合同，Rule复用头像函数。

独立审查补两项实际遗漏：Config有效打开create/edit会失效旧详情读取，不让A旧详情盖住B编辑；status严格数字1/2，非法或缺失值不提交。类型/枚举不靠类型断言充当运行校验。

- 新89项真实控件/延迟场景，连原列表与scanner共149项通过；含真实AntD必填验证、真正dropdown触发的慢第一页及view→edit/create/关重开反例。
- 两生产文件ESLint71/66，新测试0/0，四protected类别0；13处script隐藏断言及额外1处模板断言清除。
- 所有写入方冻结后的整合检查：146文件2867项全量测试、应用类型检查、11项构建通过。完整扫描1094files仍10503 errors/5 warnings，protected/parser/tool0，SFC语法盘点剩12文件33处，不宣称lint全绿。
- 整合首轮3个CMDB旧fixture缺少新会话依赖而失败，补同principal依赖后完整复跑2867通过；未将2864/3failed算作成功。没有真实Prometheus操作或上线。

## 阶段二十八：云账户动作、表单归属与导出

云账户delete/status/verify绑定合法ID/provider、UID/authGeneration、原列表及详情代；确认一次消费且实时核对权限，状态每ID最新票据只回写原行/原详情，旧成功/错误/finally不影响新动作。列表/详情读取补owner归属，避免旧列表借新身份开启动作；凭据窗口复用既有closeForm及formRequest作废/清空，validate/API前后另核对formOwner，未改create/update凭据payload构造。

CSV要求当前listOwner并显式检查首行，中文列名、顺序和值映射均保持。验证仍需显式确认、启用状态与权限；没有自动触云。原“取消后重开验证”测试改为选最新确认按钮，拒绝点击退场旧弹窗回调，不删除原覆盖。

- 新61项安全回归、原52合同及scanner23共136项通过；补旧CMDB同principal依赖后连12项为148通过；type通过。CSV及凭据payload initializer做独立AST比对相同。
- 整合首轮2864通过/3CMDB失败及3unhandled来自旧fixture未初始化新依赖，最小补7行store/auth mocks且原12项测试AST/断言/请求模拟保持；随后完整146文件2867项、类型检查、11项构建全部通过。
- 新Safety lint0/0，生产SFC与CMDB fixture各规则计数不增；清除2处隐藏script断言。完整门禁1094files的四protected类别及parser/tool0，遗留10503 errors/5 warnings没有隐藏。
- 测试全部Mock云账户/验证接口，没有真实云、模型、通知或生产操作。票据只隔离前端回执，不宣称撤销已发出的远端操作。

## 阶段二十九：会话世代响应式与历史loading收尾

私有authGeneration改为ref，外部getter仍返回number且不进入Pinia持久化state；login/logout/$reset原先先递增世代、再清用户/token的执行顺序不改。真实Pinia action包装不阻断Vue依赖跟踪，同UID仅世代变化也能及时触发窗口/历史失效。已逐个检查现有相关owner-watch只clear/close，不会由该响应新增HTTP/refresh或logout循环。

独立审查复现旧实现的两项P2：纯epoch变化不触发watch，已加载history仍显示；读取中旧结果虽被拒绝，loading却可能不收停。现在真实reactive epoch主动失效，兼容非响应式适配器时旧read完成也仅在仍占ticket且owner失效时close，不清新ticket。保留所有消费者的显式epoch检查，没有把UI失效当成远端取消。

- auth16+history/SFC405及请求/路由/Scope/table/scanner等，764项定向通过；其中真实Pinia getter同步watch、原时序、数字签名、state不持久化epoch均有回归。
- 四个owned文件逐规则lint无新增，shared/tests0/0；全仓四protected/parser门禁通过，原lint债另行记录。
- 根在其它模块收口后再次完整应用类型检查通过；全量/构建将在下一整合冻结点验证，不以本阶段定向数冒称全套。

## 阶段三十：流程编辑、状态与提交快照

Process清除7处不安全ID，编辑缺ID不能退回create。真实BasicConfig.validate必须返回true；validate前捕获表单引用/模式/深复制definition与tags及字段fingerprint，每个await后复核UID/authGeneration、交互与提交票据。详情/4类status/default操作/自有删除确认分别持有原目标及loading，one-shot不借用新窗口。关联分页及BasicConfig子实例按交互key隔离，不让旧选项回执污染新窗。

根复查发现structuredClone是新的生产浏览器依赖，与现有目标不匹配；改用仓库已导出的泛型cloneDeep/toRaw，无新依赖。保留JSON定义与完整payload合同，并补全局structuredClone缺失时create/edit仍成功及深复制隔离。兼容补丁合并的一处重复import被编译拦下，去重及去除重复测试后完整复验，不把失败版本当完成。

- 新51项真实SFC/AntD及实际BasicConfig回归，连旧Process/Design/scanner共83项通过，类型检查通过。
- 生产ESLint85→37，各规则无增；新Safety0/0，旧Process测试只补真实Pinia/auth依赖，没有删原4项业务断言。
- 第二次统一冻结：149文件3069项全量、类型及11项构建通过，四类lint门禁0/parser0。完整lint仍10443 errors/5 warnings；SFC脚本剩11，不宣称全部清零。没有真实工单提交或部署。

## 阶段三十一：采集Job/Pool真实校验与凭据快照

两页原来template有formRef但脚本无声明/未validate，现补真实FormInstance与动态必填；safe ID/enable枚举、UID/authGeneration、窗口/详情/关联分页及字段fingerprint覆盖每个await。delete/status确认及回执不借新身份/新行，Pool不再硬编码user_id=1而使用已验证当前数字UID，字段仍保留以免Go更新owner成0。Bearer仅通过原helper构造，旧掩码不回填/重传，保留/替换/清除合同与owner清理均验证，错误使用固定脱敏文案。

规则按实际Go合同收敛：Job名1..50；Pool interval/timeout按已有服务规则>0且timeout<=interval；独立port允许0或1..65535整数，Job timing/refresh及remoteTimeout合法0不盲拒。Static地址保留单主机/IP、host:port、IPv6及显式0端口原文，不重写payload；拒绝scheme/path/query/fragment/凭据/空白/坏格式，纯解析不进行DNS/HTTP探测。提示说明嵌入端口原样优先，避免新真实validate将旧合法host:port误拒。

- 新116项Safety及原凭据7、列表37、scanner23共183项通过，类型检查通过。两页生产lint逐规则无新增、合计减少10；newSafety0/0。
- 清除8处隐藏SFC断言。声明清理中dispose hook曾被误移块外，4个真实unmount红测试与unused import共同发现，按精确AST恢复；最终每页真正script内唯一hook、块外仅空白注释、真实script/template编译及CSS字节不变均确认。
- 列表仅这两页旧原始异常文案断言改为固定脱敏expectedFailure，原错误区/清旧列表/重试/请求及其它7页断言保留。
- 最终149文件3069项全量、类型/11构建通过。没有真实Prometheus、K8s或云连接，未将临时脚本错误或中间失败算作验收。

## 阶段三十二：CMDB只读边界与地域查询确认归属

收敛4页7处隐藏script断言及树模板额外1处：托管云未知操作标记单次捕获合法owner，匿名不读写本地标记且保持保守阻塞；资源CSV显式首行guard，原列顺序不变；树节点选择必须合法safe ID且详情ID匹配，取消选择立即清loading，旧详情不能恢复选择；地域metadata单次Map读取，保留project_id显式空值并省略缺失值。

额外修复地域查询子组件的真实P1：其全局确认框独立于父凭据窗口，旧确认须绑定UID/authGeneration、account/provider与权限/启用/禁用状态。多getter同步watch只在身份或关键props真正变化时失效，单纯同UID profile刷新不取消；自有Modal在取消/卸载/作用域变化销毁且one-shot。请求前后及匹配ticket finally确保旧结果/错误不覆盖新查询，非响应式适配器旧读也只自清。完成后的退场旧cancel也不能清掉已采纳结果。没有自动查询、使用未保存密钥或真实云请求。

- 新16地域安全/metadata、6节点非法ID/取消loading、1匿名标记回归；连相关9文件共259项通过。最终样式/控制分支整理后73项重点复验也通过，类型检查通过。
- 新地域test lint0/0；4生产文件逐规则唯一变化为import间距/新纯导入位置规范化，sort-imports29→26，没有重排旧value imports或新诊断。模板只改指定null/disabled表达式，styles不变。
- 与其它已冻结阶段统一149文件3069项、类型/11构建通过；全仓1097文件仍10443 errors/5 warnings，四protected/parser0。下一阶段仍有11处SFC script语法未受原TS规则覆盖，不能以现门禁冒称全源码无断言。未上线。

## 阶段三十三：值班显示缓存与告警池头像

移除3处SFC脚本断言：告警池的相同8色盘复用公共头像函数；值班表保留原有6色盘业务差异，仅明确检查索引；用户名缓存单次读取并区分缺失与合法空字符串，不强制把undefined当string。没有修改这两页的CRUD或排班接口。

- 相关值班表/列表/公共颜色3文件50项及应用类型检查通过；6色盘新旧2010个Unicode/长字符串比较相同。
- 该阶段采用模块验证，前一3069全量及11构建保留原范围，没有伪写为本次重跑。未做真实排班或告警池写入。


## 阶段三十四：澄清注释中的完成态示例

六文件仅把错误提示/CSS变量/模块导出示例的模糊占位文字换成明确中文或具体token示例，消除7条把示例误认成无期限任务的expiring-todo诊断；真实验证码发送TODO仍保留，未冒充功能实现或关闭规则。

- 六文件移除注释后实际TypeScript输出JavaScript逐字相同，定向ESLint中expiring类0，差异检查通过。
- 这是注释调整，未新增镜像实现的测试或声称业务测试全套重跑；同名CSS示例没有改变任何实际变量名称。

## 阶段三十五：调班表单与窗口归属

调班提交使用真实 FormInstance 校验，绑定账号世代、组、窗口、记录和字段快照；旧读取、校验或写入回执不能修改新窗口的内容或 loading。日期切换清除原值班人，不以 today_user 推断未来日期，日期仍按本地 YYYY-MM-DD 提交。用户选项独立分页，保留原接口合同与错误提示边界。

- 新33项真实 SFC/AntD 回归，连列表37项、请求提示扫描29项共99项通过；应用类型检查通过。新测试 lint 为0，生产文件原有111条诊断降至106条，各规则无新增，移除4处脚本非空断言。
- 本阶段仅覆盖调班流程；未宣称其它值班组 CRUD 已完成安全收敛，未访问真实排班服务或上线。

## 阶段三十六：通知配置校验、详情与删除归属

通知创建/编辑提交前调用真实表单校验，并捕获账号世代、窗口、模式、字段快照；校验后的变更不能借旧结果提交。详情须匹配请求 ID，删除确认一次性消费且绑定列表和当前窗口，旧回执不能关闭新窗口。保留历史触发配置、幂等字段及接收范围合同，脱离响应式数组构造提交数据。

手动通知邮箱基础校验改为线性字符串检查，保持原来 trim 和基础邮箱语法；隔离实测旧正则在恶意长域名上出现回溯，新增固定语料和实际 helper 的限时长输入检查，不扩大为 RFC 邮箱认证。

- 新38项通知安全用例；本次通知/接收范围/扫描及邮箱6文件114项通过，开发阶段另含调度合同的133项定向通过；应用类型检查通过。邮箱15项语料和1项长输入测试包含在本次114项中。
- 新安全及邮箱测试 lint 为0，既有目标逐规则无新增；移除2处脚本及1处模板断言。请求提示扫描补正反例，不扩大白名单。
- 手动发送、测试发送和状态操作尚待下一阶段单独收敛；本次没有真实投递邮件、飞书或站内消息。

## 阶段三十七：模板可空值的读取与显式写入

Cron 参数和 Pod 资源输入移除模板非空断言：读取允许缺值，输入事件先检查类型和当前对象/索引，再写入原字段。Pod 只在实际输入时按已有默认结构初始化资源，不在渲染时修改数据。预测卡片使用稳定的 prediction 视图字段；RCA 命中率显式检查有限数值与范围，不将未知值显示为0。

- 相关预测、RCA、Cron、Pod 与共享表格15文件185项通过；最终输入格式调整后2文件7项复验，类型检查通过。生产四文件及修改的 Cron 测试逐规则诊断未增加，新增 Pod 测试 lint 为0。
- 独立审查确认4个资源字段映射及原 payload 默认结构保持；去除8处模板断言，未改变样式、接口或缺值的业务意义。完整 SFC 语法门禁将在下一阶段接入，不能以原脚本门禁宣称已覆盖模板。

## 阶段三十八：测试 Promise 能力与声明运行时一致

15个测试文件的47处 Promise.withResolvers 改用共享 createDeferred，基于原生 Promise executor 保持 resolve/reject、thenable 同化与微任务顺序，不要求新增静态 API；避免仓库 .node-version=20.14.0 与测试依赖能力不一致。其它通知测试由下一阶段处理，不宣称本阶段全部替换。

- 辅助函数4项与受影响测试共16文件288项通过，应用类型检查通过；helper 在实际 Node18.17 的独立脚本中也验证 resolve/thenable/reject，这不等同于应用支持 Node18 或完整测试在 Node20 执行。
- 新 helper/test lint 为0，15个测试逐规则无新增。去除新增导入并反向替换调用后的 TypeScript AST 与原文件相同，原业务断言未更改；未重排旧导入或升级依赖。

## 阶段三十九：数字常量格式

15文件19处十进制常量补数字分隔符，长条件按既有 Prettier 格式换行；只修改字面量写法，不调整数值、限制、超时或执行顺序。保留会改变编译文本形态的十六进制项供后续独立处理。

- 真实 TypeScript/SFC 编译检查确认项目 ES2015 目标下14文件输出逐字相同；另1文件条件换行改变了编译文本排版，编译后 AST 的节点、数值与控制流相同，样式保持。目标 numeric-separators 诊断减少19，逐规则无新增；未为纯格式变更添加重复业务测试，未声称全套回归重跑。

## 阶段四十：保持运行时代码的类型导入整理

整理12个文件的导入空行与纯类型导入位置，减少17条 sort-imports 诊断。筛选严格使用仓库的 verbatimModuleSyntax=true，TypeScript/SFC 编译后的脚本、模板、样式及自定义块输出须逐字相同；96个会改变输出的候选跳过，保留值导入的执行顺序。

- 12文件逐规则诊断无新增，真实编译输出对比通过。此阶段未修改业务逻辑或增加依赖，没有将被跳过的排序债计为完成，也没有重复声明全量业务回归。

## 阶段四十一：唯一属性的类型声明排序

26文件的类型字面量按规范排序，仅接受名称唯一、使用普通名称的属性签名。保留联合/交叉类型的顺序、函数与重载、运行时对象及组件宏生成的运行时结构；会改变编译输出或增加其它规则诊断的10个候选跳过。

- 减少102条 sort-object-types 诊断，各规则无新增；TypeScript/SFC 在 verbatimModuleSyntax=true、ES2015 下编译输出逐字相同，应用类型检查通过。
- AST 对比只允许上述属性顺序及属性末尾分隔符变化，字段名称、可选性、readonly、具体类型及其它节点保持；没有借此排序联合分支或重载。未增加依赖或重复业务测试。

## 阶段四十二：通知组目录与表单闭环

通知组的 pool_id 实际关联 AlertManager 实例池，选择器改用对应目录与详情接口，不再借用采集池。保留合法的 on_duty_group_id=0 未关联状态；已有池不在当前分页时按原ID补查，错ID/旧响应不能注入新窗口。创建/编辑执行真实表单校验并冻结字段，账号世代、窗口、列表与关联选项分别持有票据；详情、删除确认及旧finally不能修改新交互。

详情中全部非空机器人 token 统一遮罩，空值显示未配置；编辑字段及原有 PUT token 合同保持，未自动清空凭据或修改既有渠道。

- 新42项真实 Form/Select/DOM 安全回归，连既有列表37项及请求提示扫描29项共108项通过；应用类型检查通过。生产 lint97→51，各规则无新增，新测试0/0。
- **历史数据需在发布前核对**：旧界面保存的 pool_id 可能来自采集池 ID 空间，不能按数值相同自动认定是正确告警池。本次没有自动迁移历史关联或访问真实数据库、AlertManager、通知通道，未上线。

## 阶段四十三：通知发送与状态回执归属

测试发送、手动发送分别持有独立窗口世代和账号归属，发送前冻结目标、渠道、接收人及字段；手动发送调用真实 FormInstance 校验。通知状态按合法ID单飞，shallowReactive Map保留票据身份，旧finally不能清除新请求的loading，旧详情或列表回执不能更新后来窗口。

- 新51项发送安全回归，连既有通知、接收范围、排期、扫描及权限覆盖8组251项通过；应用类型检查通过。新Safety lint0/0，Notification209→208，各规则无新增。
- 使用既有2个发送权限alias并精确更新其未接入快照；U3_SCOPE_APPROVED总开关保持原值，状态沿既有update API权限路径。发送payload仍分别为原测试3字段、手动4字段和状态status字段，不增加notification_id或清除触发参数。
- 旧2个通知测试的3处新版Promise静态调用补为共享deferred，32项复验通过、逐规则无新增且反向AST保留全部原断言；至此原17文件50处调用均已替换。
- 所有消息接口由Fake接管，没有真实投递；前端拒绝旧回执不代表撤销已发出的请求或保证外部通知exactly-once。

## 阶段四十四：记录规则表单、池选择与表达式校验

记录规则新增/编辑要求真实表单实例并校验，验证前冻结字段和labels数组，账号世代、窗口、实例、指纹及独立提交票据覆盖每个await。缺失/非法编辑ID不退回create；池ID与enable校验后才发送，名称统一Go的1..50，IP按后端可选合同允许留空。列表、池查询与PromQL校验分别绑定owner和窗口，搜索一开始就废弃旧池查询，旧finally只收自己的loading；错误固定脱敏。保留原API字段与标签顺序。

独立审查复现重开编辑丢失非首页已选池名称，现只复用该owner/世代下实际读取的缓存或当前record.pool_name，分页仅补当前选中项的权威名称，不混入旧页、不伪造名字、不新增接口。真实Select反例又证实，仅给Form加key仍会复用旧标签：将私有窗口世代改为响应式ref、配合Form key后，跨owner相同ID不再显示旧名字。缓存随owner变化/卸载清空。

- 新35项真实AntD回归，连本轮告警池51、既有行操作42/列表37/提示扫描29，共5文件194项通过；应用类型检查通过。新Safety lint0/0，页面78→73，各规则无新增。
- 零参重试入口与带scope的私有读取函数分离，实际点击测试防止MouseEvent被当回调；旧Action测试只补真实hasPerm依赖，Lists本页只更新固定文案，未删业务断言。字段快照/窗口隔离不表示撤销远端已完成的写入；全部API为Fake，未操作真实Prometheus或上线。

## 阶段四十五：告警实例池与用户选择闭环

实例池创建/编辑要求实际Form验证，窗口、账号世代、字段指纹与独立submitting隔离验证及API回执。详情、删除确认和用户目录查询分别持有票据；用户选择只使用当前目录与当前表单的username。名称、receiver及非空实例按Go合同校验，保留空时长的既有默认语义、标签顺序、原DTO，创建不硬编码user_id。

- 新51项真实组件回归，连列表37/请求扫描29共117项通过；应用类型检查通过，生产lint77→64，各规则无新增，新Safety0/0。
- 根复核移除owner观察器额外发起列表读取，仅清理过渡身份的窗口、私有数据与旧读取；对应回归明确不新增GET、旧reject不toast，保留手动刷新入口。列表旧fixture仅更新固定错误文案，其清理/重试断言完整保留。
- 未连接真实AlertManager、用户服务或数据库，也未部署。

## 阶段四十六：真实SFC语法与不可绕过的保护门禁

新增cloudops/no-sfc-non-null-assertion，真实Vue factory默认error，同时访问script和template的TSNonNullExpression，保留原TS规则。普通逻辑!、!!、optional和显式guard合法；缺parser服务、关闭script parser、表达式解析失败、未配置可审查tokenizer的非HTML模板，以及script/template外链src均失败关闭，不提供危险自动修复。

门禁增加第五保护类，原生suppressedMessages中的保护诊断仍为失败；对含eslint指令标记的实际源文件补审，禁inline config并停用Vue指令后处理的抑制，只把保护诊断和解析/工具故障并回。普通规则waiver及原始lint总数保持其原义；补审必须完整覆盖请求的路径集合，空、缺失、额外或重复结果均失败，不泄露错误原文。

- 55项真实根配置/解析器及分类测试通过，原6fixtures内容和期望保留；配置包类型检查及owned lint通过。增强门禁快照为1111文件、protected/parser0，额外41文件；普通lint仍10178 errors/5 warnings。该快照后补审覆盖校验进一步收紧，未用此结果宣称全lint通过，后续整合再取当前快照。
- 唯一历史保护抑制about.vue的no-undef移除，精确声明实际Vite插件注入的readonly metadata全局。JavaScript/Turbo/Vue中3条已无效ts-expect-error仅删除注释，未修改运行时导入或旧规则。
- ESLint配置包新增typecheck并进入Verify CI；Vite配置工程独立tsc也实跑通过并加入CI，保留原应用typecheck、全量Vitest（含internal tests）、构建及浏览器验证。配置YAML实际解析通过，未升级依赖、变更忽略规则或设置债务基线。

## 阶段四十七：值班组CRUD目标与回执

值班组新增/编辑执行真实Form验证，trim后的名称1..50、描述255、正整数周期与成员ID按Go合同检查，成员顺序及副本保留。响应式窗口世代与Form key分离交互和提交；独立submitting不借用列表loading，校验等待、旧写入及finally不能移到新目标。启停每ID单飞，删除确认one-shot，详情和成员读取latest-only；详情enable=2明确显示禁用。

- 新50项CRUD、原调班33项、列表37项与提示扫描29项在统一218项中全部通过；应用类型检查通过。页面lint106→94，各规则无新增，新Safety0/0。
- 独立审查未发现确定新阻断；保留{}成功响应及已交调班日期/DTO，进入CRUD取消旧调班交互。原错误fixture仅更新本页固定文案，不删除清理/重试断言。
- 原“无效成员”表组曾被Vitest拆成单个参数，已改用真实数组对象并复验；未将误输入当成数组边界覆盖。全Fake，未真实排班或上线。

## 阶段四十八：本地资源表单与已保存身份

本地资源表单必须具备实际Form验证，捕获owner/auth世代、模式、保存ID和字段快照；等待校验时改SSH草稿或认证方式不能提交旧值。响应式窗口key重建表单，关闭/owner变化/卸载清除未保存key/password；同认证留空仍omit保留，主动轮换发送新值，description=''及tags=[]显式清除保持，标签两层复制。详情、删除确认与仅saved-ID终端导航分别核验身份和窗口，不把草稿主机或凭据带进路由。

- 新48项Safety、原contract3/CMDBLists18/提示扫描29，在本轮218项统一验证中通过；应用类型检查通过。页面lint86→84，各规则无新增，新Safety0/0，旧contract只补6行真实store mock依赖，原断言不删。
- 独立审查核对Go更新合同未发现A阶段阻断；补齐一个真正pending detail时卸载的回归，更正原只变generation却命名为unmount的用例，未把afterEach清理算成此场景验收。
- 绑定/解绑四函数AST与原实现相同，明确留给阶段B修复，不宣称该页所有异步流程已闭环。API/Router全Fake，没有连接SSH、云或主机，没有输出凭据payload或上线。

## 阶段四十九：本地资源绑定解绑窗口

绑定与解绑捕获原saved资源ID、owner/auth世代、窗口模式、目录/关联集合及独立选择快照，单窗单飞；取消、切目标/模式、权限或身份变化使旧回执失效。旧success/failure/finally不能关闭新窗、清新选择或解锁新提交；列表与详情刷新只归原scope，详情还校验原对象、detailRequest及ID，避免A完成后误读B。允许真实非叶节点绑定，拒绝非法或不属于当前目录/关联集合的节点。

- 新72项BindingSafety连已交A48/contract3/CMDBLists18/提示扫描29/权限82，共252项通过；应用类型检查通过。页面lint84→84逐规则不增，新Safety0/0。
- 独立审查和72项独立执行无确定阻断；两处fixture的非叶枚举从0修正为真实2后再次72项通过，未将非规范样例冒称真实DTO。A的48用例及原contract未改。
- 全部API替身，无SSH/云连接；窗口失效只拒绝旧回执，不撤销已经发送的远端写入。

## 阶段五十：可视化本地演示环境

新增显式demo mode：仅本机开发serve切换到独立loopback演示API，普通dev/build/preview保持原上游；补optional ConfigEnv与isPreview边界，防止preview使用demo却隐藏提示。认证与白名单业务数据由本地Go处理，K8s、云、AI及首页指标合成；头部/登录页常驻演示标识，首页来源文案不再称合成指标为真实主机采样。未覆盖、外部执行、SSH、通知等明确拒绝，不伪造写成功。

- 27项Node专项进入Verify CI；真实SDK配置模式矩阵含preview，合成/拒绝路径断言零上游。完整Vitest163文件3560项、三类类型检查、11项构建通过；五保护类/parser0，普通lint仍10164 errors/5 warnings，未隐藏。
- 57静态叶路由逐页打开无JS异常；一次profile401刷新后恢复，未谎报零HTTP错误。四指标预测曲线及RCA降级示例实际点击验证；动态终端及真实执行不在验收范围。
- 同步后端有88条本机幂等业务样例、4条演示进程内收件箱；真实消息账本和任务队列未伪造。新增角色无API授权、用户冻结、无凭据、内置/用户Cron禁用。恢复工具只支持已准备环境，不声称fresh安装。
- 两条无真实handler的旧写路径移出白名单，拒绝回归通过；API静态清单475含重复/动态限制，不能作为全接口实现证明。详见scripts/demo/README.md及docs/demo/taste-contract.md。没有发布或上线。

## 阶段五十一：数值写法冲突收敛

终端UTF-8边界与两份Secret测试的7个数值改用等值十进制写法，解决Unicorn要求大写hex、Prettier又要求小写hex的真实冲突。不改规则或添加豁免，不触碰regex、string escape、keys、imports或类型。

- 全TS AST节点及数值一致，全部非numeric原文逐字保留；3份现成测试187项通过。number-literal-case减少7、numeric-separators-style减少2，各规则无新增，总诊断30→21，剩余其它债保留。
- 仅数值写法变化，没有新增镜像测试、整体格式化或重复声称业务全量重跑。

## 阶段五十二：保持值导入顺序的纯类型整理

26个生产文件（17TS/9Vue）仅移动独立import type声明及对应空行。值导入、混合导入的内容和相对顺序保持；不移动声明自身成员或类型/联合/交叉分支，不套用会改变模块执行顺序的whole-sort。

- sort-imports减少31，逐文件全部规则无新增；TS5.9.3/Vue3.5.42在verbatimModuleSyntax=true、ES2015下真实TS或Vue script/render输出逐字相同，模板、样式、自定义块及非import声明文本保持。
- 18文件300项现有测试与应用类型检查通过。7个带注释/非连续/无收益候选明确跳过；不增加测试、改规则、扩大ignore或设置基线来追数量。

## 阶段五十三：移除无消费者的旧API聚合

删除私有应用中无业务/类型消费者的旧tree.ts，以及认证barrel中唯一的旧模块export。607行旧模块包含25函数、40独立接口（51声明，其中11重复合并），不是活跃TreeNodeManager使用的现代tree_node。认证其余export和现代接口保持，不为不存在的旧URL增加兼容层。

- 全repoAST检查覆盖显式import/export、namespace、动态glob及脚本：只有barrel链接，没有旧导出调用；活跃树页面实际使用正确PUT/DELETE。
- 类型检查、9文件191项请求/登录/路由测试、27演示专项及真实生产构建通过。旧模块仅减少1条lint，不夸大收益；barrel原有6条不增。
- 演示静态扫描随死模块移除25声明，去掉旧file的6个重复白名单并保留现代条目；450声明=106本机Go/125合成/219拒绝，仍不是全接口实现证明。仅清理死模块/误导扫描，不宣称修复线上业务故障。

## 阶段五十四：告警规则目录实体

告警规则选择器由AlertManager目录改为真实ScrapePool；分页、搜索和离页已选项详情全部一致，保留原窗口/owner票据、其它payload和字段名。下拉打开时读取第一页，不因仅有已选项而阻断目录，分页进度不把额外selected项当真实页行。

- namespace9+原FormSafety89/Lists37/scanner29共164项及类型检查通过，新测试0/0；页面71→70，仅import类减少无新增。原Safety仅3处endpoint fixture迁移，全部断言保持。
- 后端同阶段service/DI与实际Wire验证使用不同ID的Alert99/Scrape7，阻止错实体保存。旧pool_id不自动按数字相同转换，发布前需人工核对；未迁移数据库或调用真实集群。

## 阶段五十五：API目录编辑与权限回执

API管理使用明确create/edit模式和响应式窗口key，真实必需Form、owner/auth世代、目标及字段快照覆盖验证和API等待。表单/查看切换统一失效旧交互，列表与统计独立latest-only，同记录访问权限与删除互斥、确认one-shot。失败rollback仅回仍owned同row，提示/刷新另受查询scope约束，避免只改未提交搜索输入就留下假成功状态。Owner观察器只清理不自动GET。

- 保category0/undefined与现methods1..4；已有is_public0按私有展示，普通编辑明确规范为2，不自动公开；新请求只接受1/2。未修改Go DTO或504条真实目录。
- 原31项保留、补4红共35新Safety，连Role5/coverage82共122项、全类型及owned lint通过（原33→0）。独立4反例针对新版本再执行全部转绿；外置复制的旧31有一条仍假设watch自动刷新，未据此改坏生产合同，正式用例已显式刷新并保原断言。
- SFC标准块/样式字节保持，新增测试0/0。所有API替身，无真实权限写入；已发请求仅隔离回执，不宣称撤销。

## 阶段五十六：告警标签与注解协议

编辑/展示/提交统一首个等号解析，保逗号、后续等号及合法空值；无等号旧坏条目不自动猜测转换，未改动原样送严格后端要求人工修正，显式编辑/删除后才改变。内部标记不泄漏DTO，只发送string数组。

- 原FormSafety89+5协议回归、namespace9/列表37/提示扫描29共169项通过，类型检查通过，页面70→70各规则不增、新改测试0/0。两处get().exists()类型误用改为保同一存在断言的element检查，未删断言或放宽tsconfig。
- 独立4个first=/空值/旧数据保留删除边界复验通过；未修改Go发布循环或其它模块共享解析函数，无真实数据迁移。

## 阶段五十七：加载更多哨兵的静态属性

12个K8s SFC中30个disabled a-select-option的纯ASCII哨兵由常量字符串`:value`改为静态`value`，只在这些节点内调整所需属性顺序。保留5种哨兵的字符串值、禁用状态、条件和子内容，其余16处未入选绑定不改，不做整文件格式化。

- script/style字节保持，30节点外全部源码逐字相同；仅将目标值属性与属性顺序规范化后，完整模板AST一致。没有移动业务声明、修改事件、动态值、规则或ignore。
- 30组实际属性通过Vue SSR和已安装AntD 4.2.6的convertChildrenToData验证，value值/类型、disabled和key一致；没有访问集群或其他外部服务。
- 12文件定向lint总诊断1054→1024，vue/no-useless-v-bind 30→0，逐文件各规则无新增。剩余1024条为其它既有债，不代表全仓lint通过。
- Task、Pod表单、Secret挂载、workload scope四份现有测试93项及应用类型检查通过；未新增镜像测试、未重跑或冒称本阶段已完成全仓业务回归。未上线。

## 阶段五十八：数字解析函数的全局别名

17个K8s TypeScript文件的19处全局`parseInt`/`parseFloat`调用统一为`Number.parseInt`/`Number.parseFloat`。TypeScript实际符号解析确认原函数与`Number`均来自全局lib声明、没有局部遮蔽；两个入口是相同内建解析函数，保留全部实参、进制及调用时机。未包含有独立强制转换语义的`isNaN`。

- 仅替换19处callee token，并对共享工具中的一条变长表达式做必要换行；其他业务表达式、对象顺序、导入和类型成员保持。
- 17文件定向lint总诊断2271→2252，逐文件各规则无新增，parser/tool失败0。其余2252条是既有债，不代表全仓lint通过。
- Task、Namespace、Pod表单和workload scope四份现有测试91项及应用类型检查通过；没有增加复述实现的测试。无集群或其他真实外部调用，未上线。
- 完整边界检查1129文件通过：5类受保护规则0、parser/tool失败0，额外指令补审41文件；全仓仍10040 errors/5 warnings，继续处理剩余债务。

## 阶段五十九：模板对象的同名属性简写

20个SFC的39处同名属性改为property shorthand，仅包含分页对象的`pageSize`、`total`以及SystemAudit行选择对象的`selectedRowKeys`。不排序属性、不转换method，不包含computed key或`__proto__`，不做整文件格式化。

- script/style字节及39处fix之外全部源码保持；使用各自真实binding metadata、实际scoped设置和同一文件ID编译，20份生产compiled script、完整DOM render和SSR render输出均逐字相同。
- 20文件定向lint总诊断1460→1421，vue/object-shorthand 39→0，逐文件各规则无新增。其余1421条为既有债，不代表全仓lint通过。
- Management、Namespace、workload scope三份现有分页相关测试79项，以及按“审计”筛选的4项真实挂载用例通过；该挂载文件另外24项非审计用例未执行。应用类型检查通过，没有新增镜像测试或重跑全仓。
- 本轮只读分类的324条no-use-before-define均指向运行时变量或箭头函数，类型引用和真正FunctionDeclaration候选均为0，未为压数字移动这些声明。无真实接口、集群或权限数据操作，未上线。

## 阶段六十：Namespace箭头函数的依赖顺序

基于该模块实际依赖图，仅将`fetchNamespaces`和`resetClusters`两个完整const-arrow声明按原相对顺序移到`fetchClusters`前、`clearNamespaces`后。保持同一useNamespacePage作用域、函数种类/名称/声明及函数体原文，所有其它语句原文和相对顺序不变，没有添加断言或改动状态与业务流程。

- AST识别39个顶层箭头函数，完整依赖图无环；两段移动跨越的24条语句全部为纯const-arrow创建，没有ref/computed调用或其它即时执行语句。所需state及clearNamespaces/recordToKeyValueList已在前面定义，创建箭头函数时不会立即读取捕获变量。
- 原模块与实际移动后的导出函数使用真实Vue ref/computed和Fake API比对：factory不发请求；reset先清页码/列表，再读取集群、自动加载首个命名空间、加载更多，以及集群失败清理的请求与状态轨迹一致。页面onMounted在factory返回后调用fetchClusters。
- 现有Namespace测试5项和应用类型检查通过；该模块no-use-before-define 2→0，定向lint总诊断91→89，各规则无新增，其余89条既有债保留。没有新增镜像测试或重跑全仓。
- 这是按真实依赖闭环处理箭头函数的单模块验证，不把2条减少当作原324条全部完成；没有改函数为function声明或连接真实集群，未上线。

## 阶段六十一：生成报告的检查范围

根ESLint配置仅排除`test-results/**`。这是`playwright.config.ts`明确写入、且已被Git忽略的临时报告目录；此前本地两份报告被当作源码扫描，其中JSON报告有3条排序诊断，CI未生成它们。该范围修正不计作源码错误修复，也没有修改规则或排除业务源码。

- 使用真实ESLint路径判断验证：根报告、隐藏报告和其生成子目录被忽略；相邻的`tests/e2e`、`src/test-results`、`test-results-source.ts`、边界工具和根配置仍受检查。
- 根配置lint为0错误/警告，既有29项边界工具测试通过。调用完整边界检查及额外指令审计：1127文件、5类保护规则0、parser/tool失败0、41文件补审。
- 普通源码lint仍9996 errors/5 warnings，包含上一阶段Namespace的2条真实修复；移除生成报告扫描的3条不充作清理成果。新的完整结果已按当前源码采集，本地和CI源码范围一致。
- 本阶段不改应用代码、测试数据或报告内容，没有新增复述配置的测试，也未重跑应用构建或业务测试。未上线。

## 阶段六十二：K8s hook的箭头函数依赖闭环

17个K8s hook按真实scope/symbol依赖图搬移72段完整const-arrow声明，保留函数种类、名称、函数体和同一hook作用域。所有其它statement原文与相对顺序、捕获binding依赖及hook外源码保持，没有移动ref/computed/let或history scope初始化语句，没有添加断言或修改Namespace与非hook的secret-data。

- 五个跨history/computed/具名函数边界的模块额外比对真实导出factory：使用真实Vue及原history helper、Fake API，factory零请求；成功与失败两种流程的构造事件、请求顺序、分页和清理状态新旧一致。边界没有接收或观察被前移的reset函数。
- 17文件定向lint总诊断2337→2241，no-use-before-define 101→5，逐文件各规则无新增。Pod内层SSE和WebSocket两个重连SCC保留原文，仍有createFetchSSE两条及connect三条前引，没有用改函数种类或豁免掩盖循环。
- 全部K8s目录现有26个测试文件1203项及应用类型检查通过；独立AST/源码比对确认72个完整声明、所有其它statement顺序及捕获绑定保持。未新增镜像测试或重跑全仓。
- 这是在已验证合同内完成的批次，不宣称其它域的声明顺序或Pod重连循环已全部修复。全部API替身，没有连接真实集群，未上线。

## 阶段六十三：Pod私有重连入口的可提升声明

真实SSE/WS互相递归仍保留，仅将私有`createFetchSSE`改为同名async function声明、私有`connect`改为同名function声明。两段函数体、参数、作用域、statement位置和初次连接调用点保持，声明外源码逐字相同。沿用已有no-use-before-define的functions:false/variables:true配置，没有修改规则或豁免。

- 实际AST/symbol核对两个入口只有3/4处内部无参直接调用，无binding重赋值、构造调用、函数prototype或反射观察；函数体无this/arguments/super/new.target，私有scope无direct eval。可提升绑定在现有初始化前不被观察，首次I/O仍由原位置启动。
- 原/新真实usePodPage导出函数使用Fake fetch/WS和定时器比对：factory零I/O、返回API key不变；SSE 401刷新、读取和取消，以及WS 4401刷新、重连、发送和关闭轨迹一致，没有剩余定时器或真实网络。
- Pod和流式认证/提示、WebSocket客户端/URL、终端UTF-8分片六份现有测试72项及应用类型检查通过。该文件定向lint249→244，no-use-before-define 5→0，各规则无新增，其余244条既有债保留；没有新增镜像测试或重跑全仓。
- 该阶段明确改变两个私有入口的声明种类以表达真实递归，不把const-arrow批量替换成function，也不宣称消除了重连逻辑循环。没有真实Pod、终端或集群操作，未上线。
- 完整边界及指令审计1127文件通过，5类保护规则0、parser/tool失败0、补审41文件；当前普通源码lint仍9895 errors/5 warnings，不代表全lint通过。

## 阶段六十四：SFC纯函数创建区间的依赖顺序

22个SFC仅在连续纯const-arrow创建区间内搬移73段完整声明。保留声明kind、名称、函数体、script作用域、捕获binding和所有其它statement原文顺序；每个箭头函数前的固定statement序号保持，未跨macro/watch/computed/call或数据初始化边界，不混入其它保留候选。

- 独立核对实际磁盘源码与已审提案相同；script外模板、style及其它原文字节保持。各自真实compileScript的binding分类相同，在同一文件ID和实际scoped配置下，完整生产DOM/SSR render输出逐字一致。
- 22文件定向lint总诊断1635→1552，no-use-before-define 113→30，逐文件各规则无新增；其余1552条诊断保留，不代表全仓lint已通过，也不把本批83条当作剩余221条全部完成。
- 全Web现有165文件3609项测试、应用类型检查及单次build:antd通过（11任务成功，其中10项复用缓存）。没有新增镜像测试或改动测试断言、规则及ignore。
- 宏、watch与调用初始化等更复杂边界及非本批helper未变，没有把所有剩余声明换成function或移动const数据初始化。没有真实接口、模型、集群或权限写入，未上线。

## 阶段六十五：Prometheus固定初始化边界的纯声明顺序

MonitorAlertPool、MonitorConfig和MonitorOnDutyGroupTable三个SFC搬移11段完整const-arrow声明。前两页仅跨无回调的ref、原生Set和let初始化；值班表将fetchDutyGroups声明延后到loadChangeRecords后，使分页reactive数据及被调用函数都已初始化。固定ref/reactive/Set/let、watch和所有其它statement的原文顺序保持，未改变kind、函数体、作用域、捕获binding或模板style。

- 核对Set的真实symbol来自TypeScript全局lib，两处边界输入仅为枚举数值数组；ref/reactive使用真实Vue。固定构造器不接收或观察被搬移函数，Vue生命周期注册本身不执行mounted回调；值班表原watch默认非immediate、onMounted先nextTick的协议保持。
- 原/新真实编译setup使用真实Vue、useListRequest和cloneDeep，在Fake传输及受控时钟下构造请求均为0；受控调用已注册mounted回调后，列表、详情后并行计划/历史/调班读取、对话框动作与失败清理轨迹一致。这是setup/mounted阶段探针，不冒称浏览器或DOM挂载；实际DOM行为另由既有挂载测试覆盖。
- 实际源码比对确认完整声明和其它statement原文顺序、script外字节保持；真实编译binding分类、生产DOM/SSR render一致。三文件定向lint215→200，no-use-before-define 15→0，各规则无新增，其余200条既有债保留。
- AlertPoolSafety、FormSafety、Lists和值班表四份现有真实测试186项、应用类型检查通过；没有新增镜像测试、规则或ignore，也未重复全仓测试及构建。没有真实集群、通知或配置写入，未上线。

## 阶段六十六：工单回调的固定初始化边界

Instance、Notification和WorkorderComments三个SFC搬移46段完整const-arrow声明，no-use-before-define分别31、12、7条归零。保留声明kind、名称、函数体、同一script作用域与捕获binding；所有其它statement原文顺序及模板、style字节保持，没有移动ref/reactive、watch、生命周期或debounce初始化。

- Instance将关闭表单回调延后到formDesignLoading初始化之后；评论将提交回调延后到quotedComment及textarea ref之后。通知列表统计和读取声明提前到debounce之前，菜单声明延后到发送处理函数之后；固定数据初始化保持原位。原watch非immediate，生命周期仅注册回调，defineExpose仍暴露相同两个方法。
- 核对已安装lodash-es的实际debounce构造：构造只创建包装器，不执行用户回调。原/新真实编译setup使用真实Vue与实际debounce源码，在Fake API和受控计时器下，成功/失败六组构造、受控mounted读取、表单关闭及评论expose/open/post/refresh轨迹相同；factory零请求和零timer，搜索499/500ms、直接搜索取消与卸载取消保持。这是setup/mounted调用探针，不冒称DOM挂载或真实通知投递。
- 磁盘源码与提案逐字核对，46段完整声明及其余statement顺序保持；真实compileScript binding分类、生产DOM/SSR render输出一致。三文件定向lint479 errors/2 warnings→429 errors/2 warnings，逐文件各规则无新增；其余既有诊断保留，不代表全仓lint通过。
- 工单目录全部现有12个测试文件260项及应用类型检查通过，覆盖通知权限、取消、并发与失败动作等既有回归；没有新增镜像测试、修改断言或规则，也未重复全仓测试和构建。全部API为替身，没有真实工单、通知或权限写入，未上线。

## 阶段六十七：自有映射值查询与局部字典排序

16个源文件的24处局部字典读取改为共享`getOwnLookupValue`，只返回自有字段，未知的constructor、__proto__、toString和继承getter不再越过原fallback。调用者原`|| fallback`保持，已知值、0/false/空串及key求值时机不变；这是明确的未知键硬化，不把它描述为所有JavaScript环境下完全没有行为变化。

- 使用ES2015已有的hasOwnProperty.call，不引入Object.hasOwn运行时要求。对本批只读、不逃逸、无type反射、无computed/duplicate/__proto__/spread/getter/method且值为primitive的24个对象，建立自有读取后再安全排序151个字段。不对任意对象、列配置、样式或有副作用值机械排序；不承诺Proxy、own accessor或不符合number|string合同的对象key无副作用。
- 仅24处读取、选定字段顺序及16个纯helper导入变化，旧导入声明原文顺序保持。独立TS AST还原排序和guard后，各实际函数与原文相同；已知151键与原函数相同，未知/原型键fallback及24个继承getter零调用通过，ES2015编译验证通过。
- 16源文件定向1372→1307净减65：选中sort-objects减少64，RCA仅新导入位置同时减少1条旧sort-imports，其余逐文件规则不增；helper与测试lint0。Instance和WorkorderComments不在本批，未与阶段66写入交叉。
- 206项关联测试和最终应用类型通过，Root统一全量166文件3619测试、11构建任务通过。新增helper测试直接验证未知键、惰性fallback、同名遮蔽和继承getter，未新增镜像测试。没有改变规则、ignore或调用真实服务，未上线。
- 完整边界1129文件通过：5类保护规则0、parser/tool失败0、额外补审41文件；普通源码仍9682 errors/5 warnings，未全清。

## 阶段六十八：工单分页与筛选回调的声明顺序

FormDesign、Process、Template、ProcessDesign和WorkorderTimeline五个SFC搬移9段完整const-arrow声明，保留kind、函数体、同一作用域及捕获binding。其它固定statement原文顺序、模板和style保持，没有移动data/ref/let、watch或调用初始化。

- FormDesign将关闭、选择和搜索分类三个回调延后到searchTimer初始化后；Process和Template各将分页回调延后到读取函数之后，loadError ref及读取函数原位不变。Timeline的两个纯动作判定声明提前到筛选computed前；ProcessDesign的步骤文本和用户读取声明分别提前到对应computed/watch之前，两段modelValue相关watch位置保持。
- 已安装Vue的computed构造保存getter，读取时才求值；ProcessDesign的selectedStep watcher非immediate。保留该页searchUsers的debounce调用初始化前引1条，不移动调用来消除诊断。五文件no-use-before-define 12→1、总lint292→281 errors，0 warnings，逐文件各规则无新增。
- 磁盘源码逐字匹配提案，9段声明原文及其它statement顺序保持，真实compileScript binding和生产DOM/SSR render一致。Template与Timeline原/新实际编译setup在Fake API下的成功/失败四组轨迹相同：factory零请求，受控mounted读取、分页大小改变重置页码及失败清理保持；Timeline四种筛选和正反排序的具体ID序列、expose/open请求保持。这是setup与受控mounted调用探针，不冒称DOM挂载。
- 工单目录现有12文件260项测试及应用类型检查通过；没有新增镜像测试或修改断言、规则与ignore，没有重复全仓测试和构建。未扩展预测/RCA复杂初始化边界，未调用真实工单或通知服务，未上线。

## 阶段六十九：工单动作与图标的自有映射

补完阶段67因并行写入排除的Instance动作名和WorkorderComments图标字典：两个局部对象22个primitive字段、各唯一只读引用复用已交`getOwnLookupValue`，未知原型键返回undefined后仍走原惰性fallback。已知动作、图标、0值及未知值保持约定，继承getter不会执行。

- 仅两个helper新导入、两个读取调用和选定字段排序，既有import声明原文顺序不变；Instance长错误提示做必要换行。其它AST、模板/style和原binding保持。没有更改helper、业务条件、规则、ignore或数据初始化。
- fresh两文件lint234→224，sort-objects119→109减少10，sort-imports15不变，逐文件各规则无新增；22已知键、12未知/原型/fallback和两继承getter执行证明通过。
- 工单目录及既有helper共13文件270测试、最终应用类型检查与差异检查通过；没有新增镜像测试、真实工单操作或通知，未重复全仓与构建，未上线。

## 阶段七十：悬浮助手的完整回调依赖闭环

ai.vue搬移14段完整const-arrow声明，no-use-before-define 30→0。保留kind、名称、函数体、同一script作用域和捕获binding；所有固定statement原文顺序、模板和style保持。没有移动状态/ref/reactive、账户存储构造、marked.setOptions、watch或任何业务调用，也未改变会话恢复和聊天协议。

- persistState和聊天初始化依赖的数据完成初始化后才创建相关回调；loadState声明延后到新建会话依赖之后；拖拽、缩放、滚动和搜索按真实闭包依赖排列，escapeHtml提前到高亮函数之前。stopDrag/stopResize的自引用事件移除协议保持，没有转换函数种类或消除真实递归。
- 已安装marked的setOptions仅合并defaults，不执行highlight回调；唯一immediate账户watch仍在原位置。原/新实际编译setup使用真实Vue、账户scope、marked及私有内存DOM存储，以Fake API覆盖空缓存/已有会话与恢复成功/失败四种组合：即时账户初始化、读取和持久化、拖拽缩放、新建会话、换账号与清理轨迹相同。已有会话在原immediate watch阶段读取，不误称所有setup均零请求；没有真实模型或网络调用，此为受控setup/生命周期探针而非DOM挂载验收。
- 磁盘源码与提案逐字匹配，14段完整声明、其它statement原文顺序、compileScript binding分类及生产DOM/SSR render一致；单文件lint133→103 errors、1 warning保持，逐规则无新增，其余既有债保留。
- AI与独立助手页面及账户scope现有7文件53项测试、应用类型检查通过，包含账户切换隔离、旧流取消、持久化和会话恢复等既有回归。没有修改测试断言、规则或ignore，没有重复全仓测试和构建；其它初始化类前引保留待独立验证，未上线。

## 阶段七十一：已验证的防抖构造与未赋值计时器绑定

ProcessDesign将完整searchUsers debounce构造提前到selectedStep watcher前，仍在fetchUserList声明之后。该调用参数仅为纯closure和数值300，已安装lodash-es实现构造时仅分配本地wrapper及cancel/flush，不执行用户回调、调度timer或产生I/O；不据此把任意调用视为无副作用。

- MonitorSend仅提前三个无initializer的let声明，两个onBeforeUnmount的原文位置与注册顺序、所有定时器赋值和任务时点保持。明确允许的内部变化是缩短这三个绑定的TDZ窗口：跨越区间只有不观察这些绑定的ref/reactive数据构造，没有读取、写入或eval；生命周期注册只保存回调，实际首次读取仍在原初始化完成后。没有移动hook来凑数，也不将该结论泛化到有initializer或可被提前观察的let。
- 两文件四段完整statement及其它statement原文顺序、同一作用域、模板/style、compileScript binding分类和生产DOM/SSR render保持。no-use-before-define 4→0，总lint109→105 errors，0 warnings，逐文件各规则无新增。
- 原/新实际编译setup使用真实Vue与实际lodash debounce、Fake API和受控时钟，成功/失败四组轨迹相同：factory零请求/零timer，299/300ms执行边界、步骤切换取消、三种目录搜索、关闭及卸载取消保持，两个卸载hook仍按原顺序注册。这是setup与受控生命周期调用探针，不替代DOM挂载回归。
- ProcessDesign.contract、MonitorSendSafety、PrometheusLists及PrometheusFormSafety现有4文件178项测试和应用类型检查通过。未新增镜像测试、改断言/规则/ignore或扩展其它前引项；没有真实通知、云或模型调用，未上线。

## 阶段七十二：云账户地域校验的私有函数依赖

CloudAccountManagement仅将normalizeRegions、regionSignature两段完整const-arrow按依赖顺序提前到formRules computed之前，no-use-before-define 2→0。声明kind、函数体、同一作用域与捕获binding保持，所有其它statement、状态/watch/data/call初始化顺序及模板style字节保持，没有改动地域或凭据业务。

- 创建这两个函数不读取地域数据，不执行map、JSON或sort。实际调用时normalizeRegions仍产生新数组与对象，regionSignature仅排序该新数组，不修改调用方原始地域列表；computed校验规则及validator调用时机原样。
- 磁盘源码与提案逐字匹配，完整声明和其它statement原文顺序、compileScript binding分类及生产DOM/SSR render一致；单文件lint105→103 errors，0 warnings，逐规则无新增，其余既有债保留。
- 原/新实际编译setup使用真实Vue、Fake API，在读取成功/失败两种流程下factory零请求，受控mounted读取、Azure/GCP/华为/阿里云地域校验矩阵、签名与输入不变、关闭清理轨迹相同。这是setup/受控生命周期探针，不代替真实DOM挂载验收。
- CloudAccountSafety、CloudAccount.contract和CMDBLists现有3文件131项测试及应用类型检查通过，保留账户与窗口隔离、失败清理和provider凭据等既有回归；未改测试断言、规则或ignore，未重跑全仓测试和构建。没有真实云、凭据验证或网络调用，未上线。

## 阶段七十三：本地资源分页回调的完整依赖顺序

LocalResourceManagement仅将fetchLocalResourcesForScope、fetchLocalResources和handleTableChange三段完整const-arrow按依赖顺序提前到paginationConfig之前，no-use-before-define 2→0。捕获的pagination/filterForm及其它state已初始化；函数创建不读取这些数据或发送请求，实际分页回调和读取仍在原调用时机执行。

- 三段声明kind、函数体、同一作用域与捕获binding，以及其它fixed statement原文顺序、data/computed/watch/call初始化位置、模板/style保持。磁盘源码与提案逐字匹配，compileScript binding分类及生产DOM/SSR render一致；单文件lint84→82 errors，0 warnings，逐规则无新增。
- 原/新实际编译setup以真实Vue和Fake API比对成功/失败两组轨迹：factory零请求，受控mounted读取树及列表的顺序相同，实际paginationConfig的onChange(3,20)及onShowSizeChange(1,50)产生相同params、filter、rows、loading和错误清理。这是setup/受控生命周期探针，不替代真实DOM挂载测试。
- LocalResource.contract、LocalResourceSafety、LocalResourceBindingSafety及CMDBLists现有4文件141项测试和应用类型检查通过，保留既有账户隔离、窗口/请求竞态、绑定及失败回归；未新增镜像测试、改断言、规则或ignore，未重复全仓测试和构建。该单模块闭环不代表其它域的前引全部完成，没有真实资源、SSH或网络操作，未上线。

## 阶段七十四：预测分析的共享清理职责

PredictAnalysis将账户变化与表单变化中相同的五步清理提取为私有clearAnalysisResult函数：作废analysisLane、清analyzing、清错误、清结果、释放图表。函数定义在lane创建之后，两个原回调仍在原调用点执行；owner回调的currentValue清空仍最后，并保留因此触发同步formData watcher的重复清理，没有删减invalidate次数或依赖generation省略操作。

- 这是有实际状态清理责任的复用函数，不是空thunk。具名函数没有this/arguments/super/new.target、构造或反射观察，只在两个原回调中直接调用；真实useAiRequestScope的owner watch非immediate，scope/lane初始化没有提前执行清理。共享scope、其它预测/RCA页面、data/watch/chartAppearance及业务调用初始化位置未改。
- 另外仅按依赖搬移getCurrentValueMax和图表初始化闭环的六段完整const-arrow，保留kind、函数体与捕获binding。共享函数的五步展开回两个call点后，其它statement原文顺序保持；模板/style、原binding分类与生产DOM/SSR render一致，新binding仅为该私有清理函数。单文件no-use-before-define 3→0、总lint85→82 errors，0 warnings，逐规则无新增。
- 落盘前原源码与离线内存提案均通过全部预测目录现有5文件35项测试，确认Vite实际加载提案。落盘后同套35项及应用类型检查通过，没有新增镜像测试或修改断言、规则及ignore，也没有重复全仓构建。
- 原/新实际编译setup使用真实Vue、useAiRequestScope和主题监听，以及Fake模型/图表，成功、失败、类型切换迟到和owner切换迟到四组轨迹相同：factory/mount无模型请求，lane操作次数/票据、错误清理、图表配置数据、释放/重建、主题刷新与resize保持。此为setup/受控生命周期探针，不替代真实DOM测试；没有真实模型、云或网络调用，未上线。

## 阶段七十五：剩余SFC叶回调的声明顺序

SystemRole、Secret、MonitorOnDutyGroup和MonitorScrapeJob四个SFC各搬移一段完整const-arrow，分别将API选择判定和剪贴板函数放到首次回调引用前，将详情转编辑回调延后到编辑入口后，将服务树读取声明放到原onMounted注册前。四个组件各自no-use-before-define 1→0，没有改变函数kind、名称、函数体、作用域或捕获binding。

- 状态、computed/watch、生命周期注册与其它副作用初始化保持原文顺序，模板和style字节保持；角色判定依赖的selectedApis已初始化，剪贴板函数创建不操作浏览器，详情编辑回调仅延后创建，服务树读取仍由原mounted回调触发。没有移动状态或hook来凑数，也未触及Secret编码器的正则/schema初始化。
- 磁盘源码与提案逐字匹配，四段完整statement与其它statement顺序、真实compileScript binding分类及生产DOM/SSR render一致。四文件lint328→324 errors、0 warnings，逐文件各规则无新增，其余既有诊断保留。
- 原/新实际编译角色、值班组和采集任务setup，在Fake API成功/失败六组轨迹中保持factory零请求、真实computed角色选择、详情转编辑及mounted树/列表读取和失败处理一致。该探针为受控setup/生命周期调用，实际DOM行为由现有挂载回归覆盖。
- 角色、Secret目录、值班CRUD/调班、采集安全/凭据、Prometheus列表、权限按钮与表格等现有19文件754项测试及应用类型检查通过；没有新增镜像测试、修改断言、规则或ignore，也没有重复全仓测试和构建。没有真实集群、凭据、通知或外部API操作，未上线。

## 阶段七十六：否定条件与完整分支的同构整理

23个源文件（9个SFC、14个TS）仅处理53处unicorn/no-negated-condition：对!operand或!=/!==条件取逻辑补，并交换完整if块或三元分支。条件operand仍按原顺序求值一次，成员getter/coercion与被选分支的真实执行路径保持；原块作用域、分支内声明、调用与副作用次序保持，没有重排对象属性、数据、初始化或其它规则。

- 当前53处均满足限定合同，无无else、悬挂else、块外注释归属不明、嵌套函数声明或重叠fix需要豁免。完整分支原文和内注释保留，括号及三元结合按真实解析后的AST核对，运算优先级保持；规范化条件逻辑补与分支交换后，整个真实script AST的token/literal/声明结构一致。
- 磁盘源码逐字匹配已审提案；其它源码仅有该规则的精确fix，9个SFC模板/style字节、compileScript binding分类和生产DOM/SSR render保持。Root另用HEAD-before及磁盘源码独立重建canonical AST和模板/style复核通过。
- 23文件定向lint2742→2689 errors，1 warning保持；该规则53→0，逐文件各规则无新增。其余既有诊断保留，没有修改规则、ignore、测试或lock，也没有随手格式化。
- 全Web现有166文件3619项测试及应用类型检查通过，覆盖K8s、Cron、AI、云账户、工单等原有异步隔离与失败回归；没有新增镜像测试，本阶段按约定未重复构建。没有真实外部API、集群、云或凭据操作，未上线。

## 阶段七十七：保留模块求值顺序的类型导入整理

65个文件（25个SFC、40个TS，其中23个测试文件）仅整理显式type import位置及导入间空行。运行时value和side-effect import的每条完整声明原文、相对顺序保持，全部import声明的完整原文multiset保持；所有非import statement及测试逻辑、断言、fixture保持，没有重排会影响模块求值顺序的导入。

- 从604条sort-imports中筛选，先采用原规则排序提案，再恢复value/side-effect声明原序，仅保留实际净减且逐规则无新增的文件。其余71个无净减或会产生新诊断的提案，以及13个注释归属需要另审的保守排除文件未改；独立逐import检查包含leading、内部及同一行trailing注释，最终65文件的导入区域无注释或directive，不以类型擦除掩盖指令作用域变化。
- 使用verbatimModuleSyntax=true擦除类型后，对完整JavaScript AST全部子节点逐一比较，结构、token和literal保持；25个SFC再经真实compileScript后的JavaScript AST、binding分类及生产DOM/SSR render一致，模板/style字节保持。类型导入跨越运行时声明不产生新的运行时模块读取或初始化。
- 65文件sort-imports 280→171，净减109；该范围总lint3918→3809 errors，5 warnings保持，逐文件各规则无新增。其余既有导入顺序诊断继续保留，没有宣称604条全部修复，也没有修改规则、ignore、CI或lock。
- 全Web现有166文件3619项测试、应用类型检查通过；测试文件仅导入排版，正文statement保持，没有新增镜像测试或更改业务断言。本阶段按约定未重复构建，没有真实外部API、云、集群或凭据操作，未上线。

## 阶段七十八：AntD Modal具名配置的静态属性顺序

19个文件（6个SFC、13个TS）仅整理73个直接Modal.confirm/warning/error配置的属性顺序，净减149条sort-objects。TypeScript真实scope/symbol确认Modal来自ant-design-vue命名导入，配置只含title/content/centered/width/okText/cancelText/onOk/okType/onCancel九种已声明字段；值仅为primitive、无插值template或完整函数表达式，排除member读取、call、spread、computed/getter、赋值、重复字段及__proto__。

- 已安装AntD4.2.6的index/confirm/ConfirmDialog/ActionButton链先复制配置，再按固定具名props读取和调用content、onOk/onCancel。排序改变输入字典的插入序，九个具名字段映射和消费者回调位置保持，不把该结论泛化到其它对象。所有完整property及函数体原文multiset保持，数组、业务调用与其它AST顺序不变；73配置无property外部注释归属歧义或directive，回调内部注释随完整原文保持。
- 落盘前在两个独立fresh JS process/JSDOM及库module graph中，以九字段原序/排序各运行10个实际Modal DOM场景，包含每次content render的完整trace一致。标题、正文、按钮文字、危险类型、宽度、居中、ok/cancel/程序关闭，以及Promise resolve关闭和reject保留窗口的行为保持；拒绝路径仅按精确Fake Error身份记录SDK预期事件，未知错误仍使探针失败。使用Fake回调，不执行业务API。
- 全树AST仅对限定配置的property顺序规范化后相同，真实符号及值分类再次核对；6个SFC binding、模板/style和生产DOM/SSR render保持。19文件lint2284→2135 errors，0 warnings，逐文件各规则无新增；未混入Table.columns、菜单、CSS、校验或参与遍历/哈希的数据。
- 全Web现有166文件3619项测试及应用类型检查通过，保留原有确认/取消、权限、异步归属及失败回归；未修改测试逻辑、断言、fixture、规则、ignore、CI或lock，没有新增镜像测试或重复构建。没有真实集群、通知、云或外部API操作，未上线。

## 阶段七十九：未知显示键的own lookup修复

AutoFix六个公开formatter及NotificationEvents的eventsNames、states共八个字典、十处读取复用既有getOwnLookupValue。此前string输入constructor、__proto__或toString会命中继承属性，返回function/object而绕过原fallback；继承getter还可能执行并观察字典插入序。现在仅返回owned值，非own键走原fallback，不读取继承getter；这是明确的显示行为修复，不冒称纯重排等价。

- formatter保留原有||链、空输入和普通future key的原文本/默认颜色/图标合同；事件名称与列表状态、详情标题、投递状态均保留??及原“其他事件”/“未知状态”fallback。合法owned值保持，既有helper的0/false/空串合同由原测试继续覆盖，未改helper或换fallback运算符。
- 只有守卫后的eventsNames顶层keys排序；states声明及Object.entries→eventStates原文和下拉顺序保持，所有按钮closed状态检查原字节保持。PV配置、其它闭集状态map及其它索引表未混改，未知状态显示不会授权取消/重试/投递动作。
- 两个现有测试文件新增30项必要回归，保留全部旧statement、断言及fixture。最终HEAD原生产代码加载下26项新增用例失败、24项通过（含四项普通future键正向）；修复后50项全部通过。六formatter覆盖合法/空/未知键与继承getter；真实AntD挂载和Fake API覆盖事件名称、列表状态、详情标题、投递行的constructor/proto/toString/future及局部字典canary getter，验证回退渲染且无写请求。
- getter测试不扩写Object.prototype：formatter对既有__proto__ accessor经真实descriptor类型guard后spy并finally恢复，通知在局部字典设置私有prototype并finally恢复。fixture使用unknown和明确对象guard，没有用any或强制断言绕过类型检查，也没有规则豁免；不以修改旧期望掩盖原错误。
- 生产AST复核仅有十处guard调用、必要import和单个eventsNames排序，原控制流及fallback运算符保持；模板仅四处读取替换，原binding及style保持。四文件lint77→71 errors，各规则无新增，净减6条sort-objects；六formatter与状态读取改动是功能修复而非计数成果。
- 最终源码全Web166文件3649项测试及应用类型检查通过，包含30项新增回归。没有改CI、规则、ignore或lock，没有新增镜像测试或重复构建；没有真实模型、通知、云、集群或外部API操作，未上线。

## 阶段八十：经Vue消费者验证的primitive union顺序

29个TS文件仅整理58处union：30处number|null、23处string|null、4处string|number及1处number|null|undefined。成员原文multiset、声明作用域和其它AST保持，注释归属不清的项不纳入；未扩大到Boolean/String组合、literal、引用或复杂function/conditional/infer/intersection成员。196条中净减58，138条保留，不以TS擦除就泛称所有union可交换。

- 每个编辑文件以已保存before快照和真实落盘after比较，完整TS AST仅上述成员次序变化，擦除后的完整JavaScript AST相同。strictNullChecks下真实checker解析的intrinsic .types形状和实际顺序一致；已安装TypeScript5.9.3会预先创建这些intrinsic类型并按type.id整理union，不将此证明推广到可能观察顺序的literal/复杂类型操作。
- 已安装Vue3.5.42提供registerTS、compileScript fs(fileExists/readFile/realpath)、invalidateTypeCache及parseCache接口。before host显式覆盖29份原快照，after host读取真实磁盘；两次之间失效全部transitive read/deps及parse缓存。先用虚拟导入TS的Boolean|String→String|Boolean控制样例正确检出runtime props JavaScript变化，避免缓存或纯TS擦除造成假绿。
- 全仓354个真实SFC逐个比较开发/生产，共708组before/after：两侧编译错误均0，完整compiled JavaScript AST、bindings及DOM/SSR输出差异0。编译器实际读取5个编辑TS：api/core下的aiops/predict.ts、aiops/rca.ts、cron/cron.ts、tree/tree_cloud.ts，以及views/servicetree/managed-operation-marker.ts；每个读取的before/after内容digest分别核对快照/磁盘且不同。
- 其余24个编辑文件标记“当前无SFC consumer”，仅指本次SFC宏类型解析未读取，不代表业务组件没有value import；这些文件自身的完整emit JavaScript AST已另行验证。没有宣称全29文件都被SFC类型消费者读取，也不跳过无法证明的消费者。
- 29文件定向lint净减58条sort-union-types，逐文件各规则无新增；全Web现有166文件3649项测试及应用类型检查通过。manifest内RcaSafety.test.ts仅一处type annotation顺序，测试逻辑、断言及fixture不变；未改规则、ignore、CI或lock，没有新增镜像测试或重复构建，没有真实外部API或凭据操作，未上线。
