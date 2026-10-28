async page => {
  await page.setViewportSize({width:390,height:844});
  const results=[];
  const go=async(group,tab)=>{
    await page.getByRole('button',{name:group,exact:true}).click();
    await page.getByRole('tablist',{name:`${group}功能标签页`}).getByRole('tab',{name:tab,exact:true}).click();
  };
  await go('分析洞察','分析');
  const tabs=page.locator('main [role=tablist]').first();
  await tabs.getByRole('tab').first().focus();
  await tabs.getByRole('tab').first().press('End');
  const last=tabs.getByRole('tab').last();
  if(await last.getAttribute('aria-selected')!=='true') throw Error('End did not select the last analysis tab');
  const box=await last.boundingBox();
  if(!box || box.x<0 || box.x+box.width>392) throw Error('Selected analysis tab is clipped');
  results.push({check:'narrow analysis keyboard navigation and automatic scrolling',passed:true});
  await page.screenshot({path:'docs/system-consistency-20261012/analysis-keyboard-end.png'});
  await go('知识沉淀','知识资产');
  await page.getByRole('button',{name:'展开知识文献库侧边栏',exact:true}).click();
  await page.getByRole('complementary',{name:'知识沉淀导航栏'}).waitFor();
  await page.keyboard.press('Control+b');
  await page.getByRole('complementary',{name:'知识沉淀导航栏'}).waitFor({state:'hidden'});
  results.push({check:'narrow knowledge navigation opens and closes with keyboard',passed:true});
  await page.screenshot({path:'docs/system-consistency-20261012/knowledge-narrow-after.png'});
  await go('AI 认知','技能');
  await page.screenshot({path:'docs/system-consistency-20261012/skills-narrow-after.png'});
  await go('工程核心','仪表盘');
  // Import is available from the shared database menu even with populated data.
  await page.getByRole('button',{name:/已保存到 OPFS|临时分析空间/}).click();
  const importButton=page.getByRole('button',{name:/导入数据表文件/}).first();
  if(await importButton.count()) {
    await importButton.click();
    const dialog=page.getByRole('dialog',{name:'数据导入',exact:true});
    await dialog.waitFor();
    if(!await dialog.evaluate(el=>el.contains(document.activeElement))) throw Error('Import focus escaped');
    await page.screenshot({path:'docs/system-consistency-20261012/import-dialog-after.png'});
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    results.push({check:'real import dialog semantics, focus, Escape',passed:true});
  } else {
    results.push({check:'import dialog from database menu',passed:false,reason:'No import button in database menu; prior actual import separately verified'});
  }
  return results;
}
