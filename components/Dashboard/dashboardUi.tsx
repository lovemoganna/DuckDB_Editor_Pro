/**
 * Shared Dashboard surface tokens.
 * Thin composition helpers over Workbench + Monokai — not a second button system.
 * Primary CTA = accent green fill (matches ActionButton variant="primary").
 *
 * Rules for Studio Home:
 * - Use monokai-* / DB.* only — no bg-[#…], emerald-*, slate-*, rose-*, arbitrary text-[Npx]
 * - Type scale: text-xs (body), text-meta / text-2xs / text-micro (meta)
 * - CTA: DB.btnPrimary | Workbench ActionButton
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export type DbBadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

export const DB = {
  shell: 'rounded-md border border-monokai-border bg-monokai-surface shadow-sm',
  panel: 'flex flex-col rounded-md border border-monokai-border bg-monokai-surface shadow-sm p-3',
  /** Content panels — quiet IDE pane, no lift shadow */
  panelLg:
    'relative flex flex-col overflow-hidden rounded-md border border-monokai-border/80 bg-monokai-surface/60 p-3 h-full select-text',
  kpi: 'group relative flex flex-col gap-1.5 rounded-md border border-monokai-border bg-monokai-surface p-2.5 transition-colors duration-150',
  kpiCard:
    'group relative flex flex-col justify-between overflow-hidden rounded-md border border-monokai-border bg-monokai-surface p-3 shadow-sm transition-colors duration-150',
  kpiCardInteractive:
    'hover:border-monokai-border-strong hover:bg-monokai-elevated/40 cursor-pointer text-left',
  kpiInteractive:
    'hover:border-monokai-border-strong hover:bg-monokai-elevated/40 cursor-pointer',
  btnPrimary: `inline-flex items-center gap-1.5 rounded-md bg-monokai-accent px-3 py-1.5 text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnSecondary: `inline-flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnGhostLink: `inline-flex items-center gap-1 rounded-md px-1 text-meta text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer ${focus}`,
  btnIcon: `inline-flex h-8 w-8 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated text-monokai-fg-muted hover:bg-monokai-hover hover:text-monokai-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  focus,
  chip: 'inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated px-2 py-0.5 text-2xs font-mono text-monokai-fg-muted',
  segment: 'inline-flex items-center rounded-md border border-monokai-border bg-monokai-elevated p-0.5 text-2xs',
  segmentItem: `rounded-md px-2 py-0.5 cursor-pointer transition-colors text-monokai-comment hover:text-monokai-fg ${focus}`,
  segmentItemActive:
    'rounded-md px-2 py-0.5 cursor-pointer transition-colors bg-monokai-accent/20 text-monokai-accent font-semibold',
  iconBox:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated text-monokai-fg-muted',
  sectionHeader: 'flex items-center justify-between gap-2',
  sectionTitle: 'text-xs font-semibold tracking-wide text-monokai-fg',
  sectionMeta: 'text-2xs font-mono text-monokai-comment',
  meta: 'text-meta text-monokai-comment',
  metaMono: 'text-2xs font-mono text-monokai-comment',
  body: 'text-meta text-monokai-fg-muted',
  value: 'text-base font-semibold tracking-tight font-mono text-monokai-fg',
  kpiValue: 'font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-monokai-fg truncate',
  input: `w-full rounded-md border border-monokai-border bg-monokai-elevated py-1 pl-7 pr-7 text-meta font-mono text-monokai-fg placeholder:text-monokai-comment focus:border-monokai-accent/70 focus:outline-none focus:ring-1 focus:ring-monokai-accent/20 transition-colors ${focus}`,
  tile: `group flex items-start gap-2.5 rounded-md border border-monokai-border bg-monokai-elevated p-2 text-left shadow-2xs transition-colors duration-150 hover:border-monokai-border-strong hover:bg-monokai-border/40 cursor-pointer ${focus}`,
  empty: 'flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-monokai-border bg-monokai-elevated/40 px-4 py-6 text-center',
  statusDotOk: 'h-1.5 w-1.5 rounded-full bg-monokai-accent',
  statusDotWarn: 'h-1.5 w-1.5 rounded-full bg-monokai-yellow',
  badgeOk:
    'rounded px-1.5 py-0.5 font-mono text-2xs border border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent',
  badgeWarn:
    'rounded px-1.5 py-0.5 font-mono text-2xs border border-monokai-yellow/40 bg-monokai-yellow/10 text-monokai-yellow',
  badgeDanger:
    'rounded px-1.5 py-0.5 font-mono text-2xs border border-monokai-pink/50 bg-monokai-pink/15 text-monokai-pink',
  badgeNeutral:
    'rounded px-1.5 py-0.5 font-mono text-2xs border border-monokai-border bg-monokai-elevated text-monokai-comment',
  badgeInfo:
    'rounded px-1.5 py-0.5 font-mono text-2xs border border-monokai-cyan/30 bg-monokai-cyan/10 text-monokai-cyan',
} as const;

export function dbBadgeClass(tone: DbBadgeTone = 'neutral'): string {
  switch (tone) {
    case 'ok':
      return DB.badgeOk;
    case 'warn':
      return DB.badgeWarn;
    case 'danger':
      return DB.badgeDanger;
    case 'info':
      return DB.badgeInfo;
    default:
      return DB.badgeNeutral;
  }
}

export function dbIconBox(className = ''): string {
  return `${DB.iconBox} ${className}`.trim();
}

/** Accent tint for KPI icon boxes — monokai semantic colors only */
export type DbAccentTone = 'cyan' | 'accent' | 'yellow' | 'purple' | 'pink' | 'orange' | 'neutral';

export function dbAccentIconBox(tone: DbAccentTone = 'neutral'): string {
  switch (tone) {
    case 'cyan':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-cyan/30 bg-monokai-cyan/15 text-monokai-cyan';
    case 'accent':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-accent/30 bg-monokai-accent/15 text-monokai-accent';
    case 'yellow':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-yellow/30 bg-monokai-yellow/15 text-monokai-yellow';
    case 'purple':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-purple/30 bg-monokai-purple/15 text-monokai-purple';
    case 'pink':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-pink/30 bg-monokai-pink/15 text-monokai-pink';
    case 'orange':
      return 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-orange/30 bg-monokai-orange/15 text-monokai-orange';
    default:
      return DB.iconBox;
  }
}

interface DashActionTileProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  testId?: string;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export const DashActionTile: React.FC<DashActionTileProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  testId,
  onDrop,
  onDragOver,
}) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    onDrop={onDrop}
    onDragOver={onDragOver}
    className={DB.tile}
  >
    <span className={DB.iconBox}>
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-meta font-medium text-monokai-fg group-hover:text-monokai-fg">
        {title}
      </span>
      <span className="mt-0.5 truncate font-mono text-2xs text-monokai-comment">{description}</span>
    </span>
  </button>
);

export interface DashboardKpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeTone?: DbBadgeTone;
  title?: string;
  onActivate?: (e?: React.MouseEvent) => void;
  footer?: React.ReactNode;
  chartNode?: React.ReactNode;
  iconSpinning?: boolean;
  accentTone?: DbAccentTone;
  className?: string;
  watermark?: React.ReactNode;
}

export const DashboardKpiCard: React.FC<DashboardKpiCardProps> = ({
  icon: Icon,
  label,
  value,
  hint,
  badge,
  badgeTone = 'neutral',
  title,
  onActivate,
  footer,
  chartNode,
  iconSpinning = false,
  accentTone = 'cyan',
  className = '',
  watermark,
}) => {
  const interactive = Boolean(onActivate);
  const cardClassName = `${DB.kpiCard} ${interactive ? DB.kpiCardInteractive : ''} ${className}`.trim();

  const content = (
    <>
      {watermark}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={dbAccentIconBox(accentTone)}>
            <Icon className={`h-3.5 w-3.5 ${iconSpinning ? 'animate-spin' : ''}`} />
          </span>
          <span className="truncate text-xs font-semibold tracking-wide text-monokai-fg">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {badge ? <span className={`shrink-0 ${dbBadgeClass(badgeTone)}`}>{badge}</span> : null}
          {interactive ? (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-monokai-comment opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-monokai-accent" />
          ) : null}
        </div>
      </div>

      <div className="relative z-10 mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className={DB.kpiValue}>{value}</div>
          {footer ? (
            footer
          ) : hint ? (
            <div className={`mt-0.5 ${DB.metaMono} truncate`}>{hint}</div>
          ) : null}
        </div>
        {chartNode ? <div className="shrink-0">{chartNode}</div> : null}
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div title={title} className={cardClassName}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" title={title} onClick={(e) => onActivate?.(e)} className={cardClassName}>
      {content}
    </button>
  );
};
