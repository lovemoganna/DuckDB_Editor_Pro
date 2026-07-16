import { describe, expect, it } from 'vitest';
import { Node } from 'reactflow';
import {
  getLayoutedElements,
  getOntologyNodeDimensions,
  ONTOLOGY_LAYOUTS,
} from './OntologyLayout';

const node = (id: string, data: Record<string, unknown> = {}) => ({ id, position: { x: 0, y: 0 }, data });
const edge = (source: string, target: string, index = 0) => ({ id: `${source}-${target}-${index}`, source, target });

const graphNodes = [
  node('root'),
  node('a'), node('b'), node('c'),
  node('a-1'), node('a-2'), node('b-1'), node('b-2'), node('c-1'),
  node('detached-1'), node('detached-2'),
];
const graphEdges = [
  edge('root', 'a'), edge('root', 'b'), edge('root', 'c'),
  edge('a', 'a-1'), edge('a', 'a-2'), edge('b', 'b-1'), edge('b', 'b-2'), edge('c', 'c-1'),
  edge('a-1', 'b-2'), edge('detached-1', 'detached-2'),
];

const overlaps = (a: Node, b: Node) => {
  const da = getOntologyNodeDimensions(a);
  const db = getOntologyNodeDimensions(b);
  return a.position.x < b.position.x + db.width
    && a.position.x + da.width > b.position.x
    && a.position.y < b.position.y + db.height
    && a.position.y + da.height > b.position.y;
};

describe('Ontology canvas layouts', () => {
  it.each(ONTOLOGY_LAYOUTS.map((layout) => layout.id))('%s is deterministic and non-overlapping', (mode) => {
    const first = getLayoutedElements(graphNodes, graphEdges, mode, 130, 220).nodes;
    const second = getLayoutedElements(graphNodes, graphEdges, mode, 130, 220).nodes;
    expect(first.map(({ id, position }) => ({ id, position })))
      .toEqual(second.map(({ id, position }) => ({ id, position })));

    first.forEach((current, index) => {
      first.slice(index + 1).forEach((other) => {
        expect(overlaps(current, other), `${mode}: ${current.id} overlaps ${other.id}`).toBe(false);
      });
    });
  });

  it('keeps radial descendants on outward rings', () => {
    const result = getLayoutedElements(
      [node('root'), node('child-a'), node('child-b'), node('leaf')],
      [edge('root', 'child-a'), edge('root', 'child-b'), edge('child-a', 'leaf')],
      'radial',
      180,
      280,
    );
    const positions = new Map(result.nodes.map((item) => [item.id, item.position]));
    const radius = (id: string) => Math.hypot(positions.get(id)!.x + 110, positions.get(id)!.y + 41);
    expect(radius('root')).toBeLessThan(50);
    expect(radius('child-a')).toBeGreaterThan(200);
    expect(radius('leaf')).toBeGreaterThan(radius('child-a'));
  });
});
