/**
 * AI Skills Panel - Smart + Browse Dual Mode
 *
 * Smart mode (default): NL input → intent analysis → auto skill match → SQL generation
 * Browse mode: Traditional category browsing → manual form fill → execute
 *
 * Follows Monokai theme from DESIGN_SYSTEM.md
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Zap,
  Database,
  Table,
  Eye,
  Hash,
  ArrowRightLeft,
  Lightbulb,
  Filter,
  Layers,
  Settings2,
  GitCompare,
  TrendingUp,
  Wrench,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileCode,
  Wand2,
  Calculator,
  Microscope,
  Puzzle,
  GitBranch,
  DatabaseZap,
  Trash2,
  AlignLeft,
  Calendar,
  Type,
  TrendingDown,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Columns,
  Copy,
  RefreshCw,
  Send,
  MessageSquare,
  LayoutGrid,
  Clock,
  BarChart3,
  ShieldCheck,
  Download,
  Link,
  Github,
  Info,
  Keyboard,
  RotateCcw,
  X
} from 'lucide-react';
import { AISkill, SkillCategory, SkillResult } from '../types';
import { getAllSkills, getSkillsByCategory, searchSkills, getSkillCategories } from '../services/skillRegistry';
import { SkillCard } from './SkillCard';
import { SkillInvoker } from './SkillInvoker';
import { SqlPreview } from './SqlPreview';
import { QuickActions } from './QuickActions';
import { useSkillRouter } from '../hooks/useSkillRouter';
import { testSkill, SkillTestResult } from '../services/skillTester';
import { diagnoseSkill, autoFixSkill, DiagnosticReport } from '../services/skillDiagnostics';
import { SkillImportModal } from './SkillImportModal';
import { SkillTestPanel } from './SkillTestPanel';

interface SkillPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteSql?: (sql: string) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

/**
 * Category configuration following Monokai color system
 */
const CATEGORY_CONFIG: Record<SkillCategory, { label: string; icon: React.ElementType; color: string; gradient: string; bgGradient: string }> = {
  sql: { label: 'SQL 生成', icon: DatabaseZap, color: 'text-monokai-blue', gradient: 'from-monokai-blue to-monokai-accent', bgGradient: 'from-monokai-blue/10 to-monokai-accent/10' },
  analysis: { label: '数据分析', icon: BarChart3, color: 'text-monokai-purple', gradient: 'from-monokai-purple to-monokai-pink', bgGradient: 'from-monokai-purple/10 to-monokai-pink/10' },
  transformation: { label: '数据转换', icon: ArrowRightLeft, color: 'text-monokai-green', gradient: 'from-monokai-green to-emerald-500', bgGradient: 'from-monokai-green/10 to-emerald-500/10' },
  optimization: { label: '性能优化', icon: Zap, color: 'text-monokai-orange', gradient: 'from-monokai-orange to-monokai-yellow', bgGradient: 'from-monokai-orange/10 to-monokai-yellow/10' },
  utility: { label: '实用工具', icon: Wrench, color: 'text-monokai-comment', gradient: 'from-monokai-comment to-monokai-fg', bgGradient: 'from-monokai-comment/10 to-monokai-fg/10' }
};

