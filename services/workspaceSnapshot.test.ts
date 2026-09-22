import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import {
  WORKSPACE_SNAPSHOT_FILE_NAME,
  WorkspaceSnapshotStore,
  decodeWorkspaceArchive,
  encodeWorkspaceArchive,
} from './workspaceSnapshot';

describe('WorkspaceSnapshotStore', () => {
  const exportPath = 'workspace_snapshot_20260726';
  const exportedFiles = [
    { fileName: `${exportPath}/schema.sql`, dataProtocol: DuckDBDataProtocol.BUFFER },
    { fileName: `${exportPath}/load.sql`, dataProtocol: DuckDBDataProtocol.BUFFER },
  ];
  const fileBytes = new Map([
    [`${exportPath}/schema.sql`, new Uint8Array([1, 2, 3])],
    [`${exportPath}/load.sql`, new Uint8Array([4, 5])],
  ]);

  let persistedBytes = new Uint8Array();
  const registerFileBuffer = vi.fn(async () => undefined);
  const copyFileToBuffer = vi.fn(async (path: string) => fileBytes.get(path) ?? new Uint8Array());
  const globFiles = vi.fn(async () => exportedFiles);
  const write = vi.fn(async (bytes: Uint8Array) => {
    persistedBytes = bytes.slice();
  });
  const close = vi.fn(async () => undefined);
  const createWritable = vi.fn(async () => ({ write, close }));
  const getFile = vi.fn(async () => ({
    size: persistedBytes.byteLength,
    arrayBuffer: async () => persistedBytes.slice().buffer,
  }));
  const getFileHandle = vi.fn(async (_name: string, options?: { create?: boolean }) => {
    if (!options?.create && persistedBytes.byteLength === 0) {
      throw new DOMException('missing', 'NotFoundError');
    }
    return { getFile, createWritable };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    persistedBytes = new Uint8Array();
  });

  it('round-trips exported SQL and Parquet bytes without changing their paths', () => {
    const encoded = encodeWorkspaceArchive({
      exportPath,
      files: [
        { path: `${exportPath}/schema.sql`, bytes: new Uint8Array([1, 2, 3]) },
        { path: `${exportPath}/table.parquet`, bytes: new Uint8Array([4, 5]) },
      ],
    });

    expect(decodeWorkspaceArchive(encoded)).toEqual({
      exportPath,
      files: [
        { path: `${exportPath}/schema.sql`, bytes: new Uint8Array([1, 2, 3]) },
        { path: `${exportPath}/table.parquet`, bytes: new Uint8Array([4, 5]) },
      ],
    });
  });

  it('packages a completed DuckDB export and restores every file before import', async () => {
    const store = new WorkspaceSnapshotStore(
      { registerFileBuffer, copyFileToBuffer, globFiles },
      async () => ({ getFileHandle }),
    );

    const persisted = await store.persist(exportPath);
    registerFileBuffer.mockClear();
    const restored = await store.restore();

    expect(globFiles).toHaveBeenCalledWith(`${exportPath}/**`);
    expect(getFileHandle).toHaveBeenCalledWith(
      WORKSPACE_SNAPSHOT_FILE_NAME,
      { create: true },
    );
    expect(persisted.size).toBeGreaterThan(0);
    expect(restored).toEqual({
      restored: true,
      size: persisted.size,
      exportPath,
      files: exportedFiles.map(file => file.fileName).sort(),
    });
    expect(registerFileBuffer).toHaveBeenCalledWith(
      `${exportPath}/schema.sql`,
      new Uint8Array([1, 2, 3]),
    );
    expect(registerFileBuffer).toHaveBeenCalledWith(
      `${exportPath}/load.sql`,
      new Uint8Array([4, 5]),
    );
  });

  it('treats a missing snapshot as a clean first run', async () => {
    const store = new WorkspaceSnapshotStore(
      { registerFileBuffer, copyFileToBuffer, globFiles },
      async () => ({ getFileHandle }),
    );

    await expect(store.restore()).resolves.toEqual({ restored: false, size: 0 });
    expect(registerFileBuffer).not.toHaveBeenCalled();
  });

  it('exports and replaces the persisted archive only after validating it', async () => {
    const store = new WorkspaceSnapshotStore(
      { registerFileBuffer, copyFileToBuffer, globFiles },
      async () => ({ getFileHandle }),
    );
    const replacement = encodeWorkspaceArchive({
      exportPath,
      files: [{
        path: `${exportPath}/schema.sql`,
        bytes: new Uint8Array([9, 8, 7]),
      }],
    });

    await store.replacePersisted(replacement);

    await expect(store.readPersisted()).resolves.toEqual(replacement);
    await expect(store.replacePersisted(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      /incomplete|unknown/i,
    );
    await expect(store.readPersisted()).resolves.toEqual(replacement);
  });
});
