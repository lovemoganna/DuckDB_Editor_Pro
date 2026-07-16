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

import React, { useState, useCallback, useEffect, useRef, useMemo, useReducer } from 'react';
import { duckDBService } from '../services/duckdbService';
import { OntologyDraftPayload } from '../services/ontologyAiService';

import seedOntologyLv1 from '../data/ontology/seed-ontology-lv1.json';
import seedOntologyLv2 from '../data/ontology/seed-ontology-lv2.json';
import seedOntologyLv3 from '../data/ontology/seed-ontology-lv3.json';
import seedOntologyLv4 from '../data/ontology/seed-ontology-lv4.json';
import seedOntologyLv5 from '../data/ontology/seed-ontology-lv5.json';
import seedEcommerce from '../data/ontology/seed-ecommerce.json';
import seedHealthTracker from '../data/ontology/seed-health-tracker.json';
import seedMyLife from '../data/ontology/seed-my-life.json';
import seedProductCatalog from '../data/ontology/seed-product-catalog.json';
import seedProjectTracker from '../data/ontology/seed-project-tracker.json';
import seedRiskInvestigation from '../data/ontology/seed-risk-investigation.json';
import seedTaskTracker from '../data/ontology/seed-task-tracker.json';
import seedWorkflow from '../data/ontology/seed-workflow.json';
import seedStressTest from '../data/ontology/seed-stress-test.json';import { DEFAULT_PATTERNS } from '../components/Library/defaultPatterns';

export const ONTOLOGY_SEEDS: Record<string, any> = {
  'ontology-lv1': seedOntologyLv1,
  'ontology-lv2': seedOntologyLv2,
  'ontology-lv3': seedOntologyLv3,
  'ontology-lv4': seedOntologyLv4,
  'ontology-lv5': seedOntologyLv5,
  'ecommerce': seedEcommerce,
  'health-tracker': seedHealthTracker,
  'my-life': seedMyLife,
  'product-catalog': seedProductCatalog,
  'project-tracker': seedProjectTracker,
  'risk-investigation': seedRiskInvestigation,
  'task-tracker': seedTaskTracker,
  'workflow': seedWorkflow,
  'stress-test': seedStressTest,
};

export const ONTOLOGY_SEED_INFOS = [
  // ── 基础教学 (Tutorial) ──
  { id: 'ontology-lv1', name: '本体 Lv.1：概念与对象', category: 'Tutorial', icon: '🌱', description: '定义核心概念类型 (Class) 与具体实例 (Instance)，是建模的基础' },
  { id: 'ontology-lv2', name: '本体 Lv.2：语义关联', category: 'Tutorial', icon: '🌿', description: '定义概念与实例之间的关系类型 (Relation) 与连线 (Link)' },
  { id: 'ontology-lv3', name: '本体 Lv.3：属性特征化', category: 'Tutorial', icon: '🌳', description: '使用 JSON 属性细化描述类与实例的特征约束，增强多态性' },
  { id: 'ontology-lv4', name: '本体 Lv.4：演变与行动', category: 'Tutorial', icon: '⚙️', description: '引入行动 (Action) 机制，模拟本体模型的动态演变与回写运维流' },
  { id: 'ontology-lv5', name: '本体 Lv.5：方法论反思', category: 'Tutorial', icon: '🧠', description: '通过反思 (Introspection) 与洞察 (Insight)，探索本体设计的深层逻辑' },

  // ── 行业应用 (Industry - Palantir Ontology 风格) ──
  { id: 'risk-investigation', name: '项目风险调查 (Risk)', category: 'Industry', icon: '⚠️', description: '模拟风险事件向技术组件与可用性指标传导，支持路径影响分析' },
  { id: 'ecommerce', name: '电商运营图谱 (E-Commerce)', category: 'Industry', icon: '🛒', description: '定义商品 (Product)、客户 (Customer)、渠道 (Channel) 等商业运营实体与交易关联' },
  { id: 'product-catalog', name: '商品目录管理 (Catalog)', category: 'Industry', icon: '📦', description: '模拟大型商品分类树、属性集、供应商等实体与多对多目录链接结构' },
  { id: 'workflow', name: '业务工作流 (Workflow)', category: 'Industry', icon: '🔄', description: '模拟业务审批流、任务分派、状态流转等流程本体管理与时序追踪' },

  // ── 日常管理 (Personal) ──
  { id: 'my-life', name: '个人生活管理 (Life)', category: 'Personal', icon: '🏠', description: '通过事件、习惯、项目等实体刻画个人的生活习惯及多维价值关联' },
  { id: 'health-tracker', name: '健康追踪 (Health)', category: 'Personal', icon: '🏥', description: '记录饮食、运动、体征、睡眠，以及健康指标的波动和交叉影响关系' },
  { id: 'project-tracker', name: '项目追踪管理 (Project)', category: 'Personal', icon: '📅', description: '针对工程项目的里程碑、团队、依赖组件等进行建模与风险监控' },
  { id: 'task-tracker', name: '任务追踪 (Task)', category: 'Personal', icon: '✅', description: '任务依赖、优先级、执行人等本体建模，管理细粒度研发工作流' },
  { id: 'stress-test', name: '本体压力测试 (Stress)', category: 'Personal', icon: '⚡', description: '高基数、多层级拓扑结构的测试种子，用于评估画布在极端数据下的性能' }
];

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

