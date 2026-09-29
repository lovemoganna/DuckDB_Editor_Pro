// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainPlanView } from './ExplainPlanView';

afterEach(cleanup);

const SAMPLE_PLAN = `PROJECTION [id, name]
HASH_JOIN (INNER) (users.id = orders.user_id)
SEQ_SCAN users
SEQ_SCAN orders`;

const PLAN_WITH_COST = `PROJECTION [id]
EC: 100.00 (100.00%)
HASH_JOIN
EC: 80.00 (80.00%)
SEQ_SCAN users
EC: 20.00 (20.00%)`;

const BOX_PLAN = `
┌─────────────────────────────────────┐
│             HASH_JOIN               │
│         EC: 100 (100.00%)           │
│        Actual time: 0.85ms          │
└─────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │          SEQ_SCAN on orders     │
    │         EC: 40 (40.00%)         │
    │        Filters: o_total > 100   │
    └─────────────────────────────────┘
    ┌─────────────────────────────────┐
    │        SEQ_SCAN on customers    │
    │         EC: 10 (10.00%)         │
    └─────────────────────────────────┘
`;

describe('ExplainPlanView', () => {
  it('shows empty state without fabricating demo operators', () => {
    render(<ExplainPlanView planText="" loading={false} />);
    expect(screen.getByText('还没有执行步骤')).toBeTruthy();
    expect(screen.queryByText(/哈希连接|读取「/)).toBeNull();
  });

  it('renders human-readable steps instead of raw opcodes as primary labels', () => {
    render(
      <ExplainPlanView
        planText={SAMPLE_PLAN}
        loading={false}
        onAnalyzeModeChange={() => {}}
      />
    );
    expect(screen.getAllByText(/整理要输出的列/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/内连接两路数据|连接两路数据/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/读取「users」/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/读取「orders」/).length).toBeGreaterThan(0);
    expect(screen.queryByText('HASH_JOIN')).toBeNull();
    expect(screen.getByRole('button', { name: /^测耗时$/ })).toBeTruthy();
  });

  it('parses DuckDB box plans with readable table titles and collapse controls', () => {
    render(<ExplainPlanView planText={BOX_PLAN} loading={false} />);
    expect(screen.getAllByText(/连接两路数据|哈希连接/).length).toBeGreaterThan(0);
    expect(screen.getByText(/读取「orders」/)).toBeTruthy();
    expect(screen.getByText(/读取「customers」/)).toBeTruthy();
    expect(screen.getByText(/o_total > 100/)).toBeTruthy();
    expect(screen.getByLabelText('折叠子步骤')).toBeTruthy();
  });

  it('marks real cost bottlenecks and offers timing mode toggle', () => {
    const onAnalyze = vi.fn();
    render(
      <ExplainPlanView
        planText={PLAN_WITH_COST}
        loading={false}
        analyzeMode={false}
        onAnalyzeModeChange={onAnalyze}
      />
    );
    expect(screen.getAllByText(/80%/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^测耗时$/ }));
    expect(onAnalyze).toHaveBeenCalledWith(true);
  });

  it('expands plain-language detail inline', () => {
    render(<ExplainPlanView planText={SAMPLE_PLAN} loading={false} onSendToAi={() => {}} />);
    const joinTitle = screen.getAllByText(/内连接两路数据|连接两路数据/)[0];
    fireEvent.click(joinTitle.closest('[role="treeitem"]')!);
    expect(screen.getByText('帮我优化')).toBeTruthy();
  });

  it('shows loading and error states clearly', () => {
    const { rerender } = render(<ExplainPlanView planText="" loading />);
    expect(screen.getByText('正在解读执行步骤')).toBeTruthy();

    rerender(
      <ExplainPlanView
        planText="执行计划解析异常: syntax error"
        loading={false}
        activeSql="SELECT 1"
        onRefreshExplain={() => {}}
      />
    );
    expect(screen.getByText('无法生成执行计划')).toBeTruthy();
    expect(screen.getByText(/syntax error/)).toBeTruthy();
  });

  it('keeps view mode labels for result-section compatibility', () => {
    render(<ExplainPlanView planText={SAMPLE_PLAN} />);
    expect(screen.getByText('图形')).toBeTruthy();
    expect(screen.getByText('文本')).toBeTruthy();
  });

  it('toggles step detail closed when clicked again', () => {
    render(<ExplainPlanView planText={SAMPLE_PLAN} loading={false} onSendToAi={() => {}} />);
    const joinItem = screen.getAllByText(/内连接两路数据|连接两路数据/)[0].closest('[role="treeitem"]')!;
    fireEvent.click(joinItem);
    expect(screen.getByText('帮我优化')).toBeTruthy();
    fireEvent.click(joinItem);
    expect(screen.queryByText('帮我优化')).toBeNull();
  });

  it('toggles raw engine text', () => {
    render(<ExplainPlanView planText={SAMPLE_PLAN} loading={false} />);
    fireEvent.click(screen.getByTitle('查看 / 隐藏引擎原文'));
    expect(screen.getByText(/HASH_JOIN/)).toBeTruthy();
  });

  it('falls back to raw text when plan cannot be parsed into steps', () => {
    // "physical_plan" alone is a known empty marker from DuckDB row keys
    render(<ExplainPlanView planText={"physical_plan\n\n   "} loading={false} />);
    expect(screen.getByText(/未能拆成步骤树/)).toBeTruthy();
    expect(screen.getByText(/已拿到原文/)).toBeTruthy();
  });
});
