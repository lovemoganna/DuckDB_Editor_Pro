import { GraphNode, GraphLink } from './D3GraphView.types';
import { ICON_HEXAGON, ICON_BOX, ICON_BOLT } from './D3GraphView.visuals';

export interface GraphExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface GraphSvgExport {
  svg: string;
  bounds: GraphExportBounds;
}

const finite = (val: number, fallback = 0) => (Number.isFinite(val) ? val : fallback);
const round = (val: number) => Math.round(val * 10) / 10;

const escapeXml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Gets exact semantic icon path for each node type (Host, DB, Server, Port, Share, TypeHub, Action, Box)
 */
export const getNodeIconPath = (d: GraphNode): string => {
  if (d.group === 'typeHub') return ICON_HEXAGON;
  if (d.group === 'action') return ICON_BOLT;
  const typeName = (d._typeName || '').toLowerCase();
  const label = (d.label || '').toLowerCase();

  if (typeName.includes('host') || typeName.includes('主机') || label.includes('host') || label.includes('192.168.')) {
    return 'M -6,-4 H 6 V 2 H -6 Z M -8,4 H 8 M -2,2 L -4,4 H 4 L 2,2';
  }
  if (typeName.includes('server') || typeName.includes('服务器') || typeName.includes('dns') || typeName.includes('web')) {
    return 'M -6,-5 H 6 V -2 H -6 Z M -6,-1 H 6 V 2 H -6 Z M -6,3 H 6 V 6 H -6 Z M -3,-3.5 H -2 M -3,0.5 H -2 M -3,4.5 H -2';
  }
  if (typeName.includes('db') || typeName.includes('database') || typeName.includes('数据库') || typeName.includes('duckdb')) {
    return 'M -6,-3 C -6,-5 6,-5 6,-3 C 6,-1 -6,-1 -6,-3 M -6,-3 V 3 C -6,5 6,5 6,3 V -3';
  }
  if (typeName.includes('port') || typeName.includes('端口') || typeName.includes('service') || typeName.includes('服务')) {
    return 'M -3,-6 H 3 V -2 H -3 Z M -4,-2 H 4 V 3 C 4,5 -4,5 -4,3 Z M 0,4 V 8';
  }
  if (typeName.includes('network') || typeName.includes('网络') || typeName.includes('subnet') || typeName.includes('网段')) {
    return 'M -6,2 A 3,3 0 0 1 -3,-2 A 4,4 0 0 1 3,-2 A 3,3 0 0 1 6,2 Z';
  }
  if (typeName.includes('share') || typeName.includes('共享') || typeName.includes('folder') || typeName.includes('文件夹')) {
    return 'M -7,-5 H -2 L 0,-3 H 7 V 5 H -7 Z';
  }
  return ICON_BOX;
};

export const getNodeFillColor = (d: GraphNode): string => {
  const typeName = (d._typeName || '').toLowerCase();
  const label = (d.label || '').toLowerCase();

  if (d.group === 'typeHub') return d.color || '#66d9ef';
  if (d.group === 'action') return '#3b82f6';

  if (typeName.includes('host') || typeName.includes('主机') || label.includes('host') || label.includes('192.168.')) {
    return '#ffffff';
  }
  if (typeName.includes('port') || typeName.includes('端口') || typeName.includes('service') || typeName.includes('服务')) {
    const isRisky = label.includes('21') || label.includes('22') || label.includes('445') || label.includes('3389') || label.includes('danger') || label.includes('risk') || label.includes('ftp') || label.includes('smb');
    return isRisky ? '#ef4444' : '#3b82f6';
  }
  if (typeName.includes('share') || typeName.includes('共享') || typeName.includes('folder')) {
    return '#f97316';
  }
  return d.color || '#a070d0';
};

/**
 * Calculates absolute bounding box of nodes and edges in graph data coordinates.
 */
export const computeGraphBounds = (
  nodes: GraphNode[],
  padding = 60
): GraphExportBounds => {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    const x = finite(n.x, 0);
    const y = finite(n.y, 0);
    const r = (n.size || 12) + 20;
    minX = Math.min(minX, x - r - 80); // padding for label
    maxX = Math.max(maxX, x + r + 120);
    minY = Math.min(minY, y - r - 20);
    maxY = Math.max(maxY, y + r + 20);
  });

  const width = Math.max(200, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(150, Math.ceil(maxY - minY + padding * 2));

  return {
    minX: round(minX - padding),
    minY: round(minY - padding),
    maxX: round(maxX + padding),
    maxY: round(maxY + padding),
    width,
    height,
  };
};

