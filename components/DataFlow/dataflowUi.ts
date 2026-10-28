/**
 * DataFlow UI 共享规范（MECE）
 *
 * 仅收敛本板块内已分裂的 class 写法，不引入新设计体系。
 * 字号策略：正文字号略收紧（meta/2xs/3xs），提高信息密度。
 * 交互：统一 focus ring、按钮高度 28px、面板头 36px。
 */

/** 面板壳 */
export const dfShell =
  'dataflow-shell flex h-full w-full flex-col overflow-hidden bg-monokai-bg text-monokai-fg font-sans text-xs select-none';

/** 统一顶栏 / 侧栏头：36px */
export const dfPanelHeader =
  'flex h-9 shrink-0 items-center justify-between border-b border-monokai-border px-3 bg-monokai-sidebar/80';

export const dfPanelTitle =
  'flex items-center gap-1.5 text-xs font-semibold text-monokai-fg font-mono tracking-tight';

/** 画布工具栏岛 */
export const dfToolbarIsland =
  'flex items-center gap-0.5 rounded-md border border-monokai-border bg-monokai-surface/95 p-0.5 shadow-lg backdrop-blur-md font-mono text-2xs';

const dfFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export const dfIconBtn =
  `p-1.5 rounded-md text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${dfFocus}`;

export const dfIconBtnActive =
  `p-1.5 rounded-md bg-monokai-accent/20 text-monokai-accent font-semibold transition-colors cursor-pointer ${dfFocus}`;

export const dfDividerV = 'h-3.5 w-px bg-monokai-border mx-0.5 shrink-0';

/** Tab 下划线式 */
export const dfTabBase =
  'relative flex h-full items-center gap-1.5 text-2xs font-medium transition-colors cursor-pointer';

export const dfTabActive = 'text-monokai-accent font-semibold';
export const dfTabIdle = 'text-monokai-comment hover:text-monokai-fg';
export const dfTabUnderline = 'absolute bottom-0 left-0 right-0 h-0.5 bg-monokai-accent';

/** 表单 */
export const dfLabel = 'block text-2xs font-medium text-monokai-comment mb-1';

export const dfInput =
  `w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1 text-meta font-mono text-monokai-fg outline-none placeholder:text-monokai-comment focus:border-monokai-accent/70 transition-colors ${dfFocus}`;

export const dfSelect =
  `h-7 w-full rounded-md border border-monokai-border bg-monokai-surface px-1.5 text-meta font-mono text-monokai-fg outline-none cursor-pointer focus:border-monokai-accent/70 ${dfFocus}`;

export const dfTextarea =
  `w-full rounded-md border border-monokai-border bg-monokai-bg px-2 py-1.5 text-meta font-mono text-monokai-fg outline-none placeholder:text-monokai-comment focus:border-monokai-accent/70 resize-y min-h-[72px] ${dfFocus}`;

/** 按钮 — primary = accent green，与 Workbench ActionButton 一致 */
export const dfBtnPrimary =
  `inline-flex items-center justify-center gap-1.5 h-7 rounded-md bg-monokai-accent px-2.5 text-xs font-semibold text-[var(--dataflow-on-accent)] hover:bg-monokai-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm ${dfFocus}`;

export const dfBtnSecondary =
  `inline-flex items-center justify-center gap-1 h-7 rounded-md border border-monokai-border bg-monokai-surface/70 px-2 text-xs text-monokai-fg hover:bg-monokai-elevated cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${dfFocus}`;

export const dfBtnGhost =
  `inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-elevated cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${dfFocus}`;

export const dfBtnDanger =
  `inline-flex items-center justify-center gap-1 h-7 rounded-md border border-monokai-pink/40 bg-monokai-pink/10 px-2 text-xs text-monokai-pink hover:bg-monokai-pink/20 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${dfFocus}`;

export const dfBtnWarn =
  `inline-flex items-center justify-center gap-1.5 h-7 rounded-md border border-monokai-pink/60 bg-monokai-pink/20 px-2.5 text-xs font-semibold text-monokai-pink hover:bg-monokai-pink/30 cursor-pointer transition-colors shadow-[0_0_12px_color-mix(in_srgb,var(--monokai-pink)_25%,transparent)] ${dfFocus}`;

/** 下拉菜单项 */
export const dfMenuPanel =
  'absolute z-50 mt-1.5 flex flex-col gap-0.5 rounded-md border border-monokai-border bg-monokai-surface p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 font-sans text-xs';

