import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownPreview } from './MarkdownPreview';
import { duckDBService } from '../services/duckdbService';

vi.mock('../services/duckdbService', () => ({
  duckDBService: {
    query: vi.fn(),
  },
}));

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders markdown headings, paragraphs, and list items', () => {
    const md = `
# 标题一
这是一段正文描述。

- 列表项 Alpha
- 列表项 Beta
`;
    render(<MarkdownPreview content={md} />);

    expect(screen.getByText('标题一')).toBeInTheDocument();
    expect(screen.getByText('这是一段正文描述。')).toBeInTheDocument();
    expect(screen.getByText('列表项 Alpha')).toBeInTheDocument();
    expect(screen.getByText('列表项 Beta')).toBeInTheDocument();
  });

  it('renders GitHub Alert callout when blockquote has [!NOTE] or [!TIP]', () => {
    const md = `
> [!NOTE]
> 这是系统的关键说明。

> [!TIP]
> 这是一个实用的调优技巧。
`;
    render(<MarkdownPreview content={md} />);

    expect(screen.getByText(/说明 \(Note\)/)).toBeInTheDocument();
    expect(screen.getByText(/这是系统的关键说明。/)).toBeInTheDocument();
    expect(screen.getByText(/技巧提示 \(Tip\)/)).toBeInTheDocument();
    expect(screen.getByText(/这是一个实用的调优技巧。/)).toBeInTheDocument();
  });

  it('renders tables with proper header and cell contents', () => {
    const md = `
| 参数名称 | 推荐值 |
| :--- | :--- |
| max_memory | 2GB |
| threads | 4 |
`;
    render(<MarkdownPreview content={md} />);

    expect(screen.getByText('参数名称')).toBeInTheDocument();
    expect(screen.getByText('推荐值')).toBeInTheDocument();
    expect(screen.getByText('max_memory')).toBeInTheDocument();
    expect(screen.getByText('2GB')).toBeInTheDocument();
  });

  it('renders code blocks with syntax highlighting and copy button', () => {
    const md = `
\`\`\`sql
SELECT 1 AS test;
\`\`\`
`;
    render(<MarkdownPreview content={md} />);

    expect(screen.getByText('SQL STATEMENT')).toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
    expect(screen.getByText('格式化')).toBeInTheDocument();
  });

  it('keeps inline SQL execution results after parent rerenders with new onTryCode identity', async () => {
    (duckDBService.query as any).mockResolvedValueOnce([{ answer: 42 }]);

    const md = `
\`\`\`sql
SELECT 42 AS answer;
\`\`\`
`;
    const { rerender } = render(
      <MarkdownPreview content={md} onTryCode={() => {}} />
    );

    fireEvent.click(screen.getByText('执行 SQL'));

    await waitFor(() => {
      expect(screen.getByText('执行完成')).toBeInTheDocument();
      expect(screen.getByText('1 行 · 1 列')).toBeInTheDocument();
    });

    // 模拟 schema-changed → App 重渲染传入新的内联回调引用
    rerender(<MarkdownPreview content={md} onTryCode={() => {}} />);

    expect(screen.getByText('执行完成')).toBeInTheDocument();
    expect(screen.getByText('1 行 · 1 列')).toBeInTheDocument();
    expect(screen.getByText('收起结果')).toBeInTheDocument();
  });
});
