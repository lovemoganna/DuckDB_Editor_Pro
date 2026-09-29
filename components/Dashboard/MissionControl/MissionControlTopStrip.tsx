import React, { useMemo } from 'react';
import {
  Database,
  Cpu,
  RotateCcw,
  Play,
  Sparkles,
  HardDrive,
  AlertTriangle,
  Flame,
  Wand2,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { HeroDeepSpaceIllustration } from './DashboardSvgIllustrations';

export interface MissionControlTopStripProps {
  metrics?: DashboardDbMetrics;
  tables?: TableItemDetail[];
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
  onNavigate: (tab: Tab) => void;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenAiChat?: () => void;
  onFilterErrorQueries?: () => void;
  onFilterSlowQueries?: () => void;
  onSelectTableStructure?: (tableName: string, focusTab?: 'profile' | 'add' | 'ddl') => void;
  onShrinkMemory?: () => void;
  onOpenImport?: () => void;
  onToggleLayoutMode?: () => void;
}

export const MissionControlTopStrip: React.FC<MissionControlTopStripProps> = ({
  metrics,
  tables = [],
  runtimeInfo,
  onNavigate,
  onSelectQuery,
  onRefresh,
  isRefreshing = false,
  onOpenAiChat,
  onFilterErrorQueries,
  onFilterSlowQueries,
  onSelectTableStructure,
  onShrinkMemory,
  onOpenImport,
  onToggleLayoutMode,
}) => {
  const sqlTabs = useSqlEditorStore((s) => s.tabs);
  const activeTabId = useSqlEditorStore((s) => s.activeTabId);
  const createSqlTab = useSqlEditorStore((s) => s.createTab);

  const activeSqlTab = useMemo(() => {
    return sqlTabs.find((t) => t.id === activeTabId) || sqlTabs[0] || null;
  }, [sqlTabs, activeTabId]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  }, []);

  const engineVersion = runtimeInfo?.version ? `v${runtimeInfo.version}` : 'v1.33.1';
  const isPersistent = Boolean(runtimeInfo?.persistent ?? metrics?.isPersistent);
  const dbName = metrics?.databaseName && metrics.databaseName !== 'memory' ? metrics.databaseName : 'duckdb_managed';

  const handleResumeWork = () => {
    if (activeSqlTab?.code?.trim()) {
      onNavigate(Tab.SQL);
      return;
    }
    createSqlTab();
    onNavigate(Tab.SQL);
  };

  const primaryCtaLabel = activeSqlTab?.code?.trim() ? '继续编辑' : '新建查询';
  const primaryCtaTitle = activeSqlTab?.code?.trim()
    ? `回到 SQL 工作台继续编辑「${activeSqlTab.title || '未命名'}」`
    : '新建空白 SQL 工作表';

  const handleToggleCopilot = () => {
    if (onOpenAiChat) {
      onOpenAiChat();
    } else {
      useCopilotStore.getState().setIsOpen(true);
    }
  };

  // 快捷 AI 探查生成
  const handleQuickAiPrompt = (promptType: 'quality' | 'slow' | 'overview') => {
    if (promptType === 'quality' && tables.length > 0) {
      onSelectTableStructure?.(tables[0].name, 'profile');
      return;
    }
    if (promptType === 'slow') {
      if (onFilterSlowQueries) {
        onFilterSlowQueries();
      } else {
        onNavigate(Tab.SQL);
      }
      return;
    }
    if (promptType === 'overview' && tables.length > 0) {
      const summarySql = `SELECT count(*) AS total_rows FROM "${tables[0].name}";`;
      if (onSelectQuery) {
        onSelectQuery(summarySql, false);
      } else {
        onNavigate(Tab.SQL);
      }
      return;
    }
    handleToggleCopilot();
  };

  const hasErrors = Boolean(metrics?.errorCount && metrics.errorCount > 0);
  const hasMissingPk = Boolean(metrics?.qualityIssues?.missingPkCount && metrics.qualityIssues.missingPkCount > 0);
  const hasSlowQueries = Boolean(metrics?.latencyDistribution?.slowCount && metrics.latencyDistribution.slowCount > 0);

  return (
    <div className="relative overflow-hidden rounded-xl border border-monokai-border bg-gradient-to-r from-monokai-surface via-monokai-surface to-monokai-elevated/80 p-3 sm:p-3.5 shadow-md shadow-black/25 backdrop-blur-md select-text hover:border-monokai-accent/40 transition-all duration-300">
      {/* 右侧沉浸式深空数据流 SVG 插画 */}
      <HeroDeepSpaceIllustration className="opacity-60 group-hover:opacity-80 transition-opacity" />

      {/* 顶部主横向信息流 */}
      <div className="relative z-10 flex flex-col gap-2.5">
        {/* Top Status & Identity Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-monokai-border/60 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-monokai-cyan/40 bg-monokai-cyan/15 text-monokai-cyan shadow-[0_0_8px_rgba(102,217,239,0.2)]">
              <Database className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold font-mono tracking-wider uppercase text-monokai-fg">
              仪表盘
            </span>
            <span className="text-[10px] font-mono text-monokai-cyan font-semibold px-1.5 py-0.5 rounded bg-monokai-cyan/10 border border-monokai-cyan/30">
              DuckDB Studio
            </span>
            <span className="text-xs font-mono text-monokai-comment">·</span>
            <span className="text-xs text-monokai-fg-muted">{greeting}</span>

            {/* Persistence & Version Tag */}
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-monokai-border bg-monokai-bg/80 px-2 py-0.5 text-[10px] font-mono text-monokai-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent animate-pulse" />
              {isPersistent ? 'OPFS 本地持久化' : '内存沙盒'}
            </span>
            <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-monokai-border bg-monokai-bg/80 px-2 py-0.5 text-[10px] font-mono text-monokai-yellow">
              <Cpu className="h-3 w-3" />
              {engineVersion}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onToggleLayoutMode && (
              <button
                type="button"
                onClick={onToggleLayoutMode}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-monokai-border bg-monokai-elevated/70 px-2.5 text-xs font-mono text-monokai-fg hover:border-monokai-accent hover:text-monokai-accent hover:bg-monokai-hover transition-all cursor-pointer shadow-xs"
                title="切换到经典全景视图"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="text-xs">经典视图</span>
              </button>
            )}

            {/* 刷新工作区按钮 */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-monokai-border bg-monokai-elevated/70 px-2.5 text-xs font-mono text-monokai-fg hover:border-monokai-accent hover:text-monokai-accent hover:bg-monokai-hover transition-all cursor-pointer shadow-xs"
              title="刷新工作区状态"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`} />
              <span className="text-xs">刷新</span>
            </button>
          </div>
        </div>

        {/* Middle Main Content Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Left Column: Heading + CTAs + Diagnostics */}
          <div className="lg:col-span-8 space-y-2">
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-monokai-fg flex items-center gap-2">
                <span>
                  {activeSqlTab?.code?.trim()
                    ? '继续上次的查询分析'
                    : tables.length > 0
                      ? '从这里开始探查数据'
                      : '导入数据或新建查询'}
                </span>
              </h1>
              <p className="mt-0.5 text-xs text-monokai-fg-muted max-w-2xl leading-normal truncate">
                {tables.length > 0
                  ? `工作区就绪，当前已挂载 ${tables.length} 张表可用。内置毫秒级列式引擎，支持就地即时 SQL 分析、资产关系探查与图表生成。`
                  : '工作区就绪。支持拖入 CSV、Parquet、Excel、JSON 或 SQLite 文件即时挂载分析，零服务端依赖，极速纯本地运算。'}
              </p>
            </div>

            {/* Action Buttons & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleResumeWork}
                title={primaryCtaTitle}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-monokai-accent to-emerald-400 hover:from-monokai-accent-hover hover:to-emerald-300 text-monokai-bg font-bold px-3 py-1.5 text-xs transition-all cursor-pointer shadow-[0_0_12px_rgba(166,226,46,0.3)] hover:shadow-[0_0_16px_rgba(166,226,46,0.45)] active:scale-[0.98]"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{primaryCtaLabel}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleCopilot}
                className="flex items-center gap-1.5 rounded-lg border border-monokai-border bg-monokai-elevated/80 hover:bg-monokai-hover hover:border-monokai-yellow/60 text-monokai-fg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer shadow-xs"
                title="切换独立 Copilot 协同助手 (Ctrl+I)"
              >
                <Sparkles className="h-3.5 w-3.5 text-monokai-yellow" />
                <span>智能助手</span>
                <kbd className="hidden sm:inline-block rounded border border-monokai-border bg-monokai-bg px-1.5 py-0.2 text-[10px] font-mono text-monokai-comment">Ctrl+I</kbd>
              </button>

              {onOpenImport && (
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="flex items-center gap-1.5 rounded-lg border border-monokai-border/80 bg-monokai-surface/60 hover:bg-monokai-elevated hover:border-monokai-cyan/60 text-monokai-fg-muted hover:text-monokai-cyan px-2.5 py-1.5 text-xs font-mono transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>导入数据</span>
                </button>
              )}
            </div>

            {/* Smart Diagnostics & AI Quick Exploration Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
              {/* Diagnostic Pills */}
              {hasErrors && (
                <button
                  type="button"
                  onClick={onFilterErrorQueries}
                  className="inline-flex items-center gap-1.5 rounded-md bg-monokai-pink/15 border border-monokai-pink/40 px-2.5 py-1 text-[11px] text-monokai-pink font-semibold hover:bg-monokai-pink/25 transition-colors cursor-pointer"
                  title="点击过滤并查看失败查询详情"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>{metrics?.errorCount} 条查询失败</span>
                  <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                </button>
              )}

              {hasMissingPk && (
                <button
                  type="button"
                  onClick={() => tables[0] && onSelectTableStructure?.(tables[0].name, 'ddl')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-monokai-yellow/15 border border-monokai-yellow/40 px-2.5 py-1 text-[11px] text-monokai-yellow font-medium hover:bg-monokai-yellow/25 transition-colors cursor-pointer"
                  title="点击查看未设主键的表结构"
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>{metrics?.qualityIssues?.missingPkCount} 张表未设主键</span>
                </button>
              )}

              {hasSlowQueries && (
                <button
                  type="button"
                  onClick={onFilterSlowQueries}
                  className="inline-flex items-center gap-1.5 rounded-md bg-monokai-orange/15 border border-monokai-orange/40 px-2.5 py-1 text-[11px] text-monokai-orange font-medium hover:bg-monokai-orange/25 transition-colors cursor-pointer"
                  title="点击排查执行耗时超过 200ms 的慢查询"
                >
                  <Flame className="h-3 w-3" />
                  <span>{metrics?.latencyDistribution?.slowCount} 条慢查询待优化</span>
                </button>
              )}

              {/* Quick AI Exploration Pills */}
              <button
                type="button"
                onClick={() => handleQuickAiPrompt('overview')}
                className="inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated/40 hover:bg-monokai-hover hover:border-monokai-cyan/60 px-2 py-0.5 text-[11px] text-monokai-comment hover:text-monokai-cyan transition-colors cursor-pointer"
              >
                <Wand2 className="h-3 w-3 text-monokai-cyan" />
                <span>数据概览 SQL</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAiPrompt('quality')}
                className="inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated/40 hover:bg-monokai-hover hover:border-monokai-accent/60 px-2 py-0.5 text-[11px] text-monokai-comment hover:text-monokai-accent transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-3 w-3 text-monokai-accent" />
                <span>表结构体检</span>
              </button>
            </div>
          </div>

          {/* Right Column: Contextual Project Telemetry Card */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div className="rounded-lg border border-monokai-border/80 bg-monokai-bg/60 p-3.5 backdrop-blur-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-monokai-border/40 pb-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-monokai-fg">
                  <Database className="h-3.5 w-3.5 text-monokai-cyan" />
                  <span>当前项目</span>
                </div>
                <span className="rounded bg-monokai-elevated px-1.5 py-0.5 text-[10px] font-mono text-monokai-yellow">
                  DuckDB {engineVersion}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-monokai-fg font-medium">{dbName}</span>
                <span className="text-[11px] text-monokai-comment">/workspace/{dbName}</span>
              </div>

              <div className="text-[11px] font-mono text-monokai-accent">
                {isPersistent ? 'OPFS 本地持久化模式' : '内存临时沙盒模式'}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-monokai-border/40">
                <div className="flex flex-col">
                  <span className="text-[10px] text-monokai-comment">数据表</span>
                  <span className="text-xs font-mono font-bold text-monokai-fg">
                    {metrics?.tableCount ?? tables.length}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-monokai-comment">数据量</span>
                  <span className="text-xs font-mono font-bold text-monokai-accent">
                    {metrics?.dataSize || '0 B'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-monokai-comment">SQL 查询</span>
                  <span className="text-xs font-mono font-bold text-monokai-cyan">
                    {metrics?.totalQueries ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
