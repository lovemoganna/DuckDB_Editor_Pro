import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9346;
const userData = path.join(os.tmpdir(), 'edge-inspect-' + Date.now());

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
    'http://localhost:5173/DuckDB_Editor_Pro/',
  ]);

  try {
    let pageWsUrl = null;
    for (let i = 0; i < 25; i++) {
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
    await delay(1500);

    // Click "AI 认知"
    const clickDomain = await call('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(x => x.textContent.includes('AI') && x.textContent.includes('认知'));
        if (b) {
          b.click();
          return b.textContent.trim();
        }
        return 'not_found';
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    console.log('Domain button clicked:', clickDomain.result.value);

    // Wait for loading to finish
    for (let i = 0; i < 20; i++) {
      const loading = await call('Runtime.evaluate', {
        expression: `Boolean(document.body.innerText.includes('正在准备数据与执行环境') || document.body.innerText.includes('加载中...'))`,
        returnByValue: true,
      });
      if (!loading.result.value) break;
      await delay(800);
    }
    await delay(2000);

    // Inspect stats and graph elements
    const graphInfo = await call('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const statsMatch = text.match(/实体:\\s*(\\d+)[\\s\\S]*?关系:\\s*(\\d+)[\\s\\S]*?概念模式:\\s*(\\d+)[\\s\\S]*?关系类型:\\s*(\\d+)[\\s\\S]*?行动规则:\\s*(\\d+)/);
        
        const svg = document.querySelector('svg[role="img"]') || document.querySelector('.graph-container')?.closest('svg');
        const nodeEls = svg ? Array.from(svg.querySelectorAll('.nv-node')) : [];
        const linkEls = svg ? Array.from(svg.querySelectorAll('.nv-links path')) : [];
        
        const nodes = nodeEls.map(el => ({
          text: el.textContent?.trim(),
          class: el.getAttribute('class'),
          transform: el.getAttribute('transform')
        }));

        const links = linkEls.map(el => ({
          class: el.getAttribute('class'),
          d: el.getAttribute('d'),
          stroke: el.getAttribute('stroke'),
          opacity: el.style.opacity
        }));

        return {
          stats: statsMatch ? statsMatch[0] : 'no_stats_found',
          nodeCount: nodes.length,
          linkCount: links.length,
          nodes,
          linksSample: links.slice(0, 10)
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    console.log('Graph info on clean initial load:', JSON.stringify(graphInfo.result.value, null, 2));

    const ss = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('public/clean_browser_initial_load.png', Buffer.from(ss.result.data, 'base64'));
    console.log('Saved screenshot to public/clean_browser_initial_load.png');

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
