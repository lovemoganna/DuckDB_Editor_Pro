// Browser execution against the actual Vite app and DuckDB-WASM, using synthetic QA records.
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const dir = process.env.BPRD_SCREENSHOTS || '/tmp/bprd-browser';
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const steps = [];
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,300)));
  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByTestId('action-new-sql').waitFor({ timeout: 90000 });
    steps.push('dashboard_loaded');
    const upload = page.locator('input[type=file][accept*=".xlsx"]').first();
    await upload.setInputFiles('/tmp/bprd_browser_qa.xlsx');
    await page.getByText(/已成功挂载.*工作表/).first().waitFor({ timeout: 90000 });
    steps.push('xlsx_four_sheet_import');
    await page.getByTestId('action-new-sql').click();
    const editor = page.locator('.cm-content[contenteditable=true]').first();
    await editor.waitFor({ timeout: 25000 });
    const sql = 'SELECT u.country_code, COUNT(f.fiat_order_id) AS fiat_orders, SUM(f.amount) AS fiat_amount FROM bprd_browser_qa_users u JOIN bprd_browser_qa_fiat_transactions f ON CAST(u.uid AS VARCHAR) = CAST(f.uid AS VARCHAR) WHERE f.status = \'completed\' GROUP BY u.country_code ORDER BY fiat_amount DESC';
    await editor.fill(sql);
    await page.locator('button[title="运行 SQL (Ctrl+Enter)"]').click();
    await page.getByText('fiat_amount', {exact:true}).first().waitFor({timeout:60000});
    steps.push('duckdb_wasm_sql_result');
    await page.locator('button[title="可视化图表"]').first().click();
    await page.getByRole('button', {name:'新建可视化'}).click();
    await page.getByRole('button', {name:'Save Chart'}).click();
    await page.locator('canvas').first().waitFor({timeout:40000});
    const box = await page.locator('canvas').first().evaluate(el => ({width:el.width,height:el.height}));
    assert(box.width>0 && box.height>0, 'chart canvas was not rendered');
    steps.push('chartjs_canvas_render');
    await page.screenshot({path:path.join(dir,'chart.png'),fullPage:true});
    console.log('BPRD_BROWSER_PASS', JSON.stringify({steps,canvas:box,pageErrors:errors.slice(0,5)}));
  } catch (error) {
    await page.screenshot({path:path.join(dir,'error.png'),fullPage:true}).catch(()=>{});
    console.error('BPRD_BROWSER_FAIL',JSON.stringify({steps,error:String(error),pageErrors:errors.slice(0,8)}));
    process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e);process.exitCode=1;});
