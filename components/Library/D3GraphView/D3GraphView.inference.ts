import type {
  RuleAst,
  RuleDefinition,
} from '../../../services/ontology/ontologyInferenceEngine';
import type { InferenceWorkspace } from '../../../services/ontology/ontologyInferenceModule';
import type {
  GraphData,
  GraphLink,
  GraphNode,
} from './D3GraphView.types';

const collectRuleDependencies = (
  node: RuleAst,
  rules: Map<string, RuleDefinition>,
  featureIds: Set<string>,
  ruleIds: Set<string>,
  activeRuleIds: Set<string>,
): void => {
  if (node.kind === 'condition') {
    featureIds.add(node.featureId);
    return;
  }
  if (node.kind === 'ruleRef') {
    ruleIds.add(node.ruleId);
    if (activeRuleIds.has(node.ruleId)) return;
    const referenced = rules.get(node.ruleId);
    if (referenced) {
      collectRuleDependencies(
        referenced.root,
        rules,
        featureIds,
        ruleIds,
        new Set(activeRuleIds).add(node.ruleId),
      );
    }
    return;
  }
  if (node.kind === 'not') {
    collectRuleDependencies(
      node.child,
      rules,
      featureIds,
      ruleIds,
      activeRuleIds,
    );
    return;
  }
  node.children.forEach(child =>
    collectRuleDependencies(child, rules, featureIds, ruleIds, activeRuleIds),
  );
};

interface InferenceNodeInput {
  id: string;
  label: string;
  group: string;
  color: string;
  size: number;
  [key: string]: unknown;
}

const inferenceNode = (
  node: InferenceNodeInput,
  description: unknown,
): GraphNode => ({
  ...node,
  description: JSON.stringify(description, null, 2),
}) as GraphNode;

const inferenceLink = (link: GraphLink): GraphLink => ({
  ...link,
  _inferenceProjection: true,
});

export function projectInferenceWorkspace(
  graph: GraphData,
  workspace: InferenceWorkspace,
): GraphData {
  const nodes = graph.nodes
    .filter(node => !node._inferenceDefinitionKind)
    .map(node => ({ ...node }));
  const links = graph.links
    .filter(link => !link._inferenceProjection)
    .map(link => ({ ...link }));
  const existingNodeIds = new Set(nodes.map(node => node.id));
  const dependencyFeatureIds = new Set(workspace.dependencyFeatureIds ?? []);
  const dependencyRuleIds = new Set(workspace.dependencyRuleIds ?? []);
  const addNode = (node: GraphNode) => {
    if (existingNodeIds.has(node.id)) return;
    nodes.push(node);
    existingNodeIds.add(node.id);
  };

  workspace.features.forEach(feature => {
    const id = `feature::${feature.id}`;
    addNode(inferenceNode({
      id,
      label: feature.name,
      group: 'feature',
      color: dependencyFeatureIds.has(feature.id)
        ? '#75715e'
        : feature.status === 'active'
          ? '#66d9ef'
          : '#e6db74',
      size: dependencyFeatureIds.has(feature.id)
        ? 7
        : feature.status === 'active'
          ? 10
          : 8,
      _typeId: feature.objectTypeId,
      _inferenceDefinitionKind: 'feature',
      _inferenceVersionId: feature.id,
      _inferenceDependency: dependencyFeatureIds.has(feature.id),
    }, feature));
    const typeNodeId = `type::${feature.objectTypeId}`;
    if (existingNodeIds.has(typeNodeId)) {
      links.push(inferenceLink({
        source: id,
        target: typeNodeId,
        color: 'rgba(102,217,239,0.55)',
        weight: 0.2,
        _linkTypeName: '定义特征',
      }));
    }
  });

  const ruleMap = new Map(workspace.rules.map(rule => [rule.id, rule]));
  workspace.rules.forEach(rule => {
    const ruleNodeId = `rule::${rule.id}`;
    addNode(inferenceNode({
      id: ruleNodeId,
      label: rule.name,
      group: 'rule',
      color: dependencyRuleIds.has(rule.id) ? '#75715e' : '#f92672',
      size: dependencyRuleIds.has(rule.id) ? 9 : 12,
      _inferenceDefinitionKind: 'rule',
      _inferenceVersionId: rule.id,
      _inferenceDependency: dependencyRuleIds.has(rule.id),
    }, rule));
    const featureIds = new Set<string>();
    const ruleIds = new Set<string>();
    collectRuleDependencies(
      rule.root,
      ruleMap,
      featureIds,
      ruleIds,
      new Set([rule.id]),
    );
    featureIds.forEach(featureId => {
      const featureNodeId = `feature::${featureId}`;
      if (!existingNodeIds.has(featureNodeId)) return;
      links.push(inferenceLink({
        source: ruleNodeId,
        target: featureNodeId,
        color: 'rgba(249,38,114,0.55)',
        weight: 0.3,
        _linkTypeName: '使用特征',
      }));
    });
    ruleIds.forEach(ruleId => {
      const referencedNodeId = `rule::${ruleId}`;
      if (!existingNodeIds.has(referencedNodeId)) return;
      links.push(inferenceLink({
        source: ruleNodeId,
        target: referencedNodeId,
        color: 'rgba(174,129,255,0.65)',
        weight: 0.35,
        _linkTypeName: '复用子规则',
      }));
    });
  });

  workspace.outcomes.forEach(outcome => {
    const outcomeNodeId = `outcome::${outcome.id}`;
    addNode(inferenceNode({
      id: outcomeNodeId,
      label: outcome.name,
      group: 'outcome',
      color: '#a6e22e',
      size: 13,
      _typeId: outcome.objectTypeId,
      _inferenceDefinitionKind: 'outcome',
      _inferenceVersionId: outcome.id,
    }, outcome));
    const ruleNodeId = `rule::${outcome.ruleId}`;
    if (existingNodeIds.has(ruleNodeId)) {
      links.push(inferenceLink({
        source: outcomeNodeId,
        target: ruleNodeId,
        color: 'rgba(166,226,46,0.6)',
        weight: 0.4,
        _linkTypeName: '由规则判断',
      }));
    }
  });

  const inferenceTypeNames = workspace.features.length
    || workspace.rules.length
    || workspace.outcomes.length
    ? ['业务特征', '规则', '结局']
    : [];
  return {
    ...graph,
    nodes,
    links,
    typeNames: [...new Set([...graph.typeNames, ...inferenceTypeNames])],
  };
}
