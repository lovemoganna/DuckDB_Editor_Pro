import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Database, Upload, RotateCcw } from 'lucide-react';
import { Tab } from '../../../types';
import { type DashboardDbMetrics, type TableItemDetail } from '../../../hooks/useDashboardWorkflow';
import { DB } from '../dashboardUi';
import { ActionButton, IconButton } from '../../ui/Workbench';

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
  const menuRef = useRef<HTMLDivElement>(null);
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
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
      setMenuPos({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [dbMenuOpen]);

  useEffect(() => {
    if (!dbMenuOpen || !menuPos) return;
    const menu = menuRef.current;
    (menu?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]') || menu?.querySelector<HTMLButtonElement>('[role="option"], button'))?.focus();
  }, [dbMenuOpen, Boolean(menuPos)]);

  const closeMenu = () => { setDbMenuOpen(false); triggerRef.current?.focus(); };

  useEffect(() => {
    if (!dbMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setDbMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [dbMenuOpen]);

  const contextLine = tables.length > 0 ? `${tables.length} 个数据集 · ${metrics?.formattedTotalRows || '未知'} 行 · 数据规模未应用筛选` : '';

  return (
    <header className="home-context-header relative z-20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between select-text pb-1">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h1 className="text-sm font-semibold tracking-tight text-monokai-fg font-sans">分析范围</h1>
          <span className="font-mono text-2xs text-monokai-comment">/</span>
          <button
            ref={triggerRef}
            type="button"
            disabled={!onSwitchAnalysisContext || isRefreshing}
            onClick={() => setDbMenuOpen((v) => !v)}
            onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setDbMenuOpen(true); } }}
            className="inline-flex max-w-[min(100%,320px)] items-center gap-1.5 rounded-md border border-monokai-border/80 bg-monokai-surface/70 px-2 py-0.5 font-mono text-xs text-monokai-fg-muted hover:border-monokai-accent/50 hover:text-monokai-accent transition-colors disabled:opacity-60 cursor-pointer"
            title="切换待分析数据库 / Schema"
            aria-haspopup="listbox"
            aria-expanded={dbMenuOpen}
            aria-controls={dbMenuOpen ? 'home-db-switcher-menu' : undefined}
          >
            <Database className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentLabel}</span>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${dbMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <p title={contextLine} className="flex flex-wrap gap-x-1 text-xs text-monokai-fg-muted font-sans">{tables.length > 0 && <><span className="whitespace-nowrap">{tables.length} 个数据集 · {metrics?.formattedTotalRows || '未知'} 行</span><span className="whitespace-nowrap">· 数据规模未应用筛选</span></>}</p>
      </div>

      {dbMenuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-72 overflow-auto rounded-md border border-monokai-border bg-monokai-sidebar shadow-2xl custom-scrollbar"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: `min(288px, calc(100dvh - ${menuPos.top + 12}px))` }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== triggerRef.current) setDbMenuOpen(false); }}
            onKeyDown={event => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              const options = Array.from(event.currentTarget.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
              if (!options.length) return;
              event.preventDefault();
              const index = options.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
              options[next]?.focus();
            }}
          >
            <div className="flex items-center justify-between sticky top-0 border-b border-monokai-border bg-monokai-elevated px-2.5 py-1.5 text-2xs font-mono uppercase tracking-wide text-monokai-comment">
              <span>切换分析数据库</span>
              <span>{(analysisContexts.length > 0 ? analysisContexts : [{ id: schemaName }]).length} 个可用目标</span>
            </div>
            <div id="home-db-switcher-menu" role="listbox" aria-label="切换分析范围">
            {/* 数据库分组 */}
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3 w-3 text-monokai-accent" />
              <span>数据库 (Database)</span>
            </div>
            {analysisContexts
              .filter((ctx) => ctx.kind !== 'schema')
              .map((ctx) => (
                <button
                  key={`${ctx.kind}:${ctx.id}`}
                  type="button"
                  role="option"
                  tabIndex={ctx.isCurrent ? 0 : -1}
                  aria-selected={ctx.isCurrent}
                  className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                    ctx.isCurrent
                      ? 'bg-monokai-accent/15 text-monokai-accent font-medium'
                      : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                  }`}
                  onClick={() => {
                    closeMenu();
                    if (!ctx.isCurrent) onSwitchAnalysisContext?.({ id: ctx.id, kind: ctx.kind });
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Database className="h-3.5 w-3.5 shrink-0 text-monokai-comment" />
                    <span className="min-w-0 flex-1 truncate font-mono">{ctx.label}</span>
                  </div>
                  {ctx.isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-monokai-accent ml-2" />}
                </button>
              ))}

            {/* 当前库下的 Schema 分组 */}
            {analysisContexts.some((ctx) => ctx.kind === 'schema') && (
              <>
                <div className="my-1 mx-2 border-t border-monokai-border/40" />
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-monokai-comment uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-amber-400">§</span>
                    <span>当前库模式 (Schema)</span>
                  </span>
                  <span className="text-[9px] lowercase font-normal text-monokai-comment/70">所属: {dbName}</span>
                </div>
                {analysisContexts
                  .filter((ctx) => ctx.kind === 'schema')
                  .map((ctx) => (
                    <button
                      key={`${ctx.kind}:${ctx.id}`}
                      type="button"
                      role="option"
                      tabIndex={ctx.isCurrent ? 0 : -1}
                      aria-selected={ctx.isCurrent}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                        ctx.isCurrent
                          ? 'bg-monokai-accent/15 text-monokai-accent font-medium'
                          : 'text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-fg'
                      }`}
                      onClick={() => {
                        closeMenu();
                        if (!ctx.isCurrent) onSwitchAnalysisContext?.({ id: ctx.id, kind: ctx.kind });
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pl-1">
                        <span aria-hidden="true" className="font-mono text-[10px] text-amber-400/80">§</span>
                        <span className="min-w-0 flex-1 truncate font-mono">{ctx.label}</span>
                      </div>
                      {ctx.isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-monokai-accent ml-2" />}
                    </button>
                  ))}
              </>
            )}
            </div>
            <div className="sticky bottom-0 border-t border-monokai-border bg-monokai-elevated">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-monokai-fg-muted hover:bg-monokai-surface hover:text-monokai-accent transition-colors cursor-pointer"
                onClick={() => {
                  closeMenu();
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
          <ActionButton
            size="sm"
            variant="secondary"
            onClick={onOpenImport}
            icon={Upload}
            title="导入数据文件"
          >
            导入数据
          </ActionButton>
        )}

        {onRefresh && (
          <IconButton
            size="sm"
            label="刷新数据"
            icon={RotateCcw}
            onClick={onRefresh}
            disabled={isRefreshing}
            className={isRefreshing ? 'animate-spin' : ''}
            title="刷新数据"
          />
        )}
      </div>
    </header>
  );
};
