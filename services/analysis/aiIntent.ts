/**
 * AI Analysis Intent → validated AnalysisSpec.
 * AI must not emit raw SQL for the analysis path; only Intent JSON.
 */

import type {
  AnalysisAgg,
  AnalysisFieldCatalog,
  AnalysisIntent,
  AnalysisSpec,
  CalcDef,
  ChartTypeId,
  DateTruncGrain,
  FilterClause,
  FilterOp,
} from './types';
import { createEmptySpec, emptyFilters } from './types';
import { isValidAgg } from './fieldCatalog';
import { validateCalcExpression } from './calcCompiler';
import { listChartTypes } from './chartRegistry';

const FILTER_OPS = new Set<FilterOp>([
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'in',
  'not_null',
  'is_null',
]);

const GRAINS = new Set<DateTruncGrain>(['day', 'week', 'month', 'quarter', 'year']);

const CALC_KINDS = new Set([
  'expr',
  'ratio',
  'yoy',
  'mom',
  'cumulative',
  'rank',
  'moving',
  'lod_fixed',
  'lod_include',
  'lod_exclude',
]);

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseJsonLoose(input: unknown): unknown {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Strip markdown fences if present
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(raw);
  }
  return input;
}

function assertColumn(catalog: AnalysisFieldCatalog | null | undefined, column: string, label: string) {
  if (!catalog) return;
  if (!catalog.fields.some((f) => f.column === column)) {
    throw new Error(`${label} 引用了未知列「${column}」`);
  }
}

function normalizeFilter(raw: unknown, index: number): FilterClause {
  if (!raw || typeof raw !== 'object') throw new Error(`filters[${index}] 非法`);
  const f = raw as Record<string, unknown>;
  const column = String(f.column || '');
  if (!column) throw new Error(`filters[${index}] 缺少 column`);
  const op = String(f.op || '=') as FilterOp;
  if (!FILTER_OPS.has(op)) throw new Error(`filters[${index}] 不支持的 op: ${op}`);
  return {
    id: typeof f.id === 'string' ? f.id : `f_${index}`,
    column,
    op,
    value: f.value as FilterClause['value'],
  };
}

function normalizeCalc(raw: unknown, index: number): CalcDef {
  if (!raw || typeof raw !== 'object') throw new Error(`calcs[${index}] 非法`);
  const c = raw as Record<string, unknown>;
  const kind = String(c.kind || '');
  if (!CALC_KINDS.has(kind)) throw new Error(`calcs[${index}] 未知 kind: ${kind}`);
  const alias = String(c.alias || `calc_${index}`);
  const def: CalcDef = {
    id: typeof c.id === 'string' ? c.id : uid('calc'),
    kind: kind as CalcDef['kind'],
    alias,
    expression: c.expression != null ? String(c.expression) : undefined,
    sourceMetricId: c.sourceMetricId != null ? String(c.sourceMetricId) : undefined,
    denominatorMetricId: c.denominatorMetricId != null ? String(c.denominatorMetricId) : undefined,
    rankFn: c.rankFn as CalcDef['rankFn'],
    rankOrder: c.rankOrder === 'asc' || c.rankOrder === 'desc' ? c.rankOrder : undefined,
    partitionBy: Array.isArray(c.partitionBy) ? c.partitionBy.map(String) : undefined,
    windowSize: typeof c.windowSize === 'number' ? c.windowSize : undefined,
    movingAgg: c.movingAgg === 'sum' || c.movingAgg === 'avg' ? c.movingAgg : undefined,
    lodDimensions: Array.isArray(c.lodDimensions) ? c.lodDimensions.map(String) : undefined,
    lodColumn: c.lodColumn != null ? String(c.lodColumn) : undefined,
    lodAgg: c.lodAgg && isValidAgg(String(c.lodAgg)) ? (c.lodAgg as AnalysisAgg) : undefined,
  };
  if (def.kind === 'expr') {
    const v = validateCalcExpression(def.expression || '');
    if (!v.ok) throw new Error(`calcs[${index}] ${(v as { ok: false; error: string }).error}`);
  }
  return def;
}

const allowedCharts = () => new Set(listChartTypes().map((c) => c.id));

/**
 * Parse LLM JSON (object or string) into a validated AnalysisSpec.
 */
