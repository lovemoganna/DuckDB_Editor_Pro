import React from 'react';
import {
  Database,
  Layers,
  TerminalSquare,
  HardDrive,
  UploadCloud,
  Sparkles,
  Plus,
  Activity,
  Cpu,
} from 'lucide-react';
import { Tab } from '../../types';

interface DashboardHeroTelemetryProps {
  version: string;
  isPersistent: boolean;
  tableCount: number;
  dashboardCount: number;
  widgetCount: number;
  activityCount: number;
  isSeedingDemo: boolean;
  onOpenImport: () => void;
  onNavigateToSql: () => void;
  onLoadDemoDataset: () => void;
  onCreateDashboard: () => void;
  onNavigateToHistory: () => void;
}

export const DashboardHeroTelemetry: React.FC<DashboardHeroTelemetryProps> = ({
  version,
  isPersistent,
  tableCount,
  dashboardCount,
  widgetCount,
  activityCount,
  isSeedingDemo,
  onOpenImport,
  onNavigateToSql,
  onLoadDemoDataset,
  onCreateDashboard,
  onNavigateToHistory,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. TOP TELEMETRY BAR & GLOBAL ACTIONS */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-monokai-border bg-monokai-surface/90 backdrop-blur-md px-4 py-2.5 rounded-md">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-monokai-green animate-pulse" />
            <h1 className="text-xs font-bold uppercase tracking-wider text-monokai-fg">
              DuckDB Studio
            </h1>
          </div>
          <span className="text-monokai-comment font-mono text-xs">/</span>
          <span className="text-xs font-medium text-monokai-fg-muted">
            全景分析驾驶舱 (Analytics Cockpit)
          </span>

          <div className="flex items-center gap-1.5 ml-1">
            <span className="inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated px-2 py-0.5 font-mono text-2xs text-monokai-fg-muted">
              <Cpu className="h-3 w-3 text-monokai-cyan" />
              DuckDB {version}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2 py-0.5 font-mono text-2xs text-monokai-fg-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isPersistent ? 'bg-monokai-green' : 'bg-monokai-yellow'
                }`}
              />
              {isPersistent ? 'OPFS 持久存储' : '内存临时沙盒'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onLoadDemoDataset && (
            <button
              type="button"
              onClick={onLoadDemoDataset}
              disabled={isSeedingDemo}
              className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-2.5 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer disabled:opacity-50"
              title="一键生成电商 6 表关联业务示例"
            >
              <Sparkles className="h-3.5 w-3.5 text-monokai-comment" />
              <span>{isSeedingDemo ? '载入中…' : '载入 Demo 数据集'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenImport}
            className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated px-2.5 text-xs font-medium text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-surface transition-all cursor-pointer"
            title="拖入或选择本地 CSV / Parquet / JSON 文件"
          >
            <UploadCloud className="h-3.5 w-3.5 text-monokai-comment" />
            <span>导入数据</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToSql}
            className="flex h-7 items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 text-xs font-semibold text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated transition-all cursor-pointer shadow-sm"
            title="打开 3 栏式 SQL 即席查询工作台"
          >
            <TerminalSquare className="h-3.5 w-3.5 text-monokai-comment" />
            <span>新建 SQL 查询 →</span>
          </button>
        </div>
      </header>

      {/* 2. DATA ASSET & ENGINE TELEMETRY TICKERS */}
      <section
        aria-label="数据资产指标罗盘"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {/* Metric 1: 数据表资产 */}
        <div className="relative overflow-hidden flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface p-3.5 hover:border-monokai-border-strong transition-colors group">
          <div className="flex items-center justify-between text-monokai-comment">
            <span className="text-meta font-mono uppercase tracking-wider text-monokai-fg-muted flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-monokai-cyan" />
              活跃数据资产
            </span>
            <span className="text-2xs font-mono text-monokai-green">READY</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-monokai-fg tracking-tight">
              {tableCount}
            </span>
            <span className="text-xs font-mono text-monokai-fg-muted">张表</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-meta font-mono text-monokai-comment border-t border-monokai-border/40 pt-1.5">
            <span>引擎形态</span>
            <span className="text-monokai-cyan font-medium">
              {isPersistent ? 'OPFS 存储' : '内存模式'}
            </span>
          </div>
        </div>

        {/* Metric 2: 专题大盘 */}
        <div className="relative overflow-hidden flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface p-3.5 hover:border-monokai-border-strong transition-colors group">
          <div className="flex items-center justify-between text-monokai-comment">
            <span className="text-meta font-mono uppercase tracking-wider text-monokai-fg-muted flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-monokai-orange" />
              专题分析大盘
            </span>
            <button
              type="button"
              onClick={onCreateDashboard}
              className="text-2xs font-mono text-monokai-orange hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> 新建
            </button>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-monokai-fg tracking-tight">
              {dashboardCount}
            </span>
            <span className="text-xs font-mono text-monokai-fg-muted">个看板</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-meta font-mono text-monokai-comment border-t border-monokai-border/40 pt-1.5">
            <span>组件图表总计</span>
            <span className="text-monokai-orange font-medium">{widgetCount} 个</span>
          </div>
        </div>

        {/* Metric 3: 即席查询流水 */}
        <div className="relative overflow-hidden flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface p-3.5 hover:border-monokai-border-strong transition-colors group">
          <div className="flex items-center justify-between text-monokai-comment">
            <span className="text-meta font-mono uppercase tracking-wider text-monokai-fg-muted flex items-center gap-1.5">
              <TerminalSquare className="h-3.5 w-3.5 text-monokai-green" />
              查询执行流水
            </span>
            <span className="text-2xs font-mono text-monokai-green">本地历史记录</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-monokai-fg tracking-tight">
              {activityCount}
            </span>
            <span className="text-xs font-mono text-monokai-fg-muted">条历史 / 收藏</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-meta font-mono text-monokai-comment border-t border-monokai-border/40 pt-1.5">
            <span>快捷定位</span>
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="text-monokai-green hover:underline cursor-pointer"
            >
              历史审计 →
            </button>
          </div>
        </div>

        {/* Metric 4: 极速格式支持 */}
        <div className="relative overflow-hidden flex flex-col justify-between rounded-md border border-monokai-border bg-monokai-surface p-3.5 hover:border-monokai-border-strong transition-colors group">
          <div className="flex items-center justify-between text-monokai-comment">
            <span className="text-meta font-mono uppercase tracking-wider text-monokai-fg-muted flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-monokai-yellow" />
              数据导入能力
            </span>
            <span className="text-2xs font-mono text-monokai-yellow">本地零上传</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-mono text-monokai-fg tracking-tight">
              Parquet · CSV · Arrow
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-meta font-mono text-monokai-comment border-t border-monokai-border/40 pt-1.5">
            <span>多格式支持</span>
            <span className="text-monokai-yellow font-medium">支持拖拽导入</span>
          </div>
        </div>
      </section>
    </div>
  );
};
