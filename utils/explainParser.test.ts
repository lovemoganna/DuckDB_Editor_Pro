/**
 * explainParser.test.ts — Unit tests for explainParser
 *
 * Loop 6 of SqlEditor Pro refactor.
 */

import { describe, it, expect } from 'vitest';
import {
  parseExplainOutput,
  formatCost,
  formatCardinality,
  costColor,
} from './explainParser';

describe('explainParser', () => {

  describe('formatCost', () => {
    it('formats millions', () => {
      expect(formatCost(1_500_000)).toBe('1.50M');
    });
    it('formats thousands', () => {
      expect(formatCost(1_500)).toBe('1.50K');
    });
    it('formats small numbers', () => {
      expect(formatCost(3.14)).toBe('3.14');
    });
    it('handles undefined', () => {
      expect(formatCost(undefined)).toBe('—');
    });
  });

  describe('formatCardinality', () => {
    it('formats millions', () => {
      expect(formatCardinality(50000)).toBe('50.0K');
    });
    it('formats small numbers', () => {
      expect(formatCardinality(7)).toBe('7');
    });
    it('handles undefined', () => {
      expect(formatCardinality(undefined)).toBe('—');
    });
  });

  describe('costColor', () => {
    it('returns green for cheap nodes (<20%)', () => {
      expect(costColor(0.1)).toBe('text-monokai-green');
    });
    it('returns yellow for moderate cost (20-50%)', () => {
      expect(costColor(0.3)).toBe('text-monokai-yellow');
    });
    it('returns orange for high cost (50-80%)', () => {
      expect(costColor(0.6)).toBe('text-monokai-orange');
    });
    it('returns pink for expensive nodes (>=80%)', () => {
      expect(costColor(0.9)).toBe('text-monokai-pink');
    });
    it('returns comment color for undefined', () => {
      expect(costColor(undefined)).toBe('text-monokai-comment');
    });
  });

  describe('parseExplainOutput', () => {
    it('returns empty array for empty string', () => {
      expect(parseExplainOutput('')).toEqual([]);
    });

    it('parses plain text lines as other nodes', () => {
      const nodes = parseExplainOutput('Physical Plan');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Physical Plan');
      expect(nodes[0].type).toBe('other');
    });

    it('parses a simple single-node box', () => {
      const raw = `
┌──────────────────────┐
│    Result Collector    │
└──────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Result Collector');
      expect(nodes[0].type).toBe('result');
    });

    it('extracts EC and Cost from annotations', () => {
      const raw = `
┌─────────────────────┐
│       Hash Join        │
│    EC: 5820.46 (85.00%)   │
│    Cost: 5820.46     │
└─────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].estimatedCost).toBeCloseTo(5820.46);
      expect(nodes[0].costFraction).toBeCloseTo(0.85);
    });

    it('extracts estimated cardinalities', () => {
      const raw = `
┌─────────────────────────────┐
│       Seq Scan on my_table   │
│    Estimated Cardinalities: 100000, 5000  │
└─────────────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].estimatedCardinalities).toEqual([100000, 5000]);
    });

    it('classifies scan nodes', () => {
      const raw = `
┌────────────────────────┐
│  Seq Scan on orders     │
└────────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].type).toBe('scan');
    });

    it('classifies join nodes', () => {
      const raw = `
┌─────────────────────────┐
│       Hash Join           │
│    EC: 100.00 (100.00%)   │
└─────────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].type).toBe('join');
    });

    it('classifies aggregate nodes', () => {
      const raw = `
┌───────────────────────┐
│   Hash Group By        │
└───────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].type).toBe('aggregate');
    });

    it('classifies sort nodes', () => {
      const raw = `
┌─────────────┐
│  Order By    │
└─────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].type).toBe('sort');
    });

    it('skips blank lines at start', () => {
      const raw = `

┌──────────────────┐
│  Result           │
└──────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(1);
    });

    it('produces unique IDs for each node', () => {
      const raw = `
┌────────────────┐
│  Node A         │
└────────────────┘
┌────────────────┐
│  Node B         │
└────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].id).not.toBe(nodes[1].id);
    });

    it('assigns children under parent node', () => {
      const raw = `
┌─────────────────────────────────────┐
│          Hash Join                    │
│         EC: 1.00 (100.00%)           │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │       Seq Scan on t1              │
    └─────────────────────────────────┘
    ┌─────────────────────────────────┐
    │       Seq Scan on t2              │
    └─────────────────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].children).toHaveLength(2);
      expect(nodes[0].children[0].type).toBe('scan');
      expect(nodes[0].children[1].type).toBe('scan');
    });

    it('preserves remaining annotations that are not structured fields', () => {
      const raw = `
┌───────────────────────┐
│  Seq Scan on foo       │
│  EC: 10.00 (50.00%)   │
│  Elements: 50000 rows  │
└───────────────────────┘
`;
      const nodes = parseExplainOutput(raw);
      expect(nodes[0].annotations).toContain('Elements: 50000 rows');
    });

    it('handles multiple unboxable plain lines', () => {
      const raw = `physical_plan
another_line`;
      const nodes = parseExplainOutput(raw);
      expect(nodes).toHaveLength(2);
    });
  });
});
