async page => {
  const config = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__system_audit_config') || '{}'));
  const phase = config.phase || 'empty-dark-desktop';
  await page.setViewportSize({width:config.width || 1440,height:config.height || 1000});
  const currentTheme=await page.evaluate(()=>document.documentElement.dataset.theme);
  if (config.theme && currentTheme!==config.theme) await page.getByRole('button',{name:config.theme==='light'?'切换为浅色模式':'切换为深色模式',exact:true}).click();
  const groups = [
    ['工程核心',['仪表盘','数据','Schema','SQL','数据流']],
    ['分析洞察',['指标','可视化','分析','历史','审计']],
    ['知识沉淀',['知识资产','插件','知识联动']],
    ['AI 认知',['本体图谱','技能','能力','推演']],
  ];
  const results=[];
  const errors=[];
  const onError=error=>errors.push(String(error));
  page.on('pageerror',onError);
  for (const [group, tabs] of groups) {
    if (config.group && group!==config.group) continue;
    await page.getByRole('button',{name:group,exact:true}).click();
    await page.getByRole('tablist',{name:`${group}功能标签页`}).waitFor();
    for (const tab of tabs) {
      const nav=page.getByRole('tablist',{name:`${group}功能标签页`}).getByRole('tab',{name:tab,exact:true});
      try {
        await nav.click();
        await page.locator('main').first().waitFor();
        await page.waitForFunction(() => !document.querySelector('main [role="status"] .animate-spin'), undefined, {timeout:15000});
        await page.waitForFunction(() => !/DuckDB 正在准备数据与执行环境|加载分析…/.test(document.querySelector('main')?.innerText || ''), undefined, {timeout:15000});
        // Observe two frames, then capture the current screen rather than a cached image.
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const evidence=await page.evaluate(()=>{
          const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
          const main=document.querySelector('main');
          const controls=[...document.querySelectorAll('button,a,input,select,textarea,[role="tab"]')].filter(visible);
          const unnamed=controls.filter(el=>el.tagName==='BUTTON' && !(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.getAttribute('title')||el.textContent?.trim()));
          const overflow=[...(main?.querySelectorAll('*')||[])].filter(el=>visible(el)&&el.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(el=>({tag:el.tagName,text:el.textContent?.trim().slice(0,60),className:String(el.className).slice(0,130)}));
          return {theme:document.documentElement.dataset.theme,bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,
            mainText:main?.innerText.slice(0,1200),controls:controls.length,unnamedButtons:unnamed.map(el=>el.outerHTML.slice(0,250)),
            alerts:[...document.querySelectorAll('[role="alert"]')].filter(visible).map(el=>el.textContent),
            subTabs:[...document.querySelectorAll('main [role="tab"]')].filter(visible).map(el=>({name:el.textContent?.trim(),selected:el.getAttribute('aria-selected')})),overflow};
        });
        const file=`docs/system-consistency-20261012/${phase}/${group}-${tab}.png`;
        await page.screenshot({path:file,fullPage:true});
        results.push({group,tab,screenshot:file,errors:errors.splice(0),...evidence});
      } catch(error) {results.push({group,tab,blocked:String(error)});}
    }
  }
  page.off('pageerror',onError);
  return {phase,results};
}