/**
 * Collects 1-hop and 2-hop connected subgraph nodes and links for a target node.
 */
export const collectSubgraph = (
  targetNodeId: string,
  allNodes: GraphNode[],
  allLinks: GraphLink[],
  maxHops = 1
): { subgraphNodes: GraphNode[]; subgraphLinks: GraphLink[] } => {
  const connectedNodeIds = new Set<string>([targetNodeId]);
  let currentHopIds = new Set<string>([targetNodeId]);

  for (let hop = 0; hop < maxHops; hop++) {
    const nextHopIds = new Set<string>();
    allLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);

      if (currentHopIds.has(sId) && !connectedNodeIds.has(tId)) {
        connectedNodeIds.add(tId);
        nextHopIds.add(tId);
      }
      if (currentHopIds.has(tId) && !connectedNodeIds.has(sId)) {
        connectedNodeIds.add(sId);
        nextHopIds.add(sId);
      }
    });
    currentHopIds = nextHopIds;
  }

  const subgraphNodes = allNodes.filter(n => connectedNodeIds.has(n.id));
  const subgraphLinks = allLinks.filter(l => {
    const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
    const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
    return connectedNodeIds.has(sId) && connectedNodeIds.has(tId);
  });

  return { subgraphNodes, subgraphLinks };
};

/**
 * Generates vector SVG markup for D3GraphView data with crisp node icons, borders & property badges.
 */
