import type { OntologySnapshot } from './ontologyReasoningModule';
import {
  runInference,
  type FeatureDefinition,
  type FeatureValueType,
  type InferenceReport,
  type InferenceRequest,
  type RuleDefinition,
} from './ontologyInferenceEngine';

export interface OntologySituationModel {
  features: FeatureDefinition[];
  rows: Array<Record<string, unknown>>;
  provenance: {
    snapshotId: string;
    ontologyId: string;
    objectTypeId: number;
    objectIds: number[];
  };
}

export interface OntologySituationOptions {
  objectTypeId: number;
  selectedFeatureIds?: string[];
  rules?: RuleDefinition[];
  selectedRuleIds?: string[];
  topK?: number;
  beamWidth?: number;
  ranking?: InferenceRequest['ranking'];
}

const propertyValueType = (valueType: string): FeatureValueType => {
  if (valueType === 'array') return 'set';
  if (valueType === 'boolean' || valueType === 'number') return valueType;
  return 'string';
};

const relationFeatureId = (
  objectTypeId: number,
  linkTypeId: number,
  direction: 'outgoing' | 'incoming',
): string => `feature.ontology.relation.${objectTypeId}.${linkTypeId}.${direction}.v1`;

export function createOntologySituationModel(
  snapshot: OntologySnapshot,
  options: Pick<OntologySituationOptions, 'objectTypeId'>,
): OntologySituationModel {
  const propertyFeatures: FeatureDefinition[] = snapshot.catalog.propertyDefinitions
    .filter(property =>
      property.objectTypeId === options.objectTypeId
      && property.status === 'active',
    )
    .map(property => ({
      id: property.id,
      logicalId: property.logicalId,
      version: property.version,
      name: property.name || property.key,
      description: `Ontology 属性 ${property.key}`,
      valueType: propertyValueType(property.valueType),
      objectTypeId: property.objectTypeId,
      source: {
        kind: 'ontology_property',
        table: 'life_object',
        jsonColumn: 'properties',
        propertyKey: property.key,
      },
      nullSemantics: property.nullable
        ? `属性 ${property.key} 未记录时为 UNKNOWN`
        : `缺少属性 ${property.key} 时为 UNKNOWN，不推断为 FALSE`,
      status: 'active',
      ...(property.valueType === 'boolean' ? { domain: [true, false] } : {}),
    }));
  const relationFeatures: FeatureDefinition[] = snapshot.linkTypes.flatMap(linkType =>
    (['outgoing', 'incoming'] as const).map(direction => ({
      id: relationFeatureId(options.objectTypeId, linkType.id, direction),
      logicalId: relationFeatureId(options.objectTypeId, linkType.id, direction).replace(/\.v1$/, ''),
      version: 1,
      name: `${direction === 'outgoing' ? '发出' : '接收'}关系：${linkType.name}`,
      description: `${direction === 'outgoing' ? '当前对象指向其他对象' : '其他对象指向当前对象'}的有向关系`,
      valueType: 'boolean' as const,
      objectTypeId: options.objectTypeId,
      source: {
        kind: 'ontology_relation' as const,
        table: 'life_object',
        objectIdColumn: 'id',
        linkTable: 'life_link',
        linkTypeId: linkType.id,
        direction,
      },
      nullSemantics: '未记录关系时为 UNKNOWN；只有显式不存在断言才是 FALSE',
      status: 'active' as const,
      domain: [true, false],
    })),
  );
  const features = [...propertyFeatures, ...relationFeatures];
  const objects = snapshot.objects.filter(object => object.objectTypeId === options.objectTypeId);
  const rows = objects.map(object => {
    const row: Record<string, unknown> = { __objectId: object.id };
    for (const feature of propertyFeatures) {
      const source = feature.source;
      if (source.kind === 'ontology_property') {
        row[feature.id] = Object.prototype.hasOwnProperty.call(object.properties, source.propertyKey)
          ? object.properties[source.propertyKey]
          : undefined;
      }
    }
    for (const feature of relationFeatures) {
      const source = feature.source;
      if (source.kind !== 'ontology_relation') continue;
      const exists = snapshot.links.some(link =>
        link.linkTypeId === source.linkTypeId
        && (source.direction === 'outgoing'
          ? link.sourceObjectId === object.id
          : link.targetObjectId === object.id),
      );
      row[feature.id] = exists ? true : undefined;
    }
    return row;
  });
  return {
    features,
    rows,
    provenance: {
      snapshotId: snapshot.snapshotId,
      ontologyId: snapshot.ontologyId,
      objectTypeId: options.objectTypeId,
      objectIds: objects.map(object => object.id),
    },
  };
}

