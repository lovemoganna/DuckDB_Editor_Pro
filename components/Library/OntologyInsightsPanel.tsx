/**
 * OntologyInsightsPanel — AI 增强的洞察面板
 *
 * 提供:
 * - 基于图谱分析的洞察建议
 * - 分组建议 (基于类型+关系聚类)
 * - 反思流程 (Introspection)
 * - 洞察记录与管理
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles, Lightbulb, Plus, X, Tag, Clock, ArrowRight,
  Brain, ChevronRight, Edit3, Save, Trash2, MessageSquare,
  TrendingUp, Target, Star, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import { ontologyAiService, SuggestionItem, IntrospectionGuidance } from '../../services/ontologyAiService';
import { ActionButton, IconButton, Badge } from '../ui/Workbench';

interface LifeObject {
  id: number;
  object_type_id: number;
  name: string;
  properties: string;
  annotations?: string;
}

interface LifeObjectType {
  id: number;
  name: string;
  description: string;
}

interface LifeLink {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight: number;
}

interface LifeLinkType {
  id: number;
  name: string;
  description: string;
}

interface Introspection {
  id: number;
  object_id: number;
  question: string;
  answer: string;
  created_at: string;
}

interface Insight {
  id: number;
  object_id: number;
  object_name?: string;
  insight: string;
  tag: string;
  created_at: string;
}

// Grouping suggestion algorithm
function computeGroupingSuggestions(
  objects: LifeObject[],
  links: LifeLink[],
  objectTypes: LifeObjectType[]
): Array<{ type: 'hub' | 'isolated' | 'cross_type' | 'cycle' | 'weight_imbalance'; severity: 'high' | 'medium' | 'low'; message: string; objectIds?: number[] }> {
  const suggestions: Array<{ type: 'hub' | 'isolated' | 'cross_type' | 'cycle' | 'weight_imbalance'; severity: 'high' | 'medium' | 'low'; message: string; objectIds?: number[] }> = [];

  // Degree analysis
  const degree: Record<number, number> = {};
  objects.forEach(o => { degree[o.id] = 0; });
  links.forEach(l => {
    degree[l.source_object_id] = (degree[l.source_object_id] || 0) + 1;
    degree[l.target_object_id] = (degree[l.target_object_id] || 0) + 1;
  });

  const degrees = Object.values(degree);
  const avgDegree = degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const isolated = objects.filter(o => degree[o.id] === 0);
  if (isolated.length > 0) {
    suggestions.push({ type: 'isolated', severity: isolated.length > 2 ? 'high' : 'medium', message: `${isolated.length} 个对象没有连接 — 考虑为它们添加关系`, objectIds: isolated.map(o => o.id) });
  }

  // Hub detection
  const hubs = objects.filter(o => (degree[o.id] || 0) > avgDegree * 2);
  if (hubs.length > 0) {
    suggestions.push({ type: 'hub', severity: 'medium', message: `${hubs.length} 个 Hub 节点可能是核心 — 请确保它们的关系权重合理` });
  }

  // Cross-type links
  const crossTypeLinks = links.filter(l => {
    const src = objects.find(o => o.id === l.source_object_id);
    const tgt = objects.find(o => o.id === l.target_object_id);
    return src && tgt && src.object_type_id !== tgt.object_type_id;
  });
  if (crossTypeLinks.length > 0) {
    suggestions.push({ type: 'cross_type', severity: 'low', message: `${crossTypeLinks.length} 条跨类型关系 — 这些边界关系可能蕴含重要洞察` });
  }

  // Weight imbalance
  const highWeight = links.filter(l => Number(l.weight) >= 0.9);
  const lowWeight = links.filter(l => Number(l.weight) <= 0.3);
  if (highWeight.length === 0 && objects.length > 2) {
    suggestions.push({ type: 'weight_imbalance', severity: 'medium', message: `没有发现核心关系 — 考虑提升重要关系的权重` });
  }
  if (lowWeight.length > links.length * 0.5 && links.length > 3) {
    suggestions.push({ type: 'weight_imbalance', severity: 'low', message: `${lowWeight.length} 条弱关系可能需要重新评估其价值` });
  }

  return suggestions;
}

// Type clustering suggestions
function computeTypeClusters(
  objects: LifeObject[],
  objectTypes: LifeObjectType[]
): Array<{ typeId: number; typeName: string; count: number; coverage: string }> {
  const typeCounts: Record<number, number> = {};
  objects.forEach(o => { typeCounts[o.object_type_id] = (typeCounts[o.object_type_id] || 0) + 1; });

  return objectTypes.map(ot => ({
    typeId: ot.id,
    typeName: ot.name,
    count: typeCounts[ot.id] || 0,
    coverage: objects.length > 0 ? `${(((typeCounts[ot.id] || 0) / objects.length) * 100).toFixed(0)}%` : '0%',
  }));
}

interface OntologyInsightsPanelProps {
  objects: LifeObject[];
  objectTypes: LifeObjectType[];
  links: LifeLink[];
  linkTypes: LifeLinkType[];
}

const OntologyInsightsPanel: React.FC<OntologyInsightsPanelProps> = ({
  objects, objectTypes, links, linkTypes,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'suggestions' | 'introspect' | 'insights'>('overview');
  const [introspections, setIntrospections] = useState<Introspection[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedObject, setSelectedObject] = useState<LifeObject | null>(null);
  const [introspectionQ, setIntrospectionQ] = useState('');
  const [introspectionA, setIntrospectionA] = useState('');
  const [insightText, setInsightText] = useState('');
  const [insightTag, setInsightTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const [initting, setInitting] = useState(false);

  // P1-2/P3-1: AI-powered suggestions
  const [aiSuggestions, setAiSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingAISuggestions, setLoadingAISuggestions] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState<string | null>(null);

  // P2-2: AI introspection guidance
  const [aiIntrospection, setAiIntrospection] = useState<IntrospectionGuidance | null>(null);
  const [loadingAIIntrospection, setLoadingAIIntrospection] = useState(false);
  const [aiIntrospectionError, setAiIntrospectionError] = useState<string | null>(null);
  const [introspectionTopic, setIntrospectionTopic] = useState('');

  // Load data — auto-init tables first
  const checkAndInit = useCallback(async () => {
    setLoadError(null);
    setNeedsInit(false);
    try {
      await duckDBService.ontologyInit();
      // Dynamically import ontologyInsightsService to preserve separation
      const insightsService = await import('../../services/ontology/ontologyInsightsService');
      const [ints, ins] = await Promise.all([
        insightsService.queryRecentIntrospections(20),
        insightsService.queryRecentInsights(20),
      ]);
      setIntrospections(ints as any[]);
      setInsights(ins as any[]);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('does not exist') || msg.includes('Catalog Error')) {
        setNeedsInit(true);
      } else {
        console.warn('[Insights] Load failed:', msg);
      }
    }
  }, []);

  useEffect(() => {
    checkAndInit();
  }, [checkAndInit]);

  // Computed data
  const suggestions = useMemo(() => computeGroupingSuggestions(objects, links, objectTypes), [objects, links, objectTypes]);
  const typeClusters = useMemo(() => computeTypeClusters(objects, objectTypes), [objects, objectTypes]);

  const handleAddIntrospection = async () => {
    if (!selectedObject || !introspectionQ.trim() || !introspectionA.trim()) return;
    setSaving(true);
    try {
      const insightsService = await import('../../services/ontology/ontologyInsightsService');
      await insightsService.addIntrospection(selectedObject.id, introspectionQ, introspectionA);
      const ints = await insightsService.queryIntrospectionsByObject(selectedObject.id, 20);
      setIntrospections(ints as any[]);
      setIntrospectionQ('');
      setIntrospectionA('');
    } catch {}
    setSaving(false);
  };

  const handleAddInsight = async () => {
    if (!selectedObject || !insightText.trim()) return;
    setSaving(true);
    try {
      const insightsService = await import('../../services/ontology/ontologyInsightsService');
      await insightsService.addInsight(selectedObject.id, insightText, insightTag || 'general');
      const ins = await insightsService.queryRecentInsights(20);
      setInsights(ins as any[]);
      setInsightText('');
      setInsightTag('');
    } catch {}
    setSaving(false);
  };

  const handleDeleteInsight = async (id: number) => {
    try {
      const insightsService = await import('../../services/ontology/ontologyInsightsService');
      await insightsService.deleteInsight(id);
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const TABS = [
    { id: 'overview' as const, label: '总览', icon: <TrendingUp className="w-3 h-3" />, color: '#66d9ef' },
    { id: 'suggestions' as const, label: `建议 (${suggestions.length})`, icon: <Lightbulb className="w-3 h-3" />, color: '#fbbf24' },
    { id: 'introspect' as const, label: '反思', icon: <Brain className="w-3 h-3" />, color: '#38bdf8' },
    { id: 'insights' as const, label: `洞察 (${insights.length})`, icon: <Lightbulb className="w-3 h-3" />, color: '#4ade80' },
  ];

  const SEVERITY_COLORS = { high: '#f87171', medium: '#fbbf24', low: '#38bdf8' };

  return (
    <div className="flex flex-col h-full bg-monokai-bg border border-monokai-border rounded-lg overflow-hidden text-monokai-fg">
      {/* Header */}
      <div className="p-3 border-b border-monokai-border bg-monokai-sidebar/60 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-monokai-cyan/15 text-monokai-cyan flex items-center justify-center border border-monokai-cyan/30 shrink-0">
          <TrendingUp className="w-4 h-4 text-monokai-cyan" />
        </div>
        <div>
          <div className="text-xs font-bold text-monokai-fg">本体洞察面板</div>
          <div className="text-[10px] text-monokai-comment">结构分析 · 反思引导 · 洞察记录</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 gap-1 border-b border-monokai-border bg-monokai-sidebar/40 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-monokai-surface text-monokai-cyan border border-monokai-cyan/30 shadow-xs'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50 border border-transparent'
            }`}
          >
            {t.icon} <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 text-xs">
        {loadError && !needsInit && (
          <div className="p-2.5 bg-monokai-yellow/10 border border-monokai-yellow/30 rounded-lg flex items-center gap-2 text-xs text-monokai-yellow">
            <AlertCircle className="w-4 h-4 shrink-0 text-monokai-yellow" />
            <span>{loadError}</span>
          </div>
        )}
        {needsInit && (
          <div className="p-4 bg-monokai-surface/60 border border-monokai-border rounded-lg text-center space-y-2">
            <div className="text-xs font-semibold text-monokai-fg">本体论尚未初始化</div>
            <div className="text-xs text-monokai-comment leading-relaxed">
              点击下方按钮初始化并导入种子数据后，即可使用 AI 洞察分析功能。
            </div>
            <div className="pt-1 flex justify-center">
              <ActionButton
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={initting}
                onClick={async () => {
                  setInitting(true);
                  try {
                    await duckDBService.ontologyInit();
                    await duckDBService.ontologySeed();
                    setNeedsInit(false);
                    await checkAndInit();
                  } catch (e: any) { console.error('[Insights] Init failed:', e); }
                  setInitting(false);
                }}
              >
                一键初始化
              </ActionButton>
            </div>
          </div>
        )}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-2.5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '对象', value: objects.length, color: 'text-monokai-cyan' },
                { label: '关系', value: links.length, color: 'text-monokai-accent' },
                { label: '类型', value: objectTypes.length, color: 'text-monokai-yellow' },
                { label: '建议', value: suggestions.length, color: 'text-monokai-orange' },
              ].map(item => (
                <div key={item.label} className="p-2.5 bg-monokai-surface/60 border border-monokai-border rounded-lg text-center">
                  <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] text-monokai-comment uppercase tracking-wider font-semibold mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Type coverage */}
            <div className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2">
              <div className="text-xs text-monokai-comment font-semibold uppercase tracking-wider mb-1">类型覆盖</div>
              {typeClusters.map(tc => {
                const pct = parseInt(tc.coverage) || 0;
                return (
                  <div key={tc.typeId} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-monokai-fg font-medium">{tc.typeName}</span>
                      <span className="text-monokai-comment font-mono">{tc.count} ({tc.coverage})</span>
                    </div>
                    <div className="h-1.5 bg-monokai-bg rounded-full overflow-hidden border border-monokai-border/40">
                      <div className="h-full bg-monokai-cyan rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top suggestions preview */}
            {suggestions.slice(0, 3).length > 0 && (
              <div className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2">
                <div className="text-xs text-monokai-comment font-semibold uppercase tracking-wider">待处理建议</div>
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${s.severity === 'high' ? 'bg-monokai-pink' : s.severity === 'medium' ? 'bg-monokai-yellow' : 'bg-monokai-cyan'}`} />
                    <span className="text-xs text-monokai-fg/80 leading-relaxed">{s.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="flex flex-col gap-2.5">
            {/* AI Suggestions — trigger button */}
            <div className="flex gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                icon={Sparkles}
                loading={loadingAISuggestions}
                disabled={objects.length === 0}
                onClick={async () => {
                  setLoadingAISuggestions(true);
                  setAiSuggestionsError(null);
                  try {
                    const objectNames = objects.map(o => o.name);
                    const linkNames = links.map(l => `${l.source_object_id}→${l.target_object_id}`);
                    const result = await ontologyAiService.generateSuggestions(objectNames, linkNames, objects.length, links.length);
                    setAiSuggestions(result || []);
                  } catch (e: any) {
                    setAiSuggestionsError(e?.message || 'AI 分析失败');
                    setAiSuggestions([]);
                  }
                  setLoadingAISuggestions(false);
                }}
              >
                图谱智能分析
              </ActionButton>
              {aiSuggestions.length > 0 && (
                <IconButton
                  icon={X}
                  label="清除建议"
                  size="sm"
                  onClick={() => setAiSuggestions([])}
                />
              )}
            </div>
            {aiSuggestionsError && (
              <div className="p-2.5 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-xs text-monokai-pink">
                {aiSuggestionsError}
              </div>
            )}
            {/* AI suggestions results */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-monokai-accent font-semibold uppercase tracking-wider">
                  分析建议 ({aiSuggestions.length})
                </div>
                {aiSuggestions.map((item, i) => (
                  <div key={i} className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="info" size="sm">{item.type}</Badge>
                      <span className="text-xs font-semibold text-monokai-fg flex-1">{item.title}</span>
                      <span className="text-xs font-mono text-monokai-comment">{(item.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-xs text-monokai-fg/80 leading-relaxed">{item.description}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-monokai-comment leading-relaxed">
              基于当前图谱结构自动分析，识别潜在问题和优化机会
            </div>
            {suggestions.length === 0 && (
              <div className="text-center py-6 text-monokai-accent text-xs">
                ✓ 图谱结构健康，没有发现明显问题
              </div>
            )}
            {suggestions.map((s, i) => {
              const ICONS: Record<string, React.ReactNode> = {
                isolated: <AlertCircle className="w-4 h-4 text-monokai-pink" />,
                hub: <Star className="w-4 h-4 text-monokai-yellow" />,
                cross_type: <ArrowRight className="w-4 h-4 text-monokai-cyan" />,
                weight_imbalance: <TrendingUp className="w-4 h-4 text-monokai-orange" />,
              };
              return (
                <div key={i} className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-monokai-surface border border-monokai-border flex items-center justify-center shrink-0">
                      {ICONS[s.type] || <Lightbulb className="w-4 h-4 text-monokai-yellow" />}
                    </div>
                    <div className="text-xs font-semibold text-monokai-fg">
                      {s.severity === 'high' ? '高优先级' : s.severity === 'medium' ? '中优先级' : '低优先级'} — {s.type === 'isolated' ? '孤立节点' : s.type === 'hub' ? 'Hub 节点' : s.type === 'cross_type' ? '跨类型关系' : '权重不平衡'}
                    </div>
                  </div>
                  <div className="text-xs text-monokai-fg/80 leading-relaxed">{s.message}</div>
                  {s.objectIds && s.objectIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {s.objectIds.slice(0, 5).map(id => {
                        const obj = objects.find(o => o.id === id);
                        return obj ? (
                          <span key={id} className="px-2 py-0.5 rounded text-[10px] font-mono bg-monokai-bg border border-monokai-border text-monokai-cyan">
                            {obj.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'introspect' && (
          <div className="flex flex-col gap-3">
            {/* AI Introspection Guidance */}
            <div className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2.5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-monokai-yellow" />
                <span className="text-xs font-semibold text-monokai-yellow">AI 反思引导</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={introspectionTopic}
                  onChange={e => setIntrospectionTopic(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && introspectionTopic.trim()) {
                      setLoadingAIIntrospection(true);
                      setAiIntrospectionError(null);
                      try {
                        const result = await ontologyAiService.generateIntrospectionGuidance(introspectionTopic);
                        setAiIntrospection(result);
                        setIntrospectionTopic('');
                      } catch (err: any) {
                        setAiIntrospectionError(err?.message || '生成失败');
                      }
                      setLoadingAIIntrospection(false);
                    }
                  }}
                  placeholder="输入反思主题，如：工作与生活的平衡..."
                  className="flex-1 px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent"
                />
                <ActionButton
                  variant="secondary"
                  size="sm"
                  loading={loadingAIIntrospection}
                  disabled={!introspectionTopic.trim()}
                  onClick={async () => {
                    if (!introspectionTopic.trim()) return;
                    setLoadingAIIntrospection(true);
                    setAiIntrospectionError(null);
                    try {
                      const result = await ontologyAiService.generateIntrospectionGuidance(introspectionTopic);
                      setAiIntrospection(result);
                      setIntrospectionTopic('');
                    } catch (err: any) {
                      setAiIntrospectionError(err?.message || '生成失败');
                    }
                    setLoadingAIIntrospection(false);
                  }}
                >
                  生成
                </ActionButton>
              </div>
              {aiIntrospectionError && <div className="text-xs text-monokai-pink">{aiIntrospectionError}</div>}
              {aiIntrospection && (
                <div className="space-y-2 pt-1 border-t border-monokai-border/60">
                  <div className="text-xs text-monokai-accent font-semibold">引导问题</div>
                  {aiIntrospection.questions?.map((q, i) => (
                    <div key={i} className="p-2.5 bg-monokai-bg border border-monokai-border rounded-md space-y-1.5">
                      <div className="text-xs font-semibold text-monokai-yellow">Q{i + 1}: {q.question}</div>
                      <div className="text-xs text-monokai-comment italic">提示：{q.hint}</div>
                      {q.relatedConcepts?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {q.relatedConcepts.map((c, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-monokai-surface text-monokai-cyan text-[10px] rounded border border-monokai-border/60">{c}</span>
                          ))}
                        </div>
                      )}
                      <div className="pt-1">
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIntrospectionQ(q.question);
                            setSelectedObject(objects[0] || null);
                          }}
                        >
                          填充至反思表单
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Select object */}
            <div className="space-y-1.5">
              <label className="text-xs text-monokai-comment font-semibold uppercase tracking-wider">选择反思对象</label>
              <select
                value={selectedObject?.id || ''}
                onChange={e => setSelectedObject(objects.find(o => o.id === parseInt(e.target.value)) || null)}
                className="w-full px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg focus:outline-none focus:border-monokai-accent"
              >
                <option value="">— 选择对象 —</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {selectedObject && (
              <>
                {/* New introspection */}
                <div className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2.5">
                  <div className="text-xs text-monokai-cyan font-semibold uppercase tracking-wider">添加反思</div>
                  <div className="space-y-1">
                    <label className="text-xs text-monokai-comment font-medium">核心问题</label>
                    <textarea
                      value={introspectionQ}
                      onChange={e => setIntrospectionQ(e.target.value)}
                      placeholder="例如：这个对象与我的核心目标有什么关系？"
                      rows={2}
                      className="w-full p-2 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-monokai-comment font-medium">思考回答</label>
                    <textarea
                      value={introspectionA}
                      onChange={e => setIntrospectionA(e.target.value)}
                      placeholder="你的反思回答..."
                      rows={3}
                      className="w-full p-2 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <ActionButton
                      variant="primary"
                      size="sm"
                      disabled={saving || !introspectionQ.trim() || !introspectionA.trim()}
                      loading={saving}
                      onClick={handleAddIntrospection}
                    >
                      保存反思
                    </ActionButton>
                  </div>
                </div>

                {/* History */}
                {introspections.filter(i => i.object_id === selectedObject.id).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-monokai-comment font-semibold uppercase tracking-wider">历史反思</div>
                    {introspections.filter(i => i.object_id === selectedObject.id).map(intr => (
                      <div key={intr.id} className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-1.5">
                        <div className="text-xs text-monokai-cyan font-semibold">Q: {intr.question}</div>
                        <div className="text-xs text-monokai-fg/85 leading-relaxed">A: {intr.answer}</div>
                        <div className="text-[10px] text-monokai-comment font-mono">{intr.created_at}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!selectedObject && (
              <div className="text-center py-6 text-monokai-comment text-xs">
                请选择上方对象开始反思
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="flex flex-col gap-3">
            {/* Add insight */}
            <div className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-2.5">
              <div className="text-xs text-monokai-accent font-semibold uppercase tracking-wider">记录洞察</div>
              <div>
                <select
                  value={selectedObject?.id || ''}
                  onChange={e => setSelectedObject(objects.find(o => o.id === parseInt(e.target.value)) || null)}
                  className="w-full px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg focus:outline-none focus:border-monokai-accent"
                >
                  <option value="">关联到哪个对象</option>
                  {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <textarea
                  value={insightText}
                  onChange={e => setInsightText(e.target.value)}
                  placeholder="你的洞察..."
                  rows={3}
                  className="w-full p-2 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent resize-none"
                />
              </div>
              <div className="flex gap-2 items-center">
                <input
                  value={insightTag}
                  onChange={e => setInsightTag(e.target.value)}
                  placeholder="标签 (如: 重要, 待验证)"
                  className="flex-1 px-2.5 py-1.5 bg-monokai-sidebar border border-monokai-border rounded-md text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent"
                />
                <ActionButton
                  variant="primary"
                  size="sm"
                  disabled={saving || !insightText.trim()}
                  loading={saving}
                  onClick={handleAddInsight}
                >
                  保存
                </ActionButton>
              </div>
            </div>

            {/* Insights list */}
            <div className="space-y-2">
              <div className="text-xs text-monokai-comment font-semibold uppercase tracking-wider">洞察记录 ({insights.length})</div>
              {insights.length === 0 && <div className="text-center py-6 text-monokai-comment text-xs">暂无洞察 — 从上方记录第一个</div>}
              {insights.map(ins => (
                <div key={ins.id} className="p-3 bg-monokai-surface/60 border border-monokai-border rounded-lg space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      {ins.tag && (
                        <Badge variant="danger" size="sm">
                          <Tag className="w-2.5 h-2.5 inline mr-1" />{ins.tag}
                        </Badge>
                      )}
                      {ins.object_name && (
                        <span className="text-xs text-monokai-cyan font-mono">
                          → {ins.object_name}
                        </span>
                      )}
                    </div>
                    <IconButton
                      icon={Trash2}
                      label="删除洞察"
                      tone="danger"
                      size="sm"
                      onClick={() => handleDeleteInsight(ins.id)}
                    />
                  </div>
                  <div className="text-xs text-monokai-fg/85 leading-relaxed">{ins.insight}</div>
                  <div className="text-[10px] text-monokai-comment font-mono">{ins.created_at}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OntologyInsightsPanel;
