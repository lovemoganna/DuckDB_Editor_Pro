/**
 * useOntologyStore — Ontology 模块的单一数据源（Single Source of Truth）
 *
 * 设计原则：
 * 1. 唯一数据源：所有 OntologyView 及其子组件必须通过此 Hook 访问数据
 * 2. 自动同步：DuckDB 写入后自动触发数据刷新
 * 3. 缓存失效：任何数据变更（CRUD/AI生成）后自动 invalidate
 * 4. 三层架构对齐：
 *    - Data 层（MECE Layer）← 数据结构
 *    - Graph 层 ← D3 图谱可视化
 *    - AI 层 ← AI 推理与生成
 *
 * 数据流：
 *   DuckDB (持久化)
 *       ↕ 读写
 *   useOntologyStore (内存缓存 + 状态)
 *       ↕ 订阅/更新
 *   OntologyView + D3GraphView + OntologyInsightsPanel (视图)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { duckDBService } from '../services/duckdbService';

// ============================================================
// Types — 与 DuckDB 五表一一对应
// ============================================================

export interface LifeObjectType {
  id: number;
  name: string;
  description: string;
}

export interface LifeObject {
  id: number;
  object_type_id: number;
  name: string;
  properties: string;
  annotations: string;
}

export interface LifeLinkType {
  id: number;
  name: string;
  description: string;
}

export interface LifeLink {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight: number;
}

export interface LifeAction {
  id: number;
  object_id: number;
  name: string;
  description: string;
  status: string;
  execute_at: string | null;
}

export interface LifeIntrospection {
  id: number;
  object_id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface LifeInsight {
  id: number;
  object_id: number;
  insight: string;
  tag: string;
  created_at: string;
}

// ============================================================
// State
// ============================================================

export type InitState = 'loading' | 'no-tables' | 'need-seed' | 'ready';
export type ViewMode = 'data' | 'graph' | 'canvas';
export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

export interface OntologyStoreState {
  // Initialization
  initState: InitState;
  initting: boolean;

  // Core data (5 tables)
  objectTypes: LifeObjectType[];
  objects: LifeObject[];
  linkTypes: LifeLinkType[];
  links: LifeLink[];
  actions: LifeAction[];
  introspections: LifeIntrospection[];
  insights: LifeInsight[];

  // View state
  activeLayer: MECELayer;
  viewMode: ViewMode;
  drawerOpen: boolean;
  insightsOpen: boolean;
  search: string;

  // AI state
  aiTopic: string;
  isGenerating: boolean;

  // Error
  error: string | null;

  // Stats (derived)
  stats: {
    objectTypes: number;
    objects: number;
    linkTypes: number;
    links: number;
    actions: number;
    introspections: number;
    insights: number;
  };
}

// ============================================================
// Actions
// ============================================================

export type OntologyAction =
  | { type: 'SET_INIT_STATE'; state: InitState }
  | { type: 'SET_INITTING'; value: boolean }
  | { type: 'SET_DATA'; objectTypes: LifeObjectType[]; objects: LifeObject[]; linkTypes: LifeLinkType[]; links: LifeLink[]; actions: LifeAction[]; introspections: LifeIntrospection[]; insights: LifeInsight[] }
  | { type: 'SET_ACTIVE_LAYER'; layer: MECELayer }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'TOGGLE_INSIGHTS' }
  | { type: 'SET_SEARCH'; term: string }
  | { type: 'SET_AI_TOPIC'; topic: string }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_INTROSPECTIONS'; introspections: LifeIntrospection[] }
  | { type: 'SET_INSIGHTS'; insights: LifeInsight[] };

// ============================================================
// Reducer
// ============================================================

function reducer(state: OntologyStoreState, action: OntologyAction): OntologyStoreState {
  switch (action.type) {
    case 'SET_INIT_STATE':
      return { ...state, initState: action.state };

    case 'SET_INITTING':
      return { ...state, initting: action.value };

    case 'SET_DATA': {
      const stats = {
        objectTypes: action.objectTypes.length,
        objects: action.objects.length,
        linkTypes: action.linkTypes.length,
        links: action.links.length,
        actions: action.actions.length,
        introspections: action.introspections.length,
        insights: action.insights.length,
      };
      return {
        ...state,
        objectTypes: action.objectTypes,
        objects: action.objects,
        linkTypes: action.linkTypes,
        links: action.links,
        actions: action.actions,
        introspections: action.introspections,
        insights: action.insights,
        stats,
        initState: 'ready',
        error: null,
      };
    }

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayer: action.layer };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: !state.drawerOpen };

    case 'TOGGLE_INSIGHTS':
      return { ...state, insightsOpen: !state.insightsOpen };

    case 'SET_SEARCH':
      return { ...state, search: action.term };

    case 'SET_AI_TOPIC':
      return { ...state, aiTopic: action.topic };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_INTROSPECTIONS':
      return {
        ...state,
        introspections: action.introspections,
        stats: { ...state.stats, introspections: action.introspections.length },
      };

    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: action.insights,
        stats: { ...state.stats, insights: action.insights.length },
      };

    default:
      return state;
  }
}

// ============================================================
// Initial State
// ============================================================

const initState: OntologyStoreState = {
  initState: 'loading',
  initting: false,
  objectTypes: [],
  objects: [],
  linkTypes: [],
  links: [],
  actions: [],
  introspections: [],
  insights: [],
  activeLayer: 'domains',
  viewMode: 'graph',
  drawerOpen: true,
  insightsOpen: false,
  search: '',
  aiTopic: '',
  isGenerating: false,
  error: null,
  stats: {
    objectTypes: 0, objects: 0, linkTypes: 0, links: 0,
    actions: 0, introspections: 0, insights: 0,
  },
};

// ============================================================
// Store Hook
// ============================================================

export function useOntologyStore() {
  const [state, dispatch] = useState<OntologyStoreState>(initState);
  const refreshCountRef = useRef(0);

  // ── Load all ontology data from DuckDB ──
  const loadData = useCallback(async () => {
    try {
      const tables = await duckDBService.getTables();
      const requiredTables = [
        'life_object_type', 'life_object', 'life_link_type',
        'life_link', 'life_action',
      ];
      const allExist = requiredTables.every(t => tables.includes(t));

      if (!allExist) {
        dispatch({ type: 'SET_INIT_STATE', state: 'no-tables' });
        return;
      }

      const [objectTypes, objects, linkTypes, links, actions] = await Promise.all([
        duckDBService.getOntologyObjectTypes() as Promise<LifeObjectType[]>,
        duckDBService.getOntologyObjects() as Promise<LifeObject[]>,
        duckDBService.getOntologyLinkTypes() as Promise<LifeLinkType[]>,
        duckDBService.getOntologyLinks() as Promise<LifeLink[]>,
        duckDBService.getOntologyActions() as Promise<LifeAction[]>,
      ]);

      // Load introspection/insight if tables exist
      let introspections: LifeIntrospection[] = [];
      let insights: LifeInsight[] = [];
      try {
        if (tables.includes('life_introspection')) {
          introspections = await duckDBService.getOntologyIntrospections() as LifeIntrospection[];
        }
        if (tables.includes('life_insight')) {
          insights = await duckDBService.getOntologyInsights() as LifeInsight[];
        }
      } catch {}

      dispatch({
        type: 'SET_DATA',
        objectTypes, objects, linkTypes, links, actions, introspections, insights,
      });
    } catch (e: any) {
      if (e.message?.includes('does not exist') || e.message?.includes('Catalog Error')) {
        dispatch({ type: 'SET_INIT_STATE', state: 'no-tables' });
      } else {
        dispatch({ type: 'SET_ERROR', error: e.message });
      }
    }
  }, []);

  // ── Init tables + seed data ──
  const initOntology = useCallback(async () => {
    dispatch({ type: 'SET_INITTING', value: true });
    try {
      await duckDBService.ontologyInit();
      try { await duckDBService.ontologySeed(); } catch {}
      await loadData();
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatch({ type: 'SET_INITTING', value: false });
    }
  }, [loadData]);

  // ── Refresh (invalidate cache) ──
  const refresh = useCallback(async () => {
    refreshCountRef.current++;
    await loadData();
  }, [loadData]);

  // ── Check if init needed on mount ──
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── CRUD Operations ──
  const createObjectType = useCallback(async (name: string, description: string) => {
    const maxId = state.objectTypes.length
      ? Math.max(...state.objectTypes.map(o => o.id)) : 0;
    await duckDBService.query(
      `INSERT INTO life_object_type VALUES (${maxId + 1}, '${name}', '${description}')`
    );
    await refresh();
  }, [state.objectTypes, refresh]);

  const createObject = useCallback(async (
    name: string, objectTypeId: number, properties: string = '{}'
  ) => {
    const maxId = state.objects.length ? Math.max(...state.objects.map(o => o.id)) : 0;
    await duckDBService.query(
      `INSERT INTO life_object (id, object_type_id, name, properties) VALUES (${maxId + 1}, ${objectTypeId}, '${name}', '${properties}')`
    );
    await refresh();
  }, [state.objects, refresh]);

  const createLinkType = useCallback(async (name: string, description: string) => {
    const maxId = state.linkTypes.length ? Math.max(...state.linkTypes.map(l => l.id)) : 0;
    await duckDBService.query(
      `INSERT INTO life_link_type VALUES (${maxId + 1}, '${name}', '${description}')`
    );
    await refresh();
  }, [state.linkTypes, refresh]);

  const createLink = useCallback(async (
    linkTypeId: number, sourceId: number, targetId: number, weight: number = 0.5
  ) => {
    const maxId = state.links.length ? Math.max(...state.links.map(l => l.id)) : 0;
    await duckDBService.query(
      `INSERT INTO life_link VALUES (${maxId + 1}, ${linkTypeId}, ${sourceId}, ${targetId}, ${weight})`
    );
    await refresh();
  }, [state.links, refresh]);

  const createAction = useCallback(async (
    name: string, objectId: number, description: string = '', status: string = 'pending'
  ) => {
    const maxId = state.actions.length ? Math.max(...state.actions.map(a => a.id)) : 0;
    await duckDBService.query(
      `INSERT INTO life_action (id, object_id, name, description, status) VALUES (${maxId + 1}, ${objectId}, '${name}', '${description}', '${status}')`
    );
    await refresh();
  }, [state.actions, refresh]);

  const deleteObject = useCallback(async (id: number) => {
    await duckDBService.deleteOntologyNodeTree(id);
    await refresh();
  }, [refresh]);

  const deleteLink = useCallback(async (id: number) => {
    await duckDBService.deleteOntologyLink(id);
    await refresh();
  }, [refresh]);

  const updateLinkWeight = useCallback(async (id: number, weight: number) => {
    await duckDBService.updateOntologyLinkWeight(id, weight);
    await refresh();
  }, [refresh]);

  // ── AI Draft Commit ──
  const commitOntologyDraft = useCallback(async (draftData: {
    objects: any[]; links: any[]; actions: any[];
    introspections: any[]; insights: any[];
  }) => {
    await duckDBService.executeOntologyDraft(draftData);
    await refresh();
  }, [refresh]);

  // ── Execute SQL (template panel) ──
  const executeSQL = useCallback(async (sql: string, refreshTables?: boolean) => {
    await duckDBService.query(sql);
    if (refreshTables) await refresh();
  }, [refresh]);

  // ── Add introspection / insight ──
  const addIntrospection = useCallback(async (objectId: number, question: string, answer: string) => {
    await duckDBService.addIntrospection(objectId, question, answer);
    const data = await duckDBService.getOntologyIntrospections() as LifeIntrospection[];
    dispatch({ type: 'SET_INTROSPECTIONS', introspections: data });
  }, []);

  const addInsight = useCallback(async (objectId: number, insight: string, tag: string) => {
    await duckDBService.addInsight(objectId, insight, tag);
    const data = await duckDBService.getOntologyInsights() as LifeInsight[];
    dispatch({ type: 'SET_INSIGHTS', insights: data });
  }, []);

  const deleteInsight = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM life_insight WHERE id = ${id}`);
    const data = await duckDBService.getOntologyInsights() as LifeInsight[];
    dispatch({ type: 'SET_INSIGHTS', insights: data });
  }, []);

  // ── Derived: lookup maps ──
  const objectTypeMap = useMemo(() => {
    const m: Record<number, LifeObjectType> = {};
    state.objectTypes.forEach(o => { m[o.id] = o; });
    return m;
  }, [state.objectTypes]);

  const objectNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    state.objects.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [state.objects]);

  const linkTypeMap = useMemo(() => {
    const m: Record<number, LifeLinkType> = {};
    state.linkTypes.forEach(l => { m[l.id] = l; });
    return m;
  }, [state.linkTypes]);

  // ── Layer-aware CRUD visibility ──
  const layerCRUDVisibility = useMemo(() => {
    const l = state.activeLayer;
    return {
      showObjectType: l === 'foundation' || l === 'domains',
      showObject: l === 'foundation' || l === 'patterns' || l === 'domains',
      showLinkType: l === 'foundation' || l === 'relations' || l === 'patterns' || l === 'domains',
      showLink: l === 'relations' || l === 'patterns' || l === 'domains',
      showAction: l === 'methodology' || l === 'domains',
    };
  }, [state.activeLayer]);

  return {
    // State
    state,
    dispatch,

    // Data
    objectTypeMap,
    objectNameMap,
    linkTypeMap,
    layerCRUDVisibility,

    // Operations
    loadData,
    initOntology,
    refresh,

    // CRUD
    createObjectType,
    createObject,
    createLinkType,
    createLink,
    createAction,
    deleteObject,
    deleteLink,
    updateLinkWeight,

    // AI
    commitOntologyDraft,
    executeSQL,

    // Introspection/Insight
    addIntrospection,
    addInsight,
    deleteInsight,
  };
}

// ============================================================
// Layer Config (shared)
// ============================================================

export const ONTOLOGY_LAYERS: Record<MECELayer, {
  label: string;
  description: string;
  color: string;
  layerColor: string;
}> = {
  foundation: {
    label: '基础层',
    description: '核心概念定义 — Object Type / Link Type 的结构与约束',
    color: 'purple',
    layerColor: 'monokai-purple',
  },
  relations: {
    label: '关系层',
    description: '关系实例建模 — Link 实例 CRUD + 权重调整',
    color: 'green',
    layerColor: 'monokai-green',
  },
  methodology: {
    label: '方法层',
    description: '建模方法论 — 反思流程、数据清理、导出导入',
    color: 'cyan',
    layerColor: 'monokai-cyan',
  },
  patterns: {
    label: '模式层',
    description: '核心模式 — 递归追溯、视图封装、聚合分析',
    color: 'yellow',
    layerColor: 'monokai-yellow',
  },
  domains: {
    label: '领域层',
    description: '垂直领域 — 种子数据导入 + 完整初始化',
    color: 'blue',
    layerColor: 'monokai-blue',
  },
};
