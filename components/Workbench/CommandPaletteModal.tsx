import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Play,
  FileCode,
  Download,
  Terminal,
  X,
} from 'lucide-react';
import { ModalShell } from '../ui/Workbench';
import { ActionButton } from '../ui/Workbench';

export interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  onRunQuery: () => void;
  onExplainQuery: () => void;
  onNewTab: () => void;
  onExportParquet: () => void;
  hasActiveSql: boolean;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  run: () => void;
  description?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  onClose,
  onRunQuery,
  onExplainQuery,
  onNewTab,
  onExportParquet,
  hasActiveSql,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'run',
      label: '运行当前查询',
      icon: Play,
      shortcut: 'Ctrl+Enter',
      run: () => {
        onClose();
        onRunQuery();
      },
      description: '执行当前 Tab 的 SQL',
    },
    {
      id: 'explain',
      label: '解释查询计划',
      icon: Search,
      shortcut: 'Ctrl+E',
      run: () => {
        onClose();
        onExplainQuery();
      },
      description: '生成 EXPLAIN 执行计划',
    },
    {
      id: 'new-tab',
      label: '新建 SQL 标签页',
      icon: FileCode,
      shortcut: 'Ctrl+T',
      run: () => {
        onClose();
        onNewTab();
      },
      description: '在编辑器中新增一个查询 Tab',
    },
    {
      id: 'export-parquet',
      label: '导出结果为 Parquet',
      icon: Download,
      shortcut: 'Ctrl+Shift+E',
      run: () => {
        onClose();
        onExportParquet();
      },
      description: '将当前 SQL 结果导出为 .parquet 文件',
    },
  ];

  const filtered = React.useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q) ?? false)
    );
  }, [query, commands.length]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus the input on next paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep selected index within bounds when filter changes
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(filtered.length - 1, prev + 1));
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(0, prev - 1));
      scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) cmd.run();
    }
  };

  const scrollSelectedIntoView = () => {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="SQL 工作台快捷命令"
      description="快速运行、解释、新建标签页或导出结果"
      size="sm"
      closeLabel="关闭命令面板"
      className="!max-w-lg"
    >
      <div onKeyDown={handleKeyDown}>
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 py-2 mb-2 border border-monokai-border rounded-lg bg-monokai-bg focus-within:border-monokai-accent transition-colors">
          <Terminal className="h-4 w-4 text-monokai-comment shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="键入命令或搜索操作…"
            className="flex-1 bg-transparent text-xs text-monokai-fg font-mono outline-none placeholder:text-monokai-comment/70"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-monokai-comment hover:text-monokai-fg transition-colors"
              aria-label="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-1"
          role="listbox"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-monokai-comment uppercase tracking-wider font-mono">
            {query ? `匹配结果 (${filtered.length})` : 'Recent & Actions'}
          </div>

          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-monokai-comment">
              未找到匹配的命令
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const selected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  data-cmd-index={idx}
                  onClick={cmd.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  disabled={!hasActiveSql && (cmd.id === 'run' || cmd.id === 'explain' || cmd.id === 'export-parquet')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs font-sans transition-colors cursor-pointer ${
                    selected
                      ? 'bg-monokai-accent/15 text-monokai-fg border border-monokai-accent/40'
                      : 'border border-transparent hover:bg-monokai-surface text-monokai-fg'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  role="option"
                  aria-selected={selected}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-monokai-accent' : 'text-monokai-comment'}`} />
                    <span className="truncate">{cmd.label}</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-monokai-comment bg-monokai-bg border border-monokai-border px-1.5 py-0.5 rounded shrink-0">
                    {cmd.shortcut}
                  </kbd>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-monokai-border/60 flex items-center justify-between text-[10px] text-monokai-comment font-mono">
          <span className="flex items-center gap-2">
            <span>↑↓ 选择</span>
            <span>Enter 执行</span>
            <span>Esc 关闭</span>
          </span>
          <ActionButton variant="secondary" size="sm" onClick={onClose}>关闭</ActionButton>
        </div>
      </div>
    </ModalShell>
  );
};

export default CommandPaletteModal;
