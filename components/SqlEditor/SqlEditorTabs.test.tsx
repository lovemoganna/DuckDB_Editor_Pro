// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqlEditorTabs } from './SqlEditorTabs';
import { useSqlEditorStore } from '../../hooks/store/useSqlEditorStore';
import type { SqlTab } from '../../types';
import { downloadSqlTab } from '../../utils/sqlExporter';

beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mockTabs: SqlTab[] = [
  {
    id: 'tab-1',
    title: 'Query 1',
    code: 'SELECT 1;',
    history: [],
    historyIndex: -1,
    loading: false,
    viewMode: 'table',
    chartConfig: { id: '1', title: '', type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false, aggregation: 'none' },
    page: 0,
    filterTerm: '',
  },
  {
    id: 'tab-2',
    title: 'Query 2',
    code: 'SELECT 2;',
    history: [],
    historyIndex: -1,
    loading: false,
    viewMode: 'table',
    chartConfig: { id: '2', title: '', type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false, aggregation: 'none' },
    page: 0,
    filterTerm: '',
  },
  {
    id: 'tab-3',
    title: 'Query 3',
    code: 'SELECT 3;',
    history: [],
    historyIndex: -1,
    loading: false,
    viewMode: 'table',
    chartConfig: { id: '3', title: '', type: 'bar', xKey: '', yKeys: [], yRightKeys: [], stacked: false, horizontal: false, aggregation: 'none' },
    page: 0,
    filterTerm: '',
  },
];

