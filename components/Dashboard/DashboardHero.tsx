import React, { useMemo } from 'react';
import {
  Play,
  Upload,
  PlusSquare,
  Table,
  BookOpen,
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Layers,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Tab } from '../../types';
import { type DashboardDbMetrics } from '../../hooks/useDashboardWorkflow';

interface DashboardHeroProps {
  onNavigate: (tab: Tab) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshedTime?: string;
  metrics?: DashboardDbMetrics;
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onNavigate,
  onOpenImport,
  onOpenCreate,
  onOpenSettings,
  onRefresh,
  isRefreshing = false,
  lastRefreshedTime,
  metrics,
  runtimeInfo,
}) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  }, []);

  const engineVersion = runtimeInfo?.version ? `v${runtimeInfo.version}` : 'v1.33.1';

  return (
    <div className="relative w-full rounded-2xl bg-monokai-surface border border-monokai-border p-3.5 sm:p-4 overflow-hidden shadow-xl shrink-0">
      {/* Background Subtle Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#3a3b3612_1px,transparent_1px),linear-gradient(to_bottom,#3a3b3612_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Welcome and Buttons */}
        <div className="flex flex-col space-y-3 max-w-3xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-monokai-accent/10 border border-monokai-accent/30 text-monokai-accent shadow-[0_0_12px_rgba(166,226,46,0.25)] shrink-0">
                <Database className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg flex items-center gap-2">
                <span>
                  {greeting}，欢迎使用{' '}
                  <span className="text-monokai-accent font-bold">DuckDB Studio</span>
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pl-9 text-xs text-monokai-comment">
              <p className="font-normal text-monokai-fg-muted text-meta">
                本地高性能分析数据库 · 简单、快速、开放
              </p>
              <span className="text-monokai-border hidden sm:inline">|</span>
              {/* Real Engine & Interactive Status Badges */}
              <div className="flex items-center gap-2 flex-wrap font-mono text-2xs sm:text-meta">
                <span
                  title="当前连接数据库"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-monokai-elevated border border-monokai-border text-monokai-fg-muted shadow-xs"
                >
                  <HardDrive className="w-3 h-3 text-monokai-cyan" />
                  <span>库: {metrics?.isPersistent && metrics?.databaseName === 'memory' ? 'main' : (metrics?.databaseName || 'main')}</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title="点击查看或配置持久化模式"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg-muted transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${metrics?.isPersistent ? 'bg-monokai-accent shadow-[0_0_6px_rgba(166,226,46,0.8)]' : 'bg-monokai-yellow shadow-[0_0_6px_rgba(230,219,116,0.8)]'}`} />
                  <span>{metrics?.modeLabel || '内存数据库'}</span>
                </button>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-monokai-accent/10 border border-monokai-accent/30 text-monokai-accent shadow-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>DuckDB {engineVersion} 就绪</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Primary Action Button: Open SQL */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.SQL)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-accent hover:bg-monokai-accent-hover text-black font-bold text-xs shadow-[0_0_16px_rgba(166,226,46,0.25)] transition-all duration-150 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-fg"
            >
              <Play className="w-3.5 h-3.5 fill-current text-black" />
              <span>打开 SQL 编辑器</span>
              <span className="px-1.5 py-0.5 ml-0.5 text-2xs font-mono bg-black/20 text-black rounded font-semibold border border-black/20">
                Ctrl ↵
              </span>
            </button>

            {/* Secondary: Import Data */}
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
            >
              <Upload className="w-3.5 h-3.5 text-monokai-comment" />
              <span>导入数据</span>
            </button>

            {/* Secondary: Create Table */}
            <button
              type="button"
              onClick={onOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
            >
              <PlusSquare className="w-3.5 h-3.5 text-monokai-comment" />
              <span>新建数据集</span>
            </button>

            {/* Secondary: Browse Data */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.DATA)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
            >
              <Table className="w-3.5 h-3.5 text-monokai-comment" />
              <span>浏览数据</span>
            </button>

            {/* Secondary: Schema Designer */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.STRUCTURE)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-cyan"
            >
              <Layers className="w-3.5 h-3.5 text-monokai-cyan" />
              <span>结构设计</span>
            </button>

            {/* Secondary: Analysis Hub */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.ANALYSIS_HUB)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-green"
            >
              <Activity className="w-3.5 h-3.5 text-monokai-green" />
              <span>分析中心</span>
            </button>

            {/* Secondary: Metrics */}
            <button
              type="button"
              onClick={() => onNavigate(Tab.METRICS)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-amethyst"
            >
              <TrendingUp className="w-3.5 h-3.5 text-monokai-amethyst" />
              <span>指标中心</span>
            </button>

            {/* Secondary: Documentation */}
            <a
              href="https://duckdb.org/docs/"
              target="_blank"
              rel="noreferrer noopener"
              title="在新标签页中打开 DuckDB 官方技术文档"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border text-monokai-fg text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
            >
              <BookOpen className="w-3.5 h-3.5 text-monokai-comment" />
              <span>查看文档</span>
              <ExternalLink className="w-2.5 h-2.5 text-monokai-comment/80" />
            </a>

            {/* Hint: Command Palette */}
            <div className="hidden sm:flex items-center gap-1.5 text-2xs text-monokai-comment font-mono pl-1">
              <span className="px-1.5 py-0.5 rounded bg-monokai-elevated border border-monokai-border text-monokai-fg-muted text-2xs font-semibold shadow-2xs">
                {typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
              </span>
              <span>呼出命令面板</span>
            </div>
          </div>
        </div>

        {/* Right Side: Refresh Button, Quote & Snapshot */}
        <div className="flex flex-col items-start lg:items-end justify-center pt-2 lg:pt-0 border-t lg:border-t-0 border-monokai-border">
          <div className="flex items-center gap-2 mb-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-monokai-elevated hover:bg-monokai-border/40 border border-monokai-border hover:border-monokai-border-strong text-monokai-fg-muted hover:text-monokai-fg text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-monokai-accent"
                title="手动刷新仪表盘数据统计"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-monokai-accent ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-45 transition-transform'}`} />
                <span>{isRefreshing ? '正在刷新…' : '刷新数据'}</span>
              </button>
            )}
            {lastRefreshedTime && (
              <span className="text-2xs font-mono text-monokai-comment">
                同步于 {lastRefreshedTime}
              </span>
            )}
          </div>

          <blockquote className="text-left lg:text-right hidden lg:block border-l-2 lg:border-l-0 lg:border-r-2 border-monokai-accent/60 pl-2.5 lg:pl-0 lg:pr-2.5 py-0.5 bg-monokai-elevated/30 rounded-r lg:rounded-r-none lg:rounded-l">
            <p className="text-meta font-medium text-monokai-fg-muted italic tracking-wide font-sans">
              &ldquo;Fast Analytics for Everyone.&rdquo;
            </p>
            <cite className="not-italic text-2xs text-monokai-comment font-mono mt-0.5 block">
              — DuckDB
            </cite>
          </blockquote>
          {metrics && (
            <div className="mt-1 text-left lg:text-right text-2xs sm:text-meta font-mono text-monokai-comment">
              <span className="text-monokai-comment">已载入表资产：</span>
              <span className="text-monokai-fg font-bold">{metrics.tableCount}</span> 个表 ·{' '}
              <span className="text-monokai-fg font-bold">{metrics.viewCount}</span> 个视图
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
