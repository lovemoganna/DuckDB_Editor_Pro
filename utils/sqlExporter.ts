/**
 * sqlExporter.ts — Enhanced SQL result export utilities.
 *
 * Loop 8 of SqlEditor Pro refactor.
 *
 * Provides:
 *   - CSV with optional UTF-8 BOM (Excel-compatible)
 *   - JSON with bigint serialization
 *   - Markdown table export
 *   - HTML report generation
 *   - Clipboard copy (TSV / Markdown / HTML)
 *
 * All functions are pure and synchronous (or async for Parquet via duckDBService).
 */

import type { QueryResult } from '../types';

/** Options for CSV export. */
export interface CsvExportOptions {
  /** Prepend UTF-8 BOM so Excel opens the file correctly. Default: true. */
  bom?: boolean;
  /** Custom column names (defaults to result column names). */
  columns?: string[];
}

/** Options for HTML report. */
export interface HtmlReportOptions {
  /** Custom title. Defaults to tab title. */
  title?: string;
  /** Number of rows to include in preview. Default: 100. */
  maxRows?: number;
  /** Base64 chart image (optional). */
  chartImage?: string | null;
}

/** Options for markdown export. */
export interface MarkdownExportOptions {
  /** Include separator row. Default: true. */
  includeSeparator?: boolean;
}

/**
 * Export query results as CSV (optionally with UTF-8 BOM for Excel).
 */
export function exportCsv(result: QueryResult, options: CsvExportOptions = {}): Blob {
  const { bom = true, columns } = options;
  const cols = columns ?? result.columns;
  const header = cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');

  const rows = result.rows.map(r =>
    cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'bigint' ? v.toString() : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const content = `${header}\n${rows.join('\n')}`;
  const bomChar = bom ? '\uFEFF' : '';
  return new Blob([bomChar + content], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export query results as formatted JSON.
 */
export function exportJson(result: QueryResult): Blob {
  const replacer = (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value;
  const content = JSON.stringify(result.rows, replacer, 2);
  return new Blob([content], { type: 'application/json' });
}

/**
 * Generate a Markdown table from query results.
 */
export function exportMarkdown(result: QueryResult, options: MarkdownExportOptions = {}): string {
  const { includeSeparator = true } = options;
  const { columns, rows } = result;

  const header = `| ${columns.join(' | ')} |`;
  const sep = includeSeparator
    ? `| ${columns.map(() => '---').join(' | ')} |`
    : '';
  const body = rows.map(r =>
    `| ${columns.map(c => {
      const v = r[c];
      if (v === null) return '_NULL_';
      if (v === undefined) return '';
      return String(v).replace(/\|/g, '\\|');
    }).join(' | ')} |`
  ).join('\n');

  return [header, sep, body].filter((l, i) => i === 0 || (i === 1 && includeSeparator) || l !== '').join('\n');
}

/**
 * Generate an HTML report from query results.
 */
export function generateHtmlReport(
  title: string,
  sql: string,
  result: QueryResult,
  options: HtmlReportOptions = {}
): string {
  const { title: customTitle, maxRows = 100, chartImage } = options;
  const reportTitle = customTitle ?? title;
  const previewRows = result.rows.slice(0, maxRows);

  const rowsHtml = previewRows.map(r =>
    `<tr>${result.columns.map(c => {
      const v = r[c];
      return `<td>${v === null ? '<em>NULL</em>' : escapeHtml(String(v))}</td>`;
    }).join('')}</tr>`
  ).join('');

  const headersHtml = result.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(reportTitle)}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f8f8f8; color: #222; }
        h1 { margin: 0 0 4px; font-size: 20px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
        .sql-block { background: #eee; padding: 14px; border-radius: 6px; font-family: 'Courier New', monospace; white-space: pre-wrap; border: 1px solid #ddd; margin-bottom: 20px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
        th { background: #f2f2f2; font-weight: 600; }
        tr:hover td { background: #fafafa; }
        .chart-container { margin-bottom: 24px; background: white; padding: 16px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        img { max-width: 100%; height: auto; }
        .section-title { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: #333; }
        .null { color: #999; font-style: italic; }
        .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
    </style>
</head>
<body>
    <h1>${escapeHtml(reportTitle)}</h1>
    <div class="meta">
        Generated on ${new Date().toLocaleString()} &middot;
        Execution: ${result.executionTime.toFixed(2)}ms &middot;
        Rows: ${result.rows.length.toLocaleString()}${result.rows.length > maxRows ? ` (showing first ${maxRows})` : ''}
    </div>

    <div class="section-title">SQL</div>
    <div class="sql-block">${escapeHtml(sql) || '<em>—</em>'}</div>

    ${chartImage ? `
    <div class="chart-container">
        <img src="${chartImage}" alt="Chart" />
    </div>` : ''}

    <div class="section-title">Data Preview</div>
    <table>
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>

    <div class="footer">DuckDB Manager &mdash; Generated Report</div>
</body>
</html>`;
}

/**
 * Copy query results as TSV to clipboard.
 */
export function copyAsTsv(result: QueryResult): string {
  const { columns, rows } = result;
  const header = columns.join('\t');
  const body = rows.map(r => columns.map(c => String(r[c] ?? '')).join('\t')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Copy query results as Markdown table to clipboard.
 */
export function copyAsMarkdown(result: QueryResult): string {
  return exportMarkdown(result);
}

/**
 * Copy query results as HTML table to clipboard.
 */
export function copyAsHtml(result: QueryResult): string {
  const header = `<thead><tr>${result.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${result.rows.map(r =>
    `<tr>${result.columns.map(c => {
      const v = r[c];
      return `<td>${v === null ? '<em>NULL</em>' : escapeHtml(String(v))}</td>`;
    }).join('')}</tr>`
  ).join('')}</tbody>`;
  return `<table border="1" cellspacing="0" cellpadding="5">\n${header}\n${body}\n</table>`;
}

/**
 * Export query results as Excel-compatible HTML/XML Spreadsheet.
 */
export function exportExcel(result: QueryResult): Blob {
  const { columns, rows } = result;
  
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  html += `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Query Results</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>`;
  html += `<body><table>`;
  
  // Header row
  html += `<tr>${columns.map(c => `<th style="background-color: #4CAF50; color: white; font-weight: bold; border: 1px solid #dddddd; padding: 8px;">${String(c)}</th>`).join('')}</tr>`;
  
  // Data rows
  for (const r of rows) {
    html += `<tr>${columns.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return `<td style="border: 1px solid #dddddd; padding: 8px;"></td>`;
      const s = typeof v === 'bigint' ? v.toString() : String(v);
      return `<td style="border: 1px solid #dddddd; padding: 8px;">${escapeHtml(s)}</td>`;
    }).join('')}</tr>`;
  }
  
  html += `</table></body></html>`;
  return new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
}


/** Trigger a file download from a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Asynchronously export query results as Blob using a Web Worker.
 * Follows User's Option B: if Worker is unsupported, throws error.
 */
export function exportDataAsync(
  type: 'csv' | 'json' | 'excel',
  result: QueryResult,
  options: any = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof Worker === 'undefined') {
        throw new Error('当前浏览器环境不支持 Web Worker，无法运行异步数据导出。');
      }

      const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        const { success, output, mimeType, error } = e.data;
        worker.terminate();
        if (success) {
          resolve(new Blob([output], { type: mimeType }));
        } else {
          reject(new Error(error || '导出格式化失败。'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ type, result, options });
    } catch (e) {
      reject(e);
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

