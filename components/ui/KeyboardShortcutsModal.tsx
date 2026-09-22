/**
 * KeyboardShortcutsModal — global shortcut cheat sheet.
 * Opens via Shift+? or `open-keyboard-shortcuts` window event.
 * Uses ModalShell for consistent Monokai chrome.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Keyboard, Command, Terminal, Wrench, Sparkles } from 'lucide-react';
import { CommandRegistry } from '../../services/commandRegistry';
import { ModalShell } from './Workbench';

interface ShortcutGroup {
  category: string;
  icon: React.ReactNode;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

export const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcutGroups: ShortcutGroup[] = useMemo(() => {
    const commands = CommandRegistry.getAll();
    const globalCmds = commands.filter(c => c.category === 'global' && c.keys);
    const queryCmds = commands.filter(c => c.category === 'query' && c.keys);
    const toolCmds = commands.filter(c => c.category === 'tools' && c.keys);

    const groups: ShortcutGroup[] = [
      {
        category: '全局通用快捷键',
        icon: <Command className="w-3.5 h-3.5 text-monokai-yellow" />,
        shortcuts: globalCmds.map(c => ({ keys: c.keys!, description: c.label })),
      },
      {
        category: 'SQL 执行与编辑快捷键',
        icon: <Terminal className="w-3.5 h-3.5 text-monokai-cyan" />,
        shortcuts: queryCmds.map(c => ({ keys: c.keys!, description: c.label })),
      },
    ];

    if (toolCmds.length > 0) {
      groups.push({
        category: '系统与辅助工具快捷键',
        icon: <Wrench className="w-3.5 h-3.5 text-monokai-accent" />,
        shortcuts: toolCmds.map(c => ({ keys: c.keys!, description: c.label })),
      });
    }

    return groups;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.cm-editor') !== null);

      if (e.key === '?' && e.shiftKey && !isInput) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-keyboard-shortcuts', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-keyboard-shortcuts', handleOpenEvent);
    };
  }, []);

  return (
    <ModalShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="快捷键速查指南"
      description="高效操作 DuckDB Studio 的键盘快捷键映射"
      size="lg"
      icon={Keyboard}
      iconColor="text-monokai-accent"
      badge="Cheat Sheet"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-monokai-comment">
            <Sparkles className="w-3.5 h-3.5 text-monokai-amethyst" />
            随时按{' '}
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-monokai-bg rounded border border-monokai-border text-monokai-accent">
              Shift + ?
            </kbd>{' '}
            呼出本指南
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-monokai-accent text-monokai-bg font-semibold hover:bg-monokai-accent-hover transition-colors text-xs cursor-pointer"
          >
            完成
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {shortcutGroups.map(group => (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-monokai-fg-muted tracking-wider uppercase border-b border-monokai-border pb-1.5 font-mono">
              {group.icon}
              <span>{group.category}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {group.shortcuts.map(shortcut => (
                <div
                  key={shortcut.description}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-monokai-surface/60 border border-monokai-border/60 hover:border-monokai-border transition-colors group"
                >
                  <span className="text-xs text-monokai-fg-muted group-hover:text-monokai-fg transition-colors">
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {shortcut.keys.map((k, idx) => (
                      <React.Fragment key={`${shortcut.description}-${k}-${idx}`}>
                        {idx > 0 && <span className="text-[10px] text-monokai-comment">+</span>}
                        <kbd className="px-2 py-0.5 text-[11px] font-mono bg-monokai-bg text-monokai-accent rounded border border-monokai-border shadow-xs">
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {shortcutGroups.every(g => g.shortcuts.length === 0) && (
          <p className="text-xs text-monokai-comment text-center py-8">暂无已注册的快捷键命令</p>
        )}
      </div>
    </ModalShell>
  );
};
