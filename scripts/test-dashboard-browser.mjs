import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const output=path.resolve('output/playwright/dashboard-stability');
await mkdir(output,{recursive:true});
const base=process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:5186/DuckDB_Editor_Pro/';
const url=new URL('test/dashboard-stability.html',base).href;
let server, browser, context, page;
const checks=[], errors=[];
const check=(name,detail)=>{checks.push({name,detail});console.log(`PASS ${name}`);};
try {
  if(!process.env.DASHBOARD_BASE_URL) {
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,VITE_ACCEPTANCE_CACHE_DIR:path.resolve('node_modules/.vite-dashboard-acceptance')}});
    let log='';server.stdout.on('data',chunk=>{log+=chunk;});server.stderr.on('data',chunk=>{log+=chunk;});
    const deadline=Date.now()+60000;
    while(true) {
      if(server.exitCode!==null)throw new Error(`Acceptance server exited: ${log}`);
      try {if((await fetch(url)).ok)break;} catch{}
      if(Date.now()>deadline)throw new Error(`Acceptance server timeout: ${log}`);
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  browser=await chromium.launch({headless:true,...(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname)?{args:['--no-proxy-server']}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.tracing.start({screenshots:true,snapshots:true});
  page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  console.log('Loading real DuckDB dashboard acceptance surface');
  await page.goto(url,{waitUntil:'commit',timeout:60000});
  const cards=page.locator('[data-widget-id]');
  const kpi=page.locator('[data-widget-id="kpi"]');
  const loaded=async()=>page.waitForFunction(()=>document.querySelectorAll('[data-widget-id] [data-result-at]').length===3 && ![...document.querySelectorAll('[role="status"]')].some(el=>el.textContent.includes('正在刷新')),{},{timeout:120000});
  const layout=()=>cards.evaluateAll(elements=>elements.map(el=>({id:el.getAttribute('data-widget-id'),x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
  const stored=()=>page.evaluate(async()=>await window.dashboardAcceptance.stored());
  await loaded();
  assert.equal(await cards.count(),3);
  assert.equal(await page.getByRole('note').count(),1);
  assert.equal(await page.locator('[data-widget-id="table"] [data-result-total]').getAttribute('data-result-total'),'9');
  check('real readonly baseline loads three saved widgets and nine detail rows');
  const original=(await stored())[0];
  const initial=await layout();
  await page.getByRole('button',{name:'筛选渠道',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-widget-id="table"] [data-result-total]')?.getAttribute('data-result-total')==='5');
  await loaded();
  assert.deepEqual(await layout(),initial);
  check('real channel filtering changes rows without moving cards');
  await page.getByRole('button',{name:'清除渠道',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-widget-id="table"] [data-result-total]')?.getAttribute('data-result-total')==='9');
  await loaded();
  assert.deepEqual(await layout(),initial);
  check('clearing filters restores all nine rows and preserves geometry');
  const assertGeometry=async()=>{
    const rectangles=await layout();
    const viewport=page.viewportSize();
    for(const rect of rectangles) {assert.ok(rect.w>0&&rect.h>0);assert.ok(rect.x>=0 && rect.x+rect.w<=viewport.width+1,`card outside viewport: ${rect.id}`);}
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++) {
      const a=rectangles[i],b=rectangles[j];
      assert.ok(a.x+a.w<=b.x+1 || b.x+b.w<=a.x+1 || a.y+a.h<=b.y+1 || b.y+b.h<=a.y+1,`overlap ${a.id}/${b.id}`);
    }
    const canvases=await page.locator('[data-widget-id] canvas').evaluateAll(elements=>elements.map(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let painted=0;for(let index=3;index<pixels.length;index+=64)if(pixels[index]>0)painted++;
      return {width:canvas.width,height:canvas.height,box:canvas.getBoundingClientRect().toJSON(),painted};
    }));
    assert.ok(canvases.length>0);
    assert.ok(canvases.every(canvas=>canvas.width>0&&canvas.height>0&&canvas.box.width>0&&canvas.box.height>0));
    assert.ok(canvases.every(canvas=>canvas.painted>100),'blank canvas');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    return rectangles;
  };
  for(const width of [1440,1280,1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await assertGeometry();
    await page.screenshot({path:path.join(output,`board-${width}.png`),fullPage:true});
    assert.deepEqual((await stored())[0].items,original.items);
    check(`viewport ${width}: no overlap, no page overflow, drawable canvas, saved geometry unchanged`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'更多组件选项 渠道金额',exact:true}).click();
  await page.getByRole('button',{name:'全屏查看',exact:true}).click();
  await page.getByRole('dialog',{name:'渠道金额 全屏透视'}).waitFor();
  const beforeTimer=await kpi.locator('[data-result-at]').getAttribute('data-result-at');
  await page.waitForFunction(at=>document.querySelector('[data-widget-id="kpi"] [data-result-at]')?.getAttribute('data-result-at')!==at,beforeTimer,{timeout:45000});
  assert.equal(await page.getByRole('dialog',{name:'渠道金额 全屏透视'}).count(),1);
  assert.ok(await page.getByRole('dialog').locator('canvas').evaluate(canvas=>canvas.width>0&&canvas.height>0));
  check('actual 30-second automatic refresh keeps fullscreen open and canvas drawable');
  for(const width of [768,390]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.getByRole('dialog').count(),1);
    await page.screenshot({path:path.join(output,`fullscreen-${width}.png`)});
  }
  await page.getByRole('button',{name:'关闭全屏透视',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'编辑布局',exact:true}).click();
  const handle=page.locator('[data-widget-id="chart"] .react-resizable-handle-se');
  await handle.scrollIntoViewIfNeeded();
  const box=await handle.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.move(box.x+box.width/2-130,box.y+box.height/2+70,{steps:10});await page.mouse.up();
  await page.waitForFunction(async()=>{const board=(await window.dashboardAcceptance.stored())[0];return board.items.find(item=>item.i==='chart').h>6;});
  const drag=page.locator('[data-widget-id="kpi"] .drag-handle');
  await drag.scrollIntoViewIfNeeded();
  const dragBox=await drag.boundingBox();assert.ok(dragBox);
  await page.mouse.move(dragBox.x+20,dragBox.y+10);await page.mouse.down();
  await page.mouse.move(dragBox.x+150,dragBox.y+10,{steps:10});await page.mouse.up();
  await page.waitForFunction(async()=>{const board=(await window.dashboardAcceptance.stored())[0];return board.items.find(item=>item.i==='kpi').x>0;});
  await page.getByRole('button',{name:'完成编辑',exact:true}).click();
  await page.getByRole('button',{name:'编辑布局',exact:true}).waitFor();
  const saved=(await stored())[0];assert.ok(saved.layoutLocked);
  await page.reload({waitUntil:'commit',timeout:60000});await loaded();
  assert.deepEqual((await stored())[0].items,saved.items);
  await assertGeometry();
  check('real drag and resize persist, lock completes, reload restores saved geometry');
  // A second independent catalog uses its own configuration namespace.
  const isolation=await page.evaluate(async()=>{
    const {dbService}=await import('/DuckDB_Editor_Pro/services/dbService.ts');
    return await dbService.getDashboards('memory');
  });
  assert.ok(!isolation.some(board=>board.id==='acceptance-board'));
  check('saved readonly board does not leak into the memory catalog');
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>window.dashboardAcceptance.incidents()),[]);
  check('no console errors, unhandled page errors, or dashboard incidents');
  await page.screenshot({path:path.join(output,'final.png'),fullPage:true});
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,checks,errors},null,2));
} catch(error) {
  await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:false,checks,errors,error:String(error.stack||error)},null,2));
  console.error(error);process.exitCode=1;
} finally {
  await context?.tracing.stop({path:path.join(output,'trace.zip')}).catch(()=>{});
  await browser?.close();
  server?.kill();
}
