// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';

vi.mock('../ui/CodeHighlightBlock', () => ({
  CodeHighlightBlock: ({
    code,
    language,
    title,
    onCopy,
    onSendToEditor,
  }: {
    code: string;
    language?: string;
    title?: string;
    onCopy?: () => void;
    onSendToEditor?: (code: string) => void;
  }) => (
    <div data-testid="code-highlight-block">
      <span>{title || `${(language || 'text').toUpperCase()} SNIPPET`}</span>
      <pre>{code}</pre>
      <button type="button" onClick={() => onCopy?.()}>
        复制
      </button>
      {onSendToEditor && (
        <button type="button" onClick={() => onSendToEditor(code)}>
          发送到 SQL 编辑器
        </button>
      )}
    </div>
  ),
}));

describe('ChatMessageMarkdown Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders markdown headings with appropriate hierarchy', () => {
    const md = `
# 一级主标题
## 二级模块标题
### 三级小结标题
#### 四级明细标题
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('一级主标题');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('二级模块标题');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('三级小结标题');
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('四级明细标题');
  });

  it('renders paragraphs and unordered/ordered lists cleanly', () => {
    const md = `
这是一段关于 DuckDB 性能分析的正文说明。

- 内存优化建议
- 索引与分区配置

1. 执行计划分析
2. 过滤下推生效确认
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByText('这是一段关于 DuckDB 性能分析的正文说明。')).toBeInTheDocument();
    expect(screen.getByText('内存优化建议')).toBeInTheDocument();
    expect(screen.getByText('索引与分区配置')).toBeInTheDocument();
    expect(screen.getByText('执行计划分析')).toBeInTheDocument();
    expect(screen.getByText('过滤下推生效确认')).toBeInTheDocument();
  });

  it('renders Markdown tables with header and cell styling', () => {
    const md = `
| 字段名称 | 数据类型 | 业务释义 |
| :--- | :--- | :--- |
| order_id | BIGINT | 唯一订单标识 |
| amount | DECIMAL(10,2) | 订单实付金额 |
| created_at | TIMESTAMP | 订单支付时间 |
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByText('字段名称')).toBeInTheDocument();
    expect(screen.getByText('数据类型')).toBeInTheDocument();
    expect(screen.getByText('业务释义')).toBeInTheDocument();
    expect(screen.getByText('order_id')).toBeInTheDocument();
    expect(screen.getByText('BIGINT')).toBeInTheDocument();
    expect(screen.getByText('唯一订单标识')).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.getByText('DECIMAL(10,2)')).toBeInTheDocument();
    expect(screen.getByText('订单实付金额')).toBeInTheDocument();
  });

  it('renders GitHub Alerts callouts with Chinese badges and icons', () => {
    const md = `
> [!NOTE]
> 这是系统的基础说明。

> [!TIP]
> 使用 Parquet 格式可显著提升读取速度。

> [!WARNING]
> 避免全表不带过滤条件的笛卡尔积。
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByText('说明')).toBeInTheDocument();
    expect(screen.getByText(/这是系统的基础说明/)).toBeInTheDocument();
    expect(screen.getByText('技巧提示')).toBeInTheDocument();
    expect(screen.getByText(/使用 Parquet 格式可显著提升读取速度/)).toBeInTheDocument();
    expect(screen.getByText('注意事项')).toBeInTheDocument();
    expect(screen.getByText(/避免全表不带过滤条件的笛卡尔积/)).toBeInTheDocument();
  });

  it('renders DuckDB SQL blocks with copy and send-to-editor buttons', () => {
    const onRunSql = vi.fn();
    const onCopySql = vi.fn();
    const sqlCode = 'SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id;';
    const md = `
已生成优化后的 DuckDB SQL 查询：

\`\`\`sql
${sqlCode}
\`\`\`
`;
    render(<ChatMessageMarkdown content={md} onRunSql={onRunSql} onCopySql={onCopySql} />);

    expect(screen.getByText('DuckDB SQL')).toBeInTheDocument();
    expect(screen.getByText(sqlCode)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /复制/i });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);
    expect(onCopySql).toHaveBeenCalledWith(sqlCode);

    const runBtn = screen.getByRole('button', { name: /发送到 SQL 编辑器/i });
    expect(runBtn).toBeInTheDocument();
    fireEvent.click(runBtn);
    expect(onRunSql).toHaveBeenCalledWith(sqlCode);
  });

  it('renders non-SQL code blocks (Python, JSON) with language label and copy button', () => {
    const md = `
\`\`\`python
import duckdb
con = duckdb.connect()
print(con.execute("SELECT 42").fetchall())
\`\`\`
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByText(/PYTHON/i)).toBeInTheDocument();
    expect(screen.getByText(/import duckdb/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制/i })).toBeInTheDocument();
  });

  it('renders inline code, bold, italics, and links properly', () => {
    const md = `
你可以使用 \`SUMMARIZE\` 快速查看表结构，通过 **粗体重点** 和 *斜体注解*，详情可查阅 [DuckDB 文档](https://duckdb.org)。
`;
    render(<ChatMessageMarkdown content={md} />);

    expect(screen.getByText('SUMMARIZE')).toBeInTheDocument();
    expect(screen.getByText('粗体重点')).toBeInTheDocument();
    expect(screen.getByText('斜体注解')).toBeInTheDocument();
    const link = screen.getByText('DuckDB 文档');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://duckdb.org');
  });
});
