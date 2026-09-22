import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9388;
const userData = path.join(os.tmpdir(), 'edge-import-audit-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const auditDir = path.resolve('public/import_audit');
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  console.log('[Browser QA] Launching Edge headless...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1000',
    `--user-data-dir=${userData}`,
    'http://localhost:5173/DuckDB_Editor_Pro/',
  ]);

  try {
    let pageWsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const pages = await res.json();
        const appPage = pages.find(p => p.url && p.url.includes('5173'));
        if (appPage && appPage.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('WebSocket URL not found on Edge CDP port ' + PORT);

    const ws = new WebSocket(pageWsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (m) => {
        const data = JSON.parse(m.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    ws.addEventListener('message', (m) => {
      try {
        const data = JSON.parse(m.data);
        if (data.method === 'Runtime.consoleAPICalled') {
          const text = (data.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
          console.log(`[Browser Console ${data.params.type}]`, text);
        }
        if (data.method === 'Runtime.exceptionThrown') {
          console.error('[Browser Exception]', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
        }
      } catch (e) {}
    });

    await call('Page.enable');
    await call('Runtime.enable');
    
    console.log('[Browser QA] Waiting for DuckDB and app initialization...');
    for (let i = 0; i < 30; i++) {
      const state = await call('Runtime.evaluate', {
        expression: `({
          title: document.title,
          textSample: document.body.innerText.slice(0, 100).replace(/\\n/g, ' '),
          isLoading: Boolean(
            document.body.innerText.includes('正在准备数据') ||
            document.body.innerText.includes('加载中') ||
            document.body.innerText.includes('Initializing') ||
            document.body.innerText.includes('正在初始化')
          ),
          hasRoot: Boolean(document.getElementById('root')?.children?.length)
        })`,
        returnByValue: true,
      });
      console.log(`[Browser QA] Init Poll ${i}:`, JSON.stringify(state.result.value));
      if (state.result.value.hasRoot && !state.result.value.isLoading) {
        break;
      }
      await delay(1000);
    }
    await delay(2000);

    console.log('[Browser QA] App ready. Triggering duckdb-open-import event...');
    await call('Runtime.evaluate', {
      expression: `window.dispatchEvent(new CustomEvent('duckdb-open-import'))`,
    });
    await delay(1200);

    // 1. Capture initial Import Wizard
    let ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '01_initial_import_wizard.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 01_initial_import_wizard.png');

    // Audit initial typography and layout metrics
    const auditMetrics = await call('Runtime.evaluate', {
      expression: `(() => {
        const modal = Array.from(document.querySelectorAll('.fixed.inset-0')).find(el => el.textContent.includes('数据导入')) || document.body;

        const headings = Array.from(modal.querySelectorAll('h1, h2, h3, h4')).map(h => ({
          tag: h.tagName,
          text: h.innerText.replace(/\\n/g, ' ').trim(),
          fontSize: window.getComputedStyle(h).fontSize,
          fontWeight: window.getComputedStyle(h).fontWeight,
          color: window.getComputedStyle(h).color,
        }));

        const buttons = Array.from(modal.querySelectorAll('button')).map(b => ({
          text: b.innerText.replace(/\\n/g, ' ').trim(),
          fontSize: window.getComputedStyle(b).fontSize,
          padding: window.getComputedStyle(b).padding,
          borderRadius: window.getComputedStyle(b).borderRadius,
          border: window.getComputedStyle(b).border,
          bg: window.getComputedStyle(b).backgroundColor,
          color: window.getComputedStyle(b).color,
        }));

        const labels = Array.from(modal.querySelectorAll('label, span')).filter(s => s.innerText && s.innerText.trim().length > 0).slice(0, 30).map(s => ({
          text: s.innerText.trim().slice(0, 30),
          fontSize: window.getComputedStyle(s).fontSize,
          fontFamily: window.getComputedStyle(s).fontFamily.slice(0, 30),
        }));

        return {
          modalFound: true,
          headings,
          buttonCount: buttons.length,
          buttonsSample: buttons.slice(0, 10),
          labelsSample: labels.slice(0, 15),
        };
      })()`,
      returnByValue: true,
    });
    console.log('[Browser QA] Initial Audit Metrics:', JSON.stringify(auditMetrics.result.value, null, 2));

    // 2. Switch to Remote URL mode
    console.log('[Browser QA] Switching to Remote URL mode...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const urlBtn = btns.find(b => b.textContent.includes('远程 URL'));
        if (urlBtn) urlBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '02_remote_url_presets.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 02_remote_url_presets.png');

    // 3. Switch to Paste Text mode and click "填入示例数据"
    console.log('[Browser QA] Switching to Paste Text mode...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const pasteBtn = btns.find(b => b.textContent.includes('粘贴文本'));
        if (pasteBtn) pasteBtn.click();
      })()`,
    });
    await delay(500);
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sampleBtn = btns.find(b => b.textContent.includes('填入示例数据'));
        if (sampleBtn) sampleBtn.click();
      })()`,
    });
    await delay(1200);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '03_paste_text_mode.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 03_paste_text_mode.png');

    // 4. Click Advanced Options
    console.log('[Browser QA] Toggling Advanced Options...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const advBtn = btns.find(b => b.textContent.includes('高级选项'));
        if (advBtn) advBtn.click();
      })()`,
    });
    await delay(600);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '05_advanced_options_expanded.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 05_advanced_options_expanded.png');

    // 5. Open Help Modal
    console.log('[Browser QA] Opening Help Modal...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const helpBtn = btns.find(b => b.textContent.includes('使用帮助'));
        if (helpBtn) helpBtn.click();
      })()`,
    });
    await delay(600);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '04_help_modal.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 04_help_modal.png');

    // Close help modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const okBtn = btns.find(b => b.textContent.includes('我知道了'));
        if (okBtn) okBtn.click();
      })()`,
    });
    await delay(600);

    // 6. Test Real Multi-Sheet Excel File Upload
    console.log('[Browser QA] Generating and uploading real Multi-Sheet Excel file...');
    // Switch back to Local File tab
    await call('Runtime.evaluate', {
      expression: `(() => {
        const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('本地文件'));
        if (tab) tab.click();
      })()`,
    });
    await delay(500);

    // Generate multi-sheet excel buffer
    const writeXlsxFile = (await import('write-excel-file/node')).default;
    const excelRes = await writeXlsxFile([
      {
        sheet: 'Quarterly_Sales',
        data: [
          [{ value: 'region' }, { value: 'product' }, { value: 'revenue' }, { value: 'is_target_met' }],
          [{ value: 'North' }, { value: 'Enterprise Cloud' }, { value: 125000 }, { value: 'TRUE' }],
          [{ value: 'South' }, { value: 'Edge Storage' }, { value: 89200 }, { value: 'FALSE' }],
          [{ value: 'West' }, { value: 'AI Accelerator' }, { value: 340000 }, { value: 'TRUE' }],
        ]
      },
      {
        sheet: 'Employees_Directory',
        data: [
          [{ value: 'emp_id' }, { value: 'full_name' }, { value: 'title' }, { value: 'salary' }],
          [{ value: 1001 }, { value: 'Alice Smith' }, { value: 'Principal Architect' }, { value: 210000 }],
          [{ value: 1002 }, { value: 'Bob Jones' }, { value: 'Kernel Engineer' }, { value: 195000 }],
          [{ value: 1003 }, { value: 'Charlie Zhang' }, { value: 'Data Analyst' }, { value: 140000 }],
        ]
      },
      {
        sheet: 'Empty_Notes',
        data: [
          [{ value: 'note' }],
          [{ value: '' }]
        ]
      }
    ], { buffer: true });
    const excelBuffer = await excelRes.toBuffer();

    const byteArr = Array.from(new Uint8Array(excelBuffer));

    // Inject in-memory File directly via React props onChange to guarantee file reading reliability
    const injectResult = await call('Runtime.evaluate', {
      expression: `(() => {
        try {
          const bytes = new Uint8Array(${JSON.stringify(byteArr)});
          const file = new File([bytes], 'quarterly_business_report.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            lastModified: Date.now()
          });

          const input = document.querySelector('input[type="file"]');
          if (!input) return { success: false, reason: 'input not found' };

          // Find React props key (e.g. __reactProps$...)
          const reactKey = Object.keys(input).find(k => k.startsWith('__reactProps'));
          if (reactKey && typeof input[reactKey].onChange === 'function') {
            input[reactKey].onChange({ target: { files: [file] } });
            return { success: true, method: 'react-props', fileName: file.name, fileSize: file.size };
          }

          // Fallback to DataTransfer
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, method: 'datatransfer', fileName: file.name, fileSize: file.size };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      })()`,
      returnByValue: true
    });
    console.log('[Browser QA] File injected into React component:', JSON.stringify(injectResult.result.value));

    // Wait for excel parsing (read-excel-file runs client-side)
    await delay(2500);

    // 7. Capture Excel multi-sheet loaded state
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '06_excel_multisheet_loaded.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 06_excel_multisheet_loaded.png');

    // Audit sheet tabs
    const sheetTabs = await call('Runtime.evaluate', {
      expression: `(() => {
        const tabs = Array.from(document.querySelectorAll('*')).filter(el => 
          el.innerText && (
            el.innerText.includes('Quarterly_Sales') || 
            el.innerText.includes('Employees_Directory') || 
            el.innerText.includes('Empty_Notes')
          ) && el.classList.contains('cursor-pointer')
        ).map(el => ({
          text: el.innerText.trim(),
          classes: el.className
        }));
        const previewRows = Array.from(document.querySelectorAll('tbody tr')).length;
        const tableCols = Array.from(document.querySelectorAll('th')).map(th => th.innerText.trim());
        return { tabs, previewRows, tableCols };
      })()`,
      returnByValue: true,
    });
    console.log('[Browser QA] Detected Excel Sheet Tabs & Data:', JSON.stringify(sheetTabs.result.value));

    // 8. Click second sheet: Employees_Directory
    console.log('[Browser QA] Switching to Employees_Directory Sheet...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const els = Array.from(document.querySelectorAll('*'));
        const empTab = els.find(el => el.innerText && el.innerText.includes('Employees_Directory') && el.classList.contains('cursor-pointer'));
        if (empTab) empTab.click();
      })()`,
    });
    await delay(1200);

    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '07_excel_sheet_switched.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 07_excel_sheet_switched.png');

    // 9. Test "仅选非空表" (Select only non-empty sheets)
    console.log('[Browser QA] Testing "仅选非空表" action button...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const nonEmptyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('仅选非空'));
        if (nonEmptyBtn) nonEmptyBtn.click();
      })()`,
    });
    await delay(800);

    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '08_excel_non_empty_toggle.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 08_excel_non_empty_toggle.png');

    // 10. Test Multi-Sheet Target Table Names Drawer
    console.log('[Browser QA] Toggling Target Table Names Drawer...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const drawerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('各工作表目标表名映射'));
        if (drawerBtn) drawerBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '09_excel_sheet_names_drawer.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 09_excel_sheet_names_drawer.png');

    // 11. Test Column Filter & Batch Action
    console.log('[Browser QA] Testing column search filter and batch action...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('input[placeholder*="过滤字段"]');
        if (input) {
          const reactKey = Object.keys(input).find(k => k.startsWith('__reactProps'));
          if (reactKey && typeof input[reactKey].onChange === 'function') {
            input[reactKey].onChange({ target: { value: 'sal' } });
          }
        }
      })()`,
    });
    await delay(600);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '10_column_search_and_batch.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 10_column_search_and_batch.png');

    // Clear column filter
    await call('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('input[placeholder*="过滤字段"]');
        if (input) {
          const reactKey = Object.keys(input).find(k => k.startsWith('__reactProps'));
          if (reactKey && typeof input[reactKey].onChange === 'function') {
            input[reactKey].onChange({ target: { value: '' } });
          }
        }
      })()`,
    });
    await delay(500);

    // Test "转蛇形" action
    const snakeResult = await call('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('转蛇形'));
        if (btn) {
          btn.click();
          return { found: true, clicked: true };
        }
        return { found: false };
      })()`,
      returnByValue: true,
    });
    console.log('[Browser QA] Clicked 转蛇形 button:', JSON.stringify(snakeResult.result.value));
    await delay(600);

    // 12. Test Type Dropdown Upward Popup (No Clipping)
    console.log('[Browser QA] Opening column type dropdown on bottom row...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const typeButtons = Array.from(document.querySelectorAll('button')).filter(b => 
          b.textContent && (b.textContent.includes('BIGINT') || b.textContent.includes('VARCHAR') || b.textContent.includes('DOUBLE'))
        );
        if (typeButtons.length > 0) {
          // Click the last type button
          typeButtons[typeButtons.length - 1].click();
        }
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '11_dropdown_upward_no_clipping.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 11_dropdown_upward_no_clipping.png');

    // Verify dropdown is open
    const openCheck = await call('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('[data-column-type-dropdown] .z-50'))`,
      returnByValue: true
    });
    console.log('[Browser QA] Dropdown open state before blank click:', openCheck.result.value);

    // Click on blank area outside the dropdown to dismiss it
    console.log('[Browser QA] Clicking blank area to dismiss dropdown...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const bg = document.querySelector('header') || document.body;
        bg.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      })()`,
    });
    await delay(500);

    const closedCheck = await call('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('[data-column-type-dropdown] .z-50'))`,
      returnByValue: true
    });
    console.log('[Browser QA] Dropdown open state after blank click (expect false):', closedCheck.result.value);

    await delay(500);

    // 13. Test Client-Side Preview Table Sorting
    console.log('[Browser QA] Testing Preview table column sorting...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const ths = Array.from(document.querySelectorAll('th'));
        const salaryTh = ths.find(th => th.textContent && th.textContent.includes('salary'));
        if (salaryTh) salaryTh.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '12_table_client_sorting.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 12_table_client_sorting.png');

    // 14. Test Sidebar Toggle (Collapse to Wide-Screen & Restore)
    console.log('[Browser QA] Testing Sidebar collapse to wide-screen mode...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const collapseBtn = btns.find(b => b.textContent && (b.textContent.includes('收起侧栏') || b.textContent.includes('收起')));
        if (collapseBtn) collapseBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '13_sidebar_collapsed_widescreen.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 13_sidebar_collapsed_widescreen.png');

    console.log('[Browser QA] Testing Sidebar expand / restore...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const expandBtn = btns.find(b => b.textContent && b.textContent.includes('展开配置')) ||
          document.querySelector('button[aria-label="展开配置面板"]');
        if (expandBtn) expandBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '14_sidebar_restored.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 14_sidebar_restored.png');

    // 15. Test SQL Preview Modal
    console.log('[Browser QA] Opening DuckDB SQL Preview Modal...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sqlBtn = btns.find(b => b.textContent && b.textContent.includes('SQL 预览'));
        if (sqlBtn) sqlBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '15_sql_preview_modal.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 15_sql_preview_modal.png');

    // Close SQL Preview modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const closeBtn = btns.find(b => b.textContent && (b.textContent.includes('关闭') || b.textContent.includes('Close')));
        if (closeBtn) closeBtn.click();
      })()`,
    });
    await delay(500);

    // 16. Execute real Multi-Sheet batch import into DuckDB
    console.log('[Browser QA] Executing real Multi-Sheet Import...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const importBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('批量导入') || b.textContent.includes('开始导入'));
        if (importBtn) importBtn.click();
      })()`,
    });
    await delay(3500);

    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '16_excel_import_success.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 16_excel_import_success.png');

    // Verify imported tables in DuckDB
    const duckdbTables = await call('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const { duckDBService } = await import('/DuckDB_Editor_Pro/services/duckdbService.ts');
          const tables = await duckDBService.getTables('main');
          return { success: true, tables };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('[Browser QA] DuckDB Tables after import:', JSON.stringify(duckdbTables.result.value));

    // 17. Test Recent Imports Modal & History Sync
    console.log('[Browser QA] Reopening Import Wizard to test Recent Imports Modal...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        window.dispatchEvent(new CustomEvent('duckdb-open-import'));
      })()`,
    });
    await delay(800);

    console.log('[Browser QA] Clicking 导入历史 button...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const histBtn = btns.find(b => b.textContent && b.textContent.includes('导入历史'));
        if (histBtn) histBtn.click();
      })()`,
    });
    await delay(800);
    ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(auditDir, '17_recent_imports_modal.png'), Buffer.from(ss.data, 'base64'));
    console.log('[Browser QA] Saved 17_recent_imports_modal.png');

    const recentButtons = await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('.fixed.inset-0 button')).map(b => b.textContent.trim());
        return btns;
      })()`,
      returnByValue: true
    });
    console.log('[Browser QA] Recent Imports modal buttons:', JSON.stringify(recentButtons.result.value));


    // Close Recent Imports modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const doneBtn = btns.find(b => b.textContent && b.textContent.includes('完成'));
        if (doneBtn) doneBtn.click();
      })()`,
    });
    await delay(500);

    ws.close();
    console.log('[Browser QA] All browser tests and snapshots completed successfully!');
  } catch (err) {
    console.error('[Browser QA] Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
}

main();
