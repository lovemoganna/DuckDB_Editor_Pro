/**
 * Table and column data profiler for data health checks.
 */

import { duckDBService } from '../duckdbService';
import type { ColumnInfo } from '../../types';
import { classifySemanticType, type ColumnSemanticType } from './semantic';
import { quoteIdent } from '../databaseCatalog';

async function scopedTable(tableName: string) {
  const scope = await duckDBService.getCurrentCatalogAndSchema();
  return [scope.catalog, scope.schema, tableName].map(quoteIdent).join('.');
}

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

/**
 * Fetch high-level table statistics and data completeness.
 */
export async function fetchTableOverview(tableName: string, schema: ColumnInfo[]): Promise<TableOverview> {
  const escapedTable = await scopedTable(tableName);
  const countSql = `SELECT COUNT(*) AS total_rows FROM ${escapedTable}`;
  const res = await duckDBService.readQuery(countSql);
  if (res?.[0]?.total_rows == null) throw new Error('未能获取记录行数');
  const rowCount = Number(res[0].total_rows);

  const pkColumns = schema.filter((c) => c.pk).map((c) => c.name);

  let completenessRate = Number.NaN;
  if (rowCount > 0 && schema.length > 0) {
    const nullColsSelect = schema
      .map((c) => `COUNT(CASE WHEN "${c.name.replace(/"/g, '""')}" IS NULL THEN 1 END) AS "${c.name.replace(/"/g, '""')}_nulls"`)
      .join(', ');
    try {
      const nullRes = await duckDBService.readQuery(`SELECT ${nullColsSelect} FROM ${escapedTable}`);
      if (nullRes?.[0]) {
        let totalNulls = 0;
        schema.forEach((c) => {
          totalNulls += Number(nullRes[0][`${c.name}_nulls`] ?? Number.NaN);
        });
        const totalCells = rowCount * schema.length;
        completenessRate = totalCells > 0 ? Math.round(((totalCells - totalNulls) / totalCells) * 1000) / 10 : 100;
      }
    } catch (err) {
      console.warn('[AnalysisProfiler] Null audit skipped:', err);
    }
  }

  const estimatedMemoryKb = Number.NaN;
  const healthScore = Number.NaN;

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
 * Fetch column profile details (nulls, distinct, min, max, sparkline histogram).
 */
export async function fetchColumnProfiles(tableName: string, schema: ColumnInfo[]): Promise<ColumnProfile[]> {
  const escapedTable = await scopedTable(tableName);
  const countRes = await duckDBService.readQuery(`SELECT COUNT(*) AS total_rows FROM ${escapedTable}`);
  if (countRes?.[0]?.total_rows == null) throw new Error('未能获取记录行数');
  const rowCount = Number(countRes[0].total_rows);

  const profiles: ColumnProfile[] = [];

  for (const col of schema) {
    const semanticType = classifySemanticType(col.name, col.type);
    const colEscaped = `"${col.name.replace(/"/g, '""')}"`;

    let nonNullCount = 0;
    let distinctCount = 0;
    let minVal: unknown = null;
    let maxVal: unknown = null;
    let avgVal: number | null = null;
    let medianVal: number | null = null;
    const topValues: { value: string; count: number; ratio: number }[] = [];

    try {
      if (/INT|DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE/i.test(col.type)) {
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
        (topRes || []).forEach((tr) => {
          const cnt = Number(tr.cnt || 0);
          topValues.push({
            value: String(tr.val),
            count: cnt,
            ratio: Math.round((cnt / rowCount) * 1000) / 10,
          });
        });
      }
    } catch (err) {
      console.warn(`[AnalysisProfiler] Profile failed for column ${col.name}:`, err);
      throw new Error(`字段 ${col.name} 检查失败：${String((err as Error).message)}`);
    }

    const sparkline: number[] = [];
    if (
      semanticType === 'numeric' &&
      minVal !== null &&
      maxVal !== null &&
      typeof minVal === 'number' &&
      typeof maxVal === 'number' &&
      minVal < maxVal &&
      nonNullCount > 5
    ) {
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
        (sparkRes || []).forEach((sr) => {
          bMap[Number(sr.b)] = Number(sr.cnt || 0);
        });
        for (let i = 1; i <= 8; i++) {
          sparkline.push(bMap[i] || 0);
        }
      } catch (sparkErr) {
        console.warn(`[AnalysisProfiler] Sparkline failed for column ${col.name}:`, sparkErr);
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
      min: minVal as number | string | null,
      max: maxVal as number | string | null,
      avg: avgVal,
      median: medianVal,
      topValues,
      sparkline: sparkline.length > 0 ? sparkline : undefined,
    });
  }

  return profiles;
}
