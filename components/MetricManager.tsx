import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MetricChart, MetricPackage, MetricDefinition } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { aiService } from '../services/aiService';
import { toastService } from '../services/toastService';
import { MetricCard } from './MetricCard';
import { MetricChartListModal } from './MetricChartListModal';
import { MetricTemplateModal } from './MetricTemplateModal';
import { MetricDataSourceModal } from './MetricDataSourceModal';
import { MetricEditModal } from './MetricEditModal';
import {
  Database, Plus, RefreshCw, Trash2, Check, Loader2, Package, ArrowLeft, Play,
  BarChart2, Star, Search, Download, Upload, LayoutDashboard,
  Sparkles, HelpCircle, X, Zap, Undo2,
  Filter, Layers, BookOpen, ExternalLink, CheckCircle2,
  Table2, ArrowRight
} from 'lucide-react';
import {
  PanelHeader, PageHeader, ActionButton, IconButton,
  SearchInput, EmptyState, SegmentedTabs
} from './ui/Workbench';

// ── MECE 背景说明数据 ──────────────────────────────────────────────────────────
type MetricCategoryHelp = {
  title: string;
  description: string;
  scenarios: string[];
  commonErrors: string[];
  aiHints: string[];
  quickStart: string[];
  formulaExamples: { name: string; formula: string; note: string }[];
};

const METRIC_CATEGORY_HELP: Record<string, MetricCategoryHelp> = {
  metricModeling: {
    title: '指标定义 / 建模',
    description: '适用于将业务问题转化为可量化的声明式指标体系，每个指标包含标识、场景、公式与数据依赖。',
    scenarios: [
      '有明确业务目标，需要搭建统一的营收/流量/转化指标体系',
      '数据表结构已知，希望 AI 自动推断关键原子指标与复合指标',
      '对已有指标进行标准化命名与语义对齐',
    ],
    commonErrors: [
      '公式中使用列名占位符（如 amount_col），未替换为实际字段名',
      '比率类指标未处理分母为零（应使用 NULLIF 防除零）',
      '趋势类指标未指定时间粒度，导致聚合结果失去时序意义',
    ],
    aiHints: [
      '提供「业务目标 + 表名 + 关键字段」，AI 可一次生成高质量指标草稿',
      '复合指标（如留存率）建议先拆解为原子指标，再组合计算',
    ],
    quickStart: [
      '1. 在左侧勾选目标数据表',
      '2. 输入业务需求或点击「AI 填充」自动命名',
      '3. 点击「生成指标」完成建模并自动保存指标包',
    ],
    formulaExamples: [
      { name: 'DAU（日活用户数）', formula: 'COUNT(DISTINCT user_id)', note: '配合 WHERE date_trunc 过滤日期' },
      { name: '订单金额总计', formula: 'SUM(order_amount)', note: '注意过滤已取消订单' },
      { name: '用户转化率', formula: 'COUNT(DISTINCT paid_user) * 1.0 / NULLIF(COUNT(DISTINCT visit_user), 0)', note: '用 NULLIF 防分母为零' },
    ],
  },
  metricValidation: {
    title: '指标验证 / 修复',
    description: '适用于对指标 SQL 公式进行实际执行验证，定位语法或字段错误，并使用 AI 自动修复。',
    scenarios: [
      '批量导入后的指标公式正确性核查',
      '数据表结构变更后，检查依赖该表的指标是否仍然可用',
      '新建指标后，确认公式在实际 DuckDB 数据上可正确执行',
    ],
    commonErrors: [
      '验证时未选择数据源表，导致 SQL 执行缺失 FROM 目标',
      '指标公式包含方言函数，需适配 DuckDB 标准语法',
    ],
    aiHints: [
      '验证失败时点击「🔧 修复」，AI 会结合真实表字段自动改写公式',
      '批量验证前建议先单个验证典型指标',
    ],
    quickStart: [
      '1. 进入指标包详情页',
      '2. 点击单个指标卡片的「验证（▶）」按钮',
      '3. 若报错可点击「修复（🔧）」让 AI 自动重构',
      '4. 点击顶部「验证全部」进行批量确认',
    ],
    formulaExamples: [
      { name: '防除零写法', formula: 'SUM(revenue) / NULLIF(COUNT(*), 0)', note: '避免分母为 0 导致运行时错误' },
      { name: '安全类型转换', formula: 'TRY_CAST(amount_str AS DOUBLE)', note: '字段类型不匹配时安全转换' },
    ],
  },
  chartGeneration: {
    title: '图表生成 / 可视化',
    description: '从指标公式自动推断图表类型（折线/柱状/饼图）并生成可视化图表配置，一键发布至 Dashboard。',
    scenarios: [
      '趋势类指标自动生成时序折线图',
      '构成类指标自动生成占比饼图或环形图',
      '对比类指标自动生成分组柱状图',
    ],
    commonErrors: [
      '数据源表无数据，生成图表时返回空结果',
      '纯标量无时间维度指标无法推断 X 轴',
    ],
    aiHints: [
      '生成图表前确保指标已通过「验证」（绿色标签）',
      '时序指标在公式中注明 date_trunc 聚合维度',
    ],
    quickStart: [
      '1. 进入指标包详情页',
      '2. 点击指标卡片上的「📊 图表」图标',
      '3. 点击顶部「查看图表」在弹窗中对比或发送至看板',
    ],
    formulaExamples: [
      { name: '折线图（趋势）', formula: "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt FROM t GROUP BY 1", note: '包含时间维度' },
      { name: '柱状图（分组）', formula: 'SELECT category, SUM(amount) AS total FROM t GROUP BY category', note: '分类维度' },
    ],
  },
};

