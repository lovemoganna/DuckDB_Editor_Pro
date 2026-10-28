/**
 * AnalysisSpec → DuckDB SQL compiler (CTE layered).
 */

import type {
  AnalysisSpec,
  CascadeFilter,
  ColumnRoleMap,
  CompiledAnalysis,
  FilterClause,
} from './types';
import { quoteIdent, quoteTable, literalValue, sanitizeAlias } from './sqlUtils';
import {
  compilePostAggCalcs,
  dimSelectSql,
  metricSelectSql,
  resolveMetricCalc,
  validateCalcExpression,
  rewriteExprWithColumns,
} from './calcCompiler';

function compileFilterClause(f: FilterClause): string {
  const col = quoteIdent(f.column);
  switch (f.op) {
    case 'is_null':
      return `${col} IS NULL`;
    case 'not_null':
      return `${col} IS NOT NULL`;
    case 'contains': {
      const v = escapeStr(String(f.value ?? ''));
      return `CAST(${col} AS VARCHAR) LIKE '%${v}%'`;
    }
    case 'in': {
      const vals = Array.isArray(f.value) ? f.value : [f.value ?? ''];
      if (vals.length === 0) return '1=0';
      return `${col} IN (${vals.map((v) => literalValue(v as string | number)).join(', ')})`;
    }
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const num = Number(f.value);
      if (Number.isFinite(num) && String(f.value).trim() !== '') {
        return `${col} ${f.op} ${num}`;
      }
      return `${col} ${f.op} ${literalValue(String(f.value ?? ''))}`;
    }
    case '!=':
      return `${col} != ${literalValue(String(f.value ?? ''))}`;
    case '=':
    default:
      return `${col} = ${literalValue(String(f.value ?? ''))}`;
  }
}

