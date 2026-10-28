import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { ActionButton, FormSelect } from '../ui/Workbench';
import { duckDBService } from '../../services/duckdbService';
import { buildSliceQuery, discoverSliceTables, executeSqlSlice, suggestSliceIdentity, validateSliceIdentity, listSliceValues, applySliceFilters, type SliceFilter, type SliceResult, type SliceTable, type ProjectionMapping } from '../../services/ontology/sqlGraphProjection';
import './sqlOntologySlice.css';
import type { DatasetDefinition } from '../../services/workbench/analysisTypes';

function SliceSelect({options, ...props}: React.ComponentProps<typeof FormSelect> & {options: {value: string; label: string}[]}) {
  return <FormSelect {...props}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</FormSelect>;
}

function FilterValue({table, filter, index, onChange}: {table?: SliceTable; filter: SliceFilter; index: number; onChange: (value: string) => void}) {
  const id = useId();
  const [values, setValues] = useState<string[]>([]);
  useEffect(() => {
    let current = true; setValues([]);
    if (table && filter.field) void listSliceValues(table, filter.field).then(next => {if(current) setValues(next);}).catch(() => {});
    return () => {current = false;};
  }, [table, filter.field]);
  return <><input aria-label={`筛选值 ${index + 1}`} className="slice-editor" list={id} value={filter.value} placeholder="输入或选择实际字段值" onChange={e=>onChange(e.target.value)}/><datalist id={id}>{values.map(value=><option key={value} value={value}/>)}</datalist></>;
}

export interface SliceProjectionState { result: SliceResult | null; busy: boolean; error: string }

