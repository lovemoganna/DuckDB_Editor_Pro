import { duckDBService } from './duckdbService';
import { workbookIO } from './workbookIO';

export type ImportSourceMode = 'local' | 'url' | 'paste';
export type ImportFileFormat = 'CSV' | 'TSV' | 'JSON' | 'Parquet' | 'Excel';
export type ConflictStrategy = 'replace' | 'append' | 'fail';

export type ImportLifecycleState =
  | 'IDLE'
  | 'EMPTY'
  | 'SOURCE_SELECTED'
  | 'PARSING'
  | 'PARSED'
  | 'VALIDATING'
  | 'READY'
  | 'IMPORTING'
  | 'SUCCESS'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'IMPORT_ERROR';

export interface ColumnMappingItem {
  index: number;
  sourceName: string;
  targetName: string;
  inferredType: string;
  overrideType?: string;
  nullable: boolean;
  sampleValue: string;
}

export interface ParseOptions {
  format: ImportFileFormat;
  delimiter: string;
  quote: string;
  header: boolean;
  encoding: string;
  skipRows?: number;
  dateFormat?: string;
  sampleSize?: number;
}

export interface ExcelSheetMetadata {
  name: string;
  targetTableName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnMappingItem[];
  previewRows: Record<string, any>[];
  rawSqlSource: string;
  isEmpty: boolean;
  isHidden?: boolean;
  selected: boolean;
}

export interface FileMetadataResult {
  fileName: string;
  filePath?: string;
  fileSizeBytes: number;
  formattedSize: string;
  rowCount: number;
  columnCount: number;
  encoding: string;
  hasHeader: boolean;
  format: ImportFileFormat;
  lastModified?: string;
  columns: ColumnMappingItem[];
  previewRows: Record<string, any>[];
  rawSqlSource: string;
  sheets?: ExcelSheetMetadata[];
  activeSheetName?: string;
}

export interface ImportExecutionResult {
  schema: string;
  tableName: string;
  rowCount: number;
  columnsCount: number;
  verified: boolean;
  durationMs: number;
  sampleRows: any[];
}

export const DUCKDB_TYPE_OPTIONS = [
  'BIGINT',
  'INTEGER',
  'SMALLINT',
  'TINYINT',
  'DOUBLE',
  'FLOAT',
  'DECIMAL(18,2)',
  'VARCHAR',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'TIME',
  'JSON',
  'BLOB',
];

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function detectFormatFromName(name: string): ImportFileFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith('.parquet')) return 'Parquet';
  if (lower.endsWith('.json') || lower.endsWith('.jsonl')) return 'JSON';
  if (lower.endsWith('.tsv') || lower.endsWith('.tab')) return 'TSV';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'Excel';
  return 'CSV';
}

class DataImportService {
  private activeVirtualFiles = new Set<string>();

  /**
   * 清理当前导入会话中创建的临时虚拟文件
   */
  async cleanupVirtualFiles(): Promise<void> {
    for (const name of this.activeVirtualFiles) {
      await duckDBService.dropFile(name);
    }
    this.activeVirtualFiles.clear();
  }

