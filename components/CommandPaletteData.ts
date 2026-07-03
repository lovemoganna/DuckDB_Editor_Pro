/**
 * CommandPaletteData - Data layer for CommandPalette
 *
 * Provides command definitions, table data, and fuzzy search logic.
 */

import { AISkill } from '../types';
import { OntologyCommand } from '../hooks/useOntologyStore';

// ============================================================
// Command types
// ============================================================

export interface CommandItem {
  id: string;
  type: 'action' | 'navigation' | 'table' | 'skill' | 'ontology';
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  tab?: string;
  skillId?: string;
  ontologyCommand?: OntologyCommand;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

// ============================================================
// Built-in commands
// ============================================================

export const BUILT_IN_COMMANDS: CommandItem[] = [
  // Navigation
  { id: 'nav-dashboard', type: 'navigation', label: '回到主页', description: '切换到 Dashboard', tab: 'dashboard' },
  { id: 'nav-data', type: 'navigation', label: '数据视图', description: '切换到 Data Tab', tab: 'data' },
  { id: 'nav-structure', type: 'navigation', label: '结构视图', description: '切换到 Schema Tab', tab: 'structure' },
  { id: 'nav-sql', type: 'navigation', label: 'SQL 编辑器', description: '切换到 SQL Tab', tab: 'sql' },
  { id: 'nav-metrics', type: 'navigation', label: '指标管理', description: '切换到 Metrics Tab', tab: 'metrics' },
  { id: 'nav-audit', type: 'navigation', label: '审计日志', description: '切换到 Logs Tab', tab: 'audit' },
  { id: 'nav-skills', type: 'navigation', label: 'AI 技能', description: '切换到 AI Skills Tab', tab: 'ai_skills' },
  { id: 'nav-library', type: 'navigation', label: '知识库', description: '切换到 Library Tab', tab: 'library' },
  { id: 'nav-ontology', type: 'navigation', label: '本体论', description: '切换到 Ontology Tab', tab: 'ontology' },
  { id: 'nav-analysis-hub', type: 'navigation', label: '分析中心', description: '切换到 Analysis Hub', tab: 'analysis_hub' },
  { id: 'nav-extensions', type: 'navigation', label: '插件中心', description: '切换到 Extensions Tab', tab: 'extensions' },
  { id: 'nav-tutorials', type: 'navigation', label: '学习中心', description: '切换到 Learn Tab', tab: 'tutorials' },

  // Actions
  { id: 'action-create-table', type: 'action', label: '新建数据表', description: '打开创建表对话框', shortcut: 'Ctrl+N' },
  { id: 'action-import', type: 'action', label: '导入数据', description: '打开导入向导', shortcut: 'Ctrl+I' },
  { id: 'action-export', type: 'action', label: '导出数据', description: '打开导出对话框', shortcut: 'Ctrl+E' },
  { id: 'action-settings', type: 'action', label: '设置与备份', description: '打开设置面板' },

  // Ontology actions (navigation is handled by nav-ontology)
  { id: 'ont-new-object-type', type: 'ontology', label: '新建对象类型', description: '在 Ontology 中创建新对象类型', ontologyCommand: { action: 'open-inspector', mode: 'create-object-type' } },
  { id: 'ont-new-object', type: 'ontology', label: '新建本体对象', description: '在 Ontology 中创建新对象', ontologyCommand: { action: 'open-drawer', drawer: 'crud' } },
  { id: 'ont-new-link', type: 'ontology', label: '新建本体链接', description: '在 Ontology 中创建对象间链接', ontologyCommand: { action: 'open-drawer', drawer: 'crud' } },
  { id: 'ont-graph-view', type: 'ontology', label: '本体图谱视图', description: '切换到 Ontology 图谱视图', ontologyCommand: { action: 'open-view', view: 'graph' } },
  { id: 'ont-data-view', type: 'ontology', label: '本体数据视图', description: '切换到 Ontology 数据视图', ontologyCommand: { action: 'open-view', view: 'data' } },
  { id: 'ont-canvas-view', type: 'ontology', label: '本体画布视图', description: '切换到 Ontology Canvas 视图', ontologyCommand: { action: 'open-view', view: 'canvas' } },
  { id: 'ont-init', type: 'ontology', label: '初始化本体库', description: '初始化 Ontology 表结构与种子数据', ontologyCommand: { action: 'init' } },
  { id: 'ont-reseed', type: 'ontology', label: '重新播种本体', description: '重新加载种子数据', ontologyCommand: { action: 'reseed' } },
  { id: 'ont-refresh', type: 'ontology', label: '刷新本体', description: '重新加载 Ontology 数据', ontologyCommand: { action: 'refresh' } },
];

// ============================================================
// AI Skill commands
// ============================================================

export function buildSkillCommands(skills: AISkill[]): CommandItem[] {
  return skills.map(skill => ({
    id: `skill-${skill.id}`,
    type: 'skill' as const,
    label: skill.name,
    description: skill.description,
    icon: skill.icon || '⚡',
    skillId: skill.id,
  }));
}

// ============================================================
// Fuzzy search
// ============================================================

export function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Direct contains
  if (t.includes(q)) return true;

  // Fuzzy: each query char must appear in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return commands;
  return commands.filter(cmd =>
    fuzzyMatch(query, cmd.label) ||
    fuzzyMatch(query, cmd.description || '') ||
    fuzzyMatch(query, cmd.tab || '')
  );
}

// ============================================================
// Build all commands for palette
// ============================================================

export function buildCommandPalette(
  tables: string[],
  skills: AISkill[],
  extraActions: CommandItem[]
): CommandItem[] {
  const tableCommands: CommandItem[] = tables.map(t => ({
    id: `table-${t}`,
    type: 'table' as const,
    label: `📋 ${t}`,
    description: `选择数据表 ${t}`,
  }));

  return [
    ...BUILT_IN_COMMANDS,
    ...extraActions,
    ...tableCommands,
    ...buildSkillCommands(skills),
  ];
}
