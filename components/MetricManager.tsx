import './metricUi.css';
import { extractTablesFromSql } from '../services/queryVizHint';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MetricChart, MetricPackage, MetricDefinition } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { aiService } from '../services/aiService';
import { toastService } from '../services/toastService';
import { MetricCard } from './MetricCard';
import { MetricChartListModal } from './MetricChartListModal';
import { MetricTemplateModal } from './MetricTemplateModal';
import { METRIC_AUTHORING_RULES } from '../services/metricAuthoring';
import { MetricDataSourceModal } from './MetricDataSourceModal';
import { MetricEditModal } from './MetricEditModal';
import { MetricCreatePackageModal } from './MetricCreatePackageModal';
import {
  Database, Plus, RefreshCw, Trash2, Check, Loader2, Package, ArrowLeft, Play,
  BarChart2, Star, Search, Download, Upload, LayoutDashboard,
  Sparkles, HelpCircle, X, Zap, Undo2,
  Filter, Layers, BookOpen, ExternalLink, CheckCircle2,
  Table2, ArrowRight, GitBranch, PieChart
} from 'lucide-react';
import {
  PanelHeader, PageHeader, ActionButton, IconButton,
  SearchInput, EmptyState, SegmentedTabs, FormInput, FormTextarea, ModalShell
} from './ui/Workbench';
import { LineageGraphView } from './ui/LineageGraphView';
import { metricSource } from '../services/metricSql';
import { activeAnalysisDatabase } from '../services/metricAssetStorage';
import { semanticMetricCatalog } from '../services/semanticMetricCatalog';
import { buildAnalyticalCatalog } from '../services/analyticalCatalogService';

import { METRIC_CATEGORY_HELP, HELP_CATEGORIES } from '../data/metricHelp';

type SidebarTabType = 'builder' | 'tables' | 'guide';

interface MetricManagerProps {
  tables: string[];
  currentTable?: string | null;
  currentMetricId?: string | null;
  onExecuteSql?: (sql: string) => void;
  onChartGenerated?: (chart: MetricChart) => void;
  onNavigateToDashboard?: () => void;
  onNavigateToVisualization?: (metricId?: string) => void;
  onNavigateToData?: (tableName: string) => void;
}

