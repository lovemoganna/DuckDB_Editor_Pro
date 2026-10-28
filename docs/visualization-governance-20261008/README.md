# 全局可视化治理记录（2026-10-08，America/Los_Angeles）

**结论：本轮已完成公共层缺陷修复及相关回归，尚未达到 BRD 的全局完成条件。** 代码扫描、真实计算、浏览器绘制、生产页面完整业务操作是不同的证据。以下不以构建成功或非零 canvas 代替布局、交互和配置恢复验收。

## 一、五项待核实信息的实际结果

### 1. 图表库和版本

以当前 node_modules/package.json 为准（不以依赖声明范围代替安装版本）：Chart.js 4.4.2、react-chartjs-2 5.2.0、chartjs-plugin-datalabels 2.2.0；关系/流程展示另使用 D3 7.9.0、ReactFlow 11.11.4、Mermaid 11.16.0、Pixi.js 8.20.1。DuckDB WASM 包 1.32.0，浏览器实际引擎报告 1.4.3。保留现有技术栈。

### 2. 实际类型、页面和覆盖边界

chartRegistry 注册 13 类：bar、line、area、doughnut、pie、scatter、table、kpi、counter、funnel、waterfall、histogram、combo。pivot 是表格配置分支，不是第 14 个独立 Chart.js 图表构造器。统计图共同出口是 components/charts/ChartRenderer.tsx；全量源码扫描没有发现第二个直接 react-chartjs-2 消费者。

入口包括 AnalysisHub（及 LinkedAnalysis、TimeSeries、Pivot、RecipeCenter）、ChartBuilder、ChartDashboard、DashboardWidget、VisualizationWorkbench/VisualizationCard、Workbench/ResultSection，以及首页/ExecutiveOverview。完整引用和相对依赖图见 [rescan-delivery.json](rescan-delivery.json)。扫描 690 个生产源码文件，记录 97 个相关源码条目；**97 不是组件数量**。原生 SVG 条目包含装饰/品牌图形。

关系/流程/原生图形另包括 D3GraphView、GraphRenderer、OntologyCanvas、SchemaGraphView、ERDiagram、CausalGraph、MermaidChart、DataFlow、ExecutionPlan、技能 Pipeline、OntologyStudio/Workspace、学习页面交互图和遥测图。它们消费拓扑/流程语义；本轮没有把这些输入伪装成数值 Chart Spec，也没有执行其全部浏览器交互验收。

| 组件族 | 源码中已实现 | 部分实现/缺口及当前验收范围 |
| --- | --- | --- |
| 柱/条形 | 排序、TopN、分组、堆叠、百分比、值标签、点击回调 | 本轮真实查询与三尺寸绘制、原生柱体点击；所有生产页面联动及密集长标签的像素验收未完成 |
| 饼/圆环 | 扇区值/占比、内外标签/引导线、圆环总量、点击 | 三尺寸绘制、精度及小尺寸圆形验证；选中项中心内容没有独立实现/验收证据 |
| 折线/面积 | 时间排序、缺失值策略、同比/环比/累计/移动平均、面积堆叠 | 真实日历同比环比已核验；全部缺失策略、所有辅助 Series 的生产页面组合未逐项操作 |
| 散点 | X/Y、颜色/大小、趋势线、异常点、记录追溯、框选入口 | 非数值轴错误已修复；原生框选拖动和跨组件 SQL 联动未验证 |
| 直方图 | 自动分箱、binCount、频数及占比 Tooltip | 缺少显式分箱区间设置和频数/占比切换完整能力；仅实际分箱数据与基础绘制覆盖 |
| KPI/counter | 名称、值、单位及有效比较值的变化率 | 无有效基准不得显示虚构变化率；目标差值完整 UI 未确认，未计 PASS |
| 双轴/组合 | 柱线共享维度、左右量纲、格式、堆叠 Tooltip | 混量纲合计修复通过；所有 Series 轴归属图例要求未全部满足/操作验收 |
| 漏斗 | 横向阶段条、首阶段比例、相邻转化率、点击 | 当前是阶段条形实现；真实业务阶段语义/下钻未验证，渠道测试输入不视为业务漏斗验收 |
| 瀑布 | 增减、累计、总量节点识别 | 总量依赖标签名称启发式；缺少显式起点/变化/终点字段绑定契约，语义验收未完成 |
| 表格/透视 | 格式、排序、过滤、固定列、汇总、单元格事件；二维展开折叠/小计/总计 | 真实 VARCHAR 金额汇总已修复；任意多级维度层级透视没有实现，生产页面完整操作未验证 |
| 拓扑/流程/SVG | 各自真实已有组件和输入契约，详见清单 | 代码引用已扫描，不能将统计图 42 次绘制算作这些组件的布局/交互 PASS |

