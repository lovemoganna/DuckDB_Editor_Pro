/**
 * components/ExecutionPlan/model/sqlMapper.ts
 *
 * Helper to link ExecutionPlan operators to relevant SQL clauses.
 * Strictly tagged as Editor Pro Derived (heuristic assistance, not DuckDB fact).
 */

import { ExecutionNode } from './types';

export function deriveSqlMapping(
  node: ExecutionNode,
  fullSql?: string
): { sqlSnippet?: string; explanation: string } {
  if (!fullSql) {
    return {
      sqlSnippet: undefined,
      explanation: '无关联的编辑器 SQL 语句',
    };
  }

  const extra = node.extraInfo;

  // 1. Table or Function Scan
  if (extra['Table'] || extra['Function'] || node.category === 'scan') {
    const tableTarget = String(extra['Table'] || extra['Function'] || '').trim();
    if (tableTarget && fullSql.toLowerCase().includes(tableTarget.toLowerCase())) {
      return {
        sqlSnippet: `FROM ... ${tableTarget}`,
        explanation: `由读取数据源「${tableTarget}」推导`,
      };
    }
  }

  // 2. Filter predicates
  if (extra['Filters'] || extra['Expression'] || node.category === 'filter') {
    const expr = String(extra['Filters'] || extra['Expression'] || '').trim();
    if (expr) {
      return {
        sqlSnippet: `WHERE / HAVING ${expr}`,
        explanation: '由过滤谓词条件推导',
      };
    }
  }

  // 3. Join condition
  if (extra['Conditions'] || node.category === 'join') {
    const cond = String(extra['Conditions'] || '').trim();
    if (cond) {
      return {
        sqlSnippet: `JOIN ... ON ${cond}`,
        explanation: '由多表关联对齐条件推导',
      };
    }
  }

  // 4. Groups & Aggregates
  if (extra['Groups'] || extra['Aggregates'] || node.category === 'aggregate') {
    const parts = [extra['Groups'] ? `GROUP BY ${extra['Groups']}` : '', extra['Aggregates'] ? extra['Aggregates'] : '']
      .filter(Boolean)
      .join(' | ');
    if (parts) {
      return {
        sqlSnippet: parts,
        explanation: '由分组聚合子句推导',
      };
    }
  }

  // 5. Projections
  if (extra['Projections'] || node.category === 'projection') {
    const proj = String(extra['Projections'] || '').trim();
    if (proj) {
      return {
        sqlSnippet: `SELECT ${proj.length > 50 ? proj.slice(0, 50) + '...' : proj}`,
        explanation: '由列投影表达式推导',
      };
    }
  }

  return {
    sqlSnippet: undefined,
    explanation: 'Editor Pro 推导：暂未锁定直接对应的 SQL 子句',
  };
}
