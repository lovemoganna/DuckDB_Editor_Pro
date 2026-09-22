import type {
  DraftChange,
  FoundPath,
  OntologyEdge,
  OntologyNode,
  PathStep,
} from '../../types/ontologyWorkspace';

export interface PathSearchOptions {
  maxDepth?: number;
  includeInferred?: boolean;
  assertedOnly?: boolean;
  relationTypes?: string[];
  mode?: 'shortest' | 'all';
  maxPaths?: number;
}

const confidenceRank = (confidence: OntologyEdge['confidence']): number => {
  if (typeof confidence === 'number') return confidence;
  if (confidence === 'Low') return 0.4;
  if (confidence === 'Medium') return 0.7;
  return 1;
};

const confidenceLabel = (confidence: number): 'High' | 'Medium' | 'Low' =>
  confidence >= 0.85 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';

const edgeToStep = (edge: OntologyEdge): PathStep => ({
  from: edge.source,
  relation: edge.relationName,
  to: edge.target,
  type: edge.type,
  source: edge.sourceRevision || (edge.mapping ? 'duckdb_catalog.mapping' : 'ontology_workspace'),
  confidence: confidenceLabel(confidenceRank(edge.confidence)),
  asserted: edge.asserted,
  inferred: edge.inferred,
  mapping: edge.mapping,
  explain: edge.inferred
    ? {
        rule: edge.inverseOf ? `inverseOf(${edge.inverseOf})` : 'Ontology inference rule',
        premises: [`${edge.source} ${edge.relationName} ${edge.target}`],
        conclusion: `${edge.source} ${edge.relationName} ${edge.target}`,
      }
    : undefined,
});

export const findOntologyPaths = (
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  source: string,
  target: string,
  options: PathSearchOptions = {},
): FoundPath[] => {
  if (!source || !target || source === target) return [];
  const knownNodes = new Set(nodes.flatMap((node) => [node.id, node.name]));
  if (!knownNodes.has(source) || !knownNodes.has(target)) return [];

  const maxDepth = Math.max(1, Math.min(12, options.maxDepth ?? 4));
  const maxPaths = Math.max(1, Math.min(50, options.maxPaths ?? 20));
  const allowedTypes = options.relationTypes?.length ? new Set(options.relationTypes) : null;
  const usableEdges = edges.filter((edge) => {
    if (options.assertedOnly && !edge.asserted) return false;
    if (options.includeInferred === false && edge.inferred) return false;
    if (allowedTypes && !allowedTypes.has(edge.type) && !allowedTypes.has(edge.relationName)) return false;
    return true;
  });

  const outgoing = new Map<string, OntologyEdge[]>();
  usableEdges.forEach((edge) => {
    const list = outgoing.get(edge.source) || [];
    list.push(edge);
    outgoing.set(edge.source, list);
  });
  outgoing.forEach((list) => list.sort((a, b) => a.relationName.localeCompare(b.relationName)));

  const queue: Array<{ at: string; path: OntologyEdge[]; visited: Set<string> }> = [
    { at: source, path: [], visited: new Set([source]) },
  ];
  const found: OntologyEdge[][] = [];
  let shortestDepth: number | null = null;

  while (queue.length > 0 && found.length < maxPaths) {
    const current = queue.shift()!;
    if (current.path.length >= maxDepth) continue;
    for (const edge of outgoing.get(current.at) || []) {
      if (current.visited.has(edge.target)) continue;
      const nextPath = [...current.path, edge];
      if (edge.target === target) {
        if (shortestDepth === null) shortestDepth = nextPath.length;
        if (options.mode !== 'shortest' || nextPath.length === shortestDepth) found.push(nextPath);
        continue;
      }
      if (options.mode === 'shortest' && shortestDepth !== null && nextPath.length >= shortestDepth) continue;
      queue.push({
        at: edge.target,
        path: nextPath,
        visited: new Set([...current.visited, edge.target]),
      });
    }
  }

  return found
    .sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      const aScore = Math.min(...a.map((edge) => confidenceRank(edge.confidence)));
      const bScore = Math.min(...b.map((edge) => confidenceRank(edge.confidence)));
      return bScore - aScore;
    })
    .map((path, index) => {
      const score = Math.min(...path.map((edge) => confidenceRank(edge.confidence)));
      return {
        id: `path-${index + 1}-${path.map((edge) => edge.id).join('-')}`,
        title: `Path ${index + 1}${index === 0 ? ' (Shortest)' : ` (${path.length} hops)`}`,
        length: path.length,
        isShortest: index === 0,
        confidence: confidenceLabel(score),
        hasInferred: path.some((edge) => edge.inferred),
        steps: path.map(edgeToStep),
      };
    });
};

export interface MatrixCell {
  relations: OntologyEdge[];
  kind: 'none' | 'asserted' | 'inferred' | 'mixed';
}

export interface SameLevelMatrix {
  entities: OntologyNode[];
  cells: Record<string, Record<string, MatrixCell>>;
}

