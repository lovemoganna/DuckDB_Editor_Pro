/**
 * CanvasRightPanel — SQL preview and node inspector panel
 *
 * Optimized: unified spacing (multiples of 8px), consistent typography,
 * SQL block max-height 320px, CTA button with hover glow.
 */

import React from 'react';
import {
  X, Terminal, Sparkles, Trash2
} from 'lucide-react';
import type { CanvasState, CanvasItem } from './OntologyCanvas.types';

interface CompileResult {
  success: boolean;
  sql: string;
  ctes: any[];
  warnings: string[];
  errors: any[];
  mode: 'pipeline' | 'knowledge' | 'explorer';
}

interface CanvasRightPanelProps {
  selectedItem: CanvasItem | null;
  selectedItemId: string | null;
  objects: any[];
  objectTypes: any[];
  canvasState: CanvasState;
  compileResult: CompileResult;
  showRefinePanel: boolean;
  refineInput: string;
  isRefining: boolean;
  refineResult: { summary: string; steps: any[] } | null;
  onUpdateNode: (id: string, updates: any) => void;
  onDeleteItem: (id: string) => void;
  onShowRefinePanel: () => void;
  onRefineInputChange: (v: string) => void;
  onRefine: () => void;
  onCloseRefine: () => void;
  onInsert: (sql: string) => void;
}

// ── Monokai palette ─────────────────────────────────────────────────────────
const MK = {
  blue:       '#818cf8',
  green:      '#4ade80',
  orange:     '#fb923c',
  red:        '#f87171',
  indigo:     '#6366f1',
  muted:      '#64748b',
  faint:      '#94a3b8',
  bg:         'rgba(13,13,20,0.98)',
} as const;

// ── Shared label style (10px uppercase) ──────────────────────────────────────
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: MK.muted,
  display: 'block',
  marginBottom: 4,
};

// ── Node Inspector Mode ────────────────────────────────────────────────────────
interface NodeInspectorProps {
  selectedItem: CanvasItem;
  selectedItemId: string;
  objects: any[];
  objectTypes: any[];
  onDeleteItem: (id: string) => void;
  onInsert: (sql: string) => void;
}

function NodeInspector({ selectedItem, selectedItemId, objects, objectTypes, onDeleteItem, onInsert }: NodeInspectorProps) {
  const obj = objects.find((o: any) => o.id === selectedItem.objectId);
  const objType = objectTypes.find((t: any) => t.id === obj?.object_type_id);
  const color = '#818cf8';
  const sqlFragment = selectedItem.metadata?.sqlFragment || '';
  const isEmptyFragment = !sqlFragment.trim() || sqlFragment.startsWith('-- ');

  return (
    <div style={{ height: '100%', background: MK.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', flex: 1 }}>
          {obj?.name || '未命名对象'}
        </span>
        <button
          onClick={() => onDeleteItem(selectedItemId)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, opacity: 0.6 }}
          aria-label="删除节点">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* Node type */}
        <div style={{ marginBottom: 16 }}>
          <span style={LABEL_STYLE}>节点类型</span>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6,
            background: `${color}18`, border: `1px solid ${color}40`,
            color, display: 'inline-block',
          }}>
            {selectedItem.nodeType || 'Concept'}
          </span>
        </div>

        {/* Object type */}
        {objType && (
          <div style={{ marginBottom: 16 }}>
            <span style={LABEL_STYLE}>对象类型</span>
            <span style={{ fontSize: 11, color: MK.faint }}>{objType.name}</span>
          </div>
        )}

        {/* SQL fragment */}
        {selectedItem.metadata?.sqlFragment && (
          <div style={{ marginBottom: 16 }}>
            <span style={LABEL_STYLE}>SQL 片段</span>
            <pre style={{
              margin: 0, fontSize: 10, color: MK.faint,
              whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.6,
              background: '#000', padding: 8, borderRadius: 6,
              maxHeight: 100, overflow: 'auto',
            }}>
              {sqlFragment}
            </pre>
            <button
              disabled={isEmptyFragment}
              onClick={() => onInsert(sqlFragment)}
              style={{
                marginTop: 6, width: '100%',
                padding: '6px 12px', borderRadius: 6,
                background: isEmptyFragment ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: MK.blue, fontSize: 11, cursor: isEmptyFragment ? 'not-allowed' : 'pointer',
                opacity: isEmptyFragment ? 0.5 : 1,
              }}>
              注入 SQL
            </button>
          </div>
        )}

        {/* MECE layer */}
        {selectedItem.metadata?.layerTag && (
          <div style={{ marginBottom: 16 }}>
            <span style={LABEL_STYLE}>MECE 层</span>
            <span style={{ fontSize: 11, color: MK.faint }}>{selectedItem.metadata.layerTag}</span>
          </div>
        )}

        {/* Node ID */}
        <div style={{ marginBottom: 16 }}>
          <span style={LABEL_STYLE}>节点 ID</span>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
            {selectedItem.id}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── SQL Preview Mode ──────────────────────────────────────────────────────────
