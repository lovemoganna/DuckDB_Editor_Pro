import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertTriangle, ChevronDown, ChevronRight, Code2, GitBranch, GripVertical,
  Layers, Link2, Minus, Plus, ShieldCheck, Trash2, X, FileText, Undo, Redo, Wand2
} from 'lucide-react';



import {
  parseRuleLisp,
  type ConditionOperator, type FeatureDefinition, type FeatureValueType,
  type RuleAst, type RuleDefinition, type RuleValidationReport,
} from '../../services/ontology/ontologyInferenceEngine';


// Fallback definitions in case they are not exported
const OPERATOR_LABELS: Record<string, string> = {
  is_true: '是', is_false: '否', eq: '等于', neq: '不等于', gt: '大于',
  gte: '大于等于', lt: '小于', lte: '小于等于', between: '介于', in: '属于',
  not_in: '不属于', contains: '包含', not_contains: '不包含', contains_any: '包含任一',
  contains_all: '包含全部', before: '早于', after: '晚于', on_or_before: '不晚于',
  on_or_after: '不早于', is_null: '为空', is_not_null: '不为空'
};

const OPERATORS_BY_TYPE: Record<string, string[]> = {
  boolean: ['is_true','is_false','eq','neq','is_null','is_not_null'],
  number: ['eq','neq','gt','gte','lt','lte','between','is_null','is_not_null'],
  string: ['eq','neq','in','not_in','is_null','is_not_null'],
  category: ['eq','neq','in','not_in','is_null','is_not_null'],
  set: ['contains','not_contains','contains_any','contains_all','is_null','is_not_null'],
  timestamp: ['eq','neq','before','after','on_or_before','on_or_after','between','is_null','is_not_null']
};

const VALUE_FREE_OPERATORS = new Set(['is_true', 'is_false', 'is_null', 'is_not_null']);

export interface RuleTreeEditorProps {
  rule: RuleDefinition;
  features: FeatureDefinition[];
  availableRules: RuleDefinition[];
  validationReport: RuleValidationReport | null;
  onRuleChange: (rule: RuleDefinition) => void;
}

const generateNodeId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const updateNodeInAst = (root: RuleAst, nodeId: string, updater: (node: RuleAst) => RuleAst): RuleAst | null => {
  if (!root) return null;
  if (root.nodeId === nodeId) {
    return updater({ ...root } as any);
  }

  if (root.kind === 'and' || root.kind === 'or') {
    return {
      ...root,
      children: root.children.map(c => updateNodeInAst(c as RuleAst, nodeId, updater)!).filter(Boolean) as any[]
    };
  }

  if (root.kind === 'not') {
    if (root.child) {
      const newChild = updateNodeInAst(root.child as RuleAst, nodeId, updater);
      return { ...root, child: newChild as any };
    }
  }

  return { ...root };
};

const removeNodeFromAst = (root: RuleAst, nodeId: string): RuleAst | null => {
  if (root.nodeId === nodeId) return null;
  
  if (root.kind === 'and' || root.kind === 'or') {
    return {
      ...root,
      children: root.children
        .map(c => removeNodeFromAst(c as RuleAst, nodeId))
        .filter(c => c !== null) as any[]
    };
  }

  if (root.kind === 'not') {
    if (root.child) {
      const newChild = removeNodeFromAst(root.child as RuleAst, nodeId);
      return {
        ...root,
        child: newChild as any
      };
    }
  }

  return { ...root };
};

const parseInputValue = (val: string): unknown => {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  if (!isNaN(Number(val)) && val.trim() !== '') return Number(val);
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  
  if (val.includes(',')) {
    return val.split(',').map(s => parseInputValue(s.trim()));
  }
  return val;
};

const stringifyValue = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

interface RuleNodeProps {
  node: RuleAst;
  features: FeatureDefinition[];
  availableRules: RuleDefinition[];
  depth: number;
  onUpdate: (nodeId: string, updater: (n: RuleAst) => RuleAst) => void;
  onRemove: (nodeId: string) => void;
  validationReport: RuleValidationReport | null;
}

