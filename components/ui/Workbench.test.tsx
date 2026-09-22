// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Search } from 'lucide-react';
import { ActionButton, DrawerShell, ModalShell, EmptyState, IconButton, PanelHeader, SegmentedTabs, Toolbar } from './Workbench';

afterEach(cleanup);

describe('workbench UI primitives', () => {
  it('prevents duplicate actions and announces loading', () => {
    const action = vi.fn();
    render(<ActionButton loading onClick={action}>导入</ActionButton>);
    const button = screen.getByRole('button', { name: '导入' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });

  it('keeps dialog focus during parent updates and returns it on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const content = <><input aria-label="名称" /><button>预览</button></>;
    const { rerender, unmount } = render(<ModalShell open title="导入" onClose={() => onClose()}>{content}</ModalShell>);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '名称' }));
    screen.getByRole('button', { name: '预览' }).focus();
    rerender(<ModalShell open title="导入" onClose={() => onClose()}>{content}</ModalShell>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '预览' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('exposes named controls with restrained shared sizing', () => {
    const onClick = vi.fn();
    render(
      <Toolbar aria-label="画布工具">
        <IconButton label="搜索节点" icon={Search} onClick={onClick} />
      </Toolbar>,
    );

    const button = screen.getByRole('button', { name: '搜索节点' });
    expect(button.className).toContain('min-h-8');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders tabs and empty states through their public labels', () => {
    const onChange = vi.fn();
    render(
      <>
        <PanelHeader title="数据视图" description="查看当前实体数据" />
        <SegmentedTabs
          aria-label="视图"
          value="graph"
          onChange={onChange}
          items={[
            { value: 'graph', label: '知识图谱' },
            { value: 'data', label: '数据视图' },
          ]}
        />
        <EmptyState title="暂无数据" description="请先导入数据" />
      </>,
    );

    expect(screen.getByRole('heading', { name: '数据视图' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '数据视图' }));
    expect(onChange).toHaveBeenCalledWith('data');
    expect(screen.getByText('请先导入数据')).toBeTruthy();
  });

  it('renders DrawerShell and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <DrawerShell open title="详情抽屉" onClose={onClose} side="right" size="md">
        <p>抽屉内容</p>
      </DrawerShell>,
    );
    expect(screen.getByRole('dialog', { name: '详情抽屉' })).toBeTruthy();
    expect(screen.getByText('抽屉内容')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

});
