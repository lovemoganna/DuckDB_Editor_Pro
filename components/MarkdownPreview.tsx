import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Info, 
  Lightbulb, 
  AlertTriangle, 
  AlertOctagon, 
  Bookmark, 
  ChevronRight, 
  ExternalLink 
} from 'lucide-react';
import { CodeHighlightBlock } from './ui/CodeHighlightBlock';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onTryCode?: (code: string) => void;
  onSendToEditor?: (code: string) => void;
  collapseAll?: boolean;
}

const getHeadingId = (children: React.ReactNode): string => {
  const text = React.Children.toArray(children)
    .map((c) => (typeof c === 'string' ? c : ''))
    .join('')
    .trim();
  return (
    text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
};

// 提取并解析 GitHub Alert 语法，如 > [!NOTE] 提示内容
const parseAlertContent = (children: React.ReactNode): { type: string; content: React.ReactNode } | null => {
  if (!children) return null;

  // 过滤纯空白字符节点
  const childArray = React.Children.toArray(children).filter(
    (c) => !(typeof c === 'string' && c.trim() === '')
  );
  if (childArray.length === 0) return null;

  const firstChild = childArray[0];
  if (!React.isValidElement(firstChild)) {
    return null;
  }

  const firstProps = firstChild.props as { children?: React.ReactNode } | undefined;
  if (!firstProps?.children) {
    return null;
  }

  const pChildren = React.Children.toArray(firstProps.children);
  if (pChildren.length === 0) return null;

  const firstTextIndex = pChildren.findIndex(
    (c) => typeof c === 'string' && c.trim().length > 0
  );
  if (firstTextIndex === -1) return null;

  const firstText = pChildren[firstTextIndex] as string;
  const lines = firstText.split(/\r?\n/);
  const firstLine = lines[0];
  const alertHeaderMatch = firstLine.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i);
  if (!alertHeaderMatch) return null;

  const alertType = alertHeaderMatch[1].toUpperCase();
  const inlineTitle = alertHeaderMatch[2].trim();
  const restLines = lines.slice(1).join('\n').trim();

  const remainingP: React.ReactNode[] = [];
  if (inlineTitle && !restLines) {
    remainingP.push(inlineTitle);
  } else {
    if (inlineTitle) {
      remainingP.push(<strong key="inline-title" className="font-semibold block mb-0.5">{inlineTitle}</strong>);
    }
    if (restLines) {
      remainingP.push(restLines);
    }
  }

  for (let i = firstTextIndex + 1; i < pChildren.length; i++) {
    remainingP.push(pChildren[i]);
  }

  const restBlocks = childArray.slice(1);

  return {
    type: alertType,
    content: (
      <div className="space-y-1">
        {remainingP.length > 0 && <p className="leading-relaxed my-0.5">{remainingP}</p>}
        {restBlocks}
      </div>
    ),
  };
};

const getAlertConfig = (type: string) => {
  switch (type) {
    case 'NOTE':
      return {
        label: '说明 (Note)',
        icon: <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
        borderCls: 'border-l-2 border-sky-500 bg-sky-950/20 text-sky-200',
        badgeCls: 'text-sky-400 font-semibold',
      };
    case 'TIP':
      return {
        label: '技巧提示 (Tip)',
        icon: <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        borderCls: 'border-l-2 border-[#a3e635] bg-[#162218]/50 text-emerald-200',
        badgeCls: 'text-[#a3e635] font-semibold',
      };
    case 'IMPORTANT':
      return {
        label: '核心要点 (Important)',
        icon: <Bookmark className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
        borderCls: 'border-l-2 border-purple-500 bg-purple-950/25 text-purple-200',
        badgeCls: 'text-purple-400 font-semibold',
      };
    case 'WARNING':
      return {
        label: '注意事项 (Warning)',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        borderCls: 'border-l-2 border-amber-500 bg-amber-950/25 text-amber-200',
        badgeCls: 'text-amber-400 font-semibold',
      };
    case 'CAUTION':
      return {
        label: '风险警示 (Caution)',
        icon: <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />,
        borderCls: 'border-l-2 border-red-500 bg-red-950/30 text-red-200',
        badgeCls: 'text-red-400 font-semibold',
      };
    default:
      return {
        label: '提示',
        icon: <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
        borderCls: 'border-l-2 border-zinc-500 bg-[#161d17] text-zinc-300',
        badgeCls: 'text-zinc-400 font-semibold',
      };
  }
};

const REMARK_PLUGINS = [remarkGfm];