### 3. 公共层实际实现与职责

AnalysisSpec → sqlCompiler/calcCompiler → duckDBService 的实际查询 → chartRegistry/chartDisplay → ChartSpec → chartJsAdapter → ChartRenderer/TableView/PivotTableView。

- 分析层：聚合、时间计算、分箱、比例、排序、缺失策略位于现有 services/analysis 公共模块。
- Chart Spec：services/analysis/types.ts 定义结构，chartRegistry 注册类型/字段语义并映射结果；dashboardWidgetAdapter 接入已有 ChartConfig，保留 formatByKey 等保存参数。
- Formatter：utils/chartFormat.ts 管理数值解析、编号保护、单位、精度、百分比和千分位。构成占比统一调用 formatPercentValue（默认一位精度）；百分比堆叠的结果格式优先于保存的绝对量单位。
- 渲染：chartJsAdapter、chartUtils、chartStyleRules/chartPlugins、chartSpace、chartWindow 和统一 ChartRenderer 负责轴、Tooltip、标签、图例、几何、分页/滚动。图表消费引擎结果；没有新增平行渲染架构。
- 状态：services/workbench/runtime 的请求/缓存失效、筛选绑定，store 的数据库/页面上下文，以及 useVisualizationRequest 等图形请求清理共同承担状态；这不是单一独立“全局状态模块”。图例、表格视图和框选具有展示状态。

### 4. 绑定、计算和保存

已有 X/Y/右 Y、Series/分组、Label、Color、Size、brushField 和透视行/列/值配置，实际可用通道取决于图表类型，不能认定所有类型支持全部通道。公共层现在拒绝不存在的显式绑定、非数值散点轴/大小和未知保存图表类型；KPI 不要求其未消费的 X 维度。其他类型的所有非法计算语义仍需逐项补足，不能据此声明绑定校验全覆盖。

已有聚合、排序、TopN、时间 grain、同比/环比、累计、移动平均、比例/百分比堆叠、直方图分箱。同比/环比现在按时间 grain 查找实际上一日历周期，并匹配其他维度，缺失或零比较基准返回 NULL；类别维度不允许静默充当日期。

dbService 将 dashboard、query、setting 等对象保存到当前 catalog 的 __studio 元数据，用户 ChartConfig/formatByKey 随已有对象保存；domain setting 有 saveDomainSetting/getDomainSetting，底层运行环境支持 OPFS，也可能使用 MEMORY。此次没有迁移或清空配置。测试浏览器使用独立内存环境只读附加基线，不证明实际用户数据库切换、OPFS 重启或生产页面保存恢复通过。

### 5. 真实数据、口径和环境

固定文件：data/crud-lab/baseline.duckdb；SHA256 `a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887`。

独立源文件：data/crud-lab/source/google-sheet.xlsx；SHA256 `6be7f75d21611e38888819204bccad8c161a965abde7d0039336cf5746718315`。来源/下载时间以 data/crud-lab/manifest.json 为准：已有 Google Sheets XLSX 导出，2026-10-02T00:22:34.341732 UTC；本轮未重新下载或改变版本。此处只采用项目现存快照，不推测原业务真实性或更新频率。

