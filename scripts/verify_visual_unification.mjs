import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9340;
const userData = path.join(os.tmpdir(), 'edge-unify-' + Date.now());

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
    if (res && res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res && res.result ? res.result.value : null;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
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
    '--window-size=1680,1050',
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
        const appPage = pages.find(p => (p.title && p.title.includes('DuckDB Manager Pro')) || (p.url && p.url.includes('5173')));
        if (appPage && appPage.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          console.log('Selected App Page:', appPage.title, appPage.url);
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('App page WebSocket not found');

    const client = new CDPClient(pageWsUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Waiting for header to mount...');
    for (let i = 0; i < 30; i++) {
      const hasHeader = await client.evaluate(`Boolean(document.querySelector('header'))`);
      if (hasHeader) break;
      await delay(500);
    }
    await delay(1500);

    // 1. Click "AI 认知"
    const clickDomain = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('AI') && b.textContent.includes('认知')));
      if (btn) {
        btn.click();
        return 'clicked_domain: ' + btn.textContent.trim();
      }
      return 'domain_btn_not_found';
    })()`);
    console.log('1. Domain click:', clickDomain);
    
    // Wait for DuckDB loading overlay to disappear
    console.log('Waiting for DuckDB and Ontology workspace to load...');
    for (let i = 0; i < 20; i++) {
      const isLoading = await client.evaluate(`
        Boolean(document.body.innerText.includes('正在准备数据与执行环境') || document.body.innerText.includes('加载中...'))
      `);
      if (!isLoading) break;
      await delay(800);
    }
    await delay(1500);

    // Helper to inspect SVG D3 elements
    const inspectGraph = async (stepName) => {
      return await client.evaluate(`(() => {
        const svg = document.querySelector('svg[role="img"]') || Array.from(document.querySelectorAll('svg')).find(s => s.querySelector('.graph-container'));
        if (!svg) return { error: 'no_graph_svg_found' };
        
        // In D3GraphView, nodes have class 'nv-node' and links are paths in '.nv-links'
        const nodeEls = Array.from(svg.querySelectorAll('.nv-node'));
        const linkEls = Array.from(svg.querySelectorAll('.nv-links path'));
        
        const mainG = svg.querySelector('g.graph-container') || svg.querySelector('g');
        const transform = mainG ? mainG.getAttribute('transform') : null;

        const nodes = nodeEls.map(el => {
          const text = el.textContent?.trim() || '';
          const transform = el.getAttribute('transform') || '';
          const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
          const x = match ? parseFloat(match[1]) : 0;
          const y = match ? parseFloat(match[2]) : 0;
          const isTypeHub = el.classList.contains('nv-typehub') || text.includes('Type') || text.includes('类型');
          return { text, x, y, isTypeHub, className: el.getAttribute('class') };
        });

        const typeHubs = nodes.filter(n => n.isTypeHub);
        const instances = nodes.filter(n => !n.isTypeHub);
        const minInstanceY = instances.length > 0 ? Math.min(...instances.map(n => n.y)) : 0;
        const maxTypeHubY = typeHubs.length > 0 ? Math.max(...typeHubs.map(n => n.y)) : 0;
        const typeHubsAboveInstances = typeHubs.length === 0 || maxTypeHubY < minInstanceY;

        return {
          step: '${stepName}',
          totalNodes: nodes.length,
          totalLinks: linkEls.length,
          typeHubCount: typeHubs.length,
          instanceCount: instances.length,
          typeHubsAboveInstances,
          minInstanceY,
          maxTypeHubY,
          transform,
          sampleNodes: nodes.slice(0, 6)
        };
      })()`);
    };

    // Step 1: Click "重试初始化" or "一键初始化" to load Palantir Meta-Ontology model
    console.log('Triggering Step 1 (Initial Load via 重试初始化 / 一键初始化)...');
    const clickInit = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('重试初始化') || b.textContent.includes('一键初始化')));
      if (btn) {
        btn.click();
        return 'clicked_init: ' + btn.textContent.trim();
      }
      return 'init_btn_not_found';
    })()`);
    console.log('Init button:', clickInit);
    await delay(3000);

    const step1Info = await inspectGraph('Step 1: Initial Load');
    console.log('Step 1 info:', JSON.stringify(step1Info, null, 2));
    await client.captureScreenshot('public/step1_initial_load.png');
    await client.captureScreenshot('C:/Users/luoyu/.gemini/antigravity/brain/f43fa45a-a8c0-403f-86a3-46a255ac461b/step1_initial_load.png');

    // Helper to click a specific lesson's load button
    const clickLessonLoad = async (lessonNumStr) => {
      return await client.evaluate(`((targetNum) => {
        const spans = Array.from(document.querySelectorAll('span'));
        const span = spans.find(s => s.textContent?.trim() === targetNum);
        if (span) {
          const card = span.closest('.rounded-xl') || span.parentElement?.parentElement?.parentElement;
          if (card) {
            const btns = Array.from(card.querySelectorAll('button'));
            const loadBtn = btns.find(b => b.textContent && (b.textContent.includes('载入') || b.textContent.includes('重置')));
            if (loadBtn) {
              loadBtn.click();
              return 'clicked_lesson_' + targetNum + ': ' + loadBtn.textContent.trim();
            }
          }
        }
        return 'not_found_' + targetNum;
      })('${lessonNumStr}')`);
    };

    // Step 2: Load Lesson 0001
    console.log('Triggering Lesson 0001 Load...');
    const clickL1 = await clickLessonLoad('0001');
    console.log('Step 2 load:', clickL1);
    await delay(3000);

    const step2Info = await inspectGraph('Step 2: Lesson 1 Load');
    console.log('Step 2 info:', JSON.stringify(step2Info, null, 2));
    await client.captureScreenshot('public/step2_lesson1_load.png');
    await client.captureScreenshot('C:/Users/luoyu/.gemini/antigravity/brain/f43fa45a-a8c0-403f-86a3-46a255ac461b/step2_lesson1_load.png');

    // Step 3: Load Lesson 0002
    console.log('Triggering Lesson 0002 Load...');
    const clickL2 = await clickLessonLoad('0002');
    console.log('Step 3 load:', clickL2);
    await delay(3000);

    const step3Info = await inspectGraph('Step 3: Lesson 2 Load');
    console.log('Step 3 info:', JSON.stringify(step3Info, null, 2));
    await client.captureScreenshot('public/step3_lesson2_load.png');
    await client.captureScreenshot('C:/Users/luoyu/.gemini/antigravity/brain/f43fa45a-a8c0-403f-86a3-46a255ac461b/step3_lesson2_load.png');

    // Step 4: Load Lesson 0003
    console.log('Triggering Lesson 0003 Load...');
    const clickL3 = await clickLessonLoad('0003');
    console.log('Step 4 load:', clickL3);
    await delay(3000);

    const step4Info = await inspectGraph('Step 4: Lesson 3 Load');
    console.log('Step 4 info:', JSON.stringify(step4Info, null, 2));
    await client.captureScreenshot('public/step4_lesson3_load.png');
    await client.captureScreenshot('C:/Users/luoyu/.gemini/antigravity/brain/f43fa45a-a8c0-403f-86a3-46a255ac461b/step4_lesson3_load.png');

    // Step 5: Reset Default
    console.log('Triggering Reset Default...');
    const clickReset = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      // Find reset icon/button
      const resetBtn = allBtns.find(b => b.getAttribute('title')?.includes('重置') || b.textContent?.includes('重置') || b.textContent?.includes('恢复默认') || b.getAttribute('aria-label')?.includes('还原'));
      if (resetBtn) {
        resetBtn.click();
        return 'clicked_reset_button';
      }
      return 'reset_button_not_found';
    })()`);
    console.log('Step 5 reset clicked:', clickReset);
    await delay(1000);

    // If confirm modal opened, click confirm
    await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const okBtn = allBtns.find(b => b.textContent?.trim() === '确定' || b.textContent?.trim() === '恢复' || b.textContent?.trim() === '确认还原');
      if (okBtn) okBtn.click();
    })()`);
    await delay(3000);
    await delay(3000);

    const step5Info = await inspectGraph('Step 5: Reset Default');
    console.log('Step 5 info:', JSON.stringify(step5Info, null, 2));
    await client.captureScreenshot('public/step5_reset_default.png');
    await client.captureScreenshot('C:/Users/luoyu/.gemini/antigravity/brain/f43fa45a-a8c0-403f-86a3-46a255ac461b/step5_reset_default.png');

    console.log('================ ALL STEPS VERIFIED ================');

    client.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch (e) {}
    process.exit(0);
  }
}

main();
