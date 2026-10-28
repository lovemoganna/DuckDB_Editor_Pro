import { describe, it, expect } from 'vitest';
import { buildGraphDataFromState, buildSchemaGraphLinks } from './D3GraphView.data';

describe('schema graph projection', () => {
  it('displays saved type relations with zero business instances', () => {
    const types = [{ id: 1, name: 'Customer', description: '' }, { id: 2, name: 'Order', description: '' }];
    const relations = [{ id: 1, name: 'PLACED', fromType: 'Customer', toType: 'Order' }];
    const data = buildGraphDataFromState({ objectTypes: types, linkTypes: relations, objects: [], links: [], actions: [] }, {});
    expect(data?.nodes.map(n => n.id)).toEqual(['type::1','type::2']);
    expect(data?.links).toEqual([expect.objectContaining({ source: 'type::1', target: 'type::2', _isSchemaLink: true })]);
    expect(buildSchemaGraphLinks(types, [{ id: 2, name: 'dangling', fromType: 'Missing', toType: 'Order' }])).toEqual([]);
  });
});
