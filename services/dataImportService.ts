import { duckDBService } from './duckdbService';
import { workbookIO, WorkbookFile } from './workbookIO';
import { validateDuckDBDatabaseFile } from './workspaceDatabaseFile';
import { quoteIdent, quoteLiteral } from './databaseCatalog';
import { allocateImportTableNames, allocateExcelTableNames, cleanIdentifier } from './importTableNames';

export type ImportSourceMode = 'local' | 'url' | 'paste';
export type ImportFileFormat = 'CSV' | 'TSV' | 'JSON' | 'Parquet' | 'Excel' | 'DuckDB';
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
  if (!name) return 'CSV';
  const trimmed = name.trim();

  try {
    const isUrl = /^https?:\/\//i.test(trimmed) || (trimmed.includes('/') && trimmed.includes('?'));
    if (isUrl) {
      const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
      const parsed = new URL(fullUrl);

      const formatParam = (
        parsed.searchParams.get('format') ||
        parsed.searchParams.get('exportFormat') ||
        parsed.searchParams.get('output') ||
        ''
      ).toLowerCase();

      if (formatParam === 'xlsx' || formatParam === 'xls') return 'Excel';
      if (formatParam === 'duckdb') return 'DuckDB';
      if (formatParam === 'parquet') return 'Parquet';
      if (formatParam === 'json' || formatParam === 'jsonl') return 'JSON';
      if (formatParam === 'tsv' || formatParam === 'tab') return 'TSV';
      if (formatParam === 'csv') return 'CSV';

      if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/spreadsheets')) {
        return 'Excel';
      }

      const pathname = parsed.pathname.toLowerCase();
      if (pathname.endsWith('.xlsx') || pathname.endsWith('.xls')) return 'Excel';
      if (pathname.endsWith('.duckdb')) return 'DuckDB';
      if (pathname.endsWith('.parquet')) return 'Parquet';
      if (pathname.endsWith('.json') || pathname.endsWith('.jsonl')) return 'JSON';
      if (pathname.endsWith('.tsv') || pathname.endsWith('.tab')) return 'TSV';
      if (pathname.endsWith('.csv')) return 'CSV';
    }
  } catch {
    // fallback to path/file extension check
  }

  const cleanName = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (cleanName.endsWith('.parquet')) return 'Parquet';
  if (cleanName.endsWith('.duckdb')) return 'DuckDB';
  if (cleanName.endsWith('.json') || cleanName.endsWith('.jsonl')) return 'JSON';
  if (cleanName.endsWith('.tsv') || cleanName.endsWith('.tab')) return 'TSV';
  if (cleanName.endsWith('.xlsx') || cleanName.endsWith('.xls')) return 'Excel';

  if (trimmed.includes('?')) {
    const queryPart = trimmed.split('?')[1].toLowerCase();
    if (queryPart.includes('format=xlsx') || queryPart.includes('format=xls')) return 'Excel';
    if (queryPart.includes('format=duckdb')) return 'DuckDB';
    if (queryPart.includes('format=parquet')) return 'Parquet';
    if (queryPart.includes('format=json')) return 'JSON';
    if (queryPart.includes('format=tsv')) return 'TSV';
  }

  return 'CSV';
}

export interface FetchedRemoteFile {
  blob: Blob;
  buffer: ArrayBuffer;
  fileName: string;
  size: number;
  contentType: string;
}

export function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=(?:UTF-8''|utf-8'')?([^;]+)/i.exec(header);
  if (utf8Match && utf8Match[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''));
      if (decoded) return decoded;
    } catch {}
  }
  const filenameMatch = /filename=["']?([^"';]+)["']?/i.exec(header);
  if (filenameMatch && filenameMatch[1]) {
    const raw = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
    if (raw) return raw;
  }
  return null;
}

