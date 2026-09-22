export interface RecentImportItem {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  importedAt: string;
  status: 'success' | 'error' | 'loading';
  tableName: string;
  rowCount?: number;
}

const RECENT_IMPORTS_KEY = 'duckdb_recent_imports';

export const DEFAULT_DEMO_IMPORTS: RecentImportItem[] = [];

export const recentImportsService = {
  getImports(): RecentImportItem[] {
    try {
      const raw = localStorage.getItem(RECENT_IMPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[recentImportsService] Failed to parse recent imports', e);
    }
    return [];
  },

  addImport(item: Omit<RecentImportItem, 'id'>): RecentImportItem {
    const fullItem: RecentImportItem = {
      ...item,
      id: `${item.name}-${Date.now()}`,
    };
    try {
      const current = this.getImports();
      const updated = [fullItem, ...current.filter(i => i.name !== item.name)].slice(0, 50);
      localStorage.setItem(RECENT_IMPORTS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('duckdb-imports-updated'));
    } catch (e) {
      console.warn('[recentImportsService] Failed to save import', e);
    }
    return fullItem;
  },

  seedDemoImports(): void {
    try {
      localStorage.setItem(RECENT_IMPORTS_KEY, JSON.stringify(DEFAULT_DEMO_IMPORTS));
      window.dispatchEvent(new CustomEvent('duckdb-imports-updated'));
    } catch (e) {
      console.warn('[recentImportsService] Failed to seed demo imports', e);
    }
  },

  clearImports(): void {
    try {
      localStorage.removeItem(RECENT_IMPORTS_KEY);
      window.dispatchEvent(new CustomEvent('duckdb-imports-updated'));
    } catch (e) {
      console.warn('[recentImportsService] Failed to clear imports', e);
    }
  },
};
