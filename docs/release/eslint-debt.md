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
