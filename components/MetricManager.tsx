import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MetricChart, MetricPackage, MetricDefinition } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { aiService } from '../services/aiService';
import { MetricCard } from './MetricCard';
import { MetricChartListModal } from './MetricChartListModal';
import { 
  Database, Plus, RefreshCw, Trash2, ChevronRight, 
  ChevronDown, Check, Loader2, Package, ArrowLeft, Play,
  BarChart2, Star, Search, Download, Upload,
  Sparkles, HelpCircle, X, ChevronUp, Zap, Undo2
} from 'lucide-react';

// ── MECE 背景说明数据 ──────────────────────────────────────────────────────────
type MetricCategoryHelp = {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  bestPractices: string[];
  formulaExamples: { name: string; formula: string; note: string }[];
};

const METRIC_CATEGORY_HELP: Record<string, MetricCategoryHelp> = {
  metricModeling: {
    title: '指标定义 / 建模',
    description: '适用于将业务问题转化为可量化的指标，每个指标需包含名称、场景、特点、定义、公式、案例与数据依赖。',
    scenarios: [
      '有明确业务目标，需要定义一组核心指标体系',
      '数据表结构已知，希望 AI 自动推断关键指标',
      '需要快速搭建营收/流量/转化/留存的指标集合',
      '对已有指标进行标准化命名与语义对齐',
    ],
    commonErrors: [
      '公式中使用列名占位符（如 amount_col），未替换为实际字段名',
      '混用 MySQL 聚合语法（如 GROUP_CONCAT），在 DuckDB 中报错',
      '比率类指标未处理分母为零（应使用 NULLIF 防除零）',
      '趋势类指标未指定时间粒度，导致聚合结果失去时序意义',
      '依赖字段（dependencies）填写表名而非列名',
    ],
    aiHints: [
      '提供「业务目标 + 表名 + 关键字段」，AI 可一次生成 5-10 个指标草稿',
      '生成后检查每个公式是否有未填的占位符，可再次让 AI 补全',
      '复合指标（如留存率）建议先拆解为原子指标，再组合',
      '指定分类（营收类/流量类/转化类），AI 生成的指标体系更系统',
    ],
    quickStart: [
      '1. 在左侧勾选目标数据表',
      '2. 输入包名或点击「AI 填充」自动生成包名与描述',
      '3. 在自然语言框描述业务需求，AI 实时生成指标草稿',
      '4. 检查草稿并点击「生成指标」保存指标包',
      '5. 生成后进入详情页逐一验证指标公式',
    ],
    bestPractices: [
      '指标名称使用 snake_case（如 daily_active_users），保持一致性',
      '每个指标必须填写单位（个/元/次/%），便于图表轴标签',
      '公式中明确写出聚合粒度（如：按 user_id 去重）',
      '复杂公式优先写成 CTE 形式，便于后续验证与维护',
    ],
    formulaExamples: [
      { name: 'DAU（日活用户数）', formula: 'COUNT(DISTINCT user_id)', note: '配合 WHERE date_trunc 过滤日期' },
      { name: '订单金额总计', formula: 'SUM(order_amount)', note: '注意过滤已取消订单' },
      { name: '用户渗透率', formula: 'COUNT(DISTINCT user_id) * 1.0 / NULLIF(total_users, 0)', note: '用 NULLIF 防分母为零' },
    ],
  },
  metricValidation: {
    title: '指标验证 / 修复',
    description: '适用于对指标 SQL 公式进行实际执行验证，定位语法或字段错误，并使用 AI 自动修复后重新验证。',
    scenarios: [
      '批量导入后的指标公式正确性核查',
      '数据表结构变更后，检查依赖该表的指标是否仍然可用',
      '新建指标后，确认公式在实际数据上可正确执行',
      'AI 生成的公式含占位符或方言语法，需修复后验证',
    ],
    commonErrors: [
      '验证时未选择数据源表，导致 SQL 执行缺失 FROM 目标',
      '指标公式为纯聚合表达式（如 SUM(amount)），需补全 SELECT...FROM 结构',
      '字段名大小写不匹配（DuckDB 默认不区分大小写，但双引号内区分）',
      '公式引用的列已被重命名或删除，验证失败但错误信息不明确',
      '批量验证时并发触发过多 AI 请求，导致限流失败',
    ],
    aiHints: [
      '验证失败后，将错误信息粘贴给 AI，描述「这是指标 X 的公式，执行报错如下」',
      '使用「修复」按钮（🔧）让 AI 自动改写公式，修复后会自动重新验证',
      '批量验证前建议先单个验证典型指标，确认数据源连通性',
      'AI 修复时可提示「保持业务含义不变，仅修复语法错误」',
    ],
    quickStart: [
      '1. 进入指标包详情页',
      '2. 点击指标卡片的「验证（▶）」按钮进行单个验证',
      '3. 若出现红色「验证失败」标签，点击「修复（🔧）」',
      '4. AI 修复完成后自动重新验证，直到出现绿色「已验证」标签',
      '5. 全部验证通过后点击顶部「验证全部」进行批量确认',
    ],
    bestPractices: [
      '公式中使用 LIMIT 1 或 COUNT(*) 等轻量操作验证，而非完整聚合扫描',
      '验证前确认左侧数据源表已正确导入且有数据',
      '修复后建议对比原公式与修复版本，确认业务含义未改变',
      '验证通过的指标及时打上「收藏」标记，便于后续快速检索',
    ],
    formulaExamples: [
      { name: '防除零写法', formula: 'SUM(revenue) / NULLIF(COUNT(*), 0)', note: '避免分母为 0 导致运行时错误' },
      { name: '安全类型转换', formula: 'TRY_CAST(amount_str AS DOUBLE)', note: '字段类型不匹配时安全转换，失败返回 NULL' },
      { name: '空值处理', formula: 'COALESCE(SUM(amount), 0)', note: '当表无数据时返回 0 而非 NULL' },
    ],
  },
  metricAnalysis: {
    title: '指标分类 / 检索',
    description: '适用于对指标按业务域、计算类型、数据依赖进行分类管理，支持关键词搜索与收藏筛选，快速定位目标指标。',
    scenarios: [
      '指标包内指标数量超过 20 个，需要快速定位特定指标',
      '按业务域（营收/流量/转化/留存）筛选相关指标',
      '查找依赖特定字段（如 user_id）的所有指标',
      '标记高频使用的核心指标以便快速访问',
    ],
    commonErrors: [
      '搜索词使用中文业务名，但指标名称为英文，搜索无结果（可搜定义字段）',
      '「仅显示收藏」过滤器开启后忘记关闭，导致看不到新增指标',
      '指标分类（category）未填写，搜索时无法按类别过滤',
      '多个指标包中存在同名指标，未注意当前处于哪个包的详情页',
    ],
    aiHints: [
      '搜索支持指标名称、定义与分类的模糊匹配，可用英文关键词搜索',
      '为指标填写 category（如「营收类」「流量类」），可在搜索框中精确过滤',
      '收藏核心指标后，可快速切换「仅收藏」视图做日常查看',
      '指标包支持导出为 JSON，可离线整理后再导入其他项目复用',
    ],
    quickStart: [
      '1. 进入指标包详情页，顶部搜索框输入关键词',
      '2. 点击⭐筛选按钮切换「收藏 / 全部」模式',
      '3. 搜索结果为零时，检查「仅显示收藏」是否已开启',
      '4. 为常用指标点击星标图标进行收藏',
      '5. 使用「导出」将整个指标包保存为 JSON 备份',
    ],
    bestPractices: [
      '统一指标命名规范（snake_case 英文），提高搜索命中率',
      '每个指标填写 category 字段，便于分组查看',
      '跨项目复用时优先用导入/导出，而非手动重建',
      '收藏数量建议控制在 10 个以内，保持核心指标突出',
    ],
    formulaExamples: [
      { name: '按分类搜索', formula: '搜索框输入 "营收类" 或 "revenue"', note: '匹配指标名、定义、分类三个字段' },
      { name: '依赖字段检索', formula: '搜索框输入字段名如 "user_id"', note: '可在指标定义文本中匹配' },
      { name: '批量导出复用', formula: '点击包列表「⬇」图标 → 保存 JSON → 导入新项目', note: '跨库复用指标体系' },
    ],
  },
  chartGeneration: {
    title: '图表生成 / 可视化',
    description: '适用于从指标公式自动推断图表类型（折线/柱状/饼图等）并生成可在 SQL 编辑器中展示的图表配置，无需手动配置图表参数。',
    scenarios: [
      '趋势类指标（日/周/月聚合）自动生成折线图',
      '构成类指标（各类别占比）自动生成饼图或柱状图',
      '对比类指标（同环比）自动生成分组柱状图',
      '批量为指标包内所有指标生成图表',
    ],
    commonErrors: [
      '数据源表未连接或无数据，生成图表时 SQL 返回空结果',
      '指标公式为纯标量（如 COUNT(*)），无时间维度，系统无法推断 X 轴',
      '图表类型推断错误，需手动调整图表配置',
      '批量生成时因 AI 调用频繁导致超时，部分指标图表生成失败',
    ],
    aiHints: [
      '生成图表前确保指标已通过「验证」（绿色标签），避免图表 SQL 执行失败',
      '趋势类指标在公式中注明时间字段（如 date_trunc），AI 图表推断更准确',
      '批量生成时建议分批（每次 5-10 个），避免并发限流',
      '生成的图表可在 SQL 编辑器的「图表」标签页中查看与调整',
    ],
    quickStart: [
      '1. 进入指标包详情页，确认指标已验证通过',
      '2. 点击指标卡片右上角「📊」按钮生成单个图表',
      '3. 或点击顶部「生成全部图表」批量处理',
      '4. 点击「查看图表」打开图表列表模态框',
      '5. 点击图表卡片的「在 SQL 编辑器中打开」进行进一步分析',
    ],
    bestPractices: [
      '趋势指标公式中建议包含 date_trunc 或 strftime，帮助 AI 推断时间 X 轴',
      '构成指标公式中包含 GROUP BY 类别字段，有助于生成正确的分组图表',
      '重新分析（刷新）指标包后需重新生成图表，旧图表不会自动更新',
    ],
    formulaExamples: [
      { name: '折线图（趋势）', formula: "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt FROM t GROUP BY 1", note: '包含时间维度，AI 推断为折线图' },
      { name: '柱状图（分组）', formula: 'SELECT category, SUM(amount) AS total FROM t GROUP BY category', note: '分类维度，AI 推断为柱状图' },
      { name: '饼图（构成）', formula: 'SELECT status, COUNT(*) AS cnt FROM t GROUP BY status', note: '枚举类别，AI 推断为饼图' },
    ],
  },
  metricManagement: {
    title: '指标包管理 / 版本控制',
    description: '适用于指标包的创建、导入/导出、版本历史查看与血缘追踪管理，支持跨项目指标体系迁移与复用。',
    scenarios: [
      '从零开始构建一套指标体系并保存为指标包',
      '将团队共享的指标包 JSON 导入当前项目',
      '数据表结构变更后，重新分析刷新指标包',
      '查看某个指标的修改历史与版本差异',
    ],
    commonErrors: [
      '导入 JSON 格式不合法（缺少 id/name/metrics 字段）导致导入失败',
      '重新分析（刷新）时数据源表已被删除，导致分析报错',
      '删除指标包时未导出备份，数据无法恢复',
      '同一指标包被多次导入，产生重复包（系统自动生成新 ID，但内容相同）',
    ],
    aiHints: [
      '重新分析前先导出当前指标包作为备份，防止分析结果覆盖手动调整内容',
      '导入外部指标包后，逐一检查公式中的表名是否与当前项目一致',
      '版本号大于 1 的指标可点击展开历史记录，查看各版本变更字段',
      '血缘追踪（lineage）字段由 AI 分析时自动填充，可辅助理解指标依赖关系',
    ],
    quickStart: [
      '1. 在指标包列表页点击「导入」上传 JSON 文件',
      '2. 或勾选数据表后点击「新建指标包」从零创建',
      '3. 进入指标包后点击「重新分析」可基于当前表重新生成指标',
      '4. 点击指标列表页的「导出」图标保存指标包 JSON',
      '5. 删除前务必先导出备份',
    ],
    bestPractices: [
      '每次重要修改前先「导出」备份，避免误操作丢失数据',
      '指标包命名包含业务域与日期（如：电商核心指标_2026Q1），便于版本识别',
      '导入外部包后立即执行「验证全部」确认字段匹配性',
    ],
    formulaExamples: [
      { name: '导出指标包', formula: '点击包列表「⬇」图标 → 保存 .json', note: '包含所有指标定义与元数据' },
      { name: '导入指标包', formula: '包列表页右上角「导入」→ 选择 .json 文件', note: '系统自动生成新 ID 避免冲突' },
      { name: '版本查看', formula: '指标卡片展开 → 查看 history 字段变更记录', note: '保留最近 N 版修改历史' },
    ],
  },
};

