import React, { useEffect, useRef, useState } from 'react';
import { duckDBService } from '../../services/duckdbService';
import type { OntologyModelingResult } from '../../services/ontologyModelingService';
import { normalizeModelingDraft, queryModelingInstances } from '../../services/ontologyModelingDraft';
import type { DatasetDefinition } from '../../services/workbench/analysisTypes';
import { datasetModelingMapping } from '../../services/ontologyModelingDatasets';

type Column = { table_catalog: string; table_schema: string; table_name: string; column_name: string };
export function OntologyModelingMapping({ draft, selectedTypeName, onChange, datasets = [], owner = '', activeDataset }: {
  draft: OntologyModelingResult; selectedTypeName: string | null; onChange: (d: OntologyModelingResult) => void;
  datasets?: DatasetDefinition[]; owner?: string; activeDataset?: DatasetDefinition;
}) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => {
    setError('');
    try { setColumns(await duckDBService.query(`SELECT table_catalog, table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema NOT IN ('information_schema','pg_catalog') ORDER BY 1,2,3,ordinal_position`)); }
    catch (e) { setError(String(e)); }
  };
  useEffect(() => { void refresh(); }, []);
  const t = draft.objectTypes.find(t => t.name === selectedTypeName);
  const m = t?.mapping;
  const unique = (rows: Column[], key: keyof Column) => [...new Set(rows.map(c => c[key]))];
  const fields = (typeName: string) => {
    const mapping = draft.objectTypes.find(t => t.name === typeName)?.mapping;
    if (mapping?.dataset) return datasets.find(d => d.id === mapping.dataset!.id)?.fields.map(f => f.name) || [];
    return columns.filter(c => c.table_catalog === mapping?.catalog && c.table_schema === mapping?.schema && c.table_name === mapping?.table).map(c => c.column_name);
  };
  const update = (patch: Partial<NonNullable<typeof m>>) => {
    if (!t) return;
    onChange(normalizeModelingDraft({ ...draft, objectTypes: draft.objectTypes.map(o => o === t ? { ...o,
      mapping: { catalog: '', schema: '', table: '', idField: '', properties: {}, ...m, ...patch } } : o) }));
  };
  const select = (label: string, value: string, values: string[], change: (v: string) => void) => <label className="block space-y-1">{label}
    <select aria-label={label} className="w-full rounded border border-monokai-border bg-monokai-bg p-1" value={value} onChange={e => change(e.target.value)}>
      <option value="">请选择</option>{values.map(v => <option key={v}>{v}</option>)}
    </select></label>;
  return <section className="text-xs space-y-3" aria-label="真实数据映射">
    <p>定义 Object Type 不创建实例。配置来源和连接条件后，查询 DuckDB 生成实例草案。</p>
    <button onClick={refresh} className="text-monokai-cyan">刷新数据库目录</button>
    {t ? <div className="space-y-2">
      <strong>{t.name} · 数据来源</strong>
      <label className="block space-y-1">工作区数据集
        <select aria-label="工作区数据集" className="w-full rounded border border-monokai-border bg-monokai-bg p-1" value={m?.dataset?.id || ''} onChange={e => {
          const definition = datasets.find(d => d.id === e.target.value);
          if (!definition) { update({ dataset: undefined, table: '', idField: '', properties: {} }); return; }
          try {
            const source = activeDataset?.id === definition.id ? activeDataset : definition;
            const mapping = datasetModelingMapping(source, owner, definition);
            mapping.properties = Object.fromEntries(Object.keys(t.properties || {}).filter(p => source.fields.some(f => f.name === p)).map(p => [p, p]));
            onChange(normalizeModelingDraft({ ...draft, objectTypes: draft.objectTypes.map(o => o === t ? { ...o, mapping } : o) }));
          } catch (e) { setError(String(e)); }
        }}>
          <option value="">手动选择物理表</option>
          {m?.dataset && !datasets.some(d => d.id === m.dataset!.id) && <option value={m.dataset.id}>{m.dataset.name}（当前不可用）</option>}
          {datasets.map(d => <option key={d.id} value={d.id} disabled={!!d.error}>{d.name}{d.kind === 'query' ? ' · SQL 数据集' : ''}</option>)}
        </select>
      </label>
      {m?.dataset ? <div className="space-y-1"><p>{m.dataset.name} · v{m.dataset.version} · {m.catalog}.{m.schema}</p>
        <details><summary className="cursor-pointer">查看来源查询与筛选范围</summary><pre className="whitespace-pre-wrap break-all">{m.dataset.sql}</pre></details></div> : <>
      {select('数据库', m?.catalog || '', unique(columns, 'table_catalog'), catalog => update({ catalog, schema: '', table: '', idField: '', properties: {} }))}
      {select('数据集 / Schema', m?.schema || '', unique(columns.filter(c => c.table_catalog === m?.catalog), 'table_schema'), schema => update({ schema, table: '', idField: '', properties: {} }))}
      {select('表 / 视图', m?.table || '', unique(columns.filter(c => c.table_catalog === m?.catalog && c.table_schema === m?.schema), 'table_name'), table => update({ table, idField: '', properties: {} }))}
      </>}
      {select('对象标识字段', m?.idField || '', fields(t.name), idField => update({ idField }))}
      {Object.keys(t.properties || {}).map(p => <React.Fragment key={p}>{select(`属性 ${p} 来源字段`, m?.properties[p] || '', fields(t.name), f => {
        const properties = { ...m?.properties }; if (f) properties[p] = f; else delete properties[p]; update({ properties });
      })}</React.Fragment>)}
      {m && <button className="text-monokai-orange" onClick={() => onChange(normalizeModelingDraft({ ...draft, objectTypes: draft.objectTypes.map(o => o === t ? { ...o, mapping: undefined } : o) }))}>移除此对象的数据映射</button>}
    </div> : <p>点击画布对象，配置其数据来源。</p>}
    {draft.linkTypes.map((l, i) => <div key={i} className="border-t border-monokai-border pt-2 space-y-1">
      <strong>{l.name}：{l.fromType} → {l.toType}</strong>
      <p>等值连接条件（两端字段需兼容）</p>
      {select(`${l.name} 来源连接字段`, l.mapping?.sourceField || '', fields(l.fromType), sourceField => onChange(normalizeModelingDraft({ ...draft, linkTypes: draft.linkTypes.map((r, j) => j === i ? { ...r, mapping: { sourceField, targetField: r.mapping?.targetField || '' } } : r) })))}
      {select(`${l.name} 目标连接字段`, l.mapping?.targetField || '', fields(l.toType), targetField => onChange(normalizeModelingDraft({ ...draft, linkTypes: draft.linkTypes.map((r, j) => j === i ? { ...r, mapping: { sourceField: r.mapping?.sourceField || '', targetField } } : r) })))}
      {l.mapping && <button className="text-monokai-orange" onClick={() => onChange(normalizeModelingDraft({ ...draft, linkTypes: draft.linkTypes.map((r, j) => j === i ? { ...r, mapping: undefined } : r) }))}>移除连接规则</button>}
    </div>)}
    {error && <p role="alert" className="text-monokai-orange">{error}</p>}
    <button disabled={busy || !draft.objectTypes.some(t => t.mapping)} className="p-2 rounded bg-monokai-cyan text-monokai-bg disabled:opacity-40" onClick={async () => {
      setBusy(true); setError('');
      try {
        const result = await queryModelingInstances(draft, duckDBService.query.bind(duckDBService));
        if (!mounted.current) return;
        if (JSON.stringify(latestDraft.current) !== JSON.stringify(draft)) throw new Error('查询期间草案已变化，请重新预览，保留当前修改。');
        onChange(result);
      }
      catch (e) { if (mounted.current) setError(String(e)); } finally { if (mounted.current) setBusy(false); }
    }}>{busy ? '查询真实数据中…' : '查询并预览真实实例'}</button>
    <p>预览上限：每类 500 个实例、每种关系 2000 条。超过上限会提示筛选，不会静默截断。</p>
  </section>;
}
