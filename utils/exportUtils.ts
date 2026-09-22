import { workbookIO, WorkbookSheet } from '../services/workbookIO';

/** Prepend UTF-8 BOM so Excel correctly recognizes the encoding. */
export function encodeCSV(content: string): Blob {
  return new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
}

export function arrayToCSV(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map(r =>
    r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = encodeCSV(content);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadArrayAsCSV(rows: (string | number | boolean | null | undefined)[][], filename: string): void {
  downloadCSV(arrayToCSV(rows), filename);
}

export function downloadExcel(sheets: WorkbookSheet[], filename: string): Promise<void> {
  return workbookIO.downloadWorkbook(sheets, filename);
}

export function downloadObjectsAsExcel<T extends Record<string, unknown>>(
  objects: T[],
  filename: string,
  sheetName = 'Sheet1'
): Promise<void> {
  if (objects.length === 0) {
    return downloadExcel([{ name: sheetName, headers: [], rows: [] }], filename);
  }
  const headers = Object.keys(objects[0]);
  const rows = objects.map(obj => headers.map(h => obj[h] ?? null));
  return downloadExcel([{ name: sheetName, headers, rows: rows as (string | number | boolean | null | undefined)[][] }], filename);
}
