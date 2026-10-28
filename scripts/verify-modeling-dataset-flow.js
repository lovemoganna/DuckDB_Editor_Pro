async page => {
  if (await page.getByRole('button',{name:'关闭内容库',exact:true}).isVisible()) await page.getByRole('button',{name:'关闭内容库',exact:true}).click();
  if (await page.getByRole('button',{name:'关闭',exact:true}).isVisible()) await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'工程核心',exact:true}).click();
  await page.getByRole('tab',{name:'仪表盘',exact:true}).click();
  const catalog = 'funds_modeling_acceptance';
  const fiatId = `table:${JSON.stringify([catalog,'main','fiat_transactions'])}`;
  const usersId = `table:${JSON.stringify([catalog,'main','users'])}`;
  await page.getByLabel('浏览数据集').selectOption(fiatId);
  await page.getByRole('button',{name:'AI 认知',exact:true}).click();
  await page.getByRole('button',{name:'本体建模',exact:true}).click();
  await page.getByLabel('建模数据集').getByRole('option',{name:`${catalog}.main.fiat_transactions`,exact:true}).waitFor({state:'attached'});
  if (await page.getByLabel('建模数据集').inputValue() !== fiatId) throw new Error('Home dataset was not carried into modeling');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'工程核心',exact:true}).click();
  await page.getByRole('tab',{name:'仪表盘',exact:true}).click();
  if (!await page.getByLabel('浏览数据集').getByRole('option',{name:'已完成USD交易',exact:true}).count()) {
    await page.getByRole('button',{name:'添加分析',exact:true}).click();
    await page.getByRole('button',{name:'组合 / SQL 数据集',exact:true}).first().click();
    await page.getByLabel('数据集名称').fill('已完成USD交易');
    await page.getByLabel('数据集 SQL').fill(`SELECT * FROM "${catalog}"."main"."fiat_transactions" WHERE status='completed' AND currency='USD'`);
    await page.getByRole('button',{name:'验证并保存数据集',exact:true}).click();
    await page.getByRole('dialog',{name:'创建分析数据集',exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'关闭内容库',exact:true}).click();
  }
  await page.getByLabel('浏览数据集').selectOption({label:'已完成USD交易'});
  const datasetId = await page.getByLabel('浏览数据集').inputValue();
  await page.getByRole('button',{name:'AI 认知',exact:true}).click();
  await page.getByRole('button',{name:'本体建模',exact:true}).click();
  await page.getByLabel('建模数据集').getByRole('option',{name:'已完成USD交易',exact:true}).first().waitFor({state:'attached'});
  if (await page.getByLabel('建模数据集').inputValue() !== datasetId) throw new Error('Selected SQL dataset was lost across navigation');
  await page.getByRole('button',{name:'从当前数据集创建类型',exact:true}).click();
  await page.getByLabel('对象标识字段',{exact:true}).selectOption('fiat_order_id');
  await page.getByLabel('建模数据集').selectOption(usersId);
  await page.getByRole('button',{name:'从当前数据集创建类型',exact:true}).click();
  await page.getByLabel('对象标识字段',{exact:true}).selectOption('uid');
  await page.getByTestId('modeling-node-已完成USD交易').click({modifiers:['Shift']});
  await page.getByTestId('modeling-node-users').click({modifiers:['Shift']});
  await page.getByRole('button',{name:/^数据映射/}).click();
  await page.getByLabel(/来源连接字段$/).selectOption('uid');
  await page.getByLabel(/目标连接字段$/).selectOption('uid');
  await page.getByRole('button',{name:'查询并预览真实实例',exact:true}).click();
  await page.getByRole('status').filter({hasText:'19 真实实例'}).waitFor();
  await page.screenshot({path:'docs/modeling-current-dataset-flow.png',fullPage:true});
  await page.getByTestId('enter-commit-step-btn').click();
  await page.getByRole('button',{name:'确认写入本体图谱',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'返回本体图谱',exact:true}).waitFor({state:'hidden'});
  const saved = await page.evaluate(async ({catalog,datasetId}) => {
    const db = window.__duckDBService;
    const {loadModelingDraft} = await import('/DuckDB_Editor_Pro/services/ontologyModelingPersistence.ts');
    const {loadDynamicGraphData} = await import('/DuckDB_Editor_Pro/components/Library/D3GraphView/D3GraphView.data.ts');
    const mapping={objectTypeTable:'life_object_type',objectTable:'life_object',linkTypeTable:'life_link_type',linkTable:'life_link',actionTable:'life_action'};
    const draft=await loadModelingDraft(db.query.bind(db),mapping);
    const source=draft.objectTypes.find(t=>t.mapping?.dataset?.id===datasetId);
    const sourceRows=await db.query(`SELECT * FROM "${catalog}"."main"."fiat_transactions" WHERE status='completed' AND currency='USD' ORDER BY fiat_order_id`);
    const instances=draft.objects.filter(o=>o.objectType===source.name);
    if(instances.length!==sourceRows.length || instances.length!==9 || draft.objects.length!==19 || draft.links.length!==9)throw new Error('Source/instance/link counts diverged');
    for(const row of sourceRows) {
      const instance=instances.find(o=>o.provenance?.key===row.fiat_order_id);
      if(!instance || JSON.stringify(instance.properties)!==JSON.stringify(row))throw new Error('Mapped properties differ from actual source');
    }
    const graph=await loadDynamicGraphData(mapping);
    const projection={types:graph.nodes.filter(n=>n.group==='typeHub').length,instances:graph.nodes.filter(n=>n.group==='instance').length,schemaLinks:graph.links.filter(l=>l._isSchemaLink).length,instanceLinks:graph.links.filter(l=>l._linkTypeId&&!l._isSchemaLink).length};
    if(projection.instances!==19 || projection.instanceLinks!==9)throw new Error('Main graph not synchronized');
    return {sourceRows:sourceRows.length,instances:draft.objects.length,links:draft.links.length,datasetId,projection};
  },{catalog,datasetId});
  return {verdict:'PASS',...saved,checks:['Home physical dataset selection','SQL dataset created through existing UI','selected dataset shared across pages','field definitions from dataset metadata','real filtered query instances','dataset-to-dataset join','source values reconciled row by row','formal save','existing main graph projection']};
}
