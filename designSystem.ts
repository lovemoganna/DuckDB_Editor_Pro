/**
 * Design System Constants — SegmentedTabs tones, z-index, empty copy.
 *
 * Visual values (color / spacing / radius) live in index.css `:root`.
 * Prefer Workbench primitives (ActionButton, ModalShell, DrawerShell, FormInput)
 * over ad-hoc Tailwind overlays.
 *
 * @usage
 *   import { DESIGN_SYSTEM } from './designSystem';
 *   <SegmentedTabs {...DESIGN_SYSTEM.TABS.PRIMARY} />
 */

export const DESIGN_SYSTEM = {
  /**
   * 全局 TAB 设计规范 — 配合 Workbench SegmentedTabs
   */
  TABS: {
    PRIMARY: {
      tone: 'accent' as const,
      size: 'sm' as const,
    },
    SECONDARY: {
      tone: 'accent' as const,
      size: 'sm' as const,
    },
    FUNCTIONAL: {
      tone: 'accent' as const,
      size: 'sm' as const,
    },
    VIEW_SWITCH: {
      tone: 'accent' as const,
      size: 'md' as const,
    },
  },

  /** 模块语义 tone — 配合 SegmentedTabs tone prop */
  MODULE_TONES: {
    database: 'accent' as const,
    analytics: 'accent' as const,
    knowledge: 'amethyst' as const,
    capability: 'pink' as const,
  },

  /**
   * Z-Index — aligned with index.css (.modal-backdrop 9998, .toast 10000)
   */
  Z_INDEX: {
    BASE: 0,
    DROPDOWN: 20,
    STICKY: 30,
    POPOVER: 60,
    TOOLTIP: 70,
    MODAL_BACKDROP: 9998,
    MODAL: 9999,
    TOAST: 10000,
    CRITICAL: 9999,
  },

  /** Spacing — mirrors CSS --space-* (8px grid) */
  SPACING: {
    xs: 'var(--space-1)',  // 4px
    sm: 'var(--space-2)',  // 8px
    md: 'var(--space-4)',  // 16px
    lg: 'var(--space-5)',  // 24px
    xl: 'var(--space-6)',  // 32px
  },

  TRANSITION: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
} as const;

export const MODULE_SECTIONS = {
  '数据工程': 'database',
  '分析洞察': 'analytics',
  '知识网络': 'knowledge',
  'AI 认知': 'capability',
} as const;

/**
 * 统一空状态文案格式："请[操作]以[结果]"
 */
export const EMPTY_STATE_MESSAGES = {
  DATA: {
    title: '未选择数据表',
    description: '在左侧边栏单击选择一张已有数据表以进行流式浏览，或使用下方快捷动作快速开始分析。',
  },
  SCHEMA: {
    title: '未选择数据表',
    description: '请从下方快捷列表选择一张表，或切换到 ER 关系图谱点选节点，以探索字段详情与 DDL 架构。',
  },
  SQL: {
    title: 'SQL 编辑器就绪',
    description: '在下方输入 SQL 查询语句，或使用左侧快捷模板',
  },
  HISTORY: {
    title: '暂无查询历史',
    description: '在 SQL 编辑器中运行查询后，此处将自动记录完整的执行代码、运行耗时与成功状态',
  },
  METRICS: {
    title: '暂无语义指标',
    description: '通过 AI 辅助分析数据后，系统将自动生成可复用的语义指标定义',
  },
} as const;
