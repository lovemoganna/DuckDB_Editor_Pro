import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

export const WORKSPACE_SNAPSHOT_FILE_NAME = 'duckdb_manager_workspace.snapshot';
const ARCHIVE_MAGIC = 'DDBWS001';
const MAGIC_BYTES = new TextEncoder().encode(ARCHIVE_MAGIC);

type SnapshotDatabase = Pick<
  AsyncDuckDB,
  'registerFileBuffer' | 'copyFileToBuffer' | 'globFiles'
>;

interface SnapshotFile {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface SnapshotWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

interface SnapshotFileHandle {
  getFile(): Promise<SnapshotFile>;
  createWritable(): Promise<SnapshotWritable>;
}

interface SnapshotDirectory {
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<SnapshotFileHandle>;
}

type SnapshotDirectoryProvider = () => Promise<SnapshotDirectory>;

export interface WorkspaceArchive {
  exportPath: string;
  files: Array<{
    path: string;
    bytes: Uint8Array;
  }>;
}

interface WorkspaceArchiveManifest {
  version: 1;
  exportPath: string;
  files: Array<{
    path: string;
    offset: number;
    length: number;
  }>;
}

function assertSafeExportPath(exportPath: string): void {
  if (!/^workspace_snapshot_[a-zA-Z0-9_-]+$/.test(exportPath)) {
    throw new Error(`Unsafe workspace export path: ${exportPath}`);
  }
}

function assertSafeArchiveFile(exportPath: string, filePath: string): void {
  if (
    filePath.includes('..')
    || filePath.startsWith('/')
    || !filePath.startsWith(`${exportPath}/`)
  ) {
    throw new Error(`Unsafe workspace archive file: ${filePath}`);
  }
}

export function encodeWorkspaceArchive(archive: WorkspaceArchive): Uint8Array {
  assertSafeExportPath(archive.exportPath);

  let payloadSize = 0;
  const manifest: WorkspaceArchiveManifest = {
    version: 1,
    exportPath: archive.exportPath,
    files: archive.files.map(file => {
      assertSafeArchiveFile(archive.exportPath, file.path);
      const entry = {
        path: file.path,
        offset: payloadSize,
        length: file.bytes.byteLength,
      };
      payloadSize += file.bytes.byteLength;
      return entry;
    }),
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const headerSize = MAGIC_BYTES.byteLength + 4 + manifestBytes.byteLength;
  const encoded = new Uint8Array(headerSize + payloadSize);
  encoded.set(MAGIC_BYTES, 0);
  new DataView(encoded.buffer).setUint32(MAGIC_BYTES.byteLength, manifestBytes.byteLength, true);
  encoded.set(manifestBytes, MAGIC_BYTES.byteLength + 4);

  let payloadOffset = headerSize;
  for (const file of archive.files) {
    encoded.set(file.bytes, payloadOffset);
    payloadOffset += file.bytes.byteLength;
  }
  return encoded;
}

export function decodeWorkspaceArchive(encoded: Uint8Array): WorkspaceArchive {
  if (encoded.byteLength < MAGIC_BYTES.byteLength + 4) {
    throw new Error('Workspace snapshot is incomplete');
  }
  for (let index = 0; index < MAGIC_BYTES.byteLength; index += 1) {
    if (encoded[index] !== MAGIC_BYTES[index]) {
      throw new Error('Workspace snapshot has an unknown format');
    }
  }

  const manifestLength = new DataView(
    encoded.buffer,
    encoded.byteOffset,
    encoded.byteLength,
  ).getUint32(MAGIC_BYTES.byteLength, true);
  const manifestStart = MAGIC_BYTES.byteLength + 4;
  const manifestEnd = manifestStart + manifestLength;
  if (manifestEnd > encoded.byteLength) {
    throw new Error('Workspace snapshot manifest is incomplete');
  }

  const manifest = JSON.parse(
    new TextDecoder().decode(encoded.subarray(manifestStart, manifestEnd)),
  ) as WorkspaceArchiveManifest;
  if (manifest.version !== 1) {
    throw new Error(`Unsupported workspace snapshot version: ${String(manifest.version)}`);
  }
  assertSafeExportPath(manifest.exportPath);

  const payload = encoded.subarray(manifestEnd);
  const files = manifest.files.map(file => {
    assertSafeArchiveFile(manifest.exportPath, file.path);
    if (
      !Number.isInteger(file.offset)
      || !Number.isInteger(file.length)
      || file.offset < 0
      || file.length < 0
      || file.offset + file.length > payload.byteLength
    ) {
      throw new Error(`Workspace snapshot entry is incomplete: ${file.path}`);
    }
    return {
      path: file.path,
      bytes: payload.slice(file.offset, file.offset + file.length),
    };
  });

  return {
    exportPath: manifest.exportPath,
    files,
  };
}

export class WorkspaceSnapshotStore {
  constructor(
    private readonly database: SnapshotDatabase,
    private readonly getDirectory: SnapshotDirectoryProvider,
  ) {}

  async readPersisted(): Promise<Uint8Array | null> {
    try {
      const root = await this.getDirectory();
      const handle = await root.getFileHandle(WORKSPACE_SNAPSHOT_FILE_NAME);
      const file = await handle.getFile();
      if (file.size === 0) return null;
      return new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async replacePersisted(encoded: Uint8Array): Promise<void> {
    // Decode first so malformed imports cannot overwrite a valid snapshot.
    decodeWorkspaceArchive(encoded);
    const root = await this.getDirectory();
    const handle = await root.getFileHandle(WORKSPACE_SNAPSHOT_FILE_NAME, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(encoded.slice());
    } finally {
      await writable.close();
    }
  }

  async restore(): Promise<{
    restored: boolean;
    size: number;
    exportPath?: string;
    files?: string[];
  }> {
    try {
      const root = await this.getDirectory();
      const handle = await root.getFileHandle(WORKSPACE_SNAPSHOT_FILE_NAME);
      const file = await handle.getFile();
      if (file.size === 0) {
        return { restored: false, size: 0 };
      }

      const encoded = new Uint8Array(await file.arrayBuffer());
      const archive = decodeWorkspaceArchive(encoded);
      for (const entry of archive.files) {
        await this.database.registerFileBuffer(entry.path, entry.bytes);
      }
      return {
        restored: true,
        size: file.size,
        exportPath: archive.exportPath,
        files: archive.files.map(entry => entry.path),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { restored: false, size: 0 };
      }
      throw error;
    }
  }

  async persist(exportPath: string): Promise<{ size: number; files: string[] }> {
    assertSafeExportPath(exportPath);
    const registeredFiles = await this.database.globFiles(`${exportPath}/**`);
    const fileNames = registeredFiles
      .map(file => file.fileName)
      .filter(fileName => fileName.startsWith(`${exportPath}/`))
      .sort((left, right) => left.localeCompare(right));
    if (fileNames.length === 0) {
      throw new Error(`DuckDB export produced no files in ${exportPath}`);
    }

    const files = [];
    for (const fileName of fileNames) {
      files.push({
        path: fileName,
        bytes: await this.database.copyFileToBuffer(fileName),
      });
    }
    const encoded = encodeWorkspaceArchive({ exportPath, files });

    const root = await this.getDirectory();
    const handle = await root.getFileHandle(WORKSPACE_SNAPSHOT_FILE_NAME, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(encoded);
    } finally {
      await writable.close();
    }
    return { size: encoded.byteLength, files: fileNames };
  }
}
