import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  Activity, 
  GitBranch, 
  HelpCircle,
  Sparkles,
  BookMarked,
  Search,
  Check,
  Award,
  X,
  FileCode2,
  Clock
} from 'lucide-react';
import { useOntologyStore, ONTOLOGY_SEED_INFOS, MECELayer } from '../../hooks/useOntologyStore';
import { MermaidChart } from '../MermaidChart';

// ============================================================
// MergeConflictModal
// ============================================================

interface MergeConflictModalProps {
  isOpen: boolean;
  conflicts: Array<{ type: string; name: string; details: string }>;
  onCancel: () => void;
  onProceed: (resolution: 'overwrite' | 'skip') => void;
}

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({
  isOpen,
  conflicts,
  onCancel,
  onProceed
}) => {
  if (!isOpen) return null;

  const typeMap: Record<string, string> = {
    objectType: '对象类型 (Schema)',
    linkType: '关系类型 (Schema)',
    object: '实体节点 (Node)',
    link: '关联线 (Edge)',
    action: '行动计划 (Action)'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4">
      <div className="w-[620px] max-h-[80vh] bg-monokai-bg border border-monokai-orange/40 rounded-none shadow-[0_0_24px_rgba(253,151,31,0.2)] flex flex-col font-sans text-monokai-fg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border/40 bg-monokai-surface/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-monokai-orange animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-monokai-orange tracking-wide uppercase">模式注入冲突检测</h3>
              <p className="text-[10px] text-monokai-comment/80 mt-0.5">检测到模式库元素与当前画布已有架构存在重复或定义冲突</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-monokai-comment hover:text-monokai-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[45vh] custom-scrollbar">
          {conflicts.map((c, i) => (
            <div key={i} className="flex flex-col gap-1 p-2 bg-monokai-surface border border-monokai-border/20">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-monokai-cyan uppercase tracking-wider">{typeMap[c.type] || c.type}</span>
                <span className="font-semibold text-monokai-fg bg-monokai-sidebar/80 px-1.5 py-0.5">{c.name}</span>
              </div>
              <p className="text-[10px] text-monokai-comment leading-relaxed mt-0.5">{c.details}</p>
            </div>
          ))}
        </div>

        {/* Actions info */}
        <div className="px-5 py-3 bg-monokai-sidebar/20 border-t border-monokai-border/30 text-[10px] text-monokai-comment leading-relaxed">
          <span className="font-bold text-monokai-orange block mb-1">请选择合并冲突解决策略：</span>
          <div>• <span className="text-monokai-green font-bold">跳过冲突（保留现有）</span>: 只把当前画布没有的新类型和节点注入，已存在的冲突数据保持现状。</div>
          <div className="mt-0.5">• <span className="text-monokai-pink font-bold">覆盖冲突（注入模式）</span>: 将本地冲突节点的属性、描述以模式库的数据进行覆写同步。</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-monokai-border/40 bg-monokai-surface/20">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/40 transition-colors border border-monokai-border/30"
          >
            取消合并
          </button>
          <button 
            onClick={() => onProceed('skip')}
            className="px-4 py-2 text-xs font-bold text-monokai-green bg-monokai-green/10 hover:bg-monokai-green/20 border border-monokai-green/30 transition-colors"
          >
            保留本地原有
          </button>
          <button 
            onClick={() => onProceed('overwrite')}
            className="px-4 py-2 text-xs font-bold text-monokai-pink bg-monokai-pink/10 hover:bg-monokai-pink/20 border border-monokai-pink/30 transition-colors"
          >
            覆盖冲突项
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Component
// ============================================================

interface PatternLibraryPanelProps {
  state: any;
  activeTemplateId: string;
  switchTemplate: (templateId: string) => Promise<void>;
  onTablesReady?: () => void;
}

export const PatternLibraryPanel: React.FC<PatternLibraryPanelProps> = ({
  state,
  activeTemplateId,
  switchTemplate,
  onTablesReady
}) => {
  const store = useOntologyStore();
  
  // Navigation & Filtering State
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    foundational: true,
    patterns: true,
    abstractions: true,
    methodology: true
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string>('oma-core');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [schemaOnly, setSchemaOnly] = useState(false);
  const [detailTab, setDetailTab] = useState<'concept' | 'topology' | 'practices'>('concept');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    setDetailTab('concept');
  }, [selectedNodeId]);
  
  // Merge Conflict State
  const [conflictState, setConflictState] = useState<{
    show: boolean;
    templateId: string;
    conflicts: Array<{ type: string; name: string; details: string }>;
  }>({ show: false, templateId: '', conflicts: [] });

  const [mergeToast, setMergeToast] = useState<{ show: boolean; msg: string; success: boolean }>({ show: false, msg: '', success: true });

  // Toggle category collapse
  const toggleCat = (catId: string) => {
    setExpandedCats(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const wikiCategories = useMemo(() => {
    const catsMap = new Map<string, { id: string; title: string; icon: React.ElementType; nodes: any[] }>();
    const iconMap: Record<string, React.ElementType> = {
      BookOpen, Sparkles, GitBranch, Layers, Activity, Clock, AlertTriangle, HelpCircle
    };
    const catIcons: Record<string, React.ElementType> = {
      foundational: Layers,
      patterns: GitBranch,
      abstractions: AlertTriangle,
      methodology: BookMarked
    };

    (store.patterns || []).forEach((p: any) => {
      const catId = p.category_id || p.categoryId || 'custom';
      const catTitle = p.category_title || p.categoryTitle || '自定义模式';
      if (!catsMap.has(catId)) {
        catsMap.set(catId, {
          id: catId,
          title: catTitle,
          icon: catIcons[catId] || BookOpen,
          nodes: []
        });
      }
      catsMap.get(catId)!.nodes.push({
        ...p,
        icon: iconMap[p.iconName || p.icon_name] || BookOpen
      });
    });
    return Array.from(catsMap.values());
  }, [store.patterns]);

  const expandAll = useCallback(() => {
    const updated: Record<string, boolean> = {};
    wikiCategories.forEach(cat => {
      updated[cat.id] = true;
    });
    setExpandedCats(updated);
  }, [wikiCategories]);

  const collapseAll = useCallback(() => {
    const updated: Record<string, boolean> = {};
    wikiCategories.forEach(cat => {
      updated[cat.id] = false;
    });
    setExpandedCats(updated);
  }, [wikiCategories]);

  // Find currently selected Wiki node
  const activeNode = useMemo(() => {
    for (const cat of wikiCategories) {
      const found = cat.nodes.find(n => n.id === selectedNodeId);
      if (found) return found;
    }
    if (wikiCategories.length > 0 && wikiCategories[0].nodes.length > 0) {
      return wikiCategories[0].nodes[0];
    }
    return {
      id: '', title: '加载中...', icon: BookOpen, brief: '请稍候...', seedIds: [], coreNodes: [], principles: [], bestPractices: [], antiPatterns: [], description: '', layer: 'foundation'
    };
  }, [selectedNodeId, wikiCategories]);

  // Sync selected node with Graph Search & Canvas active layer
  useEffect(() => {
    if (activeNode && activeNode.id && store?.dispatch) {
      // 1. Update the search term in global store to match the pattern's core components
      const term = activeNode.coreNodes.join(' ');
      store.dispatch({ type: 'SET_SEARCH', term });
      
      // 2. Sync canvas layer
      store.dispatch({ type: 'SET_CANVAS_LAYER', layer: activeNode.layer });
    }
  }, [selectedNodeId, activeNode, store?.dispatch]);

  // Filtered Wiki tree based on search keyword
  const filteredCategories = useMemo(() => {
    if (!wikiSearchQuery.trim()) return wikiCategories;
    const query = wikiSearchQuery.toLowerCase();
    
    return wikiCategories.map(cat => {
      const filteredNodes = cat.nodes.filter(node => 
        node.title.toLowerCase().includes(query) ||
        node.brief.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.coreNodes.some((n: string) => n.toLowerCase().includes(query))
      );
      return {
        ...cat,
        nodes: filteredNodes
      };
    }).filter(cat => cat.nodes.length > 0);
  }, [wikiSearchQuery, wikiCategories]);

  // Handle template merge/apply pattern
  const handleApplyPattern = async (seedId: string) => {
    // 1. Scan for conflicts first using the store helper
    if ((store as any).checkTemplateMergeConflicts) {
      const { conflicts, hasConflicts } = (store as any).checkTemplateMergeConflicts(seedId);
      if (hasConflicts) {
        setConflictState({ show: true, templateId: seedId, conflicts });
        return;
      }
    }
    
    // No conflicts, execute safe merge directly
    await executeMerge(seedId, 'skip');
  };

  const executeMerge = async (seedId: string, resolution: 'overwrite' | 'skip') => {
    try {
      if ((store as any).mergeOntologyTemplate) {
        await (store as any).mergeOntologyTemplate(seedId, resolution, schemaOnly);
      } else {
        // Fallback to legacy switchTemplate if store has not updated
        await switchTemplate(seedId);
      }
      
      // Show success toast
      const seedInfo = ONTOLOGY_SEED_INFOS.find(s => s.id === seedId);
      setMergeToast({
        show: true,
        msg: `成功注入「${seedInfo?.name || '资产'}」，已与现有画布增量合并 ${schemaOnly ? '(仅结构)' : ''}`,
        success: true
      });
      setTimeout(() => setMergeToast(p => ({ ...p, show: false })), 3000);

      if (onTablesReady) {
        onTablesReady();
      }
      setConflictState({ show: false, templateId: '', conflicts: [] });
    } catch (err) {
      console.error('Failed to merge pattern seed:', err);
      setMergeToast({
        show: true,
        msg: '模式注入合并失败，详情见控制台',
        success: false
      });
      setTimeout(() => setMergeToast(p => ({ ...p, show: false })), 4000);
    }
  };

  // Perform clean reload (overwrite template completely for tutorial purposes)
  const handleCleanReload = async (seedId: string) => {
    if (!window.confirm("这会完全擦除当前画布并替换为此模式的专属教学数据，确认继续？")) return;
    try {
      await switchTemplate(seedId);
      
      setMergeToast({
        show: true,
        msg: '已完全重新载入专属教学图谱',
        success: true
      });
      setTimeout(() => setMergeToast(p => ({ ...p, show: false })), 3000);

      if (onTablesReady) {
        onTablesReady();
      }
    } catch (e) {
      console.error("Clean reload failed", e);
    }
  };

  return (
    <div className="flex flex-col h-full text-monokai-fg">
      {/* Header Info */}
      <div className="flex-shrink-0 border-b border-monokai-border/40 pb-3 mb-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <BookMarked className="w-4 h-4 text-monokai-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-monokai-cyan">Palantir Ontology 建模模式库</h3>
        </div>
        <p className="text-[11px] text-monokai-comment/70 px-1 leading-normal">
          系统化沉淀建模原则、通用模式与最佳实践。支持模式一键增量注入与冲突自动解决。
        </p>
      </div>

      {/* Directory and Article Layout */}
      {viewMode === 'list' ? (
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {/* Wiki Node Search Bar */}
          <div className="flex-shrink-0 px-1 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment/50" />
              <input
                type="text"
                value={wikiSearchQuery}
                onChange={e => setWikiSearchQuery(e.target.value)}
                placeholder="搜索建模思维、模式与最佳实践..."
                className="w-full pl-8 pr-4 py-1.5 text-[11px] bg-monokai-surface border border-monokai-border/30 hover:border-monokai-accent/40 text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-cyan/50 focus:bg-monokai-bg transition-all"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-monokai-comment px-1">
              <span>{filteredCategories.reduce((acc, cat) => acc + cat.nodes.length, 0)} 个模式</span>
              <div className="flex items-center gap-2">
                <button onClick={expandAll} className="hover:text-monokai-cyan transition-all duration-150">展开全部</button>
                <span className="text-monokai-border/30">|</span>
                <button onClick={collapseAll} className="hover:text-monokai-cyan transition-all duration-150">收起全部</button>
              </div>
            </div>
          </div>

          {/* Tree Accordion Section */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-monokai-border/30 rounded-none p-2 bg-monokai-sidebar/30">
            <div className="space-y-2">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-monokai-comment">未找到匹配的建模模式</div>
              ) : (
                filteredCategories.map(cat => {
                  const Icon = cat.icon;
                  const isExpanded = expandedCats[cat.id] || wikiSearchQuery.trim().length > 0;
                  return (
                    <div key={cat.id} className="space-y-1">
                      <button 
                        onClick={() => toggleCat(cat.id)}
                        className="w-full flex items-center justify-between py-1 px-1.5 rounded-none hover:bg-monokai-sidebar/60 transition-colors text-left text-xs font-semibold text-monokai-comment/90"
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-monokai-orange/80 shrink-0" />
                          <span className="truncate">{cat.title}</span>
                        </div>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="pl-4 border-l border-monokai-border/30 ml-2.5 space-y-0.5">
                          {cat.nodes.map(node => {
                            const isSelected = selectedNodeId === node.id;
                            const NodeIcon = node.icon;

                            return (
                              <button
                                key={node.id}
                                onClick={() => {
                                  setSelectedNodeId(node.id);
                                  setViewMode('detail');
                                }}
                                className={`w-full flex items-center justify-between py-1.5 px-2 rounded-none text-[11px] text-left transition-all ${
                                  isSelected 
                                    ? 'bg-monokai-cyan/10 text-monokai-cyan font-bold border-l-2 border-monokai-cyan pl-1.5'
                                    : 'hover:bg-monokai-sidebar/40 text-monokai-fg/80'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <NodeIcon className={`w-3 h-3 shrink-0 ${isSelected ? 'text-monokai-cyan' : 'text-monokai-comment/70'}`} />
                                  <span className="truncate">{node.title}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          {/* Back Navigation Bar */}
          <div className="flex-shrink-0 px-1 flex items-center justify-between gap-2">
            <button 
              onClick={() => setViewMode('list')}
              className="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-monokai-cyan bg-monokai-cyan/10 hover:bg-monokai-cyan/20 border border-monokai-cyan/20 hover:border-monokai-cyan/45 rounded-lg transition-all duration-200 active:scale-[0.98]"
            >
              <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>返回目录</span>
            </button>
            <select
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              className="max-w-[160px] text-[10px] bg-monokai-sidebar border border-monokai-border/30 rounded px-1.5 py-1 text-monokai-fg outline-none focus:border-monokai-cyan transition-colors"
            >
              {wikiCategories.map(cat => (
                <optgroup key={cat.id} label={cat.title} className="bg-monokai-bg text-[10px]">
                  {cat.nodes.map(n => (
                    <option key={n.id} value={n.id} className="text-[10px]">{n.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Wiki Details Panel */}
          <div className="flex-1 min-h-0 flex flex-col border border-monokai-border/30 rounded-none bg-monokai-surface/30">
            
            {/* Header Title & Brief (Always Visible) */}
            <div className="p-3 border-b border-monokai-border/20 bg-monokai-sidebar/20 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-monokai-fg mb-1.5">
                {activeNode.icon && React.createElement(activeNode.icon, { className: "w-4 h-4 text-monokai-cyan" })}
                <span className="truncate">{activeNode.title}</span>
              </div>
              <p className="text-[11px] text-monokai-comment/80 leading-normal line-clamp-2" title={activeNode.brief}>
                {activeNode.brief}
              </p>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-monokai-border/10 bg-monokai-sidebar/10 flex-shrink-0 text-[10px]">
              <button
                onClick={() => setDetailTab('concept')}
                className={`flex-1 py-2 text-center font-bold border-b-2 transition-all ${
                  detailTab === 'concept'
                    ? 'border-monokai-cyan text-monokai-cyan bg-monokai-cyan/5'
                    : 'border-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/20'
                }`}
              >
                💡 概念与逻辑
              </button>
              {activeNode.mermaid && (
                <button
                  onClick={() => setDetailTab('topology')}
                  className={`flex-1 py-2 text-center font-bold border-b-2 transition-all ${
                    detailTab === 'topology'
                      ? 'border-monokai-cyan text-monokai-cyan bg-monokai-cyan/5'
                      : 'border-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/20'
                  }`}
                >
                  📐 拓扑结构
                </button>
              )}
              <button
                onClick={() => setDetailTab('practices')}
                className={`flex-1 py-2 text-center font-bold border-b-2 transition-all ${
                  detailTab === 'practices'
                    ? 'border-monokai-cyan text-monokai-cyan bg-monokai-cyan/5'
                    : 'border-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-sidebar/20'
                }`}
              >
                🛡️ 实践指南
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
              {detailTab === 'concept' && (
                <div className="space-y-4">
                  {/* Core Idea */}
                  <div className="space-y-1 bg-monokai-sidebar/20 p-2.5 border border-monokai-border/10">
                    <h4 className="text-[10px] font-bold text-monokai-orange/95 uppercase tracking-wider">💡 建模逻辑解析</h4>
                    <p className="text-[11px] text-monokai-fg/80 leading-normal">
                      {activeNode.description}
                    </p>
                  </div>

                  {/* Principles */}
                  {activeNode.principles && activeNode.principles.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-bold text-monokai-cyan uppercase tracking-wider">⚡ 核心设计原则</h4>
                      <ul className="pl-4 space-y-1 text-[11px] text-monokai-fg/75 list-none">
                        {activeNode.principles.map((pr: string, idx: number) => (
                          <li key={idx} className="leading-normal flex items-start gap-1.5">
                            <span className="text-monokai-cyan shrink-0 mt-1">•</span>
                            <span>{pr}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Associated Nodes Info */}
                  {activeNode.coreNodes && activeNode.coreNodes.length > 0 && (
                    <div className="text-[10px] text-monokai-comment/60 bg-monokai-sidebar/20 p-2 rounded border border-monokai-border/20">
                      <span className="font-semibold block mb-0.5 text-monokai-cyan/80">🎨 对应图谱 / 画布核心类型：</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeNode.coreNodes.map((node: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-monokai-cyan/10 border border-monokai-cyan/20 text-monokai-cyan text-[9px]">
                            {node}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'topology' && activeNode.mermaid && (
                <div className="space-y-2">
                  <div className="bg-monokai-sidebar/30 border border-monokai-border/20 rounded p-1 overflow-hidden">
                    <MermaidChart chart={activeNode.mermaid} />
                  </div>
                </div>
              )}

              {detailTab === 'practices' && (
                <div className="space-y-4">
                  {/* Best Practices */}
                  {activeNode.bestPractices && activeNode.bestPractices.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-monokai-green uppercase tracking-wider flex items-center gap-1.5 pl-1">
                        <CheckCircle className="w-3.5 h-3.5 text-monokai-green" />
                        <span>最佳实践 (Best Practices)</span>
                      </h4>
                      <div className="space-y-2 pl-1">
                        {activeNode.bestPractices.map((bp: string, idx: number) => (
                          <div key={idx} className="bg-monokai-green/[0.03] border-l-4 border-l-monokai-green border-y-transparent border-r-transparent p-2 text-[11px] text-monokai-fg/85 leading-normal flex items-start gap-2 rounded-r-md">
                            <Check className="w-3.5 h-3.5 text-monokai-green shrink-0 mt-0.5" />
                            <span>{bp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anti-Patterns */}
                  {activeNode.antiPatterns && activeNode.antiPatterns.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-monokai-pink uppercase tracking-wider flex items-center gap-1.5 pl-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-monokai-pink" />
                        <span>反模式与重构 (Anti-Patterns)</span>
                      </h4>
                      <div className="space-y-2.5 pl-1">
                        {activeNode.antiPatterns.map((ap: any, idx: number) => (
                          <div key={idx} className="bg-monokai-pink/[0.03] border-l-4 border-l-monokai-pink border-y-transparent border-r-transparent p-2.5 space-y-1.5 rounded-r-md">
                            <span className="text-[10px] font-bold text-monokai-pink block">❌ {ap.title}</span>
                            <div className="space-y-1.5 text-[10px] leading-relaxed">
                              <div>
                                <span className="text-monokai-pink/80 font-bold">错误做法：</span>
                                <span className="text-monokai-comment/80">{ap.bad}</span>
                              </div>
                              <div className="mt-1 border-t border-monokai-border/10 pt-1.5">
                                <span className="text-monokai-green font-bold">正确做法：</span>
                                <span className="text-monokai-fg/90">{ap.good}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Floating Actions Footer (Glassmorphism design) */}
            <div className="border-t border-monokai-border/30 bg-monokai-sidebar/70 backdrop-blur-md p-3 flex flex-col gap-2.5 flex-shrink-0">
              {/* Schema Only Toggle */}
              <label className="flex items-center gap-2 text-[10px] text-monokai-comment cursor-pointer select-none hover:text-monokai-fg transition-colors">
                <input
                  type="checkbox"
                  checked={schemaOnly}
                  onChange={e => setSchemaOnly(e.target.checked)}
                  className="rounded bg-monokai-surface border-monokai-border/40 text-monokai-cyan focus:ring-0 focus:ring-offset-0"
                />
                <span>仅导入结构定义 (不导入任何测试数据实例)</span>
              </label>

              {/* CTA Button Group */}
              <div className="flex flex-col gap-1.5">
                {activeNode.seedIds && activeNode.seedIds.map((seedId: string) => {
                  const seedInfo = ONTOLOGY_SEED_INFOS.find(s => s.id === seedId);
                  if (!seedInfo) return null;
                  const isCurrentlyActive = activeTemplateId === seedId;

                  return (
                    <div key={seedId} className="flex gap-1.5">
                      {/* Primary Apply/Merge Button */}
                      <button
                        disabled={state.initting}
                        onClick={() => handleApplyPattern(seedId)}
                        className={`flex-1 group flex items-center justify-center gap-1.5 px-3 py-2 rounded font-bold transition-all text-[11px] border ${
                          isCurrentlyActive 
                            ? 'bg-monokai-green/10 border-monokai-green text-monokai-green shadow-[0_0_12px_rgba(166,226,46,0.15)]'
                            : 'bg-monokai-cyan/15 border-monokai-cyan text-monokai-cyan hover:bg-monokai-cyan/25 hover:shadow-[0_0_12px_rgba(102,217,239,0.25)] active:scale-[0.98]'
                        }`}
                      >
                        <Zap className={`w-3.5 h-3.5 shrink-0 ${isCurrentlyActive ? 'text-monokai-green animate-pulse' : 'text-monokai-cyan'}`} />
                        <span className="truncate">{isCurrentlyActive ? '当前正在运行' : `增量注入模式：${seedInfo.name.split('：')[1] || seedInfo.name}`}</span>
                      </button>

                      {/* Dangerous Clean Reload Button */}
                      <button
                        disabled={state.initting}
                        title="重载此专属教学图谱（会清空当前已有画布）"
                        onClick={() => handleCleanReload(seedId)}
                        className="px-2.5 py-2 rounded bg-monokai-pink/10 hover:bg-monokai-pink/20 border border-monokai-pink/30 text-monokai-pink text-[11px] font-bold active:scale-[0.98] transition-all"
                      >
                        完全重载
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Toast Alert */}
      {mergeToast.show && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 text-xs font-bold shadow-lg flex items-center gap-2 ${
          mergeToast.success ? 'bg-monokai-green text-black' : 'bg-monokai-pink text-white'
        }`}>
          <Check className="w-3.5 h-3.5" />
          <span>{mergeToast.msg}</span>
        </div>
      )}

      {/* Merge Conflict Modal */}
      <MergeConflictModal
        isOpen={conflictState.show}
        conflicts={conflictState.conflicts}
        onCancel={() => setConflictState({ show: false, templateId: '', conflicts: [] })}
        onProceed={(resolution) => executeMerge(conflictState.templateId, resolution)}
      />
    </div>
  );
};
