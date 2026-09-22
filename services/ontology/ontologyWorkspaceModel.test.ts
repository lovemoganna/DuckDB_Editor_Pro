import { describe, expect, it } from 'vitest';
import type { OntologyEdge, OntologyNode } from '../../types/ontologyWorkspace';
import {
  buildSameLevelMatrix,
  compareOntologyEntities,
  findOntologyPaths,
  previewPropertyImpact,
} from './ontologyWorkspaceModel';

const nodes: OntologyNode[] = [
  {
    id: 'A', name: 'A', label: 'A', iri: 'ex:A', description: '',
    abstractionLevel: 'L1', domain: 'Commerce', type: 'class', status: 'normal',
    parentClassId: 'Root', subClassIds: ['AChild'],
    objectProperties: [{ name: 'toB', targetClassId: 'B', targetClassName: 'B', asserted: true }],
    dataProperties: [{ name: 'name', type: 'xsd:string' }],
  },
  {
    id: 'B', name: 'B', label: 'B', iri: 'ex:B', description: '',
    abstractionLevel: 'L1', domain: 'Commerce', type: 'class', status: 'normal',
    parentClassId: 'Root',
    objectProperties: [{ name: 'toC', targetClassId: 'C', targetClassName: 'C', asserted: true }],
    dataProperties: [{ name: 'name', type: 'xsd:string' }, { name: 'rating', type: 'xsd:decimal' }],
  },
  {
    id: 'C', name: 'C', label: 'C', iri: 'ex:C', description: '',
    abstractionLevel: 'L1', domain: 'Risk', type: 'class', status: 'normal',
  },
  {
    id: 'D', name: 'D', label: 'D', iri: 'ex:D', description: '',
    abstractionLevel: 'L2', domain: 'Commerce', type: 'class', status: 'normal',
  },
];

const edges: OntologyEdge[] = [
  {
    id: 'ab', source: 'A', target: 'B', relationName: 'toB', type: 'object_property',
    asserted: true, inferred: false, mapping: false, confidence: 'High',
  },
  {
    id: 'bc', source: 'B', target: 'C', relationName: 'toC', type: 'inferred',
    asserted: false, inferred: true, mapping: false, confidence: 'Medium',
  },
  {
    id: 'ac', source: 'A', target: 'C', relationName: 'directInferred', type: 'inferred',
    asserted: false, inferred: true, mapping: false, confidence: 'Low',
  },
];

describe('ontologyWorkspaceModel', () => {
  it('returns no fabricated fallback when no path exists', () => {
    expect(findOntologyPaths(nodes, edges, 'D', 'A', { maxDepth: 4, includeInferred: true })).toEqual([]);
  });

  it('respects max depth and inferred-edge filtering', () => {
    expect(findOntologyPaths(nodes, edges, 'A', 'C', { maxDepth: 1, includeInferred: false })).toEqual([]);

    const direct = findOntologyPaths(nodes, edges, 'A', 'C', { maxDepth: 1, includeInferred: true });
    expect(direct).toHaveLength(1);
    expect(direct[0].length).toBe(1);
    expect(direct[0].steps[0].relation).toBe('directInferred');

    const assertedOnly = findOntologyPaths(nodes, edges, 'A', 'B', { maxDepth: 2, includeInferred: false });
    expect(assertedOnly[0].steps.every((step) => !step.inferred)).toBe(true);
  });

  it('derives matrix cells from the actual filtered graph', () => {
    const matrix = buildSameLevelMatrix(nodes, edges, 'L1', { includeInferred: true });
    expect(matrix.entities.map((node) => node.name)).toEqual(['A', 'B', 'C']);
    expect(matrix.cells['A']['B'].relations.map((edge) => edge.id)).toEqual(['ab']);
    expect(matrix.cells['A']['C'].kind).toBe('inferred');
  });

  it('compares the selected entities rather than returning Product/Supplier constants', () => {
    const comparison = compareOntologyEntities(nodes, edges, 'A', 'B');
    expect(comparison.shared.dataProperties).toEqual(['name']);
    expect(comparison.onlyA.objectProperties).toEqual(['toB']);
    expect(comparison.onlyB.dataProperties).toEqual(['rating']);
    expect(comparison.metrics.objectProperties).toEqual({ a: 1, b: 1 });
  });

  it('calculates property impact from reachable dependencies', () => {
    const impact = previewPropertyImpact(nodes, edges, 'toB', 'B OR C');
    expect(impact.objectPropertiesCount).toBe(1);
    expect(impact.classesCount).toBeGreaterThanOrEqual(2);
    expect(impact.examples).toContain('A');
    expect(impact.examples).toContain('B');
  });
});
