import React, { useState, useEffect } from 'react';
import {
  X, Database, Terminal, Settings, Zap,
  ChevronRight, ArrowRight, Save, Trash2,
  Box, Square, Layers, Code, Sparkles, Loader2, Wand2
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { ontologyAiService } from '../../services/ontologyAiService';

interface CanvasNodeInspectorProps {
  item: {
    id: string;
    nodeType?: string;
    metadata?: any;
    objectId: number;
    x: number;
    y: number;
  };
  object: any;
  /** 拓扑中所有 items，用于分析上下文 */
  allItems?: Array<{
    id: string;
    nodeType?: string;
    metadata?: any;
    objectId: number;
  }>;
  onUpdate: (updates: any) => void;
  onClose: () => void;
  onDelete: () => void;
}

const NODE_TYPES = [
  { id: 'Source', label: '源数据 (Source)', icon: Database, color: '#38bdf8', hint: '从物理表读取原始数据，作为拓扑的入口节点。' },
  { id: 'Transform', label: '数据变换 (Transform)', icon: Layers, color: '#a78bfa', hint: '对输入数据执行 JOIN、聚合、清洗等变换操作。' },
  { id: 'Sink', label: '最终输出 (Sink)', icon: Zap, color: '#4ade80', hint: '将结果写入目标表或作为最终查询输出。' },
  { id: 'Control', label: '控制逻辑 (Control)', icon: Settings, color: '#fb923c', hint: '添加 WHERE 条件、过滤逻辑或参数化控制。' },
];

export const CanvasNodeInspector: React.FC<CanvasNodeInspectorProps> = ({
  item, object, allItems = [], onUpdate, onClose, onDelete
}) => {
  const [nodeType, setNodeType] = useState(item.nodeType || 'Source');
  const [sqlFragment, setSqlFragment] = useState(item.metadata?.sqlFragment || '');
  const [tableName, setTableName] = useState(item.metadata?.tableName || object?.name || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setNodeType(item.nodeType || 'Source');
    setSqlFragment(item.metadata?.sqlFragment || '');
    setTableName(item.metadata?.tableName || object?.name || '');
  }, [item]);

  const handleSave = () => {
    onUpdate({
      nodeType,
      metadata: {
        ...item.metadata,
        sqlFragment,
        tableName
      }
    });
  };

  const handleAIAutoFill = async () => {
    setIsAiLoading(true);
    try {
      let generatedSql = '';
      const table = tableName || object?.name || 'unknown_table';

      if (nodeType === 'Source') {
        const result = await ontologyAiService.generateObjectModel(table);
        const obj = result.objects?.[0];
        if (obj?.properties) {
          const cols = Object.keys(obj.properties).join(', ');
          generatedSql = cols ? `SELECT ${cols} FROM "${table}"` : `SELECT * FROM "${table}"`;
        } else {
          generatedSql = `SELECT * FROM "${table}"`;
        }
      } else if (nodeType === 'Transform') {
        const contextItems = allItems.filter(i => i.id !== item.id);
        const contextNames = contextItems.map(i => i.metadata?.tableName || '').filter(Boolean).join(', ');
        const result = await ontologyAiService.generatePatternSQL(
          'aggregation_view',
          contextNames ? `输入: ${contextNames}` : `基础表: ${table}`
        );
        generatedSql = result.sql
          ? result.sql.replace(/\{\{[^}]+\}\}/g, (m) => m.replace(/[{}]/g, ''))
          : `SELECT * FROM previous_cte -- 基于 ${table} 的变换`;
      } else if (nodeType === 'Sink') {
        const result = await ontologyAiService.generatePatternSQL(
          'aggregation_view',
          `输出目标: ${table}`
        );
        generatedSql = result.sql
          ? `-- 最终输出: ${table}\n${result.sql.replace(/\{\{[^}]+\}\}/g, (m) => m.replace(/[{}]/g, ''))}`
          : `SELECT * FROM previous_cte; -- 输出至 ${table}`;
      } else if (nodeType === 'Control') {
        const result = await ontologyAiService.generatePatternSQL(
          'recursive_cte',
          `过滤条件表: ${table}`
        );
        generatedSql = result.sql
          ? result.sql.replace(/\{\{[^}]+\}\}/g, (m) => m.replace(/[{}]/g, ''))
          : `SELECT * FROM previous_cte WHERE 1=1; -- ${table} 过滤`;
      }

      setSqlFragment(generatedSql);
    } catch (err) {
      console.error('[CanvasNodeInspector] AI auto-fill failed:', err);
      setAiHint('AI 生成失败，请手动输入 SQL 片段');
      setShowHint(true);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIAutoHint = async () => {
    setIsAiLoading(true);
    setShowHint(true);
    try {
      const nodeTypeMeta = NODE_TYPES.find(n => n.id === nodeType);
      let hint = '';
      if (nodeType === 'Source') {
        hint = `Source 节点: SELECT * FROM "${tableName || object?.name || '表名'}" — 作为拓扑入口，将物理表数据加载到 CTE 流中。`;
      } else if (nodeType === 'Transform') {
        const prevItems = allItems.filter(i => {
          const idx = allItems.findIndex(x => x.id === item.id);
          const prevIdx = allItems.findIndex(x => x.id === i.id);
          return prevIdx < idx;
        });
        if (prevItems.length > 0) {
          hint = `Transform 节点: 对 ${prevItems.map(i => i.metadata?.tableName || '前置表').join(', ')} 的结果进行 JOIN/聚合。\n推荐: SELECT t1.*, t2.* FROM cte_a t1 LEFT JOIN cte_b t2 ON ...`;
        } else {
          hint = `Transform 节点: 对上一节点输出执行数据变换（JOIN、聚合、清洗）。\n推荐: SELECT ... FROM previous_cte WHERE ...`;
        }
      } else if (nodeType === 'Sink') {
        hint = `Sink 节点: 将整个拓扑的最终结果输出。\n推荐: SELECT * FROM last_cte — 或直接作为最终查询返回。`;
      } else {
        hint = `Control 节点: 添加 WHERE/HAVING 过滤条件。\n推荐: WHERE column > value AND ...`;
      }
      setAiHint(hint || nodeTypeMeta?.hint || '暂无提示');
    } catch {
      setAiHint(nodeTypeMeta?.hint || '暂无提示');
    } finally {
      setIsAiLoading(false);
    }
  };

  const activeType = NODE_TYPES.find(t => t.id === nodeType) || NODE_TYPES[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(13,13,20,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Box className="w-4 h-4 text-indigo-400" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>节点检视器</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>ID: {item.id}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Object Info */}
        <div style={{ marginBottom: 24, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>绑定的物理对象</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{object?.name || '未知对象'}</div>
        </div>

        {/* Node Type Selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 10 }}>业务类型 (Node Type)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {NODE_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => { setNodeType(type.id); setShowHint(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', borderRadius: 8,
                  background: nodeType === type.id ? `${type.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${nodeType === type.id ? type.color : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <type.icon className="w-4 h-4" style={{ color: nodeType === type.id ? type.color : '#64748b' }} />
                <span style={{ fontSize: 10, color: nodeType === type.id ? '#f8fafc' : '#94a3b8', fontWeight: 500 }}>{type.label}</span>
              </button>
            ))}
          </div>
          {/* Node type hint */}
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: `${activeType.color}08`, border: `1px solid ${activeType.color}20`, fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
            <Wand2 className="w-3 h-3 inline mr-1" style={{ color: activeType.color, verticalAlign: 'middle' }} />
            {activeType.hint}
          </div>
        </div>

        {/* Type Specific Config */}
        <div style={{ marginBottom: 24 }}>
          {nodeType === 'Source' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>数据表名 (Table Name)</label>
              <input
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#f1f5f9', fontSize: 12
                }}
              />
            </div>
          )}

          {(nodeType === 'Transform' || nodeType === 'Source') && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                  {nodeType === 'Source' ? '追加条件 (Filter Fragment)' : 'SQL 变换逻辑 (SQL Fragment)'}
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {/* AI 辅助按钮 */}
                  <button
                    onClick={handleAIAutoFill}
                    disabled={isAiLoading}
                    title="AI 自动生成 SQL 片段"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6,
                      background: isAiLoading ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.08)',
                      border: '1px solid rgba(167,139,250,0.3)',
                      color: '#a78bfa', fontSize: 10, cursor: isAiLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isAiLoading ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> 生成中</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> AI 辅助</>
                    )}
                  </button>
                  {/* AI Hint 按钮 */}
                  <button
                    onClick={handleAIAutoHint}
                    disabled={isAiLoading}
                    title="查看该节点类型的最佳实践提示"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(251,146,60,0.08)',
                      border: '1px solid rgba(251,146,60,0.3)',
                      color: '#fb923c', fontSize: 10, cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Wand2 className="w-3 h-3" /> 最佳实践
                  </button>
                  <Code className="w-3 h-3 text-[#94a3b8]" style={{ alignSelf: 'center' }} />
                </div>
              </div>

              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CodeMirror
                  value={sqlFragment}
                  height="120px"
                  theme={monokai}
                  extensions={[sql()]}
                  onChange={setSqlFragment}
                  style={{ fontSize: '11px' }}
                />
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
                * 将作为 CTE 内部的 SQL 逻辑执行。AI 辅助按钮可自动生成推荐片段。
              </div>

              {/* AI Hint 结果展示 */}
              {showHint && aiHint && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#fb923c', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>AI 最佳实践提示</span>
                    <button onClick={() => setShowHint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 10 }}>✕</button>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 9, color: '#d1d5db' }}>
                    {aiHint}
                  </pre>
                </div>
              )}
            </div>
          )}

          {nodeType === 'Sink' && (
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', fontSize: 10, color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Zap className="w-3 h-3" style={{ color: '#4ade80' }} />
                <span style={{ color: '#4ade80', fontWeight: 600 }}>Sink 节点最佳实践</span>
              </div>
              <div style={{ lineHeight: 1.7 }}>
                Sink 节点是拓扑的终点。推荐写法：<br />
                <code style={{ color: '#a78bfa', fontFamily: 'monospace' }}>SELECT * FROM previous_cte;</code><br />
                如需写入物理表，可改为 <code style={{ color: '#a78bfa', fontFamily: 'monospace' }}>CREATE TABLE ... AS SELECT * FROM previous_cte;</code>
              </div>
              <button
                onClick={handleAIAutoFill}
                disabled={isAiLoading}
                style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 10, cursor: 'pointer' }}
              >
                {isAiLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> 生成中</> : <><Sparkles className="w-3 h-3" /> AI 生成输出 SQL</>}
              </button>
            </div>
          )}

          {nodeType === 'Control' && (
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 10, color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Settings className="w-3 h-3" style={{ color: '#fb923c' }} />
                <span style={{ color: '#fb923c', fontWeight: 600 }}>Control 节点最佳实践</span>
              </div>
              <div style={{ lineHeight: 1.7 }}>
                Control 节点用于添加 WHERE/HAVING 条件或 CASE 逻辑。<br />
                <code style={{ color: '#a78bfa', fontFamily: 'monospace' }}>WHERE column {'>'} value AND status = 'active'</code>
              </div>
              <button
                onClick={handleAIAutoFill}
                disabled={isAiLoading}
                style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c', fontSize: 10, cursor: 'pointer' }}
              >
                {isAiLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> 生成中</> : <><Sparkles className="w-3 h-3" /> AI 生成过滤条件</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', display: 'flex', gap: 10 }}>
        <button
          onClick={onDelete}
          style={{
            padding: '8px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="删除节点"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 1, padding: '8px', borderRadius: 8,
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Save className="w-3.5 h-3.5" /> 保存配置
        </button>
      </div>
    </div>
  );
};
