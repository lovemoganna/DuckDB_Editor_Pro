import React, { useEffect, useState } from 'react';
import { ActionButton, FormInput, FormSelect, FormTextarea, ModalShell } from '../../ui/Workbench';
import type { Dashboard, DashboardItem, ChartConfig } from '../../../types';
import type { AnalysisFilter, DatasetDefinition, DashboardContext, WidgetQuerySpec, WidgetSettings } from '../../../services/workbench/analysisTypes';
import { DatasetFieldChartBuilder } from './DatasetFieldChartBuilder';
import { saveQueryDataset } from '../../../services/workbench/datasets';
import { compileAnalysis, validateFilters } from '../../../services/workbench/queryCompiler';
import { validateUniqueKeys } from '../../../services/workbench/datasetGuards';
import { quoteIdent } from '../../../services/databaseCatalog';
import { dbService } from '../../../services/dbService';

const emptyContext: DashboardContext = { filters: [], refreshSeconds: 0 };
const operators = {eq:'等于',ne:'不等于',gte:'大于等于 / 起始时间',lt:'小于 / 截止时间',lte:'小于等于',contains:'包含',isNull:'为空',notNull:'非空'};
export function FilterEditor({ datasets, filters, onChange }: {key?: React.Key; datasets:DatasetDefinition[];filters:AnalysisFilter[];onChange:(filters:AnalysisFilter[])=>void}) {
  const [datasetId,setDatasetId]=useState(datasets.length===1?datasets[0].id:''), [field,setField]=useState(''), [operator,setOperator]=useState<AnalysisFilter['operator']>('eq'), [value,setValue]=useState('');
  const dataset=datasets.find(d=>d.id===datasetId);
  return <div className="space-y-2 text-xs">
    {filters.map(filter=><div key={filter.id} className="flex flex-wrap items-center justify-between gap-2 border border-monokai-border/80 bg-monokai-surface/40 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono font-medium text-monokai-cyan">{filter.field}</span>
        <span className="text-monokai-comment">{operators[filter.operator]}</span>
        <span className="font-mono text-monokai-fg bg-monokai-elevated px-1.5 py-0.5 rounded border border-monokai-border">{filter.value}</span>
      </div>
      <ActionButton size="sm" variant="ghost" className="text-monokai-pink hover:text-monokai-pink" onClick={()=>onChange(filters.filter(f=>f.id!==filter.id))}>移除条件</ActionButton>
      <details className="w-full text-2xs text-monokai-comment pt-1 border-t border-monokai-border/40"><summary className="cursor-pointer hover:text-monokai-fg">适用数据集与字段映射（{Object.keys(filter.bindings).length} 个绑定）</summary>
        <div className="grid gap-2 py-2 sm:grid-cols-2">{datasets.map(d=><label key={d.id} className="flex flex-col gap-1 text-monokai-fg-muted font-medium">{d.name}
          <FormSelect sizeVariant="sm" aria-label={`${filter.field} 绑定 ${d.name}`} value={filter.bindings[d.id] || ''} onChange={event=>{
            const bindings={...filter.bindings}; if(event.target.value)bindings[d.id]=event.target.value;else delete bindings[d.id];
            onChange(filters.map(f=>f.id===filter.id?{...f,bindings}:f));
          }}><option value="">不参与此条件</option>{d.fields.map(f=><option key={f.name} value={f.name}>{f.name} · {f.type}</option>)}</FormSelect>
        </label>)}</div>
      </details>
    </div>)}
    <div className="flex flex-wrap gap-2 items-end rounded-lg border border-monokai-border/70 bg-monokai-surface/20 p-2.5">
      <label className="min-w-36 flex-1 text-2xs text-monokai-fg-muted font-medium">数据集<FormSelect sizeVariant="sm" aria-label="筛选数据集" value={datasetId} onChange={e=>{setDatasetId(e.target.value);setField('');}}><option value="">选择数据集</option>{datasets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</FormSelect></label>
      <label className="min-w-28 flex-1 text-2xs text-monokai-fg-muted font-medium">字段<FormSelect sizeVariant="sm" aria-label="筛选字段" value={field} onChange={e=>setField(e.target.value)}><option value="">选择字段</option>{dataset?.fields.map(f=><option key={f.name} value={f.name}>{f.name}</option>)}</FormSelect></label>
      <label className="min-w-28 flex-1 text-2xs text-monokai-fg-muted font-medium">条件<FormSelect sizeVariant="sm" aria-label="筛选条件" value={operator} onChange={e=>setOperator(e.target.value as AnalysisFilter['operator'])}>{Object.entries(operators).map(([id,label])=><option key={id} value={id}>{label}</option>)}</FormSelect></label>
      {!['isNull','notNull'].includes(operator)&&<label className="min-w-28 flex-1 text-2xs text-monokai-fg-muted font-medium">值<FormInput sizeVariant="sm" aria-label="筛选值" value={value} onChange={e=>setValue(e.target.value)} /></label>}
      <ActionButton size="sm" variant="primary" disabled={!dataset || !field || (!['isNull','notNull'].includes(operator)&&!value.trim())} onClick={()=>{
        if(dataset)onChange([...filters,{id:crypto.randomUUID(),field,operator,value,bindings:{[dataset.id]:field}}]);setValue('');
      }}>添加条件</ActionButton>
    </div>
  </div>;
}

export function DashboardContextControls({board,datasets,onSave}:{board:Dashboard;datasets:DatasetDefinition[];onSave:(board:Dashboard)=>Promise<void>}) {
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(board.context || emptyContext),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setDraft(board.context || emptyContext);},[board.id,board.context]);
  return <>
    <div className="flex flex-wrap items-center gap-1.5">
      <ActionButton size="sm" variant="secondary" onClick={()=>{setDraft(board.context || emptyContext);setError('');setOpen(true);}}>
        筛选{board.context?.filters.length ? `（${board.context.filters.length}）` : ''}
      </ActionButton>
      {board.context?.filters.map(filter=><span key={filter.id} className="inline-flex items-center gap-1 rounded-md border border-monokai-border/80 bg-monokai-elevated px-2 py-0.5 text-2xs font-mono text-monokai-fg-muted break-words">
        <span className="text-monokai-cyan">{filter.field}</span>
        <span>{operators[filter.operator]}</span>
        <span className="text-monokai-fg">{filter.value}</span>
      </span>)}
    </div>
    <ModalShell open={open} title="统一分析上下文" description="条件进入底层查询；按数据集显式映射字段。截止时间使用小于条件可避免日期边界重叠。" onClose={()=>setOpen(false)} size="xl" footer={<><ActionButton variant="secondary" onClick={()=>setOpen(false)}>取消</ActionButton><ActionButton disabled={busy} onClick={()=>void(async()=>{setBusy(true);try{validateFilters(draft.filters,datasets);await onSave({...board,formatVersion:2,context:draft,updatedAt:Date.now()});setOpen(false);}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}})()}>应用并保存默认条件</ActionButton></>}>
      <FilterEditor datasets={datasets} filters={draft.filters} onChange={filters=>setDraft({...draft,filters})}/>
      <label className="block mt-4 text-xs text-monokai-fg-muted font-medium">刷新策略<FormSelect sizeVariant="sm" className="mt-1" aria-label="看板刷新策略" value={draft.refreshSeconds} onChange={e=>setDraft({...draft,refreshSeconds:Number(e.target.value)})}><option value={0}>应用内数据变化时刷新</option><option value={30}>每 30 秒</option><option value={60}>每 60 秒</option><option value={300}>每 5 分钟</option></FormSelect></label>
      <p className="mt-1.5 text-2xs text-monokai-comment">定时刷新重新查询已连接数据；外部文件内容变化仍需重新载入数据源。</p>
      {error&&<p role="alert" className="mt-2 rounded border border-monokai-pink/30 bg-monokai-pink/10 p-2 text-xs text-monokai-pink">{error}</p>}
    </ModalShell>
  </>;
}

