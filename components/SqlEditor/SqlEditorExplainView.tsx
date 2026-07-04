/**
 * SqlEditorExplainView — "Explain" view of query results.
 *
 * Renders EXPLAIN ANALYZE output in three modes:
 * 1. DAG (Mermaid flowchart)
 * 2. Tree (Nested cards)
 * 3. Raw (Original text output)
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
import { MermaidChart } from '../MermaidChart';

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

// Generate a valid Mermaid string from explain plan tree nodes
function generateMermaidFromExplainNodes(nodes: ExplainNode[]): string {
  let mermaid = 'graph TD\n';
  const nodeDefinitions: string[] = [];
  const links: string[] = [];

  // Custom styling variables
  mermaid += '  %% Custom style configurations\n';

  function traverse(node: ExplainNode) {
    const safeId = `node_${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const timing = node.annotations.find(a => a.includes('Actual time') || a.includes('Cumulative time')) || '';
    const cleanTiming = timing ? `<br/>${timing.replace(/"/g, "'").trim()}` : '';
    const cost = node.costFraction !== undefined ? `<br/>Cost: ${Math.round(node.costFraction * 100)}%` : '';
    
    // Choose shape based on type
    let shapeStart = '[';
    let shapeEnd = ']';
    if (node.type === 'scan') {
      shapeStart = '([';
      shapeEnd = '])';
    } else if (node.type === 'join') {
      shapeStart = '{';
      shapeEnd = '}';
    } else if (node.type === 'aggregate') {
      shapeStart = '[/';
      shapeEnd = '/]';
    } else if (node.type === 'filter') {
      shapeStart = '>';
      shapeEnd = ']';
    }

    const label = `"${node.name}${cleanTiming}${cost}"`;
    nodeDefinitions.push(`  ${safeId}${shapeStart}${label}${shapeEnd}`);

    // Color schema
    const colors: Record<string, string> = {
      scan: 'fill:#1e293b,stroke:#0ea5e9,stroke-width:2px,color:#38bdf8',
      join: 'fill:#1e293b,stroke:#eab308,stroke-width:2px,color:#fde047',
      aggregate: 'fill:#1e293b,stroke:#a855f7,stroke-width:2px,color:#c084fc',
      sort: 'fill:#1e293b,stroke:#22c55e,stroke-width:2px,color:#4ade80',
      projection: 'fill:#1e293b,stroke:#22c55e,stroke-width:1px,color:#f8f8f2',
      filter: 'fill:#1e293b,stroke:#f97316,stroke-width:2px,color:#fb923c',
      result: 'fill:#1e293b,stroke:#ec4899,stroke-width:3px,color:#f472b6',
    };
    const style = colors[node.type] || 'fill:#1e293b,stroke:#64748b,color:#f8f8f2';
    nodeDefinitions.push(`  style ${safeId} ${style}`);

    for (const child of node.children) {
      const childSafeId = `node_${child.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      // In database query plans, data flows bottom-up (from child to parent)
      links.push(`  ${childSafeId} --> ${safeId}`);
      traverse(child);
    }
  }

  nodes.forEach(traverse);
  return mermaid + nodeDefinitions.join('\n') + '\n' + links.join('\n');
}

export const SqlEditorExplainView: React.FC<SqlEditorExplainViewProps> = ({ result }) => {
  const [viewMode, setViewMode] = useState<'dag' | 'tree' | 'raw'>('dag');
  
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

  const mermaidChartCode = useMemo(() => {
    if (!nodes || nodes.length === 0) return '';
    return generateMermaidFromExplainNodes(nodes);
  }, [nodes]);

  const hasBoxes = /[┌┬├╔╦╠#*√]/.test(rawText);

  return (
    <div className="p-4 overflow-auto h-full custom-scrollbar">
      <div className="bg-monokai-surface rounded border border-monokai-accent/50 overflow-hidden flex flex-col h-full min-h-[400px]">
        {/* Header */}
        <div className="px-3 py-2 bg-monokai-bg border-b border-monokai-accent/30 flex items-center gap-2 shrink-0">
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
          
          {/* Mode Switcher */}
          <div className="flex rounded overflow-hidden border border-monokai-accent/40 bg-monokai-surface text-[9px] font-mono">
            <button
              onClick={() => setViewMode('dag')}
              className={`px-2.5 py-1 transition-colors ${viewMode === 'dag' ? 'bg-monokai-purple text-white font-bold' : 'text-monokai-comment hover:bg-monokai-accent/50'}`}
              disabled={!mermaidChartCode}
            >
              DAG 图形
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2.5 py-1 transition-colors ${viewMode === 'tree' ? 'bg-monokai-purple text-white font-bold' : 'text-monokai-comment hover:bg-monokai-accent/50'}`}
            >
              树状图 (Tree)
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 transition-colors ${viewMode === 'raw' ? 'bg-monokai-purple text-white font-bold' : 'text-monokai-comment hover:bg-monokai-accent/50'}`}
            >
              原始文本 (Raw)
            </button>
          </div>

          <span className="text-[9px] text-monokai-comment/40 font-mono">
            {rawText.split('\n').length} lines
          </span>
        </div>

        {/* Content Area */}
        <div className="p-3 overflow-auto flex-1 min-h-0">
          {viewMode === 'dag' && mermaidChartCode ? (
            <div className="bg-monokai-bg/30 rounded border border-monokai-accent/20 p-2 min-h-[350px]">
              <MermaidChart chart={mermaidChartCode} />
            </div>
          ) : viewMode === 'tree' && nodes && nodes.length > 0 ? (
            <div className="space-y-0.5">
              {nodes.map(node => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          ) : (
            <pre className="text-xs font-mono text-monokai-fg whitespace-pre leading-relaxed custom-scrollbar overflow-auto">
              {rawText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlEditorExplainView;
