import React, { useMemo, useState } from 'react';
import {
  Archive, Copy, Edit3, Filter, GitBranch, Plus, Search, Trash2, X, AlertCircle, Play, Network, Layers, Download, Upload
} from 'lucide-react';
import { toastService } from '../../services/toastService';


import {
  validateRule,
  type FeatureDefinition, type RuleAst, type RuleDefinition,
} from '../../services/ontology/ontologyInferenceEngine';

// Helpers

function findRuleReferences(rules: RuleDefinition[], targetRuleId: string): string[] {
  const referencers: string[] = [];

  function walkAst(node: any): boolean {
    if (!node) return false;
    if (node.kind === 'ruleRef' && node.ruleId === targetRuleId) {
      return true;
    }
    if (node.kind === 'and' || node.kind === 'or') {
      return (node.children || []).some(walkAst);
    }
    if (node.kind === 'not') {
      return walkAst(node.child);
    }
    return false;
  }

  for (const rule of rules) {
    if (rule.id !== targetRuleId && walkAst(rule.root)) {
      referencers.push(rule.id);
    }
  }

  return referencers;
}

function countReferencedFeatures(node: any): number {
  const featureIds = new Set<string>();

  function walkAst(n: any) {
    if (!n) return;
    if (n.kind === 'condition' && n.featureId) {
      featureIds.add(n.featureId);
    }
    if (n.kind === 'and' || n.kind === 'or') {
      (n.children || []).forEach(walkAst);
    }
    if (n.kind === 'not') {
      walkAst(n.child);
    }
  }

  walkAst(node);
  return featureIds.size;
}

function findChildRuleRefs(node: any): string[] {
  const childRuleIds = new Set<string>();
  function walkAst(n: any) {
    if (!n) return;
    if (n.kind === 'ruleRef' && n.ruleId) {
      childRuleIds.add(n.ruleId);
    }
    if (n.kind === 'and' || n.kind === 'or') {
      (n.children || []).forEach(walkAst);
    }
    if (n.kind === 'not') {
      walkAst(n.child);
    }
  }
  walkAst(node);
  return Array.from(childRuleIds);
}

function regenerateNodeIds(node: any): any {
  if (!node) return node;

  const generateNodeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

  const newNode = { ...node };

  if (newNode.kind === 'and' || newNode.kind === 'or') {
    newNode.nodeId = generateNodeId(`logic_${newNode.kind}`);
    newNode.children = (newNode.children || []).map(regenerateNodeIds);
  } else if (newNode.kind === 'not') {
    newNode.nodeId = generateNodeId('logic_not');
    newNode.child = regenerateNodeIds(newNode.child);
  } else if (newNode.kind === 'condition') {
    newNode.nodeId = generateNodeId('cond');
  } else if (newNode.kind === 'ruleRef') {
    newNode.nodeId = generateNodeId('ref');
  }

  return newNode;
}

export interface RuleManagerPanelProps {
  rules: RuleDefinition[];
  features: FeatureDefinition[];
  onRulesChange: (rules: RuleDefinition[]) => void;
  onEditRule: (ruleId: string) => void;
}