export function DatasetComposer({owner,datasets,onCreated}:{owner:string;datasets:DatasetDefinition[];onCreated:()=>Promise<void>}) {
  const [open,setOpen]=useState(false),[editingId,setEditingId]=useState(''),[name,setName]=useState(''),[mode,setMode]=useState('sql'),[sql,setSql]=useState(''),[left,setLeft]=useState(''),[right,setRight]=useState(''),[leftKey,setLeftKey]=useState(''),[rightKey,setRightKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const l=datasets.find(d=>d.id===left),r=datasets.find(d=>d.id===right);
  const build=async()=>{
    if(mode==='sql')return sql;
    if(!l||!r)throw new Error('请选择两个数据集');
    if(mode==='union')return `SELECT * FROM (\n${l.sql}\n) AS a UNION ALL BY NAME SELECT * FROM (\n${r.sql}\n) AS b`;
    if(!l.fields.some(f=>f.name===leftKey)||!r.fields.some(f=>f.name===rightKey))throw new Error('请选择关联键');
    await validateUniqueKeys([{sql:r.sql,key:rightKey}]);
    const fields=[...l.fields.map(f=>`a.${quoteIdent(f.name)} AS ${quoteIdent(f.name)}`),...r.fields.map(f=>`b.${quoteIdent(f.name)} AS ${quoteIdent('right_'+f.name)}`)];
    if(new Set([...l.fields.map(f=>f.name),...r.fields.map(f=>'right_'+f.name)]).size!==fields.length)throw new Error('输出字段重名，请使用 SQL 显式命名字段');
    return `SELECT ${fields.join(', ')} FROM (\n${l.sql}\n) AS a ${mode==='left'?'LEFT':'INNER'} JOIN (\n${r.sql}\n) AS b ON a.${quoteIdent(leftKey)} = b.${quoteIdent(rightKey)}`;
  };
  return <>
    <ActionButton variant="secondary" size="sm" onClick={()=>{setError('');setOpen(true);}}>
      组合 / SQL 数据集
    </ActionButton>
    <ModalShell
      open={open}
      title="创建分析数据集"
      description="只读数据集引用已连接来源，不复制业务数据。关联模式要求右侧键唯一，防止重复计量。"
      size="xl"
      onClose={()=>setOpen(false)}
      footer={<>
        <ActionButton variant="secondary" onClick={()=>setOpen(false)}>取消</ActionButton>
        <ActionButton
          variant="primary"
          disabled={busy||!name.trim()}
          loading={busy}
          onClick={()=>void(async()=>{
            setBusy(true);setError('');
            try{
              await saveQueryDataset(owner,name,await build(),mode==='sql'?undefined:[...(l?.uniqueKeys||[]),...(r?.uniqueKeys||[]),...(mode==='union'||!r?[]:[{sql:r.sql,key:rightKey}])],editingId||undefined);
              await onCreated();
              setOpen(false);
            }catch(e){
              setError(String((e as Error).message));
            }finally{
              setBusy(false);
            }
          })()}
        >
          验证并保存数据集
        </ActionButton>
      </>}
    >
      <div className="space-y-4 text-xs">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">已有定义</label>
          <FormSelect
            sizeVariant="sm"
            aria-label="编辑已保存数据集"
            value={editingId}
            onChange={e=>{
              setEditingId(e.target.value);
              const existing=datasets.find(d=>d.id===e.target.value);
              setName(existing?.name||'');
              setSql(existing?.sql||'');
              setMode('sql');
            }}
          >
            <option value="">创建新数据集</option>
            {datasets.filter(d=>d.kind==='query').map(d=><option key={d.id} value={d.id}>{d.name} · v{d.version}</option>)}
          </FormSelect>
          <p className="text-2xs text-monokai-comment">保存修改保留绑定身份，依赖组件重新查询。SQL 模式请自行确认关联基数；可视化关联会持续检查右侧唯一键。</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">名称</label>
          <FormInput
            sizeVariant="sm"
            aria-label="数据集名称"
            placeholder="输入数据集名称"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">组合方式</label>
          <FormSelect
            sizeVariant="sm"
            aria-label="数据集组合方式"
            value={mode}
            onChange={e=>setMode(e.target.value)}
          >
            <option value="sql">只读 SQL</option>
            <option value="left">左关联 (LEFT JOIN)</option>
            <option value="inner">内关联 (INNER JOIN)</option>
            <option value="union">按字段名追加 UNION ALL</option>
          </FormSelect>
        </div>

        {mode==='sql' ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-monokai-fg">只读 SQL 查询</label>
            <FormTextarea
              fontVariant="mono"
              aria-label="数据集 SQL"
              rows={8}
              value={sql}
              onChange={e=>setSql(e.target.value)}
              placeholder="SELECT ... FROM 数据库.Schema.表；跨库请明确限定来源"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-monokai-border/80 bg-monokai-surface/40 p-3">
            {[{label:'左侧',id:left,set:setLeft,key:leftKey,setKey:setLeftKey,d:l},{label:'右侧',id:right,set:setRight,key:rightKey,setKey:setRightKey,d:r}].map(side=>(
              <div key={side.label} className="space-y-2">
                <label className="block text-xs font-medium text-monokai-fg-muted">
                  {side.label}数据集
                  <FormSelect sizeVariant="sm" className="mt-1" aria-label={`${side.label}数据集`} value={side.id} onChange={e=>{side.set(e.target.value);side.setKey('');}}>
                    <option value="">选择数据集</option>
                    {datasets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </FormSelect>
                </label>
                {mode!=='union' && (
                  <label className="block text-xs font-medium text-monokai-fg-muted">
                    关联键
                    <FormSelect sizeVariant="sm" className="mt-1" aria-label={`${side.label}关联键`} value={side.key} onChange={e=>side.setKey(e.target.value)}>
                      <option value="">选择字段</option>
                      {side.d?.fields.map(f=><option key={f.name} value={f.name}>{f.name} · {f.type}</option>)}
                    </FormSelect>
                  </label>
                )}
              </div>
            ))}
          </div>
        )}

        {error&&<p role="alert" className="rounded-lg border border-monokai-pink/30 bg-monokai-pink/10 p-2.5 text-xs text-monokai-pink font-mono">{error}</p>}
      </div>
    </ModalShell>
  </>;
}

export function DatasetWidgetBuilder({board,datasets,onCreated,initialDatasetId,brush,open: controlledOpen,onOpenChange}:{
  board:Dashboard;datasets:DatasetDefinition[];onCreated:(board:Dashboard)=>void;initialDatasetId?:string;
  brush?:React.ComponentProps<typeof DatasetFieldChartBuilder>["brush"];
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen,setInternalOpen]=useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(val);
    onOpenChange?.(val);
  };
  return <><ActionButton size="sm" variant="primary" onClick={()=>setOpen(true)}>创建图表</ActionButton>
    <DatasetFieldChartBuilder open={isOpen} onClose={()=>setOpen(false)} datasets={datasets} initialDatasetId={initialDatasetId} context={board.context} brush={brush}
      onSave={async(definition,settings)=>{
        const query={...definition,id:crypto.randomUUID(),createdAt:Date.now(),databaseName:board.databaseName,pinned:true};
        await dbService.saveQuery(query);
        const card=query.widgetType==='value';
        const next=await dbService.updateDashboard(board.id,board.databaseName!,current=>({...current,formatVersion:2,items:[...current.items,{i:crypto.randomUUID(),savedQueryId:query.id,x:0,y:Math.max(0,...current.items.map(i=>i.y+i.h)),w:card?3:6,h:card?3:7,settings}]}));
        onCreated(next);
      }}/></>;
}

