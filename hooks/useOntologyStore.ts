/**
 * useOntologyStore — Ontology 模块的单一数据源（Single Source of Truth）
 *
 * 设计原则：
 * 1. 唯一数据源：所有 OntologyPanel 及其子组件必须通过此 Hook 访问数据
 * 2. 自动同步：DuckDB 写入后自动触发数据刷新
 * 3. 缓存失效：任何数据变更（CRUD/AI生成）后自动 invalidate
 * 4. 三视图架构：
 *    - Graph 层 ← D3 图谱可视化
 *    - Data 层  ← SQL 模板 + CRUD
 *    - Canvas 层 ← 自由画布
 *
 * 数据流：
 *   DuckDB (持久化)
 *       ↕ 读写
 *   useOntologyStore (内存缓存 + 状态)
 *       ↕ 订阅/更新
 *   OntologyPanel + D3GraphView + OntologyCanvas + OntologyInsightsPanel (视图)
 */

import { useState, useCallback, useEffect, useRef, useMemo, useReducer } from 'react';
import { duckDBService } from '../services/duckdbService';
import { OntologyDraftPayload } from '../services/ontologyAiService';

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

/** MECE 层级枚举 */
export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

/** 画布快照 — 用于清除前备份和 Ctrl+Z 撤销 */
export interface CanvasSnapshot {
  timestamp: number;
  layer: MECELayer;
  itemsJson: string;
  spacesJson: string;
  edgesJson: string;
}

// ============================================================
// State
// ============================================================

export type InitState = 'loading' | 'no-tables' | 'need-seed' | 'ready';

/** 三视图：图谱 / 数据 / 画布 */
export type ViewTab = 'graph' | 'data' | 'canvas';

/** 左侧抽屉 Tab：模板 / CRUD / 洞察 */
export type DrawerTab = 'templates' | 'crud' | 'insights' | 'mapping';

export interface OntologyStoreState {
  // Initialization
  initState: InitState;
  initting: boolean;

  // Core data (五表)
  objectTypes: LifeObjectType[];
  objects: LifeObject[];
  linkTypes: LifeLinkType[];
  links: LifeLink[];
  actions: LifeAction[];
  introspections: LifeIntrospection[];
  insights: LifeInsight[];

  // View state（三视图 + 抽屉）
  activeTab: ViewTab;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  insightsOpen: boolean;
  search: string;

  // AI state
  aiTopic: string;
  isGenerating: boolean;
  draftPayload: OntologyDraftPayload | null;
  draftJsonStr: string;

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

  // Dynamic Mapping
  mapping: {
    objectTable: string;
    objectTypeTable: string;
    linkTable: string;
    linkTypeTable: string;
    actionTable: string;
  };

  // Canvas state
  canvasActiveLayer: MECELayer;
  canvasAiFillLoading: boolean;
  canvasSnapshots: CanvasSnapshot[];
}

// ============================================================
// Actions
// ============================================================

