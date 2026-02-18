import React, { useState, useEffect, useCallback } from 'react';
import { MetricChart, MetricPackage, MetricDefinition } from '../types';
import { metricAnalyzer } from '../services/metricAnalyzer';
import { MetricCard } from './MetricCard';
import { MetricChartListModal } from './MetricChartListModal';
import { 
  Database, Plus, RefreshCw, Trash2, ChevronRight, 
  ChevronDown, Check, Loader2, Package, ArrowLeft, Play,
  BarChart2, Star, Search, Download, Upload
} from 'lucide-react';

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
      <div className="w-80 bg-monokai-sidebar border-r border-monokai-accent flex flex-col">
        <div className="p-4 border-b border-monokai-accent">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Database size={18} className="text-monokai-blue" />
            选择数据表
          </h2>
          <p className="text-xs text-monokai-comment mt-1">
            勾选要分析的表，AI将自动生成指标定义
          </p>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-2">
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
                      ? 'bg-monokai-blue/20 text-white' 
                      : 'hover:bg-monokai-accent/30 text-monokai-fg'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    selectedTables.has(table) 
                      ? 'bg-monokai-blue border-monokai-blue' 
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

        {/* New Package Form */}
        <div className="p-4 border-t border-monokai-accent bg-monokai-bg">
          {showNewForm ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="指标包名称 *"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
              />
              <input
                type="text"
                placeholder="描述（可选）"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-sm text-white focus:border-monokai-blue outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="flex-1 px-3 py-2 border border-monokai-accent text-monokai-comment rounded text-sm hover:bg-monokai-accent/30"
                >
                  取消
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || selectedTables.size === 0}
                  className="flex-1 px-3 py-2 bg-monokai-blue text-monokai-bg font-bold rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      分析中
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      生成指标
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              disabled={selectedTables.size === 0}
              className="w-full px-4 py-2 bg-monokai-green text-monokai-bg font-bold rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              新建指标包
            </button>
          )}
          
          {/* 模板按钮 */}
          <button
            onClick={() => setShowTemplates(true)}
            className="w-full px-4 py-2 bg-monokai-bg border border-monokai-purple text-monokai-purple font-bold rounded text-sm hover:bg-monokai-purple/20 flex items-center justify-center gap-2"
          >
            <Package size={16} />
            使用模板
          </button>
          
          {/* 连接数据源按钮 */}
          <button
            onClick={() => setShowDataSourceModal(true)}
            className="w-full px-4 py-2 bg-monokai-bg border border-monokai-blue text-monokai-blue font-bold rounded text-sm hover:bg-monokai-blue/20 flex items-center justify-center gap-2"
          >
            <Database size={16} />
            连接数据源
          </button>
          
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
                  className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-white"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedPackage.name}</h2>
                  <p className="text-xs text-monokai-comment">
                    {selectedPackage.description || '无描述'} | {selectedPackage.metrics.length} 个指标
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleValidateAll()}
                  disabled={isAnalyzing || !selectedPackage.sourceTables.length}
                  className="px-3 py-1.5 border border-monokai-green text-monokai-green rounded text-sm hover:bg-monokai-green/20 flex items-center gap-2 disabled:opacity-50"
                  title="批量验证所有指标"
                >
                  <Play size={14} />
                  验证全部
                </button>
                <button
                  onClick={() => handleGenerateAllCharts()}
                  disabled={isGeneratingChart || !selectedPackage.sourceTables.length}
                  className="px-3 py-1.5 border border-monokai-purple text-monokai-purple rounded text-sm hover:bg-monokai-purple/20 flex items-center gap-2 disabled:opacity-50"
                  title="批量生成所有指标的图表"
                >
                  <BarChart2 size={14} />
                  {isGeneratingChart ? '生成中...' : '生成全部图表'}
                </button>
                <button
                  onClick={() => setShowChartList(true)}
                  className="px-3 py-1.5 border border-monokai-purple text-monokai-purple rounded text-sm hover:bg-monokai-purple/20 flex items-center gap-2"
                  title="查看已生成的图表"
                >
                  <BarChart2 size={14} />
                  查看图表
                </button>
                <button
                  onClick={() => handleRefresh(selectedPackage)}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 border border-monokai-blue text-monokai-blue rounded text-sm hover:bg-monokai-blue/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  重新分析
                </button>
                <button
                  onClick={() => handleDeletePackage(selectedPackage.id)}
                  className="px-3 py-1.5 border border-monokai-pink text-monokai-pink rounded text-sm hover:bg-monokai-pink/20 flex items-center gap-2"
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
                    className="w-full pl-10 pr-4 py-2 bg-monokai-bg border border-monokai-border rounded text-sm text-white placeholder-monokai-comment focus:outline-none focus:border-monokai-accent"
                  />
                </div>
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    showFavoritesOnly 
                      ? 'bg-monokai-accent text-white' 
                      : 'bg-monokai-bg border border-monokai-border text-monokai-comment hover:text-white'
                  }`}
                >
                  <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  {showFavoritesOnly ? '已收藏' : '收藏'}
                  {favorites.size > 0 && <span className="ml-1 bg-monokai-purple text-white text-xs px-1.5 py-0.5 rounded">{favorites.size}</span>}
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
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package size={18} className="text-monokai-purple" />
                    指标包列表
                  </h2>
                  <p className="text-xs text-monokai-comment mt-1">
                    共 {packages.length} 个指标包
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 px-2 py-1.5 bg-monokai-bg border border-monokai-border rounded text-xs text-monokai-comment hover:text-white cursor-pointer transition-colors">
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
                            <h3 className="font-bold text-white">{pkg.name}</h3>
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
                            className="p-1.5 hover:bg-monokai-accent rounded text-monokai-comment hover:text-white transition-colors"
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
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package size={18} className="text-monokai-purple" />
                选择指标模板
              </h3>
              <button onClick={() => setShowTemplates(false)} className="text-monokai-comment hover:text-white">
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
                        <h4 className="font-bold text-white">{template.name}</h4>
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
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="text-monokai-blue" /> 连接外部数据源
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-monokai-comment mb-1">数据源类型</label>
                <select
                  value={dataSourceType}
                  onChange={(e) => setDataSourceType(e.target.value as any)}
                  className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-white"
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
                  className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-white"
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
                  className="w-full bg-monokai-sidebar border border-monokai-accent p-2 rounded text-white"
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
                className="px-4 py-2 text-monokai-comment hover:text-white"
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
                className="px-4 py-2 bg-monokai-blue text-white font-bold rounded hover:opacity-90"
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
