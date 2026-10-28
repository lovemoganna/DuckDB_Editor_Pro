import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importOpfsDuckdbFile, deleteOpfsDuckdbFile, prepareOpfsWorkspaceFile } from './opfsDatabaseFiles';

describe('domain database files', () => {
  const write = vi.fn();
  const close = vi.fn();
  const removeEntry = vi.fn();
  const getFileHandle = vi.fn();
  const file = (valid = true) => {
    const bytes = new Uint8Array(32);
    if (valid) bytes.set([68, 85, 67, 75], 8);
    return { arrayBuffer: async () => bytes.buffer } as File;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getFileHandle.mockReset();
    write.mockReset().mockResolvedValue(undefined);
    close.mockReset().mockResolvedValue(undefined);
    removeEntry.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({ getFileHandle, removeEntry }) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('validates the native header before creating any file', async () => {
    await expect(importOpfsDuckdbFile(file(false), 'external')).rejects.toThrow();
    expect(getFileHandle).not.toHaveBeenCalled();
  });

  it('initializes a zero-byte workspace from a validated database template', async () => {
    getFileHandle.mockResolvedValue({ getFile: async () => ({ size: 0 }), createWritable: async () => ({ write, close }) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: file().arrayBuffer }));
    await prepareOpfsWorkspaceFile();
    expect(write).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(close).toHaveBeenCalledOnce();
    expect(removeEntry).not.toHaveBeenCalled();
  });

  it('never overwrites a nonempty workspace or downloads a template for it', async () => {
    getFileHandle.mockResolvedValue({ getFile: async () => ({ size: 4096 }), createWritable: async () => ({ write, close }) });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await prepareOpfsWorkspaceFile();
    expect(fetch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing domain file', async () => {
    getFileHandle.mockResolvedValue({});
    await expect(importOpfsDuckdbFile(file(), 'external')).rejects.toThrow('已存在');
    expect(write).not.toHaveBeenCalled();
    expect(removeEntry).not.toHaveBeenCalled();
  });

  it('copies and closes a valid external database file', async () => {
    getFileHandle.mockRejectedValueOnce(new DOMException('missing', 'NotFoundError'))
      .mockResolvedValueOnce({ createWritable: async () => ({ write, close }) });
    await expect(importOpfsDuckdbFile(file(), 'external')).resolves.toBe('opfs://external.duckdb');
    expect(write).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(close).toHaveBeenCalledOnce();
  });

  it('removes only the newly created partial file when writing fails', async () => {
    getFileHandle.mockRejectedValueOnce(new DOMException('missing', 'NotFoundError'))
      .mockResolvedValueOnce({ createWritable: async () => ({ write, close }) });
    write.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(importOpfsDuckdbFile(file(), 'external')).rejects.toThrow('quota exceeded');
    expect(removeEntry).toHaveBeenCalledExactlyOnceWith('external.duckdb');
  });

  it('reports a file deletion error instead of claiming success', async () => {
    removeEntry.mockRejectedValueOnce(new Error('file locked'));
    await expect(deleteOpfsDuckdbFile('external')).rejects.toThrow('file locked');
  });
});
