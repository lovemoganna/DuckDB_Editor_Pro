# DuckDB Editor Pro 可视化治理与复验

日期：2026-10-09，America/Los_Angeles。

**结论：已实施下述公共层修复和能力补全，但尚未满足 BRD 的全局完成条件。** 生产入口复现了只读库看板元数据写入失败；拓扑/流程组件、全部生产页面及全部尺寸/数据量组合的运行验收未完成。下文严格区分源码扫描、组件契约测试、真实计算、验收面浏览器操作及生产页面操作。

本轮保留现有工作区全部未提交改动，不更换图表库，不清空配置，不修改基线数据。2026-10-08 文档及测试结果仅作为历史背景，不计入本轮 PASS 数量。

## 1. 待核实信息

### 1.1 实际依赖

安装版本来自本轮 node_modules 扫描，声明范围与安装版本分别保存在 [inventory-final.json](inventory-final.json)：

| 用途 | 实际安装版本 |
| --- | --- |
| 统计图 | Chart.js 4.4.2、react-chartjs-2 5.2.0、chartjs-plugin-datalabels 2.2.0 |
| 图/流程 | D3 7.9.0、ReactFlow 11.11.4、Mermaid 11.16.0、Pixi.js 8.20.1 |
| 布局依赖 | dagre 0.8.5、elkjs 0.12.0 |
| 安装但未扫描到实际源码 import | Recharts 2.15.4 |
| 数据引擎 | @duckdb/duckdb-wasm 1.32.0；本轮生产浏览器页脚实际报告 DuckDB 1.33.1 |

不能把包版本等同于引擎版本，也不能沿用历史报告的浏览器引擎号。

### 1.2 组件清单、页面与能力状态

最终扫描覆盖 707 个生产源码文件，识别 118 个可视化入口及公共依赖条目。**118 是源码条目数，不是图表类型数，也不是实际组件总数。** 完整文件清单见 [inventory-final.md](inventory-final.md)，AST imports/re-exports/dynamic imports、相对路径和 `@/` 路径依赖、源码哈希见对应 JSON。扫描补上 src、types、布局库和仅包裹图表的页面引用，并排除 lucide/heroicons 同名图标；与初始 690/97 的差异主要是扫描范围完善，不代表新增业务组件。

注册类型 13 个：bar、line、area、pie、doughnut、scatter、histogram、kpi、counter、combo、funnel、waterfall、table。pivot 为表格配置分支，横向条形为 bar 配置分支，没有新增图表构造器。ChartRenderer 是唯一直接 react-chartjs-2 消费者。

统计图页面入口：ChartBuilder、ChartDashboard、DashboardWidget、AnalysisHub 及其 LinkedAnalysis/TimeSeries/Pivot/RecipeCenter、VisualizationWorkbench/VisualizationCard、Workbench ResultSection、首页/ExecutiveOverview。拓扑/流程另有 D3GraphView、GraphRenderer、OntologyCanvas、SchemaGraphView、ERDiagram、CausalGraph、MermaidChart、DataFlow、ExecutionPlan、OntologyStudio/Workspace、技能 Pipeline、学习页面图和遥测图。原生 SVG 清单也包含品牌/装饰图形，不应全部当统计图。

| 组件族 | 源码能力与本轮执行结果 | 部分实现/未验证项 |
| --- | --- | --- |
| 柱/条形 | 排序、TopN、分组、堆叠、百分比、标签和点击；修复 AVG/MIN TopN 与 COUNT 语义 | 所有生产页面点击到全局 SQL 过滤链路、密集长标签和所有正负值尺寸组合未全验收 |
| 饼/圆环 | 数值/比例、内外标签与引导线、圆环总量、点击；本轮三尺寸绘制 | 圆环中心选中项显示缺少独立完整实现证据；密集小扇区像素验收未全覆盖 |
| 折线/面积 | 时间排序、缺失策略、同比/环比/累计/移动平均、堆叠/百分比；真实 SQL 关联回归 | 全部策略/辅助 Series 的生产页组合及全部 Tooltip 操作未逐项验收 |
| 散点 | 颜色/大小、趋势线、异常标识、原始记录映射；真实 9 行完成原生鼠标框选并核对全部记录 ID | 框选回调已验证，不等于跨组件过滤/取消/恢复全部通过 |
| 直方图 | 自动分箱、数量配置；本轮新增固定区间宽度和频数/占比切换，真实分箱独立核验 | 任意自定义不等宽边界没有实现；小尺寸需要滚动，全部标签布局未全验收 |
| KPI/counter | 指标/单位；修复显式聚合忽略后续行；新增真实基准字段变化率和目标差值配置 | 全量业务同比/环比口径配置及生产保存重启未验证；缺基准不生成虚构变化率 |
| 双轴/组合 | 共享 X、左右字段/单位、柱线、Tooltip；本轮补齐图例左右轴标识 | 多量纲分轴校验通过，不等于全部实际页面配置组合已操作 |
| 漏斗 | 现有阶段条形、首阶段比例及相邻转化率、点击 | 真实业务阶段定义及下钻未验证；渠道数据仅证明渲染，不作为业务漏斗验收 |
| 瀑布 | 增减/累计/总量；本轮新增显式 start/change/end/total 角色字段和 Tooltip 语义，保留旧配置启发式 | 生产业务终点口径及所有分页交互未全验收；非法角色明确报错 |
| 表格/透视 | 格式、排序、过滤、固定列/汇总、单元格事件；二维展开折叠/小计/总计；本轮修复数值字符串排序与非指标字段变化后旧过滤状态 | 任意多级维度层级透视未实现；生产全流程未逐项验收 |
| 拓扑/流程/原生图 | 全量源码引用扫描并保留真实拓扑输入契约 | 运行交互、尺寸、缩放和状态隔离未全验收；没有伪装成数值 Chart Spec，也不计统计图浏览器 PASS |

