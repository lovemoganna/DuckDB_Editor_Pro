import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  BarChart2,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  getDataStats,
  exportAllData,
  exportSelectedData,
  importData,
  downloadExportFile,
  readImportFile,
  clearAllData,
  loadSettings,
  saveSettings,
  autoBackup,
  LearnSettings
} from '../../services/learnDataManager';

interface DataManagementSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const DataManagementSidebar: React.FC<DataManagementSidebarProps> = ({
  isOpen,
  onClose,
  onDataChanged
}) => {
  const [stats, setStats] = useState<{
    progressCount: number;
    notesCount: number;
    favoritesCount: number;
    codeSnippetsCount: number;
    lastBackup?: string;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 选择性导出选项
  const [exportOptions, setExportOptions] = useState({
    includeProgress: true,
    includeNotes: true,
    includeFavorites: true,
    includeCodeSnippets: true,
    includeSettings: true
  });

  // 自动备份设置
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await getDataStats();
      setStats(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  // 加载设置
  useEffect(() => {
    const settings = loadSettings();
    setAutoBackupEnabled(settings.autoBackup || false);
    setAutoBackupInterval(settings.autoBackupInterval || 'weekly');
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 一键导出
  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      downloadExportFile(data);
      showMessage('success', '数据导出成功！');
      await loadStats();
    } catch (error) {
      showMessage('error', '导出失败：' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // 选择性导出
  const handleExportSelected = async () => {
    setIsExporting(true);
    try {
      const data = await exportSelectedData(exportOptions);
      downloadExportFile(data);
      showMessage('success', '选择性地数据导出成功！');
    } catch (error) {
      showMessage('error', '导出失败：' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // 导入数据
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage(null);

    try {
      const content = await readImportFile(file);
      const result = await importData(content, importMode);

      if (result.success) {
        const importedParts: string[] = [];
        if (result.imported.progress) importedParts.push(`${result.imported.progress} 个进度`);
        if (result.imported.notes) importedParts.push(`${result.imported.notes} 条笔记`);
        if (result.imported.favorites) importedParts.push(`${result.imported.favorites} 个收藏`);
        if (result.imported.codeSnippets) importedParts.push(`${result.imported.codeSnippets} 个代码片段`);
        if (result.imported.settings) importedParts.push('设置');

        showMessage('success', `导入成功！${importedParts.join('、')}`);
        await loadStats();
        onDataChanged?.();
      } else {
        showMessage('error', result.message);
      }
    } catch (error) {
      showMessage('error', '导入失败：' + (error as Error).message);
    } finally {
      setIsImporting(false);
      // 清空文件输入
      e.target.value = '';
    }
  };

  // 清除所有数据
  const handleClearAll = async () => {
    if (!confirm('确定要清除所有学习数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有进度、笔记、收藏将被永久删除！')) return;

    setIsClearing(true);
    try {
      const result = await clearAllData();
      if (result.success) {
        showMessage('success', result.message);
        await loadStats();
        onDataChanged?.();
      } else {
        showMessage('error', result.message);
      }
    } catch (error) {
      showMessage('error', '清除失败：' + (error as Error).message);
    } finally {
      setIsClearing(false);
    }
  };

  // 切换自动备份
  const handleAutoBackupToggle = () => {
    const newEnabled = !autoBackupEnabled;
    setAutoBackupEnabled(newEnabled);

    const settings = loadSettings();
    settings.autoBackup = newEnabled;
    settings.autoBackupInterval = newEnabled ? autoBackupInterval : undefined;
    saveSettings(settings);

    if (newEnabled) {
      autoBackup();
      showMessage('success', '自动备份已开启');
    } else {
      showMessage('success', '自动备份已关闭');
    }
  };

  // 更新自动备份间隔
  const handleIntervalChange = (interval: 'daily' | 'weekly' | 'monthly') => {
    setAutoBackupInterval(interval);

    const settings = loadSettings();
    settings.autoBackupInterval = interval;
    saveSettings(settings);
  };

  // 手动触发备份
  const handleManualBackup = async () => {
    await autoBackup();
    await loadStats();
    showMessage('success', '备份已保存到浏览器存储');
  };

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

      <div data-learn-sidebar role="dialog" aria-modal="true" aria-label="教程辅助侧栏" className={`fixed inset-y-0 right-0 w-[480px] max-w-full bg-monokai-sidebar border-l border-monokai-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-border bg-monokai-sidebar shrink-0">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <Database className="w-4 h-4 text-monokai-green" />
            <span>数据管理与备份</span>
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded-md hover:bg-monokai-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mx-4 mt-3 p-3 rounded-lg text-xs font-mono ${
            message.type === 'success'
              ? 'bg-monokai-green/10 border border-monokai-green/30 text-monokai-green'
              : 'bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink'
          }`}>
            {message.text}
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-monokai-bg">
          {/* 数据统计 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
              <BarChart2 className="w-3.5 h-3.5 text-monokai-yellow" />
              <span>数据统计</span>
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border">
                <div className="text-lg font-bold font-mono text-monokai-blue">{stats?.progressCount || 0}</div>
                <div className="text-xs text-monokai-comment">学习进度</div>
              </div>
              <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border">
                <div className="text-lg font-bold font-mono text-monokai-yellow">{stats?.notesCount || 0}</div>
                <div className="text-xs text-monokai-comment">学习笔记</div>
              </div>
              <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border">
                <div className="text-lg font-bold font-mono text-monokai-pink">{stats?.favoritesCount || 0}</div>
                <div className="text-xs text-monokai-comment">收藏教程</div>
              </div>
              <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border">
                <div className="text-lg font-bold font-mono text-monokai-amethyst">{stats?.codeSnippetsCount || 0}</div>
                <div className="text-xs text-monokai-comment">代码片段</div>
              </div>
            </div>
          </div>

          {/* 导出功能 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
              <Download className="w-3.5 h-3.5 text-monokai-blue" />
              <span>导出数据</span>
            </h4>

            {/* 一键导出 */}
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full py-2.5 bg-monokai-blue/15 hover:bg-monokai-blue/25 border border-monokai-blue/30 rounded-lg text-monokai-blue text-xs font-medium transition-colors flex items-center justify-center gap-2 mb-2.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? '导出中...' : '一键导出全部数据'}</span>
            </button>

            {/* 选择性导出 */}
            <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border space-y-2.5">
              <div className="text-xs text-monokai-comment">选择性导出：</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeProgress}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeProgress: e.target.checked }))}
                    className="rounded border-monokai-border bg-monokai-bg accent-monokai-blue"
                  />
                  <span>学习进度</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeNotes}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                    className="rounded border-monokai-border bg-monokai-bg accent-monokai-blue"
                  />
                  <span>学习笔记</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeFavorites}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeFavorites: e.target.checked }))}
                    className="rounded border-monokai-border bg-monokai-bg accent-monokai-blue"
                  />
                  <span>收藏教程</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeCodeSnippets}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeCodeSnippets: e.target.checked }))}
                    className="rounded border-monokai-border bg-monokai-bg accent-monokai-blue"
                  />
                  <span>代码片段</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg col-span-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeSettings}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
                    className="rounded border-monokai-border bg-monokai-bg accent-monokai-blue"
                  />
                  <span>个人设置</span>
                </label>
              </div>
              <button
                onClick={handleExportSelected}
                disabled={isExporting || (!exportOptions.includeProgress && !exportOptions.includeNotes && !exportOptions.includeFavorites && !exportOptions.includeCodeSnippets && !exportOptions.includeSettings)}
                className="w-full py-2 bg-monokai-sidebar hover:bg-monokai-surface border border-monokai-border rounded-md text-monokai-fg text-xs font-medium transition-colors disabled:opacity-50"
              >
                导出选中数据
              </button>
            </div>
          </div>

          {/* 导入功能 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
              <Upload className="w-3.5 h-3.5 text-monokai-green" />
              <span>导入数据</span>
            </h4>

            <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border space-y-2.5">
              {/* 导入模式选择 */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="border-monokai-border bg-monokai-bg accent-monokai-green"
                  />
                  <span>合并（保留现有）</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-monokai-fg">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="border-monokai-border bg-monokai-bg accent-monokai-green"
                  />
                  <span>替换（覆盖现有）</span>
                </label>
              </div>

              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={isImporting}
                  className="hidden"
                />
                <div className="w-full py-2.5 bg-monokai-green/10 hover:bg-monokai-green/20 border border-monokai-green/30 rounded-lg text-monokai-green text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isImporting ? '导入中...' : '选择 JSON 文件导入'}</span>
                </div>
              </label>

              <p className="text-[10px] text-monokai-comment">
                提示：合并模式会保留现有数据，仅新增不重复的内容
              </p>
            </div>
          </div>

          {/* 自动备份设置 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
              <Clock className="w-3.5 h-3.5 text-monokai-orange" />
              <span>自动备份</span>
            </h4>

            <div className="bg-monokai-surface rounded-lg p-3 border border-monokai-border space-y-3">
              {/* 开关 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-monokai-fg">开启自动备份</span>
                <button
                  onClick={handleAutoBackupToggle}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    autoBackupEnabled ? 'bg-monokai-green' : 'bg-monokai-border'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 备份间隔 */}
              {autoBackupEnabled && (
                <>
                  <div className="flex gap-2">
                    {(['daily', 'weekly', 'monthly'] as const).map(interval => (
                      <button
                        key={interval}
                        onClick={() => handleIntervalChange(interval)}
                        className={`flex-1 py-1 text-xs rounded transition-colors ${
                          autoBackupInterval === interval
                            ? 'bg-monokai-blue text-white font-medium'
                            : 'bg-monokai-bg text-monokai-comment hover:text-monokai-fg border border-monokai-border'
                        }`}
                      >
                        {interval === 'daily' ? '每天' : interval === 'weekly' ? '每周' : '每月'}
                      </button>
                    ))}
                  </div>

                  {/* 最后备份时间 */}
                  {stats?.lastBackup && (
                    <div className="text-xs text-monokai-comment font-mono">
                      上次备份：{new Date(stats.lastBackup).toLocaleString()}
                    </div>
                  )}

                  {/* 手动备份按钮 */}
                  <button
                    onClick={handleManualBackup}
                    className="w-full py-2 bg-monokai-sidebar hover:bg-monokai-bg border border-monokai-border rounded-md text-monokai-fg text-xs font-medium transition-colors"
                  >
                    立即备份
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 危险区域 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-pink uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>危险操作</span>
            </h4>

            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="w-full py-2.5 bg-monokai-pink/10 hover:bg-monokai-pink/20 border border-monokai-pink/30 rounded-lg text-monokai-pink text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearing ? '清除中...' : '清除所有学习数据'}</span>
            </button>

            <p className="text-[10px] text-monokai-comment mt-1.5">
              警告：此操作将永久删除所有学习进度、笔记、收藏和代码片段，且无法恢复！
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="p-3 border-t border-monokai-border bg-monokai-sidebar text-[10px] text-monokai-comment text-center font-mono shrink-0">
          数据将导出为 JSON 格式，可在任意时间导入恢复
        </div>
      </div>
    </>
  );
};

export default DataManagementSidebar;
