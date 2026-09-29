// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiChatModal } from './AiChatModal';
import { useSqlEditorStore } from '../hooks/store/useSqlEditorStore';
import { aiService } from '../services/aiService';
import { Tab } from '../types';

vi.mock('../services/aiService', () => ({
  aiService: {
    isConfigured: vi.fn(() => true),
    sendChatMessage: vi.fn(),
  },
}));

describe('AiChatModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    tables: [{ name: 'orders', rowCount: 1000, columnCount: 5 } as any],
    currentTable: 'orders',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSqlEditorStore.setState({
      tabs: [],
      activeTabId: '',
    });
  });

  it('renders modal with Chinese title, table context, and suggestions', () => {
    render(<AiChatModal {...defaultProps} />);

    expect(screen.getByText('AI 数据分析助手')).toBeInTheDocument();
    expect(screen.getByText(/多轮自然语言对话/)).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('开始数据分析对话')).toBeInTheDocument();
    expect(screen.getByText(/分析 orders 表的数据分布与缺失值质量/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/用自然语言描述你的数据分析需求/)).toBeInTheDocument();
  });

  it('renders model options with Chinese badges (云端, 极速, 本地)', () => {
    render(<AiChatModal {...defaultProps} />);

    const modelSelector = screen.getByTitle('选择 AI 模型');
    fireEvent.click(modelSelector);

    expect(screen.getByText('选择分析引擎')).toBeInTheDocument();
    expect(screen.getAllByText('云端').length).toBeGreaterThan(0);
    expect(screen.getAllByText('极速').length).toBeGreaterThan(0);
    expect(screen.getAllByText('本地').length).toBeGreaterThan(0);
  });

  it('allows filling input by clicking suggestion chip', () => {
    render(<AiChatModal {...defaultProps} />);

    const chip = screen.getByText(/分析 orders 表的数据分布与缺失值质量/);
    fireEvent.click(chip);

    const textarea = screen.getByPlaceholderText(/用自然语言描述你的数据分析需求/);
    expect((textarea as HTMLTextAreaElement).value).toBe('分析 orders 表的数据分布与缺失值质量');
  });

  it('sends message and renders AI response Markdown with DuckDB SQL block', async () => {
    (aiService.sendChatMessage as any).mockResolvedValueOnce(
      '已为您完成分析：\n\n### 订单概览\n- 总流水稳定\n\n```sql\nSELECT count(*) FROM orders;\n```\n\n> 说明：数据已剔除测试订单。'
    );

    render(<AiChatModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/用自然语言描述你的数据分析需求/);
    fireEvent.change(textarea, { target: { value: '统计总订单量' } });

    const sendBtn = screen.getByTitle(/发送消息/i);
    fireEvent.click(sendBtn);

    // User message is rendered
    expect(screen.getByText('统计总订单量')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('已为您完成分析：')).toBeInTheDocument();
      expect(screen.getByText('订单概览')).toBeInTheDocument();
      expect(screen.getByText('总流水稳定')).toBeInTheDocument();
      expect(screen.getByText('DuckDB SQL')).toBeInTheDocument();
      expect(screen.getByText('SELECT count(*) FROM orders;')).toBeInTheDocument();
      expect(screen.getByText(/数据已剔除测试订单/)).toBeInTheDocument();
    });

    // Run SQL button
    const runBtn = screen.getByRole('button', { name: /在编辑器中运行/i });
    expect(runBtn).toBeInTheDocument();
    fireEvent.click(runBtn);

    expect(useSqlEditorStore.getState().tabs.length).toBe(1);
    expect(useSqlEditorStore.getState().tabs[0].code).toBe('SELECT count(*) FROM orders;');
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(Tab.SQL);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