// AI Skills 模块背景说明配置
const SKILL_BACKGROUND_INFO: Record<SkillCategory | 'smart' | 'all', {
  title: string;
  scenarios: string[];
  commonErrors: string[];
  bestPractices: string[];
  aiPrompt: string;
}> = {
  all: {
    title: '全部技能',
    scenarios: [
      '浏览所有可用技能',
      '按分类筛选技能',
      '搜索特定技能',
      '导入自定义技能'
    ],
    commonErrors: [
      '技能选择不当导致生成结果不匹配',
      '未理解技能的使用场景',
      '忽略技能参数配置'
    ],
    bestPractices: [
      '先了解技能功能再使用',
      '根据需求选择合适的技能',
      '参考示例调整参数'
    ],
    aiPrompt: '帮我生成一个[需求描述]的 SQL，要求使用[表名]表'
  },
  smart: {
    title: '智能模式',
    scenarios: [
      '自然语言描述 SQL 需求',
      '意图分析与技能推荐',
      '一键生成可执行 SQL',
      '基于表结构的智能适配'
    ],
    commonErrors: [
      '描述过于模糊，导致意图识别失败',
      '未指定表名或列名，生成内容不匹配',
      '期望一步到位，缺少迭代优化'
    ],
    bestPractices: [
      '明确指定目标表和列',
      '描述具体的业务逻辑',
      '根据 AI 反馈补充缺失信息',
      '多次迭代优化结果'
    ],
    aiPrompt: '帮我生成一个[需求描述]的 SQL，要求使用[表名]表，包含[字段列表]'
  },
  sql: {
    title: 'SQL 生成',
    scenarios: [
      'SELECT 查询构建',
      'INSERT/UPDATE/DELETE 操作',
      'CREATE/ALTER/DROP 表结构',
      '索引和视图创建'
    ],
    commonErrors: [
      '未检查表名和列名是否存在',
      '忽略数据类型匹配',
      '缺少必要的 WHERE 条件'
    ],
    bestPractices: [
      '先了解目标表结构',
      '使用参数化查询',
      '添加适当的注释说明'
    ],
    aiPrompt: '帮我生成一个[具体需求]的 SQL 查询，使用[表名]表'
  },
  analysis: {
    title: '数据分析',
    scenarios: [
      '聚合统计与分组',
      '排名与 Top N 查询',
      '时间序列分析',
      '漏斗分析与留存'
    ],
    commonErrors: [
      '聚合函数使用不当',
      '分组与排序混淆',
      '窗口函数理解偏差'
    ],
    bestPractices: [
      '明确聚合维度',
      '合理使用 HAVING',
      '理解窗口函数的帧概念'
    ],
    aiPrompt: '帮我设计一个[分析类型]的 SQL，例如[具体业务场景]'
  },
  transformation: {
    title: '数据转换',
    scenarios: [
      '数据类型转换',
      '字符串处理',
      '行列转换',
      '条件逻辑 CASE'
    ],
    commonErrors: [
      '忽略转换后的 NULL 处理',
      '字符编码问题',
      '转换方向错误'
    ],
    bestPractices: [
      '使用 COALESCE 处理 NULL',
      '明确转换目标类型',
      '添加错误处理'
    ],
    aiPrompt: '帮我实现[转换类型]的数据转换，例如[具体场景]'
  },
  optimization: {
    title: '性能优化',
    scenarios: [
      'SQL 性能诊断',
      '索引建议',
      '查询重写',
      '执行计划分析'
    ],
    commonErrors: [
      '过早优化',
      '忽略统计信息',
      '滥用子查询'
    ],
    bestPractices: [
      '先分析执行计划',
      '关注瓶颈而非全面',
      '使用 EXPLAIN 分析'
    ],
    aiPrompt: '帮我优化这个 SQL：[SQL语句]，给出优化建议和替代方案'
  },
  utility: {
    title: '实用工具',
    scenarios: [
      '测试数据生成',
      'SQL 格式化',
      '批量操作',
      '辅助脚本'
    ],
    commonErrors: [
      '生成数据不符合业务规则',
      '批量操作缺少事务',
      '格式化破坏 SQL 语义'
    ],
    bestPractices: [
      '生成数据符合约束',
      '使用事务保证原子性',
      '保持格式化可读性'
    ],
    aiPrompt: '帮我生成[工具类型]工具，例如[具体需求]'
  }
};

/** Get category colors for tags */
const getCategoryTagColors = (category: SkillCategory) => {
  const colors: Record<SkillCategory, { bg: string; border: string; text: string }> = {
    sql: { bg: 'bg-monokai-blue/15', border: 'border-monokai-blue/30', text: 'text-monokai-blue' },
    analysis: { bg: 'bg-monokai-purple/15', border: 'border-monokai-purple/30', text: 'text-monokai-purple' },
    transformation: { bg: 'bg-monokai-green/15', border: 'border-monokai-green/30', text: 'text-monokai-green' },
    optimization: { bg: 'bg-monokai-orange/15', border: 'border-monokai-orange/30', text: 'text-monokai-orange' },
    utility: { bg: 'bg-monokai-comment/15', border: 'border-monokai-comment/30', text: 'text-monokai-comment' },
  };
  return colors[category] || colors.sql;
};

const getSkillIcon = (skillId: string): React.ElementType => {
  const iconMap: Record<string, React.ElementType> = {
    'select': FileCode, 'join': Layers, 'cte': GitBranch, 'insert': Database,
    'update': Settings2, 'delete': Trash2, 'create-table': Table, 'alter-table': Wrench,
    'drop-table': TrendingDown, 'view': Eye, 'index': Hash, 'time-series': TrendingUp,
    'comparison': GitCompare, 'funnel': Filter, 'retention': Clock, 'pivot': Table,
    'unpivot': ArrowRightLeft, 'type-cast': Calculator, 'string': Type,
    'date': Calendar, 'explain': Microscope, 'rewrite': Wand2,
    'test-data': Puzzle, 'sample': Filter, 'summarize': FileText,
  };
  for (const [key, icon] of Object.entries(iconMap)) {
    if (skillId.includes(key)) return icon;
  }
  return Sparkles;
};



