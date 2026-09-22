import { MetricDefinition, MetricPackage } from '../types';
import { DataLineageGraph, LineageService } from './LineageService';

const VERSIONED_FIELDS: Array<keyof MetricDefinition> = [
  'name',
  'definition',
  'formula',
  'dependencies',
  'scenario',
  'characteristics',
  'value',
  'unit',
  'category',
];

export interface MetricImpact {
  packageId: string;
  metricId: string;
  metricName: string;
  depth: number;
  reason: string;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function quoteIdentifier(identifier: string): string {
  if (!identifier.trim()) throw new Error('Metric lineage identifier is empty');
  return identifier
    .split('.')
    .map(part => `"${part.replace(/"/g, '""')}"`)
    .join('.');
}

export class SemanticMetricCatalog {
  constructor(private readonly now: () => number = Date.now) {}

  versionMetric(previous: MetricDefinition, next: MetricDefinition): MetricDefinition {
    const changedFields = VERSIONED_FIELDS.filter(field =>
      !sameValue(previous[field], next[field]),
    );
    if (changedFields.length === 0) {
      return {
        ...next,
        version: previous.version ?? 1,
        history: [...(previous.history ?? [])],
      };
    }

    const timestamp = this.now();
    const version = (previous.version ?? 1) + 1;
    const previousValues = Object.fromEntries(
      changedFields.map(field => [field, previous[field]]),
    );

    return {
      ...next,
      version,
      updatedAt: timestamp,
      history: [
        ...(previous.history ?? []),
        {
          version,
          changedAt: timestamp,
          changedFields: changedFields as string[],
          previousValues,
        },
      ].slice(-20),
    };
  }

  versionMetrics(
    previousMetrics: readonly MetricDefinition[],
    nextMetrics: readonly MetricDefinition[],
  ): MetricDefinition[] {
    const previousById = new Map(previousMetrics.map(metric => [metric.id, metric]));
    return nextMetrics.map(metric => {
      const previous = previousById.get(metric.id);
      if (!previous) {
        return {
          ...metric,
          version: metric.version ?? 1,
          history: [...(metric.history ?? [])],
        };
      }
      return this.versionMetric(previous, metric);
    });
  }

  analyzeColumnImpact(
    packages: readonly MetricPackage[],
    table: string,
    column: string,
  ): MetricImpact[] {
    const allMetrics = packages.flatMap(pkg =>
      pkg.metrics.map(metric => ({ pkg, metric })),
    );
    const impacts: MetricImpact[] = [];
    const impacted = new Set<string>();
    let frontier = allMetrics.filter(({ pkg, metric }) =>
      pkg.sourceTables.some(source => source.toLowerCase() === table.toLowerCase())
      && metric.dependencies.some(dependency => dependency.toLowerCase() === column.toLowerCase()),
    );
    let depth = 1;

    while (frontier.length > 0) {
      const nextFrontier: typeof frontier = [];
      for (const entry of frontier) {
        const key = `${entry.pkg.id}:${entry.metric.id}`;
        if (impacted.has(key)) continue;
        impacted.add(key);
        impacts.push({
          packageId: entry.pkg.id,
          metricId: entry.metric.id,
          metricName: entry.metric.name,
          depth,
          reason: depth === 1
            ? `${table}.${column}`
            : 'dependent metric',
        });

        for (const candidate of allMetrics) {
          const candidateKey = `${candidate.pkg.id}:${candidate.metric.id}`;
          if (impacted.has(candidateKey)) continue;
          const dependencies = candidate.metric.dependencies.map(value => value.toLowerCase());
          if (
            dependencies.includes(entry.metric.id.toLowerCase())
            || dependencies.includes(entry.metric.name.toLowerCase())
          ) {
            nextFrontier.push(candidate);
          }
        }
      }
      frontier = nextFrontier;
      depth += 1;
    }

    return impacts;
  }

  buildMetricLineage(metric: MetricDefinition, sourceTable: string): DataLineageGraph {
    const sql = /^\s*(?:select|with)\b/i.test(metric.formula)
      ? metric.formula
      : `SELECT ${metric.formula} AS ${quoteIdentifier(metric.name)} FROM ${quoteIdentifier(sourceTable)}`;
    return LineageService.parseSqlLineage(sql);
  }
}

export const semanticMetricCatalog = new SemanticMetricCatalog();
