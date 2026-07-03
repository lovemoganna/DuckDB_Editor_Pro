import { describe, expect, it } from 'vitest';
import {
  aggregateParallelEdges,
  buildGraphDataFromState,
  computeEdgeGroupOffsets,
} from './D3GraphView.data';
import { ONTOLOGY_SEED_STATEMENTS } from '../ontologyDataModel';
import type { GraphLink, GraphNode } from './D3GraphView.types';

const mapping = {
  objectTypeTable: 'life_object_type',
  objectTable: 'life_object',
  linkTypeTable: 'life_link_type',
  linkTable: 'life_link',
  actionTable: 'life_action',
};

const countInsertRows = (statement: string) => {
  const values = statement.match(/VALUES\s+([\s\S]*?)\s+ON CONFLICT/i)?.[1] || '';
  return values.split(/\),\s*\(/).filter(Boolean).length;
};

const defaultSeedState = {
  objectTypes: [
    { id: 1, name: 'Aspect', description: '生活维度' },
    { id: 2, name: 'Person', description: '人物' },
    { id: 3, name: 'Goal', description: '目标' },
  ],
  objects: [
    { id: 1, object_type_id: 1, name: '心态', properties: '{"state":"焦虑"}' },
    { id: 2, object_type_id: 1, name: '工作', properties: '{"role":"工程师"}' },
    { id: 3, object_type_id: 1, name: '家庭', properties: '{"priority":"最高"}' },
    { id: 4, object_type_id: 1, name: '身体', properties: '{"state":"还行"}' },
    { id: 5, object_type_id: 2, name: '父母', properties: '{"relationship":"直系亲属"}' },
    { id: 6, object_type_id: 2, name: '配偶', properties: '{"relationship":"伴侣"}' },
    { id: 7, object_type_id: 2, name: '同事小王', properties: '{"relationship":"同事"}' },
    { id: 8, object_type_id: 2, name: '老友老李', properties: '{"relationship":"挚友"}' },
    { id: 9, object_type_id: 3, name: '副业变现', properties: '{"progress":20}' },
    { id: 10, object_type_id: 3, name: '读完50本书', properties: '{"progress":38}' },
    { id: 11, object_type_id: 3, name: '跑完半马', properties: '{"progress":60}' },
    { id: 12, object_type_id: 3, name: '掌握日语N3', properties: '{"progress":45}' },
  ],
  linkTypes: [
    { id: 1, name: '影响', description: 'A 作用于 B' },
    { id: 2, name: '养活', description: 'A 为 B 提供物质基础' },
    { id: 3, name: '锚定', description: 'A 为 B 提供精神支撑' },
    { id: 4, name: '支撑', description: 'A 为 B 提供基础条件' },
    { id: 5, name: '依恋', description: 'A 深度依赖 B' },
    { id: 6, name: '协助', description: 'A 帮助 B 完成任务' },
  ],
  links: [
    { id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.9 },
    { id: 2, link_type_id: 2, source_object_id: 2, target_object_id: 3, weight: 1.0 },
    { id: 3, link_type_id: 3, source_object_id: 3, target_object_id: 1, weight: 0.8 },
    { id: 4, link_type_id: 4, source_object_id: 4, target_object_id: 1, weight: 0.7 },
    { id: 5, link_type_id: 1, source_object_id: 6, target_object_id: 1, weight: 0.95 },
    { id: 6, link_type_id: 3, source_object_id: 5, target_object_id: 1, weight: 0.85 },
    { id: 7, link_type_id: 5, source_object_id: 5, target_object_id: 6, weight: 1.0 },
    { id: 8, link_type_id: 6, source_object_id: 7, target_object_id: 2, weight: 0.6 },
    { id: 9, link_type_id: 1, source_object_id: 8, target_object_id: 1, weight: 0.7 },
    { id: 10, link_type_id: 3, source_object_id: 8, target_object_id: 1, weight: 0.75 },
    { id: 11, link_type_id: 4, source_object_id: 4, target_object_id: 11, weight: 0.9 },
    { id: 12, link_type_id: 2, source_object_id: 2, target_object_id: 9, weight: 0.8 },
    { id: 13, link_type_id: 1, source_object_id: 1, target_object_id: 10, weight: 0.5 },
  ],
  actions: [
    { id: 1, object_id: 4, name: '早睡早起', description: '调整作息', status: 'pending', execute_at: '2024-12-31' },
    { id: 2, object_id: 9, name: '搭建 MVP', description: '完成副业项目', status: 'pending', execute_at: '2025-06-01' },
    { id: 3, object_id: 11, name: '月跑量80公里', description: '跑步目标', status: 'pending', execute_at: '2025-05-01' },
  ],
};

