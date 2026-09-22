import { describe, it, expect } from 'vitest';
import { ONTOLOGY_SEEDS } from '../hooks/useOntologyStore';

describe('Ontology Tutorial Seeds (lesson-0001 to lesson-0014)', () => {
  for (let i = 1; i <= 14; i++) {
    const lessonId = `lesson-${String(i).padStart(4, '0')}`;

    it(`validates ${lessonId} seed structure and SQL generation`, () => {
      const seed = ONTOLOGY_SEEDS[lessonId];
      expect(seed).toBeDefined();

      // Object Types
      expect(seed.objectTypes.length).toBeGreaterThan(0);
      const typeIdSet = new Set(seed.objectTypes.map((ot: any) => ot.id));
      expect(typeIdSet.size).toBe(seed.objectTypes.length);

      // Objects
      expect(seed.objects.length).toBeGreaterThanOrEqual(5);
      expect(seed.objects.length).toBeLessThanOrEqual(8);
      const objIdSet = new Set(seed.objects.map((o: any) => o.id));
      expect(objIdSet.size).toBe(seed.objects.length);

      for (const obj of seed.objects) {
        expect(typeIdSet.has(obj.object_type_id)).toBe(true);
        expect(obj.name.length).toBeLessThanOrEqual(12);
        expect(typeof obj.properties === 'string' ? JSON.parse(obj.properties) : obj.properties).toBeTypeOf('object');
      }

      // Link Types
      expect(seed.linkTypes.length).toBeGreaterThan(0);
      const linkTypeIdSet = new Set(seed.linkTypes.map((lt: any) => lt.id));

      // Links
      expect(seed.links.length).toBeGreaterThanOrEqual(5);
      const linkIdSet = new Set(seed.links.map((l: any) => l.id));
      expect(linkIdSet.size).toBe(seed.links.length);

      for (const link of seed.links) {
        expect(objIdSet.has(link.source_object_id)).toBe(true);
        expect(objIdSet.has(link.target_object_id)).toBe(true);
        expect(linkTypeIdSet.has(link.link_type_id)).toBe(true);
      }

      // Actions, Introspections, Insights
      if (seed.actions) {
        for (const act of seed.actions) {
          expect(objIdSet.has(act.object_id)).toBe(true);
        }
      }
      if (seed.introspections) {
        for (const intro of seed.introspections) {
          expect(objIdSet.has(intro.object_id)).toBe(true);
        }
      }
      if (seed.insights) {
        for (const ins of seed.insights) {
          expect(objIdSet.has(ins.object_id)).toBe(true);
        }
      }

      // Verify SQL statement construction doesn't throw and has valid SQL literals
      const esc = (val: any) => (val ? String(val).replace(/'/g, "''") : '');
      const otValues = seed.objectTypes.map((ot: any) =>
        `(${ot.id}, '${esc(ot.name)}', '${esc(ot.description)}')`
      ).join(', ');
      expect(otValues).not.toContain("'''''");

      const objValues = seed.objects.map((o: any) => {
        const propsStr = typeof o.properties === 'string' ? o.properties : JSON.stringify(o.properties || {});
        return `(${o.id}, ${o.object_type_id}, '${esc(o.name)}', '${esc(propsStr)}', '${esc(o.annotations)}')`;
      }).join(', ');
      expect(objValues).not.toContain('undefined');

      const linkValues = seed.links.map((l: any) =>
        `(${l.id}, ${l.link_type_id}, ${l.source_object_id}, ${l.target_object_id}, ${l.weight ?? 1.0})`
      ).join(', ');
      expect(linkValues).not.toContain('NaN');
    });
  }
});
