import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeftRight, Plus, Trash2, Save, Download, BarChart3, Table2, SlidersHorizontal, ArrowUp, ArrowDown, FolderOpen, Link2, Unlink, AlertTriangle, Sparkles, Undo2, Redo2} from 'lucide-react';
import {PivotExtractMetricModal} from './PivotExtractMetricModal';
import type {ColumnInfo} from '../../types';
import {useCurrentAnalysisDataset} from '../../hooks/useCurrentAnalysisDataset';
import {useAnalysisWorkspace} from '../../hooks/store/useAnalysisWorkspace';
import {useAppStore} from '../../hooks/store/useAppStore';
import {useWorkbenchRevision} from '../../services/workbench/runtime';
import {duckDBService} from '../../services/duckdbService';
import {runAnalysis} from '../../services/analysis/pipeline';
import type {AnalysisResult, DateTruncGrain, AnalysisAgg,ChartSpec} from '../../services/analysis/types';
import type {AnalysisRecord} from '../../services/analysisObjects';
import {classifySemanticType} from '../../services/analysis/semantic';
import {defaultPivot, loadPivotRecord, listPivotRecords, deletePivotRecord, buildJoinedSource, pivotDefinitionKey, pivotQueryKey, pivotNumericType, pivotDetailSql, pivotDrafts, pivotSourceKey, pivotToSpec, PIVOT_DEFAULT_METRIC, savePivotRecord, validatePivotSource, type PivotDefinition, type PivotJoinConfig, type PivotDimension} from '../../services/analysis/pivotExperience';
import {mapResultToChartSpec,chartSpecToChartConfig} from '../../services/analysis/chartRegistry';
import {compileAnalysisSql} from '../../services/analysis/sqlCompiler';
import {quoteIdent,literalValue} from '../../services/analysis/sqlUtils';
import {getOrCreateHomeDashboard, addObjectToDashboard} from '../../services/homeDashboardService';
import {toastService} from '../../services/toastService';
import {DrawerShell, ModalShell, ActionButton} from '../ui/Workbench';
import {PivotTableView} from '../charts/PivotTableView';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';
import {AH, AnalysisEmptyHint, AnalysisErrorState, AnalysisLoadingState, AnalysisResultTable, AnalysisSqlBar} from './analysisUi';

export interface PivotEntryProps {
  currentTable:string; schema:ColumnInfo[]; fieldCatalog?:unknown; initialDimension?:string;
  onInsertSql?:(sql:string, executeDirectly?:boolean)=>void;
}

export function PivotExperienceEntry({currentTable,initialDimension,onInsertSql}:PivotEntryProps) {
  const request=useAnalysisWorkspace(s=>s.pivotRequest);
  const database=useAppStore(s=>s.currentDatabase);
  const [reload,setReload]=useState(0);
  const inherited=useCurrentAnalysisDataset(reload,!request?.analysisId);
  const pending=!request?.analysisId && inherited.pending;
  const [loaded,setLoaded]=useState<{token:string;definition?:PivotDefinition;analysisId?:string;savedAt?:number;error?:string}>();
  const token=JSON.stringify(request?.analysisId?[request.key,database,reload]:[request?.key,database,currentTable,inherited.source,inherited.dataset?.sql,inherited.dataset?.fields,reload]);
  useEffect(()=>{
    let live=true;
    if(pending)return;
    void(async()=>{
      try {
        let definition:PivotDefinition,analysisId:string|undefined,savedAt:number|undefined;
        if(request?.analysisId){const record=await loadPivotRecord(request.analysisId);definition=record.pivot!;analysisId=record.id;savedAt=record.savedAt;}
        else {
          if(inherited.error)throw new Error(inherited.error);
          let source=inherited.dataset;
          if(!source && currentTable){
            const scope=await duckDBService.getCurrentCatalogAndSchema();
            source=await validatePivotSource({id:`table:${JSON.stringify([scope.catalog,scope.schema,currentTable])}`,name:currentTable,
              catalog:scope.catalog,schema:scope.schema,table:currentTable,kind:'table',version:1,
              sql:`SELECT * FROM ${[scope.catalog,scope.schema,currentTable].map(quoteIdent).join('.')}`,fields:[]});
          }
          if(!source)throw new Error('请选择数据表，或从成功执行的 SQL 结果进入透视分析');
          definition=defaultPivot(source,initialDimension);
        }
        if(live)setLoaded({token,definition,analysisId,savedAt});
      }catch(error){if(live)setLoaded({token,error:String((error as Error).message)});}
    })();
    return()=>{live=false;};
  },[token,pending]);
  if(loaded?.token!==token)return <AnalysisLoadingState message="正在确认透视来源与配置…"/>;
  if(loaded.error)return <AnalysisErrorState title="无法打开透视来源" message={loaded.error} onRetry={()=>setReload(value=>value+1)}/>;
  return <PivotEditor key={`${pivotSourceKey(loaded.definition!.source)}:${loaded.analysisId || 'draft'}`} initial={loaded.definition!} initialId={loaded.analysisId} initialSavedAt={loaded.savedAt} onInsertSql={onInsertSql}/>;
}

const AGGS:{value:AnalysisAgg;label:string}[]=[{value:'count',label:'计数'},{value:'count_distinct',label:'去重计数'},{value:'sum',label:'求和'},{value:'avg',label:'平均值'},{value:'min',label:'最小值'},{value:'max',label:'最大值'},{value:'median',label:'中位数'}];
const GRAINS:{value:DateTruncGrain;label:string}[]=[{value:'day',label:'日'},{value:'week',label:'周'},{value:'month',label:'月'},{value:'quarter',label:'季度'},{value:'year',label:'年'}];

