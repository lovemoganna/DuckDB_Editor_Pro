/**
 * Generator Registry — Declarative skill-to-generator mapping
 *
 * Replaces the hardcoded if-else chain in skillExecutor.ts with a
 * Map<generatorId, GeneratorFn> for O(1) lookups.
 *
 * Skill definitions declare a `generatorId` field. The registry resolves
 * that ID to the actual generator function at runtime.
 */

import { SkillExecutionContext } from '../../../types';

// All generators must conform to this signature
export type GeneratorFn = (inputs: Record<string, any>, context: SkillExecutionContext) => string;

// Registry: generatorId -> generator function
const registry = new Map<string, GeneratorFn>();

// ============================================================
// Query Generators
// ============================================================

async function loadQueryGenerators(): Promise<typeof import('../sql-generators/query-generators').sqlQueryGenerators> {
  const mod = await import('../sql-generators/query-generators');
  return mod.sqlQueryGenerators;
}

// ============================================================
// DDL Generators
// ============================================================

async function loadDdlGenerators(): Promise<typeof import('../sql-generators/ddl-generators').sqlDdlGenerators> {
  const mod = await import('../sql-generators/ddl-generators');
  return mod.sqlDdlGenerators;
}

// ============================================================
// Analysis Generators
// ============================================================

async function loadAnalysisGenerators(): Promise<typeof import('../sql-generators/analysis-generators').analysisGenerators> {
  const mod = await import('../sql-generators/analysis-generators');
  return mod.analysisGenerators;
}

// ============================================================
// Misc Generators (Transformation, Optimization, Utility)
// ============================================================

async function loadMiscGenerators(): Promise<{
  transformationGenerators: typeof import('../sql-generators/misc-generators').transformationGenerators;
  optimizationGenerators: typeof import('../sql-generators/misc-generators').optimizationGenerators;
  utilityGenerators: typeof import('../sql-generators/misc-generators').utilityGenerators;
}> {
  const mod = await import('../sql-generators/misc-generators');
  return {
    transformationGenerators: mod.transformationGenerators,
    optimizationGenerators: mod.optimizationGenerators,
    utilityGenerators: mod.utilityGenerators,
  };
}

// ============================================================
// Register all generators
// ============================================================

// Cache for loaded generator modules
let _cache: {
  query?: Awaited<ReturnType<typeof loadQueryGenerators>>;
  ddl?: Awaited<ReturnType<typeof loadDdlGenerators>>;
  analysis?: Awaited<ReturnType<typeof loadAnalysisGenerators>>;
  misc?: Awaited<ReturnType<typeof loadMiscGenerators>>;
} | null = null;

async function ensureCache() {
  if (!_cache) {
    const [query, ddl, analysis, misc] = await Promise.all([
      loadQueryGenerators(),
      loadDdlGenerators(),
      loadAnalysisGenerators(),
      loadMiscGenerators(),
    ]);
    _cache = { query, ddl, analysis, misc };
  }
  return _cache;
}

/**
 * Register all built-in generators into the registry.
 * Called once during module initialization.
 */
export async function registerAllGenerators(): Promise<void> {
  const { query, ddl, analysis, misc } = await ensureCache();

  // Query generators
  registry.set('sql-select', query.select);
  registry.set('sql-join', query.join);
  registry.set('sql-aggregation', query.aggregation);
  registry.set('sql-window', query.window);
  registry.set('sql-cte', query.cte as GeneratorFn);
  registry.set('sql-insert', query.insert);
  registry.set('sql-update', query.update);
  registry.set('sql-delete', query.delete);

  // DDL generators
  registry.set('sql-create-table', ddl.createTable as GeneratorFn);
  registry.set('sql-create-table-nl', ddl.createTableNL as GeneratorFn);
  registry.set('sql-create-table-template', ddl.createTableTemplate as GeneratorFn);
  registry.set('sql-create-table-import', ddl.createTableImport as GeneratorFn);
  registry.set('sql-alter-table', ddl.alterTable);
  registry.set('sql-drop-table', ddl.dropTable as GeneratorFn);
  registry.set('sql-view', ddl.createView as GeneratorFn);
  registry.set('sql-index', ddl.createIndex as GeneratorFn);
  registry.set('sql-table-design', ddl.tableDesign);

  // Analysis generators
  registry.set('analysis-time-series', analysis.timeSeries);
  registry.set('analysis-comparison', analysis.comparison);
  registry.set('analysis-funnel', analysis.funnel as GeneratorFn);
  registry.set('analysis-retention', analysis.retention);

  // Transformation generators
  registry.set('transform-pivot', misc.transformationGenerators.pivot);
  registry.set('transform-unpivot', misc.transformationGenerators.unpivot as GeneratorFn);
  registry.set('transform-type-conversion', misc.transformationGenerators.typeConversion);
  registry.set('transform-string-manipulation', misc.transformationGenerators.stringManipulation);
  registry.set('transform-date-handling', misc.transformationGenerators.dateHandling);

  // Optimization generators
  registry.set('optimization-explain', misc.optimizationGenerators.explain as GeneratorFn);
  registry.set('optimization-index', misc.optimizationGenerators.index);
  registry.set('optimization-query-rewrite', misc.optimizationGenerators.queryRewrite as GeneratorFn);

  // Utility generators
  registry.set('utility-test-data', misc.utilityGenerators.testData);
  registry.set('utility-summarize', misc.utilityGenerators.summarize as GeneratorFn);
  registry.set('utility-sample-query', misc.utilityGenerators.sampleQuery);
}

/**
 * Look up a generator by its ID.
 * Returns null if not found.
 */
export function getGenerator(generatorId: string): GeneratorFn | null {
  return registry.get(generatorId) ?? null;
}

/**
 * Check if a generator ID is registered.
 */
export function hasGenerator(generatorId: string): boolean {
  return registry.has(generatorId);
}

/**
 * Register a custom generator (for user-defined skills).
 */
export function registerGenerator(generatorId: string, fn: GeneratorFn): void {
  registry.set(generatorId, fn);
}

/**
 * Unregister a generator (for removing user-defined skills).
 */
export function unregisterGenerator(generatorId: string): boolean {
  return registry.delete(generatorId);
}

/**
 * Get all registered generator IDs (for debugging/introspection).
 */
export function getRegisteredGeneratorIds(): string[] {
  return Array.from(registry.keys());
}

// ============================================================
// Initialize on module load
// ============================================================

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensure all generators are registered before first use.
 * Safe to call multiple times.
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = registerAllGenerators().then(() => { initialized = true; });
  }
  return initPromise;
}

// Auto-initialize in non-test environments
if (typeof window !== 'undefined' || typeof process !== 'undefined') {
  // Defer to first use to avoid blocking SSR/worker entry
}
