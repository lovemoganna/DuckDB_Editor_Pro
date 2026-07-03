import { describe, expect, it } from 'vitest';
import {
  buildOntologyCanvasModel,
  buildCanvasViewInsight,
  buildPathSegments,
  buildRelationLegend,
  collectNeighborhoodNodeIds,
  collectConnectedNodeIds,
  filterCanvasModel,
  findShortestNodePath,
  removeLayoutForObject,
} from './CanvasOntologyModel';

const objectTypes = [
  { id: 1, name: 'Person', description: 'People and roles' },
  { id: 2, name: 'Project', description: 'Work containers' },
];

const objects = [
  { id: 10, object_type_id: 1, name: 'Alice', properties: '{}', annotations: '' },
  { id: 20, object_type_id: 2, name: 'Canvas Revamp', properties: '{}', annotations: '' },
  { id: 30, object_type_id: 2, name: 'QA Plan', properties: '{}', annotations: '' },
];

const linkTypes = [
  { id: 100, name: 'owns', description: 'Ownership relation' },
  { id: 200, name: 'depends_on', description: 'Dependency relation' },
];

describe('buildOntologyCanvasModel', () => {
  it('maps ontology objects and links into readable canvas nodes and edges', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 1, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
      ],
      layout: { 10: { x: 42, y: 84 } },
    });

    expect(model.nodes).toHaveLength(3);
    expect(model.nodes[0]).toMatchObject({
      id: 'object-10',
      objectId: 10,
      typeName: 'Person',
      x: 42,
      y: 84,
      outbound: 1,
      degree: 1,
    });
    expect(model.edges[0]).toMatchObject({
      id: 'link-1',
      sourceNodeId: 'object-10',
      targetNodeId: 'object-20',
      label: 'owns',
      status: 'strong',
    });
    expect(model.stats).toMatchObject({ objects: 3, links: 1, danglingLinks: 0 });
    expect(model.typeGroups).toEqual([
      expect.objectContaining({ typeName: 'Project', count: 2 }),
      expect.objectContaining({ typeName: 'Person', count: 1 }),
    ]);
  });

  it('keeps orphan nodes visible and reports missing object types', () => {
    const model = buildOntologyCanvasModel({
      objects: [
        ...objects,
        { id: 40, object_type_id: 999, name: 'Unknown', properties: '{}', annotations: '' },
      ],
      objectTypes,
      linkTypes,
      links: [],
    });

    const unknown = model.nodes.find(node => node.objectId === 40);
    expect(unknown).toMatchObject({
      typeName: 'Missing type #999',
      missingType: true,
      inbound: 0,
      outbound: 0,
    });
    expect(model.warnings.some(warning => warning.code === 'missing-object-type')).toBe(true);
  });

  it('normalizes legacy percentage weights into canvas weights', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 18, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 90 },
        { id: 19, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 150 },
      ],
    });

    expect(model.edges[0]).toMatchObject({ weight: 0.9, status: 'strong' });
    expect(model.edges[1]).toMatchObject({ weight: 1, status: 'strong' });
    expect(model.relationSummaries.find(summary => summary.linkTypeId === 100)?.averageWeight).toBe(0.9);
  });

  it('drops dangling links from rendering and reports them', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 2, link_type_id: 100, source_object_id: 10, target_object_id: 999, weight: 0.5 },
      ],
    });

    expect(model.edges).toHaveLength(0);
    expect(model.stats.danglingLinks).toBe(1);
    expect(model.warnings).toContainEqual(expect.objectContaining({
      code: 'dangling-link',
      linkId: 2,
    }));
    expect(model.readabilityWarnings).toContainEqual(expect.objectContaining({
      code: 'dangling-link',
      severity: 'warning',
    }));
  });

  it('marks duplicate and reversed relationships without hiding them', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 3, link_type_id: 200, source_object_id: 10, target_object_id: 20, weight: 0.5 },
        { id: 4, link_type_id: 200, source_object_id: 10, target_object_id: 20, weight: 0.4 },
        { id: 5, link_type_id: 200, source_object_id: 20, target_object_id: 10, weight: 0.3 },
      ],
    });

    expect(model.edges).toHaveLength(3);
    expect(model.edges[0]).toMatchObject({ duplicateCount: 2, duplicateIndex: 0, hasReverse: true });
    expect(model.edges[1]).toMatchObject({ duplicateCount: 2, duplicateIndex: 1, hasReverse: true });
    expect(model.edges[2]).toMatchObject({ status: 'weak', hasReverse: true });
    expect(model.warnings.filter(warning => warning.code === 'duplicate-link')).toHaveLength(2);
    expect(model.relationSummaries[0]).toMatchObject({
      label: 'depends_on',
      count: 3,
      duplicateCount: 2,
      reverseCount: 3,
      weakCount: 1,
    });
    expect(model.readabilityWarnings.some(warning => warning.code === 'duplicate-link')).toBe(true);
    expect(model.readabilityWarnings.some(warning => warning.code === 'reverse-link')).toBe(true);
  });

  it('summarizes hub and isolated nodes for observation-first UI', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 8, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 9, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.6 },
      ],
    });

    expect(model.hubNodes[0]).toMatchObject({
      name: 'Alice',
      degree: 2,
      inbound: 1,
      outbound: 1,
    });
    expect(model.isolatedNodes).toHaveLength(0);
  });

  it('builds analysis tasks for core focus, relation filtering, and path tracing', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 21, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 22, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });

    expect(model.analysisTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'inspect-node',
        title: '从核心节点开始',
        nodeId: 'object-20',
      }),
      expect.objectContaining({
        action: 'filter-relation',
        linkTypeId: 200,
      }),
      expect.objectContaining({
        action: 'trace-path',
        sourceNodeId: 'object-20',
      }),
    ]));
  });

  it('promotes readability issues into analysis tasks', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 23, link_type_id: 200, source_object_id: 10, target_object_id: 20, weight: 0.5 },
        { id: 24, link_type_id: 200, source_object_id: 10, target_object_id: 20, weight: 0.4 },
        { id: 25, link_type_id: 200, source_object_id: 20, target_object_id: 10, weight: 0.3 },
      ],
    });

    expect(model.analysisTasks).toContainEqual(expect.objectContaining({
      action: 'show-issues',
      title: '查看结构异常',
    }));
  });

  it('keeps filtered analysis tasks aligned with the visible canvas model', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 26, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 27, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });

    const filtered = filterCanvasModel(model, { linkTypeId: 200, hideIsolated: true });

    expect(filtered.analysisTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'filter-relation', linkTypeId: 200 }),
    ]));
    expect(filtered.analysisTasks.some(task => task.nodeId === 'object-10')).toBe(false);
  });

  it('explains the current core canvas view with key facts and next action', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 28, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 29, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.6 },
      ],
    });

    const insight = buildCanvasViewInsight({
      baseModel: model,
      viewModel: model,
      mode: 'core',
    });

    expect(insight).toMatchObject({
      title: '核心结构围绕 Alice',
      keyNodeId: 'object-10',
      severity: 'info',
    });
    expect(insight.keyFacts).toContain('核心 Alice · 2 连接');
    expect(insight.scopeFacts).toContain('范围：核心与近邻');
    expect(insight.nextAction).toContain('Alice');
  });

  it('explains relation-filtered views as scoped analysis', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 30, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 31, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });
    const filtered = filterCanvasModel(model, { linkTypeId: 100 });

    const insight = buildCanvasViewInsight({
      baseModel: model,
      viewModel: filtered,
      mode: 'all',
      relationLabel: 'owns',
      hideIsolated: true,
    });

    expect(insight.title).toBe('正在只看「owns」');
    expect(insight.keyRelationTypeId).toBe(100);
    expect(insight.explanation).toContain('按关系类型收敛');
    expect(insight.scopeFacts).toEqual(expect.arrayContaining([
      '隐藏关系 1',
      '关系筛选：owns',
      '孤立对象已隐藏',
    ]));
  });

  it('explains missing path results with recovery guidance', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 32, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
      ],
    });

    const insight = buildCanvasViewInsight({
      baseModel: model,
      viewModel: filterCanvasModel(model, { nodeIds: new Set(['object-10', 'object-30']), edgeIds: new Set() }),
      mode: 'path',
      pathFound: false,
    });

    expect(insight).toMatchObject({
      title: '没有找到可达路径',
      severity: 'warning',
    });
    expect(insight.scopeFacts).toEqual(expect.arrayContaining([
      '隐藏对象 1',
      '隐藏关系 1',
      '范围：路径未命中',
    ]));
    expect(insight.nextAction).toContain('回到全量视图');
  });

  it('builds selected node context with incoming, outgoing, neighbors, and questions', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      selectedNodeId: 'object-10',
      links: [
        { id: 10, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 11, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.6 },
      ],
    });

    expect(model.selectedNodeContext?.node.name).toBe('Alice');
    expect(model.selectedNodeContext?.incoming).toHaveLength(1);
    expect(model.selectedNodeContext?.outgoing).toHaveLength(1);
    expect(model.selectedNodeContext?.neighbors.map(node => node.name).sort()).toEqual(['Canvas Revamp', 'QA Plan']);
    expect(model.selectedNodeContext?.relationBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'depends_on', incoming: 1, outgoing: 0, total: 1 }),
      expect.objectContaining({ label: 'owns', incoming: 0, outgoing: 1, total: 1, strongCount: 1 }),
    ]));
    expect(model.selectedNodeContext?.observationQuestions).toHaveLength(3);
  });

  it('builds selected edge context for relation-first inspection', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      selectedEdgeId: 'link-10',
      links: [
        { id: 10, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 11, link_type_id: 100, source_object_id: 20, target_object_id: 30, weight: 0.6 },
        { id: 12, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.4 },
      ],
    });

    expect(model.selectedEdgeContext).toMatchObject({
      edge: expect.objectContaining({ id: 'link-10', label: 'owns' }),
      source: expect.objectContaining({ name: 'Alice' }),
      target: expect.objectContaining({ name: 'Canvas Revamp' }),
      sameTypeCount: 2,
      sameTypeVisibleRatio: 0.6667,
      isPrimaryRelationType: true,
      sourceDegree: 2,
      targetDegree: 2,
    });
    expect(model.selectedEdgeContext?.observationQuestions).toEqual(expect.arrayContaining([
      expect.stringContaining('Alice 到 Canvas Revamp'),
      expect.stringContaining('同类关系还有 1 条'),
    ]));
  });

  it('reports isolated nodes as readability warnings', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [],
    });

    expect(model.isolatedNodes.map(node => node.name)).toEqual(['Alice', 'Canvas Revamp', 'QA Plan']);
    expect(model.readabilityWarnings.filter(warning => warning.code === 'isolated-node')).toHaveLength(3);
  });
});