interface SqlPreviewProps {
  canvasState: CanvasState;
  compileResult: CompileResult;
  showRefinePanel: boolean;
  refineInput: string;
  isRefining: boolean;
  refineResult: { summary: string; steps: any[] } | null;
  onShowRefinePanel: () => void;
  onRefineInputChange: (v: string) => void;
  onRefine: () => void;
  onCloseRefine: () => void;
  onInsert: (sql: string) => void;
}

function SqlPreview({
  canvasState, compileResult,
  showRefinePanel, refineInput, isRefining, refineResult,
  onShowRefinePanel, onRefineInputChange, onRefine, onCloseRefine,
  onInsert,
}: SqlPreviewProps) {
  const compiledSql = compileResult.sql;
  const isEmptySql = !compiledSql.trim() || compiledSql.startsWith('-- ');

  return (
    <div style={{ height: '100%', background: MK.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
      }}>
        <Terminal className="w-4 h-4 mr-2" style={{ color: MK.blue, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          {compileResult.mode === 'pipeline' ? '管道 SQL 预览'
            : compileResult.mode === 'knowledge' ? '拓扑 SQL 预览'
            : '表依赖分析'}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        {/* Stats badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(99,102,241,0.15)', color: MK.blue,
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            {canvasState.items.length} 节点
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.2)',
          }}>
            {canvasState.edges.length} 边
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(251,146,60,0.1)', color: MK.orange,
            border: '1px solid rgba(251,146,60,0.2)',
          }}>
            {compileResult.ctes.length} CTE
          </span>
          {compileResult.warnings.length > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(239,68,68,0.1)', color: MK.red,
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              {compileResult.warnings.length} 警告
            </span>
          )}
        </div>

        {/* SQL code block */}
        <pre style={{
          margin: 0,
          fontSize: 11,
          color: MK.faint,
          whiteSpace: 'pre-wrap',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.6,
          background: '#000',
          padding: 12,
          borderRadius: 8,
          maxHeight: '40vh',
          overflow: 'auto',
          marginBottom: 12,
        }}>
          {compiledSql}
        </pre>

        {/* Warnings */}
        {compileResult.warnings.length > 0 && (
          <div style={{
            marginBottom: 12, padding: 10, borderRadius: 8,
            background: 'rgba(251,146,60,0.06)',
            border: '1px solid rgba(251,146,60,0.15)',
            fontSize: 10, color: MK.orange, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ 拓扑警告</div>
            {compileResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          </div>
        )}

        {/* Insights */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.1)',
          fontSize: 11, color: MK.faint,
          marginBottom: 12,
        }}>
          <div style={{ color: MK.indigo, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles className="w-3.5 h-3.5" />
            拓扑洞察
          </div>
          {compileResult.ctes.length === 0 ? (
            <span>画布为空或所有节点均为 Control 类型。</span>
          ) : (
            <>
              <span>
                检测到 <strong style={{ color: MK.blue }}>{canvasState.edges.length}</strong> 条数据依赖路径，
                共 <strong style={{ color: MK.blue }}>{compileResult.ctes.length}</strong> 个 CTE 阶段。
              </span>
              <br />
              {compileResult.success
                ? <span style={{ color: MK.green }}>✓ 拓扑结构有效，可生成 SQL</span>
                : <span style={{ color: MK.red }}>✗ 存在错误，请检查节点配置</span>}
            </>
          )}
        </div>

        {/* Refine panel */}
        {!showRefinePanel ? (
          <button
            onClick={onShowRefinePanel}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(251,146,60,0.05)',
              border: '1px dashed rgba(251,146,60,0.3)',
              color: MK.orange,
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 12,
            }}>
            再细化一下...（输入优化方向，AI 分析拓扑并给出建议）
          </button>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                autoFocus
                value={refineInput}
                onChange={e => onRefineInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onRefine();
                  if (e.key === 'Escape') onCloseRefine();
                }}
                placeholder="描述优化方向，如：增加过滤节点、改为时序聚合..."
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(251,146,60,0.3)',
                  color: '#fff', fontSize: 11, outline: 'none',
                }}
              />
              <button
                onClick={onRefine}
                disabled={isRefining || !refineInput.trim()}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: isRefining ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.1)',
                  border: '1px solid rgba(251,146,60,0.4)',
                  color: MK.orange, fontSize: 11,
                  cursor: isRefining ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                }}>
                {isRefining ? '分析中...' : '优化'}
              </button>
              <button onClick={onCloseRefine}
                style={{
                  padding: '7px 8px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: MK.muted, cursor: 'pointer', fontSize: 11,
                }}>
                ✕
              </button>
            </div>
            {refineResult && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(251,146,60,0.06)',
                border: '1px solid rgba(251,146,60,0.2)',
                fontSize: 11, color: MK.faint,
              }}>
                <div style={{ color: MK.orange, fontWeight: 600, marginBottom: 6 }}>
                  {refineResult.summary}
                </div>
                {refineResult.steps.map((step, i) => (
                  <div key={i} style={{
                    marginBottom: 6, paddingLeft: 10,
                    borderLeft: '2px solid rgba(251,146,60,0.3)', lineHeight: 1.6,
                  }}>
                    {step.action}
                    {step.introspection && (
                      <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, fontStyle: 'italic' }}>
                        ? {step.introspection}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          disabled={isEmptySql}
          onClick={() => onInsert(compiledSql)}
          style={{
            width: '100%', padding: 10, borderRadius: 8,
            background: isEmptySql
              ? 'rgba(99,102,241,0.2)'
              : 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none', color: 'white',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(99,102,241,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
          }}>
          注入 SQL 到解析器
        </button>
      </div>
    </div>
  );
}

// ── CanvasRightPanel (root) ──────────────────────────────────────────────────
const CanvasRightPanel: React.FC<CanvasRightPanelProps> = ({
  selectedItem, selectedItemId, objects, objectTypes, canvasState, compileResult,
  showRefinePanel, refineInput, isRefining, refineResult,
  onUpdateNode, onDeleteItem,
  onShowRefinePanel, onRefineInputChange, onRefine, onCloseRefine,
  onInsert,
}) => {
  if (selectedItem && selectedItemId) {
    return (
      <NodeInspector
        selectedItem={selectedItem}
        selectedItemId={selectedItemId}
        objects={objects}
        objectTypes={objectTypes}
        onDeleteItem={onDeleteItem}
        onInsert={onInsert}
      />
    );
  }

  return (
    <SqlPreview
      canvasState={canvasState}
      compileResult={compileResult}
      showRefinePanel={showRefinePanel}
      refineInput={refineInput}
      isRefining={isRefining}
      refineResult={refineResult}
      onShowRefinePanel={onShowRefinePanel}
      onRefineInputChange={onRefineInputChange}
      onRefine={onRefine}
      onCloseRefine={onCloseRefine}
      onInsert={onInsert}
    />
  );
};

export default CanvasRightPanel;