export const RuleManagerPanel: React.FC<RuleManagerPanelProps> = ({
  rules,
  features,
  onRulesChange,
  onEditRule,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');


  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          rule.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || rule.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rules, searchTerm, statusFilter]);

  const handleCreateRule = () => {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newRule: RuleDefinition = {
      id,
      logicalId: `l_${id}`,
      version: 1,
      name: '新规则',
      description: '',
      status: 'draft',
      root: { kind: 'and', nodeId: `logic_and_${Math.random().toString(36).slice(2, 8)}`, children: [] } as any,
    };
    onRulesChange([...rules, newRule]);
    onEditRule(id);
  };

  const handleCopyRule = (rule: RuleDefinition) => {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newRule: RuleDefinition = {
      ...rule,
      id,
      logicalId: `l_${id}`,
      version: rule.version + 1,
      name: `${rule.name} (副本)`,
      status: 'draft',
      root: regenerateNodeIds(rule.root),
    };
    onRulesChange([...rules, newRule]);
  };

  const handleDeleteRule = (ruleId: string) => {
    const referencers = findRuleReferences(rules, ruleId);
    if (referencers.length > 0) {
      toastService.warning(`此规则被 ${referencers.length} 条其他规则引用，无法删除`);
      return;
    }
    if (confirm('确定要删除此规则吗？')) {
      onRulesChange(rules.filter(r => r.id !== ruleId));
      toastService.success('规则已删除');
    }
  };

  const handleToggleStatus = (rule: RuleDefinition) => {
    const newStatus = rule.status === 'active' ? 'archived' : 'active';
    const updatedRules = rules.map(r => r.id === rule.id ? { ...r, status: newStatus as any } : r);
    onRulesChange(updatedRules);
  };

  const handleActivateDraft = (rule: RuleDefinition) => {
    const updatedRules = rules.map(r => r.id === rule.id ? { ...r, status: 'active' as any } : r);
    onRulesChange(updatedRules);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(rules, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ontology_rules_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('规则库已成功导出为 JSON 文件');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (Array.isArray(imported)) {
          onRulesChange(imported);
          toastService.success(`成功导入 ${imported.length} 条规则`);
        }
      } catch (err) {
        toastService.error(`导入 JSON 失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-monokai-bg text-monokai-fg p-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black flex items-center gap-2 text-monokai-fg">
            <GitBranch size={20} className="text-monokai-cyan" />
            规则库管理
          </h2>
          <div className="flex bg-monokai-sidebar border border-monokai-border rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-monokai-cyan/15 text-monokai-cyan' : 'text-monokai-comment hover:text-monokai-fg'}`}
            >
              列表视图
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${viewMode === 'tree' ? 'bg-monokai-cyan/15 text-monokai-cyan' : 'text-monokai-comment hover:text-monokai-fg'}`}
            >
              依赖图谱
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-monokai-sidebar hover:bg-monokai-surface text-monokai-fg rounded-lg text-xs font-bold transition-colors border border-monokai-border cursor-pointer"
            title="导出全部规则为 JSON"
          >
            <Download size={14} /> 导出 JSON
          </button>

          <label
            className="flex items-center gap-1.5 px-3 py-2 bg-monokai-sidebar hover:bg-monokai-surface text-monokai-fg rounded-lg text-xs font-bold transition-colors border border-monokai-border cursor-pointer"
            title="导入 JSON 规则文件"
          >
            <Upload size={14} /> 导入 JSON
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
          <button
            onClick={handleCreateRule}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            新建规则
          </button>
        </div>
      </div>


      {/* Filters and Search */}
      <div className="flex justify-between items-center mb-6 shrink-0 gap-4">
        <div className="flex bg-monokai-sidebar border border-monokai-border rounded-lg p-1 gap-1">
          {[
            { value: 'all', label: '全部' },
            { value: 'draft', label: '草稿' },
            { value: 'active', label: '生效中' },
            { value: 'archived', label: '已归档' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                statusFilter === opt.value
                  ? 'bg-monokai-surface text-monokai-fg border border-monokai-border-subtle'
                  : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-monokai-comment" />
          <input
            type="text"
            placeholder="搜索规则..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-monokai-sidebar border border-monokai-border rounded-lg py-2 pl-9 pr-4 text-xs text-monokai-fg focus:outline-none focus:border-monokai-accent transition-colors placeholder:text-monokai-comment"
          />
        </div>
      </div>

      {/* Content View: List or Dependency Tree */}
      {viewMode === 'tree' ? (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <div className="bg-monokai-sidebar border border-monokai-border rounded-xl p-4">
            <h3 className="text-xs font-bold text-monokai-fg mb-3 flex items-center gap-2">
              <Network size={14} className="text-monokai-accent" /> 子规则引用网络拓扑
            </h3>
            <div className="space-y-3">
              {rules.map(rule => {
                const childRefs = findChildRuleRefs(rule.root);
                const referencers = findRuleReferences(rules, rule.id);
                return (
                  <div key={rule.id} className="border border-monokai-border-subtle rounded-lg p-3 bg-monokai-surface text-xs">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 font-bold text-monokai-fg">
                        <span>{rule.name}</span>
                        <span className="text-[10px] text-monokai-comment">({rule.id})</span>
                      </div>
                      <button
                        onClick={() => onEditRule(rule.id)}
                        className="text-monokai-accent hover:underline text-[11px] cursor-pointer"
                      >
                        编辑 AST
                      </button>
                    </div>

                    {childRefs.length > 0 && (
                      <div className="mt-2 text-[11px] text-monokai-comment">
                        ↳ 调用的子规则: {childRefs.map(id => rules.find(r => r.id === id)?.name || id).join('、')}
                      </div>
                    )}
                    {referencers.length > 0 && (
                      <div className="mt-1 text-[11px] text-monokai-green">
                        ↑ 被上级规则引用: {referencers.map(id => rules.find(r => r.id === id)?.name || id).join('、')}
                      </div>
                    )}
                    {childRefs.length === 0 && referencers.length === 0 && (
                      <div className="mt-1 text-[10px] text-monokai-comment">独立基础规则</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Rule List */
        <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-3 pb-6 custom-scrollbar">
          {filteredRules.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-monokai-comment">
              <GitBranch size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-bold mb-2">
                {rules.length === 0 ? '暂无规则' : '未找到匹配的规则'}
              </p>
              {rules.length === 0 && (
                <p className="text-xs">
                  点击右上角的"新建规则"按钮开始创建第一条规则
                </p>
              )}
            </div>
          ) : (
            filteredRules.map(rule => {
              const referencers = findRuleReferences(rules, rule.id);
              const featureCount = countReferencedFeatures(rule.root);

              const validationReport = validateRule(rule, features, rules);
              const isValid = validationReport.valid;

              return (
                <div
                  key={rule.id}
                  className="group border border-monokai-border bg-monokai-sidebar rounded-xl p-4 hover:border-monokai-border-strong transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-black text-monokai-fg">{rule.name}</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-comment border border-monokai-border-subtle">
                        v{rule.version}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rule.status === 'draft' ? 'bg-monokai-yellow/10 text-monokai-yellow border border-monokai-border-subtle' :
                        rule.status === 'active' ? 'bg-monokai-green/10 text-monokai-green border border-monokai-border-subtle' :
                        'bg-monokai-surface text-monokai-comment border border-monokai-border-subtle'
                      }`}>
                        {rule.status === 'draft' ? '草稿' :
                         rule.status === 'active' ? '生效中' : '已归档'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditRule(rule.id)}
                        className="p-1.5 text-monokai-comment hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleCopyRule(rule)}
                        className="p-1.5 text-monokai-comment hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="复制"
                      >
                        <Copy size={16} />
                      </button>

                      {rule.status === 'draft' ? (
                        <button
                          onClick={() => handleActivateDraft(rule)}
                          className="p-1.5 text-monokai-comment hover:text-monokai-green hover:bg-monokai-green/10 rounded-lg transition-colors"
                          title="激活"
                        >
                          <Play size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(rule)}
                          className="p-1.5 text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/10 rounded-lg transition-colors"
                          title={rule.status === 'active' ? '归档' : '激活'}
                        >
                          <Archive size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-pink/10 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-monokai-comment mb-4 line-clamp-2">
                    {rule.description || '暂无描述'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-monokai-comment">
                    <div className="flex items-center gap-1.5">
                      {isValid ? (
                        <span className="flex items-center gap-1 text-monokai-green">
                          <span className="w-1.5 h-1.5 rounded-full bg-monokai-green"></span>
                          校验通过
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-monokai-pink">
                          <AlertCircle size={12} />
                          {validationReport.errors.length} 个错误
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span>关联特征:</span>
                      <span className="text-white font-bold">{featureCount}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span>被引用:</span>
                      <span className={`font-bold ${referencers.length > 0 ? 'text-monokai-cyan' : 'text-white'}`}>
                        {referencers.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                      <span className="opacity-50">ID:</span>
                      <span className="font-mono">{rule.id}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};


export default RuleManagerPanel;
