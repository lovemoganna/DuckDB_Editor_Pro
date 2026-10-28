# 首页系统地图与覆盖清单

范围内顶层页面：1（Tab.DASHBOARD），已扫描1。下列13个源模块均已作静态检查；其中WorkbenchControls包含FilterEditor、DashboardContextControls、DatasetComposer、DatasetWidgetBuilder、WidgetInstanceEditor五个组件。QuickTablePeekDrawer为首页直接引用但目前没有可达触发入口的关联组件，仅组件运行测试覆盖。

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

服务接口统计：37/37 个范围内调用的本地服务方法/导出函数完成契约边界检查；首页直接调用的HTTP业务端点为0（本地DuckDB WASM）。此统计不代表整仓库接口总数，不代表每个接口均完成浏览器端到端执行。内部纯辅助函数和导航回调不计入服务接口数量。

| 接口 | 证据位置 | 覆盖层次 |
|---|---|---|
| getTables | `services/duckdbService.ts:1047` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getCurrentCatalogAndSchema | `services/duckdbService.ts:3560` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| listAnalysisContexts | `services/duckdbService.ts:3570` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| switchAnalysisContext | `services/duckdbService.ts:3649` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| readQuery | `services/duckdbService.ts:839` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| readQueryBatchWithParams | `services/duckdbService.ts:3149` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| query | `services/duckdbService.ts:759` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getTableSchema | `services/duckdbService.ts:1294` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| importFile | `services/duckdbService.ts:1427` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getDashboards | `services/dbService.ts:224` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| saveDashboard | `services/dbService.ts:206` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| updateDashboard | `services/dbService.ts:212` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getQueries | `services/dbService.ts:184` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| saveQuery | `services/dbService.ts:179` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getDomainSetting | `services/dbService.ts:239` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| saveDomainSetting | `services/dbService.ts:233` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getOrCreateHomeDashboard | `services/homeDashboardService.ts:52` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| createHomeView | `services/homeDashboardService.ts:205` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| selectHomeView | `services/homeDashboardService.ts:217` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| addObjectToDashboard | `services/homeDashboardService.ts:194` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| listAnalysisObjects | `services/analysisObjects.ts:22` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| saveObjectReference | `services/analysisObjects.ts:85` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| resolveAnalysisObject | `services/analysisObjects.ts:43` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| updateObjectPresentation | `services/analysisObjects.ts:95` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| ensureDynamicHome | `services/dynamicHome.ts:7` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| refreshDatabaseAnalysis | `services/databaseAnalysis.ts:85` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| loadDatasets | `services/workbench/datasets.ts:8` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| saveQueryDataset | `services/workbench/datasets.ts:50` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| executeWidget | `services/workbench/runtime.ts:20` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| compileAnalysis | `services/workbench/queryCompiler.ts:111` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| validateFilters | `services/workbench/queryCompiler.ts:86` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| validateUniqueKeys | `services/workbench/datasetGuards.ts:6` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| importSqlWorkspace | `services/sqlWorkspaceService.ts:33` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| getImports | `services/recentImportsService.ts:17` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| addImport | `services/recentImportsService.ts:32` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| exportCsv | `utils/sqlExporter.ts:45` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |
| openExecutiveWorkspace | `services/executiveWorkspace.ts:9` | 静态调用与契约边界已检查；运行覆盖见测试及截图 |

数据对象：Dashboard、DashboardItem、SavedQuery、ChartConfig、QueryHistoryItem（types.ts）；DatasetDefinition、DatasetField、AnalysisFilter、DashboardContext、WidgetSettings、WidgetQuerySpec（services/workbench/analysisTypes.ts）；CurrentDatasetContext（services/workbench/currentDataset.ts）；AnalysisObject、AnalysisRecord（services/analysisObjects.ts）；TableItemDetail、DashboardDbMetrics、RecentQueryDisplayItem（hooks/useDashboardWorkflow.ts）；RecentImportItem（services/recentImportsService.ts）；DuckDBRuntimeInfo（services/duckdbService.ts）。检查了字段在首页调用链中的读取、写入和传递，未修改存储结构。

流向：App → Dashboard → useDashboardWorkflow → DuckDB/本地元数据；Dashboard → DataIdeMissionControl → HomeHeader + HomeBoardCanvas → WorkspaceObjects / DatasetPreview / DashboardGrid → DashboardWidget → executeWidget → compileAnalysis → 参数化只读查询。视图与组件写入通过现有updateDashboard串行队列。导航交接检查到App的handleNavigateWithContext边界，目标业务页内部不在本次范围。

未扫描：数据、Schema、SQL、数据流、指标、分析中心、本体图谱、知识库、AI等独立页面的内部实现；旧版未挂载的仪表盘展示模块（例如MissionControlKpis、LiveQueryStream、ExecutiveOverview等）；全仓库服务和全部图表类型。原因：用户限定首页及直接相关模块；只核对这些目标的首页交接，不标记目标页通过。导入向导仅验证首页入口与取消/禁用状态，不宣称整个导入产品流程通过。