### 1.3 公共契约与职责

实际链路：`AnalysisSpec → sqlCompiler/calcCompiler → duckDBService → chartRegistry/chartDisplay → ChartSpec → chartJsAdapter → ChartRenderer`。现有表格/透视分支也通过统一规格进入渲染；拓扑/流程有其自身输入契约。

- 数据/分析：真实 SQL、聚合、日历周期计算、排序、TopN、比例、分箱及统计辅助序列在现有 services/analysis 和查询运行层。
- 格式：utils/chartFormat 管理数值解析、编号保护、单位、精度、百分比、千分位和缩写。本轮收紧单位推断 token，防止 items 被当作 ms、order_amount 被当作笔数。
- 配置：services/analysis/types 的 ChartSpec/VisualConfig、chartRegistry 字段校验、dashboardWidgetAdapter 的旧 ChartConfig 接入、WidgetChartConfigPanel 实际控件。
- 渲染：chartJsAdapter、chartPlugins、chartStyleRules、chartSpace、chartWindow 和 ChartRenderer 管理 Tooltip、轴、标签、图例、几何/滚动/分页，不新建平行架构。
- 状态：store、services/workbench/runtime、useVisualizationRequest 等承担数据库/查询/过滤失效和请求隔离；图例/表格/框选维护展示状态。不存在一个已经覆盖所有页面的单一“全局状态服务”，不得宣称所有状态已统一完毕。

### 1.4 字段、计算、配置与持久化

已存在 X/Y/右 Y、Series/分组、Label、Color、Size、brushField 以及透视行/列/值绑定。实际可用通道依图表语义决定。公共入口对显式绑定字段缺失、非数值统计指标、散点 X/Size、非法角色/分箱宽度/目标、混用轴量纲给出明确错误；COUNT(*) 允许文本/NULL，不混用为金额。

计算支持 sum/avg/count/min/max、排序/TopN、时间 grain、同比/环比、累计、移动平均、百分比/堆叠和分箱。本轮共用 aggregateChartValues，排名与绘制使用同一聚合口径。KPI 明确聚合时使用全部过滤后记录，未配置聚合时保留既有首行语义。

Dashboard/query/setting 由 dbService 保存到所属 catalog 的 `__studio.objects`，ChartConfig/formatByKey 随对象保留；运行层支持 OPFS 和 MEMORY。新增参数沿此既有配置通路保存，组件测试核对原格式配置未丢失。**只读 catalog 不允许当前元数据实现写入，已实际复现为阻塞，不能据此宣称持久化验收通过。**

### 1.5 真实数据、口径与环境

固定文件 `data/crud-lab/baseline.duckdb`，SHA256 `a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887`。原始 XLSX `data/crud-lab/source/google-sheet.xlsx`，SHA256 `6be7f75d21611e38888819204bccad8c161a965abde7d0039336cf5746718315`。采用现存项目快照，未重新下载或虚构订单。

本轮 native DuckDB 实际目录查询确认：文件包含 main 和 lab_baseline 两个 schema，各有 users 10、fiat_transactions 25、crypto_transactions 25、exchange_rates 8，共 **8 张物理表、136 行**。main 业务子集为 **4 表、68 行**。生产导入预览也显示 136 行；纠正历史文档将整个文件写成 68 行的描述。

独立业务口径不跨币种合计，完成订单 status=completed：USD SUM(amount)=104270，wire_transfer=102000，ach=2270；USD withdrawal 取负后净额47730。新增直方图过滤后 USD 完成订单9行，宽度10000得到计数 `[6,1,1,0,1]`，占比 `[66.6667,11.1111,11.1111,0,11.1111]`；目标104000对应差值270 USD。原始行求和和区间计数独立于图表计算。

