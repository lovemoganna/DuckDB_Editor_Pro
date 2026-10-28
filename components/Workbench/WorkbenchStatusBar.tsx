import React from 'react';
import { Check, Database, HardDrive, Cpu, Clock, Activity, MessageSquare } from 'lucide-react';
import type { DuckDBRuntimeInfo } from '../../services/duckdbService';

interface WorkbenchStatusBarProps {
  runtimeInfo: DuckDBRuntimeInfo;
  activeDatabase?: string;
  activeSchema?: string;
  cursorLine?: number;
  cursorCol?: number;
  selectedChars?: number;
  activeTabTitle?: string;
  activeTabIsDirty?: boolean;
  tableCount?: number;
  isRunning?: boolean;
  executionTime?: number;
  onOpenRuntimeCenter?: () => void;
  onOpenFeedback?: () => void;
  onFocusEditor?: () => void;
}

export const WorkbenchStatusBar: React.FC<WorkbenchStatusBarProps> = ({
  runtimeInfo,
  activeDatabase = 'memory',
  activeSchema = 'main',
  cursorLine = 1,
  cursorCol = 1,
  selectedChars = 0,
  activeTabTitle,
  activeTabIsDirty = false,
  tableCount,
  isRunning = false,
  executionTime,
  onOpenRuntimeCenter,
  onOpenFeedback,
  onFocusEditor,
}) => {
  return (
    <footer className="h-7 w-full shrink-0 border-t border-monokai-border/80 bg-gradient-to-b from-monokai-sidebar/95 via-monokai-sidebar/90 to-monokai-sidebar/95 px-3 flex items-center justify-between text-xs font-mono text-monokai-fg-muted select-none z-30 relative">
      {/* Subtle top hairline for depth */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-monokai-fg/8 to-transparent" />
      
      {/* Left side items */}
      <div className="flex items-center gap-3 min-w-0 text-[11px] overflow-hidden">
        {/* Database & Schema badge */}
        <div className="flex items-center gap-1 text-monokai-fg px-1.5 py-0.5 rounded-md bg-monokai-bg/40 border border-monokai-border/30 hover:border-monokai-yellow/40 transition-colors shrink-0">
          <Database className="w-3 h-3 text-monokai-yellow" />
          <span className="text-[10px] uppercase tracking-wide text-monokai-comment/80">db</span>
          <span className="text-monokai-fg font-medium truncate max-w-[100px]">{activeDatabase}.{activeSchema}</span>
          {tableCount != null && (
            <span className="text-[10px] text-monokai-comment ml-0.5">({tableCount}表)</span>
          )}
        </div>

        {/* Cursor line & column indicator */}
        <button
          type="button"
          onClick={onFocusEditor}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-monokai-surface text-monokai-fg-muted hover:text-monokai-cyan transition-colors cursor-pointer shrink-0 border border-transparent hover:border-monokai-border/40"
          title="光标位置 (点击聚焦 SQL 编辑器)"
        >
          <span className="text-[10px] text-monokai-comment">行</span>
          <span className="text-monokai-fg font-bold tabular-nums">{cursorLine}</span>
          <span className="text-[10px] text-monokai-comment ml-0.5">列</span>
          <span className="text-monokai-fg font-bold tabular-nums">{cursorCol}</span>
          {selectedChars != null && selectedChars > 0 ? (
            <span className="text-[10px] text-monokai-yellow font-medium ml-1">({selectedChars} 选区)</span>
          ) : null}
        </button>

        {/* Active tab & dirty state */}
        {activeTabTitle && (
          <div className="hidden lg:flex items-center gap-1.5 text-monokai-comment truncate max-w-[160px] shrink-0" title={`当前查询: ${activeTabTitle}`}>
            <span className="text-[10px] truncate">{activeTabTitle}</span>
            {activeTabIsDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow shrink-0" title="未保存更改" />
            )}
          </div>
        )}

        {/* Memory with progress bar */}
        <div
          onClick={onOpenRuntimeCenter}
          className="hidden md:flex items-center gap-1.5 text-monokai-fg hover:text-monokai-cyan cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-monokai-cyan/8 transition-colors border border-transparent hover:border-monokai-cyan/30 shrink-0"
          title="点击查看运行时状态中心"
        >
          <Cpu className="w-3 h-3 text-monokai-cyan/80" />
          <span className="text-[10px] uppercase tracking-wide text-monokai-comment/80">内存</span>
          <span className="font-bold tabular-nums">{runtimeInfo.memoryUsage || '未采集'}</span>
        </div>

        {/* Checkpoint */}
        <div
          onClick={onOpenRuntimeCenter}
          className="hidden xl:flex items-center gap-1 text-monokai-fg-muted hover:text-monokai-cyan cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-monokai-cyan/8 transition-colors border border-transparent hover:border-monokai-cyan/30 shrink-0"
          title="查看运行时状态详情"
        >
          <Clock className="w-3 h-3 text-monokai-comment/80" />
          <span className="text-[10px] text-monokai-comment/80">运行时</span>
          <span className="font-mono text-[10px]">{runtimeInfo.ready ? '就绪' : '初始化中'}</span>
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-2.5 shrink-0 text-[11px]">
        {/* Status indicator */}
        {isRunning ? (
          <div className="flex items-center gap-1.5 text-monokai-yellow font-sans font-medium px-2 py-0.5 rounded-md bg-monokai-yellow/12 border border-monokai-yellow/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-monokai-yellow" />
            <span className="text-[11px]">执行中...</span>
          </div>
        ) : (
          <div
            onClick={onOpenRuntimeCenter}
            className="group flex items-center gap-1.5 text-monokai-green font-sans font-medium hover:opacity-90 cursor-pointer px-2 py-0.5 rounded-md hover:bg-monokai-green/8 transition-colors border border-transparent hover:border-monokai-green/30"
            title="点击打开运行时状态中心"
          >
            <span className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-green shadow-[0_0_6px_rgba(166,226,46,0.6)] animate-pulse" />
              <span className="absolute inset-0 blur-[2px] bg-monokai-green/40 rounded-full" />
            </span>
            <span className="text-[11px]">就绪</span>
            {executionTime != null && executionTime > 0 && (
              <span className="text-monokai-comment text-[10px] font-mono">({Math.round(executionTime)}ms)</span>
            )}
          </div>
        )}

        {/* Control center button */}
        <button
          onClick={onOpenRuntimeCenter}
          className="group flex items-center gap-1 px-2 py-0.5 rounded-md bg-monokai-surface/60 hover:bg-monokai-elevated border border-monokai-border/60 hover:border-monokai-accent/50 text-monokai-fg-muted hover:text-monokai-fg transition-all duration-150 cursor-pointer"
          title="查看 DuckDB WASM 引擎与扩展运行时状态"
        >
          <Cpu className="w-3 h-3 text-monokai-comment group-hover:text-monokai-accent transition-colors" />
          <span className="text-[11px]">控制</span>
        </button>

        {/* Feedback button */}
        <button
          onClick={onOpenFeedback}
          className="group flex items-center gap-1 px-2 py-0.5 rounded-md bg-monokai-surface/60 hover:bg-monokai-elevated border border-monokai-border/60 hover:border-monokai-amethyst/50 text-monokai-fg-muted hover:text-monokai-fg transition-all duration-150 cursor-pointer"
          title="打开 Linear 反馈与 Issue 追踪看板"
        >
          <MessageSquare className="w-3 h-3 text-monokai-comment group-hover:text-monokai-amethyst transition-colors" />
          <span className="text-[11px]">反馈</span>
        </button>
      </div>
    </footer>
  );
};
