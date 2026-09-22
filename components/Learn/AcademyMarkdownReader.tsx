/**
 * AcademyMarkdownReader.tsx - 学堂专用轻量沉浸式讲义阅读器
 * 
 * 设计目标：
 * 1. 彻底解决旧版 MarkdownViewer 导致的 5 重侧边栏、双重 SQL 执行器与排版冲突；
 * 2. 专注阅读理解体验：Monokai 现代极客排版、优雅字阶与层次分明的代码块；
 * 3. 智能代码交互：代码块提供「复制代码」与「填入试炼场」一键注入能力；
 * 4. 目录大纲导航 (TOC)：自动解析 H1-H3 标题并提供平滑定位跳转；
 * 5. Mermaid 图表原生渲染：可视化架构与数据链路。
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { 
  Copy, Check, Play, List, ChevronRight, Hash, 
  ExternalLink, FileText, Sparkles, BookOpen
} from 'lucide-react';
import { SafeSvgImage } from '../ui/SafeSvgImage';
import { toastService } from '../../services/toastService';

interface AcademyMarkdownReaderProps {
  content: string;
  onTryCode?: (code: string) => void;
  showToc?: boolean;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
});

// Mermaid 独立渲染组件
const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(idRef.current, chart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch (err) {
        if (isMounted) setError(true);
      }
    };
    if (chart.trim()) {
      renderChart();
    }
    return () => { isMounted = false; };
  }, [chart]);

  if (error) {
    return (
      <div className="p-3 my-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
        图表渲染失败，请检查 Mermaid 语法。
      </div>
    );
  }

  return (
    <div className="my-5 flex justify-center bg-monokai-sidebar/70 p-4 rounded-xl overflow-x-auto border border-monokai-border shadow-xs">
      <SafeSvgImage svg={svg} alt="Tutorial diagram" className="max-w-none" />
    </div>
  );
};

// 单个代码块增强渲染器
const CodeBlock: React.FC<{
  language?: string;
  codeString: string;
  onTryCode?: (code: string) => void;
}> = ({ language, codeString, onTryCode }) => {
  const [copied, setCopied] = useState(false);
  const cleanCode = codeString.replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    toastService.success('代码已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFill = () => {
    if (onTryCode) {
      onTryCode(cleanCode);
      toastService.info('代码已填入右侧试炼场');
    }
  };

  if (language === 'mermaid') {
    return <MermaidBlock chart={cleanCode} />;
  }

  return (
    <div className="my-4 rounded-xl bg-monokai-sidebar border border-monokai-border overflow-hidden shadow-xs group">
      {/* 顶部语言标识与操作区 */}
      <div className="h-8 bg-monokai-surface/80 px-3 flex items-center justify-between border-b border-monokai-border/80">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-monokai-comment">
          <Hash className="w-3.5 h-3.5 text-monokai-cyan" />
          <span className="uppercase tracking-wider text-monokai-cyan">{language || 'text'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-0.5 rounded text-[10.5px] text-monokai-comment hover:text-white hover:bg-monokai-elevated transition-colors cursor-pointer flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-monokai-green" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>

          {onTryCode && (
            <button
              type="button"
              onClick={handleFill}
              className="px-2.5 py-0.5 rounded text-[10.5px] font-bold text-monokai-bg bg-monokai-green hover:bg-monokai-green/90 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>填入试炼场</span>
            </button>
          )}
        </div>
      </div>

      {/* 代码内容主体 */}
      <pre className="p-4 text-xs font-mono text-zinc-200 leading-relaxed overflow-x-auto bg-monokai-bg/60 select-text">
        <code>{cleanCode}</code>
      </pre>
    </div>
  );
};