export function WidgetInstanceEditor({item,datasets,open,onClose,onSave}:{item:DashboardItem;datasets:DatasetDefinition[];open:boolean;onClose:()=>void;onSave:(settings:WidgetSettings)=>Promise<void>}) {
  const [draft,setDraft]=useState<WidgetSettings>(item.settings||{}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(open){setDraft(item.settings||{});setError('');}},[open,item]);
  return <ModalShell open={open} title="组件实例设置" description="只修改当前放置实例；原指标与其他组件保持独立。" size="xl" onClose={onClose} footer={<><ActionButton variant="secondary" onClick={onClose}>取消</ActionButton><ActionButton variant="primary" disabled={busy} loading={busy} onClick={()=>void(async()=>{setBusy(true);try{validateFilters(draft.filters||[],datasets);await onSave(draft);onClose();}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}})()}>应用并保存实例</ActionButton></>}>
    <div className="space-y-4 text-xs">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-monokai-fg">实例标题</label>
        <FormInput sizeVariant="sm" aria-label="实例标题" value={draft.title||''} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      </div>
      <label className="flex items-center gap-2 cursor-pointer font-medium text-monokai-fg">
        <input type="checkbox" className="rounded border-monokai-border text-monokai-accent focus:ring-monokai-accent/30" checked={draft.linked!==false} onChange={e=>setDraft({...draft,linked:e.target.checked})}/>
        <span>参与全局筛选与图表联动</span>
      </label>
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-monokai-fg">数据集绑定</label>
        <FormSelect sizeVariant="sm" aria-label="实例数据集" value={draft.datasetId||''} onChange={e=>setDraft({...draft,datasetId:e.target.value||undefined})}>
          <option value="">沿用来源定义</option>
          {datasets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </FormSelect>
        <p className="text-2xs text-monokai-comment">重新绑定适用于从数据集创建的组件；自定义 SQL 的来源仍由 SQL 定义。</p>
      </div>
      <div className="space-y-2 pt-2 border-t border-monokai-border/60">
        <h3 className="font-semibold text-xs text-monokai-fg">局部筛选</h3>
        <FilterEditor datasets={datasets} filters={draft.filters||[]} onChange={filters=>setDraft({...draft,filters})}/>
      </div>
      {error&&<p role="alert" className="rounded-lg border border-monokai-pink/30 bg-monokai-pink/10 p-2.5 text-xs text-monokai-pink font-mono">{error}</p>}
    </div>
  </ModalShell>;
}
