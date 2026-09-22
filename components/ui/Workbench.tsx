/**
 * Workbench UI kit — single source for chrome primitives.
 * Rules: monokai-* / CSS vars only; overlays via ModalShell / DrawerShell;
 * forms via FormInput / FormSelect / FormTextarea; body copy defaults to text-xs.
 */
import React, { useEffect, useId, useRef } from 'react';
import { LucideIcon, Loader2, Search, X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export type WorkbenchDensity = 'comfortable' | 'compact';

export interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  density?: WorkbenchDensity;
  scroll?: 'page' | 'content' | 'none';
}

/** PageShell is the common content boundary for every workspace feature. */
export const PageShell: React.FC<PageShellProps> = ({
  density = 'comfortable',
  scroll = 'content',
  className = '',
  children,
  ...props
}) => (
  <main
    data-density={density}
    data-scroll={scroll}
    className={`workbench-page flex min-h-0 flex-1 flex-col bg-monokai-bg text-monokai-fg text-xs font-sans ${
      scroll === 'page' ? 'overflow-y-auto' : scroll === 'content' ? 'overflow-hidden' : ''
    } ${className}`}
    {...props}
  >
    {children}
  </main>
);

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'primary' | 'danger' | 'warning' | 'success' | 'amethyst';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className = '',
  title,
  ...props
}) => {
  const toneClass =
    tone === 'danger'
      ? 'text-monokai-pink hover:bg-monokai-pink/15'
      : tone === 'primary'
      ? 'text-monokai-accent hover:bg-monokai-accent/15'
      : tone === 'warning'
      ? 'text-monokai-yellow hover:bg-monokai-yellow/15'
      : tone === 'success'
      ? 'text-monokai-green hover:bg-monokai-green/15'
      : tone === 'amethyst'
      ? 'text-monokai-amethyst hover:bg-monokai-amethyst/15'
      : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/80';

  const sizeClass =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-4.5 w-4.5';

  return (
    <button
      type="button"
      aria-label={label}
      title={title || label}
      className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg cursor-pointer transition-colors duration-150 ${sizeClass} ${toneClass} ${focusRing} ${className}`}
      {...props}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </button>
  );
};

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'amethyst';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}, ref) => {
  const variantClass =
    variant === 'primary'
      ? 'bg-monokai-accent text-monokai-bg font-semibold hover:bg-monokai-accent-hover shadow-xs'
      : variant === 'success'
      ? 'bg-monokai-green/15 text-monokai-green font-semibold hover:bg-monokai-green/25'
      : variant === 'warning'
      ? 'bg-monokai-yellow/15 text-monokai-yellow font-semibold hover:bg-monokai-yellow/25'
      : variant === 'danger'
      ? 'bg-monokai-pink/15 text-monokai-pink font-semibold hover:bg-monokai-pink/25'
      : variant === 'amethyst'
      ? 'bg-monokai-amethyst/15 text-monokai-amethyst font-semibold hover:bg-monokai-amethyst/25'
      : variant === 'ghost'
      ? 'bg-transparent text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface/60'
      : 'bg-monokai-surface text-monokai-fg font-medium hover:bg-monokai-hover';

  const sizeClass =
    size === 'sm'
      ? 'h-8 px-2.5 text-xs gap-1.5 rounded-lg'
      : size === 'lg'
      ? 'h-10 px-4.5 text-sm gap-2 rounded-lg font-semibold'
      : 'h-9 px-3.5 text-xs gap-2 rounded-lg font-medium';

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-sans cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${focusRing} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : Icon && iconPosition === 'left' && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </button>
  );
});
ActionButton.displayName = 'ActionButton';

/** Toolbar — compact command strip shared by all workbench surfaces. */
export const Toolbar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div
    role="toolbar"
    className={`flex min-h-12 items-center gap-2.5 border-b border-monokai-border/80 bg-monokai-surface px-4 py-2 font-sans ${className}`}
    {...props}
  />
);

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

export interface SegmentedTabsProps<T extends string> {
  value: T;
  items: readonly SegmentedTab<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  tone?: 'accent' | 'yellow' | 'green' | 'amethyst' | 'pink' | 'cyan' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TONE_TEXT_MAP: Record<NonNullable<SegmentedTabsProps<string>['tone']>, string> = {
  accent: 'text-monokai-accent',
  yellow: 'text-monokai-yellow',
  green: 'text-monokai-green',
  amethyst: 'text-monokai-amethyst',
  pink: 'text-monokai-pink',
  cyan: 'text-monokai-cyan',
  orange: 'text-monokai-orange',
};

const TONE_BADGE_MAP: Record<NonNullable<SegmentedTabsProps<string>['tone']>, string> = {
  accent: 'bg-monokai-accent/20 text-monokai-accent',
  yellow: 'bg-monokai-yellow/20 text-monokai-yellow',
  green: 'bg-monokai-green/20 text-monokai-green',
  amethyst: 'bg-monokai-amethyst/20 text-monokai-amethyst',
  pink: 'bg-monokai-pink/20 text-monokai-pink',
  cyan: 'bg-monokai-cyan/20 text-monokai-cyan',
  orange: 'bg-monokai-orange/20 text-monokai-orange',
};

export function SegmentedTabs<T extends string>({
  value,
  items,
  onChange,
  tone = 'accent',
  size = 'md',
  className = '',
  ...props
}: SegmentedTabsProps<T>) {
  const containerClass =
    size === 'sm'
      ? 'h-7.5 p-0.5'
      : size === 'lg'
      ? 'h-10 p-1'
      : 'h-8 p-0.5';

  const itemClass =
    size === 'sm'
      ? 'h-6.5 px-2.5 text-[10px]'
      : size === 'lg'
      ? 'h-8 px-3.5 text-xs'
      : 'h-7 px-2.5 text-[11px]';

  const toneText = TONE_TEXT_MAP[tone] || TONE_TEXT_MAP.accent;
  const toneBadge = TONE_BADGE_MAP[tone] || TONE_BADGE_MAP.accent;

  return (
    <div
      role="tablist"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-gradient-to-b from-monokai-sidebar/85 to-monokai-sidebar/70 font-sans border border-monokai-border/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${containerClass} ${className}`}
      {...props}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const targetIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                ? items.length - 1
                : event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : (index - 1 + items.length) % items.length;
              onChange(items[targetIndex].value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              buttons?.[targetIndex]?.focus();
            }}
            className={`group relative inline-flex items-center gap-1 rounded-md font-medium cursor-pointer transition-all duration-150 select-none ${itemClass} ${focusRing} ${
              active
                ? `bg-gradient-to-b from-monokai-surface to-monokai-surface/90 text-monokai-fg shadow-sm font-semibold border border-monokai-border/60`
                : 'text-monokai-comment/80 hover:bg-monokai-surface/50 hover:text-monokai-fg border border-transparent'
            }`}
          >
            {/* Active indicator bar */}
            {active && (
              <span className={`absolute left-1 right-1 top-0 h-px bg-current opacity-40 rounded-full ${toneText}`} />
            )}
            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                  active ? toneText : 'text-monokai-comment group-hover:text-monokai-fg'
                }`}
                aria-hidden="true"
              />
            )}
            <span className="tracking-tight">{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`ml-0.5 rounded px-1 py-0.2 text-[9px] font-mono font-bold ${
                  active ? toneBadge : 'bg-monokai-sidebar text-monokai-comment/70'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  size?: 'sm' | 'md';
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = '搜索...',
  size = 'md',
  className = '',
  ...props
}) => {
  const heightClass = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-xs';

  return (
    <div className={`relative flex items-center min-w-[150px] max-w-sm ${className}`}>
      <Search className="absolute left-3 h-4 w-4 text-monokai-comment pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-8 rounded-lg bg-monokai-surface text-monokai-fg placeholder-monokai-comment/60 font-sans transition-all focus:outline-none focus:ring-1 focus:ring-monokai-accent ${heightClass}`}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          className="absolute right-2.5 text-monokai-comment hover:text-monokai-fg cursor-pointer p-0.5 transition-colors"
          aria-label="清空搜索"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export type WorkbenchTone = 'accent' | 'yellow' | 'green' | 'amethyst' | 'pink' | 'orange';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: WorkbenchTone;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
}

const getToneStyles = (tone: WorkbenchTone) => {
  switch (tone) {
    case 'amethyst':
      return {
        boxClass: 'bg-monokai-amethyst/10 text-monokai-amethyst',
      };
    case 'pink':
      return {
        boxClass: 'bg-monokai-pink/10 text-monokai-pink',
      };
    case 'yellow':
      return {
        boxClass: 'bg-monokai-yellow/10 text-monokai-yellow',
      };
    case 'green':
      return {
        boxClass: 'bg-monokai-green/10 text-monokai-green',
      };
    case 'orange':
      return {
        boxClass: 'bg-monokai-orange/10 text-monokai-orange',
      };
    case 'accent':
    default:
      return {
        boxClass: 'bg-monokai-accent/10 text-monokai-accent',
      };
  }
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  tone = 'accent',
  badge,
  actions,
  sticky = true,
  className = '',
  children,
  ...props
}) => {
  const toneStyle = getToneStyles(tone);

  return (
    <header
      className={`relative flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-monokai-border bg-monokai-sidebar px-5 sm:px-6 py-3 font-sans select-none z-10 ${
        sticky ? 'sticky top-0' : ''
      } ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyle.boxClass}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-base sm:text-lg font-bold text-monokai-fg tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && <p className="hidden sm:block truncate text-xs text-monokai-comment/85 mt-0.5 leading-tight">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">{actions || children}</div>
    </header>
  );
};

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: WorkbenchTone;
  actions?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  description,
  icon: Icon,
  tone = 'accent',
  actions,
  className = '',
  children,
  ...props
}) => {
  const toneStyle = getToneStyles(tone);

  return (
    <div className={`flex min-h-12 items-center justify-between gap-4 border-b border-monokai-border bg-monokai-surface px-4 py-2 font-sans ${className}`} {...props}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneStyle.boxClass}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-monokai-fg">{title}</h2>
          {description && <p className="mt-0.5 truncate text-xs text-monokai-comment">{description}</p>}
        </div>
      </div>
      {(actions || children) && <div className="flex shrink-0 items-center gap-2">{actions || children}</div>}
    </div>
  );
};

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
  secondaryAction,
  className = '',
  ...props
}) => (
  <div className={`flex min-h-52 flex-col items-center justify-center rounded-lg bg-monokai-surface/40 px-6 py-10 text-center font-sans ${className}`} {...props}>
    {Icon && (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-monokai-sidebar text-monokai-comment mb-3.5">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
    )}
    <h3 className="text-xs font-semibold text-monokai-fg">{title}</h3>
    {description && <p className="mt-1.5 max-w-md text-meta text-monokai-comment leading-relaxed">{description}</p>}
    {(action || secondaryAction) && (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
);

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: WorkbenchDensity;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  density = 'comfortable',
  className = '',
  children,
  ...props
}) => (
  <div
    role="group"
    data-density={density}
    className={`workbench-filter-bar flex shrink-0 flex-wrap items-center border-b border-monokai-border/80 bg-monokai-surface/70 px-4 ${
      density === 'compact' ? 'min-h-10 gap-1.5 py-1.5' : 'min-h-12 gap-2.5 py-2'
    } ${className}`}
    {...props}
  >
    {children}
  </div>
);

export type WorkbenchStatus = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'ai';

const statusClasses: Record<WorkbenchStatus, string> = {
  neutral: 'bg-monokai-surface text-monokai-comment',
  info: 'bg-monokai-accent/15 text-monokai-accent',
  success: 'bg-monokai-green/15 text-monokai-green',
  warning: 'bg-monokai-yellow/15 text-monokai-yellow',
  error: 'bg-monokai-pink/15 text-monokai-pink',
  ai: 'bg-monokai-amethyst/15 text-monokai-amethyst',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: WorkbenchStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'neutral',
  className = '',
  children,
  ...props
}) => (
  <span
    className={`inline-flex min-h-5 items-center rounded-md px-2 py-0.5 text-meta font-semibold leading-none ${statusClasses[status]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'ai';
}

const statToneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'text-monokai-fg',
  info: 'text-monokai-accent',
  success: 'text-monokai-green',
  warning: 'text-monokai-yellow',
  danger: 'text-monokai-pink',
  ai: 'text-monokai-amethyst',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  className = '',
  ...props
}) => (
  <div className={`workbench-stat-card flex min-h-24 items-start justify-between gap-4 rounded-lg bg-monokai-surface p-4 ${className}`} {...props}>
    <div className="min-w-0">
      <p className="text-xs font-medium text-monokai-comment">{label}</p>
      <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${statToneClasses[tone]}`}>{value}</div>
      {description && <p className="mt-1 text-[11px] text-monokai-comment">{description}</p>}
    </div>
    {Icon && (
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-current/10 ${statToneClasses[tone]}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
    )}
  </div>
);

export interface ModalShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  className?: string;
  autoFocus?: boolean;
  headerActions?: React.ReactNode;
  badge?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

const modalSizeClasses: Record<NonNullable<ModalShellProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  closeLabel = '关闭',
  className = '',
  autoFocus = true,
  headerActions,
  badge,
  icon: Icon,
  iconColor = 'text-monokai-accent',
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (autoFocus !== false) {
      const autoFocusTarget = panel?.querySelector<HTMLElement>('[autofocus]');
      if (autoFocusTarget) {
        autoFocusTarget.focus();
      } else {
        const firstInput = panel?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])');
        (firstInput || panel?.querySelector<HTMLElement>('button:not([disabled])') || panel)?.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, autoFocus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-lg border border-monokai-border bg-monokai-sidebar shadow-2xl ${modalSizeClasses[size]} ${className}`}
      >
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-monokai-border/80 bg-monokai-surface px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-monokai-accent/15 border border-monokai-accent/30">
                <Icon className={`h-4.5 w-4.5 ${iconColor}`} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="break-words text-base font-semibold text-monokai-fg">{title}</h2>
                {badge && (
                  <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              {description && <p className="mt-1 text-xs text-monokai-comment truncate">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button type="button" onClick={onClose} className={`flex h-9 w-9 items-center justify-center rounded-lg text-monokai-comment hover:bg-monokai-bg hover:text-monokai-fg ${focusRing}`} aria-label={closeLabel} title={closeLabel}>
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">{children}</div>
        {footer && <footer className="flex flex-wrap min-h-14 shrink-0 items-center justify-end gap-2 border-t border-monokai-border/80 bg-monokai-surface px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
};

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tone?: 'neutral' | 'accent' | 'danger';
  sizeVariant?: 'sm' | 'md' | 'lg';
  fontVariant?: 'sans' | 'mono';
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(({
  tone = 'neutral',
  sizeVariant = 'md',
  fontVariant = 'sans',
  className = '',
  ...props
}, ref) => {
  const toneClasses =
    tone === 'danger'
      ? 'border-monokai-pink/60 focus:border-monokai-pink focus:ring-monokai-pink/30 text-monokai-pink'
      : 'border-monokai-border/80 focus:border-monokai-accent focus:ring-monokai-accent/30 text-monokai-fg';

  const sizeClasses =
    sizeVariant === 'sm'
      ? 'px-2.5 py-1.5 text-xs'
      : sizeVariant === 'lg'
      ? 'px-4 py-2.5 text-sm'
      : 'px-3.5 py-2 text-xs';

  const fontClasses = fontVariant === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <input
      ref={ref}
      className={`w-full rounded-lg bg-monokai-surface placeholder-monokai-comment/60 border transition-all focus:outline-none focus:ring-2 ${fontClasses} ${sizeClasses} ${toneClasses} ${className}`}
      {...props}
    />
  );
});
FormInput.displayName = 'FormInput';

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  sizeVariant?: 'sm' | 'md' | 'lg';
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(({
  sizeVariant = 'md',
  className = '',
  children,
  ...props
}, ref) => {
  const sizeClasses =
    sizeVariant === 'sm'
      ? 'h-8 px-2.5 text-xs'
      : sizeVariant === 'lg'
      ? 'h-10 px-4 text-sm'
      : 'h-9 px-3.5 text-xs';

  return (
    <select
      ref={ref}
      className={`w-full rounded-lg border border-monokai-border/80 bg-monokai-surface text-monokai-fg font-sans transition-all focus:outline-none focus:ring-2 focus:border-monokai-accent focus:ring-monokai-accent/30 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
FormSelect.displayName = 'FormSelect';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: 'neutral' | 'accent' | 'danger';
  sizeVariant?: 'sm' | 'md' | 'lg';
  fontVariant?: 'sans' | 'mono';
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(({
  tone = 'neutral',
  sizeVariant = 'md',
  fontVariant = 'sans',
  className = '',
  ...props
}, ref) => {
  const toneClasses =
    tone === 'danger'
      ? 'border-monokai-pink/60 focus:border-monokai-pink focus:ring-monokai-pink/30 text-monokai-pink'
      : 'border-monokai-border/80 focus:border-monokai-accent focus:ring-monokai-accent/30 text-monokai-fg';

  const sizeClasses =
    sizeVariant === 'sm'
      ? 'px-2.5 py-1.5 text-xs min-h-[72px]'
      : sizeVariant === 'lg'
      ? 'px-4 py-2.5 text-sm min-h-[120px]'
      : 'px-3.5 py-2 text-xs min-h-[96px]';

  const fontClasses = fontVariant === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <textarea
      ref={ref}
      className={`w-full rounded-lg bg-monokai-surface placeholder-monokai-comment/60 border transition-all focus:outline-none focus:ring-2 resize-y ${fontClasses} ${sizeClasses} ${toneClasses} ${className}`}
      {...props}
    />
  );
});
FormTextarea.displayName = 'FormTextarea';

export interface DrawerShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'right' | 'left' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  headerActions?: React.ReactNode;
}

const drawerSizeClasses: Record<
  NonNullable<DrawerShellProps['side']>,
  Record<NonNullable<DrawerShellProps['size']>, string>
> = {
  right: {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-2xl',
  },
  left: {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-2xl',
  },
  bottom: {
    sm: 'h-[40vh] max-h-[40vh]',
    md: 'h-[55vh] max-h-[55vh]',
    lg: 'h-[70vh] max-h-[70vh]',
    xl: 'h-[85vh] max-h-[85vh]',
  },
};

export const DrawerShell: React.FC<DrawerShellProps> = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  side = 'right',
  size = 'md',
  closeLabel = '关闭',
  className = '',
  contentClassName = '',
  headerActions,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (firstFocusable || panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const sidePosition =
    side === 'left'
      ? 'inset-y-0 left-0 border-r'
      : side === 'bottom'
      ? 'inset-x-0 bottom-0 border-t rounded-t-lg'
      : 'inset-y-0 right-0 border-l';

  const flexDirection = side === 'bottom' ? 'flex-col' : 'flex-col';

  return (
    <div
      className="fixed inset-0 z-[200] flex bg-black/65"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed ${sidePosition} ${drawerSizeClasses[side][size]} flex ${flexDirection} overflow-hidden border-monokai-border bg-monokai-sidebar shadow-2xl ${className}`}
      >
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-monokai-border/80 bg-monokai-surface px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-semibold text-monokai-fg">{title}</h2>
            {description && <p className="mt-0.5 truncate text-xs text-monokai-comment">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-monokai-comment hover:bg-monokai-bg hover:text-monokai-fg ${focusRing}`}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar text-xs ${contentClassName}`}>{children}</div>
        {footer && (
          <footer className="flex flex-wrap min-h-12 shrink-0 items-center justify-end gap-2 border-t border-monokai-border/80 bg-monokai-surface px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export type InlineAlertTone = 'info' | 'success' | 'warning' | 'error';

export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: InlineAlertTone;
  title?: string;
  icon?: LucideIcon;
}

const inlineAlertStyles: Record<InlineAlertTone, { wrap: string; icon: string }> = {
  info: { wrap: 'border-monokai-cyan/30 bg-monokai-cyan/10 text-monokai-cyan', icon: 'text-monokai-cyan' },
  success: { wrap: 'border-monokai-accent/30 bg-monokai-accent/10 text-monokai-accent', icon: 'text-monokai-accent' },
  warning: { wrap: 'border-monokai-yellow/30 bg-monokai-yellow/10 text-monokai-yellow', icon: 'text-monokai-yellow' },
  error: { wrap: 'border-monokai-pink/30 bg-monokai-pink/10 text-monokai-pink', icon: 'text-monokai-pink' },
};

const inlineAlertIcons: Record<InlineAlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  tone = 'info',
  title,
  icon,
  className = '',
  children,
  ...props
}) => {
  const Icon = icon || inlineAlertIcons[tone];
  const styles = inlineAlertStyles[tone];
  return (
    <div
      role="status"
      className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-sans ${styles.wrap} ${className}`}
      {...props}
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true" />
      <div className="min-w-0 text-monokai-fg">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children && <div className="text-monokai-fg-muted leading-relaxed">{children}</div>}
      </div>
    </div>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'amethyst';
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'amethyst' | 'accent' | 'pink' | 'yellow' | 'green' | 'blue';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  tone,
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const effectiveVariant = tone || variant;
  const variantClasses = {
    neutral: 'bg-monokai-surface text-monokai-comment',
    primary: 'bg-monokai-green/15 text-monokai-green',
    accent: 'bg-monokai-accent/15 text-monokai-accent',
    success: 'bg-monokai-green/15 text-monokai-green',
    green: 'bg-monokai-green/15 text-monokai-green',
    warning: 'bg-monokai-yellow/15 text-monokai-yellow',
    yellow: 'bg-monokai-yellow/15 text-monokai-yellow',
    danger: 'bg-monokai-pink/15 text-monokai-pink',
    pink: 'bg-monokai-pink/15 text-monokai-pink',
    info: 'bg-monokai-blue/15 text-monokai-blue',
    blue: 'bg-monokai-blue/15 text-monokai-blue',
    amethyst: 'bg-monokai-amethyst/15 text-monokai-amethyst',
  }[effectiveVariant] || 'bg-monokai-surface text-monokai-comment';

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium rounded ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export interface WorkbenchLoadingStateProps {
  label?: string;
  message?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export const WorkbenchLoadingState: React.FC<WorkbenchLoadingStateProps> = ({
  label,
  message,
  description,
  className = '',
  compact = false,
}) => {
  const displayMessage = label || message || '正在加载工作区...';
  const resolvedDescription =
    description === undefined
      ? (compact ? undefined : 'DuckDB 正在准备数据与执行环境')
      : description || undefined;
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 text-center bg-monokai-bg font-sans ${
        compact ? 'h-full min-h-0 p-4' : 'min-h-[320px] h-full p-8'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative flex items-center justify-center ${compact ? 'h-8 w-8' : 'h-12 w-12'}`}>
        <div className="absolute inset-0 rounded-full border-2 border-monokai-accent/20 animate-ping" />
        <div
          className={`rounded-full border-2 border-monokai-accent border-t-transparent animate-spin ${
            compact ? 'h-5 w-5' : 'h-8 w-8'
          }`}
        />
      </div>
      <p className={`font-semibold text-monokai-fg ${compact ? 'text-meta' : 'text-xs'}`}>{displayMessage}</p>
      {resolvedDescription && (
        <p className="text-meta text-monokai-comment max-w-sm">{resolvedDescription}</p>
      )}
    </div>
  );
};

/** Cross-module jump chip — shared by Data / Schema / Analysis surfaces. */
export const NavJumpChip: React.FC<{
  label: string;
  title: string;
  toneClass: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, title, toneClass, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-monokai-surface hover:bg-monokai-elevated border border-monokai-border text-meta cursor-pointer transition-colors ${focusRing} ${toneClass}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