4 张表：users 10、fiat_transactions 25、crypto_transactions 25、exchange_rates 8，共 68 行。固定初始口径：不跨币种合计，完成订单 status=completed；USD 金额 SUM(amount)=104270，USDT=13000；USD 净额按 withdrawal 取负=47730；全部法币+加密订单完成率 43/50=86%。wire_transfer 的 USD 完成金额 102000（净额48000），ach 金额2270。

services/workbench/fundsBaseline.integration.test.ts 从 XLSX 原始行独立核对这些结果，SQL 实际交由 native DuckDB -readonly 执行；新 globalGovernance.integration.test.ts 同样每次验证基线哈希并运行真实 SQL，对日历周期从原始行独立求和/查找预期。VARCHAR、NULL、零、缺失字段、无结果反例是对这些真实行的查询/投影，不是虚构订单或静态业务结果。

Windows、项目现存 Node/Vitest、只读 native DuckDB 1.4.2 和 Vite 127.0.0.1:5173；浏览器独立 test/global-visualization-real.html 从固定文件实际加载 DuckDB WASM。没有触碰用户已打开的生产页面。

## 二、缺陷闭环

| ID | 复现条件与修复前实际结果 | 根因/最小修复及独立反例 | 当前结果及证据 |
| --- | --- | --- | --- |
| G01 | 已保存 amount=USD/percent=false，切换 bar/area/combo 百分比堆叠；计算是比例、标签仍绝对单位 | chartRegistry 衍生百分比格式被旧配置覆盖；强制计算语义的 % 格式，右轴原值保留 | PASS；before-confirmed.log，16 项真实治理测试含右轴独立反例 |
| G02 | 实际 SUM(amount) 返回 VARCHAR；表格展示未经单位/千分位格式化 | Formatter 对字符串提前返回；只格式化明确有格式的有效数值字符串，编号保护优先；修复中独立年份反例暴露默认维度格式也会把2025改成2,025，进一步收紧默认维度格式 | PASS；真实字符串金额与000042/文本/真实年份反例；dimension-format-before.log保留失败证据 |
| G03 | 绑定不存在的 Y/Label/Series/X；静默空图 | 缺少统一字段存在性校验；注册映射入口明确 error，按图表必需通道校验 | PASS；真实字段删除投影 + KPI 未使用 X 反例 |
| G04 | channel 文本绑定散点 X，产生无效点 | 散点数值通道缺少检查；X/Y/Size 非数值明确字段错误，不把 NULL 当缺失字段 | PASS；文本轴与真实 NULL/0 反例 |
| G05 | 保存的未知 chartType 显示成柱状图 | 注册入口默认回退；返回明确 error，不禁用已有类型 | PASS；真实查询结果+未知配置 |
| G06 | 左轴 USD、右轴笔数、stack Tooltip 混加 | 合计未限定量纲轴；公共合计只取 y 轴 | PASS；100 USD 与2笔独立反例；原组合图真实查询 |
| G07 | 缺月的 USD 月序列，6月与4月比较为6566.67%，而5月缺失应 NULL | positional LAG 不表达日历语义；按 grain 回查上一月/年、匹配其他维度，缺失/零返回 NULL | PASS；原失败月份及所有实际币种月序列 MoM/YoY 独立核验；无 time grain 明确拒绝 |
| G08 | pie/doughnut 280×240 强制480宽，圆形裁切 | 公共几何最小宽度不适合稀疏圆形；按可用宽度及160高度适配，密集内容空间策略保留 | PASS（稀疏固定案例）；arc-space-before.log、arc-before.png、最终 pie-280.png；全部密集圆形尚未像素验收 |
| G09 | 容器高度收缩，绘图区166高但实际 canvas 仍286高 | Chart.js 高度未随已测几何同步；共用几何调用公开 resize | PASS；canvas-resize-before.log、真实截图/DOM、height-only 组件反例 |
| G10 | 同扇区内98%、图例97.8%；轴强制整数% | 各处精度独立设置；公共占比 Formatter，百分比轴尊重统一格式 | PASS；precision-before.log、真实饼图内外标签测试、最终截图97.8%一致 |
| G11 | WASM DECIMAL/VARCHAR 金额表格汇总遗漏 | 汇总仅认原生 number；适配器传递明确 measureKeys，显式度量可解析字符串，非绑定编号不求和 | PASS；table-summary-before.log、真实金额104270与000042维度反例 |
| G12 | 稀疏小尺寸饼图外置标签/引导线与标题相交 | 外置标签按整个canvas边缘装箱，未避开标题；公共插件按chartArea上下边界装箱，并约束引导线弯折点 | PASS（原案例）；pie-title-before.log两项失败反例→两项通过；重新加载页面后的真实pie-280.png标题和引导线分离；密集图仍未全验收 |

