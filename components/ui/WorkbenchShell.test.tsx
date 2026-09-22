// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkbenchShell } from './WorkbenchShell';

const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
});

describe('WorkbenchShell', () => {
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
