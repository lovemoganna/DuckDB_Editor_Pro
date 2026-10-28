async (page) => {
  return await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(url => /\/services\/duckdbService\.ts(?:\?t=\d+)?$/.test(url));
    if (!moduleUrl) throw new Error('Running application service module not found');
    const { duckDBService } = await import(moduleUrl);
    await duckDBService.init();
    const context = await duckDBService.getCurrentCatalogAndSchema();
    const catalogs = await duckDBService.listDatabases();
    const runtime = duckDBService.getRuntimeInfo();
    if (!runtime.persistent) throw new Error(`Persistent workspace unavailable: ${runtime.persistenceError}`);
    const target = catalogs.find(row => row.name === 'duckdb_manager_workspace')?.name;
    if (!target) throw new Error('Persistent workspace not mounted');
    const quoted = '"' + target.replaceAll('"', '""') + '"';
    const table = `${quoted}.main.__write_regression_1009`;
    await duckDBService.query(`CREATE TABLE ${table}(value INTEGER)`);
    try {
      await duckDBService.query(`INSERT INTO ${table} VALUES (42)`);
      const rows = await duckDBService.query(`SELECT value FROM ${table}`);
      if (Number(rows[0]?.value) !== 42) throw new Error('Workspace write not readable');
      return { context, catalogs, rows };
    } finally { await duckDBService.query(`DROP TABLE ${table}`); }
  });
}