export interface Position {
  x: number;
  y: number;
}

export type SavedPositions = Record<number, Position>;

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

/** Imperative command accepted by OntologyPanel (e.g. from CommandPalette) */
export type OntologyCommand =
  | { action: 'open-view'; view: ViewTab }
  | { action: 'open-drawer'; drawer: DrawerTab }
  | { action: 'open-inspector'; mode: 'create-object-type' | 'create-object' | 'create-link' | 'create-link-type' | 'create-action' }
  | { action: 'init' }
  | { action: 'reseed' }
  | { action: 'refresh' };

export interface OntologyStoreState {
  // Initialization
  initState: InitState;
  initting: boolean;
  activeTemplateId: string;
  patterns: any[];
  patternsLoading: boolean;

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

  // Pending command (from CommandPalette etc.) — consumed on panel mount
  pendingCommand: OntologyCommand | null;

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
    introspectionTable: string;
    insightTable: string;
    objectFields: Record<string, string>;
    linkFields: Record<string, string>;
  };

  // Canvas state
  canvasActiveLayer: MECELayer;
  canvasAiFillLoading: boolean;
  canvasSnapshots: CanvasSnapshot[];
  canvasPositions: SavedPositions;
  canvasLockedNodeIds: Set<number>;
}

// ============================================================
// Actions
// ============================================================

export type OntologyAction =
  | { type: 'SET_INIT_STATE'; state: InitState }
  | { type: 'SET_INITTING'; value: boolean }
  | { type: 'SET_ACTIVE_TEMPLATE'; templateId: string }
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
  | { type: 'SET_PENDING_COMMAND'; command: OntologyCommand | null }
  | { type: 'SET_INTROSPECTIONS'; introspections: LifeIntrospection[] }
  | { type: 'SET_INSIGHTS'; insights: LifeInsight[] }
  | { type: 'UPDATE_MAPPING'; mapping: Partial<OntologyStoreState['mapping']> }
  | { type: 'SET_CANVAS_LAYER'; layer: MECELayer }
  | { type: 'SET_CANVAS_AI_FILL_LOADING'; value: boolean }
  | { type: 'PUSH_CANVAS_SNAPSHOT'; snapshot: CanvasSnapshot }
  | { type: 'POP_CANVAS_SNAPSHOT' }
  | { type: 'SET_CANVAS_POSITIONS'; positions: SavedPositions }
  | { type: 'SET_CANVAS_LOCKED_NODES'; lockedNodeIds: Set<number> }
  | { type: 'SET_PATTERNS'; patterns: any[] }
  | { type: 'SET_PATTERNS_LOADING'; value: boolean };

// ============================================================
// Reducer
// ============================================================

