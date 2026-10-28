import React from 'react';
import type { GraphNode, GraphLink } from './D3GraphView.types';

const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const display = (value: unknown) => value == null ? '—' : typeof value === 'object' ? json(value) : String(value);

/** SQL provenance belongs in the existing graph inspectors, not in a second canvas. */
export function ProjectionTrace({node, link, rows}: {node?: GraphNode | null; link?: GraphLink; rows: Record<string,unknown>[]}) {
  const selected = link || node;
  if (!selected) return <p className="text-monokai-comment">点击图谱对象，查看来源表、标识、属性与查询记录。</p>;
  const fields = link ? {关系:link._linkTypeName,...link._properties} : {来源表:node?._trace?.table,标识:node?._trace?.key,...node?._trace?.properties};
  return <section aria-label={link ? 'SQL 关系来源' : 'SQL 对象来源'} className="space-y-2 text-xs">
    {node && <strong className="text-monokai-cyan break-words">{node.label}</strong>}
    <dl className="grid grid-cols-[minmax(60px,1fr)_minmax(0,2fr)] gap-x-2 gap-y-1 max-h-56 overflow-auto">
      {Object.entries(fields).map(([key,value])=><React.Fragment key={key}><dt className="text-monokai-comment break-words">{key}</dt><dd className="m-0 break-words">{display(value)}</dd></React.Fragment>)}
    </dl>
    {node?._trace?.sql && <details><summary className="cursor-pointer text-monokai-cyan">数据集查询定义</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">{node._trace.sql}</pre></details>}
    <details><summary className="cursor-pointer text-monokai-cyan">原始查询记录 · {selected._rowIndices?.length || 0} 行</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">{json((selected._rowIndices || []).map((i:number)=>rows[i]))}</pre></details>
  </section>;
}
