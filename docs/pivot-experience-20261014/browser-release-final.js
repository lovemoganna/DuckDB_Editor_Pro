async (page) => {
  page.setDefaultTimeout(15000);
  await page.getByRole('button',{name:'仪表盘',exact:true}).click();
  const title='DuckDB 函数目录 · 透视验证 · 已更新';
  await page.getByRole('button',{name:`更多组件选项 ${title}`,exact:true}).click();
  await page.getByRole('button',{name:'编辑透视表',exact:true}).click();
  await page.getByTestId('pivot-editor').waitFor({timeout:30000});
  if(await page.getByLabel('筛选 1 值',{exact:true}).inputValue()!=='2')throw new Error('Saved filter was lost');
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存分析')?.disabled,null,{timeout:30000});
  await page.screenshot({path:'docs/pivot-experience-20261014/restored-after-reload.png',fullPage:true});
}
