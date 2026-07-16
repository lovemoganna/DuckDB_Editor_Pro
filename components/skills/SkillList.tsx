/**
 * SkillList - Left panel of Browse mode: search, category tabs, and skill cards
 *
 * Refactored for flat Monokai design with enhanced visual hierarchy.
 * All state consumed from SkillContext — no prop drilling.
 *
 * P0-3 Features:
 * - Advanced filtering (operation type, requires table/columns)
 * - Multiple sort modes (name, usage, recent, category)
 * - Usage statistics integration
 */

import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Filter,
  SortAsc,
  Star,
  Zap,
  Table2,
  Columns,
  Sparkles,
  X,
} from 'lucide-react';
import { AISkill, SkillCategory } from '../../types';
import { CATEGORY_DESIGN } from '../theme/ai-skills';
import { getSkillCategories } from '../../services/skillRegistry';
import { getSkillHistory } from '../../services/skillExecutor';
import { getSkillStats, isSkillFavorited, getSkillFavorites } from '../../services/skill/skillHistoryStorage';
import { SkillCard } from '../SkillCard';
import { useSkillContext } from './context/SkillContext';

interface SkillListProps {
  currentTable?: string;
  onShowImportModal: () => void;
  onSkillSelect: (skill: AISkill) => void;
}

type SortMode = 'default' | 'recent' | 'name' | 'usage' | 'favorites';
type FilterTag = 'all' | 'requires-table' | 'requires-columns' | 'favorites' | 'modeling' | 'wrangling' | 'insights' | 'optimization' | 'engineering';

