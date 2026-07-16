import { describe, expect, it } from 'vitest';
import { buildOntologyExportSvg } from './OntologyExport';

describe('Ontology graph export geometry', () => {
  it('derives exact output bounds from every node and route without viewport input', () => {
    const nodes = [
      { id: 'left', position: { x: -620, y: 240 }, data: { obj: { id: 1, name: 'Left entity', object_type_id: 1 }, type: { name: 'Origin' } } },
      { id: 'right', position: { x: 940, y: -360 }, data: { obj: { id: 2, name: 'Right entity', object_type_id: 2 }, type: { name: 'Target' } } },
    ];
    const edges = [{ id: 'edge', source: 'left', target: 'right', label: 'depends on', data: {} }];
    const result = buildOntologyExportSvg(nodes, edges, 'hierarchical');

    expect(result.bounds.x).toBeLessThan(-620);
    expect(result.bounds.y).toBeLessThan(-360);
    expect(result.bounds.x + result.bounds.width).toBeGreaterThan(1160);
    expect(result.bounds.y + result.bounds.height).toBeGreaterThan(322);
    expect(result.svg).toContain('viewBox="');
    expect(result.svg).toContain('Left entity');
    expect(result.svg).toContain('Right entity');
    expect(result.svg).toContain('depends on');
    expect(result.svg).not.toContain('react-flow__viewport');
  });
});
