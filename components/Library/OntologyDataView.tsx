import React, { useState, useMemo, useCallback } from 'react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import {
  Database, Hexagon, Box, Link2, Zap, LayoutList, Hash, AtSign,
  Eye, EyeOff, Search, X, Sparkles, AlertTriangle, Info, RefreshCw,
} from 'lucide-react';
import { importOntologyFromJSON } from '../../services/ontology/ontologyStorage';

type DataTab = 'objectType' | 'object' | 'linkType' | 'link' | 'action';

// ─── Tab Metadata ────────────────────────────────────────────

interface TabMeta {
  id: DataTab;
  label: string;
  icon: React.FC<any>;
  color: string;
  /** 模块场景说明 */
  scenarioTitle: string;
  scenarioDesc: string;
  /** 常见误用/警戒 */
  warningText: string;
}

const TAB_CONFIG: TabMeta[] = [
  {
    id: 'objectType',
    label: '类型 (Type)',
    icon: Hexagon,
    color: 'text-[#FF9F1C]',
    scenarioTitle: '类型构架层 — 本体论骨架',
    scenarioDesc: '定义实例的「种类标签」。类型是所有实例归属的基底，图谱中所有 Instance 节点均挂载于此层。常见于领域分类、角色谱系、项目维度等场景。',
    warningText: '删除或重命名类型会影响所有子实例节点在图谱中的视觉归属，可能引发 D3 TypeHub 渲染缺口。操作前请确认图谱中无孤立实例。',
  },
  {
    id: 'object',
    label: '实例 (Instance)',
    icon: Box,
    color: 'text-[#4CC9F0]',
    scenarioTitle: '实例存储层 — 核心知识单元',
    scenarioDesc: '承载所有具体实体（人物、事件、概念、资产等）。每个实体归属于一种类型，并可持有任意结构的 JSON 特性配置（properties）用于存放扩展元数据。',
    warningText: 'properties 字段为原始 JSON 字符串，格式错误会导致图谱属性徽章无法显示。填写时请确保是合法的 JSON（如 {"key": "value"}）。',
  },
  {
    id: 'linkType',
    label: '关系定义',
    icon: LayoutList,
    color: 'text-[#E76F51]',
    scenarioTitle: '关系约束层 — 语义边类型',
    scenarioDesc: '规定实体之间可以建立的连接「类别标签」。每条实际关系（link）都必须引用一个已有的关系类型。常见关系如「包含」、「触发」、「继承」等。',
    warningText: '删除关系类型不会自动删除引用该类型的所有实际关系（link），会造成关系库中出现悬空 foreign key，请先清除实际关系后再删除类型。',
  },
  {
    id: 'link',
    label: '关系库',
    icon: Link2,
    color: 'text-[#FFD166]',
    scenarioTitle: '关系连接层 — 图谱拓扑边',
    scenarioDesc: '记录两个实例节点之间的实际连接，每条关系带有一个 0~1 的耦合权重（weight）。权重影响 D3 图谱中边的弹力强度与视觉粗细，是控制图谱引力分布的核心变量。',
    warningText: '大幅修改高权重关系（w > 0.8）可能造成 D3 Force Simulation 向心力骤变，导致图谱节点大幅漂移甚至飞出视口。建议先在图谱视图中观察布局再调整权值。',
  },
  {
    id: 'action',
    label: '行动记录',
    icon: Zap,
    color: 'text-[#FF9CF7]',
    scenarioTitle: '行动任务层 — 实体挂载动作队列',
    scenarioDesc: '每个实例可挂载若干行动（Action），表示该实体需要完成的任务项或阶段里程碑。行动状态（pending / done）粒度清晰，是追踪知识图谱执行进度的主要入口。',
    warningText: 'execute_at 字段需严格遵守 YYYY-MM-DD 格式。传入 ISO 时间戳（含 T 与时区）将导致 DuckDB DATE 类型解析失败，行动将无法被正确落库。',
  },
];

// ─── Component ───────────────────────────────────────────────

