import React from 'react';
import { DataLineageGraph } from '../../services/LineageService';
import { AlertTriangle, Columns, Database, GitBranch, Table, X } from 'lucide-react';

interface LineageGraphViewProps {
  graph: DataLineageGraph;
  onClose?: () => void;
}

const RELATION_LABELS: Record<DataLineageGraph['edges'][number]['relationType'], string> = {
  TRANSFORM: '转换',
  DERIVED_FROM: '派生自',
  JOIN_ON: '连接',
  AGGREGATED_BY: '聚合',
};

export const LineageGraphView: React.FC<LineageGraphViewProps> = ({ graph, onClose }) => {
  const nodesById = new Map(graph.nodes.map(node => [node.id, node]));
  const diagnostics = graph.diagnostics;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-monokai-accent/20 bg-monokai-bg p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-monokai-accent/20 pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-monokai-cyan" />
          <h3 className="text-base font-bold text-monokai-fg">数据血缘与转换关系</h3>
          <span className="rounded bg-monokai-surface px-2 py-0.5 text-[10px] text-monokai-comment">
            {diagnostics.parser}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-monokai-comment transition-colors hover:bg-monokai-accent/20 hover:text-white"
            aria-label="关闭血缘视图"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {diagnostics.confidence !== 'exact' && (
        <div
          className={`mb-3 rounded-lg border p-3 text-xs ${
            diagnostics.confidence === 'blocked'
              ? 'border-monokai-pink/40 bg-monokai-pink/10 text-monokai-pink'
              : 'border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow'
          }`}
          role="alert"
        >
          <div className="mb-1 flex items-center gap-1 font-bold">
            <AlertTriangle className="h-3.5 w-3.5" />
            {diagnostics.confidence === 'blocked' ? 'SQL 无法解析，血缘已阻止' : '部分血缘需要人工确认'}
          </div>
          {[...diagnostics.errors, ...diagnostics.warnings].map((message, index) => (
            <p key={`${message}:${index}`}>{message}</p>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-lg border border-monokai-accent/10 bg-monokai-sidebar/40 p-4">
        {graph.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-monokai-comment">
            <p>暂无可展示的血缘关系。</p>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-monokai-yellow">
                <Table className="h-4 w-4" /> 上游物理表
              </h4>
              <div className="flex flex-wrap gap-3">
                {graph.nodes.filter(node => node.type === 'table').map(node => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 rounded-lg border border-monokai-yellow/30 bg-monokai-surface px-3 py-2 font-mono text-xs text-monokai-fg shadow-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-monokai-yellow" />
                    {node.label}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-monokai-cyan">
                <Columns className="h-4 w-4" /> 字段与指标节点
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {graph.nodes.filter(node => node.type !== 'table').map(node => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between rounded-lg border border-monokai-cyan/30 bg-monokai-surface p-3 font-mono text-xs text-monokai-fg"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${node.type === 'metric' ? 'bg-monokai-pink' : 'bg-monokai-cyan'}`} />
                      <span>{node.label}</span>
                    </div>
                    <span className="text-[10px] text-monokai-comment">{node.table || 'result'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-monokai-green">
                <GitBranch className="h-4 w-4" /> 转换边
              </h4>
              <div className="space-y-2">
                {graph.edges.map((edge, index) => (
                  <div
                    key={`${edge.source}:${edge.target}:${edge.relationType}:${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-monokai-green/20 bg-monokai-surface px-3 py-2 text-xs"
                  >
                    <span className="truncate font-mono text-monokai-cyan" title={nodesById.get(edge.source)?.label ?? edge.source}>
                      {nodesById.get(edge.source)?.label ?? edge.source}
                    </span>
                    <span className="rounded bg-monokai-green/10 px-2 py-0.5 text-[10px] text-monokai-green">
                      {RELATION_LABELS[edge.relationType]} →
                    </span>
                    <span className="truncate font-mono text-monokai-fg" title={nodesById.get(edge.target)?.label ?? edge.target}>
                      {nodesById.get(edge.target)?.label ?? edge.target}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default LineageGraphView;
