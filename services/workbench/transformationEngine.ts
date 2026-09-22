/**
 * services/workbench/transformationEngine.ts
 *
 * Backend Transformation Engine for DuckDB Workbench (BRD index10.md Section 3.1 & 3.2).
 * Responsibilities:
 * - Generate derived DuckDB SQL queries from base queries + transformation configs.
 * - Perform fast in-memory transformation (filter, sort, group, aggregate) on QuerySnapshots.
 */

import type { QuerySnapshot, FilterRule, SortRule, MetricRule, TransformationConfig } from './types';

export class TransformationEngine {
  /**
   * Apply in-memory transformation to an existing QuerySnapshot to produce a derived snapshot
   */
  applyTransformation(
    parentSnapshot: QuerySnapshot,
    config: TransformationConfig,
    newSnapshotId: string
  ): QuerySnapshot {
    let rows = [...(parentSnapshot.rows || [])];
    let columns = [...parentSnapshot.columns];
    let columnTypes = [...parentSnapshot.columnTypes];
    let columnTypeMap = { ...parentSnapshot.columnTypeMap };

    // 1. In-Memory Filter
    if (config.filters && config.filters.length > 0) {
      rows = rows.filter(row => {
        return config.filters!.every(filter => {
          const val = row[filter.column];
          switch (filter.operator) {
            case '=':
              return val == filter.value;
            case '!=':
              return val != filter.value;
            case '>':
              return Number(val) > Number(filter.value);
            case '>=':
              return Number(val) >= Number(filter.value);
            case '<':
              return Number(val) < Number(filter.value);
            case '<=':
              return Number(val) <= Number(filter.value);
            case 'LIKE':
            case 'ILIKE':
              return String(val).toLowerCase().includes(String(filter.value).toLowerCase());
            case 'IS NULL':
              return val === null || val === undefined;
            case 'IS NOT NULL':
              return val !== null && val !== undefined;
            default:
              return true;
          }
        });
      });
    }

    // 2. In-Memory Sort
    if (config.sorts && config.sorts.length > 0) {
      rows.sort((a, b) => {
        for (const sort of config.sorts!) {
          const valA = a[sort.column];
          const valB = b[sort.column];
          if (valA === valB) continue;
          const isNum = typeof valA === 'number' && typeof valB === 'number';
          let comparison = 0;
          if (isNum) {
            comparison = valA - valB;
          } else {
            comparison = String(valA).localeCompare(String(valB));
          }
          return sort.direction === 'DESC' ? -comparison : comparison;
        }
        return 0;
      });
    }

    // 3. In-Memory Group By & Aggregations
    if (config.groupBy && config.groupBy.length > 0 && config.metrics && config.metrics.length > 0) {
      const groups = new Map<string, any[]>();
      for (const row of rows) {
        const groupKey = config.groupBy.map(col => String(row[col])).join('___');
        const list = groups.get(groupKey) || [];
        list.push(row);
        groups.set(groupKey, list);
      }

      const aggregatedRows: any[] = [];
      for (const [, groupRows] of groups) {
        const first = groupRows[0];
        const newRow: Record<string, any> = {};
        for (const col of config.groupBy) {
          newRow[col] = first[col];
        }
        for (const metric of config.metrics) {
          const colValues = groupRows.map(r => r[metric.column]).filter(v => v !== null && v !== undefined);
          let aggVal: any = 0;
          switch (metric.aggregator) {
            case 'COUNT':
              aggVal = groupRows.length;
              break;
            case 'COUNT_DISTINCT':
              aggVal = new Set(colValues).size;
              break;
            case 'SUM':
              aggVal = colValues.reduce((sum, v) => sum + Number(v), 0);
              break;
            case 'AVG':
              aggVal = colValues.length > 0 ? colValues.reduce((sum, v) => sum + Number(v), 0) / colValues.length : 0;
              break;
            case 'MIN':
              aggVal = colValues.length > 0 ? Math.min(...colValues.map(Number)) : 0;
              break;
            case 'MAX':
              aggVal = colValues.length > 0 ? Math.max(...colValues.map(Number)) : 0;
              break;
          }
          newRow[metric.alias] = aggVal;
        }
        aggregatedRows.push(newRow);
      }

      rows = aggregatedRows;
      columns = [...config.groupBy, ...config.metrics.map(m => m.alias)];
      columnTypes = columns.map(c => (config.groupBy!.includes(c) ? (columnTypeMap[c] || 'VARCHAR') : 'DECIMAL(18,2)'));
      columnTypeMap = {};
      columns.forEach((c, idx) => {
        columnTypeMap[c] = columnTypes[idx];
      });
    }

    const derivedSql = this.generateDerivedSql(parentSnapshot.sql, config);

    return {
      snapshotId: newSnapshotId,
      executionId: `exec_${Date.now()}`,
      tabId: parentSnapshot.tabId,
      title: `${parentSnapshot.title} (Derived)`,
      sql: derivedSql,
      columns,
      columnTypes,
      columnTypeMap,
      rows,
      totalRowCount: rows.length,
      executionTime: 5,
      executedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      parentSnapshotId: parentSnapshot.snapshotId,
      transformation: config,
    };
  }

  /**
   * Generates a derived DuckDB SQL query string
   */
  generateDerivedSql(baseSql: string, config: TransformationConfig): string {
    const cleanBaseSql = baseSql.trim().replace(/;\s*$/, '');
    const cteSql = `WITH source_data AS (\n    ${cleanBaseSql.replace(/\n/g, '\n    ')}\n)`;

    const selectParts: string[] = [];
    if (config.groupBy && config.groupBy.length > 0) {
      selectParts.push(...config.groupBy);
      if (config.metrics && config.metrics.length > 0) {
        for (const metric of config.metrics) {
          selectParts.push(`${metric.aggregator}(${metric.column}) AS "${metric.alias}"`);
        }
      }
    } else {
      selectParts.push('*');
    }

    let whereClause = '';
    if (config.filters && config.filters.length > 0) {
      const filterExprs = config.filters.map(f => {
        if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
          return `"${f.column}" ${f.operator}`;
        }
        const valStr = typeof f.value === 'number' ? f.value : `'${String(f.value).replace(/'/g, "''")}'`;
        return `"${f.column}" ${f.operator} ${valStr}`;
      });
      whereClause = `WHERE ${filterExprs.join(' AND ')}`;
    }

    let groupByClause = '';
    if (config.groupBy && config.groupBy.length > 0) {
      groupByClause = `GROUP BY ${config.groupBy.map(c => `"${c}"`).join(', ')}`;
    }

    let orderByClause = '';
    if (config.sorts && config.sorts.length > 0) {
      const sortExprs = config.sorts.map(s => `"${s.column}" ${s.direction}`);
      orderByClause = `ORDER BY ${sortExprs.join(', ')}`;
    }

    const clauses = [
      `SELECT\n    ${selectParts.join(',\n    ')}`,
      'FROM source_data',
      whereClause,
      groupByClause,
      orderByClause,
    ].filter(Boolean);

    return `${cteSql}\n${clauses.join('\n')};`;
  }
}

export const transformationEngine = new TransformationEngine();
