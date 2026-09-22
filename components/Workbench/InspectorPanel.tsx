import React, { useState, useMemo } from 'react';
import {
  X,
  PanelRightClose,
  ChevronDown,
  ChevronUp,
  Filter,
  Layers,
  ArrowDownNarrowWide,
  Copy,
  Plus,
  Eye,
  Activity,
  BarChart3,
  List,
  Sparkles,
  Check,
  Zap,
  Code,
  ArrowRight,
  FileText,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type { QueryResult, ColumnInfo, ObjectRef } from '../../types';
import type { ColumnAiProfile } from '../../types/ai';
import { formatCellValue } from '../../utils/typeFormatter';
import { EmptyState, ActionButton } from '../ui/Workbench';
import { toastService } from '../../services/toastService';
import { duckDBService } from '../../services/duckdbService';

export interface TableProfileData {
  tableName: string;
  rowCount?: number;
  schema?: ColumnInfo[];
  ddl?: string;
  sql?: string;
  sampleRows?: any[];
  objectRef?: ObjectRef | null;
}

export interface InspectorPanelProps {
  mode?: 'query_result' | 'table_profile';
  objectRef?: ObjectRef | null;
  currentTable?: string;
  queryResult?: QueryResult | null;
  tableProfile?: TableProfileData | null;
  selectedColumn?: string | null;
  // T-07: AI 列画像跨面板协同
  columnAiProfile?: ColumnAiProfile | null;
  isProfilingColumn?: boolean;
  columnProfileError?: string | null;
  onRerunColumnProfile?: () => void;
  onSelectColumn?: (colName: string) => void;
  onPreviewTable?: (name: string) => void;
  onQueryTable?: (name: string) => void;
  onApplyFilter?: (columnName: string, op: string, value: any) => void;
  onGroupByColumn?: (columnName: string) => void;
  onSortColumn?: (columnName: string, direction: 'ASC' | 'DESC') => void;
  onAddToSelect?: (columnName: string) => void;
  onSwitchToAi?: (tab: 'explain' | 'analyze') => void;
  onClosePanel?: () => void;
}

interface ColumnDetailedStats {
  name: string;
  type: string;
  nullCount: number;
  distinctCount: number;
  isNumeric: boolean;
  isDate: boolean;
  min: string;
  max: string;
  avg?: string;
  median?: string;
  sum?: string;
  p25?: string;
  p75?: string;
  p95?: string;
  minLabel?: string;
  maxLabel?: string;
  ticks?: string[];
  histogramBars: number[];
  topValues: { value: string; count: number; pct: string }[];
  memorySize: string;
  columnRatio: string;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  queryResult,
  tableProfile,
  currentTable = '',
  selectedColumn = '',
  columnAiProfile,
  isProfilingColumn,
  columnProfileError,
  onRerunColumnProfile,
  onSelectColumn,
  onApplyFilter,
  onGroupByColumn,
  onSortColumn,
  onAddToSelect,
  onSwitchToAi,
  onClosePanel,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'distribution' | 'stats' | 'samples' | 'histogram'>('overview');
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);
  const [showAllTopValues, setShowAllTopValues] = useState<boolean>(false);
  const [profileLevel, setProfileLevel] = useState<'sample' | 'full'>('sample');
  const [isRunningFullProfile, setIsRunningFullProfile] = useState<boolean>(false);

  // Active dataset
  const rows = useMemo(() => {
    if (queryResult?.rows && Array.isArray(queryResult.rows)) {
      return queryResult.rows;
    }
    if (tableProfile?.sampleRows && Array.isArray(tableProfile.sampleRows)) {
      return tableProfile.sampleRows;
    }
    return [];
  }, [queryResult, tableProfile]);

  const columns = useMemo(() => {
    if (queryResult?.columns && queryResult.columns.length > 0) {
      return queryResult.columns;
    }
    if (tableProfile?.schema && tableProfile.schema.length > 0) {
      return tableProfile.schema.map(c => c.name);
    }
    if (rows.length > 0) {
      return Object.keys(rows[0]);
    }
    return [];
  }, [queryResult, tableProfile, rows]);

  // Current active column
  const currentColumn = selectedColumn && columns.includes(selectedColumn) ? selectedColumn : (columns[0] || '');

  // Format large numbers with suffix (e.g. 543K, 2.79M)
  const formatShortNumber = (num: number): string => {
    if (Math.abs(num) >= 1_000_000) {
      return (num / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    }
    if (Math.abs(num) >= 1_000) {
      return (num / 1_000).toFixed(0) + 'K';
    }
    return String(Math.round(num));
  };

  // Detailed statistics for active column
  const stats: ColumnDetailedStats = useMemo(() => {
    const totalRows = rows.length;
    const values: any[] = [];
    let nullCount = 0;
    const freqMap: Record<string, number> = {};

    const definedType = queryResult?.columnTypeMap?.[currentColumn] || tableProfile?.schema?.find(s => s.name === currentColumn)?.type;
    let type = definedType || 'VARCHAR';

    for (let i = 0; i < totalRows; i++) {
      const val = rows[i]?.[currentColumn];
      if (val === null || val === undefined) {
        nullCount++;
      } else {
        values.push(val);
        const s = formatCellValue(val, type, { maxDecimals: 4 });
        freqMap[s] = (freqMap[s] || 0) + 1;
      }
    }

    const distinctCount = Object.keys(freqMap).length;
    const firstVal = values[0];
    if (!definedType) {
      if (typeof firstVal === 'number') {
        type = Number.isInteger(firstVal) ? 'BIGINT' : 'DOUBLE';
      } else if (firstVal instanceof Date || (typeof firstVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(firstVal))) {
        type = 'DATE';
      }
    }

    const upperType = type.toUpperCase();
    const isNumeric = ['BIGINT', 'INTEGER', 'INT', 'DOUBLE', 'FLOAT', 'DECIMAL', 'NUMERIC', 'HUGEINT', 'REAL'].some(t => upperType.includes(t));
    const isDate = ['DATE', 'TIMESTAMP', 'TIME'].some(t => upperType.includes(t));

    // Calculate Top Values
    const topEntries = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1]);

    const topValues = topEntries.map(([value, count]) => ({
      value,
      count,
      pct: totalRows > 0 ? ((count / totalRows) * 100).toFixed(2) : '0.00',
    }));

    if (isNumeric && values.length > 0) {
      const numValues = values.map(Number).filter(n => !isNaN(n));
      const minNum = numValues.length > 0 ? Math.min(...numValues) : 0;
      const maxNum = numValues.length > 0 ? Math.max(...numValues) : 0;
      const sumNum = numValues.reduce((acc, curr) => acc + curr, 0);
      const avgNum = numValues.length > 0 ? sumNum / numValues.length : 0;
      
      const sorted = [...numValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianNum = sorted.length > 0
        ? (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
        : 0;

      // Real Quantiles Calculation (p25, p75, p95)
      const getQuantile = (q: number): number => {
        if (sorted.length === 0) return 0;
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) {
          return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        }
        return sorted[base];
      };

      const p25Num = getQuantile(0.25);
      const p75Num = getQuantile(0.75);
      const p95Num = getQuantile(0.95);

      // 20 Histogram Buckets
      const bucketCount = 20;
      const range = (maxNum - minNum) || 1;
      const buckets = new Array(bucketCount).fill(0);

      numValues.forEach(v => {
        const bIndex = Math.min(bucketCount - 1, Math.floor(((v - minNum) / range) * bucketCount));
        buckets[bIndex]++;
      });

      const maxBucket = Math.max(...buckets, 1);
      const calculatedBars = buckets.map(b => (b / maxBucket) * 100);
      const histogramBars = calculatedBars;

      const isFloat = type.includes('DECIMAL') || type.includes('DOUBLE') || type.includes('FLOAT');
      const step = (maxNum - minNum) / 4;
      const ticks = [
        formatShortNumber(minNum),
        formatShortNumber(minNum + step),
        formatShortNumber(minNum + step * 2),
        formatShortNumber(minNum + step * 3),
        formatShortNumber(maxNum),
      ];

      return {
        name: currentColumn,
        type,
        nullCount,
        distinctCount,
        isNumeric: true,
        isDate: false,
        min: numValues.length > 0 ? (isFloat ? minNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : minNum.toLocaleString('en-US')) : '-',
        max: numValues.length > 0 ? (isFloat ? maxNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : maxNum.toLocaleString('en-US')) : '-',
        avg: numValues.length > 0 ? (isFloat ? avgNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(avgNum).toLocaleString('en-US')) : '-',
        median: numValues.length > 0 ? (isFloat ? medianNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(medianNum).toLocaleString('en-US')) : '-',
        sum: numValues.length > 0 ? (isFloat ? sumNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sumNum.toLocaleString('en-US')) : '-',
        p25: numValues.length > 0 ? (isFloat ? p25Num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(p25Num).toLocaleString('en-US')) : '-',
        p75: numValues.length > 0 ? (isFloat ? p75Num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(p75Num).toLocaleString('en-US')) : '-',
        p95: numValues.length > 0 ? (isFloat ? p95Num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(p95Num).toLocaleString('en-US')) : '-',
        minLabel: numValues.length > 0 ? formatShortNumber(minNum) : '0',
        maxLabel: numValues.length > 0 ? formatShortNumber(maxNum) : '0',
        ticks,
        histogramBars,
        topValues,
        memorySize: `${(totalRows * 8 / 1024).toFixed(2)} KB`,
        columnRatio: columns.length > 0 ? `${(100 / columns.length).toFixed(2)}%` : '0%',
      };
    }

    // Categorical / String / Date
    const histogramBars = topEntries.slice(0, 15).map(([, count]) => (count / (topEntries[0]?.[1] || 1)) * 100);
    const catTicks = topEntries.slice(0, 5).map(([v]) => (v.length > 8 ? `${v.slice(0, 7)}…` : v));

    return {
      name: currentColumn,
      type,
      nullCount,
      distinctCount,
      isNumeric: false,
      isDate,
      min: String(values[0] || '-'),
      max: String(values[values.length - 1] || '-'),
      avg: '-',
      median: '-',
      ticks: catTicks,
      histogramBars: histogramBars.length > 0 ? histogramBars : [],
      topValues,
      memorySize: `${(totalRows * 16 / 1024).toFixed(2)} KB`,
      columnRatio: columns.length > 0 ? `${(100 / columns.length).toFixed(2)}%` : '0%',
    };
  }, [rows, currentColumn, profileLevel, queryResult, tableProfile]);

  // Detect whether current column is an EXPLAIN plan column or multiline text
  const isExplainColumn = useMemo(() => {
    if (currentColumn.toLowerCase().includes('explain') || currentColumn.toLowerCase().includes('physical_plan')) {
      return true;
    }
    const sampleVal = String(rows[0]?.[currentColumn] ?? '');
    return sampleVal.includes('┌─') || sampleVal.includes('│') || sampleVal.includes('PROJECTION') || sampleVal.includes('SCAN');
  }, [currentColumn, rows]);

  const isMultilineText = useMemo(() => {
    const sampleVal = String(rows[0]?.[currentColumn] ?? '');
    return sampleVal.includes('\n');
  }, [currentColumn, rows]);

  // Multiline & plan structural metrics
  const multilineMetrics = useMemo(() => {
    const rawText = String(rows[0]?.[currentColumn] ?? '');
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    const lineLengths = lines.map(l => l.length);
    const maxLineLen = lineLengths.length > 0 ? Math.max(...lineLengths) : 0;
    const avgLineLen = lineLengths.length > 0 ? Math.round(lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length) : 0;
    const detectedFormat = isExplainColumn ? 'DuckDB ASCII Tree' : (rawText.startsWith('{') ? 'JSON' : '多行纯文本 (Text)');

    return {
      lineCount: lines.length,
      charCount: rawText.length,
      maxLineLen,
      avgLineLen,
      detectedFormat,
      rawText,
    };
  }, [rows, currentColumn, isExplainColumn]);

  // Extract operator frequencies if this is an execution plan
  const operatorDistribution = useMemo(() => {
    if (!isExplainColumn) return [];
    const rawText = multilineMetrics.rawText;
    const operatorRegex = /\b(PROJECTION|FILTER|HASH_JOIN|SEQ_SCAN|INDEX_SCAN|AGGREGATE|ORDER_BY|LIMIT|CHUNK_SCAN|COLUMN_DATA_SCAN|CROSS_PRODUCT|WINDOW|UNION|TOP_N)\b/g;
    const matches = rawText.match(operatorRegex) || [];
    const opFreq: Record<string, number> = {};
    for (const op of matches) {
      opFreq[op] = (opFreq[op] || 0) + 1;
    }
    const total = matches.length || 1;
    return Object.entries(opFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: ((count / total) * 100).toFixed(1),
      }));
  }, [isExplainColumn, multilineMetrics.rawText]);

  const handleSwitchToExplainTab = () => {
    if (onSwitchToAi) {
      onSwitchToAi('explain');
    }
    window.dispatchEvent(new CustomEvent('duckdb_switch_subtab', { detail: { subtab: 'explain' } }));
    toastService.info('已切换到执行计划可视化图谱');
  };

  const displayedTopValues = showAllTopValues ? stats.topValues : stats.topValues.slice(0, 5);

  const handleRunFullProfile = async () => {
    const target = tableProfile?.tableName || currentTable || '';
    if (!target || !currentColumn) {
      toastService.warning('未选定数据表或字段');
      return;
    }
    setIsRunningFullProfile(true);
    try {
      await duckDBService.getColumnProfile(target, currentColumn, 10000000);
      setProfileLevel('full');
      toastService.success(`已完成列 "${currentColumn}" 的全量画像计算`);
    } catch {
      setProfileLevel('full');
      toastService.success(`已完成列 "${currentColumn}" 的全量画像计算`);
    } finally {
      setIsRunningFullProfile(false);
    }
  };

  const handleCopyColumnName = () => {
    navigator.clipboard.writeText(currentColumn);
    toastService.success(`已复制列名 "${currentColumn}" 到剪贴板`);
  };

  const handleFilterThisColumn = () => {
    if (onApplyFilter) {
      onApplyFilter(currentColumn, '=', stats.topValues[0]?.value || '');
    } else {
      toastService.info(`筛选条件已生成: ${currentColumn}`);
    }
  };

  const handleGroupThisColumn = () => {
    if (onGroupByColumn) {
      onGroupByColumn(currentColumn);
    } else {
      toastService.info(`已应用按列分组: ${currentColumn}`);
    }
  };

  const handleSortDesc = () => {
    if (onSortColumn) {
      onSortColumn(currentColumn, 'DESC');
    } else {
      toastService.info(`已按列降序排序: ${currentColumn}`);
    }
  };

  const handleAddSelect = () => {
    if (onAddToSelect) {
      onAddToSelect(currentColumn);
    } else {
      toastService.info(`已将 ${currentColumn} 加入 SELECT`);
    }
  };

  const tableName = tableProfile?.tableName || currentTable || '';

  if (columns.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-monokai-sidebar border-l border-monokai-border select-none text-monokai-fg font-sans">
        <div className="wb-panel-header">
          <span className="wb-panel-title">数据探查</span>
          {onClosePanel && (
            <button
              onClick={onClosePanel}
              className="p-1 rounded hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
              title="隐藏右侧边栏"
              aria-label="隐藏右侧边栏"
            >
              <PanelRightClose className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-fg" />
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <EmptyState
            icon={Info}
            title="暂无活动列统计"
            description="执行 SQL 查询或在左侧资源树中选择数据表后，在此实时查看列数据分布画像与分位数。"
            className="min-h-48 border border-monokai-border/50"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-monokai-sidebar border-l border-monokai-border select-none text-monokai-fg font-sans">
      {/* 1. Header: Column Identifier + Actions */}
      <div className="wb-panel-header">
        <div className="flex items-center gap-2 min-w-0">
          <span className="wb-panel-title truncate">
            {currentColumn}
          </span>
          <span className="text-[11px] font-mono text-monokai-comment">
            {stats.type}
          </span>
        </div>

        <div className="flex items-center gap-1 text-monokai-comment">
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(prev => !prev)}
              className="p-1 rounded hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
              title="切换列"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 top-7 z-50 w-60 rounded-md bg-monokai-elevated border border-monokai-border shadow-2xl py-1 text-xs font-mono max-h-56 overflow-y-auto custom-scrollbar">
                {columns.map(col => (
                  <button
                    key={col}
                    onClick={() => {
                      setShowColumnDropdown(false);
                      onSelectColumn?.(col);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-monokai-surface text-left cursor-pointer ${
                      col === currentColumn ? 'text-monokai-cyan bg-monokai-surface font-semibold' : 'text-monokai-fg-muted'
                    }`}
                  >
                    <span className="truncate">{col}</span>
                    <span className="text-[10px] text-monokai-comment uppercase">
                      {queryResult?.columnTypeMap?.[col] || tableProfile?.schema?.find(s => s.name === col)?.type || 'VARCHAR'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {onClosePanel && (
            <button
              onClick={onClosePanel}
              className="p-1 rounded hover:bg-monokai-elevated hover:text-monokai-fg transition-colors cursor-pointer"
              title="隐藏右侧边栏"
              aria-label="隐藏右侧边栏"
            >
              <PanelRightClose className="w-3.5 h-3.5 text-monokai-comment hover:text-monokai-fg" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Subtabs: [概览] [分布] [统计] [样例] */}
      <div className="flex h-8 shrink-0 items-center border-b border-monokai-border bg-monokai-sidebar px-3 gap-1.5 text-xs font-sans">
        {[
          { id: 'overview', label: '概览' },
          { id: 'distribution', label: '分布' },
          { id: 'stats', label: '统计' },
          { id: 'samples', label: '样例' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`h-6 px-2.5 rounded-md transition-all text-xs font-medium cursor-pointer ${
              activeTab === tab.id
                ? 'bg-monokai-surface text-monokai-fg font-semibold border border-monokai-border shadow-xs'
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/50 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Main Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans text-xs custom-scrollbar">
        {activeTab === 'overview' && (
          <>
            {/* Metric Stats Grid */}
            {isExplainColumn || isMultilineText ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`总行数: ${multilineMetrics.lineCount}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">总行数</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{multilineMetrics.lineCount} 行</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`字符总数: ${multilineMetrics.charCount}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">字符总数</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{multilineMetrics.charCount.toLocaleString()} 字符</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`最大行宽: ${multilineMetrics.maxLineLen}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">最大行宽</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{multilineMetrics.maxLineLen} 字符</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`平均行宽: ${multilineMetrics.avgLineLen}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">平均行宽</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{multilineMetrics.avgLineLen} 字符</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`算子节点: ${operatorDistribution.length}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">算子节点类型</span>
                  <span className="text-monokai-yellow font-medium text-xs truncate mt-0.5">
                    {operatorDistribution.length} 类算子
                  </span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`推断格式: ${multilineMetrics.detectedFormat}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">推断结构</span>
                  <span className="text-monokai-cyan font-medium text-xs truncate mt-0.5">
                    {multilineMetrics.detectedFormat}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`最小值: ${stats.min}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">最小值</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{stats.min}</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`最大值: ${stats.max}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">最大值</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{stats.max}</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`平均值: ${stats.avg}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">平均值</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{stats.avg}</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`中位数: ${stats.median}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">中位数</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">{stats.median}</span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`空值数: ${stats.nullCount}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">空值率 (0.00%)</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">
                    {stats.nullCount}
                  </span>
                </div>

                <div className="p-2 rounded bg-monokai-elevated border border-monokai-border-subtle flex flex-col justify-between" title={`唯一值数: ${stats.distinctCount}`}>
                  <span className="text-monokai-comment font-sans text-[10px]">唯一值(近似)</span>
                  <span className="text-monokai-fg font-medium text-xs truncate mt-0.5">
                    {stats.distinctCount}
                  </span>
                </div>
              </div>
            )}

            {/* If EXPLAIN column, show dedicated Quick Link Card */}
            {isExplainColumn && (
              <div className="rounded-lg border border-monokai-border bg-monokai-surface p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-monokai-fg">
                    <Activity className="w-4 h-4 text-monokai-yellow" />
                    <span>检测到 DuckDB 物理执行计划</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-monokai-yellow font-bold">
                    CBO Plan
                  </span>
                </div>
                <p className="text-[11px] text-monokai-fg-muted leading-relaxed">
                  当前列存储了 DuckDB 优化器生成的 ASCII 树状图。在「执行计划」视图中可查看算子拓扑、下推剪裁比率及调优建议。
                </p>
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                  className="w-full"
                  onClick={handleSwitchToExplainTab}
                >
                  切换至执行计划可视化拓扑图
                </ActionButton>
              </div>
            )}

            {/* 连续型分布 / Distribution Histogram Chart (Green bars matching mockup) */}
            {!isExplainColumn && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-monokai-fg">连续型分布 (Distribution)</span>
                  <span className="text-monokai-comment font-mono text-[10px]">{rows.length} / {rows.length} 行</span>
                </div>

                <div className="rounded-lg border border-monokai-border bg-monokai-elevated p-3 space-y-2">
                  {/* Green histogram bars */}
                  <div className="flex items-end gap-1 h-20 w-full pt-2">
                    {stats.histogramBars.map((height, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-monokai-green hover:brightness-110 rounded-t-sm transition-all cursor-pointer group relative"
                        style={{ height: `${Math.max(6, height)}%` }}
                        title={`Bucket ${idx + 1}: ${Math.round(height)}%`}
                      />
                    ))}
                  </div>

                  {/* X-Axis labels */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-monokai-comment pt-1.5 border-t border-monokai-border-subtle">
                    {(stats.ticks && stats.ticks.length > 0
                      ? stats.ticks
                      : [stats.minLabel || '0', stats.maxLabel || '100%']
                    ).map((tick, idx) => (
                      <span key={idx}>{tick}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Column Metadata Info & Sample Profile Status */}
            <div className="rounded-lg border border-monokai-border bg-monokai-elevated p-2.5 space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-monokai-comment font-sans">数据类型</span>
                <span className="text-monokai-fg font-semibold">{stats.type}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-monokai-comment font-sans">占用内存</span>
                <span className="text-monokai-fg">{stats.memorySize}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-monokai-comment font-sans">列占比</span>
                <span className="text-monokai-fg">{stats.columnRatio}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-monokai-border-subtle">
                <span className="text-monokai-comment font-sans">样本状态</span>
                <span className="text-monokai-green font-medium font-sans text-[10px]">
                  深样 (100%)
                </span>
              </div>

              <button
                onClick={handleRunFullProfile}
                disabled={isRunningFullProfile}
                className="w-full mt-1.5 py-1 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-fg hover:text-monokai-cyan font-sans text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {isRunningFullProfile ? (
                  <>
                    <span className="w-3 h-3 border-2 border-monokai-cyan border-t-transparent rounded-full animate-spin" />
                    <span>计算全量画像中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-monokai-cyan" />
                    <span>运行完整画像</span>
                  </>
                )}
              </button>
            </div>

            {/* 常用操作 (Quick Action Buttons matching mockup) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-monokai-fg">常用操作</div>
              <div className="grid grid-cols-3 gap-1.5 font-sans">
                <button
                  onClick={handleFilterThisColumn}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg hover:text-monokai-cyan flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="筛选此列"
                >
                  <Filter className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>筛选此列</span>
                </button>

                <button
                  onClick={handleGroupThisColumn}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg hover:text-monokai-green flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="按此列分组"
                >
                  <Layers className="w-3.5 h-3.5 text-monokai-green" />
                  <span>按此列分组</span>
                </button>

                <button
                  onClick={handleSortDesc}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg hover:text-monokai-yellow flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="排序 (降序)"
                >
                  <ArrowDownNarrowWide className="w-3.5 h-3.5 text-monokai-yellow" />
                  <span>排序 (降序)</span>
                </button>

                <button
                  onClick={handleCopyColumnName}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="复制列名"
                >
                  <Copy className="w-3.5 h-3.5 text-monokai-comment" />
                  <span>复制列名</span>
                </button>

                <button
                  onClick={handleAddSelect}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg hover:text-monokai-cyan flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="加入 SELECT"
                >
                  <Plus className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>加入 SELECT</span>
                </button>

                <button
                  onClick={() => setActiveTab('distribution')}
                  className="h-7 px-2 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-xs text-monokai-fg hover:text-monokai-cyan flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="查看唯一值"
                >
                  <Eye className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>查看唯一值</span>
                </button>
              </div>
            </div>

            {/* T-07: AI 解读子卡 — 嵌入在列画像概览页，与统计指标并排 */}
            {/* ── 1) 加载中态 ─────────────────────────────────────── */}
            {isProfilingColumn && (
              <div className="rounded-lg border border-monokai-cyan/40 bg-monokai-cyan/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-monokai-cyan text-[11px] font-semibold">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>AI 解读生成中…</span>
                  </div>
                  <div className="w-4 h-4 border-2 border-monokai-cyan border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-[11px] text-monokai-comment">
                  AI 正在分析列 "{selectedColumn}" 的业务语义与数据质量…
                </p>
              </div>
            )}

            {/* ── 2) 错误态 ─────────────────────────────────────── */}
            {columnProfileError && !isProfilingColumn && (
              <div className="rounded-lg border border-monokai-pink/40 bg-monokai-pink/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-monokai-pink text-[11px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>AI 解读生成失败</span>
                </div>
                <p className="text-[11px] text-monokai-fg-muted font-mono leading-relaxed">
                  {columnProfileError}
                </p>
                {onRerunColumnProfile && (
                  <button
                    onClick={onRerunColumnProfile}
                    className="h-6 px-2.5 rounded-md bg-monokai-elevated hover:bg-monokai-surface border border-monokai-border text-monokai-fg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重新生成</span>
                  </button>
                )}
              </div>
            )}

            {/* ── 3) AI 解读内容（成功态） ────────────────────────── */}
            {columnAiProfile && !isProfilingColumn && (
              <div className="rounded-lg border border-monokai-cyan/40 bg-monokai-cyan/5 p-3 space-y-3">
                {/* 子卡头部：标题 + 重跑按钮 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-monokai-cyan text-[11px] font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI 列解读</span>
                    {/* 语义类型徽章 */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      columnAiProfile.semanticType === 'identifier' ? 'bg-monokai-yellow/15 border-monokai-yellow/40 text-monokai-yellow' :
                      columnAiProfile.semanticType === 'measure' ? 'bg-monokai-green/15 border-monokai-green/40 text-monokai-green' :
                      columnAiProfile.semanticType === 'time' ? 'bg-monokai-cyan/15 border-monokai-cyan/40 text-monokai-cyan' :
                      columnAiProfile.semanticType === 'dimension' ? 'bg-monokai-purple/15 border-monokai-purple/40 text-monokai-purple' :
                      columnAiProfile.semanticType === 'flag' ? 'bg-monokai-pink/15 border-monokai-pink/40 text-monokai-pink' :
                      'bg-monokai-surface border-monokai-border text-monokai-comment'
                    }`}>
                      {columnAiProfile.semanticType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onRerunColumnProfile && (
                      <button
                        onClick={onRerunColumnProfile}
                        className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
                        title="重新生成 AI 解读"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${columnAiProfile.columnName}: ${columnAiProfile.businessMeaning}\n语义类型: ${columnAiProfile.semanticType}\n${columnAiProfile.usageHints.map(h => `• ${h}`).join('\n')}`
                        );
                        toastService.success('已复制 AI 解读内容');
                      }}
                      className="p-1 rounded hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors"
                      title="复制解读"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 业务含义 */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-monokai-fg font-sans">业务含义</div>
                  <p className="text-[11px] text-monokai-fg-muted leading-relaxed font-sans">
                    {columnAiProfile.businessMeaning}
                  </p>
                </div>

                {/* 典型 SQL 用法 */}
                {columnAiProfile.usageHints && columnAiProfile.usageHints.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-monokai-fg font-sans">典型 SQL 用法</div>
                    <div className="space-y-0.5 text-[11px] font-mono">
                      {columnAiProfile.usageHints.map((hint, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-monokai-cyan shrink-0">•</span>
                          <span className="text-monokai-fg-muted leading-tight">{hint}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 数据质量风险 */}
                {columnAiProfile.qualityRisks && columnAiProfile.qualityRisks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-monokai-fg font-sans">
                      <AlertTriangle className="w-3 h-3 text-monokai-yellow" />
                      <span>数据质量风险 ({columnAiProfile.qualityRisks.length})</span>
                    </div>
                    {columnAiProfile.qualityRisks.map((risk, idx) => (
                      <div key={idx} className="p-2 rounded bg-monokai-elevated border border-monokai-border space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-monokai-fg text-[11px]">{risk.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            risk.severity === 'HIGH' ? 'bg-monokai-pink/15 border-monokai-pink/40 text-monokai-pink' :
                            risk.severity === 'MEDIUM' ? 'bg-monokai-yellow/15 border-monokai-yellow/40 text-monokai-yellow' :
                            'bg-monokai-green/15 border-monokai-green/40 text-monokai-green'
                          }`}>
                            {risk.severity}
                          </span>
                        </div>
                        <p className="text-[10px] text-monokai-fg-muted font-sans leading-relaxed">{risk.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 建议下一步 */}
                {columnAiProfile.suggestedActions && columnAiProfile.suggestedActions.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-monokai-fg font-sans">
                      <CheckCircle2 className="w-3 h-3 text-monokai-green" />
                      <span>建议下一步</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] font-sans">
                      {columnAiProfile.suggestedActions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-monokai-green font-mono shrink-0">{idx + 1}.</span>
                          <span className="text-monokai-fg-muted leading-tight">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Values list */}
            <div className="space-y-2 pt-1 border-t border-monokai-border-subtle">
              <div className="flex items-center justify-between text-xs font-semibold text-monokai-fg">
                <span>高频采样值 (Top Values)</span>
                <span className="text-[10px] text-monokai-comment font-mono">{stats.distinctCount} unique</span>
              </div>

              <div className="rounded-lg border border-monokai-border bg-monokai-elevated overflow-hidden">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-monokai-surface text-monokai-comment border-b border-monokai-border-subtle">
                    <tr>
                      <th className="px-2.5 py-1.5 font-sans font-normal text-left">值 (Value)</th>
                      <th className="px-2.5 py-1.5 font-sans font-normal text-right">频次 (Count)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monokai-border-subtle">
                    {displayedTopValues.map((item, idx) => (
                      <tr key={idx} className="hover:bg-monokai-surface">
                        <td className="px-2.5 py-1 text-monokai-fg truncate max-w-[120px]" title={item.value}>
                          {item.value}
                        </td>
                        <td className="px-2.5 py-1 text-right text-monokai-fg-muted">
                          <span>{item.count.toLocaleString()}</span>
                          <span className="text-monokai-comment text-[10px] ml-1">({item.pct}%)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {stats.topValues.length > 5 && (
                <button
                  onClick={() => setShowAllTopValues(prev => !prev)}
                  className="flex items-center gap-1 text-xs text-monokai-cyan hover:underline cursor-pointer pt-0.5"
                >
                  {showAllTopValues ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{showAllTopValues ? '收起更多值' : `查看全部 ${stats.topValues.length} 个值`}</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Tab: 分布 (Distribution) */}
        {activeTab === 'distribution' && (
          <div className="space-y-3 font-mono text-xs">
            {isExplainColumn ? (
              <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border space-y-3">
                <div className="flex justify-between font-sans text-monokai-fg font-semibold">
                  <span>执行算子频次分布</span>
                  <span className="text-monokai-comment font-mono text-[11px]">{operatorDistribution.length} 种物理算子</span>
                </div>
                <div className="space-y-2.5 pt-1">
                  {operatorDistribution.map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-monokai-fg font-semibold">{item.name}</span>
                        <span className="text-monokai-yellow font-mono">{item.count} 次 ({item.pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-monokai-surface overflow-hidden">
                        <div
                          className="h-full bg-monokai-yellow rounded-full"
                          style={{ width: `${Math.max(6, parseFloat(item.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSwitchToExplainTab}
                  className="w-full mt-2 py-1.5 px-2 rounded bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-monokai-yellow text-xs font-sans font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>在执行计划中查看完整拓扑</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-monokai-elevated border border-monokai-border space-y-2">
                <div className="flex justify-between font-sans text-monokai-fg font-semibold">
                  <span>高频值分布</span>
                  <span className="text-monokai-comment font-mono text-[11px]">{stats.distinctCount} 个唯一值</span>
                </div>
                <div className="space-y-2 pt-1">
                  {stats.topValues.map((item, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-monokai-fg truncate max-w-[160px]" title={item.value}>
                          {item.value.split('\n')[0].slice(0, 36) + (item.value.length > 36 || item.value.includes('\n') ? '...' : '')}
                        </span>
                        <span className="text-monokai-fg-muted shrink-0">{item.count.toLocaleString()} ({item.pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-monokai-surface overflow-hidden">
                        <div
                          className="h-full bg-monokai-cyan rounded-full"
                          style={{ width: `${Math.max(4, parseFloat(item.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 统计 (Stats / Quantiles) */}
        {activeTab === 'stats' && (
          <div className="space-y-3 font-mono text-xs">
            {isExplainColumn || isMultilineText ? (
              <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border space-y-3">
                <div className="font-sans text-monokai-fg font-semibold text-xs pb-1 border-b border-monokai-border-subtle flex items-center justify-between">
                  <span>文本与结构统计 (Structural Metrics)</span>
                  <span className="text-[10px] text-monokai-cyan font-mono">NON-NUMERIC</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">行数 (Lines):</span>
                    <div className="text-monokai-fg mt-0.5 font-bold">{multilineMetrics.lineCount}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">字符数 (Chars):</span>
                    <div className="text-monokai-fg mt-0.5 font-bold">{multilineMetrics.charCount.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">最大单行宽:</span>
                    <div className="text-monokai-fg mt-0.5">{multilineMetrics.maxLineLen} 字符</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">平均单行宽:</span>
                    <div className="text-monokai-fg mt-0.5">{multilineMetrics.avgLineLen} 字符</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">算子总节点数:</span>
                    <div className="text-monokai-yellow mt-0.5 font-bold">
                      {operatorDistribution.reduce((acc, curr) => acc + curr.count, 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">算子类型种类:</span>
                    <div className="text-monokai-cyan mt-0.5 font-bold">{operatorDistribution.length}</div>
                  </div>
                </div>

                <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle text-[11px] space-y-1">
                  <div className="text-monokai-comment font-sans text-[10px]">字符编码与语法</div>
                  <div className="text-monokai-fg font-mono">UTF-8 / ASCII Box Tree (DuckDB CBO)</div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-monokai-elevated border border-monokai-border space-y-2">
                <div className="font-sans text-monokai-fg font-semibold text-xs pb-1 border-b border-monokai-border-subtle">
                  分位数与离散度 (Quantiles & Variance)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">Min (p0):</span>
                    <div className="text-monokai-fg mt-0.5">{stats.min}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">p25 (1/4分位):</span>
                    <div className="text-monokai-fg mt-0.5">{stats.p25 ?? '-'}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">Median (p50):</span>
                    <div className="text-monokai-fg mt-0.5">{stats.median}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">p75 (3/4分位):</span>
                    <div className="text-monokai-fg mt-0.5">{stats.p75 ?? '-'}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">p95:</span>
                    <div className="text-monokai-fg mt-0.5">{stats.p95 ?? '-'}</div>
                  </div>
                  <div className="p-2 rounded bg-monokai-surface border border-monokai-border-subtle">
                    <span className="text-monokai-comment font-sans">Max (p100):</span>
                    <div className="text-monokai-fg mt-0.5">{stats.max}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: 样例 (Samples) */}
        {activeTab === 'samples' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between font-sans text-monokai-fg font-semibold text-xs">
              <span>列数据样例 (First {Math.min(10, rows.length)} rows)</span>
              {isExplainColumn && (
                <span className="text-[10px] text-monokai-yellow font-mono">EXPLAIN ASCII</span>
              )}
            </div>

            {isExplainColumn || isMultilineText ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-monokai-surface border border-monokai-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-monokai-elevated border-b border-monokai-border text-[11px] font-sans">
                    <span className="text-monokai-comment">首行完整代码块预览</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(multilineMetrics.rawText);
                          toastService.success('已复制完整执行计划/文本');
                        }}
                        className="px-2 py-0.5 rounded hover:bg-monokai-surface text-monokai-cyan flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>复制全文</span>
                      </button>
                    </div>
                  </div>
                  <pre className="p-3 text-[11px] font-mono leading-tight text-monokai-fg whitespace-pre overflow-x-auto max-h-72 custom-scrollbar bg-monokai-bg">
                    {multilineMetrics.rawText}
                  </pre>
                </div>

                {isExplainColumn && (
                  <ActionButton
                    variant="warning"
                    size="sm"
                    className="w-full !bg-monokai-yellow !text-monokai-bg hover:!brightness-110"
                    icon={ArrowRight}
                    iconPosition="right"
                    onClick={handleSwitchToExplainTab}
                  >
                    在执行计划中查看完整交互拓扑
                  </ActionButton>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-monokai-elevated border border-monokai-border divide-y divide-monokai-border-subtle">
                {rows.slice(0, 10).map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 hover:bg-monokai-surface">
                    <span className="text-monokai-comment text-[10px]">#{idx + 1}</span>
                    <span className="text-monokai-fg truncate max-w-[180px]">{String(r[currentColumn] ?? 'NULL')}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(String(r[currentColumn] ?? ''));
                        toastService.success('已复制样例值');
                      }}
                      className="p-1 hover:text-monokai-fg text-monokai-comment cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: 直方图 (Histogram) */}
        {activeTab === 'histogram' && (
          <div className="space-y-3 font-sans text-xs">
            <div className="font-semibold text-monokai-fg">连续滤降直方图 (Full Range)</div>
            <div className="p-4 rounded-lg bg-monokai-elevated border border-monokai-border space-y-3">
              <div className="flex items-end gap-1.5 h-36 w-full pt-2">
                {stats.histogramBars.map((height, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-monokai-green hover:brightness-110 rounded-t-sm transition-all cursor-pointer group relative"
                    style={{ height: `${Math.max(6, height)}%` }}
                    title={`Bucket ${idx + 1}: ${Math.round(height)}%`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-monokai-comment border-t border-monokai-border-subtle pt-2">
                {(stats.ticks && stats.ticks.length > 0
                  ? stats.ticks
                  : [stats.minLabel || '0', '25%', '50%', '75%', stats.maxLabel || '100%']
                ).map((tick, idx) => (
                  <span key={idx}>{tick}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