export function normalizeRemoteUrl(url: string, format?: ImportFileFormat): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const gsMatch = trimmed.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
  if (gsMatch) {
    const docId = gsMatch[1];
    const exportFormat = format === 'CSV' ? 'csv' : format === 'TSV' ? 'tsv' : 'xlsx';
    if (!trimmed.includes('/export')) {
      return `https://docs.google.com/spreadsheets/d/${docId}/export?format=${exportFormat}`;
    } else if (!trimmed.includes('format=')) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${sep}format=${exportFormat}`;
    }
  }

  return trimmed;
}

export async function fetchRemoteFile(url: string, format?: ImportFileFormat): Promise<FetchedRemoteFile> {
  const normalizedUrl = normalizeRemoteUrl(url, format);
  let res: Response | null = null;
  let lastError: any = null;

  // 1. 本地开发服务器代理 /api/proxy (若在 Vite 开发环境中，可避免一切跨域与网络问题)
  try {
    const devProxyUrl = `/api/proxy?url=${encodeURIComponent(normalizedUrl)}`;
    const devRes = await fetch(devProxyUrl);
    if (devRes.ok) {
      res = devRes;
    }
  } catch {
    // 忽略代理错误，继续尝试直接 fetch
  }

  // 2. 尝试直接 fetch
  if (!res) {
    try {
      const directRes = await fetch(normalizedUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        },
      });
      if (directRes.ok) {
        res = directRes;
      } else {
        lastError = new Error(`HTTP ${directRes.status}: ${directRes.statusText}`);
      }
    } catch (directErr: any) {
      lastError = directErr;
    }
  }

  // 3. 尝试公共 CORS 代理备选
  if (!res) {
    try {
      const publicCorsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`;
      const corsRes = await fetch(publicCorsUrl);
      if (corsRes.ok) {
        res = corsRes;
      }
    } catch {
      // 忽略公共代理错误
    }
  }

  if (!res || !res.ok) {
    const detailMsg = lastError?.message || '网络连接或跨域策略受阻';
    throw new Error(
      `无法下载远程文件 (${detailMsg})。\n` +
      `排查建议：\n` +
      `1. 请检查文件链接是否允许公开访问（如 Google 表格需设为“知道链接的任何人可查看”）；\n` +
      `2. 若受浏览器跨域安全策略 (CORS) 限制，可直接在浏览器新标签页中打开链接下载文件，并切换至【本地文件】选项卡上传。`
    );
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(
      '远程地址返回了 HTML 网页内容，而非 Excel 二进制数据文件。' +
      '若使用 Google Sheets，请确保链接包含导出参数（/export?format=xlsx）且共享权限设为“知道链接的任何人可查看”。'
    );
  }

  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('下载的远程文件内容为空 (0 字节)');
  }

  let fileName = '';
  const contentDisp = res.headers.get('content-disposition');
  const headerFilename = parseFilenameFromContentDisposition(contentDisp);
  if (headerFilename) {
    fileName = headerFilename;
  } else {
    const gsMatch = normalizedUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
    if (gsMatch) {
      fileName = `google_sheet_${gsMatch[1].slice(0, 10)}.xlsx`;
    } else {
      const pathPart = normalizedUrl.split('?')[0].split('#')[0].split('/').pop() || 'remote_data';
      fileName = pathPart;
    }
  }

  if (!fileName.toLowerCase().endsWith('.xlsx') && !fileName.toLowerCase().endsWith('.xls') && !fileName.toLowerCase().endsWith('.duckdb')) {
    fileName += format === 'DuckDB' ? '.duckdb' : '.xlsx';
  }

  return {
    blob: new Blob([buffer]),
    buffer,
    fileName,
    size: buffer.byteLength,
    contentType,
  };
}

class DataImportService {
  private activeVirtualFiles = new Set<string>();
  private activeAttachedCatalogs = new Set<string>();
  private previewQueue: Promise<unknown> = Promise.resolve();