const HELP_CATEGORIES = [
  { key: 'metricModeling', label: '指标建模' },
  { key: 'metricValidation', label: '指标验证' },
  { key: 'chartGeneration', label: '图表生成' },
] as const;

type SidebarTabType = 'builder' | 'tables' | 'guide';

interface MetricManagerProps {
  tables: string[];
  currentTable?: string | null;
  onExecuteSql?: (sql: string) => void;
  onChartGenerated?: (chart: MetricChart) => void;
  onNavigateToDashboard?: () => void;
}

export const MetricManager: React.FC<MetricManagerProps> = ({
  tables,
  currentTable,
  onExecuteSql,
  onChartGenerated,
  onNavigateToDashboard,
}) => {
  // ── Core State ─────────────────────────────────────────────────────────────
  const [packages, setPackages] = useState<MetricPackage[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<MetricPackage | null>(null);
  const [packageSearchTerm, setPackageSearchTerm] = useState('');
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // ── Form State ─────────────────────────────────────────────────────────────
  const [packageName, setPackageName] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [aiNaturalLanguageInput, setAiNaturalLanguageInput] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [metricPreview, setMetricPreview] = useState<MetricDefinition[] | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const nlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Left Sidebar Tab State ─────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('builder');
  const [activeHelpCategory, setActiveHelpCategory] = useState<keyof typeof METRIC_CATEGORY_HELP>('metricModeling');

  // ── Detail View Filtering & Modals ─────────────────────────────────────────
  const [detailSearchTerm, setDetailSearchTerm] = useState('');
  const [selectedCategoryPill, setSelectedCategoryPill] = useState<string>('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('duckdb_metric_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [showChartListModal, setShowChartListModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricDefinition | null>(null);
  const [metricCharts, setMetricCharts] = useState<Map<string, boolean>>(new Map());
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);

  // ── Quick Clear Undo Toast ─────────────────────────────────────────────────
  const [lastClearedForm, setLastClearedForm] = useState<{
    packageName: string;
    packageDescription: string;
    aiInput: string;
    selectedTables: Set<string>;
  } | null>(null);
  const [showClearToast, setShowClearToast] = useState(false);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPackages();
  }, []);

  // Auto-select currentTable from navigation context if provided
  useEffect(() => {
    if (currentTable && tables.includes(currentTable)) {
      setSelectedTables(prev => {
        if (!prev.has(currentTable)) {
          const next = new Set(prev);
          next.add(currentTable);
          return next;
        }
        return prev;
      });
      if (!packageName) {
        setPackageName(`${currentTable}_业务指标包`);
      }
    }
  }, [currentTable, tables]);

  useEffect(() => {
    if (selectedPackage) {
      loadMetricChartsForPackage(selectedPackage.id);
    }
  }, [selectedPackage]);

  const loadPackages = () => {
    const loaded = metricAnalyzer.loadMetricPackages();
    setPackages(loaded);
  };

  const loadMetricChartsForPackage = (packageId: string) => {
    const charts = metricAnalyzer.getChartsByPackage(packageId);
    const chartMap = new Map<string, boolean>();
    charts.forEach(chart => {
      chartMap.set(chart.metricId, true);
    });
    setMetricCharts(chartMap);
  };

  const isFavorite = (metricId: string) => favorites.has(metricId);

  const toggleFavorite = (metricId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      localStorage.setItem('duckdb_metric_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // ── Natural Language Realtime Preview ──────────────────────────────────────
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
          1,
        );
        const arr = Array.isArray(result) ? result : [result];
        setMetricPreview(
          arr.slice(0, 3).map((m: any, i: number) => ({
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
          })),
        );
      } catch {
        // Silent fail for preview
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 600);
  };

  // ── AI Auto Fill ───────────────────────────────────────────────────────────
  const handleMetricAIFill = async () => {
    if (selectedTables.size === 0) {
      toastService.warning('请先选择数据表', '在左侧「数据表」标签中至少勾选一张表');
      setSidebarTab('tables');
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
        2,
      );
      if (result?.name) setPackageName(result.name);
      if (result?.description) setPackageDescription(result.description);
      toastService.success('AI 智能填充完成', result?.name || '已生成指标包名称与描述');
    } catch (err) {
      console.error('AI fill failed:', err);
      toastService.error('AI 填充失败', '请检查网络或 AI 模型配置');
    } finally {
      setIsAiFilling(false);
    }
  };

  // ── Quick Clear ────────────────────────────────────────────────────────────
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

  // ── AI Generate / Analyze ──────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (selectedTables.size === 0) {
      toastService.warning('请先勾选数据表', '请在左侧选择至少一张表进行语义分析');
      setSidebarTab('tables');
      return;
    }

    const name = packageName.trim() || `指标包_${new Date().toLocaleDateString()}`;
    setIsAnalyzing(true);
    setAnalysisProgress('正在提取数据表语义结构...');

    try {
      const metrics = await metricAnalyzer.analyzeMetrics(
        Array.from(selectedTables),
        (step) => setAnalysisProgress(step),
      );

      const newPackage = metricAnalyzer.createMetricPackage(
        name,
        packageDescription.trim(),
        Array.from(selectedTables),
        metrics,
      );

      // Save and reload
      const existing = metricAnalyzer.loadMetricPackages();
      existing.push(newPackage);
      metricAnalyzer.saveAllPackages(existing);
      loadPackages();
      setSelectedPackage(newPackage);

      // Reset form
      setPackageName('');
      setPackageDescription('');
      setAiNaturalLanguageInput('');
      setSelectedTables(new Set());
      setMetricPreview(null);
      toastService.success('指标包构建成功', `已提取 ${newPackage.metrics.length} 个核心指标`);
    } catch (err) {
      console.error('Analysis failed:', err);
      toastService.error('分析生成失败', (err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // ── Batch Actions ──────────────────────────────────────────────────────────
  const handleValidateAll = async () => {
    if (!selectedPackage || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisProgress('正在逐一验证指标公式...');
    try {
      const updatedMetrics: MetricDefinition[] = [];
      let successCount = 0;
      for (let i = 0; i < selectedPackage.metrics.length; i++) {
        const metric = selectedPackage.metrics[i];
        setAnalysisProgress(`正在验证 (${i + 1}/${selectedPackage.metrics.length}): ${metric.name}...`);
        const result = await metricAnalyzer.validateMetric(metric, selectedPackage.sourceTables[0]);
        const validatedMetric: MetricDefinition = {
          ...metric,
          isValid: result.isValid,
          validationError: result.error,
        };
        if (result.isValid) successCount++;
        updatedMetrics.push(validatedMetric);
      }

      const updatedPackage = {
        ...selectedPackage,
        metrics: updatedMetrics,
        updatedAt: Date.now(),
      };
      metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
      loadPackages();
      setSelectedPackage(updatedPackage);
      toastService.success('批量验证完成', `验证通过率: ${successCount} / ${selectedPackage.metrics.length}`);
    } catch (err) {
      toastService.error('批量验证失败', (err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleGenerateAllCharts = async () => {
    if (!selectedPackage || isGeneratingChart) return;
    setIsGeneratingChart(true);
    try {
      let count = 0;
      for (const metric of selectedPackage.metrics) {
        try {
          await metricAnalyzer.generateChart(metric, selectedPackage.id, selectedPackage.sourceTables[0]);
          count++;
        } catch {
          // continue
        }
      }
      loadMetricChartsForPackage(selectedPackage.id);
      toastService.success('图表批量生成完成', `已成功生成 ${count} 个指标图表`);
    } catch (err) {
      toastService.error('生成图表失败', (err as Error).message);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  // ── Single Metric Actions ──────────────────────────────────────────────────
  const handleValidateMetric = async (metric: MetricDefinition) => {
    if (!selectedPackage) return;
    try {
      const result = await metricAnalyzer.validateMetric(metric, selectedPackage.sourceTables[0]);
      const updatedMetrics = selectedPackage.metrics.map(m =>
        m.id === metric.id
          ? { ...m, isValid: result.isValid, validationError: result.error }
          : m,
      );
      const updatedPackage = { ...selectedPackage, metrics: updatedMetrics, updatedAt: Date.now() };
      metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
      loadPackages();
      setSelectedPackage(updatedPackage);
      if (result.isValid) {
        toastService.success(`指标「${metric.name}」验证通过`);
      } else {
        toastService.error(`指标「${metric.name}」验证失败`, result.error);
      }
    } catch (err) {
      toastService.error('验证执行异常', (err as Error).message);
    }
  };

  const handleFixMetric = async (metric: MetricDefinition) => {
    if (!selectedPackage) return;
    try {
      const fixedMetric = await metricAnalyzer.fixMetric(metric, selectedPackage.sourceTables[0]);
      if (fixedMetric) {
        // Re-validate fixed metric
        const validation = await metricAnalyzer.validateMetric(fixedMetric, selectedPackage.sourceTables[0]);
        const finalMetric = {
          ...fixedMetric,
          isValid: validation.isValid,
          validationError: validation.error,
          version: (metric.version || 1) + 1,
        };

        const updatedMetrics = selectedPackage.metrics.map(m => (m.id === metric.id ? finalMetric : m));
        const updatedPackage = { ...selectedPackage, metrics: updatedMetrics, updatedAt: Date.now() };
        metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
        loadPackages();
        setSelectedPackage(updatedPackage);
        toastService.success(`AI 已修复指标「${metric.name}」`, `已升级为版本 v${finalMetric.version}`);
      }
    } catch (err) {
      toastService.error('AI 修复失败', (err as Error).message);
    }
  };

  const handleGenerateChart = async (metric: MetricDefinition) => {
    if (!selectedPackage) return;
    try {
      const chart = await metricAnalyzer.generateChart(metric, selectedPackage.id, selectedPackage.sourceTables[0]);
      loadMetricChartsForPackage(selectedPackage.id);
      if (onChartGenerated) {
        onChartGenerated(chart);
      }
      toastService.success(`已为「${metric.name}」生成图表`, `类型: ${chart.chartConfig.type}`);
    } catch (err) {
      toastService.error('生成图表失败', (err as Error).message);
    }
  };

  const handleExecuteMetricInEditor = (metric: MetricDefinition) => {
    const sql = metric.sqlValidation || metric.formula;
    if (!sql) {
      toastService.error('指标未包含有效的 SQL 表达式');
      return;
    }
    if (onExecuteSql) {
      onExecuteSql(sql);
      toastService.success(`已载入指标 “${metric.name}” 至 SQL 编辑器`);
    } else {
      window.dispatchEvent(
        new CustomEvent('duckdb_execute_sql', {
          detail: { sql, autoRun: true, title: `Metric: ${metric.name}` },
        })
      );
      toastService.success(`已发送指标 “${metric.name}” 到编辑器执行`);
    }
  };

  const handleSaveEditMetric = (updatedMetric: MetricDefinition) => {
    if (!selectedPackage) return;
    const updatedMetrics = selectedPackage.metrics.map(m =>
      m.id === updatedMetric.id ? { ...updatedMetric, updatedAt: Date.now() } : m,
    );
    const updatedPackage = { ...selectedPackage, metrics: updatedMetrics, updatedAt: Date.now() };
    metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
    loadPackages();
    setSelectedPackage(updatedPackage);
    toastService.success('指标更新成功', updatedMetric.name);
  };

  const handleDeleteMetric = (metricId: string) => {
    if (!selectedPackage) return;
    const updatedMetrics = selectedPackage.metrics.filter(m => m.id !== metricId);
    const updatedPackage = { ...selectedPackage, metrics: updatedMetrics, updatedAt: Date.now() };
    metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
    loadPackages();
    setSelectedPackage(updatedPackage);
    toastService.success('指标已移除');
  };

  const handleAddTemplate = (template: Omit<MetricDefinition, 'id' | 'createdAt'>) => {
    if (!selectedPackage) {
      toastService.warning('请先选择或新建指标包');
      return;
    }
    const newMetric: MetricDefinition = {
      ...template,
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    const updatedPackage = {
      ...selectedPackage,
      metrics: [...selectedPackage.metrics, newMetric],
      updatedAt: Date.now(),
    };
    metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedPackage.metrics });
    loadPackages();
    setSelectedPackage(updatedPackage);
    setShowTemplatesModal(false);
    toastService.success(`已置入模板指标「${template.name}」`);
  };

  const handleDeletePackage = (packageId: string) => {
    metricAnalyzer.deleteMetricPackage(packageId);
    loadPackages();
    setSelectedPackage(null);
    toastService.success('指标包已删除');
  };

  const handleExportPackage = (pkg: MetricPackage) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pkg, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${pkg.name}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toastService.success(`已导出「${pkg.name}」JSON 备份`);
  };

  const handleImportPackage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported.name && Array.isArray(imported.metrics)) {
          const newPkg: MetricPackage = {
            ...imported,
            id: `pkg_${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metrics: imported.metrics.map((m: any) => ({
              ...m,
              id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            })),
          };
          const existing = metricAnalyzer.loadMetricPackages();
          existing.push(newPkg);
          metricAnalyzer.saveAllPackages(existing);
          loadPackages();
          setSelectedPackage(newPkg);
          toastService.success(`成功导入指标包「${newPkg.name}」`, `共 ${newPkg.metrics.length} 个指标`);
        } else {
          toastService.error('导入失败', 'JSON 格式不符合指标包规范');
        }
      } catch (err) {
        toastService.error('导入失败', (err as Error).message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // ── Filtered Data Computations ─────────────────────────────────────────────
  const packageCategories = useMemo(() => {
    if (!selectedPackage) return ['全部'];
    const set = new Set<string>(['全部']);
    selectedPackage.metrics.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [selectedPackage]);

  const filteredMetrics = useMemo(() => {
    if (!selectedPackage) return [];
    return selectedPackage.metrics.filter(m => {
      if (showFavoritesOnly && !favorites.has(m.id)) return false;
      if (selectedCategoryPill !== '全部' && m.category !== selectedCategoryPill) return false;
      if (!detailSearchTerm.trim()) return true;
      const q = detailSearchTerm.toLowerCase().trim();
      return (
        m.name.toLowerCase().includes(q) ||
        m.scenario?.toLowerCase().includes(q) ||
        m.definition?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q)
      );
    });
  }, [selectedPackage, showFavoritesOnly, favorites, selectedCategoryPill, detailSearchTerm]);

  const filteredPackages = useMemo(() => {
    if (!packageSearchTerm.trim()) return packages;
    const q = packageSearchTerm.toLowerCase().trim();
    return packages.filter(
      p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
    );
  }, [packages, packageSearchTerm]);

  const filteredTablesList = useMemo(() => {
    if (!tableSearchTerm.trim()) return tables;
    const q = tableSearchTerm.toLowerCase().trim();
    return tables.filter(t => t.toLowerCase().includes(q));
  }, [tables, tableSearchTerm]);

  return (
    <div className="metric-manager flex-1 flex min-h-0 bg-monokai-bg font-sans overflow-hidden">
      {/* ── Left Sidebar (320px) ─────────────────────────────────────────── */}
      <div className="metric-builder-sidebar w-80 flex-shrink-0 bg-monokai-sidebar border-r border-monokai-border flex flex-col min-h-0">
        <PanelHeader
          title="指标建模工作台"
          icon={Layers}
          tone="accent"
          actions={
            <span className="text-[10px] font-mono font-medium text-monokai-comment px-1.5 py-0.5 rounded bg-monokai-surface border border-monokai-border">
              DuckDB
            </span>
          }
        />

        {/* Sidebar Segmented Navigation */}
        <div className="p-3 border-b border-monokai-border bg-monokai-sidebar">
          <SegmentedTabs<SidebarTabType>
            value={sidebarTab}
            onChange={(val: SidebarTabType) => setSidebarTab(val)}
            aria-label="指标工作台模式切换"
            size="sm"
            tone="accent"
            items={[
              { value: 'builder', label: 'AI 建模', icon: Sparkles },
              { value: 'tables', label: `数据表 (${selectedTables.size})`, icon: Table2 },
              { value: 'guide', label: '知识指南', icon: BookOpen },
            ]}
          />
        </div>

        {/* Sidebar Tab 1: AI Builder */}
        {sidebarTab === 'builder' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar bg-monokai-bg/40">
            {/* Table Selection State Hint */}
            <div className="bg-monokai-surface border border-monokai-border rounded-lg p-2.5 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-monokai-comment font-medium">已关联数据源表:</span>
                <button
                  type="button"
                  onClick={() => setSidebarTab('tables')}
                  className="text-monokai-accent hover:underline text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  切换选择 ({selectedTables.size} 张) <ArrowRight size={11} />
                </button>
              </div>
              {selectedTables.size === 0 ? (
                <p className="text-[11px] text-monokai-yellow mt-1">
                  ⚠️ 尚未勾选数据表，请先切换至「数据表」标签勾选
                </p>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {Array.from(selectedTables).map(t => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-monokai-bg text-[10px] font-mono text-monokai-fg-muted border border-monokai-border/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Natural Language Prompt Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-monokai-comment" />
                业务需求描述 (AI 实时推断)
              </label>
              <div className="relative">
                <textarea
                  rows={2}
                  placeholder="例如：统计各渠道客单价与次日留存率，监控核心营收..."
                  value={aiNaturalLanguageInput}
                  onChange={e => handleNLInputChange(e.target.value)}
                  className="w-full bg-monokai-surface p-2.5 pr-7 rounded-lg text-xs text-monokai-fg placeholder-monokai-comment/60 border border-monokai-border focus:border-monokai-border-strong focus:outline-none resize-none transition-colors leading-relaxed"
                />
                {aiNaturalLanguageInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiNaturalLanguageInput('');
                      setMetricPreview(null);
                    }}
                    className="absolute top-2 right-2 text-monokai-comment hover:text-monokai-fg p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Realtime Draft Preview */}
            {(isGeneratingPreview || metricPreview) && (
              <div className="bg-monokai-surface border border-monokai-border rounded-lg p-2.5 animate-in fade-in duration-150">
                <div className="text-[11px] text-monokai-fg font-semibold mb-1.5 flex items-center gap-1.5 font-mono">
                  {isGeneratingPreview ? (
                    <>
                      <Loader2 size={11} className="animate-spin text-monokai-comment" />
                      <span>正在分析表结构并生成草稿...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={11} className="text-monokai-yellow" />
                      <span>AI 指标草稿推断 ({metricPreview?.length} 个)</span>
                    </>
                  )}
                </div>
                {metricPreview?.map((m, i) => (
                  <div key={i} className="border-t border-monokai-border/60 pt-1.5 mt-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-monokai-fg font-mono text-[11px] font-semibold">{m.name}</span>
                      {m.category && <span className="text-monokai-comment text-[10px]">· {m.category}</span>}
                    </div>
                    <div className="text-monokai-comment text-[10px] font-mono mt-0.5 break-all">{m.formula}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Package Name & Description Form */}
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  指标包名称 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 电商营收核心指标包"
                  value={packageName}
                  onChange={e => setPackageName(e.target.value)}
                  className="w-full bg-monokai-surface border border-monokai-border px-3 py-1.5 rounded-lg text-xs text-monokai-fg placeholder-monokai-comment/60 focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  业务说明 (可选)
                </label>
                <input
                  type="text"
                  placeholder="业务口径与用途概要"
                  value={packageDescription}
                  onChange={e => setPackageDescription(e.target.value)}
                  className="w-full bg-monokai-surface border border-monokai-border px-3 py-1.5 rounded-lg text-xs text-monokai-fg placeholder-monokai-comment/60 focus:border-monokai-border-strong focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <ActionButton
                variant="success"
                size="sm"
                icon={Zap}
                onClick={handleAnalyze}
                disabled={isAnalyzing || selectedTables.size === 0}
                loading={isAnalyzing}
              >
                {isAnalyzing ? '分析中...' : '生成指标包'}
              </ActionButton>

              <ActionButton
                variant="secondary"
                size="sm"
                icon={Sparkles}
                onClick={handleMetricAIFill}
                disabled={isAiFilling || selectedTables.size === 0}
                loading={isAiFilling}
              >
                AI 填充
              </ActionButton>

              <ActionButton
                variant="secondary"
                size="sm"
                icon={Package}
                onClick={() => setShowTemplatesModal(true)}
              >
                模版库
              </ActionButton>

              <ActionButton
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="text-monokai-pink hover:bg-monokai-pink/15"
                onClick={handleMetricQuickClear}
              >
                清空重置
              </ActionButton>
            </div>

            {/* Undo Toast */}
            {showClearToast && (
              <div className="flex items-center justify-between bg-monokai-surface border border-monokai-border rounded-lg px-3 py-2 text-xs">
                <span className="text-monokai-comment text-[11px]">已清空输入表单</span>
                <button
                  type="button"
                  onClick={handleUndoClear}
                  className="text-monokai-accent hover:underline text-xs flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Undo2 size={12} /> 撤销
                </button>
              </div>
            )}

            {/* External Data Source Entrance */}
            <div className="pt-2 border-t border-monokai-border/70">
              <ActionButton
                variant="secondary"
                size="sm"
                icon={Database}
                className="w-full"
                onClick={() => setShowDataSourceModal(true)}
              >
                挂载外部数据源 (CSV/Parquet)
              </ActionButton>
            </div>
          </div>
        )}

        {/* Sidebar Tab 2: Tables Selector */}
        {sidebarTab === 'tables' && (
          <div className="flex-1 flex flex-col min-h-0 bg-monokai-bg/40">
            <div className="p-3 border-b border-monokai-border/80 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-monokai-comment" />
                <input
                  type="text"
                  value={tableSearchTerm}
                  onChange={e => setTableSearchTerm(e.target.value)}
                  placeholder="搜索数据表..."
                  className="w-full bg-monokai-surface border border-monokai-border rounded-md pl-7 pr-6 py-1 text-xs text-monokai-fg placeholder-monokai-comment/60 focus:border-monokai-border-strong focus:outline-none"
                />
                {tableSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setTableSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-monokai-comment text-[11px]">
                  已选 <strong className="text-monokai-yellow">{selectedTables.size}</strong> / {tables.length} 张表
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTables(new Set(tables))}
                    className="text-[11px] text-monokai-accent hover:underline cursor-pointer"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTables(new Set())}
                    className="text-[11px] text-monokai-comment hover:text-monokai-fg cursor-pointer"
                  >
                    清空
                  </button>
                </div>
              </div>
            </div>

            {/* Tables Checklist */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {filteredTablesList.length === 0 ? (
                <div className="py-8 text-center text-monokai-comment text-xs">
                  暂无匹配数据表
                </div>
              ) : (
                filteredTablesList.map(t => {
                  const isChecked = selectedTables.has(t);
                  return (
                    <label
                      key={t}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                        isChecked
                          ? 'bg-monokai-surface border-monokai-border text-monokai-fg'
                          : 'hover:bg-monokai-surface/60 text-monokai-comment border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const next = new Set(selectedTables);
                          if (next.has(t)) next.delete(t);
                          else next.add(t);
                          setSelectedTables(next);
                        }}
                        className="h-3.5 w-3.5 rounded border-monokai-border accent-monokai-yellow cursor-pointer"
                      />
                      <span className="font-mono text-xs truncate flex-1">{t}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-monokai-border bg-monokai-sidebar/90">
              <ActionButton
                variant="primary"
                size="sm"
                icon={Sparkles}
                className="w-full"
                onClick={() => setSidebarTab('builder')}
              >
                确定并返回 AI 建模 ({selectedTables.size})
              </ActionButton>
            </div>
          </div>
        )}

        {/* Sidebar Tab 3: Guide / MECE */}
        {sidebarTab === 'guide' && (
          <div className="flex-1 flex flex-col min-h-0 bg-monokai-bg/40">
            {/* Sub-tabs for Help categories */}
            <div className="flex border-b border-monokai-border bg-monokai-sidebar px-2">
              {HELP_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveHelpCategory(cat.key)}
                  className={`flex-1 py-2 text-[11px] font-medium transition-colors border-b-2 -mb-px text-center cursor-pointer ${
                    activeHelpCategory === cat.key
                      ? 'border-monokai-fg text-monokai-fg font-bold'
                      : 'border-transparent text-monokai-comment hover:text-monokai-fg'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Guide Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs custom-scrollbar">
              {(() => {
                const c = METRIC_CATEGORY_HELP[activeHelpCategory];
                return (
                  <>
                    <div>
                      <h4 className="text-monokai-yellow font-bold text-xs mb-1">{c.title}</h4>
                      <p className="text-monokai-comment leading-relaxed text-[11px]">{c.description}</p>
                    </div>

                    <div>
                      <div className="text-[10px] text-monokai-blue uppercase font-bold mb-1">典型场景</div>
                      <div className="space-y-1">
                        {c.scenarios.map((s, i) => (
                          <div key={i} className="text-monokai-fg text-[11px] flex gap-1.5">
                            <span className="text-monokai-blue shrink-0">·</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-monokai-pink uppercase font-bold mb-1">常见错误</div>
                      <div className="space-y-1">
                        {c.commonErrors.map((e, i) => (
                          <div key={i} className="text-monokai-fg text-[11px] flex gap-1.5">
                            <span className="text-monokai-pink shrink-0">·</span>
                            <span>{e}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-monokai-comment uppercase font-bold mb-1.5">公式示例</div>
                      <div className="space-y-1.5">
                        {c.formulaExamples.map((ex, i) => (
                          <div key={i} className="bg-monokai-surface border border-monokai-border rounded p-2">
                            <div className="text-monokai-fg font-medium text-xs">{ex.name}</div>
                            <code className="text-monokai-green text-[10px] font-mono block mt-0.5 break-all">
                              {ex.formula}
                            </code>
                            <div className="text-monokai-comment text-[10px] mt-0.5">{ex.note}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Right Workspace (Two-Tier Architecture) ───────────────────────── */}
      <div className="metric-workspace flex-1 flex flex-col min-w-0 bg-monokai-bg">
        {selectedPackage ? (
          // ── Tier 2: Package Detail Workspace ─────────────────────────────
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="p-4 border-b border-monokai-border bg-monokai-sidebar/95 flex items-center justify-between gap-4 shrink-0 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <IconButton
                  label="返回指标包列表"
                  icon={ArrowLeft}
                  size="sm"
                  onClick={() => setSelectedPackage(null)}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-monokai-fg truncate">{selectedPackage.name}</h2>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-monokai-accent/15 text-monokai-accent font-semibold">
                      {selectedPackage.metrics.length} 个指标
                    </span>
                  </div>
                  <p className="text-xs text-monokai-comment truncate mt-0.5">
                    {selectedPackage.description || '无业务描述'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {onNavigateToDashboard && (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    icon={LayoutDashboard}
                    onClick={onNavigateToDashboard}
                    title="返回首页仪表盘"
                  >
                    仪表盘
                  </ActionButton>
                )}
                <ActionButton
                  variant="success"
                  size="sm"
                  icon={Play}
                  onClick={handleValidateAll}
                  disabled={isAnalyzing || !selectedPackage.sourceTables.length}
                >
                  验证全部
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={BarChart2}
                  onClick={handleGenerateAllCharts}
                  disabled={isGeneratingChart || !selectedPackage.sourceTables.length}
                  loading={isGeneratingChart}
                >
                  生成全部图表
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={BarChart2}
                  onClick={() => setShowChartListModal(true)}
                >
                  查看图表
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={() => handleExportPackage(selectedPackage)}
                  title="导出指标包 JSON"
                >
                  导出
                </ActionButton>
                <ActionButton
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => handleDeletePackage(selectedPackage.id)}
                >
                  删除包
                </ActionButton>
              </div>
            </div>

            {/* Secondary Meta Strip: Dependencies & Quick Stats */}
            <div className="px-5 py-2.5 bg-monokai-surface/40 flex items-center justify-between text-xs text-monokai-comment font-mono flex-wrap gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span>依赖数据表:</span>
                {selectedPackage.sourceTables.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded bg-monokai-bg text-monokai-yellow">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span>
                  已验证: <strong className="text-monokai-green">{selectedPackage.metrics.filter(m => m.isValid).length}</strong>
                </span>
                <span>
                  已关联图表: <strong className="text-monokai-blue">{metricCharts.size}</strong>
                </span>
                <span>
                  收藏: <strong className="text-monokai-yellow">{selectedPackage.metrics.filter(m => favorites.has(m.id)).length}</strong>
                </span>
              </div>
            </div>

            {/* Filter Toolbar & Category Pills */}
            <div className="p-4 bg-monokai-bg flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <SearchInput
                  value={detailSearchTerm}
                  onChange={setDetailSearchTerm}
                  onClear={() => setDetailSearchTerm('')}
                  placeholder="搜索指标名称、公式、业务定义..."
                  className="flex-1"
                />

                <ActionButton
                  variant={showFavoritesOnly ? 'warning' : 'secondary'}
                  size="sm"
                  icon={Star}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  {showFavoritesOnly ? '仅收藏' : '收藏筛选'}
                </ActionButton>

                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowTemplatesModal(true)}
                >
                  添加模版指标
                </ActionButton>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {packageCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryPill(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                      selectedCategoryPill === cat
                        ? 'bg-monokai-surface text-monokai-fg border-monokai-border-strong shadow-xs'
                        : 'bg-monokai-sidebar text-monokai-comment hover:text-monokai-fg border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Content Grid */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-monokai-bg">
              {filteredMetrics.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title={
                    showFavoritesOnly
                      ? '暂无收藏的指标'
                      : detailSearchTerm
                      ? '没有匹配的指标'
                      : '该指标包暂无指标定义'
                  }
                  description="点击「添加模版指标」或在左侧使用 AI 自动生成语义指标"
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
                  {filteredMetrics.map(metric => (
                    <MetricCard
                      key={metric.id}
                      metric={metric}
                      sourceTable={selectedPackage.sourceTables[0]}
                      onEdit={setEditingMetric}
                      onDelete={handleDeleteMetric}
                      onValidate={handleValidateMetric}
                      onFix={handleFixMetric}
                      onGenerateChart={handleGenerateChart}
                      onExecuteInEditor={handleExecuteMetricInEditor}
                      hasChart={metricCharts.get(metric.id) || false}
                      onToggleFavorite={toggleFavorite}
                      isFavorite={isFavorite(metric.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // ── Tier 1: Discovery Board (Package List View) ───────────────────
          <div className="flex-1 flex flex-col min-h-0">
            <PageHeader
              title="语义指标库 (Semantic Metrics)"
              description="基于 DuckDB 的声明式语义指标建模与多维分析管理中心"
              icon={BarChart2}
              tone="accent"
              badge={
                <span className="rounded-full bg-monokai-surface border border-monokai-border px-2.5 py-0.5 text-[10px] font-mono font-medium text-monokai-fg-muted">
                  {packages.length} 个指标包
                </span>
              }
              actions={
                <div className="flex items-center gap-2">
                  {onNavigateToDashboard && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      icon={LayoutDashboard}
                      onClick={onNavigateToDashboard}
                      title="返回首页仪表盘"
                    >
                      仪表盘
                    </ActionButton>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-monokai-surface border border-monokai-border rounded-lg text-xs font-medium text-monokai-fg hover:bg-monokai-sidebar cursor-pointer transition-colors shadow-xs active:scale-95">
                    <Upload size={14} className="text-monokai-fg-muted" />
                    <span>导入指标包</span>
                    <input type="file" accept=".json" onChange={handleImportPackage} className="hidden" />
                  </label>
                </div>
              }
            />

            {/* Filter Search Bar */}
            <div className="p-4 bg-monokai-sidebar/40">
              <div className="max-w-4xl mx-auto flex items-center gap-3">
                <SearchInput
                  value={packageSearchTerm}
                  onChange={setPackageSearchTerm}
                  onClear={() => setPackageSearchTerm('')}
                  placeholder="搜索指标包名称或描述..."
                  className="flex-1"
                />
              </div>
            </div>

            {/* Package Cards List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-monokai-bg">
              {filteredPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center mb-4 text-monokai-comment shadow-lg shadow-black/40">
                    <Package className="h-7 w-7 text-monokai-comment" />
                  </div>
                  <h3 className="text-base font-bold text-monokai-fg mb-1.5 tracking-tight">暂无指标包</h3>
                  <p className="text-xs text-monokai-comment max-w-sm mb-6 leading-relaxed">
                    在左侧选择数据表后输入业务描述自动推断，或直接浏览预设指标库快速构建。
                  </p>
                  <div className="flex items-center gap-3">
                    <ActionButton
                      variant="primary"
                      size="md"
                      icon={Sparkles}
                      onClick={() => setShowTemplatesModal(true)}
                    >
                      浏览预设指标模板
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-3.5">
                  {filteredPackages.map(pkg => (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className="group bg-monokai-sidebar border border-monokai-border rounded-xl p-5 hover:border-monokai-border-strong hover:bg-monokai-surface/60 transition-all cursor-pointer shadow-xs hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-sm text-monokai-fg group-hover:text-monokai-accent transition-colors truncate">
                              {pkg.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-monokai-surface text-monokai-fg-muted border border-monokai-border font-semibold shrink-0">
                              {pkg.metrics.length} 个指标
                            </span>
                          </div>

                          <p className="text-xs text-monokai-comment mt-1 line-clamp-2 leading-relaxed">
                            {pkg.description || '暂无业务描述'}
                          </p>

                          {/* Dependencies & Preview tags */}
                          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-monokai-comment">
                            <span className="text-[11px] font-mono text-monokai-comment">依赖表:</span>
                            {pkg.sourceTables.map(t => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-monokai-surface text-[10px] font-mono text-monokai-fg-muted border border-monokai-border"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Right operations */}
                        <div className="flex items-center gap-2 shrink-0">
                          <IconButton
                            label="导出指标包"
                            icon={Download}
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              handleExportPackage(pkg);
                            }}
                          />
                          <ActionButton
                            variant="primary"
                            size="sm"
                            icon={ArrowRight}
                            iconPosition="right"
                            onClick={() => setSelectedPackage(pkg)}
                          >
                            进入详细内容
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {/* 1. Template Modal */}
      <MetricTemplateModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={handleAddTemplate}
      />

      {/* 2. External Data Source Modal */}
      <MetricDataSourceModal
        isOpen={showDataSourceModal}
        onClose={() => setShowDataSourceModal(false)}
      />

      {/* 3. Metric Chart List Modal */}
      {showChartListModal && selectedPackage && (
        <MetricChartListModal
          packageId={selectedPackage.id}
          onClose={() => setShowChartListModal(false)}
          onRefresh={() => loadMetricChartsForPackage(selectedPackage.id)}
          onOpenInSqlEditor={chart => {
            if (onChartGenerated) onChartGenerated(chart);
          }}
        />
      )}

      {/* 4. Metric Edit Modal */}
      <MetricEditModal
        isOpen={!!editingMetric}
        metric={editingMetric}
        onClose={() => setEditingMetric(null)}
        onSave={handleSaveEditMetric}
      />
    </div>
  );
};

export default MetricManager;
