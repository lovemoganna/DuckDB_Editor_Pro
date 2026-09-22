/**
 * Shared Analysis Hub UI primitives & class tokens.
 * Thin composition helpers over Workbench + Monokai tokens — not a second design system.
 *
 * CTA: primary = accent green (matches ActionButton); orange = warning/highlight only.
 * Density: body = text-meta (11px), caption = text-2xs (10px) under `.analysis-hub`.
 */
import React from 'react';
import { Check, Code, Copy, RefreshCw, type LucideIcon } from 'lucide-react';
import { InlineAlert, WorkbenchLoadingState } from '../ui/Workbench';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

/** Dense, shared surface tokens for Analysis Hub sub-views */
export const AH = {
  /** Panel shell only — applies `.analysis-hub` density scope once */
  root: 'analysis-hub flex h-full flex-col overflow-hidden bg-monokai-bg font-sans text-meta text-monokai-fg',
  /** Nested sub-view pane — no second `.analysis-hub` / bg reset */
  pane: 'flex h-full min-h-0 flex-col overflow-hidden',
  scrollBody: 'flex-1 min-h-0 overflow-auto p-3 custom-scrollbar',
  configBar:
    'flex flex-col gap-2 border-b border-monokai-border bg-monokai-surface px-3 py-2',
  card: 'rounded-md border border-monokai-border bg-monokai-surface shadow-xs',
  cardMuted: 'rounded-md border border-monokai-border/80 bg-monokai-bg/60',
  cardInteractive:
    'rounded-md border border-monokai-border bg-monokai-surface p-2.5 shadow-xs hover:border-monokai-border-strong transition-colors',
  kpi: 'flex flex-col rounded-md border border-monokai-border bg-monokai-surface p-2 shadow-xs',
  label: 'text-2xs text-monokai-comment font-mono',
  sectionTitle: 'text-2xs font-bold uppercase tracking-wider text-monokai-fg',
  sectionDesc: 'text-2xs text-monokai-comment leading-snug',
  body: 'text-meta text-monokai-fg/90 leading-relaxed',
  link: `text-monokai-cyan hover:text-monokai-accent underline-offset-2 hover:underline transition-colors cursor-pointer ${focus}`,
  textLink: `text-monokai-cyan hover:text-monokai-accent hover:underline font-mono text-2xs inline-flex items-center gap-0.5 cursor-pointer ${focus}`,
  divider: 'border-t border-monokai-border/60',
  quote:
    'border-l-2 border-monokai-yellow/70 bg-monokai-yellow/5 pl-2.5 py-1.5 text-meta text-monokai-fg-muted leading-relaxed',
  list: 'list-disc pl-4 space-y-1 text-meta text-monokai-fg/90 marker:text-monokai-comment',
  inlineCode:
    'rounded-sm border border-monokai-border/70 bg-monokai-bg px-1 py-px font-mono text-2xs text-monokai-yellow',
  badge:
    'inline-flex items-center gap-0.5 rounded-md border border-monokai-border bg-monokai-bg px-1.5 py-0.5 font-mono text-3xs font-semibold text-monokai-comment',
  input: `rounded-md border border-monokai-border bg-monokai-surface px-2 py-1 text-meta text-monokai-fg font-mono placeholder:text-monokai-comment focus:border-monokai-accent focus:outline-none focus:ring-1 focus:ring-monokai-accent/25 ${focus}`,
  select: `rounded-md border border-monokai-border bg-monokai-surface px-2 py-1 text-meta text-monokai-fg font-mono focus:border-monokai-accent focus:outline-none focus:ring-1 focus:ring-monokai-accent/25 cursor-pointer ${focus}`,
  chip: `px-2 py-0.5 text-meta rounded-md border border-monokai-border bg-monokai-surface text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer ${focus}`,
  chipActive:
    'px-2 py-0.5 text-meta rounded-md border border-monokai-border-strong bg-monokai-elevated text-monokai-accent font-semibold',
  btnGhost: `inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-meta text-monokai-fg hover:border-monokai-border-strong hover:bg-monokai-elevated/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnPrimary: `inline-flex items-center gap-1 rounded-md bg-monokai-accent px-2.5 py-1 text-meta font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnSuccess: `inline-flex items-center gap-1 rounded-md bg-monokai-green/15 border border-monokai-green/35 px-2.5 py-1 text-meta font-semibold text-monokai-green hover:bg-monokai-green/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnWarning: `inline-flex items-center gap-1 rounded-md bg-monokai-yellow/15 border border-monokai-yellow/35 px-2.5 py-1 text-meta font-semibold text-monokai-yellow hover:bg-monokai-yellow/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  iconBtn: `inline-flex items-center justify-center rounded-md border border-monokai-border bg-monokai-surface p-1.5 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  dangerIconBtn: `inline-flex items-center justify-center rounded-md p-1 text-monokai-comment hover:text-monokai-pink transition-colors cursor-pointer ${focus}`,
  segmentTrack: 'inline-flex items-center rounded-md border border-monokai-border bg-monokai-bg p-0.5',
  segmentItem: `flex items-center gap-1 px-2 py-0.5 text-meta rounded-md transition-colors cursor-pointer text-monokai-comment hover:text-monokai-fg ${focus}`,
  segmentItemActive:
    'flex items-center gap-1 px-2 py-0.5 text-meta rounded-md transition-colors cursor-pointer bg-monokai-accent text-monokai-bg font-semibold',
  progressTrack: 'w-full bg-monokai-bg rounded-sm h-1 overflow-hidden',
  tableWrap:
    'flex flex-col rounded-md border border-monokai-border bg-monokai-surface overflow-hidden shadow-xs',
  table: 'w-full text-left border-collapse text-meta font-mono',
  th: 'px-2.5 py-1.5 font-semibold text-monokai-comment border-r border-monokai-border/40 last:border-r-0',
  td: 'px-2.5 py-1 text-monokai-fg/90 border-r border-monokai-border/30 last:border-r-0 whitespace-nowrap',
  codeBlock:
    'border-t border-monokai-border bg-monokai-bg p-2.5 text-meta font-mono text-monokai-cyan max-h-36 overflow-y-auto custom-scrollbar select-text',
  codePanel:
    'rounded-md border border-monokai-border bg-monokai-bg p-2.5 text-meta font-mono text-monokai-cyan overflow-auto custom-scrollbar select-text',
  sqlBar:
    'border-t border-monokai-border bg-monokai-surface px-3 py-1.5 flex items-center justify-between gap-2 text-meta',
  fieldRow: 'flex flex-col gap-1 min-w-0',
  dashedAdd:
    'flex items-center justify-center gap-1 rounded-md border border-dashed border-monokai-border py-1 text-2xs text-monokai-comment hover:border-monokai-accent hover:text-monokai-fg transition-colors cursor-pointer',
  /** Default chart host height (px) — keep pivot / timeseries / recipes aligned */
  chartHeight: 280,
} as const;

const ICON_TONE_MAP = {
  orange: 'bg-monokai-orange/20 text-monokai-orange',
  cyan: 'bg-monokai-cyan/20 text-monokai-cyan',
  yellow: 'bg-monokai-yellow/20 text-monokai-yellow',
  green: 'bg-monokai-green/20 text-monokai-green',
  accent: 'bg-monokai-accent/20 text-monokai-accent',
} as const;

export function analysisIconBox(tone: keyof typeof ICON_TONE_MAP = 'accent'): string {
  return `flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ICON_TONE_MAP[tone]}`;
}

export function formatAnalysisCell(val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-monokai-comment italic">null</span>;
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  return String(val);
}

interface AnalysisLoadingStateProps {
  message: string;
  className?: string;
}

export const AnalysisLoadingState: React.FC<AnalysisLoadingStateProps> = ({
  message,
  className = '',
}) => (
  <div className={`h-56 ${className}`}>
    <WorkbenchLoadingState message={message} description="" compact />
  </div>
);

interface AnalysisSubViewHeaderProps {
  icon: LucideIcon;
  iconTone?: 'orange' | 'cyan' | 'yellow' | 'green' | 'accent';
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export const AnalysisSubViewHeader: React.FC<AnalysisSubViewHeaderProps> = ({
  icon: Icon,
  iconTone = 'accent',
  title,
  description,
  actions,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <span className={analysisIconBox(iconTone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className={AH.sectionTitle}>{title}</h3>
        <p className={AH.sectionDesc}>{description}</p>
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-1.5 shrink-0">{actions}</div>}
  </div>
);

interface AnalysisKpiTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
}

export const AnalysisKpiTile: React.FC<AnalysisKpiTileProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName = 'text-monokai-comment',
  valueClassName = 'text-monokai-fg',
}) => (
  <div className={AH.kpi}>
    <span className={`${AH.label} flex items-center gap-1.5`}>
      {Icon && <Icon className={`h-3 w-3 ${iconClassName}`} aria-hidden="true" />}
      {label}
    </span>
    <div className={`mt-0.5 text-sm font-bold font-mono tracking-tight ${valueClassName}`}>{value}</div>
    {hint && <div className="mt-0.5 text-2xs text-monokai-comment font-mono">{hint}</div>}
  </div>
);

interface AnalysisResultTableProps {
  columns: string[];
  rows: any[];
  title?: string;
  metaRight?: React.ReactNode;
  maxHeightClass?: string;
  emptyMessage?: string;
}

export const AnalysisResultTable: React.FC<AnalysisResultTableProps> = ({
  columns,
  rows,
  title,
  metaRight,
  maxHeightClass = 'max-h-56',
  emptyMessage = '暂无结果行',
}) => {
  if (rows.length === 0) {
    return (
      <div className={`${AH.tableWrap} px-3 py-6 text-center text-meta text-monokai-comment`}>
        {emptyMessage}
      </div>
    );
  }

  const cols = columns.length > 0 ? columns : Object.keys(rows[0] || {});

  return (
    <div className={AH.tableWrap}>
      {(title || metaRight) && (
        <div className="px-2.5 py-1.5 border-b border-monokai-border bg-monokai-bg flex items-center justify-between text-meta font-mono">
          <span className="font-semibold text-monokai-fg">{title}</span>
          {metaRight && <span className="text-2xs text-monokai-comment">{metaRight}</span>}
        </div>
      )}
      <div className={`${maxHeightClass} overflow-auto custom-scrollbar`}>
        <table className={AH.table}>
          <thead>
            <tr className="border-b border-monokai-border bg-monokai-bg/80 sticky top-0 z-10">
              {cols.map(col => (
                <th key={col} className={AH.th}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-monokai-border/40">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-monokai-bg/40 transition-colors">
                {cols.map(col => (
                  <td key={col} className={AH.td}>
                    {formatAnalysisCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-2.5 py-1.5 bg-monokai-bg border-t border-monokai-border text-2xs text-monokai-comment font-mono flex items-center justify-between">
        <span>共 {rows.length} 行</span>
        <span>DuckDB Local WASM</span>
      </div>
    </div>
  );
};

interface AnalysisErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const AnalysisErrorState: React.FC<AnalysisErrorStateProps> = ({
  title = '分析异常',
  message,
  onRetry,
}) => (
  <div className="p-3">
    <InlineAlert tone="error" title={title}>
      <p className="font-mono text-meta text-monokai-pink/90">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${AH.btnGhost} mt-2 text-monokai-pink border-monokai-pink/30 bg-monokai-pink/10 hover:bg-monokai-pink/20`}>
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          重试
        </button>
      )}
    </InlineAlert>
  </div>
);

