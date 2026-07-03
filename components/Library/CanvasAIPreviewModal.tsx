import React from 'react';
import {
  X, Sparkles, LayoutGrid, Box, ArrowRightLeft, Check
} from 'lucide-react';
import type { CanvasSpace, CanvasItem, CanvasEdge } from './OntologyCanvas.types';

interface CanvasAIPreviewModalProps {
  aiPreview: {
    spaces: CanvasSpace[];
    items: CanvasItem[];
    edges: CanvasEdge[];
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

const CanvasAIPreviewModal: React.FC<CanvasAIPreviewModalProps> = ({ aiPreview, onClose, onConfirm }) => {
  if (!aiPreview) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 680, maxHeight: '80vh',
          background: 'rgba(23,23,35,0.98)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(167,139,250,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles className="w-5 h-5" style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>AI 生成预览</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>请审核即将注入画布的新结构</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8, borderRadius: 10, background: 'none', border: 'none',
              cursor: 'pointer', color: '#64748b'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div style={{
          padding: '12px 24px', background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 24, fontSize: 12
        }}>
          <span style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LayoutGrid className="w-4 h-4" /> 空间 × {aiPreview.spaces.length}
          </span>
          <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Box className="w-4 h-4" /> 节点 × {aiPreview.items.length}
          </span>
          <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowRightLeft className="w-4 h-4" /> 连线 × {aiPreview.edges.length}
          </span>
        </div>

        {/* Preview content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {aiPreview.spaces.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>空间分组</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {aiPreview.spaces.map(sp => (
                  <div key={sp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    background: `${sp.color}15`, border: `1px solid ${sp.color}40`
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sp.color }} />
                    <span style={{ fontSize: 12, color: sp.color, fontWeight: 600 }}>{sp.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>节点列表</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {aiPreview.items.slice(0, 12).map(item => {
                const nodeColor: Record<string, string> = {
                  Concept: '#a78bfa', Event: '#38bdf8', Goal: '#4ade80', Insight: '#fb923c'
                };
                const color = nodeColor[item.nodeType || 'Concept'] || '#a78bfa';
                return (
                  <div key={item.id} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: `${color}08`, border: `1px solid ${color}20`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{item.nodeType}</span>
                    </div>
                    <div style={{
                      fontSize: 11, color: '#94a3b8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {item.metadata?.tableName || '未命名'}
                    </div>
                  </div>
                );
              })}
              {aiPreview.items.length > 12 && (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#64748b'
                }}>
                  + 还有 {aiPreview.items.length - 12} 个节点
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'flex-end', gap: 12
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 10,
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 500
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 20px', borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)'
            }}
          >
            <Check className="w-4 h-4" /> 确认并应用
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasAIPreviewModal;
