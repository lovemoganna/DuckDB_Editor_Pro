import type { ChartSpec } from './types';
import { computePivotTable } from './chartDisplay';
export function filterPivotSpec(spec:ChartSpec, filter:string):ChartSpec {
  if (!filter.trim() || !spec.pivotTable) return spec;
  const pivot=spec.pivotTable, query=filter.trim().toLocaleLowerCase();
  if(pivot.totalsScope==='source') {
    const matches=(labels:string[], map?:Record<string,string>)=>labels.filter(key=>String(map?.[key] ?? key).toLocaleLowerCase().includes(query));
    const matchedRows=matches(pivot.rowValues,pivot.rowLabels), matchedCols=matches(pivot.colValues,pivot.colLabels);
    // View search changes visibility, never the source aggregates or their scope.
    const rowValues=matchedCols.length?pivot.rowValues:matchedRows,colValues=matchedRows.length?pivot.colValues:matchedCols;
    const rowSet=new Set(matchedRows);
    const matrix=Object.fromEntries(rowValues.map(row=>[row,rowSet.has(row)?pivot.matrix[row]:Object.fromEntries(matchedCols.filter(col=>Object.hasOwn(pivot.matrix[row] || {},col)).map(col=>[col,pivot.matrix[row][col]]))]));
    return {...spec,pivotTable:{...pivot,rowValues,colValues,matrix}};
  }
  const rows=(spec.rows||[]).filter(row=>[pivot.rowKey,pivot.colKey].some(key=>String(row[key]??'').toLocaleLowerCase().includes(query)));
  return {...spec,rows,pivotTable:{...pivot,...computePivotTable(rows,pivot.rowKey,pivot.colKey,pivot.valKey,pivot.aggregation)}};
}
