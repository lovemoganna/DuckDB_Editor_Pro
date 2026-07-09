import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { monokai } from '@uiw/codemirror-theme-monokai';
import mermaid from 'mermaid';
import { debounce } from 'lodash';
import { duckDBService } from '../../services/duckdbService';
import { ResultTable } from './ResultTable';
import { NotesSidebar } from './NotesSidebar';
import { FavoritesSidebar } from './FavoritesSidebar';
import { CodeSnippetsSidebar } from './CodeSnippetsSidebar';
import { DataManagementSidebar } from './DataManagementSidebar';
import { saveNote, Note } from '../../services/learnNotesStorage';
import { addFavorite, removeFavoriteByTutorialId, isFavorite } from '../../services/favoritesStorage';
import { saveSnippet, isSnippetExists, CodeSnippet, generateSnippetId } from '../../services/codeSnippetsStorage';
import { Copy, Check, StickyNote, Code, Heart, HeartHandshake, Database, Play, X, Trash2, FileText, Library, Clock, BarChart2, Download, Upload, AlertTriangle, ChevronRight } from 'lucide-react';

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

// Mermaid 组件
const Mermaid = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, chart);
        setSvg(svg);
        setError(false);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(true);
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) return <div className="text-red-500 text-sm p-2 border border-red-500/50 rounded bg-red-500/10">Failed to render diagram</div>;

  return (
    <div className="mermaid-wrapper my-6 flex justify-center bg-[#282a36] p-4 rounded-lg overflow-x-auto border border-monokai-accent/30" dangerouslySetInnerHTML={{ __html: svg }} />
  );
};

export interface TocItem {
  id: string;
  title: string;
  level: number;
  children?: TocItem[];
}

// 将扁平 TOC 转换为树形结构
export const buildTocTree = (toc: TocItem[]): TocItem[] => {
  const root: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const item of toc) {
    const node: TocItem = { ...item, children: [] };

    if (stack.length === 0) {
      root.push(node);
    } else {
      const last = stack[stack.length - 1];
      if (item.level > last.level) {
        // 子章节
        if (!last.children) last.children = [];
        last.children.push(node);
      } else {
        // 找到合适的父节点
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
          stack.pop();
        }
        if (stack.length === 0) {
          root.push(node);
        } else {
          const parent = stack[stack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      }
    }
    stack.push(node);
  }

  return root;
};

interface MarkdownViewerProps {
  content: string;
  onTryCode?: (code: string) => void;
  onOpenTable?: (tableName: string) => void;
  tutorialId?: string;
  tutorialTitle?: string;
  showToc?: boolean; // 控制目录显示
}

// 统一的 ID 生成逻辑
const generateId = (text: string, level: number = 0): string => {
  const sanitized = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '');
  return (sanitized || 'heading') + (level > 0 ? `-h${level}` : '');
};

// 从React children中提取纯文本
const extractTextFromChildren = (children: React.ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return extractTextFromChildren(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (React.isValidElement(children) && (children.props as any)?.children) {
    return extractTextFromChildren((children.props as any).children);
  }
  return '';
};

// 从 markdown 内容中提取目录
export const extractToc = (markdown: string): TocItem[] => {
  const cleanMarkdown = markdown
    .replace(/```[\s\S]*?```/g, match => '\n'.repeat(match.split('\n').length - 1))
    .replace(/<!--[\s\S]*?-->/g, match => '\n'.repeat(match.split('\n').length - 1));

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(cleanMarkdown)) !== null) {
    const level = match[1].length;
    const rawTitle = match[2].trim();

    // 提取标题中的编号前缀，用于显示（加空格美化）
    let displayTitle = rawTitle;
    const numberPrefixMatch = rawTitle.match(/^(\d+(\.\d+)*)\s*[.、]\s*/);
    if (numberPrefixMatch) {
      const prefix = numberPrefixMatch[1];
      const restTitle = rawTitle.slice(numberPrefixMatch[0].length);
      displayTitle = `${prefix}. ${restTitle}`;
    }

    const line = cleanMarkdown.substring(0, match.index).split('\n').length;
    // 使用原始标题生成ID，保证与实际渲染的标题ID一致
    const id = `${generateId(rawTitle, level)}-L${line}`;
    toc.push({ id, title: displayTitle, level });
  }

  return toc;
};

