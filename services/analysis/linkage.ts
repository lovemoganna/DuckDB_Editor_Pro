/**
 * Pure Spec patches for filters, cascade, brush linkage, drill, dynamic fields.
 * UI emits events here, then re-runs pipeline.runAnalysis(spec).
 */

import type {
  AnalysisSpec,
  DimBinding,
  FilterClause,
  LinkageEvent,
  MetricBinding,
} from './types';
import { emptyFilters } from './types';

function cloneSpec(spec: AnalysisSpec): AnalysisSpec {
  return {
    ...spec,
    dimensions: spec.dimensions.map((d) => ({ ...d })),
    metrics: spec.metrics.map((m) => ({ ...m })),
    calcs: (spec.calcs || []).map((c) => ({ ...c })),
    filters: {
      global: [...(spec.filters?.global || [])],
      cascade: [...(spec.filters?.cascade || [])],
      interactive: [...(spec.filters?.interactive || [])],
    },
    sort: [...(spec.sort || [])],
    topN: spec.topN ? { ...spec.topN } : undefined,
    visual: { ...spec.visual, encoding: spec.visual.encoding ? { ...spec.visual.encoding } : undefined },
    linkage: spec.linkage ? { ...spec.linkage, listen: [...spec.linkage.listen], emit: [...spec.linkage.emit] } : undefined,
    drill: spec.drill ? { ...spec.drill, path: [...spec.drill.path] } : undefined,
    fields: [...(spec.fields || [])],
    dataset: { ...spec.dataset },
  };
}

export function applyGlobalFilter(spec: AnalysisSpec, clause: FilterClause): AnalysisSpec {
  const next = cloneSpec(spec);
  if (!next.filters) next.filters = emptyFilters();
  const key = clause.id || `${clause.column}:${clause.op}`;
  next.filters.global = next.filters.global.filter(
    (f) => (f.id || `${f.column}:${f.op}`) !== key,
  );
  next.filters.global.push({ ...clause, id: clause.id || key });
  return next;
}

export function removeGlobalFilter(spec: AnalysisSpec, clauseIdOrColumn: string): AnalysisSpec {
  const next = cloneSpec(spec);
  next.filters.global = next.filters.global.filter(
    (f) => f.id !== clauseIdOrColumn && f.column !== clauseIdOrColumn,
  );
  return next;
}

export function applyCascadeParent(
  spec: AnalysisSpec,
  parentColumn: string,
  childColumn: string,
  parentValue: string | number | undefined,
): AnalysisSpec {
  const next = cloneSpec(spec);
  next.filters.cascade = next.filters.cascade.filter((c) => c.childColumn !== childColumn);
  next.filters.cascade.push({ parentColumn, childColumn, parentValue });
  return next;
}

export function applyBrush(
  spec: AnalysisSpec,
  field: string,
  values: Array<string | number>,
): AnalysisSpec {
  const next = cloneSpec(spec);
  const brushId = `brush:${field}`;
  next.filters.interactive = next.filters.interactive.filter((f) => f.id !== brushId);
  if (values.length === 1) {
    next.filters.interactive.push({
      id: brushId,
      column: field,
      op: '=',
      value: values[0],
    });
  } else if (values.length > 1) {
    next.filters.interactive.push({
      id: brushId,
      column: field,
      op: 'in',
      value: values,
    });
  }
  if (next.linkage) {
    next.linkage = { ...next.linkage, brushField: field };
  }
  return next;
}

export function clearInteractiveFilters(spec: AnalysisSpec): AnalysisSpec {
  const next = cloneSpec(spec);
  next.filters.interactive = [];
  return next;
}

/**
 * Drill into a dimension value: append interactive filter on current path level,
 * advance drill.currentLevel when path has a next dimension.
 */
export function applyDrill(spec: AnalysisSpec, dimValue: string | number): AnalysisSpec {
  const next = cloneSpec(spec);
  const path = next.drill?.path?.length
    ? next.drill.path
    : next.dimensions.map((d) => d.column);
  const level = next.drill?.currentLevel ?? 0;
  const col = path[Math.min(level, path.length - 1)];
  if (!col) return next;

  const drillId = `drill:${col}:${level}`;
  next.filters.interactive = next.filters.interactive.filter((f) => f.id !== drillId);
  next.filters.interactive.push({
    id: drillId,
    column: col,
    op: '=',
    value: dimValue,
  });

  const nextLevel = Math.min(level + 1, Math.max(0, path.length - 1));
  next.drill = { path, currentLevel: nextLevel };

  // Promote next path dimension into dimensions if missing
  const nextCol = path[nextLevel];
  if (nextCol && nextLevel > level && !next.dimensions.some((d) => d.column === nextCol)) {
    next.dimensions.push({
      id: `dim_${nextCol}`,
      column: nextCol,
    });
  }

  // Detail mode at leaf
  if (nextLevel >= path.length - 1 && level >= path.length - 1) {
    next.visual = { ...next.visual, chartType: 'table' };
  }

  return next;
}