export const buildD3GraphExportSvg = (
  nodes: GraphNode[],
  links: GraphLink[],
  linkTypeMap: Record<number, any> = {},
  padding = 60
): GraphSvgExport => {
  const bounds = computeGraphBounds(nodes, padding);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Link SVG markup
  const linkElementsMarkup = links.map(link => {
    const srcNode = typeof link.source === 'object' ? (link.source as GraphNode) : nodeMap.get(String(link.source));
    const tgtNode = typeof link.target === 'object' ? (link.target as GraphNode) : nodeMap.get(String(link.target));
    if (!srcNode || !tgtNode) return '';

    const sx = finite(srcNode.x, 0);
    const sy = finite(srcNode.y, 0);
    const tx = finite(tgtNode.x, 0);
    const ty = finite(tgtNode.y, 0);

    const color = link.color || '#66d9ef';
    const relName = link._linkTypeName || (link._linkTypeId !== undefined ? linkTypeMap[link._linkTypeId]?.name : '');
    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;

    return `
      <g class="graph-export-link">
        <line x1="${round(sx)}" y1="${round(sy)}" x2="${round(tx)}" y2="${round(ty)}" stroke="${color}" stroke-width="2" stroke-opacity="0.85" marker-end="url(#arrow-export)"/>
        ${relName ? `
          <g transform="translate(${round(midX)} ${round(midY)})">
            <rect x="${round(-Math.min(60, relName.length * 6))}" y="-9" width="${round(Math.min(120, relName.length * 12 + 10))}" height="18" rx="4" fill="#1e1f1c" stroke="${color}" stroke-width="1.2" opacity="0.95"/>
            <text y="4" fill="${color}" font-size="10" font-weight="bold" text-anchor="middle">${escapeXml(relName)}</text>
          </g>
        ` : ''}
      </g>`;
  }).join('\n');

  // Node SVG markup with semantic icon rendering
  const nodeElementsMarkup = nodes.map(n => {
    const x = finite(n.x, 0);
    const y = finite(n.y, 0);
    const isTypeHub = n.group === 'typeHub';
    const isAction = n.group === 'action';
    const r = isTypeHub ? 28 : isAction ? 7 : 12;

    const fillColor = getNodeFillColor(n);
    const strokeColor = isTypeHub ? fillColor : (fillColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : '#66d9ef');
    const iconPath = getNodeIconPath(n);
    const label = String(n.label || n.id);
    const iconColor = fillColor === '#ffffff' ? '#0c0d12' : 'rgba(255,255,255,0.9)';
    const iconScale = isTypeHub ? 'scale(1.6) translate(0, 1)' : isAction ? 'scale(0.55) translate(0, 1)' : 'scale(0.9)';

    return `
      <g class="graph-export-node" transform="translate(${round(x)}, ${round(y)})">
        ${isTypeHub ? `
          <circle r="${r + 6}" fill="none" stroke="${fillColor}" stroke-width="1.5" stroke-opacity="0.35"/>
          <circle r="${r}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        ` : `
          <circle r="${r}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" fill-opacity="0.95"/>
        `}
        
        <!-- Node Icon Vector Path -->
        <path d="${iconPath}" transform="${iconScale}" fill="none" stroke="${iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Node Label -->
        <text x="${r + 8}" y="4" fill="#ffffff" font-size="${isTypeHub ? 13 : 11}" font-weight="bold" font-family="Inter, sans-serif" paint-order="stroke" stroke="#12131a" stroke-width="3.5" stroke-linejoin="round">${escapeXml(label)}</text>
        
        <!-- Property Badge -->
        ${n._propsCount ? `
          <circle cx="${r * 0.65}" cy="${r * 0.65}" r="7" fill="#FF6B35" stroke="rgba(0,0,0,0.6)" stroke-width="1"/>
          <text x="${r * 0.65}" y="${r * 0.65 + 3}" text-anchor="middle" font-size="9" font-weight="bold" fill="white">${n._propsCount}</text>
        ` : ''}
      </g>`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" role="img" aria-label="Knowledge Graph Export">
  <defs>
    <marker id="arrow-export" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#66d9ef"/>
    </marker>
    <style>
      text { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    </style>
  </defs>
  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="#12131a"/>
  <g class="export-links">${linkElementsMarkup}</g>
  <g class="export-nodes">${nodeElementsMarkup}</g>
</svg>`;

  return { svg, bounds };
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
  format: 'png' | 'jpeg'
): Promise<Blob> => {
  const requestedScale = 3;
  const maximumDimension = 16384;
  const scale = Math.max(
    0.5,
    Math.min(
      requestedScale,
      maximumDimension / Math.max(1, width),
      maximumDimension / Math.max(1, height)
    )
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片导出 Canvas');

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
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('导出图片编码失败'))), mimeType, 0.96);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Downloads full knowledge graph or target node subgraph as PNG/JPEG/SVG.
 */
export const downloadD3GraphImage = async (
  nodes: GraphNode[],
  links: GraphLink[],
  linkTypeMap: Record<number, any> = {},
  format: 'png' | 'jpeg' | 'svg' = 'png',
  filenamePrefix = 'knowledge-graph'
) => {
  if (nodes.length === 0) throw new Error('图谱中无节点数据');

  const { svg, bounds } = buildD3GraphExportSvg(nodes, links, linkTypeMap);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenamePrefix}-${timestamp}.${format === 'jpeg' ? 'jpg' : format}`;

  if (format === 'svg') {
    saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
    return;
  }

  const blob = await svgToRasterBlob(svg, bounds.width, bounds.height, format);
  saveBlob(blob, filename);
};

/**
 * Batch exports all node subgraphs as individual images consecutively.
 */
export const exportAllSubgraphs = async (
  nodes: GraphNode[],
  links: GraphLink[],
  linkTypeMap: Record<number, any> = {},
  onProgress?: (current: number, total: number, label: string) => void
) => {
  const instanceNodes = nodes.filter(n => n.group === 'instance' || n.group === 'typeHub');
  if (instanceNodes.length === 0) throw new Error('图中无有效实体节点');

  const total = instanceNodes.length;
  for (let i = 0; i < total; i++) {
    const node = instanceNodes[i];
    if (onProgress) onProgress(i + 1, total, node.label || node.id);

    const { subgraphNodes, subgraphLinks } = collectSubgraph(node.id, nodes, links, 1);
    if (subgraphNodes.length <= 1 && subgraphLinks.length === 0) continue;

    const safeLabel = (node.label || node.id).replace(/[/\\?%*:|"<>]/g, '_');
    await downloadD3GraphImage(
      subgraphNodes,
      subgraphLinks,
      linkTypeMap,
      'png',
      `subgraph-${i + 1}-${safeLabel}`
    );

    // Yield control to UI thread briefly so downloads don't block
    await new Promise(r => setTimeout(r, 120));
  }
};
