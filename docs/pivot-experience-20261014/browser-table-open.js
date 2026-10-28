async (page) => {
  page.setDefaultTimeout(15000);
  await page.getByRole('button',{name:'工程核心',exact:true}).click();
  await page.getByRole('tab',{name:'SQL',exact:true}).click();
  await page.getByRole('textbox').nth(1).fill('CREATE TABLE IF NOT EXISTS pivot_qa_functions AS SELECT function_type, return_type, len(parameters) AS parameter_count FROM duckdb_functions()');
  await page.getByRole('button',{name:'运行',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='停止' || b.textContent==='停止')?.disabled,null,{timeout:30000});
  await page.getByRole('tab',{name:'数据',exact:true}).click();
}
