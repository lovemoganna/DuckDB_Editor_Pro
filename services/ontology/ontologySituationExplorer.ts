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
      && property.status !== 'conflicted'
      && property.status !== 'archived',
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
