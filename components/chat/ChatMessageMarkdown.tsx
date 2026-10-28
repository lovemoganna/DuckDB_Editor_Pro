import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ExternalLink,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  Bookmark,
} from 'lucide-react';
import { CodeHighlightBlock } from '../ui/CodeHighlightBlock';

export interface ChatMessageMarkdownProps {
  content: string;
  onRunSql?: (sql: string) => void;
  onCopySql?: (sql: string) => void;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm];

// 提取并解析 GitHub Alert 语法，如 > [!NOTE] 提示内容
const parseAlertContent = (children: React.ReactNode): { type: string; content: React.ReactNode } | null => {
  if (!children) return null;

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
      remainingP.push(<strong key="inline-title" className="font-semibold block mb-0.5 text-monokai-fg">{inlineTitle}</strong>);
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
        label: '说明',
        icon: <Info className="w-3.5 h-3.5 text-monokai-cyan shrink-0" />,
        borderCls: 'border-l-2 border-monokai-cyan bg-monokai-cyan/10 text-monokai-fg',
        badgeCls: 'text-monokai-cyan font-semibold',
      };
    case 'TIP':
      return {
        label: '技巧提示',
        icon: <Lightbulb className="w-3.5 h-3.5 text-monokai-accent shrink-0" />,
        borderCls: 'border-l-2 border-monokai-accent bg-monokai-accent/10 text-monokai-fg',
        badgeCls: 'text-monokai-accent font-semibold',
      };
    case 'IMPORTANT':
      return {
        label: '核心要点',
        icon: <Bookmark className="w-3.5 h-3.5 text-monokai-purple shrink-0" />,
        borderCls: 'border-l-2 border-monokai-purple bg-monokai-purple/10 text-monokai-fg',
        badgeCls: 'text-monokai-purple font-semibold',
      };
    case 'WARNING':
      return {
        label: '注意事项',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-monokai-yellow shrink-0" />,
        borderCls: 'border-l-2 border-monokai-yellow bg-monokai-yellow/10 text-monokai-fg',
        badgeCls: 'text-monokai-yellow font-semibold',
      };
    case 'CAUTION':
      return {
        label: '风险警示',
        icon: <AlertOctagon className="w-3.5 h-3.5 text-monokai-pink shrink-0" />,
        borderCls: 'border-l-2 border-monokai-pink bg-monokai-pink/10 text-monokai-fg',
        badgeCls: 'text-monokai-pink font-semibold',
      };
    default:
      return {
        label: '提示',
        icon: <Info className="w-3.5 h-3.5 text-monokai-comment shrink-0" />,
        borderCls: 'border-l-2 border-monokai-comment bg-monokai-surface/60 text-monokai-fg',
        badgeCls: 'text-monokai-comment font-semibold',
      };
  }
};

interface CodeBlockItemProps {
  code: string;
  language: string;
  onRunSql?: (sql: string) => void;
  onCopySql?: (sql: string) => void;
}

const resolveLanguage = (language: string, code: string): string => {
  const lang = (language || '').toLowerCase().trim();
  if (lang === 'duckdb' || lang === 'postgresql' || lang === 'postgres') return 'sql';
  if (lang) return lang;
  if (/^\s*(SELECT|WITH|INSERT|CREATE|UPDATE|DELETE|DESCRIBE|EXPLAIN|SUMMARIZE|SHOW)\b/i.test(code)) {
    return 'sql';
  }
  return 'text';
};

const CodeBlockItem: React.FC<CodeBlockItemProps> = ({ code, language, onRunSql, onCopySql }) => {
  const resolvedLang = resolveLanguage(language, code);
  const isSql = resolvedLang === 'sql';

  return (
    <CodeHighlightBlock
      code={code}
      language={resolvedLang}
      title={isSql ? 'DuckDB SQL' : undefined}
      maxHeight="240px"
      initialCollapsed={false}
      allowFormat={isSql}
      enableExecute={false}
      showLineNumbers={false}
      className="my-2.5"
      onCopy={onCopySql ? () => onCopySql(code) : undefined}
      onSendToEditor={isSql && onRunSql ? onRunSql : undefined}
    />
  );
};

