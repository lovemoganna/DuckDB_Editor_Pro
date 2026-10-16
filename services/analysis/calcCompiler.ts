/**
 * Calc expression validation + SQL fragment compilation for window / LOD / period calcs.
 *
 * LOD semantics (DuckDB approximations, not full Tableau LOD):
 * - lod_fixed: separate aggregate CTE + LEFT JOIN on intersecting grain keys
 * - lod_include / lod_exclude: window SUM with PARTITION BY include/exclude dims
 */

import type {
  AnalysisAgg,
  AnalysisSpec,
  CalcDef,
  DimBinding,
  LodJoinMeta,
  MetricBinding,
} from './types';
import { quoteIdent, sanitizeAlias } from './sqlUtils';

/** Allowed function names inside expr calcs (case-insensitive). */
const ALLOWED_FUNCS = new Set(
  [
    'abs',
    'ceil',
    'floor',
    'round',
    'sqrt',
    'ln',
    'log',
    'log10',
    'exp',
    'power',
    'pow',
    'greatest',
    'least',
    'coalesce',
    'nullif',
    'cast',
    'case',
    'when',
    'then',
    'else',
    'end',
    'and',
    'or',
    'not',
    'is',
    'null',
    'true',
    'false',
    'date_trunc',
    'date_part',
    'extract',
    'year',
    'month',
    'day',
    'length',
    'lower',
    'upper',
    'trim',
    'concat',
  ].map((s) => s.toLowerCase()),
);

/**
 * Validate a scalar calc expression — identifiers, numbers, operators, CASE, whitelisted funcs.
 * Rejects semicolons, comments, subqueries, and unknown function calls.
 */
export function validateCalcExpression(expression: string): { ok: true } | { ok: false; error: string } {
  const expr = String(expression || '').trim();
  if (!expr) return { ok: false, error: '计算表达式为空' };
  if (expr.length > 500) return { ok: false, error: '计算表达式过长' };
  if (/;|--|\/\*|\*\//.test(expr)) return { ok: false, error: '禁止注释或语句分隔符' };
  if (/\b(select|insert|update|delete|drop|alter|create|attach|copy|pragma|call)\b/i.test(expr)) {
    return { ok: false, error: '禁止 SQL 关键字' };
  }
  if (/\(\s*select\b/i.test(expr)) return { ok: false, error: '禁止子查询' };

  // Tokenize roughly: identifiers, numbers, strings, operators, parens
  const re =
    /'(?:''|[^'])*'|"(?:[^"]|"")*"|[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*|\d+(?:\.\d+)?|[+\-*/%<>=!(),.]|\s+/g;
  let m: RegExpExecArray | null;
  let covered = 0;
  const idents: string[] = [];
  while ((m = re.exec(expr)) !== null) {
    covered += m[0].length;
    const tok = m[0];
    if (/^\s+$/.test(tok) || /^'/.test(tok) || /^"/.test(tok) || /^\d/.test(tok) || /^[+\-*/%<>=!(),.]$/.test(tok)) {
      continue;
    }
    idents.push(tok);
  }
  if (covered !== expr.length) {
    return { ok: false, error: '表达式含非法字符' };
  }

  // Function calls: IDENT(
  const funcCalls = expr.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g);
  for (const fc of funcCalls) {
    const name = fc[1].toLowerCase();
    if (!ALLOWED_FUNCS.has(name)) {
      return { ok: false, error: `不允许的函数: ${fc[1]}` };
    }
  }

  return { ok: true };
}

/** Rewrite bare identifiers in expr to quoted column refs when they match known columns. */
export function rewriteExprWithColumns(expression: string, columns: string[]): string {
  const colSet = new Set(columns.map((c) => c.toLowerCase()));
  const colMap = new Map(columns.map((c) => [c.toLowerCase(), c]));
  return expression.replace(
    /'(?:''|[^'])*'|"(?:[^"]|"")*"|[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*/g,
    (tok) => {
      if (tok.startsWith("'") || tok.startsWith('"')) return tok;
      const lower = tok.toLowerCase();
      if (ALLOWED_FUNCS.has(lower)) return tok;
      if (colSet.has(lower)) return quoteIdent(colMap.get(lower)!);
      return tok;
    },
  );
}

