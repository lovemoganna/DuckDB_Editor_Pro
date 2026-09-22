/**
 * CommandRegistry - Unified Command Registry for DuckDB Studio
 * Single source of truth for Command Palette, Menus, Tooltips, and Keyboard Cheat Sheet.
 */

export interface StudioCommand {
  id: string;
  label: string;
  category: 'global' | 'query' | 'navigation' | 'tools';
  categoryLabel: string;
  shortcut?: string;
  keys?: string[];
  description: string;
  enabled: boolean;
  actionId: string;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  // Global Commands
  {
    id: 'global.command_palette',
    label: '打开命令面板',
    category: 'global',
    categoryLabel: '全局通用',
    shortcut: 'Ctrl+K',
    keys: ['Ctrl', 'K'],
    description: '搜索并执行全局命令与数据对象',
    enabled: true,
    actionId: 'open-command-palette',
  },
  {
    id: 'global.shortcuts_guide',
    label: '快捷键指南',
    category: 'global',
    categoryLabel: '全局通用',
    shortcut: 'Shift+?',
    keys: ['Shift', '?'],
    description: '打开全屏快捷键速查指南',
    enabled: true,
    actionId: 'open-keyboard-shortcuts',
  },
  {
    id: 'global.escape',
    label: '关闭当前浮层 / 取消',
    category: 'global',
    categoryLabel: '全局通用',
    shortcut: 'Esc',
    keys: ['Esc'],
    description: '关闭当前活动模态框、下拉菜单或弹出层',
    enabled: true,
    actionId: 'global-escape',
  },
  {
    id: 'global.quick_search',
    label: '快速搜索对象',
    category: 'global',
    categoryLabel: '全局通用',
    shortcut: 'Ctrl+P',
    keys: ['Ctrl', 'P'],
    description: '聚焦资源管理器搜索输入框',
    enabled: true,
    actionId: 'focus-object-search',
  },

  // Query & SQL Commands
  {
    id: 'query.run',
    label: '运行 SQL',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+Enter',
    keys: ['Ctrl', 'Enter'],
    description: '执行当前活动编辑器的 SQL 语句',
    enabled: true,
    actionId: 'workbench-run-query',
  },
  {
    id: 'query.run_selected',
    label: '运行选中 SQL',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+Shift+Enter',
    keys: ['Ctrl', 'Shift', 'Enter'],
    description: '仅执行编辑器中高亮选中的 SQL 代码段',
    enabled: true,
    actionId: 'workbench-run-selected',
  },
  {
    id: 'query.format',
    label: '格式化 SQL',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+Shift+F',
    keys: ['Ctrl', 'Shift', 'F'],
    description: '自动美化与规范化当前 SQL 代码',
    enabled: true,
    actionId: 'workbench-format-sql',
  },
  {
    id: 'query.save',
    label: '保存查询',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+S',
    keys: ['Ctrl', 'S'],
    description: '保存当前查询至本地会话历史与查询模板',
    enabled: true,
    actionId: 'workbench-save-query',
  },
  {
    id: 'query.toggle_comment',
    label: '切换代码注释',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+/',
    keys: ['Ctrl', '/'],
    description: '为当前选中行添加或移除 SQL 注释 (--)',
    enabled: true,
    actionId: 'editor-toggle-comment',
  },
  {
    id: 'query.find',
    label: '代码查找',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+F',
    keys: ['Ctrl', 'F'],
    description: '在当前 SQL 编辑器中查找文本',
    enabled: true,
    actionId: 'editor-find',
  },

  // Tools & Navigation
  {
    id: 'tools.export_database',
    label: '导出数据库资产',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '导出 DuckDB 快照 (.duckdb)、可移植包 (.zip) 或仅 Schema',
    enabled: true,
    actionId: 'open-export-database-modal',
  },
  {
    id: 'tools.workspace_backup',
    label: '工作区备份与恢复',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '安全导出或恢复完整工作区状态（带预检与覆盖保护）',
    enabled: true,
    actionId: 'open-workspace-backup-modal',
  },
  {
    id: 'tools.ai_settings',
    label: 'AI 推理设置',
    category: 'tools',
    categoryLabel: '系统设置',
    shortcut: 'Ctrl+,',
    keys: ['Ctrl', ','],
    description: '配置本地 Ollama 或云端 AI 推理模型服务',
    enabled: true,
    actionId: 'open-settings-modal',
  },
  {
    id: 'tools.query_history',
    label: '查询历史',
    category: 'tools',
    categoryLabel: '数据库工具',
    description: '查看并复用历史执行的 SQL 记录',
    enabled: true,
    actionId: 'open-query-history',
  },
  {
    id: 'tools.create_view',
    label: '新建分析视图',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '基于 SQL 查询新建逻辑视图',
    enabled: true,
    actionId: 'open-create-view-modal',
  },
  {
    id: 'tools.clear_workspace',
    label: '清空工作区资源',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '批量清理当前数据库中的数据表、视图、宏与自定义函数以及挂载文件',
    enabled: true,
    actionId: 'open-clear-workspace-modal',
  },
  {
    id: 'tools.clear_views',
    label: '清空所有视图',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '一键清空并删除当前数据库中的所有逻辑分析视图',
    enabled: true,
    actionId: 'clear-all-views',
  },
  {
    id: 'tools.clear_macros',
    label: '清空所有宏',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '一键清空并删除当前数据库中的所有宏与自定义函数',
    enabled: true,
    actionId: 'clear-all-macros',
  },
];

export class CommandRegistry {
  private static commands: StudioCommand[] = [...STUDIO_COMMANDS];

  public static getAll(): StudioCommand[] {
    return this.commands.filter(c => c.enabled);
  }

  public static getByCategory(category: StudioCommand['category']): StudioCommand[] {
    return this.commands.filter(c => c.category === category && c.enabled);
  }

  public static getCommand(id: string): StudioCommand | undefined {
    return this.commands.find(c => c.id === id);
  }

  public static dispatch(actionId: string, detail?: unknown): void {
    window.dispatchEvent(new CustomEvent(actionId, { detail }));
  }
}

export const commandRegistry = CommandRegistry;
export type AppCommand = StudioCommand;
