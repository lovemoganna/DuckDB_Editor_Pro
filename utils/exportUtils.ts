import * as XLSX from 'xlsx';

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

interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export function downloadExcel(sheets: ExcelSheet[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, filename);
}

export function downloadObjectsAsExcel<T extends Record<string, unknown>>(
  objects: T[],
  filename: string,
  sheetName = 'Sheet1'
): void {
  if (objects.length === 0) {
    downloadExcel([{ name: sheetName, headers: [], rows: [] }], filename);
    return;
  }
  const headers = Object.keys(objects[0]);
  const rows = objects.map(obj => headers.map(h => obj[h] ?? null as unknown as undefined));
  downloadExcel([{ name: sheetName, headers, rows }], filename);
}
