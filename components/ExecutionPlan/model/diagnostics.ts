/**
 * components/ExecutionPlan/model/diagnostics.ts
 *
 * Phenomenon-based Diagnostic Engine for DuckDB Execution Plans.
 *
 * Strict Principles:
 * 1. Only report observed factual phenomena (never speculate on unproven root causes).
 * 2. Explicitly tagged with `source: 'editor_pro_derived'`.
 * 3. Operates purely on ExecutionModel nodes without touching raw DuckDB data.
 * 4. Concise, direct, and actionable language (no fluff).
 */

import { DiagnosticSignal, ExecutionNode } from './types';

export function computeDiagnostics(
  node: ExecutionNode,
  childrenNodes: ExecutionNode[],
  totalOperatorTimingSeconds: number
): DiagnosticSignal[] {
  const signals: DiagnosticSignal[] = [];
  const metrics = node.metrics;

  // 1. High Scan Ratio: rows scanned substantially exceeds output rows
  if (
    typeof metrics.rowsScanned === 'number' &&
    typeof metrics.actualRows === 'number' &&
    metrics.rowsScanned >= 100
  ) {
    if (metrics.actualRows === 0 || metrics.rowsScanned >= metrics.actualRows * 10) {
      const filteredPct = Math.round(
        ((metrics.rowsScanned - metrics.actualRows) / metrics.rowsScanned) * 100
      );
      signals.push({
        type: 'high_scan_ratio',
        severity: 'warning',
        title: '扫描过滤比过低',
        phenomenon: `读 ${metrics.rowsScanned.toLocaleString()} 行仅出 ${metrics.actualRows.toLocaleString()} 行 (初筛淘汰率约 ${filteredPct}%)，建议下推过滤谓词或建索引。`,
        source: 'editor_pro_derived',
      });
    }
  }

  // 2. Cardinality Mismatch: Estimated Cardinality diverges markedly from Actual Cardinality
  if (
    typeof metrics.estimatedRows === 'number' &&
    typeof metrics.actualRows === 'number' &&
    metrics.estimatedRows > 0 &&
    metrics.actualRows > 0
  ) {
    const ratio = metrics.actualRows / metrics.estimatedRows;
    if (ratio >= 5 || ratio <= 0.2) {
      const times = ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1);
      const direction = ratio >= 1 ? '偏高' : '偏低';
      signals.push({
        type: 'cardinality_mismatch',
        severity: 'info',
        title: '预估基数失真',
        phenomenon: `实际行数 (${metrics.actualRows.toLocaleString()}) 与预估 (${metrics.estimatedRows.toLocaleString()}) 相差约${direction} ${times} 倍，可能影响关联顺序。`,
        source: 'editor_pro_derived',
      });
    }
  }

  // 3. Data Explosion: Output rows noticeably exceed the sum of input rows (especially in Joins)
  if (
    node.category === 'join' &&
    typeof metrics.actualRows === 'number' &&
    childrenNodes.length > 0
  ) {
    const totalInputRows = childrenNodes.reduce((sum, c) => sum + (c.metrics.actualRows ?? 0), 0);
    if (totalInputRows > 0 && metrics.actualRows > totalInputRows * 1.5 && metrics.actualRows > 20) {
      const expansionFactor = (metrics.actualRows / totalInputRows).toFixed(1);
      signals.push({
        type: 'data_explosion',
        severity: 'warning',
        title: '关联数据膨胀',
        phenomenon: `输入总计 ${totalInputRows.toLocaleString()} 行，关联输出 ${metrics.actualRows.toLocaleString()} 行 (放大约 ${expansionFactor} 倍)，请检查关联键是否非唯一。`,
        source: 'editor_pro_derived',
      });
    }
  }

  // 4. Timing Hotspot: Operator timing accounts for >= 35% of total operator timing
  if (
    typeof metrics.timingSeconds === 'number' &&
    metrics.timingSeconds > 0.0005 &&
    totalOperatorTimingSeconds > 0
  ) {
    const timingShare = (metrics.timingSeconds / totalOperatorTimingSeconds) * 100;
    if (timingShare >= 35) {
      signals.push({
        type: 'timing_hotspot',
        severity: 'critical',
        title: '核心耗时瓶颈',
        phenomenon: `该单算子耗时 (${(metrics.timingSeconds * 1000).toFixed(2)} ms) 占总算子耗时的 ${timingShare.toFixed(1)}%，为主要性能瓶颈。`,
        source: 'editor_pro_derived',
      });
    }
  }

  return signals;
}
