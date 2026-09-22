import { describe, expect, it } from 'vitest';
import { RISK_INFERENCE_WORKSPACE } from '../../../services/ontology/ontologyInferenceRiskTemplate';
import type { GraphData } from './D3GraphView.types';
import { projectInferenceWorkspace } from './D3GraphView.inference';

describe('inference workspace graph projection', () => {
  it('projects versioned features, rules and outcomes without copying them into objects', () => {
    const graph: GraphData = {
      nodes: [{
        id: 'type::1',
        label: '交易',
        group: 'typeHub',
        color: '#fff',
        size: 20,
        description: '交易对象',
      }],
      links: [],
      typeMap: { 1: { id: 1, name: '交易', description: '交易对象' } },
      linkTypeMap: {},
      typeNames: ['交易'],
    };

    const projected = projectInferenceWorkspace(graph, RISK_INFERENCE_WORKSPACE);

    expect(projected.nodes).toHaveLength(7);
    expect(projected.nodes.find(node =>
      node.id === `feature::${RISK_INFERENCE_WORKSPACE.features[0].id}`,
    )).toMatchObject({
      label: '快进快出',
      group: 'feature',
      _inferenceDefinitionKind: 'feature',
    });
    expect(projected.nodes.find(node =>
      node.id === `rule::${RISK_INFERENCE_WORKSPACE.rules[0].id}`,
    )).toMatchObject({
      label: '高风险交易',
      group: 'rule',
    });
    expect(projected.links.filter(link =>
      link._linkTypeName === '使用特征',
    )).toHaveLength(4);
    expect(projected.links.some(link =>
      link.source === `outcome::${RISK_INFERENCE_WORKSPACE.outcomes[0].id}`
      && link.target === `rule::${RISK_INFERENCE_WORKSPACE.rules[0].id}`,
    )).toBe(true);
    expect(graph.nodes).toHaveLength(1);
  });
});
