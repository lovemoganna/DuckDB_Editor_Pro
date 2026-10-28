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
  {
    id: 'query.explain',
    label: '生成执行计划',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+E',
    keys: ['Ctrl', 'E'],
    description: '查看物理算子拓扑图与预期开销',
    enabled: true,
    actionId: 'workbench-explain-query',
  },
  {
    id: 'query.profile',
    label: '深度剖析执行',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+Shift+A',
    keys: ['Ctrl', 'Shift', 'A'],
    description: '真实运行并量化各节点耗时与算子细节',
    enabled: true,
    actionId: 'workbench-profile-query',
  },
  {
    id: 'query.export',
    label: '导出查询结果',
    category: 'query',
    categoryLabel: 'SQL 执行与编辑',
    shortcut: 'Ctrl+Shift+E',
    keys: ['Ctrl', 'Shift', 'E'],
    description: '导出查询结果为 Parquet、CSV 或 JSON',
    enabled: true,
    actionId: 'workbench-export-results',
  },
  {
    id: 'tabs.new_tab',
    label: '新建查询 Tab',
    category: 'navigation',
    categoryLabel: '标签页与导航',
    shortcut: 'Ctrl+T',
    keys: ['Ctrl', 'T'],
    description: '在 SQL 工作台中新增空白查询标签',
    enabled: true,
    actionId: 'workbench-new-tab',
  },
  {
    id: 'tabs.close_tab',
    label: '关闭当前 Tab',
    category: 'navigation',
    categoryLabel: '标签页与导航',
    shortcut: 'Ctrl+W',
    keys: ['Ctrl', 'W'],
    description: '关闭当前活动的查询标签',
    enabled: true,
    actionId: 'workbench-close-tab',
  },
  {
    id: 'tabs.cycle_tab',
    label: '切换下一个 Tab',
    category: 'navigation',
    categoryLabel: '标签页与导航',
    shortcut: 'Ctrl+Tab',
    keys: ['Ctrl', 'Tab'],
    description: '循环切换到下一个查询标签',
    enabled: true,
    actionId: 'workbench-next-tab',
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
    id: 'tools.create_table',
    label: '新建数据表',
    category: 'tools',
    categoryLabel: '资产与维护',
    description: '通过可视化界面新建 DuckDB 数据表，自定义字段类型与约束',
    enabled: true,
    actionId: 'open-create-table-modal',
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
  {
    id: 'tools.database_manager',
    label: '数据库管理与新建',
    category: 'tools',
    categoryLabel: '资产与维护',
    shortcut: 'Ctrl+Shift+D',
    keys: ['Ctrl', 'Shift', 'D'],
    description: '新建、挂载 (ATTACH)、切换 (USE) 或管理 DuckDB 数据库',
    enabled: true,
    actionId: 'open-project-manager-modal',
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
    const cmd = this.getCommand(actionId) || this.commands.find(c => c.actionId === actionId);
    if (cmd && cmd.actionId && cmd.actionId !== actionId) {
      window.dispatchEvent(new CustomEvent(cmd.actionId, { detail }));
    }
    window.dispatchEvent(new CustomEvent(actionId, { detail }));
  }
}

export const commandRegistry = CommandRegistry;
export type AppCommand = StudioCommand;