const RuleNodeComponent: React.FC<RuleNodeProps> = ({
  node, features, availableRules, depth, onUpdate, onRemove, validationReport
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const validationErrors = useMemo(() => {
    if (!validationReport || !validationReport.errors) return [];
    return validationReport.errors.filter((e: any) => e.nodeId === node.nodeId);
  }, [validationReport, node.nodeId]);

  const validationWarnings = useMemo(() => {
    if (!validationReport || !validationReport.warnings) return [];
    return validationReport.warnings.filter((w: any) => w.nodeId === node.nodeId);
  }, [validationReport, node.nodeId]);

  const hasError = validationErrors.length > 0;
  const hasWarning = validationWarnings.length > 0;

  const getBorderColor = () => {
    if (node.kind === 'and') return 'border-l-monokai-accent';
    if (node.kind === 'or') return 'border-l-monokai-fg-muted';
    if (node.kind === 'not') return 'border-l-rose-400';
    if (node.kind === 'condition') return 'border-l-monokai-border-strong';
    if (node.kind === 'ruleRef') return 'border-l-monokai-accent/70';
    return 'border-l-monokai-border';
  };

  const getBadgeLabel = () => {
    if (node.kind === 'and') return 'AND · 全部满足';
    if (node.kind === 'or') return 'OR · 任一满足';
    if (node.kind === 'not') return 'NOT · 排除';
    if (node.kind === 'condition') return '条件';
    if (node.kind === 'ruleRef') return '子规则';
    return '未知';
  };

  const ringStyle = hasError 
    ? 'ring-1 ring-rose-500/50' 
    : hasWarning 
      ? 'ring-1 ring-amber-500/50' 
      : 'border border-monokai-border';

  const addChild = (type: 'condition' | 'and' | 'ruleRef') => {
    onUpdate(node.nodeId, (n: any) => {
      const newChild: any = type === 'condition' 
        ? { kind: 'condition', nodeId: generateNodeId(), featureId: '', operator: 'eq' }
        : type === 'and'
          ? { kind: 'and', nodeId: generateNodeId(), children: [] }
          : { kind: 'ruleRef', nodeId: generateNodeId(), ruleId: '' };

      if (n.kind === 'and' || n.kind === 'or') {
        return { ...n, children: [...(n.children || []), newChild] };
      }
      if (n.kind === 'not') {
        return { ...n, child: newChild };
      }
      return n;
    });
  };

  return (
    <div className={`${depth > 0 ? 'ml-6' : 'ml-0'} flex flex-col relative`}>
      {depth > 0 && (
        <div className="absolute -left-4 top-4 w-4 h-px bg-white/10" />
      )}
      
      <div className={`flex flex-col mb-2 p-3 bg-monokai-surface/60 rounded-lg border-l-2 ${getBorderColor()} ${ringStyle} transition-all`}>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(node.kind === 'and' || node.kind === 'or' || node.kind === 'not') && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-white/10 rounded text-monokai-fg"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <span className="text-xs font-black text-monokai-fg/80 px-2 py-0.5 rounded bg-white/5">
              {getBadgeLabel()}
            </span>

            {/* Validation indicators */}
            {hasError && <AlertTriangle size={14} className="text-monokai-pink" aria-label="Error" />}
            {hasWarning && !hasError && <AlertTriangle size={14} className="text-monokai-yellow" aria-label="Warning" />}
          </div>

          <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
            {(node.kind === 'and' || node.kind === 'or') && (
              <>
                <button onClick={() => onUpdate(node.nodeId, (n: any) => ({ ...n, kind: n.kind === 'and' ? 'or' : 'and' }))} className="p-1 hover:bg-white/10 rounded text-[10px] text-monokai-cyan" aria-label="Toggle Logic">
                  切换为 {node.kind === 'and' ? 'OR' : 'AND'}
                </button>
                <button onClick={() => addChild('condition')} className="p-1 hover:bg-white/10 rounded text-monokai-green" aria-label="Add Condition" title="添加条件"><Plus size={14} /></button>
                <button onClick={() => addChild('and')} className="p-1 hover:bg-white/10 rounded text-monokai-cyan" aria-label="Add Group" title="添加逻辑组"><Layers size={14} /></button>
                <button onClick={() => addChild('ruleRef')} className="p-1 hover:bg-white/10 rounded text-monokai-amethyst" aria-label="Add Rule Reference" title="添加子规则"><GitBranch size={14} /></button>
              </>
            )}
            {node.kind === 'not' && !('child' in node && (node as any).child) && (
              <button onClick={() => addChild('condition')} className="p-1 hover:bg-white/10 rounded text-monokai-green" aria-label="Add Condition"><Plus size={14} /></button>
            )}
            <button onClick={() => onRemove(node.nodeId)} className="p-1 hover:bg-monokai-pink/20 rounded text-monokai-pink" aria-label="Delete Node"><Trash2 size={14} /></button>
          </div>
        </div>

        {/* Validation Tooltips */}
        {(hasError || hasWarning) && (
          <div className="mt-2 text-[10px] space-y-1">
            {validationErrors.map((e: any, i) => (
              <div key={i} className="text-monokai-pink bg-monokai-pink/10 px-2 py-1 rounded">{e.message}</div>
            ))}
            {validationWarnings.map((w: any, i) => (
              <div key={i} className="text-monokai-yellow bg-monokai-yellow/10 px-2 py-1 rounded">{w.message}</div>
            ))}
          </div>
        )}

        {/* Node Content Editor */}
        <div className="mt-2">
          {node.kind === 'condition' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select 
                className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent min-w-[120px]"
                value={(node as any).featureId || ''}
                onChange={(e) => {
                  const targetFeature = features.find(f => f.id === e.target.value);
                  const targetValType = targetFeature?.valueType || 'string';
                  const availableOps = OPERATORS_BY_TYPE[targetValType] || OPERATORS_BY_TYPE.string;
                  const defaultOp = availableOps[0] || 'eq';
                  onUpdate(node.nodeId, (n: any) => ({
                    ...n,
                    featureId: e.target.value,
                    operator: defaultOp,
                    value: undefined,
                    secondValue: undefined,
                  }));
                }}
                aria-label="Feature"
              >
                <option value="" disabled>选择特征...</option>
                {features.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.valueType})</option>
                ))}
              </select>

              {(() => {
                const feature = features.find(f => f.id === (node as any).featureId);
                const valType = feature?.valueType || 'string';
                const ops = OPERATORS_BY_TYPE[valType] || OPERATORS_BY_TYPE.string;
                
                return (
                  <select 
                    className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent"
                    value={(node as any).operator || ''}
                    onChange={(e) => onUpdate(node.nodeId, (n: any) => ({ ...n, operator: e.target.value, value: undefined, secondValue: undefined }))}
                    disabled={!feature}
                    aria-label="Operator"
                  >
                    {ops.map(op => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                    ))}
                  </select>
                );
              })()}

              {!(node as any).operator || !VALUE_FREE_OPERATORS.has((node as any).operator as string) ? (
                <>
                  {(() => {
                    const feature = features.find(f => f.id === (node as any).featureId);
                    const domainValues = Array.isArray(feature?.domain) ? feature!.domain : null;

                    if (domainValues && domainValues.length > 0 && ((node as any).operator === 'eq' || (node as any).operator === 'neq')) {
                      return (
                        <select
                          className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent flex-1 min-w-[80px]"
                          value={stringifyValue((node as any).value)}
                          onChange={(e) => onUpdate(node.nodeId, (n: any) => ({ ...n, value: parseInputValue(e.target.value) }))}
                          disabled={!(node as any).featureId}
                          aria-label="Value Select"
                        >
                          <option value="">选择预置值...</option>
                          {domainValues.map((val, idx) => (
                            <option key={idx} value={String(val)}>{String(val)}</option>
                          ))}
                        </select>
                      );
                    }

                    return (
                      <input 
                        type="text"
                        className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent flex-1 min-w-[80px]"
                        placeholder="值"
                        value={stringifyValue((node as any).value)}
                        onChange={(e) => onUpdate(node.nodeId, (n: any) => ({ ...n, value: parseInputValue(e.target.value) }))}
                        disabled={!(node as any).featureId}
                        aria-label="Value"
                      />
                    );
                  })()}

                  {(node as any).operator === 'between' && (
                    <>
                      <span className="text-monokai-comment">至</span>
                      <input 
                        type="text"
                        className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent flex-1 min-w-[80px]"
                        placeholder="值 2"
                        value={stringifyValue((node as any).secondValue)}
                        onChange={(e) => onUpdate(node.nodeId, (n: any) => ({ ...n, secondValue: parseInputValue(e.target.value) }))}
                        aria-label="Second Value"
                      />
                    </>
                  )}
                </>
              ) : null}
            </div>
          )}

          {node.kind === 'ruleRef' && (
            <div className="flex items-center gap-2 text-xs">
              <Link2 size={14} className="text-monokai-comment" />
              <select 
                className="bg-[#0c0d12] border border-white/10 rounded px-2 py-1 text-monokai-fg outline-none focus:border-monokai-accent flex-1"
                value={(node as any).ruleId || ''}
                onChange={(e) => onUpdate(node.nodeId, (n: any) => ({ ...n, ruleId: e.target.value }))}
                aria-label="Rule Reference"
              >
                <option value="" disabled>选择引用的规则...</option>
                {availableRules.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && (node.kind === 'and' || node.kind === 'or') && (node as any).children && (
        <div className="flex flex-col relative border-l border-white/10 ml-4 pl-4 pt-1">
          {((node as any).children as RuleAst[]).map((child) => (
            <RuleNodeComponent
              key={child.nodeId}
              node={child}
              features={features}
              availableRules={availableRules}
              depth={depth + 1}
              onUpdate={onUpdate}
              onRemove={onRemove}
              validationReport={validationReport}
            />
          ))}
          {((node as any).children as RuleAst[]).length === 0 && (
            <div className="text-[10px] text-monokai-comment italic py-2">空逻辑组</div>
          )}
        </div>
      )}

      {isExpanded && node.kind === 'not' && (node as any).child && (
        <div className="flex flex-col relative border-l border-white/10 ml-4 pl-4 pt-1">
          <RuleNodeComponent
            node={(node as any).child}
            features={features}
            availableRules={availableRules}
            depth={depth + 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
            validationReport={validationReport}
          />
        </div>
      )}
    </div>
  );
};

export const RuleTreeEditor: React.FC<RuleTreeEditorProps> = ({
  rule, features, availableRules, validationReport, onRuleChange
}) => {
  const [history, setHistory] = useState<RuleAst[]>([]);
  const [redoStack, setRedoStack] = useState<RuleAst[]>([]);

  // Reset history stack when editing rule changes
  useEffect(() => {
    setHistory([]);
    setRedoStack([]);
  }, [rule.id]);

  const pushStateToHistory = useCallback((currentRoot: RuleAst | null) => {
    if (currentRoot) {
      setHistory(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(currentRoot))]);
      setRedoStack([]);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    if (rule.root) {
      setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(rule.root))]);
    }
    onRuleChange({ ...rule, root: previous });
  }, [history, rule, onRuleChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    if (rule.root) {
      setHistory(prev => [...prev, JSON.parse(JSON.stringify(rule.root))]);
    }
    onRuleChange({ ...rule, root: next });
  }, [redoStack, rule, onRuleChange]);

  // Keyboard shortcuts for Undo (Ctrl+Z / Cmd+Z) & Redo (Ctrl+Y / Cmd+Shift+Z / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (isInput) return;

      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && isZ) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if (modifier && isY) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleUpdateNode = useCallback((nodeId: string, updater: (n: RuleAst) => RuleAst) => {
    if (!rule.root) return;
    const newRoot = updateNodeInAst(rule.root, nodeId, updater);
    if (newRoot) {
      pushStateToHistory(rule.root);
      onRuleChange({ ...rule, root: newRoot });
    }
  }, [rule, onRuleChange, pushStateToHistory]);

  const handleRemoveNode = useCallback((nodeId: string) => {
    if (!rule.root) return;
    const newRoot = removeNodeFromAst(rule.root, nodeId);
    pushStateToHistory(rule.root);
    onRuleChange({ ...rule, root: newRoot as any });
  }, [rule, onRuleChange, pushStateToHistory]);

  const handleCreateRoot = (kind: 'and' | 'or') => {
    const newRoot: any = { kind, nodeId: generateNodeId(), children: [] };
    pushStateToHistory(rule.root);
    onRuleChange({ ...rule, root: newRoot });
  };


  const handleMetadataChange = (key: keyof RuleDefinition, value: string) => {
    onRuleChange({ ...rule, [key]: value });
  };

  const statusColors = {
    draft: 'text-monokai-yellow bg-monokai-yellow/10',
    active: 'text-monokai-green bg-monokai-green/10',
    archived: 'text-monokai-comment bg-white/5'
  };

  const statusLabels = {
    draft: '草稿',
    active: '生效中',
    archived: '已归档'
  };

  const [showLispModal, setShowLispModal] = useState(false);
  const [lispText, setLispText] = useState('');
  const [lispParseError, setLispParseError] = useState('');


  // Parentheses & syntax validator
  const lispValidation = useMemo(() => {
    if (!lispText.trim()) {
      return { valid: false, openCount: 0, closeCount: 0, diff: 0, error: '请输入 Lisp 表达式', unmatchedCloseIndex: null, previewNodeCount: 0 };
    }
    let openCount = 0;
    let closeCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lispText.length; i++) {
      const char = lispText[i];
      if (inString) {
        if (char === stringChar && lispText[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }
      if (char === '(') {
        openCount++;
      } else if (char === ')') {
        closeCount++;
        if (closeCount > openCount) {
          return {
            valid: false,
            openCount,
            closeCount,
            diff: openCount - closeCount,
            error: `第 ${i + 1} 字符处多余右括号 ')'`,
            unmatchedCloseIndex: i,
            previewNodeCount: 0,
          };
        }
      }
    }

    if (inString) {
      return {
        valid: false,
        openCount,
        closeCount,
        diff: openCount - closeCount,
        error: '字符串单双引号未闭合',
        unmatchedCloseIndex: null,
        previewNodeCount: 0,
      };
    }

    const diff = openCount - closeCount;
    if (diff > 0) {
      return {
        valid: false,
        openCount,
        closeCount,
        diff,
        error: `括号未闭合（缺少 ${diff} 个右括号 ')'）`,
        unmatchedCloseIndex: null,
        previewNodeCount: 0,
      };
    }

    try {
      const parsed = parseRuleLisp(lispText, rule, features, availableRules);
      return {
        valid: true,
        openCount,
        closeCount,
        diff: 0,
        error: null,
        unmatchedCloseIndex: null,
        previewNodeCount: parsed.root ? 1 : 0,
      };
    } catch (err) {
      return {
        valid: false,
        openCount,
        closeCount,
        diff: 0,
        error: `Lisp 表达式结构语法错误: ${err instanceof Error ? err.message : String(err)}`,
        unmatchedCloseIndex: null,
        previewNodeCount: 0,
      };
    }
  }, [lispText, rule, features, availableRules]);

  const handleImportLisp = () => {
    setLispParseError('');
    if (!lispText.trim()) return;
    try {
      pushStateToHistory(rule.root);
      const parsed = parseRuleLisp(lispText, rule, features, availableRules);
      onRuleChange(parsed);
      setShowLispModal(false);
      setLispText('');
    } catch (err) {
      setLispParseError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d12] text-monokai-fg overflow-hidden rounded-2xl border border-white/10 relative">
      
      {/* Header */}
      <div className="bg-[#141622] p-4 border-b border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <input 
            type="text" 
            className="text-lg font-black bg-transparent outline-none flex-1 border-b border-transparent focus:border-white/20 transition-colors"
            value={rule.name || ''}
            onChange={(e) => handleMetadataChange('name', e.target.value)}
            placeholder="规则名称"
            aria-label="Rule Name"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-monokai-fg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-bold transition-colors border border-white/10"
              title="撤销 (Undo)"
              aria-label="撤销"
            >
              <Undo size={13} /> 撤销
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-monokai-fg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-bold transition-colors border border-white/10"
              title="重做 (Redo)"
              aria-label="重做"
            >
              <Redo size={13} /> 重做
            </button>
            <button
              onClick={() => {
                setLispText('');
                setLispParseError('');
                setShowLispModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-monokai-surface text-monokai-fg-muted hover:text-monokai-accent hover:bg-monokai-hover text-xs font-medium transition-colors border border-monokai-border cursor-pointer"
              title="直接粘贴中文 Lisp 表达式生成规则树"
            >
              <Code2 size={14} /> 导入 Lisp
            </button>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded font-bold ${statusColors[rule.status] || statusColors.draft}`}>
            {statusLabels[rule.status] || '草稿'}
          </span>
        </div>

        
        <textarea 
          className="text-xs text-monokai-comment bg-monokai-surface/60 border border-monokai-border rounded p-2 outline-none focus:border-monokai-accent resize-none h-16 transition-colors"
          value={rule.description || ''}
          onChange={(e) => handleMetadataChange('description', e.target.value)}
          placeholder="添加规则描述..."
          aria-label="Rule Description"
        />
      </div>

      {/* Lisp Import Modal Overlay */}
      {showLispModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex flex-col justify-center items-center">
          <div className="bg-monokai-surface border border-monokai-border rounded-xl p-5 w-full max-w-lg shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-monokai-border/40 pb-3">
              <h3 className="text-sm font-black text-monokai-fg flex items-center gap-2">
                <Code2 size={16} className="text-monokai-accent" />
                中文 Lisp 表达式导入与智能语法校验
              </h3>
              <button onClick={() => setShowLispModal(false)} className="text-monokai-comment hover:text-white" aria-label="关闭 modal">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-monokai-comment leading-relaxed">
              示例：<code className="text-monokai-accent font-mono">(高风险交易 (AND (快进快出 是) (交易金额 大于 100000)))</code>
            </p>

            <div className="relative flex flex-col gap-1">
              <textarea
                value={lispText}
                onChange={(e) => setLispText(e.target.value)}
                placeholder="请粘贴 Lisp 表达式..."
                className="w-full h-36 bg-monokai-sidebar border border-monokai-border rounded-lg p-3 font-mono text-xs text-monokai-fg outline-none focus:border-monokai-accent"
                aria-label="Lisp Expression Input"
              />
              <div className="flex items-center justify-between text-[10px] text-monokai-comment px-1">
                <span>括号计数: ( {lispValidation.openCount} / {lispValidation.closeCount} )</span>
                {lispValidation.diff > 0 && <span className="text-amber-400 font-bold">缺少 {lispValidation.diff} 个 &#39;&#41;&#39;</span>}
              </div>
            </div>

            {/* Smart Syntax Validation & Parenthesis Hints */}
            {lispText.trim() !== '' && (
              <div>
                {lispValidation.valid ? (
                  <div className="flex items-center gap-2 p-2 bg-monokai-green/10 border border-monokai-border-subtle rounded text-xs text-monokai-green">
                    <ShieldCheck size={14} />
                    <span>✅ 括号与语法校验通过，可顺利解析为 AST 规则树</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 p-2 bg-rose-500/10 border border-monokai-border-subtle rounded text-xs text-rose-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle size={14} />
                        {lispValidation.error}
                      </span>
                      {lispValidation.diff > 0 && (
                        <button
                          type="button"
                          onClick={() => setLispText(prev => prev + ')'.repeat(lispValidation.diff))}
                          className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold transition-colors border border-monokai-border-subtle cursor-pointer"
                        >
                          <Wand2 size={12} /> 一键补全括号
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {lispParseError && (
              <div className="p-2 bg-rose-500/10 border border-monokai-border-subtle rounded text-xs text-rose-400">
                {lispParseError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-monokai-border/40">
              <button
                onClick={() => setShowLispModal(false)}
                className="px-3 py-1.5 rounded text-xs text-monokai-comment hover:bg-monokai-surface hover:text-monokai-fg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleImportLisp}
                disabled={!lispValidation.valid}
                className="px-4 py-1.5 rounded bg-monokai-accent text-monokai-bg text-xs font-bold hover:bg-monokai-accent-hover disabled:opacity-40 cursor-pointer shadow-xs"
              >
                解析并重建规则树
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Depth Warning */}
      {validationReport?.warnings?.some(w => w.code === 'deep_nesting') && (
        <div className="bg-amber-500/10 text-amber-300 p-3 text-xs flex items-center gap-2 border-b border-monokai-border-subtle">
          <AlertTriangle size={14} />
          <span>逻辑层级过深。建议将部分复杂逻辑提取为子规则，以保持可维护性。</span>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {rule.root ? (
          <RuleNodeComponent 
            node={rule.root} 
            features={features} 
            availableRules={availableRules.filter(r => r.id !== rule.id)} // Prevent self-reference
            depth={0} 
            onUpdate={handleUpdateNode}
            onRemove={handleRemoveNode}
            validationReport={validationReport}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-60">
            <Layers size={48} className="text-monokai-comment mb-4 opacity-50" />
            <h3 className="text-sm font-black mb-2">未配置规则逻辑</h3>
            <p className="text-xs text-monokai-comment mb-6 text-center max-w-xs">
              创建规则的根逻辑组，开始配置条件。
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => handleCreateRoot('and')}
                className="flex items-center gap-2 px-3.5 py-2 bg-monokai-accent text-monokai-bg rounded-lg hover:bg-monokai-accent-hover transition-colors text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus size={14} /> 创建 AND 组
              </button>
              <button 
                onClick={() => handleCreateRoot('or')}
                className="flex items-center gap-2 px-3.5 py-2 bg-monokai-surface text-monokai-fg border border-monokai-border rounded-lg hover:bg-monokai-hover transition-colors text-xs font-bold cursor-pointer"
              >
                <Plus size={14} /> 创建 OR 组
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};


export default RuleTreeEditor;
