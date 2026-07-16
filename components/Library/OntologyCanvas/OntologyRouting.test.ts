import { describe, expect, it } from 'vitest';
import { getOrthogonalRoute, GraphRect } from './OntologyRouting';

const intersectsInterior = (a: { x: number; y: number }, b: { x: number; y: number }, rect: GraphRect) => {
  if (a.x === b.x) {
    return a.x > rect.x && a.x < rect.x + rect.width
      && Math.max(a.y, b.y) > rect.y
      && Math.min(a.y, b.y) < rect.y + rect.height;
  }
  return a.y > rect.y && a.y < rect.y + rect.height
    && Math.max(a.x, b.x) > rect.x
    && Math.min(a.x, b.x) < rect.x + rect.width;
};

describe('Ontology orthogonal routing', () => {
  it('uses only horizontal/vertical segments and avoids unrelated nodes', () => {
    const source = { id: 'source', x: 0, y: 100, width: 220, height: 82 };
    const blocker = { id: 'blocker', x: 330, y: 80, width: 220, height: 120 };
    const target = { id: 'target', x: 680, y: 100, width: 220, height: 82 };
    const route = getOrthogonalRoute(source, target, [source, blocker, target], 'hierarchical');

    expect(route.points.length).toBeGreaterThan(3);
    route.points.slice(1).forEach((point, index) => {
      const previous = route.points[index];
      expect(point.x === previous.x || point.y === previous.y).toBe(true);
      expect(intersectsInterior(previous, point, blocker)).toBe(false);
    });
    expect(route.path).not.toMatch(/[CQ]/);
  });
});
