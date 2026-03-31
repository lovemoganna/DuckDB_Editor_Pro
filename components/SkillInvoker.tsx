/**
 * Skill Invoker Component
 *
 * Dynamic form for invoking skills with input fields.
 * Features:
 * - AI one-click fill for quick example/heuristic generation
 * - Quick clear button for efficient iteration
 * - Module background explanation with usage scenarios and common errors
 * - Real-time AI-powered input suggestions based on user context
 * - Live SQL preview as user types
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Loader2,
  AlertCircle,
  Sparkles,
  Table,
  Columns,
  Info,
  ArrowRight,
  CheckCircle2,
  Sparkles as SparklesIcon,
  Trash2,
  Lightbulb,
  Zap,
  Wand2,
  Target,
  AlertTriangle,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wand2 as MagicWand,
  MessageSquare,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code,
  FileCode
} from 'lucide-react';
import { AISkill, SkillInputField, SkillExecutionContext, SkillResult } from '../types';
import { executeSkill } from '../services/skillExecutor';

/**
 * 按技能大类提供的背景说明与常见错误提示（MECE 结构）
 * 每个分类包含：标题、描述、适用场景、常见错误、AI协作提示、快速开始、最佳实践、示例场景
 */
type CategoryHelpData = {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
  exampleFlows: { name: string; description: string }[];
};

