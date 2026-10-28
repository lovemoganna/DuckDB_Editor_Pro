async (page) => {
  const cell=page.getByRole('button',{name:'查看明细 aggregate / BIGINT',exact:true});
  await cell.click();
  await page.getByRole('dialog',{name:'透视明细'}).waitFor();
  await page.getByRole('dialog').getByText('1–50 条',{exact:true}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'下一页',exact:true}).click();
  await page.getByRole('dialog').getByText('51–84 条',{exact:true}).waitFor();
  await page.screenshot({path:'docs/pivot-experience-20261014/details.png',fullPage:true});
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  if(!await cell.evaluate(element=>element===document.activeElement))throw new Error('Drawer did not return focus to its cell');
  await page.getByRole('button',{name:'交换行列',exact:true}).click();
  if(await page.getByLabel('行',{exact:true}).inputValue()!=='return_type')throw new Error('Row/column exchange lost its field');
  await page.getByRole('button',{name:'交换行列',exact:true}).click();
  await page.getByRole('button',{name:'添加值',exact:true}).click();
  await page.getByLabel('值 2 字段',{exact:true}).selectOption('parameter_count');
  await page.getByLabel('值 2 聚合方式',{exact:true}).selectOption('avg');
  await page.getByLabel('值 2 名称',{exact:true}).fill('平均参数数');
  await page.getByLabel('当前展示的值',{exact:true}).selectOption('1');
  await page.getByLabel('分析名称',{exact:true}).fill('DuckDB 函数目录 · 透视验证');
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存分析')?.disabled);
  await page.getByRole('button',{name:'保存并加入首页',exact:true}).click();
  await page.getByRole('button',{name:'另存为',exact:true}).waitFor({timeout:30000});
  await page.getByText('已保存',{exact:true}).waitFor();
  const records=await page.evaluate(async()=>{
    const {dbService}=await import('/DuckDB_Editor_Pro/services/dbService.ts');
    const {duckDBService}=await import('/DuckDB_Editor_Pro/services/duckdbService.ts');
    return dbService.getDomainSetting('linked-analyses',(await duckDBService.getCurrentCatalogAndSchema()).catalog);
  });
  const saved=records.find(r=>r.title==='DuckDB 函数目录 · 透视验证');
  if(!saved || saved.pivot.column.column!=='return_type' || saved.pivot.metrics[1].agg!=='avg')throw new Error('Complete editable definition not saved');
  await page.screenshot({path:'docs/pivot-experience-20261014/saved-editor.png',fullPage:true});
  await page.getByRole('button',{name:'仪表盘',exact:true}).click();
  await page.getByText('DuckDB 函数目录 · 透视验证',{exact:true}).first().waitFor({timeout:30000});
  await page.screenshot({path:'docs/pivot-experience-20261014/home-pivot.png',fullPage:true});
}