interface AnalysisEmptyHintProps {
  message: string;
  className?: string;
}

export const AnalysisEmptyHint: React.FC<AnalysisEmptyHintProps> = ({
  message,
  className = '',
}) => (
  <div
    className={`rounded-md border border-dashed border-monokai-border bg-monokai-bg/40 px-3 py-5 text-center text-meta text-monokai-comment ${className}`}
  >
    {message}
  </div>
);

interface AnalysisSegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface AnalysisSegmentToggleProps<T extends string> {
  value: T;
  options: readonly AnalysisSegmentOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
}

export function AnalysisSegmentToggle<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: AnalysisSegmentToggleProps<T>) {
  return (
    <div className={AH.segmentTrack} role="tablist" aria-label={ariaLabel}>
      {options.map(opt => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={active ? AH.segmentItemActive : AH.segmentItem}
          >
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface AnalysisSqlBarProps {
  sql: string;
  open: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied?: boolean;
  emptyLabel?: string;
}

export const AnalysisSqlBar: React.FC<AnalysisSqlBarProps> = ({
  sql,
  open,
  onToggle,
  onCopy,
  copied = false,
  emptyLabel = '-- 尚未生成 SQL',
}) => (
  <>
    <div className={AH.sqlBar}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 text-monokai-comment hover:text-monokai-fg font-mono transition-colors cursor-pointer ${focus}`}
      >
        <Code className="h-3.5 w-3.5 text-monokai-cyan" aria-hidden="true" />
        <span>{open ? '收起 SQL' : '查看底层 SQL'}</span>
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={!sql}
        className={`${AH.btnGhost} disabled:opacity-50`}
      >
        {copied ? (
          <Check className="h-3 w-3 text-monokai-green" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
        <span>{copied ? '已复制' : '复制 SQL'}</span>
      </button>
    </div>
    {open && (
      <div className={AH.codeBlock}>
        <pre className="whitespace-pre-wrap leading-relaxed">{sql || emptyLabel}</pre>
      </div>
    )}
  </>
);

interface AnalysisFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const AnalysisField: React.FC<AnalysisFieldProps> = ({
  label,
  children,
  className = '',
}) => (
  <div className={`${AH.fieldRow} ${className}`}>
    <label className={AH.label}>{label}</label>
    {children}
  </div>
);
