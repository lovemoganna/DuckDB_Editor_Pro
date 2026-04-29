/**
 * AbstractionExportDialog — 导入导出对话框
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileJson,
  Clipboard,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  exportAbstractionTables,
  importAbstractionTables,
  downloadAsFile,
  exportToClipboard,
  importFromClipboard,
} from '../../utils/abstractionImportExport';

interface AbstractionExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableIds?: string[];
}

export const AbstractionExportDialog: React.FC<AbstractionExportDialogProps> = ({
  isOpen,
  onClose,
  tableIds,
}) => {
  const [mode, setMode] = useState<'menu' | 'export' | 'import'>('menu');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportFile = async () => {
    setIsExporting(true);
    setResult(null);
    try {
      await downloadAsFile(undefined, tableIds);
      setResult({ success: true, message: '导出成功，文件已下载' });
    } catch (e) {
      setResult({ success: false, message: `导出失败: ${e instanceof Error ? e.message : '未知错误'}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClipboard = async () => {
    setIsExporting(true);
    setResult(null);
    try {
      const success = await exportToClipboard(tableIds);
      if (success) {
        setResult({ success: true, message: '导出成功，内容已复制到剪贴板' });
      } else {
        setResult({ success: false, message: '导出失败：无法访问剪贴板' });
      }
    } catch (e) {
      setResult({ success: false, message: `导出失败: ${e instanceof Error ? e.message : '未知错误'}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportText = async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    setResult(null);
    try {
      const importResult = await importAbstractionTables(importText, { skipExisting: true });
      if (importResult.success) {
        setResult({
          success: true,
          message: `导入成功：${importResult.imported} 个，${importResult.skipped} 个已跳过`,
        });
        setImportText('');
      } else {
        setResult({
          success: false,
          message: `导入失败: ${importResult.errors.join('; ')}`,
        });
      }
    } catch (e) {
      setResult({ success: false, message: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportClipboard = async () => {
    setIsImporting(true);
    setResult(null);
    try {
      const importResult = await importFromClipboard({ skipExisting: true });
      if (importResult.success) {
        setResult({
          success: true,
          message: `导入成功：${importResult.imported} 个，${importResult.skipped} 个已跳过`,
        });
      } else {
        setResult({
          success: false,
          message: `导入失败: ${importResult.errors.join('; ')}`,
        });
      }
    } catch (e) {
      setResult({ success: false, message: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    const { importFromFile } = await import('../../utils/abstractionImportExport');
    try {
      const importResult = await importFromFile(file, { skipExisting: true });
      if (importResult.success) {
        setResult({
          success: true,
          message: `导入成功：${importResult.imported} 个，${importResult.skipped} 个已跳过`,
        });
      } else {
        setResult({
          success: false,
          message: `导入失败: ${importResult.errors.join('; ')}`,
        });
      }
    } catch (err) {
      setResult({ success: false, message: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-monokai-bg border border-monokai-accent rounded-lg w-full max-w-md overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-accent">
          <h3 className="text-lg font-bold text-monokai-fg">导入/导出</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-monokai-accent/30 text-monokai-comment"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-monokai-accent">
          <button
            onClick={() => { setMode('export'); setResult(null); }}
            className={`flex-1 px-4 py-2 text-sm ${mode === 'export' ? 'text-monokai-purple border-b-2 border-monokai-purple' : 'text-monokai-comment hover:text-monokai-fg'}`}
          >
            <Download className="w-4 h-4 inline mr-1" />
            导出
          </button>
          <button
            onClick={() => { setMode('import'); setResult(null); }}
            className={`flex-1 px-4 py-2 text-sm ${mode === 'import' ? 'text-monokai-purple border-b-2 border-monokai-purple' : 'text-monokai-comment hover:text-monokai-fg'}`}
          >
            <Upload className="w-4 h-4 inline mr-1" />
            导入
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {mode === 'export' ? (
            <div className="space-y-3">
              <p className="text-sm text-monokai-comment">
                将抽象表导出为 JSON 格式，可以备份或分享给其他人。
              </p>

              <button
                onClick={handleExportFile}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-monokai-purple text-white rounded-lg text-sm hover:bg-monokai-purple/80 disabled:opacity-50"
              >
                <FileJson className="w-4 h-4" />
                {isExporting ? '导出中...' : '下载 JSON 文件'}
              </button>

              <button
                onClick={handleExportClipboard}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-monokai-blue/20 text-monokai-blue rounded-lg text-sm hover:bg-monokai-blue/30 disabled:opacity-50"
              >
                <Clipboard className="w-4 h-4" />
                复制到剪贴板
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-monokai-comment">
                从 JSON 文件或剪贴板导入抽象表。
              </p>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-monokai-purple text-white rounded-lg text-sm hover:bg-monokai-purple/80 disabled:opacity-50"
              >
                <FileJson className="w-4 h-4" />
                {isImporting ? '导入中...' : '选择 JSON 文件'}
              </button>

              <div className="text-center text-xs text-monokai-comment">或</div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="粘贴 JSON 数据..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-monokai-sidebar border border-monokai-accent rounded-lg text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-purple resize-none"
              />
              <button
                onClick={handleImportText}
                disabled={isImporting || !importText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-monokai-green/20 text-monokai-green rounded-lg text-sm hover:bg-monokai-green/30 disabled:opacity-50"
              >
                导入文本
              </button>

              <button
                onClick={handleImportClipboard}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-monokai-accent/20 text-monokai-comment rounded-lg text-sm hover:text-monokai-fg disabled:opacity-50"
              >
                <Clipboard className="w-4 h-4" />
                从剪贴板导入
              </button>
            </div>
          )}

          {/* 结果 */}
          {result && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              result.success ? 'bg-monokai-green/10 border border-monokai-green/30' : 'bg-monokai-red/10 border border-monokai-red/30'
            }`}>
              {result.success ? (
                <Check className="w-4 h-4 text-monokai-green flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-monokai-red flex-shrink-0" />
              )}
              <p className={`text-xs ${result.success ? 'text-monokai-green' : 'text-monokai-red'}`}>
                {result.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbstractionExportDialog;
