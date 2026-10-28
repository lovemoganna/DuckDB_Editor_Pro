/**
 * Vitest stub for `@duckdb/duckdb-wasm/.../duckdb-browser-eh.worker.js?worker`.
 * The real IIFE worker crashes under jsdom (js-sha256 expects browser globals).
 */
export default class MockDuckDBWorkerCtor {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (globalThis as any).Worker('mock-duckdb-worker');
  }
}
