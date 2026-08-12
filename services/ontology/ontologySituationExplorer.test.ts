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

const createActiveSnapshot = (seed: unknown) => {
  const discovered = createOntologySnapshot(seed as never, emptyCatalog);
  return {
    ...discovered,
    catalog: {
      ...discovered.catalog,
      propertyDefinitions: discovered.catalog.propertyDefinitions.map(property => ({
        ...property,
        status: property.status === 'conflicted' ? 'conflicted' as const : 'active' as const,
      })),
    },
  };
};

describe('Ontology native situation explorer', () => {
  it.each([
    ['e-commerce ontology', ecommerceSeed],
    ['health-tracking ontology', healthSeed],
  ])('discovers selectable features from the real %s without domain branches', (_name, seed) => {
    const snapshot = createActiveSnapshot(seed);
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

  it('reports only current facts when the ontology has no executable rules', () => {
    const snapshot = createActiveSnapshot(ecommerceSeed);
    const model = createOntologySituationModel(snapshot, { objectTypeId: 1 });
    const properties = model.features
      .filter(feature => feature.source.kind === 'ontology_property')
      .slice(0, 2);

    expect(properties).toHaveLength(2);
    const report = exploreOntologySituations(snapshot, {
      objectTypeId: 1,
      selectedFeatureIds: properties.map(feature => feature.id),
      rules: [],
      topK: 20,
      beamWidth: 20,
    });

    expect(report.establishedCandidates.length).toBeGreaterThan(0);
    expect(report.establishedCandidates[0].sourceObjectIds.length).toBeGreaterThan(0);
    expect(report.establishedCandidates[0].sourceObjectIds.every(objectId =>
      snapshot.objects.some(object => object.id === objectId),
    )).toBe(true);
    expect(report.possibleCandidates).toHaveLength(0);
    expect(report.excludedCandidates).toHaveLength(0);
    expect(report.totalCandidateCount).toBe(report.establishedCandidates.length);
    expect(report.featureVersionIds).toEqual(properties.map(feature => feature.id));
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

  it('does not admit externally supplied sample features into an ontology situation model', () => {
    const snapshot = createOntologySnapshot(ecommerceSeed as never, emptyCatalog);
    const fakeFeature = {
      id: 'feature.mock.transaction.amount.v1',
      logicalId: 'feature.mock.transaction.amount',
      version: 1,
      name: 'Mock amount',
      description: 'Not present in the ontology',
      valueType: 'number',
      objectTypeId: 1,
      source: { kind: 'column', table: 'mock', column: 'amount' },
      nullSemantics: 'UNKNOWN',
      status: 'active',
    };

    const model = createOntologySituationModel(snapshot, {
      objectTypeId: 1,
      extraFeatures: [fakeFeature],
    } as never);

    expect(model.features.some(feature => feature.id === fakeFeature.id)).toBe(false);
    expect(model.rows.every(row => !(fakeFeature.id in row))).toBe(true);
  });

  it('exposes only activated stable property definitions to rule conditions', () => {
    const snapshot = createOntologySnapshot(ecommerceSeed as never, {
      ...emptyCatalog,
      propertyDefinitions: [{
        id: 'property.pending.v1', logicalId: 'property.pending', version: 1,
        objectTypeId: 1, key: 'pending_key', name: 'Pending key', valueType: 'string',
        nullable: true, status: 'candidate',
      }],
    } as never);

    const model = createOntologySituationModel(snapshot, { objectTypeId: 1 });
    expect(model.features.some(feature => feature.id === 'property.pending.v1')).toBe(false);
  });
});
