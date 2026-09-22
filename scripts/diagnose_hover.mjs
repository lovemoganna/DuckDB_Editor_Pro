import { spawn } from 'child_process';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userData = 'C:\\Users\\luoyu\\AppData\\Local\\Temp\\edge-diag-' + Date.now();

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const proc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9370',
    '--remote-allow-origins=*',
    '--headless=new',
    '--window-size=1680,1050',
    `--user-data-dir=${userData}`,
    'http://localhost:5173/DuckDB_Editor_Pro/'
  ]);

  await delay(2500);

  const res = await fetch('http://127.0.0.1:9370/json/list');
  const list = await res.json();
  const page = list.find(p => p.url.includes('5173'));
  if (!page) {
    console.error('Page not found');
    proc.kill();
    return;
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const curId = msgId++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  // Click AI 认知
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span, a'));
      const tab = tabs.find(el => el.textContent && el.textContent.trim() === 'AI 认知');
      if (tab) tab.click();
      return !!tab;
    })()`,
    returnByValue: true
  });
  await delay(2500);

  // Initialize or load lesson 0001
  await send('Runtime.evaluate', {
    expression: `(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('重试初始化') || b.textContent.includes('一键初始化')));
      if (btn) btn.click();
    })()`,
    returnByValue: true
  });
  await delay(2500);

  // Get nodes positions on screen
  const nodePositions = await send('Runtime.evaluate', {
    expression: `(() => {
      const nodes = Array.from(document.querySelectorAll('.nv-node'));
      return nodes.map(n => {
        const rect = n.getBoundingClientRect();
        return {
          id: n.__data__?.id,
          label: n.__data__?.label,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          w: rect.width,
          h: rect.height
        };
      });
    })()`,
    returnByValue: true
  });

  console.log('Nodes on screen:', nodePositions?.value);

  // Move real mouse via CDP Input.dispatchMouseEvent to node "餐馆买菜" (obj::4)
  const targetNode = nodePositions?.value?.find(n => n.id === 'obj::4');
  if (targetNode) {
    console.log(`Moving mouse to node ${targetNode.label} at (${targetNode.x}, ${targetNode.y})...`);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: targetNode.x,
      y: targetNode.y
    });
    await delay(1000);

    const hoverState = await send('Runtime.evaluate', {
      expression: `(() => {
        const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
        const links = Array.from(document.querySelectorAll('.nv-link-main'));
        return {
          hoveredElementTag: document.elementFromPoint(${targetNode.x}, ${targetNode.y})?.tagName,
          hoveredElementClass: document.elementFromPoint(${targetNode.x}, ${targetNode.y})?.className,
          badges: badges.map(b => ({
            text: b.textContent?.trim(),
            display: window.getComputedStyle(b).display,
            opacity: window.getComputedStyle(b).opacity
          })),
          activeLinksCount: links.filter(l => !l.classList.contains('nv-dim')).length,
          dimmedLinksCount: links.filter(l => l.classList.contains('nv-dim')).length
        };
      })()`,
      returnByValue: true
    });

    console.log('Hover state with Input.dispatchMouseEvent on circle:', JSON.stringify(hoverState?.value, null, 2));
  }

  // Also test moving mouse to the TEXT LABEL of "餐馆买菜"
  const labelPositions = await send('Runtime.evaluate', {
    expression: `(() => {
      const labels = Array.from(document.querySelectorAll('.nv-node-label'));
      return labels.map(l => {
        const rect = l.getBoundingClientRect();
        return {
          text: l.textContent?.trim(),
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      });
    })()`,
    returnByValue: true
  });
  console.log('Labels on screen:', labelPositions?.value);

  const targetLabel = labelPositions?.value?.find(l => l.text === '餐馆买菜');
  if (targetLabel) {
    console.log(`Moving mouse to label ${targetLabel.text} at (${targetLabel.x}, ${targetLabel.y})...`);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: targetLabel.x,
      y: targetLabel.y
    });
    await delay(1000);

    const labelHoverState = await send('Runtime.evaluate', {
      expression: `(() => {
        const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
        const visibleBadges = badges.filter(b => window.getComputedStyle(b).display !== 'none');
        return {
          hoveredElementTag: document.elementFromPoint(${targetLabel.x}, ${targetLabel.y})?.tagName,
          hoveredElementClass: document.elementFromPoint(${targetLabel.x}, ${targetLabel.y})?.className,
          visibleBadgesCount: visibleBadges.length
        };
      })()`,
      returnByValue: true
    });
    console.log('Hover state when mouse is on label:', labelHoverState?.value);
  }

  ws.close();
  proc.kill();
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch {}
}

main().catch(console.error);