export const MetricManager: React.FC<MetricManagerProps> = ({
  tables,
  currentTable,
  currentMetricId,
  onExecuteSql,
  onChartGenerated,
  onNavigateToDashboard,
  onNavigateToVisualization,
  onNavigateToData,
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
  const previewRequestRef = useRef(0);

  useEffect(() => {
    previewRequestRef.current++;
    if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);
    setMetricPreview(null);
    setIsGeneratingPreview(false);
    return () => {
      previewRequestRef.current++;
      if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);
    };
  }, [selectedTables]);

  // ── Left Sidebar Tab State ─────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('builder');
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeHelpCategory, setActiveHelpCategory] = useState<keyof typeof METRIC_CATEGORY_HELP>('metricModeling');

  // ── Detail View Filtering & Modals ─────────────────────────────────────────
  const [detailSearchTerm, setDetailSearchTerm] = useState('');
  const [selectedCategoryPill, setSelectedCategoryPill] = useState<string>('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('duckdb_metric_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [showChartListModal, setShowChartListModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricDefinition | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'metric' | 'package'; id: string; name: string } | null>(null);
  const [lineageModalMetric, setLineageModalMetric] = useState<MetricDefinition | null>(null);
  const [metricCharts, setMetricCharts] = useState<Map<string, boolean>>(new Map());
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Quick Clear Undo Toast ─────────────────────────────────────────────────
  const [lastClearedForm, setLastClearedForm] = useState<{
    packageName: string;
    packageDescription: string;
    aiInput: string;
    selectedTables: Set<string>;
  } | null>(null);
  const [showClearToast, setShowClearToast] = useState(false);
  const clearToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (clearToastTimerRef.current) clearTimeout(clearToastTimerRef.current); }, []);
  const focusedMetricRef = useRef<string | null>(null);

  // Filters and overlays belong to the opened package, not the whole library.
  useEffect(() => {
    setDetailSearchTerm(selectedPackage?.metrics.find(metric => metric.id === currentMetricId)?.name || '');
    setSelectedCategoryPill('全部');
    setShowFavoritesOnly(false);
    setEditingMetric(null);
    setLineageModalMetric(null);
    setShowChartListModal(false);
    setPendingDelete(null);
  }, [selectedPackage?.id]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPackages();
    const reload = () => loadPackages();
    window.addEventListener('duckdb-metrics-updated', reload);
    window.addEventListener('duckdb-database-changed', reload);
    window.addEventListener('duckdb-metric-charts-updated', reload);
    return () => {
      window.removeEventListener('duckdb-metrics-updated', reload);
      window.removeEventListener('duckdb-database-changed', reload);
      window.removeEventListener('duckdb-metric-charts-updated', reload);
    };
  }, []);

  useEffect(() => {
    if (!currentMetricId) { focusedMetricRef.current = null; return; }
    if (focusedMetricRef.current === currentMetricId) return;
    const pkg = packages.find(item => item.metrics.some(metric => metric.id === currentMetricId));
    if (!pkg) return;
    focusedMetricRef.current = currentMetricId;
    setSelectedPackage(pkg);
    setDetailSearchTerm(pkg.metrics.find(metric => metric.id === currentMetricId)?.name || '');
    setSelectedCategoryPill('全部');
    setShowFavoritesOnly(false);
  }, [currentMetricId, packages]);

  useEffect(() => {
    setSelectedTables(prev => new Set([...prev].filter(table => tables.includes(table))));
  }, [tables]);

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
    setSelectedPackage(prev => prev ? loaded.find(pkg => pkg.id === prev.id) || null : null);
  };

  const saveMetricResults = (pkg: MetricPackage, database: string, results: MetricDefinition[]) => {
    if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，本次结果未保存，请在当前数据库重新验证');
    const latest = metricAnalyzer.loadMetricPackages().find(item => item.id === pkg.id);
    if (!latest) return;
    const metrics = latest.metrics.map(metric => {
      const before = pkg.metrics.find(item => item.id === metric.id);
      const result = results.find(item => item.id === metric.id);
      // A result for an earlier definition must not overwrite an edit made while it ran.
      if (!before || !result || metric.formula !== before.formula || metric.sourceTable !== before.sourceTable
        || JSON.stringify(metric.calculation) !== JSON.stringify(before.calculation)) return metric;
      const changes = Object.fromEntries(Object.entries(result).filter(([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(before[key as keyof MetricDefinition])));
      return { ...metric, ...changes };
    });
    metricAnalyzer.updateMetricPackage(pkg.id, { metrics });
    loadPackages();
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
    const requestId = ++previewRequestRef.current;
    setAiNaturalLanguageInput(value);
    setMetricPreview(null);
    setIsGeneratingPreview(false);
    if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);
    if (!value.trim() || selectedTables.size === 0) return;

    nlDebounceRef.current = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const tableList = Array.from(selectedTables).join('、');
        const schemas = await metricAnalyzer.collectTableSchema(Array.from(selectedTables));
        if (requestId !== previewRequestRef.current) return;
        const prompt = `根据以下需求生成指标定义（返回 JSON 数组，每个元素包含 name/scenario/characteristics/value/definition/formula/example/dependencies/unit/category 字段，最多 3 个指标）：
数据表：${tableList}
实际结构：${JSON.stringify(schemas.map(table => ({ tableName: table.tableName, columns: table.columns })))}
需求描述：${value.trim()}
${METRIC_AUTHORING_RULES}`;
        const result = await aiService.robustCall<MetricDefinition[]>(
          'metric' as any,
          prompt,
          '你是数据分析专家。仅返回 JSON 数组，不包含其他内容。',
          true,
          1,
        );
        const arr = Array.isArray(result) ? result : [result];
        if (requestId !== previewRequestRef.current) return;
        setMetricPreview(metricAnalyzer.validateMetrics(arr.slice(0, 3)).map(metric => ({ ...metric,
          sourceTable: metric.sourceTable || (schemas.length === 1 ? schemas[0].tableName : undefined),
        })));

      } catch {
        // Silent fail for preview
      } finally {
        if (requestId === previewRequestRef.current) setIsGeneratingPreview(false);
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
      if (result?.name || result?.description) {
        toastService.success('AI 智能填充完成', result?.name || '已生成指标包名称与描述');
      } else {
        toastService.warning('AI 未能生成有效信息', '请补充自然语言描述或手动输入包名称');
      }
    } catch (err) {
      console.error('AI fill failed:', err);
      toastService.error('AI 填充失败', '请检查网络或 AI 模型配置');
    } finally {
      setIsAiFilling(false);
    }
  };

  // ── Quick Clear ────────────────────────────────────────────────────────────
  const handleMetricQuickClear = () => {
    if (!packageName.trim() && !packageDescription.trim() && !aiNaturalLanguageInput.trim() && selectedTables.size === 0) {
      toastService.info('表单已是空白状态');
      return;
    }
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
    if (clearToastTimerRef.current) clearTimeout(clearToastTimerRef.current);
    clearToastTimerRef.current = setTimeout(() => setShowClearToast(false), 5000);
  };

  const handleUndoClear = () => {
    if (!lastClearedForm) return;
    if (clearToastTimerRef.current) clearTimeout(clearToastTimerRef.current);
    setPackageName(lastClearedForm.packageName);
    setPackageDescription(lastClearedForm.packageDescription);
    setAiNaturalLanguageInput(lastClearedForm.aiInput);
    setSelectedTables(lastClearedForm.selectedTables);
    setLastClearedForm(null);
    setShowClearToast(false);
  };

  // ── Lineage Graph Computation ──────────────────────────────────────────────
  const lineageGraph = useMemo(() => {
    if (!lineageModalMetric || !selectedPackage) return null;
    const sourceTable = metricSource(lineageModalMetric, selectedPackage.sourceTables);
    return semanticMetricCatalog.buildMetricLineage(lineageModalMetric, sourceTable);
  }, [lineageModalMetric, selectedPackage]);

  // ── AI Generate / Analyze ──────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (selectedTables.size === 0) {
      toastService.warning('请先勾选数据表', '请在左侧选择至少一张表进行语义分析');
      setSidebarTab('tables');
      return;
    }

    const database = activeAnalysisDatabase();
    const name = packageName.trim() || `指标包_${new Date().toLocaleDateString()}`;
    setIsAnalyzing(true);
    setAnalysisProgress('正在提取数据表语义结构...');

    try {
      const metrics = await metricAnalyzer.analyzeMetrics(
        Array.from(selectedTables),
        (step) => setAnalysisProgress(step),
        aiNaturalLanguageInput.trim(),
      );

      if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，请重新生成指标');
      if (!metrics.length) { toastService.info('未生成指标候选，请补充业务问题或手动定义'); return; }
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
      toastService.success('指标包构建成功', `已保留 ${newPackage.metrics.length} 个候选草稿，请补齐口径并验证`);
    } catch (err) {
      console.error('Analysis failed:', err);
      toastService.error('分析生成失败', (err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleCreatePackage = (newPackage: MetricPackage) => {
    const existing = metricAnalyzer.loadMetricPackages();
    existing.push(newPackage);
    metricAnalyzer.saveAllPackages(existing);
    loadPackages();
    setSelectedPackage(newPackage);
  };

  const handleBuildFromTables = async () => {
    const sources = selectedTables.size ? [...selectedTables] : currentTable ? [currentTable] : tables;
    if (!sources.length) { toastService.info('请先导入数据或创建数据表'); return; }
    const database = activeAnalysisDatabase();
    setIsAnalyzing(true);
    try {
      const catalog = await buildAnalyticalCatalog(sources);
      if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，请重新生成指标');
      const metrics: MetricDefinition[] = catalog.coreMetrics.map(proposal => ({
        id: `metric-${proposal.id}-${Date.now()}`, name: proposal.name, sourceTable: proposal.tableName,
        governance: {role: 'diagnostic', reviewStatus: 'draft'},
        scenario: '当前数据表的基础统计', characteristics: proposal.aggregation,
        value: '基础诊断候选；业务问题、决策用途、资格总体与单位尚待确认',
        definition: proposal.rationale,
        formula: proposal.sql, sqlValidation: proposal.sql,
        example: '执行指标查询后查看实际结果', dependencies: proposal.measureColumn ? [proposal.measureColumn] : [],
        unit: proposal.aggregation === 'count' ? '行' : '',
        createdAt: Date.now(), category: '数据基础',
      }));
      if (!metrics.length) { toastService.info('当前数据表没有可生成的指标'); return; }
      const pkg = metricAnalyzer.createMetricPackage(packageName.trim() || `${sources[0]}_基础指标`,
        '真实字段生成的基础诊断候选；技术验证不代表业务价值已确认', sources, metrics);
      metricAnalyzer.saveMetricPackage(pkg);
      loadPackages();
      setSelectedPackage(pkg);
      toastService.success(`已从真实字段生成 ${metrics.length} 个指标`);
    } catch (error) { toastService.error('指标生成失败', (error as Error).message); }
    finally { setIsAnalyzing(false); }
  };

  // ── Batch Actions ──────────────────────────────────────────────────────────
  const handleValidateAll = async () => {
    if (!selectedPackage || isAnalyzing) return;
    const database = activeAnalysisDatabase();
    setIsAnalyzing(true);
    setAnalysisProgress('正在逐一验证指标公式...');
    try {
      const updatedMetrics: MetricDefinition[] = [];
      let successCount = 0;
      for (let i = 0; i < selectedPackage.metrics.length; i++) {
        if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，批量验证已停止');
        const metric = selectedPackage.metrics[i];
        setAnalysisProgress(`正在验证 (${i + 1}/${selectedPackage.metrics.length}): ${metric.name}...`);
        const result = await metricAnalyzer.validateMetric(metric, metricSource(metric, selectedPackage.sourceTables));
        const validatedMetric: MetricDefinition = {
          ...metric,
          isValid: result.isValid,
          validationError: result.error, sqlValidation: result.sql, validationDatabase: result.database, validationResult: result.result?.slice(0, 20),
          lastValidated: Date.now(),
        };
        if (result.isValid) successCount++;
        updatedMetrics.push(validatedMetric);
      }

      saveMetricResults(selectedPackage, database, updatedMetrics);
      const summary = `通过 ${successCount} / ${selectedPackage.metrics.length}，失败 ${selectedPackage.metrics.length - successCount}`;
      if (successCount === selectedPackage.metrics.length) toastService.success('批量验证完成', summary);
      else toastService.warning('部分指标验证失败', summary);
    } catch (err) {
      toastService.error('批量验证失败', (err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleGenerateAllCharts = async () => {
    if (!selectedPackage || isGeneratingChart) return;
    const database = activeAnalysisDatabase();
    setIsGeneratingChart(true);
    try {
      let count = 0;
      for (const [index, metric] of selectedPackage.metrics.entries()) {
        if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，图表生成已停止');
        setAnalysisProgress(`正在生成图表 (${index + 1}/${selectedPackage.metrics.length}): ${metric.name}`);
        try {
          await metricAnalyzer.generateChart(metric, selectedPackage.id, metricSource(metric, selectedPackage.sourceTables));
          count++;
        } catch {
          // continue
        }
      }
      loadMetricChartsForPackage(selectedPackage.id);
      const summary = `成功 ${count} / ${selectedPackage.metrics.length}，失败 ${selectedPackage.metrics.length - count}`;
      if (count === selectedPackage.metrics.length) toastService.success('图表批量生成完成', summary);
      else toastService.warning('部分图表生成失败', summary);
    } catch (err) {
      toastService.error('生成图表失败', (err as Error).message);
    } finally {
      setIsGeneratingChart(false);
      setAnalysisProgress('');
    }
  };

  // ── Single Metric Actions ──────────────────────────────────────────────────
  const handleValidateMetric = async (metric: MetricDefinition) => {
    if (!selectedPackage) return;
    const database = activeAnalysisDatabase();
    try {
      const result = await metricAnalyzer.validateMetric(metric, metricSource(metric, selectedPackage.sourceTables));
      const updatedMetrics = selectedPackage.metrics.map(m =>
        m.id === metric.id
          ? { ...m, isValid: result.isValid, validationError: result.error, sqlValidation: result.sql, validationDatabase: result.database, validationResult: result.result?.slice(0, 20), lastValidated: Date.now() }
          : m,
      );
      saveMetricResults(selectedPackage, database, updatedMetrics.filter(item => item.id === metric.id));
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
    const database = activeAnalysisDatabase();
    try {
      const fixedMetric = await metricAnalyzer.fixMetric(metric, metricSource(metric, selectedPackage.sourceTables));
      if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，修复已停止');
      if (fixedMetric) {
        // Re-validate fixed metric
        const validation = await metricAnalyzer.validateMetric(fixedMetric, metricSource(metric, selectedPackage.sourceTables));
        const finalMetric = {
          ...fixedMetric,
          isValid: validation.isValid,
          validationError: validation.error,
          sqlValidation: validation.sql, validationDatabase: validation.database,
          validationResult: validation.result?.slice(0, 20), lastValidated: Date.now(),
          version: (metric.version || 1) + 1,
        };

        saveMetricResults(selectedPackage, database, [finalMetric]);
        if (validation.isValid) toastService.success(`已修复指标「${metric.name}」`, `已升级为版本 v${finalMetric.version}`);
        else toastService.error('修复后的指标仍未通过验证', validation.error);
      }
    } catch (err) {
      toastService.error('AI 修复失败', (err as Error).message);
    }
  };

  const handleGenerateChart = async (metric: MetricDefinition) => {
    if (!selectedPackage) return;
    try {
      const chart = await metricAnalyzer.generateChart(metric, selectedPackage.id, metricSource(metric, selectedPackage.sourceTables));
      loadMetricChartsForPackage(selectedPackage.id);
      toastService.success(`已为「${metric.name}」生成图表`, `类型: ${chart.chartConfig.type}`);
    } catch (err) {
      toastService.error('生成图表失败', (err as Error).message);
    }
  };

  const handleExecuteMetricInEditor = async (metric: MetricDefinition) => {
    let sql: string;
    try { sql = await metricAnalyzer.generateValidationSql(metric, metricSource(metric, selectedPackage?.sourceTables || [])); }
    catch (error) { toastService.error('无法生成指标 SQL', (error as Error).message); return; }
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

  const handleSaveEditMetric = async (updatedMetric: MetricDefinition) => {
    if (!selectedPackage || (selectedPackage.databaseName && selectedPackage.databaseName !== activeAnalysisDatabase())) throw new Error('数据库已切换，请重新打开指标包');
    const database = activeAnalysisDatabase();
    const validation = await metricAnalyzer.validateMetric(updatedMetric, metricSource(updatedMetric, selectedPackage.sourceTables));
    if (database !== activeAnalysisDatabase()) throw new Error('数据库已切换，请重新打开指标包');
    if (!validation.isValid) throw new Error(validation.error);
    const saved = { ...updatedMetric, sqlValidation: validation.sql, validationResult: validation.result?.slice(0, 20), validationDatabase: validation.database, isValid: true, lastValidated: Date.now(), updatedAt: Date.now() };
    const latest = metricAnalyzer.loadMetricPackages().find(pkg => pkg.id === selectedPackage.id);
    if (!latest) throw new Error('指标包已移除，无法保存');
    const exists = latest.metrics.some(m => m.id === saved.id);
    const updatedMetrics = exists ? latest.metrics.map(m => m.id === saved.id ? saved : m) : [...latest.metrics, saved];
    const updatedPackage = metricAnalyzer.updateMetricPackage(selectedPackage.id, { metrics: updatedMetrics });
    loadPackages();
    setSelectedPackage(prev => prev?.id === updatedPackage?.id ? updatedPackage : prev);
    const savedMetric = updatedPackage?.metrics.find(metric => metric.id === updatedMetric.id);
    if (savedMetric && metricAnalyzer.getChartByMetric(savedMetric.id)) {
      try { await metricAnalyzer.generateChart(savedMetric, selectedPackage.id, metricSource(savedMetric, selectedPackage.sourceTables)); }
      catch (error) { toastService.warning('指标已保存，但关联图表更新失败', (error as Error).message); }
    }
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
    setShowTemplatesModal(false);
    setEditingMetric({ ...newMetric, sourceTable: template.sourceTable || (selectedPackage.sourceTables.length === 1 ? selectedPackage.sourceTables[0] : undefined) });
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
    const database = activeAnalysisDatabase();
    reader.onload = (e) => {
      try {
        if (activeAnalysisDatabase() !== database) throw new Error('数据库已切换，请在目标数据库重新导入');
        const rawContent = e.target?.result as string;
        if (!rawContent || !rawContent.trim()) {
          toastService.error('导入失败', 'JSON 文件内容为空');
          return;
        }
        const imported = JSON.parse(rawContent);
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          toastService.error('导入失败', '文件根结构必须为指标包 JSON 对象');
          return;
        }

        if (!Array.isArray(imported.metrics)) throw new Error('指标包必须包含 metrics 数组');
        const rawMetrics = imported.metrics;
        const validMetrics: MetricDefinition[] = rawMetrics
          .filter((m: any) => m && typeof m === 'object' && typeof m.name === 'string' && m.name.trim().length > 0)
          .map((m: any) => ({
            id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            name: String(m.name).trim(),
            scenario: typeof m.scenario === 'string' ? m.scenario.trim() : '',
            characteristics: typeof m.characteristics === 'string' ? m.characteristics.trim() : '标准型',
            value: typeof m.value === 'string' ? m.value.trim() : '',
            definition: typeof m.definition === 'string' ? m.definition.trim() : '',
            formula: typeof m.formula === 'string' ? m.formula.trim() : '',
            example: typeof m.example === 'string' ? m.example.trim() : '',
            dependencies: Array.isArray(m.dependencies)
              ? m.dependencies.filter((d: any) => typeof d === 'string' && d.trim().length > 0).map((d: any) => d.trim())
              : [],
            unit: typeof m.unit === 'string' ? m.unit.trim() : '',
            category: typeof m.category === 'string' && m.category.trim() ? m.category.trim() : '基础统计',
            tags: Array.isArray(m.tags)
              ? m.tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0).map((t: any) => t.trim())
              : [],
            isFavorite: Boolean(m.isFavorite),
            sourceTable: typeof m.sourceTable === 'string' ? m.sourceTable : undefined,
            calculation: m.calculation && typeof m.calculation === 'object' && !Array.isArray(m.calculation) ? m.calculation : undefined,
            governance: m.governance && typeof m.governance === 'object' && !Array.isArray(m.governance) ? { ...m.governance, reviewStatus: 'draft' } : undefined,
            isValid: undefined,
            sqlValidation: undefined,
            validationError: undefined,
            createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
            updatedAt: Date.now(),
          }));

        if (rawMetrics.length > 0 && validMetrics.length === 0) {
          toastService.error('导入失败', '未在文件中检测到有效的指标定义 (至少需提供包含名称的指标项)');
          return;
        }

        const sourceTables = Array.isArray(imported.sourceTables)
          ? imported.sourceTables.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
          : (typeof imported.table === 'string' && imported.table.trim() ? [imported.table.trim()] : []);

        const newPkg: MetricPackage = {
          id: `pkg_${Date.now()}`,
          name: typeof imported.name === 'string' && imported.name.trim() ? imported.name.trim() : `导入指标包_${new Date().toISOString().slice(0, 10)}`,
          description: typeof imported.description === 'string' ? imported.description.trim() : '',
          sourceTables,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metrics: validMetrics,
        };

        const existing = metricAnalyzer.loadMetricPackages();
        existing.push(newPkg);
        metricAnalyzer.saveAllPackages(existing);
        loadPackages();
        setSelectedPackage(newPkg);

        if (validMetrics.length < rawMetrics.length) {
          toastService.warning(
            `成功导入「${newPkg.name}」`,
            `导入 ${validMetrics.length} 个指标 (已过滤 ${rawMetrics.length - validMetrics.length} 个格式异常项)`
          );
        } else {
          toastService.success(`成功导入指标包「${newPkg.name}」`, `共 ${validMetrics.length} 个指标`);
        }
      } catch (err) {
        toastService.error('导入失败', `JSON 解析异常: ${(err as Error).message}`);
      }
    };
    reader.onerror = () => toastService.error('导入失败', '无法读取文件，请重新选择');
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
  useEffect(() => {
    if (!packageCategories.includes(selectedCategoryPill)) setSelectedCategoryPill('全部');
  }, [packageCategories, selectedCategoryPill]);

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

  const hasDetailFilters = Boolean(detailSearchTerm.trim() || showFavoritesOnly || selectedCategoryPill !== '全部');
  const resetDetailFilters = () => {
    setDetailSearchTerm(''); setSelectedCategoryPill('全部'); setShowFavoritesOnly(false);
  };

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
    <div className="metric-manager metric-surface relative flex-1 flex min-w-0 min-h-0 bg-monokai-bg font-sans overflow-hidden">
      {showBuilder && !selectedPackage && <button type="button" aria-label="收起建模工具遮罩" className="absolute inset-0 z-20 bg-black/30" onClick={() => setShowBuilder(false)} />}
      {/* ── Left Sidebar (320px) ─────────────────────────────────────────── */}
      <div className={`metric-builder-sidebar absolute inset-y-0 left-0 z-30 shadow-xl w-80 max-w-[85vw] flex-shrink-0 bg-monokai-sidebar border-r border-monokai-border flex flex-col min-h-0 ${selectedPackage || !showBuilder ? 'hidden' : ''}`}>
        <PanelHeader
          title="指标建模工作台"
          icon={Layers}
          tone="accent"
          actions={
            <IconButton label="收起建模工具" icon={X} size="sm" onClick={() => setShowBuilder(false)} />
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
              { value: 'tables', label: `数据表 (${tables.length})`, icon: Table2 },
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
                <FormTextarea
                  sizeVariant="sm"
                  rows={2}
                  placeholder="例如：统计各渠道客单价与次日留存率，监控核心营收..."
                  value={aiNaturalLanguageInput}
                  onChange={e => handleNLInputChange(e.target.value)}
                  className="pr-7 resize-none leading-relaxed"
                />
                {aiNaturalLanguageInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiNaturalLanguageInput('');
                      setMetricPreview(null);
                    }}
                    className="absolute top-2 right-2 text-monokai-comment hover:text-monokai-fg p-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent rounded-sm"
                    aria-label="清空输入"
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
                <FormInput
                  sizeVariant="sm"
                  type="text"
                  placeholder="例如: 电商营收核心指标包"
                  value={packageName}
                  onChange={e => setPackageName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-monokai-fg-muted uppercase tracking-wider mb-1">
                  业务说明 (可选)
                </label>
                <FormInput
                  sizeVariant="sm"
                  type="text"
                  placeholder="业务口径与用途概要"
                  value={packageDescription}
                  onChange={e => setPackageDescription(e.target.value)}
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
                icon={Plus}
                onClick={() => setShowCreatePackageModal(true)}
              >
                手动建包
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
            </div>

            <div className="pt-0.5">
              <ActionButton
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="w-full text-monokai-pink hover:bg-monokai-pink/15"
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
              <SearchInput
                size="sm"
                value={tableSearchTerm}
                onChange={setTableSearchTerm}
                onClear={() => setTableSearchTerm('')}
                placeholder="搜索数据表..."
                className="w-full max-w-none"
              />

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
            <div className="p-2 border-b border-monokai-border bg-monokai-sidebar">
              <SegmentedTabs<string>
                value={activeHelpCategory}
                onChange={val => setActiveHelpCategory(val as keyof typeof METRIC_CATEGORY_HELP)}
                aria-label="指南分类"
                size="sm"
                tone="accent"
                className="w-full"
                items={HELP_CATEGORIES.map(cat => ({
                  value: cat.key,
                  label: cat.label,
                }))}
              />
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
              <div className="flex items-center gap-2 max-w-full flex-wrap">
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
                  disabled={isAnalyzing || isGeneratingChart || !selectedPackage.metrics.length}
                  loading={isAnalyzing}
                >
                  验证全部
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={BarChart2}
                  onClick={handleGenerateAllCharts}
                  disabled={isAnalyzing || isGeneratingChart || !selectedPackage.metrics.length}
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
                {onNavigateToVisualization && (
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={PieChart}
                    onClick={() => onNavigateToVisualization()}
                    title="前往可视化中心查看多维图表与数据联动"
                  >
                    可视化中心
                  </ActionButton>
                )}
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
                  disabled={isAnalyzing || isGeneratingChart}
                  onClick={() => setPendingDelete({ kind: 'package', id: selectedPackage.id, name: selectedPackage.name })}
                >
                  删除包
                </ActionButton>
              </div>
            </div>

            {/* Secondary Meta Strip: Dependencies & Quick Stats */}
            <div className="px-5 py-2.5 bg-monokai-surface/40 flex items-center justify-between text-xs text-monokai-comment font-mono flex-wrap gap-2 shadow-xs border-b border-monokai-border/60">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-monokai-comment">依赖数据表:</span>
                {selectedPackage.sourceTables.map(t => (
                  <button
                    type="button"
                    key={t}
                    title={t}
                    disabled={!tables.includes(t) || !onNavigateToData}
                    onClick={() => onNavigateToData?.(t)}
                    className="max-w-[180px] truncate px-2 py-0.5 rounded bg-monokai-bg text-monokai-yellow border border-monokai-border/60 hover:border-monokai-accent/60 hover:text-monokai-fg transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
                  >
                    {t}
                  </button>
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
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <SearchInput
                  value={detailSearchTerm}
                  onChange={setDetailSearchTerm}
                  onClear={() => setDetailSearchTerm('')}
                  placeholder="搜索指标名称、公式、业务定义..."
                  className="flex-1 min-w-[180px]"
                />

                <ActionButton
                  variant={showFavoritesOnly ? 'warning' : 'secondary'}
                  size="sm"
                  icon={Star}
                  aria-pressed={showFavoritesOnly}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  {showFavoritesOnly ? '仅收藏' : '收藏筛选'}
                </ActionButton>

                <ActionButton variant="success" size="sm" icon={Plus} onClick={() => setEditingMetric({
                  id: `metric_${crypto.randomUUID()}`, name: '', formula: '', scenario: '', characteristics: '', value: '', definition: '', example: '', dependencies: [], createdAt: Date.now(),
                  sourceTable: selectedPackage.sourceTables.length === 1 ? selectedPackage.sourceTables[0] : '', calculation: { aggregation: 'COUNT' },
                })}>手动建立指标</ActionButton>
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
                    aria-pressed={selectedCategoryPill === cat}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent ${
                      selectedCategoryPill === cat
                        ? 'bg-monokai-surface text-monokai-fg border-monokai-border-strong shadow-xs'
                        : 'bg-monokai-sidebar text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60 border-monokai-border/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>


            {/* Metrics Content Grid */}
            <div className="px-5 pb-2 flex flex-wrap items-center gap-3 text-xs text-monokai-comment">
              <span>显示 {filteredMetrics.length} / {selectedPackage.metrics.length} 个指标</span>
              {hasDetailFilters && <ActionButton size="sm" variant="ghost" icon={X} onClick={resetDetailFilters}>清除筛选</ActionButton>}
              {(isAnalyzing || isGeneratingChart) && <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-monokai-accent"><Loader2 size={13} className="animate-spin" />{analysisProgress || '正在处理指标…'}</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-monokai-bg">
              {filteredMetrics.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title={
                    hasDetailFilters
                      ? '没有匹配的指标'
                      : '该指标包暂无指标定义'
                  }
                  description={hasDetailFilters ? '调整搜索、分类或收藏条件，或点击「清除筛选」查看全部指标。' : '点击「手动建立指标」，选择真实字段并验证计算结果'}
                />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4 items-start">
                  {filteredMetrics.map(metric => (
                    <MetricCard
                      key={metric.id}
                      metric={metric}
                      sourceTable={metricSource(metric, selectedPackage.sourceTables) || extractTablesFromSql(metric.formula)[0]}
                      onEdit={setEditingMetric}
                      onDelete={id => setPendingDelete({ kind: 'metric', id, name: metric.name })}
                      busy={isAnalyzing || isGeneratingChart}
                      onValidate={handleValidateMetric}
                      onFix={handleFixMetric}
                      onGenerateChart={handleGenerateChart}
                      onViewChart={onNavigateToVisualization}
                      onShowLineage={setLineageModalMetric}
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
              className="flex-wrap [&>div:first-child]:min-w-[260px] [&>div:first-child]:flex-1"
              title="指标库"
              description="管理计算口径，验证真实数据，并用于分析与可视化"
              icon={BarChart2}
              tone="accent"
              badge={
                <span className="shrink-0 whitespace-nowrap rounded-full bg-monokai-surface border border-monokai-border px-2.5 py-0.5 text-[10px] font-mono font-medium text-monokai-fg-muted">
                  {packages.length} 个指标包
                </span>
              }
              actions={
                <div className="flex items-center gap-2 flex-wrap">
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportPackage}
                    className="hidden"
                  />
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={Sparkles}
                    onClick={handleBuildFromTables}
                    disabled={!tables.length || isAnalyzing}
                    title="依据当前数据库的真实字段生成基础指标"
                  >
                    从真实字段生成
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    icon={Upload}
                    onClick={() => fileInputRef.current?.click()}
                    title="导入指标包 JSON 文件"
                  >
                    导入指标包
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setShowCreatePackageModal(true)}
                  >
                    新建指标包
                  </ActionButton>
                </div>
              }
            />

            {/* Filter Search Bar */}
            <div className="p-4 bg-monokai-sidebar/40">
              <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-3">
                <ActionButton variant="secondary" size="sm" aria-expanded={showBuilder} onClick={() => setShowBuilder(value => !value)}>{showBuilder ? '收起建模工具' : '指标建模工具'}</ActionButton>
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
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-monokai-bg">
              {filteredPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-monokai-surface border border-monokai-border flex items-center justify-center mb-4 text-monokai-comment shadow-lg shadow-black/40">
                    <Package className="h-7 w-7 text-monokai-comment" />
                  </div>
                  <h3 className="text-sm font-bold text-monokai-fg mb-1.5 tracking-tight">{packages.length ? '未找到匹配的指标包' : '暂无指标包'}</h3>
                  <p className="text-xs text-monokai-comment max-w-sm mb-6 leading-relaxed">
                    {packages.length ? '请调整搜索条件；已有指标包仍保留。' : '导入真实数据后可从字段生成基础指标，也可以手动创建业务指标包。'}
                  </p>
                  <div className="flex items-center gap-3">
                    {packages.length ? <ActionButton variant="secondary" size="sm" onClick={() => setPackageSearchTerm('')}>清除搜索</ActionButton> : <ActionButton
                      variant="primary"
                      size="md"
                      icon={Sparkles}
                      onClick={handleBuildFromTables}
                    disabled={!tables.length || isAnalyzing}
                    >
                      从真实字段生成
                    </ActionButton>}
                    <ActionButton
                      variant="secondary"
                      size="md"
                      icon={Plus}
                      onClick={() => setShowCreatePackageModal(true)}
                    >
                      新建指标包
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-3.5">
                  {filteredPackages.map(pkg => (
                    <div
                      key={pkg.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPackage(pkg)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPackage(pkg);
                        }
                      }}
                      className="group bg-monokai-sidebar border border-monokai-border rounded-xl p-5 hover:border-monokai-border-strong hover:bg-monokai-surface/60 transition-all cursor-pointer shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
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
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <IconButton
                              label="导出指标包"
                              icon={Download}
                              size="sm"
                              onClick={() => handleExportPackage(pkg)}
                            />
                            <IconButton
                              label="删除指标包"
                              icon={Trash2}
                              size="sm"
                              tone="danger"
                              onClick={() => setPendingDelete({ kind: 'package', id: pkg.id, name: pkg.name })}
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
      <ModalShell
        className="metric-surface"
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.kind === 'package' ? '删除指标包' : '删除指标'}
        size="sm"
        footer={
          <>
            <ActionButton variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              取消
            </ActionButton>
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => {
                if (!pendingDelete) return;
                if (pendingDelete.kind === 'package') handleDeletePackage(pendingDelete.id);
                else handleDeleteMetric(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              确认删除
            </ActionButton>
          </>
        }
      >
        <p className="p-4 text-xs text-monokai-fg leading-relaxed break-words">
          确认删除「<strong className="text-monokai-accent font-semibold">{pendingDelete?.name}</strong>」？
          {pendingDelete?.kind === 'package' ? '包内指标定义将一并移除，建议先导出备份。' : '关联图表也将移除。'}
        </p>
      </ModalShell>
      {/* 1. Template Modal */}
      <MetricTemplateModal

        tables={selectedPackage?.sourceTables || []}
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
        tables={selectedPackage?.sourceTables || []}
        creating={!!editingMetric && !selectedPackage?.metrics.some(m => m.id === editingMetric.id)}
        isOpen={!!editingMetric}
        metric={editingMetric}
        onClose={() => setEditingMetric(null)}
        onSave={handleSaveEditMetric}
      />

      {/* 5. Metric Lineage Modal */}
      {lineageModalMetric && lineageGraph && (
        <ModalShell
          className="metric-surface"
          open={Boolean(lineageModalMetric)}
          onClose={() => setLineageModalMetric(null)}
          title={`指标血缘关系: ${lineageModalMetric.name}`}
          description={`解析自公式「${lineageModalMetric.formula}」与源表「${lineageModalMetric ? metricSource(lineageModalMetric, selectedPackage?.sourceTables || []) : '未绑定'}」`}
          icon={GitBranch}
          size="lg"
          footer={
            <>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setLineageModalMetric(null)}
              >
                关闭
              </ActionButton>
              <ActionButton
                variant="primary"
                size="sm"
                icon={Play}
                onClick={() => {
                  handleExecuteMetricInEditor(lineageModalMetric);
                  setLineageModalMetric(null);
                }}
              >
                在 SQL 编辑器中运行
              </ActionButton>
            </>
          }
        >
          <div className="h-[440px] flex flex-col">
            <LineageGraphView
              graph={lineageGraph}
              embedded={true}
              onClose={() => setLineageModalMetric(null)}
            />
          </div>
        </ModalShell>
      )}

      {/* 6. Metric Create Package Modal */}
      <MetricCreatePackageModal
        isOpen={showCreatePackageModal}
        onClose={() => setShowCreatePackageModal(false)}
        onCreatePackage={handleCreatePackage}
        availableTables={tables}
        existingPackageNames={packages.map(p => p.name)}
      />
    </div>
  );
};

export default MetricManager;
