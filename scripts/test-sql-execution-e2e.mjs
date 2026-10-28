import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const userData = path.join(os.tmpdir(), 'edge-sql-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Testing end-to-end SQL execution...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
    `--user-data-dir=${userData}`,
    'http://localhost:5173/DuckDB_Editor_Pro/',
  ]);

  try {
    let pageWsUrl = null;
    for (let i = 0; i < 40; i++) {
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

    if (!pageWsUrl) throw new Error('WebSocket URL not found on Edge debug port');

    const ws = new WebSocket(pageWsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const pendingHandlers = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pendingHandlers.has(data.id)) {
        const { resolve, reject } = pendingHandlers.get(data.id);
        pendingHandlers.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      pendingHandlers.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');

    for (let i = 0; i < 40; i++) {
      const evalRes = await call('Runtime.evaluate', {
        expression: `!document.body.innerText.includes('正在初始化') && !!document.querySelector('main')`,
        returnByValue: true,
      });
      if (evalRes?.result?.value) break;
      await delay(800);
    }

    // Switch to SQL editor
    await call('Runtime.evaluate', {
      expression: `(async () => {
        const sqlTab = Array.from(document.querySelectorAll('[role="tab"], button')).find(b => (b.innerText || '').trim().startsWith('SQL'));
        if (sqlTab) sqlTab.click();
      })()`,
      awaitPromise: true,
    });
    await delay(1500);

    // Execute query via button
    const execRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        const runBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('运行') || (b.title || '').includes('运行'));
        if (!runBtn) return { success: false, reason: 'No run button' };
        runBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        const bodyText = document.body.innerText;
        const hasResult = bodyText.includes('查询成功') || bodyText.includes('行') || document.querySelectorAll('table tbody tr').length > 0;
        return {
          success: true,
          buttonFound: true,
          hasResult,
          rowCount: document.querySelectorAll('table tbody tr').length,
          preview: bodyText.slice(0, 300),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log('SQL Execution Result:', JSON.stringify(execRes?.result?.value, null, 2));

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
