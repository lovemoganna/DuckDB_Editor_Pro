import { validateMeasurementUnits } from './unitGuard';
/**
 * Analysis pipeline: Spec → SQL → execute → ChartSpec.
 * Sole execution entry for analysis charts.
 */

import { duckDBService } from '../duckdbService';
import { compileAnalysisSql, validateAnalysisSpec } from './sqlCompiler';
import { mapResultToChartSpec, chartSpecToChartConfig } from './chartRegistry';
import { resolveDataset } from './datasetContext';
import { parseAndNormalize } from './aiIntent';
import type { AnalysisFieldCatalog, AnalysisResult, AnalysisSpec } from './types';

export interface RunAnalysisOptions {
  isCurrent?: () => boolean;
  /** Skip DuckDB context switch / table listing */
  skipDatasetResolve?: boolean;
}

/**
 * Compile + execute AnalysisSpec; map rows through Chart Registry.
 */
export async function runAnalysis(
  spec: AnalysisSpec,
  options: RunAnalysisOptions = {},
): Promise<AnalysisResult> {
  validateAnalysisSpec(spec);
  validateMeasurementUnits(spec);

  if (!options.skipDatasetResolve) {
    await resolveDataset(spec.dataset);
  }

  const scope = await duckDBService.getCurrentCatalogAndSchema();
  if (spec.dataset.sql && (spec.dataset.catalog !== scope.catalog || spec.dataset.schema !== scope.schema)) throw new Error('透视来源所属数据库或 Schema 已切换，请重新选择来源');
  const boundSpec = { ...spec, dataset: { ...spec.dataset, table: spec.dataset.sql || spec.dataset.table.includes('.') ? spec.dataset.table : `${scope.catalog}.${scope.schema}.${spec.dataset.table}` } };
  const compiled = compileAnalysisSql(boundSpec);
  if(options.isCurrent && !options.isCurrent())throw new DOMException('查询请求已失效','AbortError');
  const start = performance.now();
  const rawRows = options.isCurrent
    ? (await duckDBService.readQueryBatchWithParams([{sql:compiled.sql,params:[]}],{isCurrent:options.isCurrent}))[0]
    : await duckDBService.readQuery(compiled.sql);
  const current = await duckDBService.getCurrentCatalogAndSchema();
  if (current.catalog !== scope.catalog || current.schema !== scope.schema) throw new Error('分析范围已切换，请重新计算');
  const executionTimeMs = Math.round((performance.now() - start) * 10) / 10;

  const rows = (rawRows || []) as Record<string, unknown>[];
  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : [...compiled.dimAliases, ...compiled.metricAliases, ...compiled.calcAliases];

  const chart = mapResultToChartSpec(rows, columns, spec, compiled);
  const chartConfig = chartSpecToChartConfig(chart);

  return {
    spec,
    sql: compiled.sql,
    columns,
    rows,
    roles: compiled.roles,
    chart,
    chartConfig,
    executionTimeMs,
  };
}

/** Compile only — for SQL preview / tests without execution. */
export function compileAnalysis(spec: AnalysisSpec) {
  validateAnalysisSpec(spec);
  validateMeasurementUnits(spec);
  return compileAnalysisSql(spec);
}

/**
 * Thin AI entry: Intent JSON → Spec → runAnalysis.
 * AI must not supply raw SQL on this path.
 */
export async function runAnalysisIntent(
  llmJson: unknown,
  catalog?: AnalysisFieldCatalog | null,
  options: RunAnalysisOptions & {
    table?: string;
    contextId?: string;
    /** When true (default), intent.table must match catalog.table */
    strict?: boolean;
  } = {},
): Promise<AnalysisResult> {
  const spec = parseAndNormalize(llmJson, catalog, {
    table: options.table,
    contextId: options.contextId,
    strict: options.strict !== false,
  });
  return runAnalysis(spec, options);
}
