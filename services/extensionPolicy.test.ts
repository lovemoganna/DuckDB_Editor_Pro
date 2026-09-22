import { describe, expect, it } from 'vitest';
import { buildExtensionLoadSql, shouldLoadExtensionAtStartup } from './extensionPolicy';

describe('DuckDB extension policy', () => {
  it('keeps optional network extensions out of the startup path', () => {
    expect(shouldLoadExtensionAtStartup('httpfs')).toBe(false);
    expect(shouldLoadExtensionAtStartup('fts')).toBe(false);
  });

  it('allows known extensions and rejects SQL-shaped names', () => {
    expect(buildExtensionLoadSql('spatial')).toBe("INSTALL 'spatial'; LOAD 'spatial';");
    expect(() => buildExtensionLoadSql("httpfs'; DROP TABLE users; --")).toThrow(
      /unsupported extension/i,
    );
  });
});
