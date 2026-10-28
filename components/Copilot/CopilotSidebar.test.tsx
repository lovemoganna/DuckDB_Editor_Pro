// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotSidebar } from './CopilotSidebar';
import { useCopilotStore } from '../../hooks/store/useCopilotStore';
import { useAppStore } from '../../hooks/store/useAppStore';
import { Tab } from '../../types';

vi.mock('../../services/copilotExplorePrompts', () => ({
  generateExplorePrompts: vi.fn(async () => [
    '统计 orders.amount 分位数并找异常',
    '检查 orders 空值与重复键',
  ]),
}));

vi.mock('../ui/CodeHighlightBlock', () => ({
  CodeHighlightBlock: ({
    code,
    title,
    onSendToEditor,
  }: {
    code: string;
    title?: string;
    onSendToEditor?: (code: string) => void;
  }) => (
    <div data-testid="code-highlight-block">
      <span>{title || 'CODE'}</span>
      <pre>{code}</pre>
      {onSendToEditor && (
        <button type="button" onClick={() => onSendToEditor(code)}>
          发送到 SQL 编辑器
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../services/copilotSessionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/copilotSessionStorage')>(
    '../../services/copilotSessionStorage',
  );
  return {
    ...actual,
    listCopilotSessionMetas: vi.fn(async () => []),
    listCopilotSessions: vi.fn(async () => []),
    getCopilotSession: vi.fn(async () => null),
    createCopilotSession: vi.fn(async (partial?: any) => ({
      id: 'cps-test-new',
      name: partial?.name || '新对话',
      messages: partial?.messages || [],
      contextTables: partial?.contextTables || [],
      contextTable: partial?.contextTable ?? null,
      selectedModel: partial?.selectedModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    saveCopilotSession: vi.fn(async (session: any) => ({ ...session, updatedAt: Date.now() })),
    deleteCopilotSession: vi.fn(async () => undefined),
    renameCopilotSession: vi.fn(async (id: string, name: string) => ({
      id,
      name,
      messages: [],
      contextTables: [],
      contextTable: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    getActiveSessionId: vi.fn(() => null),
    setActiveSessionId: vi.fn(),
  };
});

import { generateExplorePrompts } from '../../services/copilotExplorePrompts';
import { createCopilotSession } from '../../services/copilotSessionStorage';

describe('CopilotSidebar Component', () => {
  const defaultProps = {
    onNavigate: vi.fn(),
    currentTable: 'customers',
    tables: ['customers', 'orders'],
    activeTab: Tab.DASHBOARD,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateExplorePrompts).mockResolvedValue([
      '统计 orders.amount 分位数并找异常',
      '检查 orders 空值与重复键',
    ]);
    useAppStore.setState({ pendingSql: '' });
    useCopilotStore.setState({
      isOpen: true,
      width: 420,
      messages: [],
      inputValue: '',
      isGenerating: false,
      contextTable: 'customers',
      contextTables: ['customers'],
      contextPinned: false,
      contextTab: Tab.DASHBOARD,
      sessions: [],
      activeSessionId: 'cps-active',
      sessionsHydrated: true,
      showSessionHistory: false,
    });
  });

  it('renders sidebar with header, model badge, and context table tag', () => {
    render(<CopilotSidebar {...defaultProps} tables={['customers', 'orders', 'categories']} />);

    expect(screen.getAllByText('AI Copilot').length).toBeGreaterThan(0);
    expect(screen.getByText('有什么想查的？')).toBeInTheDocument();
    expect(screen.queryByText(/AI 数据分析助手/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('选择关注的数据表')).toBeInTheDocument();
    expect(screen.getByText('customers')).toBeInTheDocument();
  });

  it('allows multi-selecting context tables from the picker', () => {
    render(<CopilotSidebar {...defaultProps} tables={['customers', 'orders', 'categories']} />);

    fireEvent.click(screen.getByLabelText('选择关注的数据表'));
    fireEvent.click(screen.getByRole('option', { name: 'orders' }));
    fireEvent.click(screen.getByRole('option', { name: 'categories' }));

    expect(useCopilotStore.getState().contextTables).toEqual(['customers', 'orders', 'categories']);
    expect(useCopilotStore.getState().contextPinned).toBe(true);
    expect(screen.getByText('customers +2')).toBeInTheDocument();
  });

  it('clears table selection and shows 所有表 label', () => {
    render(<CopilotSidebar {...defaultProps} tables={['customers', 'orders']} />);

    fireEvent.click(screen.getByLabelText('选择关注的数据表'));
    fireEvent.click(screen.getByRole('button', { name: '清空' }));

    expect(useCopilotStore.getState().contextTables).toEqual([]);
    expect(screen.getByText('所有表')).toBeInTheDocument();
  });

  it('collapses when clicking the close button and unmounts content without floating button', () => {
    const { container } = render(<CopilotSidebar {...defaultProps} />);

    const closeBtn = screen.getByTitle('收起侧边栏');
    fireEvent.click(closeBtn);

    expect(useCopilotStore.getState().isOpen).toBe(false);

    // When collapsed, floating edge button is removed (toggled via Ctrl+I shortcut)
    expect(screen.queryByTitle(/展开 AI Copilot 侧边栏/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('allows typing into textarea and updating store inputValue', () => {
    render(<CopilotSidebar {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/提问、生成 SQL/i);
    fireEvent.change(textarea, { target: { value: '计算近 30 天活跃用户数' } });

    expect(useCopilotStore.getState().inputValue).toBe('计算近 30 天活跃用户数');
  });

  it('renders SQL code blocks with send-to-editor button via pendingSql', () => {
    useCopilotStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '已为你生成 SQL：\n\n```sql\nSELECT count(*) FROM customers;\n```',
          sqlBlocks: ['SELECT count(*) FROM customers;'],
          timestamp: '12:05',
        },
      ],
    });

    render(<CopilotSidebar {...defaultProps} />);

    expect(screen.getByText('SELECT count(*) FROM customers;')).toBeInTheDocument();
    const runBtn = screen.getByRole('button', { name: /发送到 SQL 编辑器/i });
    expect(runBtn).toBeInTheDocument();

    fireEvent.click(runBtn);
    expect(useAppStore.getState().pendingSql).toBe('SELECT count(*) FROM customers;');
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(Tab.SQL);
  });

  it('renders markdown rich elements properly without exposing raw markdown', () => {
    useCopilotStore.setState({
      messages: [
        {
          id: 'msg-rich',
          role: 'assistant',
          content: `### 核心分析结论
- **用户留存率** 达到 85%
- 活跃周期稳定

| 维度 | 指标值 |
| :--- | :--- |
| DAU | 12,000 |
| MAU | 48,000 |

> 说明：数据基于最近 30 天滚动统计。`,
          timestamp: '12:10',
        },
      ],
    });

    render(<CopilotSidebar {...defaultProps} />);

    // Headings, bold, lists, and tables should render as semantic DOM
    expect(screen.getByText('核心分析结论')).toBeInTheDocument();
    expect(screen.getByText('用户留存率')).toBeInTheDocument();
    expect(screen.getByText('活跃周期稳定')).toBeInTheDocument();
    expect(screen.getByText('维度')).toBeInTheDocument();
    expect(screen.getByText('指标值')).toBeInTheDocument();
    expect(screen.getByText('DAU')).toBeInTheDocument();
    expect(screen.getByText('12,000')).toBeInTheDocument();
    expect(screen.getByText(/数据基于最近 30 天滚动统计/)).toBeInTheDocument();
  });

  it('renders stop button when isGenerating is true and stops generation on click', () => {
    useCopilotStore.setState({
      isGenerating: true,
      messages: [
        {
          id: 'msg-stream',
          role: 'assistant',
          content: '正在生成分析中...',
          timestamp: '12:15',
          isStreaming: true,
        },
      ],
    });

    render(<CopilotSidebar {...defaultProps} />);

    const stopBtn = screen.getByRole('button', { name: '停止生成' });
    expect(stopBtn).toBeInTheDocument();
    expect(screen.getByText('停止')).toBeInTheDocument();

    fireEvent.click(stopBtn);
    expect(useCopilotStore.getState().isGenerating).toBe(false);
    expect(useCopilotStore.getState().messages[0].isStreaming).toBe(false);
    expect(useCopilotStore.getState().messages[0].content).toContain('用户已主动停止生成');
  });

  it('requires confirmation before starting a new session when multiple messages exist', async () => {
    useCopilotStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: '欢迎', timestamp: '12:00' },
        { id: '2', role: 'user', content: '查询活跃用户', timestamp: '12:01' },
      ],
      activeSessionId: 'cps-old',
      sessionsHydrated: true,
    });

    render(<CopilotSidebar {...defaultProps} />);

    const clearBtn = screen.getByLabelText('清空会话历史');
    fireEvent.click(clearBtn);

    expect(screen.getByText('确定新建?')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(useCopilotStore.getState().messages.length).toBe(2);

    fireEvent.click(screen.getByText('确定新建?'));
    await waitFor(() => {
      expect(createCopilotSession).toHaveBeenCalled();
      expect(useCopilotStore.getState().activeSessionId).toBe('cps-test-new');
      expect(useCopilotStore.getState().messages).toEqual([]);
    });
  });

  it('opens session history panel from header button', () => {
    useCopilotStore.setState({
      sessions: [
        {
          id: 'cps-1',
          name: '探查 customers',
          createdAt: Date.now() - 60_000,
          updatedAt: Date.now() - 60_000,
          messageCount: 4,
          preview: '分析 customers 空值',
        },
      ],
      sessionsHydrated: true,
    });

    render(<CopilotSidebar {...defaultProps} />);
    const historyBtn = screen.getByRole('button', { name: '会话历史' });
    fireEvent.click(historyBtn);
    expect(useCopilotStore.getState().showSessionHistory).toBe(true);
    expect(historyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('探查 customers')).toBeInTheDocument();
  });

  it('renders copy full message button for assistant responses', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    useCopilotStore.setState({
      messages: [
        {
          id: 'msg-complete',
          role: 'assistant',
          content: '这里是经过深入推导的数据洞察分析报告。',
          timestamp: '12:20',
          isStreaming: false,
        },
      ],
    });

    render(<CopilotSidebar {...defaultProps} />);

    const copyBtn = screen.getByRole('button', { name: '复制完整回答' });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('这里是经过深入推导的数据洞察分析报告。');
  });

  it('renders generate-explore-prompts button instead of hard-coded chips', () => {
    useCopilotStore.setState({
      contextTab: Tab.SQL,
      contextTable: 'orders',
      contextTables: ['orders'],
      contextPinned: true,
    });

    render(<CopilotSidebar {...defaultProps} currentTable="orders" tables={['orders', 'customers']} />);

    expect(screen.getByRole('button', { name: '生成探索问题' })).toBeInTheDocument();
    expect(screen.queryByText('优化当前工作区 SQL 查询效率')).not.toBeInTheDocument();
    expect(screen.queryByText(/为 orders 生成多维聚合分析 SQL/)).not.toBeInTheDocument();
  });

  it('fills input when clicking a generated explore prompt chip', async () => {
    render(<CopilotSidebar {...defaultProps} tables={['orders']} />);

    fireEvent.click(screen.getByRole('button', { name: '生成探索问题' }));

    expect(generateExplorePrompts).toHaveBeenCalled();
    expect(await screen.findByText('统计 orders.amount 分位数并找异常')).toBeInTheDocument();

    fireEvent.click(screen.getByText('统计 orders.amount 分位数并找异常'));
    await waitFor(() => {
      expect(useCopilotStore.getState().inputValue).toBe('统计 orders.amount 分位数并找异常');
    });
  });
});