export const AcademyMarkdownReader: React.FC<AcademyMarkdownReaderProps> = ({
  content,
  onTryCode,
  showToc = true,
}) => {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 解析 TOC 目录
  const tocItems = useMemo<TocItem[]>(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const items: TocItem[] = [];
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '');
        items.push({ id, text, level });
      }
    });
    return items;
  }, [content]);

  // 目录跳转
  const handleScrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsTocOpen(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-monokai-bg select-text">
      
      {/* 讲义顶栏工具条：字数统计 + 大纲切换 */}
      {showToc && tocItems.length > 0 && (
        <div className="h-9 shrink-0 bg-monokai-sidebar/90 border-b border-monokai-border px-4 flex items-center justify-between z-10 sticky top-0 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-monokai-comment">
            <BookOpen className="w-3.5 h-3.5 text-monokai-cyan" />
            <span className="font-medium text-zinc-300">讲义大纲</span>
            <span className="text-[10px]">({tocItems.length} 个小节)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTocOpen(!isTocOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                isTocOpen
                  ? 'bg-monokai-cyan text-monokai-bg border-monokai-cyan font-bold'
                  : 'bg-monokai-surface text-monokai-comment hover:text-white border-monokai-border'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{isTocOpen ? '收起目录' : '展开目录'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 浮动/展开的 TOC 目录面板 */}
      {isTocOpen && tocItems.length > 0 && (
        <div className="absolute top-9 left-0 right-0 max-h-72 overflow-y-auto bg-monokai-sidebar/98 border-b border-monokai-border shadow-xl z-20 p-4 space-y-1.5 custom-scrollbar backdrop-blur-md animate-in fade-in duration-150">
          <div className="text-[10px] uppercase font-bold text-monokai-comment tracking-wider mb-2">
            快速跳转至小节
          </div>
          {tocItems.map(item => (
            <button
              key={item.id + item.text}
              type="button"
              onClick={() => handleScrollToHeading(item.id)}
              className={`w-full text-left flex items-center gap-1.5 py-1 px-2 rounded-md text-xs hover:bg-monokai-surface hover:text-monokai-cyan transition-colors cursor-pointer truncate ${
                item.level === 1 ? 'font-bold text-white pl-2' : item.level === 2 ? 'text-zinc-300 pl-4' : 'text-monokai-comment pl-6 text-[11px]'
              }`}
            >
              <ChevronRight className="w-3 h-3 text-monokai-cyan shrink-0" />
              <span className="truncate">{item.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* 讲义主体 Markdown 渲染 */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 max-w-3xl space-y-4"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // 标题渲染：注入可跳转的 id
            h1: ({ children }) => {
              const text = String(children);
              const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
              return (
                <h1 id={id} className="text-xl font-extrabold text-white tracking-tight pt-4 pb-2 border-b border-monokai-border/80 scroll-mt-12 flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-monokai-green inline-block" />
                  <span>{children}</span>
                </h1>
              );
            },
            h2: ({ children }) => {
              const text = String(children);
              const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
              return (
                <h2 id={id} className="text-base font-bold text-monokai-cyan tracking-tight pt-4 pb-1 scroll-mt-12 flex items-center gap-1.5">
                  <ChevronRight className="w-4 h-4 text-monokai-cyan" />
                  <span>{children}</span>
                </h2>
              );
            },
            h3: ({ children }) => {
              const text = String(children);
              const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
              return (
                <h3 id={id} className="text-sm font-semibold text-white pt-2 pb-0.5 scroll-mt-12">
                  {children}
                </h3>
              );
            },
            // 段落
            p: ({ children }) => (
              <p className="text-xs text-zinc-300 leading-relaxed my-2">
                {children}
              </p>
            ),
            // 列表
            ul: ({ children }) => (
              <ul className="text-xs text-zinc-300 space-y-1 my-2 list-disc list-inside">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="text-xs text-zinc-300 space-y-1 my-2 list-decimal list-inside">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">
                {children}
              </li>
            ),
            // 引用块 (Callout)
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-monokai-yellow bg-monokai-sidebar/80 px-4 py-2 rounded-r-xl text-xs text-zinc-300 my-3 shadow-2xs">
                {children}
              </blockquote>
            ),
            // 表格
            table: ({ children }) => (
              <div className="overflow-x-auto my-4 rounded-xl border border-monokai-border bg-monokai-sidebar/50 shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-monokai-surface/80 text-[11px] font-bold text-monokai-comment uppercase border-b border-monokai-border">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 border-b border-monokai-border/40 text-zinc-300">
                {children}
              </td>
            ),
            // 行内代码与代码块
            code: ({ inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              const codeString = String(children);

              if (!inline && (match || codeString.includes('\n'))) {
                return (
                  <CodeBlock
                    language={language}
                    codeString={codeString}
                    onTryCode={onTryCode}
                  />
                );
              }

              return (
                <code 
                  className="px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-yellow font-mono text-[11px] border border-monokai-border/60" 
                  {...props}
                >
                  {children}
                </code>
              );
            },
            // 超链接
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-monokai-cyan hover:underline inline-flex items-center gap-0.5"
              >
                <span>{children}</span>
                <ExternalLink className="w-2.5 h-2.5 ml-0.5 inline opacity-70" />
              </a>
            ),
            // 分割线
            hr: () => <hr className="border-monokai-border/60 my-6" />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

    </div>
  );
};

export default AcademyMarkdownReader;