function reducer(state: OntologyStoreState, action: OntologyAction): OntologyStoreState {
  switch (action.type) {
    case 'SET_INIT_STATE':
      return { ...state, initState: action.state };

    case 'SET_ACTIVE_TEMPLATE':
      return { ...state, activeTemplateId: action.templateId };

    case 'SET_PATTERNS':
      return { ...state, patterns: action.patterns, patternsLoading: false };

    case 'SET_PATTERNS_LOADING':
      return { ...state, patternsLoading: action.value };

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

    case 'SET_PENDING_COMMAND':
      return { ...state, pendingCommand: action.command };

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

    case 'SET_CANVAS_POSITIONS':
      return {
        ...state,
        canvasPositions: action.positions,
      };

    case 'SET_CANVAS_LOCKED_NODES':
      return {
        ...state,
        canvasLockedNodeIds: action.lockedNodeIds,
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
  activeTemplateId: 'ontology-lv1',
  patterns: [],
  patternsLoading: false,
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
  pendingCommand: null,
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
    introspectionTable: 'life_introspection',
    insightTable: 'life_insight',
    objectFields: {
      id: 'id',
      name: 'name',
      object_type_id: 'object_type_id',
      properties: 'properties',
      annotations: 'annotations',
    },
    linkFields: {
      id: 'id',
      link_type_id: 'link_type_id',
      source_object_id: 'source_object_id',
      target_object_id: 'target_object_id',
      weight: 'weight',
    },
  },
  canvasActiveLayer: 'foundation',
  canvasAiFillLoading: false,
  canvasSnapshots: [],
  canvasPositions: {},
  canvasLockedNodeIds: new Set(),
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

let seedingPromise: Promise<void> | null = null;

// ============================================================
// Store Hook
// ============================================================

function useOntologyStoreInternal() {
  const [state, dispatch] = useReducer(reducer, initState);
  const dispatchAction = dispatch;
  const refreshCountRef = useRef(0);

  // stateRef 用于在 async 函数中读取最新 state（避免闭包陈旧问题）
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const pendingPositionsRef = useRef<SavedPositions>({});
  const dbWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPositionsToDb = useCallback(async () => {
    const positionsToWrite = pendingPositionsRef.current;
    pendingPositionsRef.current = {};
    if (Object.keys(positionsToWrite).length === 0) return;

    try {
      for (const [nodeIdStr, pos] of Object.entries(positionsToWrite)) {
        const nodeId = Number(nodeIdStr);
        const isLocked = stateRef.current.canvasLockedNodeIds.has(nodeId);
        await duckDBService.saveOntologyCanvasState(
          `object_${nodeId}`,
          null,
          nodeId,
          `object_${nodeId}`,
          '',
          pos.x,
          pos.y,
          0,
          0,
          'object',
          { is_locked: isLocked }
        );
      }
    } catch (err) {
      console.error('Failed to batch save node positions to DuckDB in debounced task', err);
    }
  }, []);

  const queuePositionsForDb = useCallback((positions: SavedPositions) => {
    pendingPositionsRef.current = { ...pendingPositionsRef.current, ...positions };
    if (dbWriteTimeoutRef.current) {
      clearTimeout(dbWriteTimeoutRef.current);
    }
    dbWriteTimeoutRef.current = setTimeout(flushPositionsToDb, 500);
  }, [flushPositionsToDb]);

  useEffect(() => {
    return () => {
      if (dbWriteTimeoutRef.current) {
        clearTimeout(dbWriteTimeoutRef.current);
      }
    };
  }, []);

  // ── Load all ontology data from DuckDB ──
  const loadData = useCallback(async () => {
    try {
      const tables = await duckDBService.getTables();

      // Load or seed patterns first (independent of other tables)
      try {
        await duckDBService.query(`
          CREATE TABLE IF NOT EXISTS _sys_ontology_pattern_library (
            id VARCHAR PRIMARY KEY,
            category_id VARCHAR,
            category_title VARCHAR,
            title VARCHAR,
            icon_name VARCHAR,
            brief VARCHAR,
            description VARCHAR,
            layer VARCHAR,
            seed_ids JSON DEFAULT '[]',
            core_nodes JSON DEFAULT '[]',
            principles JSON DEFAULT '[]',
            best_practices JSON DEFAULT '[]',
            anti_patterns JSON DEFAULT '[]',
            mermaid VARCHAR
          )
        `);
        let patterns = await duckDBService.getOntologyPatterns();
        if (patterns.length === 0) {
          if (!seedingPromise) {
            seedingPromise = (async () => {
              console.log('[Store] Pattern library is empty, seeding default patterns...');
              for (const p of DEFAULT_PATTERNS) {
                await duckDBService.saveOntologyPattern(p);
              }
            })();
          }
          await seedingPromise;
          seedingPromise = null;
          patterns = await duckDBService.getOntologyPatterns();
        }
        dispatchAction({ type: 'SET_PATTERNS', patterns });
      } catch (pe) {
        console.warn('Load pattern library failed:', pe);
      }

      const requiredTables = [
        'life_object_type', 'life_object', 'life_link_type',
        'life_link', 'life_action',
      ];
      const allExist = requiredTables.every(t => tables.includes(t));

      if (!allExist) {
        dispatchAction({ type: 'SET_INIT_STATE', state: 'no-tables' });
        return;
      }

      const [objectTypesRaw, objectsRaw, linkTypesRaw, linksRaw, actionsRaw] = await Promise.all([
        duckDBService.getOntologyObjectTypes(),
        duckDBService.getOntologyObjects(),
        duckDBService.getOntologyLinkTypes(),
        duckDBService.getOntologyLinks(),
        duckDBService.getOntologyActions(),
      ]);

      const objectTypes = objectTypesRaw.map((ot: any) => ({
        ...ot,
        id: Number(ot.id)
      }));
      const objects = objectsRaw.map((o: any) => ({
        ...o,
        id: Number(o.id),
        object_type_id: Number(o.object_type_id)
      }));
      const linkTypes = linkTypesRaw.map((lt: any) => ({
        ...lt,
        id: Number(lt.id)
      }));
      const links = linksRaw.map((l: any) => ({
        ...l,
        id: Number(l.id),
        link_type_id: Number(l.link_type_id),
        source_object_id: Number(l.source_object_id),
        target_object_id: Number(l.target_object_id),
        weight: Number(l.weight) || 0.5
      }));
      const actions = actionsRaw.map((a: any) => ({
        ...a,
        id: Number(a.id),
        object_id: Number(a.object_id)
      }));

      // Load introspection/insight if tables exist
      const introTable = stateRef.current.mapping.introspectionTable || 'life_introspection';
      const insTable = stateRef.current.mapping.insightTable || 'life_insight';
      let introspections: LifeIntrospection[] = [];
      let insights: LifeInsight[] = [];
      try {
        if (tables.includes(introTable)) {
          const rows = await duckDBService.query(`SELECT * FROM ${introTable} ORDER BY id`);
          introspections = rows.map(r => ({
            ...r,
            id: Number(r.id),
            object_id: Number(r.object_id),
            created_at: normalizeDate(r.created_at)
          })) as LifeIntrospection[];
        }
        if (tables.includes(insTable)) {
          const rows = await duckDBService.query(`SELECT * FROM ${insTable} ORDER BY id`);
          insights = rows.map(r => ({
            ...r,
            id: Number(r.id),
            object_id: Number(r.object_id),
            created_at: normalizeDate(r.created_at)
          })) as LifeInsight[];
        }
      } catch {}

      // Ensure canvas layout table exists
      try {
        await duckDBService.query(`
          CREATE TABLE IF NOT EXISTS _sys_ontology_canvas_layout (
            node_type VARCHAR,
            node_id INTEGER,
            x DOUBLE,
            y DOUBLE,
            is_locked BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (node_type, node_id)
          )
        `);
      } catch (e) {
        console.warn('Initialize layout table failed', e);
      }

      // Ensure pattern library table exists
      try {
        await duckDBService.query(`
          CREATE TABLE IF NOT EXISTS _sys_ontology_pattern_library (
            id VARCHAR PRIMARY KEY,
            category_id VARCHAR,
            category_title VARCHAR,
            title VARCHAR,
            icon_name VARCHAR,
            brief VARCHAR,
            description VARCHAR,
            layer VARCHAR,
            seed_ids JSON DEFAULT '[]',
            core_nodes JSON DEFAULT '[]',
            principles JSON DEFAULT '[]',
            best_practices JSON DEFAULT '[]',
            anti_patterns JSON DEFAULT '[]',
            mermaid VARCHAR
          )
        `);
      } catch (e) {
        console.warn('Initialize pattern library table failed', e);
      }

      let canvasPositions: SavedPositions = {};
      let canvasLockedNodeIds: Set<number> = new Set();
      try {
        const layoutRows = await duckDBService.query("SELECT * FROM life_canvas_state WHERE node_type = 'object'");
        if (layoutRows && Array.isArray(layoutRows)) {
          layoutRows.forEach((r: any) => {
            canvasPositions[Number(r.object_id)] = { x: Number(r.x), y: Number(r.y) };
            const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : (r.metadata || {});
            if (meta.is_locked || meta.is_locked === 'true' || meta.is_locked === 1) {
              canvasLockedNodeIds.add(Number(r.object_id));
            }
          });
        }
      } catch (e) {
        console.warn('Failed to load canvas positions from DuckDB:', e);
      }

      dispatchAction({
        type: 'SET_DATA',
        objectTypes: objectTypes as any, objects: objects as any, linkTypes: linkTypes as any, links: links as any, actions: actions as any, introspections: introspections as any, insights: insights as any,
      });

      // Loaded data dispatch completed

      dispatchAction({ type: 'SET_CANVAS_POSITIONS', positions: canvasPositions });
      dispatchAction({ type: 'SET_CANVAS_LOCKED_NODES', lockedNodeIds: canvasLockedNodeIds });
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

  // ── Switch template dynamically ──
  const switchTemplate = useCallback(async (templateId: string) => {
    const seed = ONTOLOGY_SEEDS[templateId];
    if (!seed) return;
    dispatchAction({ type: 'SET_INITTING', value: true });
    try {
      await duckDBService.loadOntologyTemplate(seed);
      dispatchAction({ type: 'SET_ACTIVE_TEMPLATE', templateId });
      dispatchAction({ type: 'SET_SEARCH', term: '' }); // Clear search to avoid stale dimming/filtering
      await loadData();
      dispatchAction({ type: 'SET_ACTIVE_TAB', tab: 'graph' });
    } catch (e: any) {
      console.error('Switch template failed:', e);
      dispatchAction({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatchAction({ type: 'SET_INITTING', value: false });
    }
  }, [loadData]);

  // ── Refresh (invalidate cache) with Debounce ──
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      refreshCountRef.current++;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          await loadData();
        } finally {
          resolve();
        }
      }, 50);
    });
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

  // ── Add/Edit/Delete introspection / insight ──
  const createIntrospection = useCallback(async (objectId: number, question: string, answer: string) => {
    if (state.mapping.introspectionTable === 'life_introspection') {
      await duckDBService.addIntrospection(objectId, question, answer);
    } else {
      const maxId = state.introspections.length ? Math.max(...state.introspections.map(i => i.id)) : 0;
      await duckDBService.query(
        `INSERT INTO ${state.mapping.introspectionTable} (id, object_id, question, answer, created_at) VALUES (${maxId + 1}, ${objectId}, ${duckDBService.escapeLiteral(question)}, ${duckDBService.escapeLiteral(answer)}, CURRENT_DATE)`
      );
    }
    await refresh();
  }, [state.introspections, refresh, state.mapping]);

  const updateIntrospection = useCallback(async (id: number, objectId: number, question: string, answer: string) => {
    await duckDBService.query(
      `UPDATE ${state.mapping.introspectionTable} SET object_id=${objectId}, question=${duckDBService.escapeLiteral(question)}, answer=${duckDBService.escapeLiteral(answer)} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const deleteIntrospection = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM ${state.mapping.introspectionTable} WHERE id=${id}`);
    await refresh();
  }, [refresh, state.mapping]);

  const createInsight = useCallback(async (objectId: number, insight: string, tag: string) => {
    if (state.mapping.insightTable === 'life_insight') {
      await duckDBService.addInsight(objectId, insight, tag);
    } else {
      const maxId = state.insights.length ? Math.max(...state.insights.map(i => i.id)) : 0;
      await duckDBService.query(
        `INSERT INTO ${state.mapping.insightTable} (id, object_id, insight, tag, created_at) VALUES (${maxId + 1}, ${objectId}, ${duckDBService.escapeLiteral(insight)}, ${duckDBService.escapeLiteral(tag)}, CURRENT_DATE)`
      );
    }
    await refresh();
  }, [state.insights, refresh, state.mapping]);

  const updateInsight = useCallback(async (id: number, objectId: number, insight: string, tag: string) => {
    await duckDBService.query(
      `UPDATE ${state.mapping.insightTable} SET object_id=${objectId}, insight=${duckDBService.escapeLiteral(insight)}, tag=${duckDBService.escapeLiteral(tag)} WHERE id=${id}`
    );
    await refresh();
  }, [refresh, state.mapping]);

  const deleteInsight = useCallback(async (id: number) => {
    await duckDBService.query(`DELETE FROM ${state.mapping.insightTable} WHERE id=${id}`);
    await refresh();
  }, [refresh, state.mapping]);

  // ── Conflict Check & Merge Template ──
  const checkTemplateMergeConflicts = useCallback((templateId: string) => {
    const seed = ONTOLOGY_SEEDS[templateId];
    if (!seed) return { conflicts: [], hasConflicts: false };

    const conflicts: Array<{
      type: 'objectType' | 'object' | 'linkType' | 'link' | 'action';
      name: string;
      details: string;
    }> = [];

    // 1. Check Object Types
    const existingObjTypeNames = new Map(state.objectTypes.map(ot => [ot.name.toLowerCase(), ot]));
    const resolvedObjTypeIds = new Map<number, number>();

    (seed.objectTypes || []).forEach((ot: any) => {
      const match = existingObjTypeNames.get(ot.name.toLowerCase());
      if (match) {
        resolvedObjTypeIds.set(ot.id, match.id);
        if (match.description !== (ot.description || '')) {
          conflicts.push({
            type: 'objectType',
            name: ot.name,
            details: `描述冲突: 本地描述为 "${match.description}"，模式库中为 "${ot.description || ''}"`
          });
        }
      }
    });

    // 2. Check Link Types
    const existingLinkTypeNames = new Map(state.linkTypes.map(lt => [lt.name.toLowerCase(), lt]));
    const resolvedLinkTypeIds = new Map<number, number>();

    (seed.linkTypes || []).forEach((lt: any) => {
      const match = existingLinkTypeNames.get(lt.name.toLowerCase());
      if (match) {
        resolvedLinkTypeIds.set(lt.id, match.id);
        if (match.description !== (lt.description || '')) {
          conflicts.push({
            type: 'linkType',
            name: lt.name,
            details: `描述冲突: 本地描述为 "${match.description}"，模式库中为 "${lt.description || ''}"`
          });
        }
      }
    });

    // 3. Check Objects
    const existingObjects = new Map(state.objects.map(o => [`${o.name.toLowerCase()}_${o.object_type_id}`, o]));
    const resolvedObjectIds = new Map<number, number>();

    (seed.objects || []).forEach((o: any) => {
      const resolvedTypeId = resolvedObjTypeIds.get(o.object_type_id) ?? o.object_type_id;
      const match = existingObjects.get(`${o.name.toLowerCase()}_${resolvedTypeId}`);
      if (match) {
        resolvedObjectIds.set(o.id, match.id);
        const incomingProps = typeof o.properties === 'string' ? o.properties : JSON.stringify(o.properties || {});
        const matchProps = typeof match.properties === 'string' ? match.properties : JSON.stringify(match.properties || {});
        
        let propsDiff = false;
        try {
          const p1 = JSON.parse(incomingProps);
          const p2 = JSON.parse(matchProps);
          propsDiff = JSON.stringify(p1) !== JSON.stringify(p2);
        } catch {
          propsDiff = incomingProps !== matchProps;
        }

        if (propsDiff || match.annotations !== (o.annotations || '')) {
          conflicts.push({
            type: 'object',
            name: o.name,
            details: `属性/注解冲突: 数据配置存在差异`
          });
        }
      }
    });

    return {
      conflicts,
      hasConflicts: conflicts.length > 0
    };
  }, [state.objectTypes, state.linkTypes, state.objects]);

  const mergeOntologyTemplate = useCallback(async (templateId: string, conflictResolution: 'overwrite' | 'skip', schemaOnly: boolean = false) => {
    const seed = ONTOLOGY_SEEDS[templateId];
    if (!seed) return;

    dispatchAction({ type: 'SET_INITTING', value: true });
    try {
      await duckDBService.ontologyInit();
      const sqlParts: string[] = [];
      const esc = (val: any) => (val ? String(val).replace(/'/g, "''") : '');

      let nextTypeId = state.objectTypes.length > 0 ? Math.max(...state.objectTypes.map(ot => ot.id)) + 1 : 1;
      let nextLinkId = state.links.length > 0 ? Math.max(...state.links.map(l => l.id)) + 1 : 1;
      let nextLinkTypeId = state.linkTypes.length > 0 ? Math.max(...state.linkTypes.map(lt => lt.id)) + 1 : 1;
      let nextObjectId = state.objects.length > 0 ? Math.max(...state.objects.map(o => o.id)) + 1 : 1;
      let nextActionId = state.actions.length > 0 ? Math.max(...state.actions.map(a => a.id)) + 1 : 1;
      let nextIntroId = state.introspections.length > 0 ? Math.max(...state.introspections.map(i => i.id)) : 0;
      let nextInsightId = state.insights.length > 0 ? Math.max(...state.insights.map(i => i.id)) : 0;

      // 1. Process Object Types
      const existingObjTypeNames = new Map(state.objectTypes.map(ot => [ot.name.toLowerCase(), ot]));
      const resolvedObjTypeIds = new Map<number, number>();

      for (const ot of seed.objectTypes || []) {
        const match = existingObjTypeNames.get(ot.name.toLowerCase());
        if (match) {
          resolvedObjTypeIds.set(ot.id, match.id);
          if (conflictResolution === 'overwrite' && match.description !== (ot.description || '')) {
            sqlParts.push(`UPDATE ${state.mapping.objectTypeTable} SET description='${esc(ot.description)}' WHERE id=${match.id}`);
          }
        } else {
          const newId = nextTypeId++;
          resolvedObjTypeIds.set(ot.id, newId);
          sqlParts.push(`INSERT INTO ${state.mapping.objectTypeTable} (id, name, description) VALUES (${newId}, '${esc(ot.name)}', '${esc(ot.description)}') ON CONFLICT (id) DO NOTHING`);
        }
      }

      // 2. Process Link Types
      const existingLinkTypeNames = new Map(state.linkTypes.map(lt => [lt.name.toLowerCase(), lt]));
      const resolvedLinkTypeIds = new Map<number, number>();

      for (const lt of seed.linkTypes || []) {
        const match = existingLinkTypeNames.get(lt.name.toLowerCase());
        if (match) {
          resolvedLinkTypeIds.set(lt.id, match.id);
          if (conflictResolution === 'overwrite' && match.description !== (lt.description || '')) {
            sqlParts.push(`UPDATE ${state.mapping.linkTypeTable} SET description='${esc(lt.description)}' WHERE id=${match.id}`);
          }
        } else {
          const newId = nextLinkTypeId++;
          resolvedLinkTypeIds.set(lt.id, newId);
          sqlParts.push(`INSERT INTO ${state.mapping.linkTypeTable} (id, name, description) VALUES (${newId}, '${esc(lt.name)}', '${esc(lt.description)}') ON CONFLICT (id) DO NOTHING`);
        }
      }

      // 3. Process Objects
      const existingObjects = new Map(state.objects.map(o => [`${o.name.toLowerCase()}_${o.object_type_id}`, o]));
      const resolvedObjectIds = new Map<number, number>();

      for (const o of seed.objects || []) {
        const resolvedTypeId = resolvedObjTypeIds.get(o.object_type_id) ?? o.object_type_id;
        const match = existingObjects.get(`${o.name.toLowerCase()}_${resolvedTypeId}`);
        
        const propsStr = typeof o.properties === 'string' ? o.properties : JSON.stringify(o.properties || {});
        if (match) {
          resolvedObjectIds.set(o.id, match.id);
          if (conflictResolution === 'overwrite' && !schemaOnly) {
            sqlParts.push(`UPDATE ${state.mapping.objectTable} SET properties='${esc(propsStr)}', annotations='${esc(o.annotations)}' WHERE id=${match.id}`);
          }
        } else {
          const newId = nextObjectId++;
          resolvedObjectIds.set(o.id, newId);
          if (!schemaOnly) {
            sqlParts.push(`INSERT INTO ${state.mapping.objectTable} (id, object_type_id, name, properties, annotations) VALUES (${newId}, ${resolvedTypeId}, '${esc(o.name)}', '${esc(propsStr)}', '${esc(o.annotations)}') ON CONFLICT (id) DO NOTHING`);
          }
        }
      }

      if (!schemaOnly) {
        // 4. Process Links
        const existingLinks = new Map(state.links.map(l => [`${l.link_type_id}_${l.source_object_id}_${l.target_object_id}`, l]));

        for (const l of seed.links || []) {
          const resolvedLinkTypeId = resolvedLinkTypeIds.get(l.link_type_id) ?? l.link_type_id;
          const resolvedSrcId = resolvedObjectIds.get(l.source_object_id);
          const resolvedTgtId = resolvedObjectIds.get(l.target_object_id);

          if (!resolvedSrcId || !resolvedTgtId) continue;

          const key = `${resolvedLinkTypeId}_${resolvedSrcId}_${resolvedTgtId}`;
          const match = existingLinks.get(key);

          if (match) {
            if (conflictResolution === 'overwrite' && match.weight !== (l.weight ?? 1.0)) {
              sqlParts.push(`UPDATE ${state.mapping.linkTable} SET weight=${l.weight ?? 1.0} WHERE id=${match.id}`);
            }
          } else {
            const newId = nextLinkId++;
            sqlParts.push(`INSERT INTO ${state.mapping.linkTable} (id, link_type_id, source_object_id, target_object_id, weight) VALUES (${newId}, ${resolvedLinkTypeId}, ${resolvedSrcId}, ${resolvedTgtId}, ${l.weight ?? 1.0}) ON CONFLICT (id) DO NOTHING`);
          }
        }

        // 5. Process Actions
        const existingActions = new Map(state.actions.map(a => [`${a.name.toLowerCase()}_${a.object_id}`, a]));

        for (const a of seed.actions || []) {
          const resolvedObjId = resolvedObjectIds.get(a.object_id) ?? a.object_id;
          const key = `${a.name.toLowerCase()}_${resolvedObjId}`;
          const match = existingActions.get(key);

          if (match) {
            if (conflictResolution === 'overwrite') {
              sqlParts.push(`UPDATE ${state.mapping.actionTable} SET description='${esc(a.description)}', status='${esc(a.status || 'pending')}' WHERE id=${match.id}`);
            }
          } else {
            const newId = nextActionId++;
            const execAt = a.execute_at ? `'${a.execute_at}'` : 'NULL';
            sqlParts.push(`INSERT INTO ${state.mapping.actionTable} (id, object_id, name, description, status, execute_at) VALUES (${newId}, ${resolvedObjId}, '${esc(a.name)}', '${esc(a.description)}', '${esc(a.status || 'pending')}', ${execAt}) ON CONFLICT (id) DO NOTHING`);
          }
        }

        // 6. Process Introspections
        for (const intro of seed.introspections || []) {
          const resolvedObjId = resolvedObjectIds.get(intro.object_id);
          if (!resolvedObjId) continue;
          const newId = ++nextIntroId;
          const crAt = intro.created_at ? `'${intro.created_at}'` : 'CURRENT_DATE';
          sqlParts.push(`INSERT INTO ${state.mapping.introspectionTable} (id, object_id, question, answer, created_at) VALUES (${newId}, ${resolvedObjId}, '${esc(intro.question)}', '${esc(intro.answer)}', ${crAt}) ON CONFLICT (id) DO NOTHING`);
        }

        // 7. Process Insights
        for (const ins of seed.insights || []) {
          const resolvedObjId = resolvedObjectIds.get(ins.object_id);
          if (!resolvedObjId) continue;
          const newId = ++nextInsightId;
          const crAt = ins.created_at ? `'${ins.created_at}'` : 'CURRENT_DATE';
          sqlParts.push(`INSERT INTO ${state.mapping.insightTable} (id, object_id, insight, tag, created_at) VALUES (${newId}, ${resolvedObjId}, '${esc(ins.insight)}', '${esc(ins.tag)}', ${crAt}) ON CONFLICT (id) DO NOTHING`);
        }
      }

      console.log(`[DuckDB] mergeOntologyTemplate: executing ${sqlParts.length} merge statements (schemaOnly=${schemaOnly})`);
      for (const stmt of sqlParts) {
        if (stmt.trim()) {
          await duckDBService.query(stmt);
        }
      }
      
      window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
      await loadData();

    } catch (e: any) {
      console.error('Merge ontology template failed:', e);
      dispatchAction({ type: 'SET_ERROR', error: e.message });
    } finally {
      dispatchAction({ type: 'SET_INITTING', value: false });
    }
  }, [state, loadData]);

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
    switchTemplate,
    checkTemplateMergeConflicts,
    mergeOntologyTemplate,
    activeTemplateId: state.activeTemplateId,
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
    createIntrospection,
    updateIntrospection,
    deleteIntrospection,
    createInsight,
    updateInsight,
    deleteInsight,
    addIntrospection: createIntrospection,
    addInsight: createInsight,

    // Canvas helpers
    pendingCommand: state.pendingCommand,
    setPendingCommand: (command: OntologyCommand | null) => dispatch({ type: 'SET_PENDING_COMMAND', command }),
    canvasSnapshots: state.canvasSnapshots,
    canvasActiveLayer: state.canvasActiveLayer,
    canvasAiFillLoading: state.canvasAiFillLoading,
    setCanvasLayer: (layer: MECELayer) => dispatch({ type: 'SET_CANVAS_LAYER', layer }),
    setCanvasAiFillLoading: (value: boolean) => dispatch({ type: 'SET_CANVAS_AI_FILL_LOADING', value }),
    pushCanvasSnapshot: (snapshot: CanvasSnapshot) => dispatch({ type: 'PUSH_CANVAS_SNAPSHOT', snapshot }),
    popCanvasSnapshot: () => dispatch({ type: 'POP_CANVAS_SNAPSHOT' }),
    canvasPositions: state.canvasPositions,
    canvasLockedNodeIds: state.canvasLockedNodeIds,
    updateCanvasPosition: useCallback(async (nodeId: number, x: number, y: number) => {
      const nextPositions = { ...stateRef.current.canvasPositions, [nodeId]: { x, y } };
      dispatch({ type: 'SET_CANVAS_POSITIONS', positions: nextPositions });
      queuePositionsForDb({ [nodeId]: { x, y } });
    }, [queuePositionsForDb]),
    updateCanvasPositions: useCallback(async (positions: SavedPositions) => {
      const nextPositions = { ...stateRef.current.canvasPositions, ...positions };
      dispatch({ type: 'SET_CANVAS_POSITIONS', positions: nextPositions });
      queuePositionsForDb(positions);
    }, [queuePositionsForDb]),
    toggleLockNode: useCallback(async (nodeId: number) => {
      const nextLocked = new Set(stateRef.current.canvasLockedNodeIds);
      if (nextLocked.has(nodeId)) {
        nextLocked.delete(nodeId);
      } else {
        nextLocked.add(nodeId);
      }
      dispatch({ type: 'SET_CANVAS_LOCKED_NODES', lockedNodeIds: nextLocked });
      
      const pos = stateRef.current.canvasPositions[nodeId];
      if (pos) {
        try {
          await duckDBService.saveOntologyCanvasState(
            `object_${nodeId}`,
            null,
            nodeId,
            `object_${nodeId}`,
            '',
            pos.x,
            pos.y,
            0,
            0,
            'object',
            { is_locked: nextLocked.has(nodeId) }
          );
        } catch (err) {
          console.error('Failed to save lock state to DuckDB', err);
        }
      }
    }, []),
    lockAllNodes: useCallback(async () => {
      const allIds = new Set<number>(stateRef.current.objects.map((o: any) => o.id));
      dispatch({ type: 'SET_CANVAS_LOCKED_NODES', lockedNodeIds: allIds });
      
      try {
        for (const o of stateRef.current.objects) {
          const pos = stateRef.current.canvasPositions[o.id] || { x: 100, y: 100 };
          await duckDBService.saveOntologyCanvasState(
            `object_${o.id}`,
            null,
            o.id,
            `object_${o.id}`,
            '',
            pos.x,
            pos.y,
            0,
            0,
            'object',
            { is_locked: true }
          );
        }
      } catch (err) {
        console.error('Failed to lock all nodes in DuckDB', err);
      }
    }, []),
    unlockAllNodes: useCallback(async () => {
      const empty = new Set<number>();
      dispatch({ type: 'SET_CANVAS_LOCKED_NODES', lockedNodeIds: empty });
      
      try {
        for (const o of stateRef.current.objects) {
          const pos = stateRef.current.canvasPositions[o.id] || { x: 100, y: 100 };
          await duckDBService.saveOntologyCanvasState(
            `object_${o.id}`,
            null,
            o.id,
            `object_${o.id}`,
            '',
            pos.x,
            pos.y,
            0,
            0,
            'object',
            { is_locked: false }
          );
        }
      } catch (err) {
        console.error('Failed to unlock all nodes in DuckDB', err);
      }
    }, []),

    // Patterns
    patterns: state.patterns,
    patternsLoading: state.patternsLoading,
    saveOntologyPattern: useCallback(async (pattern: any) => {
      await duckDBService.saveOntologyPattern(pattern);
      await loadData();
    }, [loadData]),
    deleteOntologyPattern: useCallback(async (id: string) => {
      await duckDBService.deleteOntologyPattern(id);
      await loadData();
    }, [loadData]),
  };
}

// Context creation for shared store state
import { createContext, useContext } from 'react';

const OntologyStoreContext = createContext<ReturnType<typeof useOntologyStoreInternal> | null>(null);

export function OntologyStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useOntologyStoreInternal();
  return React.createElement(OntologyStoreContext.Provider, { value: store }, children);
}

export function useOntologyStore() {
  const ctx = useContext(OntologyStoreContext);
  if (!ctx) {
    // Return mock / independent store state if not wrapped (for testing or backwards compatibility)
    return useOntologyStoreInternal();
  }
  return ctx;
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
  setPendingCommand: (command: OntologyCommand | null): OntologyAction => ({ type: 'SET_PENDING_COMMAND', command }),
  setActiveTemplate: (templateId: string): OntologyAction => ({ type: 'SET_ACTIVE_TEMPLATE', templateId }),
  setCanvasLayer: (layer: MECELayer): OntologyAction => ({ type: 'SET_CANVAS_LAYER', layer }),
  setCanvasAiFillLoading: (value: boolean): OntologyAction => ({ type: 'SET_CANVAS_AI_FILL_LOADING', value }),
  pushCanvasSnapshot: (snapshot: CanvasSnapshot): OntologyAction => ({ type: 'PUSH_CANVAS_SNAPSHOT', snapshot }),
  popCanvasSnapshot: (): OntologyAction => ({ type: 'POP_CANVAS_SNAPSHOT' }),
  setPatterns: (patterns: any[]): OntologyAction => ({ type: 'SET_PATTERNS', patterns }),
};
