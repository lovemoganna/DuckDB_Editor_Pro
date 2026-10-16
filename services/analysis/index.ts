/**
 * Analysis kernel public API.
 * Spec → SQL → Result → ChartSpec. Components must not bypass this for analysis queries.
 */

export * from './types';
export * from './sqlUtils';
export * from './semantic';
export * from './datasetContext';
export * from './fieldCatalog';
export * from './profiler';
export * from './recipes';
export * from './calcCompiler';
export * from './sqlCompiler';
export * from './chartRegistry';
export * from './pipeline';
export * from './linkage';
export * from './aiIntent';
export * from './chartDisplay';
export {
  pivotConfigToSpec,
  timeSeriesConfigToSpec,
  type PivotDimension,
  type PivotMetric,
  type PivotFilter,
  type PivotQueryConfig,
  type TimeSeriesConfig,
} from './adapters/workbenchAdapter';
export {
  widgetRowsToChartSpec,
  enrichWidgetChartConfig,
} from './adapters/dashboardWidgetAdapter';
export {
  adaptChartSpec,
  resolveChartJsCtor,
  type AdaptedChartBundle,
  type ChartJsCtor,
} from './adapters/chartJsAdapter';
