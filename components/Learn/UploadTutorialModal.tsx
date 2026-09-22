import React, { useState, useRef } from 'react';
import {
  saveUserTutorial,
  extractTitleFromMarkdown,
  extractDifficultyFromMarkdown,
  extractCategoryFromMarkdown,
  generateTutorialId,
  UserTutorial,
} from '../../services/userTutorialStorage';
import { Link, FileUp, Loader2, AlertCircle, X, Check } from 'lucide-react';

interface UploadTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadTutorialModal: React.FC<UploadTutorialModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [difficulty, setDifficulty] = useState<UserTutorial['difficulty']>('Beginner');
  const [category, setCategory] = useState<string>('我的教程');
  const [tags, setTags] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导入模式（文件/URL）
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.md')) {
      setError('请选择 .md 格式的 Markdown 文件');
      return;
    }

    try {
      const text = await selectedFile.text();
      setFile(selectedFile);
      setContent(text);

      const extractedTitle = extractTitleFromMarkdown(text);
      setTitle(extractedTitle);

      const extractedDifficulty = extractDifficultyFromMarkdown(text);
      setDifficulty(extractedDifficulty);

      const extractedCategory = extractCategoryFromMarkdown(text);
      setCategory(extractedCategory);

      setError('');
    } catch (err) {
      setError('文件读取失败，请重试');
      console.error('File read error:', err);
    }
  };

  // 从 URL 获取 Markdown 内容
  const handleUrlFetch = async () => {
    if (!url.trim()) {
      setError('请输入有效的 URL 地址');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('请输入有效的 URL 地址');
      return;
    }

    setIsFetching(true);
    setError('');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      if (!text.trim()) {
        setError('获取的内容为空');
        return;
      }

      setContent(text);

      const extractedTitle = extractTitleFromMarkdown(text);
      setTitle(extractedTitle || '从 URL 导入的教程');

      const extractedDifficulty = extractDifficultyFromMarkdown(text);
      setDifficulty(extractedDifficulty);

      const extractedCategory = extractCategoryFromMarkdown(text);
      setCategory(extractedCategory || '在线教程');

      setError('');
    } catch (err: any) {
      setError(`从 URL 获取失败: ${err.message}`);
      console.error('URL fetch error:', err);
    } finally {
      setIsFetching(false);
    }
  };

  // 保存教程
  const handleSave = async () => {
    if (!content.trim()) {
      setError('教程内容不能为空');
      return;
    }

    if (!title.trim()) {
      setError('请输入教程标题');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tutorial: UserTutorial = {
        id: generateTutorialId(),
        title: title.trim(),
        content: content.trim(),
        difficulty,
        category: category.trim() || '我的教程',
        tags: tags.split(/[,， ]+/).map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveUserTutorial(tutorial);
      onSuccess();
      handleClose();
    } catch (err) {
      setError('保存失败，请重试');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 关闭并重置表单
  const handleClose = () => {
    setFile(null);
    setContent('');
    setTitle('');
    setDifficulty('Beginner');
    setCategory('我的教程');
    setTags('');
    setError('');
    setUrl('');
    setImportMode('file');
    onClose();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans select-none">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={handleClose}
      />

      {/* 模态框 */}
      <div className="relative w-full max-w-lg mx-4 bg-[#12171f] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0c1015]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileUp className="w-4 h-4 text-cyan-400" />
            <span>导入自定义 Markdown 课程</span>
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* 导入方式切换 */}
          <div className="flex gap-2 mb-1">
            <button
              onClick={() => { setImportMode('file'); setError(''); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                importMode === 'file'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-xs'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              本地文件 (.md)
            </button>
            <button
              onClick={() => { setImportMode('url'); setError(''); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                importMode === 'url'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-xs'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              网络链接 (URL)
            </button>
          </div>

          {/* 文件选择 - 仅在文件模式下显示 */}
          {importMode === 'file' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                选择 Markdown 文件
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                onChange={handleFileChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30 cursor-pointer"
              />
              {file && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  已选择: {file.name}
                </p>
              )}
            </div>
          )}

          {/* URL 导入 - 仅在 URL 模式下显示 */}
          {importMode === 'url' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                输入 Markdown 文件 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/tutorial.md"
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                  onClick={handleUrlFetch}
                  disabled={isFetching}
                  className="px-3 py-1.5 bg-zinc-800 text-cyan-400 border border-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>获取中</span>
                    </>
                  ) : (
                    <>
                      <Link className="w-3.5 h-3.5" />
                      <span>获取</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 标题 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              教程标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入教程标题"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* 难度选择 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              难度级别
            </label>
            <div className="flex gap-2">
              {(['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    difficulty === level
                      ? level === 'Beginner'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : level === 'Intermediate'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : level === 'Advanced'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {level === 'Beginner' ? '入门' :
                   level === 'Intermediate' ? '进阶' :
                   level === 'Advanced' ? '高级' : '专家'}
                </button>
              ))}
            </div>
          </div>

          {/* 分类 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              所属分类
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="我的教程"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* 标签 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              标签 <span className="text-zinc-500 font-normal">(用逗号分隔)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="SQL, 数据库, 入门"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* 预览提示 */}
          {content && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg space-y-1">
              <div className="text-[11px] font-mono text-cyan-400 font-bold">内容预览 ({content.length} 字符)</div>
              <div className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">{content.slice(0, 200)}...</div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-zinc-800 bg-[#0c1015]">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !content}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              loading || !content
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-sm active:scale-95'
            }`}
          >
            {loading ? '保存中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadTutorialModal;
