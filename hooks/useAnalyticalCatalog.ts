import { useCallback } from 'react';
import { useDatabaseAnalysis, refreshDatabaseAnalysis } from '../services/databaseAnalysis';
import { useAppStore } from './store/useAppStore';

/** All surfaces read the same model built by the application lifecycle. */
export function useAnalyticalCatalog(_tables: string[]) {
  const database = useAppStore(state => state.currentDatabase);
  const state = useDatabaseAnalysis();
  const refresh = useCallback(() => refreshDatabaseAnalysis(), []);
  return { catalog: state.database === database ? state.model : null,
    loading: state.loading, error: state.error, refresh };
}
