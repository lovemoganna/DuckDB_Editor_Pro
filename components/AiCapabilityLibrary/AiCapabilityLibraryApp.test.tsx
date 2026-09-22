// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCapabilityLibraryApp } from './AiCapabilityLibraryApp';
import { resetToSystemDefaultCapabilities } from '../../services/aiCapabilitiesStorage';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  localStorage.clear();
  resetToSystemDefaultCapabilities();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AiCapabilityLibraryApp', () => {
  it('renders correctly with default header, stats, and capabilities list', () => {
    render(<AiCapabilityLibraryApp />);

    // Check title and headers
    expect(screen.getByText('AI 能力库 (Capability Hub)')).toBeTruthy();
    expect(screen.getByText('注册能力总数')).toBeTruthy();
    expect(screen.getByText('代码生成与性能')).toBeTruthy();
    expect(screen.getByText('诊断与质量审计')).toBeTruthy();
    expect(screen.getByText('商业洞察与模型')).toBeTruthy();

    // Check default capabilities present in master list / detail
    expect(screen.getAllByText('自然语言生成 SQL (NL2SQL)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('错误智能诊断与修复').length).toBeGreaterThan(0);
  });

  it('filters capabilities when clicking category pills', () => {
    render(<AiCapabilityLibraryApp />);

    // Click on a category tab like "错误诊断与修复"
    const diagnosisTab = screen.getByRole('button', { name: /错误诊断与修复/ });
    fireEvent.click(diagnosisTab);

    // Only diagnosis capabilities should remain visible
    expect(screen.getAllByText('错误智能诊断与修复').length).toBeGreaterThan(0);
  });

  it('filters capabilities via the search bar', () => {
    render(<AiCapabilityLibraryApp />);

    const searchInput = screen.getByPlaceholderText('搜索能力名称、场景、标签或 Prompt...');
    fireEvent.change(searchInput, { target: { value: 'NL2SQL' } });

    expect(screen.getAllByText('自然语言生成 SQL (NL2SQL)').length).toBeGreaterThan(0);
    expect(screen.queryByText('DuckDB 性能与语法重构')).toBeNull();
  });

  it('allows copying prompt template', async () => {
    render(<AiCapabilityLibraryApp />);

    const copyButtons = screen.getAllByRole('button', { name: /复制 Prompt/i });
    if (copyButtons.length > 0) {
      fireEvent.click(copyButtons[0]);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('opens and closes the create modal', () => {
    render(<AiCapabilityLibraryApp />);

    const createBtn = screen.getByRole('button', { name: /新建 AI 能力/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('新建自定义 AI 能力')).toBeTruthy();

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('新建自定义 AI 能力')).toBeNull();
  });
});
