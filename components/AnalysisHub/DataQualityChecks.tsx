import React, { useEffect, useRef, useState } from 'react';
import { inspectData, type DataInspection, type InspectionState } from '../../services/dataInspection';
import { useDataInspection } from '../../hooks/store/useDataInspection';
import { duckDBService } from '../../services/duckdbService';

const labels: Record<InspectionState, string> = { not_checked: '未检查', passed: '已执行，未发现规则失败', issues: '发现规则失败', failed: '检查失败', unavailable: '数据或元数据不可用' };
export function DataQualityChecks({ currentTable, columns = [] }: { currentTable: string; columns?: string[] }) {
  const [result, setResult] = useState<DataInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [uniqueColumn, setUniqueColumn] = useState('');
  const generation = useRef(0);
  const reports = useDataInspection(state => state.reports);
  useEffect(() => {
    const request = ++generation.current;
    setResult(null); setBusy(false); setUniqueColumn('');
    void duckDBService.getCurrentCatalogAndSchema().then(scope => {
      if (generation.current !== request) return;
      const report = reports[JSON.stringify([scope.catalog, scope.schema, currentTable])];
      if (report) {
        setResult(report);
        setUniqueColumn(report.rules.find(rule => rule.name === '用户选择的唯一性规则')?.object || '');
      }
    }).catch(() => {});
    return () => { generation.current++; };
  }, [currentTable, reports]);
  const run = async () => {
    const request = ++generation.current; setBusy(true);
    try { const next = await inspectData(currentTable, { uniqueColumn }); if (generation.current === request) { setResult(next); useDataInspection.getState().record(next); } }
    catch (error) { if (generation.current === request) setResult({ catalog: '', schema: '', table: currentTable, checkedAt: Date.now(), status: 'failed', error: String((error as Error).message), rules: [], constraints: [] }); }
    finally { if (generation.current === request) setBusy(false); }
  };
  return <section aria-label="数据检查" className="rounded border border-monokai-border p-3 space-y-2 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">数据检查</h3>
      <button className="text-monokai-cyan disabled:opacity-50" disabled={busy || !currentTable} onClick={() => void run()}>{busy ? '正在检查…' : result ? '重新检查数据' : '执行数据检查'}</button></div>
    <p role="status">{busy ? '正在执行真实查询' : labels[result?.status || 'not_checked']}</p>
    <p className="text-monokai-comment">验证已声明的非空、唯一及外键约束；可空字段的空值仅作为观察。未声明约束不计为异常。</p>
    <label className="flex flex-wrap items-center gap-2">验证字段唯一性<select aria-label="选择唯一性检查字段" disabled={busy} value={uniqueColumn} onChange={event => { setUniqueColumn(event.target.value); setResult(null); }} className="rounded border border-monokai-border bg-monokai-surface p-1 max-w-full">
      <option value="">不增加规则</option>{columns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>
    {result && <>
      <p className="text-monokai-comment">{result.catalog}.{result.schema}.{result.table} · {new Date(result.checkedAt).toLocaleString()}</p>
      {result.error && <p role="alert" className="text-monokai-pink">{result.error}</p>}
      {result.rules.map((rule, index) => <details key={index} className="rounded border border-monokai-border p-2">
        <summary className="cursor-pointer break-words">{rule.name} · {rule.object} · {labels[rule.status]}{rule.failures != null ? ` · ${rule.failures} 项` : ''}</summary>
        {rule.error && <p role="alert" className="text-monokai-pink">{rule.error}</p>}
        <pre className="whitespace-pre-wrap break-words mt-2 text-monokai-comment">{rule.sql}</pre>
        {!!rule.evidence?.length && <div className="overflow-auto max-h-64 border border-monokai-border mt-2" aria-label="验证证据"><table className="text-left whitespace-nowrap"><thead><tr>{Object.keys(rule.evidence[0]).map(key => <th key={key} className="p-2">{key}</th>)}</tr></thead>
          <tbody>{rule.evidence.map((row, i) => <tr key={i}>{Object.values(row).map((value, j) => <td className="p-2" key={j}>{value == null ? 'NULL' : String(value)}</td>)}</tr>)}</tbody></table></div>}
        {rule.failures != null && rule.failures > 20 && <p>证据显示前 20 行；失败数量来自全量查询。</p>}
      </details>)}
    </>}
  </section>;
}
