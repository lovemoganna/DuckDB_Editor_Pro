/**
 * components/ExecutionPlan/model/formatPlanText.ts
 *
 * Formats an ExecutionPlanGraph into a clean, human-readable, perfectly aligned text tree outline.
 * Solves misalignment caused by unequal-length operator titles and uneven box-drawing borders.
 */

import { ExecutionPlanGraph } from './types';

export function getVisualWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // CJK unified ideographs and full-width symbols take 2 character cells
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff01 && code <= 0xff60)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function padVisualRight(str: string, targetWidth: number): string {
  const w = getVisualWidth(str);
  return w >= targetWidth ? str : str + ' '.repeat(targetWidth - w);
}

export function padVisualLeft(str: string, targetWidth: number): string {
  const w = getVisualWidth(str);
  return w >= targetWidth ? str : ' '.repeat(targetWidth - w) + str;
}

export function formatExecutionGraphAsTextOutline(graph: ExecutionPlanGraph): string {
  if (!graph || graph.nodes.size === 0) {
    return '/* 无执行步骤 */';
  }

  const lines: string[] = [];

  // Summary Header with clean divider
  lines.push('── DuckDB Editor Pro — 物理执行计划大纲 (Text Outline) ──────────────────────────');

  const metaItems: string[] = [];
  if (typeof graph.queryLatencySeconds === 'number') {
    metaItems.push(`总耗时 (Latency): ${(graph.queryLatencySeconds * 1000).toFixed(2)} ms`);
  }
  if (typeof graph.queryCpuTimeSeconds === 'number') {
    metaItems.push(`CPU 时间 (CPU Time): ${(graph.queryCpuTimeSeconds * 1000).toFixed(2)} ms`);
  }
  if (typeof graph.systemPeakMemoryBytes === 'number' && graph.systemPeakMemoryBytes > 0) {
    const memMb = (graph.systemPeakMemoryBytes / (1024 * 1024)).toFixed(2);
    metaItems.push(`峰值内存 (Peak Memory): ${memMb} MB`);
  }

  if (metaItems.length > 0) {
    lines.push(metaItems.join('  |  '));
  }
  lines.push('─'.repeat(72));
  lines.push('');

  // 1. Aligned Metrics Matrix Table (if any nodes have metrics)
  const metricNodes = Array.from(graph.nodes.values()).filter(
    n =>
      n.metrics.timingMs !== undefined ||
      n.metrics.actualRows !== undefined ||
      n.metrics.rowsScanned !== undefined ||
      n.metrics.estimatedRows !== undefined
  );

  if (metricNodes.length > 0) {
    const rows = metricNodes.map(n => ({
      name: `${n.chineseName} (${n.name})`,
      timing: n.metrics.timingMs !== undefined ? n.metrics.timingMs.toFixed(2) : '-',
      actual: n.metrics.actualRows !== undefined ? n.metrics.actualRows.toLocaleString() : '-',
      scan: n.metrics.rowsScanned !== undefined ? n.metrics.rowsScanned.toLocaleString() : '-',
      est: n.metrics.estimatedRows !== undefined ? n.metrics.estimatedRows.toLocaleString() : '-',
    }));

    const nameColW = Math.max(24, ...rows.map(r => getVisualWidth(r.name)));
    const timingColW = Math.max(10, ...rows.map(r => getVisualWidth(r.timing)));
    const actualColW = Math.max(12, ...rows.map(r => getVisualWidth(r.actual)));
    const scanColW = Math.max(12, ...rows.map(r => getVisualWidth(r.scan)));
    const estColW = Math.max(10, ...rows.map(r => getVisualWidth(r.est)));

    lines.push('── 算子度量矩阵表 (Operator Metrics Matrix) ───────────────────────────');
    const headerStr = `${padVisualRight('算子名称', nameColW)}  ${padVisualLeft('耗时(ms)', timingColW)}  ${padVisualLeft('实际产出行', actualColW)}  ${padVisualLeft('扫描行数', scanColW)}  ${padVisualLeft('预估行数', estColW)}`;
    lines.push(headerStr);
    lines.push('─'.repeat(getVisualWidth(headerStr)));

    for (const r of rows) {
      lines.push(
        `${padVisualRight(r.name, nameColW)}  ${padVisualLeft(r.timing, timingColW)}  ${padVisualLeft(r.actual, actualColW)}  ${padVisualLeft(r.scan, scanColW)}  ${padVisualLeft(r.est, estColW)}`
      );
    }
    lines.push('─'.repeat(getVisualWidth(headerStr)));
    lines.push('');
  }

  // 2. Hierarchical Execution Tree
  lines.push('── 执行计划层次树 (Execution Tree) ───────────────────────────────────');

  const visited = new Set<string>();

  function renderSubtree(nodeId: string, prefix: string = '', isTail: boolean = true) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    const connector = prefix ? (isTail ? '└── ' : '├── ') : '';
    const childIndent = prefix + (prefix ? (isTail ? '    ' : '│   ') : '    ');

    // Title line: Category + Chinese name + Raw name
    lines.push(`${prefix}${connector}[${node.category.toUpperCase()}] ${node.chineseName} (${node.name})`);

    // Collect aligned attribute items
    const attrItems: string[] = [];

    // Metrics line
    const metricParts: string[] = [];
    if (node.metrics.timingMs !== undefined) {
      metricParts.push(`耗时: ${node.metrics.timingMs.toFixed(2)} ms`);
    }
    if (node.metrics.actualRows !== undefined) {
      metricParts.push(`实际行: ${node.metrics.actualRows.toLocaleString()}`);
    }
    if (node.metrics.estimatedRows !== undefined) {
      metricParts.push(`预估行: ${node.metrics.estimatedRows.toLocaleString()}`);
    }
    if (node.metrics.rowsScanned !== undefined) {
      metricParts.push(`扫描: ${node.metrics.rowsScanned.toLocaleString()}`);
    }
    if (metricParts.length > 0) {
      attrItems.push(`[指标] ${metricParts.join('  |  ')}`);
    }

    // Detail lines
    if (node.extraInfo['Table']) attrItems.push(`[对象] Table: ${node.extraInfo['Table']}`);
    if (node.extraInfo['Filters']) attrItems.push(`[过滤] Filters: ${node.extraInfo['Filters']}`);
    if (node.extraInfo['Conditions']) attrItems.push(`[条件] Conditions: ${node.extraInfo['Conditions']}`);
    if (node.extraInfo['Projections']) attrItems.push(`[投影] Projections: ${node.extraInfo['Projections']}`);
    if (node.extraInfo['Detail']) attrItems.push(`[详情] Detail: ${node.extraInfo['Detail']}`);

    // Diagnostics
    for (const diag of node.diagnostics) {
      attrItems.push(`[诊断] ⚠ ${diag.title}: ${diag.phenomenon}`);
    }

    const hasChildren = node.childrenIds.length > 0;

    // Render attributes seamlessly
    for (let i = 0; i < attrItems.length; i++) {
      const isLastAttr = !hasChildren && i === attrItems.length - 1;
      const attrConnector = isLastAttr ? '└─ ' : '├─ ';
      lines.push(`${childIndent}${attrConnector}${attrItems[i]}`);
    }

    // Render child operators
    for (let i = 0; i < node.childrenIds.length; i++) {
      const isLastChild = i === node.childrenIds.length - 1;
      renderSubtree(node.childrenIds[i], childIndent, isLastChild);
    }
  }

  // Start from root node
  const startId = graph.rootNodeId && graph.nodes.has(graph.rootNodeId)
    ? graph.rootNodeId
    : Array.from(graph.nodes.keys())[0];

  if (startId) {
    renderSubtree(startId);
  }

  // Handle any disconnected components
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      lines.push('');
      lines.push('── [独立分支 / 子计划] ─────────────────────────────────────────────');
      renderSubtree(nodeId);
    }
  }

  return lines.join('\n');
}
