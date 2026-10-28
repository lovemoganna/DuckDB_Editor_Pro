import { useEffect } from 'react';
import { refreshDatabaseAnalysis, persistAnalysisDefinitions, useDatabaseAnalysis } from '../services/databaseAnalysis';
import { useAppStore } from './store/useAppStore';

/** One lifecycle for every analysis surface, including when home is not mounted. */
export function useDatabaseAnalysisRuntime(ready: boolean): void {
  const database = useAppStore(state => state.currentDatabase);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void refreshDatabaseAnalysis().catch(console.error); }, 250); };
    refresh();
    window.addEventListener('duckdb-schema-changed', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('duckdb-schema-changed', refresh); };
  }, [ready, database]);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!useDatabaseAnalysis.getState().loading) void persistAnalysisDefinitions(database).catch(console.error); }, 300);
      useAppStore.getState().bumpDashboardRefresh();
    };
    window.addEventListener('duckdb-metrics-updated', save);
    window.addEventListener('duckdb-metric-charts-updated', save);
    return () => { clearTimeout(timer); window.removeEventListener('duckdb-metrics-updated', save); window.removeEventListener('duckdb-metric-charts-updated', save); };
  }, [ready, database]);
}
