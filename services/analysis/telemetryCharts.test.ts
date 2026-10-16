import { expect, it } from 'vitest';
import { queryHistogram, queryLatency, importGrowth, memorySnapshot, tableVolume } from './telemetryCharts';
import type { QueryHistoryItem } from '../../types';

it('never invents time buckets for undated or out-of-window queries', () => {
  const rows = [{ id:'old',timestamp:1,executionTime:10,status:'success' }, { id:'undated',executionTime:10,status:'error' }, { id:'current',timestamp:995,executionTime:0,status:'success' }] as QueryHistoryItem[];
  const result = queryHistogram(rows,100,false,1000);
  expect(result.total).toBe(1);
  expect(result.queryHistogram.reduce((a,b) => a+b,0)).toBe(1);
  expect(result.histogramDetails.at(-1)?.percent).toBe(100);
  const latency = queryLatency(rows);
  expect(latency.latencyPoints.map(p => p.latency)).toEqual([10,0]);
  expect(latency.avgLatency).toBe(5);
});

it('uses successful import row counts and reports missing memory instead of a simulated curve', () => {
  const result = importGrowth([{id:'a',name:'a',tableName:'a',size:'1B',importedAt:'2025-01-02',status:'success',rowCount:2}, {id:'b',name:'b',tableName:'b',size:'1B',importedAt:'2025-01-01',status:'success',rowCount:10}, {id:'error',name:'e',tableName:'e',size:'1B',importedAt:'2025-01-03',status:'error',rowCount:100}]);
  expect(result.total).toBe(12);
  expect(result.spec.cartesian?.series[0].values).toEqual([10,12]);
  expect(memorySnapshot(20,1).memoryPoints).toHaveLength(1);
  expect(memorySnapshot(20,0).memoryPoints).toHaveLength(0);
  expect(tableVolume([{name:'empty',rowCount:0}],4,0).shares.values().next().value).toBeNull();
});

it('uses the same range for latency comparison and successful import growth',()=>{
 const range={from:Date.parse('2025-01-02'),to:Date.parse('2025-01-03')};
 const imports=[{id:'old',name:'old',tableName:'old',size:'1B',importedAt:'2025-01-01',status:'success' as const,rowCount:100},{id:'current',name:'current',tableName:'current',size:'1B',importedAt:'2025-01-02',status:'success' as const,rowCount:7}];
 expect(importGrowth(imports,range).total).toBe(7);
 const result=queryHistogram([{timestamp:995,executionTime:10,status:'success'},{timestamp:990,executionTime:30,status:'success'}] as QueryHistoryItem[],100,false,1000);
 expect(result.averageLatency).toBe(20);
 expect(result.latencyTrendLabel).toBe('—');
});
