import { useState, useEffect, useRef, useCallback } from 'react';
import { duckDBService } from '../services/duckdbService';

export interface TableMeta {
  name: string;
  rowCount: number | null;
  columnCount: number | null;
  columns: { name: string; type: string }[];
  sizeEstimate: string | null;
  nullRate: number | null;
  highNullColumns: string[];
  typeDistribution: Record<string, number>;
  foreignKeys: { fromCol: string; toTable: string; toCol: string }[];
  loading: boolean;
  error?: string;
}

const CONCURRENCY_LIMIT = 5;

function normalizeType(rawType: string): string {
  const upper = rawType.toUpperCase().split('(')[0].trim();
  if (['INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'HUGEINT', 'UBIGINT', 'UINTEGER', 'USMALLINT', 'UTINYINT', 'INT', 'INT4', 'INT8', 'INT2'].includes(upper)) return 'INT';
  if (['VARCHAR', 'TEXT', 'STRING', 'CHAR', 'BPCHAR'].includes(upper)) return 'TEXT';
  if (['DOUBLE', 'FLOAT', 'REAL', 'DECIMAL', 'NUMERIC'].includes(upper)) return 'FLOAT';
  if (['DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP_S', 'TIMESTAMP_MS', 'TIMESTAMP_NS', 'TIME', 'INTERVAL'].includes(upper)) return 'DATE';
  if (['BOOLEAN', 'BOOL'].includes(upper)) return 'BOOL';
  if (['BLOB', 'BYTEA'].includes(upper)) return 'BLOB';
  if (['JSON', 'JSONB'].includes(upper)) return 'JSON';
  if (upper.startsWith('STRUCT') || upper.startsWith('MAP') || upper.startsWith('LIST') || upper.startsWith('UNION')) return 'STRUCT';
  return 'OTHER';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

async function loadTableMeta(tableName: string): Promise<Omit<TableMeta, 'loading'>> {
  try {
    const [countResult, schema] = await Promise.all([
      duckDBService.query(`SELECT COUNT(*) as c FROM "${tableName}"`),
      duckDBService.getTableSchema(tableName),
    ]);

    const rowCount = Number(countResult?.[0]?.c ?? 0);
    const columns = (schema || []).map((c: any) => ({ name: c.name, type: c.type }));
    const columnCount = columns.length;

    // Type distribution
    const typeDistribution: Record<string, number> = {};
    for (const col of columns) {
      const normalized = normalizeType(col.type);
      typeDistribution[normalized] = (typeDistribution[normalized] || 0) + 1;
    }

    // NULL rate — use SUMMARIZE if table has data
    let nullRate: number | null = null;
    let highNullColumns: string[] = [];

    if (rowCount > 0 && columnCount > 0) {
      try {
        const summarize = await duckDBService.query(`SUMMARIZE "${tableName}"`);
        if (summarize && summarize.length > 0) {
          let totalNulls = 0;
          let totalCells = 0;
          for (const row of summarize) {
            const nullPct = parseFloat(row.null_percentage ?? row.null_pct ?? '0');
            const colName = row.column_name ?? row.name ?? '';
            if (!isNaN(nullPct)) {
              totalNulls += nullPct;
              totalCells += 100;
              if (nullPct > 30) {
                highNullColumns.push(colName);
              }
            }
          }
          nullRate = totalCells > 0 ? totalNulls / totalCells : 0;
        }
      } catch {
        // SUMMARIZE might fail for some table types — non-critical
      }
    }

    // Size estimate
    let sizeEstimate: string | null = null;
    try {
      const sizeResult = await duckDBService.query(
        `SELECT estimated_size FROM duckdb_tables() WHERE table_name = '${tableName}'`
      );
      if (sizeResult?.[0]?.estimated_size != null) {
        sizeEstimate = formatBytes(Number(sizeResult[0].estimated_size));
      }
    } catch {
      // fallback: rough estimate based on row count
      if (rowCount > 0 && columnCount > 0) {
        const roughBytes = rowCount * columnCount * 32; // rough 32 bytes per cell
        sizeEstimate = `~${formatBytes(roughBytes)}`;
      }
    }

    // Foreign keys
    let foreignKeys: { fromCol: string; toTable: string; toCol: string }[] = [];
    try {
      const fkResult = await duckDBService.query(
        `SELECT * FROM duckdb_constraints() WHERE table_name = '${tableName}' AND constraint_type = 'FOREIGN KEY'`
      );
      if (fkResult) {
        for (const fk of fkResult) {
          const fromCols = fk.constraint_column_names || [];
          const refTable = fk.constraint_text?.match(/REFERENCES\s+"?(\w+)"?/i)?.[1] || '';
          const refCols = fk.constraint_text?.match(/REFERENCES\s+\w+\s*\(([^)]+)\)/i)?.[1]?.split(',').map((s: string) => s.trim().replace(/"/g, '')) || [];
          if (fromCols.length > 0 && refTable) {
            foreignKeys.push({
              fromCol: Array.isArray(fromCols) ? fromCols.join(', ') : String(fromCols),
              toTable: refTable,
              toCol: refCols[0] || '',
            });
          }
        }
      }
    } catch {
      // FK info might not be available — non-critical
    }

    return {
      name: tableName,
      rowCount,
      columnCount,
      columns,
      sizeEstimate,
      nullRate,
      highNullColumns,
      typeDistribution,
      foreignKeys,
      error: undefined,
    };
  } catch (err: any) {
    return {
      name: tableName,
      rowCount: null,
      columnCount: null,
      columns: [],
      sizeEstimate: null,
      nullRate: null,
      highNullColumns: [],
      typeDistribution: {},
      foreignKeys: [],
      error: err?.message || '加载失败',
    };
  }
}

export function useTableMetaMap(tables: string[]): {
  metaMap: Map<string, TableMeta>;
  loading: boolean;
  refreshTable: (name: string) => void;
} {
  const [metaMap, setMetaMap] = useState<Map<string, TableMeta>>(new Map());
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);

  const processQueue = useCallback(async () => {
    while (queueRef.current.length > 0 && activeRef.current < CONCURRENCY_LIMIT) {
      const tableName = queueRef.current.shift();
      if (!tableName) break;

      activeRef.current++;
      loadTableMeta(tableName).then(result => {
        if (!abortRef.current) {
          setMetaMap(prev => {
            const next = new Map(prev);
            next.set(tableName, { ...result, loading: false });
            return next;
          });
        }
        activeRef.current--;
        processQueue();
      });
    }

    if (activeRef.current === 0 && queueRef.current.length === 0) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current = false;

    // Find tables that need loading
    const toLoad = tables.filter(t => !metaMap.has(t));
    // Remove stale entries
    const currentSet = new Set(tables);
    setMetaMap(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const key of next.keys()) {
        if (!currentSet.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      // Add loading placeholders for new tables
      for (const t of toLoad) {
        next.set(t, {
          name: t,
          rowCount: null,
          columnCount: null,
          columns: [],
          sizeEstimate: null,
          nullRate: null,
          highNullColumns: [],
          typeDistribution: {},
          foreignKeys: [],
          loading: true,
        });
        changed = true;
      }
      return changed ? next : prev;
    });

    if (toLoad.length > 0) {
      setLoading(true);
      queueRef.current = [...toLoad];
      processQueue();
    }

    return () => {
      abortRef.current = true;
    };
  }, [tables]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshTable = useCallback((name: string) => {
    setMetaMap(prev => {
      const next = new Map(prev);
      next.set(name, {
        name,
        rowCount: null,
        columnCount: null,
        columns: [],
        sizeEstimate: null,
        nullRate: null,
        highNullColumns: [],
        typeDistribution: {},
        foreignKeys: [],
        loading: true,
      });
      return next;
    });
    queueRef.current.push(name);
    setLoading(true);
    processQueue();
  }, [processQueue]);

  return { metaMap, loading, refreshTable };
}
