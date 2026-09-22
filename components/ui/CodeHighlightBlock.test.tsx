import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeHighlightBlock } from './CodeHighlightBlock';
import { duckDBService } from '../../services/duckdbService';

vi.mock('../../services/duckdbService', () => ({
  duckDBService: {
    query: vi.fn(),
  },
}));

describe('CodeHighlightBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Execute SQL and Send to SQL Editor buttons for SQL code', () => {
    render(<CodeHighlightBlock code="SELECT 1 AS val;" language="sql" />);

    expect(screen.getByText('执行 SQL')).toBeInTheDocument();
    expect(screen.getByText('发送到 SQL 编辑器')).toBeInTheDocument();
    expect(screen.getByText('格式化')).toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
  });

  it('triggers onSendToEditor when clicking Send to SQL Editor', () => {
    const onSendToEditor = vi.fn();
    render(
      <CodeHighlightBlock
        code="SELECT 42 AS answer;"
        language="sql"
        onSendToEditor={onSendToEditor}
      />
    );

    const sendBtn = screen.getByText('发送到 SQL 编辑器');
    fireEvent.click(sendBtn);

    expect(onSendToEditor).toHaveBeenCalledWith('SELECT 42 AS answer;');
  });

  it('executes SQL inline and expands results drawer on click Execute SQL', async () => {
    (duckDBService.query as any).mockResolvedValueOnce([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    render(<CodeHighlightBlock code="SELECT * FROM users;" language="sql" />);

    const runBtn = screen.getByText('执行 SQL');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(duckDBService.query).toHaveBeenCalledWith('SELECT * FROM users;');
      expect(screen.getByText('执行完成')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('2 行 · 2 列')).toBeInTheDocument();
    });

    // Test collapsing the results drawer
    const collapseBtn = screen.getByText('收起结果');
    fireEvent.click(collapseBtn);

    expect(screen.queryByText('执行完成')).not.toBeInTheDocument();
  });

  it('collapses code block by default and expands on click', () => {
    const { rerender } = render(
      <CodeHighlightBlock code="SELECT count(*) FROM orders;" language="sql" />
    );

    // 默认折叠：显示展开按钮与行数指示
    const expandBtn = screen.getByText('展开');
    expect(expandBtn).toBeInTheDocument();

    // 点击展开
    fireEvent.click(expandBtn);
    expect(screen.getByText('折叠')).toBeInTheDocument();

    // 再次点击折叠
    fireEvent.click(screen.getByText('折叠'));
    expect(screen.getByText('展开')).toBeInTheDocument();

    // 响应 collapseAll 属性
    rerender(
      <CodeHighlightBlock code="SELECT count(*) FROM orders;" language="sql" collapseAll={false} />
    );
    expect(screen.getByText('折叠')).toBeInTheDocument();
  });

  it('renders syntax highlight code area when expanded', () => {
    const { container } = render(
      <CodeHighlightBlock
        code="SELECT * FROM table_name WHERE status = 'active';"
        language="sql"
        initialCollapsed={false}
      />
    );

    // 展开状态下应包含 CodeMirror 或代码展示容器
    expect(screen.getByText('折叠')).toBeInTheDocument();
    expect(container.querySelector('.cm-editor') || container.querySelector('code')).toBeInTheDocument();
  });
});
