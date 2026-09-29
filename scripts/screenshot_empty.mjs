import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9401;
const userData = path.join(os.tmpdir(), 'edge-dash-empty-' + Date.now());

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

    await call('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('duckdb_dashboard_layout_mode', 'mission-control');
      })()`,
    });

    await delay(1500);

    const ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('public/refactored_empty_dashboard.png', Buffer.from(ss.data, 'base64'));
    console.log('Saved empty dashboard screenshot to public/refactored_empty_dashboard.png');

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
