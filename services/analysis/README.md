# Analysis Kernel (`services/analysis`)

**唯一**分析执行路径：**Analysis Spec → DuckDB SQL → Result → Chart Spec**。

组件与 AI **只修改 Spec**；禁止图表组件自行拼 SQL / 做聚合。旧 `analysisEngine` 已删除。

## 验收约定（本轮）

1. 任意分析查询只经 `runAnalysis` / `runAnalysisIntent` / `executeRecipe`（recipe 出口含 `chart`/`chartConfig`）
2. Pivot / TimeSeries / Recipe 图表面板消费 Registry 输出，禁止本地拼 encoding
3. `buildFieldCatalog` 驱动默认聚合与 dim/metric；Hub 选表后注入 catalog
4. `MetricBinding.calcId` 可引用 `expr` 计算字段；六种聚合 + 计算字段种类有编译测试
5. `resolveDataset` 对缺失表 fail-closed；AI Intent 默认 strict 校验 catalog.table
6. 联动协议：`applyLinkageEvent` / `applyBrush` / `applyDrill`（Spec 层；不做多图看板 UI）
7. 图表渲染唯一路径：`ChartSpec → adaptChartSpec → ChartRenderer`（Home / Analysis Hub 共用）
8. **不**仿 DataWind 堆筛选器 / 组件墙；扩展类型（funnel/waterfall/histogram/combo）经 Registry + Adapter，禁止业务组件写死

## 快速使用

```ts
import {
  createEmptySpec,
  runAnalysis,
  buildFieldCatalog,
  parseAndNormalize,
  applyBrush,
  applyLinkageEvent,
  pivotConfigToSpec,
  timeSeriesConfigToSpec,
  fetchTableOverview,
  executeRecipe,
} from '../services/analysis';

const catalog = await buildFieldCatalog('orders');
const spec = createEmptySpec({
  dataset: { table: 'orders' },
  fields: catalog.fields.map((f) => ({
    column: f.column,
    role: f.role,
    defaultAgg: f.defaultAgg,
    unitHint: f.unitHint,
  })),
  dimensions: [{ id: 'd0', column: 'region', alias: 'region' }],
  metrics: [{ id: 'm0', column: 'amount', agg: 'sum', alias: '总金额' }],
  calcs: [{ id: 'r', kind: 'ratio', alias: '占比', sourceMetricId: '总金额' }],
  filters: { global: [], cascade: [], interactive: [] },
  sort: [{ by: '总金额', order: 'desc' }],
  topN: { n: 20, by: '总金额' },
  visual: { chartType: 'bar', title: '区域销售' },
});

const result = await runAnalysis(spec);
// result.sql / result.rows / result.chart / result.chartConfig
```

AI 路径（禁止 LLM 直出 SQL）：

```ts
import { runAnalysisIntent, parseAndNormalize } from '../services/analysis';

const result = await runAnalysisIntent(llmJson, catalog); // strict table match by default
const spec = parseAndNormalize(llmJson, catalog, { strict: true });
```

Workbench 表单适配（仍进同一内核）：

```ts
const spec = pivotConfigToSpec(pivotForm);
const spec = timeSeriesConfigToSpec(timeSeriesForm);
await runAnalysis(spec);
```

联动：`applyBrush` / `applyDrill` / `applyGlobalFilter` / `applyLinkageEvent` → 新 Spec → `runAnalysis`。

Recipes：专用 SQL 允许，但必须经 `mapRecipeResultToChartSpec` 出口 `chart`/`chartConfig`。

## 模块

| 文件 | 职责 |
|------|------|
| `types.ts` | `AnalysisSpec` / `ChartSpec` / `CalcDef` / `LodJoinMeta` / `LinkageEvent` |
| `semantic.ts` | 维度/指标语义分类 |
| `datasetContext.ts` | 库 / Schema / 项目切换（缺失表抛错） |
| `fieldCatalog.ts` | 字段目录、单位、默认聚合 |
| `profiler.ts` | 表/列体检 |
| `recipes.ts` | Pareto / RFM / IQR / Histogram / Cohort → ChartSpec |
| `sqlCompiler.ts` | Spec → CTE SQL + `validateAnalysisSpec` |
| `calcCompiler.ts` | 计算字段、同比环比、占比、累计、排名、窗口、结构化 LOD |
| `chartRegistry.ts` | 图表注册表 + Result/Recipe→ChartSpec |
| `pipeline.ts` | `runAnalysis` / `runAnalysisIntent` |
| `linkage.ts` | 筛选 / 下钻 / 联动 patch |
| `aiIntent.ts` | Intent JSON → Spec（strict catalog） |
| `adapters/workbenchAdapter.ts` | Pivot / TimeSeries 表单 → Spec |

## 扩展图表（硬规则）

1. `registerChartType({ id, label, requiredEncodings, supports, mapResult })`
2. UI 只读 `listChartTypes()` / `getChartType(id)`，渲染 `result.chart` / `result.chartConfig`
3. **禁止**组件内 `duckDBService.query` 做分析聚合；一律 `runAnalysis(spec)`
4. 首批：`bar | line | area | doughnut | pie | scatter | table | kpi | counter | funnel | waterfall | histogram | combo`

## 首页 / Dashboard Widget

组件查询 SQL 可保留，但结果必须经 `enrichWidgetChartConfig(rows, chartConfig)` → Chart Spec → `getChartOptions` 渲染。禁止在 `DashboardWidget` 内私自算占比或拼 encoding。

## 可视化显示契约（引擎算、图表只展示）

- 统一 Formatter：`formatValueBySpec` / `ChartSpec.format` — Tooltip、Label、坐标轴同一套
- 饼/环：`sliceLabels` 含 `数值, 百分比`（按当前筛选结果由引擎重算）；圆环可显示 `centerTotal`
- 柱状：默认 `showValues` + `labelMode: auto`（避让外置）；正负值 `hasNegative` / `includeZero`
- 折线/面积：`missingValue: break | zero | forward_fill`；时间轴 `timeSorted`
- 堆叠：`stackMode: none | stack | percent`（percent 时 Y=0–100%）
- 联动：点击柱/扇区/透视单元格 → `onBrushFilter` 联动其他 Widget
- 空态：`emptyState: empty | all_null | error`，禁止残留旧图
- KPI：`formatValueBySpec` 显示指标名 + 值 + 单位

## 计算字段 (`CalcDef.kind`)

`expr` · `ratio` · `yoy` · `mom` · `cumulative` · `rank` · `moving` · `lod_fixed` · `lod_include` · `lod_exclude`

LOD 语义（DuckDB 近似，非完整 Tableau LOD）：

- `lod_fixed`：独立聚合 CTE + LEFT JOIN（结构化 `LodJoinMeta`，无字符串协议）
- `lod_include` / `lod_exclude`：窗口 `SUM(...) OVER (PARTITION BY ...)`
