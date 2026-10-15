# DuckDB Editor Pro 可视化链路质量验收 BRD（远程基线试验）

基线：`main` @ `f9adcc42ac10693468ca0e0b6dcfaa5855bf222c`（2026-09-22）。这是远程快照，不代表 10 月本地工作区。

## 任务目标

系统性识别当前可视化组件的数据、计算、显示、交互和响应式缺陷；先修有证据的共享根因，再逐组件回归。不得把个别缺陷的修复宣称为全项目完成。

## 当前问题（代码已确认，不代表运行已验收）

1. `utils/chartUtils.ts` 的 `aggregate` 把 `null` 转为数值 0；非法值参与 `sum/avg/min/max` 后会传播 `NaN`。该函数同时被 ChartBuilder、ChartDashboard、DashboardWidget、AnalysisChartRenderer 使用。
2. `components/DashboardWidget.tsx` 的 `renderChart` 强制 `showLegend: true`，覆盖图表持久配置中的显隐设置。

## 方案与系统行为

1. 保留 DuckDB、Chart.js、既有 SQL 查询语义和现有组件架构。不得换引擎、硬编码业务结果、改变源数据或引入生产 Mock。
2. 对需要数值聚合的图表，有限合法数值参与计算；空值、空字符串、非数值和无穷值不计入 `sum/avg/min/max`。不存在合法数值时返回 `null`，避免制造错误的零值。无匹配分组的 `sum/count` 维持原有空组合为 0 的表现，`avg/min/max/none` 用 `null` 标识未定义。显式的数值 0 仍是有效值。`count` 原有按行数计数口径不变；`none` 仍取首行，首行无有效数值时显示 `null`。
3. DashboardWidget 的普通视图和全屏视图必须尊重 `ChartConfig.showLegend`：`false` 隐藏；`true` 或省略时显示。
4. 以复现先行、最小修复、自动测试和回归为顺序。其余标题、轴、Label、Tooltip、排序、布局、筛选、联动及数据集切换问题继续扫描，只有复现后才能修改。

## 约束与边界

本轮对真实远程仓库验证**两个已定位缺陷**，不表示所有可视化组件已完整修复。原始需求中的真实 DuckDB 数据、数据库/数据集切换、Chart Spec、全局筛选、下钻、响应式窗口和首页重用闭环仍需独立验证。没有真实运行/浏览器证据，不得判整体 PASS。

## 验收标准

1. `avg(10,null)` = 10；`min(10,null)` = 10；`sum(10,'N/A')` = 10。0 不被误删；只有空/非法值时 `sum/avg/min/max` 为 `null`；计数仍按输入行数。
2. 没有交叉分组匹配时，`avg` 不得伪装成 0；有匹配且值为 0 则保留 0。空输入仍返回空图表数据。
3. 保存了 `showLegend:false` 的柱状图，在仪表盘及全屏都不显示图例；`showLegend:true` 正常显示。
4. 上述复现用例在修复前失败，在修复后通过。运行 `pnpm typecheck`、`pnpm test:run`、`pnpm build`；每项必须附 CI 实际结果，任何失败不得宣称通过。

## 待核验

真实多数据库切换、实际 Google Sheets/XLSX 四表 `users/fiat_transactions/crypto_transactions/exchange_rates` 基线、端到端 SQL 到图表闭环、浏览器布局/交互与全量组件覆盖。这些要求没有在本轮被重新定义或取消。
