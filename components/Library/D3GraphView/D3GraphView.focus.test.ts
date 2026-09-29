import { describe, expect, it } from 'vitest';
import {
  buildReadableSubgraph,
  getNodeDegreeMap,
  pickDefaultFocusNode,
  type ScopeMode,
} from './D3GraphView.focus';
import type { GraphData } from './D3GraphView.types';

const mockGraphData: GraphData = {
  nodes: [
    // Level 1: TypeHubs
    { id: 'type::1', label: 'Brand', group: 'typeHub', color: '#ff6b35', size: 28, description: '' },
    { id: 'type::2', label: 'Product', group: 'typeHub', color: '#f4a261', size: 28, description: '' },

    // Level 2: Instances
    { id: 'obj::1', label: 'Apple', group: 'instance', color: '#4cc9f0', size: 11, description: '', _typeId: 1 },
    { id: 'obj::2', label: 'iPhone', group: 'instance', color: '#4361ee', size: 11, description: '', _typeId: 2 },

    // Level 3: Properties & Actions
    { id: 'prop::1::0', label: 'country: USA', group: 'property', color: '#38bdf8', size: 9, description: '', _objId: 1 },
    { id: 'prop::2::0', label: 'price: 7999', group: 'property', color: '#38bdf8', size: 9, description: '', _objId: 2 },
    { id: 'action::1', label: 'Restock', group: 'action', color: '#10b981', size: 10, description: '', _objId: 2 },
  ],
  links: [
    // Type-Instance links
    { source: 'obj::1', target: 'type::1', color: '#ff6b35', weight: 0.5, _isTypeInstLink: true },
    { source: 'obj::2', target: 'type::2', color: '#f4a261', weight: 0.5, _isTypeInstLink: true },

    // Instance-Instance semantic link
    { source: 'obj::1', target: 'obj::2', color: '#38bdf8', weight: 0.9, _linkTypeId: 1, _linkTypeName: 'produces' },

    // Property links
    { source: 'obj::1', target: 'prop::1::0', color: 'rgba(56, 189, 248, 0.55)', weight: 0.5, _isPropLink: true },
    { source: 'obj::2', target: 'prop::2::0', color: 'rgba(56, 189, 248, 0.55)', weight: 0.5, _isPropLink: true },

    // Action link
    { source: 'obj::2', target: 'action::1', color: '#10b981', weight: 0.5, _isActionLink: true },
  ],
  typeMap: {},
  linkTypeMap: {},
  typeNames: ['Brand', 'Product'],
};

describe('D3GraphView.focus — Multi-Hop Regulation', () => {
  it('defaults to 2-hop (二跳): returns Level 1 TypeHub + Level 2 Instance, omitting Level 3 Property and Action nodes in overview', () => {
    const result = buildReadableSubgraph(
      mockGraphData,
      null,
      '2-hop',
      0.2,
      false,
      new Set()
    );

    const groups = result.nodes.map(n => n.group);
    expect(groups).toContain('typeHub');
    expect(groups).toContain('instance');
    expect(groups).not.toContain('property');
    expect(groups).not.toContain('action');
    expect(result.nodes).toHaveLength(4); // 2 TypeHubs + 2 Instances

    // Property links and action links are excluded since target nodes are hidden
    const linkTypes = result.links.map(l => l._isPropLink || l._isActionLink);
    expect(linkTypes.every(v => !v)).toBe(true);
  });

  it('supports 1-hop (一跳): returns Level 1 TypeHub nodes only in overview', () => {
    const result = buildReadableSubgraph(
      mockGraphData,
      null,
      '1-hop',
      0.2,
      false,
      new Set()
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.every(n => n.group === 'typeHub')).toBe(true);
  });

  it('supports 3-hop (三跳): returns Level 1 + Level 2 + Level 3 Property and Action nodes in overview', () => {
    const result = buildReadableSubgraph(
      mockGraphData,
      null,
      '3-hop',
      0.2,
      false,
      new Set()
    );

    const groups = new Set(result.nodes.map(n => n.group));
    expect(groups.has('typeHub')).toBe(true);
    expect(groups.has('instance')).toBe(true);
    expect(groups.has('property')).toBe(true);
    expect(groups.has('action')).toBe(true);
    expect(result.nodes).toHaveLength(7);
  });

  it('supports all (全图): returns all nodes without truncation', () => {
    const result = buildReadableSubgraph(
      mockGraphData,
      null,
      'all',
      0.2,
      false,
      new Set()
    );

    expect(result.nodes).toHaveLength(7);
  });

  it('supports focused node BFS neighborhood traversal by hop limit', () => {
    // Focus on 'obj::1' (Apple) with 1-hop:
    // Direct neighbors: 'type::1' (Brand), 'obj::2' (iPhone), 'prop::1::0' (country: USA)
    const hop1 = buildReadableSubgraph(
      mockGraphData,
      'obj::1',
      '1-hop',
      0.2,
      false,
      new Set()
    );

    const hop1Ids = new Set(hop1.nodes.map(n => n.id));
    expect(hop1Ids.has('obj::1')).toBe(true);
    expect(hop1Ids.has('type::1')).toBe(true);
    expect(hop1Ids.has('obj::2')).toBe(true);
    expect(hop1Ids.has('prop::1::0')).toBe(true);
    // 2-hop neighbors (iPhone's property and action) should NOT be in 1-hop
    expect(hop1Ids.has('prop::2::0')).toBe(false);
    expect(hop1Ids.has('action::1')).toBe(false);

    // Focus on 'obj::1' (Apple) with 2-hop:
    // Should now reach 'prop::2::0', 'action::1', and 'type::2'
    const hop2 = buildReadableSubgraph(
      mockGraphData,
      'obj::1',
      '2-hop',
      0.2,
      false,
      new Set()
    );

    const hop2Ids = new Set(hop2.nodes.map(n => n.id));
    expect(hop2Ids.has('prop::2::0')).toBe(true);
    expect(hop2Ids.has('action::1')).toBe(true);
  });
});
