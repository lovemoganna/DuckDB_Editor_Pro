async (page) => {
  const access = async operation => page.evaluate(async operation => {
    const moduleUrl = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(url => /\/services\/duckdbService\.ts(?:\?t=\d+)?$/.test(url));
    const { duckDBService: service } = await import(moduleUrl);
    await service.init();
    if (!service.getRuntimeInfo().persistent) throw new Error('Workspace fell back to memory');
    const table = 'duckdb_manager_workspace.main.__persist_regression_1009';
    if (operation === 'write') {
      await service.query(`CREATE TABLE IF NOT EXISTS ${table}(value INTEGER)`);
      await service.query(`DELETE FROM ${table}`);
      await service.query(`INSERT INTO ${table} VALUES (104270)`);
    } else {
      const rows = await service.query(`SELECT * FROM ${table}`);
      if (Number(rows[0]?.value) !== 104270) throw new Error('Persisted data lost across reload');
      await service.query(`DROP TABLE ${table}`);
      return rows;
    }
  }, operation);
  await access('write');
  await page.reload();
  await page.getByRole('tab', {name:'SQL',exact:true}).waitFor({timeout:30000});
  return {retained:await access('read')};
}
