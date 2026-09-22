/**
 * analysisEngine.ts
 * 核心分析引擎：提供 DuckDB WASM 本地极速数据画像、多维透视聚合、时序窗口分析与业务场景配方执行。
 */

import { duckDBService } from '../../services/duckdbService';
import type { ColumnInfo } from '../../types';

// ============================================================
// Types
// ============================================================

export type ColumnSemanticType = 'numeric' | 'temporal' | 'categorical' | 'boolean' | 'identifier' | 'text';

export interface ColumnProfile {
  name: string;
  type: string;
  semanticType: ColumnSemanticType;
  rowCount: number;
  nonNullCount: number;
  nullCount: number;
  nullRate: number; // 0 - 100
  distinctCount: number;
  cardinalityRate: number; // distinctCount / rowCount
  isPrimaryKeyCandidate: boolean;
  min?: number | string | null;
  max?: number | string | null;
  avg?: number | null;
  median?: number | null;
  topValues: { value: string; count: number; ratio: number }[];
  sparkline?: number[]; // 8-bucket frequency distribution for numeric columns
}

export interface TableOverview {
  tableName: string;
  rowCount: number;
  columnCount: number;
  estimatedMemoryKb: number;
  pkColumns: string[];
  healthScore: number; // 0 - 100
  completenessRate: number;
}

export interface PivotDimension {
  column: string;
  dateTrunc?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface PivotMetric {
  column?: string;
  agg: 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';
  alias: string;
}

export interface PivotFilter {
  column: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'not_null' | 'is_null';
  value: string;
}

export interface PivotQueryConfig {
  tableName: string;
  rowDimensions: PivotDimension[];
  metrics: PivotMetric[];
  filters?: PivotFilter[];
  sortMetric?: string;
  sortOrder?: 'asc' | 'desc';
  limit: number;
}

export interface CrossTabPivotConfig {
  tableName: string;
  rowDimension: string;
  rowDateTrunc?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  colDimension: string;
  colDateTrunc?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metricCol?: string;
  agg: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';
  metricAlias?: string;
  filters?: PivotFilter[];
  limitRows?: number;
}

export interface CrossTabPivotResult {
  sql: string;
  rowDimensionName: string;
  colDimensionName: string;
  rowHeaders: string[];
  colHeaders: string[];
  matrix: (number | null)[][]; // rows x cols
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  minVal: number;
  maxVal: number;
  executionTimeMs: number;
}

export interface DrillDownFilter {
  column: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'is_null' | 'not_null';
  value?: any;
}

export interface DrillDownConfig {
  tableName: string;
  filters: DrillDownFilter[];
  title?: string;
  description?: string;
  limit?: number;
}

export interface TimeSeriesConfig {
  tableName: string;
  timeColumn: string;
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  valueColumn: string;
  aggFunc: 'sum' | 'avg' | 'count' | 'min' | 'max';
  windowMode: 'raw' | 'mom' | 'moving_avg' | 'cumulative';
}

export interface RecipeParamDef {
  key: string;
  label: string;
  description: string;
  type: 'column_select' | 'number' | 'select';
  filterType?: 'numeric' | 'temporal' | 'categorical' | 'any';
  options?: { label: string; value: any }[];
  defaultValue?: any;
}

export interface RecipeMetadata {
  id: 'pareto' | 'rfm' | 'iqr' | 'histogram' | 'cohort';
  title: string;
  badge: string;
  description: string;
  applicableScenario: string;
  icon: string;
  params: RecipeParamDef[];
}

// ============================================================
// Semantic Classification Helper
// ============================================================

export function classifySemanticType(colName: string, colType: string): ColumnSemanticType {
  const upperType = colType.toUpperCase();
  const lowerName = colName.toLowerCase();

  if (
    upperType.includes('INT') ||
    upperType.includes('FLOAT') ||
    upperType.includes('DOUBLE') ||
    upperType.includes('DECIMAL') ||
    upperType.includes('NUMERIC') ||
    upperType.includes('REAL') ||
    upperType.includes('HUGEINT')
  ) {
    if (lowerName.endsWith('_id') || lowerName === 'id') {
      return 'identifier';
    }
    return 'numeric';
  }

  if (
    upperType.includes('DATE') ||
    upperType.includes('TIME') ||
    upperType.includes('TIMESTAMP')
  ) {
    return 'temporal';
  }

  if (upperType.includes('BOOL')) {
    return 'boolean';
  }

  if (lowerName.endsWith('_id') || lowerName === 'id' || lowerName.endsWith('uuid') || lowerName.endsWith('code')) {
    return 'identifier';
  }

  return 'categorical';
}

// ============================================================
// Engine Implementation
// ============================================================

export class AnalysisEngine {
  /**
   * 获取表的全景基础指标与健康度
   */
  async fetchTableOverview(tableName: string, schema: ColumnInfo[]): Promise<TableOverview> {
    const escapedTable = `"${tableName.replace(/"/g, '""')}"`;
    const countSql = `SELECT COUNT(*) AS total_rows FROM ${escapedTable}`;
    const res = await duckDBService.readQuery(countSql);
    const rowCount = Number(res?.[0]?.total_rows || 0);

    const pkColumns = schema.filter(c => c.pk).map(c => c.name);

    // 计算全表平均完备率 (非空率)
    let completenessRate = 100;
    if (rowCount > 0 && schema.length > 0) {
      const nullColsSelect = schema
        .map(c => `COUNT(CASE WHEN "${c.name.replace(/"/g, '""')}" IS NULL THEN 1 END) AS "${c.name}_nulls"`)
        .join(', ');
      try {
        const nullRes = await duckDBService.readQuery(`SELECT ${nullColsSelect} FROM ${escapedTable}`);
        if (nullRes?.[0]) {
          let totalNulls = 0;
          schema.forEach(c => {
            totalNulls += Number(nullRes[0][`${c.name}_nulls`] || 0);
          });
          const totalCells = rowCount * schema.length;
          completenessRate = totalCells > 0 ? Math.round(((totalCells - totalNulls) / totalCells) * 1000) / 10 : 100;
        }
      } catch (err) {
        console.warn('[AnalysisEngine] Null audit skipped:', err);
      }
    }

    // 简单评估占用 (每行平均约 64 字节)
    const estimatedMemoryKb = Math.round((rowCount * Math.max(1, schema.length) * 32) / 1024);
    const healthScore = Math.max(0, Math.min(100, Math.round(completenessRate * 0.8 + (pkColumns.length > 0 ? 20 : 10))));

    return {
      tableName,
      rowCount,
      columnCount: schema.length,
      estimatedMemoryKb,
      pkColumns,
      healthScore,
      completenessRate,
    };
  }

