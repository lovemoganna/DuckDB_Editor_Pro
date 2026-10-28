# 首页系统地图

统计只覆盖本次范围，不代表全系统通过。HTTP 业务接口为 0：该流程在浏览器中调用本地 DuckDB/WASM 服务。33 为列明的本地服务接口数，不包括辅助函数、React 回调、其他页面接口或传递依赖中的全部方法。接口扫描包含调用方、相关实现、字段与参数核对；不表示 33 个接口都逐个完成浏览器故障注入。

入口：[App.tsx:1021](C:/Users/luoyu/Desktop/Duckdb_Manager/duckdb-editor/App.tsx:1021) → Dashboard → useDashboardWorkflow → DataIdeMissionControl → HomeHeader / HomeBoardCanvas → WorkspaceObjects / DatasetPreview / DashboardGrid → DashboardWidget。

页面：Tab.DASHBOARD（1/1）。直接子视图（11/11 已做代码扫描与运行入口观察）：分析范围菜单、视图设置、分析内容库、组合 SQL 数据集、明细预览、字段图表创建/编辑、统一筛选、组件菜单、组件实例设置、字段/单位配置、全屏明细。导入作为关联入口验证，导入器其他格式不据此标记通过。

## 组件

- components/Dashboard.tsx：Dashboard。
- components/Dashboard/MissionControl/DataIdeMissionControl.tsx：DataIdeMissionControl。
- components/Dashboard/Home/HomeHeader.tsx：HomeHeader。
- components/Dashboard/Home/HomeBoardCanvas.tsx：HomeBoardCanvas。
- components/Dashboard/Home/WorkspaceObjects.tsx：WorkspaceObjects。
- components/Dashboard/Home/WorkbenchControls.tsx：FilterEditor, DashboardContextControls, DatasetComposer, DatasetWidgetBuilder, WidgetInstanceEditor。
- components/Dashboard/Home/DatasetFieldChartBuilder.tsx：DatasetFieldChartBuilder。
- components/Dashboard/Home/DatasetPreview.tsx：DatasetPreview。
- components/DashboardGrid.tsx：DashboardGrid。
- components/DashboardWidget.tsx：DashboardWidget。
- components/Dashboard/WidgetChartConfigPanel.tsx：WidgetChartConfigPanel。
- components/Dashboard/StudioBottomBar.tsx：StudioBottomBar。

## 本地服务接口（33/33 已静态核对相关调用路径）

- services/duckdbService.ts：getTables, getCurrentCatalogAndSchema, listAnalysisContexts, readQuery, readQueryWithParams, readQueryBatchWithParams, importFile, switchAnalysisContext, getRuntimeInfo, isBatchRunning。
- services/dbService.ts：getDashboards, saveDashboard, updateDashboard, getQueries, saveQuery, getDomainSetting, saveDomainSetting。
- services/homeDashboardService.ts：getOrCreateHomeDashboard, createHomeView, selectHomeView, addObjectToDashboard。
- services/workbench/datasets.ts：loadDatasets, saveQueryDataset。
- services/workbench/queryCompiler.ts：compileAnalysis, validateFilters, analysisSqlForEditor。
- services/workbench/runtime.ts：executeWidget。
- services/workbench/datasetGuards.ts：validateUniqueKeys。
- services/analysisObjects.ts：listAnalysisObjects, resolveAnalysisObject, updateObjectPresentation。
- services/databaseAnalysis.ts：refreshDatabaseAnalysis。
- services/dynamicHome.ts：ensureDynamicHome。

## 数据对象

Dashboard / DashboardItem / SavedQuery / ChartConfig：types.ts；DatasetDefinition / AnalysisFilter / DashboardContext / WidgetSettings / WidgetQuerySpec：services/workbench/analysisTypes.ts；TableItemDetail：hooks/useDashboardWorkflow.ts；AnalysisObject：services/analysisObjects.ts；QueryHistoryItem：types.ts；DuckDBRuntimeInfo：services/duckdbService.ts。共 13 类，均为现有对象，本次没有结构变更。

数据流：DuckDB catalog / schema / 表 → loadDatasets / 元数据读取 → 统一编译器 → 参数化只读执行 → 预览与组件。看板、查询和设置使用现有 __studio.objects；历史查询与临时 UI 状态沿用现有 store。对象更新事件触发快照重载；布局和实例设置沿用 updateDashboard 的串行写入。

## 边界

数据、Schema、SQL、图谱、分析中心、指标、数据流仅核对首页的路由/上下文接线，不深入审查目标页面。独立 ChartDashboard、未挂载的旧版 Home/MissionControl 区块、QuickTablePeekDrawer、AI/知识模块、权限和账号系统、远程导入与其他导入格式均不计入通过数。共享组件仅查本流程使用处，不扫描其余消费者。
