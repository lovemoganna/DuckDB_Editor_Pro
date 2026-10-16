import {expect,it} from 'vitest';
import {computePivotTable} from './chartDisplay';
import {filterPivotSpec} from './pivotFilter';
import {formatValueBySpec} from '../../utils/chartFormat';
import {compiledPivotSql,defaultPivot} from './pivotExperience';
import type {ChartSpec} from './types';
import {comparePivotValues,pivotMatrixRows,csvText} from './pivotView';
const source={id:'precision',name:'Precision',catalog:'memory',schema:'main',kind:'query' as const,version:1,sql:"SELECT 'A' region, CAST(9007199254740993 AS DECIMAL(38,0)) amount",fields:[{name:'region',type:'VARCHAR'},{name:'amount',type:'DECIMAL(38,0)'}]};
it('does not cast exact pivot amounts to floating point before aggregation',()=>{
  const d={...defaultPivot(source),metrics:[{column:'amount',agg:'sum' as const,alias:'金额'}]};
  expect(compiledPivotSql(d)).not.toContain('CAST("amount" AS DOUBLE)');
});
it('preserves exact engine cells and totals through the pivot matrix',()=>{
  const rows=[{region:'A',amount:'9007199254740993',__pivot_row_amount:'9007199254740993',__pivot_col_amount:'9007199254740993',__pivot_all_amount:'9007199254740993',__pivot_count:1}];
  const p=computePivotTable(rows,'region','','amount');
  expect(String(p.grandTotal)).toBe('9007199254740993');
  expect(String(p.matrix[p.rowValues[0]]['汇总'])).toBe('9007199254740993');
});
it('keeps source totals when view search has no matching labels',()=>{
  const rows=[{region:'A',value:10,__pivot_row_value:10,__pivot_col_value:10,__pivot_all_value:10,__pivot_count:1}];
  const p=computePivotTable(rows,'region','','value');
  const spec={rows,pivotTable:{...p,rowKey:'region',colKey:'',valKey:'value',aggregation:'sum'}} as ChartSpec;
  const filtered=filterPivotSpec(spec,'missing').pivotTable!;
  expect(filtered.rowValues).toHaveLength(0);expect(filtered.grandTotal).toBe(10);expect(filtered.grandCount).toBe(1);
});
it('never silently rounds a nonzero pivot amount to zero',()=>{
  expect(formatValueBySpec(0.0000123,{decimals:2,compact:false,precisionSafe:true})).not.toBe('0');
});
it('sorts exact large totals without floating point and exports the declared visible rows',()=>{
  expect(comparePivotValues('9007199254740993','9007199254740992')).toBeGreaterThan(0);
  expect(comparePivotValues('-0.00012','-0.00011')).toBeLessThan(0);
  const rows=[{region:'A',value:'9007199254740993',__pivot_row_value:'9007199254740993',__pivot_col_value:'9007199254740993',__pivot_all_value:'9007199254740993',__pivot_count:1}];
  const pivot={...computePivotTable(rows,'region','','value'),rowKey:'region',colKey:'',valKey:'value',aggregation:'sum' as const};
  const csv=csvText(pivotMatrixRows(pivot,pivot.rowValues));expect(csv).toContain('9007199254740993');expect(csv).toContain('全部符合条件的来源');
});
it('sorts scientific notation together with exact decimal strings',()=>{
  expect(comparePivotValues(1e-30,1e-20)).toBeLessThan(0);
  expect(comparePivotValues(1e21,'1000000000000000000001')).toBeLessThan(0);
});