  /**
   * 获取各列的精细化体检画像
   */
  async fetchColumnProfiles(tableName: string, schema: ColumnInfo[]): Promise<ColumnProfile[]> {
    const escapedTable = `"${tableName.replace(/"/g, '""')}"`;
    const countRes = await duckDBService.readQuery(`SELECT COUNT(*) AS total_rows FROM ${escapedTable}`);
    const rowCount = Number(countRes?.[0]?.total_rows || 0);

    const profiles: ColumnProfile[] = [];

    for (const col of schema) {
      const semanticType = classifySemanticType(col.name, col.type);
      const colEscaped = `"${col.name.replace(/"/g, '""')}"`;

      let nonNullCount = 0;
      let distinctCount = 0;
      let minVal: any = null;
      let maxVal: any = null;
      let avgVal: number | null = null;
      let medianVal: number | null = null;
      const topValues: { value: string; count: number; ratio: number }[] = [];

      try {
        if (semanticType === 'numeric') {
          const statsSql = `
            SELECT 
              COUNT(${colEscaped}) AS non_null_count,
              COUNT(DISTINCT ${colEscaped}) AS distinct_count,
              MIN(${colEscaped}) AS min_val,
              MAX(${colEscaped}) AS max_val,
              ROUND(AVG(CAST(${colEscaped} AS DOUBLE)), 2) AS avg_val,
              MEDIAN(${colEscaped}) AS median_val
            FROM ${escapedTable}
          `;
          const statsRes = await duckDBService.readQuery(statsSql);
          const row = statsRes?.[0];
          if (row) {
            nonNullCount = Number(row.non_null_count || 0);
            distinctCount = Number(row.distinct_count || 0);
            minVal = row.min_val !== null ? Number(row.min_val) : null;
            maxVal = row.max_val !== null ? Number(row.max_val) : null;
            avgVal = row.avg_val !== null ? Number(row.avg_val) : null;
            medianVal = row.median_val !== null ? Number(row.median_val) : null;
          }
        } else {
          const statsSql = `
            SELECT 
              COUNT(${colEscaped}) AS non_null_count,
              COUNT(DISTINCT ${colEscaped}) AS distinct_count,
              MIN(CAST(${colEscaped} AS VARCHAR)) AS min_val,
              MAX(CAST(${colEscaped} AS VARCHAR)) AS max_val
            FROM ${escapedTable}
          `;
          const statsRes = await duckDBService.readQuery(statsSql);
          const row = statsRes?.[0];
          if (row) {
            nonNullCount = Number(row.non_null_count || 0);
            distinctCount = Number(row.distinct_count || 0);
            minVal = row.min_val;
            maxVal = row.max_val;
          }
        }

        // 获取频次 TOP 5 (高频分布)
        if (rowCount > 0 && distinctCount > 0) {
          const topSql = `
            SELECT 
              COALESCE(CAST(${colEscaped} AS VARCHAR), '(NULL)') AS val,
              COUNT(*) AS cnt
            FROM ${escapedTable}
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 5
          `;
          const topRes = await duckDBService.readQuery(topSql);
          (topRes || []).forEach(tr => {
            const cnt = Number(tr.cnt || 0);
            topValues.push({
              value: String(tr.val),
              count: cnt,
              ratio: Math.round((cnt / rowCount) * 1000) / 10,
            });
          });
        }
      } catch (err) {
        console.warn(`[AnalysisEngine] Profile failed for column ${col.name}:`, err);
      }

      // 计算数值列简易 8 分箱分布 (用于体检卡片 Mini 柱状直方走势)
      const sparkline: number[] = [];
      if (semanticType === 'numeric' && minVal !== null && maxVal !== null && minVal < maxVal && nonNullCount > 5) {
        try {
          const sparkSql = `
            SELECT 
              WIDTH_BUCKET(CAST(${colEscaped} AS DOUBLE), ${minVal}, ${maxVal}, 8) AS b,
              COUNT(*) AS cnt
            FROM ${escapedTable}
            WHERE ${colEscaped} IS NOT NULL
            GROUP BY 1
            ORDER BY 1 ASC
          `;
          const sparkRes = await duckDBService.readQuery(sparkSql);
          const bMap: Record<number, number> = {};
          (sparkRes || []).forEach(sr => {
            bMap[Number(sr.b)] = Number(sr.cnt || 0);
          });
          for (let i = 1; i <= 8; i++) {
            sparkline.push(bMap[i] || 0);
          }
        } catch (sparkErr) {
          console.warn(`[AnalysisEngine] Sparkline failed for column ${col.name}:`, sparkErr);
        }
      }

      const nullCount = Math.max(0, rowCount - nonNullCount);
      const nullRate = rowCount > 0 ? Math.round((nullCount / rowCount) * 1000) / 10 : 0;
      const cardinalityRate = rowCount > 0 ? Math.round((distinctCount / rowCount) * 1000) / 10 : 0;
      const isPrimaryKeyCandidate = rowCount > 0 && nullCount === 0 && distinctCount === rowCount;

      profiles.push({
        name: col.name,
        type: col.type,
        semanticType,
        rowCount,
        nonNullCount,
        nullCount,
        nullRate,
        distinctCount,
        cardinalityRate,
        isPrimaryKeyCandidate,
        min: minVal,
        max: maxVal,
        avg: avgVal,
        median: medianVal,
        topValues,
        sparkline: sparkline.length > 0 ? sparkline : undefined,
      });
    }

    return profiles;
  }