export function exploreOntologySituations(
  snapshot: OntologySnapshot,
  options: OntologySituationOptions,
): InferenceReport {
  const model = createOntologySituationModel(snapshot, options);
  const selectedFeatureIds = options.selectedFeatureIds
    ?? model.features.map(feature => feature.id);
  const rules = options.rules ?? [];
  const report = runInference({
    features: model.features,
    rules,
    outcomes: [],
    selectedFeatureIds,
    selectedRuleIds: options.selectedRuleIds
      ?? rules.filter(rule => rule.status === 'active').map(rule => rule.id),
    rows: model.rows,
    topK: options.topK,
    beamWidth: options.beamWidth,
    executedSql: `ONTOLOGY SNAPSHOT ${snapshot.snapshotId}`,
    params: [],
    ranking: options.ranking,
  });
  return { ...report, sourceSnapshot: model.provenance };
}

export interface FeatureCombinationState {
  featureId: string;
  featureName: string;
  value: unknown;
}

export interface FeatureCombination {
  id: string;
  states: FeatureCombinationState[];
  matchingObjectIds: number[];
  matchCount: number;
  coverageRate: number;
}

export function crossFeatureCombinations(
  model: OntologySituationModel,
  selectedFeatureIds: string[],
  options?: { maxCombinations?: number; minCoverage?: number },
): FeatureCombination[] {
  const maxCombinations = options?.maxCombinations ?? 500;
  const minCoverage = options?.minCoverage ?? 0;
  const selectedFeatures = model.features.filter(f => selectedFeatureIds.includes(f.id));
  if (selectedFeatures.length === 0) return [];

  // Extract unique values per feature from actual data
  const featureValues = new Map<string, { feature: typeof selectedFeatures[0]; values: unknown[] }>();
  for (const feature of selectedFeatures) {
    const uniqueValues = new Set<string>();
    const values: unknown[] = [];
    for (const row of model.rows) {
      const val = row[feature.id];
      if (val === undefined || val === null) continue;
      const key = JSON.stringify(val);
      if (!uniqueValues.has(key)) {
        uniqueValues.add(key);
        values.push(val);
      }
    }
    if (values.length > 0) {
      featureValues.set(feature.id, { feature, values });
    }
  }

  // Generate cartesian product with pruning
  const entries = [...featureValues.entries()];
  if (entries.length === 0) return [];

  const combinations: FeatureCombination[] = [];
  const generate = (index: number, current: FeatureCombinationState[]) => {
    if (combinations.length >= maxCombinations) return;
    if (index === entries.length) {
      // Find matching objects
      const matchingObjectIds = model.rows
        .filter(row => current.every(state => {
          const val = row[state.featureId];
          return val !== undefined && val !== null && JSON.stringify(val) === JSON.stringify(state.value);
        }))
        .map(row => row.__objectId as number)
        .filter((id): id is number => id !== undefined);
      const coverageRate = model.rows.length > 0 ? matchingObjectIds.length / model.rows.length : 0;
      if (coverageRate >= minCoverage) {
        combinations.push({
          id: `combo-${combinations.length + 1}`,
          states: [...current],
          matchingObjectIds,
          matchCount: matchingObjectIds.length,
          coverageRate,
        });
      }
      return;
    }
    const [featureId, { feature, values }] = entries[index];
    for (const value of values) {
      generate(index + 1, [...current, {
        featureId,
        featureName: feature.name,
        value,
      }]);
    }
  };
  generate(0, []);

  // Sort by match count descending (most common combinations first)
  combinations.sort((a, b) => b.matchCount - a.matchCount);
  return combinations;
}

export interface RankedScenario {
  candidateId: string;
  rank: number;
  score: number;
  isTopCandidate: boolean;
  medal?: 'gold' | 'silver' | 'bronze';
  summaryLabel: string;
}

export function rankScenarios(
  report: InferenceReport,
  options?: { topN?: number },
): RankedScenario[] {
  const topN = options?.topN ?? 3;
  const medals: Array<'gold' | 'silver' | 'bronze'> = ['gold', 'silver', 'bronze'];

  return report.rankedCandidates.map((candidate, index) => {
    const rank = index + 1;
    const statesSummary = candidate.states
      .map(s => `${s.featureName}=${typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}`)
      .join(' + ');
    return {
      candidateId: candidate.id,
      rank,
      score: candidate.ranking.score,
      isTopCandidate: rank <= topN,
      medal: rank <= medals.length ? medals[rank - 1] : undefined,
      summaryLabel: `#${rank} ${statesSummary} (${candidate.status === 'ESTABLISHED' ? '已成立' : candidate.status === 'POSSIBLE' ? '可能' : '已排除'})`,
    };
  });
}