export const dfMenuItem =
  `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-monokai-fg hover:bg-monokai-elevated transition-colors cursor-pointer ${dfFocus}`;

/** 分区 / 卡片 */
export const dfSection = 'space-y-2';
export const dfSectionTitle =
  'text-2xs font-semibold text-monokai-comment tracking-wide';

/** 属性抽屉分区标题（对齐本体图谱实体画布属性面板） */
export const dfDrawerSectionLabel =
  'text-meta text-monokai-comment font-semibold';

/** 属性抽屉快捷操作格 */
export const dfDrawerActionTile =
  `flex flex-col items-center justify-center gap-1 p-2 text-xs bg-monokai-sidebar hover:bg-monokai-surface text-monokai-fg-muted font-bold rounded-lg transition-colors border border-monokai-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${dfFocus}`;

export const dfCard =
  'rounded-md border border-monokai-border bg-monokai-bg/70 p-2';

export const dfChip =
  'inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-2xs font-mono';

/** 状态微点 */
export const dfStatusDot =
  'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-monokai-accent shadow-[0_0_5px_color-mix(in_srgb,var(--monokai-accent)_60%,transparent)]';

export const dfStatusDotIdle =
  'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-monokai-comment/50';

/** 空态 */
export const dfEmpty =
  'flex flex-col items-center justify-center h-full py-6 px-4 text-center gap-1.5 text-monokai-comment';

export const dfEmptyTitle = 'text-xs font-sans text-monokai-fg';
export const dfEmptyHint = 'text-2xs text-monokai-comment/80 font-sans max-w-sm leading-relaxed';

/** 画布顶部异常条（分屏 Inspector 未开时仍可完成「回 SQL」） */
export const dfFaultBanner =
  'absolute top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-monokai-pink/45 bg-monokai-surface/95 px-2.5 py-1.5 shadow-lg backdrop-blur-md font-mono text-2xs max-w-[min(92%,420px)]';

/** 同步中顶栏进度 */
export const dfSyncBar =
  'absolute top-0 left-0 right-0 z-30 h-0.5 overflow-hidden bg-monokai-border/40';

export const dfSyncBarFill =
  'h-full w-1/3 animate-pulse bg-monokai-accent/80';

/** 表格 */
export const dfTable =
  'w-full text-left font-mono text-2xs border-collapse';

export const dfTableHead =
  'sticky top-0 z-10 border-b border-monokai-border bg-monokai-elevated/95 text-monokai-comment backdrop-blur-sm';

export const dfTableRow =
  'border-b border-monokai-border/30 hover:bg-monokai-elevated/40 transition-colors';

/** 模式胶囊 */
export const dfModePillGroup =
  'flex items-center rounded-md bg-monokai-surface/60 border border-monokai-border/80 p-0.5 font-mono text-2xs';

export const dfModePillActive =
  'flex items-center gap-1 px-2 py-0.5 rounded bg-monokai-elevated text-monokai-accent font-semibold shadow-xs cursor-pointer';

export const dfModePillIdle =
  'flex items-center gap-1 px-2 py-0.5 rounded text-monokai-comment hover:text-monokai-fg cursor-pointer transition-colors';

/** 画布背景（与 token 对齐，禁止裸 hex） */
export const dfCanvasBg = 'bg-monokai-bg';
export const dfChromeBg = 'bg-monokai-sidebar';

/** SVG / 内联样式色值（走 CSS 变量，随主题切换） */
export const DF_COLOR = {
  bg: 'var(--monokai-bg)',
  surface: 'var(--monokai-surface)',
  elevated: 'var(--monokai-elevated)',
  border: 'var(--monokai-border)',
  fg: 'var(--monokai-fg)',
  comment: 'var(--monokai-comment)',
  accent: 'var(--monokai-accent)',
  cyan: 'var(--monokai-cyan)',
  pink: 'var(--monokai-pink)',
  yellow: 'var(--monokai-yellow)',
  orange: 'var(--monokai-orange)',
  purple: 'var(--monokai-purple)',
  edgeIdle: 'var(--monokai-edge-idle)',
  edgeMuted: 'var(--monokai-edge-muted)',
  handleRing: 'var(--monokai-handle-ring)',
} as const;

/** Shared status wording for node cards, inspector, and execution feedback. */
export const DF_STATUS_LABEL: Record<string, string> = {
  idle: '待配置', configured: '待执行', dirty: '需重跑', queued: '排队中',
  running: '执行中', success: '已执行', error: '失败', blocked: '依赖阻塞', cancelled: '已取消',
};