export function aggSql(agg: AnalysisAgg, columnExpr: string, nativeNumeric = false): string {
  switch (agg) {
    case 'count':
      return `COUNT(${columnExpr})`;
    case 'count_distinct':
      return `COUNT(DISTINCT ${columnExpr})`;
    case 'sum':
      return `COALESCE(SUM(${nativeNumeric ? columnExpr : `CAST(${columnExpr} AS DOUBLE)`}), 0)`;
    case 'avg':
      return `COALESCE(AVG(${nativeNumeric ? columnExpr : `CAST(${columnExpr} AS DOUBLE)`}), 0)`;
    case 'min':
      return `MIN(${columnExpr})`;
    case 'max':
      return `MAX(${columnExpr})`;
    default:
      return `COUNT(${columnExpr})`;
  }
}

/**
 * Compile a metric SELECT fragment.
 * When `calcId` references an `expr` CalcDef, aggregate that expression instead of a raw column.
 * Non-expr calcs referenced by calcId are handled as post-agg columns (see sqlCompiler).
 */
export function metricSelectSql(
  m: MetricBinding,
  options?: { calc?: CalcDef | null; rawColumns?: string[]; nativeNumeric?: boolean },
): string {
  const alias = quoteIdent(sanitizeAlias(m.alias));
  const calc = options?.calc;

  if (m.calcId && calc) {
    if (calc.kind !== 'expr') {
      throw new Error(
        `度量「${m.alias}」的 calcId 指向 ${calc.kind}；仅 expr 可作为聚合度量，其他计算请放在 calcs[]`,
      );
    }
    const check = validateCalcExpression(calc.expression || '');
    if (!check.ok) throw new Error(`度量「${m.alias}」计算表达式: ${(check as { ok: false; error: string }).error}`);
    const rewritten = rewriteExprWithColumns(calc.expression!, options?.rawColumns || []);
    if (m.agg === 'count' && !calc.expression) {
      return `COUNT(*) AS ${alias}`;
    }
    return `${aggSql(m.agg, rewritten)} AS ${alias}`;
  }

  if (m.agg === 'count' && !m.column) {
    return `COUNT(*) AS ${alias}`;
  }
  const col = m.column ? quoteIdent(m.column) : '*';
  return `${aggSql(m.agg, col, options?.nativeNumeric)} AS ${alias}`;
}

/** Resolve CalcDef for a metric.calcId, or null if unset. */
export function resolveMetricCalc(spec: AnalysisSpec, m: MetricBinding): CalcDef | null {
  if (!m.calcId) return null;
  const calc = (spec.calcs || []).find((c) => c.id === m.calcId || c.alias === m.calcId);
  if (!calc) throw new Error(`度量「${m.alias}」引用了不存在的计算字段 calcId=${m.calcId}`);
  return calc;
}

export function dimSelectSql(d: DimBinding): { select: string; alias: string } {
  const alias = sanitizeAlias(d.alias || (d.dateTrunc ? `${d.column}_${d.dateTrunc}` : d.column));
  const col = quoteIdent(d.column);
  if (d.dateTrunc) {
    return {
      select: `DATE_TRUNC('${d.dateTrunc}', CAST(${col} AS DATE)) AS ${quoteIdent(alias)}`,
      alias,
    };
  }
  return { select: `${col} AS ${quoteIdent(alias)}`, alias };
}

function resolveMetricAlias(spec: AnalysisSpec, metricIdOrAlias?: string): string | null {
  if (!metricIdOrAlias) return null;
  const byId = spec.metrics.find((m) => m.id === metricIdOrAlias);
  if (byId) return sanitizeAlias(byId.alias);
  const byAlias = spec.metrics.find((m) => m.alias === metricIdOrAlias);
  if (byAlias) return sanitizeAlias(byAlias.alias);
  const calc = spec.calcs.find((c) => c.id === metricIdOrAlias || c.alias === metricIdOrAlias);
  if (calc) return sanitizeAlias(calc.alias);
  return sanitizeAlias(metricIdOrAlias);
}

function orderDimExprs(dimAliases: string[]): string {
  return dimAliases.map((a) => quoteIdent(a)).join(', ');
}

/**
 * Compile post-aggregation calc columns for the `calcs` CTE.
 * Returns SELECT fragments + structured LOD join metadata (no string protocol).
 *
 * `skipCalcIds`: expr calcs already consumed as metric.calcId aggregations.
 */