export function PivotEditor({initial,initialId,initialSavedAt,onInsertSql}:{initial:PivotDefinition;initialId?:string;initialSavedAt?:number;onInsertSql?:PivotEntryProps['onInsertSql']}) {
  const draftKey=`${pivotSourceKey(initial.source)}:${initialId || 'draft'}`;
  const cached=pivotDrafts.get(draftKey);
  const draft=!initialId || cached?.savedKey===pivotDefinitionKey(initial)?cached:undefined;
  const [definition,setDefinition]=useState<PivotDefinition>(()=>draft?{...draft.definition,source:initial.source}:initial);
  const [manualApply,setManualApply]=useState(false);
  const [appliedDefinition,setAppliedDefinition]=useState(definition);
  const [analysisId,setAnalysisId]=useState(draft?.analysisId || initialId);
  const [savedAt,setSavedAt]=useState(draft?.savedAt ?? initialSavedAt);
  const savedRecord=useRef<AnalysisRecord | undefined>(undefined);
  const [savedKey,setSavedKey]=useState<string|undefined>(draft?.savedKey || (initialId?pivotDefinitionKey(initial):undefined));
  const [savedDefinition,setSavedDefinition]=useState<PivotDefinition>(()=>draft?.savedKey?JSON.parse(draft.savedKey):initial);
  const [result,setResult]=useState<{key:string;value:AnalysisResult}>();
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [configOpen,setConfigOpen]=useState(()=>typeof window==='undefined' || window.innerWidth>=768);
  const [fieldSearch,setFieldSearch]=useState('');
  const [copied,setCopied]=useState(false);
  const [publishError,setPublishError]=useState('');
  const [showSql,setShowSql]=useState(false);
  const [retry,setRetry]=useState(0);
  const [detail,setDetail]=useState<{row:unknown;column:unknown;page:number;spec:AnalysisResult['spec']} | null>(null);
  const [detailRows,setDetailRows]=useState<Record<string,unknown>[]>([]);
  const [detailError,setDetailError]=useState('');
  const [detailBusy,setDetailBusy]=useState(false);
  const [detailRetry,setDetailRetry]=useState(0);
  const [units,setUnits]=useState<string[]>([]);
  const [unitSearch,setUnitSearch]=useState(definition.unit);
  const [unitError,setUnitError]=useState('');
  const [unitRetry,setUnitRetry]=useState(0);
  const [unitLoading,setUnitLoading]=useState(false);
  const serial=useRef(0);
  const tables=useAppStore(s=>s.tables);
  const [managerOpen,setManagerOpen]=useState(false);
  const [extractMetricOpen,setExtractMetricOpen]=useState(false);
  const [savedList,setSavedList]=useState<AnalysisRecord[]>([]);
  const [joinModalOpen,setJoinModalOpen]=useState(false);
  const [secondaryTable,setSecondaryTable]=useState('');
  const [joinType,setJoinType]=useState<'LEFT'|'INNER'>('LEFT');
  const [primaryKey,setPrimaryKey]=useState('');
  const [secondaryKey,setSecondaryKey]=useState('');
  const [secondaryCols,setSecondaryCols]=useState<string[]>([]);
  const [joining,setJoining]=useState(false);
  const [joinRisk,setJoinRisk]=useState(false);
  const key=pivotDefinitionKey(definition);
  const dirty=key!==savedKey;
  const currentDatabase=useAppStore(s=>s.currentDatabase);
  const refresh=useAppStore(s=>s.dashboardRefreshTrigger);
  const revision=useWorkbenchRevision();
  const queryKey=pivotQueryKey(definition);
  const queryDefinition=manualApply?appliedDefinition:definition;
  const executionKey=pivotQueryKey(queryDefinition);
  const unapplied=manualApply && queryKey!==executionKey;
  const requestKey=JSON.stringify([executionKey,currentDatabase,refresh,retry,revision]);
  const ready=!!result && result.key===requestKey && !error && !unapplied;
  const scopeValid=currentDatabase===definition.source.catalog;
  const fields=definition.source.fields;
  const unitColumn=fields.find(f=>/^(currency|asset)$/i.test(f.name))?.name;
  const spec=useMemo(()=>{try{return pivotToSpec(definition);}catch{return null;}},[key]);
  const chart=useMemo(()=>{
    if(!result || definition.view==='table')return undefined;
    const presentation=ready && spec ? spec : result.value.spec;
    return mapResultToChartSpec(result.value.rows,result.value.columns,presentation,compileAnalysisSql(presentation));
  },[result,spec,ready,definition.view]);
  const retainedTable=useRef<ChartSpec | undefined>(undefined);
  const tableChart=useMemo(()=>{
    if(!result)return undefined;
    if(!ready && retainedTable.current)return retainedTable.current;
    const presentation=ready?{...definition,view:'table' as const}:undefined;
    const tableSpec=presentation?pivotToSpec(presentation):{...result.value.spec,visual:{...result.value.spec.visual,chartType:'table' as const,pivot:{rowKey:result.value.spec.dimensions[0].alias!,colKey:result.value.spec.dimensions[1]?.alias || '',valKey:result.value.spec.metrics[0].alias,aggregation:'sum' as const}}};
    const table=mapResultToChartSpec(result.value.rows,result.value.columns,tableSpec,compileAnalysisSql(tableSpec));
    if(ready)retainedTable.current=table;
    return table;
  },[result,definition.visibleMetric,definition.nullDisplay,definition.decimals,JSON.stringify(definition.metrics.map(metric=>metric.decimals)),ready]);
  // Configuration history: every user edit is undoable (Ctrl/⌘+Z), including destructive ones such as swapping rows/columns.
  const definitionRef=useRef(definition);definitionRef.current=definition;
  const history=useRef<{past:PivotDefinition[];future:PivotDefinition[];lastKey:string;lastAt:number}>({past:[],future:[],lastKey:'',lastAt:0});
  const [historySize,setHistorySize]=useState({past:0,future:0});
  const syncHistory=()=>setHistorySize({past:history.current.past.length,future:history.current.future.length});
  const commit=(next:PivotDefinition,coalesce?:string)=>{
    const h=history.current,now=Date.now(),previous=definitionRef.current;
    if(!(coalesce && coalesce===h.lastKey && now-h.lastAt<1000)){h.past.push(previous);if(h.past.length>100)h.past.shift();}
    h.lastKey=coalesce||'';h.lastAt=now;h.future=[];
    definitionRef.current=next;setError('');setDefinition(next);syncHistory();
  };
  const update=(patch:Partial<PivotDefinition>,coalesce?:string)=>commit({...definitionRef.current,...patch},coalesce);
  const undo=()=>{const h=history.current,previous=h.past.pop();if(!previous)return;h.future.push(definitionRef.current);h.lastKey='';definitionRef.current=previous;setError('');setDefinition(previous);syncHistory();};
  const redo=()=>{const h=history.current,next=h.future.pop();if(!next)return;h.past.push(definitionRef.current);h.lastKey='';definitionRef.current=next;setError('');setDefinition(next);syncHistory();};
  const onHistoryKey=(event:React.KeyboardEvent)=>{
    if(!(event.ctrlKey||event.metaKey) || event.altKey)return;
    const target=event.target as HTMLElement,tag=target.tagName,type=(target as HTMLInputElement).type;
    if(tag==='TEXTAREA' || target.isContentEditable || (tag==='INPUT' && !['checkbox','radio','button'].includes(type)))return; // keep native text undo
    const key=event.key.toLowerCase();
    if(key==='z' && !event.shiftKey){event.preventDefault();undo();}
    else if((key==='z' && event.shiftKey) || key==='y'){event.preventDefault();redo();}
  };

  useEffect(()=>{
    void listPivotRecords().then(setSavedList).catch(()=>setSavedList([]));
  },[savedAt,currentDatabase,refresh]);

  useEffect(()=>{
    pivotDrafts.set(draftKey,{definition,analysisId,savedKey,savedAt});
    // The saved identity and the initial draft both restore the same session edits.
    if(analysisId)pivotDrafts.set(`${pivotSourceKey(initial.source)}:${analysisId}`,{definition,analysisId,savedKey,savedAt});
    while(pivotDrafts.size>40)pivotDrafts.delete(pivotDrafts.keys().next().value!);
  },[key,analysisId,savedKey,draftKey,savedAt]);
  useEffect(()=>{
    if(!dirty)return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[dirty]);
  useEffect(()=>{
    let live=true;setUnits([]);setUnitError('');setUnitLoading(!!unitColumn);
    const timer=setTimeout(()=>{if(unitColumn)void duckDBService.readQuery(`SELECT DISTINCT ${quoteIdent(unitColumn)} AS unit FROM (\n${definition.source.sql}\n) AS units WHERE ${quoteIdent(unitColumn)} IS NOT NULL AND CAST(${quoteIdent(unitColumn)} AS VARCHAR) ILIKE ${literalValue(`%${unitSearch}%`)} ORDER BY 1 LIMIT 200`).then(rows=>{
      if(live)setUnits(rows.map(row=>String(row.unit)));
    }).catch(failure=>{if(live)setUnitError(String((failure as Error).message));}).finally(()=>{if(live)setUnitLoading(false);});},250);
    return()=>{live=false;clearTimeout(timer);};
  },[definition.source.sql,unitColumn,refresh,unitSearch,unitRetry]);
  useEffect(()=>{
    const request=++serial.current;
    setError('');setDetail(null);
    const timer=setTimeout(()=>{
      void(async()=>{
        try {
          const source=await validatePivotSource(queryDefinition.source);
          if(request!==serial.current)return;
          if(JSON.stringify(source.fields)!==JSON.stringify(definition.source.fields))setDefinition(previous=>({...previous,source}));
          const compiled=pivotToSpec({...queryDefinition,source});
          const value=await runAnalysis(compiled,{isCurrent:()=>request===serial.current});
          if(request===serial.current)setResult({key:requestKey,value});
        }catch(failure){if(request===serial.current)setError(String((failure as Error).message));}
      })();
    },250);
    return()=>{clearTimeout(timer);serial.current++;};
  },[requestKey]);
  useEffect(()=>{
    let live=true;setDetailRows([]);setDetailError('');setDetailBusy(!!detail);
    if(detail)void(async()=>{
      try {
        await validatePivotSource(definition.source);
        const rows=await duckDBService.readQuery(pivotDetailSql(detail.spec,detail.row,detail.column,detail.page));
        const scope=await duckDBService.getCurrentCatalogAndSchema();
        if(scope.catalog!==definition.source.catalog || scope.schema!==definition.source.schema)throw new Error('数据范围已切换，请重新打开明细');
        if(live)setDetailRows(rows);
      }catch(failure){if(live)setDetailError(String((failure as Error).message));}
      finally{if(live)setDetailBusy(false);}
    })();
    return()=>{live=false;};
  },[detail,detailRetry]);

  const publish=async(record:AnalysisRecord)=>{
    const scope=await duckDBService.getCurrentCatalogAndSchema();
    if(scope.catalog!==record.databaseName || (record.schemaName && scope.schema!==record.schemaName))throw new Error('分析范围已切换，请返回原范围后重试');
    const board=await getOrCreateHomeDashboard();
    if(board.databaseName!==record.databaseName)throw new Error('首页所属数据库已切换，请返回原数据库后重试');
    if(!board.items.some(item=>item.savedQueryId===`analysis-ref:analysis:${record.id}`))await addObjectToDashboard({kind:'analysis',id:record.id,name:record.title,chartConfig:record.chartConfig},board);
  };
  const retryPublish=async()=>{
    if(!savedRecord.current || saving || !scopeValid)return;
    setSaving(true);
    try{await publish(savedRecord.current);setPublishError('');toastService.success('已加入当前首页视图');}
    catch(failure){setPublishError(`分析已保存，加入首页失败：${String((failure as Error).message)}`);}
    finally{setSaving(false);}
  };
  const save=async(copy=false,addHome=false)=>{
    if(!ready || saving || !scopeValid)return;
    setSaving(true);
    try {
      const currentChart=chart || tableChart;
      const record=await savePivotRecord(definition,result!.value.sql,currentChart?chartSpecToChartConfig({...currentChart,title:definition.title}):result!.value.chartConfig,copy?undefined:analysisId,copy?undefined:savedAt);
      setSavedAt(record.savedAt);setPublishError('');
      savedRecord.current=record;
      setAnalysisId(record.id);setSavedKey(key);setSavedDefinition(structuredClone(definition));
      if(addHome){
        try{await publish(record);
        }catch(failure){setPublishError(`分析已保存，加入首页失败：${String((failure as Error).message)}`);return;}
      }
      toastService.success(addHome?'已保存并加入当前首页视图':'透视配置已保存，可继续编辑');
    }catch(failure){toastService.error(String((failure as Error).message));}
    finally{setSaving(false);}
  };
  const exportCsv=()=>{
    if(!ready)return;
    const columns=result!.value.columns.filter(column=>!column.startsWith('__pivot_'));
    const escaped=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;
    const csv=[columns.map(escaped).join(','),...result!.value.rows.map(row=>columns.map(column=>escaped(row[column])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='透视结果.csv';link.click();URL.revokeObjectURL(url);
  };
  const rowDims: PivotDimension[] = definition.rows && definition.rows.length > 1
    ? definition.rows
    : (definition.row ? [definition.row] : (definition.rows && definition.rows.length ? definition.rows : []));
  const updateRows = (nextRows: PivotDimension[]) => {
    if (nextRows.length <= 1) {
      update({ rows: nextRows, row: nextRows[0] });
    } else {
      update({ rows: nextRows, row: nextRows[0] });
    }
  };

  const onSelectSecondaryTable = async (tbl: string) => {
    setSecondaryTable(tbl);
    if (!tbl) { setSecondaryCols([]); setSecondaryKey(''); return; }
    try {
      const scope = await duckDBService.getCurrentCatalogAndSchema();
      const q = [scope.catalog, scope.schema, tbl].map(quoteIdent).join('.');
      const cols = await duckDBService.readQuery(`DESCRIBE ${q}`);
      const colNames = cols.map(c => String(c.column_name));
      setSecondaryCols(colNames);
      const match = colNames.find(c => fields.some(f => f.name.toLowerCase() === c.toLowerCase() || (c.toLowerCase() === 'id' && f.name.toLowerCase().endsWith('_id')) || (f.name.toLowerCase() === 'id' && c.toLowerCase().endsWith('_id'))));
      if (match) {
        setSecondaryKey(match);
        const pMatch = fields.find(f => f.name.toLowerCase() === match.toLowerCase()) || fields.find(f => f.name.toLowerCase().endsWith('_id')) || fields[0];
        if (pMatch) setPrimaryKey(pMatch.name);
      } else if (colNames.length) {
        setSecondaryKey(colNames[0]);
      }
    } catch {
      setSecondaryCols([]);
    }
  };

  const handleApplyJoin = async () => {
    if (!secondaryTable || !primaryKey || !secondaryKey) return;
    setJoining(true);
    try {
      const basePrimary = definition.source.table || definition.source.name;
      const { source, fanOutRisk } = await buildJoinedSource(basePrimary, secondaryTable, joinType, primaryKey, secondaryKey);
      setJoinRisk(fanOutRisk);
      const jc: PivotJoinConfig = { enabled: true, secondaryTable, joinType, primaryKey, secondaryKey, fanOutRisk };
      update({ source, joinConfig: jc, title: `${basePrimary} ⋈ ${secondaryTable} · 透视表` });
      setJoinModalOpen(false);
      toastService.success(fanOutRisk ? '双表已关联（检测到从表关联键非唯一，存在统计膨胀风险）' : '双表关联成功，两表字段已合入目录');
    } catch (err) {
      toastService.error(`双表关联失败: ${String((err as Error).message)}`);
    } finally {
      setJoining(false);
    }
  };

  const handleRemoveJoin = async () => {
    try {
      const basePrimary = definition.source.table || definition.source.name.split(' ⋈ ')[0];
      const scope = await duckDBService.getCurrentCatalogAndSchema();
      const source = await validatePivotSource({
        id: `table:${JSON.stringify([scope.catalog,scope.schema,basePrimary])}`,
        name: basePrimary,
        catalog: scope.catalog,
        schema: scope.schema,
        table: basePrimary,
        kind: 'table',
        version: 1,
        sql: `SELECT * FROM ${[scope.catalog,scope.schema,basePrimary].map(quoteIdent).join('.')}`,
        fields: []
      });
      setJoinRisk(false);
      update({ source, joinConfig: undefined, title: `${basePrimary} · 透视表` });
      toastService.success('已解除双表关联，恢复为主表独立分析');
    } catch (err) {
      toastService.error(`解除关联失败: ${String((err as Error).message)}`);
    }
  };

  const rowDimensionsControl = () => (
    <section className={`${AH.cardMuted} p-3 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="font-semibold text-monokai-fg" htmlFor="pivot-row">行</label>
          <span className="text-2xs text-monokai-comment">纵向分组</span>
          {rowDims.length > 1 && <span className="text-2xs text-monokai-comment">({rowDims.length} 层级)</span>}
        </div>
        <button
          type="button"
          className={`${AH.btnGhost} text-2xs py-0.5 px-1.5 disabled:opacity-40`}
          disabled={!fields.some(f => !rowDims.some(r => r.column === f.name) && f.name !== definition.column?.column)}
          title={fields.some(f => !rowDims.some(r => r.column === f.name) && f.name !== definition.column?.column) ? "再添加一个行字段，形成分组层级" : "没有可添加的字段：其余字段已用于行或列"}
          onClick={() => {
            const avail = fields.find(f => !rowDims.some(r => r.column === f.name) && f.name !== definition.column?.column);
            if (avail) {
              const isTime = classifySemanticType(avail.name, avail.type) === 'temporal';
              updateRows([...rowDims, { column: avail.name, ...(isTime ? { dateTrunc: 'month' } : {}) }]);
            }
          }}
        >
          <Plus size={12}/> 添加行维度
        </button>
      </div>
      <div className="space-y-2">
        {rowDims.length === 0 && (
          <div className="border border-dashed border-monokai-border/60 rounded p-2 bg-monokai-bg/40 space-y-1.5">
            <select
              id="pivot-row"
              className={`${AH.select} w-full min-w-0 text-xs`}
              value=""
              onChange={event => {
                const field = fields.find(f => f.name === event.target.value);
                if (!field) return;
                updateRows([{ column: field.name, ...(classifySemanticType(field.name, field.type) === 'temporal' ? { dateTrunc: 'month' as const } : {}) }]);
              }}
            >
              <option value="">不设置行分组（汇总为一行）</option>
              {fields.map(f => (
                <option key={f.name} value={f.name} disabled={f.name === definition.column?.column}>{f.name}</option>
              ))}
            </select>
            <p className="text-2xs text-monokai-comment">行为空时，所有记录合并为「全部」一行；可从字段目录或此处添加行字段。</p>
          </div>
        )}
        {rowDims.map((dim, idx) => {
          const isTime = fields.find(f => f.name === dim.column && classifySemanticType(f.name, f.type) === 'temporal');
          return (
            <div key={idx} className="border border-monokai-border/60 rounded p-2 bg-monokai-bg/40 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-mono text-monokai-comment w-4">{idx + 1}.</span>
                <select
                  id={idx === 0 ? "pivot-row" : undefined}
                  aria-label={idx === 0 ? undefined : `行维度 ${idx + 1}`}
                  className={`${AH.select} flex-1 min-w-0 text-xs`}
                  value={dim.column}
                  onChange={event => {
                    const field = fields.find(f => f.name === event.target.value);
                    const isT = field && classifySemanticType(field.name, field.type) === 'temporal';
                    const next = [...rowDims];
                    next[idx] = { column: event.target.value, ...(isT ? { dateTrunc: 'month' } : {}) };
                    updateRows(next);
                  }}
                >
                  {fields.map(f => (
                    <option key={f.name} value={f.name} disabled={f.name !== dim.column && (rowDims.some(r => r.column === f.name) || f.name === definition.column?.column)}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="上移"
                  disabled={idx === 0}
                  className="p-1 hover:text-monokai-fg disabled:opacity-30"
                  onClick={() => {
                    const next = [...rowDims];
                    const tmp = next[idx - 1]; next[idx - 1] = next[idx]; next[idx] = tmp;
                    updateRows(next);
                  }}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  title="下移"
                  disabled={idx === rowDims.length - 1}
                  className="p-1 hover:text-monokai-fg disabled:opacity-30"
                  onClick={() => {
                    const next = [...rowDims];
                    const tmp = next[idx + 1]; next[idx + 1] = next[idx]; next[idx] = tmp;
                    updateRows(next);
                  }}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  title="移除此行维度"
                  aria-label={`移除行维度 ${idx + 1}`}
                  className={AH.dangerIconBtn}
                  onClick={() => updateRows(rowDims.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {isTime && (
                <label className="flex items-center gap-2 text-2xs text-monokai-comment pl-5">
                  粒度
                  <select
                    aria-label={`行维度 ${idx + 1} 日期粒度`}
                    className={`${AH.select} flex-1 text-2xs py-0.5`}
                    value={dim.dateTrunc || ''}
                    onChange={event => {
                      const next = [...rowDims];
                      next[idx] = { ...dim, dateTrunc: (event.target.value as any) || undefined };
                      updateRows(next);
                    }}
                  >
                    <option value="">原始值</option>
                    {GRAINS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const columnControl = () => {
    const dim = definition.column;
    const isTime = fields.find(f => f.name === dim?.column && classifySemanticType(f.name, f.type) === 'temporal');
    return (
      <section className={`${AH.cardMuted} p-3 space-y-2`}>
        <div className="flex items-center justify-between">
          <label className="font-semibold text-monokai-fg" htmlFor="pivot-column">列</label>
          <span className="text-2xs text-monokai-comment">横向对比 (可选)</span>
        </div>
        <select
          id="pivot-column"
          className={`${AH.select} w-full`}
          value={dim?.column || ''}
          onChange={event => {
            const field = fields.find(f => f.name === event.target.value);
            update({
              column: event.target.value ? {
                column: event.target.value,
                ...(field && classifySemanticType(field.name, field.type) === 'temporal' ? { dateTrunc: 'month' } : {})
              } : undefined
            });
          }}
        >
          <option value="">不设置列分组</option>
          {fields.map(field => (
            <option key={field.name} value={field.name} disabled={rowDims.some(r => r.column === field.name)}>
              {field.name}
            </option>
          ))}
        </select>
        {isTime && (
          <label className="flex items-center gap-2">
            日期粒度
            <select
              aria-label="列日期粒度"
              className={`${AH.select} flex-1`}
              value={dim?.dateTrunc || ''}
              onChange={event => update({ column: { ...dim, dateTrunc: (event.target.value as any) || undefined } })}
            >
              <option value="">原始值</option>
              {GRAINS.map(grain => <option key={grain.value} value={grain.value}>{grain.label}</option>)}
            </select>
          </label>
        )}
      </section>
    );
  };

  return <div className="pivot-workspace flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-sm" data-testid="pivot-editor" onKeyDown={onHistoryKey}>
    <div className="shrink-0 border-b border-monokai-border bg-monokai-surface p-3 space-y-2">
      <div className="pivot-toolbar flex flex-wrap items-center gap-2"><label className="min-w-[12rem] flex-1 basis-full sm:basis-0"><span className="sr-only">分析名称</span><input aria-label="分析名称" className={`${AH.input} w-full min-w-0`} value={definition.title} onChange={event=>update({title:event.target.value},'title')}/></label>
        <ActionButton size="sm" icon={Save} disabled={!ready || saving || !scopeValid} onClick={()=>void save()}>保存分析</ActionButton>
        <div role="group" aria-label="配置历史" className="flex items-center gap-1"><button type="button" className={AH.btnGhost} disabled={!historySize.past} onClick={undo} title="撤销上一步配置修改 (Ctrl+Z)" aria-label="撤销配置修改"><Undo2 size={14}/>撤销</button><button type="button" className={AH.btnGhost} disabled={!historySize.future} onClick={redo} title="重做 (Ctrl+Shift+Z)" aria-label="重做配置修改"><Redo2 size={14}/>重做</button></div><ActionButton size="sm" variant="ghost" icon={FolderOpen} onClick={()=>setManagerOpen(true)}>透视模板 ({savedList.length})</ActionButton>
        <ActionButton size="sm" variant="secondary" icon={Sparkles} disabled={!ready} onClick={()=>setExtractMetricOpen(true)}>提取为指标</ActionButton>
        <ActionButton size="sm" variant="secondary" disabled={!ready || saving || !scopeValid} onClick={()=>void save(false,true)}>保存并加入首页</ActionButton>
        {analysisId && <ActionButton size="sm" variant="ghost" disabled={!ready || saving} onClick={()=>void save(true)}>另存为</ActionButton>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-monokai-comment"><span className="min-w-0 truncate max-w-[55%]" title={definition.source.sql}>来源：{definition.source.name} · {definition.source.catalog}.{definition.source.schema}</span>
        {definition.joinConfig?.enabled ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/40 text-2xs">
            <Link2 size={12}/> 双表已关联（{definition.joinConfig.secondaryTable}）
            <button type="button" className="ml-1 text-monokai-comment hover:text-monokai-fg cursor-pointer" title="解除关联" onClick={handleRemoveJoin}><Unlink size={11}/></button>
          </span>
        ) : (
          <button type="button" className={`${AH.btnGhost} text-2xs py-0.5 px-2`} onClick={()=>{if(!primaryKey && fields.length)setPrimaryKey(fields[0].name);setJoinModalOpen(true);}}><Link2 size={12}/> 关联数据表</button>
        )}<span role="status">{saving?'正在保存…':dirty?'未保存 · 会话草稿':'已保存'}</span>
        {dirty && <button className={`${AH.btnGhost} max-sm:hidden`} onClick={()=>commit(savedDefinition)}>放弃本次修改</button>}
      </div>
      {publishError && <p role="alert" className="text-monokai-orange">{publishError}<button className={AH.btnGhost} disabled={saving || !scopeValid} onClick={()=>void retryPublish()}>重试加入首页</button></p>}
      <details className="text-monokai-comment"><summary className="cursor-pointer">来源范围与已继承条件{definition.source.catalog==='memory'?' · 临时内存库':''}</summary>{definition.source.catalog==='memory' && <p>临时内存库中的分析不会长期保留，请切换持久库后保存。</p>}<p className="py-2">在完整来源查询上聚合，追加筛选与来源条件同时生效。查询中的 LIMIT 也属于来源范围。</p><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all">{definition.source.sql}</pre>{dirty && <button className={`${AH.btnGhost} sm:hidden`} onClick={()=>commit(savedDefinition)}>放弃本次修改</button>}</details>
      <div className="pivot-toolbar flex flex-wrap items-center gap-2">
        <button className={AH.btnGhost} aria-expanded={configOpen} aria-controls="pivot-configuration" onClick={()=>setConfigOpen(!configOpen)}><SlidersHorizontal size={14}/>{configOpen?'收起配置':'配置透视表'}</button>
        {manualApply && <button className={AH.btnPrimary} disabled={!unapplied} onClick={()=>setAppliedDefinition(definition)}>应用配置</button>}
        <div role="group" aria-label="透视结果展示方式" className={AH.segmentTrack}>{(['table','chart'] as const).map(view=><button key={view} aria-pressed={definition.view===view} className={definition.view===view?AH.segmentItemActive:AH.segmentItem} onClick={()=>update({view})}>{view==='table'?<Table2 size={14}/>:<BarChart3 size={14}/>} {view==='table'?'透视表':'图表'}</button>)}</div>
        <button className={AH.btnGhost} disabled={!ready} onClick={exportCsv} title="导出已加载组合的聚合长表，包含查找隐藏项，不含来源总计"><Download size={14}/>导出长表 CSV</button>
        <span className="text-monokai-comment max-sm:hidden">{definition.limit?`展示前 ${definition.limit} 个行列组合`:'展示全部行列组合'} · 总计按全部符合条件的来源计算</span>
      </div>
    </div>
    <div className="pivot-body flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
      {configOpen && <aside id="pivot-configuration" aria-label="透视配置" className="pivot-config shrink-0 overflow-auto border-b border-monokai-border p-3 space-y-2 custom-scrollbar">
        <div className="pivot-config-grid">
        <div className="pivot-dimensions space-y-2">        {rowDimensionsControl()}
        <button className={`${AH.btnGhost} w-full justify-center`} disabled={!definition.column && !rowDims.length} onClick={()=>{
          // Either side may be empty: the first row dimension becomes the column and vice versa.
          const nextRows = definition.column ? [definition.column, ...rowDims.slice(1)] : rowDims.slice(1);
          update({ rows: nextRows, row: nextRows[0], column: rowDims[0] });
        }}><ArrowLeftRight size={14}/>交换行列</button>
        {columnControl()}
        </div>
        <section className={`${AH.cardMuted} p-3 space-y-3`}><div className="flex items-center justify-between"><h3 className="font-semibold">值</h3><span className="text-2xs text-monokai-comment">统计指标</span></div>
          {definition.metrics.length===0 && <p className="text-2xs text-monokai-comment">未选择值时，按「记录数」统计每个单元格包含的记录条数。可点击下方「添加值」或在字段目录中选择字段。</p>}
          {definition.metrics.map((metric,index)=><div className="space-y-2 border-b border-monokai-border pb-3 last:border-0" key={index}>
            <label className="block">字段<select aria-label={`值 ${index+1} 字段`} className={`${AH.select} w-full mt-1`} value={metric.column || ''} onChange={event=>{
              const column=event.target.value || undefined;const field=fields.find(f=>f.name===column);
              const agg=!column?'count':(['sum','avg'].includes(metric.agg) && !pivotNumericType(field?.type || ''))?'count':metric.agg;
              const autoName=metric.alias==='记录数' || metric.alias===`${metric.column} ${AGGS.find(a=>a.value===metric.agg)?.label}`;
              const alias=autoName?(column?`${column} ${AGGS.find(a=>a.value===agg)?.label}`:'记录数'):metric.alias;
              const next=[...definition.metrics];next[index]={...metric,column,agg,alias};update({metrics:next,sortMetric:definition.sortMetric===metric.alias?alias:definition.sortMetric});
            }}><option value="">整条记录</option>{fields.map(field=><option key={field.name} value={field.name}>{field.name}</option>)}</select></label>
            <div className="flex items-center gap-2"><select aria-label={`值 ${index+1} 聚合方式`} className={`${AH.select} flex-1 min-w-0`} value={metric.agg} onChange={event=>{const next=[...definition.metrics];const agg=event.target.value as AnalysisAgg;const autoName=metric.alias==='记录数' || metric.alias===`${metric.column} ${AGGS.find(a=>a.value===metric.agg)?.label}`;const alias=autoName?`${metric.column} ${AGGS.find(a=>a.value===agg)?.label}`:metric.alias;next[index]={...metric,agg,alias};update({metrics:next,sortMetric:definition.sortMetric===metric.alias?alias:definition.sortMetric});}}>{AGGS.map(agg=><option key={agg.value} value={agg.value} disabled={(!metric.column && agg.value!=='count') || (['sum','avg'].includes(agg.value) && !pivotNumericType(fields.find(f=>f.name===metric.column)?.type || ''))}>{agg.label}</option>)}</select>
              <button aria-label={`移除值 ${index+1}`} className={AH.dangerIconBtn} onClick={()=>update({metrics:definition.metrics.filter((_,i)=>i!==index),visibleMetric:0})}><Trash2 size={16}/></button></div>
            <input aria-label={`值 ${index+1} 名称`} className={`${AH.input} w-full`} value={metric.alias} onChange={event=>{const next=[...definition.metrics];const alias=event.target.value;next[index]={...metric,alias};update({metrics:next,sortMetric:definition.sortMetric===metric.alias?alias:definition.sortMetric},`alias-${index}`);}}/>
            {!['count','count_distinct'].includes(metric.agg) && <label className="block">小数位<select aria-label={`值 ${index+1} 小数位`} className={`${AH.select} ml-2`} value={metric.decimals ?? definition.decimals ?? 8} onChange={event=>{const metrics=[...definition.metrics];metrics[index]={...metric,decimals:Number(event.target.value)};update({metrics});}}>{[0,2,4,8,12].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
          </div>)}
          <button className={AH.btnGhost} onClick={()=>update({metrics:[...definition.metrics,{agg:'count',alias:`记录数 ${definition.metrics.length+1}`}]})}><Plus size={14}/>添加值</button>
          {definition.metrics.length>1 && <label className="block">当前展示的值<select aria-label="当前展示的值" className={`${AH.select} w-full mt-1`} value={definition.visibleMetric} onChange={event=>update({visibleMetric:Number(event.target.value)})}>{definition.metrics.map((metric,index)=><option key={index} value={index}>{metric.alias}</option>)}</select></label>}
          {unitColumn && <div><label className="block">计量资产<input aria-label="分析计量资产" list="pivot-unit-options" placeholder="搜索或输入资产名称" className={`${AH.input} w-full mt-1`} value={definition.unit} onChange={event=>{setUnitSearch(event.target.value);update({unit:event.target.value});}}/><datalist id="pivot-unit-options">{units.map(unit=><option key={unit} value={unit}/>)}</datalist></label><span role="status" className="block text-monokai-comment mt-1">{unitLoading?'正在查找资产…':'不同资产不能混合汇总；最多显示200条候选，可继续输入查找。'}</span>{unitError && <p role="alert">资产候选读取失败，仍可输入完整名称。<button className={AH.btnGhost} onClick={()=>setUnitRetry(v=>v+1)}>重试资产列表</button></p>}</div>}
        </section>
        <section className={`${AH.cardMuted} p-3 space-y-2`}><div className="flex items-center justify-between"><h3 className="font-semibold">筛选</h3><span className="text-2xs text-monokai-comment">限定分析范围</span></div>
          {definition.filters.map((filter,index)=><div key={index} className="space-y-2 border-b border-monokai-border pb-2">
            <select aria-label={`筛选 ${index+1} 字段`} className={`${AH.select} w-full`} value={filter.column} onChange={event=>{const next=[...definition.filters];next[index]={...filter,column:event.target.value};update({filters:next});}}>{fields.map(field=><option key={field.name}>{field.name}</option>)}</select>
            <div className="flex gap-2"><select aria-label={`筛选 ${index+1} 条件`} className={`${AH.select} flex-1`} value={filter.op} onChange={event=>{const next=[...definition.filters];next[index]={...filter,op:event.target.value as typeof filter.op};update({filters:next});}}>{[['=','等于'],['!=','不等于'],['>','大于'],['>=','大于等于'],['<','小于'],['<=','小于等于'],['contains','包含'],['is_null','为空'],['not_null','非空']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className={AH.dangerIconBtn} aria-label={`移除筛选 ${index+1}`} onClick={()=>update({filters:definition.filters.filter((_,i)=>i!==index)})}><Trash2 size={16}/></button></div>
            {!['is_null','not_null'].includes(filter.op) && <input aria-label={`筛选 ${index+1} 值`} className={`${AH.input} w-full`} value={filter.value} onChange={event=>{const next=[...definition.filters];next[index]={...filter,value:event.target.value};update({filters:next},`filter-${index}`);}}/>}
          </div>)}
          <button className={AH.btnGhost} onClick={()=>update({filters:[...definition.filters,{column:fields[0].name,op:'=',value:''}]})}><Plus size={14}/>添加筛选</button>
        </section>
        </div>
        <div className="pivot-advanced flex flex-wrap items-start gap-2">
        <details className={`${AH.cardMuted} pivot-field-directory p-2 space-y-2`}><summary className="cursor-pointer font-semibold">字段目录 · {fields.length} 个字段</summary><input aria-label="查找来源字段" className={`${AH.input} w-full`} placeholder="查找字段名称或类型…" value={fieldSearch} onChange={event=>setFieldSearch(event.target.value)}/><div className="max-h-44 overflow-auto space-y-1">{fields.filter(field=>`${field.name} ${field.type}`.toLocaleLowerCase().includes(fieldSearch.toLocaleLowerCase())).map(field=>{
          const sem=classifySemanticType(field.name,field.type);
          const inRow=rowDims.some(r=>r.column===field.name);
          const inCol=definition.column?.column===field.name;
          const inVal=definition.metrics.some(m=>m.column===field.name);
          const inFilter=definition.filters.some(f=>f.column===field.name);
          const semLabel=sem==='numeric'?'数值':sem==='temporal'?'时间':sem==='categorical'?'分类':'ID';
          const semBadgeColor=sem==='numeric'?'bg-monokai-cyan/15 text-monokai-cyan':sem==='temporal'?'bg-monokai-yellow/15 text-monokai-yellow':sem==='categorical'?'bg-monokai-green/15 text-monokai-green':'bg-monokai-border text-monokai-comment';
          return (<div key={field.name} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-monokai-bg/40">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5"><span className="truncate font-medium text-xs text-monokai-fg" title={`${field.name} · ${field.type}`}>{field.name}</span><span className={`px-1 rounded text-3xs font-mono shrink-0 ${semBadgeColor}`}>{semLabel}</span></div>
              <div className="flex items-center gap-1 mt-0.5"><small className="text-monokai-comment text-3xs">{field.type}</small>{inRow && <span className="px-1 rounded text-3xs bg-monokai-accent/20 text-monokai-accent">行</span>}{inCol && <span className="px-1 rounded text-3xs bg-monokai-cyan/20 text-monokai-cyan">列</span>}{inVal && <span className="px-1 rounded text-3xs bg-monokai-yellow/20 text-monokai-yellow">值</span>}{inFilter && <span className="px-1 rounded text-3xs bg-monokai-orange/20 text-monokai-orange">筛选</span>}</div>
            </div>
            <select aria-label={`添加字段 ${field.name}`} className={`${AH.select} text-2xs py-1`} value="" onChange={event=>{
              const slot=event.target.value;if(slot==='value')update({metrics:[...definition.metrics,{column:field.name,agg:pivotNumericType(field.type)?'sum':'count',alias:`${field.name} ${pivotNumericType(field.type)?'求和':'计数'} ${definition.metrics.length+1}`}]});
              else if(slot==='filter')update({filters:[...definition.filters,{column:field.name,op:'=',value:''}]});
              else if(slot==='row'){if(rowDims.some(r=>r.column===field.name))return;const next=[...rowDims,{column:field.name,...(classifySemanticType(field.name,field.type)==='temporal'?{dateTrunc:'month' as const}:{})}];update({rows:next,row:next[0],...(definition.column?.column===field.name?{column:undefined}:{})});}
              else if(slot==='column'){const remaining=rowDims.filter(r=>r.column!==field.name);update({column:{column:field.name,...(classifySemanticType(field.name,field.type)==='temporal'?{dateTrunc:'month' as const}:{})},rows:remaining,row:remaining[0]});}
            }}><option value="">添加到…</option><option value="row">行</option><option value="column">列</option><option value="value">值</option><option value="filter">筛选</option></select></div>);
        })}</div></details>
        <details className={`${AH.cardMuted} p-3`}><summary className="cursor-pointer font-semibold">排序与展示</summary><div className="space-y-2 pt-3">
          <label className="flex items-center gap-2"><input aria-label="修改后手动应用" type="checkbox" checked={manualApply} onChange={event=>{setAppliedDefinition(definition);setManualApply(event.target.checked);}}/>修改后手动应用</label>
          <p className="text-monokai-comment">高基数分析可先调整多个字段，再一次计算。</p>

          <p className="text-monokai-comment">此排序决定保留哪些行列组合；矩阵行排序在结果表头设置。</p>
          <label className="block">组合排序依据<select aria-label="排序依据" className={`${AH.select} w-full`} value={definition.metrics.some(metric=>metric.alias===definition.sortMetric)?definition.sortMetric:(definition.metrics[0]?.alias||PIVOT_DEFAULT_METRIC.alias)} onChange={event=>update({sortMetric:event.target.value})}>{(definition.metrics.length?definition.metrics:[PIVOT_DEFAULT_METRIC]).map(metric=><option key={metric.alias}>{metric.alias}</option>)}</select></label>
          <label className="block">组合排序方向<select aria-label="排序方向" className={`${AH.select} w-full`} value={definition.sortOrder} onChange={event=>update({sortOrder:event.target.value as 'asc'|'desc'})}><option value="desc">降序</option><option value="asc">升序</option></select></label>
          <label className="block">显示小数位<select aria-label="显示小数位" className={`${AH.select} w-full`} value={definition.decimals ?? 8} onChange={event=>update({decimals:Number(event.target.value)})}>{[0,2,4,8,12].map(n=><option key={n} value={n}>{n} 位</option>)}</select><span className="text-monokai-comment">微量非零值及精确大数保留有效数字。</span></label>
          <label className="block">空单元格显示
            <select aria-label="空单元格显示" className={`${AH.select} w-full`} value={definition.nullDisplay || 'dash'} onChange={event=>update({nullDisplay:event.target.value as any})}>
              <option value="dash">— (默认横线)</option>
              <option value="zero">0 (数字零)</option>
              <option value="empty">(空) (文字占位)</option>
            </select>
          </label>
          <label className="block">展示组数<select aria-label="展示组数" className={`${AH.select} w-full`} value={definition.limit} onChange={event=>update({limit:Number(event.target.value)})}>{[10,25,50,100,0].map(limit=><option key={limit} value={limit}>{limit?`前 ${limit} 组`:'全部'}</option>)}</select></label>
          {definition.view==='chart' && <label className="block">图表类型<select aria-label="图表类型" className={`${AH.select} w-full`} value={definition.chartType} onChange={event=>update({chartType:event.target.value as PivotDefinition['chartType']})}><option value="bar">柱状图</option><option value="line">折线图</option><option value="area">面积图</option></select></label>}
        </div></details>
        </div>
      </aside>}
      <main aria-label="透视结果" className="pivot-results flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-3">
        {!scopeValid?<AnalysisErrorState title="数据范围已变化" message="请回到原数据库后继续编辑。"/>:<>
          {error && <div className="shrink-0 max-h-40 overflow-auto"><AnalysisErrorState title="透视计算失败" message={/Error:|LINE \d/i.test(error)?'无法执行当前配置，请检查来源字段、字段类型和筛选条件。':error} onRetry={()=>setRetry(value=>value+1)}/>{/Error:|LINE \d/i.test(error) && <details><summary>查看技术详情</summary><pre className="whitespace-pre-wrap break-all">{error}</pre></details>}</div>}
          {!ready && !error && <div role="status" className="shrink-0 py-2 text-monokai-comment">{unapplied?'有未应用配置，请点击「应用配置」；当前结果保持原口径。':result?'正在更新，当前显示上次结果；更新完成后可查看明细和保存。':'正在计算当前配置…'}</div>}
          {result && <>
            {(definition.joinConfig?.fanOutRisk || joinRisk) && (
              <div role="alert" className="mb-2 p-2.5 rounded bg-monokai-orange/15 border border-monokai-orange/40 text-monokai-orange text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0"/>
                <span>从表关联键非唯一，存在 1:N 膨胀风险；求和指标可能会被重复放大计算，建议核实业务关联或使用「去重计数」。</span>
              </div>
            )}
            {definition.limit > 0 && result.value.rows.length >= definition.limit && (
              <div className="mb-2 p-2 rounded bg-monokai-surface/60 border border-monokai-border text-xs text-monokai-comment flex items-center justify-between">
                <span>注意：当前结果已按排序规则截断至前 {definition.limit} 个行列组合；矩阵行/列/来源总计均按符合条件的全部底层来源计算。</span>
                <button type="button" className="text-monokai-accent hover:underline ml-2" onClick={()=>update({limit:0})}>查看全部</button>
              </div>
            )}
            {/* 业务语义导读条：让没有分析经验的用户一眼看懂当前透视表在表达什么 */}
            <div className="pivot-result-summary flex shrink-0 flex-wrap items-center justify-between gap-2 pb-2 text-monokai-comment"><span>{rowDims.length?rowDims.map(r=>r.column).join(" / "):'全部记录'}{definition.column ? ` × ${definition.column.column}` : ""} · {definition.metrics[definition.visibleMetric]?.alias || PIVOT_DEFAULT_METRIC.alias}</span><span>{result.value.rows.length} 组 · {result.value.executionTimeMs} ms · 点击数值查看明细</span></div>
            {result.value.rows.length===0?<AnalysisEmptyHint message="当前条件没有数据，请调整追加筛选或检查来源范围。"/>:<>
              <div className={`flex-1 min-h-0 ${definition.view==='table'?'':'hidden'}`}>{tableChart?.pivotTable && <PivotTableView spec={tableChart} disabled={!ready} onCell={(row,column)=>{if(ready)setDetail({row,column,page:0,spec:result.value.spec});}}/>}</div>
              {definition.view==='chart' && chart && <div className="flex-1 min-h-0 overflow-auto"><p className="text-monokai-comment">图形坐标使用近似数值；精确值请查看透视表或导出聚合长表。</p><AnalysisChartRenderer chartSpec={chart} height={360}/></div>}
            </>}
          </>}
        </>}
      </main>
    </div>
    <div className="shrink-0"><AnalysisSqlBar sql={ready?result!.value.sql:''} open={showSql} onToggle={()=>setShowSql(!showSql)} onCopy={()=>{if(!ready)return;if(!navigator.clipboard?.writeText){toastService.error('当前环境不支持复制，请展开 SQL 手动选择');return;}void navigator.clipboard.writeText(result!.value.sql).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>toastService.error('复制失败'));}} copied={copied}/>
      {showSql && ready && onInsertSql && <button className={`${AH.btnGhost} m-2`} onClick={()=>onInsertSql(result!.value.sql,false)}>在 SQL 工作台查看</button>}
    </div>
    <DrawerShell open={!!detail} title="透视明细" description={`${rowDims.length?rowDims.map(r=>r.column).join(' / '):'全部记录'} = ${String(detail?.row??'（空值）')}${definition.column?` · ${definition.column.column} = ${String(detail?.column??'（空值）')}`:''}`} onClose={()=>setDetail(null)} size="xl" footer={<div className="flex items-center gap-3"><button className={AH.btnGhost} disabled={!detail || detail.page===0 || detailBusy} onClick={()=>setDetail(value=>value?{...value,page:value.page-1}:null)}>上一页</button><span>{detailRows.length?`${(detail?.page||0)*50+1}–${(detail?.page||0)*50+Math.min(50,detailRows.length)} 条`:'暂无记录'}</span><button className={AH.btnGhost} disabled={detailRows.length<=50 || detailBusy || !!detailError} onClick={()=>setDetail(value=>value?{...value,page:value.page+1}:null)}>下一页</button></div>}>
      <p className="mb-3 text-monokai-comment">明细包含来源条件、追加筛选、计量资产及当前行列条件。按全部输出字段排序；翻页不是数据快照，实时来源变化后请重新打开。</p>
      {detailBusy?<AnalysisLoadingState message="正在读取明细…"/>:detailError?<AnalysisErrorState title="明细读取失败" message={detailError} onRetry={()=>setDetailRetry(value=>value+1)}/>:<AnalysisResultTable columns={Object.keys(detailRows[0] || {})} rows={detailRows.slice(0,50)} title="对应来源记录" maxHeightClass="max-h-[65vh]"/>}
      {detail && spec && <details className="mt-3"><summary className="cursor-pointer">查看明细条件 SQL</summary><pre className="mt-2 whitespace-pre-wrap break-all text-monokai-comment">{pivotDetailSql(detail.spec,detail.row,detail.column,detail.page)}</pre></details>}
    </DrawerShell>
    <PivotExtractMetricModal isOpen={extractMetricOpen} onClose={()=>setExtractMetricOpen(false)} definition={definition} onInsertSql={onInsertSql}/>

    <ModalShell
      open={joinModalOpen}
      title="双表关联透视向导 (Dual-Table Join)"
      description="将当前数据表与同库内其他数据表进行关联，合并字段目录进行跨表透视分析"
      onClose={() => setJoinModalOpen(false)}
      icon={Link2}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={() => setJoinModalOpen(false)}>取消</ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            disabled={!secondaryTable || !primaryKey || !secondaryKey || joining}
            loading={joining}
            onClick={() => void handleApplyJoin()}
          >
            应用双表关联
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-monokai-fg">主表（当前分析表）</label>
            <input className={`${AH.input} w-full text-xs bg-monokai-bg/60`} disabled value={definition.source.table || definition.source.name} />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-monokai-fg">从表（关联表）</label>
            <select
              className={`${AH.select} w-full text-xs`}
              value={secondaryTable}
              onChange={e => void onSelectSecondaryTable(e.target.value)}
            >
              <option value="">选择关联表…</option>
              {tables.filter(t => t !== (definition.source.table || definition.source.name)).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-semibold text-monokai-fg">关联方式 (Join Type)</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="joinType"
                value="LEFT"
                checked={joinType === 'LEFT'}
                onChange={() => setJoinType('LEFT')}
              />
              <span>左连接 (LEFT JOIN - 保留主表全部记录)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="joinType"
                value="INNER"
                checked={joinType === 'INNER'}
                onChange={() => setJoinType('INNER')}
              />
              <span>内连接 (INNER JOIN - 仅保留匹配记录)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-semibold text-monokai-fg">主表关联键</label>
            <select
              className={`${AH.select} w-full text-xs`}
              value={primaryKey}
              onChange={e => setPrimaryKey(e.target.value)}
            >
              {fields.map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-monokai-fg">从表关联键</label>
            <select
              className={`${AH.select} w-full text-xs`}
              value={secondaryKey}
              disabled={!secondaryCols.length}
              onChange={e => setSecondaryKey(e.target.value)}
            >
              {!secondaryCols.length && <option value="">请先选择从表</option>}
              {secondaryCols.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {secondaryTable && primaryKey && secondaryKey && (
          <div className="p-2.5 rounded bg-monokai-surface/60 border border-monokai-border font-mono text-2xs text-monokai-comment">
            SQL 关联片段预览：
            <div className="text-monokai-cyan mt-1">
              {joinType} JOIN "{definition.source.catalog}"."{definition.source.schema}"."{secondaryTable}" AS t2 ON t1."{primaryKey}" = t2."{secondaryKey}"
            </div>
          </div>
        )}
      </div>
    </ModalShell>

    <DrawerShell
      open={managerOpen}
      title={`已保存透视模板 (${savedList.length})`}
      description={`当前数据库 (${currentDatabase}) 下已持久化的透视分析方案`}
      onClose={() => setManagerOpen(false)}
      size="md"
    >
      <div className="space-y-2">
        {savedList.length === 0 ? (
          <div className="p-8 text-center text-monokai-comment text-xs">
            当前数据库暂无已保存的透视模板，可通过顶部「保存分析」创建。
          </div>
        ) : (
          savedList.map(record => {
            const p = record.pivot;
            const rowSummary = p ? (p.rows && p.rows.length ? p.rows.map(r => r.column).join(' / ') : p.row?.column) : '';
            const colSummary = p?.column?.column || '无列维度';
            const valSummary = p?.metrics?.map(m => m.alias).join(', ') || '';
            return (
              <div
                key={record.id}
                className="p-3 rounded-lg border border-monokai-border bg-monokai-surface hover:border-monokai-border-strong transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-semibold text-monokai-fg truncate flex items-center gap-2">
                    <span>{record.title}</span>
                    {record.id === analysisId && (
                      <span className="text-2xs px-1.5 py-0.2 rounded bg-monokai-accent/20 text-monokai-accent font-normal">当前载入</span>
                    )}
                  </div>
                  <div className="text-2xs text-monokai-comment">
                    行：{rowSummary} · 列：{colSummary} · 值：{valSummary}
                  </div>
                  <div className="text-2xs text-monokai-comment/60">
                    更新时间：{new Date(record.savedAt || Date.now()).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (p) {
                        setDefinition(p);
                        setAnalysisId(record.id);
                        setSavedAt(record.savedAt);
                        setSavedKey(pivotDefinitionKey(p));
                        setSavedDefinition(p);
                        setManagerOpen(false);
                        toastService.success(`已载入模板「${record.title}」`);
                      }
                    }}
                  >
                    载入
                  </ActionButton>
                  <button
                    type="button"
                    className={`${AH.dangerIconBtn} p-1.5`}
                    title="删除此模板"
                    onClick={async () => {
                      try {
                        await deletePivotRecord(record.id);
                        setSavedList(prev => prev.filter(r => r.id !== record.id));
                        if (analysisId === record.id) {
                          setAnalysisId(undefined);
                          setSavedKey(undefined);
                        }
                        toastService.success('已删除透视模板');
                      } catch (e) {
                        toastService.error(`删除失败: ${String((e as Error).message)}`);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DrawerShell>
  </div>;
}