describe('SqlEditorTabs Component', () => {
  it('renders tabs and handles clicking and double clicking', () => {
    const onTabClick = vi.fn();
    const onTabDoubleClick = vi.fn();

    render(
      <SqlEditorTabs
        tabs={mockTabs}
        activeTabId="tab-1"
        editingTitleId={null}
        tempTitle=""
        onTabClick={onTabClick}
        onTabDoubleClick={onTabDoubleClick}
        onCloseTab={vi.fn()}
        onCreateTab={vi.fn()}
        onTitleChange={vi.fn()}
        onTitleSave={vi.fn()}
        onTitleKeyDown={vi.fn()}
      />
    );

    expect(screen.getByText('Query 1')).toBeTruthy();
    expect(screen.getByText('Query 2')).toBeTruthy();
    expect(screen.getByText('Query 3')).toBeTruthy();

    fireEvent.click(screen.getByText('Query 2'));
    expect(onTabClick).toHaveBeenCalledWith('tab-2');

    fireEvent.doubleClick(screen.getByText('Query 3'));
    expect(onTabDoubleClick).toHaveBeenCalledWith(mockTabs[2]);
  });

  it('triggers onCloseTab when clicking close button or middle click', () => {
    const onCloseTab = vi.fn();

    render(
      <SqlEditorTabs
        tabs={mockTabs}
        activeTabId="tab-1"
        editingTitleId={null}
        tempTitle=""
        onTabClick={vi.fn()}
        onTabDoubleClick={vi.fn()}
        onCloseTab={onCloseTab}
        onCreateTab={vi.fn()}
        onTitleChange={vi.fn()}
        onTitleSave={vi.fn()}
        onTitleKeyDown={vi.fn()}
      />
    );

    const closeButtons = screen.getAllByLabelText('关闭标签页');
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]);
    expect(onCloseTab).toHaveBeenCalledWith('tab-1', expect.anything());

    // Middle click (button = 1)
    const tab2 = screen.getByText('Query 2').closest('[role="tab"]')!;
    fireEvent.mouseDown(tab2, { button: 1 });
    expect(onCloseTab).toHaveBeenCalledWith('tab-2', expect.anything());
  });

  it('opens context menu on right click and triggers Save As and Close options', () => {
    const onSaveAsQuery = vi.fn();
    const onSaveAsDuckdbFile = vi.fn();
    const onSaveAsSqlFile = vi.fn();
    const onDuplicateTab = vi.fn();
    const onCloseTab = vi.fn();
    const onCloseOtherTabs = vi.fn();
    const onCloseTabsToRight = vi.fn();
    const onCloseAllTabs = vi.fn();

    render(
      <SqlEditorTabs
        tabs={mockTabs}
        activeTabId="tab-2"
        editingTitleId={null}
        tempTitle=""
        onTabClick={vi.fn()}
        onTabDoubleClick={vi.fn()}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onCloseAllTabs={onCloseAllTabs}
        onCreateTab={vi.fn()}
        onDuplicateTab={onDuplicateTab}
        onSaveAsQuery={onSaveAsQuery}
        onSaveAsDuckdbFile={onSaveAsDuckdbFile}
        onSaveAsSqlFile={onSaveAsSqlFile}
        onTitleChange={vi.fn()}
        onTitleSave={vi.fn()}
        onTitleKeyDown={vi.fn()}
      />
    );

    // Right click on tab-2
    const tab2 = screen.getByText('Query 2').closest('[role="tab"]')!;
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });

    // Menu options should be visible
    expect(screen.getByText('另存为已保存查询...')).toBeTruthy();
    expect(screen.getByText('另存为本地 .duckdb 文件')).toBeTruthy();
    expect(screen.getByText('另存为本地 .sql 文件')).toBeTruthy();
    expect(screen.getByText('复制为新标签页 (副本)')).toBeTruthy();
    expect(screen.getByText('重命名标签页')).toBeTruthy();
    expect(screen.getByText('关闭当前标签页')).toBeTruthy();
    expect(screen.getByText('关闭其他标签页')).toBeTruthy();
    expect(screen.getByText('关闭右侧标签页')).toBeTruthy();
    expect(screen.getByText('关闭全部标签页')).toBeTruthy();

    // Click "另存为已保存查询..."
    fireEvent.click(screen.getByText('另存为已保存查询...'));
    expect(onSaveAsQuery).toHaveBeenCalledWith(mockTabs[1]);

    // Reopen menu for Save As DuckDB file
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('另存为本地 .duckdb 文件'));
    expect(onSaveAsDuckdbFile).toHaveBeenCalledWith(mockTabs[1]);

    // Reopen menu for Save As SQL file
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('另存为本地 .sql 文件'));
    expect(onSaveAsSqlFile).toHaveBeenCalledWith(mockTabs[1]);

    // Reopen menu for Duplicate Tab
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('复制为新标签页 (副本)'));
    expect(onDuplicateTab).toHaveBeenCalledWith('tab-2');

    // Reopen menu for Close Others
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('关闭其他标签页'));
    expect(onCloseOtherTabs).toHaveBeenCalledWith('tab-2');

    // Reopen menu for Close Tabs to Right
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('关闭右侧标签页'));
    expect(onCloseTabsToRight).toHaveBeenCalledWith('tab-2');

    // Reopen menu for Close All Tabs
    fireEvent.contextMenu(tab2, { clientX: 200, clientY: 100 });
    fireEvent.click(screen.getByText('关闭全部标签页'));
    expect(onCloseAllTabs).toHaveBeenCalled();
  });

  it('opens menu via more options button (...) and closes on Escape', () => {
    render(
      <SqlEditorTabs
        tabs={mockTabs}
        activeTabId="tab-1"
        editingTitleId={null}
        tempTitle=""
        onTabClick={vi.fn()}
        onTabDoubleClick={vi.fn()}
        onCloseTab={vi.fn()}
        onCreateTab={vi.fn()}
        onTitleChange={vi.fn()}
        onTitleSave={vi.fn()}
        onTitleKeyDown={vi.fn()}
      />
    );

    const moreButtons = screen.getAllByLabelText('标签选项');
    expect(moreButtons.length).toBeGreaterThan(0);
    fireEvent.click(moreButtons[0]);

    expect(screen.getByText('另存为已保存查询...')).toBeTruthy();

    // Escape closes menu
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('另存为已保存查询...')).toBeNull();
  });
});

