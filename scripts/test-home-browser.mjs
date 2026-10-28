import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base=process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:5188/DuckDB_Editor_Pro/';
const output=path.resolve(process.env.DASHBOARD_OUTPUT || 'output/playwright/home-governance');
const catalog='home_governance';
let server,browser,context,page;
const checks=[],errors=[];
const check=name=>{checks.push(name);console.log(`PASS ${name}`);};
await mkdir(output,{recursive:true});
try {
  if(!process.env.DASHBOARD_BASE_URL) {
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{
      windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,VITE_ACCEPTANCE_CACHE_DIR:path.resolve('node_modules/.vite-home-acceptance')}
    });
    let log='';server.stdout.on('data',chunk=>{log+=chunk;});server.stderr.on('data',chunk=>{log+=chunk;});
    const deadline=Date.now()+60000;
    while(true){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(base)).ok)break;}catch{}
      if(Date.now()>deadline)throw new Error(`Server startup timeout: ${log}`);await new Promise(resolve=>setTimeout(resolve,250));}
  }
  browser=await chromium.launch({headless:true,...(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname)?{args:['--no-proxy-server']}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.tracing.start({screenshots:true,snapshots:true});
  page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  // Real application entry, without replacing any service, engine or renderer.
  await page.goto(base,{waitUntil:'commit',timeout:60000});
  await page.getByRole('banner',{name:'全局工作区顶栏'}).waitFor({timeout:120000});
  const prefix=new URL(base).pathname;
  await page.evaluate(async({prefix,catalog})=>{
    const {duckDBService:engine}=await import(`${prefix}services/duckdbService.ts`);
    const {dbService:db}=await import(`${prefix}services/dbService.ts`);
    const response=await fetch(`${prefix}data/crud-lab/baseline.duckdb`);
    const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!=='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887')throw new Error('Baseline changed');
    await engine.registerFileBuffer('home-governance.duckdb',new Uint8Array(bytes));
    await engine.query(`ATTACH 'home-governance.duckdb' AS ${catalog} (READ_ONLY)`);
    const table=`${catalog}.main.fiat_transactions`,now=Date.now();
    const queries=[
      {id:'home-real-kpi',name:'真实记录数',sql:`SELECT COUNT(*) records FROM ${table}`,widgetType:'value',charts:[{id:'count',title:'真实记录数',type:'counter',xKey:'',yKeys:['records']}]},
      {id:'home-real-chart',name:'渠道金额 · 长标题与中文标签稳定性检查',sql:`SELECT channel,SUM(amount) amount FROM ${table} GROUP BY channel ORDER BY channel`,widgetType:'chart',charts:[{id:'channel',title:'渠道金额',type:'bar',xKey:'channel',yKeys:['amount'],showLegend:true}]},
      {id:'home-real-table',name:'真实订单',sql:`SELECT fiat_order_id,channel,amount FROM ${table} ORDER BY fiat_order_id`,widgetType:'table'},
      {id:'home-real-empty',name:'空结果',sql:`SELECT * FROM ${table} WHERE FALSE`,widgetType:'table'},
      {id:'home-real-error',name:'失败查询',sql:`SELECT missing_column_for_acceptance FROM ${table}`,widgetType:'table'},
    ];
    for(const query of queries)await db.saveQuery({...query,databaseName:catalog,createdAt:now});
    for(const count of [1,12,36])await db.saveDashboard({id:`home-real-${count}`,name:`真实 ${count} 组件`,databaseName:catalog,createdAt:now,updatedAt:now,formatVersion:2,layoutLocked:true,
      context:{filters:[],refreshSeconds:0},items:Array.from({length:count},(_,index)=>({i:`real-${index}`,savedQueryId:queries[index%3].id,x:(index%3)*4,y:Math.floor(index/3)*6,w:4,h:6}))});
    await db.saveDashboard({id:'home-real-states',name:'空与错误状态',databaseName:catalog,createdAt:now,updatedAt:now,formatVersion:2,layoutLocked:true,
      items:[{i:'empty',savedQueryId:'home-real-empty',x:0,y:0,w:6,h:6},{i:'error',savedQueryId:'home-real-error',x:6,y:0,w:6,h:6}]});
    await db.saveDashboard({id:'home-real-repair',name:'旧布局恢复验收',databaseName:catalog,createdAt:now,updatedAt:now,formatVersion:2,layoutLocked:true,
      items:[{i:'repair-a',savedQueryId:'home-real-kpi',x:0,y:0,w:6,h:6},{i:'repair-b',savedQueryId:'home-real-chart',x:0,y:0,w:6,h:6}]});
    await db.saveDomainSetting('active-home-view','home-real-1',catalog);
    window.dispatchEvent(new CustomEvent('duckdb-database-changed'));
    window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
  },{prefix,catalog});
  const selectDatabase=async name=>{
    await page.getByRole('button',{name:/^(内存库|持久库) ·/}).first().click();
    await page.getByRole('option').filter({hasText:name}).first().click();
  };
  await selectDatabase(catalog);
  const cards=page.locator('[data-widget-id]');
  const loaded=async count=>{
    await page.waitForFunction(count=>document.querySelectorAll('[data-widget-id] [data-result-at]').length===count &&
      ![...document.querySelectorAll('[data-widget-id] [role="status"]')].some(e=>e.textContent.includes('正在刷新')),count,{timeout:120000});
    assert.equal(await cards.count(),count);
  };
  await loaded(1);
  assert.ok((await page.locator('[data-build-id]').first().getAttribute('data-build-id'))?.includes('-'));
  check('formal home loads readonly real baseline and exposes build identity');
  const geometry=async()=>{
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const rectangles=await cards.evaluateAll(es=>es.map(e=>({id:e.getAttribute('data-widget-id'),...e.getBoundingClientRect().toJSON()})));
    const viewport=page.viewportSize();
    for(const r of rectangles)assert.ok(r.width>0&&r.height>0&&r.x>=0&&r.right<=viewport.width+1,`outside viewport ${r.id}`);
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
      const a=rectangles[i],b=rectangles[j];assert.ok(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1,`overlap ${a.id}/${b.id}`);
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const canvases=await cards.locator('canvas').evaluateAll(es=>es.map(c=>{
      const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let painted=0;for(let i=3;i<pixels.length;i+=64)if(pixels[i])painted++;
      return {width:c.width,height:c.height,painted};
    }));
    assert.ok(canvases.every(c=>c.width>0&&c.height>0&&c.painted>100),'undrawable canvas');
  };
  const selectView=async(count)=>{await page.getByRole('combobox',{name:'工作台视图'}).selectOption(`home-real-${count}`);await loaded(count);};
  for(const count of [1,12,36]) {
    await selectView(count);
    const saved=await page.evaluate(async({prefix,catalog,count})=>{
      const {dbService}=await import(`${prefix}services/dbService.ts`);return (await dbService.getDashboards(catalog)).find(b=>b.id===`home-real-${count}`).items;
    },{prefix,catalog,count});
    for(const theme of ['dark','light']) {
      const toggle=page.getByRole('button',{name:theme==='light'?'切换为浅色模式':'切换为深色模式',exact:true});
      if(await toggle.count())await toggle.click();
      for(const width of [1440,1280,1024,768,390]) {
        await page.setViewportSize({width,height:1000});await geometry();
        await page.screenshot({path:path.join(output,`home-${count}-${theme}-${width}.png`)});
      }
    }
    const after=await page.evaluate(async({prefix,catalog,count})=>{
      const {dbService}=await import(`${prefix}services/dbService.ts`);return (await dbService.getDashboards(catalog)).find(b=>b.id===`home-real-${count}`).items;
    },{prefix,catalog,count});
    assert.deepEqual(after,saved);
    check(`${count} real widgets: both themes, five widths, painted charts, no overlap/overflow, saved layout unchanged`);
  }
  await page.setViewportSize({width:1440,height:1000});await selectView(12);
  await page.getByRole('button',{name:/AI 助手/}).first().click();
  await page.getByRole('complementary',{name:'AI Copilot 侧边栏'}).waitFor();await geometry();
  await page.getByRole('button',{name:'收起侧边栏',exact:true}).click();await geometry();
  await page.getByRole('button',{name:'新建查询',exact:true}).click();
  await page.getByRole('tab',{name:/仪表盘/}).click();await loaded(12);
  check('sidebar collapse/expand and SQL navigation return preserve the formal home');
  await page.locator('[data-widget-id="real-1"]').getByRole('button',{name:/更多组件选项/}).click();
  await page.getByRole('button',{name:'全屏查看',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.setViewportSize({width:390,height:1000});assert.ok(await page.getByRole('dialog').locator('canvas').evaluate(c=>c.width>0&&c.height>0));
  await page.getByRole('button',{name:'关闭全屏透视',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'编辑布局',exact:true}).click();
  const handle=page.locator('[data-widget-id="real-0"] .react-resizable-handle-se');await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+70,{steps:10});await page.mouse.up();
  await page.waitForFunction(async({prefix,catalog})=>{
    const {dbService}=await import(`${prefix}services/dbService.ts`);
    return (await dbService.getDashboards(catalog)).find(b=>b.id==='home-real-12').items.find(i=>i.i==='real-0').h>6;
  },{prefix,catalog},{timeout:60000});
  await page.getByRole('button',{name:'完成编辑',exact:true}).click();await page.getByRole('button',{name:'编辑布局',exact:true}).waitFor();
  const savedEdit=await page.evaluate(async({prefix,catalog})=>{
    const {dbService}=await import(`${prefix}services/dbService.ts`);return (await dbService.getDashboards(catalog)).find(b=>b.id==='home-real-12').items;
  },{prefix,catalog});
  await page.reload({waitUntil:'commit',timeout:60000});
  await page.getByRole('banner',{name:'全局工作区顶栏'}).waitFor({timeout:120000});
  // This is a buffered readonly source, intentionally not imported into OPFS.
  // Reattach the same bytes after reload; never recreate queries or board configuration.
  await page.evaluate(async({prefix,catalog})=>{
    const {duckDBService:engine}=await import(`${prefix}services/duckdbService.ts`);
    const bytes=await (await fetch(`${prefix}data/crud-lab/baseline.duckdb`)).arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!=='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887')throw new Error('Baseline changed');
    await engine.registerFileBuffer('home-governance.duckdb',new Uint8Array(bytes));
    await engine.query(`ATTACH 'home-governance.duckdb' AS ${catalog} (READ_ONLY)`);
    window.dispatchEvent(new CustomEvent('duckdb-database-changed'));
    window.dispatchEvent(new CustomEvent('duckdb-schema-changed'));
  },{prefix,catalog});
  await selectDatabase(catalog);await loaded(12);await geometry();
  assert.deepEqual(await page.evaluate(async({prefix,catalog})=>{
    const {dbService}=await import(`${prefix}services/dbService.ts`);return (await dbService.getDashboards(catalog)).find(b=>b.id==='home-real-12').items;
  },{prefix,catalog}),savedEdit);
  check('formal fullscreen, resize, save, lock and reload/reattach preserve saved geometry');
  await selectDatabase('memory');await cards.first().waitFor({state:'detached',timeout:60000});
  await selectDatabase(catalog);await loaded(12);
  check('database switch removes prior widgets and restores the selected persisted view');
  await page.getByRole('combobox',{name:'工作台视图'}).selectOption('home-real-repair');await loaded(2);await geometry();
  await page.getByRole('button',{name:'视图设置',exact:true}).click();
  await page.getByRole('button',{name:'恢复整理前配置',exact:true}).click();
  await page.getByTestId('readable-board').waitFor();await loaded(2);await geometry();
  assert.deepEqual(await page.evaluate(async({prefix,catalog})=>{
    const {dbService}=await import(`${prefix}services/dbService.ts`);return (await dbService.getDashboards(catalog)).find(b=>b.id==='home-real-repair').items.map(i=>i.y);
  },{prefix,catalog}),[0,0]);
  check('overlapping legacy view auto-repairs and restores through the formal UI without overlap');
  assert.deepEqual(errors,[]);
  await page.getByRole('combobox',{name:'工作台视图'}).selectOption('home-real-states');
  await page.waitForFunction(()=>document.querySelector('[data-widget-id="empty"] [data-result-total]')?.getAttribute('data-result-total')==='0',{},{timeout:60000});
  await page.getByRole('button',{name:'重试',exact:true}).waitFor();
  assert.equal(await cards.count(),2);await geometry();
  check('real empty result and SQL error remain confined to their cards');
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,checks,errors},null,2));
} catch(error) {
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  await writeFile(path.join(output,'failure.txt'),await page?.locator('body').innerText().catch(()=>'') || '');
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:false,checks,errors,error:String(error.stack||error)},null,2));
  console.error(error);process.exitCode=1;
} finally {await context?.tracing.stop({path:path.join(output,'trace.zip')}).catch(()=>{});await browser?.close();server?.kill();}
