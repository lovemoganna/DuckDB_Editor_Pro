async page => {
  const groups = [
    ['工程核心', ['仪表盘', '数据', 'Schema', 'SQL', '数据流']],
    ['分析洞察', ['指标', '可视化', '分析', '历史', '审计']],
    ['知识沉淀', ['知识资产', '插件', '知识联动']],
    ['AI 认知', ['本体图谱', '技能', '能力', '推演']],
  ];
  const results = [];
  for (const [group, routes] of groups) {
    await page.getByRole('button', {name: group, exact: true}).click();
    for (const route of routes) {
      await page.getByRole('tablist', {name: `${group}功能标签页`}).getByRole('tab', {name: route, exact: true}).click();
      await page.locator('main').first().waitFor();
      const tabs = await page.locator('main [role=tab]').evaluateAll(nodes => nodes.map(n => (n.getAttribute('aria-label') || n.textContent || '').trim()).filter(Boolean));
      for (const name of [...new Set(tabs)]) {
        try {
          const tab = page.locator('main').getByRole('tab', {name, exact: true});
          if (await tab.count() !== 1 || await tab.isDisabled()) continue;
          await tab.click();
          await page.waitForFunction(() => !document.querySelector('main [role=status] .animate-spin'), undefined, {timeout:15000});
          const screenshot = `docs/system-consistency-20261012/subviews/${String(results.length + 1).padStart(2, '0')}.png`;
          await page.screenshot({path:screenshot});
          results.push({group,route,name,screenshot, selected:await tab.getAttribute('aria-selected'),text:(await page.locator('main').first().innerText()).slice(0,600)});
        } catch(error) { results.push({group,route,name,blocked:String(error)}); }
      }
    }
  }
  return results;
}
