import type { MetricDefinition, MetricPackage } from '../../types';
import type { MetricAggregation, MetricCalculation, MetricGovernance } from '../../types/metric';
import type { PivotDefinition, PivotDimension } from './pivotExperience';
import { getPivotRowDimensions } from './pivotExperience';
import { quoteIdent, quoteTable } from './sqlUtils';
import { readMetricAssets, writeMetricAssets, activeAnalysisDatabase } from '../metricAssetStorage';
import { semanticMetricCatalog } from '../semanticMetricCatalog';

const AGG_MAP: Record<string, MetricAggregation> = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  count_distinct: 'COUNT DISTINCT',
  min: 'MIN',
  max: 'MAX',
};

/**
 * 将透视表中的过滤条件编译为 DuckDB SQL 过滤子句
 */
export function compilePivotFiltersToSql(filters: PivotDefinition['filters']): string {
  if (!filters || filters.length === 0) return '';
  const clauses = filters
    .map(f => {
      const col = quoteIdent(f.column);
      if (f.op === 'is_null') return `${col} IS NULL`;
      if (f.op === 'not_null') return `${col} IS NOT NULL`;
      if (f.op === 'contains') return `${col} LIKE '%${f.value.replace(/'/g, "''")}%'`;
      const escapedVal = f.value.replace(/'/g, "''");
      const num = Number(f.value);
      const valSql = !isNaN(num) && f.value.trim() !== '' ? num : `'${escapedVal}'`;
      return `${col} ${f.op} ${valSql}`;
    })
    .filter(Boolean);
  return clauses.join(' AND ');
}

export interface PivotMetricExtractionResult {
  metric: MetricDefinition;
  generatedSql: string;
  sourceTable: string;
  suggestedPackageName: string;
}

/**
 * 从透视表配置智能推导出高价值的标准化业务指标
 */
export function extractMetricFromPivot(
  definition: PivotDefinition,
  metricIndex?: number
): PivotMetricExtractionResult {
  const targetMetricIndex = metricIndex ?? definition.visibleMetric ?? 0;
  const currentMetric = definition.metrics[targetMetricIndex] || definition.metrics[0];
  const agg = (currentMetric?.agg ? AGG_MAP[currentMetric.agg] : undefined) || 'COUNT';
  const field = currentMetric?.column;

  // 1. 提取所有维度
  const rowDims = getPivotRowDimensions(definition);
  const allDims: PivotDimension[] = [...rowDims];
  if (definition.column) {
    allDims.push(definition.column);
  }

  // 2. 检测是否存在时间粒度字段
  let timeField: string | undefined;
  let grain: MetricCalculation['grain'] | undefined;
  const groupByDims: string[] = [];

  for (const dim of allDims) {
    if (dim.dateTrunc && !timeField) {
      timeField = dim.column;
      grain = dim.dateTrunc as MetricCalculation['grain'];
    } else {
      if (!groupByDims.includes(dim.column)) {
        groupByDims.push(dim.column);
      }
    }
  }

  // 3. 提取过滤条件
  const filterSql = compilePivotFiltersToSql(definition.filters);

  // 4. 来源表识别
  const isJoined = Boolean(definition.joinConfig?.enabled);
  const primaryTable = definition.source.table || definition.source.name || 'main_table';
  const secondaryTable = definition.joinConfig?.secondaryTable;
  const sourceTable = isJoined && secondaryTable ? `${primaryTable} ⋈ ${secondaryTable}` : primaryTable;

  // 5. 组装 MetricCalculation
  const calculation: MetricCalculation = {
    aggregation: agg,
    field: agg === 'COUNT' && !field ? undefined : field,
    filter: filterSql || undefined,
    groupBy: groupByDims.length ? groupByDims : undefined,
    timeField,
    grain,
    transform: 'none',
  };

  // 6. 治理属性
  const isAdditive = agg === 'SUM' || agg === 'COUNT';
  const governance: MetricGovernance = {
    role: 'outcome',
    additivity: isAdditive ? 'additive' : 'non_additive',
    reviewStatus: 'draft',
    sourceGrain: timeField ? `按${grain || '周期'}聚合` : '明细快照',
  };

  // 7. 智能推荐指标命名与描述
  const dimNames = allDims.map(d => d.column).join(' / ');
  const metricLabel = currentMetric?.alias || `${field || '记录'} ${agg}`;
  const suggestedName = dimNames ? `${metricLabel} (按 ${dimNames})` : metricLabel;
  const unit = currentMetric?.decimals !== undefined && currentMetric.decimals === 0 ? '个' : '';

  // 8. 编译可直接执行的只读标准 SQL
  let operand = field ? quoteIdent(field) : '*';
  let aggExpr = agg === 'COUNT DISTINCT' ? `COUNT(DISTINCT ${operand})` : `${agg}(${operand})`;
  if (agg === 'COUNT' && !field) aggExpr = 'COUNT(*)';

  const selectCols: string[] = [];
  if (timeField && grain) {
    selectCols.push(`date_trunc('${grain}', ${quoteIdent(timeField)}) AS period`);
  }
  for (const g of groupByDims) {
    selectCols.push(quoteIdent(g));
  }
  selectCols.push(`${aggExpr} AS ${quoteIdent(currentMetric?.alias || 'value')}`);

  let fromClause = '';
  if (isJoined && definition.joinConfig && secondaryTable) {
    const { primaryKey, secondaryKey, joinType } = definition.joinConfig;
    fromClause = `FROM ${quoteTable(primaryTable)} p\n${joinType} JOIN ${quoteTable(secondaryTable)} s ON p.${quoteIdent(primaryKey)} = s.${quoteIdent(secondaryKey)}`;
  } else {
    fromClause = `FROM ${quoteTable(primaryTable)}`;
  }

  const whereClause = filterSql ? `\nWHERE ${filterSql}` : '';
  const groupPositions = selectCols.slice(0, -1).map((_, i) => i + 1).join(', ');
  const groupByClause = groupPositions ? `\nGROUP BY ${groupPositions}\nORDER BY ${groupPositions}` : '';

  const generatedSql = `-- 【透视表沉淀指标】: ${suggestedName}
-- 聚合口径: ${agg} ${field ? `(${field})` : ''}
-- 维度拆解: ${dimNames || '全局统计'}
-- 数据治理: ${isAdditive ? '完全可加 (Additive)' : '非加法指标 (Non-additive，切勿简单求和)'}
SELECT
  ${selectCols.join(',\n  ')}
${fromClause}${whereClause}${groupByClause};`;

  const suggestedPackageName = `${primaryTable} 业务指标包`;

  const metric: MetricDefinition = {
    id: `metric_pivot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: suggestedName,
    scenario: `源自透视表多维交叉分析，用于监控「${sourceTable}」的核心业务度量走势。`,
    characteristics: isAdditive ? '完全可加 (支持沿各维度自由累加求和)' : '非加法指标 (均值/去重指标，严禁跨维度直接累加)',
    value: `统一数据消费口径，经透视表交互验证，避免编写复杂 SQL 导致统计口径失真或多表笛卡尔积膨胀。`,
    definition: `基于 ${sourceTable} 计算 ${agg}(${field || '*'})${filterSql ? `，口径筛选条件：${filterSql}` : ''}。${dimNames ? `按 ${dimNames} 维度进行聚合拆解。` : ''}`,
    formula: generatedSql,
    example: `在 SQL 查询中引用该口径聚合结果进行业务看板展示或下钻探查。`,
    dependencies: isJoined && secondaryTable ? [primaryTable, secondaryTable] : [primaryTable],
    sourceTable: primaryTable,
    unit: unit || undefined,
    category: '核心业务',
    calculation,
    governance,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };

  return {
    metric,
    generatedSql,
    sourceTable,
    suggestedPackageName,
  };
}

/**
 * 将沉淀出的指标保存至 MetricManager 指标包中
 */
export function saveMetricFromPivot(
  metric: MetricDefinition,
  targetPackageId?: string,
  newPackageName?: string
): { packageId: string; metricId: string } {
  const packages = readMetricAssets<MetricPackage>('duckdb_metric_packages');
  const catalog = activeAnalysisDatabase();
  let updatedPackages: MetricPackage[] = [];
  let finalPackageId = targetPackageId;

  const targetPkg = targetPackageId ? packages.find(p => p.id === targetPackageId) : undefined;

  if (targetPkg) {
    const updatedMetric = semanticMetricCatalog.versionMetric(
      targetPkg.metrics.find(m => m.id === metric.id) || metric,
      metric
    );
    const existingIdx = targetPkg.metrics.findIndex(m => m.id === metric.id);
    const newMetrics = existingIdx >= 0
      ? targetPkg.metrics.map((m, i) => (i === existingIdx ? updatedMetric : m))
      : [...targetPkg.metrics, updatedMetric];

    const sourceTables = Array.from(new Set([...(targetPkg.sourceTables || []), ...(metric.dependencies || [])]));
    updatedPackages = packages.map(p =>
      p.id === targetPkg.id
        ? { ...p, metrics: newMetrics, sourceTables, updatedAt: Date.now() }
        : p
    );
  } else {
    finalPackageId = `pkg_pivot_${Date.now()}`;
    const newPkg: MetricPackage = {
      id: finalPackageId,
      name: newPackageName?.trim() || `${metric.sourceTable || '透视沉淀'} 指标包`,
      description: '由透视表分析交互一键沉淀的标准业务指标集合',
      databaseName: catalog,
      sourceTables: metric.dependencies || (metric.sourceTable ? [metric.sourceTable] : []),
      metrics: [metric],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    updatedPackages = [...packages, newPkg];
  }

  writeMetricAssets('duckdb_metric_packages', updatedPackages, 'duckdb-metrics-updated');
  return { packageId: finalPackageId!, metricId: metric.id };
}
