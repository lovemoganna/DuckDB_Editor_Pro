import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableOfContents, extractTocFromMarkdown } from './TableOfContents';

describe('TableOfContents', () => {
  const sampleMarkdown = `
# 1. 前言：为什么用 SQL 建模 Ontology
一些前言内容...

\`\`\`sql
# 这里是 SQL 注释，不应被识别为标题
SELECT 1;
\`\`\`

## 1.1 核心概念拆解
详细说明概念...

### 1.1.1 元数据属性
深入说明...

## 1.2 实战演练
演练内容...
`;

  it('correctly extracts headings while ignoring code blocks', () => {
    const items = extractTocFromMarkdown(sampleMarkdown);
    expect(items.length).toBe(4);
    expect(items[0].text).toBe('1. 前言：为什么用 SQL 建模 Ontology');
    expect(items[1].text).toBe('1.1 核心概念拆解');
    expect(items[2].text).toBe('1.1.1 元数据属性');
    expect(items[3].text).toBe('1.2 实战演练');

    // 验证忽略了 SQL 代码块内的 # 注释
    const hasCodeComment = items.some((i) => i.text.includes('这里是 SQL 注释'));
    expect(hasCodeComment).toBe(false);
  });

  it('renders TABLE OF CONTENTS title and allows collapse/expand', () => {
    render(<TableOfContents content={sampleMarkdown} />);

    // 验证标题为大写的 TABLE OF CONTENTS
    expect(screen.getByText('TABLE OF CONTENTS')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    // 验证章节条目存在
    expect(screen.getByText('1.1 核心概念拆解')).toBeInTheDocument();

    // 点击收起
    const toggleBtn = screen.getByText('收起');
    fireEvent.click(toggleBtn);

    // 列表隐藏，按钮变为展开
    expect(screen.queryByText('1.1 核心概念拆解')).not.toBeInTheDocument();
    expect(screen.getByText('展开')).toBeInTheDocument();

    // 再次点击展开
    fireEvent.click(screen.getByText('展开'));
    expect(screen.getByText('1.1 核心概念拆解')).toBeInTheDocument();
  });

  it('scrolls into view smoothly when clicking an item', () => {
    // 模拟目标 DOM 元素与 scrollIntoView
    const scrollMock = vi.fn();
    const dummyTarget = document.createElement('div');
    dummyTarget.id = '1-1-核心概念拆解';
    dummyTarget.scrollIntoView = scrollMock;
    document.body.appendChild(dummyTarget);

    render(<TableOfContents content={sampleMarkdown} />);

    const link = screen.getByText('1.1 核心概念拆解');
    fireEvent.click(link);

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    document.body.removeChild(dummyTarget);
  });

  it('renders floating dock on right edge with hover-reveal and pin toggle', () => {
    render(<TableOfContents content={sampleMarkdown} />);

    const dock = screen.getByTestId('floating-toc-dock');
    expect(dock).toBeInTheDocument();
    expect(dock.className).toContain('fixed right-0');

    // 把手包含 TOC 标识
    expect(screen.getByText('TOC')).toBeInTheDocument();

    // 默认未悬浮时处于 opacity-0 与 invisible（绝对定位脱离流，隐藏不占任何页面宽度）
    const panelWrapper = dock.firstElementChild as HTMLElement;
    expect(panelWrapper.className).toContain('opacity-0');
    expect(panelWrapper.className).toContain('invisible');
    expect(panelWrapper.className).toContain('absolute right-full');

    // 鼠标移上悬浮展示
    fireEvent.mouseEnter(dock);
    expect(panelWrapper.className).toContain('opacity-100');
    expect(panelWrapper.className).toContain('visible');

    // 鼠标移出再次隐藏
    fireEvent.mouseLeave(dock);
    expect(panelWrapper.className).toContain('opacity-0');
    expect(panelWrapper.className).toContain('invisible');

    // 点击把手固定展示
    const triggerBtn = screen.getByLabelText('文章目录大纲');
    fireEvent.click(triggerBtn);
    expect(panelWrapper.className).toContain('opacity-100');
    expect(panelWrapper.className).toContain('visible');
  });
});

