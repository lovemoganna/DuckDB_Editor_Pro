import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/DuckDB_Editor_Pro/';

const DOMAINS = [
  { id: 'core', label: '工程核心', tabs: ['仪表盘', '数据', 'Schema', 'SQL', '数据流'] },
  { id: 'analytics', label: '分析洞察', tabs: ['指标', '可视化', '分析', '历史', '审计'] },
  { id: 'knowledge', label: '知识沉淀', tabs: ['知识资产', '插件', '知识联动'] },
  { id: 'ai', label: 'AI 认知', tabs: ['本体图谱', '技能', '能力', '推演'] },
];

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'small-tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const THEMES = ['dark', 'light'];

async function runAudit() {
  console.log('Launching browser for comprehensive system audit...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const uncaughtErrors = [];

  page.on('pageerror', (err) => {
    uncaughtErrors.push({ text: err.message, stack: err.stack });
    console.error('  [PageError]', err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore favicon or benign dev warnings
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
        console.error('  [ConsoleError]', text);
      }
    }
  });

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const report = {
    timestamp: new Date().toISOString(),
    viewportsChecked: VIEWPORTS.map(v => v.name),
    themesChecked: THEMES,
    viewsChecked: [],
    contrastIssues: [],
    overflowIssues: [],
    uncaughtErrors,
    consoleErrors,
    sqlEditorCheck: {},
    modalChecks: [],
  };

  // Helper to switch theme
  async function setTheme(theme) {
    await page.evaluate((targetTheme) => {
      const cur = document.documentElement.dataset.theme || 'dark';
      if (cur !== targetTheme) {
        const themeBtn = Array.from(document.querySelectorAll('button')).find(
          b => (b.getAttribute('aria-label') || '').includes('模式') ||
               (b.getAttribute('aria-label') || '').includes('主题') ||
               (b.getAttribute('title') || '').includes('主题') ||
               (b.getAttribute('title') || '').includes('模式')
        );
        if (themeBtn) {
          themeBtn.click();
        } else {
          document.documentElement.dataset.theme = targetTheme;
          localStorage.setItem('duckdb_theme', targetTheme);
        }
      }
    }, theme);
    await page.waitForTimeout(400);
  }

  // Helper to switch tab
  async function switchTab(domainLabel, tabPrefix) {
    return await page.evaluate(async ({ domLabel, tabPfx }) => {
      // 1. Click domain if not active
      const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const domBtn = allButtons.find(b => (b.textContent || '').trim().includes(domLabel));
      if (domBtn && domBtn.getAttribute('aria-pressed') !== 'true') {
        domBtn.click();
        await new Promise(r => setTimeout(r, 200));
      }

      // 2. Click tab
      const tabBtns = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const tabBtn = tabBtns.find(b => (b.textContent || '').trim().startsWith(tabPfx));
      if (tabBtn) {
        tabBtn.click();
        await new Promise(r => setTimeout(r, 300));
        return { found: true, active: tabBtn.getAttribute('aria-selected') === 'true' || tabBtn.getAttribute('tabindex') === '0' };
      }
      return { found: false };
    }, { domLabel: domainLabel, tabPfx: tabPrefix });
  }

  // Helper to check text contrast
  async function checkContrastInView(viewLabel, theme) {
    return await page.evaluate(({ viewLbl, curTheme }) => {
      function getRGB(colorStr) {
        const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
      }
      function luminance(r, g, b) {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      function contrastRatio(lum1, lum2) {
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function getEffectiveBg(el) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'transparent' && !bg.includes('rgba(0, 0, 0, 0)')) {
            const rgb = getRGB(bg);
            if (rgb) return rgb;
          }
          cur = cur.parentElement;
        }
        return curTheme === 'dark' ? [30, 31, 28] : [252, 252, 250];
      }

      const issues = [];
      const walker = document.createTreeWalker(
        document.querySelector('main') || document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let count = 0;
      while (walker.nextNode() && count < 200) {
        const node = walker.currentNode;
        const text = node.nodeValue?.trim();
        if (!text || text.length < 2) continue;
        const parent = node.parentElement;
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;

        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.top > window.innerHeight || rect.bottom < 0) continue;

        const cs = window.getComputedStyle(parent);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) continue;

        const fgRGB = getRGB(cs.color);
        if (!fgRGB) continue;
        const bgRGB = getEffectiveBg(parent);

        const lumFg = luminance(...fgRGB);
        const lumBg = luminance(...bgRGB);
        const ratio = contrastRatio(lumFg, lumBg);

        // WCAG AA is 4.5:1 for normal text, 3:1 for large text. If below 2.5:1, it's a severe contrast defect.
        if (ratio < 2.5) {
          issues.push({
            view: viewLbl,
            theme: curTheme,
            text: text.slice(0, 40),
            tag: parent.tagName,
            fg: cs.color,
            bg: `rgb(${bgRGB.join(',')})`,
            ratio: Math.round(ratio * 100) / 100,
          });
        }
        count++;
      }
      return issues;
    }, { viewLbl: viewLabel, curTheme: theme });
  }

  // 1. Audit Desktop 1440 across Dark & Light
  for (const theme of THEMES) {
    console.log(`\n=== Auditing Viewports on Theme: ${theme.toUpperCase()} ===`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(theme);

    for (const domain of DOMAINS) {
      for (const tab of domain.tabs) {
        const viewLabel = `${domain.label} > ${tab}`;
        const switchRes = await switchTab(domain.label, tab);
        await page.waitForTimeout(300);

        // Check overflow
        const overflow = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          return { docW, winW, hasOverflow: docW > winW + 5 };
        });

        if (overflow.hasOverflow) {
          report.overflowIssues.push({
            view: viewLabel,
            viewport: 'desktop-1440',
            theme,
            docW: overflow.docW,
            winW: overflow.winW,
          });
          console.warn(`  [Overflow] ${viewLabel} (${overflow.docW}px > ${overflow.winW}px)`);
        }

        // Check contrast
        const contrastIssues = await checkContrastInView(viewLabel, theme);
        if (contrastIssues.length > 0) {
          report.contrastIssues.push(...contrastIssues);
          console.warn(`  [Low Contrast] ${viewLabel} (${contrastIssues.length} elements with ratio < 2.5:1)`);
          contrastIssues.slice(0, 3).forEach(iss => {
            console.warn(`    - "${iss.text}" [${iss.tag}] fg:${iss.fg} bg:${iss.bg} ratio:${iss.ratio}`);
          });
        }

        report.viewsChecked.push({
          view: viewLabel,
          theme,
          viewport: 'desktop-1440',
          switched: switchRes.found,
          contrastIssuesCount: contrastIssues.length,
          hasOverflow: overflow.hasOverflow,
        });
      }
    }
  }

  // 2. Audit Mobile (390px) & Tablet (768px, 1024px) for overflow & responsiveness
  console.log('\n=== Checking Responsive Viewports (1024, 768, 390) ===');
  for (const vp of [VIEWPORTS[1], VIEWPORTS[2], VIEWPORTS[3]]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    for (const domain of DOMAINS) {
      for (const tab of domain.tabs) {
        const viewLabel = `${domain.label} > ${tab}`;
        await switchTab(domain.label, tab);
        await page.waitForTimeout(200);

        const overflow = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          return { docW, winW, hasOverflow: docW > winW + 5 };
        });

        if (overflow.hasOverflow) {
          report.overflowIssues.push({
            view: viewLabel,
            viewport: vp.name,
            theme: 'light',
            docW: overflow.docW,
            winW: overflow.winW,
          });
          console.warn(`  [Responsive Overflow] ${vp.name} ${viewLabel}: ${overflow.docW} > ${overflow.winW}`);
        }
      }
    }
  }

  // 3. In-depth SQL Editor Inspection (Dark & Light)
  console.log('\n=== Inspecting SQL Editor in Dark & Light Modes ===');
  await page.setViewportSize({ width: 1440, height: 900 });
  await switchTab('工程核心', 'SQL');
  await page.waitForTimeout(600);

  for (const theme of ['dark', 'light']) {
    await setTheme(theme);
    await page.waitForTimeout(400);

    const cmStyles = await page.evaluate(() => {
      const cmEl = document.querySelector('.cm-editor');
      const cmContent = document.querySelector('.cm-content');
      const cmGutters = document.querySelector('.cm-gutters');
      const cmLine = document.querySelector('.cm-line');
      if (!cmEl) return { found: false };

      const getStyle = el => el ? {
        color: window.getComputedStyle(el).color,
        bg: window.getComputedStyle(el).backgroundColor,
        fontFamily: window.getComputedStyle(el).fontFamily,
        fontSize: window.getComputedStyle(el).fontSize,
      } : null;

      return {
        found: true,
        editor: getStyle(cmEl),
        content: getStyle(cmContent),
        gutters: getStyle(cmGutters),
        firstLine: getStyle(cmLine),
      };
    });

    report.sqlEditorCheck[theme] = cmStyles;
    console.log(`  SQL Editor [${theme}]:`, JSON.stringify(cmStyles, null, 2));
  }

  // 4. Modal Integrity Checks
  console.log('\n=== Checking Modals ===');
  const modalsToTest = [
    { name: '导入数据 Modal', btnText: '导入' },
    { name: '新建数据表 Modal', btnText: '新建表' },
    { name: '快捷键 Modal', key: '?' },
  ];

  for (const m of modalsToTest) {
    if (m.btnText) {
      const opened = await page.evaluate((btnTxt) => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          b => (b.textContent || '').includes(btnTxt) || (b.getAttribute('title') || '').includes(btnTxt)
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, m.btnText);

      await page.waitForTimeout(500);
      const modalInfo = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], .fixed.inset-0');
        return {
          hasDialog: !!dialog,
          text: dialog ? dialog.textContent?.slice(0, 80) : '',
        };
      });

      // Press Escape to dismiss
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      report.modalChecks.push({ name: m.name, opened, ...modalInfo });
      console.log(`  Modal check [${m.name}]: opened=${modalInfo.hasDialog}`);
    } else if (m.key) {
      await page.keyboard.press(m.key);
      await page.waitForTimeout(500);
      const modalInfo = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], .fixed.inset-0');
        return {
          hasDialog: !!dialog,
          text: dialog ? dialog.textContent?.slice(0, 80) : '',
        };
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      report.modalChecks.push({ name: m.name, opened: true, ...modalInfo });
      console.log(`  Modal check [${m.name}]: opened=${modalInfo.hasDialog}`);
    }
  }

  await browser.close();

  const outPath = path.resolve('system-audit-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nAudit finished! Report written to ${outPath}`);
  console.log(`Total views verified: ${report.viewsChecked.length}`);
  console.log(`Total contrast issues: ${report.contrastIssues.length}`);
  console.log(`Total overflow issues: ${report.overflowIssues.length}`);
  console.log(`Total console errors: ${report.consoleErrors.length}`);
  console.log(`Total uncaught errors: ${report.uncaughtErrors.length}`);
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
