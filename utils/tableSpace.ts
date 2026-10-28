/** Geometry only; every cell and row remains available. */
export function tableSpace(columns: string[], rows: Record<string, unknown>[]) {
  const length = (value: unknown) => Array.from(String(value ?? 'NULL')).reduce((n,c) => n + (/[^\x00-\x7f]/.test(c) ? 2 : 1),0);
  const widths = columns.map(column => Math.max(72, Math.min(320, 24 + Math.max(length(column), ...rows.slice(0,200).map(row=>length(row[column]))) * 7)));
  const rowHeight = Math.max(32, ...rows.slice(0,200).map(row => 12 + Math.max(1,...columns.map((column,i)=>Math.ceil(length(row[column])*7/Math.max(40,widths[i]-24))))*18));
  return { widths, width: widths.reduce((n,w)=>n+w,0), rowHeight };
}
