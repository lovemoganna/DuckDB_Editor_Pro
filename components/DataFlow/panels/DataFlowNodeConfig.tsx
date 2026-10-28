import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DataFlowNodeData } from '../../../services/dataflow/workflowTypes';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import { dfInput, dfSelect, dfTextarea, dfBtnSecondary, dfIconBtn, dfDrawerSectionLabel } from '../dataflowUi';

/** Only user-authored workflows are editable; SQL and catalog graphs describe their source. */
export const DataFlowNodeConfig: React.FC<{ nodeId: string; data: DataFlowNodeData }> = ({ nodeId, data }) => {
  const executing = useWorkflowStore(s => s.isExecuting);
  const mode = useWorkflowStore(s => s.dataFlowMode);
  const tables = useWorkflowStore(s => s.availableTables);
  const update = useWorkflowStore(s => s.updateNodeConfig);
  const c = data.config || {};
  const patch = (value: Record<string, unknown>) => update(nodeId, value);
  const field = (label: string, content: React.ReactNode) => <label className="block min-w-0 flex-1 space-y-1 text-meta text-monokai-comment"><span>{label}</span>{content}</label>;
  if (mode !== 'custom') return null;
  return <section className="space-y-2" aria-label="算子配置">
    <h3 className={dfDrawerSectionLabel}>算子配置</h3>
    <p className="text-meta text-monokai-comment">修改后当前节点及下游需重新运行。</p>
    <fieldset disabled={executing} className="space-y-2 min-w-0">
      {data.type === 'source' && <>
        {field('来源格式', <select className={dfSelect} value={c.fileType || 'table'} onChange={e => patch({ fileType: e.target.value, tableName: '', filePath: '' })}>{['table', 'csv', 'parquet', 'json'].map(t => <option key={t} value={t}>{t}</option>)}</select>)}
        {c.fileType && c.fileType !== 'table'
          ? field('文件路径或 URL', <input className={dfInput} value={c.filePath || ''} onChange={e => patch({ filePath: e.target.value })} placeholder="DuckDB 可访问的文件路径" />)
          : field('数据表', <select className={dfSelect} value={c.tableName || ''} onChange={e => patch({ tableName: e.target.value })}><option value="">选择数据表</option>{Array.from(new Set([...tables, ...(c.tableName ? [c.tableName] : [])])).map(t => <option key={t}>{t}</option>)}</select>)}
      </>}
      {data.type === 'sql_transform' && <>
        {field('转换 SQL', <textarea className={dfTextarea} value={c.sql || ''} onChange={e => patch({ sql: e.target.value })} rows={5} spellCheck={false} />)}
        <p className="text-meta text-monokai-comment">使用 {'{{input}}'} 引用上游，多输入使用 {'{{input1}}'}、{'{{input2}}'}。</p>
      </>}
      {data.type === 'schema' && <p className="text-meta text-monokai-comment">字段结构由上游结果生成，可在下方字段清单中查看。</p>}
      {data.type === 'join' && <>
        {field('连接方式', <select className={dfSelect} value={c.joinType || 'INNER'} onChange={e => patch({ joinType: e.target.value })}>{['INNER', 'LEFT', 'RIGHT', 'FULL'].map(t => <option key={t}>{t}</option>)}</select>)}
        <p className="text-meta text-monokai-comment">按连线输入顺序匹配左右表；无条件时为笛卡尔积。</p>
        {(c.conditions || []).map((item: any, i: number) => <div className="flex gap-1 items-end" key={item.id}>
          {field('左表字段', <input className={dfInput} value={item.leftColumn} onChange={e => patch({ conditions: c.conditions.map((v: any, j: number) => j === i ? { ...v, leftColumn: e.target.value } : v) })} />)}
          {field('右表字段', <input className={dfInput} value={item.rightColumn} onChange={e => patch({ conditions: c.conditions.map((v: any, j: number) => j === i ? { ...v, rightColumn: e.target.value } : v) })} />)}
          <button type="button" className={dfIconBtn} aria-label={`删除连接条件 ${i + 1}`} onClick={() => patch({ conditions: c.conditions.filter((_: any, j: number) => j !== i) })}><Trash2 size={12} /></button>
        </div>)}
        <button type="button" className={dfBtnSecondary} onClick={() => patch({ conditions: [...(c.conditions || []), { id: crypto.randomUUID(), leftColumn: '', rightColumn: '' }] })}><Plus size={12} />添加连接条件</button>
      </>}
      {data.type === 'aggregate' && <>
        {field('分组字段（每行一个）', <textarea className={dfTextarea} value={(c.groupBy || []).join('\n')} onChange={e => patch({ groupBy: e.target.value.split('\n'), rawSql: undefined })} onBlur={e => patch({ groupBy: e.target.value.split('\n').map(v => v.trim()).filter(Boolean), rawSql: undefined })} />)}
        {(c.aggregations || []).map((item: any, i: number) => <div className="space-y-1 rounded-md border border-monokai-border p-2" key={item.id}>
          <div className="flex items-center gap-1">
            {field('函数', <select className={dfSelect} value={item.func} onChange={e => patch({ rawSql: undefined, aggregations: c.aggregations.map((v: any, j: number) => j === i ? { ...v, func: e.target.value } : v) })}>{['SUM', 'COUNT', 'COUNT(DISTINCT)', 'AVG', 'MIN', 'MAX'].map(t => <option key={t}>{t}</option>)}</select>)}
            <button type="button" className={`${dfIconBtn} ml-auto`} aria-label={`删除聚合字段 ${i + 1}`} onClick={() => patch({ rawSql: undefined, aggregations: c.aggregations.filter((_: any, j: number) => j !== i) })}><Trash2 size={12} /></button>
          </div>
          {field('字段（COUNT 可使用 *）', <input className={dfInput} value={item.column} onChange={e => patch({ rawSql: undefined, aggregations: c.aggregations.map((v: any, j: number) => j === i ? { ...v, column: e.target.value } : v) })} />)}
          {field('输出名称', <input className={dfInput} value={item.alias} onChange={e => patch({ rawSql: undefined, aggregations: c.aggregations.map((v: any, j: number) => j === i ? { ...v, alias: e.target.value } : v) })} />)}
        </div>)}
        <button type="button" className={dfBtnSecondary} onClick={() => patch({ rawSql: undefined, aggregations: [...(c.aggregations || []), { id: crypto.randomUUID(), func: 'COUNT', column: '*', alias: `count_${(c.aggregations || []).length + 1}` }] })}><Plus size={12} />添加聚合字段</button>
        {field('过滤条件（WHERE）', <textarea className={dfTextarea} value={c.filter || ''} onChange={e => patch({ filter: e.target.value, rawSql: undefined })} />)}
      </>}
      {data.type === 'result' && field('输出行数上限', <input type="number" min={1} step={1} className={dfInput} value={c.limit ?? 100} onChange={e => { const limit = Number(e.target.value); if (Number.isInteger(limit) && limit > 0) patch({ limit }); }} />)}
      {data.type === 'export' && <>
        {field('导出格式', <select className={dfSelect} value={c.format || 'parquet'} onChange={e => patch({ format: e.target.value })}>{['parquet', 'csv', 'json'].map(t => <option key={t}>{t}</option>)}</select>)}
        {field('输出文件路径', <input className={dfInput} value={c.filePath || ''} onChange={e => patch({ filePath: e.target.value })} />)}
      </>}
    </fieldset>
  </section>;
};
