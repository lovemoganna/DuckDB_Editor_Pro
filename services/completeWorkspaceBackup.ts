const BACKUP_MAGIC = new TextEncoder().encode('DDBFULL1');
const CREDENTIAL_KEY_PATTERN = /(?:api[_-]?key|token|secret|password)/i;
const APP_DATABASE_PATTERN = /^(?:duckdb|DuckDB)/;
const STRUCTURED_CODEC = 'ddb-structured-v2';
const PREPARED_BLOB = Symbol('prepared-workspace-backup-blob');

export interface IndexedDBIndexSnapshot {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
}

export interface IndexedDBStoreSnapshot {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IndexedDBIndexSnapshot[];
  records: Array<{ key: IDBValidKey; value: unknown }>;
}

export interface IndexedDBDatabaseSnapshot {
  name: string;
  version: number;
  stores: IndexedDBStoreSnapshot[];
}

export interface CompleteWorkspaceBackup {
  version: 1;
  exportedAt: string;
  localStorage: Record<string, string>;
  indexedDB: IndexedDBDatabaseSnapshot[];
  duckdbSnapshot: Uint8Array;
}

export interface CompleteWorkspaceRestoreAdapters {
  captureCurrentWorkspace(): Promise<CompleteWorkspaceBackup>;
  restoreBrowserState(backup: CompleteWorkspaceBackup): Promise<void>;
  installDuckDBSnapshot(snapshot: Uint8Array): Promise<void>;
}

interface CompleteWorkspaceManifest extends Omit<CompleteWorkspaceBackup, 'duckdbSnapshot'> {
  duckdbSnapshotLength: number;
  duckdbSnapshotChecksum: number;
}

interface PreparedBlob {
  [PREPARED_BLOB]: true;
  value: string;
  type: string;
}

interface EncodedStructuredValue {
  type: string;
  value?: unknown;
  subtype?: string;
  flags?: string;
  length?: number;
  entries?: unknown[];
}

type IndexedDBFactoryWithDatabaseList = IDBFactory;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function legacyJSONReviver(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('__ddbBackupType' in value)) return value;
  const encoded = value as {
    __ddbBackupType: string;
    value: unknown;
    constructor?: string;
    flags?: string;
    type?: string;
  };
  if (encoded.__ddbBackupType === 'bigint') return BigInt(String(encoded.value));
  if (encoded.__ddbBackupType === 'number') {
    if (encoded.value === 'NaN') return Number.NaN;
    if (encoded.value === 'Infinity') return Number.POSITIVE_INFINITY;
    if (encoded.value === '-Infinity') return Number.NEGATIVE_INFINITY;
    if (encoded.value === '-0') return -0;
  }
  if (encoded.__ddbBackupType === 'date') return new Date(String(encoded.value));
  if (encoded.__ddbBackupType === 'map') {
    return new Map(encoded.value as Array<[unknown, unknown]>);
  }
  if (encoded.__ddbBackupType === 'set') {
    return new Set(encoded.value as unknown[]);
  }
  if (encoded.__ddbBackupType === 'regexp') {
    return new RegExp(String(encoded.value), encoded.flags ?? '');
  }
  if (encoded.__ddbBackupType === 'blob') {
    return new Blob([base64ToBytes(String(encoded.value))], {
      type: encoded.type ?? '',
    });
  }
  if (encoded.__ddbBackupType === 'array-buffer') {
    return base64ToBytes(String(encoded.value)).buffer;
  }
  if (encoded.__ddbBackupType === 'typed-array') {
    const bytes = base64ToBytes(String(encoded.value));
    if (encoded.constructor === 'Uint8Array') return bytes;
    if (encoded.constructor === 'Uint8ClampedArray') return new Uint8ClampedArray(bytes.buffer);
    if (encoded.constructor === 'Int8Array') return new Int8Array(bytes.buffer);
    if (encoded.constructor === 'Uint16Array') return new Uint16Array(bytes.buffer);
    if (encoded.constructor === 'Int16Array') return new Int16Array(bytes.buffer);
    if (encoded.constructor === 'Uint32Array') return new Uint32Array(bytes.buffer);
    if (encoded.constructor === 'Int32Array') return new Int32Array(bytes.buffer);
    if (encoded.constructor === 'Float32Array') return new Float32Array(bytes.buffer);
    if (encoded.constructor === 'Float64Array') return new Float64Array(bytes.buffer);
    if (encoded.constructor === 'BigInt64Array') return new BigInt64Array(bytes.buffer);
    if (encoded.constructor === 'BigUint64Array') return new BigUint64Array(bytes.buffer);
    if (encoded.constructor === 'DataView') return new DataView(bytes.buffer);
    return bytes;
  }
  return value;
}