describe('useSqlEditorStore tab actions', () => {
  beforeEach(() => {
    useSqlEditorStore.getState().setTabs(mockTabs.map(tab => ({ ...tab })));
    useSqlEditorStore.getState().setActiveTabId('tab-2');
  });

  it.each(['closeTab', 'closeOtherTabs', 'closeTabsToRight', 'closeAllTabs'] as const)(
    '%s preserves all tabs and selection when discard is cancelled', action => {
      vi.mocked(window.confirm).mockReturnValue(false);
      const state = useSqlEditorStore.getState();
      if (action === 'closeAllTabs') state[action]();
      else state[action]('tab-2');
      expect(window.confirm).toHaveBeenCalledOnce();
      expect(useSqlEditorStore.getState().tabs).toBe(state.tabs);
      expect(useSqlEditorStore.getState().activeTabId).toBe('tab-2');
    }
  );

  it('selects the nearest right neighbour, then the left neighbour', () => {
    const state = useSqlEditorStore.getState();
    state.closeTab('tab-2');
    expect(useSqlEditorStore.getState().activeTabId).toBe('tab-3');
    state.closeTab('tab-3');
    expect(useSqlEditorStore.getState().activeTabId).toBe('tab-1');
    state.closeTab('tab-1');
    const reset = useSqlEditorStore.getState();
    expect(reset.tabs).toHaveLength(1);
    expect(reset.tabs[0].code).toBe('');
    expect(reset.tabs[0].result).toBeNull();
    expect(reset.activeTabId).toBe(reset.tabs[0].id);
  });

  it('keeps the active tab when closing an inactive tab and ignores unknown ids', () => {
    const state = useSqlEditorStore.getState();
    state.closeTab('missing');
    expect(window.confirm).not.toHaveBeenCalled();
    state.closeTab('tab-1');
    expect(useSqlEditorStore.getState().activeTabId).toBe('tab-2');
  });

  it('does not confirm saved SQL, but confirms subsequent changes even after a draft reload', () => {
    const state = useSqlEditorStore.getState();
    state.updateTabById('tab-2', { savedCode: 'SELECT 2;' });
    state.closeTab('tab-2');
    expect(window.confirm).not.toHaveBeenCalled();
    state.setTabs([{ ...mockTabs[1], savedCode: 'SELECT 2;', code: 'SELECT 22;' }]);
    state.setActiveTabId('tab-2');
    vi.mocked(window.confirm).mockReturnValue(false);
    state.closeAllTabs();
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(useSqlEditorStore.getState().tabs[0].code).toBe('SELECT 22;');
  });

  it('creates unique blank tabs and independent adjacent copies', () => {
    const state = useSqlEditorStore.getState();
    const first = state.createTab();
    const second = state.createTab();
    expect(first).not.toBe(second);
    expect(useSqlEditorStore.getState().tabs.at(-1)?.code).toBe('');
    const copy = state.duplicateTab('tab-2');
    state.updateTabById(copy, { code: 'SELECT 9;' });
    expect(useSqlEditorStore.getState().tabs[1].code).toBe('SELECT 2;');
    expect(useSqlEditorStore.getState().tabs[2].id).toBe(copy);
  });

  it('correctly duplicates, closes others, closes to right, and closes all tabs', () => {
    const store = useSqlEditorStore.getState();
    store.setTabs(mockTabs);
    store.setActiveTabId('tab-2');

    // Duplicate tab-2
    const newTabId = store.duplicateTab('tab-2');
    expect(newTabId).toBeTruthy();
    let currentTabs = useSqlEditorStore.getState().tabs;
    expect(currentTabs.length).toBe(4);
    expect(currentTabs[2].title).toBe('Query 2 (副本)');
    expect(currentTabs[2].code).toBe('SELECT 2;');

    // Close tabs to right of tab-2 (idx 1, should keep tab-1 and tab-2)
    store.closeTabsToRight('tab-2');
    currentTabs = useSqlEditorStore.getState().tabs;
    expect(currentTabs.length).toBe(2);
    expect(currentTabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']);

    // Close other tabs keeping tab-2
    store.closeOtherTabs('tab-2');
    currentTabs = useSqlEditorStore.getState().tabs;
    expect(currentTabs.length).toBe(1);
    expect(currentTabs[0].id).toBe('tab-2');

    // Close all tabs -> resets to 1 fresh default tab
    store.closeAllTabs();
    currentTabs = useSqlEditorStore.getState().tabs;
    expect(currentTabs.length).toBe(1);
    expect(currentTabs[0].title).toBe('Untitled Query');
    expect(currentTabs[0].code).toBe('');
  });
});

describe('single SQL tab interactions', () => {
  function setup(tabs = [mockTabs[0]]) {
    const props = {
      tabs, activeTabId: tabs[0].id, editingTitleId: null, tempTitle: '',
      onTabClick: vi.fn(), onTabDoubleClick: vi.fn(), onCloseTab: vi.fn(),
      onCreateTab: vi.fn(), onTitleChange: vi.fn(), onTitleSave: vi.fn(), onTitleKeyDown: vi.fn(),
    };
    render(<SqlEditorTabs {...props} />);
    return props;
  }

  it('keeps close and more buttons opaque with one tab, and disables unavailable close actions', () => {
    const props = setup();
    expect(screen.getByLabelText('关闭标签页').className).toContain('opacity-100');
    expect(screen.getByLabelText('标签选项').className).toContain('opacity-100');
    fireEvent.click(screen.getByLabelText('标签选项'));
    expect(screen.getByText('关闭其他标签页').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('关闭右侧标签页').closest('button')?.disabled).toBe(true);
    fireEvent.click(screen.getByText('关闭当前标签页'));
    expect(props.onCloseTab).toHaveBeenCalledWith('tab-1', expect.anything());
  });

  it('disables closing right of the last tab with multiple tabs', () => {
    setup(mockTabs);
    fireEvent.contextMenu(screen.getByText('Query 3'));
    expect(screen.getByText('关闭右侧标签页').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('关闭其他标签页').closest('button')?.disabled).toBe(false);
  });

  it('creates a tab only from blank-strip double click and renames only the title', () => {
    const props = setup();
    fireEvent.doubleClick(screen.getByRole('tablist'));
    expect(props.onCreateTab).toHaveBeenCalledOnce();
    fireEvent.doubleClick(screen.getByText('Query 1'));
    expect(props.onTabDoubleClick).toHaveBeenCalledOnce();
    fireEvent.doubleClick(screen.getByLabelText('标签选项'));
    expect(props.onTabDoubleClick).toHaveBeenCalledOnce();
  });
});

describe('SQL source download', () => {
  it('downloads the target SQL as UTF-8 with a safe .sql filename and releases the URL', async () => {
    const timer = vi.spyOn(window, 'setTimeout');
    try {
      let downloadedBlob: Blob | undefined;
      vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
        downloadedBlob = blob as Blob;
        return 'blob:sql-test';
      });
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        expect(this.download).toBe('中文_查询.sql');
        expect(this.getAttribute('href')).toBe('blob:sql-test');
        expect(this.isConnected).toBe(true);
      });
      expect(downloadSqlTab({ ...mockTabs[1], title: '中文/查询', code: "SELECT '你好';" })).toBe('中文_查询.sql');
      expect(click).toHaveBeenCalledOnce();
      expect(downloadedBlob?.type).toBe('text/sql;charset=utf-8');
      const content = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(downloadedBlob!);
      });
      expect(content).toBe("SELECT '你好';");
      const cleanupTimer = timer.mock.calls.find(call => call[1] === 5000);
      expect(cleanupTimer).toBeDefined();
      (cleanupTimer![0] as () => void)();
      expect(revoke).toHaveBeenCalledWith('blob:sql-test');
    } finally { timer.mockRestore(); }
  });
});
