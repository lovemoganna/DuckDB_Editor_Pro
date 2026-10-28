async (page) => {
  page.setDefaultTimeout(15000);
  await page.getByRole('textbox',{name:/可选过滤条件/}).fill("function_type = 'aggregate'");
  await page.getByRole('button',{name:'应用',exact:true}).click();
  await page.getByRole('button',{name:'透视分析',exact:true}).click();
  await page.getByTestId('pivot-editor').waitFor({timeout:30000});
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存分析')?.disabled,null,{timeout:30000});
  await page.getByText('来源范围与已继承条件',{exact:true}).click();
  const source=await page.getByTestId('pivot-editor').locator('pre').first().innerText();
  if(!source.includes("WHERE function_type = 'aggregate'"))throw new Error('Applied table filter was not inherited');
  if(await page.getByRole('button',{name:'收起 scalar',exact:true}).count())throw new Error('Unfiltered scalar records leaked into pivot');
  await page.getByRole('button',{name:'查看明细 aggregate / 汇总',exact:true}).click();
  await page.getByRole('dialog').getByText('1–50 条',{exact:true}).waitFor();
  const cells=await page.getByRole('dialog').getByRole('cell').allTextContents();
  if(cells.includes('scalar') || cells.includes('macro') || cells.includes('table'))throw new Error('Unfiltered records leaked into detail');
  await page.keyboard.press('Escape');
  await page.screenshot({path:'docs/pivot-experience-20261014/table-filter-inherited.png',fullPage:true});
}
