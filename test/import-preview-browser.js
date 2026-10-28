async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: '导入数据', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles('data/crud-lab/baseline.duckdb');
  await page.getByText('已准备好导入数据', { exact: true }).waitFor({ timeout: 30000 });
  const text = await page.locator('body').innerText();
  if (!text.includes('136') || !text.includes('main.crypto_transactions') || !text.includes('lab_baseline.crypto_transactions')) {
    throw new Error('Real database preview missing schema/table/row metadata');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: 'output/playwright/import-preview-fixed.png' });
  return { realFile: 'data/crud-lab/baseline.duckdb', totalRows: 136, schemas: ['main', 'lab_baseline'], pageErrors: errors };
}
