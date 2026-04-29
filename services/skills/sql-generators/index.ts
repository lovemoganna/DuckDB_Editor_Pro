/**
 * SQL Generators - Barrel Export
 *
 * Unified access to all template-based SQL generators.
 */

export { sqlQueryGenerators } from './query-generators';
export { sqlDdlGenerators } from './ddl-generators';
export { analysisGenerators } from './analysis-generators';
export { transformationGenerators, optimizationGenerators, utilityGenerators } from './misc-generators';
export { DOMAIN_SCHEMAS, TABLE_TEMPLATES, getSampleData } from './domain-schemas';
export type { ColumnDef, TableDef, DomainSchema } from './domain-schemas';
