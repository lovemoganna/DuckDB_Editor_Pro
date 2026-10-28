import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9433;
const userData = path.join(os.tmpdir(), 'edge-modals-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Testing all system modals and action buttons...');
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

  const consoleLogs = [];
  const uncaughtErrors = [];
  const modalResults = [];

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
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params.type;
        const text = data.params.args.map(a => a.value || a.description || '').join(' ');
        if (type === 'error') {
          consoleLogs.push({ type, text });
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        uncaughtErrors.push({
          text: data.params.exceptionDetails?.text || 'Uncaught error',
          exception: data.params.exceptionDetails?.exception?.description || '',
        });
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

    const testModal = async (name, openEvent, triggerMethod) => {
      const initialErrorCount = uncaughtErrors.length;
      const res = await call('Runtime.evaluate', {
        expression: `(async () => {
          if ('${triggerMethod}' === 'event') {
            window.dispatchEvent(new CustomEvent('${openEvent}'));
          }
          await new Promise(r => setTimeout(r, 600));
          const dialog = document.querySelector('[role="dialog"], .fixed.inset-0');
          const opened = !!dialog;
          const text = dialog ? dialog.innerText.slice(0, 150) : '';

          // Check for any obvious styling or accessibility issues
          const buttons = dialog ? Array.from(dialog.querySelectorAll('button')) : [];
          const unnamedButtons = buttons.filter(b => !b.innerText.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length;

          // Try closing with Escape
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
          const closedWithEsc = !document.querySelector('[role="dialog"]');

          // If still open, try close button
          if (!closedWithEsc && dialog) {
            const closeBtn = dialog.querySelector('button[aria-label*="关闭"], button[title*="关闭"], button.absolute.top-');
            if (closeBtn) closeBtn.click();
            await new Promise(r => setTimeout(r, 300));
          }

          return {
            opened,
            text,
            buttonCount: buttons.length,
            unnamedButtons,
            closedWithEsc,
          };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });

      const newErrors = uncaughtErrors.slice(initialErrorCount);
      return {
        name,
        ...res?.result?.value,
        errors: newErrors,
      };
    };

    const modalsToTest = [
      { name: '数据导入', event: 'open-import-modal', method: 'event' },
      { name: '新建数据表', event: 'open-create-table-modal', method: 'event' },
      { name: '新建视图', event: 'open-create-view-modal', method: 'event' },
      { name: '数据库管理', event: 'open-project-manager-modal', method: 'event' },
      { name: '导出数据库', event: 'open-export-database-modal', method: 'event' },
      { name: '工作区备份', event: 'open-workspace-backup-modal', method: 'event' },
      { name: 'AI 模型设置', event: 'open-settings-modal', method: 'event' },
      { name: '快捷键列表', event: 'open-keyboard-shortcuts', method: 'event' },
    ];

    for (const m of modalsToTest) {
      console.log(`Testing modal: ${m.name}...`);
      const r = await testModal(m.name, m.event, m.method);
      modalResults.push(r);
      await delay(500);
    }

    // Now test SQL Editor query execution
    console.log('Testing real SQL execution in SQL Editor...');
    await call('Runtime.evaluate', {
      expression: `(async () => {
        const sqlTab = Array.from(document.querySelectorAll('[role="tab"], button')).find(b => (b.innerText || '').trim().startsWith('SQL'));
        if (sqlTab) sqlTab.click();
      })()`,
      awaitPromise: true,
    });
    await delay(1200);

    const sqlExecRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        // Find run button
        const runBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('运行') || (b.title || '').includes('运行'));
        if (!runBtn) return { hasRunBtn: false };

        // Check if query error or result appears
        return {
          hasRunBtn: true,
          disabled: runBtn.disabled,
          text: runBtn.innerText.trim(),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const report = {
      modalResults,
      sqlExecRes: sqlExecRes?.result?.value,
      uncaughtErrors,
      consoleErrors: consoleLogs,
    };

    const outPath = path.resolve(process.cwd(), 'audit-modal-results.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Saved results to ${outPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
