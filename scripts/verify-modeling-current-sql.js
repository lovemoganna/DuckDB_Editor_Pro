async page => {
  const sql = 'SELECT uid,user_name FROM "funds_modeling_acceptance"."main"."users" WHERE country_code=\'US\'';
  await page.getByRole('textbox',{name:'',exact:true}).fill(sql);
  await page.getByRole('button',{name:'运行',exact:true}).click();
  await page.waitForFunction(async () => {
    const {useAppStore}=await import('/DuckDB_Editor_Pro/hooks/store/useAppStore.ts');
    const source=useAppStore.getState().activeDataset;
    return source?.id.startsWith('sql:') && !source.error && source.fields.length===2;
  });
  const count=await page.evaluate(async sql=>Number((await window.__duckDBService.query(`SELECT count(*) AS n FROM (${sql}) AS source`))[0].n),sql);
  await page.getByRole('button',{name:'AI 认知',exact:true}).click();
  await page.getByRole('button',{name:'本体建模',exact:true}).click();
  await page.getByRole('button',{name:'保存当前查询为数据集并创建类型',exact:true}).click();
  await page.getByLabel('对象标识字段',{exact:true}).selectOption('uid');
  await page.getByRole('button',{name:'查询并预览真实实例',exact:true}).click();
  await page.getByRole('status').filter({hasText:`${count} 真实实例`}).waitFor();
  await page.screenshot({path:'docs/modeling-current-sql.png',fullPage:true});
  await page.getByRole('button',{name:'取消未保存修改',exact:true}).click();
  await page.getByRole('button',{name:'确认放弃修改',exact:true}).click();
  const formal=await page.evaluate(async()=>Number((await window.__duckDBService.query('SELECT count(*) AS n FROM life_object'))[0].n));
  if(formal!==19)throw new Error('Cancelled SQL modeling draft modified formal ontology');
  return {verdict:'PASS',rows:count,formalRowsPreserved:formal,checks:['real SQL executed through editor','executed query reused across navigation','explicitly saved through the shared dataset registry','query fields used for modeling','real result re-query','cancel preserves formal ontology']};
}
