/**
 * AbstractionExportDialog — 导入导出（ModalShell）
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileJson,
  Clipboard,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  importAbstractionTables,
  downloadAsFile,
  exportToClipboard,
  importFromClipboard,
  importFromFile,
} from '../../utils/abstractionImportExport';
import { ActionButton, FormTextarea, ModalShell, SegmentedTabs } from '../ui/Workbench';

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
  const [mode, setMode] = useState<'export' | 'import'>('export');
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
      setResult(
        success
          ? { success: true, message: '导出成功，内容已复制到剪贴板' }
          : { success: false, message: '导出失败：无法访问剪贴板' }
      );
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
        setResult({ success: false, message: `导入失败: ${importResult.errors.join('; ')}` });
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
        setResult({ success: false, message: `导入失败: ${importResult.errors.join('; ')}` });
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
    try {
      const importResult = await importFromFile(file, { skipExisting: true });
      if (importResult.success) {
        setResult({
          success: true,
          message: `导入成功：${importResult.imported} 个，${importResult.skipped} 个已跳过`,
        });
      } else {
        setResult({ success: false, message: `导入失败: ${importResult.errors.join('; ')}` });
      }
    } catch (err) {
      setResult({ success: false, message: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="导入 / 导出"
      description="备份或分享抽象表 JSON"
      icon={Download}
      iconColor="text-monokai-amethyst"
      size="sm"
    >
      <div className="space-y-4">
        <SegmentedTabs
          aria-label="导入导出模式"
          value={mode}
          onChange={value => {
            setMode(value);
            setResult(null);
          }}
          tone="amethyst"
          size="sm"
          items={[
            { value: 'export' as const, label: '导出', icon: Download },
            { value: 'import' as const, label: '导入', icon: Upload },
          ]}
        />

        {mode === 'export' ? (
          <div className="space-y-3">
            <p className="text-xs text-monokai-comment leading-relaxed">
              将抽象表导出为 JSON，可用于备份或分享。
            </p>
            <ActionButton
              variant="amethyst"
              size="sm"
              icon={FileJson}
              loading={isExporting}
              onClick={handleExportFile}
              className="w-full"
            >
              下载 JSON 文件
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Clipboard}
              loading={isExporting}
              onClick={handleExportClipboard}
              className="w-full"
            >
              复制到剪贴板
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-monokai-comment leading-relaxed">
              从 JSON 文件或剪贴板导入抽象表（已存在项将跳过）。
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <ActionButton
              variant="amethyst"
              size="sm"
              icon={FileJson}
              loading={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              选择 JSON 文件
            </ActionButton>
            <div className="text-center text-2xs text-monokai-comment">或</div>
            <FormTextarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="粘贴 JSON 数据..."
              rows={4}
              fontVariant="mono"
            />
            <ActionButton
              variant="success"
              size="sm"
              loading={isImporting}
              disabled={!importText.trim()}
              onClick={handleImportText}
              className="w-full"
            >
              导入文本
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              icon={Clipboard}
              loading={isImporting}
              onClick={handleImportClipboard}
              className="w-full"
            >
              从剪贴板导入
            </ActionButton>
          </div>
        )}

        {result && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 ${
              result.success
                ? 'border-monokai-accent/30 bg-monokai-accent/10'
                : 'border-monokai-pink/30 bg-monokai-pink/10'
            }`}
            role="status"
          >
            {result.success ? (
              <Check className="h-4 w-4 shrink-0 text-monokai-accent" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-monokai-pink" aria-hidden="true" />
            )}
            <p className={`text-xs ${result.success ? 'text-monokai-accent' : 'text-monokai-pink'}`}>
              {result.message}
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default AbstractionExportDialog;
