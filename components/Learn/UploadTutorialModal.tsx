import React, { useState, useRef } from 'react';
import {
  saveUserTutorial,
  extractTitleFromMarkdown,
  extractDifficultyFromMarkdown,
  extractCategoryFromMarkdown,
  generateTutorialId,
  UserTutorial,
} from '../../services/userTutorialStorage';
import { Link, FileUp, Loader2, AlertCircle } from 'lucide-react';

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

  // 新增：导入模式（文件/URL）
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 检查文件类型
    if (!selectedFile.name.endsWith('.md')) {
      setError('请选择 .md 格式的 Markdown 文件');
      return;
    }

    // 读取文件内容
    try {
      const text = await selectedFile.text();
      setFile(selectedFile);
      setContent(text);

      // 自动提取标题
      const extractedTitle = extractTitleFromMarkdown(text);
      setTitle(extractedTitle);

      // 自动判断难度
      const extractedDifficulty = extractDifficultyFromMarkdown(text);
      setDifficulty(extractedDifficulty);

      // 自动设置分类
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

    // 验证 URL 格式
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
      
      // 检查内容是否为有效的 Markdown
      if (!text.trim()) {
        setError('获取的内容为空');
        return;
      }

      setContent(text);

      // 自动提取标题
      const extractedTitle = extractTitleFromMarkdown(text);
      setTitle(extractedTitle);

      // 自动判断难度
      const extractedDifficulty = extractDifficultyFromMarkdown(text);
      setDifficulty(extractedDifficulty);

      // 自动设置分类
      const extractedCategory = extractCategoryFromMarkdown(text);
      setCategory(extractedCategory);

    } catch (err) {
      console.error('URL fetch error:', err);
      setError('获取失败，请检查 URL 是否正确或是否存在跨域问题');
    } finally {
      setIsFetching(false);
    }
  };

  // 处理保存
  const handleSave = async () => {
    if (!content) {
      setError('请先选择 Markdown 文件或输入 URL 获取内容');
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
        content,
        category,
        difficulty,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
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
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 模态框 */}
      <div className="relative w-full max-w-lg mx-4 bg-monokai-sidebar border border-monokai-accent rounded-xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-accent/50">
          <h2 className="text-lg font-bold text-white">上传教程</h2>
          <button
            onClick={handleClose}
            className="text-monokai-comment hover:text-white transition-colors"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 导入方式切换 */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => { setImportMode('file'); setError(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                importMode === 'file'
                  ? 'bg-monokai-blue/20 text-monokai-blue border border-monokai-blue/50'
                  : 'bg-monokai-bg text-monokai-comment border border-monokai-accent/30 hover:border-monokai-accent/60'
              }`}
            >
              <FileUp className="w-4 h-4" />
              本地文件
            </button>
            <button
              onClick={() => { setImportMode('url'); setError(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                importMode === 'url'
                  ? 'bg-monokai-blue/20 text-monokai-blue border border-monokai-blue/50'
                  : 'bg-monokai-bg text-monokai-comment border border-monokai-accent/30 hover:border-monokai-accent/60'
              }`}
            >
              <Link className="w-4 h-4" />
              网络链接
            </button>
          </div>

          {/* 文件选择 - 仅在文件模式下显示 */}
          {importMode === 'file' && (
            <div>
              <label className="block text-sm text-monokai-fg mb-2">
                选择 Markdown 文件
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                onChange={handleFileChange}
                className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent/50 rounded-lg text-sm text-monokai-fg file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-monokai-blue/20 file:text-monokai-blue hover:file:bg-monokai-blue/30 cursor-pointer"
              />
              {file && (
                <p className="mt-1 text-xs text-monokai-green">
                  已选择: {file.name}
                </p>
              )}
            </div>
          )}

          {/* URL 导入 - 仅在 URL 模式下显示 */}
          {importMode === 'url' && (
            <div>
              <label className="block text-sm text-monokai-fg mb-2">
                输入 Markdown 文件 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/tutorial.md"
                  className="flex-1 px-3 py-2 bg-monokai-bg border border-monokai-accent/50 rounded-lg text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
                />
                <button
                  onClick={handleUrlFetch}
                  disabled={isFetching}
                  className="px-4 py-2 bg-monokai-blue/20 text-monokai-blue rounded-lg text-sm font-medium hover:bg-monokai-blue/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      获取中
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      获取
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-monokai-comment">
                支持 .md 文件的直接链接，部分网站可能因跨域限制无法获取
              </p>
            </div>
          )}

          {/* 标题 */}
          <div>
            <label className="block text-sm text-monokai-fg mb-2">
              教程标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入教程标题"
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent/50 rounded-lg text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
          </div>

          {/* 难度选择 */}
          <div>
            <label className="block text-sm text-monokai-fg mb-2">
              难度级别
            </label>
            <div className="flex gap-2">
              {(['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    difficulty === level
                      ? level === 'Beginner'
                        ? 'bg-monokai-green/20 text-monokai-green border border-monokai-green/50'
                        : level === 'Intermediate'
                        ? 'bg-monokai-orange/20 text-monokai-orange border border-monokai-orange/50'
                        : level === 'Advanced'
                        ? 'bg-monokai-purple/20 text-monokai-purple border border-monokai-purple/50'
                        : 'bg-monokai-blue/20 text-monokai-blue border border-monokai-blue/50'
                      : 'bg-monokai-bg text-monokai-comment border border-monokai-accent/30 hover:border-monokai-accent/60'
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
          <div>
            <label className="block text-sm text-monokai-fg mb-2">
              分类
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="我的教程"
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent/50 rounded-lg text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="block text-sm text-monokai-fg mb-2">
              标签 <span className="text-monokai-comment">(用逗号分隔)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="SQL, 数据库, 入门"
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-accent/50 rounded-lg text-sm text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-blue"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg text-sm text-monokai-pink flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 预览提示 */}
          {content && (
            <div className="p-3 bg-monokai-blue/10 border border-monokai-blue/30 rounded-lg">
              <div className="text-xs text-monokai-blue mb-1">内容预览</div>
              <div className="text-sm text-monokai-fg line-clamp-3">{content.slice(0, 200)}...</div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-monokai-accent/50 bg-monokai-bg/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-monokai-comment hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !content}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              loading || !content
                ? 'bg-monokai-accent/30 text-monokai-comment cursor-not-allowed'
                : 'bg-monokai-blue text-white hover:bg-monokai-blue/80'
            }`}
          >
            {loading ? '保存中...' : '保存教程'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadTutorialModal;
