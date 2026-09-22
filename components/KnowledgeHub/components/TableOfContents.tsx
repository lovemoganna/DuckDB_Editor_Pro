import React, { useMemo, useState, useEffect } from 'react';
import { ListOrdered, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level: number;
  sectionNumber: string;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
  floating?: boolean;
}

export function extractTocFromMarkdown(markdown: string): TocItem[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const items: TocItem[] = [];

  let h1Count = 0;
  let h2Count = 0;
  let h3Count = 0;

  // 跟踪是否在代码块内，忽略代码块内部的 # 注释
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();

      // 清除加粗、斜体或行内代码标记
      const cleanText = rawText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*`)`/g, '$1')
        .trim();

      if (!cleanText) continue;

      let sectionNumber = '';
      if (level === 1) {
        h1Count++;
        h2Count = 0;
        h3Count = 0;
        sectionNumber = `${h1Count}.`;
      } else if (level === 2) {
        if (h1Count === 0) h1Count = 1;
        h2Count++;
        h3Count = 0;
        sectionNumber = `${h1Count}.${h2Count}.`;
      } else if (level === 3) {
        if (h1Count === 0) h1Count = 1;
        if (h2Count === 0) h2Count = 1;
        h3Count++;
        sectionNumber = `${h1Count}.${h2Count}.${h3Count}.`;
      }

      const id = cleanText
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';

      items.push({
        id,
        text: cleanText,
        level,
        sectionNumber,
      });
    }
  }

  return items;
}

const TableOfContentsInner: React.FC<TableOfContentsProps> = ({
  content,
  className = '',
  floating = true,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const tocItems = useMemo(() => extractTocFromMarkdown(content), [content]);

  // 监听页面滚动，高亮当前可视章节(Scrollspy)
  useEffect(() => {
    if (tocItems.length === 0) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    tocItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tocItems]);

  if (tocItems.length < 2) {
    return null;
  }

  const handleScrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setActiveId(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
    }
  };

  const navContent = (
    <nav
      aria-label="Table of contents"
      className={`rounded-xl border border-monokai-border bg-monokai-surface/98 backdrop-blur-xl overflow-hidden text-xs shadow-2xl transition-all ${
        floating ? 'w-72 sm:w-80 max-w-[calc(100vw-40px)]' : 'w-full'
      } ${className}`}
    >
      <div className="w-full flex items-center justify-between px-3.5 py-2.5 bg-monokai-surface border-b border-monokai-border/60 select-none">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-3.5 h-3.5 text-monokai-accent" />
          <span className="font-bold text-monokai-fg-muted tracking-wider uppercase font-mono text-[11px]">
            TABLE OF CONTENTS
          </span>
          <span className="text-[10px] text-monokai-accent font-mono px-1.5 py-0.2 rounded bg-monokai-elevated border border-monokai-border">
            {tocItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {floating && (
            <button
              type="button"
              onClick={() => setIsPinned((prev) => !prev)}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                isPinned
                  ? 'bg-monokai-elevated text-monokai-accent border border-monokai-accent/40'
                  : 'text-monokai-comment hover:text-monokai-fg-muted'
              }`}
              title={isPinned ? '已固定常驻(点击取消固定)' : '点击固定常驻'}
            >
              {isPinned ? '已固定' : '固定'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] text-monokai-comment hover:text-monokai-fg-muted cursor-pointer"
          >
            <span>{isOpen ? '收起' : '展开'}</span>
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-3.5 py-3 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
          <ul className="space-y-1 font-sans">
            {tocItems.map((item, idx) => {
              const isActive = activeId === item.id;
              const indentClass =
                item.level === 1
                  ? 'pl-0 font-medium'
                  : item.level === 2
                  ? 'pl-3.5 text-[11.5px]'
                  : 'pl-6 text-[11px]';

              return (
                <li
                  key={`${item.id}-${idx}`}
                  className={`${indentClass} flex items-baseline gap-1.5 py-1 px-1.5 rounded transition-all group/item ${
                    isActive
                      ? 'bg-monokai-elevated text-monokai-accent font-semibold border-l-2 border-monokai-accent'
                      : 'text-monokai-comment hover:text-monokai-fg-muted hover:bg-monokai-surface'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] shrink-0 select-none ${
                      isActive ? 'text-monokai-accent' : 'text-monokai-comment group-hover/item:text-monokai-comment'
                    }`}
                  >
                    {item.sectionNumber}
                  </span>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleScrollTo(e, item.id)}
                    className="truncate flex-1"
                    title={item.text}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );

  if (!floating) {
    return navContent;
  }

  return (
    <div
      data-testid="floating-toc-dock"
      className="fixed right-0 top-24 sm:top-28 z-40 flex items-start select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 悬浮展开的完整目录卡片（鼠标移上展示，移开隐藏，绝对定位浮层，不占任何页面流宽度） */}
      <div
        className={`absolute right-full top-0 pr-1.5 transition-all duration-300 ease-out origin-top-right ${
          isHovered || isPinned
            ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto visible shadow-2xl'
            : 'opacity-0 translate-x-6 scale-95 pointer-events-none invisible'
        }`}
      >
        {navContent}
      </div>

      {/* 最右侧悬浮把手 (默认吸附在最右侧边缘，仅当鼠标移到此把手上时才触发展开) */}
      <button
        type="button"
        onClick={() => setIsPinned((prev) => !prev)}
        title={isPinned ? '点击取消固定目录' : '鼠标移上展开目录，点击可固定 (TOC)'}
        aria-label="文章目录大纲"
        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-l-md border-l border-y shadow-lg cursor-pointer transition-all ${
          isHovered || isPinned
            ? 'bg-monokai-elevated text-monokai-accent border-monokai-accent/80 shadow-monokai-accent/15'
            : 'bg-monokai-surface/90 hover:bg-monokai-elevated text-monokai-comment hover:text-monokai-accent border-monokai-border'
        }`}
      >
        <ListOrdered className="w-3.5 h-3.5 text-monokai-accent" />
        <span
          className="text-[9.5px] font-mono font-bold tracking-widest uppercase text-monokai-fg-muted group-hover:text-monokai-accent"
          style={{ writingMode: 'vertical-rl' }}
        >
          TOC
        </span>
        <ChevronLeft
          className={`w-3 h-3 text-monokai-comment transition-transform ${
            isHovered || isPinned ? 'rotate-180 text-monokai-accent' : ''
          }`}
        />
      </button>
    </div>
  );
};

export const TableOfContents = React.memo(TableOfContentsInner);
