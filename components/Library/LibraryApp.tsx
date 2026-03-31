/**
 * Library App - 主知识库组件
 *
 * 四大分区：速查卡片、SQL模板、学习路径、个人收藏
 * 实现 MECE 原则的信息架构
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  BookOpen,
  FileCode,
  GraduationCap,
  Star,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Info,
  RotateCcw,
  Wand2,
  Copy,
  Check,
  ExternalLink,
  Tag,
  Clock,
  Trash2,
  Edit3,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Library,
  Layers
} from 'lucide-react';

// 子组件
import { ReferenceCardsPanel } from './ReferenceCardsPanel';
import { SqlTemplatesPanel } from './SqlTemplatesPanel';
import { LearningPathPanel } from './LearningPathPanel';
import { MySnippetsPanel } from './MySnippetsPanel';
import { MetaKnowledgePanel } from './MetaKnowledgePanel';
import { DDLPanel } from './DDLPanel';
import { DMLPanel } from './DMLPanel';
import { DQLPanel } from './DQLPanel';
import { FunctionsPanel } from './FunctionsPanel';
import { DCLTCLPanel } from './DCLTCLPanel';
import { OptimizationPanel } from './OptimizationPanel';

import { LibraryTab, ReferenceCard, SqlTemplate, LearningStage, CodeSnippet } from '../../types';
import {
  getAllReferenceCards,
  getAllSqlTemplates,
  getAllLearningProgress,
  getAllCodeSnippets,
  saveReferenceCard,
  saveSqlTemplate,
  saveCodeSnippet,
  deleteReferenceCard,
  deleteSqlTemplate,
  deleteCodeSnippet,
  toggleSnippetFavorite,
  markNodeCompleted,
  initializeSystemData
} from '../../services/libraryStorage';

interface LibraryAppProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToEditor?: (sql: string) => void;
  onNavigateToSkill?: (skillId: string) => void;
}

const TAB_CONFIG = [
  { id: 'meta' as LibraryTab, label: '元知识', icon: BookOpen, color: 'blue' },
  { id: 'ddl' as LibraryTab, label: 'DDL', icon: FileCode, color: 'green' },
  { id: 'dml' as LibraryTab, label: 'DML', icon: FileCode, color: 'orange' },
  { id: 'dql' as LibraryTab, label: 'DQL', icon: Search, color: 'cyan' },
  { id: 'functions' as LibraryTab, label: '函数库', icon: Sparkles, color: 'yellow' },
  { id: 'dcl' as LibraryTab, label: 'DCL/TCL', icon: Layers, color: 'red' },
  { id: 'optimization' as LibraryTab, label: '性能优化', icon: GraduationCap, color: 'purple' }
];

const TAB_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  meta: { bg: 'bg-monokai-blue/10', border: 'border-monokai-blue', text: 'text-monokai-blue', gradient: 'from-monokai-blue to-monokai-accent' },
  ddl: { bg: 'bg-monokai-green/10', border: 'border-monokai-green', text: 'text-monokai-green', gradient: 'from-monokai-green to-monokai-green' },
  dml: { bg: 'bg-monokai-orange/10', border: 'border-monokai-orange', text: 'text-monokai-orange', gradient: 'from-monokai-orange to-monokai-yellow' },
  dql: { bg: 'bg-monokai-cyan/10', border: 'border-monokai-cyan', text: 'text-monokai-cyan', gradient: 'from-monokai-cyan to-monokai-blue' },
  functions: { bg: 'bg-monokai-yellow/10', border: 'border-monokai-yellow', text: 'text-monokai-yellow', gradient: 'from-monokai-yellow to-monokai-orange' },
  dcl: { bg: 'bg-monokai-red/10', border: 'border-monokai-red', text: 'text-monokai-red', gradient: 'from-monokai-red to-monokai-pink' },
  optimization: { bg: 'bg-monokai-purple/10', border: 'border-monokai-purple', text: 'text-monokai-purple', gradient: 'from-monokai-purple to-monokai-pink' }
};

const ZONE_DESCRIPTIONS: Record<LibraryTab, { title: string; description: string; scenarios: string[]; warnings: string[] }> = {
  meta: {
    title: '元知识区',
    description: 'SQL 基础概念总览：语言分类(DDL/DML/DQL/DCL/TCL)、OLTP 与 OLAP 引擎区别、查询逻辑执行顺序、数据类型体系、方言差异速查、SQL 标准演进。',
    scenarios: ['理解 SQL 全貌与分类', '查询执行顺序导致的语法限制', '选择合适的数据库引擎', '跨方言语法转换'],
    warnings: ['此区偏理论，理解为主', '具体语法请参考对应分区']
  },
  ddl: {
    title: 'DDL 区',
    description: '数据定义语言：库表创建删除、临时表、ALTER TABLE 修改结构、约束体系(主键/外键/唯一/检查/默认)、索引管理、普通视图与物化视图、触发器、序列、表分区策略。',
    scenarios: ['新建数据库表结构', '修改已有表结构', '创建索引优化查询', '使用物化视图预计算报表'],
    warnings: ['DDL 操作通常不可回滚', '删除表前请确认数据已备份']
  },
  dml: {
    title: 'DML 区',
    description: '数据操纵语言：INSERT 单行/多行插入、UPDATE 条件更新、DELETE 条件删除、TRUNCATE 清空表、MERGE/UPSERT 合并操作、SELECT INTO 导出结果。',
    scenarios: ['批量导入数据', '按条件更新记录', '实现"存在则更新、不存在则插入"', '数据归档与清理'],
    warnings: ['UPDATE/DELETE 无 WHERE 会影响全表', '建议先 SELECT 确认影响范围']
  },
  dql: {
    title: 'DQL 区',
    description: '数据查询语言：基础检索与排序、条件过滤(WHERE/LIKE/IN/BETWEEN)、多表关联(INNER/LEFT/RIGHT/FULL/CROSS/SELF/LATERAL/ASOF)、聚合分组(GROUP BY/HAVING/ROLLUP/CUBE)、子查询与 CTE、窗口函数(排名/偏移/聚合/QUALIFY)。',
    scenarios: ['日常数据查询', '复杂多表关联分析', '分组统计与报表', '时间序列分析', '累计计算与移动平均'],
    warnings: ['窗口函数不在 GROUP BY 中折叠行', 'QUALIFY 子句仅现代 OLAP 引擎支持']
  },
  functions: {
    title: '函数库',
    description: '内置函数大全：字符串函数(CONCAT/SUBSTRING/REPLACE/TRIM)、数值函数(ROUND/CEIL/FLOOR/POWER)、日期时间函数(NOW/DATEADD/DATEDIFF)、空值处理(COALESCE/IFNULL/NULLIF)、类型转换(CAST/::)、条件分支(CASE/IF)、JSON 函数、数组函数、序列生成。',
    scenarios: ['数据清洗与格式化', '日期时间计算', 'JSON 嵌套数据提取', '类型转换与校验'],
    warnings: ['不同数据库函数名可能不同', '注意各方言函数差异表']
  },
  dcl: {
    title: 'DCL/TCL 区',
    description: '权限与事务控制：GRANT/REVOKE 权限管理、角色创建、事务控制(BEGIN/COMMIT/ROLLBACK)、ACID 特性、隔离级别(READ UNCOMMITTED/READ COMMITTED/REPEATABLE READ/SERIALIZABLE)、保存点、SQL 注入防御。',
    scenarios: ['数据库用户权限管理', '确保数据一致性', '处理并发事务', '应用安全防护'],
    warnings: ['生产环境遵循最小权限原则', '事务不宜过长以免锁表']
  },
  optimization: {
    title: '性能优化区',
    description: '查询性能优化：执行计划解读(EXPLAIN/ANALYZE)、索引类型(聚集/非聚集/复合/覆盖/全文)、复合索引最左前缀原则、索引失效场景、查询改写与反模式(N+1/SELECT */OFFSET 分页)、统计信息与优化器、行存储 vs 列存优化思路。',
    scenarios: ['分析慢查询原因', '优化大表分页', '选择合适的索引策略', '理解行列存储差异'],
    warnings: ['索引不是越多越好', '先 EXPLAIN 再优化']
  }
};

