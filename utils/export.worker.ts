// Web Worker for asynchronous data export formatting
// This worker offloads CPU-intensive CSV, JSON, and Excel formatting from the main UI thread.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

self.onmessage = function (e: MessageEvent) {
  const { type, result, options = {} } = e.data;
  const { columns, rows } = result;

  try {
    let output = '';
    let mimeType = 'text/plain';

    if (type === 'csv') {
      mimeType = 'text/csv;charset=utf-8';
      const { bom = true, customColumns } = options;
      const cols = customColumns ?? columns;
      const header = cols.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(',');

      const formattedRows = rows.map((r: any) =>
        cols.map((c: string) => {
          const v = r[c];
          if (v === null || v === undefined) return '';
          const s = typeof v === 'bigint' ? v.toString() : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        }).join(',')
      );

      const content = `${header}\n${formattedRows.join('\n')}`;
      const bomChar = bom ? '\uFEFF' : '';
      output = bomChar + content;

    } else if (type === 'json') {
      mimeType = 'application/json';
      const replacer = (_key: string, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value;
      output = JSON.stringify(rows, replacer, 2);

    } else if (type === 'excel') {
      mimeType = 'application/vnd.ms-excel;charset=utf-8';
      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
      html += `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Query Results</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>`;
      html += `<body><table>`;
      
      // Header row
      html += `<tr>${columns.map((c: string) => `<th style="background-color: #4CAF50; color: white; font-weight: bold; border: 1px solid #dddddd; padding: 8px;">${String(c)}</th>`).join('')}</tr>`;
      
      // Data rows
      for (const r of rows) {
        html += `<tr>${columns.map((c: string) => {
          const v = r[c];
          if (v === null || v === undefined) return `<td style="border: 1px solid #dddddd; padding: 8px;"></td>`;
          const s = typeof v === 'bigint' ? v.toString() : String(v);
          return `<td style="border: 1px solid #dddddd; padding: 8px;">${escapeHtml(s)}</td>`;
        }).join('')}</tr>`;
      }
      
      html += `</table></body></html>`;
      output = html;
    }

    self.postMessage({ success: true, output, mimeType });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};
