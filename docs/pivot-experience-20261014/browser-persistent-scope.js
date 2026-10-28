async (page) => {
  // QA-only setup using the application's normal catalog-switch API, in an isolated browser profile.
  await page.evaluate(async()=>{
    const {duckDBService}=await import('/DuckDB_Editor_Pro/services/duckdbService.ts');
    const {useAppStore}=await import('/DuckDB_Editor_Pro/hooks/store/useAppStore.ts');
    const scope=await duckDBService.switchAnalysisContext({kind:'database',id:'duckdb_manager_workspace'});
    useAppStore.getState().setCurrentDatabase(scope.catalog);
    useAppStore.getState().setTables(await duckDBService.getTables());
  });
}
