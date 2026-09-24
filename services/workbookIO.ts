import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { SheetData } from 'write-excel-file/browser';
import { unzipSync, strFromU8 } from 'fflate';

export interface WorkbookSheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export interface WorkbookParsedSheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  csvText: string;
  rowCount: number;
  columnCount: number;
  isEmpty: boolean;
  isHidden?: boolean;
}

export interface WorkbookFile {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type WorkbookImportErrorCode =
  | 'LEGACY_XLS_UNSUPPORTED'
  | 'UNSUPPORTED_WORKBOOK'
  | 'WORKBOOK_TOO_LARGE'
  | 'WORKBOOK_EMPTY'
  | 'WORKBOOK_TOO_MANY_CELLS';

export class WorkbookImportError extends Error {
  public readonly code: WorkbookImportErrorCode;
  public readonly originalError?: unknown;

  constructor(
    code: WorkbookImportErrorCode,
    message: string,
    originalError?: unknown
  ) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.name = 'WorkbookImportError';
  }
}

const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;
const MAX_WORKBOOK_CELLS = 1_000_000;

function extensionOf(name: string): string {
  const clean = name.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return ext;
  if (name.toLowerCase().includes('format=xlsx')) return 'xlsx';
  if (name.toLowerCase().includes('format=xls')) return 'xls';
  return ext;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function csvCell(value: string | number | boolean | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function safeWorksheetName(name: string, index: number, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, '_').trim().slice(0, 31) || `Sheet${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const marker = `_${suffix++}`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export class WorkbookIO {
  async createWorkbookBuffer(sheets: WorkbookSheet[]): Promise<ArrayBuffer> {
    const usedNames = new Set<string>();
    const sourceSheets = sheets.length > 0
      ? sheets
      : [{ name: 'Sheet1', headers: [], rows: [] }];
    const output = writeXlsxFile(sourceSheets.map((sheet, index) => ({
      sheet: safeWorksheetName(sheet.name, index, usedNames),
      data: [
        ...(sheet.headers.length > 0 ? [sheet.headers] : []),
        ...sheet.rows,
      ] as SheetData,
    })));
    return (await output.toBlob()).arrayBuffer();
  }

  async downloadWorkbook(sheets: WorkbookSheet[], filename: string): Promise<void> {
    const buffer = await this.createWorkbookBuffer(sheets);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 自动识别并解析 Excel 工作簿中的全部工作表，保留名称、独立表头、数据行及空/隐藏状态
   */
  async readAllSheets(file: WorkbookFile): Promise<WorkbookParsedSheet[]> {
    const extension = extensionOf(file.name);
    if (extension === 'xls') {
      throw new WorkbookImportError(
        'LEGACY_XLS_UNSUPPORTED',
        'Legacy .xls files are not parsed in the browser. Save the file as .xlsx or CSV, then import it again.',
      );
    }
    if (file.size > MAX_WORKBOOK_BYTES) {
      throw new WorkbookImportError(
        'WORKBOOK_TOO_LARGE',
        'Workbook exceeds the 25 MB browser safety limit. Export it as CSV or Parquet for large imports.',
      );
    }

    const buffer = await file.arrayBuffer();
    const firstBytes = new Uint8Array(buffer.slice(0, 4));
    const isZip = firstBytes[0] === 0x50 && firstBytes[1] === 0x4b && firstBytes[2] === 0x03 && firstBytes[3] === 0x04;

    if (extension !== 'xlsx' && !isZip) {
      throw new WorkbookImportError(
        'UNSUPPORTED_WORKBOOK',
        `Expected an .xlsx workbook, received .${extension || 'unknown'}.`,
      );
    }

    // 探测隐藏工作表 (OpenXML xl/workbook.xml state="hidden"|"veryHidden")
    const hiddenSheetNames = new Set<string>();
    try {
      const unzipped = unzipSync(new Uint8Array(buffer), {
        filter: (entry) => entry.name === 'xl/workbook.xml',
      });
      if (unzipped['xl/workbook.xml']) {
        const xmlText = strFromU8(unzipped['xl/workbook.xml']);
        const sheetTagRegex = /<sheet\b([^>]*)\/?>/gi;
        let match: RegExpExecArray | null;
        while ((match = sheetTagRegex.exec(xmlText)) !== null) {
          const attrs = match[1];
          const nameMatch = /name=["']([^"']*)["']/i.exec(attrs);
          const stateMatch = /state=["'](hidden|veryHidden)["']/i.exec(attrs);
          if (nameMatch && stateMatch) {
            hiddenSheetNames.add(decodeXmlEntities(nameMatch[1]));
          }
        }
      }
    } catch {
      // 容错处理：不阻断主解析流程
    }

    const rawSheets = await readXlsxFile(buffer);
    if (!rawSheets || rawSheets.length === 0) {
      throw new WorkbookImportError('WORKBOOK_EMPTY', 'The workbook does not contain a worksheet.');
    }

    let totalCells = 0;
    const parsedSheets: WorkbookParsedSheet[] = [];

    for (const rawSheet of rawSheets) {
      const sheetName = rawSheet.sheet || 'Sheet';
      const rawRows = rawSheet.data || [];
      const isHidden = hiddenSheetNames.has(sheetName);

      const cellCount = rawRows.reduce((acc, r) => acc + (r ? r.length : 0), 0);
      totalCells += cellCount;

      const isCellEmpty = (c: unknown) => c === null || c === undefined || String(c).trim() === '';
      const isRowEmpty = (r: unknown[]) => !r || r.length === 0 || r.every(isCellEmpty);

      // 去除末尾纯空行与前导纯空行
      let endIdx = rawRows.length;
      while (endIdx > 0 && isRowEmpty(rawRows[endIdx - 1])) {
        endIdx--;
      }
      let startIdx = 0;
      while (startIdx < endIdx && isRowEmpty(rawRows[startIdx])) {
        startIdx++;
      }
      const trimmedRows = rawRows.slice(startIdx, endIdx);

      if (trimmedRows.length === 0) {
        parsedSheets.push({
          name: sheetName,
          headers: [],
          rows: [],
          csvText: '',
          rowCount: 0,
          columnCount: 0,
          isEmpty: true,
          isHidden,
        });
        continue;
      }

      // 首行作为列名
      const headerRow = trimmedRows[0];
      let maxCols = headerRow.length;
      for (let i = 1; i < trimmedRows.length; i++) {
        if (trimmedRows[i].length > maxCols) {
          maxCols = trimmedRows[i].length;
        }
      }

      const headers: string[] = [];
      for (let c = 0; c < maxCols; c++) {
        const rawVal = headerRow[c];
        const colName = !isCellEmpty(rawVal) ? String(rawVal).trim() : `col_${c + 1}`;
        headers.push(colName);
      }

      // 数据行提取与格式标准化
      const dataRows: (string | number | boolean | null | undefined)[][] = [];
      for (let r = 1; r < trimmedRows.length; r++) {
        const row = trimmedRows[r];
        const normalizedRow: (string | number | boolean | null | undefined)[] = [];
        let rowHasData = false;
        for (let c = 0; c < maxCols; c++) {
          const val = row[c];
          const norm = normalizeCellValue(val);
          if (norm !== null && norm !== '') rowHasData = true;
          normalizedRow.push(norm);
        }
        if (rowHasData) {
          dataRows.push(normalizedRow);
        }
      }

      const csvLines: string[] = [];
      csvLines.push(headers.map(h => csvCell(h)).join(','));
      for (const r of dataRows) {
        csvLines.push(r.map(v => csvCell(v)).join(','));
      }
      const csvText = csvLines.join('\n');

      parsedSheets.push({
        name: sheetName,
        headers,
        rows: dataRows,
        csvText,
        rowCount: dataRows.length,
        columnCount: headers.length,
        isEmpty: dataRows.length === 0 && headers.length === 0,
        isHidden,
      });
    }

    if (totalCells > MAX_WORKBOOK_CELLS) {
      throw new WorkbookImportError(
        'WORKBOOK_TOO_MANY_CELLS',
        `The workbook exceeds the ${MAX_WORKBOOK_CELLS.toLocaleString()}-cell browser safety limit. Export it as CSV or Parquet.`,
      );
    }

    return parsedSheets;
  }

  async readFirstSheetAsCsv(file: WorkbookFile): Promise<string> {
    const sheets = await this.readAllSheets(file);
    const target = sheets.find(s => !s.isEmpty) || sheets[0];
    if (!target || (target.isEmpty && target.headers.length === 0)) {
      throw new WorkbookImportError('WORKBOOK_EMPTY', 'The workbook does not contain a worksheet.');
    }
    return target.csvText;
  }
}

export const workbookIO = new WorkbookIO();
