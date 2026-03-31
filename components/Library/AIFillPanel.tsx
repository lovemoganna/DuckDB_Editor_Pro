/**
 * AIFillPanel — Ontology 模块 AI 一键填充通用面板
 *
 * 功能：
 * - 统一的 AI 填充入口 UI
 * - 支持单输入/双输入模式
 * - 加载/错误/结果展示
 * - 二次优化入口
 * - 快速清除
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Loader, X, ChevronDown, ChevronUp,
  Copy, ArrowDownRight, RotateCcw, Check,
  AlertTriangle, Zap, Lightbulb,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { EditorView } from '@codemirror/view';
import { AIFillMode, MODE_LABELS, MODE_DESCRIPTIONS } from '../../hooks/useAIFill';

// ============================================================
// Props
// ============================================================

interface AIFillPanelProps {
  mode: AIFillMode;
  isLoading: boolean;
  error: string | null;
  result: any | null;
  input: string;
  secondaryInput?: string;
  secondaryInput2?: string;
  /** 点击「采用」按钮 */
  onAccept?: (result: any) => void;
  /** 点击「注入 SQL」按钮 */
  onInjectSQL?: (sql: string) => void;
  /** 输入变化 */
  onInputChange: (v: string) => void;
  /** 副输入变化 */
  onSecondaryChange?: (v: string) => void;
  /** 副输入2变化 */
  onSecondary2Change?: (v: string) => void;
  /** 执行填充 */
  onExecute: () => void;
  /** 取消 */
  onAbort?: () => void;
  /** 清除 */
  onClear: () => void;
  /** 二次优化 */
  onRefine?: (feedback: string) => void;
  /** 展开/收起结果 */
  defaultExpanded?: boolean;
}

const LAYER_COLORS: Record<AIFillMode, string> = {
  foundation:    'monokai-purple',
  relations:     'monokai-green',
  methodology:   'monokai-cyan',
  patterns:      'monokai-yellow',
  domains:      'monokai-blue',
  graph:        'monokai-orange',
  canvas:       'monokai-orange',
  crud:         'monokai-blue',
  introspection: 'monokai-yellow',
  suggestions:  'monokai-green',
};

// ============================================================
// Helpers
// ============================================================

function extractSQL(result: any): string | null {
  if (!result) return null;
  return (
    result.suggestedDDL ||
    result.suggestedDML ||
    result.initializationSQL ||
    result.sql ||
    null
  );
}

