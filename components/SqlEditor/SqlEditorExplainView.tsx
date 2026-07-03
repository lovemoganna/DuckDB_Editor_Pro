/**
 * SqlEditorExplainView — "Explain" view of query results.
 *
 * Loop 5/6 of SqlEditor Pro refactor.
 * Renders EXPLAIN ANALYZE output. Attempts structured tree rendering
 * when DuckDB box-drawing output is available; falls back to raw pre block.
 */

import React, { useMemo, useState } from 'react';
import type { QueryResult } from '../../types';
import {
  parseExplainOutput,
  formatCost,
  formatCardinality,
  costColor,
  type ExplainNode,
} from '../../utils/explainParser';

export interface SqlEditorExplainViewProps {
  result: QueryResult;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  scan:       'border-monokai-blue text-monokai-blue',
  join:       'border-monokai-yellow text-monokai-yellow',
  aggregate:  'border-monokai-purple text-monokai-purple',
  sort:       'border-monokai-green text-monokai-green',
  projection: 'border-monokai-cyan text-monokai-cyan',
  filter:     'border-monokai-orange text-monokai-orange',
  result:     'border-monokai-accent text-monokai-accent',
  other:      'border-monokai-comment/40 text-monokai-comment/80',
};

function NodeCard({ node, depth = 0 }: { node: ExplainNode; depth?: number }) {
  const colorClass = NODE_TYPE_COLORS[node.type] ?? NODE_TYPE_COLORS.other;
  const timing = node.annotations.find(a => a.includes('Actual time') || a.includes('Cumulative time'));

  return (
    <div className="mb-1" style={{ marginLeft: depth * 16 }}>
      {/* Node header box */}
      <div className={`inline-flex flex-col rounded border ${colorClass.split(' ')[0]}/40 bg-monokai-bg px-2 py-1.5 min-w-[180px]`}>
        <div className={`text-[10px] font-bold ${colorClass.split(' ')[1]}`}>
          {node.name}
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-2 mt-0.5">
          {node.estimatedCost !== undefined && (
            <span className={`text-[9px] font-mono ${costColor(node.costFraction)}`}>
              EC {formatCost(node.estimatedCost)}
            </span>
          )}
          {node.costFraction !== undefined && (
            <span className={`text-[9px] font-mono ${costColor(node.costFraction)}`}>
              {Math.round(node.costFraction * 100)}%
            </span>
          )}
          {node.estimatedCardinalities && (
            <span className="text-[9px] font-mono text-monokai-comment/60">
              {formatCardinality(node.estimatedCardinalities[0])} → {formatCardinality(node.estimatedCardinalities[1])}
            </span>
          )}
        </div>

        {/* Timing */}
        {timing && (
          <div className="text-[9px] font-mono text-monokai-comment/50 mt-0.5">
            {timing}
          </div>
        )}
      </div>

      {/* Annotations */}
      {node.annotations.filter(a => !a.includes('Actual time') && !a.includes('Cumulative')).map((ann, i) => (
        <div key={i} className="text-[9px] font-mono text-monokai-comment/60 mt-0.5 ml-1" style={{ marginLeft: 8 }}>
          {ann}
        </div>
      ))}

      {/* Children */}
      {node.children.map(child => (
        <NodeCard key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export const SqlEditorExplainView: React.FC<SqlEditorExplainViewProps> = ({ result }) => {
  const [showRaw, setShowRaw] = useState(false);
  const rawText = useMemo(() => {
    return result.rows.map(r =>
      String(r['explain_value'] ?? r['explore_value'] ?? JSON.stringify(r))
    ).join('\n');
  }, [result.rows]);

  const nodes = useMemo(() => {
    try {
      return parseExplainOutput(rawText);
    } catch {
      return null;
    }
  }, [rawText]);

  const hasBoxes = /[┌┬├╔╦╠#*√]/.test(rawText);

  return (
    <div className="p-4 overflow-auto h-full custom-scrollbar">
      <div className="bg-monokai-surface rounded border border-monokai-accent/50 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 bg-monokai-bg border-b border-monokai-accent/30 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-monokai-yellow" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-monokai-yellow/70">
            EXPLAIN ANALYZE
          </span>
          {hasBoxes && (
            <span className="text-[9px] text-monokai-green/60 bg-monokai-green/10 px-1.5 py-0.5 rounded border border-monokai-green/30">
              Tree parsed
            </span>
          )}
          <div className="h-px flex-1 bg-monokai-accent/20" />
          
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-[9px] px-2 py-0.5 bg-monokai-surface hover:bg-monokai-accent text-monokai-comment hover:text-monokai-fg rounded border border-monokai-accent/40 font-mono transition-colors"
          >
            {showRaw ? '切换图形树 (Tree)' : '切换原始文本 (Raw)'}
          </button>

          <span className="text-[9px] text-monokai-comment/40 font-mono">
            {rawText.split('\n').length} lines
          </span>
        </div>

        {/* Content */}
        <div className="p-3 overflow-auto max-h-[calc(100vh-300px)]">
          {!showRaw && nodes && nodes.length > 0 ? (
            <div className="space-y-0.5">
              {nodes.map(node => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          ) : (
            <pre className="text-xs font-mono text-monokai-fg whitespace-pre-wrap leading-relaxed">
              {rawText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlEditorExplainView;
