import React, { useState, useMemo } from 'react';
import { TutorialMetadata, TutorialSection, tutorials, categoryMap } from '../../data/tutorials';
import { ChevronRight } from 'lucide-react';

interface NavigationPanelProps {
  selectedTutorial: TutorialMetadata | null;
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
  currentSection?: string;
  onNavigateSection?: (sectionId: string) => void;
}

// 面包屑组件
export const Breadcrumb: React.FC<{
  items: { label: string; onClick?: () => void }[]
}> = ({ items }) => (
  <div className="flex items-center gap-2 text-sm text-monokai-comment mb-4">
    <button
      onClick={() => items[0]?.onClick?.()}
      className="hover:text-monokai-blue transition-colors flex items-center gap-1"
    >
      <span className="text-xs">🏠</span>
      <span>Learn</span>
    </button>
    {items.slice(1).map((item, index) => (
      <React.Fragment key={index}>
        <span className="text-monokai-accent">/</span>
        {item.onClick ? (
          <button
            onClick={item.onClick}
            className="hover:text-monokai-blue transition-colors"
          >
            {item.label}
          </button>
        ) : (
          <span className="text-monokai-fg">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);

// 教程列表导航项 - 支持展开章节的4级导航
const TutorialNavItem: React.FC<{
  tutorial: TutorialMetadata;
  isSelected: boolean;
  isCompleted: boolean;
  onSelect: (tutorial: TutorialMetadata) => void;
  onNavigateSection?: (sectionId: string) => void;
  currentSection?: string;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ tutorial, isSelected, isCompleted, onSelect, onNavigateSection, currentSection, index, isExpanded, onToggleExpand }) => {
  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-monokai-green/20 text-monokai-green';
      case 'Intermediate': return 'bg-monokai-orange/20 text-monokai-orange';
      case 'Advanced': return 'bg-monokai-purple/20 text-monokai-purple';
      default: return 'bg-monokai-blue/20 text-monokai-blue';
    }
  };

  const hasSections = tutorial.sections && tutorial.sections.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    // 如果有章节且点击的是展开按钮区域，则展开/收起
    if (hasSections) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      // 点击右侧20px范围内触发展开/收起
      if (clickX > rect.width - 24) {
        e.preventDefault();
        e.stopPropagation();
        onToggleExpand();
        return;
      }
    }
    onSelect(tutorial);
  };

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        className={`w-full text-left p-2.5 rounded-lg transition-all group flex items-start gap-1 ${isSelected
            ? 'bg-monokai-blue/15 border-l-2 border-monokai-blue'
            : 'hover:bg-monokai-accent/15 border-l-2 border-transparent'
          }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] w-4 ${isCompleted ? 'text-monokai-green' : 'text-monokai-comment'}`}>
              {isCompleted ? '✓' : index + 1}
            </span>
            <span className={`text-[10px] font-medium truncate ${isSelected ? 'text-monokai-blue' : 'text-monokai-fg'
              }`}>
              {tutorial.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 ml-6">
            <span className={`text-[9px] px-1 py-0.5 rounded ${getDifficultyStyle(tutorial.difficulty)}`}>
              {tutorial.difficulty === 'Beginner' ? '入门' :
                tutorial.difficulty === 'Intermediate' ? '进阶' : '高级'}
            </span>
          </div>
        </div>
        {/* 展开/收起按钮 */}
        {hasSections && (
          <span
            className="w-4 h-4 flex items-center justify-center text-monokai-comment group-hover:text-monokai-blue cursor-pointer transition-transform duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          </span>
        )}
      </button>
      {/* 第4级：展开的章节列表 */}
      {hasSections && isExpanded && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-monokai-accent/30 pl-2">
          {tutorial.sections!.map((section, sidx) => (
            <button
              key={section.id}
              onClick={() => {
                onSelect(tutorial);
                onNavigateSection?.(section.id);
              }}
              className={`w-full text-left py-1 px-2 rounded text-[10px] transition-all flex items-center gap-1.5 ${currentSection === section.id
                  ? 'bg-monokai-pink/15 text-monokai-pink'
                  : 'hover:bg-monokai-accent/10 text-monokai-fg-muted hover:text-monokai-fg'
                }`}
            >
              <span className="text-[9px] text-monokai-comment w-3">{sidx + 1}</span>
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 章节导航
export const SectionNav: React.FC<{
  sections: TutorialSection[];
  currentSection?: string;
  onSelect: (sectionId: string) => void;
}> = ({ sections, currentSection, onSelect }) => {
  return (
    <nav className="space-y-0.5 mt-3 pt-3 border-t border-monokai-accent/30">
      <h4 className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider mb-2 px-2">
        本章目录
      </h4>
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => onSelect(section.id)}
          className={`w-full text-left py-1.5 px-2 rounded text-[10px] transition-all flex items-center gap-2 ${currentSection === section.id
              ? 'bg-monokai-pink/15 text-monokai-pink'
              : 'hover:bg-monokai-accent/15 text-monokai-fg/70'
            }`}
        >
          <span className="text-[10px] text-monokai-comment w-4">{index + 1}</span>
          <span className="truncate">{section.title}</span>
        </button>
      ))}
    </nav>
  );
};

// 主导航面板组件 - 支持4级导航
export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  selectedTutorial,
  onSelectTutorial,
  currentSection,
  onNavigateSection,
}) => {
  // 展开状态 - 支持多个教程同时展开
  const [expandedTutorials, setExpandedTutorials] = useState<Set<string>>(new Set());

  // 切换展开状态
  const toggleExpand = (tutorialId: string) => {
    setExpandedTutorials(prev => {
      const next = new Set(prev);
      if (next.has(tutorialId)) {
        next.delete(tutorialId);
      } else {
        next.add(tutorialId);
      }
      return next;
    });
  };

  // 从 localStorage 读取已完成教程
  const completedTutorials = useMemo(() => {
    try {
      const saved = localStorage.getItem('duckdb_learn_progress');
      if (saved) {
        const progress = JSON.parse(saved);
        return Object.entries(progress)
          .filter(([_, p]: [string, any]) => p.completedAt)
          .map(([id]) => id);
      }
    } catch (e) { }
    return [];
  }, []);

  const categories = Object.keys(categoryMap);

  return (
    <div className="w-56 border-r border-monokai-accent flex flex-col bg-monokai-sidebar/20 shrink-0">
      {/* 头部 */}
      <div className="p-3 border-b border-monokai-accent/50">
        <h2 className="text-sm font-bold text-monokai-fg flex items-center gap-2">
          <span className="text-base">📚</span>
          <span>教程导航</span>
        </h2>
      </div>

      {/* 教程列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* 按分类显示 */}
        {categories.map(category => (
          <div key={category} className="mb-4">
            <h3 className="text-[10px] font-bold text-monokai-comment uppercase tracking-wider mb-2 px-2">
              {category}
            </h3>
            <div className="space-y-0.5">
              {(categoryMap[category] || []).map((tutorial, idx) => (
                <TutorialNavItem
                  key={tutorial.id}
                  tutorial={tutorial}
                  isSelected={selectedTutorial?.id === tutorial.id}
                  isCompleted={completedTutorials.includes(tutorial.id)}
                  onSelect={onSelectTutorial}
                  onNavigateSection={onNavigateSection}
                  currentSection={currentSection}
                  index={idx}
                  isExpanded={expandedTutorials.has(tutorial.id)}
                  onToggleExpand={() => toggleExpand(tutorial.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NavigationPanel;