export const SkillList: React.FC<SkillListProps> = ({
  currentTable,
  onShowImportModal,
  onSkillSelect,
}) => {
  const {
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    filteredSkills, skillsByCategory,
    expandedCategories, toggleCategory,
    sortOrder, setSortOrder,
    selectedSkill,
    isPipelineMode, setIsPipelineMode,
  } = useSkillContext();

  // Sort mode state
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Advanced filter tags
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);

  const history = getSkillHistory();

  // Compute usage stats from persisted storage
  const skillStats = useMemo(() => getSkillStats(), [history]);
  const favorites = useMemo(() => getSkillFavorites(), [history]);
  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.skillId)), [favorites]);

  // Advanced filtered and sorted skills
  const displaySkills = useMemo(() => {
    let skills = filteredSkills;

    // Apply filter tags
    if (filterTags.length > 0) {
      skills = skills.filter(skill => {
        // Category filter
        if (filterTags.includes(skill.category as FilterTag)) {
          return true;
        }
        // Special filters
        if (filterTags.includes('requires-table') && skill.requiresTable) return true;
        if (filterTags.includes('requires-columns') && skill.requiresColumns) return true;
        if (filterTags.includes('favorites') && favoriteIds.has(skill.id)) return true;
        return false;
      });
    }

    // Apply sorting
    if (sortMode === 'name') {
      skills = [...skills].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'usage') {
      skills = [...skills].sort((a, b) => {
        const aStats = skillStats[a.id];
        const bStats = skillStats[b.id];
        return (bStats?.totalExecutions || 0) - (aStats?.totalExecutions || 0);
      });
    } else if (sortMode === 'recent') {
      skills = [...skills].sort((a, b) => {
        const aStats = skillStats[a.id];
        const bStats = skillStats[b.id];
        return (bStats?.lastExecuted || 0) - (aStats?.lastExecuted || 0);
      });
    } else if (sortMode === 'favorites') {
      skills = [...skills].sort((a, b) => {
        const aFav = favoriteIds.has(a.id) ? 1 : 0;
        const bFav = favoriteIds.has(b.id) ? 1 : 0;
        return bFav - aFav;
      });
    }

    return skills;
  }, [filteredSkills, filterTags, sortMode, skillStats, favoriteIds]);

  const toggleFilterTag = (tag: FilterTag) => {
    setFilterTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDragStart = (e: React.DragEvent, skill: AISkill) => {
    e.dataTransfer.setData('application/reactflow-skill', JSON.stringify(skill));
    e.dataTransfer.effectAllowed = 'move';
  };

  const getSortLabel = () => {
    switch (sortMode) {
      case 'name': return '名称';
      case 'usage': return '使用';
      case 'recent': return '最近';
      case 'favorites': return '收藏';
      default: return '默认';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1f1c] select-none font-mono">
      {/* Enhanced Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#3e3d32]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-monokai-amethyst/20 to-monokai-pink/20 border border-monokai-amethyst/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-monokai-amethyst" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-monokai-fg leading-tight">AI Skills</h2>
              <p className="text-[9px] text-monokai-comment">智能技能库</p>
            </div>
          </div>
          <button
            onClick={() => setIsPipelineMode(!isPipelineMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${
              isPipelineMode
                ? 'bg-monokai-green/20 border border-monokai-green/50 text-monokai-green shadow-[0_0_8px_rgba(166,226,46,0.2)]'
                : 'bg-[#272822] border border-[#3e3d32] text-monokai-comment hover:border-monokai-green/50 hover:text-monokai-green'
            }`}
          >
            <Layers className="w-3 h-3" />
            {isPipelineMode ? '退出管道' : '管道模式'}
          </button>
        </div>

        {/* Search */}
        <div className="relative group mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-monokai-comment/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索技能..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#272822] border border-[#3e3d32] text-monokai-fg placeholder-monokai-comment/40 rounded-lg focus:outline-none focus:border-monokai-amethyst/60 focus:bg-[#272822] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-monokai-comment/60 hover:text-monokai-fg"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Sort & Filter Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded transition-all ${
                sortMode !== 'default'
                  ? 'bg-monokai-amethyst/15 border border-monokai-amethyst/40 text-monokai-amethyst'
                  : 'bg-[#272822] border border-[#3e3d32] text-monokai-comment hover:border-[#49483e]'
              }`}
            >
              <SortAsc className="w-3 h-3" />
              {getSortLabel()}
              <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            {showSortMenu && (
              <div className="absolute left-0 top-full mt-1 w-32 bg-[#272822] border border-[#3e3d32] rounded-lg shadow-xl z-50 py-1">
                {[
                  { mode: 'default' as SortMode, label: '默认顺序', icon: Layers },
                  { mode: 'name' as SortMode, label: '按名称', icon: SortAsc },
                  { mode: 'usage' as SortMode, label: '按使用次数', icon: Zap },
                  { mode: 'recent' as SortMode, label: '按最近使用', icon: Clock },
                  { mode: 'favorites' as SortMode, label: '按收藏', icon: Star },
                ].map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors ${
                      sortMode === mode
                        ? 'bg-monokai-amethyst/20 text-monokai-amethyst'
                        : 'text-monokai-comment hover:bg-[#3e3d32] hover:text-monokai-fg'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Tags */}
          <div className="flex items-center gap-1">
            {[
              { tag: 'requires-table' as FilterTag, icon: Table2, label: '表', color: '#66d9ef' },
              { tag: 'requires-columns' as FilterTag, icon: Columns, label: '列', color: '#66d9ef' },
              { tag: 'favorites' as FilterTag, icon: Star, label: '收藏', color: '#f1fa8c' },
            ].map(({ tag, icon: Icon, label, color }) => {
              const isActive = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-all border ${
                    isActive
                      ? 'border'
                      : 'bg-[#272822] border-[#3e3d32] text-monokai-comment hover:border-[#49483e]'
                  }`}
                  style={isActive ? {
                    backgroundColor: `${color}20`,
                    borderColor: `${color}60`,
                    color: color,
                  } : undefined}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Clear filters */}
          {filterTags.length > 0 && (
            <button
              onClick={() => setFilterTags([])}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-monokai-pink hover:text-monokai-fg transition-colors"
            >
              <X className="w-3 h-3" />
              清除
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-3 py-2 border-b border-[#3e3d32]/50 bg-[#1e1e1c]">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {/* All category */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 px-3 py-1.5 text-[10px] rounded-lg font-medium transition-all ${
              selectedCategory === 'all'
                ? 'border shadow-sm'
                : 'bg-[#272822] border border-transparent text-monokai-comment hover:border-[#3e3d32] hover:text-monokai-fg'
            }`}
            style={selectedCategory === 'all' ? {
              backgroundColor: 'rgba(166,226,46,0.15)',
              borderColor: 'rgba(166,226,46,0.4)',
              color: '#a6e22e',
              boxShadow: '0 0 6px rgba(166,226,46,0.15)',
            } : undefined}
          >
            全部 {filteredSkills.length}
          </button>

          {/* Category buttons */}
          {getSkillCategories().map(({ category }) => {
            const design = CATEGORY_DESIGN[category];
            const isSelected = selectedCategory === category;
            const count = skillsByCategory[category]?.length || 0;
            const color = design?.colors.primary || '#ae81ff';

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'border shadow-sm'
                    : 'bg-[#272822] border border-transparent hover:border-[#3e3d32]'
                }`}
                style={isSelected ? {
                  backgroundColor: `${color}15`,
                  borderColor: `${color}40`,
                  color: color,
                  boxShadow: `0 0 8px ${color}20`,
                } : {
                  color: '#75715e',
                }}
              >
                <span>{design?.emoji}</span>
                <span>{design?.label}</span>
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Skill List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1f1c]">
        {selectedCategory === 'all' ? (
          <div className="p-2">
            {(Object.entries(skillsByCategory) as [SkillCategory, AISkill[]][])
              .filter(([_, skills]) => skills.length > 0)
              .map(([category, categorySkills]) => {
                const design = CATEGORY_DESIGN[category];
                const isExpanded = expandedCategories.has(category);
                const filtered = categorySkills.filter(skill => displaySkills.includes(skill));
                if (filtered.length === 0 && filterTags.length > 0) return null;

                return (
                  <div key={category} className="mb-2">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#272822]/50 transition-colors group"
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-xs"
                        style={{
                          backgroundColor: `${design?.colors.primary}20`,
                          color: design?.colors.primary,
                        }}
                      >
                        {design?.emoji}
                      </div>
                      <span
                        className="text-xs font-semibold flex-1 text-left"
                        style={{ color: design?.colors.primary }}
                      >
                        {design?.label}
                      </span>
                      <span className="text-[9px] text-monokai-comment/60 font-mono">
                        {filterTags.length > 0 ? filtered.length : categorySkills.length}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-monokai-comment/60" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-monokai-comment/60" />
                      )}
                    </button>

                    {/* Skills in Category */}
                    {isExpanded && (
                      <div className="ml-2 mt-1 space-y-1 pl-3 py-1"
                        style={{ borderLeft: `2px solid ${design?.colors.primary}30` }}>
                        {filtered.map((skill) => {
                          const stats = skillStats[skill.id];
                          return (
                            <div
                              key={skill.id}
                              draggable={isPipelineMode}
                              onDragStart={(e) => handleDragStart(e, skill)}
                              className={isPipelineMode ? "cursor-grab active:cursor-grabbing" : ""}
                            >
                              <SkillCard
                                skill={skill}
                                isSelected={selectedSkill?.id === skill.id}
                                onClick={() => onSkillSelect(skill)}
                                currentTable={currentTable}
                                usageCount={stats?.totalExecutions}
                                isFavorite={favoriteIds.has(skill.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displaySkills.map((skill) => {
              const stats = skillStats[skill.id];
              return (
                <div
                  key={skill.id}
                  draggable={isPipelineMode}
                  onDragStart={(e) => handleDragStart(e, skill)}
                  className={isPipelineMode ? "cursor-grab active:cursor-grabbing" : ""}
                >
                  <SkillCard
                    skill={skill}
                    isSelected={selectedSkill?.id === skill.id}
                    onClick={() => onSkillSelect(skill)}
                    currentTable={currentTable}
                    usageCount={stats?.totalExecutions}
                    isFavorite={favoriteIds.has(skill.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {displaySkills.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-monokai-comment">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">未找到匹配的技能</p>
            {filterTags.length > 0 && (
              <button
                onClick={() => setFilterTags([])}
                className="mt-3 px-3 py-1.5 text-xs bg-monokai-amethyst/15 border border-monokai-amethyst/40 text-monokai-amethyst rounded hover:bg-monokai-amethyst/25 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#3e3d32] bg-[#1e1e1c]">
        <div className="flex items-center justify-between">
          <button
            onClick={onShowImportModal}
            className="flex items-center gap-2 px-3 py-2 text-[11px] bg-monokai-green/10 border border-monokai-green/30 text-monokai-green rounded-lg hover:bg-monokai-green/20 hover:border-monokai-green/50 transition-all"
          >
            <Download className="w-4 h-4" />
            导入技能
          </button>

          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5 text-monokai-comment">
              <Layers className="w-3 h-3" />
              <span>{displaySkills.length} 技能</span>
            </div>
            <div className="flex items-center gap-1.5 text-monokai-yellow">
              <Star className="w-3 h-3 fill-current" />
              <span>{favorites.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillList;
