// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from './WorkbenchShell';

const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
});

describe('WorkbenchShell', () => {
  it('uses the container width when surrounding panels leave less space than the window', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 850, height: 800, top: 0, left: 0, right: 850, bottom: 800, x: 0, y: 0, toJSON: () => ({}),
    });
    render(<WorkbenchShell featureId="history" right={<div>上下文信息</div>}>历史</WorkbenchShell>);
    expect(screen.queryByText('上下文信息')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开右侧上下文' }));
    expect(screen.getByText('上下文信息')).toBeTruthy();
  });
  it('recovers usable panes from malformed saved layout values', () => {
    window.localStorage.setItem('duckdb-workbench-layout:v1:sql', JSON.stringify({
      leftWidth: 'wide', rightWidth: -20, bottomHeight: 'NaN',
      leftOpen: 'false', rightOpen: false, bottomOpen: null,
    }));
    render(<WorkbenchShell featureId="sql" left={<div>资源</div>} right={<div>上下文</div>} bottom={<div>结果</div>}>
      编辑器
    </WorkbenchShell>);
    expect(screen.getByText('资源')).toBeTruthy();
    expect(screen.queryByText('上下文')).toBeNull();
    expect(screen.getByText('结果')).toBeTruthy();
    expect(screen.getByRole('separator', { name: '调整左侧窗格宽度' }).getAttribute('aria-valuenow')).toBe('260');
    expect(screen.getByRole('separator', { name: '调整底部面板高度' }).getAttribute('aria-valuenow')).toBe('36');
  });
  it('renders all dock regions and persists pane visibility per feature', () => {
    const { unmount } = render(
      <WorkbenchShell
        featureId="sql"
        left={<div>数据库资源</div>}
        right={<div>查询上下文</div>}
        bottom={<div>查询结果</div>}
        status={<div>OPFS 已就绪</div>}
      >
        <div>SQL 编辑器</div>
      </WorkbenchShell>,
    );

    expect(screen.getByText('数据库资源')).toBeTruthy();
    expect(screen.getByText('查询上下文')).toBeTruthy();
    expect(screen.getByText('查询结果')).toBeTruthy();
    expect(screen.getByText('OPFS 已就绪')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '折叠右侧上下文' }));
    expect(screen.queryByText('查询上下文')).toBeNull();
    unmount();

    render(
      <WorkbenchShell featureId="sql" right={<div>查询上下文</div>}>
        <div>SQL 编辑器</div>
      </WorkbenchShell>,
    );
    expect(screen.queryByText('查询上下文')).toBeNull();
  });

  it('supports keyboard resizing and reset on accessible separators', () => {
    render(
      <WorkbenchShell featureId="data" left={<div>数据资源</div>}>
        <div>数据画布</div>
      </WorkbenchShell>,
    );

    const separator = screen.getByRole('separator', { name: '调整左侧窗格宽度' });
    expect(separator.getAttribute('aria-valuenow')).toBe('260');
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator.getAttribute('aria-valuenow')).toBe('276');
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(separator.getAttribute('aria-valuenow')).toBe('260');
  });

  it('collapses the right inspector below the desktop breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1100 });
    render(
      <WorkbenchShell featureId="ontology" right={<div>本体信息</div>}>
        <div>知识图谱</div>
      </WorkbenchShell>,
    );

    expect(screen.queryByText('本体信息')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开右侧上下文' }));
    expect(screen.getByText('本体信息')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: '折叠右侧上下文' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('本体信息')).toBeNull();
  });
});