export type OntologyAction =
  | { type: 'SET_INIT_STATE'; state: InitState }
  | { type: 'SET_INITTING'; value: boolean }
  | { type: 'SET_DATA'; objectTypes: LifeObjectType[]; objects: LifeObject[]; linkTypes: LifeLinkType[]; links: LifeLink[]; actions: LifeAction[]; introspections: LifeIntrospection[]; insights: LifeInsight[] }
  | { type: 'SET_ACTIVE_TAB'; tab: ViewTab }
  | { type: 'SET_DRAWER_TAB'; tab: DrawerTab }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'TOGGLE_INSIGHTS' }
  | { type: 'SET_SEARCH'; term: string }
  | { type: 'SET_AI_TOPIC'; topic: string }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_DRAFT'; payload: OntologyDraftPayload | null; jsonStr?: string }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_INTROSPECTIONS'; introspections: LifeIntrospection[] }
  | { type: 'SET_INSIGHTS'; insights: LifeInsight[] }
  | { type: 'UPDATE_MAPPING'; mapping: Partial<OntologyStoreState['mapping']> }
  | { type: 'SET_CANVAS_LAYER'; layer: MECELayer }
  | { type: 'SET_CANVAS_AI_FILL_LOADING'; value: boolean }
  | { type: 'PUSH_CANVAS_SNAPSHOT'; snapshot: CanvasSnapshot }
  | { type: 'POP_CANVAS_SNAPSHOT' };

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
        objectTypes: action.objectTypes?.length || 0,
        objects: action.objects?.length || 0,
        linkTypes: action.linkTypes?.length || 0,
        links: action.links?.length || 0,
        actions: action.actions?.length || 0,
        introspections: action.introspections?.length || 0,
        insights: action.insights?.length || 0,
      };
      return {
        ...state,
        objectTypes: action.objectTypes || [],
        objects: action.objects || [],
        linkTypes: action.linkTypes || [],
        links: action.links || [],
        actions: action.actions || [],
        introspections: action.introspections || [],
        insights: action.insights || [],
        stats,
        initState: 'ready',
        error: null,
      };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };

    case 'SET_DRAWER_TAB':
      return { ...state, drawerTab: action.tab };

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

    case 'SET_DRAFT':
      return { ...state, draftPayload: action.payload, draftJsonStr: action.jsonStr ?? '' };

    case 'CLEAR_DRAFT':
      return { ...state, draftPayload: null, draftJsonStr: '', aiTopic: '' };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_INTROSPECTIONS':
      return {
        ...state,
        introspections: action.introspections || [],
        stats: { ...state.stats, introspections: action.introspections?.length || 0 },
      };

    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: action.insights || [],
        stats: { ...state.stats, insights: action.insights?.length || 0 },
      };

    case 'UPDATE_MAPPING':
      return {
        ...state,
        mapping: { ...state.mapping, ...action.mapping },
      };

    case 'SET_CANVAS_LAYER':
      return { ...state, canvasActiveLayer: action.layer };

    case 'SET_CANVAS_AI_FILL_LOADING':
      return { ...state, canvasAiFillLoading: action.value };

    case 'PUSH_CANVAS_SNAPSHOT':
      return {
        ...state,
        canvasSnapshots: [...state.canvasSnapshots, action.snapshot].slice(-5),
      };

    case 'POP_CANVAS_SNAPSHOT': {
      if (state.canvasSnapshots.length === 0) return state;
      return {
        ...state,
        canvasSnapshots: state.canvasSnapshots.slice(0, -1),
      };
    }

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
  activeTab: 'graph',
  drawerOpen: true,
  drawerTab: 'templates',
  insightsOpen: false,
  search: '',
  aiTopic: '',
  isGenerating: false,
  draftPayload: null,
  draftJsonStr: '',
  error: null,
  stats: {
    objectTypes: 0, objects: 0, linkTypes: 0, links: 0,
    actions: 0, introspections: 0, insights: 0,
  },
  mapping: {
    objectTable: 'life_object',
    objectTypeTable: 'life_object_type',
    linkTable: 'life_link',
    linkTypeTable: 'life_link_type',
    actionTable: 'life_action',
  },
  canvasActiveLayer: 'foundation',
  canvasAiFillLoading: false,
  canvasSnapshots: [],
};

// ============================================================
// Shared Utilities
// ============================================================

/** Normalize various date inputs to DuckDB DATE string 'YYYY-MM-DD' */
const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(/^\d+$/.test(dateStr) ? Number(dateStr) : dateStr);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  } catch { return ''; }
};

// ============================================================
// Store Hook
// ============================================================