const CATEGORY_HELP: Record<AISkill['category'], CategoryHelpData> = {
  sql: {
    title: 'SQL 生成 / 建模',
    description: '适用于将自然语言需求快速转成可执行的 DuckDB SQL，包括查询、建表、增删改等操作。',
    scenarios: [
      '有明确业务问题，需要一条或一组 SQL 直接回答',
      '需要快速搭建表结构或模拟数据场景',
      '已有表和字段，想要生成标准化的 SQL 模板',
      '需要从零开始设计完整的数据模型'
    ],
    commonErrors: [
      '未指定表或字段，导致生成的 SQL 含有占位符（如 table_name、col）',
      '在 WHERE 条件中直接拼接中文自然语言而非字段条件',
      '混用不同数据库方言（如 MySQL 语法）导致在 DuckDB 中执行失败',
      '未考虑 NULL 值处理，导致结果不符合预期',
      '列名未加引号，特殊字符列名导致语法错误'
    ],
    aiHints: [
      '尽量用「业务意图 + 关键字段名」描述需求，AI 更容易生成稳定 SQL',
      '如果生成结果包含占位符，先用一键示例填充，再按字段手动微调',
      '复杂场景可以先用高级技能拆为多个子查询，再逐步合成',
      '使用 CTE 逐步构建复杂查询，便于调试和维护',
      'DuckDB 特有语法：SUMMARIZE、pivot、unnest 等优先使用'
    ],
    quickStart: [
      '1. 选择「SELECT 查询生成」技能',
      '2. 描述你的查询需求',
      '3. 点击「AI 填充」快速生成',
      '4. 查看实时 SQL 预览',
      '5. 复制或执行生成的 SQL'
    ],
    bestPractices: [
      '优先使用带列名的 SELECT，避免 SELECT *',
      'WHERE 条件使用参数化查询',
      '大型结果集添加 LIMIT',
      '复杂查询使用 CTE 分解'
    ],
    exampleFlows: [
      { name: '查询用户订单', description: 'SELECT → JOIN → WHERE 组合' },
      { name: '创建电商表', description: '自然语言建表 → 模板优化' },
      { name: '复杂分析', description: 'CTE + 窗口函数 + 聚合' }
    ]
  },
  analysis: {
    title: '指标 / 分析类',
    description: '围绕时间序列、对比、漏斗、留存等分析场景，生成带聚合与窗口函数的 SQL。',
    scenarios: [
      '做趋势、同比环比、留存等指标分析',
      '需要在一个 SQL 中展示多个阶段或分组结果',
      '希望在仪表盘中直接复用分析 SQL',
      '进行用户行为路径分析和转化率分析'
    ],
    commonErrors: [
      '时间列未选对，导致分组粒度不符合预期',
      '维度列基数过高，导致结果集过大或图表难以阅读',
      '在 WHERE 与 HAVING 中混淆过滤条件，导致结果偏差',
      '窗口函数缺少 ORDER BY 导致结果不稳定',
      '累计计算未正确处理边界情况'
    ],
    aiHints: [
      '优先选择「时间列 + 指标列」作为输入，AI 会自动补充常见分析模式',
      '如果结果不符合预期，可以在描述中追加「按日聚合」「展示占比」等约束',
      '对于留存与漏斗，先从 2~3 个关键步骤开始，再逐步细化',
      '使用 DATE_TRUNC 统一时间粒度，避免时区问题',
      '对比分析时加入占比计算，更容易发现异常'
    ],
    quickStart: [
      '1. 选择「时间序列分析」或「对比分析」',
      '2. 选择时间列和数值列',
      '3. 设置分析粒度（日/周/月）',
      '4. 查看实时 SQL 预览',
      '5. 执行并查看结果'
    ],
    bestPractices: [
      '始终使用 DATE_TRUNC 统一时间粒度',
      '留存分析使用 cohort 方法',
      '漏斗分析先验证单步骤转化',
      '对比分析添加基准线'
    ],
    exampleFlows: [
      { name: '日活趋势分析', description: '时间序列 → 移动平均 → 同比环比' },
      { name: '用户留存分析', description: '留存率 → 周期对比 →  cohort 分析' },
      { name: '转化漏斗', description: '步骤定义 → 转化率 → 流失分析' }
    ]
  },
  transformation: {
    title: '数据转换 / 清洗',
    description: '用于列转行、行转列、类型转换、字符串与日期处理等预处理逻辑。',
    scenarios: [
      '在建模前标准化原始数据格式',
      '为后续分析生成中间宽表或特征列',
      '替换脏数据或对文本进行结构化拆分',
      '处理半结构化数据（JSON、嵌套数据）'
    ],
    commonErrors: [
      '忽略 NULL 值或异常值，导致转换后统计失真',
      '在字符串/日期操作中使用了错误的格式模板',
      '转换后的别名与原字段名冲突，后续 SQL 难以维护',
      'PIVOT/UNPIVOT 语法错误，列名处理不当',
      '正则表达式贪婪匹配导致性能问题'
    ],
    aiHints: [
      '说明「原字段含义 + 期望结果格式」，AI 更容易生成正确表达式',
      '复杂转换可以先让 AI 生成独立 SELECT 语句，再嵌入主查询',
      '遇到报错时优先检查 CAST/日期格式是否与源字段类型匹配',
      '使用 TRY_CAST 避免转换失败导致整查询崩溃',
      '复杂字符串处理优先用正则提取而非多次 REPLACE'
    ],
    quickStart: [
      '1. 选择转换类型（PIVOT/类型转换/字符串处理）',
      '2. 选择源列和目标格式',
      '3. 设置转换参数',
      '4. 预览转换结果',
      '5. 集成到主查询'
    ],
    bestPractices: [
      '使用 TRY_CAST 处理可能的转换失败',
      '先在小数据集测试转换逻辑',
      '保持转换后字段命名规范',
      '复杂转换拆分为多步'
    ],
    exampleFlows: [
      { name: '宽表构建', description: '多表 JOIN → PIVOT → 聚合' },
      { name: '数据清洗', description: '类型转换 → 异常值处理 → 标准化' },
      { name: '特征工程', description: '日期特征 → 文本特征 → 统计特征' }
    ]
  },
  optimization: {
    title: '性能 / 执行计划优化',
    description: '围绕 EXPLAIN、索引思路与查询改写，帮助理解并优化现有 SQL。',
    scenarios: [
      '查询在大表上执行缓慢，需要找出瓶颈',
      '想要对关键报表 SQL 做结构性改写',
      '需要在 DuckDB 中设计物化视图或预计算方案',
      '分析复杂查询的执行计划'
    ],
    commonErrors: [
      '直接对非过滤列进行复杂计算，导致全表扫描',
      '在子查询中重复计算相同表达式，浪费算力',
      '误以为 DuckDB 有传统索引，忽略列式/文件布局优势',
      'JOIN 顺序不当，导致中间结果膨胀',
      '未使用 LIMIT 导致返回大量不需要的数据'
    ],
    aiHints: [
      '先用 EXPLAIN 技能查看执行计划，再将输出与原 SQL 一并交给 AI 重写',
      '在描述中标明优化目标（性能优先/可读性优先），AI 会采用不同策略',
      '长查询可以先拆为多段子查询，逐段验证性能与正确性',
      'DuckDB 优化：利用文件排序、分区裁剪、物化视图',
      '复杂聚合可先用 CTE 预计算再 JOIN'
    ],
    quickStart: [
      '1. 粘贴需要优化的 SQL',
      '2. 使用「执行计划分析」查看瓶颈',
      '3. 根据 AI 建议优化',
      '4. 再次分析执行计划',
      '5. 应用优化后的 SQL'
    ],
    bestPractices: [
      '始终先用 EXPLAIN 分析',
      '优先优化 WHERE 条件',
      '使用物化视图缓存复杂查询',
      '避免 SELECT *，只取需要的列'
    ],
    exampleFlows: [
      { name: '执行计划分析', description: 'EXPLAIN → 分析瓶颈 → 重写优化' },
      { name: '物化视图优化', description: '识别热点查询 → 创建物化视图 → 定期刷新' },
      { name: '查询改写', description: '子查询转 JOIN → 预计算 → LIMIT 优化' }
    ]
  },
  utility: {
    title: '实用工具 / 辅助',
    description: '包括测试数据生成、样本抽取、数据摘要等辅助性 SQL 逻辑。',
    scenarios: [
      '需要快速生成一批测试数据验证模型或仪表盘',
      '在接入新表前想先粗略了解数据质量与分布',
      '从大表中抽取代表性样本进行调试',
      '需要对表结构或数据进行快速检查'
    ],
    commonErrors: [
      '在生产表上直接执行大规模测试插入，影响真实数据',
      '抽样时忽略分层条件，导致样本分布失真',
      '误删由工具生成的中间表或视图，导致后续报表失败',
      'SUMMARIZE 输出过大，未限制范围',
      '测试数据未考虑外键约束，导致关联失败'
    ],
    aiHints: [
      '建议为测试数据单独建表或使用临时表，避免污染正式数据',
      '抽样时尽量指定分层字段（如用户等级、地区）保持代表性',
      '使用数据摘要前先限制目标表规模，避免长时间扫描',
      'GENERATE_SERIES 生成有序测试数据很有用',
      '使用 USING SAMPLE 进行各种抽样：百分比、行数、分层'
    ],
    quickStart: [
      '1. 选择「测试数据生成」或「样本查询」',
      '2. 设置数据量或抽样参数',
      '3. 选择数据模式（随机/序列/边界）',
      '4. 生成并预览数据',
      '5. 插入到测试表'
    ],
    bestPractices: [
      '测试数据使用单独表或临时表',
      '抽样前确定分层字段',
      'SUMMARIZE 前先 LIMIT 范围',
      'GENERATE_SERIES 生成有序数据'
    ],
    exampleFlows: [
      { name: '测试数据生成', description: '定义结构 → 生成规则 → 批量插入' },
      { name: '数据质量检查', description: 'SUMMARIZE → 缺失值 → 异常值检测' },
      { name: '样本抽样', description: '随机抽样 → 分层抽样 → 对比分析' }
    ]
  }
};

