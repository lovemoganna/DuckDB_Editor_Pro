/** Expand scrollable chart content in the export clone, without changing the UI. */
export function expandChartExport(document: Document, element: HTMLElement) {
  const clone = document.getElementById(element.id);
  if (!clone) return;
  let width = element.clientWidth;
  clone.querySelectorAll<HTMLElement>('[aria-label="图表绘图区"], [aria-label="图例"], [aria-label="分类数值"]').forEach(region => {
    width = Math.max(width, region.scrollWidth + 32);
    region.style.flex = 'none';
    region.style.width = `${region.scrollWidth}px`;
    region.style.height = `${region.scrollHeight}px`;
    region.style.maxHeight = 'none'; region.style.overflow = 'visible';
    if (region.parentElement) { region.parentElement.style.height = 'auto'; region.parentElement.style.overflow = 'visible'; }
  });
  if (element.hasAttribute('data-chart-viewport')) width = Math.max(width, element.scrollWidth);
  clone.style.width = `${width}px`; clone.style.height = 'auto'; clone.style.minHeight = `${element.scrollHeight}px`; clone.style.overflow = 'visible';
}
