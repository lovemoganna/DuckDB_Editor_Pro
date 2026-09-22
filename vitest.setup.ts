/**
 * vitest.setup.ts — Global test environment setup
 *
 * Provides browser-like globals and mocks needed for jsdom testing:
 * 1. Worker, WebSocket stubs (jsdom does not implement these)
 * 2. @duckdb/duckdb-wasm mock — allows DuckDBService to instantiate without real WASM
 *
 * Note: duckDBService is mocked per-test-file in useOntologyStore.crud.test.ts.
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ─── Mock @duckdb/duckdb-wasm ────────────────────────────────────────────────

// ─── Mock @duckdb/duckdb-wasm ────────────────────────────────────────────────

vi.mock('@duckdb/duckdb-wasm', () => ({
  AsyncDuckDB: class MockDB {
    async instantiate() {}
    async open() {}
    async connect() {
      const mockResult = (data: any[] = []) => {
        const arr = data.map(d => ({
          ...d,
          toJSON: () => d,
        }));
        (arr as any).toArray = () => arr;
        (arr as any).schema = { fields: Object.keys(data[0] || {}).map(name => ({ name, type: { toString: () => 'VARCHAR' } })) };
        return arr;
      };
      return {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('readiness_check')) {
            return mockResult([{ readiness_check: 42 }]);
          }
          if (sql.includes('version()')) {
            return mockResult([{ v: '1.32.0' }]);
          }
          return mockResult([]);
        }),
        flush: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
    }
    registerFileText() {}
    async registerFileBuffer() {}
    async registerFileHandle() {}
    async copyFileToBuffer() { return new Uint8Array(); }
    async globFiles() { return []; }
    async flushFiles() {}
    async terminate() {}
  },
  AsyncDuckDBConnection: class {},
  DuckDBDataProtocol: {
    BUFFER: 0,
    NODE_FS: 1,
    BROWSER_FILEREADER: 2,
    BROWSER_FSACCESS: 3,
    HTTP: 4,
    S3: 5,
  },
  DuckDBAccessMode: {
    UNDEFINED: 0,
    AUTOMATIC: 1,
    READ_ONLY: 2,
    READ_WRITE: 3,
  },
  getLogLevelLabel: () => 'INFO',
}));

// ─── Mock Worker / WebSocket ──────────────────────────────────────────────────

class MockWorker {
  constructor(_url: string | URL, _options?: WorkerOptions) {}
  postMessage(_message: unknown, _transfer?: Transferable[]) {}
  terminate() {}
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event) { return true; }
}
(global as any).Worker = MockWorker;

class MockWebSocket {
  constructor(_url: string, _protocols?: string | string[]) { setTimeout(() => {}, 0); }
  send(_data: string | ArrayBuffer | Blob) {}
  close() {}
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}
(global as any).WebSocket = MockWebSocket;
