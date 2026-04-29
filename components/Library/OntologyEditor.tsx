/**
 * OntologyEditor - 本体论 CRUD 组织管理面板
 *
 * 基于 MECE 原则增强的三阶功能：
 * - AI 一键填充：智能生成对象/关系/行动
 * - 快速清除：一键重置表单
 * - 背景说明：使用场景与最佳实践
 *
 * 提供对象、关系、行动的增删改查操作
 * 所有变更直接写入 DuckDB，同时可选持久化到 IndexedDB
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  Link2,
  Zap,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  Search,
  Filter,
  Table2,
  Database,
  Target,
  Users,
  ArrowRight,
  Sparkles,
  Lightbulb,
  RotateCcw,
  Loader2,
  Star,
  Network,
  Target as TargetIcon,
  AlertTriangle as AlertIcon,
} from 'lucide-react';
import { duckDBService } from '../../services/duckdbService';
import {
  ONTOLOGY_CREATE_TABLES,
  ONTOLOGY_SEED_DATA,
  ONTOLOGY_CREATE_STATEMENTS,
  ONTOLOGY_SEED_STATEMENTS,
} from './ontologyDataModel';
import { saveOntologyEntry } from '../../services/libraryStorage';

// ==================== Types ====================

interface LifeObjectType {
  id: number;
  name: string;
  description: string;
}

interface LifeObject {
  id: number;
  object_type_id: number;
  name: string;
  properties: string;
}

interface LifeLinkType {
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

interface LifeAction {
  id: number;
  object_id: number | null;
  name: string;
  description: string;
  status: string;
  execute_at: string | null;
}

interface OntologyEditorProps {
  onDataChange?: () => void;
}

// Form states
type EditMode = 'none' | 'objectType' | 'object' | 'linkType' | 'link' | 'action';
type SubTab = 'objects' | 'relations' | 'actions';

// ============================================================
// MECE 背景说明数据
// ============================================================

interface EditorHelpData {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
}

const EDITOR_HELP: Record<string, EditorHelpData> = {
  objects: {
    title: '对象管理',
    description: '管理"我的人生"中的所有对象。对象是本体论的基本实体，如心态、工作、家庭、身体。',
    scenarios: [
      '新增一个人生对象（如"读书"、"运动"）',
      '更新对象的属性（状态、目标等）',
      '查看所有对象及其关联的类型',
      '删除不再相关的对象'
    ],
    commonErrors: [
      'object_type_id 填写了不存在的类型 ID',
      'properties JSON 格式错误',
      '删除对象前未清理关联的关系',
      '重复插入同名对象导致混淆'
    ],
    aiHints: [
      '输入"新增一个运动对象"，AI 会建议合适的类型和属性',
      '描述"心态状态很差"，AI 会生成更新 state 的 SQL',
      'JSON 属性遵循 key: value 格式，AI 可以帮你格式化',
      '想让 AI 批量生成对象，可以描述"生成 5 个生活习惯"'
    ],
    quickStart: [
      '1. 点击「新建」打开表单',
      '2. 选择对象类型（Aspect/Person/Goal）',
      '3. 填写对象名称',
      '4. 设置 JSON 属性（可选）',
      '5. 保存'
    ],
    bestPractices: [
      '优先使用 Aspect 类型描述生活维度',
      'JSON 属性要有实际意义，不要留空',
      '定期更新对象状态，保持与现实同步',
      '删除对象前先检查是否有关系关联'
    ]
  },
  relations: {
    title: '关系管理',
    description: '管理对象之间的关系。关系是本体论的核心，通过权重量化影响强度。',
    scenarios: [
      '新增一个关系（如"读书→影响→心态"）',
      '调整关系权重（反思后重新评估）',
      '查看所有关系及其强度',
      '删除过时或错误的关系'
    ],
    commonErrors: [
      'source_object_id 或 target_object_id 不存在',
      'weight 值超出 0.0~1.0 范围',
      '创建了循环依赖（自己指向自己）',
      'link_type_id 填写错误类型'
    ],
    aiHints: [
      '输入"工作对心态影响很大"，AI 会建议合适的权重（≥0.8）',
      '描述"最近忽略了读书"，AI 会建议降低相关关系权重',
      '想让 AI 推荐关系，可以描述"A 和 B 之间应该有联系"',
      '权重参考：核心 ≥0.8、重要 0.6~0.8、一般 <0.6'
    ],
    quickStart: [
      '1. 点击「新建」打开表单',
      '2. 选择关系类型（影响/养活/锚定/支撑）',
      '3. 选择源对象和目标对象',
      '4. 设置权重（0.0~1.0）',
      '5. 保存'
    ],
    bestPractices: [
      '权重要有实际依据，不要随意填写',
      '定期"反思"权重设置，保持与现实同步',
      '关注高权重关系，它们代表核心影响链',
      '发现循环依赖时及时清理'
    ]
  },
  actions: {
    title: '行动管理',
    description: '管理被注册但尚未执行的操作。行动是对象和关系之外的第三类实体，代表意图。',
    scenarios: [
      '新增一个行动（如"每天冥想 10 分钟"）',
      '标记行动已完成',
      '删除过期的行动',
      '将关系转化为行动'
    ],
    commonErrors: [
      'execute_at 日期格式错误',
      'status 值不是 pending/done',
      '行动与实际关联对象脱节',
      '积累了太多"待执行"行动'
    ],
    aiHints: [
      '输入"想养成冥想习惯"，AI 会生成相关的行动记录',
      '描述"完成了某件事"，AI 会帮你标记 status=done',
      '想让 AI 建议行动，可以描述"关系权重很低，应该做什么"',
      'execute_at 格式：YYYY-MM-DD'
    ],
    quickStart: [
      '1. 点击「新建」打开表单',
      '2. 填写行动名称',
      '3. 添加描述（可选）',
      '4. 设置执行日期（可选）',
      '5. 保存'
    ],
    bestPractices: [
      '行动要具体，不要太模糊',
      '定期回顾并清理过期行动',
      '完成行动后记得标记为 done',
      '将反思结果转化为具体行动'
    ]
  }
};

// ==================== Sub-components ====================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-monokai-orange/15', text: 'text-monokai-orange', label: '待执行' },
    done: { bg: 'bg-monokai-green/15', text: 'text-monokai-green', label: '已完成' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded ${c.bg} ${c.text} font-medium`}>
      {c.label}
    </span>
  );
};

const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
    <div className="w-full max-w-sm bg-monokai-bg border border-monokai-orange/40 rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-monokai-orange" />
        <h3 className="text-sm font-semibold text-monokai-fg">{title}</h3>
      </div>
      <p className="text-xs text-monokai-comment mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg rounded hover:bg-monokai-accent/20 transition-colors">
          取消
        </button>
        <button onClick={onConfirm} className="px-3 py-1.5 text-xs bg-monokai-orange/20 text-monokai-orange rounded hover:bg-monokai-orange/30 transition-colors font-medium">
          确认删除
        </button>
      </div>
    </div>
  </div>
);

// ============================================================
// Date normalization helper
// DuckDB returns DATE fields as epoch ms, Date objects, or ISO strings.
// HTML date input needs 'YYYY-MM-DD', DuckDB SQL needs 'YYYY-MM-DD'.
// ============================================================
function normalizeDateToString(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  if (typeof raw === 'number' && raw > 1e8) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

const OntologyEditor: React.FC<OntologyEditorProps> = ({ onDataChange }) => {
  // Data state
  const [objectTypes, setObjectTypes] = useState<LifeObjectType[]>([]);
  const [objects, setObjects] = useState<LifeObject[]>([]);
  const [linkTypes, setLinkTypes] = useState<LifeLinkType[]>([]);
  const [links, setLinks] = useState<LifeLink[]>([]);
  const [actions, setActions] = useState<LifeAction[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const [needsSeedData, setNeedsSeedData] = useState(false);
  const [initting, setInitting] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>('objects');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    objectTypes: true,
    linkTypes: true,
  });

  // Edit state
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editTarget, setEditTarget] = useState<any>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; label: string } | null>(null);

  // Message toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form values
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formObjectTypeId, setFormObjectTypeId] = useState<number>(1);
  const [formProperties, setFormProperties] = useState('');
  const [formLinkTypeId, setFormLinkTypeId] = useState<number>(1);
  const [formSourceId, setFormSourceId] = useState<number | null>(null);
  const [formTargetId, setFormTargetId] = useState<number | null>(null);
  const [formWeight, setFormWeight] = useState(0.5);
  const [formStatus, setFormStatus] = useState('pending');
  const [formExecuteAt, setFormExecuteAt] = useState('');
  const [formActionObjectId, setFormActionObjectId] = useState<number | null>(null);

  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');

  // 帮助面板状态
  const [showHelp, setShowHelp] = useState(false);
  const [showHelpTab, setShowHelpTab] = useState<string>('objects');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  /**
   * 自动初始化：检测表是否存在 → 自动创建缺失的表 → 判断是否需要种子数据
   * 避免直接查询产生 "table does not exist" 错误
   */
  // 防重复调用标志
  const initInProgressRef = React.useRef(false);

  const checkAndInit = useCallback(async () => {
    // 防止重复调用
    if (initInProgressRef.current) {
      console.log('[OntologyEditor] Init in progress, skipping duplicate call');
      return;
    }
    initInProgressRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const requiredTables = ['life_object_type', 'life_object', 'life_link_type', 'life_link', 'life_action'];
      const missingTables: string[] = [];

      for (const table of requiredTables) {
        try {
          await duckDBService.query(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch {
          missingTables.push(table);
        }
      }

      // 有缺失的表 → 自动建表（使用 IF NOT EXISTS）
      if (missingTables.length > 0) {
        console.log(`[OntologyEditor] Auto-creating missing tables: ${missingTables.join(', ')}`);
        const createStatements = [
          `CREATE TABLE IF NOT EXISTS life_object_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
          `CREATE TABLE IF NOT EXISTS life_object (id INTEGER PRIMARY KEY, object_type_id INTEGER REFERENCES life_object_type(id), name VARCHAR NOT NULL, properties JSON DEFAULT '{}')`,
          `CREATE TABLE IF NOT EXISTS life_link_type (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR)`,
          `CREATE TABLE IF NOT EXISTS life_link (id INTEGER PRIMARY KEY, link_type_id INTEGER REFERENCES life_link_type(id), source_object_id INTEGER REFERENCES life_object(id), target_object_id INTEGER REFERENCES life_object(id), weight DECIMAL(3,2) DEFAULT 1.0)`,
          `CREATE TABLE IF NOT EXISTS life_action (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR, status VARCHAR DEFAULT 'pending', execute_at DATE)`
        ];

        for (const sql of createStatements) {
          try {
            await duckDBService.query(sql);
          } catch (e: any) {
            console.warn('[OntologyEditor] Table creation error:', e.message);
          }
        }
        setNeedsSeedData(true);
        setNeedsInit(false);
        setLoading(false);
        initInProgressRef.current = false;
        return;
      }

      // 表都存在 → 检查是否有种子数据
      const result = await duckDBService.query('SELECT COUNT(*) as cnt FROM life_object_type');
      const rowCount = result?.[0]?.cnt ?? 0;
      if (Number(rowCount) === 0) {
        setNeedsSeedData(true);
        setNeedsInit(false);
      } else {
        setNeedsSeedData(false);
        setNeedsInit(false);
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

  /** 导入种子数据（若表不存在则先自动建表） */
  const handleSeedData = async () => {
    setInitting(true);
    try {
      // 使用统一的 ontologyDataModel 常量，不再硬编码
      for (const sql of ONTOLOGY_CREATE_STATEMENTS) {
        try { await duckDBService.query(sql); } catch (e: any) { console.warn('[OntologyEditor] Table creation error:', e.message); }
      }
      for (const sql of ONTOLOGY_SEED_STATEMENTS) {
        try { await duckDBService.query(sql); } catch (e: any) { console.warn('[OntologyEditor] Seed data error:', e.message); }
      }

      // 验证导入结果
      const [objResult, ltResult] = await Promise.all([
        duckDBService.query('SELECT COUNT(*) as cnt FROM life_object'),
        duckDBService.query('SELECT COUNT(*) as cnt FROM life_link_type'),
      ]);
      const objCount = Number(objResult?.[0]?.cnt ?? 0);
      const ltCount = Number(ltResult?.[0]?.cnt ?? 0);
      if (objCount === 0 || ltCount === 0) {
        // 疑似导入失败：可能是 ID 冲突，尝试 TRUNCATE 后重试
        console.warn('[OntologyEditor] Seed data verification failed (0 rows). Retrying with TRUNCATE...');
        await duckDBService.query('TRUNCATE TABLE life_object');
        await duckDBService.query('TRUNCATE TABLE life_link');
        await duckDBService.query('TRUNCATE TABLE life_object_type');
        await duckDBService.query('TRUNCATE TABLE life_action');
        for (const sql of ONTOLOGY_SEED_STATEMENTS) {
          try { await duckDBService.query(sql); } catch (e2: any) { console.warn('[OntologyEditor] Retry seed error:', e2.message); }
        }
        const retryResult = await duckDBService.query('SELECT COUNT(*) as cnt FROM life_object');
        if (Number(retryResult?.[0]?.cnt ?? 0) === 0) {
          setError('种子数据导入失败，请检查数据库状态');
          setInitting(false);
          return;
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

  useEffect(() => {
    checkAndInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: object type name lookup
  const objectTypeMap = useMemo(() => {
    const m: Record<number, string> = {};
    objectTypes.forEach(ot => { m[ot.id] = ot.name; });
    return m;
  }, [objectTypes]);

  const linkTypeMap = useMemo(() => {
    const m: Record<number, string> = {};
    linkTypes.forEach(lt => { m[lt.id] = lt.name; });
    return m;
  }, [linkTypes]);

  const objectNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    objects.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [objects]);

  // Filtered lists
  const filteredObjects = useMemo(() => {
    if (!searchTerm) return objects;
    const t = searchTerm.toLowerCase();
    return objects.filter(o =>
      o.name.toLowerCase().includes(t) ||
      objectTypeMap[o.object_type_id]?.toLowerCase().includes(t)
    );
  }, [objects, searchTerm, objectTypeMap]);

  const filteredLinks = useMemo(() => {
    if (!searchTerm) return links;
    const t = searchTerm.toLowerCase();
    return links.filter(l => {
      const srcName = objectNameMap[l.source_object_id] || '';
      const tgtName = objectNameMap[l.target_object_id] || '';
      const ltName = linkTypeMap[l.link_type_id] || '';
      return srcName.toLowerCase().includes(t) ||
             tgtName.toLowerCase().includes(t) ||
             ltName.toLowerCase().includes(t);
    });
  }, [links, searchTerm, objectNameMap, linkTypeMap]);

  // Form helpers
  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormObjectTypeId(1);
    setFormProperties('');
    setFormLinkTypeId(1);
    setFormSourceId(null);
    setFormTargetId(null);
    setFormWeight(0.5);
    setFormStatus('pending');
    setFormExecuteAt('');
    setFormActionObjectId(null);
  };

  const openCreate = (mode: EditMode) => {
    setEditMode(mode);
    setEditTarget(null);
    resetForm();
  };

  const openEdit = (mode: EditMode, target: any) => {
    setEditMode(mode);
    setEditTarget(target);
    if (mode === 'objectType') {
      setFormName(target.name);
      setFormDesc(target.description || '');
    } else if (mode === 'object') {
      setFormName(target.name);
      setFormObjectTypeId(target.object_type_id);
      setFormProperties(target.properties || '');
    } else if (mode === 'linkType') {
      setFormName(target.name);
      setFormDesc(target.description || '');
    } else if (mode === 'link') {
      setFormLinkTypeId(target.link_type_id);
      setFormSourceId(target.source_object_id);
      setFormTargetId(target.target_object_id);
      setFormWeight(target.weight);
    } else if (mode === 'action') {
      setFormName(target.name);
      setFormDesc(target.description || '');
      setFormStatus(target.status || 'pending');
      setFormExecuteAt(normalizeDateToString(target.execute_at));
      setFormActionObjectId(target.object_id || null);
    }
  };

  const closeEdit = () => {
    setEditMode('none');
    setEditTarget(null);
    resetForm();
  };

  // CRUD Operations
  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('名称不能为空', 'error');
      return;
    }
    try {
      if (editMode === 'objectType') {
        if (editTarget) {
          await duckDBService.query(`UPDATE life_object_type SET name='${formName}', description='${formDesc}' WHERE id=${editTarget.id}`);
          showToast('对象类型已更新', 'success');
        } else {
          const maxId = objectTypes.length > 0 ? Math.max(...objectTypes.map(o => o.id)) : 0;
          await duckDBService.query(`INSERT INTO life_object_type VALUES (${maxId + 1}, '${formName}', '${formDesc}')`);
          showToast('对象类型已创建', 'success');
        }
      } else if (editMode === 'object') {
        const props = formProperties.trim() || '{}';
        if (editTarget) {
          await duckDBService.query(`UPDATE life_object SET object_type_id=${formObjectTypeId}, name='${formName}', properties='${props}' WHERE id=${editTarget.id}`);
          showToast('对象已更新', 'success');
        } else {
          const maxId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) : 0;
          await duckDBService.query(`INSERT INTO life_object VALUES (${maxId + 1}, ${formObjectTypeId}, '${formName}', '${props}')`);
          showToast('对象已创建', 'success');
        }
      } else if (editMode === 'linkType') {
        if (editTarget) {
          await duckDBService.query(`UPDATE life_link_type SET name='${formName}', description='${formDesc}' WHERE id=${editTarget.id}`);
          showToast('关系类型已更新', 'success');
        } else {
          const maxId = linkTypes.length > 0 ? Math.max(...linkTypes.map(l => l.id)) : 0;
          await duckDBService.query(`INSERT INTO life_link_type VALUES (${maxId + 1}, '${formName}', '${formDesc}')`);
          showToast('关系类型已创建', 'success');
        }
      } else if (editMode === 'link') {
        if (formSourceId === null || formTargetId === null) {
          showToast('请选择源对象和目标对象', 'error');
          return;
        }
        if (editTarget) {
          await duckDBService.query(`UPDATE life_link SET link_type_id=${formLinkTypeId}, source_object_id=${formSourceId}, target_object_id=${formTargetId}, weight=${formWeight} WHERE id=${editTarget.id}`);
          showToast('关系已更新', 'success');
        } else {
          const maxId = links.length > 0 ? Math.max(...links.map(l => l.id)) : 0;
          await duckDBService.query(`INSERT INTO life_link VALUES (${maxId + 1}, ${formLinkTypeId}, ${formSourceId}, ${formTargetId}, ${formWeight})`);
          showToast('关系已创建', 'success');
        }
      } else if (editMode === 'action') {
        const execDate = formExecuteAt ? `'${normalizeDateToString(formExecuteAt)}'` : 'NULL';
        const objId = formActionObjectId ? formActionObjectId : 'NULL';
        if (editTarget) {
          await duckDBService.query(`UPDATE life_action SET object_id=${objId}, name='${formName}', description='${formDesc}', status='${formStatus}', execute_at=${execDate} WHERE id=${editTarget.id}`);
          showToast('行动已更新', 'success');
        } else {
          const maxId = actions.length > 0 ? Math.max(...actions.map(a => a.id)) : 0;
          await duckDBService.query(`INSERT INTO life_action VALUES (${maxId + 1}, ${objId}, '${formName}', '${formDesc}', '${formStatus}', ${execDate})`);
          showToast('行动已创建', 'success');
        }
      }
      closeEdit();
      await checkAndInit();
      onDataChange?.();
    } catch (e: any) {
      showToast(`操作失败: ${e.message}`, 'error');
    }
  };

  const handleDelete = async (type: string, id: number, label: string) => {
    setDeleteConfirm({ type, id, label });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    try {
      if (type === 'objectType') {
        await duckDBService.query(`DELETE FROM life_object_type WHERE id=${id}`);
      } else if (type === 'object') {
        await duckDBService.query(`DELETE FROM life_object WHERE id=${id}`);
      } else if (type === 'linkType') {
        await duckDBService.query(`DELETE FROM life_link_type WHERE id=${id}`);
      } else if (type === 'link') {
        await duckDBService.query(`DELETE FROM life_link WHERE id=${id}`);
      } else if (type === 'action') {
        await duckDBService.query(`DELETE FROM life_action WHERE id=${id}`);
      }
      showToast('删除成功', 'success');
      setDeleteConfirm(null);
      await checkAndInit();
      onDataChange?.();
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, 'error');
      setDeleteConfirm(null);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Render form overlay
  const renderFormOverlay = () => {
    if (editMode === 'none') return null;

    const titleMap: Record<EditMode, string> = {
      none: '',
      objectType: editTarget ? '编辑对象类型' : '新建对象类型',
      object: editTarget ? '编辑对象' : '新建对象',
      linkType: editTarget ? '编辑关系类型' : '新建关系类型',
      link: editTarget ? '编辑关系' : '新建关系',
      action: editTarget ? '编辑行动' : '新建行动',
    };

    const iconMap: Record<EditMode, React.ReactNode> = {
      none: null,
      objectType: <Layers className="w-4 h-4 text-monokai-purple" />,
      object: <Database className="w-4 h-4 text-monokai-blue" />,
      linkType: <Link2 className="w-4 h-4 text-monokai-green" />,
      link: <ArrowRight className="w-4 h-4 text-monokai-orange" />,
      action: <Zap className="w-4 h-4 text-monokai-yellow" />,
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeEdit}>
        <div className="w-full max-w-lg bg-monokai-bg border border-monokai-accent/50 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-monokai-accent">
            <div className="flex items-center gap-2">
              {iconMap[editMode]}
              <span className="text-sm font-semibold text-monokai-fg">{titleMap[editMode]}</span>
            </div>
            <button onClick={closeEdit} className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4">
            {/* Common: Name */}
            <div>
              <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                名称 <span className="text-monokai-orange">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="输入名称..."
                className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 focus:border-monokai-purple/50 transition-all"
              />
            </div>

            {/* Object type: Description */}
            {(editMode === 'objectType' || editMode === 'linkType') && (
              <div>
                <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="输入描述..."
                  className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 focus:border-monokai-purple/50 transition-all"
                />
              </div>
            )}

            {/* Object: Type select */}
            {editMode === 'object' && (
              <>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    对象类型
                  </label>
                  <select
                    value={formObjectTypeId}
                    onChange={e => setFormObjectTypeId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 focus:border-monokai-purple/50 transition-all"
                  >
                    {objectTypes.map(ot => (
                      <option key={ot.id} value={ot.id}>{ot.name} — {ot.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    属性 (JSON)
                  </label>
                  <textarea
                    value={formProperties}
                    onChange={e => setFormProperties(e.target.value)}
                    placeholder='{"state": "焦虑", "goal": "内心平静"}'
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 focus:border-monokai-purple/50 transition-all resize-none font-mono"
                  />
                </div>
              </>
            )}

            {/* Link: Source, Type, Target, Weight */}
            {editMode === 'link' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                      源对象
                    </label>
                    <select
                      value={formSourceId ?? ''}
                      onChange={e => setFormSourceId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                    >
                      <option value="">选择源对象</option>
                      {objects.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                      目标对象
                    </label>
                    <select
                      value={formTargetId ?? ''}
                      onChange={e => setFormTargetId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                    >
                      <option value="">选择目标对象</option>
                      {objects.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    关系类型
                  </label>
                  <select
                    value={formLinkTypeId}
                    onChange={e => setFormLinkTypeId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                  >
                    {linkTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name} — {lt.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    强度权重: <span className="text-monokai-fg font-mono">{formWeight.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={formWeight}
                    onChange={e => setFormWeight(parseFloat(e.target.value))}
                    className="w-full accent-monokai-purple"
                  />
                  <div className="flex justify-between text-[9px] text-monokai-comment mt-0.5">
                    <span>弱 (0)</span>
                    <span>中 (0.5)</span>
                    <span>强 (1.0)</span>
                  </div>
                </div>
                {/* Visual preview */}
                {formSourceId !== null && formTargetId !== null && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-monokai-sidebar/50 rounded-lg border border-monokai-accent/30">
                    <span className="px-2 py-1 bg-monokai-purple/15 text-monokai-purple text-xs rounded font-medium">
                      {objects.find(o => o.id === formSourceId)?.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-monokai-comment" />
                    <span className="px-2 py-1 bg-monokai-green/15 text-monokai-green text-xs rounded font-medium">
                      {linkTypes.find(lt => lt.id === formLinkTypeId)?.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-monokai-comment" />
                    <span className="px-2 py-1 bg-monokai-blue/15 text-monokai-blue text-xs rounded font-medium">
                      {objects.find(o => o.id === formTargetId)?.name}
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 bg-monokai-orange/15 text-monokai-orange text-[10px] rounded font-mono">
                      {formWeight.toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Action: Description, Status, Execute date */}
            {editMode === 'action' && (
              <>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    关联本体对象
                  </label>
                  <select
                    value={formActionObjectId ?? ''}
                    onChange={e => setFormActionObjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                  >
                    <option value="">(不关联对象)</option>
                    {objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    描述
                  </label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="描述这个行动..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    状态
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                  >
                    <option value="pending">待执行</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-monokai-comment uppercase tracking-wider mb-1">
                    执行日期
                  </label>
                  <input
                    type="date"
                    value={formExecuteAt}
                    onChange={e => setFormExecuteAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 transition-all"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-monokai-accent bg-monokai-sidebar/30">
            <button onClick={closeEdit} className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg rounded hover:bg-monokai-accent/20 transition-colors">
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-monokai-green/20 text-monokai-green rounded-lg hover:bg-monokai-green/30 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Stats
  const stats = useMemo(() => ({
    objectTypes: objectTypes.length,
    objects: objects.length,
    linkTypes: linkTypes.length,
    links: links.length,
    actions: actions.length,
    avgWeight: links.length > 0 ? links.reduce((s, l) => s + l.weight, 0) / links.length : 0,
  }), [objectTypes, objects, linkTypes, links, actions]);

  // 帮助面板标签切换
  const helpTabId = activeTab === 'relations' ? 'relations' : activeTab === 'actions' ? 'actions' : 'objects';
  const currentHelp = EDITOR_HELP[helpTabId];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 text-monokai-purple animate-spin" />
          <p className="text-sm text-monokai-comment">加载本体论数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm p-6">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-monokai-orange opacity-50" />
          <p className="text-sm text-monokai-orange mb-2">加载失败</p>
          <p className="text-xs text-monokai-comment mb-4">{error}</p>
          <p className="text-xs text-monokai-comment">请先在「Learn」视图中点击「初始化」加载示例数据</p>
        </div>
      </div>
    );
  }

  if (needsSeedData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <Table2 className="w-12 h-12 mx-auto mb-4 text-monokai-blue opacity-50" />
          <p className="text-sm text-monokai-fg font-medium mb-2">本体论已就绪，请导入种子数据</p>
          <p className="text-xs text-monokai-comment mb-5">五张核心表已创建。点击下方按钮导入预设数据，开启完整体验</p>
          <button
            onClick={handleSeedData}
            disabled={initting}
            className="flex items-center gap-2 mx-auto px-4 py-2 text-xs font-medium bg-monokai-blue/20 text-monokai-blue rounded-lg hover:bg-monokai-blue/30 transition-colors disabled:opacity-50"
          >
            {initting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {initting ? '导入中...' : '一键导入种子数据'}
          </button>
        </div>
      </div>
    );
  }

  if (needsInit) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <Table2 className="w-12 h-12 mx-auto mb-4 text-monokai-purple opacity-50" />
          <p className="text-sm text-monokai-fg font-medium mb-2">本体论尚未初始化</p>
          <p className="text-xs text-monokai-comment mb-5">点击下方按钮创建五张核心表并导入种子数据</p>
          <button
            onClick={handleSeedData}
            disabled={initting}
            className="flex items-center gap-2 mx-auto px-4 py-2 text-xs font-medium bg-monokai-purple/20 text-monokai-purple rounded-lg hover:bg-monokai-purple/30 transition-colors disabled:opacity-50"
          >
            {initting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {initting ? '初始化中...' : '一键初始化本体论'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-monokai-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-monokai-accent/50 bg-monokai-sidebar">
        <div className="flex items-center gap-3">
          <Table2 className="w-4 h-4 text-monokai-purple" />
          <span className="text-sm font-semibold text-monokai-fg">本体论管理</span>
          <div className="flex items-center gap-3 text-[10px] text-monokai-comment">
            <span>类型 <strong className="text-monokai-purple">{stats.objectTypes}</strong></span>
            <span>对象 <strong className="text-monokai-blue">{stats.objects}</strong></span>
            <span>关系 <strong className="text-monokai-green">{stats.links}</strong></span>
            <span>行动 <strong className="text-monokai-orange">{stats.actions}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 帮助按钮 */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                showHelp
                  ? 'bg-monokai-yellow/20 text-monokai-yellow'
                  : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/10'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            帮助
          </button>

          {/* 快速清除按钮 */}
          <button
            onClick={() => {
              setEditMode('none');
              setEditTarget(null);
              setFormName('');
              setFormDesc('');
              setFormObjectTypeId(1);
              setFormProperties('');
              setFormLinkTypeId(1);
              setFormSourceId(null);
              setFormTargetId(null);
              setFormWeight(0.5);
              setFormStatus('pending');
              setFormExecuteAt('');
              setSearchTerm('');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-monokai-pink/10 border border-monokai-pink/40 text-monokai-pink hover:bg-monokai-pink/20 transition-colors"
            title="一键清空所有表单和搜索"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            清除
          </button>

          <button
            onClick={checkAndInit}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-monokai-accent/30 bg-monokai-sidebar/30">
        <button
          onClick={() => setActiveTab('objects')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
            activeTab === 'objects'
              ? 'bg-monokai-blue/20 text-monokai-blue'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          对象管理
        </button>
        <button
          onClick={() => setActiveTab('relations')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
            activeTab === 'relations'
              ? 'bg-monokai-green/20 text-monokai-green'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          关系管理
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
            activeTab === 'actions'
              ? 'bg-monokai-orange/20 text-monokai-orange'
              : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          行动管理
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-monokai-comment" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索..."
              className="pl-7 pr-3 py-1 text-xs bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment/50 rounded focus:outline-none focus:ring-1 focus:ring-monokai-purple/50 w-36"
            />
          </div>
        </div>
      </div>

      {/* 帮助面板 */}
      {showHelp && currentHelp && (
        <div className="px-4 py-2.5 border-b border-monokai-accent/30 bg-monokai-sidebar/30">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-monokai-yellow shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-monokai-fg mb-2">{currentHelp.title} — {currentHelp.description}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
                <div>
                  <div className="flex items-center gap-1 text-monokai-green/90 font-medium mb-1">
                    <TargetIcon className="w-3 h-3" /> 适用场景
                  </div>
                  <ul className="space-y-0.5 text-monokai-comment">
                    {currentHelp.scenarios.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-monokai-pink/90 font-medium mb-1">
                    <AlertIcon className="w-3 h-3" /> 常见错误
                  </div>
                  <ul className="space-y-0.5 text-monokai-comment">
                    {currentHelp.commonErrors.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-monokai-purple/90 font-medium mb-1">
                    <Sparkles className="w-3 h-3" /> AI 协作提示
                  </div>
                  <ul className="space-y-0.5 text-monokai-comment">
                    {currentHelp.aiHints.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* === OBJECTS TAB === */}
        {activeTab === 'objects' && (
          <div className="space-y-4">
            {/* Object Types section */}
            <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('objectTypes')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-purple/5 hover:bg-monokai-purple/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-monokai-purple" />
                  <span className="text-xs font-semibold text-monokai-fg">对象类型</span>
                  <span className="text-[10px] text-monokai-comment">({objectTypes.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); openCreate('objectType'); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-purple/15 text-monokai-purple rounded hover:bg-monokai-purple/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 新建
                  </button>
                  {expandedSections.objectTypes ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
                </div>
              </button>
              {expandedSections.objectTypes && (
                <div className="divide-y divide-monokai-accent/20">
                  {objectTypes.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无对象类型</div>
                  ) : objectTypes.map(ot => (
                    <div key={ot.id} className="flex items-center justify-between px-4 py-2 hover:bg-monokai-accent/5 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-sm bg-monokai-purple shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-monokai-fg truncate">{ot.name}</div>
                          {ot.description && <div className="text-[10px] text-monokai-comment truncate">{ot.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit('objectType', ot)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete('objectType', ot.id, ot.name)} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Objects section */}
            <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('objects')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-blue/5 hover:bg-monokai-blue/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-monokai-blue" />
                  <span className="text-xs font-semibold text-monokai-fg">对象实例</span>
                  <span className="text-[10px] text-monokai-comment">({filteredObjects.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); openCreate('object'); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-blue/15 text-monokai-blue rounded hover:bg-monokai-blue/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 新建
                  </button>
                  {expandedSections.objects ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
                </div>
              </button>
              {expandedSections.objects && (
                <div className="divide-y divide-monokai-accent/20">
                  {filteredObjects.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-monokai-comment text-center">
                      {objects.length === 0 ? '暂无对象 — 请先初始化示例数据' : '无搜索结果'}
                    </div>
                  ) : filteredObjects.map(obj => {
                    let props: Record<string, string> = {};
                    try { props = JSON.parse(obj.properties || '{}'); } catch {}
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
                          <button onClick={() => openEdit('object', obj)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete('object', obj.id, obj.name)} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === RELATIONS TAB === */}
        {activeTab === 'relations' && (
          <div className="space-y-4">
            {/* Link Types */}
            <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('linkTypes')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-green/5 hover:bg-monokai-green/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-monokai-green" />
                  <span className="text-xs font-semibold text-monokai-fg">关系类型</span>
                  <span className="text-[10px] text-monokai-comment">({linkTypes.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); openCreate('linkType'); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-green/15 text-monokai-green rounded hover:bg-monokai-green/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 新建
                  </button>
                  {expandedSections.linkTypes ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
                </div>
              </button>
              {expandedSections.linkTypes && (
                <div className="divide-y divide-monokai-accent/20">
                  {linkTypes.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-monokai-comment text-center">暂无关系类型</div>
                  ) : linkTypes.map(lt => (
                    <div key={lt.id} className="flex items-center justify-between px-4 py-2 hover:bg-monokai-accent/5 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-sm bg-monokai-green shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-monokai-fg truncate">{lt.name}</div>
                          {lt.description && <div className="text-[10px] text-monokai-comment truncate">{lt.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit('linkType', lt)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete('linkType', lt.id, lt.name)} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Links */}
            <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('links')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-monokai-orange/5 hover:bg-monokai-orange/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-monokai-orange" />
                  <span className="text-xs font-semibold text-monokai-fg">关系实例</span>
                  <span className="text-[10px] text-monokai-comment">({filteredLinks.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); openCreate('link'); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-orange/15 text-monokai-orange rounded hover:bg-monokai-orange/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 新建
                  </button>
                  {expandedSections.links ? <ChevronDown className="w-4 h-4 text-monokai-comment" /> : <ChevronRight className="w-4 h-4 text-monokai-comment" />}
                </div>
              </button>
              {expandedSections.links && (
                <div className="divide-y divide-monokai-accent/20">
                  {filteredLinks.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-monokai-comment text-center">
                      {links.length === 0 ? '暂无关系 — 请先初始化示例数据' : '无搜索结果'}
                    </div>
                  ) : filteredLinks.map(link => (
                    <div key={link.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-monokai-accent/5 transition-colors group">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-monokai-purple shrink-0">{objectNameMap[link.source_object_id] || `?(${link.source_object_id})`}</span>
                        <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                        <span className="px-1.5 py-0.5 text-[9px] bg-monokai-green/15 text-monokai-green rounded shrink-0">{linkTypeMap[link.link_type_id] || '?'}</span>
                        <ArrowRight className="w-3 h-3 text-monokai-comment shrink-0" />
                        <span className="text-xs text-monokai-blue shrink-0">{objectNameMap[link.target_object_id] || `?(${link.target_object_id})`}</span>
                        <span className="ml-1 px-1 py-0.5 text-[10px] font-mono bg-monokai-orange/10 text-monokai-orange rounded shrink-0">
                          {Number(link.weight).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button onClick={() => openEdit('link', link)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete('link', link.id, `${objectNameMap[link.source_object_id]} → ${linkTypeMap[link.link_type_id]} → ${objectNameMap[link.target_object_id]}`)} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ACTIONS TAB === */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="border border-monokai-accent/30 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-monokai-yellow/5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-monokai-yellow" />
                  <span className="text-xs font-semibold text-monokai-fg">行动列表</span>
                  <span className="text-[10px] text-monokai-comment">({actions.length})</span>
                </div>
                <button
                  onClick={() => openCreate('action')}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-monokai-yellow/15 text-monokai-yellow rounded hover:bg-monokai-yellow/25 transition-colors"
                >
                  <Plus className="w-3 h-3" /> 新建
                </button>
              </div>
              <div className="divide-y divide-monokai-accent/20">
                {actions.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-monokai-comment text-center">
                    暂无行动 — 点击「新建」添加你的第一个行动
                  </div>
                ) : actions.map(action => (
                  <div key={action.id} className="flex items-center justify-between px-4 py-3 hover:bg-monokai-accent/5 transition-colors group">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {action.status === 'done'
                          ? <Check className="w-4 h-4 text-monokai-green" />
                          : <div className="w-4 h-4 rounded border-2 border-monokai-comment/40" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-medium text-monokai-fg truncate">{action.name}</div>
                          <StatusBadge status={action.status} />
                        </div>
                        {action.description && (
                          <div className="text-[10px] text-monokai-comment mt-0.5 truncate">{action.description}</div>
                        )}
                        {action.execute_at && (
                          <div className="text-[9px] text-monokai-purple/60 mt-0.5">执行日期: {action.execute_at}</div>
                        )}
                        {action.object_id && (
                          <div className="text-[9px] text-monokai-blue/60 mt-0.5 flex items-center gap-1">
                            <TargetIcon className="w-2.5 h-2.5" />
                            关联: {objectNameMap[action.object_id] || action.object_id}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => openEdit('action', action)} className="p-1 rounded text-monokai-comment hover:text-monokai-blue hover:bg-monokai-blue/10">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete('action', action.id, action.name)} className="p-1 rounded text-monokai-comment hover:text-monokai-orange hover:bg-monokai-orange/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除「${deleteConfirm.label}」吗？此操作不可撤销。`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Form Overlay */}
      {renderFormOverlay()}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-2xl text-xs font-medium animate-pulse ${
          toast.type === 'success'
            ? 'bg-monokai-green/20 text-monokai-green border border-monokai-green/30'
            : 'bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/30'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default OntologyEditor;
