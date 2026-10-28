# 本次系统地图

首页顶层页面 1/1；挂载链与直接关联源模块 13/13；本地服务边界 40/40。
计数仅针对本报告明列范围，服务边界包括直接调用和必要下游数据入口，不包括所有内部辅助函数。静态检查不等于每项浏览器执行通过。

## 页面与组件

- `components/Dashboard.tsx`
- `components/Dashboard/MissionControl/DataIdeMissionControl.tsx`
- `components/Dashboard/Home/HomeHeader.tsx`
- `components/Dashboard/Home/HomeBoardCanvas.tsx`
- `components/Dashboard/Home/WorkspaceObjects.tsx`
- `components/Dashboard/Home/WorkbenchControls.tsx`
- `components/Dashboard/Home/DatasetFieldChartBuilder.tsx`
- `components/Dashboard/Home/DatasetPreview.tsx`
- `components/DashboardGrid.tsx`
- `components/DashboardWidget.tsx`
- `components/Dashboard/WidgetChartConfigPanel.tsx`
- `components/Dashboard/QuickTablePeekDrawer.tsx`
- `hooks/useDashboardWorkflow.ts`

流向：App 的 Tab.DASHBOARD → Dashboard/useDashboardWorkflow → DataIdeMissionControl → HomeHeader/HomeBoardCanvas → WorkspaceObjects/WorkbenchControls/DatasetPreview/DashboardGrid → DashboardWidget/WidgetChartConfigPanel → 本地服务。
QuickTablePeekDrawer 仍被 Dashboard 引用，但当前挂载链没有触发控件，作为直接关联组件检查并单列可达性限制。

## 服务边界

| 接口 | 当前证据位置 | 检查层次 |
|---|---|---|
| `getTables` | `services/duckdbService.ts:1047` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getCurrentCatalogAndSchema` | `services/duckdbService.ts:3560` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `listAnalysisContexts` | `services/duckdbService.ts:3570` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `switchAnalysisContext` | `services/duckdbService.ts:3649` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `readQuery` | `services/duckdbService.ts:839` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `readQueryWithParams` | `services/duckdbService.ts:3138` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `readQueryBatchWithParams` | `services/duckdbService.ts:3149` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `query` | `services/duckdbService.ts:759` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getTableSchema` | `services/duckdbService.ts:1294` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `importFile` | `services/duckdbService.ts:1427` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getRuntimeInfo` | `services/duckdbService.ts:140` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `isBatchRunning` | `services/duckdbService.ts:136` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getDashboards` | `services/dbService.ts:224` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `saveDashboard` | `services/dbService.ts:206` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `updateDashboard` | `services/dbService.ts:212` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getQueries` | `services/dbService.ts:184` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `saveQuery` | `services/dbService.ts:179` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getDomainSetting` | `services/dbService.ts:239` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `saveDomainSetting` | `services/dbService.ts:233` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getOrCreateHomeDashboard` | `services/homeDashboardService.ts:52` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `createHomeView` | `services/homeDashboardService.ts:205` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `selectHomeView` | `services/homeDashboardService.ts:217` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `addObjectToDashboard` | `services/homeDashboardService.ts:194` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `listAnalysisObjects` | `services/analysisObjects.ts:22` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `saveObjectReference` | `services/analysisObjects.ts:85` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `resolveAnalysisObject` | `services/analysisObjects.ts:43` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `updateObjectPresentation` | `services/analysisObjects.ts:95` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `ensureDynamicHome` | `services/dynamicHome.ts:7` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `refreshDatabaseAnalysis` | `services/databaseAnalysis.ts:85` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `loadDatasets` | `services/workbench/datasets.ts:8` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `saveQueryDataset` | `services/workbench/datasets.ts:50` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `executeWidget` | `services/workbench/runtime.ts:20` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `compileAnalysis` | `services/workbench/queryCompiler.ts:111` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `validateFilters` | `services/workbench/queryCompiler.ts:86` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `validateUniqueKeys` | `services/workbench/datasetGuards.ts:6` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `importSqlWorkspace` | `services/sqlWorkspaceService.ts:33` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `getImports` | `services/recentImportsService.ts:17` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `addImport` | `services/recentImportsService.ts:32` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `exportCsv` | `utils/sqlExporter.ts:45` | 调用、参数及返回边界静态复核；运行覆盖见报告 |
| `openExecutiveWorkspace` | `services/executiveWorkspace.ts:9` | 调用、参数及返回边界静态复核；运行覆盖见报告 |

HTTP 业务端点：0；首页业务数据来自本地 DuckDB WASM。Vite 开发服务器不作为首页业务接口计数。

## 数据对象

`types.ts`：Dashboard、DashboardItem、SavedQuery、ChartConfig、QueryHistoryItem；
`services/workbench/analysisTypes.ts`：DatasetDefinition、DatasetField、AnalysisFilter、DashboardContext、WidgetSettings、WidgetQuerySpec、CompiledAnalysis；
`services/workbench/currentDataset.ts`：CurrentDatasetContext；`services/analysisObjects.ts`：AnalysisObject、AnalysisRecord；
`hooks/useDashboardWorkflow.ts`：TableItemDetail、DashboardDbMetrics、RecentQueryDisplayItem；`services/recentImportsService.ts`：RecentImportItem；`services/duckdbService.ts`：DuckDBRuntimeInfo。

## 未扫描

数据、Schema、SQL、数据流、指标、分析中心、本体图谱、知识库、AI 独立页面内部；全仓库服务；未挂载的旧版仪表盘；通用图表渲染器全部类型内部；导入向导完整产品流程。原因：超出首页及关联功能边界。仅检查导航交接及首页采用的数据适配边界，不标记目标模块通过。