export const ChatMessageMarkdown: React.FC<ChatMessageMarkdownProps> = ({
  content,
  onRunSql,
  onCopySql,
  className = '',
}) => {
  const onRunSqlRef = React.useRef(onRunSql);
  const onCopySqlRef = React.useRef(onCopySql);

  React.useEffect(() => {
    onRunSqlRef.current = onRunSql;
  }, [onRunSql]);

  React.useEffect(() => {
    onCopySqlRef.current = onCopySql;
  }, [onCopySql]);

  const components = useMemo(
    () => ({
      h1: ({ children }: any) => (
        <h1 className="text-sm font-bold text-monokai-fg mt-3 mb-1.5 pb-1 border-b border-monokai-border flex items-center gap-1.5 first:mt-0 tracking-tight">
          <span className="w-1.5 h-3.5 rounded-full bg-monokai-cyan inline-block shrink-0" />
          <span>{children}</span>
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-[13px] font-bold text-monokai-cyan mt-2.5 mb-1 flex items-center gap-1.5 first:mt-0 tracking-tight">
          <span className="w-1 h-3 rounded-full bg-monokai-cyan/70 inline-block shrink-0" />
          <span>{children}</span>
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-xs font-semibold text-monokai-fg mt-2 mb-1 flex items-center gap-1 first:mt-0">
          <span className="w-1 h-1 rounded-full bg-monokai-comment inline-block shrink-0" />
          <span>{children}</span>
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="text-xs font-medium text-monokai-comment mt-1.5 mb-0.5 first:mt-0">
          {children}
        </h4>
      ),
      p: ({ children }: any) => (
        <p className="text-xs leading-relaxed text-monokai-fg my-1.5 last:mb-0 first:mt-0 break-words">
          {children}
        </p>
      ),
      ul: ({ children }: any) => (
        <ul className="text-xs text-monokai-fg space-y-1 my-1.5 list-disc pl-4 leading-relaxed">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="text-xs text-monokai-fg space-y-1 my-1.5 list-decimal pl-4 leading-relaxed">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="leading-relaxed break-words text-monokai-fg pl-0.5">
          {children}
        </li>
      ),
      blockquote: ({ children }: any) => {
        const alert = parseAlertContent(children);
        if (alert) {
          const cfg = getAlertConfig(alert.type);
          return (
            <div className={`rounded-r-lg px-3 py-2 my-2 text-xs shadow-xs ${cfg.borderCls}`}>
              <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                {cfg.icon}
                <span className={cfg.badgeCls}>{cfg.label}</span>
              </div>
              <div className="text-xs leading-relaxed opacity-95">{alert.content}</div>
            </div>
          );
        }

        return (
          <blockquote className="border-l-2 border-monokai-purple bg-monokai-purple/10 px-3 py-1.5 rounded-r my-2 text-xs text-monokai-fg leading-relaxed shadow-2xs">
            {children}
          </blockquote>
        );
      },
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-2.5 rounded-lg border border-monokai-border bg-monokai-surface shadow-xs custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse min-w-[280px]">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-monokai-bg/70 text-[11px] font-semibold text-monokai-comment border-b border-monokai-border">
          {children}
        </thead>
      ),
      tbody: ({ children }: any) => (
        <tbody className="divide-y divide-monokai-border/40 text-monokai-fg">
          {children}
        </tbody>
      ),
      tr: ({ children }: any) => (
        <tr className="hover:bg-monokai-elevated/40 transition-colors">
          {children}
        </tr>
      ),
      th: ({ children }: any) => (
        <th className="px-3 py-1.5 text-monokai-fg font-semibold border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-3 py-1.5 text-monokai-fg border-r border-monokai-border/40 last:border-r-0 whitespace-nowrap">
          {children}
        </td>
      ),
      code: ({ inline, className: codeCls, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(codeCls || '');
        const lang = match ? match[1].toLowerCase() : '';
        const rawCode = String(children).replace(/\n$/, '');

        if (!inline && (match || rawCode.includes('\n'))) {
          return (
            <CodeBlockItem
              code={rawCode}
              language={lang}
              onRunSql={onRunSqlRef.current}
              onCopySql={onCopySqlRef.current}
            />
          );
        }

        return (
          <code
            className="px-1.5 py-0.5 rounded bg-monokai-surface text-monokai-cyan font-mono text-[11px] border border-monokai-border break-all inline-block align-baseline"
            {...props}
          >
            {children}
          </code>
        );
      },
      strong: ({ children }: any) => (
        <strong className="font-semibold text-monokai-fg">{children}</strong>
      ),
      em: ({ children }: any) => (
        <em className="italic text-monokai-comment">{children}</em>
      ),
      a: ({ href, children }: any) => {
        const isExternal = href?.startsWith('http') || href?.startsWith('//');
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
            className="text-monokai-cyan hover:underline underline-offset-2 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
          >
            <span>{children}</span>
            {isExternal && <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0" />}
          </a>
        );
      },
      hr: () => <hr className="border-monokai-border my-3" />,
    }),
    []
  );

  return (
    <div className={`text-xs leading-relaxed text-monokai-fg select-text ${className}`}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMessageMarkdown;
