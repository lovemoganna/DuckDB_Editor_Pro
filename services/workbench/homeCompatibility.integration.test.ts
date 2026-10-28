import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { widgetRowsToChartSpec } from '../analysis/adapters/dashboardWidgetAdapter';

// Three existing real-source structures, not generated records or a new dataset.
it.each([
  { table:'users', count:10, columns:'uid, country_code, account_status', key:'country_code' },
  { table:'exchange_rates', count:8, columns:'asset, rate_to_usdt, effective_date, source', key:'asset' },
  { table:'crypto_transactions', count:25, columns:'crypto_order_id, amount, confirmations, completed_at', key:'crypto_order_id' },
])('preserves all real $table rows through table adaptation',({table,count,columns,key})=>{
  const result=spawnSync('duckdb',[resolve('data/crud-lab/baseline.duckdb'),'-readonly','-bail','-json'],{
    input:`SELECT ${columns} FROM "${table}" ORDER BY 1;`,encoding:'utf8',
  });
  if(result.status!==0)throw new Error(result.stderr || result.error?.message || 'DuckDB unavailable');
  const rows=JSON.parse(result.stdout);
  expect(rows).toHaveLength(count);
  const spec=widgetRowsToChartSpec(rows,{id:table,title:table,type:'table',xKey:key,yKeys:[]});
  expect(spec.emptyState).toBe('ok');
  expect(spec.rows).toEqual(rows);
  expect(spec.columns).toEqual(columns.split(', '));
  if(table==='crypto_transactions')expect(spec.rows.some(row=>row.completed_at===null)).toBe(true);
  if(table==='exchange_rates')expect(spec.rows.every(row=>row.effective_date==='2024-09-01')).toBe(true);
});
