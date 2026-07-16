import { Edge, Node } from 'reactflow';
import { OntologyLayoutMode } from './OntologyLayout';
import {
  getGraphNodeRect,
  getOrthogonalRouteForEdge,
  GraphPoint,
  GraphRect,
  OrthogonalRoute,
} from './OntologyRouting';

export interface OntologyExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OntologySvgExport {
  svg: string;
  bounds: OntologyExportBounds;
  routes: Array<{ edge: Edge; route: OrthogonalRoute }>;
}

const PALETTE = ['#a1a1aa', '#66d9ef', '#a6e22e', '#e6db74', '#fd971f', '#f92672', '#ae81ff'];

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const round = (value: number) => Math.round(value * 10) / 10;

const getBounds = (
  rects: GraphRect[],
  routes: Array<{ edge: Edge; route: OrthogonalRoute }>,
  padding: number,
): OntologyExportBounds => {
  if (rects.length === 0) return { x: 0, y: 0, width: padding * 2 + 1, height: padding * 2 + 1 };
  let minX = Math.min(...rects.map((rect) => rect.x));
  let minY = Math.min(...rects.map((rect) => rect.y));
  let maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  let maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  routes.forEach(({ edge, route }) => {
    route.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    const labelWidth = Math.min(240, Math.max(44, String(edge.label ?? '').length * 7 + 18));
    minX = Math.min(minX, route.label.x - labelWidth / 2);
    maxX = Math.max(maxX, route.label.x + labelWidth / 2);
    minY = Math.min(minY, route.label.y - 13);
    maxY = Math.max(maxY, route.label.y + 13);
  });
  return {
    x: round(minX - padding),
    y: round(minY - padding),
    width: round(Math.max(1, maxX - minX + padding * 2)),
    height: round(Math.max(1, maxY - minY + padding * 2)),
  };
};

const renderProperties = (node: Node, rect: GraphRect) => {
  if (rect.height < 120) return '';
  const raw = node.data?.obj?.properties;
  try {
    const properties = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {});
    return Object.entries(properties).slice(0, 3).map(([key, value], index) => `
      <text x="14" y="${78 + index * 17}" class="node-prop">
        <tspan class="node-prop-key">${escapeXml(key)}:</tspan>
        <tspan dx="5">${escapeXml(String(value))}</tspan>
      </text>`).join('');
  } catch {
    return '';
  }
};

const renderNode = (node: Node, rect: GraphRect, index: number) => {
  const object = node.data?.obj ?? {};
  const type = node.data?.type ?? {};
  const color = PALETTE[Math.abs(Number(object.object_type_id ?? index)) % PALETTE.length];
  const name = String(object.name ?? node.data?.label ?? node.id);
  const typeName = String(type.name ?? '未分类');
  const nameSize = Math.max(9, Math.min(13, 185 / Math.max(8, name.length) * 1.5));
  const clipId = `node-clip-${index}`;
  return `
    <g class="ontology-export-node" transform="translate(${round(rect.x)} ${round(rect.y)})" data-node-id="${escapeXml(node.id)}">
      <defs><clipPath id="${clipId}"><rect width="${round(rect.width)}" height="${round(rect.height)}" rx="8"/></clipPath></defs>
      <rect width="${round(rect.width)}" height="${round(rect.height)}" rx="8" class="node-surface"/>
      <rect width="${round(rect.width)}" height="3" fill="${color}" clip-path="url(#${clipId})"/>
      <circle cx="18" cy="25" r="5" fill="${color}" opacity="0.9"/>
      <text x="31" y="30" class="node-title" style="font-size:${round(nameSize)}px">${escapeXml(name)}</text>
      <rect x="14" y="45" width="${Math.min(rect.width - 28, Math.max(46, typeName.length * 7 + 14))}" height="20" rx="3" fill="${color}" opacity="0.12"/>
      <text x="21" y="59" class="node-type" fill="${color}">${escapeXml(typeName)}</text>
      ${renderProperties(node, rect)}
    </g>`;
};

const renderEdge = (edge: Edge, route: OrthogonalRoute, index: number) => {
  const label = String(edge.label ?? '');
  const labelWidth = Math.min(240, Math.max(44, label.length * 7 + 18));
  return `
    <g class="ontology-export-edge" data-edge-id="${escapeXml(edge.id)}">
      <path d="${route.path}" marker-end="url(#ontology-arrow)"/>
      ${label ? `<g transform="translate(${round(route.label.x)} ${round(route.label.y)})">
        <rect x="${round(-labelWidth / 2)}" y="-11" width="${round(labelWidth)}" height="22" rx="4" class="edge-label-bg"/>
        <text y="4" class="edge-label">${escapeXml(label)}</text>
      </g>` : ''}
    </g>`;
};

