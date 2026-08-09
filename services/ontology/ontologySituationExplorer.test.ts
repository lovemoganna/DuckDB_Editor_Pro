import { describe, expect, it } from 'vitest';
import ecommerceSeed from '../../data/ontology/seed-ecommerce.json';
import healthSeed from '../../data/ontology/seed-health-tracker.json';
import { createOntologySnapshot } from './ontologyReasoningModule';
import {
  createOntologySituationModel,
  exploreOntologySituations,
} from './ontologySituationExplorer';

const emptyCatalog = {
  propertyDefinitions: [],
  rules: [],
  actionDefinitions: [],
};

describe('Ontology native situation explorer', () => {
  it.each([
    ['e-commerce ontology', ecommerceSeed],
    ['health-tracking ontology', healthSeed],
  ])('discovers selectable features from the real %s without domain branches', (_name, seed) => {
    const snapshot = createOntologySnapshot(seed as never, emptyCatalog);
    const objectTypeId = snapshot.objectTypes[0].id;
    const model = createOntologySituationModel(snapshot, { objectTypeId });

    expect(model.features.length).toBeGreaterThan(0);
    expect(model.rows).toHaveLength(
      snapshot.objects.filter(object => object.objectTypeId === objectTypeId).length,
    );
    expect(model.features.some(feature => feature.source.kind === 'ontology_property')).toBe(true);
    expect(model.features.every(feature => feature.objectTypeId === objectTypeId)).toBe(true);
    expect(model.provenance.snapshotId).toBe(snapshot.snapshotId);
  });

  it('actively enumerates relation and property combinations from one immutable snapshot', () => {
    const snapshot = createOntologySnapshot(ecommerceSeed as never, emptyCatalog);
    const model = createOntologySituationModel(snapshot, { objectTypeId: 1 });
    const relation = model.features.find(feature => feature.source.kind === 'ontology_relation');
    const property = model.features.find(feature => feature.source.kind === 'ontology_property');

    expect(relation).toBeDefined();
    expect(property).toBeDefined();
    const report = exploreOntologySituations(snapshot, {
      objectTypeId: 1,
      selectedFeatureIds: [property!.id, relation!.id],
      rules: [],
      topK: 20,
      beamWidth: 20,
    });

    expect(report.possibleCandidates.length).toBeGreaterThan(0);
    expect(report.totalCandidateCount).toBeGreaterThanOrEqual(report.candidates.length);
    expect(report.featureVersionIds).toEqual([property!.id, relation!.id]);
    expect(report.sourceSnapshot).toMatchObject({
      snapshotId: snapshot.snapshotId,
      ontologyId: snapshot.ontologyId,
      objectTypeId: 1,
      objectIds: snapshot.objects
        .filter(object => object.objectTypeId === 1)
        .map(object => object.id),
    });
    expect(snapshot.objects[0].properties).toEqual(
      createOntologySnapshot(ecommerceSeed as never, emptyCatalog).objects[0].properties,
    );
  });
});
