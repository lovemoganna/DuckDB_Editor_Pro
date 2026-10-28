async (page) => {
  await page.evaluate(async()=>{
    const {defaultPivot,pivotToSpec,pivotDetailSql,validatePivotSource}=await import('/DuckDB_Editor_Pro/services/analysis/pivotExperience.ts');
    const {runAnalysis}=await import('/DuckDB_Editor_Pro/services/analysis/pipeline.ts');
    const {duckDBService}=await import('/DuckDB_Editor_Pro/services/duckdbService.ts');
    const sql="SELECT * FROM (VALUES ('N', DATE '2026-01-01',10,'c1'), ('N',DATE '2026-01-10',30,'c1'), ('N',DATE '2026-02-01',100,'c2'), ('S',DATE '2026-01-01',20,'c1'), (NULL,NULL,40,'c3'), ('—',DATE '2026-01-01',50,'c4')) v(region,created,amount,customer)";
    const scope=await duckDBService.getCurrentCatalogAndSchema();
    const source=await validatePivotSource({id:'qa:readonly-values',name:'Read-only aggregate verification',catalog:scope.catalog,schema:scope.schema,sql,fields:[],kind:'query',version:1});
    const definition={...defaultPivot(source),row:{column:'region'},column:{column:'created',dateTrunc:'month'},limit:0,
      metrics:[{column:'amount',agg:'avg',alias:'Average'},{column:'customer',agg:'count_distinct',alias:'Customers'}],sortMetric:'Average'};
    const result=await runAnalysis(pivotToSpec(definition));
    const first=result.rows[0];
    if(Math.abs(Number(first.__pivot_all_Average)-250/6)>1e-8)throw new Error('Grand average is not source-weighted');
    if(Number(first.__pivot_all_Customers)!==4)throw new Error('Distinct customer count was summed across cells');
    const north=result.rows.find(r=>r.region==='N');
    if(Math.abs(Number(north.__pivot_row_Average)-140/3)>1e-8 || Number(north.__pivot_row_Customers)!==2)throw new Error('Row margins incorrect');
    if(result.chart.pivotTable.rowValues.length!==4)throw new Error('Null and literal dash dimensions collided');
    const nulls=await duckDBService.readQuery(pivotDetailSql(result.spec,null,null,0));
    if(nulls.length!==1 || Number(nulls[0].amount)!==40)throw new Error('Null row/column drill was not exact');
    const january=await duckDBService.readQuery(pivotDetailSql(result.spec,'N','2026-01-01',0));
    if(january.length!==2)throw new Error('Month drill missed rows or included a different month');
    const limited=await runAnalysis(pivotToSpec({...definition,limit:2}));
    if(limited.rows.length!==2 || Math.abs(Number(limited.rows[0].__pivot_all_Average)-250/6)>1e-8)throw new Error('Top N corrupted source totals');
    let rejected=false;
    try{await runAnalysis(pivotToSpec({...definition,source:{...source,schema:'not_current'}}));}catch{rejected=true;}
    if(!rejected)throw new Error('Cross-schema pivot was silently executed');
  });
}