export const LibraryApp: React.FC<LibraryAppProps> = ({
  isOpen,
  onClose,
  onInsertToEditor,
  onNavigateToSkill
}) => {
  // 状态管理
  const [activeTab, setActiveTab] = useState<LibraryTab>('meta');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 数据状态
  const [referenceCards, setReferenceCards] = useState<ReferenceCard[]>([]);
  const [sqlTemplates, setSqlTemplates] = useState<SqlTemplate[]>([]);
  const [learningStages, setLearningStages] = useState<LearningStage[]>([]);
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);

  // 初始化加载数据
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // 初始化系统预置数据
        await initializeSystemData();

        // 加载所有数据
        const [cards, templates, stages, snippets] = await Promise.all([
          getAllReferenceCards(),
          getAllSqlTemplates(),
          getAllLearningProgress(),
          getAllCodeSnippets()
        ]);

        setReferenceCards(cards);
        setSqlTemplates(templates);
        setLearningStages(stages);
        setCodeSnippets(snippets);
      } catch (error) {
        console.error('[Library] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // 过滤逻辑
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return referenceCards;
    const query = searchQuery.toLowerCase();
    return referenceCards.filter(card =>
      card.title.toLowerCase().includes(query) ||
      card.syntax.toLowerCase().includes(query) ||
      card.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [referenceCards, searchQuery]);

  const filteredTemplates = useMemo(() => {
    let templates = sqlTemplates;
    if (selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return templates;
  }, [sqlTemplates, selectedCategory, searchQuery]);

  const filteredSnippets = useMemo(() => {
    let snippets = codeSnippets;
    if (selectedCategory === 'favorites') {
      snippets = snippets.filter(s => s.favorite);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      snippets = snippets.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.sql.toLowerCase().includes(query) ||
        s.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return snippets;
  }, [codeSnippets, selectedCategory, searchQuery]);

  // 操作处理
  const handleCopyToClipboard = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('[Library] Copy failed:', error);
    }
  }, []);

  const handleInsertToEditor = useCallback((sql: string) => {
    if (onInsertToEditor) {
      onInsertToEditor(sql);
    }
  }, [onInsertToEditor]);

  // 处理 DDL 执行
  const handleAddCard = useCallback(async (card: Omit<ReferenceCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCard = await saveReferenceCard(card);
    setReferenceCards(prev => [...prev, newCard]);
  }, []);

  const handleDeleteCard = useCallback(async (id: string) => {
    await deleteReferenceCard(id);
    setReferenceCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleAddTemplate = useCallback(async (template: Omit<SqlTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    const newTemplate = await saveSqlTemplate(template);
    setSqlTemplates(prev => [...prev, newTemplate]);
  }, []);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await deleteSqlTemplate(id);
    setSqlTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleAddSnippet = useCallback(async (snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSnippet = await saveCodeSnippet(snippet);
    setCodeSnippets(prev => [...prev, newSnippet]);
  }, []);

  const handleDeleteSnippet = useCallback(async (id: string) => {
    await deleteCodeSnippet(id);
    setCodeSnippets(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    await toggleSnippetFavorite(id);
    setCodeSnippets(prev => prev.map(s =>
      s.id === id ? { ...s, favorite: !s.favorite } : s
    ));
  }, []);

  const handleMarkNodeCompleted = useCallback(async (stageId: string, nodeId: string, completed: boolean) => {
    await markNodeCompleted(stageId, nodeId, completed);
    setLearningStages(prev => prev.map(stage =>
      stage.id === stageId
        ? {
            ...stage,
            nodes: stage.nodes.map(node =>
              node.id === nodeId ? { ...node, isCompleted: completed } : node
            )
          }
        : stage
    ));
  }, []);

  const handleQuickClear = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
  }, []);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 关闭弹窗/清除搜索
      if (e.key === 'Escape') {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 渲染
  if (!isOpen) return null;

  const currentTabConfig = TAB_CONFIG.find(t => t.id === activeTab);
  const currentColors = TAB_COLORS[activeTab];
  const zoneInfo = ZONE_DESCRIPTIONS[activeTab];

  // 辅助函数：复制到编辑器
  const handleCopyToEditor = async (id: string, sql: string, onInsert?: (sql: string) => void) => {
    try {
      await navigator.clipboard.writeText(sql);
      if (onInsert) {
        onInsert(sql);
      }
    } catch (error) {
      console.error('[Library] Copy failed:', error);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden border border-monokai-accent rounded-xl bg-monokai-bg">
      {/* 左侧边栏 - Tab 导航 */}
      <div className="w-56 flex-shrink-0 border-r border-monokai-accent flex flex-col bg-monokai-sidebar">
        {/* 头部 */}
        <div className="p-3 border-b border-monokai-accent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-monokai-blue to-monokai-accent flex items-center justify-center shadow-lg shadow-monokai-blue/25">
                <Library className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-monokai-fg">
                知识库
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 全局搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
            <input
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-monokai-bg border border-monokai-accent rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
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
        </div>

        {/* Tab 列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const colors = TAB_COLORS[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                  isActive
                    ? `${colors.bg} border ${colors.border}`
                    : 'hover:bg-monokai-accent/20'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? colors.text : 'text-monokai-comment'}`} />
                <span className={`text-sm ${isActive ? 'text-monokai-fg font-medium' : 'text-monokai-comment'}`}>
                  {tab.label}
                </span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-monokai-comment" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 中间内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 内容区头部 */}
        <div className="p-4 border-b border-monokai-accent flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentTabConfig && (
              <>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentColors.gradient} flex items-center justify-center`}>
                  <currentTabConfig.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-monokai-fg">{currentTabConfig.label}</h3>
                  <p className="text-xs text-monokai-comment">
                    {activeTab === 'meta' && 'SQL 基础概念总览'}
                    {activeTab === 'ddl' && '数据定义语言'}
                    {activeTab === 'dml' && '数据操纵语言'}
                    {activeTab === 'dql' && '数据查询语言'}
                    {activeTab === 'functions' && '内置函数大全'}
                    {activeTab === 'dcl' && '权限与事务控制'}
                    {activeTab === 'optimization' && '查询性能优化'}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 帮助按钮 - 类似 MetricManager */}
            <button
              onClick={() => setShowHelpPanel(v => !v)}
              className={`p-1.5 rounded transition-colors ${
                showHelpPanel
                  ? 'bg-monokai-yellow/20 text-monokai-yellow'
                  : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/10'
              }`}
              title="背景说明与使用指南"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* AI 一键填充按钮 - 显示 AI 功能说明 */}
            <button
              onClick={() => {
                // 显示提示信息
                const tabLabels: Record<LibraryTab, string> = {
                  meta: '元知识',
                  ddl: 'DDL',
                  dml: 'DML',
                  dql: 'DQL',
                  functions: '函数库',
                  dcl: 'DCL/TCL',
                  optimization: '性能优化'
                };
                const messages: Record<LibraryTab, string> = {
                  meta: '查看 SQL 基础概念：语言分类、OLTP/OLAP、执行顺序、数据类型、方言差异\n\n快捷键：Ctrl+Shift+A',
                  ddl: '查看数据库定义语言：库表创建、约束、索引、视图、物化视图、分区\n\n快捷键：Ctrl+Shift+A',
                  dml: '查看数据操纵语言：INSERT、UPDATE、DELETE、MERGE\n\n快捷键：Ctrl+Shift+A',
                  dql: '查看数据查询语言：条件查询、多表关联、聚合分组、子查询、窗口函数\n\n快捷键：Ctrl+Shift+A',
                  functions: '查看内置函数：字符串、数值、日期、JSON、数组函数\n\n快捷键：Ctrl+Shift+A',
                  dcl: '查看权限与事务：GRANT/REVOKE、BEGIN/COMMIT、ACID、隔离级别\n\n快捷键：Ctrl+Shift+A',
                  optimization: '查看性能优化：执行计划、索引策略、查询改写\n\n快捷键：Ctrl+Shift+A'
                };
                alert(`📚 ${tabLabels[activeTab]} AI 填充功能\n\n${messages[activeTab]}`);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-monokai-purple to-monokai-pink rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              title="点击查看 AI 填充功能使用说明（快捷键：Ctrl+Shift+A）"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI 填充</span>
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-2 border-monokai-blue border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {activeTab === 'meta' && (
                <MetaKnowledgePanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'ddl' && (
                <DDLPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'dml' && (
                <DMLPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'dql' && (
                <DQLPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'functions' && (
                <FunctionsPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'dcl' && (
                <DCLTCLPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
              {activeTab === 'optimization' && (
                <OptimizationPanel
                  onCopy={handleCopyToClipboard}
                  onInsert={handleInsertToEditor}
                  copiedId={copiedId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧信息面板 */}
      {showHelpPanel && (
        <div className="w-72 border-l border-monokai-accent bg-monokai-sidebar p-4 overflow-y-auto">
          <h4 className="text-sm font-bold text-monokai-fg mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            {zoneInfo.title}
          </h4>

          <p className="text-xs text-monokai-comment mb-4">
            {zoneInfo.description}
          </p>

          <div className="mb-4">
            <h5 className="text-xs font-medium text-monokai-fg mb-2">典型使用场景</h5>
            <ul className="space-y-1">
              {zoneInfo.scenarios.map((scenario, idx) => (
                <li key={idx} className="text-xs text-monokai-comment flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 text-monokai-green flex-shrink-0" />
                  <span>{scenario}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-medium text-monokai-fg mb-2">使用提醒</h5>
            <ul className="space-y-1">
              {zoneInfo.warnings.map((warning, idx) => (
                <li key={idx} className="text-xs text-monokai-orange flex items-start gap-1">
                  <span className="text-monokai-orange">⚠</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 快捷操作提示 */}
          <div className="mt-4 p-3 bg-monokai-bg rounded-lg border border-monokai-accent">
            <h5 className="text-xs font-medium text-monokai-fg mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-monokai-blue" />
              快捷操作
            </h5>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment">AI 一键填充</span>
                <kbd className="px-1.5 py-0.5 bg-monokai-sidebar rounded text-[10px] text-monokai-fg">点击按钮</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment">快速清除</span>
                <kbd className="px-1.5 py-0.5 bg-monokai-sidebar rounded text-[10px] text-monokai-fg">清除按钮</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment">复制内容</span>
                <kbd className="px-1.5 py-0.5 bg-monokai-sidebar rounded text-[10px] text-monokai-fg">点击图标</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment">插入编辑器</span>
                <kbd className="px-1.5 py-0.5 bg-monokai-sidebar rounded text-[10px] text-monokai-fg">点击插入</kbd>
              </div>
            </div>
          </div>

          {/* 与 AI 二次优化提示 */}
          <div className="mt-4 p-3 bg-monokai-purple/10 rounded-lg border border-monokai-purple/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-monokai-purple" />
              <span className="text-xs font-medium text-monokai-purple">与 AI 协作</span>
            </div>
            <p className="text-xs text-monokai-comment mb-3">
              基于此模块说明，让 AI 为你定制更贴合业务的内容。
            </p>
            {/* 各面板的具体提示 */}
            {activeTab === 'meta' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「解释 OLTP 和 OLAP 的区别，以及如何选择数据库引擎」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「详细说明 SQL 查询的逻辑执行顺序及其影响」
                </p>
              </div>
            )}
            {activeTab === 'ddl' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「帮我生成一个创建用户表的 DDL，包含常见约束」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「解释物化视图和普通视图的区别及适用场景」
                </p>
              </div>
            )}
            {activeTab === 'dml' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「帮我写一个 MERGE 语句实现upsert功能」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「比较 DELETE、TRUNCATE、DROP 的区别」
                </p>
              </div>
            )}
            {activeTab === 'dql' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「帮我写一个获取每个部门工资最高员工的查询」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「解释窗口函数和聚合函数的区别」
                </p>
              </div>
            )}
            {activeTab === 'functions' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「各数据库的日期函数有什么区别？」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「帮我写一个解析 JSON 字段的 SQL」
                </p>
              </div>
            )}
            {activeTab === 'dcl' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「解释事务的 ACID 特性」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「说明不同隔离级别解决的问题」
                </p>
              </div>
            )}
            {activeTab === 'optimization' && (
              <div className="space-y-2">
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「帮我分析一个慢查询并给出优化建议」
                </p>
                <p className="text-xs text-monokai-fg bg-monokai-bg p-2 rounded">
                  💡 「解释复合索引的最左前缀原则」
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryApp;