  /**
   * 构建多维透视聚合 SQL
   */
  buildPivotSql(config: PivotQueryConfig): string {
    const escapedTable = `"${config.tableName.replace(/"/g, '""')}"`;

    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    // Dimensions
    config.rowDimensions.forEach((dim, idx) => {
      const colEsc = `"${dim.column.replace(/"/g, '""')}"`;
      if (dim.dateTrunc) {
        const alias = `${dim.column}_${dim.dateTrunc}`;
        selectParts.push(`DATE_TRUNC('${dim.dateTrunc}', CAST(${colEsc} AS DATE)) AS "${alias}"`);
        groupByParts.push(String(idx + 1));
      } else {
        selectParts.push(`${colEsc} AS "${dim.column}"`);
        groupByParts.push(String(idx + 1));
      }
    });

    // Metrics
    config.metrics.forEach(m => {
      const colEsc = m.column ? `"${m.column.replace(/"/g, '""')}"` : '*';
      const aliasEsc = `"${m.alias.replace(/"/g, '""')}"`;
      switch (m.agg) {
        case 'count':
          selectParts.push(`COUNT(${colEsc}) AS ${aliasEsc}`);
          break;
        case 'count_distinct':
          selectParts.push(`COUNT(DISTINCT ${colEsc}) AS ${aliasEsc}`);
          break;
        case 'sum':
          selectParts.push(`ROUND(COALESCE(SUM(CAST(${colEsc} AS DOUBLE)), 0), 2) AS ${aliasEsc}`);
          break;
        case 'avg':
          selectParts.push(`ROUND(COALESCE(AVG(CAST(${colEsc} AS DOUBLE)), 0), 2) AS ${aliasEsc}`);
          break;
        case 'min':
          selectParts.push(`MIN(${colEsc}) AS ${aliasEsc}`);
          break;
        case 'max':
          selectParts.push(`MAX(${colEsc}) AS ${aliasEsc}`);
          break;
      }
    });

    let whereClause = '';
    if (config.filters && config.filters.length > 0) {
      const conds = config.filters.map(f => {
        const colEsc = `"${f.column.replace(/"/g, '""')}"`;
        const val = f.value.replace(/'/g, "''");
        switch (f.op) {
          case '=':
            return `${colEsc} = '${val}'`;
          case '!=':
            return `${colEsc} != '${val}'`;
          case '>':
            return `${colEsc} > ${Number(f.value) || 0}`;
          case '>=':
            return `${colEsc} >= ${Number(f.value) || 0}`;
          case '<':
            return `${colEsc} < ${Number(f.value) || 0}`;
          case '<=':
            return `${colEsc} <= ${Number(f.value) || 0}`;
          case 'contains':
            return `CAST(${colEsc} AS VARCHAR) LIKE '%${val}%'`;
          case 'not_null':
            return `${colEsc} IS NOT NULL`;
          default:
            return '1=1';
        }
      });
      whereClause = `WHERE ${conds.join(' AND ')}`;
    }

    let orderByClause = '';
    if (config.sortMetric) {
      const order = (config.sortOrder || 'desc').toUpperCase();
      orderByClause = `ORDER BY "${config.sortMetric.replace(/"/g, '""')}" ${order}`;
    } else if (config.metrics.length > 0) {
      orderByClause = `ORDER BY "${config.metrics[0].alias.replace(/"/g, '""')}" DESC`;
    }

    const limitClause = config.limit > 0 ? `LIMIT ${config.limit}` : '';

    return `SELECT\n  ${selectParts.join(',\n  ')}\nFROM ${escapedTable}\n${whereClause}\nGROUP BY ${groupByParts.join(', ')}\n${orderByClause}\n${limitClause};`.trim();
  }

  /**
   * 执行多维透视并返回数据与性能开销
   */
  async executePivotQuery(config: PivotQueryConfig): Promise<{
    sql: string;
    columns: string[];
    rows: any[];
    executionTimeMs: number;
  }> {
    const startTime = performance.now();
    const sql = this.buildPivotSql(config);
    const rows = await duckDBService.readQuery(sql);
    const executionTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
    const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      sql,
      columns,
      rows,
      executionTimeMs,
    };
  }