const HELP_CATEGORIES = [
  { key: 'metricModeling', label: '指标建模' },
  { key: 'metricValidation', label: '指标验证' },
  { key: 'metricAnalysis', label: '指标分类' },
  { key: 'chartGeneration', label: '图表生成' },
  { key: 'metricManagement', label: '包管理' },
] as const;

// ── 背景说明子组件 ──────────────────────────────────────────────────────────────
const HelpSection: React.FC<{
  title: string;
  color: string;
  items: string[];
  numbered?: boolean;
}> = ({ title, color, items, numbered }) => (
  <div>
    <div className={`text-${color} uppercase font-medium mb-1.5 text-xs`}>{title}</div>
    {items.map((item, i) => (
      <div key={i} className="flex gap-1.5 mb-1">
        <span className={`text-${color} shrink-0 mt-0.5`}>{numbered ? `${i + 1}.` : '·'}</span>
        <span className="text-monokai-fg text-xs leading-relaxed">{numbered ? item.replace(/^\d+\.\s*/, '') : item}</span>
      </div>
    ))}
  </div>
);

interface MetricManagerProps {
  tables: string[];
  onExecuteSql?: (sql: string) => void;
  onChartGenerated?: (chart: MetricChart) => void;
}

export const MetricManager: React.FC<MetricManagerProps> = ({ tables, onExecuteSql, onChartGenerated }) => {
  // State
  const [packages, setPackages] = useState<MetricPackage[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [selectedPackage, setSelectedPackage] = useState<MetricPackage | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // 图表相关状态
  const [metricCharts, setMetricCharts] = useState<Map<string, boolean>>(new Map()); // metricId -> hasChart
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [chartProgress, setChartProgress] = useState('');
  const [showChartList, setShowChartList] = useState(false);
  
  // 收藏相关状态
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('duckdb_metric_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);

  // 数据源配置
  const [dataSourceType, setDataSourceType] = useState<'csv' | 'parquet' | 'json' | 'sqlite'>('csv');
  const [dataSourcePath, setDataSourcePath] = useState('');
  const [dataSourceName, setDataSourceName] = useState('');

  // AI 填充 & 自然语言输入
  const [aiNaturalLanguageInput, setAiNaturalLanguageInput] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [metricPreview, setMetricPreview] = useState<MetricDefinition[] | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const nlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 快速清除撤销
  const [lastClearedForm, setLastClearedForm] = useState<{
    packageName: string;
    packageDescription: string;
    aiInput: string;
    selectedTables: Set<string>;
  } | null>(null);
  const [showClearToast, setShowClearToast] = useState(false);

  // 背景说明面板
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [activeHelpCategory, setActiveHelpCategory] = useState<keyof typeof METRIC_CATEGORY_HELP>('metricModeling');

  // Load packages on mount
  useEffect(() => {
    loadPackages();
  }, []);

  // 当选择的指标包变化时，加载其关联的图表
  useEffect(() => {
    if (selectedPackage) {
      loadMetricChartsForPackage(selectedPackage.id);
    }
  }, [selectedPackage]);

  const loadMetricChartsForPackage = (packageId: string) => {
    const charts = metricAnalyzer.getChartsByPackage(packageId);
    const chartMap = new Map<string, boolean>();
    charts.forEach(chart => {
      chartMap.set(chart.metricId, true);
    });
    setMetricCharts(chartMap);
  };

  const loadPackages = () => {
    const loaded = metricAnalyzer.loadMetricPackages();
    setPackages(loaded);
  };

  // ── AI 一键填充 ──────────────────────────────────────────────
  const handleMetricAIFill = async () => {
    if (selectedTables.size === 0) {
      alert('请先在左侧勾选至少一张数据表');
      return;
    }
    setIsAiFilling(true);
    try {
      const tableList = Array.from(selectedTables).join('、');
      const userHint = aiNaturalLanguageInput.trim()
        ? `\n用户补充描述：${aiNaturalLanguageInput.trim()}`
        : '';
      const prompt = `根据以下数据表名称，推断其业务域并生成一个合适的指标包名称和简短描述（描述不超过30字）。
数据表：${tableList}${userHint}

仅返回 JSON，格式：{"name": "包名", "description": "描述"}`;
      const result = await aiService.robustCall<{ name: string; description: string }>(
        'metric' as any,
        prompt,
        '你是数据分析专家，负责为指标包命名。仅返回 JSON，不包含其他内容。',
        true,
        2
      );
      if (result?.name) setPackageName(result.name);
      if (result?.description) setPackageDescription(result.description);
    } catch (err) {
      console.error('AI fill failed:', err);
    } finally {
      setIsAiFilling(false);
    }
  };

  // ── 快速清除 ─────────────────────────────────────────────────
  const handleMetricQuickClear = () => {
    setLastClearedForm({
      packageName,
      packageDescription,
      aiInput: aiNaturalLanguageInput,
      selectedTables: new Set(selectedTables),
    });
    setPackageName('');
    setPackageDescription('');
    setAiNaturalLanguageInput('');
    setSelectedTables(new Set());
    setMetricPreview(null);
    setShowClearToast(true);
    setTimeout(() => setShowClearToast(false), 5000);
  };

  const handleUndoClear = () => {
    if (!lastClearedForm) return;
    setPackageName(lastClearedForm.packageName);
    setPackageDescription(lastClearedForm.packageDescription);
    setAiNaturalLanguageInput(lastClearedForm.aiInput);
    setSelectedTables(lastClearedForm.selectedTables);
    setLastClearedForm(null);
    setShowClearToast(false);
  };

  // ── 自然语言实时预览（防抖 600ms） ────────────────────────────
  const handleNLInputChange = (value: string) => {
    setAiNaturalLanguageInput(value);
    setMetricPreview(null);
    if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);
    if (!value.trim() || selectedTables.size === 0) return;
    nlDebounceRef.current = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const tableList = Array.from(selectedTables).join('、');
        const prompt = `根据以下需求生成指标定义（返回 JSON 数组，每个元素包含 name/scenario/characteristics/value/definition/formula/example/dependencies/unit/category 字段，最多 3 个指标）：
数据表：${tableList}
需求描述：${value.trim()}`;
        const result = await aiService.robustCall<MetricDefinition[]>(
          'metric' as any,
          prompt,
          '你是数据分析专家。仅返回 JSON 数组，不包含其他内容。',
          true,
          1
        );
        const arr = Array.isArray(result) ? result : [result];
        setMetricPreview(arr.slice(0, 3).map((m: any, i: number) => ({
          id: `preview_${i}`,
          name: m.name ?? '',
          scenario: m.scenario ?? '',
          characteristics: m.characteristics ?? '',
          value: m.value ?? '',
          definition: m.definition ?? '',
          formula: m.formula ?? '',
          example: m.example ?? '',
          dependencies: m.dependencies ?? [],
          unit: m.unit,
          category: m.category,
          createdAt: Date.now(),
        })));
      } catch {
        /* 预览失败静默处理 */
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 600);
  };

  // 切换指标收藏状态
  const toggleFavorite = (metricId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(metricId)) {
        newFavorites.delete(metricId);
      } else {
        newFavorites.add(metricId);
      }
      localStorage.setItem('duckdb_metric_favorites', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  };

  // 检查指标是否已收藏
  const isFavorite = (metricId: string) => favorites.has(metricId);

  // 过滤指标列表
  const filterMetrics = (metrics: MetricDefinition[]): MetricDefinition[] => {
    return metrics.filter(metric => {
      const matchFavorite = !showFavoritesOnly || favorites.has(metric.id);
      const matchSearch = !searchTerm || 
        metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metric.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metric.category?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFavorite && matchSearch;
    });
  };

  // 导出指标包为JSON文件
  const exportPackage = (pkg: MetricPackage) => {
    const dataStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metric_package_${pkg.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 导入指标包
  const importPackage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as MetricPackage;
        if (imported.id && imported.name && imported.metrics) {
          // 生成新ID避免冲突
          const newPkg: MetricPackage = {
            ...imported,
            id: `pkg_${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metrics: imported.metrics.map(m => ({
              ...m,
              id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }))
          };
          
          // 保存到存储
          const existing = metricAnalyzer.loadMetricPackages();
          existing.push(newPkg);
          metricAnalyzer.saveAllPackages(existing);
          loadPackages();
        } else {
          alert('无效的指标包格式');
        }
      } catch (err) {
        alert('导入失败: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // 预定义指标模板
  const metricTemplates: Omit<MetricDefinition, 'id' | 'createdAt'>[] = [
    {
      name: 'total_count',
      scenario: '统计总数',
      characteristics: '计数型',
      value: '用于了解业务规模',
      definition: '记录的总数量',
      formula: 'COUNT(*)',
      example: '总订单数为 1000',
      dependencies: [],
      unit: '个',
      category: '基础统计'
    },
    {
      name: 'sum_amount',
      scenario: '金额汇总',
      characteristics: '累加型',
      value: '用于了解业务收入',
      definition: '金额字段的总和',
      formula: 'SUM(amount)',
      example: '总金额为 50000 元',
      dependencies: ['amount'],
      unit: '元',
      category: '营收类'
    },
    {
      name: 'avg_amount',
      scenario: '平均金额',
      characteristics: '比率型',
      value: '用于了解平均业务水平',
      definition: '金额字段的平均值',
      formula: 'AVG(amount)',
      example: '平均金额为 50 元',
      dependencies: ['amount'],
      unit: '元',
      category: '营收类'
    },
    {
      name: 'max_amount',
      scenario: '最大金额',
      characteristics: '极值型',
      value: '用于了解业务峰值',
      definition: '金额字段的最大值',
      formula: 'MAX(amount)',
      example: '最大金额为 1000 元',
      dependencies: ['amount'],
      unit: '元',
      category: '基础统计'
    },
    {
      name: 'min_amount',
      scenario: '最小金额',
      characteristics: '极值型',
      value: '用于了解业务底线',
      definition: '金额字段的最小值',
      formula: 'MIN(amount)',
      example: '最小金额为 1 元',
      dependencies: ['amount'],
      unit: '元',
      category: '基础统计'
    },
    {
      name: 'distinct_count',
      scenario: '去重计数',
      characteristics: '计数型',
      value: '用于了解唯一主体数量',
      definition: '去重后的数量',
      formula: 'COUNT(DISTINCT user_id)',
      example: '唯一用户数为 500',
      dependencies: ['user_id'],
      unit: '个',
      category: '流量类'
    },
    {
      name: 'daily_count',
      scenario: '日活跃',
      characteristics: '趋势型',
      value: '用于了解每日业务变化',
      definition: '按日期统计的记录数',
      formula: 'SELECT date_trunc("day", created_at) as day, COUNT(*) FROM table GROUP BY 1',
      example: '今日活跃用户为 100',
      dependencies: ['created_at'],
      unit: '个',
      category: '流量类'
    },
    {
      name: 'retention_rate',
      scenario: '留存率',
      characteristics: '比率型',
      value: '用于了解用户粘性',
      definition: '次日留存用户比例',
      formula: 'SUM(CASE WHEN datediff("day", created_at, event_date) = 1 THEN 1 ELSE 0 END) / COUNT(*)',
      example: '次日留存率为 40%',
      dependencies: ['created_at', 'event_date'],
      unit: '%',
      category: '转化类'
    }
  ];

  // 从模板添加指标
  const addFromTemplate = (template: Omit<MetricDefinition, 'id' | 'createdAt'>) => {
    if (!selectedPackage) {
      alert('请先选择或创建指标包');
      return;
    }

    const newMetric: MetricDefinition = {
      ...template,
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    const updatedPackage = {
      ...selectedPackage,
      metrics: [...selectedPackage.metrics, newMetric],
      updatedAt: Date.now()
    };

    metricAnalyzer.updateMetricPackage(selectedPackage.id, {
      metrics: updatedPackage.metrics
    });

    loadPackages();
    setSelectedPackage(updatedPackage);
    setShowTemplates(false);
  };

  const toggleTable = (table: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  };

  const selectAllTables = () => {
    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables));
    }
  };

  const handleAnalyze = async () => {
    if (selectedTables.size === 0) return;
    if (!packageName.trim()) {
      alert('请输入指标包名称');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('正在收集表结构...');

    try {
      const tableArray = Array.from(selectedTables);
      
      const metrics = await metricAnalyzer.analyzeMetrics(
        tableArray,
        (chunk) => {
          setAnalysisProgress('AI 正在分析生成指标定义...');
        }
      );

      // Create and save package
      const newPackage = metricAnalyzer.createMetricPackage(
        packageName,
        packageDescription,
        tableArray,
        metrics
      );
      
      metricAnalyzer.saveMetricPackage(newPackage);
      loadPackages();
      setSelectedPackage(newPackage);
      setShowNewForm(false);
      setPackageName('');
      setPackageDescription('');
      setSelectedTables(new Set());
      
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('分析失败: ' + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleRefresh = async (pkg: MetricPackage) => {
    if (pkg.sourceTables.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress('正在重新分析...');

    try {
      const metrics = await metricAnalyzer.analyzeMetrics(
        pkg.sourceTables,
        () => {}
      );

      metricAnalyzer.updateMetricPackage(pkg.id, {
        metrics
      });
      
      loadPackages();
      setSelectedPackage(prev => prev?.id === pkg.id 
        ? { ...pkg, metrics, updatedAt: Date.now() } 
        : prev
      );
      
    } catch (error) {
      console.error('Refresh failed:', error);
      alert('更新失败: ' + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleDeletePackage = (id: string) => {
    if (!confirm('确定要删除这个指标包吗？')) return;
    metricAnalyzer.deleteMetricPackage(id);
    loadPackages();
    if (selectedPackage?.id === id) {
      setSelectedPackage(null);
    }
  };

  const handleEditMetric = (updatedMetric: MetricDefinition) => {
    if (!selectedPackage) return;
    
    const updatedMetrics = selectedPackage.metrics.map(m => 
      m.id === updatedMetric.id ? { ...updatedMetric, updatedAt: Date.now() } : m
    );
    
    metricAnalyzer.updateMetricPackage(selectedPackage.id, {
      metrics: updatedMetrics
    });
    
    loadPackages();
    setSelectedPackage(prev => prev ? { ...prev, metrics: updatedMetrics } : null);
  };

  const handleDeleteMetric = (metricId: string) => {
    if (!selectedPackage) return;
    if (!confirm('确定要删除这个指标吗？')) return;

    const updatedMetrics = selectedPackage.metrics.filter(m => m.id !== metricId);
    metricAnalyzer.updateMetricPackage(selectedPackage.id, {
      metrics: updatedMetrics
    });
    
    loadPackages();
    setSelectedPackage(prev => prev ? { ...prev, metrics: updatedMetrics } : null);
  };

  // 验证单个指标
  const handleValidateMetric = async (metric: MetricDefinition) => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) return;
    
    const sourceTable = selectedPackage.sourceTables[0];
    
    try {
      const result = await metricAnalyzer.validateMetric(metric, sourceTable);
      
      // 更新指标状态
      const updatedMetrics = selectedPackage.metrics.map(m => {
        if (m.id === metric.id) {
          return {
            ...m,
            isValid: result.isValid,
            lastValidated: Date.now(),
            validationError: result.error
          };
        }
        return m;
      });
      
      metricAnalyzer.updateMetricPackage(selectedPackage.id, {
        metrics: updatedMetrics
      });
      
      loadPackages();
      setSelectedPackage(prev => prev ? { ...prev, metrics: updatedMetrics } : null);
      
      if (!result.isValid) {
        alert(`验证失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      alert('验证失败: ' + (error as Error).message);
    }
  };

  // 修复单个指标
  const handleFixMetric = async (metric: MetricDefinition) => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) return;
    
    const sourceTable = selectedPackage.sourceTables[0];
    
    try {
      const fixedMetric = await metricAnalyzer.fixMetric(metric, sourceTable);
      
      // 更新指标
      const updatedMetrics = selectedPackage.metrics.map(m => {
        if (m.id === metric.id) {
          return {
            ...fixedMetric,
            isValid: undefined,
            lastValidated: Date.now()
          };
        }
        return m;
      });
      
      metricAnalyzer.updateMetricPackage(selectedPackage.id, {
        metrics: updatedMetrics
      });
      
      loadPackages();
      setSelectedPackage(prev => prev ? { ...prev, metrics: updatedMetrics } : null);
      
      // 尝试重新验证
      setTimeout(() => {
        const updated = updatedMetrics.find(m => m.id === metric.id);
        if (updated) {
          handleValidateMetric(updated);
        }
      }, 100);
      
    } catch (error) {
      console.error('Fix failed:', error);
      alert('修复失败: ' + (error as Error).message);
    }
  };

  // 生成图表
  const handleGenerateChart = async (metric: MetricDefinition) => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) {
      alert('请先选择数据源表');
      return;
    }

    const sourceTable = selectedPackage.sourceTables[0];
    
    setIsGeneratingChart(true);
    setChartProgress(`正在为 "${metric.name}" 生成图表...`);

    try {
      // 生成图表
      const chart = await metricAnalyzer.generateChart(
        metric,
        selectedPackage.id,
        sourceTable
      );

      // 更新状态
      setMetricCharts(prev => new Map(prev).set(metric.id, true));
      
      // 调用回调通知父组件（用于同步到 SQL 编辑器）
      if (onChartGenerated) {
        onChartGenerated(chart);
      } else {
        // 提示用户
        alert(`图表生成成功！\n\n指标: ${metric.name}\n图表类型: ${chart.chartConfig.type}\n\n点击指标卡片上的紫色图表图标可查看已生成的图表。`);
      }
      
    } catch (error) {
      console.error('Generate chart failed:', error);
      alert('生成图表失败: ' + (error as Error).message);
    } finally {
      setIsGeneratingChart(false);
      setChartProgress('');
    }
  };

  // 批量生成所有指标的图表
  const handleGenerateAllCharts = async () => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) {
      alert('请先选择数据源表');
      return;
    }

    const sourceTable = selectedPackage.sourceTables[0];
    const metricsWithoutChart = selectedPackage.metrics.filter(m => !metricCharts.get(m.id));
    
    if (metricsWithoutChart.length === 0) {
      alert('所有指标都已生成图表');
      return;
    }

    if (!confirm(`将为 ${metricsWithoutChart.length} 个指标生成图表，是否继续?`)) {
      return;
    }

    setIsGeneratingChart(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < metricsWithoutChart.length; i++) {
      const metric = metricsWithoutChart[i];
      setChartProgress(`正在生成图表 (${i + 1}/${metricsWithoutChart.length}): ${metric.name}`);

      try {
        await metricAnalyzer.generateChart(metric, selectedPackage.id, sourceTable);
        successCount++;
        setMetricCharts(prev => new Map(prev).set(metric.id, true));
      } catch (error) {
        console.error(`Failed to generate chart for ${metric.name}:`, error);
        failCount++;
      }
    }

    setIsGeneratingChart(false);
    setChartProgress('');
    
    if (onChartGenerated && successCount > 0) {
      // 提示用户可以查看图表
      alert(`图表生成完成!\n成功: ${successCount} 个\n失败: ${failCount} 个\n\n点击指标卡片上的紫色图表图标可查看已生成的图表。`);
    } else {
      alert(`图表生成完成!\n成功: ${successCount} 个\n失败: ${failCount} 个`);
    }
  };

  // 批量验证所有指标
  const handleValidateAll = async () => {
    if (!selectedPackage || selectedPackage.sourceTables.length === 0) return;
    
    const sourceTable = selectedPackage.sourceTables[0];
    
    setIsAnalyzing(true);
    setAnalysisProgress('正在验证指标...');
    
    try {
      const updatedMetrics = await Promise.all(
        selectedPackage.metrics.map(async (metric) => {
          const result = await metricAnalyzer.validateMetric(metric, sourceTable);
          return {
            ...metric,
            isValid: result.isValid,
            lastValidated: Date.now(),
            validationError: result.error
          };
        })
      );
      
      metricAnalyzer.updateMetricPackage(selectedPackage.id, {
        metrics: updatedMetrics
      });
      
      loadPackages();
      setSelectedPackage(prev => prev ? { ...prev, metrics: updatedMetrics } : null);
      
      // 统计结果
      const validCount = updatedMetrics.filter(m => m.isValid).length;
      const invalidCount = updatedMetrics.filter(m => !m.isValid).length;
      alert(`验证完成: ${validCount} 个通过, ${invalidCount} 个失败`);
      
    } catch (error) {
      console.error('Batch validation failed:', error);
      alert('批量验证失败: ' + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const togglePackageExpand = (id: string) => {
    setExpandedPackages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Table Selection */}
      <div className="w-80 bg-monokai-bg border-r border-monokai-accent flex flex-col">
        <div className="p-4 border-b border-monokai-accent bg-monokai-bg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-monokai-fg flex items-center gap-2">
              <Database size={18} className="text-monokai-blue" />
              选择数据表
            </h2>
            <button
              onClick={() => setShowHelpPanel(v => !v)}
              className={`p-1.5 rounded transition-colors ${
                showHelpPanel
                  ? 'bg-monokai-yellow/20 text-monokai-yellow'
                  : 'text-monokai-comment hover:text-monokai-yellow hover:bg-monokai-yellow/10'
              }`}
              title="背景说明与使用指南"
            >
              <HelpCircle size={16} />
            </button>
          </div>
          <p className="text-xs text-monokai-comment mt-1">
            勾选要分析的表，AI将自动生成指标定义
          </p>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-2 bg-monokai-bg">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-xs text-monokai-comment">
              已选择 {selectedTables.size} / {tables.length} 个表
            </span>
            <button
              onClick={selectAllTables}
              className="text-xs text-monokai-blue hover:underline"
            >
              {selectedTables.size === tables.length ? '取消全选' : '全选'}
            </button>
          </div>
          
          {tables.length === 0 ? (
            <div className="text-center py-8 text-monokai-comment text-sm">
              暂无数据表，请先导入数据
            </div>
          ) : (
            <div className="space-y-1">
              {tables.map(table => (
                <label
                  key={table}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedTables.has(table) 
                      ? 'bg-monokai-sidebar text-monokai-fg' 
                      : 'hover:bg-monokai-sidebar text-monokai-fg'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    selectedTables.has(table) 
                      ? 'bg-monokai-green border-monokai-green' 
                      : 'border-monokai-comment'
                  }`}>
                    {selectedTables.has(table) && <Check size={10} className="text-monokai-bg" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedTables.has(table)}
                    onChange={() => toggleTable(table)}
                  />
                  <span className="text-sm truncate">{table}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 背景说明面板 */}
        {showHelpPanel && (
          <div className="border-t border-monokai-accent bg-monokai-bg flex flex-col max-h-[55vh]">
            {/* 标签页导航 */}
            <div className="flex overflow-x-auto border-b border-monokai-accent/60 shrink-0">
              {HELP_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveHelpCategory(cat.key)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeHelpCategory === cat.key
                      ? 'border-monokai-yellow text-monokai-yellow'
                      : 'border-transparent text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 内容区 */}
            <div className="overflow-y-auto p-3 space-y-3 text-xs">
              {(() => {
                const c = METRIC_CATEGORY_HELP[activeHelpCategory];
                return (
                  <>
                    <div>
                      <div className="text-monokai-yellow font-bold text-sm mb-1">{c.title}</div>
                      <p className="text-monokai-fg leading-relaxed">{c.description}</p>
                    </div>

                    <HelpSection title="典型场景" color="monokai-blue" items={c.scenarios} />
                    <HelpSection title="常见错误" color="monokai-pink" items={c.commonErrors} />
                    <HelpSection title="AI 协作提示" color="monokai-green" items={c.aiHints} />
                    <HelpSection title="快速上手" color="monokai-purple" items={c.quickStart} numbered />

                    <div>
                      <div className="text-monokai-comment uppercase font-medium mb-1.5">公式示例</div>
                      {c.formulaExamples.map((ex, i) => (
                        <div key={i} className="mb-2 bg-monokai-bg rounded p-2 border border-monokai-accent/40">
                          <div className="text-monokai-fg font-medium">{ex.name}</div>
                          <code className="text-monokai-green text-[10px] block mt-0.5 break-all">{ex.formula}</code>
                          <div className="text-monokai-comment text-[10px] mt-0.5">{ex.note}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="text-monokai-comment uppercase font-medium mb-1.5">最佳实践</div>
                      {c.bestPractices.map((p, i) => (
                        <div key={i} className="flex gap-1.5 mb-1">
                          <span className="text-monokai-green mt-0.5">✓</span>
                          <span className="text-monokai-fg">{p}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* New Package Form */}
        <div className="p-4 border-t border-monokai-accent bg-monokai-bg">
          {showNewForm ? (
            <div className="space-y-3">
              {/* 自然语言输入框 */}
              <div className="relative">
                <textarea
                  rows={2}
                  placeholder="（可选）描述你的业务需求，AI 将实时生成指标草稿..."
                  value={aiNaturalLanguageInput}
                  onChange={(e) => handleNLInputChange(e.target.value)}
                  className="w-full bg-monokai-bg border border-monokai-accent p-2 pr-8 rounded text-xs text-monokai-fg placeholder-monokai-comment focus:border-monokai-purple outline-none resize-none"
                />
                {aiNaturalLanguageInput && (
                  <button
                    onClick={() => { setAiNaturalLanguageInput(''); setMetricPreview(null); }}
                    className="absolute top-2 right-2 text-monokai-comment hover:text-monokai-fg"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* 实时预览草稿 */}
              {(isGeneratingPreview || metricPreview) && (
                <div className="bg-monokai-sidebar border border-monokai-purple/40 rounded p-2">
                  <div className="text-xs text-monokai-purple font-medium mb-1 flex items-center gap-1">
                    {isGeneratingPreview ? (
                      <><Loader2 size={10} className="animate-spin" /> 正在生成指标草稿...</>
                    ) : (
                      <><Zap size={10} /> AI 指标预览（最多 3 个）</>
                    )}
                  </div>
                  {metricPreview && metricPreview.map((m, i) => (
                    <div key={i} className="text-xs text-monokai-fg border-t border-monokai-accent/40 pt-1 mt-1">
                      <span className="text-monokai-pink font-medium">{m.name}</span>
                      {m.category && <span className="ml-1 text-monokai-purple">· {m.category}</span>}
                      <div className="text-monokai-comment mt-0.5">{m.formula}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 包名输入框 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="指标包名称 *"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="flex-1 bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-monokai-fg placeholder-monokai-comment focus:border-monokai-blue outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="描述（可选）"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-sm text-monokai-fg placeholder-monokai-comment focus:border-monokai-blue outline-none"
              />

              {/* 操作按钮行 - 使用 Grid 布局确保对齐 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 主操作按钮 */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || selectedTables.size === 0}
                  className="px-3 py-2 !bg-monokai-surface border border-monokai-green text-monokai-green font-semibold rounded text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <><Loader2 size={14} className="animate-spin" />分析中...</>
                  ) : (
                    <><Zap size={14} />生成指标</>
                  )}
                </button>
                <button
                  onClick={handleMetricAIFill}
                  disabled={isAiFilling || selectedTables.size === 0}
                  className="px-3 py-2 !bg-monokai-surface border border-monokai-purple text-monokai-purple rounded text-xs font-medium hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 justify-center"
                  title="AI 自动填充包名和描述"
                >
                  {isAiFilling ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI 填充
                </button>
                
                {/* 次要操作按钮 */}
                <button
                  onClick={() => { setShowNewForm(false); setMetricPreview(null); }}
                  className="px-3 py-2 !bg-monokai-surface border border-monokai-accent text-monokai-comment rounded text-xs hover:opacity-80 flex items-center justify-center gap-1.5"
                >
                  <X size={12} />
                  取消
                </button>
                <button
                  onClick={handleMetricQuickClear}
                  className="px-3 py-2 !bg-monokai-surface border border-monokai-pink text-monokai-pink rounded text-xs hover:opacity-80 flex items-center justify-center gap-1.5"
                  title="快速清除所有输入"
                >
                  <Trash2 size={12} />
                  清除
                </button>
              </div>

              {/* 撤销 Toast */}
              {showClearToast && (
                <div className="flex items-center justify-between bg-monokai-sidebar border border-monokai-pink/30 rounded px-3 py-2 text-xs">
                  <span className="text-monokai-comment">已清除全部输入</span>
                  <button
                    onClick={handleUndoClear}
                    className="text-monokai-blue hover:underline ml-2 flex items-center gap-1"
                  >
                    <Undo2 size={11} />
                    撤销
                  </button>
                </div>
              )}
            </div>
          ) : null}
          
          {/* 底部按钮组 - 三行对齐 */}
          <div className="flex flex-col gap-2">
            {/* 新建指标包 - 单独一行 */}
            {!showNewForm && selectedTables.size > 0 && (
              <div className="w-full">
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full px-3 py-2 !bg-monokai-surface border border-monokai-green text-monokai-green rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  新建指标包
                </button>
              </div>
            )}
            
            {/* 模板和连接数据源按钮 - 水平排列 */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplates(true)}
                className="flex-1 px-3 py-2 !bg-monokai-surface border border-monokai-purple text-monokai-purple rounded text-xs hover:opacity-80 flex items-center justify-center gap-1.5"
              >
                <Package size={14} />
                使用模板
              </button>
              <button
                onClick={() => setShowDataSourceModal(true)}
                className="flex-1 px-3 py-2 !bg-monokai-surface border border-monokai-blue text-monokai-blue rounded text-xs hover:opacity-80 flex items-center justify-center gap-1.5"
              >
                <Database size={14} />
                连接数据源
              </button>
            </div>
          </div>
          
          {isAnalyzing && (
            <div className="mt-3 text-xs text-monokai-comment flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              {analysisProgress}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Package List & Details */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPackage ? (
          // Package Detail View
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="p-4 border-b border-monokai-accent bg-monokai-bg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-fg"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-monokai-fg">{selectedPackage.name}</h2>
                  <p className="text-xs text-monokai-comment">
                    {selectedPackage.description || '无描述'} | {selectedPackage.metrics.length} 个指标
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleValidateAll()}
                  disabled={isAnalyzing || !selectedPackage.sourceTables.length}
                  className="px-3 py-1.5 !bg-monokai-surface border border-monokai-green text-monokai-green rounded text-sm hover:opacity-80 flex items-center gap-2 disabled:opacity-50"
                  title="批量验证所有指标"
                >
                  <Play size={14} />
                  验证全部
                </button>
                <button
                  onClick={() => handleGenerateAllCharts()}
                  disabled={isGeneratingChart || !selectedPackage.sourceTables.length}
                  className="px-3 py-1.5 !bg-monokai-surface border border-monokai-purple text-monokai-green rounded text-sm hover:opacity-80 flex items-center gap-2 disabled:opacity-50"
                  title="批量生成所有指标的图表"
                >
                  <BarChart2 size={14} />
                  {isGeneratingChart ? '生成中...' : '生成全部图表'}
                </button>
                <button
                  onClick={() => setShowChartList(true)}
                  className="px-3 py-1.5 !bg-monokai-surface border border-monokai-purple text-monokai-green rounded text-sm hover:opacity-80 flex items-center gap-2"
                  title="查看已生成的图表"
                >
                  <BarChart2 size={14} />
                  查看图表
                </button>
                <button
                  onClick={() => handleRefresh(selectedPackage)}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 !bg-monokai-surface border border-monokai-blue text-monokai-green rounded text-sm hover:opacity-80 flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  重新分析
                </button>
                <button
                  onClick={() => handleDeletePackage(selectedPackage.id)}
                  className="px-3 py-1.5 !bg-monokai-surface border border-monokai-pink text-monokai-pink rounded text-sm hover:opacity-80 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>

            {/* Source Tables */}
            <div className="px-4 py-2 bg-monokai-sidebar/50 border-b border-monokai-accent">
              <div className="text-xs text-monokai-comment">
                依赖表: {selectedPackage.sourceTables.join(', ')}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* 搜索和筛选工具栏 */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
                  <input
                    type="text"
                    placeholder="搜索指标名称、定义、分类..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-monokai-bg border border-monokai-border rounded text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
                  />
                </div>
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    showFavoritesOnly 
                      ? 'bg-monokai-accent text-monokai-fg' 
                      : 'bg-monokai-bg border border-monokai-border text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  {showFavoritesOnly ? '已收藏' : '收藏'}
                  {favorites.size > 0 && <span className="ml-1 bg-monokai-purple text-monokai-fg text-xs px-1.5 py-0.5 rounded">{favorites.size}</span>}
                </button>
              </div>
              
              {filterMetrics(selectedPackage.metrics).length === 0 ? (
                <div className="text-center py-12 text-monokai-comment">
                  {showFavoritesOnly ? '暂无收藏的指标' : searchTerm ? '没有找到匹配的指标' : '暂无指标定义'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filterMetrics(selectedPackage.metrics).map(metric => (
                    <MetricCard
                      key={metric.id}
                      metric={metric}
                      sourceTable={selectedPackage.sourceTables[0]}
                      onEdit={handleEditMetric}
                      onDelete={handleDeleteMetric}
                      onValidate={handleValidateMetric}
                      onFix={handleFixMetric}
                      onGenerateChart={handleGenerateChart}
                      hasChart={metricCharts.get(metric.id) || false}
                      onToggleFavorite={toggleFavorite}
                      isFavorite={isFavorite(metric.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-monokai-accent text-xs text-monokai-comment flex justify-between">
              <span>创建于: {formatDate(selectedPackage.createdAt)}</span>
              {selectedPackage.updatedAt && (
                <span>更新于: {formatDate(selectedPackage.updatedAt)}</span>
              )}
            </div>
          </div>
        ) : (
          // Package List View
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-monokai-accent">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-monokai-fg flex items-center gap-2">
                    <Package size={18} className="text-monokai-purple" />
                    指标包列表
                  </h2>
                  <p className="text-xs text-monokai-comment mt-1">
                    共 {packages.length} 个指标包
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 px-2 py-1.5 bg-monokai-bg border border-monokai-border rounded text-xs text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors">
                    <Upload size={14} />
                    导入
                    <input type="file" accept=".json" onChange={importPackage} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {packages.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-monokai-accent mb-4" />
                  <p className="text-monokai-comment">暂无指标包</p>
                  <p className="text-xs text-monokai-comment mt-1">
                    左侧选择数据表后，点击"新建指标包"开始
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {packages.map(pkg => (
                    <div
                      key={pkg.id}
                      className="bg-[#272822] border border-monokai-accent rounded-lg p-4 hover:border-monokai-blue transition-colors"
                    >
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => togglePackageExpand(pkg.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedPackages.has(pkg.id) ? (
                            <ChevronDown size={18} className="text-monokai-comment" />
                          ) : (
                            <ChevronRight size={18} className="text-monokai-comment" />
                          )}
                          <div>
                            <h3 className="font-bold text-monokai-fg">{pkg.name}</h3>
                            <p className="text-xs text-monokai-comment">
                              {pkg.description || '无描述'} | {pkg.metrics.length} 个指标
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-monokai-comment">
                            {formatDate(pkg.updatedAt || pkg.createdAt)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportPackage(pkg);
                            }}
                            className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-monokai-fg transition-colors"
                            title="导出指标包"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPackage(pkg);
                            }}
                            className="px-3 py-1 bg-monokai-blue text-monokai-bg rounded text-xs font-bold hover:opacity-90"
                          >
                            查看
                          </button>
                        </div>
                      </div>
                      
                      {expandedPackages.has(pkg.id) && (
                        <div className="mt-3 pt-3 border-t border-monokai-accent/50">
                          <div className="text-xs text-monokai-comment mb-2">
                            依赖表: {pkg.sourceTables.join(', ')}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {pkg.metrics.map(m => (
                              <span
                                key={m.id}
                                className="px-2 py-1 bg-monokai-accent/30 rounded text-xs text-monokai-fg"
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 图表列表模态框 */}
      {showChartList && selectedPackage && (
        <MetricChartListModal
          packageId={selectedPackage.id}
          onClose={() => setShowChartList(false)}
          onRefresh={() => loadMetricChartsForPackage(selectedPackage.id)}
          onOpenInSqlEditor={(chart) => {
            if (onChartGenerated) {
              onChartGenerated(chart);
            }
          }}
        />
      )}

      {/* 指标模板模态框 */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowTemplates(false)}>
          <div className="bg-monokai-bg border border-monokai-accent rounded-lg w-[600px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-monokai-accent flex items-center justify-between">
              <h3 className="text-lg font-bold text-monokai-fg flex items-center gap-2">
                <Package size={18} className="text-monokai-purple" />
                选择指标模板
              </h3>
              <button onClick={() => setShowTemplates(false)} className="text-monokai-comment hover:text-monokai-fg">
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 gap-3">
                {metricTemplates.map((template, idx) => (
                  <div
                    key={idx}
                    className="bg-[#272822] border border-monokai-border rounded-lg p-3 hover:border-monokai-purple cursor-pointer transition-colors"
                    onClick={() => addFromTemplate(template)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-monokai-fg">{template.name}</h4>
                        <p className="text-xs text-monokai-comment mt-1">{template.definition}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-monokai-purple/20 text-monokai-purple rounded">
                        {template.category}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-monokai-comment">
                      <span className="text-monokai-green">公式: </span>{template.formula}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-monokai-accent">
              <p className="text-xs text-monokai-comment text-center">
                点击模板添加到当前指标包
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 数据源连接模态框 */}
      {showDataSourceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDataSourceModal(false)}>
          <div className="bg-monokai-bg border border-monokai-accent rounded-lg w-[500px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-monokai-fg mb-4 flex items-center gap-2">
              <Database className="text-monokai-blue" /> 连接外部数据源
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-monokai-comment mb-1">数据源类型</label>
                <select
                  value={dataSourceType}
                  onChange={(e) => setDataSourceType(e.target.value as any)}
                  className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-monokai-fg placeholder-monokai-comment"
                >
                  <option value="csv">CSV 文件</option>
                  <option value="parquet">Parquet 文件</option>
                  <option value="json">JSON 文件</option>
                  <option value="sqlite">SQLite 数据库</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-monokai-comment mb-1">数据源名称 (别名)</label>
                <input
                  type="text"
                  value={dataSourceName}
                  onChange={(e) => setDataSourceName(e.target.value)}
                  placeholder="例如: sales_data"
                  className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-monokai-fg placeholder-monokai-comment"
                />
              </div>

              <div>
                <label className="block text-sm text-monokai-comment mb-1">
                  文件路径 {dataSourceType === 'sqlite' ? '(数据库文件)' : '(文件路径或URL)'}
                </label>
                <input
                  type="text"
                  value={dataSourcePath}
                  onChange={(e) => setDataSourcePath(e.target.value)}
                  placeholder={dataSourceType === 'sqlite' ? '/path/to/database.db' : '/path/to/file.csv 或 https://...'}
                  className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-monokai-fg placeholder-monokai-comment"
                />
              </div>

              <div className="bg-monokai-sidebar p-3 rounded text-xs text-monokai-comment">
                <p className="font-bold mb-1">连接示例:</p>
                {dataSourceType === 'csv' && <code>-- CSV: SELECT * FROM read_csv_auto('data.csv')</code>}
                {dataSourceType === 'parquet' && <code>-- Parquet: SELECT * FROM read_parquet('data.parquet')</code>}
                {dataSourceType === 'json' && <code>-- JSON: SELECT * FROM read_json_auto('data.json')</code>}
                {dataSourceType === 'sqlite' && <code>-- SQLite: ATTACH 'db.sqlite' AS sqlite; SELECT * FROM sqlite.table</code>}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDataSourceModal(false)}
                className="px-4 py-2 !bg-monokai-surface border border-monokai-accent text-monokai-comment rounded hover:opacity-80"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!dataSourceName || !dataSourcePath) {
                    alert('请填写数据源名称和路径');
                    return;
                  }
                  // 生成连接SQL
                  let connectSql = '';
                  switch (dataSourceType) {
                    case 'csv':
                      connectSql = `-- 连接 CSV 数据源: ${dataSourceName}\nCREATE OR REPLACE VIEW ${dataSourceName} AS SELECT * FROM read_csv_auto('${dataSourcePath}');`;
                      break;
                    case 'parquet':
                      connectSql = `-- 连接 Parquet 数据源: ${dataSourceName}\nCREATE OR REPLACE VIEW ${dataSourceName} AS SELECT * FROM read_parquet('${dataSourcePath}');`;
                      break;
                    case 'json':
                      connectSql = `-- 连接 JSON 数据源: ${dataSourceName}\nCREATE OR REPLACE VIEW ${dataSourceName} AS SELECT * FROM read_json_auto('${dataSourcePath}');`;
                      break;
                    case 'sqlite':
                      connectSql = `-- 连接 SQLite: ${dataSourceName}\nATTACH '${dataSourcePath}' AS ${dataSourceName};`;
                      break;
                  }
                  // 复制到剪贴板
                  navigator.clipboard.writeText(connectSql);
                  alert(`连接SQL已生成并复制到剪贴板！\n\n请在SQL编辑器中执行。`);
                  setShowDataSourceModal(false);
                }}
                className="px-4 py-2 bg-monokai-blue text-monokai-fg font-bold rounded hover:opacity-90"
              >
                生成连接SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
