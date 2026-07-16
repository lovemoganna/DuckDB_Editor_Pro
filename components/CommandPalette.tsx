/**
 * CommandPalette - Global keyboard-driven command palette
 *
 * Provides fuzzy search over tables, navigation, actions, and AI skills.
 * Opens with Ctrl+K or clicking the search bar.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Search,
  Compass,
  CornerDownLeft,
  X,
} from 'lucide-react';
import {
  CommandItem,
  filterCommands,
  buildCommandPalette,
} from './CommandPaletteData';
import { AISkill } from '../types';
import { OntologyCommand } from '../hooks/useOntologyStore';

interface CommandPaletteProps {
  tables: string[];
  currentTable: string | null;
  onSelectTable: (tableName: string) => void;
  onSetActiveTab: (tab: string) => void;
  onOpenCreateTable: () => void;
  onOpenImportWizard: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onAction: (prompt: string) => void;
  skills?: AISkill[];
  /** Called when user selects an ontology-specific command from the palette */
  onOntologyAction?: (command: OntologyCommand) => void;
}

const RECENT_KEY = 'duckdb_command_palette_recent';

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecent(id: string) {
  const recent = getRecent().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  tables,
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(
    () => buildCommandPalette(tables, skills, []),
    [tables, skills]
  );

  const filtered = useMemo(
    () => filterCommands(commands, query),
    [commands, query]
  );

  // Grouped display
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach(cmd => {
      const group = cmd.type === 'table' ? 'Tables'
        : cmd.type === 'skill' ? 'AI Skills'
        : cmd.type === 'navigation' ? 'Navigation'
        : cmd.type === 'ontology' ? 'Ontology'
        : 'Actions';
      if (!groups[group]) groups[group] = [];
      groups[group].push(cmd);
    });
    return groups;
  }, [filtered]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const execute = (cmd: CommandItem) => {
    addRecent(cmd.id);

    if (cmd.type === 'table') {
      const tableName = cmd.label.replace(/^📋\s*/, '');
      onSelectTable(tableName);
    } else if (cmd.type === 'navigation' && cmd.tab) {
      onSetActiveTab(cmd.tab);
    } else if (cmd.type === 'action') {
      switch (cmd.id) {
        case 'action-create-table': onOpenCreateTable(); break;
        case 'action-import': onOpenImportWizard(); break;
        case 'action-export': onOpenExport(); break;
        case 'action-settings': onOpenSettings(); break;
      }
    } else if (cmd.type === 'ontology' && cmd.ontologyCommand && onOntologyAction) {
      onOntologyAction(cmd.ontologyCommand);
    } else if (cmd.type === 'skill' && cmd.skillId) {
      onAction(`使用技能 ${cmd.label}`);
    }

    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      }
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm">
          {/* Click outside to close */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-2xl bg-monokai-bg border border-monokai-accent shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Search Input */}
            <div className="flex items-center px-4 py-3 border-b border-monokai-accent/50 bg-monokai-sidebar">
              <Search className="w-5 h-5 text-monokai-comment flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none text-monokai-fg px-3 py-2 text-base focus:outline-none placeholder-monokai-comment"
                placeholder="搜索命令、表名、导航... (Esc 关闭)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button onClick={() => setIsOpen(false)} className="text-monokai-comment hover:text-monokai-fg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-monokai-comment flex flex-col items-center">
                  <Compass className="w-8 h-8 mb-3 opacity-30" />
                  <p>未能找到匹配项</p>
                </div>
              ) : (
                Object.entries(grouped).map(([groupName, items]) => (
                  <div key={groupName}>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-monokai-comment tracking-widest bg-monokai-sidebar/50">
                      {groupName}
                    </div>
                    {items.map((cmd) => {
                      const globalIdx = filtered.indexOf(cmd);
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <div
                          key={cmd.id}
                          onClick={() => execute(cmd)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-100 border-l-2 ${
                            isSelected
                              ? 'border-monokai-amethyst bg-monokai-accent/20'
                              : 'border-transparent hover:bg-monokai-sidebar/40'
                          }`}
                        >
                          <span className="text-base w-6 flex-shrink-0 text-center">
                            {cmd.type === 'table' ? '📋'
                              : cmd.type === 'skill' ? (cmd.icon || '⚡')
                              : cmd.type === 'navigation' ? '🧭'
                              : '⚙️'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-monokai-fg">{cmd.label}</span>
                            {cmd.description && (
                              <span className="text-xs text-monokai-comment ml-2">{cmd.description}</span>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <span className="text-[10px] font-mono text-monokai-comment px-1.5 py-0.5 rounded bg-monokai-bg border border-monokai-accent/30">
                              {cmd.shortcut}
                            </span>
                          )}
                          {globalIdx === selectedIndex && (
                            <CornerDownLeft className="w-4 h-4 text-monokai-amethyst flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="bg-monokai-sidebar/80 px-4 py-2 border-t border-monokai-accent/30 flex items-center justify-between text-xs text-monokai-comment">
              <span><span className="font-mono">↑</span> <span className="font-mono">↓</span> 导航 · <span className="font-mono">Enter</span> 执行 · <span className="font-mono">Esc</span> 关闭</span>
              <span>{filtered.length} 结果</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