function encodeStructuredValue(
  value: unknown,
  ancestors = new WeakSet<object>(),
): EncodedStructuredValue {
  if (value === undefined) return { type: 'undefined' };
  if (value === null) return { type: 'null' };
  if (typeof value === 'string' || typeof value === 'boolean') {
    return { type: typeof value, value };
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { type: 'number', value: 'NaN' };
    if (value === Number.POSITIVE_INFINITY) return { type: 'number', value: 'Infinity' };
    if (value === Number.NEGATIVE_INFINITY) return { type: 'number', value: '-Infinity' };
    if (Object.is(value, -0)) return { type: 'number', value: '-0' };
    return { type: 'number', value };
  }
  if (typeof value === 'bigint') return { type: 'bigint', value: value.toString() };
  if (typeof value !== 'object') {
    throw new Error(`Unsupported IndexedDB value type: ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new Error('Cyclic IndexedDB records are not supported by the workspace backup format');
  }
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (value instanceof RegExp) {
    return { type: 'regexp', value: value.source, flags: value.flags };
  }
  if (value instanceof ArrayBuffer) {
    return { type: 'array-buffer', value: bytesToBase64(new Uint8Array(value)) };
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return {
      type: 'typed-array',
      subtype: value.constructor.name,
      value: bytesToBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)),
    };
  }
  if ((value as Partial<PreparedBlob>)[PREPARED_BLOB]) {
    const blob = value as PreparedBlob;
    return { type: 'blob', value: blob.value, subtype: blob.type };
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    throw new Error('Blob records must be prepared before workspace backup encoding');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const entries: Array<[number, EncodedStructuredValue]> = [];
      for (let index = 0; index < value.length; index += 1) {
        if (Object.prototype.hasOwnProperty.call(value, index)) {
          entries.push([index, encodeStructuredValue(value[index], ancestors)]);
        }
      }
      return { type: 'array', length: value.length, entries };
    }
    if (value instanceof Map) {
      return {
        type: 'map',
        entries: [...value.entries()].map(([key, nested]) => [
          encodeStructuredValue(key, ancestors),
          encodeStructuredValue(nested, ancestors),
        ]),
      };
    }
    if (value instanceof Set) {
      return {
        type: 'set',
        entries: [...value.values()].map(nested => encodeStructuredValue(nested, ancestors)),
      };
    }
    return {
      type: 'object',
      entries: Object.keys(value).map(key => [
        key,
        encodeStructuredValue((value as Record<string, unknown>)[key], ancestors),
      ]),
    };
  } finally {
    ancestors.delete(value);
  }
}

function decodeStructuredValue(encoded: EncodedStructuredValue): unknown {
  if (!encoded || typeof encoded !== 'object' || typeof encoded.type !== 'string') {
    throw new Error('Complete workspace backup contains an invalid structured value');
  }
  if (encoded.type === 'undefined') return undefined;
  if (encoded.type === 'null') return null;
  if (encoded.type === 'string') return String(encoded.value);
  if (encoded.type === 'boolean') return Boolean(encoded.value);
  if (encoded.type === 'bigint') return BigInt(String(encoded.value));
  if (encoded.type === 'number') {
    if (encoded.value === 'NaN') return Number.NaN;
    if (encoded.value === 'Infinity') return Number.POSITIVE_INFINITY;
    if (encoded.value === '-Infinity') return Number.NEGATIVE_INFINITY;
    if (encoded.value === '-0') return -0;
    if (typeof encoded.value !== 'number') {
      throw new Error('Complete workspace backup contains an invalid number');
    }
    return encoded.value;
  }
  if (encoded.type === 'date') return new Date(String(encoded.value));
  if (encoded.type === 'regexp') {
    return new RegExp(String(encoded.value), encoded.flags ?? '');
  }
  if (encoded.type === 'blob') {
    return new Blob([base64ToBytes(String(encoded.value))], {
      type: encoded.subtype ?? '',
    });
  }
  if (encoded.type === 'array-buffer') {
    return base64ToBytes(String(encoded.value)).buffer;
  }
  if (encoded.type === 'typed-array') {
    const bytes = base64ToBytes(String(encoded.value));
    if (encoded.subtype === 'Uint8Array') return bytes;
    if (encoded.subtype === 'Uint8ClampedArray') return new Uint8ClampedArray(bytes.buffer);
    if (encoded.subtype === 'Int8Array') return new Int8Array(bytes.buffer);
    if (encoded.subtype === 'Uint16Array') return new Uint16Array(bytes.buffer);
    if (encoded.subtype === 'Int16Array') return new Int16Array(bytes.buffer);
    if (encoded.subtype === 'Uint32Array') return new Uint32Array(bytes.buffer);
    if (encoded.subtype === 'Int32Array') return new Int32Array(bytes.buffer);
    if (encoded.subtype === 'Float32Array') return new Float32Array(bytes.buffer);
    if (encoded.subtype === 'Float64Array') return new Float64Array(bytes.buffer);
    if (encoded.subtype === 'BigInt64Array') return new BigInt64Array(bytes.buffer);
    if (encoded.subtype === 'BigUint64Array') return new BigUint64Array(bytes.buffer);
    if (encoded.subtype === 'DataView') return new DataView(bytes.buffer);
    throw new Error(`Unsupported typed array constructor: ${String(encoded.subtype)}`);
  }
  if (encoded.type === 'array') {
    if (!Number.isInteger(encoded.length) || (encoded.length ?? -1) < 0 || !Array.isArray(encoded.entries)) {
      throw new Error('Complete workspace backup contains an invalid array');
    }
    const array = new Array(encoded.length);
    for (const entry of encoded.entries as Array<[number, EncodedStructuredValue]>) {
      if (!Array.isArray(entry) || !Number.isInteger(entry[0]) || entry[0] < 0 || entry[0] >= array.length) {
        throw new Error('Complete workspace backup contains an invalid array entry');
      }
      array[entry[0]] = decodeStructuredValue(entry[1]);
    }
    return array;
  }
  if (encoded.type === 'map') {
    if (!Array.isArray(encoded.entries)) {
      throw new Error('Complete workspace backup contains an invalid map');
    }
    return new Map(
      (encoded.entries as Array<[EncodedStructuredValue, EncodedStructuredValue]>)
        .map(([key, value]) => [decodeStructuredValue(key), decodeStructuredValue(value)]),
    );
  }
  if (encoded.type === 'set') {
    if (!Array.isArray(encoded.entries)) {
      throw new Error('Complete workspace backup contains an invalid set');
    }
    return new Set(
      (encoded.entries as EncodedStructuredValue[]).map(value => decodeStructuredValue(value)),
    );
  }
  if (encoded.type === 'object') {
    if (!Array.isArray(encoded.entries)) {
      throw new Error('Complete workspace backup contains an invalid object');
    }
    return Object.fromEntries(
      (encoded.entries as Array<[string, EncodedStructuredValue]>)
        .map(([key, value]) => [key, decodeStructuredValue(value)]),
    );
  }
  throw new Error(`Unsupported structured backup value type: ${encoded.type}`);
}

export async function prepareStructuredValueForBackup(
  value: unknown,
  ancestors = new WeakSet<object>(),
): Promise<unknown> {
  if (value === null || typeof value !== 'object') return value;
  if (
    value instanceof Date
    || value instanceof RegExp
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
  ) {
    return value;
  }
  if (value instanceof Blob) {
    return {
      [PREPARED_BLOB]: true,
      value: bytesToBase64(new Uint8Array(await value.arrayBuffer())),
      type: value.type,
    } satisfies PreparedBlob;
  }
  if (ancestors.has(value)) {
    throw new Error('Cyclic IndexedDB records are not supported by the workspace backup format');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Promise.all(value.map(item => prepareStructuredValueForBackup(item, ancestors)));
    }
    if (value instanceof Map) {
      const entries = await Promise.all([...value.entries()].map(async ([key, nested]) => [
        await prepareStructuredValueForBackup(key, ancestors),
        await prepareStructuredValueForBackup(nested, ancestors),
      ] as [unknown, unknown]));
      return new Map(entries);
    }
    if (value instanceof Set) {
      return new Set(await Promise.all(
        [...value.values()].map(item => prepareStructuredValueForBackup(item, ancestors)),
      ));
    }
    const preparedEntries = await Promise.all(
      Object.entries(value).map(async ([key, nested]) => [
        key,
        await prepareStructuredValueForBackup(nested, ancestors),
      ] as const),
    );
    return Object.fromEntries(preparedEntries);
  } finally {
    ancestors.delete(value);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(
  factory: IDBFactory,
  name: string,
  version?: number,
  onUpgrade?: (database: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version ? factory.open(name, version) : factory.open(name);
    request.onupgradeneeded = () => onUpgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(
  factory: IDBFactory,
  name: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(
      new Error(`IndexedDB database "${name}" is still open and could not be restored`),
    );
  });
}

export function isWorkspaceStorageKeySafe(key: string): boolean {
  return !CREDENTIAL_KEY_PATTERN.test(key);
}

export function encodeCompleteWorkspaceBackup(backup: CompleteWorkspaceBackup): Uint8Array {
  if (backup.version !== 1) throw new Error(`Unsupported workspace backup version: ${backup.version}`);
  const manifest: CompleteWorkspaceManifest = {
    version: backup.version,
    exportedAt: backup.exportedAt,
    localStorage: backup.localStorage,
    indexedDB: backup.indexedDB,
    duckdbSnapshotLength: backup.duckdbSnapshot.byteLength,
    duckdbSnapshotChecksum: crc32(backup.duckdbSnapshot),
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify({
    codec: STRUCTURED_CODEC,
    value: encodeStructuredValue(manifest),
  }));
  const headerLength = BACKUP_MAGIC.byteLength + 4 + manifestBytes.byteLength;
  const encoded = new Uint8Array(headerLength + backup.duckdbSnapshot.byteLength);
  encoded.set(BACKUP_MAGIC);
  new DataView(encoded.buffer).setUint32(BACKUP_MAGIC.byteLength, manifestBytes.byteLength, true);
  encoded.set(manifestBytes, BACKUP_MAGIC.byteLength + 4);
  encoded.set(backup.duckdbSnapshot, headerLength);
  return encoded;
}

export function decodeCompleteWorkspaceBackup(encoded: Uint8Array): CompleteWorkspaceBackup {
  if (encoded.byteLength < BACKUP_MAGIC.byteLength + 4) {
    throw new Error('Complete workspace backup is incomplete');
  }
  BACKUP_MAGIC.forEach((byte, index) => {
    if (encoded[index] !== byte) throw new Error('Complete workspace backup has an unknown format');
  });

  const manifestLength = new DataView(
    encoded.buffer,
    encoded.byteOffset,
    encoded.byteLength,
  ).getUint32(BACKUP_MAGIC.byteLength, true);
  const manifestStart = BACKUP_MAGIC.byteLength + 4;
  const manifestEnd = manifestStart + manifestLength;
  if (manifestEnd > encoded.byteLength) throw new Error('Complete workspace backup manifest is incomplete');

  const manifestSource = new TextDecoder().decode(encoded.subarray(manifestStart, manifestEnd));
  const parsedManifest = JSON.parse(manifestSource) as {
    codec?: string;
    value?: EncodedStructuredValue;
  };
  const manifest = (
    parsedManifest.codec === STRUCTURED_CODEC && parsedManifest.value
      ? decodeStructuredValue(parsedManifest.value)
      : JSON.parse(manifestSource, legacyJSONReviver)
  ) as CompleteWorkspaceManifest;
  if (manifest.version !== 1) {
    throw new Error(`Unsupported workspace backup version: ${String(manifest.version)}`);
  }
  if (
    !manifest.localStorage
    || !Array.isArray(manifest.indexedDB)
    || !Number.isInteger(manifest.duckdbSnapshotLength)
    || manifest.duckdbSnapshotLength < 1
    || !Number.isInteger(manifest.duckdbSnapshotChecksum)
    || manifestEnd + manifest.duckdbSnapshotLength !== encoded.byteLength
  ) {
    throw new Error('Complete workspace backup manifest is invalid');
  }

  const duckdbSnapshot = encoded.slice(manifestEnd);
  if (crc32(duckdbSnapshot) !== manifest.duckdbSnapshotChecksum) {
    throw new Error('Complete workspace backup snapshot checksum does not match');
  }

  return {
    version: 1,
    exportedAt: manifest.exportedAt,
    localStorage: manifest.localStorage,
    indexedDB: manifest.indexedDB,
    duckdbSnapshot,
  };
}

async function snapshotDatabase(
  factory: IDBFactory,
  name: string,
): Promise<IndexedDBDatabaseSnapshot> {
  const database = await openDatabase(factory, name);
  try {
    const storeNames = Array.from(database.objectStoreNames);
    if (storeNames.length === 0) {
      return { name, version: database.version, stores: [] };
    }
    const transaction = database.transaction(storeNames, 'readonly');
    const stores = await Promise.all(storeNames.map(async storeName => {
      const store = transaction.objectStore(storeName);
      const [keys, values] = await Promise.all([
        requestResult(store.getAllKeys()),
        requestResult(store.getAll()),
      ]);
      return {
        name: store.name,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames).map(indexName => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath,
            unique: index.unique,
            multiEntry: index.multiEntry,
          };
        }),
        records: await Promise.all(values.map(async (value, index) => ({
          key: keys[index],
          value: await prepareStructuredValueForBackup(value),
        }))),
      };
    }));
    await transactionDone(transaction);
    return { name, version: database.version, stores };
  } finally {
    database.close();
  }
}

export async function collectCompleteWorkspaceBackup(
  duckdbSnapshot: Uint8Array,
  storage: Storage = localStorage,
  factory: IndexedDBFactoryWithDatabaseList = indexedDB,
): Promise<CompleteWorkspaceBackup> {
  const localEntries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isWorkspaceStorageKeySafe(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) localEntries[key] = value;
  }

  const databaseNames = factory.databases
    ? (await factory.databases())
      .map(database => database.name)
      .filter((name): name is string => Boolean(name && APP_DATABASE_PATTERN.test(name)))
    : [];
  const databaseSnapshots = await Promise.all(
    [...new Set(databaseNames)].sort().map(name => snapshotDatabase(factory, name)),
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: localEntries,
    indexedDB: databaseSnapshots,
    duckdbSnapshot: duckdbSnapshot.slice(),
  };
}

async function restoreDatabase(
  factory: IndexedDBFactoryWithDatabaseList,
  snapshot: IndexedDBDatabaseSnapshot,
): Promise<void> {
  const createSchema = (database: IDBDatabase) => {
    snapshot.stores.forEach(storeSnapshot => {
      if (database.objectStoreNames.contains(storeSnapshot.name)) return;
      const store = database.createObjectStore(storeSnapshot.name, {
        keyPath: storeSnapshot.keyPath,
        autoIncrement: storeSnapshot.autoIncrement,
      });
      storeSnapshot.indexes.forEach(index => {
        store.createIndex(index.name, index.keyPath, {
          unique: index.unique,
          multiEntry: index.multiEntry,
        });
      });
    });
  };
  const database = await openDatabase(
    factory,
    snapshot.name,
    snapshot.version,
    createSchema,
  );
  try {
    const restorableStores = snapshot.stores.filter(store =>
      database.objectStoreNames.contains(store.name),
    );
    if (restorableStores.length === 0) return;
    const transaction = database.transaction(
      restorableStores.map(store => store.name),
      'readwrite',
    );
    restorableStores.forEach(storeSnapshot => {
      const store = transaction.objectStore(storeSnapshot.name);
      store.clear();
      storeSnapshot.records.forEach(record => {
        if (store.keyPath === null) store.put(record.value, record.key);
        else store.put(record.value);
      });
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function restoreBrowserWorkspaceState(
  backup: CompleteWorkspaceBackup,
  storage: Storage = localStorage,
  factory: IndexedDBFactoryWithDatabaseList = indexedDB,
): Promise<void> {
  const currentKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isWorkspaceStorageKeySafe(key)) currentKeys.push(key);
  }
  currentKeys.forEach(key => storage.removeItem(key));
  Object.entries(backup.localStorage).forEach(([key, value]) => {
    if (isWorkspaceStorageKeySafe(key)) storage.setItem(key, value);
  });

  const existingNames = new Set(
    factory.databases
      ? (await factory.databases())
        .map(database => database.name)
        .filter((name): name is string => Boolean(name))
      : [],
  );
  const snapshotNames = new Set(
    backup.indexedDB
      .map(database => database.name)
      .filter(name => APP_DATABASE_PATTERN.test(name)),
  );

  for (const name of existingNames) {
    if (APP_DATABASE_PATTERN.test(name)) {
      await deleteDatabase(factory, name);
    }
  }
  for (const database of backup.indexedDB) {
    if (!APP_DATABASE_PATTERN.test(database.name)) continue;
    if (!existingNames.has(database.name) && snapshotNames.has(database.name)) {
      await deleteDatabase(factory, database.name);
    }
    await restoreDatabase(factory, database);
  }
}

/**
 * Applies a complete restore as a recoverable two-phase operation. Browser
 * state is replaced before the engine file, and any failure restores the
 * snapshot captured immediately before the operation.
 */
export async function restoreCompleteWorkspace(
  backup: CompleteWorkspaceBackup,
  adapters: CompleteWorkspaceRestoreAdapters,
): Promise<void> {
  const previous = await adapters.captureCurrentWorkspace();
  let duckDBInstallAttempted = false;

  try {
    await adapters.restoreBrowserState(backup);
    duckDBInstallAttempted = true;
    await adapters.installDuckDBSnapshot(backup.duckdbSnapshot);
  } catch (error) {
    const rollbackFailures: string[] = [];
    try {
      await adapters.restoreBrowserState(previous);
    } catch (rollbackError) {
      rollbackFailures.push(
        `browser state: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    if (duckDBInstallAttempted) {
      try {
        await adapters.installDuckDBSnapshot(previous.duckdbSnapshot);
      } catch (rollbackError) {
        rollbackFailures.push(
          `DuckDB: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
    }
    if (rollbackFailures.length > 0) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; rollback failed (${rollbackFailures.join(', ')})`,
        { cause: error },
      );
    }
    throw error;
  }
}
