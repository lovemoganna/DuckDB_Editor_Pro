async (page) => {
  await page.getByRole('tab', {name:'SQL', exact:true}).click();
  await page.getByRole('textbox').nth(1).fill("SELECT function_type, return_type, len(parameters) AS parameter_count FROM duckdb_functions() WHERE function_type IN ('scalar', 'aggregate')");
  await page.getByRole('button', {name:'运行', exact:true}).click();
  await page.getByRole('button', {name:'透视分析', exact:true}).waitFor({timeout:30000});
  await page.getByRole('button', {name:'透视分析', exact:true}).click();
  await page.getByTestId('pivot-editor').waitFor({timeout:30000});
  await page.getByRole('button', {name:'保存分析', exact:true}).waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存分析')?.disabled,{timeout:30000});
  await page.getByLabel('列', {exact:true}).selectOption('return_type');
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存分析')?.disabled,{timeout:30000});
  await page.screenshot({path:'docs/pivot-experience-20261014/editor-wide.png',fullPage:true});
}