interface SkillInvokerProps {
  skill: AISkill;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
  onExecute: (result: SkillResult) => void;
  isExecuting: boolean;
  setIsExecuting: (value: boolean) => void;
}

/**
 * 技能特定 AI 填充提示词生成器
 */
const generateFillPrompt = (
  skill: AISkill,
  inputs: Record<string, any>,
  currentTable?: string,
  currentColumns?: { name: string; type: string }[]
): string => {
  const tableName = currentTable || inputs.tableName || 'unknown_table';
  const columns = currentColumns?.map(c => `${c.name} (${c.type})`).join(', ') || '';
  
  const prompts: Record<string, string> = {
    'sql-select-generator': `基于表 ${tableName}${columns ? `，字段: ${columns}` : ''}，用户需求: "${inputs.description || '未填写'}"，生成优化的 SELECT 查询。`,
    'sql-join-generator': `基于当前表 ${tableName}，连接类型: ${inputs.joinType || 'INNER JOIN'}，连接条件: ${inputs.joinCondition || '未填写'}，生成完整的 JOIN 查询。`,
    'sql-create-table-nl': `基于用户需求描述: "${inputs.description || '未填写'}"，业务领域: ${inputs.businessDomain || '通用'}，生成完整的建表 SQL。`,
    'analysis-time-series': `基于时间列 ${inputs.timeColumn || '未选择'}，数值列 ${inputs.valueColumn || '未选择'}，时间粒度: ${inputs.granularity || '月'}，分析类型: ${inputs.analysisType || '趋势分析'}，生成时间序列分析 SQL。`,
    'transform-pivot': `基于行标签 ${inputs.rows || '未选择'}，列标签 ${inputs.columns || '未选择'}，值列 ${inputs.values || '未选择'}，聚合函数: ${inputs.aggregation || 'SUM'}，生成 PIVOT SQL。`,
    'optimization-query-rewrite': `优化以下 SQL: "${inputs.originalSql || '未填写'}"，优化目标: ${inputs.optimizationGoals || '性能优先'}。`
  };

  return prompts[skill.id] || `基于技能 ${skill.name}，输入: ${JSON.stringify(inputs)}，生成 SQL。`;
};

