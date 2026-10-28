import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Database, Upload, RotateCcw } from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { DB } from '../dashboardUi';

export type AnalysisContextOption = {
  id: string;
  label: string;
  kind: 'schema' | 'database' | 'project';
  isCurrent: boolean;
};

export interface HomeHeaderProps {
  metrics?: DashboardDbMetrics;
  tables?: TableItemDetail[];
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
  analysisContexts?: AnalysisContextOption[];
  onSwitchAnalysisContext?: (target: { id: string; kind: AnalysisContextOption['kind'] }) => void;
  onNavigate: (tab: Tab) => void;
  onOpenImport?: () => void;
  onGenerateChart?: () => void;
  onContinueAnalysis?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  metrics,
  tables = [],
  runtimeInfo,
  analysisContexts = [],
  onSwitchAnalysisContext,
  onNavigate,
  onOpenImport,
  onGenerateChart,
  onContinueAnalysis,
  onRefresh,
  isRefreshing = false,
}) => {
  const [dbMenuOpen, setDbMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const dbName = metrics?.databaseName || 'memory';
  const schemaName = metrics?.schemaName || 'main';
  const currentLabel =
    analysisContexts.find((c) => c.isCurrent)?.label || `${dbName} / ${schemaName}`;

  useEffect(() => {
    if (!dbMenuOpen || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 260),
    });
  }, [dbMenuOpen]);

  useEffect(() => {
    if (!dbMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const menu = document.getElementById('home-db-switcher-menu');
      if (menu?.contains(t)) return;
      setDbMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDbMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [dbMenuOpen]);

  const contextLine = tables.length > 0 ? `${tables.length} 个数据集 · ${metrics?.formattedTotalRows || '未知'} 行（当前数据库与 Schema，未应用筛选）` : '';

  return (
    <header className="relative z-20 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between select-text pb-1">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-monokai-fg font-sans">数据分析</h1>
          <span className="font-mono text-2xs text-monokai-comment">/</span>
          <button
            ref={triggerRef}
            type="button"
            disabled={!onSwitchAnalysisContext || isRefreshing}
            onClick={() => setDbMenuOpen((v) => !v)}
            className="inline-flex max-w-[min(100%,320px)] items-center gap-1.5 rounded-md border border-monokai-border/80 bg-monokai-surface/70 px-2 py-0.5 font-mono text-xs text-monokai-fg-muted hover:border-monokai-accent/50 hover:text-monokai-accent transition-colors disabled:opacity-60 cursor-pointer"
            title="切换待分析数据库 / Schema"
            aria-haspopup="listbox"
            aria-expanded={dbMenuOpen}
          >
            <Database className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentLabel}</span>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${dbMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <p className="text-meta text-monokai-comment font-sans">{contextLine}</p>
      </div>

      {dbMenuOpen &&
        menuPos &&
        createPortal(
          <div
            id="home-db-switcher-menu"
            role="listbox"
            className="fixed z-[1200] max-h-72 overflow-auto rounded-md border border-monokai-border bg-monokai-sidebar shadow-2xl custom-scrollbar"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <div className="sticky top-0 border-b border-monokai-border bg-monokai-elevated px-2.5 py-1.5 text-2xs font-mono uppercase tracking-wide text-monokai-comment">
              切换分析数据库
            </div>
            {(analysisContexts.length > 0 ? analysisContexts : [{ id: schemaName, label: currentLabel, kind: 'schema' as const, isCurrent: true }]).map(
              (ctx) => (
                <button
                  key={`${ctx.kind}:${ctx.id}`}
                  type="button"
                  role="option"
                  aria-selected={ctx.isCurrent}
                  className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                    ctx.isCurrent
                      ? 'bg-monokai-accent/15 text-monokai-accent'
                      : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                  }`}
                  onClick={() => {
                    setDbMenuOpen(false);
                    if (!ctx.isCurrent) onSwitchAnalysisContext?.({ id: ctx.id, kind: ctx.kind });
                  }}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{ctx.label}</span>
                  {ctx.isCurrent && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ),
            )}
            <div className="sticky bottom-0 border-t border-monokai-border bg-monokai-elevated">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-accent transition-colors cursor-pointer"
                onClick={() => {
                  setDbMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('open-project-manager-modal'));
                }}
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>管理数据库（创建 / 挂载 / 卸载）…</span>
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {onOpenImport && (
          <button type="button" onClick={onOpenImport} className={DB.btnSecondary} title="导入数据文件">
            <Upload className="h-3.5 w-3.5" />
            <span>导入数据</span>
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={DB.btnIcon}
            title="刷新"
            aria-label="刷新"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}


      </div>
    </header>
  );
};
