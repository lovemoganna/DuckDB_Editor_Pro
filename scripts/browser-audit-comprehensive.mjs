import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9422;
const userData = path.join(os.tmpdir(), 'edge-audit-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting headless Edge for comprehensive browser audit...');
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
  const auditReport = {
    timestamp: new Date().toISOString(),
    runs: [],
    consoleErrors: [],
    unnamedButtons: [],
    overflowIssues: [],
    modalChecks: [],
    sqlChecks: [],
  };

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
        if (type === 'error' || type === 'warn') {
          consoleLogs.push({ type, text, timestamp: Date.now() });
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        uncaughtErrors.push({
          text: data.params.exceptionDetails?.text || 'Uncaught error',
          exception: data.params.exceptionDetails?.exception?.description || '',
          url: data.params.exceptionDetails?.url,
          line: data.params.exceptionDetails?.lineNumber,
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

    console.log('Waiting for DuckDB Studio / App initialization...');
    for (let i = 0; i < 40; i++) {
      const evalRes = await call('Runtime.evaluate', {
        expression: `(() => {
          const bodyText = document.body.innerText || '';
          const hasStudio = bodyText.includes('DuckDB') || !!document.querySelector('header, nav, main');
          const hasSpinners = !!document.querySelector('.animate-spin');
          return { ready: hasStudio && !bodyText.includes('正在初始化'), textLen: bodyText.length, hasSpinners };
        })()`,
        returnByValue: true,
      });
      if (evalRes?.result?.value?.ready) {
        console.log('App loaded and ready.');
        break;
      }
      await delay(800);
    }

    const setViewport = async (width, height) => {
      await call('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      await delay(300);
    };

    const setTheme = async (theme) => {
      await call('Runtime.evaluate', {
        expression: `(async () => {
          const cur = document.documentElement.dataset.theme || 'dark';
          if (cur !== '${theme}') {
            const btn = document.querySelector('button[aria-label*="主题"], button[title*="模式"], button[aria-label*="模式"]') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('浅色') || b.innerText.includes('深色') || b.innerText.includes('主题'));
            if (btn) {
              btn.click();
            } else {
              document.documentElement.dataset.theme = '${theme}';
            }
          }
        })()`,
        awaitPromise: true,
      });
      await delay(300);
    };

    const scanCurrentView = async (domainName, tabName, theme, viewportName) => {
      const res = await call('Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          const main = document.querySelector('main') || document.body;

          // Check overflow
          const visible = el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };

          const allElements = Array.from(main.querySelectorAll('*')).filter(visible);
          const overflowing = [];
          for (const el of allElements) {
            const r = el.getBoundingClientRect();
            if (r.right > winW + 3) {
              // check if it's within a deliberate scroll container
              let p = el.parentElement;
              let inScroll = false;
              while (p && p !== document.body) {
                const ps = getComputedStyle(p);
                if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') {
                  inScroll = true;
                  break;
                }
                p = p.parentElement;
              }
              if (!inScroll) {
                overflowing.push({
                  tag: el.tagName,
                  text: (el.textContent || '').trim().slice(0, 40),
                  cls: String(el.className || '').slice(0, 80),
                  right: Math.round(r.right),
                  winW,
                });
              }
            }
          }

          // Unnamed buttons
          const buttons = Array.from(document.querySelectorAll('button')).filter(visible);
          const unnamed = [];
          for (const btn of buttons) {
            const hasText = !!btn.innerText.trim();
            const hasAria = !!(btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby') || btn.getAttribute('title'));
            const hasSvgDesc = !!btn.querySelector('svg title');
            if (!hasText && !hasAria && !hasSvgDesc) {
              unnamed.push({
                cls: String(btn.className || '').slice(0, 80),
                html: btn.outerHTML.slice(0, 150),
              });
            }
          }

          // Alerts or error states
          const alerts = Array.from(document.querySelectorAll('[role="alert"], .text-red-500, .bg-red-500\\/10')).filter(visible).map(e => e.textContent?.trim().slice(0, 100));

          // Disabled buttons
          const disabledCount = buttons.filter(b => b.disabled || b.getAttribute('aria-disabled') === 'true').length;

          // Active tab confirmation
          const activeTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]')).map(t => t.textContent?.trim());

          return {
            docW,
            winW,
            hasDocHScroll: docW > winW + 5,
            overflowCount: overflowing.length,
            overflowSamples: overflowing.slice(0, 5),
            buttonCount: buttons.length,
            unnamedButtonCount: unnamed.length,
            unnamedSamples: unnamed.slice(0, 5),
            disabledCount,
            alerts,
            activeTabs,
          };
        })()`,
        returnByValue: true,
      });
      return res?.result?.value || {};
    };

    const switchDomainAndTab = async (domainName, tabName) => {
      const switched = await call('Runtime.evaluate', {
        expression: `(async () => {
          // Find domain button
          const domainBtns = Array.from(document.querySelectorAll('button, [role="tab"]'));
          const dBtn = domainBtns.find(b => (b.innerText || '').trim() === '${domainName}');
          if (dBtn) {
            dBtn.click();
            await new Promise(r => setTimeout(r, 200));
          }
          // Find tab button
          const tabBtns = Array.from(document.querySelectorAll('button, [role="tab"]'));
          const tBtn = tabBtns.find(b => (b.innerText || '').trim().startsWith('${tabName}'));
          if (tBtn) {
            tBtn.click();
            await new Promise(r => setTimeout(r, 400));
            return true;
          }
          return false;
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(400);
      return switched?.result?.value;
    };

    const domains = [
      { name: '工程核心', tabs: ['仪表盘', '数据', 'Schema', 'SQL', '数据流'] },
      { name: '分析洞察', tabs: ['指标', '可视化', '分析', '历史', '审计'] },
      { name: '知识沉淀', tabs: ['知识资产', '插件', '知识联动'] },
      { name: 'AI 认知', tabs: ['本体图谱', '技能', '能力', '推演'] },
    ];

    const configs = [
      { viewport: { width: 1440, height: 1000 }, vpName: 'desktop-1440', theme: 'dark' },
      { viewport: { width: 1440, height: 1000 }, vpName: 'desktop-1440', theme: 'light' },
      { viewport: { width: 390, height: 844 }, vpName: 'mobile-390', theme: 'light' },
      { viewport: { width: 390, height: 844 }, vpName: 'mobile-390', theme: 'dark' },
    ];

    console.log('Running comprehensive view scan across 17 views, 2 viewports, 2 themes...');

    for (const cfg of configs) {
      console.log(`\n--- Config: ${cfg.vpName} / ${cfg.theme} ---`);
      await setViewport(cfg.viewport.width, cfg.viewport.height);
      await setTheme(cfg.theme);

      for (const dom of domains) {
        for (const tab of dom.tabs) {
          const ok = await switchDomainAndTab(dom.name, tab);
          const scan = await scanCurrentView(dom.name, tab, cfg.theme, cfg.vpName);

          const runInfo = {
            domain: dom.name,
            tab,
            config: `${cfg.vpName}-${cfg.theme}`,
            switched: ok,
            docW: scan.docW,
            winW: scan.winW,
            hasDocHScroll: scan.hasDocHScroll,
            overflowCount: scan.overflowCount,
            unnamedButtonCount: scan.unnamedButtonCount,
            disabledCount: scan.disabledCount,
            alerts: scan.alerts,
            overflowSamples: scan.overflowSamples,
            unnamedSamples: scan.unnamedSamples,
          };
          auditReport.runs.push(runInfo);

          if (scan.hasDocHScroll || scan.overflowCount > 0) {
            auditReport.overflowIssues.push({
              view: `${dom.name}-${tab}`,
              cfg: `${cfg.vpName}-${cfg.theme}`,
              docW: scan.docW,
              winW: scan.winW,
              samples: scan.overflowSamples,
            });
          }

          if (scan.unnamedButtonCount > 0) {
            auditReport.unnamedButtons.push({
              view: `${dom.name}-${tab}`,
              cfg: `${cfg.vpName}-${cfg.theme}`,
              samples: scan.unnamedSamples,
            });
          }
        }
      }
    }

    // Now test Interactive Modals on Desktop
    console.log('\n--- Testing Interactive Modals ---');
    await setViewport(1440, 1000);
    await setTheme('dark');

    // 1. Test Import Modal
    const importRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        const importBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('导入数据') || (b.getAttribute('title') || '').includes('导入'));
        if (!importBtn) return { found: false };
        importBtn.click();
        await new Promise(r => setTimeout(r, 600));
        const dialog = document.querySelector('[role="dialog"]');
        const hasDialog = !!dialog;
        const dialogText = dialog ? dialog.innerText.slice(0, 100) : '';
        // Press Escape to close
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const stillOpen = !!document.querySelector('[role="dialog"]');
        return { found: true, opened: hasDialog, title: dialogText, closedWithEsc: !stillOpen };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    auditReport.modalChecks.push({ name: 'ImportModal', ...importRes?.result?.value });

    // 2. Test Shortcuts Modal (usually ? key)
    const shortcutRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const dialog = document.querySelector('[role="dialog"]');
        const opened = !!dialog;
        const text = dialog ? dialog.innerText.slice(0, 100) : '';
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        return { triggerKey: '?', opened, text, closedWithEsc: !document.querySelector('[role="dialog"]') };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    auditReport.modalChecks.push({ name: 'ShortcutsModal', ...shortcutRes?.result?.value });

    // 3. Test SQL Editor functionality
    console.log('\n--- Testing SQL Execution ---');
    await switchDomainAndTab('工程核心', 'SQL');
    await delay(1000);

    const sqlRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        // Look for run query button
        const runBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('运行') || (b.title || '').includes('运行'));
        const editor = document.querySelector('.cm-content');
        return {
          hasRunBtn: !!runBtn,
          hasCodeMirror: !!editor,
          runDisabled: runBtn?.disabled || runBtn?.getAttribute('aria-disabled') === 'true',
        };
      })()`,
      returnByValue: true,
    });
    auditReport.sqlChecks.push(sqlRes?.result?.value);

    auditReport.consoleErrors = consoleLogs;
    auditReport.uncaughtErrors = uncaughtErrors;

    const outPath = path.resolve(process.cwd(), 'audit-browser-results.json');
    fs.writeFileSync(outPath, JSON.stringify(auditReport, null, 2));
    console.log(`\nAudit completed! Report saved to ${outPath}`);
    console.log(`Total views checked: ${auditReport.runs.length}`);
    console.log(`Total console errors/warnings: ${consoleLogs.length}`);
    console.log(`Total uncaught errors: ${uncaughtErrors.length}`);
    console.log(`Total overflow issue views: ${auditReport.overflowIssues.length}`);
    console.log(`Total views with unnamed buttons: ${auditReport.unnamedButtons.length}`);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

main().catch(err => {
  console.error('Fatal error during browser audit:', err);
  process.exit(1);
});
