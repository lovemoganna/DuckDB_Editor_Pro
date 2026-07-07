import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import {
  Database, Hexagon, Box, Link2, Zap, LayoutList, Hash, AtSign,
  Eye, EyeOff, Search, X, Sparkles, AlertTriangle, Info, RefreshCw,
  ChevronUp, ChevronDown, ArrowUpDown, Download, Trash2, Plus, Check, Edit,
  ChevronRight, ArrowLeftRight, Settings, Filter
} from 'lucide-react';
import { importOntologyFromJSON } from '../../services/ontology/ontologyStorage';
import { useVirtualizer } from '@tanstack/react-virtual';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { monokai } from '@uiw/codemirror-theme-monokai';

type DataTab = 'objectType' | 'object' | 'linkType' | 'link' | 'action' | 'introspection' | 'insight';

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
  {
    id: 'introspection',
    label: '反思 (Introspection)',
    icon: RefreshCw,
    color: 'text-[#a6e22e]',
    scenarioTitle: '反思回顾层 — 心智与认知迭代',
    scenarioDesc: '记录针对特定实体（如心态、工作）提出的反思问题与回答。这是图谱用户进行自我复盘与深度思维沉淀的数据库。',
    warningText: '反思记录必须绑定一个已有的实例节点（object_id）。如果关联的实例被删除，级联删除行为视数据库约束而定。',
  },
  {
    id: 'insight',
    label: '洞察 (Insight)',
    icon: Sparkles,
    color: 'text-[#ae81ff]',
    scenarioTitle: '闪念洞察层 — 提炼价值碎片',
    scenarioDesc: '收集散落在各个实体之上的核心洞察与标签分类。支持通过标签分类对知识进行归纳整合。',
    warningText: '洞察记录必须关联实体。支持设置任意形式的 tag，用于快速聚合及检索高价值闪念。',
  },
];

