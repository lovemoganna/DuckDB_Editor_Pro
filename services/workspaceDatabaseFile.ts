export const WORKSPACE_DATABASE_FILE_NAME = 'duckdb_manager_workspace.duckdb';

interface WorkspaceFile {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface WorkspaceWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

interface WorkspaceFileHandle {
  getFile(): Promise<WorkspaceFile>;
  createWritable(): Promise<WorkspaceWritable>;
}

interface WorkspaceDirectory {
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<WorkspaceFileHandle>;
}

type WorkspaceDirectoryProvider = () => Promise<WorkspaceDirectory>;

export function validateDuckDBDatabaseFile(bytes: Uint8Array): void {
  const hasDuckMagic = bytes.byteLength >= 20
    && bytes[8] === 68
    && bytes[9] === 85
    && bytes[10] === 67
    && bytes[11] === 75;
  if (!hasDuckMagic) {
    throw new Error('Workspace backup is not a DuckDB database file');
  }
}

export class WorkspaceDatabaseFile {
  constructor(private readonly getDirectory: WorkspaceDirectoryProvider) {}

  async read(): Promise<Uint8Array> {
    const root = await this.getDirectory();
    const handle = await root.getFileHandle(WORKSPACE_DATABASE_FILE_NAME);
    const file = await handle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateDuckDBDatabaseFile(bytes);
    return bytes;
  }

  async replace(bytes: Uint8Array): Promise<void> {
    validateDuckDBDatabaseFile(bytes);
    const root = await this.getDirectory();
    const handle = await root.getFileHandle(
      WORKSPACE_DATABASE_FILE_NAME,
      { create: true },
    );
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes.slice());
      await writable.close();
    } catch (error) {
      try {
        await writable.abort?.(error);
      } catch {
        // Preserve the original replacement failure.
      }
      throw error;
    }
  }
}