describe('canvas model helpers', () => {
  it('collects selected node and one-hop neighbors', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 6, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 7, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.5 },
      ],
    });

    expect([...collectConnectedNodeIds('object-10', model.edges)].sort()).toEqual([
      'object-10',
      'object-20',
      'object-30',
    ]);
  });

  it('removes stale layout when an object is deleted', () => {
    expect(removeLayoutForObject({ 10: { x: 1, y: 2 }, 20: { x: 3, y: 4 } }, 10)).toEqual({
      20: { x: 3, y: 4 },
    });
  });

  it('collects one-hop and two-hop neighborhoods for local focus', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 12, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 13, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });

    expect([...collectNeighborhoodNodeIds('object-10', model.edges, 1)].sort()).toEqual([
      'object-10',
      'object-20',
    ]);
    expect([...collectNeighborhoodNodeIds('object-10', model.edges, 2)].sort()).toEqual([
      'object-10',
      'object-20',
      'object-30',
    ]);
  });

  it('finds a shortest path between two nodes', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 14, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 15, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });

    expect(findShortestNodePath('object-10', 'object-30', model.edges)).toEqual({
      nodeIds: ['object-10', 'object-20', 'object-30'],
      edgeIds: ['link-14', 'link-15'],
    });
  });

  it('describes path segments with relationship direction', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 36, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 37, link_type_id: 200, source_object_id: 30, target_object_id: 20, weight: 0.6 },
      ],
    });

    expect(buildPathSegments({
      nodeIds: ['object-10', 'object-20', 'object-30'],
      edgeIds: ['link-36', 'link-37'],
    }, model.nodes, model.edges)).toEqual([
      expect.objectContaining({
        edge: expect.objectContaining({ label: 'owns' }),
        from: expect.objectContaining({ name: 'Alice' }),
        to: expect.objectContaining({ name: 'Canvas Revamp' }),
        relationDirection: 'forward',
      }),
      expect.objectContaining({
        edge: expect.objectContaining({ label: 'depends_on' }),
        from: expect.objectContaining({ name: 'Canvas Revamp' }),
        to: expect.objectContaining({ name: 'QA Plan' }),
        relationDirection: 'reverse',
      }),
    ]);
  });

  it('filters visible model by link type and isolated nodes', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 16, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 17, link_type_id: 200, source_object_id: 20, target_object_id: 30, weight: 0.6 },
      ],
    });

    const ownsOnly = filterCanvasModel(model, { linkTypeId: 100 });
    expect(ownsOnly.edges.map(edge => edge.label)).toEqual(['owns']);
    expect(ownsOnly.relationSummaries).toHaveLength(1);
    expect(ownsOnly.relationSummaries[0]).toMatchObject({ linkTypeId: 100, count: 1 });
    expect(ownsOnly.nodes.find(node => node.name === 'QA Plan')).toMatchObject({ inbound: 0, outbound: 0, degree: 0 });
    expect(ownsOnly.hubNodes.map(node => node.name)).not.toContain('QA Plan');

    const noIsolated = filterCanvasModel(buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [],
    }), { hideIsolated: true });
    expect(noIsolated.nodes).toHaveLength(0);
  });

  it('treats isolated nodes in issue view as actionable structure issues', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [],
    });
    const viewModel = filterCanvasModel(model, {
      nodeIds: new Set(['object-30']),
      hideIsolated: false,
    });

    const insight = buildCanvasViewInsight({
      baseModel: model,
      viewModel,
      mode: 'issues',
      hideIsolated: false,
    });

    expect(insight.severity).toBe('warning');
    expect(insight.explanation).toContain('孤立对象');
  });

  it('builds relation legend with visible and hidden counts', () => {
    const model = buildOntologyCanvasModel({
      objects,
      objectTypes,
      linkTypes,
      links: [
        { id: 33, link_type_id: 100, source_object_id: 10, target_object_id: 20, weight: 0.8 },
        { id: 34, link_type_id: 100, source_object_id: 20, target_object_id: 30, weight: 0.7 },
        { id: 35, link_type_id: 200, source_object_id: 30, target_object_id: 10, weight: 0.6 },
      ],
    });
    const filtered = filterCanvasModel(model, { linkTypeId: 100 });

    expect(buildRelationLegend(model, filtered)).toEqual([
      expect.objectContaining({
        linkTypeId: 100,
        label: 'owns',
        visibleCount: 2,
        totalCount: 2,
        hiddenCount: 0,
      }),
      expect.objectContaining({
        linkTypeId: 200,
        label: 'depends_on',
        visibleCount: 0,
        totalCount: 1,
        hiddenCount: 1,
      }),
    ]);
  });
});
