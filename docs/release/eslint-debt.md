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
