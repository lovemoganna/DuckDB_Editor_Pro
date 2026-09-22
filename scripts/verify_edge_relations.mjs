import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9350;
const userData = path.join(os.tmpdir(), 'edge-rel-verif-' + Date.now());

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
    try {
      this.ws.close();
    } catch {}
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

  let cdp = null;

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

    cdp = new CDPClient(pageWsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('Waiting for header to mount...');
    for (let i = 0; i < 30; i++) {
      const hasHeader = await cdp.evaluate(`Boolean(document.querySelector('header'))`);
      if (hasHeader) break;
      await delay(500);
    }
    await delay(1500);

    // Click "AI 认知"
    const clickDomain = await cdp.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('AI') && b.textContent.includes('认知')));
      if (btn) {
        btn.click();
        return 'clicked_domain: ' + btn.textContent.trim();
      }
      return 'domain_btn_not_found';
    })()`);
    console.log('Domain click:', clickDomain);
    
    // Wait for DuckDB loading overlay to disappear
    console.log('Waiting for DuckDB and Ontology workspace to load...');
    for (let i = 0; i < 20; i++) {
      const isLoading = await cdp.evaluate(`
        Boolean(document.body.innerText.includes('正在准备数据与执行环境') || document.body.innerText.includes('加载中...'))
      `);
      if (!isLoading) break;
      await delay(800);
    }
    await delay(1500);

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

    // Click "一键初始化" or Lesson 0001
    console.log('Triggering initialization...');
    await cdp.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('重试初始化') || b.textContent.includes('一键初始化')));
      if (btn) btn.click();
    })()`);
    await delay(2000);

    // Load Lesson 0001
    console.log('Loading Lesson 0001...');
    await clickLessonLoad('0001');

    // Wait for nodes to appear
    for (let i = 0; i < 30; i++) {
      const count = await cdp.evaluate(`document.querySelectorAll('.nv-node').length`);
      if (count >= 5) {
        console.log('Graph nodes ready:', count);
        break;
      }
      await delay(500);
    }
    await delay(2000);

    // Ensure layout and camera fit
    await cdp.evaluate(`window.__d3FitAll && window.__d3FitAll(350)`);
    await delay(1500);

    const artifactDir = "C:\\Users\\luoyu\\.gemini\\antigravity\\brain\\f43fa45a-a8c0-403f-86a3-46a255ac461b";

    // 1. Initial Clean State
    const step1Stats = await cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('.nv-node'));
      const semanticLinks = Array.from(document.querySelectorAll('.nv-link-main.nv-link-instance'));
      const hierLinks = Array.from(document.querySelectorAll('.nv-link-main.nv-link-typeinst'));
      const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
      return {
        nodeCount: nodes.length,
        semanticLinkCount: semanticLinks.length,
        hierLinkCount: hierLinks.length,
        badgeCount: badges.length
      };
    })()`);
    console.log('Step 1 Clean State Stats:', step1Stats);

    const step1Path = path.join(artifactDir, 'edge_step1_clean.png');
    await cdp.captureScreenshot(step1Path);

    // 2. Hover over node "餐馆买菜" (obj::4)
    console.log('Hovering over node "餐馆买菜" (obj::4)...');
    const hoverNodeResult = await cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('.nv-node'));
      const target = nodes.find(n => n.__data__?.id === 'obj::4' || (n.textContent || '').includes('餐馆买菜'));
      if (target) {
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return { found: true, id: target.__data__?.id, label: target.__data__?.label };
      }
      return { found: false };
    })()`);
    console.log('Hover node result:', hoverNodeResult);
    await delay(800);

    const step2HoverStats = await cdp.evaluate(`(() => {
      const badges = Array.from(document.querySelectorAll('.nv-edge-badge'));
      const visibleBadges = badges.filter(b => {
        const style = window.getComputedStyle(b);
        return style.display !== 'none' && parseFloat(style.opacity) > 0.5;
      });
      return {
        visibleBadgeTexts: visibleBadges.map(b => b.textContent?.trim())
      };
    })()`);
    console.log('Step 2 Node Hover Visible Badges:', step2HoverStats);

    const step2Path = path.join(artifactDir, 'edge_step2_node_hover.png');
    await cdp.captureScreenshot(step2Path);

    // 3. Hover over semantic link
    console.log('Hovering over semantic link (nv-link-instance)...');
    await cdp.evaluate(`(() => {
      const link = document.querySelector('.nv-link-main.nv-link-instance');
      if (link) {
        link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }
    })()`);
    await delay(800);

    const step3Path = path.join(artifactDir, 'edge_step3_edge_hover.png');
    await cdp.captureScreenshot(step3Path);

    // 4. Click node "做菜人·妈妈" (obj::1) to select
    console.log('Selecting node "做菜人·妈妈" (obj::1)...');
    await cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('.nv-node'));
      const target = nodes.find(n => n.__data__?.id === 'obj::1');
      if (target) {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    })()`);
    await delay(800);

    const step4Path = path.join(artifactDir, 'edge_step4_node_select.png');
    await cdp.captureScreenshot(step4Path);

    // 5. Test another tutorial case (Lesson 0002) to verify consistency across lessons
    console.log('Loading Lesson 0002 to test edge consistency across lessons...');
    await clickLessonLoad('0002');
    await delay(2500);
    await cdp.evaluate(`window.__d3FitAll && window.__d3FitAll(350)`);
    await delay(1200);

    const step5Path = path.join(artifactDir, 'edge_step5_lesson2.png');
    await cdp.captureScreenshot(step5Path);

    console.log('All verification screenshots captured successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    if (cdp) cdp.close();
    edgeProc.kill();
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {}
  }
}

main();
