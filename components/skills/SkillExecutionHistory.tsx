import React, { useState, useMemo } from 'react';
import {
  History, Search, Play, Star, Clock, AlertCircle, Sparkles, ChevronRight, Check,
  Trash2, Filter, Calendar, Tag, Download, BarChart3
} from 'lucide-react';
import { AISkill, SkillResult } from '../../types';
import {
  getSkillHistory,
  deleteSkillHistoryEntry,
  clearSkillHistory,
  searchSkillHistory,
  getSkillFavorites,
  addSkillFavorite,
  removeSkillFavorite,
  isSkillFavorited,
  getSkillStats,
  getMostUsedSkills,
} from '../../services/skill/skillHistoryStorage';
import { getSkill } from '../../services/skillRegistry';

interface SkillExecutionHistoryProps {
  onReplay: (skill: AISkill, inputs?: Record<string, any>) => void;
  onClearHistory?: () => void;
}

type SortMode = 'recent' | 'success' | 'duration' | 'skill';
type FilterMode = 'all' | 'success' | 'failed' | 'favorites';

export const SkillExecutionHistory: React.FC<SkillExecutionHistoryProps> = ({ onReplay, onClearHistory }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showStats, setShowStats] = useState(false);

  const history = useMemo(() => {
    let items = searchQuery ? searchSkillHistory(searchQuery) : getSkillHistory();

    // Apply filter
    if (filterMode === 'success') {
      items = items.filter(h => h.result.success);
    } else if (filterMode === 'failed') {
      items = items.filter(h => !h.result.success);
    } else if (filterMode === 'favorites') {
      const favIds = new Set(getSkillFavorites().map(f => f.skillId));
      items = items.filter(h => favIds.has(h.skillId));
    }

    // Apply sort
    if (sortMode === 'recent') {
      items.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortMode === 'success') {
      items.sort((a, b) => (b.result.success ? 1 : 0) - (a.result.success ? 1 : 0));
    } else if (sortMode === 'duration') {
      items.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (sortMode === 'skill') {
      items.sort((a, b) => a.skillName.localeCompare(b.skillName));
    }

    return items;
  }, [searchQuery, sortMode, filterMode]);

  const favorites = useMemo(() => getSkillFavorites(), [history]);
  const stats = useMemo(() => getSkillStats(), [history]);
  const mostUsed = useMemo(() => getMostUsedSkills(5), [history]);

  const handleToggleFavorite = (skillId: string) => {
    if (isSkillFavorited(skillId)) {
      removeSkillFavorite(skillId);
    } else {
      addSkillFavorite(skillId);
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      clearSkillHistory();
      onClearHistory?.();
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0 && !searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-monokai-comment">
        <div className="w-16 h-16 rounded-xl bg-monokai-sidebar flex items-center justify-center mb-3">
          <History className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-sm font-medium text-monokai-fg">暂无执行历史</p>
        <p className="text-xs mt-1">执行过的技能将在这里显示</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-monokai-bg">
      {/* Header with search and controls */}
      <div className="flex-none p-3 border-b border-monokai-accent space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索历史记录..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-monokai-sidebar border border-monokai-accent text-monokai-fg placeholder-monokai-comment rounded-lg focus:outline-none focus:border-monokai-purple transition-colors"
          />
        </div>

        {/* Filter & Sort controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-monokai-comment" />
            <select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value as FilterMode)}
              className="text-[10px] bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded px-1.5 py-1 focus:outline-none focus:border-monokai-purple"
            >
              <option value="all">全部</option>
              <option value="success">仅成功</option>
              <option value="failed">仅失败</option>
              <option value="favorites">已收藏</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-monokai-comment" />
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="text-[10px] bg-monokai-sidebar border border-monokai-accent text-monokai-fg rounded px-1.5 py-1 focus:outline-none focus:border-monokai-purple"
            >
              <option value="recent">最近</option>
              <option value="success">成功率</option>
              <option value="duration">耗时</option>
              <option value="skill">技能名</option>
            </select>
          </div>

          {/* Stats toggle */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] border rounded transition-colors ${
              showStats
                ? 'bg-monokai-purple/20 border-monokai-purple text-monokai-purple'
                : 'bg-monokai-sidebar border-monokai-accent text-monokai-comment hover:border-monokai-purple/50'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            统计
          </button>
        </div>

        {/* Stats Panel */}
        {showStats && (
          <div className="bg-monokai-sidebar rounded-lg p-2 border border-monokai-accent/50">
            <div className="text-[10px] text-monokai-comment mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              使用统计
            </div>
            {/* Most used skills */}
            <div className="mb-2">
              <div className="text-[9px] text-monokai-comment uppercase mb-1">常用技能</div>
              {mostUsed.map((s, i) => (
                <div key={s.skillId} className="flex items-center justify-between text-[10px] py-0.5">
                  <span className="text-monokai-fg">{i + 1}. {s.skillName || s.skillId}</span>
                  <span className="text-monokai-purple font-mono">{s.count}次</span>
                </div>
              ))}
            </div>
            {/* Quick stats */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-monokai-comment">总执行: <span className="text-monokai-fg">{history.length}</span></span>
              <span className="text-monokai-comment">收藏: <span className="text-monokai-yellow">{favorites.length}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <div className="space-y-2">
          {history.map((item) => {
            const skill = getSkill(item.skillId);
            const isSuccess = item.result.success;
            const timeAgo = formatTimeAgo(item.timestamp);
            const isFavorite = isSkillFavorited(item.skillId);

            return (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                  isSuccess ? 'bg-monokai-sidebar hover:border-monokai-purple/50 border-monokai-accent' : 'bg-monokai-red/5 border-monokai-red/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isSuccess ? 'text-monokai-purple' : 'text-monokai-red'}`} />
                    <span className="text-sm font-medium text-monokai-fg truncate">{skill?.name || item.skillName}</span>
                    <span className="text-[10px] text-monokai-comment flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {timeAgo}
                    </span>
                    {item.duration && (
                      <span className="text-[9px] text-monokai-comment/50 font-mono shrink-0">
                        {item.duration < 1000 ? `${item.duration}ms` : `${(item.duration / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(item.skillId)}
                      className={`p-1.5 rounded hover:bg-monokai-bg transition-colors ${
                        isFavorite ? 'text-monokai-yellow' : 'text-monokai-comment hover:text-monokai-fg'
                      }`}
                      title={isFavorite ? "取消收藏" : "收藏"}
                    >
                      <Star className="w-3.5 h-3.5" fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => deleteSkillHistoryEntry(item.id)}
                      className="p-1.5 rounded text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => skill && onReplay(skill)}
                      className="p-1.5 text-monokai-blue hover:bg-monokai-blue/10 hover:text-monokai-blue rounded transition-colors"
                      title="重放此技能"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isSuccess ? (
                  <>
                    {item.tableName && (
                      <div className="text-[9px] text-monokai-green/70 mb-1 font-mono">
                        表: {item.tableName}
                      </div>
                    )}
                    <div className="relative group">
                      <pre className="p-2.5 text-xs font-mono text-monokai-fg overflow-x-auto custom-scrollbar max-h-24 bg-monokai-bg rounded border border-monokai-accent/30">
                        {item.result.sql}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(item.result.sql || '')}
                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 bg-monokai-bg border border-monokai-accent rounded text-monokai-comment hover:text-monokai-fg transition-all"
                        title="复制 SQL"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                    {item.result.explanation && (
                      <p className="mt-2 text-xs text-monokai-comment line-clamp-1">{item.result.explanation}</p>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-monokai-red bg-monokai-red/10 p-2 rounded">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{item.result.error}</span>
                  </div>
                )}
              </div>
            );
          })}

          {history.length === 0 && (
            <div className="text-center py-8 text-monokai-comment text-sm">
              {searchQuery ? '没有找到匹配的历史记录' : '暂无历史记录'}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-monokai-accent flex items-center justify-between">
        <span className="text-[10px] text-monokai-comment">
          {history.length} 条记录
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-[10px] text-monokai-blue hover:text-monokai-fg transition-colors"
            title="导出历史"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-[10px] text-monokai-red hover:text-monokai-fg transition-colors"
            title="清空历史"
          >
            <Trash2 className="w-3 h-3" />
            清空
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format time ago
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

export default SkillExecutionHistory;