function renderResultPreview(result: any, mode: AIFillMode): React.ReactNode {
  if (!result) return null;
  const color = LAYER_COLORS[mode];

  switch (mode) {
    case 'foundation': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.objectTypes?.length > 0 && (
            <div>
              <div className="text-[10px] text-monokai-purple font-bold uppercase tracking-wider mb-1.5">对象类型</div>
              <div className="grid grid-cols-1 gap-1.5">
                {r.objectTypes.map((ot: any, i: number) => (
                  <div key={i} className="px-3 py-2 bg-monokai-purple/5 border border-monokai-purple/20 rounded-lg">
                    <div className="text-xs font-semibold text-monokai-fg">{ot.name}</div>
                    <div className="text-[10px] text-monokai-comment mt-0.5">{ot.description}</div>
                    {ot.properties && Object.keys(ot.properties).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(ot.properties).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.5 bg-monokai-purple/10 text-monokai-purple/80 text-[9px] rounded font-mono">{k}: {v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.objects?.length > 0 && (
            <div>
              <div className="text-[10px] text-monokai-blue font-bold uppercase tracking-wider mb-1.5">对象实例</div>
              <div className="grid grid-cols-1 gap-1">
                {r.objects.map((obj: any, i: number) => (
                  <div key={i} className="px-3 py-1.5 bg-monokai-blue/5 border border-monokai-blue/20 rounded flex items-center justify-between">
                    <div>
                      <span className="text-xs text-monokai-fg">{obj.name}</span>
                      <span className="ml-2 text-[9px] text-monokai-purple/70">({obj.typeName})</span>
                    </div>
                    {obj.annotations && <span className="text-[9px] text-monokai-comment italic">{obj.annotations}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.linkTypes?.length > 0 && (
            <div>
              <div className="text-[10px] text-monokai-green font-bold uppercase tracking-wider mb-1.5">关系类型</div>
              <div className="flex flex-wrap gap-1.5">
                {r.linkTypes.map((lt: any, i: number) => (
                  <span key={i} className="px-2 py-1 bg-monokai-green/10 text-monokai-green text-[10px] rounded border border-monokai-green/20">{lt.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'relations': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.linkType && (
            <div className="px-3 py-2 bg-monokai-green/5 border border-monokai-green/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-monokai-green/20 text-monokai-green text-[10px] rounded font-mono font-bold">{r.linkType.name}</span>
                {r.linkType.temporal && <span className="text-[9px] text-monokai-cyan border border-monokai-cyan/30 px-1.5 py-0.5 rounded">时态</span>}
              </div>
              <div className="text-[10px] text-monokai-comment">{r.linkType.description}</div>
            </div>
          )}
          {r.linkInstances?.length > 0 && (
            <div>
              <div className="text-[10px] text-monokai-orange font-bold uppercase tracking-wider mb-1.5">关系实例</div>
              {r.linkInstances.map((li: any, i: number) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-3 bg-monokai-orange/5 border border-monokai-orange/20 rounded mb-1">
                  <span className="text-xs text-monokai-purple">{li.sourceName}</span>
                  <span className="text-monokai-comment">→</span>
                  <span className="px-1.5 py-0.5 bg-monokai-green/15 text-monokai-green text-[10px] rounded">{r.linkType?.name}</span>
                  <span className="text-monokai-comment">→</span>
                  <span className="text-xs text-monokai-blue">{li.targetName}</span>
                  <span className="ml-auto px-1.5 py-0.5 bg-monokai-orange/10 text-monokai-orange text-[10px] rounded font-mono">{Number(li.weight).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'methodology': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.recommendedMethod && (
            <div className="flex items-center gap-2 px-3 py-2 bg-monokai-cyan/5 border border-monokai-cyan/20 rounded-lg">
              <Lightbulb className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />
              <span className="text-xs font-bold text-monokai-cyan">{r.recommendedMethod}</span>
              {r.totalComplexity && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  r.totalComplexity === 'low' ? 'bg-monokai-green/20 text-monokai-green' :
                  r.totalComplexity === 'medium' ? 'bg-monokai-yellow/20 text-monokai-yellow' :
                  'bg-monokai-orange/20 text-monokai-orange'
                }`}>{r.totalComplexity.toUpperCase()}</span>
              )}
            </div>
          )}
          {r.steps?.length > 0 && (
            <div className="space-y-1.5">
              {r.steps.map((step: any, i: number) => (
                <div key={i} className="flex gap-2.5 px-3 py-2 bg-monokai-sidebar border border-monokai-accent/20 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-monokai-cyan/20 text-monokai-cyan text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step.step}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-monokai-fg">{step.action}</div>
                    {step.introspection && <div className="text-[10px] text-monokai-purple/80 mt-0.5 italic">? {step.introspection}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'patterns': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.patternType && (
            <div className="px-3 py-2 bg-monokai-yellow/5 border border-monokai-yellow/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-monokai-yellow uppercase">{r.patternType}</span>
              </div>
              <div className="text-[10px] text-monokai-comment">{r.description}</div>
            </div>
          )}
          {r.tips?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.tips.map((tip: string, i: number) => (
                <span key={i} className="px-2 py-1 bg-monokai-yellow/10 text-monokai-yellow/80 text-[9px] rounded border border-monokai-yellow/20">{tip}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'domains': {
      const r = result as any;
      return (
        <div className="space-y-3">
          <div className="text-center py-2">
            <span className="text-sm font-bold text-monokai-blue">{r.domainName}</span>
            <span className="text-[10px] text-monokai-comment ml-2">完整领域模型</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 bg-monokai-purple/5 border border-monokai-purple/20 rounded-lg">
              <div className="text-[10px] text-monokai-purple font-bold mb-1">对象类型 ({r.objectTypes?.length || 0})</div>
              {r.objectTypes?.slice(0, 3).map((ot: any, i: number) => (
                <div key={i} className="text-[10px] text-monokai-fg">{ot.name}</div>
              ))}
              {(r.objectTypes?.length || 0) > 3 && <div className="text-[9px] text-monokai-comment">+{r.objectTypes.length - 3} 更多</div>}
            </div>
            <div className="px-3 py-2 bg-monokai-green/5 border border-monokai-green/20 rounded-lg">
              <div className="text-[10px] text-monokai-green font-bold mb-1">关系类型 ({r.linkTypes?.length || 0})</div>
              {r.linkTypes?.slice(0, 3).map((lt: any, i: number) => (
                <div key={i} className="text-[10px] text-monokai-fg">{lt.name}</div>
              ))}
              {(r.linkTypes?.length || 0) > 3 && <div className="text-[9px] text-monokai-comment">+{r.linkTypes.length - 3} 更多</div>}
            </div>
            <div className="px-3 py-2 bg-monokai-blue/5 border border-monokai-blue/20 rounded-lg">
              <div className="text-[10px] text-monokai-blue font-bold mb-1">种子对象 ({r.seedObjects?.length || 0})</div>
              {r.seedObjects?.slice(0, 3).map((s: any, i: number) => (
                <div key={i} className="text-[10px] text-monokai-fg">{s.name}</div>
              ))}
            </div>
            <div className="px-3 py-2 bg-monokai-orange/5 border border-monokai-orange/20 rounded-lg">
              <div className="text-[10px] text-monokai-orange font-bold mb-1">种子关系 ({r.seedLinks?.length || 0})</div>
              {r.seedLinks?.slice(0, 3).map((sl: any, i: number) => (
                <div key={i} className="text-[10px] text-monokai-fg">{sl.linkTypeName}</div>
              ))}
            </div>
          </div>
          {r.views?.length > 0 && (
            <div className="px-3 py-2 bg-monokai-yellow/5 border border-monokai-yellow/20 rounded-lg">
              <div className="text-[10px] text-monokai-yellow font-bold mb-1">推荐视图 ({r.views.length})</div>
              <div className="flex flex-wrap gap-1">
                {r.views.map((v: any, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-monokai-yellow/10 text-monokai-yellow/80 text-[9px] rounded font-mono">{v.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'graph': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.layoutAlgorithm && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-monokai-orange/5 border border-monokai-orange/20 rounded">
              <Zap className="w-3 h-3 text-monokai-orange" />
              <span className="text-[10px] text-monokai-orange">推荐算法：{r.layoutAlgorithm}</span>
            </div>
          )}
          {r.nodes?.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {r.nodes.slice(0, 9).map((node: any, i: number) => (
                <div key={i} className={`px-2 py-1.5 rounded border text-center text-[10px] ${
                  node.color === 'purple' ? 'bg-monokai-purple/10 border-monokai-purple/30 text-monokai-purple' :
                  node.color === 'blue' ? 'bg-monokai-blue/10 border-monokai-blue/30 text-monokai-blue' :
                  node.color === 'green' ? 'bg-monokai-green/10 border-monokai-green/30 text-monokai-green' :
                  node.color === 'orange' ? 'bg-monokai-orange/10 border-monokai-orange/30 text-monokai-orange' :
                  'bg-monokai-yellow/10 border-monokai-yellow/30 text-monokai-yellow'
                }`}>
                  <div className="font-semibold truncate">{node.label}</div>
                  <div className="text-[9px] opacity-60">{node.type}</div>
                </div>
              ))}
              {(r.nodes?.length || 0) > 9 && <div className="px-2 py-1.5 text-center text-[10px] text-monokai-comment">+{r.nodes.length - 9} 更多</div>}
            </div>
          )}
          {r.edges?.length > 0 && (
            <div className="text-[10px] text-monokai-comment">
              {r.edges.length} 条关系边，建议使用 {r.layoutAlgorithm} 布局
            </div>
          )}
        </div>
      );
    }

    case 'canvas': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.layoutDescription && (
            <div className="px-3 py-2 bg-monokai-orange/5 border border-monokai-orange/20 rounded text-[10px] text-monokai-comment italic">
              {r.layoutDescription}
            </div>
          )}
          {r.spaces?.length > 0 && (
            <div className="space-y-1.5">
              {r.spaces.map((space: any, i: number) => (
                <div key={i} className="px-3 py-2 bg-monokai-sidebar border border-monokai-accent/20 rounded-lg">
                  <div className="text-xs font-semibold text-monokai-fg mb-1">{space.name}</div>
                  <div className="text-[9px] text-monokai-comment">位置: ({space.x}, {space.y}) 尺寸: {space.w}×{space.h}</div>
                  {space.groups?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {space.groups.map((g: any, j: number) => (
                        <span key={j} className="px-1.5 py-0.5 bg-monokai-blue/10 text-monokai-blue/80 text-[9px] rounded">{g.name} ({g.items?.length || 0})</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'introspection': {
      const r = result as any;
      return (
        <div className="space-y-3">
          {r.questions?.length > 0 && (
            <div className="space-y-1.5">
              {r.questions.map((q: any, i: number) => (
                <div key={i} className="px-3 py-2 bg-monokai-yellow/5 border border-monokai-yellow/20 rounded-lg">
                  <div className="text-xs font-semibold text-monokai-yellow mb-0.5">Q{i + 1}: {q.question}</div>
                  <div className="text-[10px] text-monokai-comment italic">提示：{q.hint}</div>
                  {q.relatedConcepts?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {q.relatedConcepts.map((c: string, j: number) => (
                        <span key={j} className="px-1.5 py-0.5 bg-monokai-purple/10 text-monokai-purple/80 text-[9px] rounded">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {r.reflectionTemplate && (
            <div className="px-3 py-2 bg-monokai-sidebar border border-monokai-accent/20 rounded">
              <div className="text-[10px] text-monokai-purple font-bold mb-1">反思模板</div>
              <pre className="text-[9px] text-monokai-comment whitespace-pre-wrap font-mono">{r.reflectionTemplate.slice(0, 200)}...</pre>
            </div>
          )}
        </div>
      );
    }

    case 'suggestions': {
      const arr = Array.isArray(result) ? result : [];
      return (
        <div className="space-y-1.5">
          {arr.map((item: any, i: number) => (
            <div key={i} className="px-3 py-2 bg-monokai-green/5 border border-monokai-green/20 rounded-lg">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                  item.type === 'object' ? 'bg-monokai-purple/20 text-monokai-purple' :
                  item.type === 'link' ? 'bg-monokai-green/20 text-monokai-green' :
                  item.type === 'action' ? 'bg-monokai-yellow/20 text-monokai-yellow' :
                  'bg-monokai-blue/20 text-monokai-blue'
                }`}>{item.type}</span>
                <span className="text-xs font-semibold text-monokai-fg">{item.title}</span>
                <span className="ml-auto text-[9px] text-monokai-comment font-mono">{(item.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="text-[10px] text-monokai-comment">{item.description}</div>
            </div>
          ))}
          {arr.length === 0 && (
            <div className="text-center py-4 text-[10px] text-monokai-comment">暂无建议</div>
          )}
        </div>
      );
    }

    case 'crud': {
      const r = result as any;
      return (
        <div className="space-y-2">
          {r.mode && (
            <div className="px-3 py-2 bg-monokai-blue/5 border border-monokai-blue/20 rounded-lg">
              <div className="text-[10px] text-monokai-blue font-bold uppercase mb-1">{r.mode} 模式</div>
              {r.name && <div className="text-xs text-monokai-fg font-semibold">{r.name}</div>}
              {r.description && <div className="text-[10px] text-monokai-comment mt-0.5">{r.description}</div>}
              {r.properties && Object.keys(r.properties).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(r.properties).map(([k, v]) => (
                    <span key={k} className="px-1.5 py-0.5 bg-monokai-purple/10 text-monokai-purple/80 text-[9px] rounded font-mono">{k}: {String(v)}</span>
                  ))}
                </div>
              )}
              {(r.objectTypeName || r.linkTypeName) && (
                <div className="flex gap-1 mt-1">
                  {r.objectTypeName && <span className="px-1.5 py-0.5 bg-monokai-purple/15 text-monokai-purple text-[9px] rounded">{r.objectTypeName}</span>}
                  {r.linkTypeName && <span className="px-1.5 py-0.5 bg-monokai-green/15 text-monokai-green text-[9px] rounded">{r.linkTypeName}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    default:
      return (
        <pre className="text-[10px] text-monokai-comment font-mono overflow-auto max-h-48">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

// ============================================================
// Component
// ============================================================

export const AIFillPanel: React.FC<AIFillPanelProps> = ({
  mode,
  isLoading,
  error,
  result,
  input,
  secondaryInput,
  secondaryInput2,
  onInputChange,
  onSecondaryChange,
  onSecondary2Change,
  onExecute,
  onAbort,
  onClear,
  onAccept,
  onInjectSQL,
  onRefine,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [refineInput, setRefineInput] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const color = LAYER_COLORS[mode];
  const hasResult = result !== null && result !== undefined;
  const hasSQL = extractSQL(result) !== null;

  // Show secondary inputs for relations mode
  const showSecondary = mode === 'relations';
  const showSecondary2 = mode === 'relations' || mode === 'patterns';

  return (
    <div className={`border rounded-xl overflow-hidden bg-monokai-sidebar border-monokai-accent/40`}>
      {/* Header */}
      <div className={`px-4 py-2.5 border-b border-monokai-accent/30 flex items-center justify-between bg-${color}/5`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 text-${color}`} />
          <span className={`text-xs font-bold text-${color} uppercase tracking-wider`}>
            {MODE_LABELS[mode]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasResult && (
            <button onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={onClear} title="快速清除"
            className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className={`p-4 space-y-3 border-b border-monokai-accent/20 bg-${color}/[0.02]`}>
        {/* Primary Input */}
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !isLoading) onExecute(); if (e.key === 'Escape') onClear(); }}
            placeholder={MODE_DESCRIPTIONS[mode]}
            className={`w-full bg-black/30 border text-xs text-monokai-fg placeholder-monokai-${color}/30 rounded-lg py-2 px-3 pr-20 focus:outline-none focus:border-${color}/60 focus:ring-1 focus:ring-${color}/30 transition-all`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {input && (
              <button onClick={onClear} className={`p-1 rounded text-monokai-${color}/40 hover:text-monokai-${color} transition-colors`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Input (for relations mode) */}
        {showSecondary && onSecondaryChange && (
          <div className="relative">
            <input
              type="text"
              value={secondaryInput || ''}
              onChange={e => onSecondaryChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isLoading) onExecute(); }}
              placeholder="目标对象（如：公司、课程）"
              className="w-full bg-black/30 border border-monokai-accent text-xs text-monokai-fg placeholder-monokai-comment/40 rounded-lg py-2 px-3 pr-8 focus:outline-none focus:border-monokai-green/60 focus:ring-1 focus:ring-monokai-green/30 transition-all"
            />
          </div>
        )}

        {/* Secondary Input 2 (context / pattern type) */}
        {showSecondary2 && onSecondary2Change && (
          <div className="relative">
            <input
              type="text"
              value={secondaryInput2 || ''}
              onChange={e => onSecondary2Change(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isLoading) onExecute(); }}
              placeholder={mode === 'relations' ? '上下文（可选）：如雇佣、学术...' : mode === 'patterns' ? '应用上下文（可选）' : ''}
              className="w-full bg-black/30 border border-monokai-accent text-xs text-monokai-fg placeholder-monokai-comment/40 rounded-lg py-2 px-3 focus:outline-none focus:border-monokai-cyan/60 focus:ring-1 focus:ring-monokai-cyan/30 transition-all"
            />
          </div>
        )}

        {/* Execute Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={isLoading ? onAbort : onExecute}
            disabled={isLoading || (!input.trim() && mode !== 'suggestions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
              isLoading
                ? 'bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/40 cursor-pointer'
                : 'bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/40 hover:bg-monokai-orange/30 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <><Loader className="w-3.5 h-3.5 animate-spin" /> 构思中...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> AI 构思{mode === 'suggestions' ? '' : ' · Enter'}</>
            )}
          </button>
          {!isLoading && (
            <span className="text-[9px] text-monokai-comment shrink-0">Ctrl+Shift+O</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-monokai-orange/10 border border-monokai-orange/30 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-monokai-orange shrink-0" />
            <span className="text-[10px] text-monokai-orange">{error}</span>
          </div>
        )}
      </div>

      {/* Result Area */}
      {hasResult && expanded && (
        <div className="p-4 space-y-3">
          {/* Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-monokai-comment uppercase tracking-wider font-bold">生成结果</span>
              {hasSQL && (
                <button
                  onClick={() => { const s = extractSQL(result); if (s) onInjectSQL?.(s); }}
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-monokai-cyan border border-monokai-cyan/30 rounded hover:bg-monokai-cyan/10 transition-colors">
                  <ArrowDownRight className="w-3 h-3" /> 注入 SQL
                </button>
              )}
            </div>
            {renderResultPreview(result, mode)}
          </div>

          {/* Accept Button */}
          {onAccept && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => onAccept(result)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold bg-monokai-green/20 text-monokai-green border border-monokai-green/40 hover:bg-monokai-green/30 transition-colors">
                <Check className="w-3.5 h-3.5" /> 采用
              </button>
            </div>
          )}

          {/* Secondary Refine */}
          {onRefine && (
            <div className="border-t border-monokai-accent/20 pt-3 mt-2">
              {!showRefine ? (
                <button onClick={() => setShowRefine(true)}
                  className="w-full py-1.5 text-[10px] text-monokai-comment hover:text-monokai-fg border border-dashed border-monokai-accent/40 rounded hover:border-monokai-fg/30 transition-colors">
                  再细化一下...
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refineInput}
                    onChange={e => setRefineInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && refineInput.trim()) { onRefine(refineInput); setRefineInput(''); setShowRefine(false); } }}
                    placeholder="描述你想细化或调整的方向..."
                    className="flex-1 bg-black/30 border border-monokai-accent text-[10px] text-monokai-fg placeholder-monokai-comment/40 rounded-lg py-1.5 px-3 focus:outline-none focus:border-monokai-yellow/60 transition-all"
                  />
                  <button onClick={() => { if (refineInput.trim()) { onRefine(refineInput); setRefineInput(''); setShowRefine(false); } }}
                    className="px-3 py-1.5 bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/40 rounded-lg text-[10px] font-bold hover:bg-monokai-yellow/30 transition-colors">
                    优化
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// AIFillModal — Full-screen modal version
// ============================================================

interface AIFillModalProps extends AIFillPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export const AIFillModal: React.FC<AIFillModalProps> = ({
  open, onClose, title, ...props
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-monokai-bg border border-monokai-accent/50 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-monokai-accent/30 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-monokai-purple" />
            <span className="text-sm font-bold text-monokai-fg">{title || MODE_LABELS[props.mode]}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AIFillPanel {...props} />
        </div>
      </div>
    </div>
  );
};
