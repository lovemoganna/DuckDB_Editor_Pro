import { MetricPackage } from '../types';
import { MetricImpact, semanticMetricCatalog } from './semanticMetricCatalog';
import { SchemaTreeContext } from './schemaRagEngine';

export type DataAssetNodeType = 'table' | 'column' | 'metric';
export type DataAssetEdgeType =
  | 'TABLE_CONTAINS_COLUMN'
  | 'METRIC_DEPENDS_ON_COLUMN'
  | 'METRIC_DEPENDS_ON_METRIC';

export interface DataAssetNode {
  id: string;
  label: string;
  type: DataAssetNodeType;
  table?: string;
  column?: string;
  packageId?: string;
  metricId?: string;
}

export interface DataAssetEdge {
  source: string;
  target: string;
  type: DataAssetEdgeType;
}

export interface DataAssetGraph {
  nodes: DataAssetNode[];
  edges: DataAssetEdge[];
}

export interface BuildDataAssetGraphInput {
  schemaTree: SchemaTreeContext;
  metricPackages: readonly MetricPackage[];
}

export class DataAssetGraphService {
  static build(input: BuildDataAssetGraphInput): DataAssetGraph {
    const nodes: DataAssetNode[] = [];
    const edges: DataAssetEdge[] = [];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    const addNode = (node: DataAssetNode) => {
      if (nodeIds.has(node.id)) return;
      nodeIds.add(node.id);
      nodes.push(node);
    };
    const addEdge = (edge: DataAssetEdge) => {
      const id = `${edge.source}|${edge.target}|${edge.type}`;
      if (edgeIds.has(id)) return;
      edgeIds.add(id);
      edges.push(edge);
    };

    Object.entries(input.schemaTree).forEach(([table, columns]) => {
      const tableId = `table:${table}`;
      addNode({ id: tableId, label: table, type: 'table', table });
      columns.forEach(column => {
        const columnId = `column:${table}.${column.name}`;
        addNode({
          id: columnId,
          label: `${table}.${column.name}`,
          type: 'column',
          table,
          column: column.name,
        });
        addEdge({ source: tableId, target: columnId, type: 'TABLE_CONTAINS_COLUMN' });
      });
    });

    const metricsByDependencyName = new Map<string, string>();
    input.metricPackages.forEach(pkg => {
      pkg.metrics.forEach(metric => {
        const metricId = `metric:${pkg.id}.${metric.id}`;
        addNode({
          id: metricId,
          label: metric.name,
          type: 'metric',
          packageId: pkg.id,
          metricId: metric.id,
        });
        metricsByDependencyName.set(metric.id.toLowerCase(), metricId);
        metricsByDependencyName.set(metric.name.toLowerCase(), metricId);
      });
    });

    input.metricPackages.forEach(pkg => {
      pkg.metrics.forEach(metric => {
        const target = `metric:${pkg.id}.${metric.id}`;
        metric.dependencies.forEach(dependency => {
          const upstreamMetric = metricsByDependencyName.get(dependency.toLowerCase());
          if (upstreamMetric && upstreamMetric !== target) {
            addEdge({
              source: upstreamMetric,
              target,
              type: 'METRIC_DEPENDS_ON_METRIC',
            });
            return;
          }

          pkg.sourceTables.forEach(table => {
            const column = input.schemaTree[table]?.find(candidate =>
              candidate.name.toLowerCase() === dependency.toLowerCase(),
            );
            if (!column) return;
            addEdge({
              source: `column:${table}.${column.name}`,
              target,
              type: 'METRIC_DEPENDS_ON_COLUMN',
            });
          });
        });
      });
    });

    return { nodes, edges };
  }

  static analyzeColumnImpact(
    metricPackages: readonly MetricPackage[],
    table: string,
    column: string,
  ): MetricImpact[] {
    return semanticMetricCatalog.analyzeColumnImpact(metricPackages, table, column);
  }
}
