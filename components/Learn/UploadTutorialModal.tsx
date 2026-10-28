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
import { ModalShell, ActionButton, FormInput } from '../ui/Workbench';

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

  return (
    <ModalShell
      open={isOpen}
      onClose={handleClose}
      title="导入自定义 Markdown 课程"
      description="上传本地 .md 文件或输入网络 URL 解析导入教程"
      icon={FileUp}
      iconColor="text-monokai-cyan"
      size="md"
      footer={
        <>
          <ActionButton variant="ghost" size="sm" onClick={handleClose}>
            取消
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={loading}
            disabled={!content}
          >
            确认导入
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4 text-xs font-sans">
        {/* 导入方式切换 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setImportMode('file'); setError(''); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              importMode === 'file'
                ? 'bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/40 shadow-xs'
                : 'bg-monokai-bg text-monokai-comment border border-monokai-border hover:text-monokai-fg'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            本地文件 (.md)
          </button>
          <button
            type="button"
            onClick={() => { setImportMode('url'); setError(''); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              importMode === 'url'
                ? 'bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/40 shadow-xs'
                : 'bg-monokai-bg text-monokai-comment border border-monokai-border hover:text-monokai-fg'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            网络链接 (URL)
          </button>
        </div>

        {/* 文件选择 - 仅在文件模式下显示 */}
        {importMode === 'file' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-monokai-fg">
              选择 Markdown 文件
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={handleFileChange}
              className="w-full px-3 py-2 bg-monokai-bg border border-monokai-border rounded-lg text-xs text-monokai-fg file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-monokai-accent/20 file:text-monokai-accent hover:file:bg-monokai-accent/30 cursor-pointer"
            />
            {file && (
              <p className="text-[11px] text-monokai-green flex items-center gap-1 font-mono">
                <Check className="w-3 h-3" />
                已选择: {file.name}
              </p>
            )}
          </div>
        )}

        {/* URL 导入 - 仅在 URL 模式下显示 */}
        {importMode === 'url' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-monokai-fg">
              输入 Markdown 文件 URL
            </label>
            <div className="flex gap-2">
              <FormInput
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/tutorial.md"
                fontVariant="mono"
              />
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleUrlFetch}
                loading={isFetching}
                icon={Link}
              >
                获取
              </ActionButton>
            </div>
          </div>
        )}

        {/* 标题 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">
            教程标题
          </label>
          <FormInput
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入教程标题"
          />
        </div>

        {/* 难度选择 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">
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
                      ? 'bg-monokai-green/20 text-monokai-green border border-monokai-green/50'
                      : level === 'Intermediate'
                      ? 'bg-monokai-yellow/20 text-monokai-yellow border border-monokai-yellow/50'
                      : level === 'Advanced'
                      ? 'bg-monokai-pink/20 text-monokai-pink border border-monokai-pink/50'
                      : 'bg-monokai-amethyst/20 text-monokai-amethyst border border-monokai-amethyst/50'
                    : 'bg-monokai-bg text-monokai-comment border border-monokai-border hover:text-monokai-fg'
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
          <label className="block text-xs font-semibold text-monokai-fg">
            所属分类
          </label>
          <FormInput
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="我的教程"
          />
        </div>

        {/* 标签 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-monokai-fg">
            标签 <span className="text-monokai-comment font-normal">(用逗号分隔)</span>
          </label>
          <FormInput
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="SQL, 数据库, 入门"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-monokai-pink/15 border border-monokai-pink/30 rounded-lg text-xs text-monokai-pink flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-monokai-pink" />
            <span>{error}</span>
          </div>
        )}

        {/* 预览提示 */}
        {content && (
          <div className="p-3 bg-monokai-surface border border-monokai-accent/30 rounded-lg space-y-1">
            <div className="text-[11px] font-mono text-monokai-accent font-bold">内容预览 ({content.length} 字符)</div>
            <div className="text-xs text-monokai-comment line-clamp-3 leading-relaxed">{content.slice(0, 200)}...</div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default UploadTutorialModal;
