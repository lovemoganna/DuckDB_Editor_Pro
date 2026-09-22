import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9360;
const userData = path.join(os.tmpdir(), 'edge-hover-diag-' + Date.now());

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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

  close() {
    try { this.ws.close(); } catch {}
  }
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

  let cdp = null;
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
    if (!pageWsUrl) throw new Error('App page WebSocket not found');

    cdp = new CDPClient(pageWsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (let i = 0; i < 30; i++) {
      const hasHeader = await cdp.evaluate(`Boolean(document.querySelector('header'))`);
      if (hasHeader) break;
      await delay(500);
    }
    await delay(1000);

    await cdp.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('AI') && b.textContent.includes('认知')));
      if (btn) btn.click();
    })()`);

    for (let i = 0; i < 20; i++) {
      const isLoading = await cdp.evaluate(`Boolean(document.body.innerText.includes('正在准备数据与执行环境'))`);
      if (!isLoading) break;
      await delay(800);
    }
    await delay(1500);

    // Initial load
    await cdp.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('重试初始化') || b.textContent.includes('一键初始化')));
      if (btn) btn.click();
    })()`);
    await delay(2000);

    // Helper to click a specific lesson's load button
    const clickLessonLoad = async (lessonNumStr) => {
      return await cdp.evaluate(`((targetNum) => {
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

    console.log('Loading Lesson 0001...');
    await clickLessonLoad('0001');

    for (let i = 0; i < 30; i++) {
      const count = await cdp.evaluate(`document.querySelectorAll('.nv-node').length`);
      if (count >= 5) {
        console.log('Graph nodes ready:', count);
        break;
      }
      await delay(500);
    }
    await delay(1500);

    await cdp.evaluate(`window.__d3FitAll && window.__d3FitAll(350)`);
    await delay(1500);

    // 1. Inspect elements at node "餐馆买菜"
    const nodeInfo = await cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('.nv-node'));
      const target = nodes.find(n => n.__data__?.id === 'obj::4' || (n.textContent || '').includes('餐馆买菜'));
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      const circle = target.querySelector('circle');
      const cRect = circle ? circle.getBoundingClientRect() : rect;
      
      const labels = Array.from(document.querySelectorAll('.nv-node-label'));
      const label = labels.find(l => l.textContent?.includes('餐馆买菜'));
      const lRect = label ? label.getBoundingClientRect() : null;

      return {
        id: target.__data__?.id,
        circleBox: { x: cRect.x + cRect.width / 2, y: cRect.y + cRect.height / 2, width: cRect.width, height: cRect.height },
        labelBox: lRect ? { x: lRect.x + lRect.width / 2, y: lRect.y + lRect.height / 2, width: lRect.width, height: lRect.height } : null
      };
    })()`);

    console.log('Node obj::4 Screen Info:', JSON.stringify(nodeInfo, null, 2));

    if (nodeInfo) {
      // Test A: CDP real mouse movement directly to Circle center
      console.log('=== Test A: Moving mouse to circle center ===');
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(nodeInfo.circleBox.x),
        y: Math.round(nodeInfo.circleBox.y)
      });
      await delay(600);

      const stateA = await cdp.evaluate(`(() => {
        const el = document.elementFromPoint(${nodeInfo.circleBox.x}, ${nodeInfo.circleBox.y});
        const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
        const visibleBadges = badges.filter(b => window.getComputedStyle(b).display !== 'none' && parseFloat(window.getComputedStyle(b).opacity) > 0.5);
        return {
          elementUnderCursor: { tag: el?.tagName, class: el?.getAttribute('class') },
          visibleBadgesCount: visibleBadges.length,
          visibleBadges: visibleBadges.map(b => b.textContent?.trim().slice(0, 30))
        };
      })()`);
      console.log('State A (Cursor on circle center):', stateA);

      // Test B: Micro-move mouse 2px (inside circle, moving across icon path)
      console.log('=== Test B: Micro-move mouse inside circle (simulating normal hand jitter) ===');
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(nodeInfo.circleBox.x + 2),
        y: Math.round(nodeInfo.circleBox.y + 2)
      });
      await delay(600);

      const stateB = await cdp.evaluate(`(() => {
        const el = document.elementFromPoint(${nodeInfo.circleBox.x + 2}, ${nodeInfo.circleBox.y + 2});
        const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
        const visibleBadges = badges.filter(b => window.getComputedStyle(b).display !== 'none' && parseFloat(window.getComputedStyle(b).opacity) > 0.5);
        return {
          elementUnderCursor: { tag: el?.tagName, class: el?.getAttribute('class') },
          visibleBadgesCount: visibleBadges.length,
          visibleBadges: visibleBadges.map(b => b.textContent?.trim().slice(0, 30))
        };
      })()`);
      console.log('State B (Micro-move 2px inside circle):', stateB);

      // Test C: Move mouse to Text Label
      if (nodeInfo.labelBox) {
        console.log('=== Test C: Moving mouse to Text Label ===');
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(nodeInfo.labelBox.x),
          y: Math.round(nodeInfo.labelBox.y)
        });
        await delay(600);

        const stateC = await cdp.evaluate(`(() => {
          const el = document.elementFromPoint(${nodeInfo.labelBox.x}, ${nodeInfo.labelBox.y});
          const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
          const visibleBadges = badges.filter(b => window.getComputedStyle(b).display !== 'none' && parseFloat(window.getComputedStyle(b).opacity) > 0.5);
          
          // Tooltip card inspection
          const tooltip = Array.from(document.querySelectorAll('div')).find(d => (d.textContent || '').includes('关联边关系'));
          const tooltipRelations = tooltip ? Array.from(tooltip.querySelectorAll('span')).map(s => s.textContent?.trim()).filter(Boolean) : null;

          return {
            elementUnderCursor: { tag: el?.tagName, class: el?.getAttribute('class') },
            visibleBadgesCount: visibleBadges.length,
            visibleBadges: visibleBadges.map(b => b.textContent?.trim().slice(0, 30)),
            hasTooltipCard: Boolean(tooltip),
            tooltipTextSnippet: tooltip?.innerText?.slice(0, 200)
          };
        })()`);
        console.log('State C (Cursor on Text Label):', stateC);

        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const outPath = 'C:\\Users\\luoyu\\.gemini\\antigravity\\brain\\f43fa45a-a8c0-403f-86a3-46a255ac461b\\edge_hover_text_label.png';
        fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
        console.log('Saved screenshot of label hover to:', outPath);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (cdp) cdp.close();
    edgeProc.kill();
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch {}
  }
}

main();
