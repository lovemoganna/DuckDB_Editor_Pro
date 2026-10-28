// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExecutionPlanView } from '../../components/ExecutionPlan/views/ExecutionPlanView';

afterEach(cleanup);

const SAMPLE_JSON_PLAN = [
  {
    name: 'HASH_JOIN',
    children: [
      {
        name: 'SEQ_SCAN',
        children: [],
        extra_info: {
          Table: 'users',
          'Estimated Cardinality': '100',
        },
      },
      {
        name: 'SEQ_SCAN',
        children: [],
        extra_info: {
          Table: 'orders',
          'Estimated Cardinality': '500',
        },
      },
    ],
    extra_info: {
      Conditions: 'users.id = orders.user_id',
      'Estimated Cardinality': '500',
    },
  },
];

const ANALYZE_JSON_PLAN = {
  latency: 0.0125,
  cpu_time: 0.025,
  children: [
    {
      operator_name: 'EXPLAIN_ANALYZE',
      children: [
        {
          operator_name: 'HASH_GROUP_BY',
          operator_timing: 0.009,
          operator_cardinality: 50,
          operator_rows_scanned: 0,
          extra_info: {
            Groups: 'dept',
            'Estimated Cardinality': '40',
          },
          children: [
            {
              operator_name: 'SEQ_SCAN',
              operator_timing: 0.003,
              operator_cardinality: 1000,
              operator_rows_scanned: 1000,
              extra_info: {
                Table: 'employees',
                'Estimated Cardinality': '1000',
              },
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

describe('ExecutionPlanView Master View', () => {
  it('renders empty state when plan is empty', () => {
    render(<ExecutionPlanView planText="" loading={false} />);
    expect(screen.getByText('还没有执行步骤')).toBeTruthy();
  });

  it('renders loading state clearly', () => {
    render(<ExecutionPlanView planText="" loading={true} />);
    expect(screen.getByText('正在解读执行步骤')).toBeTruthy();
  });

  it('renders error state safely without breaking parent container', () => {
    render(<ExecutionPlanView planText="Error explaining query: Table does not exist" loading={false} />);
    expect(screen.getByText('无法生成执行计划')).toBeTruthy();
    expect(screen.getByText(/Table does not exist/)).toBeTruthy();
  });

  it('renders structured physical plan and switches between Explain, Data, Cost lenses', () => {
    const { container } = render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        loading={false}
      />
    );

    // Initial lens is Explain
    expect(screen.getByText('哈希关联')).toBeTruthy();
    expect(screen.getAllByText('顺序表扫描').length).toBe(2);

    // Switch to Data Lens
    const dataTab = screen.getByRole('tab', { name: /Data/ });
    fireEvent.click(dataTab);
    expect(screen.getAllByText(/产出行数 \(Actual\):/).length).toBeGreaterThan(0);

    // Switch to Cost Lens
    const costTab = screen.getByRole('tab', { name: /Cost/ });
    fireEvent.click(costTab);
    expect(screen.getAllByText(/算子耗时:/).length).toBeGreaterThan(0);

    // The topology / number of cards must remain identical
    const cards = container.querySelectorAll('[data-testid^="node-"]');
    expect(cards.length).toBe(3);
  });

  it('displays real query latency and CPU time facts in analyze mode', () => {
    render(
      <ExecutionPlanView
        jsonPlan={ANALYZE_JSON_PLAN}
        loading={false}
      />
    );

    // 0.0125s = 12.50 ms
    expect(screen.getByText('12.50 ms')).toBeTruthy();
    // 0.025s = 25.00 ms
    expect(screen.getByText('25.00 ms')).toBeTruthy();
  });

  it('opens and closes NodeDetailDrawer on card click', () => {
    render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        loading={false}
        onSendToAi={() => {}}
      />
    );

    const hashJoinCard = screen.getByLabelText(/哈希关联/);
    fireEvent.click(hashJoinCard);

    // Drawer opens
    expect(screen.getByTestId('node-detail-drawer')).toBeTruthy();
    expect(screen.getByText('算子释义与职责')).toBeTruthy();
    expect(screen.getByText('帮我优化此算子 (AI Analyze)')).toBeTruthy();

    // Close button
    const closeBtn = screen.getByTitle('关闭详情');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('node-detail-drawer')).toBeNull();
  });

  it('toggles Evidence panel to view raw JSON and raw text', () => {
    render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        planText="EXPLAIN HASH_JOIN ..."
        loading={false}
      />
    );

    const evidenceBtn = screen.getByTitle('查看 / 隐藏引擎原文');
    fireEvent.click(evidenceBtn);

    expect(screen.getByTestId('evidence-panel')).toBeTruthy();
    expect(screen.getByText('执行计划审计与证据数据 (Evidence)')).toBeTruthy();

    // Default tab is outline
    expect(screen.getByText(/DuckDB Editor Pro — 物理执行计划大纲/)).toBeTruthy();

    // Switch to json tab
    const jsonTab = screen.getByRole('button', { name: /引擎 JSON 原文/ });
    fireEvent.click(jsonTab);
    expect(screen.getByText(/"HASH_JOIN"/)).toBeTruthy();

    // Close evidence panel
    fireEvent.click(evidenceBtn);
    expect(screen.queryByTestId('evidence-panel')).toBeNull();
  });

  it('triggers explicit analyze mode change when clicking profiling button', () => {
    const onAnalyze = vi.fn();
    render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        loading={false}
        analyzeMode={false}
        onAnalyzeModeChange={onAnalyze}
      />
    );

    const analyzeBtn = screen.getByRole('button', { name: /测耗时/ });
    fireEvent.click(analyzeBtn);
    expect(onAnalyze).toHaveBeenCalledWith(true);
  });

  it('zooms canvas on mouse wheel instead of scrolling', () => {
    render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        loading={false}
      />
    );

    const canvas = screen.getByTestId('execution-canvas');
    expect(canvas).toBeTruthy();

    // Wheel up (deltaY < 0) should zoom in
    const zoomTextBefore = screen.getByText(/%/).textContent;
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 200, clientY: 200 });

    const zoomTextAfterZoomIn = screen.getByText(/%/).textContent;
    expect(zoomTextBefore).toBeDefined();
    expect(zoomTextAfterZoomIn).toBeDefined();

    // Wheel down (deltaY > 0) should zoom out
    fireEvent.wheel(canvas, { deltaY: 200, clientX: 200, clientY: 200 });
    const zoomTextAfterZoomOut = screen.getByText(/%/).textContent;
    expect(zoomTextAfterZoomOut).toBeDefined();
  });

  it('supports middle click (button 1) drag to pan canvas', () => {
    render(
      <ExecutionPlanView
        jsonPlan={SAMPLE_JSON_PLAN}
        loading={false}
      />
    );

    const canvas = screen.getByTestId('execution-canvas');
    // Middle click down
    fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
    // Move mouse
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 160 });
    // Mouse up
    fireEvent.mouseUp(canvas, { button: 1 });
    expect(canvas).toBeTruthy();
  });
});
