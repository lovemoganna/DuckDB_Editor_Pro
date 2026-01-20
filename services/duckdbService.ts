import * as duckdb from '@duckdb/duckdb-wasm';
import { ColumnStats, ImportOptions } from '../types';

const DUCKDB_VERSION = '1.28.0';

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: 'text/javascript',
      })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.conn = await this.db.connect();
    
    // Initialize Audit Log Table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS _sys_audit_log (
        id INTEGER PRIMARY KEY,
        log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        operation_type VARCHAR,
        target_table VARCHAR,
        details TEXT,
        affected_rows INTEGER,
        sql_statement TEXT
      );
      CREATE SEQUENCE IF NOT EXISTS _sys_audit_seq START 1;
    `);

    this.isInitialized = true;
  }

  async query(sql: string): Promise<any[]> {
    if (!this.conn) throw new Error("Database not connected");
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => row.toJSON());
  }
  
  // Wrapper for operations that need auditing
  async executeAndAudit(sql: string, type: string, table: string | null, details: string): Promise<any> {
    if (!this.conn) throw new Error("Database not connected");
    
    try {
      const result = await this.conn.query(sql);
      let rows: any[] = [];
      try {
        rows = result.toArray().map(r => r.toJSON());
      } catch (e) {
        // Some statements like DROP don't return rows
      }
      
      // Attempt to infer affected rows if possible, otherwise 0 or result length
      const affected = rows.length; 

      // Log asynchronously to avoid blocking UI significantly, but ensure it happens
      const cleanSql = sql.replace(/'/g, "''");
      const cleanDetails = details.replace(/'/g, "''");
      const cleanTable = table ? `'${table}'` : 'NULL';
      
      const auditSql = `
        INSERT INTO _sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement)
        VALUES (nextval('_sys_audit_seq'), '${type}', ${cleanTable}, '${cleanDetails}', ${affected}, '${cleanSql}');
      `;
      
      await this.conn.query(auditSql);
      
      return rows;
    } catch (err: any) {
      throw err;
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.conn) return [];
    const res = await this.conn.query("SHOW TABLES");
    const rows = res.toArray().map(r => r.toJSON());
    // Filter out internal tables
    return rows.map((r: any) => r.name).filter((n: string) => !n.startsWith('_sys_'));
  }

  async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.conn) return [];
    const res = await this.conn.query(`PRAGMA table_info('${tableName}')`);
    return res.toArray().map(r => r.toJSON());
  }
  
  async getExtensions(): Promise<any[]> {
    if (!this.conn) return [];
    try {
        const res = await this.conn.query("SELECT * FROM duckdb_extensions()");
        return res.toArray().map(r => r.toJSON());
    } catch (e) {
        return [];
    }
  }

  async loadExtension(name: string): Promise<void> {
    if (!this.conn) return;
    await this.conn.query(`INSTALL '${name}'; LOAD '${name}';`);
  }

  async importFile(file: File, tableName: string, options?: ImportOptions): Promise<void> {
    if (!this.db || !this.conn) return;
    
    await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREF, true);
    
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv') || file.name.endsWith('.txt');
    
    let sql = '';

    if (isJson) {
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`;
    } else if (isCsv && options) {
        // Advanced CSV Import
        const opts = [];
        if (options.header) opts.push("header=true"); else opts.push("header=false");
        if (options.delimiter) opts.push(`delim='${options.delimiter}'`);
        if (options.quote) opts.push(`quote='${options.quote}'`);
        if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);
        
        // Use read_csv (not auto) if specific options provided, or read_csv_auto with overrides
        const optsStr = opts.join(', ');
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}', ${optsStr})`;
    } else if (isCsv) {
        // Fallback simple CSV
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`;
    } else {
        // Assume Parquet
         sql = `CREATE TABLE "${tableName}" AS SELECT * FROM '${file.name}'`;
    }

    await this.conn.query(sql);

    // Audit
    const auditSql = `INSERT INTO _sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('_sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported file ${file.name}', 0, '${sql.replace(/'/g, "''")}');`;
    await this.conn.query(auditSql);
  }

  async importText(text: string, tableName: string, options?: ImportOptions): Promise<void> {
      if (!this.db || !this.conn) return;
      
      const fileName = `paste_${Date.now()}.csv`;
      const file = new File([text], fileName, { type: 'text/csv' });
      
      await this.db.registerFileHandle(fileName, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREF, true);
      
      let sql = '';
      if (options) {
        const opts = [];
        if (options.header) opts.push("header=true"); else opts.push("header=false");
        if (options.delimiter) opts.push(`delim='${options.delimiter}'`);
        if (options.quote) opts.push(`quote='${options.quote}'`);
        if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);
        const optsStr = opts.join(', ');
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}', ${optsStr})`;
      } else {
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}')`;
      }
      
      await this.conn.query(sql);
      
      // Audit
      const auditSql = `INSERT INTO _sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement) VALUES (nextval('_sys_audit_seq'), 'IMPORT', '${tableName}', 'Imported from clipboard', 0, '${sql.replace(/'/g, "''")}');`;
      await this.conn.query(auditSql);
  }

  async exportDatabase(): Promise<Blob> {
     if (!this.conn) throw new Error("DB not ready");
     // Simplistic dump for WASM: Export all user tables as JSON
     const tables = await this.getTables();
     const dump: any = { tables: {} };
     
     for(const t of tables) {
         const data = await this.query(`SELECT * FROM "${t}"`);
         dump.tables[t] = data;
     }
     
     return new Blob([JSON.stringify(dump, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2)], { type: 'application/json' });
  }

  async exportParquet(query: string, filename: string): Promise<Blob> {
      if (!this.conn || !this.db) throw new Error("DB not ready");
      const tempPath = `temp_${Date.now()}.parquet`;
      
      // Execute COPY to virtual FS
      await this.conn.query(`COPY (${query}) TO '${tempPath}' (FORMAT PARQUET)`);
      
      // Read buffer from virtual FS
      const buffer = await this.db.copyFileToBuffer(tempPath);
      
      // Cleanup
      await this.conn.query(`DROP TABLE IF EXISTS "${tempPath}"`); 
      
      return new Blob([buffer], { type: 'application/vnd.apache.parquet' });
  }

  // --- CRUD Helpers ---

  escapeLiteral(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    // BigInt handling
    if (typeof value === 'bigint') return value.toString();
    
    // String escape
    return `'${String(value).replace(/"/g, '""').replace(/'/g, "''")}'`;
  }

  async insertRow(table: string, data: Record<string, any>) {
      const safeTable = `"${table}"`;
      const cols = Object.keys(data).map(c => `"${c}"`).join(', ');
      const vals = Object.values(data).map(v => this.escapeLiteral(v)).join(', ');
      
      let sql;
      if (cols.length === 0) {
          // Try default values if empty object passed
          sql = `INSERT INTO ${safeTable} DEFAULT VALUES`;
      } else {
          sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${vals})`;
      }
      
      return this.executeAndAudit(sql, 'INSERT', table, 'Inserted new row');
  }

  async updateRow(table: string, pkCol: string, pkVal: any, col: string, newVal: any) {
    const safeTable = `"${table}"`;
    const safePkVal = this.escapeLiteral(pkVal);
    const safeNewVal = this.escapeLiteral(newVal);
    
    const sql = `UPDATE ${safeTable} SET "${col}" = ${safeNewVal} WHERE "${pkCol}" = ${safePkVal}`;
    return this.executeAndAudit(sql, 'UPDATE', table, `Updated ${col} for row ${pkCol}=${pkVal}`);
  }

  async deleteRow(table: string, pkCol: string, pkVal: any) {
    const safeTable = `"${table}"`;
    const safePkVal = this.escapeLiteral(pkVal);
    
    const sql = `DELETE FROM ${safeTable} WHERE "${pkCol}" = ${safePkVal}`;
    return this.executeAndAudit(sql, 'DELETE', table, `Deleted row ${pkCol}=${pkVal}`);
  }

  async deleteRows(table: string, pkCol: string, pkVals: any[]) {
    if (pkVals.length === 0) return;
    const safeTable = `"${table}"`;
    const safeVals = pkVals.map(v => this.escapeLiteral(v)).join(', ');
    const sql = `DELETE FROM ${safeTable} WHERE "${pkCol}" IN (${safeVals})`;
    return this.executeAndAudit(sql, 'DELETE', table, `Deleted ${pkVals.length} rows`);
  }

  async addColumn(table: string, colName: string, colType: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} ADD COLUMN "${colName}" ${colType}`;
    return this.executeAndAudit(sql, 'ALTER', table, `Added column ${colName}`);
  }

  async dropColumn(table: string, colName: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} DROP COLUMN "${colName}"`;
    return this.executeAndAudit(sql, 'ALTER', table, `Dropped column ${colName}`);
  }

  async renameColumn(table: string, oldName: string, newName: string) {
    const safeTable = `"${table}"`;
    const sql = `ALTER TABLE ${safeTable} RENAME COLUMN "${oldName}" TO "${newName}"`;
    return this.executeAndAudit(sql, 'ALTER', table, `Renamed column ${oldName} to ${newName}`);
  }

  async alterColumnType(table: string, colName: string, newType: string) {
    const safeTable = `"${table}"`;
    // DuckDB allows casting: ALTER TABLE t ALTER COLUMN c TYPE type
    const sql = `ALTER TABLE ${safeTable} ALTER COLUMN "${colName}" TYPE ${newType}`;
    return this.executeAndAudit(sql, 'ALTER', table, `Changed column ${colName} type to ${newType}`);
  }

  async renameTable(oldName: string, newName: string) {
    const sql = `ALTER TABLE "${oldName}" RENAME TO "${newName}"`;
    return this.executeAndAudit(sql, 'ALTER', oldName, `Renamed table to ${newName}`);
  }

  async dropTable(tableName: string) {
    const sql = `DROP TABLE "${tableName}"`;
    return this.executeAndAudit(sql, 'DROP', tableName, 'Dropped table');
  }

  async createTable(tableName: string, columns: {name: string, type: string, pk?: boolean}[]) {
      const colDefs = columns.map(c => `"${c.name}" ${c.type}${c.pk ? ' PRIMARY KEY' : ''}`).join(', ');
      const sql = `CREATE TABLE "${tableName}" (${colDefs})`;
      return this.executeAndAudit(sql, 'CREATE', tableName, 'Created new table');
  }

  async getColumnStats(table: string, col: string): Promise<ColumnStats> {
      if (!this.conn) throw new Error("DB not connected");
      
      const sql = `
        SELECT 
            MIN("${col}") as min_val,
            MAX("${col}") as max_val,
            COUNT(*) as total,
            COUNT("${col}") as non_null_count,
            approx_count_distinct("${col}") as distinct_count
        FROM "${table}"
      `;
      
      const res = await this.query(sql);
      const row = res[0];
      
      // Top K for categorical context
      let topK: any[] = [];
      try {
          const topKSql = `SELECT "${col}" as value, COUNT(*) as count FROM "${table}" GROUP BY "${col}" ORDER BY count DESC LIMIT 5`;
          topK = await this.query(topKSql);
      } catch (e) { /* ignore */ }

      return {
          min: row.min_val,
          max: row.max_val,
          total_count: Number(row.total),
          null_count: Number(row.total) - Number(row.non_null_count),
          distinct_count: Number(row.distinct_count),
          top_k: topK
      };
  }
}

export const duckDBService = new DuckDBService();