  private enqueuePreview<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.previewQueue.then(operation);
    this.previewQueue = next.catch(() => undefined);
    return next;
  }

  /**
   * 清理当前导入会话中创建的临时虚拟文件与临时挂载库
   */
  async cleanupVirtualFiles(): Promise<void> {
    return this.enqueuePreview(() => this.cleanupVirtualFilesNow());
  }

  private async cleanupVirtualFilesNow(): Promise<void> {
    for (const alias of this.activeAttachedCatalogs) {
      try {
        await duckDBService.query(`DETACH DATABASE IF EXISTS ${alias};`);
      } catch {}
    }
    this.activeAttachedCatalogs.clear();

    for (const name of this.activeVirtualFiles) {
      await duckDBService.dropFile(name);
    }
    this.activeVirtualFiles.clear();
  }

  /**
   * 处理 Excel 工作簿，将各个工作表转为 DuckDB 虚拟 CSV 表并推断 Schema 与构建元数据
   */
  async processExcelSheets(
    file: WorkbookFile,
    fileName: string,
    filePath: string,
    fileSizeBytes: number,
    lastModified: string,
    options: ParseOptions
  ): Promise<FileMetadataResult> {
    const parsedSheets = await workbookIO.readAllSheets(file);
    if (parsedSheets.length === 0) {
      throw new Error('Excel 文件中未发现工作表');
    }

    const sheetsMeta: ExcelSheetMetadata[] = [];
    const allocatedTableNames = allocateExcelTableNames(parsedSheets, fileName);
    const baseCleanName = fileName.split('.')[0].replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || 'imported';

    for (let i = 0; i < parsedSheets.length; i++) {
      const sheet = parsedSheets[i];
      const cleanSheetName = sheet.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || `sheet_${i + 1}`;
      const sheetTargetName = allocatedTableNames[i];

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
      format: 'Excel',
      lastModified,
      columns: activeSheet?.columns || [],
      previewRows: activeSheet?.previewRows || [],
      rawSqlSource: activeSheet?.rawSqlSource || '',
      sheets: sheetsMeta,
      activeSheetName: activeSheet?.name,
    };
  }

  /**
   * 处理 DuckDB 数据库文件，提取所有数据表、列结构与数据样本
   */
  async processDuckDbTables(
    file: File | { arrayBuffer(): Promise<ArrayBuffer>; size: number; name: string },
    fileName: string,
    filePath: string,
    fileSizeBytes: number,
    lastModified: string,
    _options: ParseOptions
  ): Promise<FileMetadataResult> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validateDuckDBDatabaseFile(bytes);
    } catch {
      throw new Error(`文件 "${fileName}" 不是有效的 DuckDB 数据库文件格式`);
    }

    const tempVFile = `duckdb_temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.duckdb`;
    await duckDBService.registerFileBuffer(tempVFile, bytes);
    this.activeVirtualFiles.add(tempVFile);

    try {
      const tempAlias = `_import_db_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await duckDBService.query(`ATTACH '${tempVFile}' AS ${tempAlias} (READ_ONLY);`);
      this.activeAttachedCatalogs.add(tempAlias);

      const tableRows = await duckDBService.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_catalog = '${tempAlias}'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY (table_schema = 'main') DESC, table_name;
      `);

      if (!tableRows || tableRows.length === 0) {
        throw new Error(`DuckDB 数据库文件 (${fileName}) 中未发现包含数据的数据表`);
      }

      const tablesMeta: ExcelSheetMetadata[] = [];
      const baseCleanName = fileName.replace(/\.duckdb$/i, '');
      const targetNames = allocateImportTableNames(baseCleanName, tableRows.map(row => ({ schema: String(row.table_schema), name: String(row.table_name) })));

      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        const tSchema = String(row.table_schema || 'main');
        const tName = String(row.table_name || '');
        const targetTableName = targetNames[i];
        const rawSqlSource = [tempAlias, tSchema, tName].map(quoteIdent).join('.');

        let tableCols: ColumnMappingItem[] = [];
        let tablePreview: Record<string, any>[] = [];
        let rowCount = 0;

        try {
          const describeRows = await duckDBService.query(`DESCRIBE SELECT * FROM ${rawSqlSource};`);
          tablePreview = await duckDBService.query(`SELECT * FROM ${rawSqlSource} LIMIT 100;`);
          const countRes = await duckDBService.query(`SELECT count(*) as cnt FROM ${rawSqlSource};`);
          rowCount = Number(countRes[0]?.cnt ?? tablePreview.length);
          const firstR = tablePreview[0] || {};
          tableCols = (describeRows || []).map((col: any, colIdx: number) => {
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
          await this.cleanupVirtualFilesNow();
          throw new Error(`无法解析 DuckDB 表 ${tSchema}.${tName}: ${(e as Error).message}`);
        }

        tablesMeta.push({
          name: tableRows.some(other => other !== row && String(other.table_name).toLowerCase() === tName.toLowerCase()) ? `${tSchema}.${tName}` : tName,
          targetTableName,
          rowCount,
          columnCount: tableCols.length,
          columns: tableCols,
          previewRows: tablePreview,
          rawSqlSource,
          isEmpty: rowCount === 0,
          selected: true,
        });
      }

      const activeTable = tablesMeta.find(t => !t.isEmpty) || tablesMeta[0];
      const totalRowCount = tablesMeta.reduce((acc, t) => acc + t.rowCount, 0);

      return {
        fileName,
        filePath,
        fileSizeBytes,
        formattedSize: formatBytes(fileSizeBytes),
        rowCount: totalRowCount,
        columnCount: activeTable?.columnCount || 0,
        encoding: 'Binary',
        hasHeader: true,
        format: 'DuckDB',
        lastModified,
        columns: activeTable?.columns || [],
        previewRows: activeTable?.previewRows || [],
        rawSqlSource: activeTable?.rawSqlSource || '',
        sheets: tablesMeta,
        activeSheetName: activeTable?.name,
      };
    } catch (error) {
      await this.cleanupVirtualFilesNow();
      throw error;
    }
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
    return this.enqueuePreview(() => this.sniffSourceNow(mode, file, url, text, options));
  }

  private async sniffSourceNow(
    mode: ImportSourceMode,
    file: File | null,
    url: string,
    text: string,
    options: ParseOptions,
  ): Promise<FileMetadataResult> {
    await this.cleanupVirtualFilesNow();

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
        return await this.processExcelSheets(file, fileName, filePath, fileSizeBytes, lastModified, options);
      } else if (format === 'DuckDB' || file.name.toLowerCase().endsWith('.duckdb')) {
        return await this.processDuckDbTables(file, fileName, filePath, fileSizeBytes, lastModified, options);
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
      const normalizedUrl = normalizeRemoteUrl(url, format);
      const detectedFmt = detectFormatFromName(normalizedUrl);
      const effectiveFormat = format === 'Excel' || detectedFmt === 'Excel'
        ? 'Excel'
        : format === 'DuckDB' || detectedFmt === 'DuckDB'
        ? 'DuckDB'
        : format;

      if (effectiveFormat === 'Excel') {
        const fetched = await fetchRemoteFile(normalizedUrl, 'Excel');
        fileName = fetched.fileName;
        fileSizeBytes = fetched.size;
        filePath = normalizedUrl;
        lastModified = '远程资源 (Remote)';

        const workbookFile: WorkbookFile = {
          name: fetched.fileName,
          size: fetched.size,
          arrayBuffer: async () => fetched.buffer,
        };

        return await this.processExcelSheets(
          workbookFile,
          fileName,
          filePath,
          fileSizeBytes,
          lastModified,
          options
        );
      } else if (effectiveFormat === 'DuckDB') {
        const fetched = await fetchRemoteFile(normalizedUrl, 'DuckDB');
        fileName = fetched.fileName;
        fileSizeBytes = fetched.size;
        filePath = normalizedUrl;
        lastModified = '远程资源 (Remote)';

        const duckdbFile = {
          name: fetched.fileName,
          size: fetched.size,
          arrayBuffer: async () => fetched.buffer,
        };

        return await this.processDuckDbTables(
          duckdbFile,
          fileName,
          filePath,
          fileSizeBytes,
          lastModified,
          options
        );
      } else {
        fileName = normalizedUrl.split('?')[0].split('#')[0].split('/').pop() || 'remote_data';
        filePath = normalizedUrl;
        lastModified = '远程资源 (Remote)';

        const isParquet = effectiveFormat === 'Parquet' || normalizedUrl.toLowerCase().includes('.parquet');
        const isJson = effectiveFormat === 'JSON' || normalizedUrl.toLowerCase().includes('.json');

        if (isParquet) {
          rawSqlSource = `read_parquet('${normalizedUrl}')`;
        } else if (isJson) {
          rawSqlSource = `read_json_auto('${normalizedUrl}')`;
        } else {
          const opts: string[] = [];
          if (options.header !== undefined) opts.push(`header=${options.header ? 'true' : 'false'}`);
          const delim = options.delimiter === '\t' || effectiveFormat === 'TSV' ? '\\t' : options.delimiter;
          if (delim) opts.push(`delim='${delim}'`);
          if (options.quote) opts.push(`quote='${options.quote}'`);
          const optsStr = opts.length > 0 ? `, ${opts.join(', ')}` : '';
          rawSqlSource = `read_csv_auto('${normalizedUrl}'${optsStr})`;
        }
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
    if (format === 'DuckDB') {
      return `'${virtualFileName}'`;
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
        WHERE table_catalog = current_database()
          AND lower(table_schema) = lower(${quoteLiteral(cleanSchema)})
          AND lower(table_name) = lower(${quoteLiteral(cleanTable)})
      `);
      tableExists = res && res.length > 0;
      if (tableExists) {
        const countRes = await duckDBService.query(`SELECT count(*) as cnt FROM ${quoteIdent(cleanSchema)}.${quoteIdent(cleanTable)};`);
        existingRowCount = Number(countRes[0]?.cnt || 0);
      }
    } catch (error) {
      return { valid: false, error: `无法校验目标表: ${(error as Error).message}`, tableExists };
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
          const missingCols = columns.filter(c => !targetColNames.has(c.targetName.toLowerCase()));
          if (missingCols.length > 0) {
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

    const target = `${quoteIdent(cleanSchema)}.${quoteIdent(cleanTable)}`;

    // 1. 检查是否存在
    const existingTables = await duckDBService.getTableList(cleanSchema);
    const tableExists = existingTables.some(name => name.toLowerCase() === cleanTable.toLowerCase());

    if (tableExists && conflictStrategy === 'fail') {
      throw new Error(`目标表 "${cleanSchema}.${cleanTable}" 已存在，策略为 Fail If Exists，导入终止`);
    }

    // 2. 如果是覆盖替换且表存在，先 DROP TABLE
    const dropSql = tableExists && conflictStrategy === 'replace'
      ? `DROP TABLE ${quoteIdent(cleanSchema)}.${quoteIdent(cleanTable)};` : '';

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
      executeSql = `INSERT INTO ${target}${targetColsList ? ` (${targetColsList})` : ''}\nSELECT\n    ${projections}\nFROM ${rawSqlSource};`;
    } else {
      executeSql = `CREATE TABLE ${target} AS\nSELECT\n    ${projections}\nFROM ${rawSqlSource};`;
    }

    // 4. 执行写入
    await duckDBService.executeTransaction([dropSql, executeSql].filter(Boolean));

    // 5. 严格物理验真 (Verification)
    // 5.1 验证表是否存在
    const verifyTables = await duckDBService.getTableList(cleanSchema);
    if (!verifyTables.some(name => name.toLowerCase() === cleanTable.toLowerCase())) {
      throw new Error(`物理验真失败: 数据表 "${cleanSchema}.${cleanTable}" 未在数据库中成功创建`);
    }

    // 5.2 验证行数
    const countRes = await duckDBService.query(`SELECT count(*) as row_count FROM ${target};`);
    const writtenRows = Number(countRes[0]?.row_count || 0);

    // 5.3 获取样本验证
    const sampleRows = await duckDBService.query(`SELECT * FROM ${target} LIMIT 3;`);

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

    // Validate every destination before writing the first table.
    for (const item of sheetsToImport) {
      const check = await this.validateTarget(schema, item.tableName, conflictStrategy, item.columns);
      if (!check.valid) throw new Error(check.error);
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