保留失败日志，不修改业务答案。初始测试 SQL 使用保留字 day、零值筛选没有行、CLI 文本编码失败属于测试/传输问题，单列在 before.log/counterexamples.log/browser-utf8.log，不计入产品缺陷。原有 MoM/YoY 测试断言从实现细节 LAG 更新为日历周期语义，真实数据期望独立核验，未改成接受错误结果。

小尺寸非圆形图采用现有滚动绘图区保留必要尺寸。bar-280.png 初始视图底部横轴未露出；实际滚动后 bar-280-scrolled.png 横轴/完整分类可见，compact-scroll.log 记录 278×206 视口、282×260 内容、scrollTop=54/scrollLeft=4、overflow=auto。不能把初始截图认作所有内容同时可见，也没有新增裁切补丁。

## 三、最终验证记录与分层限制

| 验证 | 输入/预期 | 实际结果 | 判定 |
| --- | --- | --- | --- |
| 源码全量引用扫描 | 生产 components/services/utils/hooks + App/index/types，AST imports/JSX/构造器/源码哈希 | 690文件、97相关条目；ChartRenderer 唯一直接 react-chartjs-2 入口；依赖表已输出 | PASS（引用范围）；不等价全部组件运行行为通过 |
| 底层/适配/组件/关联消费回归 | 固定文件+独立 XLSX、真实日历计算、格式/状态/渲染组件契约 | 最终版本 final-contract-regression.log：25文件/178项；consumer-final-regression.log：3文件/21项，共28文件/199项通过，含16项真实治理及2项标题避让反例；较早 acceptance-regression.log 为28文件/215项 | PASS（执行案例）；不同跑测选择不能累加重复测试；jsdom canvas 警告说明它不是像素测试 |
| 实际浏览器绘制 | 13注册类型+透视，760×440、560×360、280×240；实际文件/WASM查询、Spec ok、canvas非零、圆形收缩匹配 | browser-acceptance-final.json：14展示方式/42尺寸记录，包含实际SQL/rows/Spec/DOM；截图 output/playwright/global-governance | PASS（这些断言）；所有42张截图未逐图进行完整像素语义验收，不认定全部布局PASS |
| 原生点击 | 已观察760×440柱体，鼠标点击wire_transfer | 回调 channel=wire_transfer | PASS（渲染器事件）；测试面只记录事件，不证明生产页面跨组件联动 |
| 实际过滤/恢复 | 渠道下拉wire_transfer，再取消 | 实际SQL金额102000→104270 | PASS（验收面真实过滤）；与上行分别记录 |
| 百分比/空/失败 | 保存USD格式→percent；AND false；SELECT missing | %格式；0行empty；实际Binder错误及0行，无旧结果 | PASS（验收面案例） |
| 全屏 | 测试面进入/退出dialog | 已执行并截图 | 部分验证；不等价生产全屏状态/图例恢复通过 |
| 类型/构建 | 当前最后源码 tsc、Vite生产构建 | typecheck-final.log exit0；build-final.log成功36.13s | PASS（工程检查）；构建含既有chunk大小警告 |
| 全项目保护测试 | 当前工作区完整Vitest | project-regression.log：255/256文件、2405/2406测试通过，1失败 | FAIL；完整跑测在末轮格式/汇总/标题改动前，最后版本重跑相关199项，不宣称最终全项目全绿 |

