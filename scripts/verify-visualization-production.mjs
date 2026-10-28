import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verifyVisualizationLibrary} from './visualization-quality-checks.mjs';
const output=path.resolve(process.env.QUALITY_OUTPUT || 'output/playwright/quality-20261016-round3/production');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await context.tracing.start({screenshots:true,snapshots:true});
try {
  await page.goto(process.env.QUALITY_BASE_URL || 'http://127.0.0.1:5196/DuckDB_Editor_Pro/',{waitUntil:'commit',timeout:60000});
  await page.getByRole('button',{name:'导入数据',exact:true}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'导入数据',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('test/fixtures/exchange-funds-four-tables.xlsx');
  await page.getByRole('button',{name:'批量导入选中的 4 个工作表',exact:true}).click();
  await page.getByRole('button',{name:'透视分析',exact:true}).waitFor({timeout:120000});
  if(process.env.QUALITY_HOME_AUDIT==='1') {
    await page.getByRole('button',{name:'DuckDB Studio · 返回首页仪表盘',exact:true}).click();
    await page.locator('.workspace-board-title').waitFor({timeout:120000});
    assert.ok((await page.locator('.workspace-board-title').innerText()).trim());
    for(const theme of ['dark','light']) {
      const toggle=page.getByRole('button',{name:theme==='light'?'切换为浅色模式':'切换为深色模式',exact:true});
      if(await toggle.count())await toggle.click();
      for(const width of [1440,768,375]) {
        await page.setViewportSize({width,height:1000});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        const controls=await page.locator('.workspace-board-heading button,.workspace-board-heading select').evaluateAll(elements=>elements.map(element=>{
          const r=element.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height};
        }));
        for(const r of controls) {assert.ok(r.x>=0&&r.right<=width+1);if(width===375)assert.ok(r.height>=44);}
        await page.screenshot({path:path.join(output,`production-home-${theme}-${width}.png`),animations:'disabled'});
      }
    }
    const dataset=page.getByRole('combobox',{name:'浏览数据集'});
    await dataset.selectOption(await dataset.locator('option').filter({hasText:'fiat_transactions'}).first().getAttribute('value'));
    const previewTitle=page.getByRole('heading',{name:/fiat_transactions · 明细预览/});
    await previewTitle.waitFor();
    await previewTitle.locator('xpath=ancestor::section[1]').locator('tbody tr').first().waitFor({timeout:120000});
    assert.ok(await previewTitle.evaluate(element=>{
      const r=element.getBoundingClientRect(),p=element.closest('section').getBoundingClientRect();
      return r.width>=180&&r.left>=p.left&&r.right<=p.right&&element.scrollWidth<=element.clientWidth+1;
    }));
    await page.screenshot({path:path.join(output,'production-home-mobile-preview.png'),animations:'disabled'});
    await dataset.selectOption('');
    await page.setViewportSize({width:1440,height:1000});
    console.log('PASS production workspace: imported four real worksheets, both themes, three widths, reachable controls');
  }
  await verifyVisualizationLibrary(page,output);
  assert.deepEqual(errors,[]);
} catch(error) {
  await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
} finally {
  await writeFile(path.join(output,'errors.json'),JSON.stringify(errors,null,2));
  await context.tracing.stop({path:path.join(output,'trace.zip')});
  await browser.close();
}