/** Intent display names and colors */
const INTENT_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  select: { label: '数据查询', color: 'text-monokai-blue', bg: 'bg-monokai-blue/20', border: 'border-monokai-blue/30' },
  insert: { label: '数据插入', color: 'text-monokai-green', bg: 'bg-monokai-green/20', border: 'border-monokai-green/30' },
  update: { label: '数据更新', color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/20', border: 'border-monokai-yellow/30' },
  delete: { label: '数据删除', color: 'text-monokai-red', bg: 'bg-monokai-red/20', border: 'border-monokai-red/30' },
  aggregation: { label: '聚合统计', color: 'text-monokai-purple', bg: 'bg-monokai-purple/20', border: 'border-monokai-purple/30' },
  join: { label: '多表关联', color: 'text-monokai-pink', bg: 'bg-monokai-pink/20', border: 'border-monokai-pink/30' },
  window: { label: '窗口函数', color: 'text-monokai-cyan', bg: 'bg-monokai-cyan/20', border: 'border-monokai-cyan/30' },
  transformation: { label: '数据转换', color: 'text-monokai-orange', bg: 'bg-monokai-orange/20', border: 'border-monokai-orange/30' },
  analysis: { label: '数据分析', color: 'text-monokai-purple', bg: 'bg-monokai-purple/20', border: 'border-monokai-purple/30' },
  optimization: { label: 'SQL 优化', color: 'text-monokai-yellow', bg: 'bg-monokai-yellow/20', border: 'border-monokai-yellow/30' },
  utility: { label: '工具生成', color: 'text-monokai-comment', bg: 'bg-monokai-comment/20', border: 'border-monokai-comment/30' },
};