export function parseAndNormalize(
  llmJson: unknown,
  catalog?: AnalysisFieldCatalog | null,
  defaults?: { table?: string; contextId?: string; strict?: boolean },
): AnalysisSpec {
  let data: unknown;
  try {
    data = parseJsonLoose(llmJson);
  } catch (e) {
    throw new Error(`无法解析分析意图 JSON: ${(e as Error).message}`);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('分析意图必须是 JSON 对象');
  }

  const intent = data as AnalysisIntent & Record<string, unknown>;
  const table = String(intent.table || defaults?.table || catalog?.table || '');
  if (!table) throw new Error('分析意图缺少 table');

  const strict = defaults?.strict !== false;
  if (strict && catalog && catalog.table !== table) {
    throw new Error(
      `分析意图 table「${table}」与字段目录「${catalog.table}」不一致（strict 模式）`,
    );
  }

  const dimensions = (intent.dimensions || []).map((d, i) => {
    const column = String(d.column || '');
    if (!column) throw new Error(`dimensions[${i}] 缺少 column`);
    assertColumn(catalog, column, `dimensions[${i}]`);
    const dateTrunc =
      d.dateTrunc && GRAINS.has(d.dateTrunc) ? d.dateTrunc : undefined;
    return {
      id: uid('dim'),
      column,
      dateTrunc,
      alias: d.alias || (dateTrunc ? `${column}_${dateTrunc}` : column),
    };
  });

  if (dimensions.length === 0) {
    // Default first category/time from catalog
    const fallback =
      catalog?.timeFields[0] ||
      catalog?.dimensions.find((f) => f.role === 'category') ||
      catalog?.fields[0];
    if (!fallback) throw new Error('分析意图缺少 dimensions，且无可用字段目录');
    dimensions.push({
      id: uid('dim'),
      column: fallback.column,
      alias: fallback.column,
      dateTrunc: fallback.role === 'time' ? 'month' : undefined,
    });
  }

  const metrics = (intent.metrics || []).map((m, i) => {
    const aggRaw = String(m.agg || (m.column ? 'sum' : 'count'));
    if (!isValidAgg(aggRaw)) throw new Error(`metrics[${i}] 非法聚合: ${aggRaw}`);
    if (m.column) assertColumn(catalog, m.column, `metrics[${i}]`);
    const alias = m.alias || (m.column ? `${aggRaw}_${m.column}` : '记录条数');
    return {
      id: uid('m'),
      column: m.column,
      agg: aggRaw as AnalysisAgg,
      alias,
      calcId: m.calcId,
    };
  });

  if (metrics.length === 0) {
    const measure = catalog?.measures[0];
    if (measure) {
      metrics.push({
        id: uid('m'),
        column: measure.column,
        agg: measure.defaultAgg,
        alias: `总${measure.column}`,
        calcId: undefined,
      });
    } else {
      metrics.push({
        id: uid('m'),
        column: undefined,
        agg: 'count',
        alias: '记录条数',
        calcId: undefined,
      });
    }
  }

  const calcs = (intent.calcs || []).map((c, i) => normalizeCalc(c, i));
  const filters = (intent.filters || []).map((f, i) => {
    const clause = normalizeFilter(f, i);
    assertColumn(catalog, clause.column, `filters[${i}]`);
    return clause;
  });

  let chartType: ChartTypeId = (intent.chartType as ChartTypeId) || 'bar';
  if (!allowedCharts().has(chartType)) {
    chartType = 'bar';
  }

  const fields =
    catalog?.fields.map((f) => ({
      column: f.column,
      physicalType: f.physicalType,
      role: f.role,
      unitHint: f.unitHint,
      defaultAgg: f.defaultAgg,
    })) || [];

  return createEmptySpec({
    id: uid('spec'),
    dataset: {
      table,
      contextId: intent.contextId || defaults?.contextId,
    },
    fields,
    dimensions,
    metrics,
    calcs,
    filters: {
      ...emptyFilters(),
      global: filters,
    },
    sort: (intent.sort || []).map((s) => ({
      by: String(s.by),
      order: s.order === 'asc' ? 'asc' : 'desc',
    })),
    topN: intent.topN
      ? {
          n: Number(intent.topN.n) || 10,
          by: String(intent.topN.by || metrics[0]?.alias || ''),
          othersBucket: !!intent.topN.othersBucket,
        }
      : undefined,
    visual: {
      chartType,
      title: intent.title,
    },
  });
}

/** JSON Schema-like description for prompts (documentation / system prompt injection). */
export const ANALYSIS_INTENT_SCHEMA_HINT = `{
  "table": "string (required)",
  "dimensions": [{ "column": "string", "dateTrunc": "day|week|month|quarter|year?", "alias": "string?" }],
  "metrics": [{ "column": "string?", "agg": "sum|avg|count|count_distinct|min|max", "alias": "string?" }],
  "calcs": [{ "id": "string?", "kind": "expr|ratio|yoy|mom|cumulative|rank|moving|lod_fixed|lod_include|lod_exclude", "alias": "string", "...": "kind-specific" }],
  "filters": [{ "column": "string", "op": "=|!=|>|>=|<|<=|contains|in|not_null|is_null", "value": "any?" }],
  "sort": [{ "by": "string", "order": "asc|desc" }],
  "topN": { "n": "number", "by": "string", "othersBucket": "boolean?" },
  "chartType": "bar|line|area|doughnut|pie|table|kpi",
  "title": "string?"
}`;