export const buildSameLevelMatrix = (
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  layer: OntologyNode['abstractionLevel'],
  options: { includeInferred?: boolean; domain?: string; relationTypes?: string[] } = {},
): SameLevelMatrix => {
  const entities = nodes
    .filter((node) => node.type === 'class')
    .filter((node) => node.abstractionLevel === layer)
    .filter((node) => !options.domain || options.domain === 'All' || node.domain === options.domain)
    .sort((a, b) => (a.gridColumn ?? 0) - (b.gridColumn ?? 0) || a.name.localeCompare(b.name));
  const names = new Set(entities.map((node) => node.name));
  const allowedTypes = options.relationTypes?.length ? new Set(options.relationTypes) : null;
  const visibleEdges = edges.filter((edge) =>
    names.has(edge.source) &&
    names.has(edge.target) &&
    (options.includeInferred !== false || !edge.inferred) &&
    (!allowedTypes || allowedTypes.has(edge.type) || allowedTypes.has(edge.relationName)),
  );

  const cells: Record<string, Record<string, MatrixCell>> = {};
  entities.forEach((row) => {
    cells[row.name] = {};
    entities.forEach((column) => {
      const relations = visibleEdges.filter((edge) => edge.source === row.name && edge.target === column.name);
      const hasAsserted = relations.some((edge) => edge.asserted && !edge.inferred);
      const hasInferred = relations.some((edge) => edge.inferred);
      cells[row.name][column.name] = {
        relations,
        kind: relations.length === 0 ? 'none' : hasAsserted && hasInferred ? 'mixed' : hasInferred ? 'inferred' : 'asserted',
      };
    });
  });
  return { entities, cells };
};

const propertyNames = (node: OntologyNode, type: 'object' | 'data'): string[] =>
  type === 'object'
    ? (node.objectProperties || []).map((property) => property.name)
    : (node.dataProperties || []).map((property) => property.name);

const splitFeatures = (a: string[], b: string[]) => ({
  shared: a.filter((item) => b.includes(item)).sort(),
  onlyA: a.filter((item) => !b.includes(item)).sort(),
  onlyB: b.filter((item) => !a.includes(item)).sort(),
});

export const compareOntologyEntities = (
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  entityA: string,
  entityB: string,
) => {
  const nodeA = nodes.find((node) => node.id === entityA || node.name === entityA);
  const nodeB = nodes.find((node) => node.id === entityB || node.name === entityB);
  if (!nodeA || !nodeB) return null;
  const object = splitFeatures(propertyNames(nodeA, 'object'), propertyNames(nodeB, 'object'));
  const data = splitFeatures(propertyNames(nodeA, 'data'), propertyNames(nodeB, 'data'));
  const relationsBetween = edges.filter((edge) =>
    (edge.source === nodeA.name && edge.target === nodeB.name) ||
    (edge.source === nodeB.name && edge.target === nodeA.name),
  );
  return {
    nodeA,
    nodeB,
    metrics: {
      superClass: { a: nodeA.parentClassName || nodeA.parentClassId || '—', b: nodeB.parentClassName || nodeB.parentClassId || '—' },
      subClasses: { a: nodeA.subClassIds?.length || 0, b: nodeB.subClassIds?.length || 0 },
      instances: { a: nodeA.instanceCount || 0, b: nodeB.instanceCount || 0 },
      objectProperties: { a: propertyNames(nodeA, 'object').length, b: propertyNames(nodeB, 'object').length },
      dataProperties: { a: propertyNames(nodeA, 'data').length, b: propertyNames(nodeB, 'data').length },
      mappings: { a: nodeA.mappedTable ? 1 : 0, b: nodeB.mappedTable ? 1 : 0 },
    },
    shared: { objectProperties: object.shared, dataProperties: data.shared },
    onlyA: { objectProperties: object.onlyA, dataProperties: data.onlyA },
    onlyB: { objectProperties: object.onlyB, dataProperties: data.onlyB },
    relationsBetween,
  };
};

export const previewPropertyImpact = (
  nodes: OntologyNode[],
  edges: OntologyEdge[],
  propertyName: string,
  newRange: string,
): DraftChange['impact'] => {
  const matchingEdges = edges.filter((edge) => edge.relationName === propertyName);
  const rangeNames = newRange.split(/\s+OR\s+|[,|]/i).map((value) => value.trim()).filter(Boolean);
  const affectedNames = new Set<string>(rangeNames);
  matchingEdges.forEach((edge) => {
    affectedNames.add(edge.source);
    affectedNames.add(edge.target);
  });
  edges.forEach((edge) => {
    if (affectedNames.has(edge.source) || affectedNames.has(edge.target)) {
      affectedNames.add(edge.source);
      affectedNames.add(edge.target);
    }
  });
  const affectedNodes = nodes.filter((node) => affectedNames.has(node.name) || affectedNames.has(node.id));
  const affectedEdges = edges.filter((edge) => affectedNames.has(edge.source) || affectedNames.has(edge.target));
  return {
    classesCount: affectedNodes.filter((node) => node.type === 'class').length,
    objectPropertiesCount: Math.max(1, matchingEdges.length),
    dataPropertiesCount: affectedNodes.reduce((count, node) => count + (node.dataProperties?.length || 0), 0),
    axiomsCount: affectedEdges.length,
    mappingsCount: affectedNodes.filter((node) => Boolean(node.mappedTable)).length,
    validationCount: matchingEdges.length + affectedNodes.filter((node) => Boolean(node.mappedTable)).length,
    inferredAxiomsCount: affectedEdges.filter((edge) => edge.inferred).length,
    examples: affectedNodes.map((node) => node.name).slice(0, 8),
  };
};