export const OntologyDataView: React.FC<{ ontologyState?: any }> = ({ ontologyState }) => {
  const store = useOntologyStore();
  const state = ontologyState ?? store.state;
  const { refresh } = store;
  const [activeDataTab, setActiveDataTab] = useState<DataTab>('objectType');
  const [showJson, setShowJson] = useState<Record<number, boolean>>({});
  const [filterText, setFilterText] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [hasAutoOpenedContext, setHasAutoOpenedContext] = useState(false);

  // ── Seed import state ──
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const SEED_OPTIONS = [
    { file: 'seed-ecommerce.json', label: '电商运营', desc: 'Product · Customer · Campaign · Metric', count: '5类型 / 16节点 / 24关系' },
    { file: 'seed-project-tracker.json', label: '项目追踪', desc: 'Team · Person · Project · Feature', count: '5类型 / 16节点 / 24关系' },
    { file: 'seed-product-catalog.json', label: '产品目录', desc: 'Product · Category · Supplier · Tag', count: '5类型 / 14节点 / 20关系' },
    { file: 'seed-health-tracker.json', label: '健康追踪', desc: 'Metric · Habit · Goal · Trigger', count: '5类型 / 15节点 / 26关系' },
    { file: 'seed-workflow.json', label: '工作流引擎', desc: 'Workflow · Step · Agent · Task', count: '多类型 / 稠密关系' },
    { file: 'seed-task-tracker.json', label: '任务追踪', desc: 'Task · Sprint · Epic · Team', count: '多类型 / 24关系' },
  ];

  const currentTab = TAB_CONFIG.find(t => t.id === activeDataTab)!;
  const toggleJson = (id: number) => setShowJson(p => ({ ...p, [id]: !p[id] }));

  // ── Handle tab switch: clear filter ──
  const handleTabSwitch = useCallback((tab: DataTab) => {
    setActiveDataTab(tab);
    setFilterText('');
    if (!hasAutoOpenedContext) {
      setShowContext(true);
      setHasAutoOpenedContext(true);
    }
  }, [hasAutoOpenedContext]);

  // ── Seed Import ──
  const handleImportSeed = useCallback(async (seedFile: string) => {
    setImporting(true);
    setImportMsg(null);
    setShowSeedPicker(false);
    try {
      const resp = await fetch(`/data/ontology/${seedFile}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      let data;
      try {
        data = await resp.json();
      } catch {
        throw new Error(`${seedFile} 不是有效的 JSON 文件，请选择 .json 格式的本体论数据`);
      }
      if (!data.objectTypes || !data.objects) throw new Error('无效的种子数据格式');
      const { objectCount } = await importOntologyFromJSON(state.mapping, data);
      await refresh();
      setImportMsg({ type: 'success', text: `导入成功：${objectCount} 个对象 / ${data.links?.length ?? 0} 条关系` });
      setTimeout(() => setImportMsg(null), 4000);
    } catch (e: any) {
      setImportMsg({ type: 'error', text: `导入失败：${e.message}` });
      setTimeout(() => setImportMsg(null), 5000);
    }
    setImporting(false);
  }, [state.mapping, refresh]);

  // ── Metrics ───────────────────────────────────────────────
  const metrics = useMemo(() => {
    switch (activeDataTab) {
      case 'objectType': return [
        { label: '类型总数', value: state.stats.objectTypes, icon: Hash },
        { label: '平均实例/类型', value: state.stats.objectTypes ? (state.stats.objects / state.stats.objectTypes).toFixed(1) : 0, icon: AtSign },
        { label: '最近3条', value: Math.min(state.objectTypes.length, 3), icon: Zap },
      ];
      case 'object': return [
        { label: '实例总计', value: state.stats.objects, icon: Hash },
        { label: '含 JSON 属性', value: state.objects.filter(o => o.properties && o.properties !== '{}').length, icon: Database },
        { label: '类型覆盖数', value: new Set(state.objects.map(o => o.object_type_id)).size, icon: Hexagon },
      ];
      case 'linkType': return [
        { label: '关系类型数', value: state.stats.linkTypes, icon: Hash },
        { label: '已被关系引用', value: new Set(state.links.map(l => l.link_type_id)).size, icon: Link2 },
      ];
      case 'link': return [
        { label: '连接总数', value: state.stats.links, icon: Link2 },
        { label: '强耦合 (w>0.8)', value: state.links.filter(l => l.weight > 0.8).length, icon: Zap },
        { label: '平均权重', value: state.links.length ? (state.links.reduce((s, l) => s + l.weight, 0) / state.links.length).toFixed(2) : '—', icon: AtSign },
      ];
      case 'action': return [
        { label: '任务总数', value: state.stats.actions, icon: Zap },
        { label: '已完成', value: state.actions.filter(a => a.status === 'done').length, icon: Hexagon },
        { label: '待处理', value: state.actions.filter(a => a.status === 'pending').length, icon: Box },
      ];
      default: return [];
    }
  }, [state, activeDataTab]);

  // ── Raw data + filter ─────────────────────────────────────
  const rawData: any[] = useMemo(() => {
    switch (activeDataTab) {
      case 'objectType': return state.objectTypes;
      case 'object':     return state.objects;
      case 'linkType':   return state.linkTypes;
      case 'link':       return state.links;
      case 'action':     return state.actions;
      default:           return [];
    }
  }, [state, activeDataTab]);

  const filteredData = useMemo(() => {
    if (!filterText.trim()) return rawData;
    const q = filterText.toLowerCase();
    return rawData.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rawData, filterText]);

  // ── Headers ───────────────────────────────────────────────
  const headers: Array<{ key: string; label: string; render?: (v: any, row: any) => React.ReactNode }> = useMemo(() => {
    if (activeDataTab === 'objectType') return [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '类型名称' },
      { key: 'description', label: '结构描述' },
    ];
    if (activeDataTab === 'object') return [
      { key: 'id', label: 'ID' },
      { key: 'object_type_id', label: '归属类型', render: v => <span className="text-[#FF9F1C] font-medium text-xs">{state.objectTypes.find(t => t.id === v)?.name || String(v)}</span> },
      { key: 'name', label: '实例全称' },
      { key: 'properties', label: '特性负载 (JSON)', render: (v, r) => {
        if (!v || v === '{}') return <span className="text-monokai-comment/40 text-xs italic">empty</span>;
        const isShow = showJson[r.id];
        let displayStr = v;
        try { displayStr = JSON.stringify(JSON.parse(v), null, 2); } catch {}
        return (
          <div className="relative group/json min-w-[180px] max-w-xs">
            <button
              onClick={() => toggleJson(r.id)}
              className="absolute top-1 right-1 p-1 bg-black/40 rounded hover:bg-monokai-cyan/20 opacity-0 group-hover/json:opacity-100 transition-opacity z-10"
            >
              {isShow ? <EyeOff className="w-3 h-3 text-monokai-comment"/> : <Eye className="w-3 h-3 text-monokai-comment"/>}
            </button>
            {isShow ? (
              <pre className="text-[10px] text-monokai-cyan bg-black/30 p-2 rounded-lg max-h-28 overflow-y-auto custom-scrollbar leading-relaxed">{displayStr}</pre>
            ) : (
              <span className="text-xs text-monokai-accent/80 font-mono bg-black/20 px-2 py-1 rounded block truncate pr-7">
                {displayStr.length > 48 ? displayStr.slice(0, 48) + '…' : displayStr}
              </span>
            )}
          </div>
        );
      }},
    ];
    if (activeDataTab === 'linkType') return [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '关系游标' },
      { key: 'description', label: '语义描述' },
    ];
    if (activeDataTab === 'link') return [
      { key: 'id', label: 'ID' },
      { key: 'link_type_id', label: '关系类型', render: v => <span className="text-[#FFD166] text-xs font-medium">{state.linkTypes.find(t => t.id === v)?.name || String(v)}</span> },
      { key: 'source_object_id', label: 'Source', render: v => <span className="text-[#4CC9F0] text-xs">{state.objects.find(o => o.id === v)?.name || String(v)}</span> },
      { key: 'target_object_id', label: 'Target', render: v => <span className="text-[#FF9CF7] text-xs">{state.objects.find(o => o.id === v)?.name || String(v)}</span> },
      { key: 'weight', label: '耦合权重', render: v => (
        <div className="flex items-center gap-2 min-w-[90px]">
          <div className="h-1.5 flex-1 bg-black/40 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-monokai-cyan to-[#FF9CF7] rounded-full transition-all" style={{ width: `${Math.min(Number(v) * 100, 100)}%` }} />
          </div>
          <span className="text-xs font-mono text-monokai-comment w-9 text-right">{Number(v).toFixed(2)}</span>
        </div>
      )},
    ];
    // action
    return [
      { key: 'id', label: 'ID' },
      { key: 'object_id', label: '绑定实体', render: v => <span className="text-[#4CC9F0] text-xs">{state.objects.find(o => o.id === v)?.name || String(v)}</span> },
      { key: 'name', label: '动作标识' },
      { key: 'status', label: '进度', render: v => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${v === 'done' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'}`}>{v}</span>
      )},
      { key: 'execute_at', label: '执行日期', render: v => v
        ? <span className="text-monokai-comment font-mono text-xs">{v}</span>
        : <span className="text-monokai-comment/25 text-xs">—</span>
      },
    ];
  }, [activeDataTab, state, showJson]);

  // ─────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col p-5 gap-4 relative overflow-hidden animate-in fade-in duration-300">

      {/* ── HEADER ROW ─── */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">

        {/* Capsule Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-monokai-sidebar/50 border border-white/8 rounded-2xl backdrop-blur-xl">
          {TAB_CONFIG.map(t => {
            const isActive = activeDataTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleTabSwitch(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 relative overflow-hidden ${
                  isActive ? 'text-white shadow-sm' : 'text-monokai-comment hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl" />}
                <Icon className={`w-3.5 h-3.5 relative z-10 ${isActive ? t.color : 'opacity-50'}`} />
                <span className="relative z-10 hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Search / Filter */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="过滤 / Filter…"
              className="pl-8 pr-8 py-2 text-xs bg-monokai-sidebar/50 border border-white/8 rounded-xl text-monokai-fg placeholder:text-monokai-comment/50 focus:outline-none focus:border-monokai-cyan/40 w-44 transition-all"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-white transition-colors"
                title="清除过滤"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Context toggle */}
          <button
            onClick={() => setShowContext(p => !p)}
            title="场景说明与警戒"
            className={`p-2 rounded-xl border transition-all text-xs ${showContext ? 'bg-monokai-cyan/10 border-monokai-cyan/30 text-monokai-cyan' : 'border-white/8 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/20'}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Seed Import */}
          <div className="relative">
            <button
              onClick={() => setShowSeedPicker(p => !p)}
              disabled={importing}
              title="从示例模板导入数据"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-monokai-cyan/15 to-[#FF9CF7]/10 border border-monokai-cyan/25 text-monokai-cyan hover:border-monokai-cyan/50 hover:from-monokai-cyan/25 transition-all disabled:opacity-50"
            >
              {importing
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />
              }
              <span>导入示例</span>
            </button>
            {showSeedPicker && (
              <div className="absolute top-full right-0 mt-1.5 w-72 bg-monokai-bg border border-monokai-border/60 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-monokai-border/30 text-[10px] text-monokai-comment uppercase tracking-widest font-semibold">
                  选择示例模板
                </div>
                {SEED_OPTIONS.map(opt => (
                  <button
                    key={opt.file}
                    onClick={() => handleImportSeed(opt.file)}
                    className="w-full px-4 py-3 text-left hover:bg-monokai-sidebar/60 transition-colors border-b border-monokai-border/20 last:border-b-0"
                  >
                    <div className="text-xs font-semibold text-monokai-fg">{opt.label}</div>
                    <div className="text-[10px] text-monokai-comment mt-0.5">{opt.desc}</div>
                    <div className="text-[10px] text-monokai-cyan/60 mt-0.5 font-mono">{opt.count}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTEXT PANEL ──(场景说明 + 警戒) */}
      {showContext && (
        <div className="shrink-0 rounded-2xl border border-monokai-cyan/15 bg-monokai-sidebar/30 backdrop-blur-sm p-4 animate-in slide-in-from-top-2 duration-200 flex gap-4">
          <div className="flex-1">
            <p className="text-xs font-black text-monokai-cyan mb-1 tracking-wide uppercase">{currentTab.scenarioTitle}</p>
            <p className="text-xs text-monokai-fg/70 leading-relaxed">{currentTab.scenarioDesc}</p>
          </div>
          <div className="border-l border-white/8 pl-4 flex-1">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#FF9F1C] mt-0.5 shrink-0" />
              <p className="text-xs text-[#FF9F1C]/80 leading-relaxed">{currentTab.warningText}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Result ─────────────────────────────── */}
      {importMsg && (
        <div className={`shrink-0 rounded-2xl border p-4 animate-in slide-in-from-top-2 duration-200 ${importMsg.type === 'success' ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <p className={`text-xs font-bold ${importMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{importMsg.text}</p>
        </div>
      )}

      {/* ── KPI METRICS ─────────────────────────────────── */}
      <div className="flex gap-3 shrink-0 flex-wrap">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="flex-1 min-w-[120px] bg-monokai-sidebar/30 backdrop-blur-sm border border-white/5 rounded-2xl p-4 flex items-center gap-3 hover:border-monokai-cyan/25 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Icon className="w-4 h-4 text-monokai-cyan opacity-75" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider truncate">{m.label}</p>
                <p className="text-xl font-black text-monokai-fg leading-none font-mono mt-0.5">{m.value}</p>
              </div>
            </div>
          );
        })}

        {/* Filter status badge */}
        {filterText && (
          <div className="flex-none flex items-center gap-2 px-4 py-2 bg-monokai-cyan/10 border border-monokai-cyan/25 rounded-2xl text-xs text-monokai-cyan font-bold self-center">
            <Search className="w-3 h-3 opacity-70" />
            <span>命中 {filteredData.length} / {rawData.length}</span>
            <button onClick={() => setFilterText('')} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* ── DATA GRID ───────────────────────────────────── */}
      <div className="flex-1 min-h-0 w-full bg-monokai-bg/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-inner backdrop-blur-sm">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="sticky top-0 z-10 bg-monokai-sidebar/95 backdrop-blur border-b border-white/8">
              <tr>
                {headers.map(h => (
                  <th key={h.key} className="px-5 py-3.5 text-[10px] font-black text-monokai-comment uppercase tracking-widest whitespace-nowrap">
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Database className="w-10 h-10 text-monokai-comment/20" />
                      <div>
                        <p className="text-sm font-bold text-monokai-comment/50 mb-1">
                          {filterText ? `无匹配记录 — "${filterText}"` : '当前表域无数据记录'}
                        </p>
                        <p className="text-xs text-monokai-comment/30">
                          {filterText
                            ? <>尝试修改关键词或<button onClick={() => setFilterText('')} className="text-monokai-cyan/60 hover:text-monokai-cyan underline underline-offset-2 ml-1 transition-colors">清除过滤</button></>
                            : <>点击上方<button onClick={() => setShowSeedPicker(true)} className="text-monokai-cyan/60 hover:text-monokai-cyan underline underline-offset-2 ml-1 transition-colors">导入示例</button>注入数据</>
                          }
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    className="border-b border-white/5 last:border-b-0 hover:bg-monokai-cyan/5 transition-colors duration-150"
                  >
                    {headers.map(h => (
                      <td key={h.key} className="px-5 py-3 align-middle text-sm text-monokai-fg/85">
                        {h.render
                          ? h.render(row[h.key as keyof typeof row], row)
                          : <span className="font-mono">{String(row[h.key as keyof typeof row] ?? '—')}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: row count */}
        {filteredData.length > 0 && (
          <div className="shrink-0 px-5 py-2.5 bg-monokai-sidebar/40 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-monokai-comment/50 font-mono">
              {filterText ? `${filteredData.length} / ${rawData.length} 条记录（已过滤）` : `共 ${rawData.length} 条记录`}
            </span>
            <span className="text-[10px] text-monokai-comment/30 font-mono">{currentTab.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
