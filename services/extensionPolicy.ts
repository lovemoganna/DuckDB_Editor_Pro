const SUPPORTED_EXTENSIONS = new Set([
  'fts',
  'httpfs',
  'icu',
  'json',
  'parquet',
  'spatial',
  'sqlite',
  'tpch',
  'vss',
]);

export function shouldLoadExtensionAtStartup(_name: string): boolean {
  return false;
}

export function buildExtensionLoadSql(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(normalized)) {
    throw new Error(`Unsupported extension: ${name}`);
  }
  return `INSTALL '${normalized}'; LOAD '${normalized}';`;
}
