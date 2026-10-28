import { describe, expect, it } from 'vitest';
import { buildExecutionModel, extractJsonPayload } from '../../components/ExecutionPlan/model/planParser';

describe('Execution Model Plan Parser', () => {
  it('parses structured physical plan JSON (non-analyzed)', () => {
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
    expect(graph.isAnalyzed).toBe(false);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.length).toBe(1);

    // Verify root
    const root = graph.nodes.get(graph.rootNodeId);
    expect(root).toBeDefined();
    expect(root?.name).toBe('PROJECTION');
    expect(root?.category).toBe('projection');
    expect(root?.metrics.estimatedRows).toBe(100);

    // Missing actual metrics must be strictly undefined (never 0)
    expect(root?.metrics.actualRows).toBeUndefined();
    expect(root?.metrics.timingSeconds).toBeUndefined();
    expect(root?.metrics.rowsScanned).toBeUndefined();

    // Verify child
    const childId = root?.childrenIds[0]!;
    const child = graph.nodes.get(childId);
    expect(child?.name).toBe('SEQ_SCAN');
    expect(child?.category).toBe('scan');
    expect(child?.extraInfo['Table']).toBe('orders');

    // Edge direction: child (source) -> root (target)
    const edge = graph.edges[0];
    expect(edge.source).toBe(childId);
    expect(edge.target).toBe(root?.id);
  });

  it('parses full ANALYZE profiling JSON with latency, CPU time, and operator timings', () => {
    const analyzeJson = {
      query_name: '',
      latency: 0.0152,
      cpu_time: 0.0304,
      system_peak_buffer_memory: 204800,
      children: [
        {
          operator_name: 'EXPLAIN_ANALYZE',
          children: [
            {
              operator_name: 'HASH_GROUP_BY',
              operator_type: 'HASH_GROUP_BY',
              operator_timing: 0.008,
              operator_cardinality: 10,
              operator_rows_scanned: 0,
              cpu_time: 0.016,
              extra_info: {
                Groups: 'grp',
                Aggregates: 'count()',
                'Estimated Cardinality': '12',
              },
              children: [
                {
                  operator_name: 'SEQ_SCAN',
                  operator_type: 'TABLE_SCAN',
                  operator_timing: 0.002,
                  operator_cardinality: 100,
                  operator_rows_scanned: 1000,
                  cpu_time: 0.004,
                  extra_info: {
                    Table: 'users',
                    'Estimated Cardinality': '100',
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const graph = buildExecutionModel(analyzeJson);
    expect(graph.isAnalyzed).toBe(true);
    expect(graph.queryLatencySeconds).toBeCloseTo(0.0152);
    expect(graph.queryCpuTimeSeconds).toBeCloseTo(0.0304);
    expect(graph.systemPeakMemoryBytes).toBe(204800);

    // Root operator unwrapped from EXPLAIN_ANALYZE envelope
    const root = graph.nodes.get(graph.rootNodeId);
    expect(root?.name).toBe('HASH_GROUP_BY');
    expect(root?.metrics.actualRows).toBe(10);
    expect(root?.metrics.timingMs).toBeCloseTo(8.0);
    expect(root?.metrics.estimatedRows).toBe(12);

    // Total operator timing sum = 0.008 + 0.002 = 0.01s
    expect(graph.totalOperatorTimingSeconds).toBeCloseTo(0.01);
    expect(root?.metrics.timingPercentage).toBeCloseTo(80.0);

    // Child seq scan
    const scanNode = graph.nodes.get(root?.childrenIds[0]!);
    expect(scanNode?.name).toBe('SEQ_SCAN');
    expect(scanNode?.metrics.actualRows).toBe(100);
    expect(scanNode?.metrics.rowsScanned).toBe(1000);
    expect(scanNode?.metrics.timingPercentage).toBeCloseTo(20.0);
  });

  it('handles unknown operators and preserves raw names and attributes', () => {
    const jsonWithUnknown = [
      {
        name: 'EXPERIMENTAL_VECTOR_ENGINE',
        children: [],
        extra_info: {
          'Estimated Cardinality': '42',
          CustomProp: 'test_value',
        },
      },
    ];

    const graph = buildExecutionModel(jsonWithUnknown);
    expect(graph.nodes.size).toBe(1);

    const node = Array.from(graph.nodes.values())[0];
    expect(node.isUnknownOperator).toBe(true);
    expect(node.name).toBe('EXPERIMENTAL_VECTOR_ENGINE');
    expect(node.metrics.estimatedRows).toBe(42);
    expect(node.extraInfo['CustomProp']).toBe('test_value');
  });

  it('handles empty or null inputs gracefully without crashing', () => {
    const emptyGraph = buildExecutionModel(null);
    expect(emptyGraph.nodes.size).toBe(0);
    expect(emptyGraph.edges.length).toBe(0);

    const emptyArrayGraph = buildExecutionModel([]);
    expect(emptyArrayGraph.nodes.size).toBe(0);
  });
});
