import React, { useState, useEffect, useMemo } from 'react';
import { TutorialMetadata, getNextTutorial, tutorials } from '../../data/tutorials';

interface LearningProgress {
  tutorialId: string;
  completedSections: string[];
  lastPosition: string;
  startedAt: string;
  completedAt?: string;
}

interface ProgressTrackerProps {
  selectedTutorial: TutorialMetadata | null;
  onNavigateToTutorial?: (tutorialId: string) => void;
  onNavigateSection?: (anchor: string) => void;
  onTryCode?: (code: string) => void;
}

const STORAGE_KEY = 'duckdb_learn_progress';

// 从 localStorage 加载进度
const loadProgress = (): Record<string, LearningProgress> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return {};
};

// 保存进度到 localStorage
const saveProgress = (progress: Record<string, LearningProgress>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
};

// 成就定义
const ACHIEVEMENTS = [
  { id: 'first_step', name: '初学者', desc: '完成第一个教程', icon: '🌟', condition: (p: Record<string, LearningProgress>) => Object.values(p).some(x => x.completedAt) },
  { id: 'db_master', name: '数据库大师', desc: '完成 DuckDB 入门', icon: '🏆', condition: (p: Record<string, LearningProgress>) => p['duckdb-basics']?.completedAt },
];

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  selectedTutorial,
  onNavigateToTutorial,
  onNavigateSection,
  onTryCode,
}) => {
  const [progress, setProgress] = useState<Record<string, LearningProgress>>({});

  // 加载进度
  useEffect(() => {
    const saved = loadProgress();
    setProgress(saved);
  }, []);

  // 获取已解锁的成就
  const unlockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter(a => a.condition(progress));
  }, [ACHIEVEMENTS, progress]);

  // 全局统计
  const globalStats = useMemo(() => {
    const allProgress = Object.values(progress);
    return {
      totalStarted: allProgress.length,
      totalCompleted: allProgress.filter(p => p.completedAt).length,
    };
  }, [progress]);

  // 示例 SQL 代码
  const sampleSql = useMemo(() => {
    if (!selectedTutorial) return '';
    if (selectedTutorial.id === 'duckdb-basics') {
      return `-- 创建示例表
CREATE TABLE departments (
    dept_id INTEGER PRIMARY KEY,
    dept_name VARCHAR(50) NOT NULL
);
INSERT INTO departments VALUES (1, '技术研发部'), (2, '市场营销部');
SELECT * FROM departments;`;
    }
    if (selectedTutorial.id === 'philosophy-db') {
      return `-- 哲学数据库示例
CREATE TABLE schools (school_id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO schools VALUES (1, '儒家'), (2, '道家');
SELECT * FROM schools;`;
    }
    return '';
  }, [selectedTutorial]);

  // 推荐的下一个教程
  const nextTutorial = useMemo(() => {
    if (!selectedTutorial) return null;
    return getNextTutorial(selectedTutorial.id);
  }, [selectedTutorial]);

  // 当前教程进度
  const tutorialProgress = useMemo(() => {
    if (!selectedTutorial) return null;
    return progress[selectedTutorial.id] || {
      tutorialId: selectedTutorial.id,
      completedSections: [],
      lastPosition: '',
      startedAt: new Date().toISOString(),
    };
  }, [progress, selectedTutorial]);

  // 完成百分比
  const completionPercent = useMemo(() => {
    if (!selectedTutorial?.sections || !tutorialProgress) return 0;
    const total = selectedTutorial.sections.length;
    const completed = tutorialProgress.completedSections.length;
    return Math.round((completed / total) * 100);
  }, [selectedTutorial, tutorialProgress]);

  // 标记章节完成
  const markSectionComplete = (sectionId: string) => {
    if (!selectedTutorial) return;

    const current = progress[selectedTutorial.id] || {
      tutorialId: selectedTutorial.id,
      completedSections: [],
      lastPosition: sectionId,
      startedAt: new Date().toISOString(),
    };

    if (current.completedSections.includes(sectionId)) return;

    const updated: LearningProgress = {
      ...current,
      completedSections: [...current.completedSections, sectionId],
      lastPosition: sectionId,
    };

    if (selectedTutorial.sections && updated.completedSections.length >= selectedTutorial.sections.length) {
      updated.completedAt = new Date().toISOString();
    }

    const newProgress = { ...progress, [selectedTutorial.id]: updated };
    setProgress(newProgress);
    saveProgress(newProgress);
  };

  // 首页视图 - 简洁进度面板
  if (!selectedTutorial) {
    return (
      <div className="p-4">
        <h3 className="text-xs font-bold text-monokai-comment uppercase tracking-wider mb-3">
          学习进度
        </h3>

        {/* 统计 */}
        <div className="bg-monokai-bg/40 rounded-lg p-3 mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-monokai-comment">已完成</span>
            <span className="text-monokai-green">{globalStats.totalCompleted}/{tutorials.length}</span>
          </div>
          <div className="h-1.5 bg-monokai-accent/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-monokai-green to-monokai-blue"
              style={{ width: `${(globalStats.totalCompleted / tutorials.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 成就 */}
        <div className="mb-3">
          <div className="text-[10px] text-monokai-comment mb-2">🏅 成就</div>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map(achievement => {
              const isUnlocked = unlockedAchievements.some(a => a.id === achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`p-2 rounded-lg text-center border ${isUnlocked
                    ? 'bg-monokai-yellow/10 border-monokai-yellow/30'
                    : 'bg-monokai-bg/30 border-monokai-accent/20 opacity-40'
                    }`}
                  title={achievement.desc}
                >
                  <div className="text-sm">{achievement.icon}</div>
                  <div className={`text-[9px] ${isUnlocked ? 'text-monokai-yellow' : 'text-monokai-comment'}`}>
                    {achievement.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 进行中的教程 */}
        {Object.keys(progress).length > 0 && (
          <div>
            <div className="text-[10px] text-monokai-comment mb-2">📝 进行中</div>
            <div className="space-y-1">
              {Object.entries(progress).slice(0, 3).map(([tutorialId, p]) => (
                <button
                  key={tutorialId}
                  onClick={() => onNavigateToTutorial?.(tutorialId)}
                  className="w-full text-left p-2 rounded bg-monokai-bg/30 hover:bg-monokai-accent/20 transition-colors"
                >
                  <div className="text-[10px] text-monokai-fg truncate">{tutorialId}</div>
                  <div className="mt-1 h-1 bg-monokai-accent/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-monokai-blue"
                      style={{ width: `${(p.completedSections.length / 7) * 100}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 教程详情视图
  return (
    <div className="p-4 flex flex-col">
      {/* 一键实践 */}
      {onTryCode && sampleSql && (
        <button
          onClick={() => onTryCode(sampleSql)}
          className="w-full py-2 bg-monokai-green/15 hover:bg-monokai-green/25 border border-monokai-green/30 rounded-lg text-monokai-green text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5 mb-4"
        >
          <span>⚡</span>
          <span>一键实践</span>
        </button>
      )}

      {/* 进度 */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-monokai-comment">学习进度</span>
          <span className="text-monokai-fg">{completionPercent}%</span>
        </div>
        <div className="h-1.5 bg-monokai-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-monokai-green to-monokai-blue"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* 章节进度 */}
      {selectedTutorial.sections && selectedTutorial.sections.length > 0 && (
        <div className="flex-1 overflow-y-auto mb-4">
          <div className="text-[10px] text-monokai-comment mb-2">📖 章节</div>
          <div className="space-y-1">
            {selectedTutorial.sections.map((section, index) => {
              const isCompleted = tutorialProgress?.completedSections.includes(section.id);
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    markSectionComplete(section.id);
                    onNavigateSection?.(section.anchor);
                  }}
                  className={`w-full text-left py-1.5 px-2 rounded text-[10px] flex items-center gap-2 transition-colors ${isCompleted
                    ? 'bg-monokai-green/10 text-monokai-green'
                    : 'hover:bg-monokai-accent/20 text-monokai-fg/60'
                    }`}
                >
                  <span className="w-4 text-center">{isCompleted ? '✓' : index + 1}</span>
                  <span className="truncate">{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 推荐下一教程 */}
      {nextTutorial && (
        <div className="pt-3 border-t border-monokai-accent/30">
          <div className="text-[10px] text-monokai-comment mb-2">→ 下一课</div>
          <button
            onClick={() => onNavigateToTutorial?.(nextTutorial.id)}
            className="w-full p-2.5 rounded-lg bg-monokai-blue/10 border border-monokai-blue/20 hover:bg-monokai-blue/20 transition-colors text-left"
          >
            <div className="text-[10px] text-monokai-blue font-medium truncate">
              {nextTutorial.title}
            </div>
            <div className="text-[10px] text-monokai-comment mt-0.5">
              {nextTutorial.difficulty} · {nextTutorial.estimatedTime}
            </div>
          </button>
        </div>
      )}

      {/* 完成提示 */}
      {completionPercent === 100 && (
        <div className="mt-3 p-2 bg-monokai-green/10 border border-monokai-green/30 rounded-lg text-center">
          <div className="text-sm">🎉</div>
          <div className="text-xs text-monokai-green">恭喜完成！</div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
