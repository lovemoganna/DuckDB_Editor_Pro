import { create } from 'zustand';
import type { DataInspection } from '../../services/dataInspection';

/** Session evidence. Data changes invalidate it; absence is never a pass. */
export const useDataInspection = create<{
  reports: Record<string, DataInspection>;
  record: (report: DataInspection) => void;
  invalidate: () => void;
}>((set) => ({ reports: {}, record: report => set(state => ({reports: {
  ...state.reports, [JSON.stringify([report.catalog, report.schema, report.table])]: report,
}})), invalidate: () => set({reports:{}}) }));
if (typeof window !== 'undefined') {
  window.addEventListener('duckdb-schema-changed', () => useDataInspection.getState().invalidate());
  window.addEventListener('duckdb-database-changed', () => useDataInspection.getState().invalidate());
}
