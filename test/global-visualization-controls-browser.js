async (page) => {
  await page.reload();
  const evidence=[];
  const stable=async()=>page.waitForFunction(()=>{
    const canvases=[...document.querySelectorAll('section canvas')];
    if(!canvases.length)return true;
    const pixels=canvases.map(canvas=>canvas.toDataURL()).join('');
    const previous=window.__governancePaint;
    window.__governancePaint={pixels,frames:previous?.pixels===pixels?previous.frames+1:0};
    return window.__governancePaint.frames>=8;
  },undefined,{timeout:10000,polling:'raf'});
  const wait=async()=>{
    await page.getByRole('status').filter({hasText:'真实查询完成'}).waitFor({timeout:20000});
    return JSON.parse(await page.getByTestId('engine').textContent());
  };
  await wait();
  await page.getByLabel('类型',{exact:true}).selectOption('histogram');
  await wait();
  await page.getByRole('button',{name:'字段配置',exact:true}).click();
  await page.getByLabel('分箱宽度',{exact:true}).fill('10000');
  await page.getByLabel('直方图纵轴指标',{exact:true}).selectOption('percent');
  await page.getByRole('button',{name:'应用',exact:true}).click();
  let engine=await wait();
  const bins=engine.spec.histogramBins;
  if(engine.spec.histogramValueMode!=='percent'||bins.reduce((sum,bin)=>sum+bin.count,0)!==engine.rows.length)throw new Error('Histogram config mismatch');
  for(const [index,bin] of bins.entries()){
    const count=engine.rows.filter(row=>Number(row.amount)>=bin.from&&(Number(row.amount)<bin.to||index===bins.length-1&&Number(row.amount)<=bin.to)).length;
    if(count!==bin.count||Math.abs(bin.percent-count/engine.rows.length*100)>1e-8)throw new Error('Histogram independent count mismatch');
  }
  await stable();await page.screenshot({path:'output/playwright/global-governance/histogram-config-1009.png'});
  evidence.push({case:'histogram width and percentage configuration',query:engine.query,rows:engine.rows,spec:engine.spec});

  await page.getByLabel('类型',{exact:true}).selectOption('waterfall');await wait();
  await page.getByRole('button',{name:'字段配置',exact:true}).click();
  await page.getByLabel('节点角色字段',{exact:true}).selectOption('node_role');
  await page.getByRole('button',{name:'应用',exact:true}).click();engine=await wait();
  if(engine.spec.emptyState!=='ok'||engine.spec.waterfall.roles[0]!=='start')throw new Error('Waterfall role mismatch');
  let cumulative=0;
  engine.rows.forEach((row,index)=>{
    const value=Number(row.amount); cumulative=row.node_role==='change'?cumulative+value:value;
    const wf=engine.spec.waterfall;
    const actual=wf.kinds[index]==='decrease'?wf.bases[index]:wf.bases[index]+wf.deltas[index];
    if(Math.abs(actual-cumulative)>1e-8)throw new Error('Waterfall cumulative mismatch');
  });
  await stable();await page.screenshot({path:'output/playwright/global-governance/waterfall-role-1009.png'});
  evidence.push({case:'waterfall explicit role configuration',query:engine.query,rows:engine.rows,spec:engine.spec});

  await page.getByLabel('类型',{exact:true}).selectOption('kpi');await wait();
  await page.getByRole('button',{name:'字段配置',exact:true}).click();
  await page.getByLabel('指标目标值',{exact:true}).fill('104000');
  await page.getByRole('button',{name:'应用',exact:true}).click();engine=await wait();
  if(engine.spec.kpiCompare[0].value!==270)throw new Error('KPI target mismatch');
  await page.getByText('较目标 (104,000 USD): 270 USD',{exact:true}).waitFor();
  await stable();await page.screenshot({path:'output/playwright/global-governance/kpi-target-1009.png'});
  evidence.push({case:'KPI real value against configured target',query:engine.query,rows:engine.rows,spec:engine.spec});

  await page.getByLabel('类型',{exact:true}).selectOption('scatter');engine=await wait();
  await page.getByRole('button',{name:'框选联动',exact:true}).click();
  await stable();
  const canvas=await page.getByRole('region',{name:'验收图表'}).locator('canvas').boundingBox();
  if(!canvas)throw new Error('Missing scatter canvas');
  await page.mouse.move(canvas.x+2,canvas.y+2);await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width-2,canvas.y+canvas.height-2,{steps:12});await page.mouse.up();
  const status=await page.getByRole('status').textContent();
  const records=engine.rows.map(row=>String(row.record));
  if(!status.includes('record IN (')||records.some(record=>!status.includes(record)))throw new Error('Native scatter selection mismatch');
  await page.screenshot({path:'output/playwright/global-governance/scatter-native-selection-1009.png'});
  evidence.push({case:'native scatter pointer drag',status,records});
  return {checks:evidence.length,evidence};
}
