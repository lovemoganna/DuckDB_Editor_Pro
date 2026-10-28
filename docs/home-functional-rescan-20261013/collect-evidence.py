from pathlib import Path
import difflib, hashlib, json, re, random

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent
modules = ['components/Dashboard.tsx', 'components/Dashboard/MissionControl/DataIdeMissionControl.tsx',
 'components/Dashboard/Home/HomeHeader.tsx', 'components/Dashboard/Home/HomeBoardCanvas.tsx',
 'components/Dashboard/Home/WorkspaceObjects.tsx', 'components/Dashboard/Home/WorkbenchControls.tsx',
 'components/Dashboard/Home/DatasetFieldChartBuilder.tsx', 'components/Dashboard/Home/DatasetPreview.tsx',
 'components/DashboardGrid.tsx', 'components/DashboardWidget.tsx',
 'components/Dashboard/WidgetChartConfigPanel.tsx', 'components/Dashboard/QuickTablePeekDrawer.tsx', 'hooks/useDashboardWorkflow.ts']
boundaries = {
 'services/duckdbService.ts': ['getTables','getCurrentCatalogAndSchema','listAnalysisContexts','switchAnalysisContext','readQuery','readQueryWithParams','readQueryBatchWithParams','query','getTableSchema','importFile','getRuntimeInfo','isBatchRunning'],
 'services/dbService.ts': ['getDashboards','saveDashboard','updateDashboard','getQueries','saveQuery','getDomainSetting','saveDomainSetting'],
 'services/homeDashboardService.ts': ['getOrCreateHomeDashboard','createHomeView','selectHomeView','addObjectToDashboard'],
 'services/analysisObjects.ts': ['listAnalysisObjects','saveObjectReference','resolveAnalysisObject','updateObjectPresentation'],
 'services/dynamicHome.ts': ['ensureDynamicHome'],
 'services/databaseAnalysis.ts': ['refreshDatabaseAnalysis'],
 'services/workbench/datasets.ts': ['loadDatasets','saveQueryDataset'],
 'services/workbench/runtime.ts': ['executeWidget'],
 'services/workbench/queryCompiler.ts': ['compileAnalysis','validateFilters'],
 'services/workbench/datasetGuards.ts': ['validateUniqueKeys'],
 'services/sqlWorkspaceService.ts': ['importSqlWorkspace'],
 'services/recentImportsService.ts': ['getImports','addImport'],
 'utils/sqlExporter.ts': ['exportCsv'],
 'services/executiveWorkspace.ts': ['openExecutiveWorkspace'],
}
api = []
for file, names in boundaries.items():
 lines = (root/file).read_text(encoding='utf-8-sig').splitlines()
 for name in names:
  pattern = re.compile(r'^\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?'+re.escape(name)+r'\s*(?:<|\(|=)')
  matches = [i for i,line in enumerate(lines) if pattern.search(line)]
  assert len(matches)==1, (file,name,matches)
  i=matches[0]
  api.append({'name':name,'file':file,'line':i+1,'signature':'\n'.join(lines[i:i+3])})
changes=[]
patch=[]
for before in sorted((out/'before').rglob('*.tsx')):
 relative=before.relative_to(out/'before')
 current=root/relative
 old=before.read_text(encoding='utf-8-sig')
 new=current.read_text(encoding='utf-8-sig')
 patch.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='before/'+relative.as_posix(),tofile=relative.as_posix()))
 changes.append({'file':relative.as_posix(),'before_sha256':hashlib.sha256(before.read_bytes()).hexdigest(),'after_sha256':hashlib.sha256(current.read_bytes()).hexdigest()})
(out/'changes.diff').write_text(''.join(patch),encoding='utf-8')
(out/'changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'inventory.json').write_text(json.dumps({'modules':modules,'service_boundaries':api},ensure_ascii=False,indent=2),encoding='utf-8')
inventory=['# 本次系统地图','', '首页顶层页面 1/1；挂载链与直接关联源模块 13/13；本地服务边界 %d/%d。'%(len(api),len(api)),
 '计数仅针对本报告明列范围，服务边界包括直接调用和必要下游数据入口，不包括所有内部辅助函数。静态检查不等于每项浏览器执行通过。','', '## 页面与组件','']
inventory += ['- `'+file+'`' for file in modules]
inventory += ['', '流向：App 的 Tab.DASHBOARD → Dashboard/useDashboardWorkflow → DataIdeMissionControl → HomeHeader/HomeBoardCanvas → WorkspaceObjects/WorkbenchControls/DatasetPreview/DashboardGrid → DashboardWidget/WidgetChartConfigPanel → 本地服务。',
 'QuickTablePeekDrawer 仍被 Dashboard 引用，但当前挂载链没有触发控件，作为直接关联组件检查并单列可达性限制。',
 '', '## 服务边界', '', '| 接口 | 当前证据位置 | 检查层次 |','|---|---|---|']
inventory += ['| `%s` | `%s:%d` | 调用、参数及返回边界静态复核；运行覆盖见报告 |'%(a['name'],a['file'],a['line']) for a in api]
inventory += ['', 'HTTP 业务端点：0；首页业务数据来自本地 DuckDB WASM。Vite 开发服务器不作为首页业务接口计数。',
 '', '## 数据对象','',
 '`types.ts`：Dashboard、DashboardItem、SavedQuery、ChartConfig、QueryHistoryItem；',
 '`services/workbench/analysisTypes.ts`：DatasetDefinition、DatasetField、AnalysisFilter、DashboardContext、WidgetSettings、WidgetQuerySpec、CompiledAnalysis；',
 '`services/workbench/currentDataset.ts`：CurrentDatasetContext；`services/analysisObjects.ts`：AnalysisObject、AnalysisRecord；',
 '`hooks/useDashboardWorkflow.ts`：TableItemDetail、DashboardDbMetrics、RecentQueryDisplayItem；`services/recentImportsService.ts`：RecentImportItem；`services/duckdbService.ts`：DuckDBRuntimeInfo。',
 '', '## 未扫描','',
 '数据、Schema、SQL、数据流、指标、分析中心、本体图谱、知识库、AI 独立页面内部；全仓库服务；未挂载的旧版仪表盘；通用图表渲染器全部类型内部；导入向导完整产品流程。原因：超出首页及关联功能边界。仅检查导航交接及首页采用的数据适配边界，不标记目标模块通过。']
(out/'system-map.md').write_text('\n'.join(inventory)+'\n',encoding='utf-8')
checks=[]
for round_no,ids in [(1,['R1','R2']),(2,['R1','R2','R3']),(3,['R1','R2','R3'])]:
 checks.append({'round':round_no,'seed':2026101310+round_no,'sample':random.Random(2026101310+round_no).sample(ids,min(5,len(ids))), 'reason':'少于五项，抽查全部已修复项'})
(out/'self-check-order.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':1,'modules':len(modules),'service_boundaries':len(api),'changed_product_files':len(changes),'self_check_order':checks},ensure_ascii=False))
