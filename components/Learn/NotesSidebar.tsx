import React, { useState, useEffect } from 'react';
import { Note, getAllNotes, deleteNote, exportNotes, importNotes } from '../../services/learnNotesStorage';

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
  const [editingNote, setEditingNote] = useState<Note | null>(null);
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
  }, [isOpen, tutorialId]);

  // 过滤笔记
  const filteredNotes = filter === 'current' && tutorialId
    ? notes.filter(n => n.tutorialId === tutorialId)
    : notes;

  // 删除笔记
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条笔记吗？')) return;
    try {
      await deleteNote(id);
      await loadNotes();
    } catch (error) {
      console.error('删除笔记失败:', error);
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
      a.download = `learn-notes-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出笔记失败:', error);
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
      try {
        const text = await file.text();
        const count = await importNotes(text);
        alert(`成功导入 ${count} 条笔记`);
        await loadNotes();
      } catch (error) {
        alert('导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}
      
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#21222c] border-l border-monokai-accent/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent/30 bg-[#282a36]/50">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <span className="i-lucide-sticky-note w-4 h-4 text-monokai-yellow" />
            学习笔记
            <span className="text-[10px] text-monokai-fg font-normal ml-1">({filteredNotes.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-fg hover:text-monokai-fg transition-colors p-1 rounded hover:bg-monokai-accent/20"
          >
            <span className="i-lucide-x w-5 h-5" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-2 p-3 border-b border-monokai-accent/20 bg-[#21222c]/80">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              filter === 'all' 
                ? 'bg-monokai-yellow/20 text-monokai-yellow' 
                : 'text-monokai-fg hover:text-monokai-fg hover:bg-monokai-accent/10'
            }`}
          >
            <span className="i-lucide-library w-3 h-3" />
            全部
          </button>
          <button
            onClick={() => setFilter('current')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              filter === 'current' 
                ? 'bg-monokai-yellow/20 text-monokai-yellow' 
                : 'text-monokai-fg hover:text-monokai-fg hover:bg-monokai-accent/10'
            }`}
            disabled={!tutorialId}
          >
            <span className="i-lucide-file-text w-3 h-3" />
            本教程
          </button>
          <div className="flex-1" />
          <button
            onClick={handleImport}
            className="p-1.5 text-monokai-fg hover:text-monokai-blue hover:bg-monokai-accent/10 rounded-md transition-colors"
            title="导入笔记"
          >
            <span className="i-lucide-upload w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 text-monokai-fg hover:text-monokai-blue hover:bg-monokai-accent/10 rounded-md transition-colors"
            title="导出笔记"
          >
            <span className="i-lucide-download w-4 h-4" />
          </button>
        </div>

        {/* 笔记列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-monokai-fg py-8">
              <div className="w-16 h-16 rounded-full bg-monokai-yellow/10 flex items-center justify-center mb-3">
                <span className="i-lucide-sticky-note w-8 h-8 text-monokai-yellow/50" />
              </div>
              <p className="text-sm font-medium text-monokai-fg">暂无笔记</p>
              <p className="text-xs mt-1 text-monokai-fg/80">选中教程中的文字即可添加笔记</p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className="bg-[#282a36]/50 rounded-xl p-4 border border-monokai-accent/20 hover:border-monokai-yellow/30 transition-all group hover:shadow-lg hover:shadow-monokai-yellow/5"
              >
                {/* 所属教程 */}
                <div className="flex items-center gap-1.5 text-[10px] text-monokai-blue mb-2">
                  <span className="i-lucide-file-text w-3 h-3" />
                  <span className="truncate">{note.tutorialTitle}</span>
                </div>
                
                {/* 选中的文本 */}
                <div className="text-xs text-monokai-fg mb-3 line-clamp-2 italic border-l-2 border-monokai-purple/40 pl-2.5 py-0.5 bg-monokai-purple/5 rounded-r">
                  "{note.selectedText}"
                </div>
                
                {/* 笔记内容 */}
                <div className="text-sm text-monokai-fg mb-3 whitespace-pre-wrap leading-relaxed">
                  {note.noteContent}
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center justify-between pt-2 border-t border-monokai-accent/10">
                  <span className="text-[10px] text-monokai-fg flex items-center gap-1">
                    <span className="i-lucide-clock w-3 h-3" />
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onNoteClick?.(note)}
                      className="text-[10px] px-2 py-1 text-monokai-blue hover:bg-monokai-blue/10 rounded transition-colors"
                    >
                      定位
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-[10px] px-2 py-1 text-monokai-red/70 hover:text-monokai-red hover:bg-monokai-red/10 rounded transition-colors"
                    >
                      删除
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
