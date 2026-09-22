const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

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
        const appPage = pages.find(p => (p.title && p.title.includes('DuckDB Manager Pro')) || (p.url && p.url.includes('5173')));
        if (appPage && appPage.webSocketDebuggerUrl) {
          pageWsUrl = appPage.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
      await delay(500);
    }

    if (!pageWsUrl) throw new Error('App page WebSocket not found');
    console.log('Connected to App Page WebSocket:', pageWsUrl);

    const client = new CDPClient(pageWsUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Waiting for header to mount...');
    for (let i = 0; i < 30; i++) {
      const hasHeader = await client.evaluate(`Boolean(document.querySelector('header'))`);
      if (hasHeader) break;
      await delay(500);
    }
    await delay(1000);

    // 1. Click "AI 认知"
    const clickDomain = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && b.textContent.includes('AI') && b.textContent.includes('认知')) || allBtns[4];
      if (btn) {
        btn.click();
        return 'clicked_domain: ' + btn.textContent.trim();
      }
      return 'domain_btn_not_found';
    })()`);
    console.log('1. Domain click:', clickDomain);
    await delay(3000);

    // 2. Click "一键初始化" or "重试初始化"
    const clickInit = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && (b.textContent.includes('一键初始化') || b.textContent.includes('重试初始化')));
      if (btn) {
        btn.click();
        return 'clicked_init: ' + btn.textContent.trim();
      }
      return 'init_btn_not_found';
    })()`);
    console.log('2. Init click:', clickInit);
    await delay(4000);

    // If init didn't work or still not ready, load lesson 0001
    const clickLesson = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btn = allBtns.find(b => b.textContent && b.textContent.includes('载入'));
      if (btn) {
        btn.click();
        return 'clicked_lesson_load';
      }
      return 'no_lesson_btn';
    })()`);
    console.log('3. Lesson load:', clickLesson);
    await delay(4000);

    // 4. Click "实体画布" in segmented tabs
    const clickCanvas = await client.evaluate(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const btn = allBtns.find(b => b.textContent && b.textContent.includes('实体画布'));
      if (btn) {
        btn.click();
        return 'clicked_canvas';
      }
      return 'canvas_not_found: ' + allBtns.map(b => b.textContent.trim()).filter(Boolean).slice(0, 15).join(' | ');
    })()`);
    console.log('4. Canvas tab click:', clickCanvas);
    await delay(4000);

    // 5. Deep inspection of ReactFlow elements & Edge-to-Handle alignment
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
            center: { x: hRect.left + hRect.width / 2, y: hRect.top + hRect.height / 2 }
          };
        });

        // 检查关键信息元素是否存在且在视口中有高度
        const titleEl = n.querySelector('span.text-xs, span.text-\\\\[11px\\\\]');
        const typeBadgeEl = n.querySelector('span.font-mono.font-bold');
        const countEls = Array.from(n.querySelectorAll('.font-mono')).filter(el => el.textContent.includes('↑') || el.textContent.includes('↓'));
        
        return {
          id: n.getAttribute('data-id'),
          header: titleEl?.textContent?.trim() || '',
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
          handles,
          hasTitle: Boolean(titleEl),
          hasTypeBadge: Boolean(typeBadgeEl),
          typeBadgeText: typeBadgeEl?.textContent?.trim() || '',
          style: n.getAttribute('style'),
          childStyle: n.firstElementChild?.getAttribute('style'),
          childClass: n.firstElementChild?.className,
          innerText: n.innerText.slice(0, 160).replace(/\\n+/g, ' ')
        };
      });

      const edges = rfEdges.map(e => {
        const path = e.querySelector('path.react-flow__edge-path') || e.querySelector('path');
        const d = path?.getAttribute('d') || '';
        
        let startScreen = null;
        let endScreen = null;
        if (path && path.getPointAtLength && path.getScreenCTM) {
          const totalLen = path.getTotalLength();
          const startPt = path.getPointAtLength(0);
          const endPt = path.getPointAtLength(totalLen);
          const ctm = path.getScreenCTM();
          if (ctm) {
            const sp = startPt.matrixTransform(ctm);
            const ep = endPt.matrixTransform(ctm);
            startScreen = { x: sp.x, y: sp.y };
            endScreen = { x: ep.x, y: ep.y };
          }
        }

        return {
          id: e.getAttribute('data-id') || e.id,
          d,
          startScreen,
          endScreen,
        };
      });

      // 计算每个连线端点与最近 handle 的距离偏差
      const alignmentResults = edges.map(edge => {
        if (!edge.startScreen || !edge.endScreen) return { id: edge.id, error: 'no_screen_coords' };
        
        // 查找与 startScreen 最近的 handle
        let minStartDist = Infinity;
        let bestStartHandle = null;
        let bestStartNode = null;

        let minEndDist = Infinity;
        let bestEndHandle = null;
        let bestEndNode = null;

        nodes.forEach(node => {
          node.handles.forEach(h => {
            const dStart = Math.hypot(h.center.x - edge.startScreen.x, h.center.y - edge.startScreen.y);
            if (dStart < minStartDist) {
              minStartDist = dStart;
              bestStartHandle = h.id;
              bestStartNode = node.id;
            }

            const dEnd = Math.hypot(h.center.x - edge.endScreen.x, h.center.y - edge.endScreen.y);
            if (dEnd < minEndDist) {
              minEndDist = dEnd;
              bestEndHandle = h.id;
              bestEndNode = node.id;
            }
          });
        });

        return {
          edgeId: edge.id,
          start: {
            nodeId: bestStartNode,
            handleId: bestStartHandle,
            distPx: Math.round(minStartDist * 10) / 10
          },
          end: {
            nodeId: bestEndNode,
            handleId: bestEndHandle,
            distPx: Math.round(minEndDist * 10) / 10
          },
          isPerfect: minStartDist <= 2.5 && minEndDist <= 2.5
        };
      });

      return {
        zoom,
        transform,
        nodeCount: rfNodes.length,
        edgeCount: rfEdges.length,
        nodes,
        edges,
        alignmentResults
      };
    })()`);

    console.log('Inspection Summary:');
    console.log('Zoom:', inspection.zoom);
    console.log('Nodes count:', inspection.nodeCount);
    console.log('Edges count:', inspection.edgeCount);
    console.log('Alignment Results:', JSON.stringify(inspection.alignmentResults, null, 2));
    console.log('Edges Details:', JSON.stringify(inspection.edges, null, 2));
    
    const computedStyles = await client.evaluate(`(() => {
      const n1 = document.querySelector('.react-flow__node[data-id="1"]');
      const n2 = document.querySelector('.react-flow__node[data-id="2"]');
      const parent = n1?.parentElement;
      return {
        parentTag: parent?.tagName,
        parentClass: parent?.className,
        parentStyle: parent?.getAttribute('style'),
        parentComputed: parent ? { display: getComputedStyle(parent).display, position: getComputedStyle(parent).position } : null,
        n1: n1 ? { position: getComputedStyle(n1).position, display: getComputedStyle(n1).display, top: getComputedStyle(n1).top, left: getComputedStyle(n1).left, transform: getComputedStyle(n1).transform } : null,
        n2: n2 ? { position: getComputedStyle(n2).position, display: getComputedStyle(n2).display, top: getComputedStyle(n2).top, left: getComputedStyle(n2).left, transform: getComputedStyle(n2).transform } : null,
      };
    })()`);
    const matchingRules = await client.evaluate(`(() => {
      const node = document.querySelector('.react-flow__node');
      if (!node) return [];
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && node.matches(rule.selectorText)) {
              rules.push({ selector: rule.selectorText, cssText: rule.cssText });
            }
          }
        } catch(e) {}
      }
      return rules;
    })()`);
    console.log('Matching Rules for .react-flow__node:', JSON.stringify(matchingRules, null, 2));

    // 6. Capture live screenshot
    await client.captureScreenshot('artifacts/ontology-canvas-live.png');

    // Helper to evaluate alignment
    const checkAlignment = async (label) => {
      const res = await client.evaluate(`(() => {
        const rf = document.querySelector('.react-flow');
        const transform = document.querySelector('.react-flow__viewport')?.style?.transform || '';
        let zoom = 1;
        const zoomMatch = transform.match(/scale\\(([^)]+)\\)/);
        if (zoomMatch) zoom = parseFloat(zoomMatch[1]);

        const rfNodes = Array.from(document.querySelectorAll('.react-flow__node'));
        const rfEdges = Array.from(document.querySelectorAll('.react-flow__edge'));

        const nodes = rfNodes.map(n => {
          const handles = Array.from(n.querySelectorAll('.react-flow__handle')).map(h => {
            const hRect = h.getBoundingClientRect();
            return {
              id: h.getAttribute('data-handleid') || h.id,
              center: { x: hRect.left + hRect.width / 2, y: hRect.top + hRect.height / 2 }
            };
          });
          return { id: n.getAttribute('data-id'), handles };
        });

        const alignment = rfEdges.map(e => {
          const path = e.querySelector('path.react-flow__edge-path') || e.querySelector('path');
          if (!path?.getPointAtLength || !path?.getScreenCTM) return null;
          const totalLen = path.getTotalLength();
          const sp = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
          const ep = path.getPointAtLength(totalLen).matrixTransform(path.getScreenCTM());
          
          let minStart = Infinity, minEnd = Infinity;
          nodes.forEach(n => {
            n.handles.forEach(h => {
              const ds = Math.hypot(h.center.x - sp.x, h.center.y - sp.y);
              const de = Math.hypot(h.center.x - ep.x, h.center.y - ep.y);
              if (ds < minStart) minStart = ds;
              if (de < minEnd) minEnd = de;
            });
          });
          return {
            id: e.getAttribute('data-id') || e.id,
            startDistPx: Math.round(minStart * 10) / 10,
            endDistPx: Math.round(minEnd * 10) / 10
          };
        });

        return { zoom, alignment };
      })()`);
      console.log('[Alignment ' + label + ']', JSON.stringify(res, null, 2));
      return res;
    };

    await checkAlignment('Default FitView');

    // 7. Zoom to 1.0 (Standard 100%)
    await client.evaluate(`(() => {
      if (window.__rfInstance) {
        window.__rfInstance.zoomTo(1.0, { duration: 0 });
      }
    })()`);
    await delay(600);
    await checkAlignment('Standard Zoom (1.0x)');
    await client.captureScreenshot('artifacts/ontology-canvas-zoom-100.png');

    // 8. Zoom Out into Compact Mode (0.35x)
    await client.evaluate(`(() => {
      if (window.__rfInstance) {
        window.__rfInstance.zoomTo(0.35, { duration: 0 });
      }
    })()`);
    await delay(600);
    await checkAlignment('Compact Mode (0.35x)');
    await client.captureScreenshot('artifacts/ontology-canvas-compact.png');

    // 9. Return to Fit View
    await client.evaluate(`(() => {
      if (window.__rfInstance) {
        window.__rfInstance.fitView({ padding: 0.3, duration: 0 });
      }
    })()`);
    await delay(600);
    await checkAlignment('Fit View Restored');

    // 10. Interactive Test: Move Node 2 by (+120px, +60px)
    await client.evaluate(`(() => {
      if (window.__rfInstance) {
        window.__rfInstance.setNodes(nds => nds.map(n => {
          if (n.id === '2') {
            return {
              ...n,
              position: { x: n.position.x + 120, y: n.position.y + 60 }
            };
          }
          return n;
        }));
      }
    })()`);
    await delay(600);
    await checkAlignment('After Moving Node 2 (+120, +60)');
    await client.captureScreenshot('artifacts/ontology-canvas-moved.png');

    client.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edgeProc.kill();
  }
}

main();