完整保护测试唯一失败：components/Dashboard/MissionControl/MissionControlBidirectionalFlow.test.tsx。在异步加载时同步要求“尚无数据表”；旧测试仍模拟 homeDefaultVisualizations，而当前首页已使用新模块，duckDBService mock 缺 getCurrentCatalogAndSchema。后续旧首页查询记录/导航假设也与现状不同。此测试未被跳过、放宽或改页面实现来掩盖；其真实首页完整流程仍须重建证据，此次列为验收阻塞。

有限结构兼容反例：真实查询的数值、VARCHAR DECIMAL、NULL、零；缺失字段/未知类型、文本散点轴；多币种分组+缺日历月份；双轴不同量纲；编号文本保护。它们复用固定真实记录，未新增伪造交易数据。大数据量、长标签、极端密集图形只具备部分现有逻辑测试，没有真实多结构浏览器全覆盖。

## 四、尚未通过/未验证（不计 PASS）

1. 上述能力表内的缺口：显式直方图区间/占比模式、目标差值完整UI、瀑布节点语义绑定、多层透视及所有图表通道绑定语义；它们不能以“原来没有”从BRD中静默删除。
2. 全部生产页面、拓扑/流程/SVG 的运行扫描、缩放/窗口变化、密集数据标签、交互功能及全局重新验收。
3. 原生散点框选、下钻和所有组件间筛选恢复；当前点击回调和实际过滤是两个独立证据。
4. 实际用户数据库/数据集切换、持久化重启、保存恢复及生产全屏交互状态保持。
5. 旧首页流程保护测试失败，最终版本完整保护测试未全绿。

因此全量行为覆盖、全部组件特性、布局响应式、全局筛选、状态隔离、持久化保护及全局复验不能标记为 PASS。不得引用本报告宣称“全局修复完成”。

## 五、可重复执行

在 duckdb-editor 项目目录运行（使用当前项目工具，无 Skill 安装/架构替换）：

```powershell
node scripts/audit-visualizations.mjs docs/visualization-governance-20261008/rescan-delivery.json
pnpm exec vitest run services/analysis/globalGovernance.integration.test.ts services/workbench/fundsBaseline.integration.test.ts --maxWorkers=1 --no-file-parallelism
pnpm exec vitest run services/analysis components/charts components/AnalysisHub/AnalysisHub.test.tsx components/Visualization/VisualizationWorkbench.test.tsx utils/chartFormat.test.ts utils/chartStyleRules.test.ts utils/chartSpace.test.ts utils/chartPlugins.test.ts services/workbench/fundsBaseline.integration.test.ts services/workbench/homeCompatibility.integration.test.ts --maxWorkers=1 --no-file-parallelism
pnpm exec vitest run components/DashboardWidget.requests.test.tsx components/Dashboard/WidgetChartConfigPanel.test.tsx components/Dashboard/KpiDynamicMiniCharts.test.tsx --maxWorkers=1 --no-file-parallelism
pnpm typecheck
pnpm test:run
pnpm build
```

分层执行：先真实SQL/格式/计算测试，再渲染契约，再关联组件，最后独立浏览器及完整项目保护测试；发生失败必须停在失败层，不用外层补丁掩盖。构建会复制资源并可能触发Vite刷新，应先完成构建再进行浏览器循环。

浏览器：另开 Playwright CLI 会话到 `/DuckDB_Editor_Pro/test/global-visualization-real.html`，执行 test/global-visualization-browser.js 的 async(page) 函数。每轮先reload，确保使用最终模块和新的DuckDB附加实例，而不是将HMR后的旧画面误当新代码结果。页面载入固定哈希、只读 ATTACH，再用真实查询驱动同一个生产 ChartRenderer。结果 JSON 和截图保存，不以 CLI exit0 单独判定成功（同时要求返回 typeCount=14/renderChecks=42 和全部断言执行）。这只是测试面，不新增生产页面或替代实际首页验收。

本轮借鉴本地 diagnosing-bugs 的失败证据/最小根因修复方法和 playwright 的实际浏览器验证方法；没有因 Skill 引入新业务功能、远程 Skill 依赖或额外架构。
