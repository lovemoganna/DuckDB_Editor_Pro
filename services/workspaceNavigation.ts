import { Tab } from '../types';

const WORKSPACE_TABS = new Set<Tab>(Object.values(Tab));

export type WorkspaceFeatureSection = 'database' | 'analytics' | 'knowledge' | 'capability';

export type WorkspaceIconName =
  | 'dashboard' | 'sql' | 'data' | 'schema'
  | 'metrics' | 'logs' | 'history' | 'plugins'
  | 'library' | 'analysis' | 'learn'
  | 'ai' | 'skills' | 'ontology' | 'deduction';

export interface WorkspaceFeature {
  tab: Tab;
  label: string;
  icon: WorkspaceIconName;
  aliases: readonly string[];
  section: WorkspaceFeatureSection;
  lifecycle: 'active-only';
}

export const WORKSPACE_FEATURES: readonly WorkspaceFeature[] = [
  { tab: Tab.DASHBOARD, label: '仪表盘', icon: 'dashboard', aliases: ['home', 'dashboard'], section: 'database', lifecycle: 'active-only' },
  { tab: Tab.SQL, label: 'SQL 工作台', icon: 'sql', aliases: ['sql', 'editor', 'workbench'], section: 'database', lifecycle: 'active-only' },
  { tab: Tab.DATA, label: '数据', icon: 'data', aliases: ['table-data'], section: 'database', lifecycle: 'active-only' },
  { tab: Tab.STRUCTURE, label: 'Schema', icon: 'schema', aliases: ['schema'], section: 'database', lifecycle: 'active-only' },
  { tab: Tab.METRICS, label: '指标', icon: 'metrics', aliases: ['semantic-metrics'], section: 'analytics', lifecycle: 'active-only' },
  { tab: Tab.ANALYSIS_HUB, label: '分析中心', icon: 'analysis', aliases: ['analysis'], section: 'analytics', lifecycle: 'active-only' },
  { tab: Tab.HISTORY, label: '历史', icon: 'history', aliases: ['query-history'], section: 'analytics', lifecycle: 'active-only' },
  { tab: Tab.AUDIT, label: '审计日志', icon: 'logs', aliases: ['logs', 'audit', 'audit-log'], section: 'analytics', lifecycle: 'active-only' },
  { tab: Tab.LIBRARY, label: '知识资产', icon: 'library', aliases: ['library', 'knowledge', 'assets', 'knowledge-hub', '知识资产'], section: 'knowledge', lifecycle: 'active-only' },
  { tab: Tab.EXTENSIONS, label: '插件', icon: 'plugins', aliases: ['plugins'], section: 'knowledge', lifecycle: 'active-only' },
  { tab: Tab.TUTORIALS, label: '知识资产', icon: 'library', aliases: ['learn', 'tutorials'], section: 'knowledge', lifecycle: 'active-only' },
  { tab: Tab.AI_CAPABILITIES, label: 'AI 能力库', icon: 'ai', aliases: ['ai', 'ai-cognition', 'ai_cognition', 'ai-capabilities', 'capability-hub', 'capabilities', '能力库'], section: 'capability', lifecycle: 'active-only' },
  { tab: Tab.AI_SKILLS, label: 'AI 技能', icon: 'skills', aliases: ['skills', 'ai-skills', 'ai-skill', '技能'], section: 'capability', lifecycle: 'active-only' },
  { tab: Tab.ONTOLOGY, label: '本体图谱', icon: 'ontology', aliases: ['ontology', 'knowledge-graph', 'knowledge_graph', 'graph', '本体图谱', '图谱'], section: 'capability', lifecycle: 'active-only' },
  {
    tab: Tab.COMPOSITIONAL_DEDUCTION,
    label: '组合推演',
    icon: 'deduction',
    aliases: ['simulation', 'deduction', 'compositional-deduction', '组合推演', '推演'],
    section: 'capability',
    lifecycle: 'active-only',
  },
  {
    tab: Tab.DATAFLOW,
    label: '数据流画布',
    icon: 'deduction',
    aliases: ['dataflow', 'canvas', 'flow', 'pipeline', '数据流', '数据流画布', '工作流'],
    section: 'database',
    lifecycle: 'active-only',
  },
] as const;


const WORKSPACE_FEATURE_BY_TAB = new Map(
  WORKSPACE_FEATURES.map(feature => [feature.tab, feature] as const),
);
const WORKSPACE_TAB_BY_ALIAS = new Map(
  WORKSPACE_FEATURES.flatMap(feature =>
    feature.aliases.map(alias => [alias, feature.tab] as const),
  ),
);

export function resolveWorkspaceTab(intent: string): Tab | null {
  if (WORKSPACE_TABS.has(intent as Tab)) return intent as Tab;
  return WORKSPACE_TAB_BY_ALIAS.get(intent) ?? null;
}

export function getWorkspaceFeature(tab: Tab): WorkspaceFeature {
  const feature = WORKSPACE_FEATURE_BY_TAB.get(tab);
  if (!feature) {
    throw new Error(`Workspace feature is not registered: ${tab}`);
  }
  return feature;
}
