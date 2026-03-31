/**
 * OntologyMECEPanel - 本体论 MECE 五层导航面板
 *
 * 左侧 Tab = MECE 五层 + 图谱，每层内按语义（类型/实例/模板）组织
 *
 * MECE 五层：
 * 1. 基础层 — Object/Link Type 定义 + 五表建表 SQL
 * 2. 关系层 — Link 实例管理 + 权重调整
 * 3. 方法层 — 反思流程 + 数据清理
 * 4. 模式层 — 递归追溯 + 视图封装
 * 5. 领域层 — 预设场景 + 种子数据导入
 * 6. 图谱   — ReactFlow 交互图谱
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X, Network, Database, Zap, Eye, TrendingUp, Layers, Table2,
  Sparkles, Info, ChevronRight, ChevronDown, ArrowRight,
  Plus, RefreshCw, Check, Search, AlertTriangle, RotateCcw,
  Trash2, Edit3, Link2, Lightbulb, Copy, Play,
  BookOpen, Target, Star, Clock, Loader2,
  ArrowDownRight, Loader, Brain,
  LayoutGrid,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from '../Learn/ResultTable';
import D3GraphView from './D3GraphView';
import OntologyCanvas from './OntologyCanvas';
import OntologyInsightsPanel from './OntologyInsightsPanel';
import {
  ONTOLOGY_CREATE_TABLES,
  ONTOLOGY_SEED_DATA,
} from './ontologyDataModel';
import { ontologyAiService, OntologyDraftPayload } from '../../services/ontologyAiService';

// ============================================================
// Types
// ============================================================

export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains' | 'graph' | 'canvas';

export type SemanticCategory = 'type' | 'instance' | 'template';

interface MECETabConfig {
  id: MECELayer;
  label: string;
  icon: React.ElementType;
  color: string;       // monokai color name
  meceColor: string;   // bg/border/text color
  description: string;
  semanticCategories: SemanticCategory[];
  templateCount: number;
}

// ============================================================
// MECE Tab Config
// ============================================================

const MECETABS: MECETabConfig[] = [
  {
    id: 'foundation',
    label: '基础层',
    icon: Database,
    color: 'purple',
    meceColor: 'monokai-purple',
    description: '核心概念定义 — Object Type / Link Type 的结构与约束',
    semanticCategories: ['type', 'instance', 'template'],
    templateCount: 5,
  },
  {
    id: 'relations',
    label: '关系层',
    icon: Link2,
    color: 'green',
    meceColor: 'monokai-green',
    description: '关系实例建模 — Link 实例 CRUD + 权重调整',
    semanticCategories: ['type', 'instance', 'template'],
    templateCount: 7,
  },
  {
    id: 'methodology',
    label: '方法层',
    icon: Layers,
    color: 'cyan',
    meceColor: 'monokai-cyan',
    description: '建模方法论 — 反思流程、数据清理、导出导入',
    semanticCategories: ['type', 'instance', 'template'],
    templateCount: 4,
  },
  {
    id: 'patterns',
    label: '模式层',
    icon: TrendingUp,
    color: 'yellow',
    meceColor: 'monokai-yellow',
    description: '核心模式层 — 递归追溯、视图封装、聚合分析',
    semanticCategories: ['type', 'instance', 'template'],
    templateCount: 6,
  },
  {
    id: 'domains',
    label: '领域层',
    icon: BookOpen,
    color: 'blue',
    meceColor: 'monokai-blue',
    description: '垂直领域层 — "我的人生"预设场景 + 种子数据导入',
    semanticCategories: ['type', 'instance', 'template'],
    templateCount: 2,
  },
  {
    id: 'graph',
    label: '图谱',
    icon: Network,
    color: 'pink',
    meceColor: 'monokai-pink',
    description: '交互式图谱 — ReactFlow 可视化对象关系网络',
    semanticCategories: [],
    templateCount: 0,
  },
  {
    id: 'canvas',
    label: '画布',
    icon: LayoutGrid,
    color: 'orange',
    meceColor: 'monokai-orange',
    description: '自由画布 — 拖拽组织空间布局，直观整理本体结构',
    semanticCategories: [],
    templateCount: 0,
  },
];

// ============================================================
// SQL Templates (organized by MECE layer)
// ============================================================

interface SqlTemplate {
  id: string;
  label: string;
  description: string;
  sql: string;
  refreshTables?: boolean;
}

const FOUNDATION_TEMPLATES: SqlTemplate[] = [
  {
    id: 'create-object-type',
    label: '创建对象类型表',
    description: 'id、name、description 三列',
    sql: `CREATE TABLE life_object_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
    refreshTables: true,
  },
  {
    id: 'create-object',
    label: '创建对象实例表',
    description: 'object_type_id 指向类型表，properties 用 JSON 存储灵活属性',
    sql: `CREATE TABLE life_object (
    id             INTEGER PRIMARY KEY,
    object_type_id INTEGER REFERENCES life_object_type(id),
    name           VARCHAR NOT NULL,
    properties     JSON    DEFAULT '{}',
    annotations    VARCHAR DEFAULT ''
);`,
    refreshTables: true,
  },
  {
    id: 'create-link-type',
    label: '创建关系类型表',
    description: '和对象类型表结构相同，但语义不同',
    sql: `CREATE TABLE life_link_type (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR
);`,
    refreshTables: true,
  },
  {
    id: 'create-link',
    label: '创建关系实例表',
    description: '三个外键 + weight 表示关系强度 0.0~1.0',
    sql: `CREATE TABLE life_link (
    id               INTEGER PRIMARY KEY,
    link_type_id     INTEGER REFERENCES life_link_type(id),
    source_object_id INTEGER REFERENCES life_object(id),
    target_object_id INTEGER REFERENCES life_object(id),
    weight           DECIMAL(3,2) DEFAULT 1.0
);`,
    refreshTables: true,
  },
  {
    id: 'create-action',
    label: '创建行动表',
    description: 'status 控制状态机：pending→in_progress→executed',
    sql: `CREATE TABLE life_action (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    status      VARCHAR DEFAULT 'pending',
    execute_at  DATE
);`,
    refreshTables: true,
  },
];

const RELATIONS_TEMPLATES: SqlTemplate[] = [
  {
    id: 'insert-object-type',
    label: '插入对象类型',
    description: '三个预设类型',
    sql: `INSERT INTO life_object_type VALUES
    (1, 'Aspect', '生活维度'),
    (2, 'Person', '人物'),
    (3, 'Goal',   '目标');`,
  },
  {
    id: 'insert-object',
    label: '插入对象实例',
    description: '四个核心对象',
    sql: `INSERT INTO life_object (id, object_type_id, name, properties) VALUES
    (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'),
    (2, 1, '工作', '{"role": "工程师", "struggle": "沟通"}'),
    (3, 1, '家庭', '{"priority": "最高"}'),
    (4, 1, '身体', '{"state": "还行", "goal": "健康"}');`,
  },
  {
    id: 'insert-link-type',
    label: '插入关系类型',
    description: '四种核心关系',
    sql: `INSERT INTO life_link_type VALUES
    (1, '影响', 'A 作用于 B，强度可量化'),
    (2, '养活', 'A 为 B 提供物质基础'),
    (3, '锚定', 'A 为 B 提供精神支撑'),
    (4, '支撑', 'A 为 B 提供基础条件');`,
  },
  {
    id: 'insert-link',
    label: '插入关系实例',
    description: '心态→影响→工作(0.9)，工作→养活→家庭(1.0)，家庭→锚定→心态(0.8)，身体→支撑→心态(0.7)',
    sql: `INSERT INTO life_link VALUES
    (1, 1, 1, 2, 0.9),
    (2, 2, 2, 3, 1.0),
    (3, 3, 3, 1, 0.8),
    (4, 4, 4, 1, 0.7);`,
  },
  {
    id: 'insert-action',
    label: '插入预设行动',
    description: '两个预设行动',
    sql: `INSERT INTO life_action VALUES
    (1, '深呼吸', '就这一刻。其他的都不重要。', 'pending', NULL),
    (2, '迈出下一步', '低头看路。路已经在脚下了。', 'pending', NULL);`,
  },
  {
    id: 'update-weight',
    label: '调整关系权重（反思后）',
    description: '权重不是一成不变的，定期反思后可以调整',
    sql: `UPDATE life_link
SET weight = 0.6
WHERE source_object_id = (SELECT id FROM life_object WHERE name = '心态')
  AND target_object_id = (SELECT id FROM life_object WHERE name = '工作');`,
  },
  {
    id: 'mark-action-done',
    label: '标记行动已执行',
    description: '执行完一个行动后更新状态',
    sql: `UPDATE life_action
SET status = 'executed', execute_at = CURRENT_DATE
WHERE name = '深呼吸';`,
  },
];

const METHODOLOGY_TEMPLATES: SqlTemplate[] = [
  {
    id: 'introspect-flow',
    label: '反思流程：关系 → 行动',
    description: '将关系转化为行动建议',
    sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系,
    ll.weight,
    CASE
        WHEN ll.weight < 0.5 THEN '建议：重新评估关系价值'
        WHEN ll.weight < 0.7 THEN '建议：定期维护'
        ELSE '关系稳固，继续保持'
    END AS 行动建议
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id;`,
  },
  {
    id: 'ontology-overview',
    label: '本体论状态总览',
    description: '用 UNION ALL 统计各表行数',
    sql: `SELECT '对象类型' AS 指标, COUNT(*) AS 数值 FROM life_object_type
UNION ALL
SELECT '对象实例',         COUNT(*)        FROM life_object
UNION ALL
SELECT '关系类型',         COUNT(*)        FROM life_link_type
UNION ALL
SELECT '关系实例',         COUNT(*)        FROM life_link
UNION ALL
SELECT '待执行行动',       COUNT(*)        FROM life_action WHERE status = 'pending';`,
  },
  {
    id: 'truncate-all',
    label: '清空数据（保留表结构）',
    description: 'TRUNCATE 比 DELETE 快很多，适合重新初始化数据',
    sql: `TRUNCATE TABLE life_action;
TRUNCATE TABLE life_link;
TRUNCATE TABLE life_object;
TRUNCATE TABLE life_link_type;`,
  },
  {
    id: 'drop-all-tables',
    label: '删除所有表（反向依赖顺序）',
    description: '先删子表，再删父表（外键约束顺序）',
    sql: `DROP TABLE IF EXISTS life_action;
DROP TABLE IF EXISTS life_link;
DROP TABLE IF EXISTS life_object;
DROP TABLE IF EXISTS life_link_type;
DROP TABLE IF EXISTS life_object_type;
DROP VIEW IF EXISTS v_relation_network;`,
    refreshTables: true,
  },
];

const PATTERNS_TEMPLATES: SqlTemplate[] = [
  {
    id: 'cte-weighted-links',
    label: 'CTE：带权重的完整关系视图',
    description: '封装关系 JOIN + CASE 分级，后续可直接 SELECT * FROM relation_view',
    sql: `WITH relation_view AS (
    SELECT
        src.name  AS source,
        lt.name   AS relation,
        tgt.name  AS target,
        ll.weight AS weight,
        CASE
            WHEN ll.weight >= 0.9 THEN '核心'
            WHEN ll.weight >= 0.7 THEN '重要'
            ELSE '一般'
        END AS importance
    FROM life_link ll
    JOIN life_link_type lt ON ll.link_type_id  = lt.id
    JOIN life_object  src ON ll.source_object_id = src.id
    JOIN life_object  tgt ON ll.target_object_id = tgt.id
)
SELECT * FROM relation_view ORDER BY weight DESC;`,
  },
  {
    id: 'recursive-impact',
    label: '递归追溯：从 A 出发的所有影响路径',
    description: '递归 CTE 追溯影响链，depth 限制防止无限递归',
    sql: `WITH RECURSIVE impact_chain AS (
    SELECT
        source_object_id AS start_id,
        target_object_id AS current_id,
        CAST(src.name || ' -> ' || tgt.name AS VARCHAR) AS path,
        1 AS depth
    FROM life_link ll
    JOIN life_object src ON ll.source_object_id = src.id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE src.name = '心态'

    UNION ALL

    SELECT
        ic.start_id,
        ll.target_object_id,
        ic.path || ' -> ' || tgt.name,
        ic.depth + 1
    FROM impact_chain ic
    JOIN life_link ll ON ll.source_object_id = ic.current_id
    JOIN life_object tgt ON ll.target_object_id = tgt.id
    WHERE ic.depth < 10
      AND ic.path NOT LIKE '%' || tgt.name || '%'
)
SELECT * FROM impact_chain ORDER BY depth, weight DESC;`,
  },
  {
    id: 'create-view-network',
    label: '创建视图：关系网络',
    description: '视图将三表 JOIN 固化，之后直接 SELECT * FROM v_relation_network',
    sql: `CREATE OR REPLACE VIEW v_relation_network AS
SELECT
    src.name  AS source_object,
    lt.name   AS relation_type,
    tgt.name  AS target_object,
    ll.weight AS relation_weight
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id  = lt.id
JOIN life_object  src ON ll.source_object_id = src.id
JOIN life_object  tgt ON ll.target_object_id = tgt.id;`,
    refreshTables: true,
  },
  {
    id: 'use-view',
    label: '使用视图查询',
    description: '基于视图做二次过滤',
    sql: `SELECT * FROM v_relation_network
WHERE relation_weight > 0.7
ORDER BY relation_weight DESC;`,
  },
  {
    id: 'aggregation-link-stats',
    label: '每种关系的数量和平均强度',
    description: '了解哪种关系类型使用最频繁',
    sql: `SELECT
    lt.name           AS 关系类型,
    COUNT(ll.id)      AS 实例数,
    AVG(ll.weight)    AS 平均强度,
    MAX(ll.weight)    AS 最强,
    MIN(ll.weight)    AS 最弱
FROM life_link_type lt
LEFT JOIN life_link ll ON lt.id = ll.link_type_id
GROUP BY lt.id, lt.name
ORDER BY 实例数 DESC;`,
  },
  {
    id: 'top-links',
    label: '最核心的关系（Top 3）',
    description: '找出权重最高的三条关系',
    sql: `SELECT
    src.name || ' --(' || lt.name || ')--> ' || tgt.name AS 关系链,
    ll.weight AS 强度
FROM life_link ll
JOIN life_link_type lt ON ll.link_type_id = lt.id
JOIN life_object src ON ll.source_object_id = src.id
JOIN life_object tgt ON ll.target_object_id = tgt.id
ORDER BY ll.weight DESC
LIMIT 3;`,
  },
];

const DOMAINS_TEMPLATES: SqlTemplate[] = [
  {
    id: 'create-all-tables',
    label: '一键创建五表',
    description: '一次性创建全部五张核心表',
    sql: ONTOLOGY_CREATE_TABLES,
    refreshTables: true,
  },
  {
    id: 'seed-all-data',
    label: '一键导入种子数据',
    description: '插入预设的类型、对象、关系、行动数据',
    sql: ONTOLOGY_SEED_DATA,
    refreshTables: true,
  },
  {
    id: 'init-full',
    label: '完整初始化（建表 + 数据）',
    description: '一次性执行建表和种子数据',
    sql: `${ONTOLOGY_CREATE_TABLES}

${ONTOLOGY_SEED_DATA}`,
    refreshTables: true,
  },
];

const LAYER_TEMPLATES: Record<MECELayer, SqlTemplate[]> = {
  foundation: FOUNDATION_TEMPLATES,
  relations: RELATIONS_TEMPLATES,
  methodology: METHODOLOGY_TEMPLATES,
  patterns: PATTERNS_TEMPLATES,
  domains: DOMAINS_TEMPLATES,
  graph: [],
  canvas: [],
};

// ============================================================
// Semantic Sub-Nav
// ============================================================

const SEMANTIC_LABELS: Record<SemanticCategory, { label: string; icon: React.ElementType; desc: string }> = {
  type: { label: '类型', icon: Layers, desc: 'Type 定义 CRUD' },
  instance: { label: '实例', icon: Database, desc: 'Instance 数据管理' },
  template: { label: '模板', icon: Sparkles, desc: 'SQL 代码模板' },
};

// ============================================================
// CRUD Data Types (shared by instance panels)
// ============================================================

type LifeObjectType = { id: number; name: string; description: string };
type LifeObject = { id: number; object_type_id: number; name: string; properties: string };
type LifeLinkType = { id: number; name: string; description: string };
type LifeLink = { id: number; link_type_id: number; source_object_id: number; target_object_id: number; weight: number };
type LifeAction = { id: number; name: string; description: string; status: string; execute_at: string | null };

// ============================================================
// Helper Components
// ============================================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-monokai-orange/[0.1]', text: 'text-monokai-orange', label: '待执行' },
    done: { bg: 'bg-monokai-green/[0.1]', text: 'text-monokai-green', label: '已完成' },
  };
  const c = config[status] || config.pending;
  return <span className={`px-2 py-0.5 text-[10px] rounded-lg ${c.bg} ${c.text} font-semibold`}>{c.label}</span>;
};

const ConfirmDialog: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void }> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
    <div className="w-full max-w-sm bg-[#090a0f] border border-white/[0.08] rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)] p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-monokai-orange/[0.1] flex items-center justify-center border border-monokai-orange/30">
          <AlertTriangle className="w-5 h-5 text-monokai-orange" />
        </div>
        <h3 className="text-[14px] font-bold text-white">{title}</h3>
      </div>
      <p className="text-[13px] text-white/50 mb-6 leading-relaxed">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-[12px] text-white/40 hover:text-white/70 rounded-xl hover:bg-white/[0.06] transition-all">取消</button>
        <button onClick={onConfirm} className="px-4 py-2 text-[12px] bg-monokai-orange/[0.12] text-monokai-orange rounded-xl border border-monokai-orange/40 hover:bg-monokai-orange/[0.2] transition-all font-semibold">确认删除</button>
      </div>
    </div>
  </div>
);

// ============================================================
// CRUD Instance Panel (replaces the embedded OntologyEditorPanel,
// but scoped to current layer's entity type)
// ============================================================

interface CRUDPanelProps {
  layer: MECELayer;
  onInsert?: (sql: string) => void;
}

interface FormState {
  name: string;
  desc: string;
  objectTypeId: number;
  properties: string;
  linkTypeId: number;
  sourceId: number | null;
  targetId: number | null;
  weight: number;
  status: string;
  executeAt: string;
}

const CRUDPanel: React.FC<CRUDPanelProps> = ({ layer, onInsert }) => {
  const [objectTypes, setObjectTypes] = useState<LifeObjectType[]>([]);
  const [objects, setObjects] = useState<LifeObject[]>([]);
  const [linkTypes, setLinkTypes] = useState<LifeLinkType[]>([]);
  const [links, setLinks] = useState<LifeLink[]>([]);
  const [actions, setActions] = useState<LifeAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const [needsSeedData, setNeedsSeedData] = useState(false);
  const [initting, setInitting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; label: string } | null>(null);

  type EditMode = 'none' | 'objectType' | 'object' | 'linkType' | 'link' | 'action';
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState<FormState>({
    name: '', desc: '', objectTypeId: 1, properties: '',
    linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5,
    status: 'pending', executeAt: '',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // 防重复调用标志
  const initInProgressRef = React.useRef(false);

  /**
   * 自动初始化：检测表是否存在 → 自动创建缺失的表 → 判断是否需要种子数据
   * 这是 mount 时唯一调用的入口，避免直接 loadData 产生大量 "table does not exist" 错误
   */
  const checkAndInit = useCallback(async () => {
    // 防止重复调用
    if (initInProgressRef.current) {
      console.log('[Ontology] Init in progress, skipping duplicate call');
      return;
    }
    initInProgressRef.current = true;

    setLoading(true);
    setError(null);

    try {
      // Step 1: 检测表是否存在
      const requiredTables = ['life_object_type', 'life_object', 'life_link_type', 'life_link', 'life_action', 'life_introspection', 'life_insight', 'life_canvas_state'];
      const missingTables: string[] = [];

      for (const table of requiredTables) {
        try {
          await duckDBService.query(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch {
          missingTables.push(table);
        }
      }

      // Step 2: 如果有缺失的表，使用 CREATE TABLE IF NOT EXISTS 自动建表
      if (missingTables.length > 0) {
        console.log(`[Ontology] Auto-creating missing tables: ${missingTables.join(', ')}`);
        
        // 直接使用 CREATE TABLE IF NOT EXISTS 语句建表
        const createStatements = [
          `CREATE TABLE IF NOT EXISTS life_object_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
          `CREATE TABLE IF NOT EXISTS life_object (id INTEGER PRIMARY KEY, object_type_id INTEGER REFERENCES life_object_type(id), name VARCHAR NOT NULL, properties JSON DEFAULT '{}', annotations VARCHAR DEFAULT '')`,
          `CREATE TABLE IF NOT EXISTS life_link_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
          `CREATE TABLE IF NOT EXISTS life_link (id INTEGER PRIMARY KEY, link_type_id INTEGER REFERENCES life_link_type(id), source_object_id INTEGER REFERENCES life_object(id), target_object_id INTEGER REFERENCES life_object(id), weight DECIMAL(3,2) DEFAULT 1.0)`,
          `CREATE TABLE IF NOT EXISTS life_action (id INTEGER PRIMARY KEY, object_id INTEGER, name VARCHAR NOT NULL, description VARCHAR, status VARCHAR DEFAULT 'pending', execute_at DATE)`,
          `CREATE TABLE IF NOT EXISTS life_introspection (id INTEGER PRIMARY KEY, object_id INTEGER, question VARCHAR, answer VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
          `CREATE TABLE IF NOT EXISTS life_insight (id INTEGER PRIMARY KEY, object_id INTEGER, insight VARCHAR, tag VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
          `CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL)`
        ];

        for (const sql of createStatements) {
          try {
            await duckDBService.query(sql);
          } catch (e: any) {
            console.warn('[Ontology] Table creation error:', e.message);
          }
        }

        // 建表完成后，需要种子数据
        setNeedsSeedData(true);
        setNeedsInit(false);
        setLoading(false);
        initInProgressRef.current = false;
        return;
      }

      // Step 3: 表都存在 → 检查是否有种子数据
      const result = await duckDBService.query('SELECT COUNT(*) as cnt FROM life_object_type');
      const rowCount = result?.[0]?.cnt ?? 0;
      if (Number(rowCount) === 0) {
        setNeedsSeedData(true);
        setNeedsInit(false);
      } else {
        setNeedsSeedData(false);
        setNeedsInit(false);
        // Step 4: 加载数据
        const [ots, objs, lts, lnks, acts] = await Promise.all([
          duckDBService.query('SELECT * FROM life_object_type ORDER BY id'),
          duckDBService.query('SELECT * FROM life_object ORDER BY id'),
          duckDBService.query('SELECT * FROM life_link_type ORDER BY id'),
          duckDBService.query('SELECT * FROM life_link ORDER BY id'),
          duckDBService.query('SELECT * FROM life_action ORDER BY id'),
        ]);
        setObjectTypes(ots as LifeObjectType[]);
        setObjects(objs as LifeObject[]);
        setLinkTypes(lts as LifeLinkType[]);
        setLinks(lnks as LifeLink[]);
        setActions(acts as LifeAction[]);
        // Auto-expand sections that have data
        setExpanded({
          objectTypes: (ots as LifeObjectType[]).length > 0,
          objects: (objs as LifeObject[]).length > 0,
          linkTypes: (lts as LifeLinkType[]).length > 0,
          links: (lnks as LifeLink[]).length > 0,
          actions: (acts as LifeAction[]).length > 0,
        });
      }
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('does not exist') || msg.includes('Catalog Error')) {
        setNeedsInit(true);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      initInProgressRef.current = false;
    }
  }, []);

  /** 导入种子数据 */
  const handleSeedData = async () => {
    setInitting(true);
    try {
      // Step 1: 确保表存在（使用 IF NOT EXISTS）
      const createStatements = [
        `CREATE TABLE IF NOT EXISTS life_object_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
        `CREATE TABLE IF NOT EXISTS life_object (id INTEGER PRIMARY KEY, object_type_id INTEGER, name VARCHAR NOT NULL, properties JSON DEFAULT '{}', annotations VARCHAR DEFAULT '')`,
        `CREATE TABLE IF NOT EXISTS life_link_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
        `CREATE TABLE IF NOT EXISTS life_link (id INTEGER PRIMARY KEY, link_type_id INTEGER, source_object_id INTEGER, target_object_id INTEGER, weight DECIMAL(3,2) DEFAULT 1.0)`,
        `CREATE TABLE IF NOT EXISTS life_action (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR, status VARCHAR DEFAULT 'pending', execute_at DATE)`,
        `CREATE TABLE IF NOT EXISTS life_introspection (id INTEGER PRIMARY KEY, object_id INTEGER, question VARCHAR, answer VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
        `CREATE TABLE IF NOT EXISTS life_insight (id INTEGER PRIMARY KEY, object_id INTEGER, insight VARCHAR, tag VARCHAR, created_at DATE DEFAULT CURRENT_DATE)`,
        `CREATE TABLE IF NOT EXISTS life_canvas_state (id VARCHAR PRIMARY KEY, space_id VARCHAR, object_id INTEGER, title VARCHAR, color VARCHAR, x DECIMAL, y DECIMAL, width DECIMAL, height DECIMAL)`
      ];

      for (const sql of createStatements) {
        try {
          await duckDBService.query(sql);
        } catch (e: any) {
          console.warn('[Ontology] Table creation error:', e.message);
        }
      }

      // Step 2: 导入种子数据
      const seedDataStatements = [
        `INSERT INTO life_object_type VALUES (1, 'Aspect', '生活维度'), (2, 'Person', '人物'), (3, 'Goal', '目标')`,
        `INSERT INTO life_object (id, object_type_id, name, properties) VALUES (1, 1, '心态', '{"state": "焦虑", "goal": "内心平静"}'), (2, 1, '工作', '{"role": "工程师", "struggle": "沟通与办公室政治"}'), (3, 1, '家庭', '{"priority": "最高"}'), (4, 1, '身体', '{"state": "还行", "goal": "健康"}')`,
        `INSERT INTO life_link_type VALUES (1, '影响', 'A 作用于 B'), (2, '养活', 'A 为 B 提供物质基础'), (3, '锚定', 'A 为 B 提供精神支撑'), (4, '支撑', 'A 为 B 提供基础条件')`,
        `INSERT INTO life_link VALUES (1, 1, 1, 2, 0.9), (2, 2, 2, 3, 1.0), (3, 3, 3, 1, 0.8), (4, 4, 4, 1, 0.7)`,
        `INSERT INTO life_action VALUES (1, 4, '早睡早起', '调整作息', 'pending', '2024-12-31')`,
        `INSERT INTO life_introspection VALUES (1, 1, '为什么最近总是焦虑？', '因为工作沟通不顺畅，把情绪带到了生活中。', CURRENT_DATE)`,
        `INSERT INTO life_insight VALUES (1, 2, '沟通是工程师最大的软技能壁垒', '职场真相', CURRENT_DATE)`,
        `INSERT INTO life_canvas_state VALUES ('space-1', 'space-1', NULL, '个人生活', '#a78bfa', 100, 100, 320, 350), ('item-1', 'space-1', 1, NULL, NULL, 20, 50, 280, 100), ('item-4', 'space-1', 4, NULL, NULL, 20, 180, 280, 100), ('space-2', 'space-2', NULL, '外部事务', '#38bdf8', 480, 100, 320, 350), ('item-2', 'space-2', 2, NULL, NULL, 20, 50, 280, 100), ('item-3', 'space-2', 3, NULL, NULL, 20, 180, 280, 100)`
      ];

      for (const sql of seedDataStatements) {
        try {
          await duckDBService.query(sql);
        } catch (e: any) {
          console.warn('[Ontology] Seed data error:', e.message);
        }
      }

      setNeedsSeedData(false);
      setNeedsInit(false);
      await checkAndInit();
    } catch (e: any) {
      setError(`导入种子数据失败: ${e.message}`);
    } finally {
      setInitting(false);
    }
  };

  // Only run on mount: empty deps [] is intentional here.
  // handleSeedData is called directly on click (fresh closure each time).
  useEffect(() => {
    checkAndInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const objectTypeMap = useMemo(() => { const m: Record<number, string> = {}; objectTypes.forEach(o => { m[o.id] = o.name; }); return m; }, [objectTypes]);
  const linkTypeMap = useMemo(() => { const m: Record<number, string> = {}; linkTypes.forEach(l => { m[l.id] = l.name; }); return m; }, [linkTypes]);
  const objectNameMap = useMemo(() => { const m: Record<number, string> = {}; objects.forEach(o => { m[o.id] = o.name; }); return m; }, [objects]);

  const filteredObjects = useMemo(() => {
    if (!search) return objects;
    const t = search.toLowerCase();
    return objects.filter(o => o.name.toLowerCase().includes(t) || objectTypeMap[o.object_type_id]?.toLowerCase().includes(t));
  }, [objects, search, objectTypeMap]);

  const filteredLinks = useMemo(() => {
    if (!search) return links;
    const t = search.toLowerCase();
    return links.filter(l =>
      (objectNameMap[l.source_object_id] || '').toLowerCase().includes(t) ||
      (objectNameMap[l.target_object_id] || '').toLowerCase().includes(t) ||
      (linkTypeMap[l.link_type_id] || '').toLowerCase().includes(t)
    );
  }, [links, search, objectNameMap, linkTypeMap]);

  const resetForm = () => setForm({ name: '', desc: '', objectTypeId: 1, properties: '', linkTypeId: 1, sourceId: null, targetId: null, weight: 0.5, status: 'pending', executeAt: '' });

  const openEdit = (mode: EditMode, target: any) => {
    setEditMode(mode); setEditTarget(target);
    if (mode === 'objectType') setForm(f => ({ ...f, name: target.name, desc: target.description || '' }));
    else if (mode === 'object') setForm(f => ({ ...f, name: target.name, objectTypeId: target.object_type_id, properties: target.properties || '' }));
    else if (mode === 'linkType') setForm(f => ({ ...f, name: target.name, desc: target.description || '' }));
    else if (mode === 'link') setForm(f => ({ ...f, linkTypeId: target.link_type_id, sourceId: target.source_object_id, targetId: target.target_object_id, weight: target.weight }));
    else if (mode === 'action') setForm(f => ({ ...f, name: target.name, desc: target.description || '', status: target.status || 'pending', executeAt: target.execute_at || '' }));
  };

  const openCreate = (mode: EditMode) => { setEditMode(mode); setEditTarget(null); resetForm(); };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('名称不能为空', 'error'); return; }
    try {
      if (editMode === 'objectType') {
        if (editTarget) await duckDBService.query(`UPDATE life_object_type SET name='${form.name}', description='${form.desc}' WHERE id=${editTarget.id}`);
        else { const maxId = objectTypes.length ? Math.max(...objectTypes.map(o => o.id)) : 0; await duckDBService.query(`INSERT INTO life_object_type VALUES (${maxId + 1}, '${form.name}', '${form.desc}')`); }
        showToast('已保存', 'success');
      } else if (editMode === 'object') {
        const props = form.properties.trim() || '{}';
        if (editTarget) await duckDBService.query(`UPDATE life_object SET object_type_id=${form.objectTypeId}, name='${form.name}', properties='${props}' WHERE id=${editTarget.id}`);
        else { const maxId = objects.length ? Math.max(...objects.map(o => o.id)) : 0; await duckDBService.query(`INSERT INTO life_object (id, object_type_id, name, properties) VALUES (${maxId + 1}, ${form.objectTypeId}, '${form.name}', '${props}')`); }
        showToast('已保存', 'success');
      } else if (editMode === 'linkType') {
        if (editTarget) await duckDBService.query(`UPDATE life_link_type SET name='${form.name}', description='${form.desc}' WHERE id=${editTarget.id}`);
        else { const maxId = linkTypes.length ? Math.max(...linkTypes.map(l => l.id)) : 0; await duckDBService.query(`INSERT INTO life_link_type VALUES (${maxId + 1}, '${form.name}', '${form.desc}')`); }
        showToast('已保存', 'success');
      } else if (editMode === 'link') {
        if (form.sourceId === null || form.targetId === null) { showToast('请选择源对象和目标对象', 'error'); return; }
        if (editTarget) await duckDBService.query(`UPDATE life_link SET link_type_id=${form.linkTypeId}, source_object_id=${form.sourceId}, target_object_id=${form.targetId}, weight=${form.weight} WHERE id=${editTarget.id}`);
        else { const maxId = links.length ? Math.max(...links.map(l => l.id)) : 0; await duckDBService.query(`INSERT INTO life_link VALUES (${maxId + 1}, ${form.linkTypeId}, ${form.sourceId}, ${form.targetId}, ${form.weight})`); }
        showToast('已保存', 'success');
      } else if (editMode === 'action') {
        const execDate = form.executeAt ? `'${form.executeAt}'` : 'NULL';
        if (editTarget) await duckDBService.query(`UPDATE life_action SET name='${form.name}', description='${form.desc}', status='${form.status}', execute_at=${execDate} WHERE id=${editTarget.id}`);
        else { const maxId = actions.length ? Math.max(...actions.map(a => a.id)) : 0; await duckDBService.query(`INSERT INTO life_action VALUES (${maxId + 1}, '${form.name}', '${form.desc}', '${form.status}', ${execDate})`); }
        showToast('已保存', 'success');
      }
      setEditMode('none'); setEditTarget(null);
      await checkAndInit();
    } catch (e: any) { showToast(`操作失败: ${e.message}`, 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'objectType') await duckDBService.query(`DELETE FROM life_object_type WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'object') await duckDBService.query(`DELETE FROM life_object WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'linkType') await duckDBService.query(`DELETE FROM life_link_type WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'link') await duckDBService.query(`DELETE FROM life_link WHERE id=${deleteConfirm.id}`);
      else if (deleteConfirm.type === 'action') await duckDBService.query(`DELETE FROM life_action WHERE id=${deleteConfirm.id}`);
      showToast('已删除', 'success');
      setDeleteConfirm(null);
      await checkAndInit();
    } catch (e: any) { showToast(`删除失败: ${e.message}`, 'error'); setDeleteConfirm(null); }
  };

  const toggleSection = (s: string) => setExpanded(prev => ({ ...prev, [s]: !prev[s] }));

  const stats = { objectTypes: objectTypes.length, objects: objects.length, linkTypes: linkTypes.length, links: links.length, actions: actions.length };

  // Determine which entity types to show based on layer
  const showObjectType = layer === 'foundation' || layer === 'domains';
  const showObject = layer === 'foundation' || layer === 'patterns' || layer === 'domains';
  const showLinkType = layer === 'foundation' || layer === 'relations' || layer === 'patterns' || layer === 'domains';
  const showLink = layer === 'relations' || layer === 'patterns' || layer === 'domains';
  const showAction = layer === 'methodology' || layer === 'domains';

  return (
    <div className="w-full h-full flex flex-col bg-monokai-bg">
      {/* Header — CMS management bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-black/40 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Table2 className="w-[16px] h-[16px] text-monokai-green" />
            <span className="text-[13px] font-semibold text-white/70">本体数据</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            {showObjectType && <span className="flex items-center gap-1">类型 <strong className="text-monokai-purple font-bold">{stats.objectTypes}</strong></span>}
            {showObject && <span className="flex items-center gap-1">对象 <strong className="text-monokai-blue font-bold">{stats.objects}</strong></span>}
            {showLinkType && <span className="flex items-center gap-1">关系类型 <strong className="text-monokai-green font-bold">{stats.linkTypes}</strong></span>}
            {showLink && <span className="flex items-center gap-1">关系 <strong className="text-monokai-orange font-bold">{stats.links}</strong></span>}
            {showAction && <span className="flex items-center gap-1">行动 <strong className="text-monokai-yellow font-bold">{stats.actions}</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-white/30" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
              className="pl-8 pr-3 py-1.5 text-[12px] bg-black/50 border border-white/[0.08] text-white/70 placeholder-white/30 rounded-xl focus:outline-none focus:border-[#00f0ff]/40 focus:text-white/80 w-44 transition-all" />
          </div>
          <button onClick={resetForm}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all">
            <RotateCcw className="w-[13px] h-[13px]" />
          </button>
          <button onClick={checkAndInit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-[13px] h-[13px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content — CMS content area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-48"><RefreshCw className="w-8 h-8 text-monokai-green animate-spin" /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-monokai-orange opacity-50" />
              <p className="text-[14px] text-monokai-orange mb-2">{error}</p>
              <p className="text-[12px] text-white/40">请先执行建表 SQL 创建五张核心表</p>
            </div>
          </div>
        ) : needsSeedData ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center max-w-[280px]">
              <div className="w-14 h-14 rounded-2xl bg-monokai-blue/[0.08] border border-monokai-blue/[0.2] flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-monokai-blue opacity-60" />
              </div>
              <p className="text-[14px] text-white font-medium mb-2">本体论已就绪，请导入种子数据</p>
              <p className="text-[12px] text-white/40 mb-6 leading-relaxed">五张核心表已创建，点击下方按钮导入预设数据，开启完整体验</p>
              <button
                onClick={handleSeedData}
                disabled={initting}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 text-[12px] font-semibold bg-monokai-blue/[0.12] border border-monokai-blue/40 text-monokai-blue rounded-xl hover:bg-monokai-blue/[0.2] transition-colors disabled:opacity-50"
              >
                {initting ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {initting ? '导入中...' : '一键导入种子数据'}
              </button>
            </div>
          </div>
        ) : needsInit ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center max-w-[280px]">
              <div className="w-14 h-14 rounded-2xl bg-monokai-purple/[0.08] border border-monokai-purple/[0.2] flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-monokai-purple opacity-60" />
              </div>
              <p className="text-[14px] text-white font-medium mb-2">本体论尚未初始化</p>
              <p className="text-[12px] text-white/40 mb-6 leading-relaxed">点击下方按钮创建五张核心表并导入种子数据</p>
              <button
                onClick={handleSeedData}
                disabled={initting}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 text-[12px] font-semibold bg-monokai-purple/[0.12] border border-monokai-purple/40 text-monokai-purple rounded-xl hover:bg-monokai-purple/[0.2] transition-colors disabled:opacity-50"
              >
                {initting ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {initting ? '初始化中...' : '一键初始化本体论'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Object Types */}
            {showObjectType && (
              <CRUDSection
                title="对象类型" icon={Layers} color="purple" count={objectTypes.length}
                expanded={expanded['objectTypes']} onToggle={() => toggleSection('objectTypes')}
                onAdd={() => openCreate('objectType')}
              >
                {objectTypes.length === 0 ? <EmptyMsg /> : objectTypes.map(ot => (
                  <CRUDRow key={ot.id} color="purple" name={ot.name} desc={ot.description}
                    onEdit={() => openEdit('objectType', ot)}
                    onDelete={() => setDeleteConfirm({ type: 'objectType', id: ot.id, label: ot.name })} />
                ))}
              </CRUDSection>
            )}

            {/* Objects */}
            {showObject && (
              <CRUDSection
                title="对象实例" icon={Database} color="blue" count={filteredObjects.length}
                expanded={expanded['objects']} onToggle={() => toggleSection('objects')}
                onAdd={() => openCreate('object')}
              >
                {filteredObjects.length === 0 ? <EmptyMsg /> : filteredObjects.map(obj => {
                  let props: Record<string, string> = {}; try { props = JSON.parse(obj.properties || '{}'); } catch {}
                  return (
                    <div key={obj.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-monokai-accent/5 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-2 h-2 rounded-sm bg-monokai-blue shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-monokai-fg truncate">{obj.name}</div>
                            <span className="px-1.5 py-0.5 text-[9px] bg-monokai-purple/15 text-monokai-purple rounded shrink-0">{objectTypeMap[obj.object_type_id] || '?'}</span>
                          </div>
                          {Object.keys(props).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {Object.entries(props).slice(0, 3).map(([k, v]) => (
                                <span key={k} className="text-[9px] text-monokai-comment">
                                  <span className="text-monokai-purple/70">{k}</span>: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button onClick={() => openEdit('object', obj)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm({ type: 'object', id: obj.id, label: obj.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </CRUDSection>
            )}

            {/* Link Types */}
            {showLinkType && (
              <CRUDSection
                title="关系类型" icon={Link2} color="green" count={linkTypes.length}
                expanded={expanded['linkTypes']} onToggle={() => toggleSection('linkTypes')}
                onAdd={() => openCreate('linkType')}
              >
                {linkTypes.length === 0 ? <EmptyMsg /> : linkTypes.map(lt => (
                  <CRUDRow key={lt.id} color="green" name={lt.name} desc={lt.description}
                    onEdit={() => openEdit('linkType', lt)}
                    onDelete={() => setDeleteConfirm({ type: 'linkType', id: lt.id, label: lt.name })} />
                ))}
              </CRUDSection>
            )}

            {/* Links */}
            {showLink && (
              <CRUDSection
                title="关系实例" icon={ArrowRight} color="orange" count={filteredLinks.length}
                expanded={expanded['links']} onToggle={() => toggleSection('links')}
                onAdd={() => openCreate('link')}
              >
                {filteredLinks.length === 0 ? <EmptyMsg /> : filteredLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-monokai-accent/5 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-monokai-purple shrink-0">{objectNameMap[link.source_object_id] || `?(${link.source_object_id})`}</span>
                      <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                      <span className="px-1.5 py-0.5 text-[9px] bg-monokai-green/15 text-monokai-green rounded shrink-0">{linkTypeMap[link.link_type_id] || '?'}</span>
                      <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                      <span className="text-xs text-monokai-blue shrink-0">{objectNameMap[link.target_object_id] || `?(${link.target_object_id})`}</span>
                      <span className="ml-1 px-1 py-0.5 text-[10px] font-mono bg-monokai-orange/10 text-monokai-orange rounded shrink-0">{Number(link.weight).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => openEdit('link', link)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirm({ type: 'link', id: link.id, label: `${objectNameMap[link.source_object_id]} → ${linkTypeMap[link.link_type_id]} → ${objectNameMap[link.target_object_id]}` })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </CRUDSection>
            )}

            {/* Actions */}
            {showAction && (
              <CRUDSection
                title="行动列表" icon={Zap} color="yellow" count={actions.length}
                expanded={expanded['actions']} onToggle={() => toggleSection('actions')}
                onAdd={() => openCreate('action')}
              >
                {actions.length === 0 ? <EmptyMsg /> : actions.map(action => (
                  <div key={action.id} className="flex items-center justify-between px-4 py-3 hover:bg-monokai-accent/5 transition-colors group">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {action.status === 'done' ? <Check className="w-4 h-4 text-monokai-green" /> : <div className="w-4 h-4 rounded border-2 border-monokai-comment/40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-medium text-monokai-fg truncate">{action.name}</div>
                          <StatusBadge status={action.status} />
                        </div>
                        {action.description && <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{action.description}</div>}
                        {action.execute_at && <div className="text-[9px] text-monokai-purple/60 mt-0.5">执行日期: {action.execute_at}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => openEdit('action', action)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirm({ type: 'action', id: action.id, label: action.name })} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </CRUDSection>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && <ConfirmDialog title="确认删除" message={`确定要删除「${deleteConfirm.label}」吗？此操作不可撤销。`} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />}

      {/* Form Overlay — CMS Style Modal */}
      {editMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditMode('none')}>
          <div className="w-full max-w-lg bg-[#090a0f] border border-white/[0.08] rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)] overflow-hidden max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  editMode === 'objectType' ? 'bg-monokai-purple/[0.08] border-monokai-purple/30' :
                  editMode === 'object' ? 'bg-monokai-blue/[0.08] border-monokai-blue/30' :
                  editMode === 'linkType' ? 'bg-monokai-green/[0.08] border-monokai-green/30' :
                  editMode === 'link' ? 'bg-monokai-orange/[0.08] border-monokai-orange/30' :
                  'bg-monokai-yellow/[0.08] border-monokai-yellow/30'}`}>
                  {editMode === 'objectType' && <Layers className="w-[16px] h-[16px] text-monokai-purple" />}
                  {editMode === 'object' && <Database className="w-[16px] h-[16px] text-monokai-blue" />}
                  {editMode === 'linkType' && <Link2 className="w-[16px] h-[16px] text-monokai-green" />}
                  {editMode === 'link' && <ArrowRight className="w-[16px] h-[16px] text-monokai-orange" />}
                  {editMode === 'action' && <Zap className="w-[16px] h-[16px] text-monokai-yellow" />}
                </div>
                <span className="text-[14px] font-bold text-white">
                  {editMode === 'objectType' && (editTarget ? '编辑对象类型' : '新建对象类型')}
                  {editMode === 'object' && (editTarget ? '编辑对象' : '新建对象')}
                  {editMode === 'linkType' && (editTarget ? '编辑关系类型' : '新建关系类型')}
                  {editMode === 'link' && (editTarget ? '编辑关系' : '新建关系')}
                  {editMode === 'action' && (editTarget ? '编辑行动' : '新建行动')}
                </span>
              </div>
              <button onClick={() => setEditMode('none')} className="p-2 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all">
                <X className="w-[16px] h-[16px]" />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">名称 <span className="text-monokai-orange">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入名称..."
                  className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 placeholder-white/20 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 focus:text-white transition-all" />
              </div>
              {(editMode === 'objectType' || editMode === 'linkType') && (
                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">描述</label>
                  <input type="text" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="输入描述..."
                    className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 placeholder-white/20 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 focus:text-white transition-all" />
                </div>
              )}
              {editMode === 'object' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">对象类型</label>
                    <select value={form.objectTypeId} onChange={e => setForm(f => ({ ...f, objectTypeId: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all">
                      {objectTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name} — {ot.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">属性 (JSON)</label>
                    <textarea value={form.properties} onChange={e => setForm(f => ({ ...f, properties: e.target.value }))}
                      placeholder='{"state": "焦虑", "goal": "内心平静"}' rows={3}
                      className="w-full px-4 py-2.5 text-[12px] bg-black/50 border border-white/[0.08] text-white/80 placeholder-white/20 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all resize-none font-mono" />
                  </div>
                </>
              )}
              {editMode === 'link' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">源对象</label>
                      <select value={form.sourceId ?? ''} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all">
                        <option value="">选择源对象</option>
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">目标对象</label>
                      <select value={form.targetId ?? ''} onChange={e => setForm(f => ({ ...f, targetId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all">
                        <option value="">选择目标对象</option>
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">关系类型</label>
                    <select value={form.linkTypeId} onChange={e => setForm(f => ({ ...f, linkTypeId: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all">
                      {linkTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} — {lt.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">强度权重: <span className="text-monokai-green font-mono text-[13px]">{form.weight.toFixed(2)}</span></label>
                    <input type="range" min={0} max={1} step={0.05} value={form.weight} onChange={e => setForm(f => ({ ...f, weight: parseFloat(e.target.value) }))}
                      className="w-full accent-monokai-green" />
                    <div className="flex justify-between text-[11px] text-white/30 mt-1.5"><span>弱</span><span>中</span><span>强</span></div>
                  </div>
                  {form.sourceId !== null && form.targetId !== null && (
                    <div className="flex items-center justify-center gap-3 p-4 bg-black/40 rounded-xl border border-white/[0.06]">
                      <span className="px-3 py-1.5 bg-monokai-purple/[0.1] text-monokai-purple text-[12px] rounded-lg border border-monokai-purple/20 font-medium">{objects.find(o => o.id === form.sourceId)?.name}</span>
                      <ArrowRight className="w-4 h-4 text-white/30" />
                      <span className="px-3 py-1.5 bg-monokai-green/[0.1] text-monokai-green text-[12px] rounded-lg border border-monokai-green/20 font-medium">{linkTypes.find(lt => lt.id === form.linkTypeId)?.name}</span>
                      <ArrowRight className="w-4 h-4 text-white/30" />
                      <span className="px-3 py-1.5 bg-monokai-blue/[0.1] text-monokai-blue text-[12px] rounded-lg border border-monokai-blue/20 font-medium">{objects.find(o => o.id === form.targetId)?.name}</span>
                      <span className="ml-2 px-2 py-1 bg-monokai-orange/[0.08] text-monokai-orange text-[12px] rounded-lg border border-monokai-orange/20 font-mono">{form.weight.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {editMode === 'action' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">描述</label>
                    <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="描述这个行动..." rows={2}
                      className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 placeholder-white/20 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">状态</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all">
                      <option value="pending">待执行</option><option value="done">已完成</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">执行日期</label>
                    <input type="date" value={form.executeAt} onChange={e => setForm(f => ({ ...f, executeAt: e.target.value }))}
                      className="w-full px-4 py-2.5 text-[13px] bg-black/50 border border-white/[0.08] text-white/80 rounded-xl focus:outline-none focus:border-[#00f0ff]/50 transition-all" />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07] bg-black/30 shrink-0">
              <button onClick={() => setEditMode('none')} className="px-4 py-2 text-[12px] text-white/40 hover:text-white/70 rounded-xl hover:bg-white/[0.06] transition-all">取消</button>
              <button onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 text-[12px] font-semibold bg-monokai-green/[0.1] text-monokai-green rounded-xl border border-monokai-green/40 hover:bg-monokai-green/[0.2] transition-all">
                <Check className="w-[14px] h-[14px]" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.9)] text-[12px] font-semibold animate-pulse ${
          toast.type === 'success' ? 'bg-monokai-green/[0.1] text-monokai-green border border-monokai-green/30'
            : 'bg-monokai-orange/[0.1] text-monokai-orange border border-monokai-orange/30'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

// ============================================================
// More Helper Components
// ============================================================

const EmptyMsg: React.FC = () => <div className="px-5 py-6 text-[12px] text-white/30 text-center">暂无数据</div>;

const CRUDSection: React.FC<{
  title: string; icon: React.ElementType; color: string; count: number;
  expanded: boolean; onToggle: () => void; onAdd: () => void; children: React.ReactNode;
}> = ({ title, icon: Icon, color, count, expanded, onToggle, onAdd, children }) => {
  const sectionStyles: Record<string, { headerBg: string; headerHover: string; addBtnBg: string; addBtnHover: string; borderColor: string }> = {
    purple: { headerBg: 'bg-monokai-purple/[0.04]', headerHover: 'bg-monokai-purple/[0.07]', addBtnBg: 'bg-monokai-purple/[0.1]', addBtnHover: 'bg-monokai-purple/[0.18]', borderColor: 'border-monokai-purple/[0.12]' },
    blue: { headerBg: 'bg-monokai-blue/[0.04]', headerHover: 'bg-monokai-blue/[0.07]', addBtnBg: 'bg-monokai-blue/[0.1]', addBtnHover: 'bg-monokai-blue/[0.18]', borderColor: 'border-monokai-blue/[0.12]' },
    green: { headerBg: 'bg-monokai-green/[0.04]', headerHover: 'bg-monokai-green/[0.07]', addBtnBg: 'bg-monokai-green/[0.1]', addBtnHover: 'bg-monokai-green/[0.18]', borderColor: 'border-monokai-green/[0.12]' },
    yellow: { headerBg: 'bg-monokai-yellow/[0.04]', headerHover: 'bg-monokai-yellow/[0.07]', addBtnBg: 'bg-monokai-yellow/[0.1]', addBtnHover: 'bg-monokai-yellow/[0.18]', borderColor: 'border-monokai-yellow/[0.12]' },
    orange: { headerBg: 'bg-monokai-orange/[0.04]', headerHover: 'bg-monokai-orange/[0.07]', addBtnBg: 'bg-monokai-orange/[0.1]', addBtnHover: 'bg-monokai-orange/[0.18]', borderColor: 'border-monokai-orange/[0.12]' },
    cyan: { headerBg: 'bg-monokai-cyan/[0.04]', headerHover: 'bg-monokai-cyan/[0.07]', addBtnBg: 'bg-monokai-cyan/[0.1]', addBtnHover: 'bg-monokai-cyan/[0.18]', borderColor: 'border-monokai-cyan/[0.12]' },
  };
  const s = sectionStyles[color] || sectionStyles.purple;
  return (
    <div className={`border rounded-xl overflow-hidden bg-black/20 border-white/[0.06]`}>
      <div className={`flex items-center justify-between px-4 py-3 transition-colors cursor-pointer ${s.headerBg} ${s.headerHover}`} onClick={onToggle}>
        <div className="flex items-center gap-2.5">
          <Icon className={`w-[15px] h-[15px] text-monokai-${color}`} />
          <span className="text-[13px] font-semibold text-white/80">{title}</span>
          <span className="text-[11px] text-white/30">({count})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold ${s.addBtnBg} text-monokai-${color} rounded-lg ${s.addBtnHover} transition-all`}>
            <Plus className="w-[12px] h-[12px]" /> 新建
          </button>
          {expanded ? <ChevronDown className="w-[14px] h-[14px] text-white/30" /> : <ChevronRight className="w-[14px] h-[14px] text-white/30" />}
        </div>
      </div>
      {expanded && <div className="divide-y divide-white/[0.04]">{children}</div>}
    </div>
  );
};

const CRUDRow: React.FC<{ color: string; name: string; desc?: string; onEdit: () => void; onDelete: () => void }> = ({ color, name, desc, onEdit, onDelete }) => (
  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group">
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-2 h-2 rounded-sm bg-monokai-${color} shrink-0`} />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-white/80 truncate">{name}</div>
        {desc && <div className="text-[11px] text-white/35 truncate mt-0.5">{desc}</div>}
      </div>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="p-1.5 rounded-lg text-white/30 hover:text-monokai-blue hover:bg-monokai-blue/[0.1] transition-all"><Edit3 className="w-[14px] h-[14px]" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-white/30 hover:text-monokai-orange hover:bg-monokai-orange/[0.1] transition-all"><Trash2 className="w-[14px] h-[14px]" /></button>
    </div>
  </div>
);

// ============================================================
// Template Panel
// ============================================================

interface TemplatePanelProps {
  layer: MECELayer;
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
}

interface ExecutionState {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  executionTime?: number;
}

const TemplatePanel: React.FC<TemplatePanelProps> = ({ layer, onInsert, onTablesReady }) => {
  const templates = LAYER_TEMPLATES[layer] || [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [executions, setExecutions] = useState<Record<string, ExecutionState>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExecute = useCallback(async (id: string, sql: string, refreshTables?: boolean) => {
    setExecutions(prev => ({ ...prev, [id]: { data: null, error: null, loading: true } }));
    setErrorMsg(null);
    const start = performance.now();
    try {
      const res = await duckDBService.query(sql);
      const end = performance.now();
      setExecutions(prev => ({ ...prev, [id]: { data: res, error: null, loading: false, executionTime: end - start } }));
      if (refreshTables) onTablesReady?.();
    } catch (e: any) {
      setExecutions(prev => ({ ...prev, [id]: { data: null, error: e.message, loading: false } }));
      setErrorMsg(e.message);
    }
  }, [onTablesReady]);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-monokai-comment opacity-30" />
          <p className="text-sm text-monokai-comment">该层暂无模板</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
      {errorMsg && (
        <div className="mb-3 p-3 bg-monokai-red/[0.08] border border-monokai-red/30 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-monokai-red shrink-0 mt-0.5" />
          <p className="text-[12px] text-monokai-red leading-relaxed">{errorMsg}</p>
        </div>
      )}
      <div className="space-y-3">
        {templates.map(tpl => {
          const result = executions[tpl.id];
          const isExpanded = !!expanded[tpl.id];
          return (
            <div key={tpl.id} className="bg-black/40 border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => toggle(tpl.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  {result?.error ? <span className="text-monokai-red text-[12px] shrink-0">✕</span>
                    : result?.data !== null && result?.data !== undefined ? <span className="text-monokai-green text-[12px] shrink-0">✓</span>
                    : <span className="text-white/20 text-[12px] shrink-0">○</span>}
                  <span className="text-[13px] font-medium text-white/80">{tpl.label}</span>
                  {tpl.description && <span className="text-[11px] text-white/30 hidden sm:inline">— {tpl.description}</span>}
                </div>
                {isExpanded ? <ChevronDown className="w-[14px] h-[14px] text-white/30 shrink-0" />
                  : <ChevronRight className="w-[14px] h-[14px] text-white/30 shrink-0" />}
              </div>
              {isExpanded && (
                <>
                  <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/[0.05] flex items-center gap-1.5">
                    <button onClick={e => { e.stopPropagation(); handleExecute(tpl.id, tpl.sql, tpl.refreshTables); }}
                      disabled={result?.loading}
                      className={`p-2 rounded-lg transition-all ${result?.loading ? 'bg-monokai-yellow/[0.1] text-monokai-yellow cursor-wait' : 'text-white/30 hover:text-monokai-green hover:bg-monokai-green/[0.1]'}`}
                      title="执行 SQL">
                      {result?.loading ? <Loader className="w-[14px] h-[14px] animate-spin" /> : <Play className="w-[14px] h-[14px]" />}
                    </button>
                    {onInsert && (
                      <button onClick={e => { e.stopPropagation(); onInsert(tpl.sql); }}
                        className="p-2 rounded-lg text-white/30 hover:text-monokai-blue hover:bg-monokai-blue/[0.1] transition-all" title="插入到编辑器">
                        <ArrowRight className="w-[14px] h-[14px]" />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(tpl.sql); }}
                      className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-all" title="复制">
                      <Copy className="w-[14px] h-[14px]" />
                    </button>
                  </div>
                  <div>
                    <CodeMirror value={tpl.sql} height="auto" theme={monokai}
                      extensions={[sql(), EditorView.lineWrapping, EditorView.theme({ "&": { fontSize: "12px" }, ".cm-content": { fontSize: "12px" }, ".cm-line": { fontSize: "12px" } })]}
                      editable={false} basicSetup={false} />
                  </div>
                  {result && (
                    <ResultTable data={result.data || []} error={result.error} loading={result.loading} executionTime={result.executionTime} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// Type Panel (Type definitions + properties)
// ============================================================

interface TypePanelProps {
  layer: MECELayer;
}

const TYPE_INFO: Record<MECELayer, { title: string; description: string; fields: Array<{ chiName: string; name: string; type: string; valueDesc: string; coreExplanation: string }>[] }> = {
  foundation: {
    title: '基础层 — 对象类型结构',
    description: 'Object Type 和 Link Type 定义了本体论的核心概念分类',
    fields: [
      [
        { chiName: '类型主键', name: 'id', type: 'INTEGER PRIMARY KEY', valueDesc: '确保类型的唯一标识', coreExplanation: '数据库主键，物理层必需' },
        { chiName: '类型名称', name: 'name', type: 'VARCHAR NOT NULL', valueDesc: '业务侧核心分类名称', coreExplanation: '必填字段，用于UI展示和业务对象关联' },
        { chiName: '类型描述', name: 'description', type: 'VARCHAR', valueDesc: '提供补充背景信息', coreExplanation: '选填字段，用于解释当前分类的具体使用场景和边界' },
      ],
    ],
  },
  relations: {
    title: '关系层 — 关系类型结构',
    description: 'Link Type 定义了对象之间的关系语义',
    fields: [
      [
        { chiName: '关系主键', name: 'id', type: 'INTEGER PRIMARY KEY', valueDesc: '确保关系的唯一标识', coreExplanation: '数据库主键，物理层必需' },
        { chiName: '关系名称', name: 'name', type: 'VARCHAR NOT NULL', valueDesc: '定义实体如何产生关联（如:影响、支撑）', coreExplanation: '必填字段，反映本体关系图谱的边属性' },
        { chiName: '关系描述', name: 'description', type: 'VARCHAR', valueDesc: '对关系程度和限定范围做补充说明', coreExplanation: '选填字段，帮助业务理解关系边界' },
      ],
    ],
  },
  methodology: {
    title: '方法层 — 行动与反思结构',
    description: '通过行动表驱动执行，反思表记录内省过程',
    fields: [
      [
        { chiName: '行动主键', name: 'id', type: 'INTEGER PRIMARY KEY', valueDesc: '确保行动的唯一标识', coreExplanation: '数据库主键，物理层必需' },
        { chiName: '行动名称', name: 'name', type: 'VARCHAR NOT NULL', valueDesc: '行动的核心标题', coreExplanation: '必填字段，简洁描述要执行的操作' },
        { chiName: '行动描述', name: 'description', type: 'VARCHAR', valueDesc: '行动的详细说明', coreExplanation: '选填字段，用于补充行动的背景和目的' },
        { chiName: '执行状态', name: 'status', type: 'VARCHAR DEFAULT pending', valueDesc: '状态机：pending → in_progress → executed', coreExplanation: '控制行动生命周期的核心字段' },
        { chiName: '执行日期', name: 'execute_at', type: 'DATE', valueDesc: '记录行动的计划或实际执行日期', coreExplanation: '可为 NULL，表示尚未排期' },
      ],
      [
        { chiName: '反思主键', name: 'id', type: 'INTEGER PRIMARY KEY', valueDesc: '确保反思记录的唯一标识', coreExplanation: '数据库主键' },
        { chiName: '关联对象', name: 'object_id', type: 'INTEGER', valueDesc: '反思针对的对象', coreExplanation: '关联 life_object 表的外键' },
        { chiName: '核心问题', name: 'question', type: 'VARCHAR', valueDesc: '反思的切入点问题', coreExplanation: '引导性提问，帮助深度思考' },
        { chiName: '反思回答', name: 'answer', type: 'VARCHAR', valueDesc: '对核心问题的思考回答', coreExplanation: '记录思考过程和结论' },
        { chiName: '创建日期', name: 'created_at', type: 'DATE DEFAULT CURRENT_DATE', valueDesc: '自动记录反思时间', coreExplanation: '用于追踪反思频率和时间线' },
      ],
    ],
  },
  patterns: {
    title: '模式层 — 核心模式',
    description: '递归追溯、视图封装、聚合分析等高级查询模式',
    fields: [
      [
        { chiName: '源头对象', name: 'source_object', type: 'VARCHAR', valueDesc: '直观展示关系起点', coreExplanation: '图谱边的起点节点名称' },
        { chiName: '关系类型', name: 'relation_type', type: 'VARCHAR', valueDesc: '描述产生影响的模式', coreExplanation: '直接展现边定义的语义内容' },
        { chiName: '目标对象', name: 'target_object', type: 'VARCHAR', valueDesc: '直观展示关系终点', coreExplanation: '图谱边的终点节点名称' },
        { chiName: '关系权重', name: 'relation_weight', type: 'DECIMAL(3,2)', valueDesc: '量化节点间关系的强弱指标', coreExplanation: '0.0至1.0间的浮点数，业务进行排序和剪枝的依据' },
      ],
      [
        { chiName: '起点ID', name: 'start_id', type: 'INTEGER', valueDesc: '用于追溯递归查询根源', coreExplanation: '递归共同的起始源节点ID标识' },
        { chiName: '当前节点ID', name: 'current_id', type: 'INTEGER', valueDesc: '跟踪图谱扩散触达的当下位置', coreExplanation: '当前深度遍历到的叶子节点标识' },
        { chiName: '追溯路径', name: 'path', type: 'VARCHAR', valueDesc: '展示完整的影响传播链路', coreExplanation: '使用字符串序列化出的访问轨迹，如A -> B' },
        { chiName: '追溯层级', name: 'depth', type: 'INTEGER', valueDesc: '控制搜索爆炸，限制遍历深度', coreExplanation: '整型数字，标识处于起点向外的第N层' },
      ],
    ],
  },
  domains: {
    title: '领域层 — 五表结构总览',
    description: '"我的人生"本体论五张核心表结构',
    fields: [
      [
        { chiName: '对象主键', name: 'id', type: 'INTEGER', valueDesc: '实体级别唯一标识', coreExplanation: '对象表核心主键' },
        { chiName: '外键指向类型', name: 'object_type_id', type: 'INTEGER REFERENCES ...', valueDesc: '限制对象必须归属于特定类型划分', coreExplanation: '关联对象类型表的外键' },
        { chiName: '对象名称', name: 'name', type: 'VARCHAR', valueDesc: '承载对象具体概念实体的标题', coreExplanation: '字符串名称，用于业务识别' },
        { chiName: '扩展属性', name: 'properties', type: 'JSON', valueDesc: '灵活承载不同业务需要的垂直数据', coreExplanation: 'JSON 格式存储键值对，避免频繁改表结构' },
      ],
      [
        { chiName: '连线主键', name: 'id', type: 'INTEGER', valueDesc: '关系实体级别唯一标识', coreExplanation: '关系表核心主键' },
        { chiName: '外键指向关系类型', name: 'link_type_id', type: 'INTEGER REFERENCES ...', valueDesc: '限制关系必须符合特定的边类型语义', coreExplanation: '关联关系分类表的外键' },
        { chiName: '外键指向起点', name: 'source_object_id', type: 'INTEGER REFERENCES ...', valueDesc: '限定关系的出发点对象', coreExplanation: '关联起点对象实例的外键' },
        { chiName: '外键指向终点', name: 'target_object_id', type: 'INTEGER REFERENCES ...', valueDesc: '限定关系的到达点对象', coreExplanation: '关联终点对象实例的外键' },
        { chiName: '关系强度', name: 'weight', type: 'DECIMAL(3,2)', valueDesc: '用于图计算阻尼和权重排序的核心考量', coreExplanation: '默认1.0，业务可手动调节此区间0.0~1.0的浮点数值' },
      ],
    ],
  },
  graph: {
    title: '图谱可视化',
    description: '交互式关系网络图谱',
    fields: [],
  },
  canvas: {
    title: '画布视图',
    description: '拖拽组织空间布局，直观整理本体结构',
    fields: [],
  },
};

const TypePanel: React.FC<TypePanelProps> = ({ layer }) => {
  const info = TYPE_INFO[layer];
  if (!info || info.fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Layers className="w-10 h-10 mx-auto mb-3 text-monokai-purple opacity-30" />
          <p className="text-sm text-monokai-comment">该层无类型结构说明</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-white/70 mb-1">{info.title}</h3>
        <p className="text-[12px] text-white/30 leading-relaxed">{info.description}</p>
      </div>

      {/* Tables — stacked vertically */}
      <div className="space-y-4">
        {info.fields.map((tableFields, ti) => (
          <div key={ti} className="bg-black/40 border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="px-4 py-2.5 bg-monokai-purple/[0.04] border-b border-white/[0.05]">
              <span className="text-[11px] font-bold text-monokai-purple uppercase tracking-widest">字段定义</span>
            </div>

            {/* Fields — vertical list */}
            <div className="divide-y divide-white/[0.04]">
              {tableFields.map((f, fi) => (
                <div key={fi} className="group px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                  {/* Row 1: 中文名 + type badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[12px] text-white/80 font-semibold shrink-0">{f.chiName}</span>
                      <span className="text-[11px] font-mono text-monokai-purple/60 truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-monokai-cyan/70 bg-monokai-cyan/[0.06] px-2 py-1 rounded-lg border border-monokai-cyan/20 shrink-0">
                      {f.type}
                    </span>
                  </div>
                  {/* Row 2: 价值说明 */}
                  <div className="text-[12px] text-white/35 leading-relaxed mb-1.5">
                    {f.valueDesc}
                  </div>
                  {/* Row 3: 核心解释 */}
                  <div className="text-[11px] text-white/20 leading-relaxed border-t border-white/[0.04] pt-2">
                    <span className="text-monokai-yellow/50 mr-1.5">→</span>{f.coreExplanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Main Panel Component
// ============================================================

interface OntologyMECEPanelProps {
  onInsert?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyMECEPanel: React.FC<OntologyMECEPanelProps> = ({ onInsert, onTablesReady }) => {
  const [activeLayer, setActiveLayer] = useState<MECELayer>('foundation');
  const [activeSemantic, setActiveSemantic] = useState<SemanticCategory>('template');
  const [showHelp, setShowHelp] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const [showTopBar, setShowTopBar] = useState(false); // hidden by default for clarity
  const [ontologyObjects, setOntologyObjects] = useState<any[]>([]);
  const [ontologyLinks, setOntologyLinks] = useState<any[]>([]);
  const [ontologyObjectTypes, setOntologyObjectTypes] = useState<any[]>([]);
  const [ontologyLinkTypes, setOntologyLinkTypes] = useState<any[]>([]);

  // AI Copilot State
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftPayload, setDraftPayload] = useState<OntologyDraftPayload | null>(null);
  const [draftJsonStr, setDraftJsonStr] = useState('');

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setIsGenerating(true);
    try {
      const payload = await ontologyAiService.generateOntologyDraft(aiTopic);
      setDraftPayload(payload);
      setDraftJsonStr(JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error(err);
      alert('AI 生成失败: ' + (err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommitDraft = async () => {
    try {
      const dataToCommit = JSON.parse(draftJsonStr);
      await duckDBService.executeOntologyDraft(dataToCommit);
      setDraftPayload(null);
      setAiTopic('');
      await loadOntologyData();
    } catch (err) {
      console.error(err);
      alert('提交/解析失败: ' + (err as Error).message);
    }
  };

  // Load ontology data for insights panel
  const loadOntologyData = useCallback(async () => {
    try {
      const [objs, links, objTypes, lnkTypes] = await Promise.all([
        duckDBService.getOntologyObjects(),
        duckDBService.getOntologyLinks(),
        duckDBService.getOntologyObjectTypes(),
        duckDBService.getOntologyLinkTypes(),
      ]);
      setOntologyObjects(objs);
      setOntologyLinks(links);
      setOntologyObjectTypes(objTypes);
      setOntologyLinkTypes(lnkTypes);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeLayer === 'graph' || activeLayer === 'canvas' || showInsights) {
      loadOntologyData();
    }
  }, [activeLayer, showInsights, loadOntologyData]);

  const currentTab = MECETABS.find(t => t.id === activeLayer)!;

  return (
    <div className="relative h-full w-full bg-[#090a0f] text-monokai-fg overflow-hidden flex font-mono border border-monokai-accent/30 shadow-inner shadow-black/50">
      
      {/* ================= BACKGROUND LAYER 0 (ALWAYS RENDER CANVAS/GRAPH) ================= */}
      <div className="absolute inset-0 z-0 bg-[#090a0f]">
        {activeLayer === 'canvas' ? <OntologyCanvas /> : <D3GraphView />}
      </div>

      {/* ================= OVERLAY LAYER 0: Top Bar Toggle ================= */}
      {!showTopBar && (
        <button
          onClick={() => setShowTopBar(true)}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(15,15,20,0.75)] backdrop-blur-xl border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/[0.1] hover:border-[#00f0ff]/60 transition-all font-semibold text-[12px] shadow-[0_0_15px_rgba(0,240,255,0.1)]"
        >
          <Network className="w-[14px] h-[14px]" />
          显示工具栏
        </button>
      )}

      {/* ================= OVERLAY LAYER 1: Top Floating Command Island ================= */}
      {showTopBar && (
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-5 px-5 py-3 bg-[rgba(15,15,20,0.88)] backdrop-blur-2xl border border-[#00f0ff]/25 shadow-[0_8px_60px_rgba(0,0,0,0.8)] rounded-2xl">
        <div className="flex items-center gap-3 pr-5 border-r border-white/[0.08] shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#00f0ff]/[0.08] flex items-center justify-center border border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <Network className="w-[18px] h-[18px] text-[#00f0ff]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] text-[#00f0ff] font-bold tracking-widest">MECE Ontology</span>
            <span className="text-[10px] text-white/30">Palantir Arch · v1.0</span>
          </div>
        </div>

        {/* AI Copilot Input */}
        <div className="flex items-center w-72 relative">
          <input
            type="text"
            placeholder="输入业务领域，AI 自动建模..."
            value={aiTopic}
            onChange={e => setAiTopic(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAiGenerate();
              else if (e.key === 'Escape') setAiTopic('');
            }}
            className="w-full bg-black/40 border border-[#b200ff]/35 rounded-xl py-2 pl-3.5 pr-9 text-[12px] text-[#b200ff] placeholder-[#b200ff]/30 focus:outline-none focus:border-[#b200ff]/70 focus:ring-1 focus:ring-[#b200ff]/40 transition-all"
          />
          {aiTopic && (
            <button onClick={() => setAiTopic('')} className="absolute right-2.5 text-[#b200ff]/50 hover:text-[#b200ff] transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
           onClick={handleAiGenerate}
           disabled={isGenerating || !aiTopic.trim()}
           className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all shrink-0 ${isGenerating || !aiTopic.trim() ? 'bg-white/[0.04] text-white/30 cursor-not-allowed border border-white/[0.06]' : 'bg-gradient-to-r from-[#b200ff]/[0.15] to-[#ff003c]/[0.15] border border-[#b200ff]/40 text-white shadow-[0_0_15px_rgba(178,0,255,0.25)] hover:shadow-[0_0_25px_rgba(178,0,255,0.5)] hover:border-[#b200ff]/70'}`}
        >
          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isGenerating ? '生成中...' : 'RUN AI'}
        </button>

        {/* Layout Modifiers */}
        <div className="flex items-center gap-2 pl-5 border-l border-white/[0.08] shrink-0">
          <button
             onClick={() => setActiveLayer(activeLayer === 'graph' ? 'canvas' : 'graph')}
             className="px-3 py-2 rounded-xl bg-black/40 border border-[#00f0ff]/30 text-[11px] text-[#00f0ff] hover:bg-[#00f0ff]/[0.1] transition-all font-semibold"
          >
             {activeLayer === 'graph' ? 'Canvas' : 'Graph'}
          </button>
          <button
              onClick={() => { setShowInsights(!showInsights); if (!showInsights) loadOntologyData(); }}
              className={`px-3 py-2 rounded-xl transition-all text-[11px] font-semibold border ${showInsights ? 'bg-[#ffbf00]/[0.12] border-[#ffbf00]/50 text-[#ffbf00] shadow-[0_0_12px_rgba(255,191,0,0.2)]' : 'bg-black/40 border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20'}`}
          >
            Insights
          </button>
          <button
              onClick={() => setShowTopBar(false)}
              className="px-3 py-2 rounded-xl text-[11px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all"
              title="隐藏工具栏"
          >
            隐藏
          </button>
        </div>
      </div>
      )}

      {/* ================= OVERLAY LAYER 2: Left Collapsible Semantic Drawer ================= */}
      {/* Drawer Toggle */}
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 py-5 px-1 bg-[rgba(15,15,20,0.8)] border border-l-0 border-[#00f0ff]/30 rounded-r-xl text-[#00f0ff] hover:bg-[#00f0ff]/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex flex-col items-center gap-4 backdrop-blur-md ${isDrawerOpen ? 'translate-x-[420px]' : 'translate-x-0'}`}
      >
         <div className="text-[10px] font-bold tracking-widest uppercase cursor-pointer leading-tight" style={{ writingMode: 'vertical-rl' }}>DATA EXPLORER</div>
         <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Sliding Drawer */}
      <div className={`absolute top-0 left-0 h-full w-[420px] flex bg-[rgba(10,10,13,0.97)] backdrop-blur-3xl border-r border-[#00f0ff]/20 shadow-[8px_0_60px_rgba(0,0,0,0.9)] z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Layer Ribbon (vertical navigation) */}
        <div className="w-[52px] border-r border-[#00f0ff]/15 flex flex-col items-center py-6 gap-3 bg-black/50 shrink-0">
           {MECETABS.slice(0, 5).map(tab => {
             const Icon = tab.icon;
             const isActive = activeLayer === tab.id;
             return (
               <button
                 key={tab.id}
                 onClick={() => { setActiveLayer(tab.id); if (tab.semanticCategories.length > 0) setActiveSemantic(tab.semanticCategories[0]); }}
                 title={tab.label}
                 className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-[#00f0ff]/15 border border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.3)]' : 'border border-transparent text-monokai-comment hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white'}`}
               >
                 <Icon className="w-[18px] h-[18px]" />
               </button>
             )
           })}
           {/* Spacer + Graph/Canvas quick-toggle */}
           <div className="flex-1" />
           {MECETABS.slice(5).map(tab => {
             const Icon = tab.icon;
             const isActive = activeLayer === tab.id;
             return (
               <button
                 key={tab.id}
                 onClick={() => setActiveLayer(tab.id)}
                 title={tab.label}
                 className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-[#00f0ff]/15 border border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.3)]' : 'border border-transparent text-monokai-comment hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white'}`}
               >
                 <Icon className="w-[18px] h-[18px]" />
               </button>
             );
           })}
        </div>

        {/* Semantic Content Box */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
           {/* Layer Header */}
           <div className="px-5 py-4 border-b border-white/[0.07] flex items-start justify-between gap-4 bg-gradient-to-b from-black/40 to-transparent shrink-0">
             <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.6)] shrink-0" />
                 <h3 className="text-[14px] font-bold text-[#00f0ff] uppercase tracking-widest leading-none">{currentTab.label}</h3>
               </div>
               <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{currentTab.description}</p>
             </div>
             <button onClick={() => setIsDrawerOpen(false)} className="text-white/30 hover:text-white/70 p-1.5 rounded-lg hover:bg-white/[0.06] transition-all shrink-0 mt-0.5">
               <X className="w-4 h-4" />
             </button>
           </div>

           {/* Semantic View Switcher */}
           {currentTab.semanticCategories.length > 0 ? (
             <div className="flex-1 flex flex-col overflow-hidden">
               {/* Semantic category tabs — CMS style */}
               <div className="flex px-4 pt-3 pb-0 border-b border-white/[0.05] bg-black/30 gap-1 shrink-0">
                 {currentTab.semanticCategories.map(cat => {
                   const { label, icon: CatIcon, desc } = SEMANTIC_LABELS[cat];
                   const isActive = activeSemantic === cat;
                   return (
                     <button
                       key={cat}
                       onClick={() => setActiveSemantic(cat)}
                       className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold rounded-t-lg border-b-2 transition-all relative group ${isActive
                         ? 'border-[#ffbf00] text-[#ffbf00] bg-[#ffbf00]/[0.06]'
                         : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-b-white/[0.05]'}`}
                       title={desc}
                     >
                       <CatIcon className={`w-[14px] h-[14px] ${isActive ? 'text-[#ffbf00]' : 'text-white/30 group-hover:text-white/50'}`} />
                       {label}
                     </button>
                   );
                 })}
               </div>
               <div className="flex-1 overflow-auto custom-scrollbar">
                  {activeSemantic === 'type' && <TypePanel layer={activeLayer} />}
                  {activeSemantic === 'instance' && <CRUDPanel layer={activeLayer} onInsert={onInsert} />}
                  {activeSemantic === 'template' && <TemplatePanel layer={activeLayer} onInsert={onInsert} onTablesReady={onTablesReady} />}
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
               <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-4">
                 <Eye className="w-6 h-6 text-white/30" />
               </div>
               <p className="text-[13px] text-white/50 font-medium mb-1"><b className="text-white/70">{currentTab.label}</b> 层为纯可视化区域</p>
               <p className="text-[11px] text-white/30 leading-relaxed">关闭 Data Explorer 面板可直接在画布/图谱中交互</p>
             </div>
           )}
        </div>
      </div>

      {/* ================= OVERLAY LAYER 3: RIGHT INSIGHTS HUD ================= */}
      {showInsights && (
        <div className="absolute right-5 top-24 bottom-6 w-[380px] bg-[rgba(10,10,13,0.95)] backdrop-blur-2xl border border-[#ffbf00]/20 shadow-[-8px_0_60px_rgba(0,0,0,0.85)] z-30 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/[0.07] bg-gradient-to-r from-black/60 to-[#ffbf00]/[0.04] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#ffbf00]/[0.1] flex items-center justify-center border border-[#ffbf00]/30">
                <Brain className="w-[16px] h-[16px] text-[#ffbf00]" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-[#ffbf00] tracking-wider">AI Synapses</span>
                <p className="text-[10px] text-white/30 mt-0.5">Ontology Insights</p>
              </div>
            </div>
            <button onClick={() => setShowInsights(false)} className="text-white/30 hover:text-white/70 p-2 rounded-xl hover:bg-white/[0.05] transition-all">
              <X className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#090a0f]/50">
            <OntologyInsightsPanel
              objects={ontologyObjects as any}
              objectTypes={ontologyObjectTypes as any}
              links={ontologyLinks as any}
              linkTypes={ontologyLinkTypes as any}
            />
          </div>
        </div>
      )}

      {/* ================= AI DRAFT MODAL ================= */}
      {draftPayload && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-[#090a0f] border border-[#ff003c]/40 rounded-xl shadow-[0_0_100px_rgba(255,0,60,0.3)] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-[rgba(15,15,20,0.9)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded border border-[#ff003c]/50 bg-[#ff003c]/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,0,60,0.3)]">
                  <Sparkles className="w-5 h-5 text-[#ff003c]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#ff003c] tracking-widest uppercase">DRAFT ARCHITECTURE REVIEW</h3>
                  <p className="text-[10px] text-monokai-comment mt-0.5">Please verify the semantic mapping payloads before Database commitment.</p>
                </div>
              </div>
              <button onClick={() => setDraftPayload(null)} className="text-monokai-comment hover:text-white p-2 rounded hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-[#0a0a0f] relative">
              <CodeMirror
                value={draftJsonStr}
                height="100%"
                theme={monokai}
                extensions={[EditorView.lineWrapping]}
                onChange={v => setDraftJsonStr(v)}
                className="text-sm border-none [&>.cm-editor]:outline-none"
              />
            </div>

            <div className="px-6 py-4 border-t border-white/10 bg-[rgba(15,15,20,0.9)] flex items-center justify-between shrink-0">
              <div className="text-[10px] text-monokai-comment flex flex-col gap-0.5">
                <span className="text-[#00f0ff] font-bold">Summary: {draftPayload.objects.length} Objects, {draftPayload.links.length} Links, {draftPayload.actions.length} Actions, {draftPayload.introspections.length} Introspections.</span>
                <span>Ensure foreign-key graph integrity (source_object_id, targeted keys) to prevent broken links in the layout engine.</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setDraftPayload(null)}
                  className="px-6 py-2.5 text-xs font-bold text-monokai-comment hover:text-white hover:bg-white/5 rounded border border-transparent transition-colors uppercase tracking-widest"
                >
                  ABORT
                </button>
                <button 
                  onClick={handleCommitDraft}
                  className="flex items-center gap-2 px-8 py-2.5 text-xs font-bold text-white bg-[#ff003c]/20 border border-[#ff003c]/50 rounded shadow-[0_0_20px_rgba(255,0,60,0.4)] hover:bg-[#ff003c]/40 hover:border-[#ff003c] transition-all uppercase tracking-widest"
                >
                  <Check className="w-3.5 h-3.5" />
                  COMMIT TO FOUNDRY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OntologyMECEPanel;
