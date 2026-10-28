async (page) => {
  if (await page.getByRole('button', {name:'关闭',exact:true}).count()) await page.getByRole('button', {name:'关闭',exact:true}).click();
  if (await page.getByRole('button', {name:'内存库 · memory（临时）',exact:true}).count()) {
    await page.getByRole('button', {name:'内存库 · memory（临时）',exact:true}).click();
    await page.getByRole('option', {name:'持久库 · duckdb_manager_workspace',exact:true}).click();
  }
  await page.getByRole('button', {name:'持久库 · duckdb_manager_workspace',exact:true}).waitFor();
  await page.getByRole('button', {name:'导入数据',exact:true}).click();
  await page.locator('input[type="file"]').setInputFiles('data/crud-lab/baseline.duckdb');
  await page.getByText('已准备好导入数据',{exact:true}).waitFor({timeout:30000});
  await page.getByRole('button', {name:'批量导入选中的 8 个工作表',exact:true}).click();
  return await page.locator('body').innerText();
}
