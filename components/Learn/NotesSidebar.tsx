import React, { useState, useEffect } from 'react';
import {
  StickyNote,
  X,
  Library,
  FileText,
  Upload,
  Download,
  Clock,
  Trash2,
  MapPin,
} from 'lucide-react';
import { Note, getAllNotes, deleteNote, exportNotes, importNotes } from '../../services/learnNotesStorage';
import { toastService } from '../../services/toastService';

interface NotesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tutorialId?: string;
  tutorialTitle?: string;
  onNoteClick?: (note: Note) => void;
}

export const NotesSidebar: React.FC<NotesSidebarProps> = ({ 
  isOpen, 
  onClose, 
  tutorialId, 
  tutorialTitle,
  onNoteClick 
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filter, setFilter] = useState<'all' | 'current'>('all');

  // 加载笔记
  const loadNotes = async () => {
    try {
      const allNotes = await getAllNotes();
      // 按创建时间倒序排列
      const sorted = allNotes.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotes(sorted);
    } catch (error) {
      console.error('加载笔记失败:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen]);

  // 删除笔记
  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      await loadNotes();
      toastService.success('笔记已删除');
    } catch (error) {
      console.error('删除笔记失败:', error);
      toastService.error('删除笔记失败');
    }
  };

  // 导出笔记
  const handleExport = async () => {
    try {
      const json = await exportNotes();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duckdb-notes-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastService.success('笔记导出成功');
    } catch (error) {
      console.error('导出笔记失败:', error);
      toastService.error('导出笔记失败');
    }
  };

  // 导入笔记
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const count = await importNotes(content);
          if (count > 0) {
            await loadNotes();
            toastService.success(`成功导入 ${count} 条笔记`);
          } else {
            toastService.info('未发现有效笔记或文件为空');
          }
        } catch (error) {
          toastService.error('导入失败，文件格式不正确');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 过滤笔记
  const filteredNotes = filter === 'current' && tutorialId
    ? notes.filter(n => n.tutorialId === tutorialId)
    : notes;

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
          onClick={onClose}
        />
      )}
      
      <div data-learn-sidebar role="dialog" aria-modal="true" aria-label="教程辅助侧栏" className={`fixed inset-y-0 right-0 w-80 max-w-full bg-monokai-sidebar border-l border-monokai-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-border bg-monokai-sidebar shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-monokai-yellow" />
            <span>学习笔记</span>
            <span className="text-[10px] text-monokai-comment font-mono ml-1">({filteredNotes.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded-md hover:bg-monokai-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-2 p-2.5 border-b border-monokai-border bg-monokai-surface/60 shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              filter === 'all' 
                ? 'bg-monokai-accent text-monokai-bg font-bold border border-transparent shadow-xs' 
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg border border-transparent'
            }`}
          >
            <Library className="w-3 h-3" />
            <span>全部</span>
          </button>
          <button
            onClick={() => setFilter('current')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              filter === 'current' 
                ? 'bg-monokai-accent text-monokai-bg font-bold border border-transparent shadow-xs' 
                : 'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg border border-transparent'
            }`}
            disabled={!tutorialId}
          >
            <FileText className="w-3 h-3" />
            <span>本教程</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={handleImport}
            className="p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg rounded-md transition-colors cursor-pointer"
            title="导入笔记"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExport}
            className="p-1 text-monokai-comment hover:text-monokai-fg hover:bg-monokai-bg rounded-md transition-colors cursor-pointer"
            title="导出笔记"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 笔记列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-monokai-comment">
              <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">暂无笔记</p>
              <p className="text-[11px] mt-1 opacity-60">选中教程中的文字即可添加笔记</p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className="bg-monokai-surface rounded-md p-3.5 border border-monokai-border hover:border-monokai-border-strong transition-all group shadow-xs"
              >
                {/* 所属教程 */}
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-comment mb-1.5 font-mono">
                  <FileText className="w-3 h-3" />
                  <span className="truncate">{note.tutorialTitle}</span>
                </div>
                
                {/* 选中的文本 */}
                <div className="text-[11px] text-monokai-comment mb-2.5 line-clamp-2 italic border-l-2 border-monokai-border pl-2 py-0.5 bg-monokai-bg/60 rounded-r">
                  "{note.selectedText}"
                </div>
                
                {/* 笔记内容 */}
                <div className="text-xs text-monokai-fg mb-2.5 whitespace-pre-wrap leading-relaxed">
                  {note.noteContent}
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center justify-between pt-2 border-t border-monokai-border/50">
                  <span className="text-[10px] text-monokai-comment flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onNoteClick?.(note)}
                      className="text-[10px] px-2 py-0.5 text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-hover bg-monokai-elevated border border-monokai-border rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      <span>定位</span>
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-[10px] px-2 py-0.5 text-monokai-comment hover:text-monokai-pink hover:bg-monokai-hover rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default NotesSidebar;