export function compilePostAggCalcs(
  spec: AnalysisSpec,
  dimAliases: string[],
  options?: { skipCalcIds?: Set<string> },
): { selects: string[]; lodCtes: string[]; lodJoins: LodJoinMeta[] } {
  const selects: string[] = [];
  const lodCtes: string[] = [];
  const lodJoins: LodJoinMeta[] = [];
  const orderDims = orderDimExprs(dimAliases);
  const partitionAll = dimAliases.length > 0 ? dimAliases.map((a) => quoteIdent(a)).join(', ') : '';
  const skip = options?.skipCalcIds || new Set<string>();

  for (const calc of spec.calcs) {
    if (skip.has(calc.id) || skip.has(calc.alias)) continue;

    const alias = quoteIdent(sanitizeAlias(calc.alias));
    const src = resolveMetricAlias(spec, calc.sourceMetricId);
    const srcRef = src ? quoteIdent(src) : null;

    switch (calc.kind) {
      case 'expr': {
        // Expr calcs on aggregated grain: allow referencing metric aliases
        const metricAliases = spec.metrics.map((m) => sanitizeAlias(m.alias));
        const check = validateCalcExpression(calc.expression || '');
        if (!check.ok) throw new Error(`计算字段「${calc.alias}」: ${(check as { ok: false; error: string }).error}`);
        const rewritten = rewriteExprWithColumns(calc.expression!, [
          ...dimAliases,
          ...metricAliases,
        ]);
        selects.push(`${rewritten} AS ${alias}`);
        break;
      }
      case 'ratio': {
        if (!srcRef) throw new Error(`占比计算「${calc.alias}」缺少 sourceMetricId`);
        const denAlias = resolveMetricAlias(spec, calc.denominatorMetricId);
        if (denAlias) {
          selects.push(
            `CASE WHEN ${quoteIdent(denAlias)} = 0 OR ${quoteIdent(denAlias)} IS NULL THEN NULL ELSE ${srcRef} / ${quoteIdent(denAlias)} END AS ${alias}`,
          );
        } else {
          const over = partitionAll ? '' : '';
          selects.push(
            `CASE WHEN SUM(${srcRef}) OVER (${over}) = 0 THEN NULL ELSE ${srcRef} / SUM(${srcRef}) OVER (${over}) END AS ${alias}`,
          );
        }
        break;
      }
      case 'mom':
      case 'yoy': {
        if (!srcRef) throw new Error(`期间比较「${calc.alias}」缺少 sourceMetricId`);
        const timeDims = spec.dimensions.filter(d=>d.dateTrunc);
        if (timeDims.length !== 1) throw new Error(`期间比较「${calc.alias}」需要一个明确粒度的时间维度`);
        const time = timeDims[0], grain = time.dateTrunc!;
        const timeAlias = sanitizeAlias(time.alias || `${time.column}_${grain}`);
        const interval = calc.kind === 'yoy' ? 'year' : grain;
        const keys = dimAliases.filter(key=>key!==timeAlias);
        const match = [`previous.${quoteIdent(timeAlias)} = DATE_TRUNC('${grain}', aggregated.${quoteIdent(timeAlias)} - INTERVAL '1 ${interval}')`,
          ...keys.map(key=>`previous.${quoteIdent(key)} IS NOT DISTINCT FROM aggregated.${quoteIdent(key)}`)].join(' AND ');
        // Lookup the calendar period within the same dimensional group. A gap,
        // leap year or another group must never become a positional baseline.
        const prior = `(SELECT previous.${srcRef} FROM aggregated previous WHERE ${match})`;
        const current = `aggregated.${srcRef}`;
        selects.push(
          `CASE WHEN ${prior} IS NULL OR ${prior} = 0 THEN NULL ELSE ROUND((${current} - ${prior}) / ${prior} * 100, 2) END AS ${alias}`,
        );
        break;
      }
      case 'cumulative': {
        if (!srcRef) throw new Error(`累计计算「${calc.alias}」缺少 sourceMetricId`);
        const ord = orderDims || srcRef;
        const part = calc.partitionBy?.length
          ? `PARTITION BY ${calc.partitionBy.map((c) => quoteIdent(c)).join(', ')} `
          : '';
        selects.push(
          `SUM(${srcRef}) OVER (${part}ORDER BY ${ord} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ${alias}`,
        );
        break;
      }
      case 'rank': {
        if (!srcRef) throw new Error(`排名计算「${calc.alias}」缺少 sourceMetricId`);
        const fn =
          calc.rankFn === 'dense_rank'
            ? 'DENSE_RANK'
            : calc.rankFn === 'row_number'
              ? 'ROW_NUMBER'
              : 'RANK';
        const ordDir = (calc.rankOrder || 'desc').toUpperCase();
        const part = calc.partitionBy?.length
          ? `PARTITION BY ${calc.partitionBy.map((c) => quoteIdent(c)).join(', ')} `
          : '';
        selects.push(`${fn}() OVER (${part}ORDER BY ${srcRef} ${ordDir}) AS ${alias}`);
        break;
      }
      case 'moving': {
        if (!srcRef) throw new Error(`移动窗口「${calc.alias}」缺少 sourceMetricId`);
        const n = Math.max(1, calc.windowSize ?? 7);
        const ord = orderDims || srcRef;
        const fn = calc.movingAgg === 'sum' ? 'SUM' : 'AVG';
        selects.push(
          `${fn}(${srcRef}) OVER (ORDER BY ${ord} ROWS BETWEEN ${n - 1} PRECEDING AND CURRENT ROW) AS ${alias}`,
        );
        break;
      }
      case 'lod_fixed': {
        const lodDims = calc.lodDimensions || [];
        const lodCol = calc.lodColumn;
        const lodAgg = calc.lodAgg || 'sum';
        if (!lodCol && lodAgg !== 'count') {
          throw new Error(`LOD FIXED「${calc.alias}」缺少 lodColumn`);
        }
        const cteName = `lod_${sanitizeAlias(calc.id).replace(/[^\w\u4e00-\u9fff]/g, '_')}`;
        const calcAlias = sanitizeAlias(calc.alias);
        const dimSelects = lodDims.map((c) => `${quoteIdent(c)} AS ${quoteIdent(c)}`);
        const measureExpr =
          lodAgg === 'count' && !lodCol
            ? 'COUNT(*)'
            : aggSql(lodAgg, lodCol ? quoteIdent(lodCol) : '*');
        const groupBy =
          lodDims.length > 0 ? `GROUP BY ${lodDims.map((_, i) => String(i + 1)).join(', ')}` : '';
        lodCtes.push(
          `${cteName} AS (\n  SELECT ${[...dimSelects, `${measureExpr} AS ${quoteIdent(calcAlias)}`].join(', ')}\n  FROM base\n  ${groupBy}\n)`,
        );
        // Join keys: match LOD physical columns to outer dim aliases (exact or dateTrunc prefix)
        const joinKeys = lodDims
          .map((d) => {
            const exact = dimAliases.find((a) => a === d);
            if (exact) return exact;
            return dimAliases.find((a) => a.startsWith(`${d}_`)) || null;
          })
          .filter((k): k is string => !!k);
        lodJoins.push({ cteName, alias: calcAlias, joinKeys });
        break;
      }
      case 'lod_include': {
        if (!srcRef) throw new Error(`LOD INCLUDE「${calc.alias}」缺少 sourceMetricId`);
        const extra = (calc.lodDimensions || []).map((c) => quoteIdent(c));
        const parts = [...dimAliases.map((a) => quoteIdent(a)), ...extra];
        const partSql = parts.length ? `PARTITION BY ${parts.join(', ')}` : '';
        selects.push(`SUM(${srcRef}) OVER (${partSql}) AS ${alias}`);
        break;
      }
      case 'lod_exclude': {
        if (!srcRef) throw new Error(`LOD EXCLUDE「${calc.alias}」缺少 sourceMetricId`);
        const exclude = new Set(calc.lodDimensions || []);
        const parts = dimAliases.filter((a) => !exclude.has(a)).map((a) => quoteIdent(a));
        const partSql = parts.length ? `PARTITION BY ${parts.join(', ')}` : '';
        selects.push(`SUM(${srcRef}) OVER (${partSql}) AS ${alias}`);
        break;
      }
      default:
        throw new Error(`未知计算类型: ${(calc as CalcDef).kind}`);
    }
  }

  return { selects, lodCtes, lodJoins };
}

/** Base-layer (pre-agg) projections for expr calcs that only reference raw columns */
export function compileBaseExprCalcs(
  calcs: CalcDef[],
  rawColumns: string[],
): string[] {
  const out: string[] = [];
  for (const calc of calcs) {
    if (calc.kind !== 'expr') continue;
    // Skip if expression references metric aliases only — handled post-agg
    // Heuristic: if any raw column appears, project in base
    const check = validateCalcExpression(calc.expression || '');
    if (!check.ok) throw new Error(`计算字段「${calc.alias}」: ${(check as { ok: false; error: string }).error}`);
    const lower = (calc.expression || '').toLowerCase();
    const usesRaw = rawColumns.some((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower));
    if (usesRaw) {
      const rewritten = rewriteExprWithColumns(calc.expression!, rawColumns);
      out.push(`${rewritten} AS ${quoteIdent(sanitizeAlias(calc.alias))}`);
    }
  }
  return out;
}
