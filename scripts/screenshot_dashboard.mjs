import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9399;
const userData = path.join(os.tmpdir(), 'edge-dash-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1680,1050',
    `--user-data-dir=${userData}`,
    'http://localhost:5175/DuckDB_Editor_Pro/',
  ]);

  try {
    let pageWsUrl = null;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const pages = await res.json();
        const appPage = pages.find(p => p.url && p.url.includes('5175'));
        if (appPage && appPage.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('WebSocket URL not found');

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

    await call('Page.enable');
    await call('Runtime.enable');
    
    // Wait for the app to be fully mounted and ready
    for (let i = 0; i < 40; i++) {
      const state = await call('Runtime.evaluate', {
        expression: `(() => {
          const text = document.body.innerText;
          const hasTabs = Boolean(document.querySelector('button[role="tab"]') || text.includes('总览') || text.includes('控制中心') || text.includes('数据表'));
          const isLoading = text.includes('正在初始化');
          return { hasTabs, isLoading, textLen: text.length };
        })()`,
        returnByValue: true,
      });
      if (state?.result?.value?.hasTabs && !state?.result?.value?.isLoading) {
        break;
      }
      await delay(1000);
    }
    await delay(1500);

    // Make sure we are on mission control mode
    await call('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('duckdb_dashboard_layout_mode', 'mission-control');
      })()`,
    });

    // Seed realistic tables and queries directly into DuckDB
    await call('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const { seedDemoWorkbenchData } = await import('/DuckDB_Editor_Pro/components/Workbench/seedWorkbenchData.ts');
          await seedDemoWorkbenchData();
          const { useSqlEditorStore } = await import('/DuckDB_Editor_Pro/hooks/store/useSqlEditorStore.ts');
          const store = useSqlEditorStore.getState();
          store.addHistory({ id: 'q-1', sql: "SELECT * FROM orders WHERE status = 'completed' LIMIT 50;", timestamp: new Date().toISOString(), executionTime: 18, rowCount: 50, status: 'success' });
          store.addHistory({ id: 'q-2', sql: "SELECT region, SUM(revenue) FROM sales GROUP BY region;", timestamp: new Date().toISOString(), executionTime: 42, rowCount: 4, status: 'success' });
          store.addHistory({ id: 'q-3', sql: "SELECT * FROM unnest(range(1000000)) t(i) WHERE i % 7 = 0;", timestamp: new Date().toISOString(), executionTime: 320, rowCount: 142857, status: 'success' });
          store.addHistory({ id: 'q-4', sql: "SELECT * FROM non_existent_table WHERE id = 1;", timestamp: new Date().toISOString(), executionTime: 5, rowCount: 0, status: 'error', error: 'Catalog Error: Table non_existent_table does not exist' });
          window.dispatchEvent(new CustomEvent('duckdb:refresh-tables'));
          return 'SEEDED_SUCCESS';
        } catch(e) {
          return 'SEED_ERROR: ' + e.message;
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    await delay(2500);

    const debugInfo = await call('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasGauges = text.includes('查询成功率') || text.includes('系统状态');
        const headings = Array.from(document.querySelectorAll('h2, h3')).map(h => h.innerText);
        const actionEl = document.querySelector('.relative.flex.flex-col.flex-1');
        return { hasGauges, headings, actionHeight: actionEl?.clientHeight, actionScrollHeight: actionEl?.scrollHeight };
      })()`,
      returnByValue: true,
    });
    console.log('DEBUG INFO:', JSON.stringify(debugInfo?.result?.value));

    const ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('public/refactored_populated_dashboard.png', Buffer.from(ss.data, 'base64'));
    console.log('Saved populated dashboard screenshot to public/refactored_populated_dashboard.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
}

main();
