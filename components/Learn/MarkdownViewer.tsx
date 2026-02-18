import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { dracula } from '@uiw/codemirror-theme-dracula';
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
import { Copy, Check, StickyNote, Code, Heart, HeartHandshake, Database, Play, X, Trash2, FileText, Library, Clock, BarChart2, Download, Upload, AlertTriangle } from 'lucide-react';

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
const buildTocTree = (toc: TocItem[]): TocItem[] => {
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
}

// 统一的 ID 生成逻辑
const generateId = (text: string, level: number = 0): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '')
    // 添加层级前缀以避免重复 ID
    + (level > 0 ? `-h${level}` : '');
};

// 从 markdown 内容中提取目录
const extractToc = (markdown: string): TocItem[] => {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    let title = match[2].trim();
    
    // 提取标题中的编号前缀（如 "1.", "2.1", "3.5.1"），并在编号和标题之间加空格
    const numberPrefixMatch = title.match(/^(\d+(\.\d+)*)\s*[.、]\s*/);
    if (numberPrefixMatch) {
      const prefix = numberPrefixMatch[1];
      const restTitle = title.slice(numberPrefixMatch[0].length);
      title = `${prefix}. ${restTitle}`;
    }
    
    const id = generateId(title, level);
    toc.push({ id, title, level });
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

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, onTryCode, onOpenTable, tutorialId, tutorialTitle }) => {
  const [activeAnchor, setActiveAnchor] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
      for (const code of codes) {
        const existing = await isSnippetExists(code);
        if (existing) {
          // 使用代码的 hash 作为 ID
          const codeHash = Math.abs(code.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)).toString(36);
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
    return saved ? parseInt(saved, 10) : 16;
  });

  // 字体大小变化处理
  const handleFontSizeChange = (newSize: number) => {
    const clampedSize = Math.max(12, Math.min(24, newSize));
    setFontSize(clampedSize);
    localStorage.setItem('duckdb_learn_fontsize', String(clampedSize));
  };

  // 从 markdown 内容中提取所有 SQL 代码块
  const extractAllSqlCodes = (markdown: string): string[] => {
    const sqlRegex = /```sql\n([\s\S]*?)```/g;
    const codes: string[] = [];
    let match;
    while ((match = sqlRegex.exec(markdown)) !== null) {
      codes.push(match[1].trim());
    }
    return codes;
  };

  // 复制状态
  const [copiedAll, setCopiedAll] = useState(false);
  const [sqlCodeCount, setSqlCodeCount] = useState(0);

  // 更新 SQL 代码数量
  useEffect(() => {
    const codes = extractAllSqlCodes(content);
    setSqlCodeCount(codes.length);
  }, [content]);

  // 一键复制所有 SQL 代码
  const handleCopyAllSql = async () => {
    const codes = extractAllSqlCodes(content);
    if (codes.length === 0) return;

    const combinedCode = codes.join('\n\n---\n\n');
    await navigator.clipboard.writeText(combinedCode);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
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

  const scrollToAnchor = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without jumping
      window.history.pushState(null, '', `#${id}`);
    }
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('table://')) {
      e.preventDefault();
      const tableName = href.replace('table://', '');
      onOpenTable?.(tableName);
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
        <button
          onClick={() => scrollToAnchor(item.id)}
          className={`w-full text-left text-sm py-1.5 px-2 rounded transition-all duration-200 flex items-center gap-1 ${
            isActive
              ? 'border-monokai-pink text-monokai-pink bg-monokai-pink/10 font-medium'
              : 'border-transparent text-monokai-fg/90 hover:text-monokai-fg hover:bg-monokai-accent/10'
          } ${isH1 ? '' : isH2 ? 'ml-2' : 'ml-4 text-xs'}`}
        >
          {/* 展开/折叠按钮 */}
          {hasChildren ? (
            <span
              onClick={(e) => toggleExpand(item.id, e)}
              className="w-4 h-4 flex items-center justify-center text-monokai-comment hover:text-monokai-fg cursor-pointer shrink-0 transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{item.title}</span>
        </button>

        {/* 递归渲染子章节 */}
        {hasChildren && isExpanded && (
          <div className="ml-1 border-l border-monokai-accent/30 pl-1">
            {item.children!.map((child, idx) => renderTocItem(child, idx, idx === item.children!.length - 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full relative group/viewer">
      {/* 主内容区 */}
      <main ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-8 markdown-content-area scroll-smooth h-full custom-scrollbar relative">
        {/* 顶部工具栏 - 整合所有功能 */}
        <div className="sticky top-0 z-10 bg-monokai-bg/95 backdrop-blur-sm py-2 mb-4 flex items-center justify-between border-b border-monokai-accent/30 rounded-lg px-0 -ml-4">
          {/* 左侧：标题 */}
          <div className="flex items-center -ml-2">
            <span className="text-sm text-monokai-fg font-medium">教程内容</span>
          </div>

          {/* 右侧：操作按钮组 */}
          <div className="flex items-center gap-0.5 -mr-2">
            {/* 复制全部代码 */}
            {sqlCodeCount > 0 && (
              <button
                onClick={handleCopyAllSql}
                disabled={copiedAll}
                className={`flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                  copiedAll
                    ? 'bg-monokai-green/30 text-monokai-green'
                    : 'bg-monokai-blue/20 text-monokai-blue hover:bg-monokai-blue/30'
                }`}
                title="复制本页所有 SQL 代码"
              >
                {copiedAll ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{copiedAll ? '已复制' : `${sqlCodeCount} 个代码`}</span>
              </button>
            )}

            {/* 笔记按钮 */}
            <button
              onClick={() => setShowNotesSidebar(true)}
              className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-yellow/20 text-monokai-yellow hover:bg-monokai-yellow/30 transition-all whitespace-nowrap"
              title="查看学习笔记"
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">笔记</span>
            </button>

            {/* 字号调节 - 放在笔记下面 */}
            <div className="flex justify-center items-center gap-0.5 bg-monokai-accent/20 rounded-md px-1 py-1">
              <button
                onClick={() => handleFontSizeChange(fontSize - 2)}
                disabled={fontSize <= 12}
                className="w-5 h-5 rounded text-[10px] font-bold bg-monokai-accent/30 hover:bg-monokai-accent/50 text-monokai-fg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="减小字号"
              >
                A
              </button>
              <span className="text-[10px] text-monokai-fg w-5 text-center leading-none">{fontSize}</span>
              <button
                onClick={() => handleFontSizeChange(fontSize + 2)}
                disabled={fontSize >= 24}
                className="w-6 h-5 rounded text-sm font-bold bg-monokai-accent/30 hover:bg-monokai-accent/50 text-monokai-fg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="增大字号"
              >
                A
              </button>
              <button
                onClick={() => handleFontSizeChange(16)}
                className="ml-0.5 text-[10px] text-monokai-fg hover:text-monokai-blue transition-colors px-1 py-0.5 rounded hover:bg-monokai-accent/30 whitespace-nowrap"
                title="重置为默认"
              >
                默认
              </button>
            </div>

            {/* 收藏按钮 */}
            {tutorialId && (
              <button
                onClick={handleToggleFavorite}
                className={`flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                  isFavorited
                    ? 'bg-monokai-pink/30 text-monokai-pink'
                    : 'bg-monokai-pink/20 text-monokai-pink hover:bg-monokai-pink/30'
                }`}
                title={isFavorited ? '取消收藏' : '添加收藏'}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isFavorited ? '已收藏' : '收藏'}</span>
              </button>
            )}

            {/* 代码片段按钮 */}
            <button
              onClick={() => setShowCodeSnippetsSidebar(true)}
              className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/30 transition-all whitespace-nowrap"
              title="我的代码片段"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">片段</span>
            </button>

            {/* 我的收藏列表按钮 */}
            <button
              onClick={() => setShowFavoritesSidebar(true)}
              className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-pink/20 text-monokai-pink hover:bg-monokai-pink/30 transition-all whitespace-nowrap"
              title="查看我的收藏"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">收藏</span>
            </button>

            {/* 数据管理按钮 */}
            <button
              onClick={() => setShowDataManagementSidebar(true)}
              className="flex justify-center items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-monokai-green/20 text-monokai-green hover:bg-monokai-green/30 transition-all whitespace-nowrap"
              title="数据管理"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">数据</span>
            </button>
          </div>
        </div>
        <article className="markdown-body w-full max-w-[1800px] mx-auto pb-20" style={{ fontSize: `${fontSize}px` }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => {
                const id = generateId(String(children), 1);
                return <h1 id={id} className="text-3xl font-bold text-white mb-6 pb-2 border-b border-monokai-accent/30 mt-8 first:mt-0 group/h1 relative">
                  <span className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/h1:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h1>
              },
              h2: ({ children }) => {
                const id = generateId(String(children), 2);
                return <h2 id={id} className="text-2xl font-bold text-monokai-fg mb-4 mt-8 group/h2 relative">
                  <span className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover/h2:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-sm" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h2>
              },
              h3: ({ children }) => {
                const id = generateId(String(children), 3);
                return <h3 id={id} className="text-xl font-bold text-monokai-fg mb-3 mt-6 group/h3 relative">
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/h3:opacity-100 transition-opacity text-monokai-comment cursor-pointer hover:text-monokai-blue text-xs" onClick={() => scrollToAnchor(id)}>#</span>
                  {children}
                </h3>
              },

              p: ({ children }) => <p className="text-monokai-fg leading-relaxed mb-4">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-monokai-fg ml-4 marker:text-monokai-pink">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-monokai-fg ml-4 marker:text-monokai-purple">{children}</ol>,
              li: ({ children }) => <li className="pl-1 inline-block">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-monokai-yellow pl-4 py-1 my-4 bg-monokai-yellow/10 rounded-r text-monokai-fg italic">{children}</blockquote>,

              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : 'text';
                const codeString = String(children).replace(/\n$/, '');

                // Unique ID for this code block (hash-like)
                const codeId = React.useMemo(() => {
                  return Math.abs(codeString.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)).toString(36);
                }, [codeString]);
                const result = executionResults[codeId];

                if (!inline && language === 'mermaid') {
                  return <Mermaid chart={codeString} />;
                }

                if (!inline) {
                  return (
                    <div className="code-block-wrapper my-6 rounded-md overflow-hidden bg-[#282a36] border border-monokai-accent/30 shadow-lg relative group">
                      <div className="code-block-header flex justify-between items-center px-4 py-2 bg-[#21222c] border-b border-monokai-accent/30">
                        <span className="code-lang text-xs text-monokai-blue font-bold uppercase">{language}</span>
                        <div className="flex gap-2 items-center">
                          {language === 'sql' && (
                            <>
                              <button
                                onClick={() => handleExecute(codeString, codeId)}
                                className="text-xs bg-monokai-green/20 text-monokai-green px-2 py-0.5 rounded hover:bg-monokai-green/40 transition-colors font-medium cursor-pointer flex items-center gap-1"
                              >
                                <Play className="w-3 h-3" /> Run
                              </button>
                              {onTryCode && (
                                <button onClick={() => onTryCode(codeString)} className="text-xs text-monokai-comment hover:text-white px-2 py-0.5 rounded transition-colors" title="Open in SQL Editor">
                                  Open
                                </button>
                              )}
                              {/* 代码片段收藏按钮 - 仅 SQL 代码块显示 */}
                              {language === 'sql' && (
                                <button
                                  onClick={(e) => handleOpenSnippetSave(codeString, codeId, e)}
                                  className={`text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
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
                            extensions={[sql()]}
                            theme={dracula}
                            editable={false}
                            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                            className="text-sm"
                          />
                          {/* Result Area */}
                          {(result) && (
                            <ResultTable
                              data={result.data || []}
                              error={result.error}
                              loading={result.loading}
                              executionTime={result.executionTime}
                            />
                          )}
                        </>
                      ) : (
                        <div className="p-4 overflow-x-auto">
                          <code className={`font-mono text-sm leading-relaxed text-[#f8f8f2] ${className}`} {...props}>
                            {children}
                          </code>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <code className="bg-monokai-accent/30 text-monokai-orange px-1.5 py-0.5 rounded text-sm font-mono border border-monokai-accent/50" {...props}>
                    {children}
                  </code>
                );
              },

              table: ({ children }) => <div className="overflow-x-auto my-6 border border-monokai-accent/30 rounded-lg"><table className="w-full text-left border-collapse">{children}</table></div>,
              thead: ({ children }) => <thead className="bg-monokai-sidebar/50 text-monokai-fg text-sm font-bold uppercase tracking-wider">{children}</thead>,
              tbody: ({ children }) => <tbody className="text-sm text-monokai-fg divide-y divide-monokai-accent/20 bg-monokai-bg/50">{children}</tbody>,
              tr: ({ children }) => <tr className="hover:bg-monokai-accent/10 transition-colors">{children}</tr>,
              th: ({ children }) => <th className="p-3 border-b border-monokai-accent/30">{children}</th>,
              td: ({ children }) => <td className="p-3">{children}</td>,
              a: ({ node, href, children, ...props }) => (
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
            }}
          >
            {content}
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
      </main>

      {/* 右侧目录导航 */}
      {toc.length > 0 && (
        <aside className="hidden lg:block w-64 shrink-0 border-l border-monokai-accent/30 bg-monokai-sidebar/20 h-full overflow-y-auto p-4 transition-all">
          <div className="flex items-center justify-between mb-4 border-b border-monokai-accent/30 pb-2">
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider">
              目录
            </h4>
            {/* 展开/折叠全部按钮 */}
            <button
              onClick={() => {
                if (expandedItems.size > 0) {
                  setExpandedItems(new Set());
                } else {
                  const allIds = new Set<string>();
                  tocTree.forEach(item => {
                    allIds.add(item.id);
                    if (item.children) {
                      item.children.forEach(child => allIds.add(child.id));
                    }
                  });
                  setExpandedItems(allIds);
                }
              }}
              className="text-[10px] text-monokai-comment hover:text-monokai-blue transition-colors"
              title={expandedItems.size > 0 ? "折叠全部" : "展开全部"}
            >
              {expandedItems.size > 0 ? '⊟' : '⊞'}
            </button>
          </div>
          <nav className="space-y-1 relative">
            {tocTree.map((item, index) => renderTocItem(item, index, index === tocTree.length - 1))}
          </nav>
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
