import type {
  LifeLink,
  LifeLinkType,
  LifeObject,
  LifeObjectType,
} from '../../hooks/useOntologyStore';

export interface CanvasNodeLayout {
  x: number;
  y: number;
}

export type CanvasLayoutMap = Record<number, CanvasNodeLayout>;

export interface OntologyCanvasNode {
  id: string;
  objectId: number;
  objectTypeId: number;
  name: string;
  typeName: string;
  typeDescription: string;
  properties: string;
  annotations: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inbound: number;
  outbound: number;
  degree: number;
  missingType: boolean;
}

export interface OntologyCanvasEdge {
  id: string;
  linkId: number;
  sourceObjectId: number;
  targetObjectId: number;
  sourceNodeId: string;
  targetNodeId: string;
  linkTypeId: number;
  label: string;
  description: string;
  weight: number;
  status: 'strong' | 'normal' | 'weak';
  duplicateIndex: number;
  duplicateCount: number;
  hasReverse: boolean;
}

export interface OntologyCanvasWarning {
  code: 'missing-object-type' | 'dangling-link' | 'duplicate-link';
  message: string;
  objectId?: number;
  linkId?: number;
}

export interface CanvasTypeGroup {
  objectTypeId: number;
  typeName: string;
  typeDescription: string;
  count: number;
  nodeIds: string[];
}

export interface CanvasHubNode {
  nodeId: string;
  objectId: number;
  name: string;
  typeName: string;
  inbound: number;
  outbound: number;
  degree: number;
}

export interface CanvasRelationSummary {
  linkTypeId: number;
  label: string;
  description: string;
  count: number;
  averageWeight: number;
  strongCount: number;
  weakCount: number;
  duplicateCount: number;
  reverseCount: number;
}

export interface CanvasRelationLegendItem {
  linkTypeId: number;
  label: string;
  visibleCount: number;
  totalCount: number;
  hiddenCount: number;
  averageWeight: number;
  strongCount: number;
  weakCount: number;
}

export interface CanvasReadabilityWarning {
  code: 'empty-canvas' | 'isolated-node' | 'hub-overload' | 'duplicate-link' | 'reverse-link' | 'dangling-link';
  severity: 'info' | 'warning';
  message: string;
  nodeId?: string;
  linkId?: number;
}

export interface SelectedNodeContext {
  node: OntologyCanvasNode;
  incoming: OntologyCanvasEdge[];
  outgoing: OntologyCanvasEdge[];
  neighbors: OntologyCanvasNode[];
  relationBreakdown: SelectedNodeRelationSummary[];
  observationQuestions: string[];
}

export interface SelectedNodeRelationSummary {
  linkTypeId: number;
  label: string;
  incoming: number;
  outgoing: number;
  total: number;
  averageWeight: number;
  strongCount: number;
  weakCount: number;
}

export interface SelectedEdgeContext {
  edge: OntologyCanvasEdge;
  source: OntologyCanvasNode | null;
  target: OntologyCanvasNode | null;
  sameTypeCount: number;
  sameTypeVisibleRatio: number;
  isPrimaryRelationType: boolean;
  sourceDegree: number;
  targetDegree: number;
  observationQuestions: string[];
}

export interface CanvasPathResult {
  nodeIds: string[];
  edgeIds: string[];
}

export interface CanvasPathSegment {
  edge: OntologyCanvasEdge;
  from: OntologyCanvasNode | null;
  to: OntologyCanvasNode | null;
  relationDirection: 'forward' | 'reverse';
}

export type CanvasAnalysisTaskAction =
  | 'inspect-node'
  | 'show-core'
  | 'show-issues'
  | 'filter-relation'
  | 'trace-path';