// Copy Button Component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-xs transition-colors cursor-pointer flex items-center gap-1 ${copied ? 'text-monokai-green' : 'text-monokai-comment hover:text-white'
        }`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" /> Copied!
        </>
      ) : (
        'Copy'
      )}
    </button>
  );
};

interface ExecutionResult {
  data: any[] | null;
  error: string | null;
  loading: boolean;
  timestamp: number;
  executionTime?: number;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, onTryCode, onOpenTable, tutorialId, tutorialTitle, showToc = true }) => {
  const [activeAnchor, setActiveAnchor] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 预处理内容：处理可能与 Markdown 语法冲突的字符
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    console.log('=== MarkdownViewer 原始 content ===', JSON.stringify(content));

    // 使用特殊标记符号（SOH字符，不会出现在正常文本中）
    const SUB_START = '\x01SUB_START\x01';
    const SUB_END = '\x01SUB_END\x01';
    const SUP_START = '\x01SUP_START\x01';
    const SUP_END = '\x01SUP_END\x01';

    // 分割内容为代码块和非代码块部分，分别处理
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    // 检查原始内容是否包含 SUB_START 或 SUBEND（调试用）
    if (content.includes('SUB_START') || content.includes('SUBEND')) {
      console.log('=== 原始内容包含占位符 ===', JSON.stringify(content));
    }

    const result = parts.map((part, index) => {
      // 偶数索引是非代码块内容，奇数索引是代码块内容 (由于使用了捕获组)
      if (index % 2 === 0) {
        // 非代码块部分：
        // 1. 先将sub/sup标签转为特殊标记
        // 2. 转义下划线（避免被Markdown解析为斜体）
        return part
          .replace(/<sub>/gi, SUB_START)
          .replace(/<\/sub>/gi, SUB_END)
          .replace(/<sup>/gi, SUP_START)
          .replace(/<\/sup>/gi, SUP_END)
          .replace(/_/g, '\\_');
      }
      // 代码块部分原样返回
      return part;
    }).join('');
    
    // 检查处理后的内容
    if (result.includes('\x01SUB') || result.includes('\\_')) {
      console.log('=== 处理后内容 ===', JSON.stringify(result));
    }

    return result;
  }, [content]);

  // 笔记相关状态
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [notePopupPos, setNotePopupPos] = useState({ x: 0, y: 0 });
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // 收藏相关状态
  const [showFavoritesSidebar, setShowFavoritesSidebar] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // 代码片段收藏相关状态
  const [showCodeSnippetsSidebar, setShowCodeSnippetsSidebar] = useState(false);
  const [snippetToSave, setSnippetToSave] = useState<{ code: string; codeId: string } | null>(null);
  const [snippetDescription, setSnippetDescription] = useState('');
  const [snippetTags, setSnippetTags] = useState('');
  const [isSavingSnippet, setIsSavingSnippet] = useState(false);
  const [savedSnippets, setSavedSnippets] = useState<Set<string>>(new Set());
  const [snippetPopupPos, setSnippetPopupPos] = useState({ x: 0, y: 0 });

  // 数据管理侧边栏状态
  const [showDataManagementSidebar, setShowDataManagementSidebar] = useState(false);

  // 检查代码是否已收藏
  const checkSnippetSaved = useCallback(async (code: string) => {
    const saved = await isSnippetExists(code);
    return saved;
  }, []);

  // 检查并初始化收藏状态
  useEffect(() => {
    const checkFavorite = async () => {
      if (tutorialId) {
        const favorited = await isFavorite(tutorialId);
        setIsFavorited(favorited);
      }
    };
    checkFavorite();
  }, [tutorialId]);

  // 切换收藏状态
  const handleToggleFavorite = async () => {
    if (!tutorialId || !tutorialTitle) return;

    try {
      if (isFavorited) {
        await removeFavoriteByTutorialId(tutorialId);
        setIsFavorited(false);
      } else {
        await addFavorite({
          id: `fav-${Date.now()}`,
          tutorialId,
          tutorialTitle,
          addedAt: new Date().toISOString()
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('操作收藏失败:', error);
    }
  };

  // 监听文本选择
  useEffect(() => {
    const handleTextSelect = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        setSelectedText(text);
        // 获取选区位置
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setNotePopupPos({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
        }
        setShowNotePopup(true);
      } else {
        // 延迟隐藏，让点击事件先触发
        setTimeout(() => setShowNotePopup(false), 200);
      }
    };

    document.addEventListener('mouseup', handleTextSelect);
    return () => document.removeEventListener('mouseup', handleTextSelect);
  }, []);

  // 保存笔记
  const handleSaveNote = async () => {
    if (!noteContent.trim() || !tutorialId) return;

    setIsSavingNote(true);
    try {
      const note: Note = {
        id: `note-${Date.now()}`,
        tutorialId,
        tutorialTitle: tutorialTitle || '未知教程',
        selectedText,
        noteContent: noteContent.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveNote(note);
      setNoteContent('');
      setShowNotePopup(false);
      setShowNotesSidebar(true);
    } catch (error) {
      console.error('保存笔记失败:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  // 打开代码片段收藏弹窗
  const handleOpenSnippetSave = async (code: string, codeId: string, event: React.MouseEvent) => {
    // 检查是否已收藏
    const existing = await isSnippetExists(code);
    if (existing) {
      // 如果已收藏，打开侧边栏展示
      setShowCodeSnippetsSidebar(true);
      return;
    }
    // 获取点击位置
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setSnippetPopupPos({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setSnippetToSave({ code, codeId });
    setSnippetDescription('');
    setSnippetTags('');
  };

  // 保存代码片段
  const handleSaveSnippet = async () => {
    if (!snippetToSave || !tutorialId) return;

    setIsSavingSnippet(true);
    try {
      const snippet: CodeSnippet = {
        id: generateSnippetId(),
        code: snippetToSave.code,
        description: snippetDescription.trim(),
        tutorialId,
        tutorialTitle: tutorialTitle || '未知教程',
        tags: snippetTags.split(',').map(t => t.trim()).filter(t => t),
        createdAt: new Date().toISOString()
      };
      await saveSnippet(snippet);
      setSavedSnippets(prev => new Set(prev).add(snippetToSave.codeId));
      setSnippetToSave(null);
      setShowCodeSnippetsSidebar(true);
    } catch (error) {
      console.error('保存代码片段失败:', error);
    } finally {
      setIsSavingSnippet(false);
    }
  };

  // 关闭代码片段弹窗
  const handleCloseSnippetPopup = () => {
    setSnippetToSave(null);
    setSnippetDescription('');
    setSnippetTags('');
  };

  // 初始化已保存的代码片段（当教程内容变化时）
  useEffect(() => {
    const initSavedSnippets = async () => {
      const codes = extractAllSqlCodes(content);
      const saved = new Set<string>();
      for (const codeObj of codes) {
        const existing = await isSnippetExists(codeObj.code);
        if (existing) {
          // 使用代码的 hash 作为 ID
          const codeHash = Math.abs(codeObj.code.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)).toString(36);
          saved.add(codeHash);
        }
      }
      setSavedSnippets(saved);
    };
    if (content) {
      initSavedSnippets();
    }
  }, [content]);

  // 字体大小状态
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('duckdb_learn_fontsize');
    return saved ? parseInt(saved, 10) : 14;
  });

  // 字体大小变化处理
  const handleFontSizeChange = (newSize: number) => {
    const clampedSize = Math.max(10, Math.min(24, newSize));
    setFontSize(clampedSize);
    localStorage.setItem('duckdb_learn_fontsize', String(clampedSize));
  };

  // 从 markdown 内容中提取所有 SQL 代码块及其 ID
  const extractAllSqlCodes = (markdown: string): { code: string; id: string }[] => {
    const results: { code: string; id: string }[] = [];

    // 生成 codeId 的函数（与渲染时保持一致）
    const generateCodeId = (codeString: string): string => {
      return Math.abs(codeString.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)).toString(36);
    };

    // 先匹配 ```sql 标记的代码块 (支持忽略大小写，支持 \r\n，支持后缀空格)
    const sqlRegex = /```sql[ \t]*\r?\n([\s\S]*?)```/gi;
    let match;
    while ((match = sqlRegex.exec(markdown)) !== null) {
      const code = match[1].trim();
      if (code) {
        results.push({ code, id: generateCodeId(code) });
      }
    }

    // 再匹配没有语言标记的 ``` 代码块 (支持 \r\n，支持后缀空格)
    const plainCodeRegex = /```[ \t]*\r?\n([\s\S]*?)```/g;
    while ((match = plainCodeRegex.exec(markdown)) !== null) {
      const code = match[1].trim();
      // 只有看起来像 SQL 的代码才添加
      if (code && (code.toUpperCase().includes('SELECT') ||
        code.toUpperCase().includes('INSERT') ||
        code.toUpperCase().includes('UPDATE') ||
        code.toUpperCase().includes('DELETE') ||
        code.toUpperCase().includes('CREATE') ||
        code.toUpperCase().includes('DROP') ||
        code.toUpperCase().includes('FROM') ||
        code.toUpperCase().includes('WHERE'))) {
        results.push({ code, id: generateCodeId(code) });
      }
    }

    return results;
  };

  // 复制状态
  const [copiedAll, setCopiedAll] = useState(false);
  const [sqlCodeCount, setSqlCodeCount] = useState(0);
  // 执行全部SQL状态
  const [executingAll, setExecutingAll] = useState(false);
  const [executedCount, setExecutedCount] = useState(0);
  // 清空表状态
  const [clearingTables, setClearingTables] = useState(false);

  // 更新 SQL 代码数量
  useEffect(() => {
    const codes = extractAllSqlCodes(content);
    setSqlCodeCount(codes.length);
  }, [content]);

  // 一键复制所有 SQL 代码
  const handleCopyAllSql = async () => {
    const codes = extractAllSqlCodes(content);
    if (codes.length === 0) {
      alert('当前页面没有 SQL 代码块');
      return;
    }

    const combinedCode = codes.join('\n\n---\n\n');
    await navigator.clipboard.writeText(combinedCode);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // 一键执行所有 SQL 代码 - 在每个代码块位置显示结果
  const handleExecuteAllSql = async () => {
    const codeBlocks = extractAllSqlCodes(content);
    if (codeBlocks.length === 0) {
      alert('当前页面没有 SQL 代码块可执行');
      return;
    }

    setExecutingAll(true);
    setExecutedCount(0);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < codeBlocks.length; i++) {
      const { code, id } = codeBlocks[i];

      // 设置该代码块为加载状态
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: null, error: null, loading: true, timestamp: Date.now() }
      }));

      const startTime = performance.now();
      try {
        const res = await duckDBService.query(code);
        const endTime = performance.now();
        successCount++;

        // 设置执行结果（会显示在代码块下方）
        setExecutionResults(prev => ({
          ...prev,
          [id]: { data: res, error: null, loading: false, timestamp: Date.now(), executionTime: endTime - startTime }
        }));

        // 滚动到该代码块位置显示结果
        const element = document.getElementById(`result-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 等待一小段时间让用户看到结果
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e: any) {
        errorCount++;
        setExecutionResults(prev => ({
          ...prev,
          [id]: { data: null, error: e.message, loading: false, timestamp: Date.now() }
        }));

        // 滚动到错误位置
        const element = document.getElementById(`result-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setExecutedCount(i + 1);
    }

    // 执行完成
    setExecutingAll(false);
    alert(`执行完成！成功: ${successCount}, 失败: ${errorCount}`);
  };

  // 清空所有数据表
  const handleClearAllTables = async () => {
    if (!confirm('确定要清空所有数据表吗？此操作不可恢复！')) {
      return;
    }

    setClearingTables(true);
    try {
      // 查询所有表
      const tables = await duckDBService.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'");

      if (tables && tables.length > 0) {
        // 逐个删除表
        for (const row of tables) {
          const tableName = row.table_name;
          try {
            await duckDBService.query(`DROP TABLE IF EXISTS "${tableName}"`);
            console.log('[ClearTables] Dropped table:', tableName);
          } catch (e) {
            console.warn('[ClearTables] Failed to drop table:', tableName, e);
          }
        }
        alert(`已清空 ${tables.length} 个数据表`);
      } else {
        alert('当前没有数据表');
      }
    } catch (e) {
      console.error('[ClearTables] Error:', e);
      alert('清空表失败: ' + (e as Error).message);
    }
    setClearingTables(false);
  };

  const toc = useMemo(() => extractToc(content), [content]);
  const tocTree = useMemo(() => buildTocTree(toc), [toc]);

  // 初始化展开所有一级章节
  useEffect(() => {
    const initialExpanded = new Set<string>();
    tocTree.forEach(item => {
      initialExpanded.add(item.id);
      // 默认展开所有有子章节的
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => initialExpanded.add(child.id));
      }
    });
    setExpandedItems(initialExpanded);
  }, [tocTree]);

  // 切换展开/折叠状态
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Execution state map: codeHash -> Result
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  const handleExecute = async (code: string, id: string) => {
    setExecutionResults(prev => ({
      ...prev,
      [id]: { data: null, error: null, loading: true, timestamp: Date.now() }
    }));

    const startTime = performance.now();
    try {
      // Simple client-side execution
      const res = await duckDBService.query(code);
      const endTime = performance.now();
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: res, error: null, loading: false, timestamp: Date.now(), executionTime: endTime - startTime }
      }));
    } catch (e: any) {
      setExecutionResults(prev => ({
        ...prev,
        [id]: { data: null, error: e.message, loading: false, timestamp: Date.now() }
      }));
    }
  };

  // 使用 IntersectionObserver 优化滚动高亮
  useEffect(() => {
    // 清理旧的 observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const contentArea = document.querySelector('.markdown-content-area');
    if (!contentArea) return;

    // 创建 observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 找出所有可见的标题
        const visibleHeadings = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleHeadings.length > 0) {
          // 选择最靠上的可见标题
          const topHeading = visibleHeadings[0];
          setActiveAnchor(topHeading.target.id);
        }
      },
      {
        root: contentArea,
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    // 观察所有标题元素
    const headings = contentArea.querySelectorAll('h1[id], h2[id], h3[id]');
    headings.forEach(heading => {
      observerRef.current?.observe(heading);
    });

    // 监听滚动显示/隐藏回到顶部按钮
    const handleScroll = debounce(() => {
      if (contentArea) {
        setShowBackToTop(contentArea.scrollTop > 400);
      }
    }, 100);

    contentArea.addEventListener('scroll', handleScroll);

    return () => {
      observerRef.current?.disconnect();
      contentArea.removeEventListener('scroll', handleScroll);
      handleScroll.cancel();
    };
  }, [content]);

  // 展开指定ID及其所有子节点的展开状态
  const expandToNode = (id: string) => {
    // 找到该节点
    const findAndExpand = (items: TocItem[], targetId: string): boolean => {
      for (const item of items) {
        if (item.id === targetId) {
          // 展开当前节点
          setExpandedItems(prev => new Set(prev).add(targetId));
          // 递归展开所有子节点
          if (item.children) {
            const expandChildren = (children: TocItem[]) => {
              children.forEach(child => {
                setExpandedItems(prev => new Set(prev).add(child.id));
                if (child.children) {
                  expandChildren(child.children);
                }
              });
            };
            expandChildren(item.children);
          }
          return true;
        }
        if (item.children) {
          if (findAndExpand(item.children, targetId)) {
            return true;
          }
        }
      }
      return false;
    };
    findAndExpand(tocTree, id);
  };

  const scrollToAnchor = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without jumping
      window.history.pushState(null, '', `#${id}`);
      // 展开该节点及其所有子节点
      expandToNode(id);
    }
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('table://')) {
      e.preventDefault();
      const tableName = href.replace('table://', '');
      onOpenTable?.(tableName);
    }
  };

  // 当前章节索引（用于上下章导航）
  const currentTocIndex = useMemo(() => {
    if (!activeAnchor) return -1;
    return toc.findIndex(item => item.id === activeAnchor);
  }, [activeAnchor, toc]);

  // 上一章和下一章
  const prevChapter = useMemo(() => {
    if (currentTocIndex <= 0) return null;
    return toc[currentTocIndex - 1];
  }, [currentTocIndex, toc]);

  const nextChapter = useMemo(() => {
    if (currentTocIndex < 0 || currentTocIndex >= toc.length - 1) return null;
    return toc[currentTocIndex + 1];
  }, [currentTocIndex, toc]);

  // 滚动到上一章
  const scrollToPrevChapter = () => {
    if (prevChapter) {
      scrollToAnchor(prevChapter.id);
    }
  };

  // 滚动到下一章
  const scrollToNextChapter = () => {
    if (nextChapter) {
      scrollToAnchor(nextChapter.id);
    }
  };

  // 回到顶部
  const scrollToTop = () => {
    const contentArea = document.querySelector('.markdown-content-area');
    if (contentArea) {
      contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 渲染树形 TOC 项目
  const renderTocItem = (item: TocItem, index: number, isLast: boolean): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeAnchor === item.id;
    const isH1 = item.level === 1;
    const isH2 = item.level === 2;

    return (
      <div key={item.id} className="relative">
        <div className="flex items-center group">
          {/* 活动指示器线 */}
          {isActive && (
            <div className="absolute left-0 w-0.5 h-6 bg-monokai-blue animate-pulse rounded-full z-10" />
          )}

          <button
            onClick={() => scrollToAnchor(item.id)}
            className={`w-full text-left py-1.5 px-3 rounded-md transition-all duration-200 flex items-center gap-2 group/btn ${isActive
              ? 'text-monokai-blue bg-monokai-blue/5 font-semibold'
              : 'text-monokai-fg/70 hover:text-monokai-fg hover:bg-monokai-accent/10'
              } ${isH1 ? 'text-[11px]' : isH2 ? 'ml-3 text-[10px]' : 'ml-6 text-[9px]'}`}
          >
            {/* 展开/折叠按钮 */}
            {hasChildren ? (
              <span
                onClick={(e) => toggleExpand(item.id, e)}
                className={`w-4 h-4 flex items-center justify-center text-monokai-comment group-hover/btn:text-monokai-blue cursor-pointer shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                <div className={`w-1 h-1 rounded-full transition-all duration-300 ${isActive ? 'bg-monokai-blue scale-125' : 'bg-monokai-accent/40 group-hover/btn:bg-monokai-blue/50'}`} />
              </span>
            )}
            <span className="truncate flex-1">{item.title}</span>
          </button>
        </div>

        {/* 递归渲染子章节 */}
        {hasChildren && isExpanded && (
          <div className="relative mt-0.5">
            {/* 连接虚线 */}
            <div className={`absolute left-[21px] top-0 bottom-2 border-l border-dashed transition-colors duration-300 ${isActive ? 'border-monokai-blue/30' : 'border-monokai-accent/20'}`} />
            <div className="space-y-0.5">
              {item.children!.map((child, idx) => renderTocItem(child, idx, idx === item.children!.length - 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full relative group/viewer">
      {/* 主内容区 */}
      <main ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-8 markdown-content-area scroll-smooth h-full custom-scrollbar relative">
        {/* 顶部工具栏 - 放在内容最前面 */}
        <div className="bg-monokai-bg py-2 mb-4 flex items-center justify-between border-b border-monokai-accent/30 rounded-lg px-0 -ml-4">
          {/* 左侧：标题 */}
          <div className="flex items-center -ml-2">
            <span className="text-sm text-monokai-fg font-medium">教程内容</span>
          </div>

          {/* 右侧：操作按钮组 */}
          <div className="flex flex-wrap items-center gap-3 -mr-2">
            {/* 文档配置组 */}
            <div className="flex items-center gap-1.5 bg-[#2a2b36] p-1 rounded-lg border border-monokai-accent/20">
              {/* 字号调节 */}
              <div className="flex justify-center items-center gap-0.5 px-1 py-0.5">
                <button
                  onClick={() => handleFontSizeChange(fontSize - 2)}
                  disabled={fontSize <= 12}
                  className="w-5 h-5 rounded text-[10px] font-bold bg-monokai-accent/30 hover:bg-monokai-accent/50 text-monokai-fg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="减小字号"
                >
                  A-
                </button>
                <span className="text-[10px] text-monokai-fg w-5 text-center leading-none">{fontSize}</span>
                <button
                  onClick={() => handleFontSizeChange(fontSize + 2)}
                  disabled={fontSize >= 24}
                  className="w-5 h-5 rounded text-[10px] font-bold bg-monokai-accent/30 hover:bg-monokai-accent/50 text-monokai-fg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="增大字号"
                >
                  A+
                </button>
                <button
                  onClick={() => handleFontSizeChange(16)}
                  className="ml-1.5 text-[9px] text-monokai-fg/70 hover:text-monokai-blue transition-colors px-1 py-0.5 rounded hover:bg-monokai-accent/30 whitespace-nowrap"
                  title="重置为默认"
                >
                  默认
                </button>
              </div>

              {/* 收藏当前教程 */}
              {tutorialId && (
                <button
                  onClick={handleToggleFavorite}
                  className={`flex justify-center items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${isFavorited
                    ? 'bg-monokai-pink/30 text-monokai-pink'
                    : 'bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink/20'
                    }`}
                  title={isFavorited ? '取消收藏' : '添加收藏'}
                >
                  <Heart className={`w-3 h-3 ${isFavorited ? 'fill-current' : ''}`} />
                  <span className="hidden sm:inline">{isFavorited ? '已收藏' : '收藏'}</span>
                </button>
              )}
            </div>

            {/* SQL 核心操作组 */}
            <div className="flex items-center gap-1 bg-[#2a2b36] p-1 rounded-lg border border-monokai-accent/20">
              {/* 全部执行 SQL */}
              <button
                onClick={handleExecuteAllSql}
                disabled={executingAll}
                className={`flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${executingAll
                  ? 'bg-monokai-purple/30 text-monokai-purple'
                  : 'bg-monokai-green/20 text-monokai-green hover:bg-monokai-green/30'
                  }`}
                title="执行本页所有 SQL 代码"
              >
                {executingAll ? (
                  <span className="w-3 h-3 border-2 border-monokai-purple border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>{executingAll ? `执行中 ${executedCount}/${sqlCodeCount}` : '全部执行'}</span>
              </button>

              {/* 复制全部代码 */}
              <button
                onClick={handleCopyAllSql}
                disabled={copiedAll}
                className={`flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${copiedAll
                  ? 'bg-monokai-green/30 text-monokai-green'
                  : 'bg-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue/30'
                  }`}
                title="复制本页所有 SQL 代码"
              >
                {copiedAll ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedAll ? '已复制' : '复制代码'}</span>
              </button>

              {/* 清空表 */}
              <button
                onClick={handleClearAllTables}
                disabled={clearingTables}
                className={`flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${clearingTables
                  ? 'bg-monokai-pink/30 text-monokai-pink'
                  : 'bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink/20'
                  }`}
                title="清空所有数据表"
              >
                {clearingTables ? (
                  <span className="w-3 h-3 border-2 border-monokai-pink border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                <span>清空表</span>
              </button>
            </div>

            {/* 个人学习辅助组 */}
            <div className="flex items-center gap-1 bg-[#2a2b36] p-1 rounded-lg border border-monokai-accent/20">
              {/* 笔记按钮 */}
              <button
                onClick={() => setShowNotesSidebar(true)}
                className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-monokai-yellow/10 text-monokai-yellow hover:bg-monokai-yellow/20 transition-all whitespace-nowrap"
                title="查看学习笔记"
              >
                <StickyNote className="w-3 h-3" />
                <span>笔记</span>
              </button>

              {/* 代码片段按钮 */}
              <button
                onClick={() => setShowCodeSnippetsSidebar(true)}
                className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-monokai-purple/10 text-monokai-purple hover:bg-monokai-purple/20 transition-all whitespace-nowrap"
                title="我的代码片段"
              >
                <Code className="w-3 h-3" />
                <span>片段</span>
              </button>

              {/* 我的收藏列表按钮 */}
              <button
                onClick={() => setShowFavoritesSidebar(true)}
                className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-monokai-pink/10 text-monokai-pink hover:bg-monokai-pink/20 transition-all whitespace-nowrap"
                title="查看我的收藏"
              >
                <HeartHandshake className="w-3 h-3" />
                <span>收藏</span>
              </button>

              {/* 数据管理按钮 */}
              <button
                onClick={() => setShowDataManagementSidebar(true)}
                className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-monokai-green/10 text-monokai-green hover:bg-monokai-green/20 transition-all whitespace-nowrap"
                title="数据管理"
              >
                <Database className="w-3 h-3" />
                <span>数据</span>
              </button>
            </div>
          </div>
        </div>
        <article className="markdown-body w-full max-w-[1800px] mx-auto pb-20" style={{ fontSize: `${fontSize}px` }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // 处理文本节点：将占位符转换回HTML标签
              text: ({ children }: any) => {
                if (typeof children === 'string') {
                  return (
                    <>
                      {children
                        .split(/(\u0001SUB_START\u0001[\s\S]*?\u0001SUB_END\u0001)/g)
                        .map((part: string, i: number) => {
                          if (part.startsWith('\u0001SUB_START\u0001') && part.endsWith('\u0001SUB_END\u0001')) {
                            const content = part.replace('\u0001SUB_START\u0001', '').replace('\u0001SUB_END\u0001', '');
                            return <sub key={i}>{content}</sub>;
                          }
                          if (part.startsWith('\u0001SUP_START\u0001') && part.endsWith('\u0001SUP_END\u0001')) {
                            const content = part.replace('\u0001SUP_START\u0001', '').replace('\u0001SUP_END\u0001', '');
                            return <sup key={i}>{content}</sup>;
                          }
                          return part;
                        })}
                    </>
                  );
                }
                return children;
              },
              h1: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 1)}${line ? `-L${line}` : ''}`;
                return <h1 id={id} className="text-3xl font-bold text-white mb-6 pb-2 border-b border-monokai-accent/30 mt-8 first:mt-0 group/h1 relative">
                  <span className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/h1:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h1>
              },
              h2: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 2)}${line ? `-L${line}` : ''}`;
                return <h2 id={id} className="text-2xl font-bold text-monokai-fg mb-4 mt-8 group/h2 relative">
                  <span className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover/h2:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-sm" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h2>
              },
              h3: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 3)}${line ? `-L${line}` : ''}`;
                return <h3 id={id} className="text-xl font-bold text-monokai-fg mb-3 mt-6 group/h3 relative">
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/h3:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-xs" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h3>
              },
              h4: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 4)}${line ? `-L${line}` : ''}`;
                return <h4 id={id} className="text-lg font-bold text-monokai-fg mb-2 mt-5 group/h4 relative">
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/h4:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-xs" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h4>
              },
              h5: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 5)}${line ? `-L${line}` : ''}`;
                return <h5 id={id} className="text-base font-bold text-monokai-fg mb-2 mt-4 group/h5 relative">
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/h5:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-xs" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h5>
              },
              h6: ({ children, node }: any) => {
                const line = node?.position?.start?.line;
                const id = `${generateId(extractTextFromChildren(children), 6)}${line ? `-L${line}` : ''}`;
                return <h6 id={id} className="text-sm font-bold text-monokai-fg mb-2 mt-3 group/h6 relative">
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/h6:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-xs" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h6>
              },

              p: ({ children }) => <div className="text-monokai-fg leading-relaxed mb-4">{children}</div>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-monokai-fg ml-4 marker:text-monokai-pink">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-monokai-fg ml-4 marker:text-monokai-purple">{children}</ol>,
              li: ({ children }) => <li className="pl-1 inline-block">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-monokai-yellow pl-4 py-1 my-4 bg-monokai-yellow/10 rounded-r text-monokai-fg italic">{children}</blockquote>,

              code({ node, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : 'text';
                const codeString = extractTextFromChildren(children).replace(/\n$/, '');

                // Check if it's a code block (has language class or contains newline)
                const isBlock = match || codeString.includes('\n');

                // Unique ID for this code block (hash-like)
                const codeId = React.useMemo(() => {
                  return Math.abs(codeString.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)).toString(36);
                }, [codeString]);
                const result = executionResults[codeId];

                if (isBlock && language === 'mermaid') {
                  return <Mermaid chart={codeString} />;
                }

                if (isBlock) {
                  return (
                    <div className="code-block-wrapper my-6 rounded-md overflow-hidden bg-[#272822] border border-monokai-accent/30 shadow-lg relative group">
                      <div className="code-block-header flex justify-between items-center px-4 py-2 bg-[#3e3d32] border-b border-monokai-accent/30">
                        <div className="flex items-center gap-3">
                          <span className="code-lang text-xs text-monokai-blue font-bold uppercase">{language}</span>
                          {/* 执行状态指示器 */}
                          {language === 'sql' && result && (
                            <div className="flex items-center gap-1.5">
                              {result.loading ? (
                                <span className="flex items-center gap-1 text-xs text-monokai-yellow">
                                  <span className="w-2 h-2 bg-monokai-yellow rounded-full animate-pulse" />
                                  执行中...
                                </span>
                              ) : result.error ? (
                                <span className="flex items-center gap-1 text-xs text-monokai-pink">
                                  <span className="w-2 h-2 bg-monokai-pink rounded-full" />
                                  执行失败
                                </span>
                              ) : result.data ? (
                                <span className="flex items-center gap-1 text-xs text-monokai-green">
                                  <span className="w-2 h-2 bg-monokai-green rounded-full" />
                                  执行成功
                                  {result.executionTime && <span className="text-monokai-comment ml-1">({result.executionTime.toFixed(1)}ms)</span>}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 items-center">
                          {language === 'sql' && (
                            <>
                              {/* 运行按钮 - 更醒目的样式 */}
                              <button
                                onClick={() => handleExecute(codeString, codeId)}
                                disabled={result?.loading}
                                className={`text-xs px-3 py-1.5 rounded-md font-medium cursor-pointer flex items-center gap-1.5 transition-all ${
                                  result?.loading
                                    ? 'bg-monokai-yellow/20 text-monokai-yellow cursor-wait'
                                    : result?.error
                                    ? 'bg-monokai-pink/20 text-monokai-pink hover:bg-monokai-pink/40'
                                    : result?.data
                                    ? 'bg-monokai-green/20 text-monokai-green hover:bg-monokai-green/40'
                                    : 'bg-monokai-green text-white hover:bg-monokai-green/80'
                                }`}
                              >
                                {result?.loading ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-monokai-yellow border-t-transparent rounded-full animate-spin" />
                                    <span>运行中</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3" />
                                    <span>{result?.data ? '重新运行' : '运行'}</span>
                                  </>
                                )}
                              </button>
                              {onTryCode && (
                                <button
                                  onClick={() => onTryCode(codeString)}
                                  className="text-xs text-monokai-comment hover:text-white px-2 py-1.5 rounded-md transition-colors flex items-center gap-1"
                                  title="在 SQL 编辑器中打开"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span>打开</span>
                                </button>
                              )}
                              {/* 代码片段收藏按钮 - 仅 SQL 代码块显示 */}
                              {language === 'sql' && (
                                <button
                                  onClick={(e) => handleOpenSnippetSave(codeString, codeId, e)}
                                  className={`text-xs px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                                    savedSnippets.has(codeId)
                                      ? 'text-monokai-pink bg-monokai-pink/20'
                                      : 'text-monokai-comment hover:text-monokai-pink'
                                  }`}
                                  title={savedSnippets.has(codeId) ? '已收藏' : '收藏代码片段'}
                                >
                                  <Heart className={`w-3 h-3 ${savedSnippets.has(codeId) ? 'fill-current' : ''}`} />
                                </button>
                              )}
                            </>
                          )}
                          <CopyButton text={codeString} />
                        </div>
                      </div>
                      {language === 'sql' ? (
                        <>
                          <CodeMirror
                            value={codeString}
                            extensions={[
                              sql(),
                              EditorView.theme({
                                "&": { fontSize: `${Math.max(11, fontSize - 2)}px` },
                                ".cm-content": { fontSize: `${Math.max(11, fontSize - 2)}px` },
                                ".cm-line": { fontSize: `${Math.max(11, fontSize - 2)}px` }
                              })
                            ]}
                            theme={monokai}
                            editable={false}
                            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                            style={{ fontSize: `${Math.max(11, fontSize - 2)}px` }}
                          />
                          {/* Result Area */}
                          {(result) && (
                            <div id={`result-${codeId}`}>
                              <ResultTable
                                data={result.data || []}
                                error={result.error}
                                loading={result.loading}
                                executionTime={result.executionTime}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <CodeMirror
                          value={codeString}
                          extensions={[
                            language === 'python' ? python() :
                            language === 'javascript' || language === 'js' ? javascript() :
                            language === 'typescript' || language === 'ts' ? javascript({ typescript: true }) :
                            language === 'json' ? json() :
                            language === 'rust' || language === 'rs' ? rust() :
                            language === 'cpp' || language === 'c++' ? cpp() :
                            language === 'java' ? java() :
                            language === 'html' ? html() :
                              language === 'css' ? css() :
                              language === 'markdown' || language === 'md' ? markdown() :
                              language === 'yaml' || language === 'yml' ? yaml() :
                              language === 'xml' ? xml() :
                              [],
                            EditorView.theme({
                              "&": { fontSize: `${Math.max(11, fontSize - 2)}px` },
                              ".cm-content": { fontSize: `${Math.max(11, fontSize - 2)}px` },
                              ".cm-line": { fontSize: `${Math.max(11, fontSize - 2)}px` }
                            })
                          ]}
                          theme={dracula}
                          editable={false}
                          basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                          style={{ fontSize: `${Math.max(11, fontSize - 2)}px` }}
                        />
                      )}
                    </div>
                  );
                }
                return (
                  <code className="bg-monokai-accent/30 text-monokai-orange px-1.5 py-0.5 rounded text-[10px] font-mono border border-monokai-accent/50" {...props}>
                    {children}
                  </code>
                );
              },

              table: ({ children }) => <div className="overflow-x-auto my-6 border border-monokai-accent/30 rounded-lg"><table className="w-full text-left border-collapse">{children}</table></div>,
              thead: ({ children }) => <thead className="bg-monokai-sidebar/50 text-monokai-fg text-[10px] font-bold uppercase tracking-wider">{children}</thead>,
              tbody: ({ children }) => <tbody className="text-[10px] text-monokai-fg divide-y divide-monokai-accent/20 bg-monokai-bg/50">{children}</tbody>,
              tr: ({ children }) => <tr className="hover:bg-monokai-accent/10 transition-colors">{children}</tr>,
              th: ({ children }) => <th className="p-3 border-b border-monokai-accent/30 text-[10px]">{children}</th>,
              td: ({ children }: any) => {
                // 处理占位符转换
                const SUB_START = '\x01SUB_START\x01';
                const SUB_END = '\x01SUB_END\x01';
                const SUP_START = '\x01SUP_START\x01';
                const SUP_END = '\x01SUP_END\x01';

                // 处理下划线分隔的字段名称高亮显示
                const processUnderscoreHighlight = (text: string): React.ReactNode => {
                  // 先将转义的下划线 \_ 还原为 _
                  const restored = text.replace(/\\_/g, '_');
                  
                  if (!restored.includes('_')) {
                    return restored;
                  }

                  // 清理多余的下划线：
                  // 1. 如果字符串以 _ 开头或结尾，先去掉
                  // 2. 如果有连续的 __，替换为单个 _
                  let cleaned = restored
                    .replace(/^_+/, '')   // 去掉开头的多余下划线
                    .replace(/_+$/, '')   // 去掉结尾的多余下划线
                    .replace(/_+/g, '_'); // 替换连续的多个下划线为单个
                  
                  // 再次检查清理后是否还有下划线
                  if (!cleaned.includes('_')) {
                    return cleaned;
                  }

                  const parts = cleaned.split('_');
                  return parts.map((part, index) => (
                    <span
                      key={index}
                      className="bg-monokai-yellow/30 text-monokai-yellow px-0.5 rounded mx-0.5 font-medium"
                    >
                      {part}
                    </span>
                  ));
                };

                const processChildren = (content: React.ReactNode): React.ReactNode => {
                  if (typeof content === 'string') {
                    // 首先检查是否包含占位符（SUB_START 或 SUB_END），这说明数据被错误处理了
                    // 占位符格式为 \x01SUB_START\x01 或 \x01SUB_END\x01
                    // 注意：这里需要单独检查每个占位符，因为可能出现不配对的情况
                    const hasSubStart = content.includes('\x01SUB_START\x01');
                    const hasSubEnd = content.includes('\x01SUB_END\x01');
                    const hasSupStart = content.includes('\x01SUP_START\x01');
                    const hasSupEnd = content.includes('\x01SUP_END\x01');
                    
                    if (hasSubStart || hasSubEnd || hasSupStart || hasSupEnd) {
                      console.log('=== 发现错误处理的占位符 ===', JSON.stringify(content));
                      
                      // 先还原被错误处理的占位符，将所有占位符都还原为 _
                      // 这样即使占位符不配对，也能正确还原为下划线分隔的格式
                      let restored = content
                        .replace(/\x01SUB_START\x01/g, '_')
                        .replace(/\x01SUB_END\x01/g, '_')
                        .replace(/\x01SUP_START\x01/g, '_')
                        .replace(/\x01SUP_END\x01/g, '_');
                      
                      console.log('=== 占位符还原后 ===', JSON.stringify(restored));
                      
                      // 如果还原后还有下划线，进行高亮处理
                      if (restored.includes('_')) {
                        return processUnderscoreHighlight(restored);
                      }
                      return restored;
                    }

                    // 检查是否有转义的下划线 \_ 或普通下划线 _
                    const hasEscapedUnderscore = content.includes('\\_');
                    const hasUnderscore = content.includes('_');
                    
                    // 如果有下划线（转义的或普通的），则先处理下划线高亮
                    if (hasEscapedUnderscore || hasUnderscore) {
                      console.log('=== TD原始字符串 ===', JSON.stringify(content));
                      console.log('=== 有转义下划线 ===', hasEscapedUnderscore, '=== 有普通下划线 ===', hasUnderscore);
                      return processUnderscoreHighlight(content);
                    }

                    // 处理占位符转换（sub/sup）
                    console.log('=== TD原始字符串(无下划线) ===', JSON.stringify(content));
                    const parts = content.split(new RegExp(`(${SUB_START}[\\s\\S]*?${SUB_END}|${SUP_START}[\\s\\S]*?${SUP_END})`, 'g'));
                    console.log('=== TD分割后 ===', JSON.stringify(parts));
                    return parts.map((part, i) => {
                      if (part.startsWith(SUB_START) && part.endsWith(SUB_END)) {
                        const text = part.slice(SUB_START.length, -SUB_END.length);
                        return <sub key={i}>{text}</sub>;
                      }
                      if (part.startsWith(SUP_START) && part.endsWith(SUP_END)) {
                        const text = part.slice(SUP_START.length, -SUP_END.length);
                        return <sup key={i}>{text}</sup>;
                      }
                      return part;
                    });
                  }
                  if (Array.isArray(content)) {
                    return content.map((item, i) => processChildren(item));
                  }
                  return content;
                };
                return <td className="p-3 text-[10px]">{processChildren(children)}</td>;
              },
              a: ({ node, href, children, ...props }: any) => (
                <a
                  className="text-monokai-blue hover:text-monokai-purple hover:underline transition-colors cursor-pointer"
                  href={href}
                  onClick={(e) => href && handleLinkClick(e, href)}
                  target={href?.startsWith('http') ? "_blank" : undefined}
                  rel={href?.startsWith('http') ? "noopener noreferrer" : undefined}
                  {...props}
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="text-monokai-fg font-bold">{children}</strong>,
              em: ({ children }) => <em className="text-monokai-yellow italic">{children}</em>,
              // 将 sub/sup 标签转换为斜体显示，避免 Markdown 解析错误导致的下标样式
              sub: ({ children }) => <em className="text-monokai-yellow italic not-italic">{children}</em>,
              sup: ({ children }) => <em className="text-monokai-yellow italic not-italic">{children}</em>,
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </article>

        {/* 回到顶部按钮 */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 w-12 h-12 bg-monokai-blue/90 hover:bg-monokai-blue text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 hover:scale-110"
            title="回到顶部"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}

        {/* 底部悬浮工具栏：上一章/下一章/回到顶部 */}
        {toc.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-[#21222c]/95 backdrop-blur-sm border border-monokai-accent/50 rounded-full shadow-xl z-40 transition-all duration-300 translate-y-0 opacity-100">
            {/* 上一章 */}
            <button
              onClick={scrollToPrevChapter}
              disabled={!prevChapter}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                prevChapter
                  ? 'text-monokai-fg hover:bg-monokai-accent/30 hover:text-white'
                  : 'text-monokai-comment/40 cursor-not-allowed'
              }`}
              title={prevChapter ? `上一章: ${prevChapter.title}` : '已经是第一章'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">上一章</span>
            </button>

            {/* 分割线 */}
            <div className="w-px h-5 bg-monokai-accent/40" />

            {/* 当前章节指示器 */}
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs text-monokai-comment">
                {currentTocIndex >= 0 ? `${currentTocIndex + 1}/${toc.length}` : `${toc.length}`}
              </span>
              <span className="text-xs text-monokai-fg font-medium max-w-[120px] truncate">
                {activeAnchor ? (toc.find(t => t.id === activeAnchor)?.title || '') : (toc[0]?.title || '')}
              </span>
            </div>

            {/* 分割线 */}
            <div className="w-px h-5 bg-monokai-accent/40" />

            {/* 回到顶部 */}
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-monokai-fg hover:bg-monokai-accent/30 hover:text-white transition-all"
              title="回到顶部"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="hidden sm:inline">顶部</span>
            </button>

            {/* 分割线 */}
            <div className="w-px h-5 bg-monokai-accent/40" />

            {/* 下一章 */}
            <button
              onClick={scrollToNextChapter}
              disabled={!nextChapter}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                nextChapter
                  ? 'text-monokai-fg hover:bg-monokai-accent/30 hover:text-white'
                  : 'text-monokai-comment/40 cursor-not-allowed'
              }`}
              title={nextChapter ? `下一章: ${nextChapter.title}` : '已经是最后一章'}
            >
              <span className="hidden sm:inline">下一章</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* 右侧目录导航 */}
      {toc.length > 0 && showToc && (
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-l border-monokai-accent/20 bg-monokai-bg/50 h-full overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-between p-4 border-b border-monokai-accent/20 bg-monokai-sidebar/5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-monokai-blue" />
              <h4 className="text-[11px] font-bold text-monokai-fg/90 uppercase tracking-widest">
                目录
              </h4>
            </div>
            {/* 展开/折叠全部按钮 */}
            <button
              onClick={() => {
                if (expandedItems.size > 0) {
                  setExpandedItems(new Set());
                } else {
                  const allIds = new Set<string>();
                  const collect = (items: TocItem[]) => {
                    items.forEach(item => {
                      allIds.add(item.id);
                      if (item.children) collect(item.children);
                    });
                  };
                  collect(tocTree);
                  setExpandedItems(allIds);
                }
              }}
              className="p-1.5 rounded-md hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-blue transition-all"
              title={expandedItems.size > 0 ? "折叠全部" : "展开全部"}
            >
              {expandedItems.size > 0 ? (
                <BarChart2 className="w-3.5 h-3.5 rotate-90" />
              ) : (
                <Library className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <nav className="space-y-0.5">
              {tocTree.map((item, index) => renderTocItem(item, index, index === tocTree.length - 1))}
            </nav>
          </div>
        </aside>
      )}

      {/* 笔记侧边栏 */}
      <NotesSidebar
        isOpen={showNotesSidebar}
        onClose={() => setShowNotesSidebar(false)}
        tutorialId={tutorialId}
        tutorialTitle={tutorialTitle}
      />

      {/* 收藏侧边栏 */}
      <FavoritesSidebar
        isOpen={showFavoritesSidebar}
        onClose={() => setShowFavoritesSidebar(false)}
      />

      {/* 代码片段侧边栏 */}
      <CodeSnippetsSidebar
        isOpen={showCodeSnippetsSidebar}
        onClose={() => setShowCodeSnippetsSidebar(false)}
        onSelectTutorial={(tutorialId) => {
          // 这里需要通过父组件跳转，暂时仅关闭侧边栏
          setShowCodeSnippetsSidebar(false);
        }}
        onTryCode={onTryCode}
      />

      {/* 数据管理侧边栏 */}
      <DataManagementSidebar
        isOpen={showDataManagementSidebar}
        onClose={() => setShowDataManagementSidebar(false)}
        onDataChanged={() => {
          // 数据变化后可以触发页面刷新等操作
        }}
      />

      {/* 添加笔记弹窗 */}
      {showNotePopup && selectedText && tutorialId && (
        <div
          className="fixed z-[100] bg-[#21222c] border border-monokai-yellow/30 rounded-xl shadow-2xl p-4 w-72 animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: Math.min(notePopupPos.x, window.innerWidth - 320),
            top: Math.max(notePopupPos.y - 180, 20),
            transform: 'translateX(-50%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 装饰性角落 */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-monokai-yellow rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-monokai-yellow rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-monokai-yellow rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-monokai-yellow rounded-br-lg" />

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-monokai-yellow" />
              添加笔记
            </h4>
            <button
              onClick={() => setShowNotePopup(false)}
              className="text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 选中的文本 */}
          <div className="text-xs text-monokai-comment mb-3 p-2.5 bg-monokai-bg/60 rounded-lg border-l-2 border-monokai-purple/60 italic leading-relaxed">
            "{selectedText.length > 80 ? selectedText.substring(0, 80) + '...' : selectedText}"
          </div>

          {/* 笔记输入 */}
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="记录你的想法..."
            className="w-full h-20 p-2.5 text-sm bg-monokai-bg/80 border border-monokai-accent/20 rounded-lg text-monokai-fg placeholder-monokai-comment/40 focus:border-monokai-yellow/50 focus:outline-none resize-none transition-colors"
            autoFocus
          />

          {/* 按钮 */}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setShowNotePopup(false)}
              className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors rounded-md hover:bg-monokai-accent/10"
            >
              取消
            </button>
            <button
              onClick={handleSaveNote}
              disabled={!noteContent.trim() || isSavingNote}
              className="px-3 py-1.5 text-xs bg-monokai-yellow/20 text-monokai-yellow rounded-md hover:bg-monokai-yellow/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSavingNote ? (
                <>保存中...</>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 代码片段收藏弹窗 */}
      {snippetToSave && (
        <div
          className="fixed z-[100] bg-[#21222c] border border-monokai-blue/30 rounded-xl shadow-2xl p-4 w-80 animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: Math.min(snippetPopupPos.x, window.innerWidth - 360),
            top: Math.max(snippetPopupPos.y - 280, 20),
            transform: 'translateX(-50%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 装饰性角落 */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-monokai-blue rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-monokai-blue rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-monokai-blue rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-monokai-blue rounded-br-lg" />

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
              <Code className="w-4 h-4 text-monokai-blue" />
              收藏代码片段
            </h4>
            <button
              onClick={handleCloseSnippetPopup}
              className="text-monokai-comment hover:text-monokai-fg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 代码预览 */}
          <div className="text-xs text-monokai-comment mb-3 p-2.5 bg-monokai-bg/60 rounded-lg border-l-2 border-monokai-blue/60 font-mono max-h-20 overflow-auto">
            {snippetToSave.code.length > 150 ? snippetToSave.code.substring(0, 150) + '...' : snippetToSave.code}
          </div>

          {/* 描述输入 */}
          <textarea
            value={snippetDescription}
            onChange={(e) => setSnippetDescription(e.target.value)}
            placeholder="添加描述（可选）..."
            className="w-full h-16 p-2.5 text-sm bg-monokai-bg/80 border border-monokai-accent/20 rounded-lg text-monokai-fg placeholder-monokai-comment/40 focus:border-monokai-blue/50 focus:outline-none resize-none transition-colors mb-2"
            autoFocus
          />

          {/* 标签输入 */}
          <input
            type="text"
            value={snippetTags}
            onChange={(e) => setSnippetTags(e.target.value)}
            placeholder="标签（用逗号分隔）"
            className="w-full px-3 py-2 text-sm bg-monokai-bg/80 border border-monokai-accent/20 rounded-lg text-monokai-fg placeholder-monokai-comment/40 focus:border-monokai-blue/50 focus:outline-none transition-colors mb-3"
          />

          {/* 按钮 */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCloseSnippetPopup}
              className="px-3 py-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors rounded-md hover:bg-monokai-accent/10"
            >
              取消
            </button>
            <button
              onClick={handleSaveSnippet}
              disabled={isSavingSnippet}
              className="px-3 py-1.5 text-xs bg-monokai-blue/20 text-monokai-blue rounded-md hover:bg-monokai-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSavingSnippet ? (
                <>保存中...</>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownViewer;
