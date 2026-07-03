/**
 * vitest.setup.ts — Global test environment setup
 *
 * Provides browser-like globals and mocks needed for jsdom testing:
 * 1. Worker, WebSocket stubs (jsdom does not implement these)
 * 2. @duckdb/duckdb-wasm mock — allows DuckDBService to instantiate without real WASM
 *
 * Note: duckDBService is mocked per-test-file in useOntologyStore.crud.test.ts.
 */

import { vi } from 'vitest';

// ─── Mock @duckdb/duckdb-wasm ────────────────────────────────────────────────

vi.mock('@duckdb/duckdb-wasm', () => ({
  AsyncDuckDB: class MockDB {
    async instantiate() {}
    async connect() {
      return {
        query: vi.fn().mockResolvedValue([]),
        flush: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
    }
    registerFileText() {}
  },
  AsyncDuckDBConnection: class {},
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
