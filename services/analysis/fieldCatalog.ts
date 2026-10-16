/**
 * Field catalog for analysis — roles, default aggs, unit hints.
 * Builds on analyticalCatalogService + classifySemanticType.
 */

import { duckDBService } from '../duckdbService';
import { classifySemanticType } from './semantic';
import { buildAnalyticalCatalog } from '../analyticalCatalogService';
import { useDatabaseAnalysis } from '../databaseAnalysis';
import { inferChartUnit } from '../../utils/chartFormat';
import type { AnalysisAgg, AnalysisFieldCatalog, AnalysisFieldCatalogEntry, FieldRef } from './types';
import type { FieldRole, MetricAgg } from '../../types/analyticalCatalog';

function defaultAggFor(role: FieldRole, column: string): AnalysisAgg {
  if (role === 'measure') {
    const n = column.toLowerCase();
    if (/rate|pct|percent|ratio|score|avg|price/.test(n)) return 'avg';
    return 'sum';
  }
  return 'count';
}

function suggestedAggs(role: FieldRole, column: string): AnalysisAgg[] {
  if (role !== 'measure') return ['count', 'count_distinct'];
  const n = column.toLowerCase();
  if (/rate|pct|percent|ratio|score|avg|price/.test(n)) return ['avg', 'min', 'max', 'sum'];
  return ['sum', 'avg', 'min', 'max', 'count'];
}

function mapSemantic(role: FieldRole): string {
  switch (role) {
    case 'measure':
      return 'numeric';
    case 'time':
      return 'temporal';
    case 'category':
    case 'comparison':
      return 'categorical';
    case 'identifier':
      return 'identifier';
    case 'boolean':
      return 'boolean';
    default:
      return 'text';
  }
}

/**
 * Build field catalog for a single table (preferred path for Analysis Spec).
 */
export async function buildFieldCatalog(table: string): Promise<AnalysisFieldCatalog> {
  const schema = await duckDBService.getTableSchema(table);
  let rowCount = 0;
  try {
    const rows = await duckDBService.readQuery(
      `SELECT COUNT(*)::BIGINT AS c FROM "${table.replace(/"/g, '""')}"`,
    );
    rowCount = Number(rows?.[0]?.c ?? 0);
  } catch {
    rowCount = 0;
  }

  // Prefer richer analytical catalog when available
  let analyticalFields: Map<string, { role: FieldRole; confidence: number; nullRate: number | null; distinctCount: number | null; sampleValues?: string[] }> =
    new Map();
  try {
    const shared = useDatabaseAnalysis.getState();
    const catalog = shared.database === duckDBService.getRuntimeInfo?.().currentDatabase && shared.model && !shared.loading
      ? shared.model : await buildAnalyticalCatalog([table]);
    const summary = catalog.tables.find((t) => t.tableName === table);
    if (summary) {
      for (const f of summary.fields) {
        analyticalFields.set(f.columnName, {
          role: f.role,
          confidence: f.confidence,
          nullRate: f.nullRate,
          distinctCount: f.distinctCount,
          sampleValues: f.sampleValues,
        });
      }
      rowCount = summary.rowCount || rowCount;
    }
  } catch {
    /* fall back to schema-only */
  }

  const fields: AnalysisFieldCatalogEntry[] = (schema || []).map((col) => {
    const semantic = classifySemanticType(col.name, col.type);
    const fromCatalog = analyticalFields.get(col.name);
    let role: FieldRole =
      fromCatalog?.role ??
      (semantic === 'numeric'
        ? 'measure'
        : semantic === 'temporal'
          ? 'time'
          : semantic === 'boolean'
            ? 'boolean'
            : semantic === 'identifier'
              ? 'identifier'
              : 'category');

    const unitHint = inferChartUnit(col.name);
    const entry: AnalysisFieldCatalogEntry = {
      column: col.name,
      physicalType: col.type,
      role,
      semanticType: fromCatalog ? mapSemantic(role) : semantic,
      defaultAgg: defaultAggFor(role, col.name),
      suggestedAggs: suggestedAggs(role, col.name),
      unitHint,
      confidence: fromCatalog?.confidence ?? 60,
      nullRate: fromCatalog?.nullRate ?? null,
      distinctCount: fromCatalog?.distinctCount ?? null,
      sampleValues: fromCatalog?.sampleValues,
    };
    return entry;
  });

  return {
    table,
    builtAt: Date.now(),
    rowCount,
    fields,
    dimensions: fields.filter((f) =>
      ['category', 'time', 'comparison', 'identifier', 'attribute', 'boolean'].includes(f.role),
    ),
    measures: fields.filter((f) => f.role === 'measure'),
    timeFields: fields.filter((f) => f.role === 'time'),
  };
}

export function catalogToFieldRefs(catalog: AnalysisFieldCatalog): FieldRef[] {
  return catalog.fields.map((f) => ({
    column: f.column,
    physicalType: f.physicalType,
    role: f.role,
    unitHint: f.unitHint,
    defaultAgg: f.defaultAgg,
  }));
}

export function resolveDefaultAgg(
  catalog: AnalysisFieldCatalog | null | undefined,
  column: string | undefined,
  fallback: AnalysisAgg = 'sum',
): AnalysisAgg {
  if (!column) return 'count';
  const entry = catalog?.fields.find((f) => f.column === column);
  return entry?.defaultAgg ?? fallback;
}

export function isValidAgg(agg: string): agg is MetricAgg {
  return ['sum', 'avg', 'count', 'count_distinct', 'min', 'max'].includes(agg);
}
