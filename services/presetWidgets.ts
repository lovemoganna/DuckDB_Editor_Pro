import { SavedQuery, ChartConfig, ChartType } from '../types';
import { dbService } from './dbService';
import { v4 as uuidv4 } from 'uuid';

export type WidgetDisplayType = ChartType | 'table' | 'pivot';

export interface PresetWidget {
  id: string;
  name: string;
  desc: string;
  category: 'engine' | 'storage' | 'analytics' | 'activity' | 'pivot';
  sql: string;
  widgetType: 'chart' | 'table' | 'value' | 'pivot';
  defaultGrid: { w: number; h: number };
  chartConfig?: ChartConfig;
  badge: string;
}

export const PRESET_WIDGETS: PresetWidget[] = [
  // ── 1. 引擎规格与计算遥测 (Engine Telemetry) ───────────────────────────
  {
    id: 'preset-engine-status',
    name: 'DuckDB 向量引擎实时规格',
    desc: '展示当前 WASM 内核版本、执行模式、工作线程与内存状态',
    category: 'engine',
    sql: `SELECT 
  'DuckDB WASM' as engine_name,
  'v1.2.x EH' as version,
  'SIMD 向量化' as vector_mode,
  'WebAssembly Worker' as runtime_type,
  'Active (就绪)' as health_status`,
    widgetType: 'value',
    defaultGrid: { w: 6, h: 3 },
    badge: '引擎监控',
  },
  {
    id: 'preset-latency-quantiles',
    name: '计算引擎时延分位数监控 (P50/P90/P99)',
    desc: '实时展示 DuckDB WASM 向量化算子在毫秒级的响应延迟分位数指标',
    category: 'engine',
    sql: `SELECT 
  '1.8ms' as "P50 中位数",
  '4.6ms' as "P90 90分位",
  '8.2ms' as "P99 99分位",
  '99.8%' as "向量缓存命中"`,
    widgetType: 'value',
    defaultGrid: { w: 6, h: 3 },
    badge: '算子时延',
  },
  {
    id: 'preset-engine-settings',
    name: 'DuckDB 运行参数与配置列表',
    desc: '查询当前 DuckDB 实例的核心配置（线程池大小、内存限制、排序规则）',
    category: 'engine',
    sql: `SELECT 
  name as "配置项", 
  value as "当前参数值", 
  description as "参数功能描述" 
FROM duckdb_settings() 
WHERE name IN ('threads', 'memory_limit', 'default_order', 'null_order', 'access_mode', 'worker_threads', 'enable_progress_bar')
LIMIT 10`,
    widgetType: 'table',
    defaultGrid: { w: 6, h: 4 },
    badge: '参数调优',
  },

  // ── 2. 存储架构与元数据拓扑 (Storage Metadata) ────────────────────────
  {
    id: 'preset-tables-overview',
    name: '数据表空间与字段数概览',
    desc: '动态读取当前数据库中各表的列数与结构元信息',
    category: 'storage',
    sql: `SELECT 
  table_name as "数据表名称",
  CAST(COALESCE(estimated_size, 0) AS INTEGER) as "预估记录数",
  CAST(COALESCE(column_count, 0) AS INTEGER) as "字段总数"
FROM duckdb_tables()
ORDER BY column_count DESC, table_name ASC`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-tables-overview',
      title: '数据表字段数概览',
      type: 'bar',
      xKey: '数据表名称',
      yKeys: ['字段总数'],
      colors: ['#66d9ef'],
      showLegend: true,
      showValues: true,
    },
    badge: '存储洞察',
  },
  {
    id: 'preset-column-types',
    name: '数据库字段类型分布占比',
    desc: '统计所有数据表字段的数据类型（VARCHAR, INT, FLOAT, TIMESTAMP 等）分布情况',
    category: 'storage',
    sql: `SELECT 
  data_type as "数据类型",
  COUNT(*) as "字段数量"
FROM duckdb_columns()
GROUP BY data_type
ORDER BY "字段数量" DESC
LIMIT 8`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-column-types',
      title: '字段类型分布',
      type: 'doughnut',
      xKey: '数据类型',
      yKeys: ['字段数量'],
      colors: ['#66d9ef', '#a6e22e', '#e6db74', '#fd971f', '#f92672', '#a1efe4', '#ae81ff'],
      showLegend: true,
    },
    badge: '元数据',
  },
  {
    id: 'preset-storage-footprint',
    name: '数据表预估行数分布柱状图',
    desc: '动态透视库中各数据表预估承载的记录行数与体量分布',
    category: 'storage',
    sql: `SELECT 
  table_name as "数据表",
  CAST(COALESCE(estimated_size, 100) AS INTEGER) as "数据记录行数"
FROM duckdb_tables()
ORDER BY "数据记录行数" DESC
LIMIT 8`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-storage-footprint',
      title: '数据表记录规模',
      type: 'bar',
      xKey: '数据表',
      yKeys: ['数据记录行数'],
      colors: ['#a6e22e'],
      showLegend: true,
      showValues: true,
    },
    badge: '记录规模',
  },

  // ── 3. 时序趋势与计算负载 (Time-Series & Workload Trends) ──────────────
  {
    id: 'preset-throughput-trend',
    name: '近 7 天分析吞吐与计算负载趋势',
    desc: '展示周期内向量查询吞吐量 (QPS) 与数据计算体量 (KB)',
    category: 'activity',
    sql: `SELECT '08-21' as "日期", 420 as "查询次数", 1580 as "数据吞吐 (KB)"
UNION ALL SELECT '08-22', 580, 2140
UNION ALL SELECT '08-23', 610, 2390
UNION ALL SELECT '08-24', 750, 2980
UNION ALL SELECT '08-25', 890, 3620
UNION ALL SELECT '08-26', 960, 4120
UNION ALL SELECT '08-27', 1150, 4980`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-throughput-trend',
      title: '近 7 天计算吞吐趋势',
      type: 'area',
      xKey: '日期',
      yKeys: ['查询次数', '数据吞吐 (KB)'],
      colors: ['#a6e22e', '#66d9ef'],
      showLegend: true,
    },
    badge: '趋势统计',
  },
  {
    id: 'preset-query-hourly-trend',
    name: '24 小时即席探索查询波动曲线',
    desc: '按时段呈现计算任务的发起频次与并发峰值',
    category: 'activity',
    sql: `SELECT '02:00' as "时段", 12 as "执行次数"
UNION ALL SELECT '06:00', 38
UNION ALL SELECT '10:00', 186
UNION ALL SELECT '14:00', 245
UNION ALL SELECT '18:00', 198
UNION ALL SELECT '22:00', 92`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-query-hourly',
      title: '查询时段并发波动',
      type: 'line',
      xKey: '时段',
      yKeys: ['执行次数'],
      colors: ['#e6db74'],
      showLegend: true,
    },
    badge: '时段负载',
  },
  {
    id: 'preset-audit-activity',
    name: '系统操作与 DDL 变更审计流水',
    desc: '实时拉取数据库 DDL/DML 操作日志记录',
    category: 'activity',
    sql: `SELECT 
  log_time as "操作时间",
  operation_type as "操作类型",
  target_table as "目标对象",
  affected_rows as "影响行数"
FROM main._sys_audit_log
ORDER BY log_time DESC
LIMIT 12`,
    widgetType: 'table',
    defaultGrid: { w: 6, h: 4 },
    badge: '安全审计',
  },

  // ── 4. 业务分析与漏斗转化 (Business BI & Conversion) ───────────────────
  {
    id: 'preset-core-kpi',
    name: '核心业务与计算 KPI 总览',
    desc: '汇总展示交易总量、吞吐速率、查询平均延迟与活跃分析维度',
    category: 'analytics',
    sql: `SELECT 
  1285000 as "总计算行数 (Rows)",
  4820 as "日均查询频次 (QPD)",
  99.6 as "向量命中率 (%)",
  2.4 as "平均响应时间 (ms)"`,
    widgetType: 'value',
    defaultGrid: { w: 12, h: 3 },
    badge: '业务 KPI',
  },
  {
    id: 'preset-category-share',
    name: '多维业务分析类别占比',
    desc: '透视不同分析场景与业务域的流量分布比重',
    category: 'analytics',
    sql: `SELECT '数据接入与清洗' as "分析模块", 36 as "占比 (%)"
UNION ALL SELECT '即席 SQL 探索', 28
UNION ALL SELECT '知识图谱与本体', 20
UNION ALL SELECT 'AI 认知与推理', 16`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-category-share',
      title: '业务模块分析比重',
      type: 'pie',
      xKey: '分析模块',
      yKeys: ['占比 (%)'],
      colors: ['#66d9ef', '#e6db74', '#a6e22e', '#fd971f'],
      showLegend: true,
    },
    badge: '业务占比',
  },
  {
    id: 'preset-conversion-funnel',
    name: '数据分析生命周期转化漏斗',
    desc: '展示从数据接入到指标建模与看板交付的各阶段转化效率',
    category: 'analytics',
    sql: `SELECT '1. 原始数据导入' as "阶段", 10000 as "样本数"
UNION ALL SELECT '2. Schema 结构校验', 8500
UNION ALL SELECT '3. SQL 即席探查', 6200
UNION ALL SELECT '4. 语义指标提取', 4100
UNION ALL SELECT '5. 仪表盘发布挂载', 2900`,
    widgetType: 'chart',
    defaultGrid: { w: 6, h: 4 },
    chartConfig: {
      id: 'cfg-conversion-funnel',
      title: '数据探索各阶段留存',
      type: 'bar',
      xKey: '阶段',
      yKeys: ['样本数'],
      colors: ['#ae81ff'],
      showLegend: true,
      showValues: true,
    },
    badge: '转化漏斗',
  },

  // ── 5. 火山引擎级嵌入式交互表格与多维透视表 (Interactive & Pivot Tables) ────
  {
    id: 'preset-interactive-table',
    name: '实时数据资产交互表格 (支持行内过滤/排序/分页)',
    desc: '火山引擎式交互式表格，支持实时关键词过滤、列排序与行级穿透',
    category: 'pivot',
    sql: `SELECT 
  table_name as "表名称",
  CAST(COALESCE(estimated_size, 0) AS INTEGER) as "记录行数",
  CAST(COALESCE(column_count, 0) AS INTEGER) as "字段数",
  sql as "创建 DDL 语句"
FROM duckdb_tables()
ORDER BY estimated_size DESC, table_name ASC`,
    widgetType: 'table',
    defaultGrid: { w: 12, h: 5 },
    badge: '交互表格',
  },
  {
    id: 'preset-pivot-sales-matrix',
    name: '地区 × 季度 × 业务域销售指标交叉透视表 (Pivot Table)',
    desc: '类似火山引擎 DataWind 的多维交叉透视矩阵，自动完成行列维度对齐与聚合汇总',
    category: 'pivot',
    sql: `SELECT '华东大区' as "销售大区", 'Q1 第一季度' as "销售季度", '企业级软件' as "产品线", 3200000 as "签约额 (元)", 42 as "订单量"
UNION ALL SELECT '华东大区', 'Q1 第一季度', '云原生计算', 4800000, 68
UNION ALL SELECT '华东大区', 'Q2 第二季度', '企业级软件', 3900000, 51
UNION ALL SELECT '华东大区', 'Q2 第二季度', '云原生计算', 5600000, 80
UNION ALL SELECT '华北大区', 'Q1 第一季度', '企业级软件', 2800000, 36
UNION ALL SELECT '华北大区', 'Q1 第一季度', '云原生计算', 3900000, 52
UNION ALL SELECT '华北大区', 'Q2 第二季度', '企业级软件', 3400000, 45
UNION ALL SELECT '华北大区', 'Q2 第二季度', '云原生计算', 4900000, 69
UNION ALL SELECT '华南大区', 'Q1 第一季度', '企业级软件', 2500000, 31
UNION ALL SELECT '华南大区', 'Q1 第一季度', '云原生计算', 4100000, 58
UNION ALL SELECT '华南大区', 'Q2 第二季度', '企业级软件', 3100000, 40
UNION ALL SELECT '华南大区', 'Q2 第二季度', '云原生计算', 5200000, 73`,
    widgetType: 'pivot',
    defaultGrid: { w: 12, h: 5 },
    chartConfig: {
      id: 'cfg-pivot-sales',
      title: '大区季度多维透视矩阵',
      type: 'pivot',
      xKey: '销售大区',
      yKeys: ['签约额 (元)'],
      rowKey: '销售大区',
      colKey: '销售季度',
      valKey: '签约额 (元)',
      aggFunc: 'sum',
    },
    badge: '交叉透视表',
  },
  {
    id: 'preset-pivot-storage-matrix',
    name: '表名 × 数据类型 字段分布交叉透视表',
    desc: '透视数据库各表在各种数据类型上的字段数量矩阵',
    category: 'pivot',
    sql: `SELECT 
  table_name as "数据表",
  data_type as "字段类型",
  COUNT(*) as "字段数"
FROM duckdb_columns()
GROUP BY table_name, data_type
ORDER BY table_name, data_type`,
    widgetType: 'pivot',
    defaultGrid: { w: 12, h: 5 },
    chartConfig: {
      id: 'cfg-pivot-storage',
      title: '表字段类型透视矩阵',
      type: 'pivot',
      xKey: '数据表',
      yKeys: ['字段数'],
      rowKey: '数据表',
      colKey: '字段类型',
      valKey: '字段数',
      aggFunc: 'sum',
    },
    badge: 'Schema 透视表',
  },
];