// Collapsible JSON Viewer for Properties
const CollapsibleJsonViewer: React.FC<{ data: any; depth?: number }> = ({ data, depth = 0 }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (data === null) return <span className="text-monokai-comment">null</span>;
  if (data === undefined) return <span className="text-monokai-comment">undefined</span>;

  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return <span className="text-[#FF9D00]">"{data}"</span>;
    }
    if (typeof data === 'number') {
      return <span className="text-[#AE81FF]">{data}</span>;
    }
    if (typeof data === 'boolean') {
      return <span className="text-[#F92672]">{String(data)}</span>;
    }
    return <span>{String(data)}</span>;
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);

  if (keys.length === 0) {
    return <span>{isArray ? '[]' : '{}'}</span>;
  }

  const indentClass = depth > 0 ? 'pl-3 border-l border-white/5 ml-1.5' : '';

  return (
    <div className="font-mono text-xs select-none">
      <span>{isArray ? '[' : '{'}</span>
      <div className={indentClass}>
        {keys.map((key, index) => {
          const value = data[key];
          const isValueObject = typeof value === 'object' && value !== null;
          const isCollapsed = collapsed[key];
          const hasMore = index < keys.length - 1;

          return (
            <div key={key} className="py-0.5">
              {isValueObject ? (
                <div className="flex items-start">
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="mr-1 text-[10px] text-monokai-comment hover:text-white transition-colors focus:outline-none"
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                  <span className="text-monokai-cyan font-semibold mr-1">{isArray ? '' : `"${key}": `}</span>
                  {isCollapsed ? (
                    <span className="text-monokai-comment cursor-pointer" onClick={() => toggleCollapse(key)}>
                      {Array.isArray(value) ? `[...] (${value.length})` : `{...} (${Object.keys(value).length})`}
                      {hasMore && ','}
                    </span>
                  ) : (
                    <span>
                      <CollapsibleJsonViewer data={value} depth={depth + 1} />
                      {hasMore && ','}
                    </span>
                  )}
                </div>
              ) : (
                <div className="pl-3.5">
                  <span className="text-monokai-cyan font-semibold mr-1">{isArray ? '' : `"${key}": `}</span>
                  <CollapsibleJsonViewer data={value} depth={depth + 1} />
                  {hasMore && ','}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span>{isArray ? ']' : '}'}</span>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────

export const OntologyDataView: React.FC<{ ontologyState?: any }> = ({ ontologyState }) => {
  const store = useOntologyStore();
  const state = ontologyState ?? store.state;
  const { refresh } = store;
  const [activeDataTab, setActiveDataTab] = useState<DataTab>('objectType');
  const [showJson, setShowJson] = useState<Record<number, boolean>>({});
  const [filterText, setFilterText] = useState('');
  const [showContext, setShowContext] = useState(false);

  // ── Sorting state ──
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ── Pagination state ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ── Seed import state ──
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Interactive CRUD / Selection States ──
  const [editingCell, setEditingCell] = useState<{ id: number; key: string; value: any } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormValues, setAddFormValues] = useState<Record<string, any>>({});
  const [jsonEditModal, setJsonEditModal] = useState<{ id: number; field: string; text: string; error: string | null } | null>(null);

  // ── Advanced Filters ──
  const [filterObjectTypeId, setFilterObjectTypeId] = useState<number | ''>('');
  const [filterLinkTypeId, setFilterLinkTypeId] = useState<number | ''>('');
  const [filterMinWeight, setFilterMinWeight] = useState<number>(0);
  const [filterActionStatus, setFilterActionStatus] = useState<string | ''>('');

  // ── Inspector Panel State ──
  const [inspectorRowId, setInspectorRowId] = useState<number | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  // ── Table Container Ref for Virtualizer ──
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  // ── Handle tab switch: clear filter, sorting, pagination, and selection ──
  const handleTabSwitch = useCallback((tab: DataTab) => {
    setActiveDataTab(tab);
    setFilterText('');
    setSortField(null);
    setSortDirection('asc');
    setCurrentPage(1);
    setSelectedRowIds(new Set());
    setShowAddForm(false);
    setEditingCell(null);
    setFilterObjectTypeId('');
    setFilterLinkTypeId('');
    setFilterMinWeight(0);
    setFilterActionStatus('');
    setInspectorRowId(null);
  }, []);

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

  // ── Search Term Highlighting Helper ──
  const renderHighlightedText = useCallback((text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-monokai-cyan/35 text-white rounded px-0.5 font-semibold">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  }, []);

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
      case 'introspection': return [
        { label: '反思总数', value: state.stats.introspections || 0, icon: RefreshCw },
        { label: '关联实体数', value: new Set(state.introspections.map(i => i.object_id)).size, icon: Box },
      ];
      case 'insight': return [
        { label: '洞察总数', value: state.stats.insights || 0, icon: Sparkles },
        { label: '不同标签数', value: new Set(state.insights.map(i => i.tag).filter(Boolean)).size, icon: Hash },
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
      case 'introspection': return state.introspections;
      case 'insight':       return state.insights;
      default:           return [];
    }
  }, [state, activeDataTab]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...rawData];

    // 1. Text Filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
      );
    }

    // 2. Advanced Multi-Dimensional Filters
    if (activeDataTab === 'object' && filterObjectTypeId !== '') {
      result = result.filter(row => row.object_type_id === Number(filterObjectTypeId));
    } else if (activeDataTab === 'link') {
      if (filterLinkTypeId !== '') {
        result = result.filter(row => row.link_type_id === Number(filterLinkTypeId));
      }
      if (filterMinWeight > 0) {
        result = result.filter(row => row.weight >= filterMinWeight);
      }
    } else if (activeDataTab === 'action' && filterActionStatus !== '') {
      result = result.filter(row => row.status === filterActionStatus);
    } else if ((activeDataTab === 'introspection' || activeDataTab === 'insight') && filterObjectTypeId !== '') {
      result = result.filter(row => row.object_id === Number(filterObjectTypeId));
    }

    // 3. Sort
    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawData, filterText, sortField, sortDirection, activeDataTab, filterObjectTypeId, filterLinkTypeId, filterMinWeight, filterActionStatus]);

  // ── Row Virtualizer for Infinite Scrolling ──
  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 15,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  // Keep compatibility with selection and header checks
  const paginatedData = filteredAndSortedData;

  // ── Sorting handler ──
  const handleHeaderClick = useCallback((key: string) => {
    if (sortField === key) {
      setSortDirection(p => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortField]);

  // ── Single Row deletion ──
  const handleDeleteRow = useCallback(async (id: number) => {
    try {
      if (activeDataTab === 'objectType') await store.deleteObjectType(id);
      else if (activeDataTab === 'object') await store.deleteObject(id);
      else if (activeDataTab === 'linkType') await store.deleteLinkType(id);
      else if (activeDataTab === 'link') await store.deleteLink(id);
      else if (activeDataTab === 'action') await store.deleteAction(id);
      else if (activeDataTab === 'introspection') await store.deleteIntrospection(id);
      else if (activeDataTab === 'insight') await store.deleteInsight(id);
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      alert(`删除失败: ${e.message}`);
    }
  }, [activeDataTab, store]);

  // ── Batch deletion ──
  const handleBatchDelete = useCallback(async () => {
    if (selectedRowIds.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedRowIds.size} 条记录吗？`)) return;

    try {
      const ids = Array.from(selectedRowIds);
      for (const id of ids) {
        if (activeDataTab === 'objectType') await store.deleteObjectType(id);
        else if (activeDataTab === 'object') await store.deleteObject(id);
        else if (activeDataTab === 'linkType') await store.deleteLinkType(id);
        else if (activeDataTab === 'link') await store.deleteLink(id);
        else if (activeDataTab === 'action') await store.deleteAction(id);
        else if (activeDataTab === 'introspection') await store.deleteIntrospection(id);
        else if (activeDataTab === 'insight') await store.deleteInsight(id);
      }
      setSelectedRowIds(new Set());
      alert('批量删除成功');
    } catch (e: any) {
      alert(`批量删除部分失败: ${e.message}`);
    }
  }, [selectedRowIds, activeDataTab, store]);

  // ── Save Cell inline changes ──
  const handleSaveCell = useCallback(async (id: number, key: string, value: any) => {
    setEditingCell(null);
    try {
      if (activeDataTab === 'objectType') {
        const item = state.objectTypes.find(t => t.id === id);
        if (!item) return;
        const name = key === 'name' ? value : item.name;
        const description = key === 'description' ? value : item.description;
        await store.updateObjectType(id, name, description);
      } else if (activeDataTab === 'object') {
        const item = state.objects.find(o => o.id === id);
        if (!item) return;
        const name = key === 'name' ? value : item.name;
        const typeId = key === 'object_type_id' ? Number(value) : item.object_type_id;
        const properties = key === 'properties' ? value : item.properties;
        await store.updateObject(id, name, typeId, properties);
      } else if (activeDataTab === 'linkType') {
        const item = state.linkTypes.find(t => t.id === id);
        if (!item) return;
        const name = key === 'name' ? value : item.name;
        const description = key === 'description' ? value : item.description;
        await store.updateLinkType(id, name, description);
      } else if (activeDataTab === 'link') {
        const item = state.links.find(l => l.id === id);
        if (!item) return;
        const linkTypeId = key === 'link_type_id' ? Number(value) : item.link_type_id;
        const sourceId = key === 'source_object_id' ? Number(value) : item.source_object_id;
        const targetId = key === 'target_object_id' ? Number(value) : item.target_object_id;
        const weight = key === 'weight' ? Number(value) : item.weight;
        await store.updateLink(id, linkTypeId, sourceId, targetId, weight);
      } else if (activeDataTab === 'action') {
        const item = state.actions.find(a => a.id === id);
        if (!item) return;
        const name = key === 'name' ? value : item.name;
        const description = item.description;
        const status = key === 'status' ? value : item.status;
        const executeAt = key === 'execute_at' ? value : item.execute_at;
        await store.updateAction(id, name, description, status, executeAt);
      } else if (activeDataTab === 'introspection') {
        const item = state.introspections.find(i => i.id === id);
        if (!item) return;
        const objectId = key === 'object_id' ? Number(value) : item.object_id;
        const question = key === 'question' ? value : item.question;
        const answer = key === 'answer' ? value : item.answer;
        await store.updateIntrospection(id, objectId, question, answer);
      } else if (activeDataTab === 'insight') {
        const item = state.insights.find(i => i.id === id);
        if (!item) return;
        const objectId = key === 'object_id' ? Number(value) : item.object_id;
        const insight = key === 'insight' ? value : item.insight;
        const tag = key === 'tag' ? value : item.tag;
        await store.updateInsight(id, objectId, insight, tag);
      }
    } catch (e: any) {
      alert(`保存失败: ${e.message}`);
    }
  }, [activeDataTab, state, store]);

  // ── Add Item form submit ──
  const handleAddItem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeDataTab === 'objectType') {
        const { name, description } = addFormValues;
        if (!name) return alert('名称不能为空');
        await store.createObjectType(name, description || '');
      } else if (activeDataTab === 'object') {
        const { name, typeId, properties } = addFormValues;
        if (!name || !typeId) return alert('名称与归属类型不能为空');
        await store.createObject(name, Number(typeId), properties || '{}');
      } else if (activeDataTab === 'linkType') {
        const { name, description } = addFormValues;
        if (!name) return alert('名称不能为空');
        await store.createLinkType(name, description || '');
      } else if (activeDataTab === 'link') {
        const { linkTypeId, sourceId, targetId, weight } = addFormValues;
        if (!linkTypeId || !sourceId || !targetId) return alert('请填满关系类型及两端节点');
        await store.createLink(Number(linkTypeId), Number(sourceId), Number(targetId), Number(weight ?? 0.5));
      } else if (activeDataTab === 'action') {
        const { name, objectId, status, executeAt } = addFormValues;
        if (!name || !objectId) return alert('任务标识与绑定实体不能为空');
        await store.createAction(name, Number(objectId), '', status || 'pending', executeAt || undefined);
      } else if (activeDataTab === 'introspection') {
        const { objectId, question, answer } = addFormValues;
        if (!objectId || !question || !answer) return alert('关联实体、问题与回答均不能为空');
        await store.createIntrospection(Number(objectId), question, answer);
      } else if (activeDataTab === 'insight') {
        const { objectId, insight, tag } = addFormValues;
        if (!objectId || !insight) return alert('关联实体与洞察描述均不能为空');
        await store.createInsight(Number(objectId), insight, tag || '');
      }
      setShowAddForm(false);
      setAddFormValues({});
    } catch (err: any) {
      alert(`添加记录失败: ${err.message}`);
    }
  }, [activeDataTab, addFormValues, store]);

  // ── JSON Modal Save ──
  const handleSaveJsonModal = useCallback(async () => {
    if (!jsonEditModal) return;
    try {
      JSON.parse(jsonEditModal.text); // validation
      await handleSaveCell(jsonEditModal.id, jsonEditModal.field, jsonEditModal.text);
      setJsonEditModal(null);
    } catch {
      setJsonEditModal(p => p ? { ...p, error: '非法的 JSON 格式，请检查语法' } : null);
    }
  }, [jsonEditModal, handleSaveCell]);

  // ── Navigate Link & Filter ──
  const handleNavigateToInstance = useCallback((name: string) => {
    setActiveDataTab('object');
    setFilterText(name);
    setCurrentPage(1);
    setSelectedRowIds(new Set());
    setEditingCell(null);
    setShowAddForm(false);
  }, []);

  // ── Headers config (Editable) ──────────────────────────────────
  const headers: Array<{ key: string; label: string; render?: (v: any, row: any) => React.ReactNode }> = useMemo(() => {
    if (activeDataTab === 'objectType') return [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '类型名称', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'description', label: '结构描述', render: (v) => renderHighlightedText(String(v), filterText) },
    ];
    if (activeDataTab === 'object') return [
      { key: 'id', label: 'ID' },
      { key: 'object_type_id', label: '归属类型', render: v => <span className="text-[#FF9F1C] font-semibold text-xs">{state.objectTypes.find(t => t.id === v)?.name || String(v)}</span> },
      { key: 'name', label: '实例全称', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'properties', label: '特性负载 (JSON)', render: (v, r) => {
        if (!v || v === '{}') return (
          <button
            onClick={(e) => { e.stopPropagation(); setJsonEditModal({ id: r.id, field: 'properties', text: '{}', error: null }); }}
            className="text-monokai-comment/40 text-xs italic hover:text-monokai-cyan transition-colors"
          >
            + Add Properties
          </button>
        );
        const isShow = showJson[r.id];
        let parsedJson: any = null;
        let isInvalid = false;
        try { parsedJson = JSON.parse(v); } catch { isInvalid = true; }
        
        if (isInvalid) return <span className="text-monokai-orange/80 text-xs font-mono truncate max-w-xs" title={v}>{v}</span>;

        return (
          <div className="relative group/json min-w-[200px] max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover/json:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setJsonEditModal({ id: r.id, field: 'properties', text: v, error: null })}
                className="px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-monokai-cyan hover:bg-monokai-cyan/20"
                title="编辑 JSON"
              >
                Edit
              </button>
              <button
                onClick={() => toggleJson(r.id)}
                className="p-1 bg-black/60 rounded hover:bg-monokai-cyan/20"
              >
                {isShow ? <EyeOff className="w-3 h-3 text-monokai-comment"/> : <Eye className="w-3 h-3 text-monokai-comment"/>}
              </button>
            </div>
            {isShow ? (
              <div className="text-[10px] bg-black/35 p-3 rounded-lg max-h-40 overflow-y-auto custom-scrollbar leading-relaxed">
                <CollapsibleJsonViewer data={parsedJson} />
              </div>
            ) : (
              <span className="text-xs text-monokai-accent/80 font-mono bg-black/20 px-2 py-1 rounded block truncate pr-14 cursor-pointer" onClick={() => toggleJson(r.id)}>
                {v}
              </span>
            )}
          </div>
        );
      }},
    ];
    if (activeDataTab === 'linkType') return [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '关系游标', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'description', label: '语义描述', render: (v) => renderHighlightedText(String(v), filterText) },
    ];
    if (activeDataTab === 'link') return [
      { key: 'id', label: 'ID' },
      { key: 'link_type_id', label: '关系类型', render: v => <span className="text-[#FFD166] text-xs font-semibold">{state.linkTypes.find(t => t.id === v)?.name || String(v)}</span> },
      { key: 'source_object_id', label: 'Source', render: v => {
        const obj = state.objects.find(o => o.id === v);
        const name = obj?.name || String(v);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleNavigateToInstance(name); }}
            className="text-[#4CC9F0] text-xs hover:underline text-left font-semibold"
            title="点击跳转到实例"
          >
            {renderHighlightedText(name, filterText)}
          </button>
        );
      }},
      { key: 'target_object_id', label: 'Target', render: v => {
        const obj = state.objects.find(o => o.id === v);
        const name = obj?.name || String(v);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleNavigateToInstance(name); }}
            className="text-[#FF9CF7] text-xs hover:underline text-left font-semibold"
            title="点击跳转到实例"
          >
            {renderHighlightedText(name, filterText)}
          </button>
        );
      }},
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
      { key: 'object_id', label: '绑定实体', render: v => {
        const obj = state.objects.find(o => o.id === v);
        const name = obj?.name || String(v);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleNavigateToInstance(name); }}
            className="text-[#4CC9F0] text-xs hover:underline text-left font-semibold"
            title="点击跳转到实例"
          >
            {renderHighlightedText(name, filterText)}
          </button>
        );
      }},
      { key: 'name', label: '动作标识', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'status', label: '进度', render: v => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${v === 'done' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'}`}>{v}</span>
      )},
      { key: 'execute_at', label: '执行日期', render: v => v
        ? <span className="text-monokai-comment font-mono text-xs">{v}</span>
        : <span className="text-monokai-comment/25 text-xs">—</span>
      },
    ];
    if (activeDataTab === 'introspection') return [
      { key: 'id', label: 'ID' },
      { key: 'object_id', label: '关联实体', render: v => {
        const obj = state.objects.find(o => o.id === v);
        const name = obj?.name || String(v);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleNavigateToInstance(name); }}
            className="text-[#4CC9F0] text-xs hover:underline text-left font-semibold"
            title="点击跳转到实例"
          >
            {renderHighlightedText(name, filterText)}
          </button>
        );
      }},
      { key: 'question', label: '反思问题', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'answer', label: '解答描述', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'created_at', label: '记录日期', render: v => v
        ? <span className="text-monokai-comment font-mono text-xs">{v}</span>
        : <span className="text-monokai-comment/25 text-xs">—</span>
      },
    ];
    if (activeDataTab === 'insight') return [
      { key: 'id', label: 'ID' },
      { key: 'object_id', label: '关联实体', render: v => {
        const obj = state.objects.find(o => o.id === v);
        const name = obj?.name || String(v);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleNavigateToInstance(name); }}
            className="text-[#4CC9F0] text-xs hover:underline text-left font-semibold"
            title="点击跳转到实例"
          >
            {renderHighlightedText(name, filterText)}
          </button>
        );
      }},
      { key: 'insight', label: '价值洞察', render: (v) => renderHighlightedText(String(v), filterText) },
      { key: 'tag', label: '标签 (Tag)', render: v => v
        ? <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20">{renderHighlightedText(String(v), filterText)}</span>
        : <span className="text-monokai-comment/25 text-xs">—</span>
      },
      { key: 'created_at', label: '记录日期', render: v => v
        ? <span className="text-monokai-comment font-mono text-xs">{v}</span>
        : <span className="text-monokai-comment/25 text-xs">—</span>
      },
    ];
  }, [activeDataTab, state, showJson, filterText, renderHighlightedText, handleNavigateToInstance]);

  // ── CSV/JSON Export ──
  const handleExportData = useCallback((format: 'csv' | 'json', useSelection = false) => {
    const dataToExport = useSelection
      ? filteredAndSortedData.filter(row => selectedRowIds.has(row.id))
      : filteredAndSortedData;

    if (dataToExport.length === 0) return;

    let content = '';
    let mimeType = '';
    let fileName = `ontology_${activeDataTab}_export_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'json') {
      content = JSON.stringify(dataToExport, null, 2);
      mimeType = 'application/json';
      fileName += '.json';
    } else {
      // CSV format
      const csvHeaders = headers.map(h => h.label).join(',');
      const csvRows = dataToExport.map(row => {
        return headers.map(h => {
          const val = row[h.key];
          if (val === null || val === undefined) return '';
          let valStr = String(val);
          if (valStr.includes(',') || valStr.includes('"') || valStr.includes('\n')) {
            valStr = `"${valStr.replace(/"/g, '""')}"`;
          }
          return valStr;
        }).join(',');
      });
      content = [csvHeaders, ...csvRows].join('\n');
      mimeType = 'text/csv;charset=utf-8;';
      fileName += '.csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredAndSortedData, selectedRowIds, activeDataTab, headers]);

  // ── Selection helpers ──
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const ids = new Set(paginatedData.map(r => r.id));
      setSelectedRowIds(ids);
    } else {
      setSelectedRowIds(new Set());
    }
  }, [paginatedData]);

  const handleSelectRow = useCallback((id: number, checked: boolean) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // ── Render cell editor inline ──
  const renderInlineEditor = (row: any, key: string) => {
    const val = editingCell?.value;
    const onChange = (newVal: any) => setEditingCell(p => p ? { ...p, value: newVal } : null);
    const onSave = () => handleSaveCell(row.id, key, val);
    const onCancel = () => setEditingCell(null);

    // Select wrappers based on key fields
    if (key === 'object_type_id') {
      return (
        <select
          autoFocus
          value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onSave}
          className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
        >
          {state.objectTypes.map(ot => (
            <option key={ot.id} value={ot.id}>{ot.name}</option>
          ))}
        </select>
      );
    }
    if (key === 'link_type_id') {
      return (
        <select
          autoFocus
          value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onSave}
          className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
        >
          {state.linkTypes.map(lt => (
            <option key={lt.id} value={lt.id}>{lt.name}</option>
          ))}
        </select>
      );
    }
    if (key === 'source_object_id' || key === 'target_object_id' || key === 'object_id') {
      return (
        <select
          autoFocus
          value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onSave}
          className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
        >
          {state.objects.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      );
    }
    if (key === 'status') {
      return (
        <select
          autoFocus
          value={val}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
        >
          <option value="pending">PENDING</option>
          <option value="done">DONE</option>
        </select>
      );
    }
    if (key === 'weight') {
      return (
        <div className="flex items-center gap-2" onMouseUp={onSave}>
          <input
            autoFocus
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={val}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 accent-monokai-cyan"
          />
          <span className="text-xs font-mono text-monokai-cyan">{Number(val).toFixed(2)}</span>
        </div>
      );
    }
    if (key === 'execute_at') {
      return (
        <input
          autoFocus
          type="date"
          value={val || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none"
        />
      );
    }

    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        className="bg-monokai-bg border border-monokai-cyan/40 rounded px-1.5 py-0.5 text-xs text-monokai-fg focus:outline-none w-full max-w-[200px]"
      />
    );
  };

  // ── Render Right Inspector Details ──
  const renderInspectorContent = () => {
    if (inspectorRowId === null) return null;
    const row = filteredAndSortedData.find(r => r.id === inspectorRowId);
    if (!row) return <div className="p-4 text-xs text-monokai-comment">未找到记录详情</div>;

    const onClose = () => {
      setShowInspector(false);
      setInspectorRowId(null);
    };

    if (activeDataTab === 'objectType') {
      const instances = state.objects.filter((o: any) => o.object_type_id === row.id);
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hexagon className="w-5 h-5 text-[#FF9F1C]" />
              <span className="font-bold text-sm text-monokai-fg">类型详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">类型名称</p>
            <p className="text-sm font-bold text-white font-mono mt-0.5">{row.name}</p>
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id}</p>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">结构描述</p>
            <p className="text-xs text-monokai-fg/80 mt-1 leading-relaxed">{row.description || '无结构描述'}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">所属实例 ({instances.length})</p>
            {instances.length === 0 ? (
              <p className="text-xs text-monokai-comment italic">该类型下暂无实体实例</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {instances.map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setActiveDataTab('object');
                      setFilterText(o.name);
                      setInspectorRowId(o.id);
                      setShowInspector(true);
                    }}
                    className="w-full text-left p-2 rounded bg-black/10 border border-white/5 hover:border-monokai-cyan/35 hover:bg-monokai-cyan/5 transition-all text-xs font-mono text-monokai-cyan truncate"
                  >
                    • {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeDataTab === 'object') {
      const parentType = state.objectTypes.find((t: any) => t.id === row.object_type_id);
      const incomingLinks = state.links.filter((l: any) => l.target_object_id === row.id);
      const outgoingLinks = state.links.filter((l: any) => l.source_object_id === row.id);
      const actions = state.actions.filter((a: any) => a.object_id === row.id);
      let parsedJson: any = null;
      try { parsedJson = JSON.parse(row.properties || '{}'); } catch {}

      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5 text-[#4CC9F0]" />
              <span className="font-bold text-sm text-monokai-fg">实例详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">实例名称</p>
            <p className="text-sm font-bold text-white font-mono mt-0.5">{row.name}</p>
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id}</p>
            {parentType && (
              <button
                onClick={() => {
                  setActiveDataTab('objectType');
                  setFilterText(parentType.name);
                  setInspectorRowId(parentType.id);
                }}
                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#FF9F1C] hover:underline"
              >
                <Hexagon className="w-3 h-3" />
                <span>类型: {parentType.name}</span>
              </button>
            )}
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">特性负载 (JSON)</p>
              <button
                onClick={() => setJsonEditModal({ id: row.id, field: 'properties', text: row.properties || '{}', error: null })}
                className="text-[10px] text-monokai-cyan hover:underline font-bold"
              >
                编辑 JSON
              </button>
            </div>
            {parsedJson && Object.keys(parsedJson).length > 0 ? (
              <div className="text-[10px] bg-black/45 p-2.5 rounded-lg max-h-40 overflow-y-auto custom-scrollbar">
                <CollapsibleJsonViewer data={parsedJson} />
              </div>
            ) : (
              <p className="text-xs text-monokai-comment italic">暂无自定义特性负载</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider mb-1.5">上游关系 (引向我)</p>
              {incomingLinks.length === 0 ? (
                <p className="text-[10px] text-monokai-comment italic pl-2">无指向该实体的上游关系</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {incomingLinks.map((l: any) => {
                    const srcObj = state.objects.find((o: any) => o.id === l.source_object_id);
                    const lType = state.linkTypes.find((lt: any) => lt.id === l.link_type_id);
                    return (
                      <div key={l.id} className="p-1.5 rounded bg-black/10 border border-white/5 flex items-center justify-between gap-1 text-[10px] font-mono">
                        <button
                          onClick={() => {
                            if (srcObj) {
                              setFilterText(srcObj.name);
                              setInspectorRowId(srcObj.id);
                            }
                          }}
                          className="text-monokai-cyan hover:underline truncate max-w-[80px]"
                        >
                          {srcObj?.name || l.source_object_id}
                        </button>
                        <span className="text-monokai-comment text-[9px] bg-black/20 px-1 rounded truncate max-w-[60px]" title={lType?.name}>
                          {lType?.name || 'rel'}
                        </span>
                        <span className="text-[#FF9CF7] text-right font-bold truncate">我 (w:{l.weight.toFixed(1)})</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider mb-1.5">下游关系 (从我出发)</p>
              {outgoingLinks.length === 0 ? (
                <p className="text-[10px] text-monokai-comment italic pl-2">无从该实体出发的下游关系</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {outgoingLinks.map((l: any) => {
                    const tgtObj = state.objects.find((o: any) => o.id === l.target_object_id);
                    const lType = state.linkTypes.find((lt: any) => lt.id === l.link_type_id);
                    return (
                      <div key={l.id} className="p-1.5 rounded bg-black/10 border border-white/5 flex items-center justify-between gap-1 text-[10px] font-mono">
                        <span className="text-[#4CC9F0] font-bold">我</span>
                        <span className="text-monokai-comment text-[9px] bg-black/20 px-1 rounded truncate max-w-[60px]" title={lType?.name}>
                          {lType?.name || 'rel'}
                        </span>
                        <button
                          onClick={() => {
                            if (tgtObj) {
                              setFilterText(tgtObj.name);
                              setInspectorRowId(tgtObj.id);
                            }
                          }}
                          className="text-monokai-pink hover:underline truncate text-right max-w-[80px]"
                        >
                          {tgtObj?.name || l.target_object_id}
                        </button>
                        <span className="text-monokai-comment text-[9px]">w:{l.weight.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {actions.length > 0 && (
              <div>
                <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider mb-1.5">关联行动计划 ({actions.length})</p>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {actions.map((a: any) => (
                    <div key={a.id} className="p-1.5 rounded bg-black/10 border border-white/5 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-monokai-fg/80 truncate max-w-[130px]">{a.name}</span>
                      <span className={`px-1 rounded text-[8px] font-bold ${a.status === 'done' ? 'bg-green-500/15 text-green-400' : 'bg-orange-500/15 text-orange-400'}`}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeDataTab === 'linkType') {
      const linkRefs = state.links.filter((l: any) => l.link_type_id === row.id);
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-[#E76F51]" />
              <span className="font-bold text-sm text-monokai-fg">关系类型详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">关系名称</p>
            <p className="text-sm font-bold text-white font-mono mt-0.5">{row.name}</p>
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id}</p>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">语义约束描述</p>
            <p className="text-xs text-monokai-fg/80 mt-1 leading-relaxed">{row.description || '无语义说明'}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">关系引用实例 ({linkRefs.length})</p>
            {linkRefs.length === 0 ? (
              <p className="text-xs text-monokai-comment italic">目前关系库中暂无此关系的实际引用实例</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {linkRefs.map((l: any) => {
                  const s = state.objects.find((o: any) => o.id === l.source_object_id);
                  const t = state.objects.find((o: any) => o.id === l.target_object_id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        setActiveDataTab('link');
                        setFilterText(`${s?.name || l.source_object_id}`);
                        setInspectorRowId(l.id);
                      }}
                      className="w-full text-left p-2 rounded bg-black/10 border border-white/5 hover:border-monokai-cyan/35 hover:bg-monokai-cyan/5 transition-all text-[10px] font-mono text-monokai-fg/70 flex items-center justify-between"
                    >
                      <span className="truncate max-w-[80px] text-monokai-cyan">{s?.name || l.source_object_id}</span>
                      <span className="text-monokai-comment">&rarr;</span>
                      <span className="truncate max-w-[80px] text-monokai-pink">{t?.name || l.target_object_id}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeDataTab === 'link') {
      const srcObj = state.objects.find((o: any) => o.id === row.source_object_id);
      const tgtObj = state.objects.find((o: any) => o.id === row.target_object_id);
      const relationType = state.linkTypes.find((lt: any) => lt.id === row.link_type_id);

      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#FFD166]" />
              <span className="font-bold text-sm text-monokai-fg">拓扑关系详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">语义关联结构</p>
            <div className="flex items-center justify-between gap-1.5 p-2 bg-black/30 rounded-lg">
              {srcObj && (
                <button
                  onClick={() => {
                    setActiveDataTab('object');
                    setFilterText(srcObj.name);
                    setInspectorRowId(srcObj.id);
                  }}
                  className="text-xs font-bold font-mono text-monokai-cyan hover:underline truncate max-w-[80px]"
                >
                  {srcObj.name}
                </button>
              )}
              <span className="text-[10px] font-bold text-[#FFD166] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                {relationType?.name || row.link_type_id}
              </span>
              {tgtObj && (
                <button
                  onClick={() => {
                    setActiveDataTab('object');
                    setFilterText(tgtObj.name);
                    setInspectorRowId(tgtObj.id);
                  }}
                  className="text-xs font-bold font-mono text-monokai-pink hover:underline truncate max-w-[80px]"
                >
                  {tgtObj.name}
                </button>
              )}
            </div>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">耦合权重 (Elastic Weight)</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-monokai-cyan to-[#FF9CF7] rounded-full" style={{ width: `${row.weight * 100}%` }} />
              </div>
              <span className="text-sm font-mono font-bold text-white">{row.weight.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeDataTab === 'action') {
      const boundObj = state.objects.find((o: any) => o.id === row.object_id);
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF9CF7]" />
              <span className="font-bold text-sm text-monokai-fg">行动任务详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">动作标识 (Action Key)</p>
            <p className="text-sm font-bold text-white font-mono mt-0.5">{row.name}</p>
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id}</p>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">进度状态</p>
              <span className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${row.status === 'done' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'}`}>
                {row.status}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">执行日期</p>
              <p className="text-xs font-bold text-white font-mono mt-1.5">{row.execute_at || '—'}</p>
            </div>
          </div>

          {boundObj && (
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">绑定关联实体</p>
              <button
                onClick={() => {
                  setActiveDataTab('object');
                  setFilterText(boundObj.name);
                  setInspectorRowId(boundObj.id);
                }}
                className="mt-2 text-xs font-bold font-mono text-monokai-cyan hover:underline flex items-center gap-1.5"
              >
                <Box className="w-3.5 h-3.5" />
                <span>{boundObj.name} (Instance)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (activeDataTab === 'introspection') {
      const boundObj = state.objects.find((o: any) => o.id === row.object_id);
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#a6e22e]" />
              <span className="font-bold text-sm text-monokai-fg">反思记录详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <div>
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">反思问题</p>
              <p className="text-xs text-white mt-1.5 leading-relaxed">{row.question}</p>
            </div>
            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">解答描述</p>
              <p className="text-xs text-white mt-1.5 leading-relaxed">{row.answer}</p>
            </div>
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id} | 日期: {row.created_at || '—'}</p>
          </div>

          {boundObj && (
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">绑定关联实体</p>
              <button
                onClick={() => {
                  setActiveDataTab('object');
                  setFilterText(boundObj.name);
                  setInspectorRowId(boundObj.id);
                }}
                className="mt-2 text-xs font-bold font-mono text-monokai-cyan hover:underline flex items-center gap-1.5"
              >
                <Box className="w-3.5 h-3.5" />
                <span>{boundObj.name} (Instance)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (activeDataTab === 'insight') {
      const boundObj = state.objects.find((o: any) => o.id === row.object_id);
      return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 gap-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ae81ff]" />
              <span className="font-bold text-sm text-monokai-fg">洞察记录详情</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-monokai-comment hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <div>
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">提炼的洞察</p>
              <p className="text-xs text-white mt-1.5 leading-relaxed">{row.insight}</p>
            </div>
            {row.tag && (
              <div className="border-t border-white/5 pt-2 mt-2">
                <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">标签 (Tag)</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full bg-monokai-pink/15 text-monokai-pink border border-monokai-pink/20">
                  {row.tag}
                </span>
              </div>
            )}
            <p className="text-[10px] text-monokai-comment font-mono mt-1">ID: {row.id} | 日期: {row.created_at || '—'}</p>
          </div>

          {boundObj && (
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[10px] text-monokai-comment font-bold uppercase tracking-wider">关联实体</p>
              <button
                onClick={() => {
                  setActiveDataTab('object');
                  setFilterText(boundObj.name);
                  setInspectorRowId(boundObj.id);
                }}
                className="mt-2 text-xs font-bold font-mono text-monokai-cyan hover:underline flex items-center gap-1.5"
              >
                <Box className="w-3.5 h-3.5" />
                <span>{boundObj.name} (Instance)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

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
              onChange={e => {
                setFilterText(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="过滤 / Filter…"
              className="pl-8 pr-8 py-2 text-xs bg-monokai-sidebar/50 border border-white/8 rounded-xl text-monokai-fg placeholder:text-monokai-comment/50 focus:outline-none focus:border-monokai-cyan/40 w-44 transition-all"
            />
            {filterText && (
              <button
                onClick={() => {
                  setFilterText('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-white transition-colors"
                title="清除过滤"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Export Buttons */}
          {filteredAndSortedData.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExportData('csv')}
                title="导出所有过滤记录为 CSV"
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-white/8 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/30 hover:bg-monokai-cyan/5 transition-all"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExportData('json')}
                title="导出所有过滤记录为 JSON"
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-white/8 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/30 hover:bg-monokai-cyan/5 transition-all"
              >
                <Download className="w-3 h-3" />
                <span>JSON</span>
              </button>
            </div>
          )}

          {/* Context toggle */}
          <button
            onClick={() => setShowContext(p => !p)}
            title="场景说明与警戒"
            className={`p-2 rounded-xl border transition-all text-xs ${showContext ? 'bg-monokai-cyan/10 border-monokai-cyan/30 text-monokai-cyan' : 'border-white/8 text-monokai-comment hover:text-monokai-cyan hover:border-monokai-cyan/20'}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Add Record button */}
          <button
            onClick={() => {
              setShowAddForm(p => !p);
              setAddFormValues({});
            }}
            title="在当前模块快速新增记录"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              showAddForm ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'border-white/8 text-monokai-comment hover:text-green-400 hover:border-green-500/20'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增</span>
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

      {/* ── ADVANCED FILTERS PANEL ── */}
      {(activeDataTab === 'object' || activeDataTab === 'link' || activeDataTab === 'action' || activeDataTab === 'introspection' || activeDataTab === 'insight') && (
        <div className="shrink-0 p-3 bg-monokai-sidebar/30 border border-white/5 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-monokai-comment">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold uppercase tracking-wider text-[10px]">高级过滤 / Filter</span>
          </div>

          {activeDataTab === 'object' && (
            <div className="flex items-center gap-2">
              <span className="text-monokai-comment font-semibold">类型:</span>
              <select
                value={filterObjectTypeId}
                onChange={e => {
                  setFilterObjectTypeId(e.target.value === '' ? '' : Number(e.target.value));
                }}
                className="bg-black/30 border border-white/8 rounded-xl px-2.5 py-1 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/40"
              >
                <option value="">所有类型 (All Types)</option>
                {state.objectTypes.map(ot => (
                  <option key={ot.id} value={ot.id}>{ot.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeDataTab === 'link' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-monokai-comment font-semibold">关系类型:</span>
                <select
                  value={filterLinkTypeId}
                  onChange={e => {
                    setFilterLinkTypeId(e.target.value === '' ? '' : Number(e.target.value));
                  }}
                  className="bg-black/30 border border-white/8 rounded-xl px-2.5 py-1 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/40"
                >
                  <option value="">所有关系 (All Relations)</option>
                  {state.linkTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-monokai-comment font-semibold">最小权重 (w &ge;):</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={filterMinWeight}
                  onChange={e => setFilterMinWeight(Number(e.target.value))}
                  className="w-24 accent-monokai-cyan"
                />
                <span className="font-mono text-monokai-cyan">{filterMinWeight.toFixed(1)}</span>
                {filterMinWeight > 0 && (
                  <button
                    onClick={() => setFilterMinWeight(0)}
                    className="text-monokai-comment hover:text-white ml-1 font-bold"
                  >
                    重置
                  </button>
                )}
              </div>
            </>
          )}

          {activeDataTab === 'action' && (
            <div className="flex items-center gap-2">
              <span className="text-monokai-comment font-semibold">进度状态:</span>
              <select
                value={filterActionStatus}
                onChange={e => setFilterActionStatus(e.target.value)}
                className="bg-black/30 border border-white/8 rounded-xl px-2.5 py-1 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/40"
              >
                <option value="">所有状态 (All Statuses)</option>
                <option value="pending">PENDING</option>
                <option value="done">DONE</option>
              </select>
            </div>
          )}

          {(activeDataTab === 'introspection' || activeDataTab === 'insight') && (
            <div className="flex items-center gap-2">
              <span className="text-monokai-comment font-semibold">关联实体:</span>
              <select
                value={filterObjectTypeId}
                onChange={e => {
                  setFilterObjectTypeId(e.target.value === '' ? '' : Number(e.target.value));
                }}
                className="bg-black/30 border border-white/8 rounded-xl px-2.5 py-1 text-xs text-monokai-fg focus:outline-none focus:border-monokai-cyan/40"
              >
                <option value="">所有实体 (All Objects)</option>
                {state.objects.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Advanced Filters Button */}
          {(filterObjectTypeId !== '' || filterLinkTypeId !== '' || filterMinWeight > 0 || filterActionStatus !== '') && (
            <button
              onClick={() => {
                setFilterObjectTypeId('');
                setFilterLinkTypeId('');
                setFilterMinWeight(0);
                setFilterActionStatus('');
              }}
              className="ml-auto px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-white transition-all text-[10px] font-bold"
            >
              清除所有条件
            </button>
          )}
        </div>
      )}

      {/* ── ADD RECORD FORM ── */}
      {showAddForm && (
        <form onSubmit={handleAddItem} className="shrink-0 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">快速新增 - {currentTab.label}</span>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            {activeDataTab === 'objectType' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">类型名称 *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. User"
                    value={addFormValues.name || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg placeholder:text-monokai-comment/30 focus:outline-none focus:border-green-500/40 w-44"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">结构描述</label>
                  <input
                    type="text"
                    placeholder="请输入类型的结构与规则描述"
                    value={addFormValues.description || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, description: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg placeholder:text-monokai-comment/30 focus:outline-none focus:border-green-500/40 w-full"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'object' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">实例名称 *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice"
                    value={addFormValues.name || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">归属类型 *</label>
                  <select
                    required
                    value={addFormValues.typeId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, typeId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择归属类型 --</option>
                    {state.objectTypes.map(ot => (
                      <option key={ot.id} value={ot.id}>{ot.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">特性负载 (JSON)</label>
                  <input
                    type="text"
                    placeholder='e.g. {"age": 28}'
                    value={addFormValues.properties || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, properties: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-full font-mono"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'linkType' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">关系名称 *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. knows"
                    value={addFormValues.name || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">关系语义描述</label>
                  <input
                    type="text"
                    placeholder="请对该关联的语义约束进行描述"
                    value={addFormValues.description || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, description: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-full"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'link' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">关系类型 *</label>
                  <select
                    required
                    value={addFormValues.linkTypeId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, linkTypeId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择关系类型 --</option>
                    {state.linkTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">Source 节点 *</label>
                  <select
                    required
                    value={addFormValues.sourceId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, sourceId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择起点 --</option>
                    {state.objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">Target 节点 *</label>
                  <select
                    required
                    value={addFormValues.targetId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, targetId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择终点 --</option>
                    {state.objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">耦合权重 (0~1)</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={addFormValues.weight ?? 0.5}
                    onChange={e => setAddFormValues(p => ({ ...p, weight: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-24 font-mono"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'action' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">动作标识 *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. process_audit"
                    value={addFormValues.name || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, name: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">绑定实体 *</label>
                  <select
                    required
                    value={addFormValues.objectId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, objectId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择实体 --</option>
                    {state.objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">任务进度</label>
                  <select
                    value={addFormValues.status || 'pending'}
                    onChange={e => setAddFormValues(p => ({ ...p, status: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-32"
                  >
                    <option value="pending">PENDING</option>
                    <option value="done">DONE</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">执行日期</label>
                  <input
                    type="date"
                    value={addFormValues.executeAt || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, executeAt: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-40"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'introspection' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">绑定实体 *</label>
                  <select
                    required
                    value={addFormValues.objectId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, objectId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择实体 --</option>
                    {state.objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">反思问题 *</label>
                  <input
                    type="text"
                    required
                    placeholder="请输入反思问题"
                    value={addFormValues.question || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, question: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">回答描述 *</label>
                  <input
                    type="text"
                    required
                    placeholder="请输入对问题的解答描述"
                    value={addFormValues.answer || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, answer: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-full"
                  />
                </div>
              </>
            )}

            {activeDataTab === 'insight' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">关联实体 *</label>
                  <select
                    required
                    value={addFormValues.objectId || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, objectId: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  >
                    <option value="">-- 选择实体 --</option>
                    {state.objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-monokai-comment font-bold">提炼的洞察 *</label>
                  <input
                    type="text"
                    required
                    placeholder="请输入闪念或认知洞察"
                    value={addFormValues.insight || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, insight: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-monokai-comment font-bold">标签 (Tag)</label>
                  <input
                    type="text"
                    placeholder="e.g. 职场真相"
                    value={addFormValues.tag || ''}
                    onChange={e => setAddFormValues(p => ({ ...p, tag: e.target.value }))}
                    className="px-3 py-1.5 text-xs bg-monokai-sidebar/85 border border-white/8 rounded-lg text-monokai-fg focus:outline-none focus:border-green-500/40 w-44"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 transition-colors text-white font-bold rounded-lg text-xs"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 border border-white/8 text-monokai-comment hover:text-white rounded-lg text-xs"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

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

      {/* ── KPI METRICS & MINI GRAPH ─────────────────────────────────── */}
      <div className="flex gap-3 shrink-0 flex-wrap">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="flex-1 min-w-[150px] bg-monokai-sidebar/30 backdrop-blur-sm border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-monokai-cyan/25 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4 text-monokai-cyan opacity-75" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider truncate">{m.label}</p>
                  <p className="text-xl font-black text-monokai-fg leading-none font-mono mt-0.5">{m.value}</p>
                </div>
              </div>

              {/* Step 5: SVG Sparkline diagrams on KPI Cards */}
              {activeDataTab === 'link' && m.label.includes('平均权重') && state.links.length > 0 && (
                <div className="w-16 h-8 opacity-65 group-hover:opacity-90 transition-opacity">
                  <svg className="w-full h-full" viewBox="0 0 60 30">
                    <path
                      d={`M ${state.links.map((l: any, idx: number) => `${(idx / Math.max(state.links.length - 1, 1)) * 60},${30 - (l.weight * 25)}`).join(' L ')}`}
                      fill="none"
                      stroke="#4CC9F0"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
              {activeDataTab === 'action' && m.label.includes('待处理') && state.actions.length > 0 && (
                <div className="w-8 h-8 opacity-65 group-hover:opacity-90 transition-opacity">
                  <svg className="w-full h-full" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="#FF9CF7" strokeWidth="2.5" />
                    <circle
                      cx="10" cy="10" r="8"
                      fill="none"
                      stroke="#4CC9F0"
                      strokeWidth="2.5"
                      strokeDasharray={`${(state.actions.filter((a: any) => a.status === 'done').length / state.actions.length) * 50.2} 50.2`}
                      transform="rotate(-90 10 10)"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {/* Filter status badge */}
        {filterText && (
          <div className="flex-none flex items-center gap-2 px-4 py-2 bg-monokai-cyan/10 border border-monokai-cyan/25 rounded-2xl text-xs text-monokai-cyan font-bold self-center">
            <Search className="w-3 h-3 opacity-70" />
            <span>命中 {filteredAndSortedData.length} / {rawData.length}</span>
            <button onClick={() => setFilterText('')} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* ── BATCH OPERATIONS TOOLBAR ── */}
      {selectedRowIds.size > 0 && (
        <div className="shrink-0 px-5 py-3 bg-monokai-cyan/10 border border-monokai-cyan/35 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 text-xs font-bold text-monokai-cyan">
            <span>已选中 {selectedRowIds.size} 项</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportData('csv', true)}
              className="px-3 py-1 bg-monokai-bg/60 border border-monokai-cyan/20 hover:border-monokai-cyan/40 hover:bg-monokai-cyan/20 text-xs font-bold rounded-lg text-monokai-fg transition-all"
            >
              导出所选 (CSV)
            </button>
            <button
              onClick={() => handleExportData('json', true)}
              className="px-3 py-1 bg-monokai-bg/60 border border-monokai-cyan/20 hover:border-monokai-cyan/40 hover:bg-monokai-cyan/20 text-xs font-bold rounded-lg text-monokai-fg transition-all"
            >
              导出所选 (JSON)
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1 bg-red-500/80 hover:bg-red-600 transition-colors text-xs font-bold rounded-lg text-white"
            >
              批量删除
            </button>
            <button
              onClick={() => setSelectedRowIds(new Set())}
              className="px-3 py-1 text-xs border border-white/5 hover:text-white rounded-lg text-monokai-comment"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── SPLIT LAYOUT: DATA GRID + INSPECTOR ── */}
      <div className="flex-1 min-h-0 w-full flex gap-4 overflow-hidden">
        {/* Left Side: Data Grid */}
        <div className="flex-1 min-h-0 bg-monokai-bg/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-inner backdrop-blur-sm">
          <div ref={tableContainerRef} className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="sticky top-0 z-10 bg-monokai-sidebar/95 backdrop-blur border-b border-white/8">
                <tr>
                  {/* Checkbox Column */}
                  <th className="px-5 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedData.length > 0 && paginatedData.every(r => selectedRowIds.has(r.id))}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded bg-black/40 border-white/8 accent-monokai-cyan focus:ring-0 focus:outline-none"
                    />
                  </th>

                  {headers.map(h => {
                    const isSorted = sortField === h.key;
                    return (
                      <th
                        key={h.key}
                        onClick={() => handleHeaderClick(h.key)}
                        className="px-5 py-3.5 text-[10px] font-black text-monokai-comment uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{h.label}</span>
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3 h-3 text-monokai-cyan" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-monokai-cyan" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                          )}
                        </div>
                      </th>
                    );
                  })}

                  {/* Operations Column */}
                  <th className="px-5 py-3.5 text-[10px] font-black text-monokai-comment uppercase tracking-widest w-20 text-center">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 2} className="px-5 py-20 text-center">
                       <div className="flex flex-col items-center gap-4">
                        <Database className="w-10 h-10 text-monokai-comment/20" />
                        <div>
                          <p className="text-sm font-bold text-monokai-comment/50 mb-1">
                            {filterText ? `无匹配记录 — "${filterText}"` : '当前表域无数据记录'}
                          </p>
                          <p className="text-xs text-monokai-comment/30">
                            {filterText
                              ? <>尝试修改关键词或<button onClick={() => { setFilterText(''); }} className="text-monokai-cyan/60 hover:text-monokai-cyan underline underline-offset-2 ml-1 transition-colors">清除过滤</button></>
                              : <>点击上方<button onClick={() => setShowSeedPicker(true)} className="text-monokai-cyan/60 hover:text-monokai-cyan underline underline-offset-2 ml-1 transition-colors">导入示例</button>注入数据</>
                            }
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr>
                        <td style={{ height: `${paddingTop}px` }} colSpan={headers.length + 2} />
                      </tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                      const row = filteredAndSortedData[virtualRow.index];
                      if (!row) return null;
                      const isSelectedInInspector = inspectorRowId === row.id;

                      return (
                        <tr
                          key={row.id ?? virtualRow.index}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          onClick={() => {
                            setInspectorRowId(row.id);
                            setShowInspector(true);
                          }}
                          className={`border-b border-white/5 last:border-b-0 hover:bg-monokai-cyan/5 cursor-pointer transition-colors duration-150 ${
                            selectedRowIds.has(row.id) ? 'bg-monokai-cyan/8' : ''
                          } ${isSelectedInInspector ? 'bg-monokai-cyan/5 border-l-2 border-l-monokai-cyan pl-2' : ''}`}
                        >
                          {/* Selection Checkbox */}
                          <td className="px-5 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedRowIds.has(row.id)}
                              onChange={e => handleSelectRow(row.id, e.target.checked)}
                              className="rounded bg-black/40 border-white/8 accent-monokai-cyan focus:ring-0 focus:outline-none"
                            />
                          </td>

                          {headers.map(h => {
                            const isEditing = editingCell && editingCell.id === row.id && editingCell.key === h.key;
                            // Columns that are disabled from inline text editing (IDs, JSON properties, weight visuals)
                            const isEditableField = h.key !== 'id' && h.key !== 'properties';

                            return (
                              <td
                                key={h.key}
                                className="px-5 py-3 align-middle text-sm text-monokai-fg/85 cursor-text select-text"
                                onDoubleClick={() => {
                                  if (isEditableField) {
                                    setEditingCell({ id: row.id, key: h.key, value: row[h.key] });
                                  }
                                }}
                              >
                                {isEditing ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    {renderInlineEditor(row, h.key)}
                                  </div>
                                ) : (
                                  h.render
                                    ? h.render(row[h.key as keyof typeof row], row)
                                    : <span className="font-mono">{String(row[h.key as keyof typeof row] ?? '—')}</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Action Controls */}
                          <td className="px-5 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1.5 rounded-lg text-monokai-comment hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="删除当前行"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td style={{ height: `${paddingBottom}px` }} colSpan={headers.length + 2} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: row count and virtualization status */}
          <div className="shrink-0 px-5 py-3 bg-monokai-sidebar/40 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-monokai-comment/50 font-mono">
                {filterText || filterObjectTypeId !== '' || filterLinkTypeId !== '' || filterMinWeight > 0 || filterActionStatus !== ''
                  ? `已开启虚拟化滚动 | 匹配 ${filteredAndSortedData.length} / ${rawData.length} 条记录（已过滤）`
                  : `已开启虚拟化滚动 | 共 ${rawData.length} 条记录`}
              </span>
            </div>
            <span className="text-[10px] text-monokai-comment/30 font-mono">{currentTab.label}</span>
          </div>
        </div>

        {/* Right Side: Inspector Panel Drawer */}
        {showInspector && inspectorRowId !== null && (
          <div className="w-80 shrink-0 bg-monokai-sidebar/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col backdrop-blur-md animate-in slide-in-from-right-3 duration-250">
            {renderInspectorContent()}
          </div>
        )}
      </div>

      {/* ── JSON EDITOR MODAL ── */}
      {jsonEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-monokai-bg border border-monokai-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-monokai-border/40 flex items-center justify-between bg-monokai-sidebar">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-monokai-cyan" />
                <span className="text-sm font-bold text-monokai-fg">编辑 Instance 特性负载 (JSON)</span>
              </div>
              <button onClick={() => setJsonEditModal(null)} className="text-monokai-comment hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3">
              <p className="text-xs text-monokai-comment">请直接修改下方的 JSON 载荷配置。系统在保存时将自动执行格式校验。</p>
              <div className="w-full flex-1 min-h-[300px] border border-white/8 rounded-xl overflow-hidden bg-black/40">
                <CodeMirror
                  value={jsonEditModal.text}
                  theme={monokai}
                  extensions={[json()]}
                  onChange={value => setJsonEditModal(p => p ? { ...p, text: value, error: null } : null)}
                  className="font-mono text-xs text-left"
                  placeholder='e.g. {"key": "value"}'
                  height="300px"
                />
              </div>
              {jsonEditModal.error && (
                <div className="px-4 py-2 border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{jsonEditModal.error}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-monokai-border/40 bg-monokai-sidebar flex justify-end gap-2 shrink-0">
              <button
                onClick={handleSaveJsonModal}
                className="px-4 py-2 bg-monokai-cyan hover:bg-monokai-cyan/80 text-black font-bold rounded-xl text-xs transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setJsonEditModal(null)}
                className="px-4 py-2 border border-white/8 hover:bg-white/5 text-monokai-comment hover:text-white rounded-xl text-xs transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
