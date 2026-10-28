import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { verifyVisualizationLibrary } from './visualization-quality-checks.mjs';

const base = process.env.QUALITY_BASE_URL || 'http://127.0.0.1:5173/DuckDB_Editor_Pro/';
const output = path.resolve(process.env.QUALITY_OUTPUT || 'output/playwright/quality-20261016');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const pass = name => { checks.push(name); console.log(`PASS ${name}`); };
const screenshot = async name => {
  if (await page.locator('.analysis-home').count()) await page.locator('.analysis-home').evaluate(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) parent.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
};
const home = () => page.getByRole('button', { name: 'DuckDB Studio · 返回首页仪表盘', exact: true }).click();
const geometry = async () => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document overflows horizontally');
  const bounds = await page.locator('.workspace-welcome button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  for (const rect of bounds) assert.ok(rect.width > 0 && rect.height >= 36 && rect.x >= 0 && rect.right <= page.viewportSize().width, 'unreachable welcome action');
};
try {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(base, { waitUntil: 'commit', timeout: 60000 });
  await page.locator('.workspace-welcome').waitFor({ timeout: 120000 });
  const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry=>entry.name));
  assert.ok(!initialResources.some(url=>/\/(?:ImportWizard|WorkbenchView|elk\.bundled)[^/]*\.(?:tsx?|js)/.test(url)), 'unused tools or layout engine fetched on first-run home');
  await writeFile(path.join(output,'initial-resources.json'),JSON.stringify(initialResources,null,2));
  pass('first-run home does not fetch the import tool, SQL workspace or ELK layout engine');
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('button', { name: theme === 'light' ? '切换为浅色模式' : '切换为深色模式', exact: true });
    if (await toggle.count()) await toggle.click();
    for (const [width, height] of [[1440, 1000], [1024, 900], [768, 1024], [390, 844], [375, 812], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await geometry();
      await screenshot(`welcome-${theme}-${width}`);
    }
    const contrast = await page.locator('.welcome-description').evaluate(element => {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      const rgb = color => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3); };
      const luminance = channels => channels.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((total, c, i) => total + c * [.2126, .7152, .0722][i], 0);
      const color = getComputedStyle(element).color;
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--monokai-bg').trim();
      const values = [luminance(rgb(color)), luminance(rgb(bg))].sort((a, b) => b - a);
      return (values[0] + .05) / (values[1] + .05);
    });
    assert.ok(contrast >= 4.5, `body contrast ${contrast}`);
    pass(`${theme}: six viewport layouts and body contrast ${contrast.toFixed(2)}:1`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.workspace-welcome').evaluate(el => getComputedStyle(el).animationName), 'none');
  pass('reduced motion disables welcome entrance');
  await page.getByRole('button', { name: '导入数据', exact: true }).click();
  await page.getByRole('heading', { name: /数据导入/ }).waitFor();
  await screenshot('import-entry');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.locator('.workspace-welcome').waitFor();
  await page.getByRole('button', { name: '打开数据库管理', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await screenshot('database-entry');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '新建查询', exact: true }).click();
  await page.getByRole('toolbar', { name: 'SQL 工作区工具栏' }).waitFor();
  assert.ok(await page.getByTitle('编辑器字号 13px').count());
  await page.getByRole('textbox', {name:'SQL 查询编辑器',exact:true}).waitFor();
  const splitter = page.getByRole('separator', {name:'调整 SQL 编辑器与结果区域高度'});
  await splitter.focus(); await splitter.press('ArrowDown');
  assert.equal(await splitter.getAttribute('aria-valuenow'), '45');
  await splitter.press('Enter'); assert.equal(await splitter.getAttribute('aria-valuenow'), '50');
  await screenshot('sql-readable-default');
  await home();
  await page.locator('.workspace-welcome').waitFor();
  pass('import, database management and fresh SQL entry use real workflows');

  const switcher = page.getByTitle('切换待分析数据库 / Schema');
  await switcher.focus(); await switcher.press('ArrowDown');
  await page.getByRole('listbox', { name: '切换分析范围' }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'option');
  await page.keyboard.press('End'); await page.keyboard.press('Home'); await page.keyboard.press('Escape');
  assert.ok(await switcher.evaluate(el => document.activeElement === el));
  await page.setViewportSize({ width: 375, height: 812 });
  await switcher.click();
  const rect = await page.getByRole('listbox').evaluate(el => el.parentElement.getBoundingClientRect().toJSON());
  assert.ok(rect.x >= 0 && rect.right <= 375 && rect.bottom <= 812);
  await screenshot('switcher-mobile');
  await page.keyboard.press('Escape');
  pass('switcher keyboard navigation, Escape focus return and mobile popup bounds');
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (process.env.QUALITY_STATIC_ONLY === '1') {
    pass('production bundle first-run workflows verified');
  } else {
  const prefix = new URL(base).pathname;
  const real = await page.evaluate(async prefix => {
    const { duckDBService: engine } = await import(`${prefix}services/duckdbService.ts`);
    const bytes = await (await fetch(`${prefix}data/crud-lab/baseline.duckdb`)).arrayBuffer();
    await engine.registerFileBuffer('quality-readonly.duckdb', new Uint8Array(bytes));
    await engine.query("ATTACH 'quality-readonly.duckdb' AS quality_review (READ_ONLY)");
    const result = await engine.query('SELECT COUNT(*) AS records FROM quality_review.main.fiat_transactions');
    const { dbService: db } = await import(`${prefix}services/dbService.ts`);
    const catalog = 'quality_review', now = Date.now();
    const queries = [
      {id:'quality-count',name:'实际交易记录',sql:`SELECT COUNT(*) records FROM ${catalog}.main.fiat_transactions`,widgetType:'value',charts:[{id:'count',title:'实际交易记录',type:'counter',xKey:'',yKeys:['records']}]},
      {id:'quality-channels',name:'各渠道交易金额',sql:`SELECT channel,SUM(amount) amount FROM ${catalog}.main.fiat_transactions GROUP BY channel ORDER BY channel`,widgetType:'chart',charts:[{id:'channels',title:'各渠道交易金额',type:'bar',xKey:'channel',yKeys:['amount'],showLegend:true}]},
      {id:'quality-orders',name:'交易明细',sql:`SELECT fiat_order_id,channel,amount FROM ${catalog}.main.fiat_transactions ORDER BY fiat_order_id`,widgetType:'table'},
    ];
    for(const query of queries) await db.saveQuery({...query,databaseName:catalog,createdAt:now});
    await db.saveDashboard({id:'quality-board',name:'真实交易分析',databaseName:catalog,createdAt:now,updatedAt:now,formatVersion:2,layoutLocked:true,context:{filters:[],refreshSeconds:0},
      items:queries.map((query,index)=>({i:`quality-${index}`,savedQueryId:query.id,...[
        {x:0,y:0,w:12,h:2},{x:0,y:2,w:7,h:7},{x:7,y:2,w:5,h:7}
      ][index]}))});
    await db.saveDomainSetting('active-home-view','quality-board',catalog);
    window.dispatchEvent(new CustomEvent('duckdb-database-changed'));
    return String(result[0].records);
  }, prefix);
  assert.ok(Number(real) > 0);
  await switcher.click();
  await page.getByRole('option').filter({ hasText: 'quality_review' }).click();
  await page.getByRole('button', { name: '新建查询', exact: true }).waitFor({ timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-widget-id] [data-result-at]').length === 3, {timeout:120000});
  const directFullscreen = page.getByRole('button',{name:'全屏查看 各渠道交易金额',exact:true});
  await directFullscreen.click();
  const fullDialog = page.getByRole('dialog');
  await fullDialog.waitFor();
  assert.ok(await fullDialog.evaluate(element=>element.contains(document.activeElement)));
  for(let i=0;i<12;i++) await page.keyboard.press('Tab');
  assert.ok(await fullDialog.evaluate(element=>element.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  assert.ok(await directFullscreen.evaluate(element=>document.activeElement===element));
  pass('direct fullscreen action contains keyboard focus and returns it on Escape');
  assert.equal(await page.getByRole('button',{name:'导出诊断记录'}).count(),0);
  await page.getByText('工作台诊断',{exact:true}).click();
  await page.getByRole('button',{name:'导出诊断记录'}).waitFor();
  await page.getByText('工作台诊断',{exact:true}).click();
  await screenshot('real-data-home-light');
  const dark = page.getByRole('button', { name: '切换为深色模式', exact: true });
  if (await dark.count()) await dark.click();
  await screenshot('real-data-home-dark');
  for (const width of [1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 }); await geometry();
    const cards = await page.locator('[data-widget-id]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
    for (const rect of cards) assert.ok(rect.x >= 0 && rect.right <= width + 1, 'real widget outside viewport');
    await screenshot(`real-data-home-dark-${width}`);
  }
  const chartRegion=page.locator('[data-widget-id="quality-1"]').getByRole('region',{name:'图表绘图区'});
  await page.locator('[data-widget-id="quality-1"]').getByText('横向滚动查看完整图表',{exact:true}).waitFor();
  await chartRegion.focus();
  await chartRegion.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('[data-widget-id="quality-1"] [aria-label="图表绘图区"]')?.scrollLeft>0);
  await page.screenshot({path:path.join(output,'chart-mobile-keyboard-scroll.png'),animations:'disabled'});
  pass('narrow chart explains overflow and supports native keyboard scrolling');
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator('.workspace-welcome').count(), 0);
  pass(`readonly baseline has ${real} actual rows; populated workspace replaces first-run state`);
  await page.getByRole('tab', { name: 'SQL', exact: true }).click();
  await page.getByRole('toolbar', { name: 'SQL 工作区工具栏' }).waitFor();
  await home();
  await page.getByRole('button', { name: '新建查询', exact: true }).waitFor();
  pass('populated workspace survives SQL navigation and return');
  if (process.env.QUALITY_HOME_AUDIT === '1') {
    await page.getByRole('heading',{name:'真实交易分析',exact:true}).waitFor();
    const originalLayout = await page.evaluate(async prefix => {
      const {dbService}=await import(`${prefix}services/dbService.ts`);
      return JSON.stringify((await dbService.getDashboards('quality_review')).find(board=>board.id==='quality-board').items);
    },prefix);
    await page.getByRole('button',{name:'视图设置',exact:true}).click();
    const longName='真实交易分析 · 跨渠道资金流与已完成订单金额追踪 · 国际业务团队共享工作台';
    await page.getByRole('textbox',{name:'视图名称'}).fill(longName);
    await page.getByRole('button',{name:'重命名',exact:true}).click();
    await page.getByRole('heading',{name:longName,exact:true}).waitFor();
    await page.getByRole('button',{name:'视图设置',exact:true}).click();
    for (const width of [1440,1024,768,390,375]) {
      await page.setViewportSize({width,height:1000});
      await geometry();
      const bounds=await page.locator('.workspace-board-heading button, .workspace-board-heading select, .workspace-board-title').evaluateAll(elements=>elements.map(element=>{
        const r=element.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height,scroll:element.scrollWidth,client:element.clientWidth};
      }));
      for(const r of bounds) assert.ok(r.x>=0&&r.right<=width+1,'home control outside viewport');
      if(width<=390) for(const r of bounds) assert.ok(r.height>=44,'mobile home control below 44px');
      await screenshot(`home-long-title-${width}`);
    }
    await page.getByRole('button',{name:'筛选',exact:true}).click();
    const filterDialog=page.getByRole('dialog',{name:'统一分析上下文'});
    await filterDialog.waitFor();
    for(let i=0;i<12;i++)await page.keyboard.press('Tab');
    assert.ok(await filterDialog.evaluate(element=>element.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.ok(await page.getByRole('button',{name:'筛选',exact:true}).evaluate(element=>document.activeElement===element));
    const dataset=page.getByRole('combobox',{name:'浏览数据集'});
    const datasetValue=await dataset.locator('option').filter({hasText:'fiat_transactions'}).first().getAttribute('value');
    await dataset.selectOption(datasetValue);
    await page.getByRole('heading',{name:/fiat_transactions · 明细预览/}).waitFor();
    await page.getByText('25 行记录',{exact:true}).waitFor();
    await geometry();
    const previewHeading=page.getByRole('heading',{name:/fiat_transactions · 明细预览/});
    assert.ok(await previewHeading.evaluate(element=>{
      const heading=element.getBoundingClientRect(), card=element.closest('section').getBoundingClientRect();
      return heading.width>=180&&heading.left>=card.left&&heading.right<=card.right&&element.scrollWidth<=element.clientWidth+1;
    }),'dataset heading clips inside its card');
    await screenshot('home-mobile-dataset-preview');
    assert.equal(await dataset.inputValue(),datasetValue);
    await dataset.selectOption('');
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'视图设置',exact:true}).click();
    await page.getByRole('textbox',{name:'视图名称'}).fill('真实交易分析');
    await page.getByRole('button',{name:'重命名',exact:true}).click();
    await page.getByRole('heading',{name:'真实交易分析',exact:true}).waitFor();
    await page.getByRole('button',{name:'视图设置',exact:true}).click();
    assert.equal(await page.evaluate(async prefix=>{
      const {dbService}=await import(`${prefix}services/dbService.ts`);
      return JSON.stringify((await dbService.getDashboards('quality_review')).find(board=>board.id==='quality-board').items);
    },prefix),originalLayout);
    await screenshot('home-refined-final');
    pass('real view rename, long-title bounds, 44px mobile controls, filter focus return and dataset selection preserve saved widget geometry');
  }
  if(process.env.QUALITY_VIZ_AUDIT==='1')await verifyVisualizationLibrary(page,output);
  if (process.env.QUALITY_AUDIT_FEATURES === '1') {
    const groups = [
      ['工程核心',['数据','Schema','SQL','数据流']],
      ['分析洞察',['指标','可视化','分析','历史','审计']],
      ['知识沉淀',['知识资产','插件','知识联动']],
      ['AI 认知',['本体图谱','技能','能力','推演']],
    ];
    const surfaces=[];
    for(const [domain,tabs] of groups) {
      await page.getByRole('navigation',{name:'业务领域大类'}).getByRole('button',{name:domain,exact:true}).click();
      for(const label of tabs) {
        await page.getByRole('tab',{name:label,exact:true}).first().click();
        await page.getByText('正在加载工作区...',{exact:true}).waitFor({state:'hidden',timeout:120000});
        const surface=page.locator('[data-workspace-feature]');
        await surface.waitFor();
        if(label==='分析') await surface.locator('.pivot-grid tbody tr').first().waitFor({timeout:120000});
        if(label==='可视化') await surface.locator('canvas').first().waitFor({timeout:120000});
        await page.evaluate(()=>document.fonts.ready);
        const text=await surface.innerText();
        assert.ok(text.trim().length>15,`empty ${label}`);
        assert.ok(!/发生错误|is unavailable/.test(text),`failed surface ${label}`);
        await screenshot(`surface-${label}`);
        surfaces.push({domain,label,characters:text.length});
      }
    }
    await writeFile(path.join(output,'surfaces.json'),JSON.stringify(surfaces,null,2));
    await home();
    pass('sixteen feature surfaces load through the real global navigation');
  }
  }
  assert.deepEqual(errors, []);
  pass('no uncaught browser errors');
} finally {
  await writeFile(path.join(output, 'checks.json'), JSON.stringify({ base, checks, errors }, null, 2));
  await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  await browser.close();
}