export interface CanvasAnalysisTask {
  id: string;
  title: string;
  description: string;
  action: CanvasAnalysisTaskAction;
  priority: number;
  nodeId?: string;
  linkTypeId?: number;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface CanvasViewInsight {
  title: string;
  explanation: string;
  keyFacts: string[];
  scopeFacts: string[];
  nextAction: string;
  keyNodeId?: string;
  keyRelationTypeId?: number;
  severity: 'neutral' | 'info' | 'warning';
}

export interface OntologyCanvasModel {
  nodes: OntologyCanvasNode[];
  edges: OntologyCanvasEdge[];
  warnings: OntologyCanvasWarning[];
  typeGroups: CanvasTypeGroup[];
  hubNodes: CanvasHubNode[];
  isolatedNodes: OntologyCanvasNode[];
  relationSummaries: CanvasRelationSummary[];
  selectedNodeContext: SelectedNodeContext | null;
  selectedEdgeContext: SelectedEdgeContext | null;
  readabilityWarnings: CanvasReadabilityWarning[];
  analysisTasks: CanvasAnalysisTask[];
  stats: {
    objects: number;
    objectTypes: number;
    links: number;
    linkTypes: number;
    danglingLinks: number;
  };
}

export type CanvasViewInsightMode = 'all' | 'core' | 'issues' | 'one-hop' | 'two-hop' | 'path';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;
const COLUMN_GAP = 340;
const ROW_GAP = 150;

function nodeId(objectId: number): string {
  return `object-${objectId}`;
}

function fallbackLayout(index: number, objectTypeIndex: number): CanvasNodeLayout {
  const col = Math.max(0, objectTypeIndex);
  const row = index;
  return {
    x: 140 + col * COLUMN_GAP,
    y: 130 + row * ROW_GAP,
  };
}

function linkStatus(weight: number): OntologyCanvasEdge['status'] {
  if (weight >= 0.75) return 'strong';
  if (weight <= 0.35) return 'weak';
  return 'normal';
}

function normalizeLinkWeight(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  if (numeric > 1 && numeric <= 100) return numeric / 100;
  return Math.min(1, Math.max(0, numeric));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTypeGroups(nodes: OntologyCanvasNode[]): CanvasTypeGroup[] {
  const groups = new Map<number, CanvasTypeGroup>();
  nodes.forEach(node => {
    const group = groups.get(node.objectTypeId) ?? {
      objectTypeId: node.objectTypeId,
      typeName: node.typeName,
      typeDescription: node.typeDescription,
      count: 0,
      nodeIds: [],
    };
    group.count += 1;
    group.nodeIds.push(node.id);
    groups.set(node.objectTypeId, group);
  });
  return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName));
}

