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
    { id: 'overview' as const, label: '总览', icon: <TrendingUp className="w-3 h-3" />, color: '#ae81ff' },
    { id: 'suggestions' as const, label: `建议 (${suggestions.length})`, icon: <Lightbulb className="w-3 h-3" />, color: '#fbbf24' },
    { id: 'introspect' as const, label: '反思', icon: <Brain className="w-3 h-3" />, color: '#38bdf8' },
    { id: 'insights' as const, label: `洞察 (${insights.length})`, icon: <Lightbulb className="w-3 h-3" />, color: '#4ade80' },
  ];

  const SEVERITY_COLORS = { high: '#f87171', medium: '#fbbf24', low: '#38bdf8' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#161622', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #66d9ef, #66d9ef)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>本体洞察面板</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>结构分析 · 反思引导 · 洞察记录</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '6px 10px', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: activeTab === t.id ? `${t.color}20` : 'transparent',
            color: activeTab === t.id ? t.color : '#6b7280',
            fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            whiteSpace: 'nowrap' as const,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loadError && !needsInit && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle className="w-4 h-4" style={{ color: '#fbbf24', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#fbbf24' }}>{loadError}</span>
          </div>
        )}
        {needsInit && (
          <div style={{ marginBottom: 10, padding: '12px 16px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.25)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#bda2ff', fontWeight: 600, marginBottom: 4 }}>本体论尚未初始化</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6 }}>
              点击下方按钮初始化并导入种子数据后，即可使用 AI 洞察分析功能。
            </div>
            <button
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
              disabled={initting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8,
                background: initting ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.2)',
                border: '1px solid rgba(167,139,250,0.4)',
                cursor: initting ? 'not-allowed' : 'pointer',
                color: '#bda2ff', fontSize: 12, fontWeight: 600,
              }}
            >
              {initting ? <><div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#bda2ff', borderRadius: '50%' }} /> 初始化中...</> : <><Sparkles className="w-3.5 h-3.5" /> 一键初始化</>}
            </button>
          </div>
        )}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: '对象', value: objects.length, color: '#ae81ff' },
                { label: '关系', value: links.length, color: '#22c55e' },
                { label: '类型', value: objectTypes.length, color: '#38bdf8' },
                { label: '建议', value: suggestions.length, color: '#fbbf24' },
              ].map(item => (
                <div key={item.label} style={{ padding: '8px 10px', background: `${item.color}10`, border: `1px solid ${item.color}25`, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Type coverage */}
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>类型覆盖</div>
              {typeClusters.map(tc => {
                const pct = parseInt(tc.coverage) || 0;
                return (
                  <div key={tc.typeId} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#e5e7eb' }}>{tc.typeName}</span>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{tc.count} ({tc.coverage})</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#ae81ff', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top suggestions preview */}
            {suggestions.slice(0, 3).length > 0 && (
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>待处理建议</div>
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLORS[s.severity], flexShrink: 0, marginTop: 4 }} />
                    <span style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{s.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {/* P1-2/P3-1: AI Suggestions — trigger button */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
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
                disabled={loadingAISuggestions || objects.length === 0}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, cursor: objects.length === 0 ? 'not-allowed' : 'pointer',
                  background: loadingAISuggestions ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.15)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#fbbf24', fontSize: 12, fontWeight: 600,
                }}
              >
                {loadingAISuggestions ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> 分析中...</> : <><Sparkles className="w-3.5 h-3.5" /> 图谱分析</>}
              </button>
              {aiSuggestions.length > 0 && (
                <button onClick={() => setAiSuggestions([])}
                  style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', cursor: 'pointer' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {aiSuggestionsError && (
              <div style={{ padding: '8px 12px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, fontSize: 11, color: '#fbbf24' }}>
                {aiSuggestionsError}
              </div>
            )}
            {/* AI suggestions results */}
            {aiSuggestions.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>
                  分析建议 ({aiSuggestions.length})
                </div>
                {aiSuggestions.map((item, i) => {
                  const TYPE_COLORS: Record<string, string> = {
                    object: '#ae81ff', link: '#22c55e', action: '#fbbf24', introspection: '#38bdf8'
                  };
                  const color = TYPE_COLORS[item.type] || '#4ade80';
                  return (
                    <div key={i} style={{ padding: 10, background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 10, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ padding: '1px 6px', background: `${color}20`, color, fontSize: 9, borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>{item.type}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{item.title}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{(item.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{item.description}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.6, marginBottom: 4 }}>
              基于当前图谱结构自动分析，识别潜在问题和优化机会
            </div>
            {suggestions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#4ade80', fontSize: 12 }}>
                ✓ 图谱结构健康，没有发现明显问题
              </div>
            )}
            {suggestions.map((s, i) => {
              const color = SEVERITY_COLORS[s.severity];
              const ICONS: Record<string, React.ReactNode> = {
                isolated: <AlertCircle className="w-4 h-4" />,
                hub: <Star className="w-4 h-4" />,
                cross_type: <ArrowRight className="w-4 h-4" />,
                weight_imbalance: <TrendingUp className="w-4 h-4" />,
              };
              return (
                <div key={i} style={{ padding: 12, background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                      {ICONS[s.type] || <Lightbulb className="w-4 h-4" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color }}>{s.severity === 'high' ? '高优先级' : s.severity === 'medium' ? '中优先级' : '低优先级'} — {s.type === 'isolated' ? '孤立节点' : s.type === 'hub' ? 'Hub 节点' : s.type === 'cross_type' ? '跨类型关系' : '权重不平衡'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5 }}>{s.message}</div>
                  {s.objectIds && s.objectIds.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                      {s.objectIds.slice(0, 5).map(id => {
                        const obj = objects.find(o => o.id === id);
                        return obj ? (
                          <span key={id} style={{ padding: '2px 8px', background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 12, fontSize: 10, color }}>
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
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {/* P2-2: AI Introspection Guidance */}
            <div style={{ padding: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Brain className="w-4 h-4 text-monokai-yellow" style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>AI 反思引导</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
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
                  style={{ flex: 1, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 11, outline: 'none' }}
                />
                <button
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
                  disabled={loadingAIIntrospection || !introspectionTopic.trim()}
                  style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', cursor: !introspectionTopic.trim() ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, opacity: !introspectionTopic.trim() ? 0.5 : 1 }}
                >
                  {loadingAIIntrospection ? '...' : '生成'}
                </button>
              </div>
              {aiIntrospectionError && <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 4 }}>{aiIntrospectionError}</div>}
              {aiIntrospection && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>引导问题</div>
                  {aiIntrospection.questions?.map((q, i) => (
                    <div key={i} style={{ padding: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, marginBottom: 2 }}>Q{i + 1}: {q.question}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>提示：{q.hint}</div>
                      {q.relatedConcepts?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {q.relatedConcepts.map((c, j) => (
                            <span key={j} style={{ padding: '1px 6px', background: 'rgba(167,139,250,0.2)', color: '#ae81ff', fontSize: 9, borderRadius: 4 }}>{c}</span>
                          ))}
                        </div>
                      )}
                      {/* Quick-fill button */}
                      <button onClick={() => {
                        setIntrospectionQ(q.question);
                        setSelectedObject(objects[0] || null);
                      }}
                        style={{ marginTop: 4, padding: '2px 8px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontSize: 9, borderRadius: 4, cursor: 'pointer' }}>
                        填充问题
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Select object */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>选择反思对象</div>
              <select
                value={selectedObject?.id || ''}
                onChange={e => setSelectedObject(objects.find(o => o.id === parseInt(e.target.value)) || null)}
                style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e5e7eb', fontSize: 12, outline: 'none' }}
              >
                <option value="">— 选择对象 —</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {selectedObject && (
              <>
                {/* New introspection */}
                <div style={{ padding: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>添加反思</div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>核心问题</div>
                    <textarea value={introspectionQ} onChange={e => setIntrospectionQ(e.target.value)} placeholder="例如：这个对象与我的核心目标有什么关系？"
                      style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 11, outline: 'none', resize: 'vertical', minHeight: 50, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>思考回答</div>
                    <textarea value={introspectionA} onChange={e => setIntrospectionA(e.target.value)} placeholder="你的反思回答..."
                      style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 11, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={handleAddIntrospection} disabled={saving || !introspectionQ.trim() || !introspectionA.trim()} style={{
                    padding: '5px 12px', borderRadius: 8, background: '#38bdf8', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    color: '#fff', fontSize: 11, fontWeight: 600, opacity: saving || !introspectionQ.trim() || !introspectionA.trim() ? 0.5 : 1,
                  }}>
                    {saving ? '保存中...' : '保存反思'}
                  </button>
                </div>

                {/* History */}
                {introspections.filter(i => i.object_id === selectedObject.id).length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>历史反思</div>
                    {introspections.filter(i => i.object_id === selectedObject.id).map(intr => (
                      <div key={intr.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600, marginBottom: 4, fontStyle: 'italic' }}>Q: {intr.question}</div>
                        <div style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.5, marginBottom: 4 }}>A: {intr.answer}</div>
                        <div style={{ fontSize: 9, color: '#475569' }}>{intr.created_at}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!selectedObject && (
              <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 12 }}>
                请选择上方对象开始反思
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {/* Add insight */}
            <div style={{ padding: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>记录洞察</div>
              <div style={{ marginBottom: 6 }}>
                <select
                  value={selectedObject?.id || ''}
                  onChange={e => setSelectedObject(objects.find(o => o.id === parseInt(e.target.value)) || null)}
                  style={{ width: '100%', padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 11, outline: 'none' }}
                >
                  <option value="">关联到哪个对象</option>
                  {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 6 }}>
                <textarea value={insightText} onChange={e => setInsightText(e.target.value)} placeholder="你的洞察..."
                  style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 11, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={insightTag} onChange={e => setInsightTag(e.target.value)} placeholder="标签 (如: 重要, 待验证)"
                  style={{ flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 11, outline: 'none' }} />
                <button onClick={handleAddInsight} disabled={saving || !insightText.trim()} style={{
                  padding: '5px 12px', borderRadius: 8, background: '#4ade80', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  color: '#0d0d14', fontSize: 11, fontWeight: 600, opacity: saving || !insightText.trim() ? 0.5 : 1,
                }}>
                  {saving ? '...' : '保存'}
                </button>
              </div>
            </div>

            {/* Insights list */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>洞察记录 ({insights.length})</div>
              {insights.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 12 }}>暂无洞察 — 从上方记录第一个</div>}
              {insights.map(ins => (
                <div key={ins.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {ins.tag && (
                        <span style={{ padding: '2px 7px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, fontSize: 9, color: '#bda2ff' }}>
                          <Tag className="w-2.5 h-2.5 inline" /> {ins.tag}
                        </span>
                      )}
                      {ins.object_name && (
                        <span style={{ fontSize: 10, color: '#6b7280' }}>
                          → {ins.object_name}
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleDeleteInsight(ins.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', opacity: 0.5, padding: 0 }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, marginBottom: 4 }}>{ins.insight}</div>
                  <div style={{ fontSize: 9, color: '#475569' }}>{ins.created_at}</div>
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