export const SkillPanel: React.FC<SkillPanelProps> = ({
  isOpen,
  onClose,
  onExecuteSql,
  currentTable,
  currentColumns
}) => {
  // Mode: 'smart' (NL-driven) or 'browse' (category browsing)
  const [viewMode, setViewMode] = useState<'smart' | 'browse'>('smart');

  // 背景说明相关状态
  const [showBackgroundInfo, setShowBackgroundInfo] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);

  // Browse mode state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<SkillCategory>>(
    new Set(['sql', 'analysis', 'transformation', 'optimization', 'utility'])
  );
  const [selectedSkill, setSelectedSkill] = useState<AISkill | null>(null);
  const [browseResult, setBrowseResult] = useState<SkillResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Validation state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<SkillTestResult | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);

  // Smart mode via shared hook
  const router = useSkillRouter({ currentTable, currentColumns });

  // Browse mode - filtered skills
  const filteredSkills = useMemo(() => {
    if (searchQuery.trim()) return searchSkills(searchQuery);
    if (selectedCategory === 'all') return getAllSkills();
    return getSkillsByCategory(selectedCategory);
  }, [searchQuery, selectedCategory]);

  const skillsByCategory = useMemo(() => {
    const grouped: Record<SkillCategory, AISkill[]> = {
      sql: [], analysis: [], transformation: [], optimization: [], utility: []
    };
    filteredSkills.forEach(skill => grouped[skill.category].push(skill));
    return grouped;
  }, [filteredSkills]);

  const handleSkillSelect = (skill: AISkill) => {
    setSelectedSkill(skill);
    setBrowseResult(null);
  };

  const handleExecutionComplete = (result: SkillResult) => {
    setBrowseResult(result);
    setIsExecuting(false);
  };

  const toggleCategory = (category: SkillCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  /** Handle skill validation - test and diagnose a skill */
  const handleValidateSkill = async (skill: AISkill) => {
    setIsValidating(true);
    setSelectedSkill(skill);
    setValidationResult(null);
    setDiagnosticReport(null);

    try {
      // Run test
      const testResult = await testSkill(skill.id);
      setValidationResult(testResult);

      // Run diagnostics
      const diagnostics = await diagnoseSkill(skill.id, testResult);
      setDiagnosticReport(diagnostics);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  /** Handle auto-fix for a skill */
  const handleAutoFixSkill = async (skill: AISkill) => {
    setIsValidating(true);

    try {
      const fixResult = await autoFixSkill(skill.id);
      if (fixResult.success && fixResult.fixed > 0) {
        // Re-validate after fix
        await handleValidateSkill(fixResult.fixedSkills?.[0] || skill);
      }
    } catch (error) {
      console.error('Auto-fix failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  /** Quick action handler (simpler approach): fill input, then user clicks execute */
  const handleQuickActionFill = (prompt: string) => {
    router.setInput(prompt);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Import Modal */}
      <SkillImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Test Panel Modal */}
      {showTestPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SkillTestPanel
            skillId={selectedSkill?.id}
            onClose={() => setShowTestPanel(false)}
          />
        </div>
      )}

      {/* Validation Result Popup */}
      {validationResult && selectedSkill && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setValidationResult(null)}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-monokai-bg border border-monokai-accent rounded-xl shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-monokai-fg flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${validationResult.passed ? 'text-monokai-green' : 'text-monokai-red'}`} />
                技能验证结果
              </h3>
              <button onClick={() => setValidationResult(null)} className="text-monokai-comment hover:text-monokai-fg">
                <ChevronRight className="w-4 h-4 rotate-45" />
              </button>
            </div>

            <div className={`p-3 rounded-lg mb-3 ${validationResult.passed ? 'bg-monokai-green/10 border border-monokai-green/30' : 'bg-monokai-red/10 border border-monokai-red/30'}`}>
              <div className="flex items-center gap-2">
                {validationResult.passed ? (
                  <Check className="w-4 h-4 text-monokai-green" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-monokai-red" />
                )}
                <span className="text-sm text-monokai-fg">
                  {validationResult.passed ? '验证通过' : '发现问题'}
                </span>
                <span className="text-xs text-monokai-comment ml-auto">
                  {validationResult.passedTests}/{validationResult.totalTests} 测试通过
                </span>
              </div>
            </div>

            {/* Diagnostic Summary */}
            {diagnosticReport && (
              <div className="mb-3">
                <div className="text-xs text-monokai-comment mb-2">问题诊断:</div>
                <div className="flex gap-2 text-xs">
                  {diagnosticReport.summary.critical > 0 && (
                    <span className="px-2 py-1 bg-monokai-red/20 text-monokai-red rounded">{diagnosticReport.summary.critical} 严重</span>
                  )}
                  {diagnosticReport.summary.high > 0 && (
                    <span className="px-2 py-1 bg-monokai-orange/20 text-monokai-orange rounded">{diagnosticReport.summary.high} 高</span>
                  )}
                  {diagnosticReport.summary.autoFixable > 0 && (
                    <span className="px-2 py-1 bg-monokai-blue/20 text-monokai-blue rounded flex items-center gap-1">
                      <Wand2 className="w-3 h-3" />
                      {diagnosticReport.summary.autoFixable} 可自动修复
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowTestPanel(true)}
                className="flex-1 px-3 py-2 text-xs bg-monokai-purple/20 text-monokai-purple rounded-lg hover:bg-monokai-purple/30 flex items-center justify-center gap-1"
              >
                <Microscope className="w-3 h-3" />
                查看详情
              </button>
              {diagnosticReport?.summary.autoFixable > 0 && (
                <button
                  onClick={() => handleAutoFixSkill(selectedSkill)}
                  disabled={isValidating}
                  className="flex-1 px-3 py-2 text-xs bg-monokai-green/20 text-monokai-green rounded-lg hover:bg-monokai-green/30 flex items-center justify-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  {isValidating ? '修复中...' : '自动修复'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full w-full overflow-hidden border border-monokai-accent rounded-xl bg-monokai-bg">
      {/* ── SMART MODE ── */}
      {viewMode === 'smart' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-monokai-accent bg-monokai-sidebar/50 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center shadow-lg shadow-monokai-purple/25">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-monokai-fg">AI 技能中心</h2>
                  <p className="text-[10px] text-monokai-comment">描述需求 → 智能匹配 → 一键生成 SQL</p>
                </div>
              </div>

              {/* Mode Toggle & Background Info */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBackgroundInfo(!showBackgroundInfo)}
                  className={`p-2 rounded-lg transition-all ${showBackgroundInfo ? 'bg-monokai-purple/20 text-monokai-purple' : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/20'}`}
                  title="背景说明"
                >
                  <Info className="w-4 h-4" />
                </button>
                <div className="flex bg-monokai-bg rounded-lg p-0.5 border border-monokai-accent">
                  <button
                    onClick={() => setViewMode('smart')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    智能
                  </button>
                  <button
                    onClick={() => setViewMode('browse')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 text-monokai-comment hover:text-monokai-fg"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    浏览
                  </button>
                </div>
              </div>
            </div>

            {/* Background Info Panel */}
            {showBackgroundInfo && (
              <div className="mb-3 p-3 bg-monokai-bg rounded-lg border border-monokai-purple/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-monokai-purple">使用提示</span>
                  <button
                    onClick={() => setShowAIPrompt(!showAIPrompt)}
                    className="text-[10px] text-monokai-blue hover:text-monokai-fg flex items-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    AI 提示词
                  </button>
                </div>

                {/* AI Prompt */}
                {showAIPrompt && (
                  <div className="mb-2 p-2 bg-monokai-purple/10 rounded border border-monokai-purple/20">
                    <p className="text-[10px] text-monokai-comment mb-1">点击复制提示词：</p>
                    <button
                      onClick={() => {
                        const key = viewMode === 'smart' ? 'smart' : (selectedCategory === 'all' ? 'all' : selectedCategory);
                        navigator.clipboard.writeText(SKILL_BACKGROUND_INFO[key]?.aiPrompt || '');
                      }}
                      className="text-[10px] text-monokai-fg hover:text-monokai-purple text-left w-full p-1.5 bg-monokai-sidebar rounded border border-monokai-accent hover:border-monokai-purple/50 transition-colors"
                    >
                      {SKILL_BACKGROUND_INFO[viewMode === 'smart' ? 'smart' : (selectedCategory === 'all' ? 'all' : selectedCategory)]?.aiPrompt}
                    </button>
                  </div>
                )}

                {/* 使用场景 */}
                <div className="mb-2">
                  <span className="text-[10px] text-monokai-comment">使用场景：</span>
                  <ul className="mt-1 space-y-0.5">
                    {SKILL_BACKGROUND_INFO[viewMode === 'smart' ? 'smart' : (selectedCategory === 'all' ? 'all' : selectedCategory)]?.scenarios.map((s, i) => (
                      <li key={i} className="text-[10px] text-monokai-fg flex items-start gap-1">
                        <span className="text-monokai-purple">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 常见错误 */}
                <div className="mb-2">
                  <span className="text-[10px] text-monokai-yellow">常见错误：</span>
                  <ul className="mt-1 space-y-0.5">
                    {SKILL_BACKGROUND_INFO[viewMode === 'smart' ? 'smart' : (selectedCategory === 'all' ? 'all' : selectedCategory)]?.commonErrors.map((e, i) => (
                      <li key={i} className="text-[10px] text-monokai-comment flex items-start gap-1">
                        <span className="text-monokai-red">✕</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 最佳实践 */}
                <div>
                  <span className="text-[10px] text-monokai-green">最佳实践：</span>
                  <ul className="mt-1 space-y-0.5">
                    {SKILL_BACKGROUND_INFO[viewMode === 'smart' ? 'smart' : (selectedCategory === 'all' ? 'all' : selectedCategory)]?.bestPractices.map((p, i) => (
                      <li key={i} className="text-[10px] text-monokai-fg flex items-start gap-1">
                        <span className="text-monokai-green">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Table Context */}
            {currentTable && (
              <div className="flex items-center gap-3 px-3 py-2 bg-monokai-purple/8 border border-monokai-purple/20 rounded-lg mb-3">
                <div className="flex items-center gap-1.5 text-monokai-fg text-xs">
                  <Table className="w-3.5 h-3.5 text-monokai-purple" />
                  <span className="text-monokai-comment">当前表:</span>
                  <span className="font-semibold font-mono">{currentTable}</span>
                </div>
                {currentColumns && currentColumns.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-monokai-comment">
                    <Columns className="w-3.5 h-3.5" />
                    <span>{currentColumns.length} 列</span>
                    <span className="text-[10px] text-monokai-comment/70">
                      ({currentColumns.slice(0, 4).map(c => c.name).join(', ')}{currentColumns.length > 4 ? '...' : ''})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* NL Input Area */}
            <div className="relative">
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-monokai-purple mt-2.5 shrink-0" />
                <textarea
                  value={router.input}
                  onChange={(e) => router.setInput(e.target.value)}
                  placeholder={currentTable
                    ? `针对 ${currentTable} 表，描述你的需求...\n例如：统计每月的订单数量和金额，按金额降序排列`
                    : '描述你的 SQL 需求...\n例如：帮我创建一张用户表，包含姓名、邮箱、注册时间'
                  }
                  className="flex-1 px-3 py-2.5 text-sm bg-monokai-bg border border-monokai-accent text-monokai-fg placeholder-monokai-comment/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple/50 focus:border-monokai-purple/50 transition-all resize-none"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      router.handleExecute();
                    }
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-2.5">
                <div className="text-[10px] text-monokai-comment flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-monokai-bg border border-monokai-accent rounded font-mono text-[9px]">Ctrl+Enter</kbd>
                  <span>一键生成</span>
                </div>
                <div className="flex items-center gap-2">
                  {router.input.trim() && (
                    <button
                      onClick={() => router.reset()}
                      className="px-2.5 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg rounded-md hover:bg-monokai-accent/30 transition-all"
                    >
                      清空
                    </button>
                  )}
                  <button
                    onClick={router.handleAnalyze}
                    disabled={router.isAnalyzing || !router.input.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-monokai-accent/40 text-monokai-fg rounded-lg hover:bg-monokai-accent/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  >
                    {router.isAnalyzing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 分析中</>
                    ) : (
                      <><Lightbulb className="w-3.5 h-3.5" /> 分析</>
                    )}
                  </button>
                  <button
                    onClick={router.handleExecute}
                    disabled={router.isExecuting || !router.input.trim()}
                    className="px-3.5 py-1.5 text-xs font-medium bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-md shadow-monokai-purple/20"
                  >
                    {router.isExecuting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5" /> 一键生成</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Intent Analysis */}
            {router.intentAnalysis && !router.executionResult && (
              <div className="p-4 bg-gradient-to-br from-monokai-sidebar/80 to-monokai-bg border border-monokai-accent/50 rounded-xl space-y-3 shadow-lg shadow-monokai-purple/5 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-monokai-comment">识别意图:</span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${INTENT_LABELS[router.intentAnalysis.intent]?.bg || 'bg-monokai-purple/20'} ${INTENT_LABELS[router.intentAnalysis.intent]?.color || 'text-monokai-purple'} ${INTENT_LABELS[router.intentAnalysis.intent]?.border || 'border-monokai-purple/30'}`}>
                      {INTENT_LABELS[router.intentAnalysis.intent]?.label || router.intentAnalysis.intent}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-monokai-comment">置信度:</span>
                    <span className={`text-xs font-bold ${router.intentAnalysis.confidence >= 0.8 ? 'text-monokai-green' :
                      router.intentAnalysis.confidence >= 0.5 ? 'text-monokai-yellow' : 'text-monokai-red'
                      }`}>
                      {Math.round(router.intentAnalysis.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {router.intentAnalysis.reasoning && (
                  <p className="text-xs text-monokai-comment leading-relaxed">{router.intentAnalysis.reasoning}</p>
                )}

                {router.intentAnalysis.missingInfo && router.intentAnalysis.missingInfo.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-monokai-yellow bg-monokai-yellow/5 p-2 rounded">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>需要补充: {router.intentAnalysis.missingInfo.join(', ')}</span>
                  </div>
                )}

                {router.suggestedSkills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-monokai-comment uppercase tracking-wider">推荐技能</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {router.suggestedSkills.slice(0, 5).map(skill => {
                        const tagColors = getCategoryTagColors(skill.category);
                        return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            setViewMode('browse');
                            setSelectedSkill(skill);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md hover:rounded-full transition-all duration-200 border ${tagColors.bg} ${tagColors.border} ${tagColors.text} hover:brightness-110`}
                        >
                          {React.createElement(getSkillIcon(skill.id), { className: 'w-3 h-3' })}
                          <span className="max-w-[80px] truncate">{skill.name}</span>
                          <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                        </button>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Execution Result */}
            {router.executionResult && (
              <div className={`p-4 border rounded-lg animate-[fadeIn_0.2s_ease-out] ${router.executionResult.success
                ? 'bg-monokai-green/5 border-monokai-green/30'
                : 'bg-monokai-red/5 border-monokai-red/30'
                }`}>
                {router.executionResult.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-monokai-green">
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-semibold">SQL 生成成功</span>
                      </div>
                      {router.intentAnalysis && (
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${INTENT_LABELS[router.intentAnalysis.intent]?.bg || 'bg-monokai-purple/15'} ${INTENT_LABELS[router.intentAnalysis.intent]?.color || 'text-monokai-purple'}`}>
                          {INTENT_LABELS[router.intentAnalysis.intent]?.label || router.intentAnalysis.intent}
                        </span>
                      )}
                    </div>

                    {/* SQL Preview */}
                    <div className="relative group">
                      <pre className="p-3 bg-monokai-bg rounded-lg overflow-x-auto text-xs font-mono text-monokai-fg custom-scrollbar max-h-56 border border-monokai-accent/30">
                        {router.executionResult.sql}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(router.executionResult?.sql || '')}
                        className="absolute top-2 right-2 p-1.5 bg-monokai-accent/50 hover:bg-monokai-accent rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="复制 SQL"
                      >
                        <Copy className="w-3 h-3 text-monokai-fg" />
                      </button>
                    </div>

                    {/* Explanation */}
                    {router.executionResult.explanation && (
                      <div className="p-2.5 bg-monokai-bg/50 rounded-lg border border-monokai-accent/20">
                        <span className="text-[10px] font-medium text-monokai-comment uppercase tracking-wider">说明</span>
                        <p className="text-xs text-monokai-fg mt-1 leading-relaxed">{router.executionResult.explanation}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (onExecuteSql && router.executionResult?.sql) {
                            onExecuteSql(router.executionResult.sql);
                          }
                        }}
                        className="flex-1 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-monokai-green to-emerald-500 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md"
                      >
                        <Zap className="w-4 h-4" />
                        插入到编辑器
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(router.executionResult?.sql || '')}
                        className="px-4 py-2 text-sm font-medium bg-monokai-accent/30 text-monokai-fg rounded-lg hover:bg-monokai-accent/50 transition-all flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复制
                      </button>
                      <button
                        onClick={router.handleExecute}
                        className="px-4 py-2 text-sm font-medium bg-monokai-accent/30 text-monokai-fg rounded-lg hover:bg-monokai-accent/50 transition-all flex items-center gap-2"
                        title="重新生成"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 text-monokai-red">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold">生成失败</span>
                      <p className="text-xs mt-1 opacity-80">{router.executionResult.error}</p>
                      <button
                        onClick={router.handleExecute}
                        className="mt-2 px-3 py-1 text-xs bg-monokai-accent/30 text-monokai-fg rounded hover:bg-monokai-accent/50 transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> 重试
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions - show when no result is displayed */}
            {!router.executionResult && !router.intentAnalysis && (
              <QuickActions
                currentTable={currentTable}
                currentColumns={currentColumns}
                onAction={handleQuickActionFill}
              />
            )}

            {/* Help text when empty */}
            {!router.input.trim() && !router.executionResult && !router.intentAnalysis && (
              <div className="mt-4 p-4 bg-monokai-sidebar/30 border border-monokai-accent/30 rounded-lg">
                <h4 className="text-xs font-semibold text-monokai-fg mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-monokai-yellow" />
                  使用提示
                </h4>
                <ul className="space-y-1.5 text-[11px] text-monokai-comment">
                  <li className="flex items-start gap-2">
                    <span className="text-monokai-purple font-bold mt-px">1</span>
                    <span>{currentTable ? `当前已选中 ${currentTable} 表，AI 会基于表结构智能生成 SQL` : '在左侧选择一个数据表，AI 将基于表结构智能推荐'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-monokai-purple font-bold mt-px">2</span>
                    <span>用自然语言描述需求，如「按月统计销售额」「查找最近 7 天新注册用户」</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-monokai-purple font-bold mt-px">3</span>
                    <span>点击「分析」查看意图识别，或直接「一键生成」获取 SQL</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-monokai-accent bg-monokai-sidebar/50 shrink-0">
            <div className="flex items-center justify-between text-xs text-monokai-comment">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-monokai-purple" />
                  <span>AI 驱动 · 自然语言</span>
                </div>
                {currentTable && (
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-monokai-green" />
                    <span className="text-monokai-green font-medium">{currentTable}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setViewMode('browse')}
                className="text-monokai-comment hover:text-monokai-fg transition-colors flex items-center gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                切换浏览模式
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BROWSE MODE ── */}
      {viewMode === 'browse' && (
        <>
          {/* Left Panel - Skill List */}
          <div className="w-72 flex-shrink-0 border-r border-monokai-accent flex flex-col bg-monokai-sidebar">
            {/* Header */}
            <div className="p-3 border-b border-monokai-accent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center shadow-lg shadow-monokai-purple/25">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-monokai-fg">
                    AI 技能库
                  </h2>
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-monokai-bg rounded-lg p-0.5 border border-monokai-accent">
                  <button
                    onClick={() => setViewMode('smart')}
                    className="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 text-monokai-comment hover:text-monokai-fg"
                  >
                    <Sparkles className="w-3 h-3" />
                    智能
                  </button>
                  <button
                    onClick={() => setViewMode('browse')}
                    className="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white shadow-sm"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    浏览
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment group-focus-within:text-monokai-purple transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索技能..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-monokai-bg border border-monokai-accent text-monokai-fg placeholder-monokai-comment rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent transition-all"
                />
              </div>

              {/* Category Tabs */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-monokai-purple to-monokai-pink text-white shadow-md'
                    : 'bg-monokai-bg text-monokai-comment hover:text-monokai-fg border border-transparent hover:border-monokai-accent'
                    }`}
                >
                  全部
                </button>
                {getSkillCategories().map(({ category, count }) => {
                  const config = CATEGORY_CONFIG[category];
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${selectedCategory === category
                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                        : 'bg-monokai-bg text-monokai-comment hover:text-monokai-fg border border-transparent hover:border-monokai-accent'
                        }`}
                    >
                      {config?.label || category}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skill List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {selectedCategory === 'all' ? (
                (Object.entries(skillsByCategory) as [SkillCategory, AISkill[]][])
                  .filter(([_, skills]) => skills.length > 0)
                  .map(([category, skills]) => (
                    <div key={category} className="mb-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-monokai-fg hover:bg-monokai-accent/20 rounded-lg transition-colors"
                      >
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        {CATEGORY_CONFIG[category] && React.createElement(
                          CATEGORY_CONFIG[category].icon,
                          { className: `w-3.5 h-3.5 ${CATEGORY_CONFIG[category].color}` }
                        )}
                        <span className="text-monokai-fg">{CATEGORY_CONFIG[category]?.label || category}</span>
                        <span className="ml-auto text-xs text-monokai-comment">({skills.length})</span>
                      </button>

                      {expandedCategories.has(category) && (
                        <div className="mt-1 space-y-1 ml-3">
                          {skills.map(skill => (
                            <SkillCard
                              key={skill.id}
                              skill={skill}
                              isSelected={selectedSkill?.id === skill.id}
                              onClick={() => handleSkillSelect(skill)}
                              currentTable={currentTable}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                filteredSkills.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isSelected={selectedSkill?.id === skill.id}
                    onClick={() => handleSkillSelect(skill)}
                    currentTable={currentTable}
                  />
                ))
              )}

              {filteredSkills.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-monokai-comment">
                  <div className="w-16 h-16 rounded-xl bg-monokai-bg flex items-center justify-center mb-3">
                    <Search className="w-8 h-8 text-monokai-comment" />
                  </div>
                  <p className="text-sm font-medium text-monokai-fg">没有找到匹配的技能</p>
                  <p className="text-xs text-monokai-comment mt-1">试试其他关键词</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-monokai-accent bg-monokai-sidebar/50">
              <div className="flex flex-wrap items-center gap-2 text-xs text-monokai-comment">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-monokai-purple" />
                  <span>点击技能开始使用</span>
                </div>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1 text-monokai-green hover:text-monokai-fg transition-colors"
                >
                  <Download className="w-3 h-3" />
                  导入技能
                </button>
                <button
                  onClick={() => setShowTestPanel(true)}
                  className="flex items-center gap-1 text-monokai-blue hover:text-monokai-fg transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  验证技能
                </button>
                <button
                  onClick={() => setViewMode('smart')}
                  className="flex items-center gap-1 text-monokai-purple hover:text-monokai-fg transition-colors ml-auto"
                >
                  <Sparkles className="w-3 h-3" />
                  切换智能模式
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Skill Invoker & Preview */}
          <div className="flex-1 flex flex-col bg-monokai-bg">
            {selectedSkill ? (
              <React.Fragment>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <SkillInvoker
                    skill={selectedSkill}
                    currentTable={currentTable}
                    currentColumns={currentColumns}
                    onExecute={handleExecutionComplete}
                    isExecuting={isExecuting}
                    setIsExecuting={setIsExecuting}
                  />
                </div>

                {browseResult && (
                  <div className="border-t border-monokai-accent shadow-lg">
                    <SqlPreview
                      sql={browseResult.sql || ''}
                      explanation={browseResult.explanation}
                      error={browseResult.error}
                      onExecute={onExecuteSql}
                      onClose={() => setBrowseResult(null)}
                    />
                  </div>
                )}
              </React.Fragment>
            ) : (
              <div className="flex-1 flex items-center justify-center text-monokai-comment">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-monokai-sidebar flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-monokai-purple" />
                  </div>
                  <h3 className="text-lg font-semibold text-monokai-fg mb-2">选择 AI 技能</h3>
                  <p className="text-sm text-monokai-comment mb-4">从左侧选择一个技能开始生成 SQL</p>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <span className="px-3 py-1 text-xs bg-monokai-blue/20 text-monokai-blue rounded-lg">SELECT</span>
                    <span className="px-3 py-1 text-xs bg-monokai-green/20 text-monokai-green rounded-lg">JOIN</span>
                    <span className="px-3 py-1 text-xs bg-monokai-purple/20 text-monokai-purple rounded-lg">GROUP BY</span>
                    <span className="px-3 py-1 text-xs bg-monokai-orange/20 text-monokai-orange rounded-lg">+ 更多</span>
                  </div>
                  <button
                    onClick={() => setViewMode('smart')}
                    className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5 mx-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    或使用智能模式
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
};
