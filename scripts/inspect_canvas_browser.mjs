import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const userData = path.join(os.tmpdir(), 'edge-cdp-' + Date.now());

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
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const pages = await res.json();
        const appPage = pages.find(p => p.title?.includes('DuckDB Manager Pro') || p.url?.includes('5173'));
        if (appPage?.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('App page WebSocket not found');
    console.log('Connecting to App Page at:', pageWsUrl);

    const client = new CDPClient(pageWsUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await delay(3500);

    // 1. Click AI 认知
    await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const target = allBtns.find(b => b.textContent.includes('AI') && b.textContent.includes('认知')) || allBtns[4];
      target?.click();
    })()`);
    await delay(2500);

    // Click "一键初始化"
    const initRes = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const initBtn = allBtns.find(b => b.textContent.includes('一键初始化') || b.textContent.includes('重试初始化'));
      if (initBtn) {
        initBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'clicked: ' + initBtn.textContent.trim();
      }
      return 'not_found';
    })()`);
    console.log('Init button:', initRes);
    await delay(3000);

    // Click "载入" on first lesson if available
    const lessonRes = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const loadBtn = allBtns.find(b => b.textContent.includes('载入'));
      if (loadBtn) {
        loadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'clicked_load_lesson: ' + loadBtn.textContent.trim();
      }
      return 'not_found';
    })()`);
    console.log('Lesson button:', lessonRes);
    await delay(3000);

    // Switch to "实体画布"
    const canvasRes = await client.evaluate(`(() => {
      const allTabs = Array.from(document.querySelectorAll('[role=\"tab\"], button'));
      const canvasTab = allTabs.find(t => t.textContent.includes('实体画布'));
      if (canvasTab) {
        canvasTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'switched_to_canvas';
      }
      return 'canvas_tab_not_found: ' + allTabs.map(t => t.textContent.trim()).filter(Boolean).slice(0, 15).join(' | ');
    })()`);
    console.log('Canvas Switch:', canvasRes);
    await delay(3000);

    await client.captureScreenshot('artifacts/ontology-canvas-live.png');

    // Deep inspection of ReactFlow elements
    const inspection = await client.evaluate(`(() => {
      const rfNodes = Array.from(document.querySelectorAll('.react-flow__node'));
      const rfEdges = Array.from(document.querySelectorAll('.react-flow__edge'));
      const viewportEl = document.querySelector('.react-flow__viewport');
      const transform = viewportEl ? viewportEl.style.transform : 'none';

      let zoom = 1;
      const zoomMatch = transform.match(/scale\\(([^)]+)\\)/);
      if (zoomMatch) zoom = parseFloat(zoomMatch[1]);

      const nodes = rfNodes.map(n => {
        const rect = n.getBoundingClientRect();
        const handles = Array.from(n.querySelectorAll('.react-flow__handle')).map(h => {
          const hRect = h.getBoundingClientRect();
          return {
            id: h.getAttribute('data-handleid') || h.id,
            className: h.className,
            // center in viewport
            cx: Math.round(hRect.left + hRect.width / 2),
            cy: Math.round(hRect.top + hRect.height / 2),
            w: Math.round(hRect.width),
            h: Math.round(hRect.height)
          };
        });
        const header = n.querySelector('span')?.textContent || '';
        return {
          id: n.getAttribute('data-id'),
          header,
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
          handles,
          text: n.innerText.slice(0, 150).replace(/\\n+/g, ' ')
        };
      });

      const edges = rfEdges.map(e => {
        const path = e.querySelector('path.react-flow__edge-path') || e.querySelector('path');
        const d = path?.getAttribute('d') || '';
        const m = d.match(/^M\\s*([-\\d.]+)[,\\s]+([-\\d.]+)/);
        const start = m ? { x: Math.round(parseFloat(m[1])), y: Math.round(parseFloat(m[2])) } : null;
        const tokens = d.trim().replace(/[A-Za-z]/g, ' ').trim().split(/[\\s,]+/);
        const end = tokens.length >= 2 ? {
          x: Math.round(parseFloat(tokens[tokens.length - 2])),
          y: Math.round(parseFloat(tokens[tokens.length - 1]))
        } : null;
        return {
          id: e.getAttribute('data-id') || e.id,
          d,
          start,
          end
        };
      });

      return {
        zoom,
        transform,
        nodeCount: rfNodes.length,
        edgeCount: rfEdges.length,
        nodes,
        edges
      };
    })()`);

    console.log('Inspection:');
    console.log('Zoom:', inspection.zoom);
    console.log('Nodes (' + inspection.nodeCount + '):', JSON.stringify(inspection.nodes, null, 2));
    console.log('Edges (' + inspection.edgeCount + '):', JSON.stringify(inspection.edges, null, 2));

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
  }
}

main();
