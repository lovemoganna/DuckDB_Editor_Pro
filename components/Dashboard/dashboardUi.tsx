/**
 * Shared Dashboard surface tokens.
 * Thin composition helpers over Workbench + Monokai — not a second button system.
 * Primary CTA = accent green fill (matches ActionButton variant="primary").
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export const DB = {
  shell: 'rounded-md border border-monokai-border bg-monokai-surface shadow-sm',
  panel: 'flex flex-col rounded-md border border-monokai-border bg-monokai-surface shadow-sm p-3',
  kpi: 'group relative flex flex-col gap-1.5 rounded-md border border-monokai-border bg-monokai-surface p-2.5 transition-colors duration-150',
  kpiInteractive:
    'hover:border-monokai-border-strong hover:bg-monokai-elevated/40 cursor-pointer',
  btnPrimary: `inline-flex items-center gap-1.5 rounded-md bg-monokai-accent px-3 py-1.5 text-xs font-semibold text-monokai-bg hover:bg-monokai-accent-hover transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnSecondary: `inline-flex items-center gap-1.5 rounded-md border border-monokai-border bg-monokai-surface px-3 py-1.5 text-xs font-medium text-monokai-fg hover:bg-monokai-hover transition-colors duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  btnGhostLink: `inline-flex items-center gap-1 rounded-md px-1 text-meta text-monokai-comment hover:text-monokai-fg transition-colors cursor-pointer ${focus}`,
  focus,
  chip: 'inline-flex items-center gap-1 rounded-md border border-monokai-border bg-monokai-elevated px-2 py-0.5 text-2xs font-mono text-monokai-fg-muted',
  segment: 'inline-flex items-center rounded-md border border-monokai-border bg-monokai-elevated p-0.5 text-2xs',
  segmentItem: `rounded-md px-2 py-0.5 cursor-pointer transition-colors text-monokai-comment hover:text-monokai-fg ${focus}`,
  segmentItemActive:
    'rounded-md px-2 py-0.5 cursor-pointer transition-colors bg-monokai-accent/20 text-monokai-accent font-semibold',
  iconBox:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-monokai-border bg-monokai-elevated text-monokai-fg-muted',
  sectionTitle: 'text-xs font-semibold tracking-wide text-monokai-fg',
  sectionMeta: 'text-2xs font-mono text-monokai-comment',
  meta: 'text-meta text-monokai-comment',
  body: 'text-meta text-monokai-fg-muted',
  value: 'text-base font-semibold tracking-tight font-mono text-monokai-fg',
  input: `w-full rounded-md border border-monokai-border bg-monokai-elevated py-1 pl-7 pr-7 text-meta font-mono text-monokai-fg placeholder:text-monokai-comment focus:border-monokai-accent/70 focus:outline-none focus:ring-1 focus:ring-monokai-accent/20 transition-colors ${focus}`,
  tile: `group flex items-start gap-2.5 rounded-md border border-monokai-border bg-monokai-elevated p-2 text-left shadow-2xs transition-colors duration-150 hover:border-monokai-border-strong hover:bg-monokai-border/40 cursor-pointer ${focus}`,
  statusDotOk: 'h-1.5 w-1.5 rounded-full bg-monokai-accent',
  statusDotWarn: 'h-1.5 w-1.5 rounded-full bg-monokai-yellow',
} as const;

export function dbIconBox(className = ''): string {
  return `${DB.iconBox} ${className}`.trim();
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