  /**
   * 执行真实商业级二维交叉透视阵列 (2D Cross-Tab Pivot Matrix)
   */
  async execute2DPivotQuery(config: CrossTabPivotConfig): Promise<CrossTabPivotResult> {
    const startTime = performance.now();
    const escapedTable = `"${config.tableName.replace(/"/g, '""')}"`;

    // 1. Column dimension expression
    const colEsc = `"${config.colDimension.replace(/"/g, '""')}"`;
    const colExpr = config.colDateTrunc
      ? `DATE_TRUNC('${config.colDateTrunc}', CAST(${colEsc} AS DATE))`
      : colEsc;

    // 2. Row dimension expression
    const rowEsc = `"${config.rowDimension.replace(/"/g, '""')}"`;
    const rowExpr = config.rowDateTrunc
      ? `DATE_TRUNC('${config.rowDateTrunc}', CAST(${rowEsc} AS DATE))`
      : rowEsc;
    const rowAlias = config.rowDateTrunc ? `${config.rowDimension}_${config.rowDateTrunc}` : config.rowDimension;

    // 3. Where filters
    const filterConds = (config.filters || []).map(f => {
      const cEsc = `"${f.column.replace(/"/g, '""')}"`;
      const val = f.value.replace(/'/g, "''");
      switch (f.op) {
        case '=': return `${cEsc} = '${val}'`;
        case '!=': return `${cEsc} != '${val}'`;
        case '>': return `${cEsc} > ${Number(f.value) || 0}`;
        case '>=': return `${cEsc} >= ${Number(f.value) || 0}`;
        case '<': return `${cEsc} < ${Number(f.value) || 0}`;
        case '<=': return `${cEsc} <= ${Number(f.value) || 0}`;
        case 'contains': return `CAST(${cEsc} AS VARCHAR) LIKE '%${val}%'`;
        case 'not_null': return `${cEsc} IS NOT NULL`;
        case 'is_null': return `${cEsc} IS NULL`;
        default: return '1=1';
      }
    });
    const whereClause = filterConds.length > 0 ? `WHERE ${filterConds.join(' AND ')}` : '';

    // 4. Fetch distinct column values (up to 12 columns for clean readable matrix layout)
    const distinctColsSql = `
      SELECT DISTINCT COALESCE(CAST(${colExpr} AS VARCHAR), '(空值)') AS col_val
      FROM ${escapedTable}
      ${whereClause ? `${whereClause} AND ${colEsc} IS NOT NULL` : `WHERE ${colEsc} IS NOT NULL`}
      ORDER BY 1 ASC
      LIMIT 12;
    `;
    const colRes = await duckDBService.readQuery(distinctColsSql);
    const colHeaders = colRes.map(r => String(r.col_val));

    // 5. Metric aggregation expression
    const metricColEsc = config.metricCol ? `"${config.metricCol.replace(/"/g, '""')}"` : '*';
    let metricValExpr = `CAST(${metricColEsc} AS DOUBLE)`;
    if (config.agg === 'count' && !config.metricCol) {
      metricValExpr = '1';
    }

    let aggFuncSql = 'SUM';
    if (config.agg === 'avg') aggFuncSql = 'AVG';
    if (config.agg === 'count') aggFuncSql = 'COUNT';
    if (config.agg === 'min') aggFuncSql = 'MIN';
    if (config.agg === 'max') aggFuncSql = 'MAX';

    // Build the PIVOT SQL
    const pivotColSelects = colHeaders.map(ch => {
      const escapedChVal = ch.replace(/'/g, "''");
      const escapedAlias = ch.replace(/"/g, '""');
      if (config.agg === 'count_distinct') {
        return `COUNT(DISTINCT CASE WHEN CAST(${colExpr} AS VARCHAR) = '${escapedChVal}' THEN ${metricColEsc} END) AS "${escapedAlias}"`;
      }
      return `ROUND(COALESCE(${aggFuncSql}(CASE WHEN CAST(${colExpr} AS VARCHAR) = '${escapedChVal}' THEN ${metricValExpr} END), 0), 2) AS "${escapedAlias}"`;
    });

    const totalColSelect = config.agg === 'count_distinct'
      ? `COUNT(DISTINCT ${metricColEsc}) AS "行总计"`
      : `ROUND(COALESCE(${aggFuncSql}(${metricValExpr}), 0), 2) AS "行总计"`;

    const limitRows = config.limitRows || 50;
    const pivotSql = `
SELECT
  ${rowExpr} AS "${rowAlias}",
  ${pivotColSelects.join(',\n  ')},
  ${totalColSelect}
FROM ${escapedTable}
${whereClause}
GROUP BY 1
ORDER BY "行总计" DESC
LIMIT ${limitRows};
    `.trim();

    const rows = await duckDBService.readQuery(pivotSql);
    const executionTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

    const rowHeaders: string[] = [];
    const matrix: (number | null)[][] = [];
    const rowTotals: number[] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    rows.forEach(r => {
      const rHeader = String(r[rowAlias] ?? '(空值)');
      rowHeaders.push(rHeader);
      const rTotal = Number(r['行总计'] || 0);
      rowTotals.push(rTotal);

      const rowCells: (number | null)[] = [];
      colHeaders.forEach(ch => {
        const v = r[ch];
        const numVal = v !== null && v !== undefined ? Number(v) : 0;
        rowCells.push(numVal);
        if (numVal < minVal) minVal = numVal;
        if (numVal > maxVal) maxVal = numVal;
      });
      matrix.push(rowCells);
    });

    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 0;

    // Calculate Column Totals & Grand Total
    const colTotals = colHeaders.map((_, colIdx) => {
      let colSum = 0;
      matrix.forEach(row => {
        colSum += Number(row[colIdx] || 0);
      });
      return Math.round(colSum * 100) / 100;
    });

    const grandTotal = Math.round(rowTotals.reduce((a, b) => a + b, 0) * 100) / 100;

    return {
      sql: pivotSql,
      rowDimensionName: rowAlias,
      colDimensionName: config.colDimension,
      rowHeaders,
      colHeaders,
      matrix,
      rowTotals,
      colTotals,
      grandTotal,
      minVal,
      maxVal,
      executionTimeMs,
    };
  }

  /**
   * 构建下钻明细 SQL
   */
  buildDrillDownSql(config: DrillDownConfig): string {
    const escapedTable = `"${config.tableName.replace(/"/g, '""')}"`;
    const conds = (config.filters || []).map(f => {
      const colEsc = `"${f.column.replace(/"/g, '""')}"`;
      const val = String(f.value ?? '').replace(/'/g, "''");
      switch (f.op) {
        case '=':
          return `${colEsc} = '${val}'`;
        case '!=':
          return `${colEsc} != '${val}'`;
        case '>':
          return `${colEsc} > ${Number(f.value) || 0}`;
        case '>=':
          return `${colEsc} >= ${Number(f.value) || 0}`;
        case '<':
          return `${colEsc} < ${Number(f.value) || 0}`;
        case '<=':
          return `${colEsc} <= ${Number(f.value) || 0}`;
        case 'contains':
          return `CAST(${colEsc} AS VARCHAR) LIKE '%${val}%'`;
        case 'is_null':
          return `${colEsc} IS NULL`;
        case 'not_null':
          return `${colEsc} IS NOT NULL`;
        default:
          return '1=1';
      }
    });
    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const limitClause = config.limit !== undefined && config.limit > 0 ? `LIMIT ${config.limit}` : 'LIMIT 100';
    return `SELECT * FROM ${escapedTable}\n${whereClause}\n${limitClause};`.trim();
  }

  /**
   * 执行明细下钻查询
   */
  async executeDrillDown(config: DrillDownConfig): Promise<{
    sql: string;
    totalCount: number;
    rows: any[];
    columns: string[];
    executionTimeMs: number;
  }> {
    const startTime = performance.now();
    const sql = this.buildDrillDownSql(config);

    const escapedTable = `"${config.tableName.replace(/"/g, '""')}"`;
    const conds = (config.filters || []).map(f => {
      const colEsc = `"${f.column.replace(/"/g, '""')}"`;
      const val = String(f.value ?? '').replace(/'/g, "''");
      switch (f.op) {
        case '=': return `${colEsc} = '${val}'`;
        case '!=': return `${colEsc} != '${val}'`;
        case '>': return `${colEsc} > ${Number(f.value) || 0}`;
        case '>=': return `${colEsc} >= ${Number(f.value) || 0}`;
        case '<': return `${colEsc} < ${Number(f.value) || 0}`;
        case '<=': return `${colEsc} <= ${Number(f.value) || 0}`;
        case 'contains': return `CAST(${colEsc} AS VARCHAR) LIKE '%${val}%'`;
        case 'is_null': return `${colEsc} IS NULL`;
        case 'not_null': return `${colEsc} IS NOT NULL`;
        default: return '1=1';
      }
    });
    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const countSql = `SELECT COUNT(*) AS cnt FROM ${escapedTable} ${whereClause};`;

    const [rows, countRes] = await Promise.all([
      duckDBService.readQuery(sql),
      duckDBService.readQuery(countSql).catch(() => [{ cnt: 0 }]),
    ]);
    const executionTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
    const totalCount = Number(countRes?.[0]?.cnt || rows.length);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      sql,
      totalCount,
      rows,
      columns,
      executionTimeMs,
    };
  }

  /**
   * 将分析结果一键物理物化为实体表或视图
   */
  async materializeAsTable(sourceSql: string, targetTableName: string, asView: boolean = false): Promise<string> {
    const cleanName = targetTableName.trim().replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
    if (!cleanName) throw new Error('表名不能为空且只能包含常规字母/数字/下划线');
    const cleanSql = sourceSql.trim().replace(/;+$/, '');
    const ddl = `CREATE OR REPLACE ${asView ? 'VIEW' : 'TABLE'} "${cleanName}" AS ${cleanSql};`;
    await duckDBService.query(ddl);
    return cleanName;
  }

  /**
   * 构建时序走势与高级窗口分析 SQL
   */
  buildTimeSeriesSql(config: TimeSeriesConfig): string {
    const escapedTable = `"${config.tableName.replace(/"/g, '""')}"`;
    const dateColEsc = `"${config.timeColumn.replace(/"/g, '""')}"`;
    const valColEsc = `"${config.valueColumn.replace(/"/g, '""')}"`;

    let aggExpr = 'COUNT(*)';
    if (config.aggFunc === 'sum') aggExpr = `ROUND(SUM(CAST(${valColEsc} AS DOUBLE)), 2)`;
    if (config.aggFunc === 'avg') aggExpr = `ROUND(AVG(CAST(${valColEsc} AS DOUBLE)), 2)`;
    if (config.aggFunc === 'min') aggExpr = `MIN(${valColEsc})`;
    if (config.aggFunc === 'max') aggExpr = `MAX(${valColEsc})`;

    const baseCte = `
WITH raw_series AS (
  SELECT
    DATE_TRUNC('${config.granularity}', CAST(${dateColEsc} AS DATE)) AS period,
    ${aggExpr} AS base_value
  FROM ${escapedTable}
  WHERE ${dateColEsc} IS NOT NULL
  GROUP BY 1
  ORDER BY 1 ASC
)`;

    if (config.windowMode === 'mom') {
      return `${baseCte}
SELECT
  STRFTIME(period, '%Y-%m-%d') AS 时间周期,
  base_value AS 当期数值,
  LAG(base_value, 1) OVER (ORDER BY period) AS 上期数值,
  ROUND(
    (base_value - LAG(base_value, 1) OVER (ORDER BY period)) / 
    NULLIF(LAG(base_value, 1) OVER (ORDER BY period), 0) * 100, 
    2
  ) AS 环比增长率_百分比
FROM raw_series
ORDER BY period ASC;`;
    }

    if (config.windowMode === 'moving_avg') {
      return `${baseCte}
SELECT
  STRFTIME(period, '%Y-%m-%d') AS 时间周期,
  base_value AS 当期实际值,
  ROUND(AVG(base_value) OVER (
    ORDER BY period 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 2) AS "7周期平滑均线"
FROM raw_series
ORDER BY period ASC;`;
    }

    if (config.windowMode === 'cumulative') {
      return `${baseCte}
SELECT
  STRFTIME(period, '%Y-%m-%d') AS 时间周期,
  base_value AS 当期新增,
  ROUND(SUM(base_value) OVER (ORDER BY period), 2) AS 累计总和
FROM raw_series
ORDER BY period ASC;`;
    }

    // Default: Raw
    return `${baseCte}
SELECT
  STRFTIME(period, '%Y-%m-%d') AS 时间周期,
  base_value AS 指标数值
FROM raw_series
ORDER BY period ASC;`;
  }

  /**
   * 执行时序计算并计算周期总结
   */
  async executeTimeSeries(config: TimeSeriesConfig): Promise<{
    sql: string;
    rows: any[];
    summary: {
      latestVal: number;
      avgVal: number;
      maxVal: number;
      totalGrowthPct: number;
    };
    executionTimeMs: number;
  }> {
    const startTime = performance.now();
    const sql = this.buildTimeSeriesSql(config);
    const rows = await duckDBService.readQuery(sql);
    const executionTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

    let latestVal = 0;
    let avgVal = 0;
    let maxVal = 0;
    let totalGrowthPct = 0;

    if (rows.length > 0) {
      const values = rows.map(r => {
        const valKey = Object.keys(r)[1] || 'base_value';
        return Number(r[valKey]) || 0;
      });

      latestVal = values[values.length - 1];
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      avgVal = Math.round((sum / values.length) * 100) / 100;
      maxVal = Math.max(...values);

      const first = values[0] || 0;
      if (first > 0) {
        totalGrowthPct = Math.round(((latestVal - first) / first) * 1000) / 10;
      }
    }

    return {
      sql,
      rows,
      summary: {
        latestVal,
        avgVal,
        maxVal,
        totalGrowthPct,
      },
      executionTimeMs,
    };
  }

  /**
   * 执行业务分析配方 (Pareto, RFM, IQR, Histogram, Cohort)
   */
  async executeRecipe(
    recipeId: 'pareto' | 'rfm' | 'iqr' | 'histogram' | 'cohort',
    tableName: string,
    params: Record<string, any>
  ): Promise<{
    sql: string;
    rows: any[];
    insights: string[];
    extraStats?: Record<string, any>;
    executionTimeMs: number;
  }> {
    const startTime = performance.now();
    const escapedTable = `"${tableName.replace(/"/g, '""')}"`;
    let sql = '';
    const insights: string[] = [];

    if (recipeId === 'pareto') {
      const entityCol = `"${(params.entityCol || 'customer_id').replace(/"/g, '""')}"`;
      const metricCol = `"${(params.metricCol || 'revenue').replace(/"/g, '""')}"`;

      sql = `
WITH aggregated AS (
  SELECT
    ${entityCol} AS 实体标识,
    ROUND(SUM(CAST(${metricCol} AS DOUBLE)), 2) AS 贡献金额
  FROM ${escapedTable}
  WHERE ${entityCol} IS NOT NULL
  GROUP BY 1
),
ranked AS (
  SELECT
    实体标识,
    贡献金额,
    SUM(贡献金额) OVER (ORDER BY 贡献金额 DESC) AS 累计贡献金额,
    SUM(贡献金额) OVER () AS 全局总额,
    ROW_NUMBER() OVER (ORDER BY 贡献金额 DESC) AS 排名,
    COUNT(*) OVER () AS 总实体数
  FROM aggregated
)
SELECT
  实体标识,
  贡献金额,
  累计贡献金额,
  ROUND(累计贡献金额 / NULLIF(全局总额, 0) * 100, 2) AS 累计贡献率_百分比,
  ROUND(排名 / NULLIF(总实体数, 0) * 100, 2) AS 实体排位占比_百分比,
  CASE WHEN (累计贡献金额 / NULLIF(全局总额, 0)) <= 0.80 THEN '核心头部 (80%贡献圈)' ELSE '长尾群体' END AS 帕累托分组
FROM ranked
ORDER BY 排名 ASC
LIMIT 100;`;

      const rows = await duckDBService.readQuery(sql);
      const topRows = rows.filter(r => r.帕累托分组 === '核心头部 (80%贡献圈)');
      const totalEntities = rows.length > 0 ? Number(rows[0].总实体数 || rows.length) : 0;
      const topCount = topRows.length;
      const totalRev = rows.length > 0 ? Number(rows[rows.length - 1].累计贡献金额 || 0) : 0;
      const topRev = topRows.length > 0 ? Number(topRows[topRows.length - 1].累计贡献金额 || 0) : 0;

      insights.push(`共探查 ${totalEntities} 个实体。`);
      insights.push(`前 ${topCount} 个核心头部实体（占 ${totalEntities > 0 ? Math.round((topCount / totalEntities) * 1000) / 10 : 0}%）贡献了全盘近 80% 的价值。`);
      insights.push(`建议将核心头部客户提取为目标重点服务名单。`);

      const cleanSql = `CREATE OR REPLACE TABLE "pareto_vip_${tableName}" AS
WITH aggregated AS (
  SELECT ${entityCol} AS entity_id, ROUND(SUM(CAST(${metricCol} AS DOUBLE)), 2) AS contribution
  FROM ${escapedTable} WHERE ${entityCol} IS NOT NULL GROUP BY 1
),
ranked AS (
  SELECT entity_id, contribution,
    SUM(contribution) OVER (ORDER BY contribution DESC) AS running_sum,
    SUM(contribution) OVER () AS total_sum
  FROM aggregated
)
SELECT entity_id, contribution, ROUND(running_sum / NULLIF(total_sum, 0) * 100, 2) AS cumulative_pct
FROM ranked
WHERE (running_sum / NULLIF(total_sum, 0)) <= 0.80
ORDER BY contribution DESC;`;

      return {
        sql,
        rows,
        insights,
        extraStats: {
          totalEntities,
          topEntitiesCount: topCount,
          topRatio: totalEntities > 0 ? Math.round((topCount / totalEntities) * 1000) / 10 : 0,
          totalRevenue: totalRev,
          topRevenue: topRev,
          cleanSql,
        },
        executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      };
    }

    if (recipeId === 'rfm') {
      const userCol = `"${(params.userCol || 'customer_id').replace(/"/g, '""')}"`;
      const dateCol = `"${(params.dateCol || 'order_date').replace(/"/g, '""')}"`;
      const amountCol = `"${(params.amountCol || 'amount').replace(/"/g, '""')}"`;

      sql = `
WITH rfm_raw AS (
  SELECT
    ${userCol} AS 用户标识,
    DATEDIFF('day', MAX(CAST(${dateCol} AS DATE)), (SELECT MAX(CAST(${dateCol} AS DATE)) FROM ${escapedTable})) AS recency_days,
    COUNT(*) AS frequency_orders,
    ROUND(SUM(CAST(${amountCol} AS DOUBLE)), 2) AS monetary_amount
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
rfm_scored AS (
  SELECT
    用户标识,
    recency_days,
    frequency_orders,
    monetary_amount,
    NTILE(3) OVER (ORDER BY recency_days ASC) AS r_score,
    NTILE(3) OVER (ORDER BY frequency_orders DESC) AS f_score,
    NTILE(3) OVER (ORDER BY monetary_amount DESC) AS m_score
  FROM rfm_raw
)
SELECT
  用户标识,
  recency_days AS 最近活跃天数,
  frequency_orders AS 消费频次,
  monetary_amount AS 累计消费金额,
  CASE
    WHEN r_score >= 2 AND f_score >= 2 AND m_score >= 2 THEN '💎 高价值核心客户'
    WHEN r_score >= 2 AND f_score < 2 AND m_score >= 2 THEN '🌱 新晋高消客户'
    WHEN r_score >= 2 AND f_score >= 2 AND m_score < 2 THEN '🏆 忠诚高频客户'
    WHEN r_score >= 2 AND f_score < 2 AND m_score < 2 THEN '✨ 新晋初访客户'
    WHEN r_score < 2 AND f_score >= 2 AND m_score >= 2 THEN '⚠️ 重点挽留流失客户'
    WHEN r_score < 2 AND f_score < 2 AND m_score >= 2 THEN '⏳ 消费睡眠客户'
    WHEN r_score < 2 AND f_score >= 2 AND m_score < 2 THEN '💤 低贡献老客户'
    ELSE '❌ 一般流失与低价值客户'
  END AS RFM分层标签
FROM rfm_scored
ORDER BY monetary_amount DESC
LIMIT 100;`;

      const rows = await duckDBService.readQuery(sql);

      // Compute 8-segment aggregate breakdown
      const segmentSql = `
WITH rfm_raw AS (
  SELECT
    ${userCol} AS user_id,
    DATEDIFF('day', MAX(CAST(${dateCol} AS DATE)), (SELECT MAX(CAST(${dateCol} AS DATE)) FROM ${escapedTable})) AS recency_days,
    COUNT(*) AS frequency_orders,
    ROUND(SUM(CAST(${amountCol} AS DOUBLE)), 2) AS monetary_amount
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
rfm_scored AS (
  SELECT
    user_id,
    recency_days,
    frequency_orders,
    monetary_amount,
    NTILE(3) OVER (ORDER BY recency_days ASC) AS r_score,
    NTILE(3) OVER (ORDER BY frequency_orders DESC) AS f_score,
    NTILE(3) OVER (ORDER BY monetary_amount DESC) AS m_score
  FROM rfm_raw
),
labeled AS (
  SELECT
    user_id,
    recency_days,
    frequency_orders,
    monetary_amount,
    CASE
      WHEN r_score >= 2 AND f_score >= 2 AND m_score >= 2 THEN '💎 高价值核心客户'
      WHEN r_score >= 2 AND f_score < 2 AND m_score >= 2 THEN '🌱 新晋高消客户'
      WHEN r_score >= 2 AND f_score >= 2 AND m_score < 2 THEN '🏆 忠诚高频客户'
      WHEN r_score >= 2 AND f_score < 2 AND m_score < 2 THEN '✨ 新晋初访客户'
      WHEN r_score < 2 AND f_score >= 2 AND m_score >= 2 THEN '⚠️ 重点挽留流失客户'
      WHEN r_score < 2 AND f_score < 2 AND m_score >= 2 THEN '⏳ 消费睡眠客户'
      WHEN r_score < 2 AND f_score >= 2 AND m_score < 2 THEN '💤 低贡献老客户'
      ELSE '❌ 一般流失与低价值客户'
    END AS segment
  FROM rfm_scored
)
SELECT
  segment,
  COUNT(*) AS user_count,
  ROUND(SUM(monetary_amount), 2) AS total_amount,
  ROUND(AVG(monetary_amount), 2) AS avg_amount,
  ROUND(AVG(recency_days), 1) AS avg_recency,
  ROUND(AVG(frequency_orders), 1) AS avg_freq
FROM labeled
GROUP BY 1
ORDER BY total_amount DESC;`;

      let segmentSummary: any[] = [];
      try {
        segmentSummary = await duckDBService.readQuery(segmentSql);
      } catch (err) {
        console.warn('Failed to query RFM segments:', err);
      }

      const championCount = rows.filter(r => r.RFM分层标签?.includes('高价值核心')).length;
      const atRiskCount = rows.filter(r => r.RFM分层标签?.includes('重点挽留')).length;

      insights.push(`已完成多维 RFM 智能打分，识别出 ${championCount} 位高价值核心客户。`);
      insights.push(`检测到 ${atRiskCount} 位高消费但近期未活跃的重点挽留客户，需尽快采取触达召回。`);

      return {
        sql,
        rows,
        insights,
        extraStats: {
          segmentSummary,
        },
        executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      };
    }

    if (recipeId === 'iqr') {
      const numCol = `"${(params.numCol || 'amount').replace(/"/g, '""')}"`;
      sql = `
WITH percentiles AS (
  SELECT
    QUANTILE_CONT(${numCol}, 0.25) AS q1,
    QUANTILE_CONT(${numCol}, 0.75) AS q3,
    (QUANTILE_CONT(${numCol}, 0.75) - QUANTILE_CONT(${numCol}, 0.25)) AS iqr
  FROM ${escapedTable}
  WHERE ${numCol} IS NOT NULL
),
bounds AS (
  SELECT
    q1,
    q3,
    iqr,
    (q1 - 1.5 * iqr) AS lower_bound,
    (q3 + 1.5 * iqr) AS upper_bound
  FROM percentiles
)
SELECT
  t.*,
  b.q1,
  b.q3,
  b.iqr,
  b.lower_bound AS 正常下界,
  b.upper_bound AS 正常上界,
  CASE 
    WHEN t.${numCol} > b.upper_bound THEN '高位极端异常值 (高于上界)'
    WHEN t.${numCol} < b.lower_bound THEN '低位极端异常值 (低于下界)'
    ELSE '正常值'
  END AS 异常判定
FROM ${escapedTable} t
CROSS JOIN bounds b
WHERE t.${numCol} > b.upper_bound OR t.${numCol} < b.lower_bound
LIMIT 100;`;

      const rows = await duckDBService.readQuery(sql);
      const q1 = rows.length > 0 ? Number(rows[0].q1 || 0) : 0;
      const q3 = rows.length > 0 ? Number(rows[0].q3 || 0) : 0;
      const iqr = rows.length > 0 ? Number(rows[0].iqr || 0) : 0;
      const lowerBound = rows.length > 0 ? Number(rows[0].正常下界 || 0) : 0;
      const upperBound = rows.length > 0 ? Number(rows[0].正常上界 || 0) : 0;

      insights.push(`基于 Tukey's IQR 原则计算，正常取值范围为 [${lowerBound.toFixed(2)} ~ ${upperBound.toFixed(2)}]。`);
      insights.push(`甄别出 ${rows.length} 条突破边界的离群极端值记录。`);
      insights.push(`可一键生成已剔除离群值的标准化清洗视图，保障下游统计可信度。`);

      const cleanSql = `CREATE OR REPLACE VIEW "cleaned_${tableName}" AS
SELECT * FROM ${escapedTable}
WHERE ${numCol} >= ${lowerBound.toFixed(2)} AND ${numCol} <= ${upperBound.toFixed(2)};`;

      return {
        sql,
        rows,
        insights,
        extraStats: {
          q1,
          q3,
          iqr,
          lowerBound,
          upperBound,
          outlierCount: rows.length,
          cleanSql,
        },
        executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      };
    }

    if (recipeId === 'histogram') {
      const numCol = `"${(params.numCol || 'amount').replace(/"/g, '""')}"`;
      const bucketCount = Number(params.bucketCount) || 8;

      sql = `
WITH stats AS (
  SELECT
    MIN(${numCol}) AS min_v,
    MAX(${numCol}) AS max_v
  FROM ${escapedTable}
  WHERE ${numCol} IS NOT NULL
),
binned AS (
  SELECT
    ${numCol} AS val,
    WIDTH_BUCKET(${numCol}, s.min_v, s.max_v, ${bucketCount}) AS bucket_idx,
    s.min_v,
    s.max_v,
    (s.max_v - s.min_v) / ${bucketCount} AS bucket_width
  FROM ${escapedTable} t
  CROSS JOIN stats s
  WHERE ${numCol} IS NOT NULL
)
SELECT
  bucket_idx AS 分箱编号,
  CONCAT(
    ROUND(min_v + (bucket_idx - 1) * bucket_width, 1), 
    ' ~ ', 
    ROUND(min_v + bucket_idx * bucket_width, 1)
  ) AS 区间范围,
  COUNT(*) AS 样本频次,
  ROUND(COUNT(*) / NULLIF((SELECT COUNT(*) FROM binned), 0) * 100, 2) AS 频次占比_百分比
FROM binned
GROUP BY 1, 2
ORDER BY 1 ASC;`;

      const rows = await duckDBService.readQuery(sql);
      insights.push(`全表数值已划分为 ${rows.length} 个等宽离散区间。`);
      const maxBucket = rows.slice().sort((a, b) => Number(b.样本频次) - Number(a.样本频次))[0];
      if (maxBucket) {
        insights.push(`最集中的核心波峰区间位于 [${maxBucket.区间范围}]，占全量样本的 ${maxBucket.频次占比_百分比}%。`);
      }

      return {
        sql,
        rows,
        insights,
        executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      };
    }

    // Default: Cohort retention
    const userCol = `"${(params.userCol || 'customer_id').replace(/"/g, '""')}"`;
    const dateCol = `"${(params.dateCol || 'order_date').replace(/"/g, '""')}"`;

    sql = `
WITH user_first_date AS (
  SELECT
    ${userCol} AS user_id,
    MIN(DATE_TRUNC('month', CAST(${dateCol} AS DATE))) AS cohort_month
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1
),
activities AS (
  SELECT
    ${userCol} AS user_id,
    DATE_TRUNC('month', CAST(${dateCol} AS DATE)) AS activity_month
  FROM ${escapedTable}
  WHERE ${userCol} IS NOT NULL AND ${dateCol} IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  STRFTIME(f.cohort_month, '%Y-%m') AS 初始群组月份,
  DATEDIFF('month', f.cohort_month, a.activity_month) AS 月度周期间隔,
  COUNT(DISTINCT a.user_id) AS 活跃用户数
FROM user_first_date f
JOIN activities a ON f.user_id = a.user_id
GROUP BY 1, 2
ORDER BY 1 ASC, 2 ASC
LIMIT 100;`;

    const rows = await duckDBService.readQuery(sql);
    insights.push(`完成多周期月度用户队列映射，支持跟踪新用户随时间衰减留存率。`);

    // Build Triangle Heatmap Matrix
    const cohortsSet = new Set<string>();
    let maxPeriod = 0;
    const countMap: Record<string, Record<number, number>> = {};

    rows.forEach(r => {
      const cohort = String(r['初始群组月份']);
      const period = Number(r['月度周期间隔']);
      const cnt = Number(r['活跃用户数']);
      cohortsSet.add(cohort);
      if (period > maxPeriod) maxPeriod = period;
      if (!countMap[cohort]) countMap[cohort] = {};
      countMap[cohort][period] = cnt;
    });

    const sortedCohorts = Array.from(cohortsSet).sort();
    const cohortMatrix = sortedCohorts.map(cohort => {
      const initialUsers = countMap[cohort]?.[0] || 1;
      const periodsData: { period: number; users: number; pct: number }[] = [];
      for (let p = 0; p <= maxPeriod; p++) {
        const u = countMap[cohort]?.[p];
        if (u !== undefined) {
          periodsData.push({
            period: p,
            users: u,
            pct: Math.round((u / initialUsers) * 1000) / 10,
          });
        }
      }
      return {
        cohort,
        initialUsers,
        periods: periodsData,
      };
    });

    return {
      sql,
      rows,
      insights,
      extraStats: {
        cohortMatrix,
        maxPeriod,
      },
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
    };
  }
}

export const analysisEngine = new AnalysisEngine();