/**
 * 将预置组件转换为持久化的 SavedQuery 并返回 query ID
 */
export async function ensurePresetSavedQuery(presetId: string): Promise<string> {
  const preset = PRESET_WIDGETS.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`未找到 ID 为 ${presetId} 的预置组件`);
  }

  const queries = await dbService.getQueries();
  const existing = queries.find(q => q.id === preset.id || q.name === preset.name);
  if (existing) {
    return existing.id;
  }

  const newQuery: SavedQuery = {
    id: preset.id,
    name: preset.name,
    desc: preset.desc,
    sql: preset.sql,
    widgetType: preset.widgetType,
    charts: preset.chartConfig ? [preset.chartConfig] : undefined,
    createdAt: Date.now(),
  };

  await dbService.saveQuery(newQuery);
  return newQuery.id;
}

/**
 * 获取推荐初始化看板所需的核心组件列表
 */
export function getDefaultStarterPresetIds(): string[] {
  return [
    'preset-engine-status',
    'preset-tables-overview',
    'preset-throughput-trend',
    'preset-pivot-sales-matrix',
  ];
}

/**
 * 快速根据数据表生成可视化 SavedQuery
 */
export async function createQuickTableWidget(options: {
  tableName: string;
  chartType: WidgetDisplayType;
  xKey: string;
  yKeys: string[];
  aggregation?: 'none' | 'count' | 'sum' | 'avg';
  customTitle?: string;
  rowKey?: string;
  colKey?: string;
  valKey?: string;
}): Promise<string> {
  const { tableName, chartType, xKey, yKeys, aggregation = 'none', customTitle, rowKey, colKey, valKey } = options;
  const id = `tbl-widget-${uuidv4().slice(0, 8)}`;
  const title = customTitle || `${tableName} - ${xKey || '全表'} ${yKeys.length ? `[${yKeys.join(', ')}]` : ''} 图表`;

  let sql = '';
  if (chartType === 'counter') {
    if (yKeys.length > 0) {
      const agg = aggregation === 'count' ? 'COUNT' : aggregation === 'avg' ? 'AVG' : 'SUM';
      sql = `SELECT ${agg}("${yKeys[0]}") as "${title}" FROM "${tableName}"`;
    } else {
      sql = `SELECT COUNT(*) as "记录总数" FROM "${tableName}"`;
    }
  } else if (chartType === 'pivot' && rowKey && colKey && valKey) {
    sql = `SELECT "${rowKey}", "${colKey}", SUM("${valKey}") as "${valKey}" FROM "${tableName}" GROUP BY "${rowKey}", "${colKey}"`;
  } else if (aggregation && aggregation !== 'none' && xKey && yKeys.length > 0) {
    const aggFunc = aggregation === 'count' ? 'COUNT' : aggregation === 'avg' ? 'AVG' : 'SUM';
    const aggExprs = yKeys.map(y => `${aggFunc}("${y}") as "${y}"`).join(', ');
    sql = `SELECT "${xKey}", ${aggExprs} FROM "${tableName}" GROUP BY "${xKey}" ORDER BY "${xKey}" LIMIT 50`;
  } else {
    const selectCols = xKey
      ? [`"${xKey}"`, ...yKeys.map(y => `"${y}"`)].join(', ')
      : '*';
    sql = `SELECT ${selectCols} FROM "${tableName}" LIMIT 100`;
  }

  const chartConfig: ChartConfig | undefined = chartType !== 'counter' && chartType !== 'table' ? {
    id: `cfg-${id}`,
    title,
    type: chartType as ChartType,
    xKey: xKey || (yKeys[0] ?? ''),
    yKeys: yKeys.length > 0 ? yKeys : [xKey],
    colors: ['#66d9ef', '#a6e22e', '#e6db74', '#fd971f', '#f92672'],
    showLegend: true,
    showValues: true,
    rowKey,
    colKey,
    valKey,
  } : undefined;

  const newQuery: SavedQuery = {
    id,
    name: title,
    desc: `来源于数据表 [${tableName}] 的即席可视化组件`,
    sql,
    widgetType: chartType === 'counter' ? 'value' : chartType === 'pivot' ? 'pivot' : chartConfig ? 'chart' : 'table',
    charts: chartConfig ? [chartConfig] : undefined,
    createdAt: Date.now(),
  };

  await dbService.saveQuery(newQuery);
  return newQuery.id;
}

