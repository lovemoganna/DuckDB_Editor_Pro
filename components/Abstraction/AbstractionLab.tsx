/**
 * AbstractionLab — 实验台
 *
 * 改进：
 * - 紧凑头部：显示 SQL 状态、版本数、执行结果
 * - Tab 标签页更醒目
 * - 版本历史改为底部状态栏，非侧边栏抽屉
 * - "保存模板"按钮在 Tab 栏右侧
 */

import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  Save,
  RotateCcw,
  History,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { useAbstractionSandbox } from '../../hooks/useAbstractionSandbox';
import { SandboxEditor } from './SandboxEditor';
import { SandboxResults } from './SandboxResults';
import { SandboxAIPanel } from './SandboxAIPanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';

interface AbstractionLabProps {
  initialSql?: string;
  onInsertSql?: (sql: string) => void;
}

export const AbstractionLab: React.FC<AbstractionLabProps> = ({
  initialSql,
  onInsertSql,
}) => {
  const [showVersions, setShowVersions] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDomain, setSaveDomain] = useState('通用');

  const sandboxTab = useAnalysisHubStore(s => s.sandboxTab);
  const setSandboxTab = useAnalysisHubStore(s => s.setSandboxTab);
  const sandboxSql = useAnalysisHubStore(s => s.sandboxSql);
  const sandboxDraftName = useAnalysisHubStore(s => s.sandboxDraftName);
  const setSandboxSql = useAnalysisHubStore(s => s.setSandboxSql);
  const setSandboxDraftName = useAnalysisHubStore(s => s.setSandboxDraftName);
  const sandboxResult = useAnalysisHubStore(s => s.sandboxResult);
  const sandboxError = useAnalysisHubStore(s => s.sandboxError);
  const isGenerating = useAnalysisHubStore(s => s.isGenerating);
  const domains = useAnalysisHubStore(s => s.domains);

  const {
    handleClearDraft,
    saveVersion,
    getVersions,
    restoreVersion,
    clearVersions,
  } = useAbstractionSandbox();

  useEffect(() => {
    if (initialSql) setSandboxSql(initialSql);
  }, [initialSql, setSandboxSql]);

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    await useAnalysisHubStore.getState().saveSandboxAsTemplate(saveName.trim(), saveDomain);
    setShowSaveDialog(false);
    setSaveName('');
  };

  const versions = getVersions();
  const hasResult = Boolean(sandboxResult);
  const hasError = Boolean(sandboxError);

  return (
    <div className="h-full flex flex-col bg-monokai-bg font-sans">
      {/* 紧凑头部 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-monokai-surface border-b border-monokai-border">
        {/* 左侧：标题 + 草稿名 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-monokai-purple" />
            <span className="text-sm font-semibold text-monokai-fg">实验台</span>
          </div>
          <input
            type="text"
            value={sandboxDraftName}
            onChange={(e) => setSandboxDraftName(e.target.value)}
            className="text-xs text-monokai-fg-muted bg-transparent border-none focus:outline-none focus:ring-0 w-36"
          />
        </div>

        {/* 中间：Tab */}
        <nav className="flex items-center gap-0.5 bg-monokai-bg rounded-lg p-0.5">
          {([
            { key: 'editor', label: '编辑器' },
            { key: 'results', label: '结果' },
            { key: 'ai', label: 'AI 协作' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSandboxTab(key)}
              className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                sandboxTab === key
                  ? 'bg-monokai-purple/20 text-monokai-purple font-medium shadow-sm'
                  : 'text-monokai-fg-muted hover:text-monokai-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 执行状态指示 */}
          {isGenerating && (
            <div className="flex items-center gap-1.5 text-xs text-monokai-purple">
              <Loader2 className="w-3 h-3 animate-spin" />
              执行中
            </div>
          )}
          {!isGenerating && hasResult && (
            <div className="flex items-center gap-1 text-xs text-monokai-green">
              <CheckCircle className="w-3 h-3" />
              执行成功
            </div>
          )}
          {!isGenerating && hasError && (
            <div className="flex items-center gap-1 text-xs text-monokai-pink">
              <AlertCircle className="w-3 h-3" />
              执行失败
            </div>
          )}

          <div className="w-px h-4 bg-monokai-border" />

          {/* 版本历史 */}
          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              showVersions
                ? 'bg-monokai-purple/15 text-monokai-purple'
                : 'text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-bg'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            历史
            {versions.length > 0 && (
              <span className={`ml-0.5 px-1 py-0.5 text-[10px] rounded-full ${
                showVersions ? 'bg-monokai-purple/30' : 'bg-monokai-bg'
              }`}>
                {versions.length}
              </span>
            )}
          </button>

          {/* 保存模板 */}
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!sandboxSql.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-monokai-blue text-white hover:bg-monokai-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            保存模板
          </button>

          {/* 清空 */}
          <button
            onClick={handleClearDraft}
            className="p-1.5 rounded-md text-monokai-fg-muted hover:text-monokai-fg hover:bg-monokai-bg transition-colors"
            title="清空"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 版本历史抽屉（从底部滑出） */}
      {showVersions && (
        <div className="h-48 border-t border-monokai-border bg-monokai-surface">
          <VersionHistoryPanel
            versions={versions}
            onRestore={restoreVersion}
            onClear={clearVersions}
          />
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {sandboxTab === 'editor' && <SandboxEditor />}
        {sandboxTab === 'results' && <SandboxResults />}
        {sandboxTab === 'ai' && <SandboxAIPanel />}
      </div>

      {/* 保存模板对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)} />
          <div className="relative bg-monokai-surface border border-monokai-border rounded-xl shadow-2xl w-96 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-monokai-border">
              <h3 className="text-sm font-semibold text-monokai-fg">保存为模板</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="p-1 rounded-md hover:bg-monokai-bg text-monokai-fg-muted hover:text-monokai-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">模板名称</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="例如：日活统计"
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg placeholder-monokai-fg-muted/50 focus:outline-none focus:border-monokai-purple transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-monokai-fg-muted mb-1.5">所属领域</label>
                <select
                  value={saveDomain}
                  onChange={(e) => setSaveDomain(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-monokai-bg border border-monokai-border rounded-lg text-monokai-fg focus:outline-none focus:border-monokai-purple transition-colors"
                >
                  {[...new Set(domains)].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-sm text-monokai-fg-muted hover:text-monokai-fg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!saveName.trim()}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-monokai-purple text-white hover:bg-monokai-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbstractionLab;
