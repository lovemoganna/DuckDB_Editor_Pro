import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcademyApp } from './AcademyApp';
import { duckDBService } from '../../services/duckDBService';

// Mock duckDBService
vi.mock('../../services/duckDBService', () => ({
  duckDBService: {
    executeAndAuditWithMetadata: vi.fn().mockResolvedValue({
      columns: ['id', 'name', 'score'],
      columnTypes: ['INTEGER', 'VARCHAR', 'DOUBLE'],
      columnTypeMap: { id: 'INTEGER', name: 'VARCHAR', score: 'DOUBLE' },
      rows: [
        { id: 1, name: 'Item_1', score: 85.5 },
        { id: 2, name: 'Item_2', score: 92.0 }
      ],
      executionTime: 4.2,
      error: null,
    }),
  }
}));

// Mock userTutorialStorage
vi.mock('../../services/userTutorialStorage', () => ({
  getAllUserTutorials: vi.fn().mockResolvedValue([]),
  deleteUserTutorial: vi.fn().mockResolvedValue(undefined),
  saveUserTutorial: vi.fn().mockResolvedValue(undefined),
  extractTitleFromMarkdown: vi.fn().mockReturnValue('自建教程测试'),
  extractDifficultyFromMarkdown: vi.fn().mockReturnValue('Beginner'),
  extractCategoryFromMarkdown: vi.fn().mockReturnValue('测试'),
  generateTutorialId: vi.fn().mockReturnValue('custom-tut-123'),
}));

// Mock toastService
vi.mock('../../services/toastService', () => ({
  toastService: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }
}));

describe('AcademyApp - DuckDB 数据实战学堂', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('renders Academy Hub with stats, filters and 3-tier shelves by default', async () => {
    render(<AcademyApp />);

    // 1. Hub Header
    expect(screen.getByText('DuckDB 数据实战学堂')).toBeTruthy();
    expect(screen.getByText('DATA ACADEMY')).toBeTruthy();

    // 2. Stats
    expect(screen.getByText('通关进度')).toBeTruthy();
    expect(screen.getByText('达成率')).toBeTruthy();
    expect(screen.getByText('总学时')).toBeTruthy();

    // 3. Difficulty Tabs
    expect(screen.getByText(/全部难度/)).toBeTruthy();
    expect(screen.getByText('初级入门')).toBeTruthy();
    expect(screen.getByText('中级进阶')).toBeTruthy();
    expect(screen.getByText('高级专家')).toBeTruthy();

    // 4. Import Button
    expect(screen.getByText('导入教程')).toBeTruthy();
  });

  it('filters courses by difficulty tab and search input', async () => {
    render(<AcademyApp />);

    // Click "初级入门" tab
    const beginnerBtn = screen.getByRole('button', { name: /初级入门/ });
    fireEvent.click(beginnerBtn);

    // Should display Beginner shelf title
    expect(screen.getByText('初级入门 (Foundations)')).toBeTruthy();

    // Search input filtering
    const searchInput = screen.getByPlaceholderText(/搜索课程、SQL关键字或标签/);
    fireEvent.change(searchInput, { target: { value: 'SELECT' } });

    // Should find the basic select lesson
    expect(screen.getByText('基础 SELECT 检索与多维条件过滤')).toBeTruthy();
  });

  it('transitions to AcademyTrialStudio when a course card is clicked, and executes SQL', async () => {
    render(<AcademyApp />);

    // Click first course card
    const firstCourseCard = screen.getByText('基础 SELECT 检索与多维条件过滤');
    fireEvent.click(firstCourseCard);

    // Should be in Trial Studio
    expect(screen.getByText('返回大厅')).toBeTruthy();
    expect(screen.getByText('SQL 交互试炼场')).toBeTruthy();
    expect(screen.getByText('为什么这一步至关重要？')).toBeTruthy();

    // Verify initial SQL is loaded into the runner
    const textarea = screen.getByPlaceholderText(/在此键入 DuckDB SQL 代码/);
    expect((textarea as HTMLTextAreaElement).value).toContain('SELECT');

    // Run SQL
    const runBtn = screen.getByRole('button', { name: /运行/ });
    fireEvent.click(runBtn);

    // Verify duckDBService execution was called
    await waitFor(() => {
      expect(duckDBService.executeAndAuditWithMetadata).toHaveBeenCalled();
      expect(screen.getByText('Item_1')).toBeTruthy();
      expect(screen.getByText('85.5')).toBeTruthy();
      expect(screen.getByText('2 行')).toBeTruthy();
    });

    // Mark as completed
    const completeBtn = screen.getByRole('button', { name: /标记已掌握/ });
    fireEvent.click(completeBtn);

    expect(screen.getByText('已通关')).toBeTruthy();

    // Return to Hub
    const backBtn = screen.getByRole('button', { name: /返回大厅/ });
    fireEvent.click(backBtn);

    // Verify back in Hub and Resume banner shows
    expect(screen.getByText('DuckDB 数据实战学堂')).toBeTruthy();
    expect(screen.getByText('继续上次学习')).toBeTruthy();
  });
});