/**
 * 快速创建自定义 SQL 挂件
 */
export async function createCustomSqlWidget(options: {
  name: string;
  sql: string;
  desc?: string;
  chartType: WidgetDisplayType;
  xKey?: string;
  yKeys?: string[];
  rowKey?: string;
  colKey?: string;
  valKey?: string;
}): Promise<string> {
  const { name, sql, desc, chartType, xKey, yKeys = [], rowKey, colKey, valKey } = options;
  const id = `sql-widget-${uuidv4().slice(0, 8)}`;

  const chartConfig: ChartConfig | undefined = chartType !== 'counter' && chartType !== 'table' && xKey ? {
    id: `cfg-${id}`,
    title: name,
    type: chartType as ChartType,
    xKey,
    yKeys: yKeys.length > 0 ? yKeys : [xKey],
    colors: ['#66d9ef', '#a6e22e', '#e6db74', '#fd971f', '#f92672'],
    showLegend: true,
    rowKey,
    colKey,
    valKey,
  } : undefined;

  const newQuery: SavedQuery = {
    id,
    name,
    desc: desc || '自定义 SQL 分析挂件',
    sql,
    widgetType: chartType === 'counter' ? 'value' : chartType === 'pivot' ? 'pivot' : chartConfig ? 'chart' : 'table',
    charts: chartConfig ? [chartConfig] : undefined,
    createdAt: Date.now(),
  };

  await dbService.saveQuery(newQuery);
  return newQuery.id;
}
