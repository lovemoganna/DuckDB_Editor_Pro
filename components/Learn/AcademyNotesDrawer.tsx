/**
 * AcademyNotesDrawer.tsx - 学习随堂笔记与心得沉淀抽屉
 * 
 * 职责：
 * 1. 沉淀复用闭环核心：在学习过程中随时撰写随堂笔记，支持 Markdown；
 * 2. 自动关联当前课程 ID 与标题，持久化存储至本地 IndexedDB (`learnNotesStorage`)；
 * 3. 支持查看当前课程专属笔记，亦可切换为“全局笔记库”进行跨课程复习；
 * 4. 支持编辑、删除以及一键导出为 Markdown 知识总结。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, BookMarked, Plus, Trash2, Edit3, Save, Download, 
  Calendar, Check, FileText, Layers, Search
} from 'lucide-react';
import { 
  Note, saveNote, deleteNote, getNotesByTutorial, getAllNotes 
} from '../../services/learnNotesStorage';
import { toastService } from '../../services/toastService';

interface AcademyNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCourseId?: string;
  currentCourseTitle?: string;
  onNoteCountChange?: (count: number) => void;
}

export const AcademyNotesDrawer: React.FC<AcademyNotesDrawerProps> = ({
  isOpen,
  onClose,
  currentCourseId,
  currentCourseTitle,
  onNoteCountChange,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewScope, setViewScope] = useState<'current' | 'all'>('current');
  const [newContent, setNewContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 加载笔记
  const loadNotes = useCallback(async () => {
    try {
      if (viewScope === 'current' && currentCourseId) {
        const courseNotes = await getNotesByTutorial(currentCourseId);
        setNotes(courseNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        onNoteCountChange?.(courseNotes.length);
      } else {
        const all = await getAllNotes();
        setNotes(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        if (currentCourseId) {
          const currentOnes = all.filter(n => n.tutorialId === currentCourseId);
          onNoteCountChange?.(currentOnes.length);
        }
      }
    } catch (err) {
      console.warn('Failed to load notes:', err);
    }
  }, [viewScope, currentCourseId, onNoteCountChange]);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, loadNotes]);

  // 新建笔记
  const handleCreate = async () => {
    if (!newContent.trim()) {
      toastService.warning('笔记内容不能为空');
      return;
    }

    const note: Note = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tutorialId: currentCourseId || 'general',
      tutorialTitle: currentCourseTitle || '通用学习笔记',
      selectedText: '',
      noteContent: newContent.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveNote(note);
      setNewContent('');
      setIsCreating(false);
      await loadNotes();
      toastService.success('随堂笔记已保存至本地');
    } catch {
      toastService.error('保存笔记失败');
    }
  };

  // 保存编辑
  const handleUpdate = async (note: Note) => {
    if (!editingContent.trim()) return;
    const updated: Note = {
      ...note,
      noteContent: editingContent.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveNote(updated);
      setEditingNoteId(null);
      await loadNotes();
      toastService.success('笔记已更新');
    } catch {
      toastService.error('更新笔记失败');
    }
  };

  // 删除笔记
  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      await loadNotes();
      toastService.info('笔记已删除');
    } catch {
      toastService.error('删除笔记失败');
    }
  };

  // 导出全部笔记为 Markdown
  const handleExportMarkdown = () => {
    if (notes.length === 0) {
      toastService.warning('当前暂无可导出的笔记');
      return;
    }

    let md = `# DuckDB 数据实战学堂 · 随堂学习笔记\n\n`;
    md += `*导出时间: ${new Date().toLocaleString()}*\n\n---\n\n`;

    notes.forEach((n, idx) => {
      md += `### ${idx + 1}. 【${n.tutorialTitle}】\n`;
      md += `*记录时间: ${new Date(n.createdAt).toLocaleString()}*\n\n`;
      md += `${n.noteContent}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DuckDB_Academy_Notes_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toastService.success('笔记已成功导出为 Markdown 文件');
  };

  const filteredNotes = notes.filter(n => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.noteContent.toLowerCase().includes(q) || n.tutorialTitle.toLowerCase().includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 max-w-full bg-[#12171f] border-l border-zinc-800 shadow-2xl z-50 flex flex-col font-sans select-none animate-in slide-in-from-right duration-200">
      
      {/* 1. 抽屉顶栏 */}
      <div className="h-12 px-4 bg-[#0c1015] border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white">随堂笔记与沉淀</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {filteredNotes.length} 条
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

      {/* 2. 模式切换与检索栏 */}
      <div className="p-3 border-b border-zinc-800 bg-[#12171f] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg bg-zinc-800/80 p-0.5 text-[11px] font-medium border border-zinc-700/60">
            <button
              type="button"
              onClick={() => setViewScope('current')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'current'
                  ? 'bg-[#0c1015] text-cyan-400 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              当前课程
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-[#0c1015] text-cyan-400 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              全部笔记
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="p-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
              title="导出为 Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[11px]">导出</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="px-2 py-1 rounded-md text-[11px] font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>写笔记</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索笔记内容或课程名..."
            className="w-full pl-7 pr-3 py-1 text-xs bg-zinc-800 text-white rounded-md border border-zinc-700 focus:outline-none focus:border-cyan-400 placeholder-zinc-500"
          />
        </div>
      </div>

      {/* 3. 新建笔记输入框 (展开时显示) */}
      {isCreating && (
        <div className="p-3 border-b border-zinc-800 bg-[#0c1015] space-y-2 shrink-0">
          <div className="text-[11px] text-zinc-400 truncate font-medium">
            关联课程：<span className="text-zinc-200">{currentCourseTitle || '通用'}</span>
          </div>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="记录关键知识点、易错点或业务启发..."
            rows={4}
            className="w-full p-2.5 text-xs bg-zinc-800/80 text-white rounded-lg border border-zinc-700 focus:border-cyan-400 focus:outline-none resize-none font-sans placeholder-zinc-500"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsCreating(false); setNewContent(''); }}
              className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-3 py-1 rounded text-[11px] font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>保存笔记</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. 笔记列表区 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {filteredNotes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500 p-4">
            <BookMarked className="w-8 h-8 mb-2 opacity-30 text-amber-400" />
            <p className="text-xs text-zinc-300">暂无随堂笔记</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
              在学习过程中随时点击右上角「写笔记」，记录属于你的 DuckDB 实战经验。
            </p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const isEditing = editingNoteId === note.id;

            return (
              <div
                key={note.id}
                className="p-3 rounded-xl bg-[#0c1015] border border-zinc-800 hover:border-cyan-500/40 transition-all space-y-2 select-text"
              >
                {/* 课程标头与日期 */}
                <div className="flex items-center justify-between text-[10.5px] text-zinc-400">
                  <span className="truncate max-w-[180px] font-semibold text-zinc-300">
                    {note.tutorialTitle}
                  </span>
                  <span className="flex items-center gap-1 shrink-0 text-zinc-500">
                    <Calendar className="w-3 h-3 opacity-60" />
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* 笔记正文 */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      rows={3}
                      className="w-full p-2 text-xs bg-zinc-800 text-white rounded border border-zinc-700 focus:border-cyan-400 focus:outline-none resize-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-white"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(note)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400 text-black"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {note.noteContent}
                  </p>
                )}

                {/* 操作栏 */}
                {!isEditing && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setEditingContent(note.noteContent);
                      }}
                      className="text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-0.5 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>编辑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>删除</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default AcademyNotesDrawer;