环境：Windows、现有 Node/pnpm/Vitest、真实 native DuckDB -readonly、Vite、Playwright Chromium。浏览器专用验收页实际 WASM 只读附加固定文件，消费同一个生产 ChartRenderer；独立生产浏览器另走文件上传/ATTACH/SQL/图表/加入看板，没有操作用户现有浏览器数据。源文件未被写入。

## 2. 本轮缺陷闭环

| ID/分类 | 复现输入、修复前实际结果、预期 | 公共层最小修复/独立反例 | 本轮判定 |
| --- | --- | --- | --- |
| N01 公共分析 | A=[6,6], B=[10]，AVG Top1；旧排名按SUM选A，预期B=10 | 排名和绘制共用聚合；MIN及真实渠道AVG独立 SQL 反例 | PASS，boundary-before/after、final-boundaries |
| N02 公共绑定 | 10类统计图绑定值5和invalid；旧静默丢弃非法记录，预期明确字段错误 | 公共 mapResult 数值通道检查；COUNT 文本、NULL 不误拒绝 | PASS，同上 |
| N03 公共语义 | COUNT 两条NULL，保存USD；旧误判空/沿用金额单位，预期2个 | COUNT按行数处理且格式为整数个；文本反例 | PASS，同上及真实SQL |
| N04 公共配置 | 左百分比正数、右绝对值-3；旧错误拒绝。右轴USD+笔却可能漏检 | 按实际轴/量纲校验，百分比只约束被转换的左轴；混右轴反例 | PASS，同上 |
| N05 公共格式/排序 | VARCHAR '-2.5','-10',NULL；旧字典排序，预期-10,-2.5,NULL | 明确 measureKeys 数值排序；编号001/02/010保持文本语义 | PASS，同上 |
| N06 公共格式 | items/customer_id/order_amount；旧子串推断错误单位 | 完整 token 和编号保护；latency_ms/orders正例 | PASS，同上 |
| N07 公共渲染 | combo左USD右笔；图例无法辨认轴归属 | 适配器统一补齐左右轴及单位；单轴格式保留 | PASS，同上 |
| N08 组件展示状态 | 指标/分类未变，仅note字段变化且含BigInt；旧表格过滤保留造成新结果被遮蔽 | 结果行全字段身份参与状态重置，BigInt安全序列化 | PASS，state-before失败证据、final-boundaries原例及独立反例 |
| N09 公共分析 | KPI明确SUM，记录3和7；旧只显示首行3，预期10 | 明确聚合统一全部过滤记录；AVG、COUNT及真实渠道求和反例 | PASS，同上 |
| N10 能力缺口 | 无固定分箱宽度/占比模式；无瀑布角色绑定；无KPI真实基准/目标控件 | 沿现有Spec和配置链路补齐；非法参数错误、0/NULL基准隐藏；原配置保留 | PASS（列明的契约和4项浏览器操作），不代表所有业务配置组合通过 |
| B01 生产持久化阻塞 | 独立生产浏览器上传并只读ATTACH baseline；首页初始化/加入看板执行CREATE，DuckDB拒绝 | 根因是 dbService.initializeMetadata 无条件写所属只读catalog，不是图表计算错误；错误和实际通知已保留 | FAIL，生产console及production-readonly-blocker证据；未用隐藏错误或修改只读属性绕过 |
| T01 测试契约 | 旧首页保护测试仍mock被移除模块、缺scope API并要求已移除按钮 | 按当前dynamicHome/scope/导航契约重建测试，明确为数据库double组件测试；没有声称其为真实E2E | PASS，最终组件用例；真实持久化独立记录为B01失败 |

boundary-before.log 的17/17失败是先建立的原始失败测试；boundary-after.log 为相同17项修复后通过。后续扩展为26项边界测试，包含新增能力和独立反例。state-before.log 保留另外两个真实状态/聚合失败。初次浏览器新增SQL使用保留字role属于测试SQL错误，修正查询后重新执行，未作为产品缺陷计数。

## 3. 执行证据与验收边界

