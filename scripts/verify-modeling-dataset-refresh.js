async page => {
  const changed = await page.evaluate(async () => {
    const db=window.__duckDBService;
    const source=(await db.query("SELECT fiat_order_id,amount FROM fiat_transactions WHERE status='completed' AND currency='USD' ORDER BY fiat_order_id LIMIT 1"))[0];
    const literal=db.escapeLiteral(`已完成USD交易:${source.fiat_order_id}`);
    const before=JSON.parse((await db.query(`SELECT properties FROM life_object WHERE name=${literal}`))[0].properties);
    await db.query(`UPDATE fiat_transactions SET amount=amount+1 WHERE fiat_order_id=${db.escapeLiteral(source.fiat_order_id)}`);
    const unchanged=JSON.parse((await db.query(`SELECT properties FROM life_object WHERE name=${literal}`))[0].properties);
    if(Number(before.amount)!==Number(unchanged.amount))throw new Error('Source update silently overwrote the formal ontology');
    return {name:`已完成USD交易:${source.fiat_order_id}`,before:Number(before.amount)};
  });
  await page.getByRole('button',{name:'本体建模',exact:true}).click();
  await page.getByRole('button',{name:'编辑已保存本体',exact:true}).click();
  await page.getByRole('button',{name:/^数据映射/}).click();
  await page.getByRole('button',{name:'查询并预览真实实例',exact:true}).click();
  await page.getByRole('button',{name:'查询并预览真实实例',exact:true}).waitFor();
  await page.getByRole('status').filter({hasText:'19 真实实例'}).waitFor();
  await page.getByTestId('enter-commit-step-btn').click();
  await page.getByRole('button',{name:'确认写入本体图谱',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'返回本体图谱',exact:true}).waitFor({state:'hidden'});
  const guards=await page.evaluate(async changed => {
    const db=window.__duckDBService, query=db.query.bind(db);
    const mapping={objectTypeTable:'life_object_type',objectTable:'life_object',linkTypeTable:'life_link_type',linkTable:'life_link',actionTable:'life_action'};
    const {loadModelingDraft,saveModelingDraft}=await import('/DuckDB_Editor_Pro/services/ontologyModelingPersistence.ts');
    const {queryModelingInstances}=await import('/DuckDB_Editor_Pro/services/ontologyModelingDraft.ts');
    const {saveQueryDataset}=await import('/DuckDB_Editor_Pro/services/workbench/datasets.ts');
    const loaded=await loadModelingDraft(query,mapping);
    const actual=Number(loaded.objects.find(o=>o.name===changed.name).properties.amount);
    if(actual!==changed.before+1 || loaded.objects.length!==19 || loaded.links.length!==9)throw new Error('Source refresh failed or duplicated instances');
    await db.useDatabase('memory');
    let scopeBlocked=false;
    try {await saveModelingDraft(db,mapping,loaded);}catch(e){scopeBlocked=String(e).includes('工作区已切换');if(!scopeBlocked)throw e;}
    if(!scopeBlocked || (await query("SELECT table_name FROM information_schema.tables WHERE table_catalog='memory' AND table_name='life_object'")).length)throw new Error('Draft leaked into another database');
    await db.useDatabase('funds_modeling_acceptance');
    const type=loaded.objectTypes.find(t=>t.mapping.dataset.id && t.name==='已完成USD交易');
    const ref=type.mapping.dataset;
    await saveQueryDataset(ref.owner,ref.name,ref.definitionSql+" AND channel='wire_transfer'",undefined,ref.id);
    let stalePreviewBlocked=false,staleSaveBlocked=false;
    try{await queryModelingInstances(loaded,query);}catch(e){stalePreviewBlocked=String(e).includes('重新选择数据集');}
    try{await saveModelingDraft(db,mapping,loaded);}catch(e){staleSaveBlocked=String(e).includes('重新选择数据集');}
    if(!stalePreviewBlocked || !staleSaveBlocked)throw new Error('Changed dataset definition reused silently');
    if(Number((await query('SELECT count(*) AS n FROM life_object'))[0].n)!==19)throw new Error('Rejected save changed formal rows');
    return {scopeBlocked,stalePreviewBlocked,staleSaveBlocked,refreshedAmount:actual};
  },changed);
  return {verdict:'PASS',...guards,checks:['real source value changed in isolated copy','formal data preserved until confirmation','preview re-executes source query','confirmed update preserves instance identity','database switch blocks writes to wrong scope','dataset definition revision blocks obsolete preview and save']};
}
