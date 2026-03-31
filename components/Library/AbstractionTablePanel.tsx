/**
 * AbstractionTablePanel - 数据抽象表面板
 *
 * 基于 MECE 原则增强的三阶功能：
 * - AI 一键填充：智能生成抽象表 SQL 模板
 * - 快速清除：一键重置筛选和选择
 * - 背景说明：MECE 抽象层级详解与最佳实践
 *
 * 基于 MECE 原则设计的数据抽象层
 * 支持层层展开、快速调用指定能力、即时生成 SQL 模拟方案
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Plus,
  Trash2,
  Search,
  Filter,
  Layers,
  Database,
  Table,
  ArrowRight,
  Sparkles,
  RotateCcw,
  RefreshCw,
  Edit3,
  BookOpen,
  Star,
  Calculator,
  Link2,
  Settings,
  Play,
  X,
  Loader2,
  Lightbulb,
  Target as TargetIcon,
  AlertTriangle as AlertIcon,
  Target,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';

import {
  getAllAbstractionTables,
  saveAbstractionTable,
  deleteAbstractionTable,
  getAllOntologyEntries
} from '../../services/libraryStorage';
import {
  AbstractionTable,
  SqlOperation,
  SqlParameter,
  AbstractionLevel,
  OntologyEntry
} from '../../types';

interface AbstractionTablePanelProps {
  // 完整参数（可选）
  tables?: AbstractionTable[];
  ontologyEntries?: OntologyEntry[];
  onCopy?: (id: string, content: string) => void;
  onInsert?: (sql: string) => void;
  onAdd?: (table: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
  copiedId?: string | null;
}

// 操作类型配置
const OPERATION_CONFIG: Record<SqlOperation, { label: string; color: string; icon: React.ElementType }> = {
  SELECT: { label: '查询', color: 'monokai-blue', icon: Search },
  INSERT: { label: '插入', color: 'monokai-green', icon: Plus },
  UPDATE: { label: '更新', color: 'monokai-yellow', icon: Edit3 },
  DELETE: { label: '删除', color: 'monokai-red', icon: Trash2 },
  AGGREGATE: { label: '聚合', color: 'monokai-purple', icon: Calculator },
  JOIN: { label: '关联', color: 'monokai-pink', icon: Link2 },
  WINDOW: { label: '窗口', color: 'monokai-orange', icon: Layers },
  CTE: { label: 'CTE', color: 'monokai-cyan', icon: Database }
};

// 抽象层级配置
const LEVEL_CONFIG: Record<keyof AbstractionTable['abstractionPath'], { label: string; color: string }> = {
  concept: { label: '概念', color: 'monokai-purple' },
  property: { label: '属性', color: 'monokai-blue' },
  relation: { label: '关系', color: 'monokai-green' },
  instance: { label: '实例', color: 'monokai-yellow' }
};

// ============================================================
// MECE 背景说明数据
// ============================================================

interface AbstractionHelpData {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
}

const ABSTRACTION_HELP: AbstractionHelpData = {
  title: '数据抽象表面板',
  description: '基于 MECE 原则设计的数据抽象层。层层展开：概念 → 属性 → 关系 → 实例，快速调用指定 SQL 能力。',
  scenarios: [
    '需要某个抽象层级的 SQL 模板（如"聚合查询"）',
    '想要复用已有的 SQL 逻辑模板',
    '需要基于"我的人生"场景生成 SQL 方案',
    '构建数据模型时的参考模板'
  ],
  commonErrors: [
    '抽象路径填写不完整，缺少必要层级',
    '表名和字段名使用了占位符而非实际名称',
    '生成的 SQL 未经测试直接执行',
    '忽略参数定义，模板不可复用'
  ],
  aiHints: [
    '描述"我的人生场景：心态→影响→工作"，AI 会生成相关的关系路径抽象',
    '输入"聚合分析"，AI 会建议聚合类型的抽象表模板',
    '想让 AI 生成完整抽象表，可以描述"概念→属性→关系→实例"四层结构',
    'AI 生成的 SQL 需要根据实际表名替换参数'
  ],
  quickStart: [
    '1. 选择领域和操作类型筛选',
    '2. 点击抽象表查看详情',
    '3. 查看 SQL 模板和参数定义',
    '4. 使用「AI 生成」创建新抽象表',
    '5. 插入或复制 SQL 到编辑器'
  ],
  bestPractices: [
    '抽象路径要遵循 MECE 原则：概念→属性→关系→实例',
    'SQL 模板使用参数占位符，便于复用',
    '为每个抽象表添加清晰的描述和标签',
    '定期维护抽象表，删除过时模板'
  ]
};

// ============================================================
// AI 生成模板示例
// ============================================================

const AI_GENERATE_TEMPLATES = [
  {
    description: '生成聚合分析表',
    operation: 'AGGREGATE' as SqlOperation,
    concept: '通用',
    hint: '基于 ${concept} 生成聚合统计 SQL'
  },
  {
    description: '生成关联查询表',
    operation: 'JOIN' as SqlOperation,
    concept: '通用',
    hint: '基于 ${concept} 生成 JOIN 查询 SQL'
  },
  {
    description: '生成窗口分析表',
    operation: 'WINDOW' as SqlOperation,
    concept: '通用',
    hint: '基于 ${concept} 生成窗口函数 SQL'
  },
  {
    description: '基于本体论生成',
    operation: 'SELECT' as SqlOperation,
    concept: '我的人生',
    hint: '"我的人生"场景：心态、工作、家庭、身体的关系查询'
  }
];

// 预置数据抽象表示例
const SAMPLE_TABLES: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '用户行为分析',
    description: '用于分析用户在平台上的行为数据',
    abstractionPath: {
      concept: '用户行为',
      property: '访问记录',
      instance: 'user_behavior'
    },
    sqlConfig: {
      operation: 'SELECT',
      template: `SELECT 
  user_id,
  COUNT(*) AS visit_count,
  MAX(visit_time) AS last_visit
FROM user_behavior
WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id`,
      parameters: [
        { name: '${table}', type: 'table', description: '行为表名', defaultValue: 'user_behavior' }
      ],
      sampleOutput: 'user_id | visit_count | last_visit\n101      | 45         | 2024-01-15'
    },
    tags: ['用户', '行为', '分析'],
    domain: '分析',
    isSystem: true,
    isFavorite: false
  },
  {
    name: '订单汇总统计',
    description: '订单金额和数量的汇总统计',
    abstractionPath: {
      concept: '订单',
      property: '金额',
      relation: 'AGGREGATE',
      instance: 'orders'
    },
    sqlConfig: {
      operation: 'AGGREGATE',
      template: `SELECT 
  DATE_TRUNC('day', order_date) AS date,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', order_date)
ORDER BY date DESC`,
      parameters: [
        { name: '${table}', type: 'table', description: '订单表名', defaultValue: 'orders' }
      ],
      sampleOutput: 'date       | order_count | total_amount | avg_amount\n2024-01-15 | 156         | 45678.90     | 292.68'
    },
    tags: ['订单', '汇总', '统计'],
    domain: '电商',
    isSystem: true,
    isFavorite: false
  },
  {
    name: '用户订单关联查询',
    description: '查询用户及其订单详情',
    abstractionPath: {
      concept: '用户',
      relation: 'HAS_MANY',
      instance: 'orders'
    },
    sqlConfig: {
      operation: 'JOIN',
      template: `SELECT 
  u.user_id,
  u.username,
  u.email,
  o.order_id,
  o.order_date,
  o.amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.order_date DESC`,
      parameters: [
        { name: '${user_table}', type: 'table', description: '用户表名', defaultValue: 'users' },
        { name: '${order_table}', type: 'table', description: '订单表名', defaultValue: 'orders' }
      ],
      sampleOutput: 'user_id | username | email           | order_id | order_date | amount\n101     | 张三     | zhangsan@...   | 5001     | 2024-01-15 | 299.00'
    },
    tags: ['用户', '订单', '关联'],
    domain: '电商',
    isSystem: true,
    isFavorite: false
  },
  {
    name: '时间序列窗口分析',
    description: '使用窗口函数进行时间序列分析',
    abstractionPath: {
      concept: '销售数据',
      property: '趋势',
      relation: 'WINDOW',
      instance: 'sales'
    },
    sqlConfig: {
      operation: 'WINDOW',
      template: `SELECT 
  sale_date,
  amount,
  SUM(amount) OVER (ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d_sum,
  AVG(amount) OVER (ORDER BY sale_date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS rolling_30d_avg
FROM sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'`,
      parameters: [
        { name: '${table}', type: 'table', description: '销售表名', defaultValue: 'sales' }
      ],
      sampleOutput: 'sale_date | amount | rolling_7d_sum | rolling_30d_avg\n2024-01-15 | 1234   | 8765          | 5432'
    },
    tags: ['销售', '窗口', '趋势'],
    domain: '分析',
    isSystem: true,
    isFavorite: false
  }
];

export const AbstractionTablePanel: React.FC<AbstractionTablePanelProps> = ({
  tables: propTables,
  ontologyEntries,
  onCopy,
  onInsert,
  onAdd: propOnAdd,
  onDelete: propOnDelete,
  copiedId
}) => {
  // 如果传入 tables 则使用，否则内部加载
  // 为没有 id 的 sample 数据生成临时 id
  const tablesWithIds = useMemo(() => {
    return (propTables || SAMPLE_TABLES).map((t, idx) => ({
      ...t,
      id: t.id || `sample-${idx}`
    }));
  }, [propTables]);
  
  const [tables, setTables] = useState<AbstractionTable[]>(tablesWithIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedOperation, setSelectedOperation] = useState<SqlOperation | 'all'>('all');
  const [selectedTable, setSelectedTable] = useState<AbstractionTable | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 帮助面板状态
  const [showHelp, setShowHelp] = useState(false);
  const [selectedAIGenerateType, setSelectedAIGenerateType] = useState<string>('select');

  // 内部/onAdd/onDelete 函数
  const handleAdd = useCallback(async (table: Omit<AbstractionTable, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (propOnAdd) {
      propOnAdd(table);
    } else {
      // 内部保存
      const saved = await saveAbstractionTable(table);
      setTables(prev => [...prev, saved]);
    }
  }, [propOnAdd]);

  const handleDelete = useCallback(async (id: string) => {
    if (propOnDelete) {
      propOnDelete(id);
    } else {
      // 内部删除
      await deleteAbstractionTable(id);
      setTables(prev => prev.filter(t => t.id !== id));
    }
  }, [propOnDelete]);

  // 加载数据（如果没有传入 tables）
  useEffect(() => {
    if (!propTables) {
      getAllAbstractionTables().then(data => {
        if (data.length > 0) {
          // 为没有 id 的数据生成临时 id
          const dataWithIds = data.map((t, idx) => ({
            ...t,
            id: t.id || `db-${idx}`
          }));
          setTables(dataWithIds);
        }
      });
    }
  }, [propTables]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
        setSelectedTable(null);
        if (showAIPanel) setShowAIPanel(false);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAIPanel(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAIPanel]);

  // 获取领域列表
  const domains = useMemo(() => {
    const domainSet = new Set(tables.map(t => t.domain));
    return Array.from(domainSet);
  }, [tables]);

  // 过滤表格
  const filteredTables = useMemo(() => {
    let result = tables;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (selectedDomain !== 'all') {
      result = result.filter(t => t.domain === selectedDomain);
    }
    
    if (selectedOperation !== 'all') {
      result = result.filter(t => t.sqlConfig.operation === selectedOperation);
    }
    
    return result;
  }, [tables, searchQuery, selectedDomain, selectedOperation]);

  // 快速清除
  const handleQuickClear = useCallback(() => {
    setSearchQuery('');
    setSelectedDomain('all');
    setSelectedOperation('all');
    setSelectedTable(null);
  }, []);

  // 填充示例数据
  const handleFillSamples = useCallback(async () => {
    for (const sample of SAMPLE_TABLES) {
      await handleAdd(sample);
    }
  }, [handleAdd]);

  // AI 生成 SQL（增强版）
  const handleAIGenerate = useCallback(() => {
    if (!aiInput.trim()) return;

    setIsGenerating(true);

    // 基于选择的生成类型和输入生成 SQL
    setTimeout(() => {
      let sql = '';
      const type = selectedAIGenerateType;

      if (type === 'aggregate') {
        sql = `-- 聚合分析抽象表
-- 概念: ${aiInput || '数据'}
SELECT
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  MAX(amount) AS max_amount,
  MIN(amount) AS min_amount
FROM your_table
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;`;
      } else if (type === 'join') {
        sql = `-- 关联查询抽象表
-- 概念: ${aiInput || '数据'}
SELECT
  u.id AS user_id,
  u.name AS user_name,
  o.id AS order_id,
  o.amount AS order_amount,
  o.created_at AS order_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.created_at DESC
LIMIT 100;`;
      } else if (type === 'window') {
        sql = `-- 窗口函数抽象表
-- 概念: ${aiInput || '数据'}
SELECT
  created_at AS date,
  amount,
  SUM(amount) OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d_sum,
  AVG(amount) OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d_avg,
  ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_num
FROM your_table
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';`;
      } else {
        // 基于本体论场景
        sql = `-- 本体论场景: ${aiInput || '我的人生'}
-- 查询所有对象及关系
SELECT
  lo.name AS 对象名称,
  lot.name AS 对象类型,
  ll.weight AS 关系强度
FROM life_object lo
JOIN life_object_type lot ON lo.object_type_id = lot.id
LEFT JOIN life_link ll ON lo.id = ll.source_object_id OR lo.id = ll.target_object_id
ORDER BY ll.weight DESC NULLS LAST;`;
      }

      setGeneratedSQL(sql);
      setIsGenerating(false);
    }, 800);
  }, [aiInput, selectedAIGenerateType]);

  // 渲染抽象层级路径
  const renderAbstractionPath = (path: AbstractionTable['abstractionPath']) => {
    const levels = Object.entries(path).filter(([_, v]) => v);
    
    return (
      <div className="flex items-center gap-1 text-xs">
        {levels.map(([level, value], idx) => (
          <React.Fragment key={level}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-monokai-comment" />}
            <span className={`px-1.5 py-0.5 rounded bg-monokai-${LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].color}/20 text-monokai-${LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].color}`}>
              {value}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* 左侧：表格列表 */}
      <div className="w-80 border-r border-monokai-accent flex flex-col">
        {/* 头部搜索和筛选 */}
        <div className="p-3 border-b border-monokai-accent space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
            <input
              type="text"
              placeholder="搜索数据抽象表..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-monokai-bg border border-monokai-accent rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-purple"
            />
            {searchQuery && (
              <button
                onClick={handleQuickClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-monokai-accent/30 text-monokai-comment"
                title="清除搜索"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 筛选器 */}
          <div className="flex gap-2">
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-monokai-bg border border-monokai-accent rounded text-monokai-fg"
            >
              <option value="all">全部领域</option>
              {domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={selectedOperation}
              onChange={(e) => setSelectedOperation(e.target.value as SqlOperation | 'all')}
              className="flex-1 px-2 py-1 text-xs bg-monokai-bg border border-monokai-accent rounded text-monokai-fg"
            >
              <option value="all">全部操作</option>
              {Object.entries(OPERATION_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 表格列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* 帮助按钮 */}
          <div className="mb-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
                showHelp
                  ? 'bg-monokai-yellow/20 text-monokai-yellow'
                  : 'bg-monokai-sidebar/50 text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/10'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {showHelp ? '收起帮助' : '查看 MECE 帮助'}
            </button>
          </div>

          {/* 帮助面板 */}
          {showHelp && (
            <div className="mb-2 p-3 bg-monokai-sidebar/50 border border-monokai-yellow/20 rounded-lg">
              <div className="text-xs font-semibold text-monokai-yellow mb-2">{ABSTRACTION_HELP.title}</div>
              <div className="text-[10px] text-monokai-comment mb-2">{ABSTRACTION_HELP.description}</div>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-green mb-1">
                    <TargetIcon className="w-3 h-3" /> 适用场景
                  </div>
                  <ul className="space-y-0.5 text-[10px] text-monokai-comment">
                    {ABSTRACTION_HELP.scenarios.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-monokai-pink mb-1">
                    <AlertIcon className="w-3 h-3" /> 常见错误
                  </div>
                  <ul className="space-y-0.5 text-[10px] text-monokai-comment">
                    {ABSTRACTION_HELP.commonErrors.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-monokai-comment mb-2 flex items-center justify-between">
            <span>共 {filteredTables.length} 个抽象表</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 text-monokai-purple hover:underline"
              >
                <Plus className="w-3 h-3" />
                添加
              </button>
            </div>
          </div>

          {filteredTables.map(table => {
            const isSelected = selectedTable?.id === table.id;
            const OpConfig = OPERATION_CONFIG[table.sqlConfig.operation];
            const OpIcon = OpConfig.icon;
            
            return (
              <div
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`p-2 mb-1 rounded-lg cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-monokai-purple/20 border border-monokai-purple/50' 
                    : 'hover:bg-monokai-accent/20 border border-transparent'
                }`}
              >
                {/* 名称和操作类型 */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-monokai-fg">{table.name}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded bg-monokai-${OpConfig.color}/20 text-monokai-${OpConfig.color}`}>
                    {OpConfig.label}
                  </span>
                </div>
                
                {/* 抽象层级路径 */}
                {renderAbstractionPath(table.abstractionPath)}
                
                {/* 标签 */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {table.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs text-monokai-comment">{tag}</span>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredTables.length === 0 && (
            <div className="text-center py-8 text-monokai-comment">
              <Table className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">暂无数据抽象表</p>
              <button 
                onClick={handleFillSamples}
                className="mt-2 text-xs text-monokai-purple hover:underline"
              >
                填充示例数据
              </button>
            </div>
          )}
        </div>

        {/* AI 生成按钮 */}
        <div className="p-2 border-t border-monokai-accent">
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGenerating ? '生成中...' : 'AI 生成抽象表'}</span>
          </button>
        </div>
      </div>

      {/* 中间：详情面板 */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedTable ? (
          <div className="space-y-4">
            {/* 头部信息 */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-monokai-fg">{selectedTable.name}</h3>
                  {selectedTable.isFavorite && (
                    <Star className="w-4 h-4 text-monokai-yellow fill-monokai-yellow" />
                  )}
                  {selectedTable.isSystem && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-monokai-green/20 text-monokai-green">
                      系统预置
                    </span>
                  )}
                </div>
                <p className="text-sm text-monokai-comment">{selectedTable.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onCopy(selectedTable.id, selectedTable.sqlConfig.template)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-monokai-purple/20 text-monokai-purple rounded-lg text-sm hover:bg-monokai-purple/30"
                >
                  {copiedId === selectedTable.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  复制
                </button>
                <button
                  onClick={() => onInsert(selectedTable.sqlConfig.template)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-monokai-blue/20 text-monokai-blue rounded-lg text-sm hover:bg-monokai-blue/30"
                >
                  <ArrowRight className="w-4 h-4" />
                  插入
                </button>
              </div>
            </div>

            {/* 抽象层级路径 */}
            <div>
              <h4 className="text-sm font-medium text-monokai-fg mb-2 flex items-center gap-1">
                <Layers className="w-4 h-4" />
                抽象层级路径
              </h4>
              <div className="p-3 bg-monokai-bg rounded-lg border border-monokai-accent">
                {renderAbstractionPath(selectedTable.abstractionPath)}
              </div>
            </div>

            {/* SQL 配置 */}
            <div>
              <h4 className="text-sm font-medium text-monokai-fg mb-2 flex items-center gap-1">
                <Database className="w-4 h-4" />
                SQL 模板
                <span className={`px-1.5 py-0.5 text-xs rounded bg-monokai-${OPERATION_CONFIG[selectedTable.sqlConfig.operation].color}/20 text-monokai-${OPERATION_CONFIG[selectedTable.sqlConfig.operation].color}`}>
                  {OPERATION_CONFIG[selectedTable.sqlConfig.operation].label}
                </span>
              </h4>
              <div className="p-3 bg-monokai-bg rounded-lg border border-monokai-accent">
                <pre className="text-xs text-monokai-comment font-mono whitespace-pre-wrap">
                  {selectedTable.sqlConfig.template}
                </pre>
              </div>
            </div>

            {/* 参数定义 */}
            {selectedTable.sqlConfig.parameters && selectedTable.sqlConfig.parameters.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-monokai-fg mb-2">参数定义</h4>
                <div className="space-y-2">
                  {selectedTable.sqlConfig.parameters.map((param) => (
                    <div key={param.name} className="flex items-center gap-2 p-2 bg-monokai-bg rounded">
                      <code className="text-xs text-monokai-purple">{param.name}</code>
                      <span className="text-xs text-monokai-comment">- {param.description}</span>
                      {param.defaultValue && (
                        <span className="text-xs text-monokai-green">(默认: {param.defaultValue})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 示例输出 */}
            {selectedTable.sqlConfig.sampleOutput && (
              <div>
                <h4 className="text-sm font-medium text-monokai-fg mb-2">示例输出</h4>
                <div className="p-3 bg-monokai-bg rounded-lg border border-monokai-accent">
                  <pre className="text-xs text-monokai-comment font-mono whitespace-pre-wrap">
                    {selectedTable.sqlConfig.sampleOutput}
                  </pre>
                </div>
              </div>
            )}

            {/* 标签 */}
            <div>
              <h4 className="text-sm font-medium text-monokai-fg mb-2">标签</h4>
              <div className="flex flex-wrap gap-1">
                {selectedTable.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                    {tag}
                  </span>
                ))}
                <span className="px-2 py-1 text-xs bg-monokai-accent/20 text-monokai-comment rounded">
                  {selectedTable.domain}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-monokai-comment">
            <div className="text-center">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>选择一个数据抽象表查看详情</p>
              <p className="text-xs mt-1">或使用 AI 生成新的抽象表</p>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：AI 生成面板 */}
      <div className="w-72 border-l border-monokai-accent bg-monokai-sidebar p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-monokai-purple" />
            <h4 className="text-sm font-bold text-monokai-fg">AI 一键填充</h4>
          </div>
          <button
            onClick={handleQuickClear}
            className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment"
            title="快速清除"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* AI 输入 */}
        <div className="space-y-3">
          <p className="text-xs text-monokai-comment">
            描述你想要的数据分析需求，AI 将自动生成 SQL 抽象表。
          </p>

          {/* 生成类型选择器 */}
          <div className="flex flex-wrap gap-1">
            {[
              { key: 'select', label: '本体论' },
              { key: 'aggregate', label: '聚合' },
              { key: 'join', label: '关联' },
              { key: 'window', label: '窗口' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setSelectedAIGenerateType(t.key)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  selectedAIGenerateType === t.key
                    ? 'bg-monokai-purple/20 text-monokai-purple'
                    : 'bg-monokai-sidebar/50 text-monokai-comment hover:text-monokai-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="例如：用户最近7天的订单汇总，包含订单数、总金额、平均金额"
            className="w-full h-24 px-3 py-2 text-sm bg-monokai-bg border border-monokai-accent rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-purple resize-none"
          />
          
          <button
            onClick={handleAIGenerate}
            disabled={isGenerating || !aiInput.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成 SQL 方案
              </>
            )}
          </button>

          {/* 生成结果 */}
          {generatedSQL && (
            <div className="mt-4 p-3 bg-monokai-bg rounded-lg border border-monokai-purple/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-monokai-purple">生成结果</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onCopy('generated', generatedSQL)}
                    className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment"
                    title="复制"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onInsert(generatedSQL)}
                    className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-blue"
                    title="插入编辑器"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <pre className="text-xs text-monokai-comment font-mono whitespace-pre-wrap">
                {generatedSQL}
              </pre>
            </div>
          )}
        </div>

        {/* 快速操作 */}
        <div className="mt-6 space-y-2">
          <button 
            onClick={handleFillSamples}
            className="w-full flex items-center gap-2 px-3 py-2 bg-monokai-blue/20 text-monokai-blue rounded-lg text-sm hover:bg-monokai-blue/30 transition-colors"
          >
            <Database className="w-4 h-4" />
            填充示例数据
          </button>
        </div>

        {/* 背景说明 */}
        <div className="mt-6 p-3 bg-monokai-purple/10 rounded-lg border border-monokai-purple/30">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-monokai-purple" />
            <span className="text-xs font-medium text-monokai-purple">数据抽象表说明</span>
          </div>
          <p className="text-xs text-monokai-comment mb-2">
            基于 MECE 原则的数据抽象层，实现层层展开的调用路径。
          </p>
          <ul className="text-xs text-monokai-comment space-y-1">
            <li>• <span className="text-monokai-purple">概念(CONCEPT)</span>：业务实体抽象</li>
            <li>• <span className="text-monokai-blue">属性(PROPERTY)</span>：特征与度量</li>
            <li>• <span className="text-monokai-green">关系(RELATION)</span>：表间关联逻辑</li>
            <li>• <span className="text-monokai-yellow">实例(INSTANCE)</span>：具体表名与字段</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AbstractionTablePanel;