| 验证层 | 实际输入/预期/实际 | 判定/证据 |
| --- | --- | --- |
| 全量源码引用复扫 | 707文件/118条目，含公共依赖和源码哈希，唯一react-chartjs-2消费者 | PASS（源码范围），inventory-final.json/md；不等同全量运行验收 |
| 关联回归 | 公共分析/格式/几何/渲染/AnalysisHub/VisualizationWorkbench/配置消费者 | 28文件217项通过，related-regression.log；这是中间版本，不能与最终重复项累加 |
| 最终聚焦回归 | 边界26 + 真实SQL19 + 表格4 + 当前首页契约1 | 4文件50项通过，final-boundaries.log；真实SQL每次检查基线哈希 |
| 新配置消费者 | 直方图/瀑布/KPI控件实际编辑，保存回调及原有formatByKey保留 | 组件配置测试及浏览器4项检查通过；实际OPFS保存/重启仍未验证 |
| 浏览器类型/尺寸矩阵 | 13注册类型+透视，760×440/560×360/280×240，实际SQL/rows/Spec/DOM；空/错查询、过滤/恢复、柱体点击、全屏 | 14展示方式42次绘制及附加断言通过，browser-matrix.json/log；未逐图完整像素语义验收，不计全局布局PASS |
| 新配置真实浏览器操作 | histogram区间和百分比独立计数、waterfall逐节点累计、KPI104270-104000=270、scatter原生拖拽返回9个真实记录ID | 4项通过，browser-controls.json、browser-controls-stable.log；截图等canvas稳定8帧后获取 |
| 生产页面 | 上传真实文件→预览136行→只读ATTACH→SQL按渠道聚合→实际图表 | 查询返回2行、绘制图表；加入看板明确失败B01，不计持久化PASS |
| 工程检查 | 最终生产源码类型检查和构建 | typecheck-final.log exit0；build.log成功，9152模块；既有WASM eval/大chunk警告保留 |
| 最终完整项目保护测试 | 不跳过用例，不以单次相关测试替代 | 258文件2443项全部通过，project-final.log，耗时1316.82秒；这不覆盖B01真实生产持久化失败 |

完整真实输入、实际 Spec、回调、SQL和计算结果存储在浏览器 JSON。单元/组件测试源码是预期结果的可执行记录，日志是实际 PASS/FAIL；它们包含有意构造的边界输入，不作为真实业务订单。生产错误见 [production-console.log](production-console.log)，实际失败通知/页面快照见 [production-readonly-blocker.yml](production-readonly-blocker.yml)。

稳定截图仍显示直方图内容宽于760视口，末尾一箱需滚动才能完整读取；实际复测视口758、内容835、scrollLeft=77，滚动后末箱及标签可见，证据 [browser-scroll.log](browser-scroll.log) 和 histogram-scrolled-1009.png。这是现有公共滚动策略，不能把初始截图认定为所有标签同时完整显示。没有通过缩小/删除数据含义让截图看似通过。所有密集/极端尺寸布局要求保持未验证。

本轮修改涉及的已跟踪文件 whitespace 检查通过。全工作区检查还发现其他原有文件的尾部空白/空行，未在本次任务中改动这些文件。测试日志中的 jsdom canvas 与模拟环境提示不作为真实像素/持久化验收证据。

## 4. 未通过与未验证

1. **FAIL/阻塞：只读数据库的首页及看板元数据写入。** 读取图表可用，当前保存流程不可用。需统一规定只读数据源的可写配置归属与隔离，不能在此轮擅自改成可写源库或以易失缓存冒充持久化。
2. **未实现：任意多级维度层级透视、任意不等宽直方图边界。** 当前二维透视和固定宽度配置不能冒称完整实现；是否属于原“区间”要求更宽语义也明确保留。
3. **部分实现/未验证：圆环中心选中项、真实业务漏斗下钻、全图表全部通道/非法计算语义组合。** 不新增静态演示冒充能力。
4. **未验证：全部生产入口、关系/流程/SVG、所有数据量/长标签/密集点/极端数值下的布局、缩放和全屏恢复。** 42次统计图绘制不是这些项的PASS证据。
5. **未验证：生产跨组件点击/框选/单元格筛选与取消恢复、数据库/数据集切换、字段删除、加载中及失败的全部竞争时序、OPFS重启和配置恢复。** 单独渲染回调和单独真实过滤不得拼接成全链路PASS。

因此全量行为覆盖、组件全部特性、全局布局、生产联动、状态隔离、持久化保护和最终全局复验均不能标为PASS，**不得宣称“全局修复完成”。**

## 5. 重复执行

```powershell
node scripts/audit-visualizations.mjs docs/visualization-governance-20261009/inventory-final.json
pnpm exec vitest run services/analysis/governanceBoundary.test.ts services/analysis/globalGovernance.integration.test.ts components/charts/ChartRenderer.visibility.test.tsx components/Dashboard/MissionControl/MissionControlBidirectionalFlow.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism
pnpm exec vitest run --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose
pnpm typecheck
pnpm build
node scripts/extract-visualization-evidence.mjs
```

浏览器独立会话先加载 `/DuckDB_Editor_Pro/test/global-visualization-real.html`，执行 `test/global-visualization-browser.js` 和 `test/global-visualization-controls-browser.js` 内的 async(page) 函数。必须检查返回的typeCount/renderChecks/checks，不能只看CLI exit0。配置操作测试等待画面稳定，读取实际引擎结果后独立计算预期。

本轮服务地址：<http://127.0.0.1:5173/DuckDB_Editor_Pro/>。生产入口和专用验收页面证据分开保留。
