/**
 * AcademySnippetsDrawer.tsx - 代码片段收藏与实战复用抽屉
 * 
 * 职责：
 * 1. 沉淀复用闭环核心：将试炼场或讲义中的优质 SQL 语句一键收藏为生产级代码片段；
 * 2. 直连本地 IndexedDB (`codeSnippetsStorage`) 进行持久化存储；
 * 3. 支持标签筛选、关键词检索；
 * 4. 一键将代码片段复用回当前试炼场、复制到剪贴板，或推送到主工作区 SQL 工作台。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Code2, Plus, Trash2, Copy, Play, ExternalLink, 
  Tag, Search, Check, Save, Layers, Sparkles, Download
} from 'lucide-react';
import { 
  CodeSnippet, getAllSnippets, saveSnippet, deleteSnippet 
} from '../../services/codeSnippetsStorage';
import { toastService } from '../../services/toastService';

interface AcademySnippetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSql?: string;
  currentCourseId?: string;
  currentCourseTitle?: string;
  onInsertCode?: (code: string) => void;
  onOpenInGlobalSql?: (sql: string) => void;
  onSnippetCountChange?: (count: number) => void;
}

export const AcademySnippetsDrawer: React.FC<AcademySnippetsDrawerProps> = ({
  isOpen,
  onClose,
  currentSql,
  currentCourseId,
  currentCourseTitle,
  onInsertCode,
  onOpenInGlobalSql,
  onSnippetCountChange,
}) => {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState(currentSql || '');
  const [newTagInput, setNewTagInput] = useState('DuckDB,SQL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 加载代码片段
  const loadSnippets = useCallback(async () => {
    try {
      const list = await getAllSnippets();
      setSnippets(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      onSnippetCountChange?.(list.length);
    } catch (err) {
      console.warn('Failed to load snippets:', err);
    }
  }, [onSnippetCountChange]);

  useEffect(() => {
    if (isOpen) {
      loadSnippets();
      if (currentSql) {
        setNewCode(currentSql);
      }
    }
  }, [isOpen, currentSql, loadSnippets]);

  // 保存代码片段
  const handleSaveSnippet = async () => {
    if (!newCode.trim()) {
      toastService.warning('代码内容不能为空');
      return;
    }
    if (!newDesc.trim()) {
      toastService.warning('请输入代码片段说明');
      return;
    }

    const tags = newTagInput
      .split(/[,， ]+/)
      .map(t => t.trim())
      .filter(Boolean);

    const snippet: CodeSnippet = {
      id: `snip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      code: newCode.trim(),
      description: newDesc.trim(),
      tutorialId: currentCourseId || 'custom',
      tutorialTitle: currentCourseTitle || '自定义试炼代码',
      tags: tags.length > 0 ? tags : ['DuckDB'],
      createdAt: new Date().toISOString(),
    };

    try {
      await saveSnippet(snippet);
      setIsSavingNew(false);
      setNewDesc('');
      await loadSnippets();
      toastService.success('代码片段已收藏至本地库');
    } catch {
      toastService.error('保存代码片段失败');
    }
  };

  // 复制片段
  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toastService.success('代码已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 删除片段
  const handleDelete = async (id: string) => {
    try {
      await deleteSnippet(id);
      await loadSnippets();
      toastService.info('代码片段已删除');
    } catch {
      toastService.error('删除片段失败');
    }
  };

  // 导出全部代码片段为 SQL 文件
  const handleExportSql = () => {
    if (snippets.length === 0) {
      toastService.warning('当前暂无可导出的代码片段');
      return;
    }

    let sqlDump = `-- ============================================================\n`;
    sqlDump += `-- DuckDB 数据实战学堂 · 生产级代码片段库导出\n`;
    sqlDump += `-- 导出时间: ${new Date().toLocaleString()}\n`;
    sqlDump += `-- ============================================================\n\n`;

    snippets.forEach((s, idx) => {
      sqlDump += `-- ------------------------------------------------------------\n`;
      sqlDump += `-- [Snippet ${idx + 1}] ${s.description}\n`;
      sqlDump += `-- 来源: ${s.tutorialTitle} | 标签: ${s.tags.join(', ')}\n`;
      sqlDump += `-- ------------------------------------------------------------\n`;
      sqlDump += `${s.code.trim()};\n\n`;
    });

    const blob = new Blob([sqlDump], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DuckDB_Snippets_${Date.now()}.sql`;
    link.click();
    URL.revokeObjectURL(url);
    toastService.success('代码片段库已成功导出为 .sql 文件');
  };

  // 过滤片段
  const filteredSnippets = snippets.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchDesc = s.description.toLowerCase().includes(q);
    const matchCode = s.code.toLowerCase().includes(q);
    const matchTag = s.tags.some(t => t.toLowerCase().includes(q));
    const matchCourse = s.tutorialTitle.toLowerCase().includes(q);
    return matchDesc || matchCode || matchTag || matchCourse;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-[#12171f] border-l border-zinc-800 shadow-2xl z-50 flex flex-col font-sans select-none animate-in slide-in-from-right duration-200">
      
      {/* 1. 抽屉顶栏 */}
      <div className="h-12 px-4 bg-[#0c1015] border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white">代码片段库 (Snippets)</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {filteredSnippets.length} 个
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. 搜索与新建入口 */}
      <div className="p-3 border-b border-zinc-800 bg-[#12171f] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索代码、描述或标签..."
              className="w-full pl-7 pr-3 py-1 text-xs bg-zinc-800 text-white rounded-md border border-zinc-700 focus:outline-none focus:border-cyan-400 placeholder-zinc-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportSql}
              className="p-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
              title="导出代码片段为 SQL 文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[11px]">导出</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSavingNew(true);
                if (currentSql) setNewCode(currentSql);
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold text-black bg-cyan-500 hover:bg-cyan-400 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>收藏当前</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. 收藏当前输入卡片 (展开时显示) */}
      {isSavingNew && (
        <div className="p-3 border-b border-zinc-800 bg-[#0c1015] space-y-2 shrink-0">
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="片段名称/用途（例如：Top-N分组取最新流水）"
            className="w-full p-2 text-xs bg-zinc-800 text-white rounded border border-zinc-700 focus:border-cyan-400 focus:outline-none placeholder-zinc-500"
            autoFocus
          />

          <textarea
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
            placeholder="SQL 语句..."
            rows={4}
            className="w-full p-2 text-xs font-mono bg-zinc-800 text-white rounded border border-zinc-700 focus:border-cyan-400 focus:outline-none resize-none placeholder-zinc-500"
          />

          <div className="flex items-center gap-2">
            <Tag className="w-3 h-3 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              placeholder="标签（逗号分隔，如：清洗,正则）"
              className="flex-1 p-1 text-xs bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none placeholder-zinc-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsSavingNew(false)}
              className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveSnippet}
              className="px-3 py-1 rounded text-[11px] font-bold bg-emerald-400 text-black hover:bg-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>保存到库</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. 代码片段列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {filteredSnippets.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500 p-4">
            <Code2 className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
            <p className="text-xs text-zinc-300">暂无收藏的代码片段</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
              在右侧试炼场调试出满意的 SQL 后，可点击「收藏当前」随时存入片段库以供后续复用。
            </p>
          </div>
        ) : (
          filteredSnippets.map(snip => {
            const isCopied = copiedId === snip.id;

            return (
              <div
                key={snip.id}
                className="rounded-xl bg-[#0c1015] border border-zinc-800 hover:border-cyan-500/40 transition-all overflow-hidden"
              >
                {/* 描述与操作 */}
                <div className="h-8 px-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 truncate max-w-[220px]">
                    {snip.description}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(snip.id, snip.code)}
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      title="复制代码"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {onInsertCode && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertCode(snip.code);
                          toastService.info('代码已注入试炼场');
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 cursor-pointer"
                        title="注入试炼场"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                    {onOpenInGlobalSql && (
                      <button
                        type="button"
                        onClick={() => onOpenInGlobalSql(snip.code)}
                        className="p-1 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer"
                        title="在主 SQL 工作台打开"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(snip.id)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* SQL 代码块 */}
                <pre className="p-3 text-[11px] font-mono text-[#d4d4d4] leading-relaxed overflow-x-auto bg-[#0c1015] max-h-36 select-text">
                  {snip.code}
                </pre>

                {/* 来源与标签 */}
                <div className="px-3 py-1.5 bg-zinc-900/50 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="truncate max-w-[160px]">来源：{snip.tutorialTitle}</span>
                  <div className="flex gap-1 flex-wrap">
                    {snip.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default AcademySnippetsDrawer;
