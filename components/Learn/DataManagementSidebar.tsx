import React, { useState, useEffect } from 'react';
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
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      <div className={`fixed inset-y-0 right-0 w-[480px] bg-[#21222c] border-l border-monokai-accent/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-monokai-accent/30 bg-[#282a36]/50">
          <h3 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
            <span className="i-lucide-database w-4 h-4 text-monokai-green" />
            数据管理
          </h3>
          <button
            onClick={onClose}
            className="text-monokai-comment hover:text-monokai-fg transition-colors p-1 rounded hover:bg-monokai-accent/20"
          >
            <span className="i-lucide-x w-5 h-5" />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mx-4 mt-3 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-monokai-green/10 border border-monokai-green/30 text-monokai-green'
              : 'bg-monokai-pink/10 border border-monokai-pink/30 text-monokai-pink'
          }`}>
            {message.text}
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {/* 数据统计 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="i-lucide-bar-chart-2 w-4 h-4" />
              数据统计
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
                <div className="text-xl font-bold text-monokai-blue">{stats?.progressCount || 0}</div>
                <div className="text-xs text-monokai-comment">学习进度</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
                <div className="text-xl font-bold text-monokai-yellow">{stats?.notesCount || 0}</div>
                <div className="text-xs text-monokai-comment">学习笔记</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
                <div className="text-xl font-bold text-monokai-pink">{stats?.favoritesCount || 0}</div>
                <div className="text-xs text-monokai-comment">收藏教程</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
                <div className="text-xl font-bold text-monokai-purple">{stats?.codeSnippetsCount || 0}</div>
                <div className="text-xs text-monokai-comment">代码片段</div>
              </div>
            </div>
          </div>

          {/* 导出功能 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="i-lucide-download w-4 h-4" />
              导出数据
            </h4>

            {/* 一键导出 */}
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full py-3 bg-monokai-blue/20 hover:bg-monokai-blue/30 border border-monokai-blue/30 rounded-lg text-monokai-blue text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
            >
              <span className="i-lucide-download w-4 h-4" />
              {isExporting ? '导出中...' : '一键导出全部数据'}
            </button>

            {/* 选择性导出 */}
            <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
              <div className="text-xs text-monokai-comment mb-2">选择性导出：</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeProgress}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeProgress: e.target.checked }))}
                    className="rounded border-monokai-accent"
                  />
                  <span className="text-monokai-fg">学习进度</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeNotes}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                    className="rounded border-monokai-accent"
                  />
                  <span className="text-monokai-fg">学习笔记</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeFavorites}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeFavorites: e.target.checked }))}
                    className="rounded border-monokai-accent"
                  />
                  <span className="text-monokai-fg">收藏教程</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeCodeSnippets}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeCodeSnippets: e.target.checked }))}
                    className="rounded border-monokai-accent"
                  />
                  <span className="text-monokai-fg">代码片段</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeSettings}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
                    className="rounded border-monokai-accent"
                  />
                  <span className="text-monokai-fg">个人设置</span>
                </label>
              </div>
              <button
                onClick={handleExportSelected}
                disabled={isExporting || (!exportOptions.includeProgress && !exportOptions.includeNotes && !exportOptions.includeFavorites && !exportOptions.includeCodeSnippets && !exportOptions.includeSettings)}
                className="w-full py-2 bg-monokai-accent/20 hover:bg-monokai-accent/30 border border-monokai-accent/30 rounded-lg text-monokai-fg text-xs font-medium transition-colors disabled:opacity-50"
              >
                导出选中数据
              </button>
            </div>
          </div>

          {/* 导入功能 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="i-lucide-upload w-4 h-4" />
              导入数据
            </h4>

            <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30">
              {/* 导入模式选择 */}
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="border-monokai-accent"
                  />
                  <span className="text-monokai-fg">合并（保留现有）</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="border-monokai-accent"
                  />
                  <span className="text-monokai-fg">替换（覆盖现有）</span>
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
                <div className="w-full py-3 bg-monokai-green/10 hover:bg-monokai-green/20 border border-monokai-green/30 rounded-lg text-monokai-green text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  <span className="i-lucide-upload w-4 h-4" />
                  {isImporting ? '导入中...' : '选择 JSON 文件导入'}
                </div>
              </label>

              <p className="text-[10px] text-monokai-comment mt-2">
                提示：合并模式会保留现有数据，仅新增不重复的内容
              </p>
            </div>
          </div>

          {/* 自动备份设置 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="i-lucide-clock w-4 h-4" />
              自动备份
            </h4>

            <div className="bg-monokai-bg/50 rounded-lg p-3 border border-monokai-accent/30 space-y-3">
              {/* 开关 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-monokai-fg">开启自动备份</span>
                <button
                  onClick={handleAutoBackupToggle}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    autoBackupEnabled ? 'bg-monokai-green' : 'bg-monokai-accent'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    autoBackupEnabled ? 'translate-x-6' : 'translate-x-0.5'
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
                        className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                          autoBackupInterval === interval
                            ? 'bg-monokai-blue text-white'
                            : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                        }`}
                      >
                        {interval === 'daily' ? '每天' : interval === 'weekly' ? '每周' : '每月'}
                      </button>
                    ))}
                  </div>

                  {/* 最后备份时间 */}
                  {stats?.lastBackup && (
                    <div className="text-xs text-monokai-comment">
                      上次备份：{new Date(stats.lastBackup).toLocaleString()}
                    </div>
                  )}

                  {/* 手动备份按钮 */}
                  <button
                    onClick={handleManualBackup}
                    className="w-full py-2 bg-monokai-accent/20 hover:bg-monokai-accent/30 border border-monokai-accent/30 rounded-lg text-monokai-fg text-xs font-medium transition-colors"
                  >
                    立即备份
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 危险区域 */}
          <div>
            <h4 className="text-xs font-bold text-monokai-pink uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="i-lucide-alert-triangle w-4 h-4" />
              危险操作
            </h4>

            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="w-full py-3 bg-monokai-pink/10 hover:bg-monokai-pink/20 border border-monokai-pink/30 rounded-lg text-monokai-pink text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="i-lucide-trash-2 w-4 h-4" />
              {isClearing ? '清除中...' : '清除所有学习数据'}
            </button>

            <p className="text-[10px] text-monokai-comment mt-2">
              警告：此操作将永久删除所有学习进度、笔记、收藏和代码片段，且无法恢复！
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="p-3 border-t border-monokai-accent/30 text-[10px] text-monokai-comment text-center">
          数据将导出为 JSON 格式，可在任意时间导入恢复
        </div>
      </div>
    </>
  );
};

export default DataManagementSidebar;
