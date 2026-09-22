import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9350;
const userData = path.join(os.tmpdir(), 'edge-diag-' + Date.now());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res?.result?.value;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot to ${outputPath}`);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('Launching headless Edge on port', PORT);
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1000',
    `--user-data-dir=${userData}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/DuckDB_Editor_Pro/',
  ]);

  try {
    let pageWsUrl = null;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const pages = await res.json();
        const appPage = pages.find(p => p.url?.includes('5173'));
        if (appPage?.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('App page WebSocket not found');
    console.log('Connected to page');

    const client = new CDPClient(pageWsUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    
    // Wait until document has buttons
    console.log('Waiting for page to render...');
    for (let i = 0; i < 30; i++) {
      const hasContent = await client.evaluate(`document.querySelectorAll('button').length > 5`);
      if (hasContent) break;
      await delay(500);
    }
    await delay(2000);

    // Click AI 认知 button
    const aiBtnResult = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const target = allBtns.find(b => b.textContent.includes('AI') && b.textContent.includes('认知')) || allBtns[4];
      if (target) {
        target.click();
        return 'clicked: ' + target.textContent.trim();
      }
      return 'not_found';
    })()`);
    console.log('AI button:', aiBtnResult);
    await delay(2500);

    // Switch to 实体画布 tab
    const tabResult = await client.evaluate(`(() => {
      const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const canvasTab = tabs.find(t => t.textContent.includes('实体画布'));
      if (canvasTab) {
        canvasTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'clicked_canvas_tab';
      }
      return 'canvas_tab_not_found: ' + tabs.map(t => t.textContent.trim()).filter(Boolean).slice(0, 20).join(' | ');
    })()`);
    console.log('Canvas tab:', tabResult);
    await delay(2500);

    await client.captureScreenshot('public/first_load_canvas.png');

    // Get nodes details on first load
    const firstLoadNodes = await client.evaluate(`(() => {
      const rfNodes = Array.from(document.querySelectorAll('.react-flow__node'));
      return rfNodes.map(n => {
        const rect = n.getBoundingClientRect();
        return {
          id: n.getAttribute('data-id'),
          transform: n.style.transform,
          title: n.querySelector('.font-bold')?.textContent || n.textContent.slice(0, 30),
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
        };
      });
    })()`);

    console.log('First load nodes count:', firstLoadNodes.length);
    console.log('First load nodes:', JSON.stringify(firstLoadNodes, null, 2));

    // Check overlap between nodes on first load
    const overlaps = [];
    for (let i = 0; i < firstLoadNodes.length; i++) {
      for (let j = i + 1; j < firstLoadNodes.length; j++) {
        const a = firstLoadNodes[i].rect;
        const b = firstLoadNodes[j].rect;
        const overlap = (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        );
        if (overlap) {
          overlaps.push({ a: firstLoadNodes[i].title, b: firstLoadNodes[j].title, aRect: a, bRect: b });
        }
      }
    }
    console.log('First load overlaps count:', overlaps.length);
    console.log('Overlaps:', JSON.stringify(overlaps, null, 2));

    // Now open 排版微调 and click a layout
    const layoutTrigger = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const adjustBtn = allBtns.find(b => b.textContent.includes('排版微调'));
      if (adjustBtn) {
        adjustBtn.click();
        return 'opened_adjust_panel';
      }
      return 'adjust_btn_not_found';
    })()`);
    console.log('Adjust panel:', layoutTrigger);
    await delay(1000);

    // Click orthogonal layout button
    const clickLayout = await client.evaluate(`(() => {
      const btn = document.querySelector('[data-testid="ontology-layout-orthogonal"]') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('正交') || b.textContent.includes('正交布局'));
      if (btn) {
        btn.click();
        return 'clicked_orthogonal';
      }
      return 'layout_btn_not_found';
    })()`);
    console.log('Click layout:', clickLayout);
    await delay(2000);

    await client.captureScreenshot('public/after_relayout_canvas.png');

    const afterRelayoutNodes = await client.evaluate(`(() => {
      const rfNodes = Array.from(document.querySelectorAll('.react-flow__node'));
      return rfNodes.map(n => {
        const rect = n.getBoundingClientRect();
        return {
          id: n.getAttribute('data-id'),
          transform: n.style.transform,
          title: n.querySelector('.font-bold')?.textContent || n.textContent.slice(0, 30),
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
        };
      });
    })()`);

    console.log('After relayout nodes count:', afterRelayoutNodes.length);
    console.log('After relayout nodes:', JSON.stringify(afterRelayoutNodes, null, 2));

    const afterOverlaps = [];
    for (let i = 0; i < afterRelayoutNodes.length; i++) {
      for (let j = i + 1; j < afterRelayoutNodes.length; j++) {
        const a = afterRelayoutNodes[i].rect;
        const b = afterRelayoutNodes[j].rect;
        const overlap = (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        );
        if (overlap) {
          afterOverlaps.push({ a: afterRelayoutNodes[i].title, b: afterRelayoutNodes[j].title, aRect: a, bRect: b });
        }
      }
    }
    console.log('After relayout overlaps count:', afterOverlaps.length);

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  }
}

main();
