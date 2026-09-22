import { describe, it, expect } from 'vitest';
import {
  resolveCollisions,
  computeLinkPath,
  GRID_SIZE,
  SavedPositions,
} from './OntologyCanvas.helpers';

describe('OntologyCanvas.helpers - Grid collision resolution', () => {
  it('snaps dropped position to GRID_SIZE multiples and resolves overlapping nodes', () => {
    const initialPositions: SavedPositions = {
      1: { x: 105, y: 203 }, // Unsnapped dropped node
      2: { x: 100, y: 200 }, // Pre-existing node
    };

    const resolved = resolveCollisions(1, initialPositions);

    // Node 1 position must be integer multiple of GRID_SIZE (20)
    expect(resolved[1].x % GRID_SIZE).toBe(0);
    expect(resolved[1].y % GRID_SIZE).toBe(0);

    // Node 1 should be pushed away from Node 2 to eliminate AABB collision
    const isOverlapping =
      Math.abs(resolved[1].x - resolved[2].x) < 220 + 20 - 5 &&
      Math.abs(resolved[1].y - resolved[2].y) < 82 + 20 - 5;
    expect(isOverlapping).toBe(false);
  });

  it('preserves non-colliding node positions without modifying them', () => {
    const initialPositions: SavedPositions = {
      1: { x: 0, y: 0 },
      2: { x: 500, y: 500 },
    };

    const resolved = resolveCollisions(1, initialPositions);
    expect(resolved[1]).toEqual({ x: 0, y: 0 });
    expect(resolved[2]).toEqual({ x: 500, y: 500 });
  });
});

describe('OntologyCanvas.helpers - Link path calculations', () => {
  it('computes accurate edge anchor paths for compact mode (zoom < 0.35)', () => {
    const srcPos = { x: 100, y: 100 };
    const tgtPos = { x: 400, y: 100 };

    const compactResult = computeLinkPath(
      1,
      10,
      20,
      srcPos,
      tgtPos,
      0.3, // zoom < 0.35 -> compact mode
      false,
      false,
      {}
    );

    expect(compactResult.smoothPath).not.toBe('');
    expect(compactResult.arrowheadPath).not.toBe('');
    expect(isNaN(compactResult.labelX)).toBe(false);
    expect(isNaN(compactResult.labelY)).toBe(false);

    // Compact width is 170px (w = 85). Exact offset = 85px.
    // sourceX is 185 (100 + 85)
    expect(compactResult.smoothPath).toContain('M 185 100');
  });

  it('computes accurate edge anchor paths for standard mode (zoom >= 0.35)', () => {
    const srcPos = { x: 100, y: 100 };
    const tgtPos = { x: 400, y: 100 };

    const normalResult = computeLinkPath(
      1,
      10,
      20,
      srcPos,
      tgtPos,
      0.8, // zoom >= 0.35 -> standard mode
      false,
      false,
      {}
    );

    // Standard width is 210px (w = 105). Exact offset = 105px.
    // sourceX is 205 (100 + 105)
    expect(normalResult.smoothPath).toContain('M 205 100');
  });
});