export function useOntologyStore() {
  const [state, dispatch] = useReducer(reducer, initState);
  const dispatchAction = dispatch;
  const refreshCountRef = useRef(0);

  // stateRef 用于在 async 函数中读取最新 state（避免闭包陈旧问题）
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

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
        dispatchAction({ type: 'SET_INIT_STATE', state: 'no-tables' });
        return;
      }

      const [objectTypes, objects, linkTypes, links, actions] = await Promise.all([
        duckDBService.getOntologyObjectTypes(),
        duckDBService.getOntologyObjects(),
        duckDBService.getOntologyLinkTypes(),
        duckDBService.getOntologyLinks(),
        duckDBService.getOntologyActions(),
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

      dispatchAction({
        type: 'SET_DATA',
        objectTypes: objectTypes as any, objects: objects as any, linkTypes: linkTypes as any, links: links as any, actions: actions as any, introspections: introspections as any, insights: insights as any,
      });
    } catch (e: any) {
      if (e.message?.includes('does not exist') || e.message?.includes('Catalog Error')) {
        dispatchAction({ type: 'SET_INIT_STATE', state: 'no-tables' });
      } else {
        dispatchAction({ type: 'SET_ERROR', error: e.message });
      }
    }
  }, []);

  // ── Init tables + seed data ──
  const initOntology = useCallback(async () => {
    dispatchAction({ type: 'SET_INITTING', value: true });
    try {
      await duckDBService.ontologyInit();
      try { await duckDBService.ontologySeed(); } catch {}
      await loadData();
    } catch (e: any) {
      dispatchAction({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatchAction({ type: 'SET_INITTING', value: false });
    }
  }, [loadData]);

  // ── Re-seed (merge new seed data into existing tables) ──
  const reseedOntology = useCallback(async () => {
    dispatchAction({ type: 'SET_INITTING', value: true });
    try {
      await duckDBService.ontologySeed();
      await loadData();
    } catch (e: any) {
      dispatchAction({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatchAction({ type: 'SET_INITTING', value: false });
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
      `INSERT INTO ${state.mapping.objectTypeTable} VALUES (${maxId + 1}, ${duckDBService.escapeLiteral(name)}, ${duckDBService.escapeLiteral(description)})`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const updateObjectType = useCallback(async (id: number, name: string, description: string) => {
    await duckDBService.query(
      `UPDATE ${state.mapping.objectTypeTable} SET name=${duckDBService.escapeLiteral(name)}, description=${duckDBService.escapeLiteral(description)} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const createObject = useCallback(async (
    name: string, objectTypeId: number, properties: string = '{}'
  ) => {
    const maxId = state.objects.length ? Math.max(...state.objects.map(o => o.id)) : 0;
    await duckDBService.query(
      `INSERT INTO ${state.mapping.objectTable} (id, object_type_id, name, properties) VALUES (${maxId + 1}, ${objectTypeId}, ${duckDBService.escapeLiteral(name)}, ${duckDBService.escapeLiteral(properties)})`
    );
    await refresh();
  }, [state.objects, refresh, state.mapping]);

  const updateObject = useCallback(async (id: number, name: string, objectTypeId: number, properties: string = '{}') => {
    await duckDBService.query(
      `UPDATE ${state.mapping.objectTable} SET name=${duckDBService.escapeLiteral(name)}, object_type_id=${objectTypeId}, properties=${duckDBService.escapeLiteral(properties)} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const createLinkType = useCallback(async (name: string, description: string) => {
    const maxId = state.linkTypes.length ? Math.max(...state.linkTypes.map(l => l.id)) : 0;
    await duckDBService.query(
      `INSERT INTO ${state.mapping.linkTypeTable} VALUES (${maxId + 1}, ${duckDBService.escapeLiteral(name)}, ${duckDBService.escapeLiteral(description)})`
    );
    await refresh();
  }, [state.linkTypes, refresh, state.mapping]);

  const updateLinkType = useCallback(async (id: number, name: string, description: string) => {
    await duckDBService.query(
      `UPDATE ${state.mapping.linkTypeTable} SET name=${duckDBService.escapeLiteral(name)}, description=${duckDBService.escapeLiteral(description)} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const createLink = useCallback(async (
    linkTypeId: number, sourceId: number, targetId: number, weight: number = 0.5
  ) => {
    const maxId = state.links.length ? Math.max(...state.links.map(l => l.id)) : 0;
    await duckDBService.query(
      `INSERT INTO ${state.mapping.linkTable} VALUES (${maxId + 1}, ${linkTypeId}, ${sourceId}, ${targetId}, ${weight})`
    );
    await refresh();
  }, [state.links, refresh, state.mapping]);

  const updateLink = useCallback(async (id: number, linkTypeId: number, sourceId: number, targetId: number, weight: number) => {
    await duckDBService.query(
      `UPDATE ${state.mapping.linkTable} SET link_type_id=${linkTypeId}, source_object_id=${sourceId}, target_object_id=${targetId}, weight=${weight} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const createAction = useCallback(async (
    name: string, objectId: number, description: string = '', status: string = 'pending', executeAt?: string
  ) => {
    const maxId = state.actions.length ? Math.max(...state.actions.map(a => a.id)) : 0;
    const normalizedDate = normalizeDate(executeAt || '');
    const execAt = normalizedDate ? `'${normalizedDate}'` : 'NULL';
    await duckDBService.query(
      `INSERT INTO ${state.mapping.actionTable} (id, object_id, name, description, status, execute_at) VALUES (${maxId + 1}, ${objectId}, ${duckDBService.escapeLiteral(name)}, ${duckDBService.escapeLiteral(description)}, ${duckDBService.escapeLiteral(status)}, ${execAt})`
    );
    await refresh();
  }, [state.actions, refresh, state.mapping]);

  const updateAction = useCallback(async (id: number, name: string, description: string, status: string, executeAt?: string) => {
    const normalizedDate = normalizeDate(executeAt || '');
    const execStr = normalizedDate ? `, execute_at='${normalizedDate}'` : '';
    await duckDBService.query(
      `UPDATE ${state.mapping.actionTable} SET name=${duckDBService.escapeLiteral(name)}, description=${duckDBService.escapeLiteral(description)}, status=${duckDBService.escapeLiteral(status)}${execStr} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const deleteObject = useCallback(async (id: number) => {
    await duckDBService.deleteOntologyNodeTree(id);
    await refresh();
  }, [refresh]);

  const deleteObjectType = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM ${state.mapping.objectTypeTable} WHERE id=${id}`);
    await refresh();
  }, [refresh, state.mapping]);

  const deleteLink = useCallback(async (id: number) => {
    await duckDBService.deleteOntologyLink(id);
    await refresh();
  }, [refresh]);

  const deleteLinkType = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM ${state.mapping.linkTypeTable} WHERE id=${id}`);
    await refresh();
  }, [refresh, state.mapping]);

  const deleteAction = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM ${state.mapping.actionTable} WHERE id=${id}`);
    await refresh();
  }, [refresh, state.mapping]);

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

  // ── Batch Import from AI Modeling Wizard ──
  const getState = useCallback(() => stateRef.current, []);

  /** Bulk-insert helper: collects rows and fires a single INSERT per chunk */
  const bulkInsert = async (table: string, columns: string[], rows: Record<string, any>[]) => {
    if (rows.length === 0) return;
    const CHUNK = 50;
    for (let ci = 0; ci < rows.length; ci += CHUNK) {
      const chunk = rows.slice(ci, ci + CHUNK);
      const values = chunk.map(row =>
        columns.map(col => duckDBService.escapeLiteral(row[col] ?? null)).join(', ')
      ).join('), (');
      const cols = columns.map(c => `"${c}"`).join(', ');
      await duckDBService.query(`INSERT INTO "${table}" (${cols}) VALUES (${values})`);
    }
  };

  const batchImportModelingResult = useCallback(async (result: {
    objectTypes: Array<{ name: string; description?: string }>;
    objects: Array<{ name: string; objectType: string; properties?: Record<string, any>; annotations?: string }>;
    linkTypes: Array<{ name: string; description?: string }>;
    links: Array<{ from: string; to: string; linkType: string; weight?: number }>;
  }) => {
    // Build type name -> id map from current state
    const typeNameMap: Record<string, number> = {};
    for (const ot of state.objectTypes) typeNameMap[ot.name] = ot.id;
    for (const lt of state.linkTypes) typeNameMap[lt.name] = lt.id;

    // Build object name -> id map from current state
    const objectNameMap: Record<string, number> = {};
    for (const o of state.objects) objectNameMap[o.name] = o.id;

    // Compute starting IDs so new items don't clash
    const startTypeId = state.objectTypes.length > 0
      ? Math.max(...state.objectTypes.map(o => o.id)) + 1 : 1;
    const startObjectId = state.objects.length > 0
      ? Math.max(...state.objects.map(o => o.id)) + 1 : 1;
    const startLinkTypeId = state.linkTypes.length > 0
      ? Math.max(...state.linkTypes.map(l => l.id)) + 1 : 1;
    const startLinkId = state.links.length > 0
      ? Math.max(...state.links.map(l => l.id)) + 1 : 1;

    // Bulk-insert object types
    const otRows = result.objectTypes.map((ot, i) => ({
      id: startTypeId + i,
      name: ot.name,
      description: ot.description || '',
    }));
    await bulkInsert(state.mapping.objectTypeTable, ['id', 'name', 'description'], otRows);

    // Refresh to get newly created IDs
    await refresh();
    const s1 = getState();
    for (const ot of s1.objectTypes) typeNameMap[ot.name] = ot.id;
    for (const o of s1.objects) objectNameMap[o.name] = o.id;

    // Bulk-insert objects
    const objRows: Record<string, any>[] = [];
    for (const obj of result.objects) {
      const typeId = typeNameMap[obj.objectType];
      if (!typeId) continue;
      const newId = startObjectId + objRows.length;
      objRows.push({
        id: newId,
        object_type_id: typeId,
        name: obj.name,
        properties: JSON.stringify(obj.properties || {}),
        annotations: obj.annotations || '',
      });
    }
    await bulkInsert(state.mapping.objectTable,
      ['id', 'object_type_id', 'name', 'properties', 'annotations'], objRows);

    // Refresh again to get object IDs
    await refresh();
    const s2 = getState();
    for (const o of s2.objects) objectNameMap[o.name] = o.id;

    // Bulk-insert link types
    const ltRows = result.linkTypes.map((lt, i) => ({
      id: startLinkTypeId + i,
      name: lt.name,
      description: lt.description || '',
    }));
    await bulkInsert(state.mapping.linkTypeTable, ['id', 'name', 'description'], ltRows);

    // Refresh to get link type IDs
    const s3 = getState();
    const linkTypeNameMap: Record<string, number> = {};
    for (const lt of s3.linkTypes) linkTypeNameMap[lt.name] = lt.id;

    // Bulk-insert links
    const linkRows: Record<string, any>[] = [];
    for (let i = 0; i < result.links.length; i++) {
      const link = result.links[i];
      const fromId = objectNameMap[link.from];
      const toId = objectNameMap[link.to];
      const ltId = linkTypeNameMap[link.linkType];
      if (!fromId || !toId || !ltId) continue;
      linkRows.push({
        id: startLinkId + linkRows.length,
        link_type_id: ltId,
        source_object_id: fromId,
        target_object_id: toId,
        weight: link.weight ?? 0.5,
      });
    }
    await bulkInsert(state.mapping.linkTable,
      ['id', 'link_type_id', 'source_object_id', 'target_object_id', 'weight'], linkRows);

    // Single final refresh
    await refresh();
  }, [state.objectTypes, state.objects, state.linkTypes, refresh, getState, state.mapping]);

  // ── Execute SQL (template panel) ──
  const executeSQL = useCallback(async (sql: string, refreshTables?: boolean) => {
    await duckDBService.query(sql);
    if (refreshTables) await refresh();
  }, [refresh]);

  // ── Add introspection / insight ──
  const addIntrospection = useCallback(async (objectId: number, question: string, answer: string) => {
    await duckDBService.addIntrospection(objectId, question, answer);
    const data = await duckDBService.getOntologyIntrospections() as LifeIntrospection[];
    dispatchAction({ type: 'SET_INTROSPECTIONS', introspections: data });
  }, []);

  const addInsight = useCallback(async (objectId: number, insight: string, tag: string) => {
    await duckDBService.addInsight(objectId, insight, tag);
    const data = await duckDBService.getOntologyInsights() as LifeInsight[];
    dispatchAction({ type: 'SET_INSIGHTS', insights: data });
  }, []);

  const deleteInsight = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM life_insight WHERE id = ${id}`);
    const data = await duckDBService.getOntologyInsights() as LifeInsight[];
    dispatchAction({ type: 'SET_INSIGHTS', insights: data });
  }, []);

  // ── Derived: lookup maps ──
  const objectTypeMap = useMemo(() => {
    const m: Record<number, LifeObjectType> = {};
    state.objectTypes?.forEach(o => { m[o.id] = o; });
    return m;
  }, [state.objectTypes]);

  const objectNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    state.objects?.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [state.objects]);

  const linkTypeMap = useMemo(() => {
    const m: Record<number, LifeLinkType> = {};
    state.linkTypes?.forEach(l => { m[l.id] = l; });
    return m;
  }, [state.linkTypes]);

  return {
    // State
    state,
    dispatch,

    // Derived maps
    objectTypeMap,
    objectNameMap,
    linkTypeMap,

    // Operations
    loadData,
    initOntology,
    reseedOntology,
    refresh,

    // CRUD
    createObjectType,
    updateObjectType,
    createObject,
    updateObject,
    createLinkType,
    updateLinkType,
    createLink,
    updateLink,
    createAction,
    updateAction,
    deleteObjectType,
    deleteObject,
    deleteLinkType,
    deleteLink,
    deleteAction,
    updateLinkWeight,

    // AI
    commitOntologyDraft,
    batchImportModelingResult,
    executeSQL,

    // Introspection/Insight
    addIntrospection,
    addInsight,
    deleteInsight,

    // Canvas helpers
    canvasSnapshots: state.canvasSnapshots,
    canvasActiveLayer: state.canvasActiveLayer,
    canvasAiFillLoading: state.canvasAiFillLoading,
    setCanvasLayer: (layer: MECELayer) => dispatch({ type: 'SET_CANVAS_LAYER', layer }),
    setCanvasAiFillLoading: (value: boolean) => dispatch({ type: 'SET_CANVAS_AI_FILL_LOADING', value }),
    pushCanvasSnapshot: (snapshot: CanvasSnapshot) => dispatch({ type: 'PUSH_CANVAS_SNAPSHOT', snapshot }),
    popCanvasSnapshot: () => dispatch({ type: 'POP_CANVAS_SNAPSHOT' }),
  };
}

// ============================================================
// Action Creators（命名 action creators，供组件调用）
// ============================================================

export const ontologyActions = {
  setActiveTab: (tab: ViewTab): OntologyAction => ({ type: 'SET_ACTIVE_TAB', tab }),
  setDrawerTab: (tab: DrawerTab): OntologyAction => ({ type: 'SET_DRAWER_TAB', tab }),
  toggleDrawer: (): OntologyAction => ({ type: 'TOGGLE_DRAWER' }),
  toggleInsights: (): OntologyAction => ({ type: 'TOGGLE_INSIGHTS' }),
  setSearch: (term: string): OntologyAction => ({ type: 'SET_SEARCH', term }),
  setAiTopic: (topic: string): OntologyAction => ({ type: 'SET_AI_TOPIC', topic }),
  setGenerating: (value: boolean): OntologyAction => ({ type: 'SET_GENERATING', value }),
  setDraft: (payload: OntologyDraftPayload | null, jsonStr?: string): OntologyAction => ({ type: 'SET_DRAFT', payload, jsonStr }),
  clearDraft: (): OntologyAction => ({ type: 'CLEAR_DRAFT' }),
  setCanvasLayer: (layer: MECELayer): OntologyAction => ({ type: 'SET_CANVAS_LAYER', layer }),
  setCanvasAiFillLoading: (value: boolean): OntologyAction => ({ type: 'SET_CANVAS_AI_FILL_LOADING', value }),
  pushCanvasSnapshot: (snapshot: CanvasSnapshot): OntologyAction => ({ type: 'PUSH_CANVAS_SNAPSHOT', snapshot }),
  popCanvasSnapshot: (): OntologyAction => ({ type: 'POP_CANVAS_SNAPSHOT' }),
};
