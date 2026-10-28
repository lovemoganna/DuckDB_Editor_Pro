export interface BoardBrushFilter {
  column: string;
  value: string;
  values?: string[];
  range?: { from: number; to: number; includeTo: boolean };
  temporalRange?: { from: string; to: string };
  sourceWidgetId?: string;
  bindings?: Record<string, string>;
}