const MarkdownPreviewInner: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  onTryCode,
  onSendToEditor,
  collapseAll,
}) => {
  // 用 ref 稳定回调，避免父组件重渲染（如 schema-changed → tables 刷新）
  // 重建 components 映射：ReactMarkdown 会把新的 code 函数当成新组件类型卸载，
  // 导致就地执行结果状态全部丢失。
  const onTryCodeRef = React.useRef(onTryCode);
  const onSendToEditorRef = React.useRef(onSendToEditor);
  React.useEffect(() => {
    onTryCodeRef.current = onTryCode;
  }, [onTryCode]);
  React.useEffect(() => {
    onSendToEditorRef.current = onSendToEditor;
  }, [onSendToEditor]);

  const markdownComponents = React.useMemo(
    () => ({
      // 标题体系：紧凑专注，层次分明，带 TOC 锚点 ID
      h1: ({ children }: any) => (
        <h1
          id={getHeadingId(children)}
          className="text-base font-bold text-zinc-100 tracking-tight pt-3 pb-1.5 mb-2 border-b border-[#22331c] flex items-center gap-2 scroll-mt-14"
        >
          <span className="w-1.5 h-4 rounded-full bg-[#a3e635] inline-block shrink-0" />
          <span>{children}</span>
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2
          id={getHeadingId(children)}
          className="text-sm font-semibold text-[#a3e635] tracking-tight pt-3 pb-1 mb-1.5 flex items-center gap-1.5 scroll-mt-14"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#a3e635] shrink-0" />
          <span>{children}</span>
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3
          id={getHeadingId(children)}
          className="text-xs font-semibold text-zinc-100 pt-2 pb-0.5 mb-1 flex items-center gap-1 scroll-mt-14"
        >
          <span className="w-1 h-1 rounded-full bg-zinc-400 inline-block shrink-0" />
          <span>{children}</span>
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4
          id={getHeadingId(children)}
          className="text-[11.5px] font-semibold text-zinc-400 pt-1.5 pb-0.5 mb-1 scroll-mt-14"
        >
          {children}
        </h4>
      ),

      // 段落
      p: ({ children }: any) => (
        <p className="text-[12.5px] text-zinc-300 leading-[1.65] my-2">
          {children}
        </p>
      ),

      // 列表：纵向紧凑，对齐统一
      ul: ({ children }: any) => (
        <ul className="text-[12.5px] text-zinc-300 space-y-1 my-2 list-disc pl-5 leading-[1.65]">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="text-[12.5px] text-zinc-300 space-y-1 my-2 list-decimal pl-5 leading-[1.65]">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="leading-[1.65] pl-0.5 text-zinc-300">
          {children}
        </li>
      ),

      // 引用块与 GitHub Alerts 样式增强
      blockquote: ({ children }: any) => {
        const alert = parseAlertContent(children);
        if (alert) {
          const cfg = getAlertConfig(alert.type);
          return (
            <div
              className={`rounded-r-lg px-3.5 py-2.5 my-2.5 text-xs shadow-xs ${cfg.borderCls}`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                {cfg.icon}
                <span className={cfg.badgeCls}>{cfg.label}</span>
              </div>
              <div className="text-[12px] opacity-90 leading-relaxed">
                {alert.content}
              </div>
            </div>
          );
        }

        return (
          <blockquote className="border-l-2 border-[#a3e635] bg-[#141a15]/80 px-3.5 py-2 rounded-r-lg text-xs text-zinc-300 my-2.5 leading-relaxed shadow-2xs">
            {children}
          </blockquote>
        );
      },

      // 表格：紧凑圆角、自适应横向滚动、交替行底色
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-3 rounded-lg border border-[#22331c] bg-[#111613] shadow-xs">
          <table className="w-full text-xs text-left border-collapse">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-[#161d17] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#22331c]">
          {children}
        </thead>
      ),
      tbody: ({ children }: any) => (
        <tbody className="divide-y divide-[#22331c]/50">
          {children}
        </tbody>
      ),
      tr: ({ children }: any) => (
        <tr className="hover:bg-[#161d17]/60 transition-colors">
          {children}
        </tr>
      ),
      th: ({ children }: any) => (
        <th className="px-3 py-2 text-zinc-200 font-semibold border-r border-[#22331c]/40 last:border-r-0">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-3 py-1.5 text-zinc-300 border-r border-[#22331c]/30 last:border-r-0">
          {children}
        </td>
      ),

      // 行内代码与多行语法高亮代码块 (默认折叠，支持一键全部折叠/展开)
      code: ({ inline, className: codeCls, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(codeCls || '');
        const language = match ? match[1] : '';
        const codeString = String(children).replace(/\n$/, '');

        // 判断是否为独立代码块
        if (!inline && (match || codeString.includes('\n'))) {
          return (
            <CodeHighlightBlock
              code={codeString}
              language={language || 'sql'}
              onTryCode={(sql) => onTryCodeRef.current?.(sql)}
              onSendToEditor={(sql) => {
                const send = onSendToEditorRef.current || onTryCodeRef.current;
                send?.(sql);
              }}
              allowFormat={true}
              collapseAll={collapseAll}
              initialCollapsed={true}
              className="my-2.5"
            />
          );
        }

        return (
          <code
            className="px-1.5 py-0.5 rounded bg-[#161d17] text-[#bef264] font-mono text-[11px] border border-[#22331c]"
            {...props}
          >
            {children}
          </code>
        );
      },

      // 链接：强调色、微交互与外链图标
      a: ({ href, children }: any) => {
        const isExternal = href?.startsWith('http') || href?.startsWith('//');
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
            className="text-[#a3e635] hover:text-[#bef264] hover:underline inline-flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <span>{children}</span>
            {isExternal && <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0" />}
          </a>
        );
      },

      // 分割线
      hr: () => <hr className="border-[#22331c] my-4" />,

      // 图片
      img: ({ src, alt }: any) => (
        <span className="block my-3 text-center">
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full h-auto rounded-lg border border-[#22331c] inline-block shadow-sm"
          />
          {alt && (
            <span className="block text-[11px] text-zinc-500 mt-1.5 font-normal">
              {alt}
            </span>
          )}
        </span>
      ),
    }),
    // collapseAll 变化时允许重建（用户主动折叠）；回调经 ref 读取，避免 schema 刷新卸载结果
    [collapseAll]
  );

  return (
    <div className={`max-w-none text-[12.5px] leading-[1.65] text-zinc-300 select-text ${className}`}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownPreview = React.memo(MarkdownPreviewInner);

export default MarkdownPreview;
