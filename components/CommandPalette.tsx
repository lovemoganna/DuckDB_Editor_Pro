/**
 * CommandPalette - Global keyboard-driven command palette
 *
 * Integrated with CommandRegistry single source of truth.
 * Opens with Ctrl+K or global event 'open-command-palette'.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Search,
  Compass,
  CornerDownLeft,
  X,
  Database,
  Terminal,
  Sparkles,
  Layers,
  Settings,
  FolderDown,
  RotateCcw,
} from 'lucide-react';
import { commandRegistry, AppCommand } from '../services/commandRegistry';
import { WORKSPACE_FEATURES } from '../services/workspaceNavigation';
import { AISkill } from '../types';
import { OntologyCommand } from '../hooks/useOntologyStore';

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  category: 'command' | 'table' | 'skill' | 'navigation' | 'ontology';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
  tables: string[];
  currentTable: string | null;
  onSelectTable: (tableName: string) => void;
  onSetActiveTab: (tab: string) => void;
  onOpenCreateTable: () => void;
  onOpenImportWizard: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onAction?: (prompt: string) => void;
  skills?: AISkill[];
  onOntologyAction?: (command: OntologyCommand) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  tables = [],
  currentTable,
  onSelectTable,
  onSetActiveTab,
  onOpenCreateTable,
  onOpenImportWizard,
  onOpenExport,
  onOpenSettings,
  onAction,
  skills = [],
  onOntologyAction,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (openOrUpdater: boolean | ((prev: boolean) => boolean)) => {
    setInternalIsOpen(prev => {
      const next = typeof openOrUpdater === 'function' ? openOrUpdater(prev) : openOrUpdater;
      if (!next && controlledOnClose) controlledOnClose();
      return next;
    });
  };
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'command' | 'table' | 'skill' | 'navigation'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build unified palette items
  const allItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];

    // 1. Registered App Commands from CommandRegistry
    const regCommands = commandRegistry.getAll();
    regCommands.forEach((cmd: AppCommand) => {
      items.push({
        id: cmd.id,
        label: cmd.label,
        description: cmd.description,
        category: 'command',
        shortcut: cmd.shortcut,
        action: () => commandRegistry.dispatch(cmd.id),
      });
    });

    // 2. Database Tables
    tables.forEach((tbl) => {
      items.push({
        id: `table-${tbl}`,
        label: tbl,
        description: '切换并查看该数据表结构与数据',
        category: 'table',
        action: () => onSelectTable(tbl),
      });
    });

    // 3. Navigation Views (All workspace features including all AI Cognition tabs)
    WORKSPACE_FEATURES.forEach((feature) => {
      items.push({
        id: `nav-${(feature.tab || '').replaceAll('_', '-')}`,
        label: `${feature.label} (${feature.tab})`,
        description: `切换到 ${feature.label} 工作区`,
        category: 'navigation',
        action: () => onSetActiveTab(feature.tab),
      });
    });

    // 4. AI Skills
    skills.forEach((sk) => {
      items.push({
        id: `skill-${sk.id}`,
        label: sk.name,
        description: sk.description,
        category: 'skill',
        action: () => {
          if (onAction) {
            onAction(`使用技能 ${sk.name}`);
          }
        },
      });
    });

    return items;
  }, [tables, skills, onSelectTable, onSetActiveTab, onAction]);

  // Filter items by query and category
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
      );
    });
  }, [allItems, query, selectedCategory]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset index on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  const executeItem = (item: CommandPaletteItem) => {
    item.action();
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const safeIdx = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
      if (filtered[safeIdx]) {
        executeItem(filtered[safeIdx]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-2xl bg-monokai-elevated border border-monokai-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-monokai-fg font-sans"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-monokai-border-subtle bg-monokai-surface">
          <Search className="w-4 h-4 text-monokai-comment shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-monokai-fg text-sm focus:outline-none placeholder-monokai-comment"
            placeholder="搜索命令、数据表、AI 技能或导航... (Esc 关闭)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-monokai-comment hover:text-monokai-fg cursor-pointer mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-sidebar text-monokai-comment border border-monokai-border">
            ESC
          </kbd>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-monokai-border-subtle bg-monokai-sidebar text-xs">
          {[
            { id: 'all', label: '全部' },
            { id: 'command', label: '系统命令' },
            { id: 'table', label: '数据表' },
            { id: 'navigation', label: '页面导航' },
            { id: 'skill', label: 'AI 技能' },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-monokai-surface text-monokai-accent font-medium shadow-xs'
                  : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-white/[0.04]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-monokai-border-subtle p-1.5 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-monokai-comment flex flex-col items-center">
              <Compass className="w-8 h-8 mb-2 opacity-30 text-monokai-comment" />
              <p className="text-xs">未能找到与 "{query}" 匹配的命令或资产</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  ref={isSelected ? el => el?.scrollIntoView?.({ block: 'nearest' }) : null}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isSelected ? 'bg-monokai-surface text-monokai-fg border border-monokai-border shadow-xs' : 'hover:bg-monokai-surface/60 text-monokai-fg-muted border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-monokai-sidebar shrink-0 border border-monokai-border-subtle">
                      {item.category === 'table' ? (
                        <Database className="w-3.5 h-3.5 text-monokai-fg-muted" />
                      ) : item.category === 'skill' ? (
                        <Sparkles className="w-3.5 h-3.5 text-monokai-fg-muted" />
                      ) : item.category === 'navigation' ? (
                        <Layers className="w-3.5 h-3.5 text-monokai-fg-muted" />
                      ) : (
                        <Terminal className="w-3.5 h-3.5 text-monokai-fg-muted" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate flex items-center gap-2">
                        <span className="text-monokai-fg">{item.label}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-monokai-sidebar text-monokai-comment border border-monokai-border-subtle">
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-monokai-comment truncate mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-monokai-sidebar text-monokai-comment border border-monokai-border-subtle">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-monokai-accent" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-monokai-surface px-4 py-2 border-t border-monokai-border-subtle flex items-center justify-between text-[11px] text-monokai-comment">
          <span>
            <kbd className="font-mono bg-monokai-sidebar px-1 py-0.5 rounded border border-monokai-border">↑</kbd>{' '}
            <kbd className="font-mono bg-monokai-sidebar px-1 py-0.5 rounded border border-monokai-border">↓</kbd> 导航 ·{' '}
            <kbd className="font-mono bg-monokai-sidebar px-1 py-0.5 rounded border border-monokai-border">Enter</kbd> 执行 ·{' '}
            <kbd className="font-mono bg-monokai-sidebar px-1 py-0.5 rounded border border-monokai-border">Esc</kbd> 关闭
          </span>
          <span>{filtered.length} 项可用</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