export function resetDrill(spec: AnalysisSpec): AnalysisSpec {
  const next = cloneSpec(spec);
  next.filters.interactive = next.filters.interactive.filter((f) => !String(f.id || '').startsWith('drill:'));
  if (next.drill) {
    next.drill = { ...next.drill, currentLevel: 0 };
  }
  return next;
}

export type DynamicSlot =
  | { kind: 'dimension'; index: number }
  | { kind: 'metric'; index: number };

export function swapDynamicField(
  spec: AnalysisSpec,
  slot: DynamicSlot,
  field: string,
  patch?: Partial<DimBinding> | Partial<MetricBinding>,
): AnalysisSpec {
  const next = cloneSpec(spec);
  if (slot.kind === 'dimension') {
    const dim = next.dimensions[slot.index];
    if (!dim) throw new Error(`维度槽位 ${slot.index} 不存在`);
    next.dimensions[slot.index] = {
      ...dim,
      ...(patch as Partial<DimBinding>),
      column: field,
      alias: (patch as Partial<DimBinding>)?.alias || field,
      dynamic: true,
    };
  } else {
    const metric = next.metrics[slot.index];
    if (!metric) throw new Error(`度量槽位 ${slot.index} 不存在`);
    next.metrics[slot.index] = {
      ...metric,
      ...(patch as Partial<MetricBinding>),
      column: field,
    };
  }
  return next;
}

/** Build a lightweight Spec for cascading child-value DISTINCT query (UI dropdowns). */
export function buildCascadeValuesSpec(
  base: AnalysisSpec,
  childColumn: string,
): AnalysisSpec {
  const next = cloneSpec(base);
  next.dimensions = [{ id: 'cascade_child', column: childColumn, alias: childColumn }];
  next.metrics = [{ id: 'cascade_cnt', agg: 'count', alias: 'cnt' }];
  next.calcs = [];
  next.sort = [{ by: 'cnt', order: 'desc' }];
  next.topN = { n: 200, by: 'cnt' };
  next.visual = { chartType: 'table', title: `${childColumn} 可选值` };
  return next;
}

/**
 * Apply a linkage event to a target Spec.
 * - If target has linkage.listen, only events whose field/channel is listed are applied.
 * - Source emit channels are advisory for multi-chart boards (Spec-only protocol).
 */
export function applyLinkageEvent(
  targetSpec: AnalysisSpec,
  event: LinkageEvent,
  options?: { ignoreListen?: boolean },
): AnalysisSpec {
  const listen = targetSpec.linkage?.listen;
  const shouldFilter = !options?.ignoreListen && listen && listen.length > 0;

  switch (event.type) {
    case 'brush': {
      if (shouldFilter && !listen!.includes(event.field) && !listen!.includes('brush')) {
        return cloneSpec(targetSpec);
      }
      return applyBrush(targetSpec, event.field, event.values);
    }
    case 'clear_brush':
      return clearInteractiveFilters(targetSpec);
    case 'cascade': {
      if (
        shouldFilter &&
        !listen!.includes(event.parentColumn) &&
        !listen!.includes(event.childColumn) &&
        !listen!.includes('cascade')
      ) {
        return cloneSpec(targetSpec);
      }
      return applyCascadeParent(
        targetSpec,
        event.parentColumn,
        event.childColumn,
        event.parentValue,
      );
    }
    case 'drill':
      if (shouldFilter && !listen!.includes('drill')) {
        return cloneSpec(targetSpec);
      }
      return applyDrill(targetSpec, event.dimValue);
    case 'global_filter': {
      if (
        shouldFilter &&
        !listen!.includes(event.clause.column) &&
        !listen!.includes('global_filter')
      ) {
        return cloneSpec(targetSpec);
      }
      return applyGlobalFilter(targetSpec, event.clause);
    }
    default:
      return cloneSpec(targetSpec);
  }
}

/** Whether a source Spec declares it emits a given channel/field. */
export function sourceEmits(sourceSpec: AnalysisSpec, channel: string): boolean {
  const emit = sourceSpec.linkage?.emit;
  if (!emit || emit.length === 0) return true;
  return emit.includes(channel);
}