function buildHubNodes(nodes: OntologyCanvasNode[]): CanvasHubNode[] {
  return nodes
    .filter(node => node.degree > 0)
    .map(node => ({
      nodeId: node.id,
      objectId: node.objectId,
      name: node.name,
      typeName: node.typeName,
      inbound: node.inbound,
      outbound: node.outbound,
      degree: node.degree,
    }))
    .sort((a, b) => b.degree - a.degree || b.outbound - a.outbound || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function buildRelationSummaries(
  edges: OntologyCanvasEdge[],
  linkTypes: LifeLinkType[]
): CanvasRelationSummary[] {
  const fallbackTypeById = new Map(linkTypes.map(type => [type.id, type]));
  const groups = new Map<number, OntologyCanvasEdge[]>();
  edges.forEach(edge => groups.set(edge.linkTypeId, [...(groups.get(edge.linkTypeId) ?? []), edge]));

  return Array.from(groups.entries())
    .map(([linkTypeId, group]) => {
      const linkType = fallbackTypeById.get(linkTypeId);
      return {
        linkTypeId,
        label: group[0]?.label ?? linkType?.name ?? `Link type #${linkTypeId}`,
        description: group[0]?.description ?? linkType?.description ?? '',
        count: group.length,
        averageWeight: average(group.map(edge => edge.weight)),
        strongCount: group.filter(edge => edge.status === 'strong').length,
        weakCount: group.filter(edge => edge.status === 'weak').length,
        duplicateCount: group.filter(edge => edge.duplicateCount > 1).length,
        reverseCount: group.filter(edge => edge.hasReverse).length,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildSelectedNodeContext(
  selectedNodeId: string | null | undefined,
  nodes: OntologyCanvasNode[],
  edges: OntologyCanvasEdge[]
): SelectedNodeContext | null {
  if (!selectedNodeId) return null;
  const node = nodes.find(item => item.id === selectedNodeId);
  if (!node) return null;

  const incoming = edges.filter(edge => edge.targetNodeId === selectedNodeId);
  const outgoing = edges.filter(edge => edge.sourceNodeId === selectedNodeId);
  const neighborIds = new Set<string>();
  incoming.forEach(edge => neighborIds.add(edge.sourceNodeId));
  outgoing.forEach(edge => neighborIds.add(edge.targetNodeId));
  const neighbors = nodes.filter(item => neighborIds.has(item.id));
  const relationGroups = new Map<number, OntologyCanvasEdge[]>();
  [...incoming, ...outgoing].forEach(edge => {
    relationGroups.set(edge.linkTypeId, [...(relationGroups.get(edge.linkTypeId) ?? []), edge]);
  });
  const relationBreakdown: SelectedNodeRelationSummary[] = Array.from(relationGroups.entries())
    .map(([linkTypeId, group]) => ({
      linkTypeId,
      label: group[0]?.label ?? `关系类型 #${linkTypeId}`,
      incoming: group.filter(edge => edge.targetNodeId === selectedNodeId).length,
      outgoing: group.filter(edge => edge.sourceNodeId === selectedNodeId).length,
      total: group.length,
      averageWeight: average(group.map(edge => edge.weight)),
      strongCount: group.filter(edge => edge.status === 'strong').length,
      weakCount: group.filter(edge => edge.status === 'weak').length,
    }))
    .sort((a, b) => b.total - a.total || b.outgoing - a.outgoing || a.label.localeCompare(b.label));

  const observationQuestions = [
    `${node.name} 为什么会成为 ${node.typeName} 中的一个对象？`,
    incoming.length > 0
      ? `哪些对象正在影响或指向 ${node.name}？`
      : `${node.name} 当前没有入边，是否应该被其他对象解释？`,
    outgoing.length > 0
      ? `${node.name} 正在影响哪些对象？`
      : `${node.name} 当前没有出边，是否只是终点或孤立记录？`,
  ];

  return { node, incoming, outgoing, neighbors, relationBreakdown, observationQuestions };
}

export function buildSelectedEdgeContext(
  selectedEdgeId: string | null | undefined,
  nodes: OntologyCanvasNode[],
  edges: OntologyCanvasEdge[],
  relationSummaries: CanvasRelationSummary[]
): SelectedEdgeContext | null {
  if (!selectedEdgeId) return null;
  const edge = edges.find(item => item.id === selectedEdgeId);
  if (!edge) return null;

  const source = nodes.find(node => node.id === edge.sourceNodeId) ?? null;
  const target = nodes.find(node => node.id === edge.targetNodeId) ?? null;
  const sameTypeCount = edges.filter(item => item.linkTypeId === edge.linkTypeId).length;
  const primarySummary = relationSummaries[0] ?? null;
  const isPrimaryRelationType = primarySummary?.linkTypeId === edge.linkTypeId;
  const sameTypeVisibleRatio = sameTypeCount / Math.max(1, edges.length);
  const sourceName = source?.name ?? '源对象';
  const targetName = target?.name ?? '目标对象';

  const observationQuestions = [
    `${sourceName} 到 ${targetName} 的「${edge.label}」是否表达了主要结构？`,
    sameTypeCount > 1
      ? `同类关系还有 ${Math.max(0, sameTypeCount - 1)} 条，是否需要只看这一类关系？`
      : `这是当前画布里唯一的「${edge.label}」关系，是否过于特殊？`,
    edge.hasReverse
      ? '这条关系存在反向表达，确认它是否代表双向语义。'
      : `如果要追踪路径，可以从 ${sourceName} 继续看下游。`,
  ];

  return {
    edge,
    source,
    target,
    sameTypeCount,
    sameTypeVisibleRatio: Number(sameTypeVisibleRatio.toFixed(4)),
    isPrimaryRelationType,
    sourceDegree: source?.degree ?? 0,
    targetDegree: target?.degree ?? 0,
    observationQuestions,
  };
}

function buildReadabilityWarnings(
  nodes: OntologyCanvasNode[],
  edges: OntologyCanvasEdge[],
  structuralWarnings: OntologyCanvasWarning[]
): CanvasReadabilityWarning[] {
  const warnings: CanvasReadabilityWarning[] = [];
  if (nodes.length === 0) {
    warnings.push({
      code: 'empty-canvas',
      severity: 'info',
      message: '画布还没有对象，先从对象库添加对象或生成示例结构。',
    });
  }

  nodes.filter(node => node.degree === 0).forEach(node => {
    warnings.push({
      code: 'isolated-node',
      severity: 'info',
      nodeId: node.id,
      message: `${node.name} 还没有任何关系，观察时容易被忽略。`,
    });
  });

  nodes.filter(node => node.degree >= 6).forEach(node => {
    warnings.push({
      code: 'hub-overload',
      severity: 'warning',
      nodeId: node.id,
      message: `${node.name} 连接了 ${node.degree} 条关系，建议优先检查它是否是结构核心。`,
    });
  });

  edges.filter(edge => edge.duplicateCount > 1).forEach(edge => {
    warnings.push({
      code: 'duplicate-link',
      severity: 'warning',
      linkId: edge.linkId,
      message: `关系 ${edge.label} 存在重复建模，请确认是否需要合并。`,
    });
  });

  edges.filter(edge => edge.hasReverse).forEach(edge => {
    warnings.push({
      code: 'reverse-link',
      severity: 'info',
      linkId: edge.linkId,
      message: `关系 ${edge.label} 存在反向关系，请确认是否代表双向语义。`,
    });
  });

  structuralWarnings.filter(warning => warning.code === 'dangling-link').forEach(warning => {
    warnings.push({
      code: 'dangling-link',
      severity: 'warning',
      linkId: warning.linkId,
      message: '存在指向缺失对象的关系，已从画布渲染中排除。',
    });
  });

  return warnings;
}

function uniqueTasks(tasks: CanvasAnalysisTask[]): CanvasAnalysisTask[] {
  const seen = new Set<string>();
  return tasks
    .filter(task => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
    .slice(0, 4);
}

function buildAnalysisTasks(
  nodes: OntologyCanvasNode[],
  edges: OntologyCanvasEdge[],
  hubNodes: CanvasHubNode[],
  isolatedNodes: OntologyCanvasNode[],
  relationSummaries: CanvasRelationSummary[],
  readabilityWarnings: CanvasReadabilityWarning[]
): CanvasAnalysisTask[] {
  if (nodes.length === 0) return [];

  const tasks: CanvasAnalysisTask[] = [];
  const coreNode = hubNodes[0];
  if (coreNode) {
    tasks.push({
      id: `inspect-core-${coreNode.nodeId}`,
      title: '从核心节点开始',
      description: `先聚焦 ${coreNode.name}，查看它的一跳关系和直接邻居。`,
      action: 'inspect-node',
      priority: 10,
      nodeId: coreNode.nodeId,
    });
  } else {
    tasks.push({
      id: 'show-core',
      title: '查看核心视图',
      description: '当前连接较少，先用核心视图找出主要对象。',
      action: 'show-core',
      priority: 12,
    });
  }

  const issueWarning = readabilityWarnings.find(warning =>
    warning.code === 'hub-overload' || warning.code === 'duplicate-link' || warning.code === 'reverse-link' || warning.code === 'dangling-link'
  );
  if (issueWarning) {
    tasks.push({
      id: `show-issues-${issueWarning.code}`,
      title: '查看结构异常',
      description: issueWarning.message,
      action: 'show-issues',
      priority: 20,
      nodeId: issueWarning.nodeId,
    });
  } else if (isolatedNodes[0]) {
    tasks.push({
      id: `inspect-isolated-${isolatedNodes[0].id}`,
      title: '检查孤立对象',
      description: `${isolatedNodes[0].name} 还没有关系，适合作为补关系的起点。`,
      action: 'inspect-node',
      priority: 25,
      nodeId: isolatedNodes[0].id,
    });
  }

  const mainRelation = relationSummaries[0];
  if (mainRelation) {
    tasks.push({
      id: `filter-relation-${mainRelation.linkTypeId}`,
      title: '按主要关系过滤',
      description: `只看 ${mainRelation.label}，先降低连线噪音。`,
      action: 'filter-relation',
      priority: 30,
      linkTypeId: mainRelation.linkTypeId,
    });
  }

  const sourceNodeId = hubNodes[0]?.nodeId ?? edges[0]?.sourceNodeId;
  const targetNodeId = hubNodes.find(node => node.nodeId !== sourceNodeId)?.nodeId
    ?? edges.find(edge => edge.sourceNodeId !== sourceNodeId || edge.targetNodeId !== sourceNodeId)?.targetNodeId;
  if (sourceNodeId && targetNodeId && sourceNodeId !== targetNodeId) {
    const sourceName = nodes.find(node => node.id === sourceNodeId)?.name ?? '起点';
    const targetName = nodes.find(node => node.id === targetNodeId)?.name ?? '终点';
    tasks.push({
      id: `trace-path-${sourceNodeId}-${targetNodeId}`,
      title: '追踪关键路径',
      description: `查看 ${sourceName} 到 ${targetName} 的关系链路。`,
      action: 'trace-path',
      priority: 40,
      sourceNodeId,
      targetNodeId,
    });
  }

  return uniqueTasks(tasks);
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function buildCanvasViewInsight(input: {
  baseModel: OntologyCanvasModel;
  viewModel: OntologyCanvasModel;
  mode: CanvasViewInsightMode;
  selectedNodeId?: string | null;
  relationLabel?: string | null;
  hideIsolated?: boolean;
  pathFound?: boolean | null;
}): CanvasViewInsight {
  const { baseModel, viewModel, mode, selectedNodeId, relationLabel, hideIsolated, pathFound } = input;
  if (baseModel.nodes.length === 0) {
    return {
      title: '等待建模起点',
      explanation: '画布还没有对象，先创建对象或生成示例结构。',
      keyFacts: ['0 个对象', '0 条关系'],
      scopeFacts: ['当前没有隐藏内容'],
      nextAction: '从对象库添加对象，或生成示例结构。',
      severity: 'neutral',
    };
  }

  const visiblePercent = percent(viewModel.nodes.length, baseModel.nodes.length);
  const keyNode = viewModel.hubNodes[0] ?? baseModel.hubNodes[0] ?? null;
  const keyRelation = viewModel.relationSummaries[0] ?? null;
  const warningCount = viewModel.readabilityWarnings.filter(warning => warning.severity === 'warning').length;
  const isolatedCount = viewModel.isolatedNodes.length;
  const facts = [
    `可见对象 ${viewModel.nodes.length}/${baseModel.nodes.length}`,
    `覆盖 ${visiblePercent}%`,
  ];
  if (keyNode) facts.push(`核心 ${keyNode.name} · ${keyNode.degree} 连接`);
  if (keyRelation) facts.push(`主关系 ${keyRelation.label} · ${keyRelation.count}`);
  if (warningCount > 0) facts.push(`异常 ${warningCount}`);
  if (isolatedCount > 0) facts.push(`孤立 ${isolatedCount}`);
  const hiddenNodes = Math.max(0, baseModel.nodes.length - viewModel.nodes.length);
  const hiddenEdges = Math.max(0, baseModel.edges.length - viewModel.edges.length);
  const scopeFacts = [
    hiddenNodes > 0 ? `隐藏对象 ${hiddenNodes}` : '对象全可见',
    hiddenEdges > 0 ? `隐藏关系 ${hiddenEdges}` : '关系全可见',
  ];
  if (relationLabel && relationLabel !== 'all') scopeFacts.push(`关系筛选：${relationLabel}`);
  if (hideIsolated) scopeFacts.push('孤立对象已隐藏');
  if (mode === 'one-hop') scopeFacts.push('范围：一跳邻居');
  if (mode === 'two-hop') scopeFacts.push('范围：两跳邻居');
  if (mode === 'core') scopeFacts.push('范围：核心与近邻');
  if (mode === 'issues') scopeFacts.push('范围：结构异常');
  if (mode === 'path') scopeFacts.push(pathFound ? '范围：路径链路' : '范围：路径未命中');

  if (mode === 'path') {
    return {
      title: pathFound ? '关键路径已高亮' : '没有找到可达路径',
      explanation: pathFound
        ? '当前只保留路径链路，适合检查两个对象之间的中间关系。'
        : '当前起点和终点之间没有可达链路，可以换一组对象或回到全量视图。',
      keyFacts: facts,
      scopeFacts,
      nextAction: pathFound ? '沿高亮路径逐个点击关系标签，检查方向和权重。' : '换一个终点，或先回到全量视图重新选择核心对象。',
      keyNodeId: keyNode?.nodeId,
      keyRelationTypeId: keyRelation?.linkTypeId,
      severity: pathFound ? 'info' : 'warning',
    };
  }

  if (mode === 'issues') {
    return {
      title: warningCount > 0 || isolatedCount > 0 ? '结构问题优先处理' : '暂无高风险结构问题',
      explanation: warningCount > 0
        ? '当前视图聚焦重复、反向、悬空或过载连接，适合做结构体检。'
        : isolatedCount > 0
          ? '当前视图聚焦孤立对象，它们暂时没有关系连接，适合判断是否需要补充关系或移出主结构。'
          : '当前没有明显异常，可继续查看核心节点和主关系。',
      keyFacts: facts,
      scopeFacts,
      nextAction: keyNode ? `先点 ${keyNode.name} 查看一跳关系，再决定是否合并或补充关系。` : '回到核心视图选择一个对象开始观察。',
      keyNodeId: keyNode?.nodeId,
      keyRelationTypeId: keyRelation?.linkTypeId,
      severity: warningCount > 0 || isolatedCount > 0 ? 'warning' : 'info',
    };
  }

  if (mode === 'one-hop' || mode === 'two-hop') {
    const selected = selectedNodeId ? viewModel.nodes.find(node => node.id === selectedNodeId) : null;
    return {
      title: selected ? `${selected.name} 的局部关系` : '等待选择焦点节点',
      explanation: selected
        ? `当前只显示 ${selected.name} 附近的直接或扩展关系，适合看清上下游对象。`
        : '局部视图需要先选择一个对象，才能收敛到一跳或两跳范围。',
      keyFacts: facts,
      scopeFacts,
      nextAction: selected ? '查看右侧检查器里的入边、出边，再选择一条关系继续追踪。' : '先点击一个核心节点，进入一跳观察。',
      keyNodeId: selected?.id ?? keyNode?.nodeId,
      keyRelationTypeId: keyRelation?.linkTypeId,
      severity: selected ? 'info' : 'warning',
    };
  }

  if (relationLabel && relationLabel !== 'all') {
    return {
      title: `正在只看「${relationLabel}」`,
      explanation: '当前视图已经按关系类型收敛，适合判断这种关系是否表达清楚、是否过密或缺失。',
      keyFacts: facts,
      scopeFacts,
      nextAction: keyNode ? `点击 ${keyNode.name}，确认这种关系在核心节点上的方向。` : '清除关系筛选后回到全量结构。',
      keyNodeId: keyNode?.nodeId,
      keyRelationTypeId: keyRelation?.linkTypeId,
      severity: warningCount > 0 ? 'warning' : 'info',
    };
  }

  if (mode === 'core') {
    return {
      title: keyNode ? `核心结构围绕 ${keyNode.name}` : '核心结构尚不明显',
      explanation: keyNode
        ? '当前优先展示连接度最高的对象和近邻，适合作为第一次阅读入口。'
        : '当前关系较少，还没有形成稳定核心。',
      keyFacts: facts,
      scopeFacts,
      nextAction: keyNode ? `从 ${keyNode.name} 开始，查看一跳关系和主关系类型。` : '先补充对象之间的关键关系。',
      keyNodeId: keyNode?.nodeId,
      keyRelationTypeId: keyRelation?.linkTypeId,
      severity: warningCount > 0 ? 'warning' : 'info',
    };
  }

  return {
    title: '全量结构总览',
    explanation: '当前显示完整本体结构，适合先判断核心对象、主关系和异常分布。',
    keyFacts: facts,
    scopeFacts,
    nextAction: keyNode ? `建议先聚焦 ${keyNode.name}，再进入一跳局部视图。` : '从对象索引中选择一个对象开始观察。',
    keyNodeId: keyNode?.nodeId,
    keyRelationTypeId: keyRelation?.linkTypeId,
    severity: warningCount > 0 ? 'warning' : 'neutral',
  };
}

export function buildRelationLegend(
  baseModel: OntologyCanvasModel,
  viewModel: OntologyCanvasModel
): CanvasRelationLegendItem[] {
  const visibleByType = new Map(viewModel.relationSummaries.map(summary => [summary.linkTypeId, summary]));
  return baseModel.relationSummaries
    .map(summary => {
      const visible = visibleByType.get(summary.linkTypeId);
      return {
        linkTypeId: summary.linkTypeId,
        label: summary.label,
        visibleCount: visible?.count ?? 0,
        totalCount: summary.count,
        hiddenCount: Math.max(0, summary.count - (visible?.count ?? 0)),
        averageWeight: visible?.averageWeight ?? summary.averageWeight,
        strongCount: visible?.strongCount ?? 0,
        weakCount: visible?.weakCount ?? 0,
      };
    })
    .filter(item => item.totalCount > 0)
    .sort((a, b) => b.visibleCount - a.visibleCount || b.totalCount - a.totalCount || a.label.localeCompare(b.label));
}

export function buildOntologyCanvasModel(input: {
  objects: LifeObject[];
  objectTypes: LifeObjectType[];
  links: LifeLink[];
  linkTypes: LifeLinkType[];
  layout?: CanvasLayoutMap;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
}): OntologyCanvasModel {
  const objectTypeById = new Map(input.objectTypes.map(type => [type.id, type]));
  const objectById = new Map(input.objects.map(object => [object.id, object]));
  const linkTypeById = new Map(input.linkTypes.map(type => [type.id, type]));
  const warnings: OntologyCanvasWarning[] = [];

  const typeOrder = new Map<number, number>();
  input.objectTypes.forEach((type, index) => typeOrder.set(type.id, index));

  const typeRowCounters = new Map<number, number>();
  const nodes = input.objects.map(object => {
    const objectType = objectTypeById.get(object.object_type_id);
    if (!objectType) {
      warnings.push({
        code: 'missing-object-type',
        message: `Object "${object.name}" references missing type #${object.object_type_id}.`,
        objectId: object.id,
      });
    }

    const row = typeRowCounters.get(object.object_type_id) ?? 0;
    typeRowCounters.set(object.object_type_id, row + 1);
    const auto = fallbackLayout(row, typeOrder.get(object.object_type_id) ?? typeOrder.size);
    const saved = input.layout?.[object.id];

    return {
      id: nodeId(object.id),
      objectId: object.id,
      objectTypeId: object.object_type_id,
      name: object.name,
      typeName: objectType?.name ?? `Missing type #${object.object_type_id}`,
      typeDescription: objectType?.description ?? '',
      properties: object.properties ?? '{}',
      annotations: object.annotations ?? '',
      x: saved?.x ?? auto.x,
      y: saved?.y ?? auto.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      inbound: 0,
      outbound: 0,
      degree: 0,
      missingType: !objectType,
    };
  });

  const nodeByObjectId = new Map(nodes.map(node => [node.objectId, node]));
  const duplicateGroups = new Map<string, LifeLink[]>();
  input.links.forEach(link => {
    const key = `${link.source_object_id}->${link.target_object_id}->${link.link_type_id}`;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), link]);
  });

  duplicateGroups.forEach(group => {
    if (group.length > 1) {
      group.forEach(link => {
        warnings.push({
          code: 'duplicate-link',
          message: `Duplicate relationship #${link.id} shares source, target, and type with another edge.`,
          linkId: link.id,
        });
      });
    }
  });

  const reversePairs = new Set(
    input.links.map(link => `${link.target_object_id}->${link.source_object_id}`)
  );

  const edges: OntologyCanvasEdge[] = [];
  const seenInGroup = new Map<string, number>();
  let danglingLinks = 0;

  for (const link of input.links) {
    const sourceNode = nodeByObjectId.get(link.source_object_id);
    const targetNode = nodeByObjectId.get(link.target_object_id);
    if (!sourceNode || !targetNode) {
      danglingLinks++;
      warnings.push({
        code: 'dangling-link',
        message: `Relationship #${link.id} points to an object that is not present in the canvas.`,
        linkId: link.id,
      });
      continue;
    }

    sourceNode.outbound += 1;
    targetNode.inbound += 1;
    sourceNode.degree += 1;
    targetNode.degree += 1;

    const groupKey = `${link.source_object_id}->${link.target_object_id}->${link.link_type_id}`;
    const duplicateIndex = seenInGroup.get(groupKey) ?? 0;
    seenInGroup.set(groupKey, duplicateIndex + 1);

    const linkType = linkTypeById.get(link.link_type_id);
    const weight = normalizeLinkWeight(link.weight);

    edges.push({
      id: `link-${link.id}`,
      linkId: link.id,
      sourceObjectId: link.source_object_id,
      targetObjectId: link.target_object_id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      linkTypeId: link.link_type_id,
      label: linkType?.name ?? `Link type #${link.link_type_id}`,
      description: linkType?.description ?? '',
      weight,
      status: linkStatus(weight),
      duplicateIndex,
      duplicateCount: duplicateGroups.get(groupKey)?.length ?? 1,
      hasReverse: reversePairs.has(`${link.source_object_id}->${link.target_object_id}`),
    });
  }

  const typeGroups = buildTypeGroups(nodes);
  const hubNodes = buildHubNodes(nodes);
  const isolatedNodes = nodes.filter(node => node.degree === 0);
  const relationSummaries = buildRelationSummaries(edges, input.linkTypes);
  const selectedNodeContext = buildSelectedNodeContext(input.selectedNodeId, nodes, edges);
  const selectedEdgeContext = buildSelectedEdgeContext(input.selectedEdgeId, nodes, edges, relationSummaries);
  const readabilityWarnings = buildReadabilityWarnings(nodes, edges, warnings);

  return {
    nodes,
    edges,
    warnings,
    typeGroups,
    hubNodes,
    isolatedNodes,
    relationSummaries,
    selectedNodeContext,
    selectedEdgeContext,
    readabilityWarnings,
    analysisTasks: buildAnalysisTasks(nodes, edges, hubNodes, isolatedNodes, relationSummaries, readabilityWarnings),
    stats: {
      objects: nodes.length,
      objectTypes: input.objectTypes.length,
      links: edges.length,
      linkTypes: input.linkTypes.length,
      danglingLinks,
    },
  };
}

export function collectConnectedNodeIds(
  selectedNodeId: string | null,
  edges: OntologyCanvasEdge[]
): Set<string> {
  const ids = new Set<string>();
  if (!selectedNodeId) return ids;
  ids.add(selectedNodeId);
  edges.forEach(edge => {
    if (edge.sourceNodeId === selectedNodeId) ids.add(edge.targetNodeId);
    if (edge.targetNodeId === selectedNodeId) ids.add(edge.sourceNodeId);
  });
  return ids;
}

export function collectNeighborhoodNodeIds(
  selectedNodeId: string | null,
  edges: OntologyCanvasEdge[],
  hops: number
): Set<string> {
  const ids = new Set<string>();
  if (!selectedNodeId || hops <= 0) return ids;

  ids.add(selectedNodeId);
  let frontier = new Set<string>([selectedNodeId]);
  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    edges.forEach(edge => {
      if (frontier.has(edge.sourceNodeId) && !ids.has(edge.targetNodeId)) {
        next.add(edge.targetNodeId);
      }
      if (frontier.has(edge.targetNodeId) && !ids.has(edge.sourceNodeId)) {
        next.add(edge.sourceNodeId);
      }
    });
    next.forEach(id => ids.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }
  return ids;
}

export function findShortestNodePath(
  sourceNodeId: string | null,
  targetNodeId: string | null,
  edges: OntologyCanvasEdge[]
): CanvasPathResult | null {
  if (!sourceNodeId || !targetNodeId) return null;
  if (sourceNodeId === targetNodeId) return { nodeIds: [sourceNodeId], edgeIds: [] };

  const adjacency = new Map<string, Array<{ nextNodeId: string; edgeId: string }>>();
  edges.forEach(edge => {
    adjacency.set(edge.sourceNodeId, [...(adjacency.get(edge.sourceNodeId) ?? []), {
      nextNodeId: edge.targetNodeId,
      edgeId: edge.id,
    }]);
    adjacency.set(edge.targetNodeId, [...(adjacency.get(edge.targetNodeId) ?? []), {
      nextNodeId: edge.sourceNodeId,
      edgeId: edge.id,
    }]);
  });

  const queue: string[] = [sourceNodeId];
  const visited = new Set<string>([sourceNodeId]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const item of adjacency.get(current) ?? []) {
      if (visited.has(item.nextNodeId)) continue;
      visited.add(item.nextNodeId);
      previous.set(item.nextNodeId, { nodeId: current, edgeId: item.edgeId });
      if (item.nextNodeId === targetNodeId) {
        const nodeIds = [targetNodeId];
        const edgeIds: string[] = [];
        let cursor = targetNodeId;
        while (cursor !== sourceNodeId) {
          const prev = previous.get(cursor);
          if (!prev) return null;
          edgeIds.unshift(prev.edgeId);
          nodeIds.unshift(prev.nodeId);
          cursor = prev.nodeId;
        }
        return { nodeIds, edgeIds };
      }
      queue.push(item.nextNodeId);
    }
  }

  return null;
}

export function buildPathSegments(
  path: CanvasPathResult | null,
  nodes: OntologyCanvasNode[],
  edges: OntologyCanvasEdge[]
): CanvasPathSegment[] {
  if (!path || path.nodeIds.length < 2) return [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const segments: CanvasPathSegment[] = [];

  for (let index = 0; index < path.edgeIds.length; index++) {
    const edge = edgeById.get(path.edgeIds[index]);
    const fromNodeId = path.nodeIds[index];
    const toNodeId = path.nodeIds[index + 1];
    if (!edge) continue;
    segments.push({
      edge,
      from: nodeById.get(fromNodeId) ?? null,
      to: nodeById.get(toNodeId) ?? null,
      relationDirection: edge.sourceNodeId === fromNodeId && edge.targetNodeId === toNodeId ? 'forward' : 'reverse',
    });
  }

  return segments;
}

export function filterCanvasModel(
  model: OntologyCanvasModel,
  options: {
    nodeIds?: Set<string>;
    linkTypeId?: number | 'all';
    hideIsolated?: boolean;
    edgeIds?: Set<string>;
  }
): OntologyCanvasModel {
  const allowedLinkType = options.linkTypeId ?? 'all';
  const nodeIds = options.nodeIds;
  const edgeIds = options.edgeIds;
  const candidateNodes = model.nodes.filter(node => {
    if (nodeIds && !nodeIds.has(node.id)) return false;
    return true;
  });
  const candidateNodeIds = new Set(candidateNodes.map(node => node.id));
  const candidateEdges = model.edges.filter(edge => {
    if (!candidateNodeIds.has(edge.sourceNodeId) || !candidateNodeIds.has(edge.targetNodeId)) return false;
    if (allowedLinkType !== 'all' && edge.linkTypeId !== allowedLinkType) return false;
    if (edgeIds && !edgeIds.has(edge.id)) return false;
    return true;
  });

  const visibleDegree = new Map<string, { inbound: number; outbound: number }>();
  candidateNodes.forEach(node => visibleDegree.set(node.id, { inbound: 0, outbound: 0 }));
  candidateEdges.forEach(edge => {
    const source = visibleDegree.get(edge.sourceNodeId);
    const target = visibleDegree.get(edge.targetNodeId);
    if (source) source.outbound += 1;
    if (target) target.inbound += 1;
  });

  const nodes = candidateNodes
    .map(node => {
      const degree = visibleDegree.get(node.id) ?? { inbound: 0, outbound: 0 };
      return {
        ...node,
        inbound: degree.inbound,
        outbound: degree.outbound,
        degree: degree.inbound + degree.outbound,
      };
    })
    .filter(node => !(options.hideIsolated && node.degree === 0));
  const visibleNodeIds = new Set(nodes.map(node => node.id));
  const edges = candidateEdges.filter(edge =>
    visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId)
  );
  const selectedNodeId = model.selectedNodeContext?.node.id;
  const selectedNodeContext = selectedNodeId && visibleNodeIds.has(selectedNodeId)
    ? buildSelectedNodeContext(selectedNodeId, nodes, edges)
    : null;
  const typeGroups = buildTypeGroups(nodes);
  const hubNodes = buildHubNodes(nodes);
  const isolatedNodes = nodes.filter(node => node.degree === 0);
  const relationSummaries = buildRelationSummaries(edges, []);
  const selectedEdgeId = model.selectedEdgeContext?.edge.id;
  const selectedEdgeContext = selectedEdgeId && edges.some(edge => edge.id === selectedEdgeId)
    ? buildSelectedEdgeContext(selectedEdgeId, nodes, edges, relationSummaries)
    : null;
  const readabilityWarnings = buildReadabilityWarnings(nodes, edges, model.warnings);

  return {
    ...model,
    nodes,
    edges,
    typeGroups,
    hubNodes,
    isolatedNodes,
    relationSummaries,
    selectedNodeContext,
    selectedEdgeContext,
    readabilityWarnings,
    analysisTasks: buildAnalysisTasks(nodes, edges, hubNodes, isolatedNodes, relationSummaries, readabilityWarnings),
    stats: {
      ...model.stats,
      objects: nodes.length,
      links: edges.length,
    },
  };
}

export function removeLayoutForObject(
  layout: CanvasLayoutMap,
  objectId: number
): CanvasLayoutMap {
  const next = { ...layout };
  delete next[objectId];
  return next;
}
