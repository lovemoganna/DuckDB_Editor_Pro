import React from 'react';
import {
  Play,
  Upload,
  Table,
  BarChart3,
  Download,
  Sparkles,
  Command,
} from 'lucide-react';
import { Tab } from '../../../types';
import { useSqlEditorStore } from '../../../hooks/store/useSqlEditorStore';
import { useAppStore } from '../../../hooks/store/useAppStore';
import { useCopilotStore } from '../../../hooks/store/useCopilotStore';
import { type TableItemDetail, type DashboardDbMetrics } from '../../../hooks/useDashboardWorkflow';
import { toastService } from '../../../services/toastService';
import { SystemHealthGauges } from './SystemHealthGauges';

export interface ActionLaunchpadProps {
  tables?: TableItemDetail[];
  onNavigate: (tab: Tab) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenExport?: () => void;
  onOpenAiChat?: () => void;
  metrics?: DashboardDbMetrics;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectQuery?: (sql: string, executeDirectly?: boolean) => void;
  /** Most recent failed SQL — powers one-click AI explain */
  lastFailedSql?: string | null;
}

export const ActionLaunchpad: React.FC<ActionLaunchpadProps> = ({
  tables = [],
  onNavigate,
  onOpenImport,
  onOpenCreate,
  onOpenExport,
  onOpenAiChat,
  metrics,
  onRefresh,
  isRefreshing = false,
  onSelectQuery,
  lastFailedSql,
}) => {
  const [selectedTableIndex, setSelectedTableIndex] = React.useState(0);
  const activeTable = tables[selectedTableIndex] || tables[0];
  const createSqlTab = useSqlEditorStore((s) => s.createTab);
  const setCurrentTable = useAppStore((s) => s.setCurrentTable);
  const setPendingAiPanel = useAppStore((s) => s.setPendingAiPanel);

  const handleCreateSql = () => {
    createSqlTab();
    toastService.success('已新建 SQL 工作表');
    onNavigate(Tab.SQL);
  };

  const handleBrowseTables = () => {
    if (tables.length > 0) {
      setCurrentTable(activeTable?.name || tables[0].name);
    }
    onNavigate(Tab.DATA);
  };

  const handleCharts = () => {
    if (tables.length > 0) {
      setCurrentTable(activeTable?.name || tables[0].name);
    }
    onNavigate(Tab.METRICS);
  };

  const handleAiAnalysis = () => {
    const tableName = activeTable?.name;
    if (tableName) {
      setCurrentTable(tableName);
      useCopilotStore.getState().setContext({ table: tableName, tab: Tab.DASHBOARD, pin: true });
      useCopilotStore.getState().setIsOpen(true);
      void useCopilotStore.getState().sendMessage(
        `请基于表「${tableName}」给出：1) 字段与业务含义速读 2) 3 条最有价值的探查 SQL 3) 数据质量风险点。优先用 DuckDB 语法。`
      );
      return;
    }
    if (onOpenAiChat) {
      onOpenAiChat();
    } else {
      useCopilotStore.getState().setIsOpen(true);
      toastService.info('请先导入数据表，或直接向助手提问');
    }
  };

  const handleExplainLastFailure = () => {
    if (!lastFailedSql?.trim()) return;
    setPendingAiPanel('explain');
    if (onSelectQuery) {
      onSelectQuery(lastFailedSql, false);
    } else {
      createSqlTab(lastFailedSql);
    }
    onNavigate(Tab.SQL);
    toastService.info('正在打开 AI 解释面板…');
  };

  const errorCount = metrics?.errorCount || 0;

  const actions = [
    {
      title: '新建 SQL 查询',
      description: '在编辑器中新建工作表',
      icon: Play,
      color: 'text-monokai-accent',
      bgColor: 'bg-monokai-accent/15 border-monokai-accent/30',
      onClick: handleCreateSql,
      disabled: false,
    },
    {
      title: '导入数据',
      description: 'CSV / Parquet / Excel',
      icon: Upload,
      color: 'text-monokai-cyan',
      bgColor: 'bg-monokai-cyan/15 border-monokai-cyan/30',
      onClick: onOpenImport,
      disabled: false,
    },
    {
      title: '浏览数据表',
      description: tables.length > 0 ? `打开 ${activeTable?.name || '数据表'}` : '暂无可用数据表',
      icon: Table,
      color: 'text-monokai-orange',
      bgColor: 'bg-monokai-orange/15 border-monokai-orange/30',
      onClick: handleBrowseTables,
      disabled: tables.length === 0,
    },
    {
      title: '生成可视化',
      description: '图表构建与分布洞察',
      icon: BarChart3,
      color: 'text-monokai-yellow',
      bgColor: 'bg-monokai-yellow/15 border-monokai-yellow/30',
      onClick: handleCharts,
      disabled: tables.length === 0,
    },
    {
      title: '导出数据',
      description: onOpenExport ? 'Parquet / JSON 镜像' : '导出入口未就绪',
      icon: Download,
      color: 'text-monokai-purple',
      bgColor: 'bg-monokai-purple/15 border-monokai-purple/30',
      onClick: () => {
        if (onOpenExport) {
          onOpenExport();
        } else {
          toastService.info('请先在设置或数据页完成导出配置');
        }
      },
      disabled: !onOpenExport,
    },
    {
      title: 'AI 智能分析',
      description: activeTable ? `解读 ${activeTable.name}` : '打开助手开始对话',
      icon: Sparkles,
      color: 'text-monokai-pink',
      bgColor: 'bg-monokai-pink/15 border-monokai-pink/30',
      onClick: handleAiAnalysis,
      disabled: false,
    },
  ];

  return (
    <div className="relative flex flex-col flex-1 min-h-[480px] rounded-xl border border-monokai-border bg-gradient-to-b from-monokai-surface to-monokai-surface/95 p-4 shadow-sm select-text justify-between hover:border-monokai-purple/40 transition-colors backdrop-blur-xs">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-monokai-border pb-2.5 shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-monokai-purple/15 text-monokai-purple border border-monokai-purple/30">
              <Command className="h-4 w-4" />
            </span>
            <h2 className="text-sm sm:text-base font-bold text-monokai-fg tracking-tight font-sans">快捷操作</h2>
            <span className="rounded bg-monokai-elevated px-2 py-0.5 font-mono text-xs text-monokai-purple border border-monokai-border">
              {actions.filter((a) => !a.disabled).length}/{actions.length}
            </span>
          </div>
          <span className="text-xs font-mono text-monokai-comment">一键直达</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-monokai-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-monokai-accent animate-pulse" />
            常用工作流
          </span>
          <span className="text-xs font-mono text-monokai-comment">点击即执行</span>
        </div>

        {errorCount > 0 && lastFailedSql && (
          <button
            type="button"
            onClick={handleExplainLastFailure}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-monokai-purple/40 bg-monokai-purple/10 px-2.5 py-1.5 text-left transition-colors hover:bg-monokai-purple/20 cursor-pointer"
            title="用 SQL 编辑器同款 AI 解释，理清最近一次失败查询"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-monokai-purple">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">AI 解释最近失败查询（{errorCount}）</span>
            </span>
            <span className="shrink-0 text-[10px] font-mono text-monokai-comment">一键直达 →</span>
          </button>
        )}
      </div>

      {/* Grid of 6 Tiles: sleek, compact, NO TRUNCATION */}
      <div className="relative z-10 grid grid-cols-2 gap-1.5 shrink-0">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.title}
              type="button"
              onClick={act.onClick}
              disabled={act.disabled}
              title={act.disabled ? act.description : undefined}
              className={`group/btn flex items-center gap-2 rounded-md border border-monokai-border bg-monokai-elevated/40 p-2 text-left transition-all cursor-pointer ${
                act.disabled
                  ? 'opacity-45 cursor-not-allowed'
                  : 'hover:bg-monokai-hover/60 hover:border-monokai-border-strong'
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-all ${act.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 ${act.color}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-monokai-fg group-hover/btn:text-monokai-cyan transition-colors leading-tight whitespace-nowrap">
                  {act.title}
                </div>
                <div className="font-mono text-[10px] text-monokai-comment group-hover/btn:text-monokai-fg-muted transition-colors truncate mt-0.5">
                  {act.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 1-Click Analytical Preset row when tables exist */}
      {tables.length > 0 && activeTable && (
        <div className="relative z-10 flex items-center justify-between gap-1.5 rounded-md border border-monokai-border bg-monokai-elevated/40 px-2 py-1 shrink-0">
          <div className="flex items-center gap-1 min-w-0 text-[11px] font-mono text-monokai-fg-muted font-bold">
            <span className="text-monokai-accent shrink-0">对表</span>
            {tables.length === 1 ? (
              <span className="truncate text-monokai-fg max-w-[85px]">{activeTable.name}</span>
            ) : (
              <select
                aria-label="选择探索表"
                value={activeTable.name}
                onChange={(e) => {
                  const idx = tables.findIndex((t) => t.name === e.target.value);
                  if (idx >= 0) setSelectedTableIndex(idx);
                }}
                className="bg-monokai-surface border border-monokai-border text-monokai-cyan rounded px-1 py-0.5 text-[10px] font-mono font-bold cursor-pointer hover:border-monokai-cyan focus:outline-none max-w-[85px] truncate"
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name} className="bg-monokai-elevated text-monokai-fg">
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                const sql = `SELECT * FROM "${activeTable.name}" LIMIT 20;`;
                if (onSelectQuery) {
                  onSelectQuery(sql, false);
                } else {
                  createSqlTab(sql);
                }
                onNavigate(Tab.SQL);
              }}
              className="flex items-center gap-1 rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-[10px] font-mono text-monokai-cyan hover:border-monokai-cyan transition-colors cursor-pointer"
              title={`在 SQL 编辑器中查看 ${activeTable.name} 前 20 条`}
            >
              <Play className="h-2 w-2 shrink-0 fill-current" />
              <span>抽样 20 条</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const sql = `SELECT count(*) AS total_rows FROM "${activeTable.name}";`;
                if (onSelectQuery) {
                  onSelectQuery(sql, false);
                } else {
                  createSqlTab(sql);
                }
                onNavigate(Tab.SQL);
              }}
              className="flex items-center gap-1 rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-[10px] font-mono text-monokai-accent hover:border-monokai-accent transition-colors cursor-pointer"
              title={`在 SQL 编辑器中统计 ${activeTable.name} 记录数`}
            >
              <Play className="h-2 w-2 shrink-0 fill-current" />
              <span>统计行数</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const sql = `DESCRIBE "${activeTable.name}";`;
                if (onSelectQuery) {
                  onSelectQuery(sql, false);
                } else {
                  createSqlTab(sql);
                }
                onNavigate(Tab.SQL);
              }}
              className="hidden sm:flex items-center gap-1 rounded border border-monokai-border bg-monokai-surface px-1.5 py-0.5 text-[10px] font-mono text-monokai-yellow hover:border-monokai-yellow transition-colors cursor-pointer"
              title={`在 SQL 编辑器中查看 ${activeTable.name} 字段结构`}
            >
              <span>画像</span>
            </button>
          </div>
        </div>
      )}

      {/* Integrated Telemetry Dock */}
      {metrics && (
        <SystemHealthGauges
          embedded
          metrics={metrics}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      )}
    </div>
  );
};
