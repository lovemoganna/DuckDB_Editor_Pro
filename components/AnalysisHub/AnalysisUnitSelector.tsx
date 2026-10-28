import React, { useEffect, useState } from 'react';
import { duckDBService } from '../../services/duckdbService';
import { quoteIdent, quoteTable } from '../../services/analysis/sqlUtils';
import type { ColumnInfo } from '../../types';
export function useAnalysisUnit(table: string, schema: ColumnInfo[]) {
  const column = schema.find(c => /^(asset|currency)$/i.test(c.name))?.name;
  const [unit,setUnit] = useState('');
  const [units,setUnits] = useState<string[]>([]);
  useEffect(() => {
    let active = true; setUnit('');setUnits([]);
    if (column && table) void duckDBService.readQuery(`SELECT DISTINCT ${quoteIdent(column)} AS unit FROM ${quoteTable(table)} WHERE ${quoteIdent(column)} IS NOT NULL ORDER BY 1`).then(rows => {
      if(!active) return; const values=rows.map(row=>String(row.unit));setUnits(values);setUnit(values[0] || '');
    }).catch(() => { if (active) { setUnits([]); setUnit(''); } });
    return () => { active=false; };
  }, [table,column]);
  const selector = column ? <label className="inline-flex items-center gap-2 text-xs text-monokai-comment">计量资产<select aria-label="分析计量资产" value={unit} onChange={e=>setUnit(e.target.value)} className="bg-monokai-bg border border-monokai-border rounded p-1"><option value="">请选择资产</option>{units.map(u=><option key={u} value={u}>{u}</option>)}</select><span>不同资产不合计 · 所有状态</span></label> : null;
  return { column,unit,selector };
}
