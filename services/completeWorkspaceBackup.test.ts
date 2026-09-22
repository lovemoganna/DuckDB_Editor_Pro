import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveExplanation } from './aiExplanationStorage';
import { saveSnippet } from './codeSnippetsStorage';
import {
  CompleteWorkspaceBackup,
  decodeCompleteWorkspaceBackup,
  encodeCompleteWorkspaceBackup,
  isWorkspaceStorageKeySafe,
  prepareStructuredValueForBackup,
  restoreCompleteWorkspace,
  restoreBrowserWorkspaceState,
} from './completeWorkspaceBackup';

function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
  stores: string[],
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => {
      stores.forEach(store => request.result.createObjectStore(store));
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('complete workspace backup codec', () => {
  it('round-trips browser state and the binary DuckDB snapshot', () => {
    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {
        duckdb_sql_history: '[{"sql":"select 1"}]',
      },
      indexedDB: [{
        name: 'duckdb_library',
        version: 4,
        stores: [{
          name: 'ontology_entries',
          keyPath: 'id',
          autoIncrement: false,
          indexes: [],
          records: [{ key: 'node-1', value: { id: 'node-1', label: 'Revenue' } }],
        }],
      }],
      duckdbSnapshot: new Uint8Array([0, 1, 2, 255]),
    };

    expect(decodeCompleteWorkspaceBackup(encodeCompleteWorkspaceBackup(backup))).toEqual(backup);
  });

  it('preserves common IndexedDB structured-clone value types', () => {
    const sparse = new Array(3);
    sparse[1] = undefined;
    sparse[2] = 'present';
    const structuredValue = {
      date: new Date('2026-07-26T12:34:56.000Z'),
      map: new Map<unknown, unknown>([['metric', 42], [7, { active: true }]]),
      set: new Set<unknown>(['duckdb', 3]),
      regexp: /duckdb\s+manager/gi,
      nan: Number.NaN,
      positiveInfinity: Number.POSITIVE_INFINITY,
      negativeInfinity: Number.NEGATIVE_INFINITY,
      negativeZero: -0,
      explicitUndefined: undefined,
      sparse,
      markerCollision: {
        __ddbBackupType: 'date',
        value: 'ordinary user data',
      },
    };
    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {},
      indexedDB: [{
        name: 'duckdb_library',
        version: 1,
        stores: [{
          name: 'records',
          keyPath: null,
          autoIncrement: false,
          indexes: [],
          records: [{ key: 'structured', value: structuredValue }],
        }],
      }],
      duckdbSnapshot: new Uint8Array([0, 1, 2, 3]),
    };

    const decoded = decodeCompleteWorkspaceBackup(encodeCompleteWorkspaceBackup(backup));
    expect(decoded.indexedDB[0].stores[0].records[0].value).toEqual(structuredValue);
    expect(Object.is(
      (decoded.indexedDB[0].stores[0].records[0].value as typeof structuredValue).negativeZero,
      -0,
    )).toBe(true);
    const decodedValue = decoded.indexedDB[0].stores[0].records[0].value as typeof structuredValue;
    expect(Object.prototype.hasOwnProperty.call(decodedValue, 'explicitUndefined')).toBe(true);
    expect(decodedValue.explicitUndefined).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(decodedValue.sparse, 0)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(decodedValue.sparse, 1)).toBe(true);
    expect(decodedValue.sparse).toHaveLength(3);
    expect(decodedValue.markerCollision).toEqual({
      __ddbBackupType: 'date',
      value: 'ordinary user data',
    });
  });

  it('rejects same-length corruption using the embedded snapshot checksum', () => {
    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {},
      indexedDB: [],
      duckdbSnapshot: new Uint8Array([0, 1, 2, 3]),
    };
    const encoded = encodeCompleteWorkspaceBackup(backup);
    encoded[encoded.length - 1] ^= 0xff;

    expect(() => decodeCompleteWorkspaceBackup(encoded)).toThrow('checksum');
  });

  it('preserves Blob records collected from IndexedDB', async () => {
    const preparedBlob = await prepareStructuredValueForBackup(
      new Blob(['ontology evidence'], { type: 'text/plain' }),
    );
    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {},
      indexedDB: [{
        name: 'duckdb_library',
        version: 1,
        stores: [{
          name: 'records',
          keyPath: null,
          autoIncrement: false,
          indexes: [],
          records: [{ key: 'blob', value: preparedBlob }],
        }],
      }],
      duckdbSnapshot: new Uint8Array([0, 1, 2, 3]),
    };
    const decoded = decodeCompleteWorkspaceBackup(encodeCompleteWorkspaceBackup(backup));
    const value = decoded.indexedDB[0].stores[0].records[0].value as Blob;

    expect(value).toBeInstanceOf(Blob);
    expect(value.type).toBe('text/plain');
    await expect(value.text()).resolves.toBe('ontology evidence');
  });

  it('never exports credential-like local storage keys', () => {
    expect(isWorkspaceStorageKeySafe('duckdb_sql_history')).toBe(true);
    expect(isWorkspaceStorageKeySafe('duckdb_ai_api_key')).toBe(false);
    expect(isWorkspaceStorageKeySafe('provider-token')).toBe(false);
  });

  it('rejects a truncated or unknown backup before restore can mutate storage', () => {
    expect(() => decodeCompleteWorkspaceBackup(new Uint8Array([1, 2, 3]))).toThrow(
      /incomplete|unknown/i,
    );
  });

  it('restores an exact IndexedDB snapshot without ghost databases or stores', async () => {
    const factory = new IDBFactory();
    const ghost = await openDatabase(factory, 'duckdb_ghost', 1, ['stale']);
    ghost.close();
    const current = await openDatabase(
      factory,
      'duckdb_library',
      1,
      ['entries', 'stale_store'],
    );
    current.close();

    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {},
      indexedDB: [{
        name: 'duckdb_library',
        version: 1,
        stores: [{
          name: 'entries',
          keyPath: null,
          autoIncrement: false,
          indexes: [],
          records: [{ key: 'restored', value: { label: 'Restored' } }],
        }],
      }],
      duckdbSnapshot: new Uint8Array([1]),
    };

    await restoreBrowserWorkspaceState(
      backup,
      { length: 0 } as Storage,
      factory,
    );

    await expect(factory.databases()).resolves.toEqual([
      { name: 'duckdb_library', version: 1 },
    ]);
    const restored = await openDatabase(factory, 'duckdb_library', 1, []);
    expect(Array.from(restored.objectStoreNames)).toEqual(['entries']);
    const record = await new Promise((resolve, reject) => {
      const request = restored.transaction('entries').objectStore('entries').get('restored');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(record).toEqual({ label: 'Restored' });
    restored.close();
  });

  it('restores databases after real feature modules have retained open connections', async () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);

    await saveSnippet({
      id: 'old-snippet',
      code: 'SELECT old_value',
      description: 'old',
      tutorialId: 'old',
      tutorialTitle: 'Old',
      tags: ['old'],
      createdAt: '2026-07-25T00:00:00.000Z',
    });
    await saveExplanation({
      id: 'old-explanation',
      sql: 'SELECT old_value',
      explanation: 'old',
      createdAt: 1,
    });

    const backup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: {},
      indexedDB: [
        {
          name: 'duckdb_code_snippets',
          version: 1,
          stores: [{
            name: 'snippets',
            keyPath: 'id',
            autoIncrement: false,
            indexes: [
              { name: 'tutorialId', keyPath: 'tutorialId', unique: false, multiEntry: false },
              { name: 'createdAt', keyPath: 'createdAt', unique: false, multiEntry: false },
              { name: 'tags', keyPath: 'tags', unique: false, multiEntry: true },
            ],
            records: [{
              key: 'restored-snippet',
              value: {
                id: 'restored-snippet',
                code: 'SELECT restored_value',
                description: 'restored',
                tutorialId: 'restored',
                tutorialTitle: 'Restored',
                tags: ['restored'],
                createdAt: '2026-07-26T00:00:00.000Z',
              },
            }],
          }],
        },
        {
          name: 'duckdb_ai_explanations',
          version: 1,
          stores: [{
            name: 'explanations',
            keyPath: 'id',
            autoIncrement: false,
            indexes: [
              { name: 'createdAt', keyPath: 'createdAt', unique: false, multiEntry: false },
            ],
            records: [{
              key: 'restored-explanation',
              value: {
                id: 'restored-explanation',
                sql: 'SELECT restored_value',
                explanation: 'restored',
                createdAt: 2,
              },
            }],
          }],
        },
      ],
      duckdbSnapshot: new Uint8Array([1]),
    };

    await restoreBrowserWorkspaceState(backup, { length: 0 } as Storage, factory);

    const restoredSnippetDB = await openDatabase(
      factory,
      'duckdb_code_snippets',
      1,
      [],
    );
    const restoredSnippet = await new Promise((resolve, reject) => {
      const request = restoredSnippetDB
        .transaction('snippets')
        .objectStore('snippets')
        .get('restored-snippet');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    restoredSnippetDB.close();

    expect(restoredSnippet).toMatchObject({
      id: 'restored-snippet',
      code: 'SELECT restored_value',
    });
    expect((await factory.databases()).sort(
      (left, right) => String(left.name).localeCompare(String(right.name)),
    )).toEqual([
      { name: 'duckdb_ai_explanations', version: 1 },
      { name: 'duckdb_code_snippets', version: 1 },
    ]);
  });

  it('rolls browser and DuckDB state back when a complete restore fails', async () => {
    const currentBackup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-25T00:00:00.000Z',
      localStorage: { duckdb_sql_history: 'current' },
      indexedDB: [],
      duckdbSnapshot: new Uint8Array([1, 2, 3]),
    };
    const incomingBackup: CompleteWorkspaceBackup = {
      version: 1,
      exportedAt: '2026-07-26T00:00:00.000Z',
      localStorage: { duckdb_sql_history: 'incoming' },
      indexedDB: [],
      duckdbSnapshot: new Uint8Array([4, 5, 6]),
    };
    const restoreBrowserState = vi.fn(async () => undefined);
    const installDuckDBSnapshot = vi.fn(async (snapshot: Uint8Array) => {
      if (snapshot === incomingBackup.duckdbSnapshot) {
        throw new Error('install failed');
      }
    });

    await expect(restoreCompleteWorkspace(incomingBackup, {
      captureCurrentWorkspace: vi.fn(async () => currentBackup),
      restoreBrowserState,
      installDuckDBSnapshot,
    })).rejects.toThrow('install failed');

    expect(restoreBrowserState.mock.calls).toEqual([
      [incomingBackup],
      [currentBackup],
    ]);
    expect(installDuckDBSnapshot.mock.calls).toEqual([
      [incomingBackup.duckdbSnapshot],
      [currentBackup.duckdbSnapshot],
    ]);
  });
});