/**
 * Builds a self-contained SVG directly from graph coordinates. No viewport
 * translation, zoom, scroll offset, or visible-container dimensions enter the
 * calculation, so every export has the same exact bounds for the same graph.
 */
export const buildOntologyExportSvg = (
  nodes: Node[],
  edges: Edge[],
  mode: OntologyLayoutMode,
  padding = 36,
): OntologySvgExport => {
  const rects = nodes.map(getGraphNodeRect);
  const routes = edges.map((edge, index) => ({
    edge,
    route: getOrthogonalRouteForEdge(nodes, edge, mode, Number(edge.data?.laneOffset ?? ((index % 3) - 1) * 8)),
  })).filter((item): item is { edge: Edge; route: OrthogonalRoute } => Boolean(item.route));
  const bounds = getBounds(rects, routes, padding);
  const rectById = new Map(rects.map((rect) => [rect.id, rect]));
  const nodeMarkup = nodes
    .map((node, index) => renderNode(node, rectById.get(node.id)!, index))
    .join('');
  const edgeMarkup = routes.map(({ edge, route }, index) => renderEdge(edge, route, index)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" role="img" aria-label="Ontology canvas export">
  <defs>
    <marker id="ontology-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a"/>
    </marker>
    <style>
      .ontology-export-edge > path { fill: none; stroke: #52525b; stroke-width: 1.6; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
      .node-surface { fill: #101116; stroke: #3f3f46; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
      text { font-family: Inter, "Segoe UI", "Microsoft YaHei", sans-serif; }
      .node-title { fill: #f4f4f5; font-weight: 700; }
      .node-type { font-size: 9px; font-weight: 700; letter-spacing: .04em; }
      .node-prop { fill: #d4d4d8; font-family: Consolas, monospace; font-size: 9px; }
      .node-prop-key { fill: #71717a; font-weight: 700; }
      .edge-label-bg { fill: #0c0d12; stroke: #3f3f46; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .edge-label { fill: #e4e4e7; font-family: Consolas, monospace; font-size: 10px; font-weight: 650; text-anchor: middle; }
    </style>
  </defs>
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#0c0d12"/>
  <g class="ontology-export-edges">${edgeMarkup}</g>
  <g class="ontology-export-nodes">${nodeMarkup}</g>
</svg>`;
  return { svg, bounds, routes };
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const svgToRasterBlob = async (
  svg: string,
  width: number,
  height: number,
  format: 'png' | 'jpeg',
) => {
  const requestedScale = 3;
  const maximumDimension = 16384;
  const maximumPixels = 96_000_000;
  const scale = Math.max(0.25, Math.min(
    requestedScale,
    maximumDimension / Math.max(1, width),
    maximumDimension / Math.max(1, height),
    Math.sqrt(maximumPixels / Math.max(1, width * height)),
  ));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片画布');

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片编码失败')), mimeType, 0.96);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadOntologyGraph = async (
  nodes: Node[],
  edges: Edge[],
  mode: OntologyLayoutMode,
  format: 'png' | 'jpeg' | 'svg',
) => {
  if (nodes.length === 0) throw new Error('画布中没有可导出的实体');
  const { svg, bounds } = buildOntologyExportSvg(nodes, edges, mode);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'svg') {
    saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `ontology-canvas-${timestamp}.svg`);
    return { bounds, pixelWidth: bounds.width, pixelHeight: bounds.height, scale: 1 };
  }
  const blob = await svgToRasterBlob(svg, finite(bounds.width, 1), finite(bounds.height, 1), format);
  saveBlob(blob, `ontology-canvas-${timestamp}.${format === 'jpeg' ? 'jpg' : 'png'}`);
  const requestedScale = 3;
  const scale = Math.min(requestedScale, 16384 / bounds.width, 16384 / bounds.height, Math.sqrt(96_000_000 / (bounds.width * bounds.height)));
  return {
    bounds,
    pixelWidth: Math.round(bounds.width * scale),
    pixelHeight: Math.round(bounds.height * scale),
    scale,
  };
};