function escapeStr(v: string): string {
  return v.replace(/'/g, "''");
}

function cascadeAsFilters(cascade: CascadeFilter[]): FilterClause[] {
  return cascade
    .filter((c) => c.parentValue !== undefined && c.parentValue !== null && c.parentValue !== '')
    .map((c) => ({
      column: c.parentColumn,
      op: '=' as const,
      value: c.parentValue,
    }));
}

function collectWhere(spec: AnalysisSpec): string {
  const clauses: FilterClause[] = [
    ...spec.filters.global,
    ...spec.filters.interactive,
    ...cascadeAsFilters(spec.filters.cascade),
  ];
  if (clauses.length === 0) return '';
  return `WHERE ${clauses.map(compileFilterClause).join(' AND ')}`;
}

/** Shared shallow validation — used by pipeline + compiler. */
export function validateAnalysisSpec(spec: AnalysisSpec): void {
  if (!spec || spec.version !== 1) {
    throw new Error('AnalysisSpec.version 必须为 1');
  }
  if (!spec.dataset?.table) throw new Error('AnalysisSpec 缺少 dataset.table');
  if (!spec.dimensions?.length) throw new Error('AnalysisSpec 至少需要一个维度');

  const hasMetrics = (spec.metrics?.length ?? 0) > 0;
  const hasMeasureCalcs = (spec.calcs || []).some((c) =>
    ['lod_fixed', 'lod_include', 'lod_exclude', 'ratio', 'expr', 'rank', 'cumulative', 'moving', 'yoy', 'mom'].includes(
      c.kind,
    ),
  );
  if (!hasMetrics && !hasMeasureCalcs) {
    throw new Error('AnalysisSpec 至少需要一个度量或可产出数值的计算字段');
  }

  for (const calc of spec.calcs || []) {
    if (calc.kind === 'expr') {
      const r = validateCalcExpression(calc.expression || '');
      if (!r.ok) throw new Error(`计算字段「${calc.alias}」: ${(r as { ok: false; error: string }).error}`);
    }
  }

  for (const m of spec.metrics || []) {
    if (m.calcId) {
      resolveMetricCalc(spec, m);
    }
  }
}

/**
 * Compile AnalysisSpec into executable DuckDB SQL + column role map.
 */
export function compileAnalysisSql(spec: AnalysisSpec): CompiledAnalysis {
  validateAnalysisSpec(spec);

  const tableSql = quoteTable(spec.dataset.table);
  const roles: ColumnRoleMap = {};
  const dimAliases: string[] = [];
  const metricAliases: string[] = [];
  const calcAliases: string[] = [];

  // --- dimensions ---
  const dimSelects: string[] = [];
  for (const d of spec.dimensions) {
    const { select, alias } = dimSelectSql(d);
    dimSelects.push(select);
    dimAliases.push(alias);
    roles[alias] = 'dimension';
  }

  // Raw columns needed for expr rewrite / base projection
  const rawCols = [
    ...new Set([
      ...spec.dimensions.map((d) => d.column),
      ...spec.metrics.map((m) => m.column).filter(Boolean) as string[],
      ...spec.fields.map((f) => f.column),
      ...(spec.calcs || []).flatMap((c) => c.lodDimensions || []),
      ...(spec.calcs || []).map((c) => c.lodColumn).filter(Boolean) as string[],
      ...(spec.calcs || [])
        .filter((c) => c.kind === 'expr' && c.expression)
        .flatMap((c) => {
          // Collect identifier-like tokens as candidate raw cols (best-effort)
          const toks = (c.expression || '').match(/[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*/g) || [];
          return toks;
        }),
    ]),
  ];

  // Expr calcs consumed via metric.calcId — skip in post-agg to avoid double emission
  const skipCalcIds = new Set<string>();
  const metricSelects: string[] = [];
  for (const m of spec.metrics) {
    const alias = sanitizeAlias(m.alias);
    metricAliases.push(alias);
    roles[alias] = 'metric';
    const calc = resolveMetricCalc(spec, m);
    if (calc) {
      skipCalcIds.add(calc.id);
      skipCalcIds.add(calc.alias);
    }
    metricSelects.push(metricSelectSql(m, { calc, rawColumns: rawCols }));
  }

  // --- base CTE: raw table + optional pre-agg expr calcs (raw columns only) ---
  const baseExprSelects: string[] = [];
  for (const calc of spec.calcs || []) {
    if (calc.kind !== 'expr') continue;
    if (skipCalcIds.has(calc.id) || skipCalcIds.has(calc.alias)) continue;
    const expr = calc.expression || '';
    const usesMetricAlias = spec.metrics.some((m) =>
      new RegExp(`\\b${m.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(expr),
    );
    if (!usesMetricAlias) {
      const rewritten = rewriteExprWithColumns(expr, rawCols);
      baseExprSelects.push(`${rewritten} AS ${quoteIdent(sanitizeAlias(calc.alias))}`);
    }
  }

  const baseSelectList =
    baseExprSelects.length > 0 ? `*, ${baseExprSelects.join(', ')}` : '*';

  const whereSql = collectWhere(spec);

  const { selects: realPostSelects, lodCtes, lodJoins } = compilePostAggCalcs(spec, dimAliases, {
    skipCalcIds,
  });

  for (const s of realPostSelects) {
    const m = s.match(/AS\s+"((?:[^"]|"")*)"\s*$/i) || s.match(/AS\s+(\S+)\s*$/i);
    if (m) {
      const a = m[1].replace(/""/g, '"');
      calcAliases.push(a);
      roles[a] = 'calc';
    }
  }
  for (const lj of lodJoins) {
    calcAliases.push(lj.alias);
    roles[lj.alias] = 'calc';
  }

  const groupBy = dimAliases.map((_, i) => String(i + 1)).join(', ');

  // Sort / TopN
  const sortClauses =
    spec.sort?.length > 0
      ? spec.sort
      : metricAliases[0]
        ? [{ by: metricAliases[0], order: 'desc' as const }]
        : [];

  let orderBy = '';
  if (sortClauses.length > 0) {
    orderBy = `ORDER BY ${sortClauses
      .map((s) => `${quoteIdent(s.by)} ${s.order.toUpperCase()}`)
      .join(', ')}`;
  }

  const topN = spec.topN;
  const limitN = topN?.n && topN.n > 0 ? topN.n : undefined;

  // Build CTE chain
  const cteParts: string[] = [];
  cteParts.push(`base AS (\n  SELECT ${baseSelectList}\n  FROM ${tableSql}\n)`);
  cteParts.push(
    `filtered AS (\n  SELECT *\n  FROM base\n  ${whereSql}\n)`.replace(/\n  \n/g, '\n'),
  );

  for (const lod of lodCtes) {
    cteParts.push(lod.replace(/\n  FROM base\n/, '\n  FROM filtered\n'));
  }

  const aggSelectList = [...dimSelects, ...metricSelects];
  if (aggSelectList.length === 0) {
    throw new Error('聚合 SELECT 为空');
  }

  cteParts.push(
    `aggregated AS (\n  SELECT\n    ${aggSelectList.join(',\n    ')}\n  FROM filtered\n  GROUP BY ${groupBy}\n)`,
  );

  let fromCalcs = 'aggregated';
  if (lodJoins.length > 0 || realPostSelects.length > 0) {
    const joinSql: string[] = [];
    const lodCols: string[] = [];
    lodJoins.forEach((lj, idx) => {
      const alias = `l${idx}`;
      // Prefer joining on LOD physical keys when they match dim aliases; else 1=1 (grand total)
      const on =
        lj.joinKeys.length > 0
          ? lj.joinKeys
              .map((k) => `aggregated.${quoteIdent(k)} = ${alias}.${quoteIdent(k)}`)
              .join(' AND ')
          : '1=1';
      joinSql.push(`LEFT JOIN ${lj.cteName} ${alias} ON ${on}`);
      lodCols.push(`${alias}.${quoteIdent(lj.alias)} AS ${quoteIdent(lj.alias)}`);
    });

    const selectCalcs = [
      ...dimAliases.map((a) => `aggregated.${quoteIdent(a)}`),
      ...metricAliases.map((a) => `aggregated.${quoteIdent(a)}`),
      ...realPostSelects,
      ...lodCols,
    ];

    cteParts.push(
      `calcs AS (\n  SELECT\n    ${selectCalcs.join(',\n    ')}\n  FROM aggregated\n  ${joinSql.join('\n  ')}\n)`,
    );
    fromCalcs = 'calcs';
  }

  let finalSql: string;
  if (topN?.othersBucket && limitN && topN.by) {
    cteParts.push(
      `ranked AS (\n  SELECT *, ROW_NUMBER() OVER (${orderBy || `ORDER BY ${quoteIdent(topN.by)} DESC`}) AS __rn\n  FROM ${fromCalcs}\n)`,
    );
    const dim0 = dimAliases[0];
    const metricSelectOthers = metricAliases
      .map((a) => `SUM(${quoteIdent(a)}) AS ${quoteIdent(a)}`)
      .join(', ');
    finalSql = `WITH ${cteParts.join(',\n')}
SELECT ${[...dimAliases.map((a) => quoteIdent(a)), ...metricAliases.map((a) => quoteIdent(a)), ...calcAliases.map((a) => quoteIdent(a))].join(', ')}
FROM ranked
WHERE __rn <= ${limitN}
UNION ALL
SELECT ${literalValue('其他')} AS ${quoteIdent(dim0)}${dimAliases
      .slice(1)
      .map((a) => `, NULL AS ${quoteIdent(a)}`)
      .join('')}, ${metricSelectOthers}${calcAliases.map((a) => `, NULL AS ${quoteIdent(a)}`).join('')}
FROM ranked
WHERE __rn > ${limitN};`;
  } else {
    const limitClause = limitN ? `LIMIT ${limitN}` : '';
    const outCols = [
      ...dimAliases.map((a) => quoteIdent(a)),
      ...metricAliases.map((a) => quoteIdent(a)),
      ...calcAliases.map((a) => quoteIdent(a)),
    ];
    finalSql = `WITH ${cteParts.join(',\n')}
SELECT ${outCols.join(', ')}
FROM ${fromCalcs}
${orderBy}
${limitClause};`.trim();
  }

  const sql = finalSql.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  return {
    sql,
    roles,
    dimAliases,
    metricAliases,
    calcAliases,
  };
}

/** Compile SQL only (convenience). */
export function compileSql(spec: AnalysisSpec): string {
  return compileAnalysisSql(spec).sql;
}
