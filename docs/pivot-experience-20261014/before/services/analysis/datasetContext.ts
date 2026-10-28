/**
 * Dataset / analysis context switching — wraps duckDBService list/switch APIs.
 */

import { duckDBService } from '../duckdbService';
import type { AnalysisContextItem, DatasetRef } from './types';

export async function listAnalysisContexts(): Promise<AnalysisContextItem[]> {
  const items = await duckDBService.listAnalysisContexts();
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    kind: item.kind,
    isCurrent: item.isCurrent,
  }));
}

export async function switchAnalysisContext(target: {
  id: string;
  kind: 'schema' | 'database' | 'project';
}): Promise<{ catalog: string; schema: string }> {
  return duckDBService.switchAnalysisContext(target);
}

export async function listDatasets(): Promise<string[]> {
  return duckDBService.getTables();
}

/**
 * Resolve dataset ref: switch context if needed, then fail-closed if table is missing.
 */
export async function resolveDataset(ref: DatasetRef): Promise<{
  table: string;
  tables: string[];
}> {
  if (!ref?.table?.trim()) {
    throw new Error('DatasetRef.table 必填');
  }

  if (ref.contextId) {
    const contexts = await listAnalysisContexts();
    const match = contexts.find((c) => c.id === ref.contextId);
    if (match && !match.isCurrent) {
      await switchAnalysisContext({ id: match.id, kind: match.kind });
    }
  }

  const tables = await listDatasets();
  const qualified = ref.table.includes('.');
  const exists =
    tables.includes(ref.table) ||
    tables.some((t) => t === ref.table || t.endsWith(`.${ref.table}`)) ||
    (qualified && tables.some((t) => t === ref.table.split('.').pop()));

  if (!exists) {
    throw new Error(
      `数据集「${ref.table}」不存在。当前可用表: ${tables.length ? tables.slice(0, 12).join(', ') : '(无)'}`,
    );
  }

  return { table: ref.table, tables };
}
