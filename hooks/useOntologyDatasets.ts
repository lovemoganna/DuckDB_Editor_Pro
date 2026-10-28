import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { loadDatasets } from '../services/workbench/datasets';
import { duckDBService } from '../services/duckdbService';
import { useWorkbenchRevision } from '../services/workbench/runtime';
import type { DatasetDefinition } from '../services/workbench/analysisTypes';

export function useOntologyDatasets() {
  const database = useAppStore(s => s.currentDatabase);
  const active = useAppStore(s => s.activeDataset);
  const table = useAppStore(s => s.currentTable);
  const revision = useWorkbenchRevision();
  const [state, setState] = useState<{ owner: string; schema: string; datasets: DatasetDefinition[]; error: string }>({ owner: '', schema: '', datasets: [], error: '' });
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const refresh = async () => {
      const generation = ++request;
      try {
        const scope = await duckDBService.getCurrentCatalogAndSchema();
        const datasets = await loadDatasets(scope.catalog);
        if (!cancelled && generation === request) setState({ owner: scope.catalog, schema: scope.schema, datasets, error: '' });
      } catch (error) { if (!cancelled && generation === request) setState(s => ({ ...s, error: String(error) })); }
    };
    void refresh();
    window.addEventListener('duckdb-tables-changed', refresh);
    return () => { cancelled = true; window.removeEventListener('duckdb-tables-changed', refresh); };
  }, [database, revision]);
  const definition = active && state.datasets.find(d => d.id === active.id);
  const transient = active?.id.startsWith('sql:') && active.catalog === state.owner ? active : undefined;
  const selected = definition ? active : transient || state.datasets.find(d => d.catalog === state.owner && d.schema === state.schema && (d.table === table || d.name === table));
  return { ...state, selected, definition: definition || (transient ? undefined : selected) };
}
