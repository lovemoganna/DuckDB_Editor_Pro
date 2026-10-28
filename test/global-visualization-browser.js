async (page) => {
  // Build resource copies do not guarantee a hot reload of every imported module.
  // Start each acceptance run with a fresh page and DuckDB attachment.
  await page.reload();
  const output='output/playwright/global-governance';
  const evidence=[];
  const types=['bar','line','area','doughnut','pie','scatter','table','kpi','counter','funnel','waterfall','histogram','combo','pivot'];
  const wait=async()=>{
    await page.getByRole('status').filter({hasText:'真实查询完成'}).waitFor({timeout:20000});
    return JSON.parse(await page.getByTestId('engine').textContent());
  };
  await wait();
  for(const type of types){
    await page.getByLabel('类型',{exact:true}).selectOption(type);
    const engine=await wait();
    if(engine.spec.emptyState!=='ok')throw new Error(`${type}: ${engine.spec.emptyState} ${engine.spec.emptyMessage}`);
    if(['kpi','counter'].includes(type)&&Number(engine.rows[0].amount)!==104270)throw new Error('KPI business mismatch');
    for(const [width,height] of [[760,440],[560,360],[280,240]]){
      await page.getByLabel('宽度',{exact:true}).fill(String(width));
      await page.getByLabel('高度',{exact:true}).fill(String(height));
      // Wait for two paint frames; screenshots during ResizeObserver updates
      // cannot establish a stable layout verdict.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      if(type==='pie'||type==='doughnut')await page.waitForFunction(()=>{
        const canvas=document.querySelector('section canvas');
        const plot=document.querySelector('[aria-label="图表绘图区"]');
        return !!canvas&&!!plot&&canvas.clientWidth<=plot.clientWidth&&canvas.clientHeight<=Math.max(160,plot.clientHeight);
      },undefined,{timeout:5000});
      const geometry=await page.getByRole('region',{name:'验收图表'}).evaluate(element=>({width:element.clientWidth,height:element.clientHeight,
        canvas:[...element.querySelectorAll('canvas')].map(canvas=>({width:canvas.width,height:canvas.height,displayWidth:canvas.clientWidth,displayHeight:canvas.clientHeight})),text:element.textContent}));
      if(geometry.canvas.some(canvas=>canvas.width<=0||canvas.height<=0))throw new Error(`${type}: zero canvas`);
      await page.screenshot({path:`${output}/${type}-${width}.png`});
      evidence.push({type,width,height,status:'rendered',geometry,query:engine.query,rows:engine.rows,spec:engine.spec});
    }
  }
  await page.getByLabel('类型',{exact:true}).selectOption('bar');await wait();
  await page.getByLabel('宽度',{exact:true}).fill('760');
  await page.getByLabel('高度',{exact:true}).fill('440');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:`${output}/bar-click-before.png`});
  // The wire_transfer rectangle was located in the rendered 760x440 screenshot.
  // This verifies the renderer's public event; the dropdown below independently
  // verifies real SQL filtering. It does not establish production-page linkage.
  await page.mouse.click(590,290);
  await page.getByRole('status').filter({hasText:'channel=wire_transfer'}).waitFor();
  evidence.push({case:'native bar click callback',status:await page.getByRole('status').textContent()});
  await page.getByLabel('渠道',{exact:true}).selectOption('wire_transfer');
  let engine=await wait();
  if(engine.rows.reduce((n,row)=>n+Number(row.amount),0)!==102000)throw new Error('Filter mismatch');
  evidence.push({case:'channel filter',query:engine.query,rows:engine.rows});
  await page.getByLabel('渠道',{exact:true}).selectOption('');engine=await wait();
  if(engine.rows.reduce((n,row)=>n+Number(row.amount),0)!==104270)throw new Error('Clear filter mismatch');
  evidence.push({case:'clear filter',query:engine.query,rows:engine.rows});
  await page.getByLabel('模式',{exact:true}).selectOption('percent');engine=await wait();
  if(engine.spec.formatByKey.amount.unit!=='%')throw new Error('Percent format mismatch');
  await page.screenshot({path:`output/playwright/global-governance/percent.png`});
  evidence.push({case:'percent',spec:engine.spec});
  await page.getByRole('button',{name:'全屏',exact:true}).click();
  await page.getByRole('dialog',{name:'全屏验收'}).waitFor();
  await page.screenshot({path:`output/playwright/global-governance/fullscreen.png`});
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  evidence.push({case:'fullscreen mount and exit',status:'executed'});
  await page.getByLabel('模式',{exact:true}).selectOption('empty');engine=await wait();
  if(engine.rows.length!==0||engine.spec.emptyState!=='empty')throw new Error('Empty state mismatch');
  evidence.push({case:'empty',spec:engine.spec});
  await page.getByLabel('模式',{exact:true}).selectOption('failure');
  await page.getByRole('status').filter({hasText:'查询失败'}).waitFor();
  engine=JSON.parse(await page.getByTestId('engine').textContent());
  if(engine.rows.length!==0)throw new Error('Failure retained rows');
  evidence.push({case:'failure',status:await page.getByRole('status').textContent(),rows:engine.rows});
  await page.getByLabel('模式',{exact:true}).selectOption('normal');await wait();
  await page.evaluate(result=>console.info('[VISUAL_GOVERNANCE_EVIDENCE]'+JSON.stringify(result)),{typeCount:types.length,renderChecks:types.length*3,evidence});
  return {typeCount:types.length,renderChecks:types.length*3,evidence};
}
