async (page) => {
  await page.reload();
  await page.getByRole('status').filter({ hasText: '真实查询完成' }).waitFor();
  await page.getByLabel('类型', { exact: true }).selectOption('histogram');
  await page.getByRole('status').filter({ hasText: '真实查询完成' }).waitFor();
  await page.getByRole('button', { name: '字段配置', exact: true }).click();
  await page.getByLabel('分箱宽度', { exact: true }).fill('10000');
  await page.getByRole('button', { name: '应用', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '真实查询完成' }).waitFor();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('section canvas');
    const pixels = canvas?.toDataURL();
    const previous = window.__scrollPaint;
    window.__scrollPaint = { pixels, frames: previous?.pixels === pixels ? previous.frames + 1 : 0 };
    return window.__scrollPaint.frames >= 8;
  }, undefined, { polling: 'raf', timeout: 10000 });
  const region = page.getByRole('region', { name: '验收图表' });
  const state = await region.evaluate(element => {
    const scroll = [...element.querySelectorAll('*')].find(child =>
      child.scrollWidth > child.clientWidth + 4 && getComputedStyle(child).overflowX === 'auto');
    if (!scroll) throw new Error('Missing horizontal content access');
    scroll.scrollLeft = scroll.scrollWidth;
    return { width: scroll.clientWidth, contentWidth: scroll.scrollWidth, scrollLeft: scroll.scrollLeft };
  });
  if (!(state.scrollLeft > 0)) throw new Error('Content does not scroll');
  await page.screenshot({ path: 'output/playwright/global-governance/histogram-scrolled-1009.png' });
  return state;
}
