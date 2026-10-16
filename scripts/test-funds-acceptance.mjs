import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base=process.env.FUNDS_BASE_URL || 'http://127.0.0.1:5191/DuckDB_Editor_Pro/';
const output=path.resolve(process.env.FUNDS_OUTPUT || '../audit-20261015/replay');
const oracleDirectory=path.resolve(process.env.FUNDS_ORACLE || '../audit-20261015');
const oracle=JSON.parse(await fs.readFile(path.join(oracleDirectory,'oracle.json'),'utf8'));
const source=JSON.parse(await fs.readFile(path.join(oracleDirectory,'source-rows.json'),'utf8'));
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.tracing.start({screenshots:true,snapshots:true});
const page=await context.newPage();page.setDefaultTimeout(15000);
const prefix=new URL(base).pathname,checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,detail)=>{checks.push({name,detail});console.log('PASS',name);};
const sql=statement=>page.evaluate(async({prefix,statement})=>{const {duckDBService}=await import(prefix+'services/duckdbService.ts');return duckDBService.readQuery(statement);},{prefix,statement});
const numberRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v!==null && /^-?\d+(\.\d+)?$/.test(String(v))?Number(v):v])));
const readyPivot=()=>page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='保存分析');return b&&!b.disabled;});
try {
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('banner',{name:'全局工作区顶栏'}).waitFor({timeout:90000});
  await page.getByRole('button',{name:'导入数据',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles(path.join(oracleDirectory,'four-tables.xlsx'));
  await page.getByRole('button',{name:'批量导入选中的 4 个工作表',exact:true}).click();
  await page.getByRole('button',{name:'透视分析',exact:true}).waitFor();
  for(const [table,expected] of Object.entries(oracle.stats))assert.equal(Number((await sql(`SELECT COUNT(*) n FROM ${table}`))[0].n),expected.rows);
  check('UI imports only four authorized business tables (10/25/25/8)');
  const temporal=[];
  for(const [table,{headers,rows}] of Object.entries(source))for(let i=0;i<headers.length;i++)if(/_at$|effective_date/.test(headers[i])){
    const observed=await sql(`SELECT CAST("${headers[0]}" AS VARCHAR) AS id,CAST("${headers[i]}" AS VARCHAR) AS value FROM "${table}" ORDER BY 1`);
    const expected=rows.map(row=>({id:String(row[0]),value:row[i]})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(observed,expected,`${table}.${headers[i]} must match independent openpyxl timestamps`);temporal.push(`${table}.${headers[i]}`);
  }
  check('all six timestamp columns match original XLSX exactly',temporal);
  await page.getByRole('combobox').first().selectOption('fiat_transactions');
  await page.getByRole('button',{name:'透视分析',exact:true}).click();await readyPivot();
  await page.locator('select:not([aria-label])').nth(0).selectOption('channel');await readyPivot();
  for(const row of oracle.results.pivot_count){const cells=await page.locator('.pivot-grid tbody tr').filter({hasText:row.channel}).locator('td').allTextContents();assert.equal(Number(cells[1]),Number(row.records));}
  check('single-table pivot count equals independent DuckDB for every channel');
  await page.getByLabel('值 1 字段',{exact:true}).selectOption('amount');
  await page.getByLabel('值 1 聚合方式',{exact:true}).selectOption('sum');
  await page.getByLabel('分析计量资产',{exact:true}).fill('USD');
  await page.getByRole('button',{name:'添加筛选',exact:true}).click();
  await page.getByLabel('筛选 1 字段',{exact:true}).selectOption('status');
  await page.getByLabel('筛选 1 值',{exact:true}).fill('completed');
  await page.locator('select:not([aria-label])').nth(1).selectOption('direction');await readyPivot();
  assert.match(await page.locator('.pivot-grid tfoot').innerText(),/104,270/);
  const cellValue=async name=>Number((await page.getByRole('button',{name,exact:true}).innerText()).replace(/[^\d.-]/g,''));
  for(const row of oracle.results.pivot_sum)assert.equal(await cellValue(`查看明细 ${row.channel} / ${row.direction}`),Number(row.amount));
  await page.getByLabel('值 1 聚合方式',{exact:true}).selectOption('avg');await readyPivot();
  assert.match(await page.locator('.pivot-grid tfoot').innerText(),/11,585\.55555556/);
  check('pivot SUM cells and weighted AVG margins match source SQL');
  await page.getByLabel('值 1 聚合方式',{exact:true}).selectOption('sum');await readyPivot();
  await page.getByRole('button',{name:'查看明细 ach / deposit',exact:true}).click();
  await page.getByRole('dialog').getByText('fo_20250308_90317462',{exact:true}).waitFor();
  assert.match(await page.getByRole('dialog').innerText(),/共 1 行/);
  await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();check('pivot detail applies asset/status/row/column filters');
  await page.getByLabel('筛选 1 值',{exact:true}).fill('absent_status');await readyPivot();
  await page.getByText('当前条件没有数据，请调整追加筛选或检查来源范围。',{exact:true}).waitFor();
  await page.getByLabel('筛选 1 值',{exact:true}).fill('pending');
  await page.getByLabel('筛选 1 值',{exact:true}).fill('completed');await readyPivot();
  assert.match(await page.locator('.pivot-grid tfoot').innerText(),/104,270/);check('empty pivot and rapid filter replacement recover without stale totals');
  await page.getByLabel('分析名称',{exact:true}).fill('真实 USD 渠道透视');
  await page.getByRole('button',{name:'图表',exact:true}).click();await page.locator('canvas').first().waitFor();
  await page.screenshot({path:path.join(output,'pivot-chart.png')});
  await page.getByRole('button',{name:'保存并加入首页',exact:true}).click();
  await page.getByText('已保存',{exact:false}).first().waitFor();
  check('real pivot is saved with Chart.js rendering and pinned to home');
  // SQL correctness is reconciled against a separate native DuckDB database, never UI cache.
  const runtime={};for(const [name,query] of Object.entries(oracle.queries)){runtime[name]=await sql(query);assert.deepEqual(numberRows(runtime[name]),numberRows(oracle.results[name]),name);}
  await fs.writeFile(path.join(output,'sql-reconciliation.json'),JSON.stringify(runtime,null,2));
  check('all native oracle SQL results reconcile with browser DuckDB, including key/cardinality checks');
  await page.getByRole('button',{name:'工程核心',exact:true}).click();
  await page.getByRole('tab',{name:'SQL',exact:true}).click();
  await fs.writeFile(path.join(output,'sql-workspace.txt'),await page.locator('body').innerText());
  // Keep execution through the actual CodeMirror and toolbar.
  const editor=page.locator('.cm-content[contenteditable=true]').first();await editor.waitFor();
  await editor.fill(oracle.queries.usd_net);
  await page.getByTitle('运行全文 (Ctrl+Enter)',{exact:true}).click();
  await page.getByText('47,730',{exact:true}).first().waitFor();check('SQL editor executes real USD net query');
  const metric=await page.evaluate(async prefix=>{
    const {metricAnalyzer:m}=await import(prefix+'services/metricAnalyzer.ts');
    const {pinChartToHome}=await import(prefix+'services/homeDashboardService.ts');
    const [definition]=m.validateMetrics([{name:'已完成 USD 金额',unit:'USD',sourceTable:'memory.main.fiat_transactions',scenario:'核对各渠道完成资金流量',value:'核对渠道汇总',definition:'每行一笔法币订单；全部来源期间；仅 completed 和 USD；不合并其他币种',calculation:{aggregation:'SUM',field:'amount',filter:"status='completed' AND currency='USD'",groupBy:['channel']},governance:{entity:'法币订单',sourceGrain:'每行一笔法币订单',reviewStatus:'draft'}}]);
    const pkg=m.createMetricPackage('真实四表验收','固定来源工作簿',['memory.main.fiat_transactions'],[definition]);
    const validation=await m.validateMetric(definition,definition.sourceTable);if(!validation.isValid)throw new Error(validation.error);
    m.saveMetricPackage(pkg);const restored=m.getMetricPackage(pkg.id).metrics[0];
    const chart=await m.generateChart(restored,pkg.id,restored.sourceTable);await pinChartToHome(chart);
    const invalid=await m.validateMetric({...definition,calculation:{...definition.calculation,field:'missing_amount'}},definition.sourceTable);
    return {validation,restored,chart,invalid};
  },prefix);
  assert.deepEqual(numberRows(metric.validation.result),oracle.results.chart.map(r=>({channel:r.channel,value:Number(r.amount)})));
  assert.equal(metric.invalid.isValid,false);assert.ok(metric.invalid.error);
  await fs.writeFile(path.join(output,'metric.json'),JSON.stringify(metric,null,2));check('metric definition validates, persists, generates chart, pins to home; bad field stays error');
  await page.getByRole('button',{name:'分析洞察',exact:true}).click();
  await page.getByRole('tab',{name:'指标',exact:true}).click();
  await page.getByText('真实四表验收',{exact:true}).first().click();
  await page.getByRole('button',{name:'编辑指标定义',exact:true}).click();
  await page.getByRole('dialog',{name:'编辑指标语义定义'}).waitFor();
  await page.getByRole('button',{name:'验证计算',exact:true}).click();
  await page.getByText('已在 memory 执行。请核对业务口径和结果后保存：',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'metric-ui-validation.png')});
  await page.getByRole('button',{name:'保存指标定义',exact:true}).click();
  await page.getByRole('dialog',{name:'编辑指标语义定义'}).waitFor({state:'hidden'});
  check('metric UI opens persisted definition, executes validation and saves');
  await page.getByRole('button',{name:'工程核心',exact:true}).click();
  await page.getByRole('tab',{name:'仪表盘',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-widget-id] [data-result-at]').length===2);
  const cards=page.locator('[data-widget-id]');assert.equal(await cards.count(),2);
  for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const rectangles=await cards.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    for(const r of rectangles)assert.ok(r.width>0&&r.height>0&&r.x>=0&&r.right<=width+1,`card outside ${width}`);
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){const a=rectangles[i],b=rectangles[j];assert.ok(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1,'overlapping cards');}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
    const canvases=await cards.locator('canvas').evaluateAll(es=>es.map(c=>({width:c.width,height:c.height,painted:[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].filter((v,i)=>i%4===3&&v>0).length})));
    assert.equal(canvases.length,2);assert.ok(canvases.every(c=>c.width>0&&c.height>0&&c.painted>100));
    await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});check(`home ${width}px: two painted charts, no overlap or overflow`);
    const bounds=await cards.locator('canvas').evaluateAll(es=>es.map(c=>{const plot=c.closest('[aria-label="图表绘图区"]');const a=c.getBoundingClientRect(),b=plot.getBoundingClientRect();return {canvas:a.toJSON(),plot:b.toJSON(),scrollLeft:plot.scrollLeft,scrollWidth:plot.scrollWidth};}));
    await fs.writeFile(path.join(output,`canvas-bounds-${width}.json`),JSON.stringify(bounds,null,2));
    assert.ok(bounds.every(b=>b.canvas.left>=b.plot.left-1 && b.canvas.top>=b.plot.top-1),'canvas leading axis clipped outside scroll origin');
    assert.ok(await cards.locator('canvas').evaluateAll(es=>es.every(c=>{const p=c.closest('[aria-label="图表绘图区"]');p.scrollLeft=p.scrollWidth;const visible=c.getBoundingClientRect().right<=p.getBoundingClientRect().right+1;p.scrollLeft=0;return visible;})),'canvas trailing data must be reachable by scrolling');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('浏览数据集',{exact:true}).selectOption({label:'memory.main.users'});
  await page.getByText('memory.main.users · 明细预览',{exact:true}).waitFor();
  await page.getByLabel('浏览数据集',{exact:true}).selectOption({label:'memory.main.crypto_transactions'});
  await page.getByLabel('浏览数据集',{exact:true}).selectOption({label:'memory.main.fiat_transactions'});
  await page.getByText('memory.main.fiat_transactions · 明细预览',{exact:true}).waitFor();
  await page.getByText('fo_20250110_78423190',{exact:true}).waitFor();
  assert.equal(await page.getByText('co_20250110_78423190',{exact:true}).count(),0);
  check('rapid dataset changes show only final dataset preview');
  // Persist genuine SQL error/empty/KPI widgets through the application's public storage API.
  await page.evaluate(async prefix=>{
    const {dbService:db}=await import(prefix+'services/dbService.ts');
    const {getOrCreateHomeDashboard}=await import(prefix+'services/homeDashboardService.ts');
    const board=await getOrCreateHomeDashboard();
    const definitions=[
      {id:'funds-error',name:'验收失败查询',sql:'SELECT missing_amount FROM memory.main.fiat_transactions',widgetType:'value',charts:[{id:'bad',title:'验收失败查询',type:'counter',xKey:'',yKeys:['missing_amount']}]},
      {id:'funds-empty',name:'验收空结果',sql:'SELECT * FROM memory.main.fiat_transactions WHERE FALSE',widgetType:'table'},
      {id:'funds-kpi',name:'验收 USD 完成金额',sql:"SELECT SUM(amount) AS value FROM memory.main.fiat_transactions WHERE currency='USD' AND status='completed'",widgetType:'value',charts:[{id:'good',title:'验收 USD 完成金额',type:'counter',xKey:'',yKeys:['value'],format:{compact:false,thousandSeparator:true,decimals:0,unit:'USD'}}]},
    ];
    for(const q of definitions)await db.saveQuery({...q,databaseName:'memory',createdAt:Date.now()});
    await db.saveDashboard({...board,items:[...board.items,...definitions.map((q,i)=>({i:q.id,savedQueryId:q.id,x:i*4,y:20,w:4,h:6}))],updatedAt:Date.now()});
    window.dispatchEvent(new CustomEvent('duckdb-home-dashboard-updated'));
  },prefix);
  await page.locator('[data-widget-id="funds-error"] [role=alert]').waitFor();
  assert.match(await page.locator('[data-widget-id="funds-error"]').innerText(),/查询失败/);
  assert.equal(await page.locator('[data-widget-id="funds-error"] [data-result-at]').count(),0);
  await page.locator('[data-widget-id="funds-empty"]').getByText('当前筛选无数据',{exact:true}).waitFor();
  await page.locator('[data-widget-id="funds-kpi"]').getByText('104,270 USD',{exact:true}).waitFor();
  check('missing field renders error instead of zero; empty data is explicit; KPI remains correct');
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await page.getByLabel('筛选数据集',{exact:true}).selectOption({label:'memory.main.fiat_transactions'});
  await page.getByLabel('筛选字段',{exact:true}).selectOption('channel');
  await page.getByLabel('筛选值',{exact:true}).fill('wire_transfer');
  await page.getByRole('button',{name:'添加条件',exact:true}).click();
  await page.getByRole('button',{name:'应用并保存默认条件',exact:true}).click();
  await page.locator('[data-widget-id="funds-kpi"]').getByText('102,000 USD',{exact:true}).waitFor();
  check('home global filter recomputes real USD total to 102000');
  await page.getByRole('button',{name:'筛选（1）',exact:true}).click();
  await page.getByRole('button',{name:'移除条件',exact:true}).click();
  await page.getByRole('button',{name:'应用并保存默认条件',exact:true}).click();
  await page.locator('[data-widget-id="funds-kpi"]').getByText('104,270 USD',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'home-error-empty-recovery.png'),fullPage:true});
  check('clearing home filter restores source total');
  await page.evaluate(async prefix=>{const {duckDBService:d}=await import(prefix+'services/duckdbService.ts');await d.createDatabase('funds_empty_scope',{persistent:false,activate:false});},prefix);
  const selectDatabase=async name=>{await page.getByRole('button',{name:/^(内存库|持久库) ·/}).first().click();await page.getByRole('option').filter({hasText:name}).first().click();};
  await selectDatabase('funds_empty_scope');
  await page.getByText('导入数据开始分析',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-widget-id]').count(),0);
  assert.equal(await page.getByText('104,270 USD',{exact:true}).count(),0);
  await selectDatabase('memory');
  await page.locator('[data-widget-id="funds-kpi"]').getByText('104,270 USD',{exact:true}).waitFor();
  check('database switch removes old cards/results and returning restores correct scoped state');
  assert.deepEqual(errors,[]);check('no uncaught browser rendering errors');
}catch(error){console.error(error);await fs.writeFile(path.join(output,'failure.txt'),String(error.stack));await fs.writeFile(path.join(output,'failure-dom.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors},null,2));await context.tracing.stop({path:path.join(output,'trace.zip')});await browser.close();}