export const SkillInvoker: React.FC<SkillInvokerProps> = ({
  skill,
  currentTable,
  currentColumns,
  onExecute,
  isExecuting,
  setIsExecuting
}) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [appliedExampleName, setAppliedExampleName] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  const [fillMode, setFillMode] = useState<'example' | 'ai'>('example');
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [liveSqlPreview, setLiveSqlPreview] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const suggestionInputRef = useRef<HTMLTextAreaElement>(null);
  const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize default values
  useEffect(() => {
    const defaults: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setInputs(defaults);
    setLiveSqlPreview('');
  }, [skill]);

  // Auto-generate live preview when inputs change (防抖)
  useEffect(() => {
    if (!showLivePreview) return;
    
    // Clear previous timeout
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }
    
    // Debounce preview generation (500ms delay)
    previewDebounceRef.current = setTimeout(() => {
      generateLivePreview();
    }, 500);
    
    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [inputs, showLivePreview]);

  // Reset form
  const handleReset = () => {
    const defaults: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setInputs(defaults);
    setAppliedExampleName(null);
    setErrors({});
  };

  // Quick clear all user inputs - one click to reset everything
  const handleClear = useCallback(() => {
    const emptyInputs: Record<string, any> = {};
    skill.inputSchema.forEach(field => {
      emptyInputs[field.name] = '';
    });
    setInputs(emptyInputs);
    setErrors({});
    setAppliedExampleName(null);
  }, [skill.inputSchema]);

  // One-click apply example input (used as "AI 一键填充")
  const handleApplyExample = (exampleInput: Record<string, any>, exampleName?: string) => {
    // Merge example with current table/column context
    const mergedInput = { ...exampleInput };
    
    // Auto-fill table name if available
    if (currentTable && !mergedInput.tableName && !mergedInput.table) {
      mergedInput.tableName = currentTable;
      mergedInput.table = currentTable;
    }
    
    setInputs(mergedInput);
    setErrors({});
    setAppliedExampleName(exampleName || null);
  };

  // AI-powered intelligent fill - generates context-aware inputs
  const handleAIFill = useCallback(() => {
    const aiGeneratedInputs: Record<string, any> = {};
    
    skill.inputSchema.forEach(field => {
      // Skip already filled required fields
      if (inputs[field.name]) return;
      
      // Generate intelligent defaults based on field type and current context
      switch (field.type) {
        case 'table':
          aiGeneratedInputs[field.name] = currentTable || '';
          break;
        case 'column':
          if (currentColumns && currentColumns.length > 0) {
            aiGeneratedInputs[field.name] = currentColumns[0].name;
          }
          break;
        case 'number':
          aiGeneratedInputs[field.name] = field.defaultValue || 10;
          break;
        case 'boolean':
          aiGeneratedInputs[field.name] = field.defaultValue ?? true;
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            aiGeneratedInputs[field.name] = field.defaultValue || field.options[0];
          }
          break;
        case 'textarea':
          // Generate contextual placeholder suggestions
          if (field.name.includes('description') || field.name.includes('query')) {
            aiGeneratedInputs[field.name] = generateContextHint(skill, currentTable, currentColumns);
          } else {
            aiGeneratedInputs[field.name] = '';
          }
          break;
        default:
          aiGeneratedInputs[field.name] = '';
      }
    });
    
    setInputs(prev => ({ ...prev, ...aiGeneratedInputs }));
    setAppliedExampleName('AI 智能填充');
  }, [skill, currentTable, currentColumns, inputs]);

  // Generate contextual hints based on current table/columns
  const generateContextHint = (skill: AISkill, table?: string, columns?: { name: string; type: string }[]): string => {
    if (!table) return '';
    
    const colNames = columns?.map(c => c.name).join(', ') || '';
    const hints: Record<string, string> = {
      'sql-select-generator': `查询 ${table} 表中的数据${colNames ? `，可选字段：${colNames}` : ''}`,
      'sql-create-table-nl': `创建一个${table}表，包含业务所需的核心字段和属性`,
      'analysis-time-series': `按时间分析 ${table} 表中的数据变化趋势`,
      'transform-pivot': `将 ${table} 表从行转列，便于对比分析`
    };
    
    return hints[skill.id] || `基于 ${table} 表生成 SQL`;
  };

  // Generate live SQL preview based on current inputs (实时预览生成的 SQL)
  const generateLivePreview = useCallback(async () => {
    // Validate required fields first
    const hasRequiredInputs = skill.inputSchema
      .filter(f => f.required)
      .every(f => inputs[f.name]);
    
    if (!hasRequiredInputs) {
      setLiveSqlPreview('// 请填写必填字段以预览 SQL');
      return;
    }

    setIsGeneratingPreview(true);
    
    try {
      const context: SkillExecutionContext = {
        tableName: currentTable,
        columns: currentColumns as any,
        schema: '',
        sampleData: []
      };
      
      const result = await executeSkill({
        skillId: skill.id,
        inputs,
        context,
        simulateOnly: true
      });
      
      if (result.success && result.sql) {
        setLiveSqlPreview(result.sql);
      } else {
        setLiveSqlPreview('-- 预览生成中...');
      }
    } catch (error) {
      setLiveSqlPreview('-- 预览生成失败');
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [skill, inputs, currentTable, currentColumns]);

  // Handle AI suggestion request - generates SQL based on current inputs
  const handleAISuggestion = useCallback(async () => {
    if (!aiSuggestion.trim()) return;
    
    setIsGeneratingSuggestion(true);
    
    try {
      const context: SkillExecutionContext = {
        tableName: currentTable,
        columns: currentColumns as any,
        schema: '',
        sampleData: []
      };
      
      // 使用 AI 建议内容作为输入的一部分
      const enhancedInputs = {
        ...inputs,
        _aiSuggestion: aiSuggestion
      };
      
      const result = await executeSkill({
        skillId: skill.id,
        inputs: enhancedInputs,
        context,
        simulateOnly: true
      });
      
      if (result.success && result.sql) {
        // 将生成的 SQL 填充到对应的输入字段中
        const sqlField = skill.inputSchema.find(f => 
          f.name === 'query' || f.name === 'sql' || f.name === 'originalSql' || f.name === 'cteQuery' || f.name === 'mainQuery'
        );
        if (sqlField) {
          setInputs(prev => ({ ...prev, [sqlField.name]: result.sql }));
        }
        onExecute(result);
      } else if (result.error) {
        onExecute(result);
      }
    } catch (error: any) {
      onExecute({
        success: false,
        error: error.message || 'AI 建议生成失败'
      });
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }, [aiSuggestion, inputs, skill, currentTable, currentColumns, onExecute]);

  // Copy text to clipboard
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Update input value
  const handleInputChange = (name: string, value: any) => {
    setInputs(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    skill.inputSchema.forEach(field => {
      if (field.required && !inputs[field.name]) {
        newErrors[field.name] = '此字段为必填项';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 当前技能所属类别的背景说明（用于模块级提示）
  const categoryHelp = useMemo(() => CATEGORY_HELP[skill.category], [skill.category]);

  // Execute skill
  const handleExecute = async () => {
    if (!validate()) return;
    
    setIsExecuting(true);
    
    try {
      const context: SkillExecutionContext = {
        tableName: currentTable,
        columns: currentColumns as any,
        schema: '',
        sampleData: []
      };
      
      const result = await executeSkill({
        skillId: skill.id,
        inputs,
        context,
        simulateOnly: true
      });
      
      onExecute(result);
    } catch (error: any) {
      onExecute({
        success: false,
        error: error.message || '执行失败'
      });
    }
  };

  // Render input field
  const renderField = (field: SkillInputField) => {
    const value = inputs[field.name];
    const error = errors[field.name];
    const hasValue = value && (typeof value === 'string' ? value.trim() : true);

    const fieldBaseClass = `w-full px-4 py-3 text-sm bg-monokai-bg border border-monokai-accent rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-monokai-fg placeholder-monokai-comment ${
      error
        ? 'border-monokai-pink focus:border-monokai-pink focus:ring-monokai-pink/20'
        : 'focus:border-monokai-purple focus:ring-monokai-purple/20'
    }`;

    switch (field.type) {
      case 'textarea':
        return (
          <div className="relative">
            <textarea
              value={value || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className={`${fieldBaseClass} min-h-[100px] resize-y`}
            />
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {hasValue && (
                <button
                  onClick={() => handleCopy(value, field.name)}
                  className="text-monokai-green hover:text-monokai-green/80 transition-colors"
                  title="复制"
                >
                  {copiedField === field.name ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => handleInputChange(field.name, '')}
                className="text-monokai-comment hover:text-monokai-pink transition-colors"
                title="清除"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="relative">
            <select
              value={value || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              className={`${fieldBaseClass} appearance-none cursor-pointer`}
            >
              <option value="">请选择...</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-monokai-comment" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="relative">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => handleInputChange(field.name, parseInt(e.target.value) || 0)}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
              className={fieldBaseClass}
            />
            {hasValue && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-green">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center justify-between p-3.5 bg-monokai-bg border border-monokai-accent rounded-lg cursor-pointer hover:bg-monokai-sidebar hover:border-monokai-accent/80 transition-colors">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleInputChange(field.name, e.target.checked)}
                className="w-4.5 h-4.5 rounded border-monokai-accent text-monokai-purple focus:ring-monokai-purple focus:ring-offset-0 bg-monokai-sidebar"
              />
              <span className="text-sm text-monokai-fg">
                {field.label}
              </span>
            </div>
            {value && (
              <span className="text-xs text-monokai-green font-medium">已启用</span>
            )}
          </label>
        );

      case 'table':
        return (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={value || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                className={`${fieldBaseClass} appearance-none cursor-pointer`}
              >
                <option value="">请选择表...</option>
                {currentTable && <option value={currentTable}>{currentTable}</option>}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Table className="w-4 h-4 text-monokai-comment" />
              </div>
            </div>
            {!currentTable && (
              <div className="flex items-center gap-2 text-xs text-monokai-yellow bg-monokai-yellow/10 px-3 py-2 rounded-lg">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>当前没有选中表，请在左侧选择一个表</span>
              </div>
            )}
          </div>
        );

      case 'column':
        return (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={value || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                className={`${fieldBaseClass} appearance-none cursor-pointer`}
              >
                <option value="">请选择列...</option>
                {currentColumns?.map(col => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Columns className="w-4 h-4 text-monokai-comment" />
              </div>
            </div>
            {!currentColumns || currentColumns.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-monokai-yellow bg-monokai-yellow/10 px-3 py-2 rounded-lg">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>当前表没有可用列</span>
              </div>
            ) : null}
          </div>
        );

      default:
        return (
          <div className="relative">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={fieldBaseClass}
            />
            {hasValue && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-green">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Skill Header + 背景说明 + 示例一键填充 */}
      <div className="mb-6 pb-5 border-b border-monokai-accent space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-monokai-purple/20 to-monokai-pink/20 flex items-center justify-center text-2xl">
            {skill.icon || '✨'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-monokai-fg">
              {skill.name}
            </h2>
            <p className="text-sm text-monokai-comment mt-1">
              {skill.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {currentTable && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-monokai-blue/20 text-monokai-blue text-xs font-medium rounded-lg">
                  <Table className="w-3 h-3" />
                  {currentTable}
                </span>
              )}
              {currentColumns && currentColumns.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-monokai-green/20 text-monokai-green text-xs font-medium rounded-lg">
                  <Columns className="w-3 h-3" />
                  {currentColumns.length} 列
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 模块背景说明：使用场景 + 常见错误 + AI 提示 - 可折叠 */}
        <div className="rounded-lg border border-monokai-accent/60 bg-monokai-sidebar/70 overflow-hidden">
          {/* 可折叠标题栏 */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-monokai-accent/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-monokai-yellow" />
              <span className="text-xs font-semibold text-monokai-fg">{categoryHelp.title}</span>
              <span className="text-[11px] text-monokai-comment">使用帮助</span>
            </div>
            <div className={`transform transition-transform duration-200 ${showHelp ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-monokai-comment" />
            </div>
          </button>

          {/* 可折叠内容区 */}
          {showHelp && (
            <div className="px-3.5 pb-3 space-y-3">
              <p className="text-xs text-monokai-comment">{categoryHelp.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-green/90">
                    <Target className="w-3 h-3" /><span>适用场景</span>
                  </div>
                  <ul className="space-y-1">
                    {categoryHelp.scenarios.map((s, idx) => (
                      <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                        <span className="text-monokai-green/70 mt-0.5">•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-pink/90">
                    <AlertTriangle className="w-3 h-3" /><span>常见错误</span>
                  </div>
                  <ul className="space-y-1">
                    {categoryHelp.commonErrors.slice(0, 4).map((s, idx) => (
                      <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                        <span className="text-monokai-pink/70 mt-0.5">•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-purple/90">
                    <Zap className="w-3 h-3" /><span>AI 协作提示</span>
                  </div>
                  <ul className="space-y-1">
                    {categoryHelp.aiHints.slice(0, 3).map((s, idx) => (
                      <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                        <span className="text-monokai-purple/70 mt-0.5">•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 快速开始 + 最佳实践 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-monokai-accent/40">
                {/* 快速开始 */}
                {categoryHelp.quickStart && categoryHelp.quickStart.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-green/90">
                      <Zap className="w-3 h-3" /><span>快速开始</span>
                    </div>
                    <ul className="space-y-0.5">
                      {categoryHelp.quickStart.map((s, idx) => (
                        <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                          <span className="text-monokai-green/70 mt-0.5">{idx + 1}.</span><span>{s.replace(/^\d+\.\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 最佳实践 */}
                {categoryHelp.bestPractices && categoryHelp.bestPractices.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-yellow/90">
                      <Target className="w-3 h-3" /><span>最佳实践</span>
                    </div>
                    <ul className="space-y-0.5">
                      {categoryHelp.bestPractices.map((s, idx) => (
                        <li key={idx} className="text-[11px] text-monokai-comment leading-relaxed flex items-start gap-1">
                          <span className="text-monokai-yellow/70 mt-0.5">•</span><span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 示例流程 */}
              {categoryHelp.exampleFlows && categoryHelp.exampleFlows.length > 0 && (
                <div className="pt-2 border-t border-monokai-accent/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-monokai-blue/90 mb-2">
                    <Wand2 className="w-3 h-3" /><span>推荐使用流程</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoryHelp.exampleFlows.map((flow, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-monokai-blue/10 border border-monokai-blue/30 rounded-md text-[11px] text-monokai-blue">
                        <span className="font-medium">{flow.name}</span>
                        <span className="text-monokai-comment">→</span><span>{flow.description}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 示例一键填充区：基于技能示例的“AI 一键填充” */}
        {skill.examples && skill.examples.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 text-xs text-monokai-comment">
              <SparklesIcon className="w-3 h-3 text-monokai-purple" />
              <span>示例一键填充</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skill.examples.map(example => (
                <button
                  key={example.name}
                  type="button"
                  onClick={() => handleApplyExample(example.input, example.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-colors ${
                    appliedExampleName === example.name
                      ? 'border-monokai-purple bg-monokai-purple/20 text-monokai-fg'
                      : 'border-monokai-accent/60 text-monokai-comment hover:border-monokai-purple/80 hover:text-monokai-fg'
                  }`}
                >
                  <SparklesIcon className="w-3 h-3" />
                  <span>{example.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI 实时建议填充区 - 用户输入即生成 SQL 方案 */}
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-monokai-purple/10 to-monokai-pink/10 border border-monokai-purple/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center">
                <MagicWand className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-monokai-fg">AI 实时建议</h4>
                <p className="text-[11px] text-monokai-comment">描述你的需求，AI 实时生成 SQL 方案</p>
              </div>
            </div>
            {!showLivePreview && (
              <button
                onClick={() => setShowLivePreview(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-monokai-purple/20 hover:bg-monokai-purple/30 text-monokai-purple rounded-lg transition-colors"
              >
                <Eye className="w-3 h-3" />
                <span>显示预览</span>
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={suggestionInputRef}
                value={aiSuggestion}
                onChange={(e) => setAiSuggestion(e.target.value)}
                placeholder={generateFillPrompt(skill, inputs, currentTable, currentColumns)}
                rows={3}
                className="w-full px-4 py-3 text-sm bg-monokai-bg border border-monokai-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-monokai-purple focus:border-transparent transition-all text-monokai-fg placeholder-monokai-comment resize-y"
              />
              {aiSuggestion && (
                <button
                  onClick={() => setAiSuggestion('')}
                  className="absolute right-3 top-3 text-monokai-comment hover:text-monokai-pink transition-colors"
                  title="清除"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleAISuggestion}
                disabled={!aiSuggestion.trim() || isGeneratingSuggestion}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-monokai-purple to-monokai-pink hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
              >
                {isGeneratingSuggestion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>生成 SQL 方案</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  setAiSuggestion('');
                  suggestionInputRef.current?.focus();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-monokai-bg border border-monokai-accent hover:bg-monokai-sidebar text-monokai-comment text-sm rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重置</span>
              </button>
              
              <div className="ml-auto flex items-center gap-2 text-xs text-monokai-comment">
                <MessageSquare className="w-3 h-3" />
                <span>描述需求 → 自动生成</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-5">
        {skill.inputSchema.map(field => (
          <div key={field.name} className="group">
            <label className="flex items-center gap-2 text-sm font-semibold text-monokai-fg mb-2">
              {field.label}
              {field.required && (
                <span className="text-monokai-pink bg-monokai-pink/20 px-1.5 py-0.5 rounded text-xs">必填</span>
              )}
            </label>
            {field.description && (
              <p className="text-xs text-monokai-comment mb-2 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                {field.description}
              </p>
            )}
            {renderField(field)}
            {errors[field.name] && (
              <p className="mt-2 text-xs text-monokai-pink flex items-center gap-1.5 bg-monokai-pink/10 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Live SQL Preview - 实时 SQL 预览 */}
      {showLivePreview && (
        <div className="mt-5 p-4 rounded-lg border border-monokai-purple/30 bg-monokai-sidebar/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-monokai-purple/20 flex items-center justify-center">
                <Code className="w-3.5 h-3.5 text-monokai-purple" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-monokai-fg">实时 SQL 预览</h4>
                <p className="text-[11px] text-monokai-comment">输入变化时自动更新</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGeneratingPreview && (
                <Loader2 className="w-3.5 h-3.5 text-monokai-purple animate-spin" />
              )}
              <button
                onClick={generateLivePreview}
                disabled={isGeneratingPreview}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-monokai-purple/20 hover:bg-monokai-purple/30 text-monokai-purple rounded-lg transition-colors"
                title="手动刷新预览"
              >
                <RefreshCw className={`w-3 h-3 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
              <button
                onClick={() => setShowLivePreview(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-monokai-bg hover:bg-monokai-sidebar text-monokai-comment rounded-lg transition-colors"
                title="隐藏预览"
              >
                <EyeOff className="w-3 h-3" />
                <span>隐藏</span>
              </button>
            </div>
          </div>
          
          <div className="relative">
            <pre className="max-h-48 overflow-y-auto p-3 bg-monokai-bg rounded-lg border border-monokai-accent/50 text-xs font-mono text-monokai-fg custom-scrollbar">
              {isGeneratingPreview ? (
                <span className="text-monokai-comment">// 正在生成预览...</span>
              ) : (
                <code>{liveSqlPreview || '// 请填写必要参数以生成预览'}</code>
              )}
            </pre>
            {liveSqlPreview && (
              <button
                onClick={() => handleCopy(liveSqlPreview, 'livePreview')}
                className="absolute top-2 right-2 p-1.5 bg-monokai-sidebar hover:bg-monokai-accent/30 rounded-lg transition-colors"
                title="复制 SQL"
              >
                {copiedField === 'livePreview' ? (
                  <Check className="w-3.5 h-3.5 text-monokai-green" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-monokai-comment" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-monokai-accent">
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-monokai-purple to-monokai-pink hover:opacity-90 disabled:opacity-70 text-white font-semibold rounded-lg transition-all duration-200"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>生成 SQL</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-70" />
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2.5 bg-monokai-bg border border-monokai-accent hover:bg-monokai-sidebar text-monokai-fg font-medium rounded-lg transition-colors"
          title="重置为默认值"
        >
          <RotateCcw className="w-4 h-4" />
          <span>重置</span>
        </button>

        {/* 快速清除按钮 - 一键清空所有输入 */}
        <button
          onClick={() => {
            handleClear();
          }}
          disabled={isExecuting}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-monokai-pink/10 border border-monokai-pink/40 hover:bg-monokai-pink/20 text-monokai-pink font-medium rounded-lg transition-colors"
          title="一键清空所有输入内容"
        >
          <Trash2 className="w-4 h-4" />
          <span>快速清除</span>
        </button>

        {/* 实时预览开关 */}
        <button
          onClick={() => setShowLivePreview(!showLivePreview)}
          className={`flex items-center gap-2 px-3.5 py-2.5 border font-medium rounded-lg transition-colors ${
            showLivePreview
              ? 'bg-monokai-purple/20 border-monokai-purple/50 text-monokai-purple'
              : 'bg-monokai-bg border-monokai-accent text-monokai-comment hover:text-monokai-fg'
          }`}
          title={showLivePreview ? '隐藏实时预览' : '显示实时预览'}
        >
          {showLivePreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>预览</span>
        </button>

        {/* 一键 AI 填充 */}
        <button
          onClick={handleAIFill}
          disabled={isExecuting}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-monokai-green/10 border border-monokai-green/40 hover:bg-monokai-green/20 text-monokai-green font-medium rounded-lg transition-colors"
          title="使用当前表/列信息自动填充"
        >
          <SparklesIcon className="w-4 h-4" />
          <span>AI 填充</span>
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-monokai-comment bg-monokai-bg px-3 py-1.5 rounded-lg">
          <kbd className="px-1.5 py-0.5 bg-monokai-sidebar rounded text-xs font-mono">Enter</kbd>
          <span>快速生成</span>
        </div>
      </div>
    </div>
  );
};

export default SkillInvoker;