describe('default ontology seed', () => {
  it('contains complete Aspect, Person, and Goal starter data', () => {
    const objectTypeRows = countInsertRows(ONTOLOGY_SEED_STATEMENTS.find(s => s.includes('life_object_type'))!);
    const objectRows = ONTOLOGY_SEED_STATEMENTS
      .filter(s => s.includes('INSERT INTO life_object '))
      .reduce((sum, s) => sum + countInsertRows(s), 0);
    const linkTypeRows = countInsertRows(ONTOLOGY_SEED_STATEMENTS.find(s => s.includes('life_link_type'))!);
    const linkRows = countInsertRows(ONTOLOGY_SEED_STATEMENTS.find(s => s.includes('INSERT INTO life_link VALUES'))!);
    const actionRows = countInsertRows(ONTOLOGY_SEED_STATEMENTS.find(s => s.includes('life_action'))!);

    expect(objectTypeRows).toBe(3);
    expect(objectRows).toBe(12);
    expect(linkTypeRows).toBe(6);
    expect(linkRows).toBe(13);
    expect(actionRows).toBe(3);
  });
});

describe('buildGraphDataFromState', () => {
  it('treats LinkType rows as edge semantics instead of graph nodes', () => {
    const graph = buildGraphDataFromState({
      objectTypes: [{ id: 1, name: 'Aspect', description: 'life area' }],
      objects: [
        { id: 1, object_type_id: 1, name: 'Work', properties: '{"priority":1}' },
        { id: 2, object_type_id: 1, name: 'Reading', properties: '{}' },
      ],
      linkTypes: [{ id: 1, name: 'supports', description: 'supports relation' }],
      links: [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.9 }],
      actions: [{ id: 1, object_id: 2, name: 'Read tonight', description: '', status: 'todo', execute_at: '' }],
    }, mapping);

    expect(graph).not.toBeNull();
    expect(graph!.nodes).toHaveLength(4);
    expect(graph!.nodes.some(node => node.id.startsWith('linktype::') || node.group === 'linkType')).toBe(false);

    const semanticLink = graph!.links.find(link => link._linkTypeId === 1);
    expect(semanticLink).toMatchObject({
      source: 'obj::1',
      target: 'obj::2',
      _linkTypeId: 1,
      _linkTypeName: 'supports',
    });
    expect(semanticLink?.color).toMatch(/^#/);
  });

  it('renders complete default seed nodes and cross-type semantic relations', () => {
    const graph = buildGraphDataFromState(defaultSeedState, mapping);

    expect(graph).not.toBeNull();
    expect(graph!.nodes).toHaveLength(18);
    expect(graph!.links).toHaveLength(28);
    expect(graph!.nodes.some(node => node.group === 'linkType')).toBe(false);

    const instanceNodes = graph!.nodes.filter(node => node.group === 'instance');
    expect(instanceNodes.filter(node => node._typeId === 2)).toHaveLength(4);
    expect(instanceNodes.filter(node => node._typeId === 3)).toHaveLength(4);

    const objectById = new Map(defaultSeedState.objects.map(obj => [obj.id, obj]));
    const hasPersonToAspect = defaultSeedState.links.some(link =>
      objectById.get(link.source_object_id)?.object_type_id === 2 &&
      objectById.get(link.target_object_id)?.object_type_id === 1
    );
    const hasAspectToGoal = defaultSeedState.links.some(link =>
      objectById.get(link.source_object_id)?.object_type_id === 1 &&
      objectById.get(link.target_object_id)?.object_type_id === 3
    );

    expect(hasPersonToAspect).toBe(true);
    expect(hasAspectToGoal).toBe(true);
  });
});

describe('parallel edge routing helpers', () => {
  it('assigns different curve offsets to multiple semantic links with the same endpoints', () => {
    const nodes: GraphNode[] = [
      { id: 'obj::1', label: 'Source', group: 'instance', color: '#fff', size: 10, description: '' },
      { id: 'obj::2', label: 'Target', group: 'instance', color: '#fff', size: 10, description: '' },
    ];
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const links: GraphLink[] = [
      { source: 'obj::1', target: 'obj::2', color: '#5ab0d0', weight: 0.5, _linkTypeId: 1, _linkTypeName: 'supports' },
      { source: 'obj::1', target: 'obj::2', color: '#60c0e0', weight: 0.8, _linkTypeId: 2, _linkTypeName: 'blocks' },
    ];

    const { aggregatedLinks } = aggregateParallelEdges(
      links,
      nodeMap,
      link => nodeMap.get(String(link.source)),
      link => nodeMap.get(String(link.target)),
    );

    computeEdgeGroupOffsets(
      aggregatedLinks,
      link => nodeMap.get(String(link.source)),
      link => nodeMap.get(String(link.target)),
    );

    const offsets = aggregatedLinks.map(link => link._groupOffset);
    expect(new Set(offsets).size).toBe(2);
    expect(offsets.every(offset => typeof offset === 'number' && offset !== 0)).toBe(true);
  });
});
