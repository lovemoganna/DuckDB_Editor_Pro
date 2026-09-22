import React, { useMemo } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { ModalShell } from '../ui/Workbench';

export interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  hint?: string;
}

interface ShortcutGroup {
  id: string;
  title: string;
  description: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'execution',
    title: '查询执行',
    description: 'SQL 运行、停止与计划',
    items: [
      { keys: ['Ctrl', 'Enter'], description: '运行完整查询', hint: '全量执行当前 Tab 的 SQL 语句' },
      { keys: ['Ctrl', 'Shift', 'Enter'], description: '仅运行选中语句', hint: '仅执行高亮选中的 SQL 代码段' },
      { keys: ['Ctrl', 'E'], description: '生成执行计划', hint: '查看物理算子拓扑图与预期开销' },
      { keys: ['Ctrl', 'Shift', 'A'], description: '深度剖析', hint: '真实运行并量化各节点耗时' },
    ],
  },
  {
    id: 'editor',
    title: '编辑器',
    description: '代码编辑、格式与保存',
    items: [
      { keys: ['Ctrl', 'Shift', 'F'], description: '美化格式化 SQL', hint: '基于 sql-formatter 的 DuckDB 关键字大写化' },
      { keys: ['Ctrl', 'S'], description: '保存当前查询 Tab', hint: '写入 localStorage 草稿槽' },
      { keys: ['Ctrl', '/'], description: '切换注释 / 取消注释', hint: '对当前行或选中区域生效' },
      { keys: ['Ctrl', 'D'], description: '复制当前行 / 选中区域', hint: '基于 CodeMirror 默认行为' },
      { keys: ['Alt', '↑/↓'], description: '上下移动当前行', hint: '快速重构 SQL 段' },
    ],
  },
  {
    id: 'tabs',
    title: '标签页',
    description: '查询 Tab 管理',
    items: [
      { keys: ['Ctrl', 'T'], description: '新建 SQL Tab', hint: '在编辑器中新增空查询标签' },
      { keys: ['Ctrl', 'W'], description: '关闭当前 Tab', hint: '脏页会触发确认弹窗' },
      { keys: ['Ctrl', 'Tab'], description: '切换到下一个 Tab', hint: '循环切换活跃标签' },
      { keys: ['Ctrl', 'Shift', 'Tab'], description: '切换到上一个 Tab', hint: '逆向循环切换活跃标签' },
      { keys: ['双击'], description: '重命名 Tab', hint: '重命名当前活跃 Tab' },
    ],
  },
  {
    id: 'global',
    title: '全局',
    description: '命令面板、面板与弹窗',
    items: [
      { keys: ['Ctrl', 'K'], description: '打开命令面板', hint: '快速搜索运行/导出/AI 命令' },
      { keys: ['?'], description: '查看此快捷键指南', hint: '即本弹窗' },
      { keys: ['Escape'], description: '关闭所有弹窗与抽屉', hint: '优先级：最上层 Modal 优先关闭' },
      { keys: ['F11'], description: '全屏浏览结果集', hint: '与结果区 Maximize 等价' },
    ],
  },
];

const formatKeyLabel = (key: string): string => {
  // Normalize keys for macOS / Windows dual-display
  if (key === 'Ctrl') return 'Ctrl';
  if (key === 'Shift') return 'Shift';
  if (key === 'Alt') return 'Alt';
  if (key === 'Meta') return '⌘';
  if (key === 'Tab') return 'Tab';
  if (key === '↑/↓') return '↑/↓';
  if (key === '?') return '?';
  return key;
};

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  open,
  onClose,
}) => {
  const groups = useMemo(() => SHORTCUT_GROUPS, []);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="快捷键指南"
      description="SQL 工作台与全局命令的键盘快捷方式"
      size="lg"
      icon={Keyboard}
      iconColor="text-monokai-accent"
      badge="Shortcuts"
      closeLabel="关闭快捷键指南"
      footer={
        <span className="mr-auto flex items-center gap-2 font-mono text-[11px] text-monokai-comment">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-monokai-accent shadow-[0_0_8px_rgba(166,226,46,0.65)]" />
          共 {groups.reduce((acc, g) => acc + g.items.length, 0)} 个快捷键 · {groups.length} 个分组
        </span>
      }
    >
      <div className="space-y-5 font-sans">
        {groups.map((group, idx) => (
          <section key={group.id} className="space-y-2">
            {/* Section Header */}
            <div className="flex items-baseline justify-between border-b border-monokai-border/60 pb-1.5">
              <div className="flex items-baseline gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-monokai-fg-muted font-mono">
                  {group.title}
                </h3>
                <span className="text-[10px] text-monokai-comment font-sans">{group.description}</span>
              </div>
              <span className="text-[10px] font-mono text-monokai-comment/70 tabular-nums">
                {String(idx + 1).padStart(2, '0')} / {String(groups.length).padStart(2, '0')}
              </span>
            </div>

            {/* Shortcut Rows */}
            <div className="grid grid-cols-1 gap-1.5">
              {group.items.map((item, itemIdx) => (
                <div
                  key={`${group.id}-${itemIdx}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-monokai-border/70 bg-monokai-surface/55 px-3 py-2 transition-colors hover:bg-monokai-surface/85 hover:border-monokai-accent/35"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-monokai-fg leading-snug">
                      {item.description}
                    </div>
                    {item.hint && (
                      <div className="text-[10px] text-monokai-comment/85 leading-snug mt-0.5 font-mono">
                        {item.hint}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, kIdx) => (
                      <React.Fragment key={`${k}-${kIdx}`}>
                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-monokai-border bg-gradient-to-b from-monokai-bg to-monokai-surface font-mono text-[10px] font-bold text-monokai-fg shadow-[inset_0_-1px_0_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]">
                          {formatKeyLabel(k)}
                        </kbd>
                        {kIdx < item.keys.length - 1 && (
                          <span className="text-[10px] text-monokai-comment/65 font-mono">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Footer hint */}
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-monokai-accent/30 bg-monokai-accent/8 px-3 py-2 text-[11px] text-monokai-fg-muted leading-relaxed">
          <Search className="w-3.5 h-3.5 text-monokai-accent mt-0.5 shrink-0" />
          <span>
            按 <kbd className="font-mono px-1 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-fg mx-0.5">?</kbd>
            可在任意时刻唤起本面板，按 <kbd className="font-mono px-1 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-fg mx-0.5">Esc</kbd>
            关闭。在 Mac 上 <kbd className="font-mono px-1 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-fg mx-0.5">Ctrl</kbd>
            等价于 <kbd className="font-mono px-1 py-0.5 rounded bg-monokai-bg border border-monokai-border text-monokai-fg mx-0.5">⌘</kbd>。
          </span>
        </div>
      </div>
    </ModalShell>
  );
};

export default KeyboardShortcutsModal;