export function SqlOntologySlice({ onClose, onProjectionChange, onRefreshRef, dataset, datasetPending=false, datasetError='' }: {
  onClose: () => void;
  onProjectionChange: (state: SliceProjectionState) => void;
  onRefreshRef?: (refresh: () => void) => void;
  dataset?: DatasetDefinition | null;
  datasetPending?: boolean;
  datasetError?: string;
}) {
  const [tables, setTables] = useState<SliceTable[]>([]);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [key, setKey] = useState('');
  const [foreignKey, setForeignKey] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [sql, setSql] = useState('');
  const [mapping, setMapping] = useState('');
  const [filters, setFilters] = useState<SliceFilter[]>([]);
  const [custom, setCustom] = useState(false);
  const [started, setStarted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keyHint, setKeyHint] = useState('');
  const [result, setResult] = useState<SliceResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingTables, setLoadingTables] = useState(true);
  const [revision, setRevision] = useState(0);
  const [catalog, setCatalog] = useState(duckDBService.getRuntimeInfo().currentDatabase);
  const request = useRef(0);
  const schemaRequest = useRef(0);
  const bindingRequest = useRef(0);
  const datasetTable = React.useMemo<SliceTable|undefined>(()=>dataset?{catalog:dataset.catalog,schema:dataset.schema,name:dataset.table || dataset.name,
    columns:dataset.fields.map(f=>f.name),primaryKey:[],sourceSql:dataset.sql,provenance:dataset.kind==='table'?`${dataset.catalog}.${dataset.schema}.${dataset.table}`:`数据集 ${dataset.name} [${dataset.id}]`}:undefined,[JSON.stringify(dataset)]);
  const sourceTable = datasetTable || tables.find(t => `${t.schema}.${t.name}` === source);
  const targetTable = tables.find(t => `${t.schema}.${t.name}` === target);

  const invalidate = useCallback(() => {
    request.current++; setResult(null); setError(''); setBusy(false);
  }, []);
  useEffect(()=>{
    invalidate();bindingRequest.current++;setStarted(false);setCustom(false);setSql('');setMapping('');setKey('');setTarget('');setForeignKey('');setTargetKey('');setFilters([]);
    if(datasetError){setError(datasetError);return;}
    if(!datasetTable)return;
    const id=bindingRequest.current;setSource('');setCatalog(datasetTable.catalog);setChecking(true);setKeyHint('正在检查当前数据集的对象标识…');
    void suggestSliceIdentity(datasetTable).then(found=>{
      if(id!==bindingRequest.current)return;
      setKey(found);setKeyHint(found?`已绑定当前数据集，${found} 唯一且非空`:'当前数据集缺少可确认的唯一标识，请调整对象标识或使用高级映射。');
      if(found){const next=buildSliceQuery(datasetTable,found);setSql(next.sql);setMapping(JSON.stringify(next.mapping,null,2));setStarted(true);}
    }).catch(e=>{if(id===bindingRequest.current)setError((e as Error).message);}).finally(()=>{if(id===bindingRequest.current)setChecking(false);});
    return()=>{bindingRequest.current++;};
  },[datasetTable,datasetError,invalidate]);
  const loadTables = useCallback(async () => {
    const id = ++schemaRequest.current; setLoadingTables(true);
    try { const loaded = await discoverSliceTables(); if (id === schemaRequest.current) { setTables(loaded); } }
    catch (e) { if (id === schemaRequest.current) { setTables([]); setError(String((e as Error).message)); } }
    finally { if (id === schemaRequest.current) setLoadingTables(false); }
  }, []);

  useEffect(() => {
    void loadTables();
    const databaseChanged = () => {
      invalidate(); setCatalog(duckDBService.getRuntimeInfo().currentDatabase);
      setTables([]); setSource(''); setTarget(''); setKey(''); setForeignKey(''); setTargetKey('');
      bindingRequest.current++; setChecking(false); setKeyHint(''); setFilters([]); setStarted(false); setCustom(false);
      setSql(''); setMapping(''); void loadTables();
    };
    const dataChanged = () => { invalidate(); setRevision(v => v + 1); void loadTables(); };
    window.addEventListener('duckdb-database-changed', databaseChanged);
    window.addEventListener('duckdb-schema-changed', dataChanged);
    return () => {
      request.current++; schemaRequest.current++; bindingRequest.current++;
      window.removeEventListener('duckdb-database-changed', databaseChanged);
      window.removeEventListener('duckdb-schema-changed', dataChanged);
    };
  }, [invalidate, loadTables]);

  // Every condition edit immediately removes the previous projection; only the latest request can publish.
  useEffect(() => {
    invalidate();
    if (datasetPending || datasetError || !sql.trim() || !mapping.trim()) return;
    const id = request.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const bindings = JSON.parse(mapping) as ProjectionMapping;
        if (!custom && sourceTable) {
          await validateSliceIdentity(sourceTable, key);
          if (targetTable) await validateSliceIdentity(targetTable, targetKey);
          if (id !== request.current) return;
        }
        const next = await executeSqlSlice(sql, bindings);
        if (id === request.current) {
          setResult(next);
        }
      } catch (e) { if (id === request.current) setError((e as Error).message); }
      finally { if (id === request.current) setBusy(false); }
    }, 450);
    return () => { clearTimeout(timer); request.current++; };
  }, [sql, mapping, revision, custom, sourceTable, targetTable, key, targetKey, invalidate,datasetPending,datasetError]);

  useEffect(() => { onProjectionChange({result, busy:datasetPending || busy, error:datasetError || error}); }, [result, busy, error, datasetPending, datasetError, onProjectionChange]);
  const recalculate = useCallback(() => { invalidate(); setRevision(v => v + 1); }, [invalidate]);
  useEffect(() => { onRefreshRef?.(recalculate); }, [onRefreshRef, recalculate]);

  const build = async () => {
    invalidate();
    const id = ++bindingRequest.current; setChecking(true);
    try {
      if (!sourceTable) throw new Error('请选择当前数据库中的真实来源表');
      await validateSliceIdentity(sourceTable, key);
      if (targetTable) await validateSliceIdentity(targetTable, targetKey);
      if (id !== bindingRequest.current) return;
      const next = buildSliceQuery(sourceTable, key, targetTable, foreignKey, targetKey);
      setSql(applySliceFilters(next.sql, sourceTable, filters)); setMapping(JSON.stringify(next.mapping, null, 2)); setStarted(true);
    } catch (e) { if (id === bindingRequest.current) setError((e as Error).message); }
    finally { if (id === bindingRequest.current) setChecking(false); }
  };
  useEffect(() => {
    if (!started || custom || !sourceTable) return;
    try {
      const next = buildSliceQuery(sourceTable, key, targetTable, foreignKey, targetKey);
      setSql(applySliceFilters(next.sql, sourceTable, filters)); setMapping(JSON.stringify(next.mapping, null, 2));
    } catch (e) { setSql(''); setError((e as Error).message); }
  }, [filters, started, custom, sourceTable, targetTable, key, foreignKey, targetKey, invalidate]);
  const changeBinding = (fn: () => void) => { bindingRequest.current++; setChecking(false); setStarted(false); invalidate(); setSql(''); setMapping(''); fn(); };
  const chooseSource = async (value: string) => {
    changeBinding(() => { setSource(value); setKey(''); setFilters([]); setTarget(''); setForeignKey(''); setTargetKey(''); setKeyHint('正在检查唯一标识…'); });
    const table = tables.find(t => `${t.schema}.${t.name}` === value), id = bindingRequest.current;
    if (!table) { setKeyHint(''); return; }
    try { const found = await suggestSliceIdentity(table); if (id === bindingRequest.current) { setKey(found); setKeyHint(found ? `已验证 ${found} 在当前表中唯一且非空` : '未找到可确认的单字段标识，请选择字段；复合标识使用高级查询。'); } }
    catch (e) { if (id === bindingRequest.current) setKeyHint((e as Error).message); }
  };
  const chooseTarget = async (value: string) => {
    changeBinding(() => { setTarget(value); setTargetKey(''); setForeignKey(''); });
    const table = tables.find(t => `${t.schema}.${t.name}` === value), id = bindingRequest.current;
    if (!table) return;
    try { const found = await suggestSliceIdentity(table); if (id === bindingRequest.current) { setTargetKey(found); if (sourceTable?.columns.includes(found)) setForeignKey(found); } }
    catch (e) { if (id === bindingRequest.current) setError((e as Error).message); }
  };
  const updateFilter = (index: number, patch: Partial<SliceFilter>) => { invalidate(); setFilters(items => items.map((item, i) => i === index ? {...item, ...patch} : item)); };
  const options = tables.map(t => ({ value: `${t.schema}.${t.name}`, label: `${t.schema}.${t.name}` }));
  const fieldOptions = (fields: string[] = []) => fields.map(c => ({ value: c, label: c }));
  return <section aria-label="数据切片筛选" className="sql-ontology-slice p-3 space-y-3 text-xs text-monokai-fg">
    <div className="flex items-center justify-between"><strong>数据切片</strong><ActionButton size="sm" variant="secondary" onClick={onClose}>收起筛选</ActionButton></div>
    <p className="text-monokai-comment">当前数据库：{catalog} · 查询结果直接显示在主图谱</p>
          <p className="text-monokai-comment">{dataset ? '已接入当前数据集，可继续缩小范围或关联其他对象。' : '先选择想查看的对象，再按业务条件缩小范围。无需编写 SQL。'}</p>
          <fieldset disabled={custom || datasetPending || !!datasetError} className="space-y-3 min-w-0">
          {dataset ? <div className="space-y-1"><strong>当前数据集：{dataset.name}</strong><p className="text-monokai-comment">跟随工作区数据集及已应用条件；在首页、数据或 SQL 中切换来源。</p></div> : <label className="block space-y-1"><span className="font-medium">1 · 查看什么对象</span><SliceSelect aria-label="切片来源表" value={source} disabled={loadingTables || datasetPending || !!datasetError} options={[{ value: '', label: datasetPending ? '同步当前数据集…' : loadingTables ? '读取数据结构…' : '选择数据表' }, ...options]} onChange={e => void chooseSource(e.target.value)} /></label>}
          {sourceTable && <><p className="text-monokai-comment" role="status">{keyHint}</p>
          <details><summary className="cursor-pointer text-monokai-cyan">对象标识：{key || '待选择'} · 调整</summary>
            <label className="block space-y-1 mt-2"><span>唯一且非空的字段</span><SliceSelect aria-label="切片对象标识" value={key} options={[{ value: '', label: '选择唯一字段' }, ...fieldOptions(sourceTable.columns)]} onChange={e => changeBinding(() => {setKey(e.target.value); setKeyHint('将在查看图谱前检查此字段的唯一性');})} /></label>
          </details></>}
          <div className="space-y-2"><span className="font-medium">2 · 限定数据范围</span>
            {!filters.length && <p className="text-monokai-comment">{dataset ? '已继承数据集查询及已应用筛选。可追加条件，需同时满足。' : '当前查看全部记录，最多 1,000 行。可添加多个条件，需同时满足。'}</p>}
            {filters.map((filter, index) => <div key={index} className="slice-filter space-y-2">
              <div className="flex gap-2"><SliceSelect aria-label={`筛选字段 ${index + 1}`} value={filter.field} options={[{value:'',label:'选择字段'},...fieldOptions(sourceTable?.columns)]} onChange={e => updateFilter(index,{field:e.target.value})}/><button type="button" className="slice-chip shrink-0" aria-label={`移除筛选 ${index + 1}`} onClick={() => {invalidate();setFilters(items => items.filter((_,i)=>i!==index));}}>移除</button></div>
              <SliceSelect aria-label={`筛选方式 ${index + 1}`} value={filter.operator} options={[{value:'eq',label:'等于（文本匹配）'},{value:'neq',label:'不等于（文本匹配）'},{value:'contains',label:'包含文本'},{value:'null',label:'为空值'},{value:'notnull',label:'不为空值'}]} onChange={e => updateFilter(index,{operator:e.target.value as SliceFilter['operator']})}/>
              {!['null','notnull'].includes(filter.operator) && <FilterValue table={sourceTable} filter={filter} index={index} onChange={value=>updateFilter(index,{value})}/>}
            </div>)}
            <ActionButton size="sm" variant="secondary" disabled={!sourceTable} onClick={()=>{invalidate();setFilters(items=>[...items,{field:'',operator:'eq',value:''}]);}}>添加筛选</ActionButton>
          </div>
          <details open={target ? true : undefined}><summary className="cursor-pointer text-monokai-cyan">关联其他对象（可选）{targetTable ? ` · ${targetTable.name}` : ''}</summary>
          <label className="block space-y-1 mt-2"><span>关联对象表</span><SliceSelect aria-label="切片关联表" value={target} options={[{ value: '', label: '仅查看来源对象' }, ...options]} onChange={e => void chooseTarget(e.target.value)} /></label>
          {targetTable && <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span>来源关联字段</span><SliceSelect aria-label="切片来源关联字段" value={foreignKey} options={[{ value: '', label: '选择字段' }, ...fieldOptions(sourceTable?.columns)]} onChange={e => changeBinding(() => setForeignKey(e.target.value))} /></label>
            <label className="space-y-1"><span>关联对象标识</span><SliceSelect aria-label="切片关联标识" value={targetKey} options={[{ value: '', label: '选择字段' }, ...fieldOptions(targetTable.columns)]} onChange={e => changeBinding(() => setTargetKey(e.target.value))} /></label>
          </div>}
          {targetTable && <p className="mt-2 text-monokai-comment">{foreignKey && targetKey ? `${sourceTable?.name}.${foreignKey} → ${targetTable.name}.${targetKey}` : '选择两端关联字段'}。同名字段仅为候选；点击查看即按此关联查询，请确认业务含义。</p>}
          </details>
          <ActionButton icon={Play} onClick={() => void build()} disabled={checking || !sourceTable || !key || filters.some(f=>!f.field) || (!!targetTable && (!foreignKey || !targetKey))}>{checking ? '检查对象标识…' : '查看图谱'}</ActionButton>
          {started && <p className="text-monokai-comment">筛选变化后自动更新；切换对象或关联后请重新查看。</p>}
          </fieldset>
          <details><summary className="cursor-pointer text-monokai-cyan">高级查询 · SQL 与对象映射</summary>
            <p className="my-2 text-monokai-comment">复杂关联、复合标识可使用手动查询。手动模式保留输入，不受上方筛选覆盖。</p>
            <ActionButton size="sm" variant="secondary" onClick={()=>{bindingRequest.current++;setChecking(false);invalidate();setCustom(!custom);if(custom){setStarted(false);setSql('');setMapping('');}}}>{custom ? '返回筛选模式（清除手动查询）' : '切换为手动查询'}</ActionButton>
            <label className="block space-y-1 mt-2"><span>{custom ? '只读 SQL · 自动执行' : '生成的 SQL · 只读预览'}</span><textarea aria-label="切片 SQL" readOnly={!custom} className="slice-editor h-52" value={sql} spellCheck={false} onChange={e => { invalidate(); setSql(e.target.value); }} placeholder="先选择对象并查看图谱，或切换为手动查询" /></label>
            <label className="block space-y-1 mt-2"><span>对象与关系映射</span><textarea aria-label="切片映射" readOnly={!custom} className="slice-editor h-60" value={mapping} spellCheck={false} onChange={e => { invalidate(); setMapping(e.target.value); }} /></label>
            <p className="my-2 text-monokai-comment">nodes：type、table、key（来源键 → 查询别名）、label、properties；edges：type、source、target、key、properties。空关联不会生成虚构节点。</p>
          </details>
    <p role="status">{busy ? '正在计算切片…' : result ? `${result.rows.length} 行 → ${result.graph.nodes.length} 个对象 · ${result.graph.links.length} 条关系` : '选择对象并查看主图谱'}</p>
    {(datasetError || error) && <p role="alert" className="rounded-md border border-monokai-pink/30 bg-monokai-pink/10 p-3 text-monokai-pink break-words">{datasetError || error}</p>}
    {result && !result.rows.length && <p>当前查询没有匹配记录，图谱为空。</p>}
    {result && result.skipped > 0 && <p className="text-monokai-comment">{result.skipped} 项空标识或缺失端点已跳过；请核对未匹配记录。</p>}
    <ActionButton size="sm" variant="secondary" onClick={recalculate} disabled={!sql || busy}>重新计算</ActionButton>
  </section>;
}
