import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WorkspaceDatabaseFile,
  validateDuckDBDatabaseFile,
} from './workspaceDatabaseFile';

function duckDBFileBytes(marker = 1): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([68, 85, 67, 75], 8);
  bytes[20] = marker;
  return bytes;
}

describe('WorkspaceDatabaseFile', () => {
  let persistedBytes = duckDBFileBytes();
  const write = vi.fn(async (bytes: Uint8Array) => {
    persistedBytes = bytes.slice();
  });
  const close = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  const createWritable = vi.fn(async () => ({ write, close, abort }));
  const getFile = vi.fn(async () => ({
    size: persistedBytes.byteLength,
    arrayBuffer: async () => persistedBytes.slice().buffer,
  }));
  const getFileHandle = vi.fn(async () => ({ getFile, createWritable }));

  beforeEach(() => {
    vi.clearAllMocks();
    persistedBytes = duckDBFileBytes();
  });

  it('reads the checkpointed native database bytes', async () => {
    const file = new WorkspaceDatabaseFile(async () => ({ getFileHandle }));

    await expect(file.read()).resolves.toEqual(duckDBFileBytes());
  });

  it('validates a replacement before overwriting the current database', async () => {
    const file = new WorkspaceDatabaseFile(async () => ({ getFileHandle }));

    await expect(file.replace(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      'not a DuckDB database file',
    );
    expect(write).not.toHaveBeenCalled();

    const replacement = duckDBFileBytes(9);
    await file.replace(replacement);
    expect(persistedBytes).toEqual(replacement);
  });

  it('recognizes the DUCK magic bytes in the storage header', () => {
    expect(() => validateDuckDBDatabaseFile(duckDBFileBytes())).not.toThrow();
    const invalid = duckDBFileBytes();
    invalid[8] = 0;
    expect(() => validateDuckDBDatabaseFile(invalid)).toThrow(
      'not a DuckDB database file',
    );
  });

  it('aborts instead of committing a partial replacement when writing fails', async () => {
    const file = new WorkspaceDatabaseFile(async () => ({ getFileHandle }));
    write.mockRejectedValueOnce(new Error('disk full'));

    await expect(file.replace(duckDBFileBytes(9))).rejects.toThrow('disk full');
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(persistedBytes).toEqual(duckDBFileBytes());
  });
});