  /**
   * 嗅探与解析数据源元数据、列结构及前 100 行样本
   */
  async sniffSource(
    mode: ImportSourceMode,
    file: File | null,
    url: string,
    text: string,
    options: ParseOptions
  ): Promise<FileMetadataResult> {
    await this.cleanupVirtualFiles();

    let virtualFileName = '';
    let rawSqlSource = '';
    let fileSizeBytes = 0;
    let fileName = '';
    let filePath = '';
    let lastModified = '';
    const format = options.format;

    if (mode === 'local') {
      if (!file) throw new Error('未选择本地文件');
      fileName = file.name;
      fileSizeBytes = file.size;
      filePath = (file as any).path || file.name;
      if (file.lastModified) {
        const d = new Date(file.lastModified);
        lastModified = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      if (format === 'Excel') {
        const parsedSheets = await workbookIO.readAllSheets(file);
        if (parsedSheets.length === 0) {
          throw new Error('Excel 文件中未发现工作表');
        }

        const sheetsMeta: ExcelSheetMetadata[] = [];
        const baseCleanName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || 'imported';

        for (let i = 0; i < parsedSheets.length; i++) {
          const sheet = parsedSheets[i];
          const cleanSheetName = sheet.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || `sheet_${i + 1}`;
          const sheetTargetName = parsedSheets.length === 1 ? `${baseCleanName}_imported` : `${baseCleanName}_${cleanSheetName}`;

          if (sheet.isEmpty || !sheet.csvText.trim() || sheet.rowCount === 0) {
            sheetsMeta.push({
              name: sheet.name,
              targetTableName: sheetTargetName,
              rowCount: 0,
              columnCount: sheet.columnCount || 0,
              columns: [],
              previewRows: [],
              rawSqlSource: '',
              isEmpty: true,
              isHidden: sheet.isHidden,
              selected: false,
            });
            continue;
          }

          const sheetVFile = `excel_temp_${Date.now()}_${i}_${cleanSheetName}.csv`;
          await duckDBService.registerFileText(sheetVFile, sheet.csvText);
          this.activeVirtualFiles.add(sheetVFile);

          const sheetSqlSource = `read_csv_auto('${sheetVFile}')`;

          let sheetCols: ColumnMappingItem[] = [];
          let sheetPreview: Record<string, any>[] = [];
          try {
            const describeRows = await duckDBService.query(`DESCRIBE SELECT * FROM ${sheetSqlSource};`);
            sheetPreview = await duckDBService.query(`SELECT * FROM ${sheetSqlSource} LIMIT 100;`);
            const firstR = sheetPreview[0] || {};
            sheetCols = (describeRows || []).map((col: any, colIdx: number) => {
              const colName = String(col.column_name ?? `col_${colIdx + 1}`);
              const rawType = String(col.column_type ?? 'VARCHAR').toUpperCase();
              const isNull = col.null === 'YES' || col.null === true || col.null === 'true';
              const sample = firstR[colName] !== undefined && firstR[colName] !== null
                ? (typeof firstR[colName] === 'object' ? JSON.stringify(firstR[colName]) : String(firstR[colName]))
                : '-';
              return {
                index: colIdx + 1,
                sourceName: colName,
                targetName: colName,
                inferredType: rawType,
                overrideType: rawType,
                nullable: isNull,
                sampleValue: sample,
              };
            });
          } catch (e) {
            console.warn(`Failed to describe sheet ${sheet.name}:`, e);
          }

          sheetsMeta.push({
            name: sheet.name,
            targetTableName: sheetTargetName,
            rowCount: sheet.rowCount,
            columnCount: sheetCols.length,
            columns: sheetCols,
            previewRows: sheetPreview,
            rawSqlSource: sheetSqlSource,
            isEmpty: false,
            isHidden: sheet.isHidden,
            selected: true,
          });
        }

        const activeSheet = sheetsMeta.find(s => !s.isEmpty) || sheetsMeta[0];
        const totalRowCount = sheetsMeta.reduce((acc, s) => acc + s.rowCount, 0);

        return {
          fileName,
          filePath,
          fileSizeBytes,
          formattedSize: formatBytes(fileSizeBytes),
          rowCount: totalRowCount,
          columnCount: activeSheet?.columnCount || 0,
          encoding: options.encoding || 'UTF-8',
          hasHeader: options.header,
          format,
          lastModified,
          columns: activeSheet?.columns || [],
          previewRows: activeSheet?.previewRows || [],
          rawSqlSource: activeSheet?.rawSqlSource || '',
          sheets: sheetsMeta,
          activeSheetName: activeSheet?.name,
        };
      } else {
        virtualFileName = `local_${Date.now()}_${file.name}`;
        await duckDBService.registerFileHandle(virtualFileName, file);
        this.activeVirtualFiles.add(virtualFileName);
        rawSqlSource = this.buildSelectSource(virtualFileName, format, options);
      }
    } else if (mode === 'paste') {
      if (!text.trim()) throw new Error('粘贴文本不能为空');
      fileName = 'pasted_text.csv';
      fileSizeBytes = new Blob([text]).size;
      filePath = '剪贴板 (Clipboard)';
      lastModified = new Date().toISOString().slice(0, 16).replace('T', ' ');

      virtualFileName = `paste_${Date.now()}.csv`;
      await duckDBService.registerFileText(virtualFileName, text);
      this.activeVirtualFiles.add(virtualFileName);
      rawSqlSource = this.buildSelectSource(virtualFileName, format, options);
    } else {
      // URL Mode
      if (!url.trim()) throw new Error('远程 URL 不能为空');
      fileName = url.split('/').pop()?.split('?')[0] || 'remote_data';
      filePath = url;
      lastModified = '远程资源 (Remote)';

      // Check if URL is parquet or CSV
      const isParquet = url.toLowerCase().includes('.parquet');
      if (isParquet) {
        rawSqlSource = `read_parquet('${url}')`;
      } else {
        const opts: string[] = [];
        if (options.header !== undefined) opts.push(`header=${options.header ? 'true' : 'false'}`);
        const delim = options.delimiter === '\t' ? '\\t' : options.delimiter;
        if (delim) opts.push(`delim='${delim}'`);
        if (options.quote) opts.push(`quote='${options.quote}'`);
        const optsStr = opts.length > 0 ? `, ${opts.join(', ')}` : '';
        rawSqlSource = `read_csv_auto('${url}'${optsStr})`;
      }
    }

    // 1. 探测列结构与类型推断 (DESCRIBE)
    const describeSql = `DESCRIBE SELECT * FROM ${rawSqlSource};`;
    let describeRows: any[] = [];
    try {
      describeRows = await duckDBService.query(describeSql);
    } catch (err: any) {
      throw new Error(`文件解析失败: ${err?.message || '无法识别格式或分隔符'}`);
    }

    if (!describeRows || describeRows.length === 0) {
      throw new Error('未检测到有效数据列或文件为空');
    }

    // 2. 提取前 100 行真实预览数据
    const previewSql = `SELECT * FROM ${rawSqlSource} LIMIT 100;`;
    let previewRows: Record<string, any>[] = [];
    try {
      previewRows = await duckDBService.query(previewSql);
    } catch (err: any) {
      throw new Error(`读取数据样本失败: ${err?.message || '语法错误'}`);
    }

    // 3. 获取总行数
    let totalRowCount = 0;
    try {
      const countRes = await duckDBService.query(`SELECT count(*) as cnt FROM ${rawSqlSource};`);
      if (countRes && countRes[0]) {
        totalRowCount = Number(countRes[0].cnt || 0);
      }
    } catch {
      totalRowCount = previewRows.length;
    }

    // 4. 构建每列映射模型 (ColumnMappingItem)
    const firstRow = previewRows[0] || {};
    const columns: ColumnMappingItem[] = describeRows.map((col: any, idx: number) => {
      const colName = String(col.column_name ?? `col_${idx + 1}`);
      const rawType = String(col.column_type ?? 'VARCHAR').toUpperCase();
      const isNull = col.null === 'YES' || col.null === true || col.null === 'true';
      const sample = firstRow[colName] !== undefined && firstRow[colName] !== null
        ? (typeof firstRow[colName] === 'object' ? JSON.stringify(firstRow[colName]) : String(firstRow[colName]))
        : '-';

      return {
        index: idx + 1,
        sourceName: colName,
        targetName: colName,
        inferredType: rawType,
        overrideType: rawType,
        nullable: isNull,
        sampleValue: sample,
      };
    });

    return {
      fileName,
      filePath,
      fileSizeBytes,
      formattedSize: formatBytes(fileSizeBytes),
      rowCount: totalRowCount,
      columnCount: columns.length,
      encoding: options.encoding || 'UTF-8',
      hasHeader: options.header,
      format,
      lastModified,
      columns,
      previewRows,
      rawSqlSource,
    };
  }

  private buildSelectSource(virtualFileName: string, format: ImportFileFormat, options: ParseOptions): string {
    if (format === 'Parquet') {
      return `read_parquet('${virtualFileName}')`;
    }
    if (format === 'JSON') {
      return `read_json_auto('${virtualFileName}')`;
    }
    // CSV / TSV / Default
    const opts: string[] = [];
    opts.push(`header=${options.header ? 'true' : 'false'}`);
    const delim = options.delimiter === '\t' ? '\\t' : options.delimiter;
    if (delim) opts.push(`delim='${delim}'`);
    if (options.quote) opts.push(`quote='${options.quote}'`);
    if (options.skipRows && options.skipRows > 0) opts.push(`skip=${options.skipRows}`);
    if (options.dateFormat) opts.push(`dateformat='${options.dateFormat}'`);

    const optsStr = opts.length > 0 ? `, ${opts.join(', ')}` : '';
    return `read_csv_auto('${virtualFileName}'${optsStr})`;
  }

  /**
   * 校验目标 Schema 与表名以及同名冲突策略
   */
  async validateTarget(
    schema: string,
    tableName: string,
    conflictStrategy: ConflictStrategy,
    columns: ColumnMappingItem[]
  ): Promise<{ valid: boolean; error?: string; warning?: string; tableExists: boolean; existingRowCount?: number }> {
    const cleanSchema = schema.trim() || 'main';
    const cleanTable = tableName.trim();

    if (!cleanTable) {
      return { valid: false, error: '目标表名不能为空', tableExists: false };
    }

    // 表名合法性校验（只允许英文字母、数字、下划线、中文）
    if (!/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/.test(cleanTable)) {
      return { valid: false, error: '表名只能包含字母、数字、下划线或中文，且不能以数字开头', tableExists: false };
    }

    // 检查目标表是否存在
    let tableExists = false;
    let existingRowCount = 0;
    try {
      const res = await duckDBService.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${cleanSchema.replace(/'/g, "''")}' 
          AND table_name = '${cleanTable.replace(/'/g, "''")}'
      `);
      tableExists = res && res.length > 0;
      if (tableExists) {
        const countRes = await duckDBService.query(`SELECT count(*) as cnt FROM "${cleanSchema}"."${cleanTable}";`);
        existingRowCount = Number(countRes[0]?.cnt || 0);
      }
    } catch {
      tableExists = false;
    }

    if (tableExists) {
      if (conflictStrategy === 'fail') {
        return {
          valid: false,
          error: `目标表 "${cleanSchema}.${cleanTable}" 已存在。当前策略为【存在即报错】，禁止覆盖。`,
          tableExists: true,
          existingRowCount,
        };
      }

      if (conflictStrategy === 'append') {
        // 校验列名或结构兼容性
        try {
          const targetCols = await duckDBService.getTableColumnDefinitions(cleanSchema, cleanTable);
          const targetColNames = new Set(targetCols.map(c => c.name.toLowerCase()));
          const missingCols = columns.filter(c => !targetColNames.has((c.overrideType ? c.targetName : c.sourceName).toLowerCase()));
          if (missingCols.length > 0 && targetCols.length !== columns.length) {
            return {
              valid: false,
              error: `列结构不兼容: 现有表有 ${targetCols.length} 列，而导入数据有 ${columns.length} 列 (缺失匹配列: ${missingCols.map(c => c.targetName).join(', ')})`,
              tableExists: true,
              existingRowCount,
            };
          }
        } catch (err: any) {
          return { valid: false, error: `校验现有表结构失败: ${err.message}`, tableExists: true };
        }
      }
    }

    return {
      valid: true,
      tableExists,
      existingRowCount,
      warning: tableExists && conflictStrategy === 'replace'
        ? `目标表 "${cleanSchema}.${cleanTable}" 已存在 (${existingRowCount} 行)，导入将彻底覆盖删除旧表`
        : undefined,
    };
  }

  /**
   * 真实落库执行全流程：事务写入、字段投影、物理验真与审计记录
   */
  async executeImport(
    rawSqlSource: string,
    schema: string,
    tableName: string,
    conflictStrategy: ConflictStrategy,
    columns: ColumnMappingItem[],
    skipCleanup = false
  ): Promise<ImportExecutionResult> {
    const startTime = performance.now();
    const cleanSchema = schema.trim() || 'main';
    const cleanTable = tableName.trim();

    // 1. 检查是否存在
    const existingTables = await duckDBService.getTableList(cleanSchema);
    const tableExists = existingTables.includes(cleanTable);

    if (tableExists && conflictStrategy === 'fail') {
      throw new Error(`目标表 "${cleanSchema}.${cleanTable}" 已存在，策略为 Fail If Exists，导入终止`);
    }

    // 2. 如果是覆盖替换且表存在，先 DROP TABLE
    if (tableExists && conflictStrategy === 'replace') {
      await duckDBService.query(`DROP TABLE IF EXISTS "${cleanSchema}"."${cleanTable}";`);
    }

    // 3. 构建 SELECT 投影与类型 CAST 语句
    const projections = columns.length > 0
      ? columns.map(col => {
          const sourceCol = `"${col.sourceName.replace(/"/g, '""')}"`;
          const targetCol = `"${col.targetName.replace(/"/g, '""')}"`;
          const castType = col.overrideType || col.inferredType;
          if (castType && castType !== 'ANY') {
            return `CAST(${sourceCol} AS ${castType}) AS ${targetCol}`;
          }
          return `${sourceCol} AS ${targetCol}`;
        }).join(',\n    ')
      : '*';

    let executeSql = '';
    const isAppend = tableExists && conflictStrategy === 'append';

    if (isAppend) {
      const targetColsList = columns.map(c => `"${c.targetName.replace(/"/g, '""')}"`).join(', ');
      executeSql = `INSERT INTO "${cleanSchema}"."${cleanTable}" (${targetColsList})\nSELECT\n    ${projections}\nFROM ${rawSqlSource};`;
    } else {
      executeSql = `CREATE TABLE "${cleanSchema}"."${cleanTable}" AS\nSELECT\n    ${projections}\nFROM ${rawSqlSource};`;
    }

    // 4. 执行写入
    await duckDBService.query(executeSql);

    // 5. 严格物理验真 (Verification)
    // 5.1 验证表是否存在
    const verifyTables = await duckDBService.getTableList(cleanSchema);
    if (!verifyTables.includes(cleanTable)) {
      throw new Error(`物理验真失败: 数据表 "${cleanSchema}.${cleanTable}" 未在数据库中成功创建`);
    }

    // 5.2 验证行数
    const countRes = await duckDBService.query(`SELECT count(*) as row_count FROM "${cleanSchema}"."${cleanTable}";`);
    const writtenRows = Number(countRes[0]?.row_count || 0);

    // 5.3 获取样本验证
    const sampleRows = await duckDBService.query(`SELECT * FROM "${cleanSchema}"."${cleanTable}" LIMIT 3;`);

    // 6. 审计日志记录
    const cleanSqlForAudit = executeSql.substring(0, 1000).replace(/'/g, "''");
    try {
      await duckDBService.query(`
        INSERT INTO memory._sys_audit_log (id, operation_type, target_table, details, affected_rows, sql_statement)
        VALUES (
          nextval('memory._sys_audit_seq'),
          'IMPORT',
          '${cleanSchema}.${cleanTable}',
          '${isAppend ? 'Appended' : 'Imported'} ${writtenRows} rows (columns: ${columns.length})',
          ${writtenRows},
          '${cleanSqlForAudit}'
        );
      `);
    } catch {}

    // 7. 派发全局变更事件
    window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));

    // 8. 清理临时虚拟文件
    if (!skipCleanup) {
      await this.cleanupVirtualFiles();
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      schema: cleanSchema,
      tableName: cleanTable,
      rowCount: writtenRows,
      columnsCount: columns.length,
      verified: true,
      durationMs,
      sampleRows,
    };
  }

  /**
   * 批量导入多个工作表，逐一校验并在完成后统一清理临时虚拟文件
   */
  async executeBatchImport(
    schema: string,
    sheetsToImport: {
      sheetName: string;
      tableName: string;
      rawSqlSource: string;
      columns: ColumnMappingItem[];
    }[],
    conflictStrategy: ConflictStrategy
  ): Promise<{ results: ImportExecutionResult[]; totalRows: number; createdTables: string[] }> {
    // 检查是否有同名目标表冲突
    const tableNames = sheetsToImport.map(s => s.tableName.trim());
    const seen = new Set<string>();
    for (const name of tableNames) {
      if (seen.has(name.toLowerCase())) {
        throw new Error(`目标表名重复: "${name}"。请在各工作表映射中指定不同的表名。`);
      }
      seen.add(name.toLowerCase());
    }

    const results: ImportExecutionResult[] = [];
    let totalRows = 0;

    for (const sheetItem of sheetsToImport) {
      if (!sheetItem.rawSqlSource) continue;
      const res = await this.executeImport(
        sheetItem.rawSqlSource,
        schema,
        sheetItem.tableName,
        conflictStrategy,
        sheetItem.columns,
        true
      );
      results.push(res);
      totalRows += res.rowCount;
    }

    await this.cleanupVirtualFiles();
    return { results, totalRows, createdTables: results.map(r => r.tableName) };
  }
}

export const dataImportService = new DataImportService();
