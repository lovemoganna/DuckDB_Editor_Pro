import { describe, expect, it } from 'vitest';
import { buildExecutionModel } from '../../components/ExecutionPlan/model/planParser';
import { formatExecutionGraphAsTextOutline } from '../../components/ExecutionPlan/model/formatPlanText';

describe('formatExecutionGraphAsTextOutline', () => {
  it('formats non-analyzed execution plan into clean hierarchical outline', () => {
    const rawJson = [
      {
        name: 'PROJECTION',
        children: [
          {
            name: 'SEQ_SCAN',
            children: [],
            extra_info: {
              Table: 'orders',
              'Estimated Cardinality': '100',
              Filters: 'status = 1',
            },
          },
        ],
        extra_info: {
          Projections: 'id, total',
          'Estimated Cardinality': '100',
        },
      },
    ];

    const graph = buildExecutionModel(rawJson);
    const outline = formatExecutionGraphAsTextOutline(graph);

    expect(outline).toContain('[PROJECTION] 列投影计算 (PROJECTION)');
    expect(outline).toContain('└── [SCAN] 顺序表扫描 (SEQ_SCAN)');
    expect(outline).toContain('Table: orders');
    expect(outline).toContain('Filters: status = 1');
    expect(outline).toContain('预估行: 100');
  });

  it('formats analyzed execution plan with timing, actual rows, and scanned rows', () => {
    const analyzeJson = {
      latency: 0.015,
      cpu_time: 0.03,
      children: [
        {
          operator_name: 'HASH_JOIN',
          operator_timing: 0.008,
          operator_cardinality: 500,
          children: [
            {
              operator_name: 'SEQ_SCAN',
              operator_timing: 0.002,
              operator_cardinality: 1000,
              operator_rows_scanned: 10000,
              extra_info: {
                Table: 'orders',
              },
              children: [],
            },
          ],
        },
      ],
    };

    const graph = buildExecutionModel(analyzeJson);
    const outline = formatExecutionGraphAsTextOutline(graph);

    expect(outline).toContain('总耗时 (Latency): 15.00 ms');
    expect(outline).toContain('CPU 时间 (CPU Time): 30.00 ms');
    expect(outline).toContain('[JOIN] 哈希关联 (HASH_JOIN)');
    expect(outline).toContain('8.00 ms');
    expect(outline).toContain('实际行: 500');
    expect(outline).toContain('扫描: 10,000');
  });

  it('handles empty or error graph safely', () => {
    const emptyGraph = buildExecutionModel('');
    const outline = formatExecutionGraphAsTextOutline(emptyGraph);
    expect(outline).toBe('/* 无执行步骤 */');
  });
});
