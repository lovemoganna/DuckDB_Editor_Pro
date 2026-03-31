import React, { useState, useMemo, useEffect } from 'react';
import { TutorialMetadata, tutorials, categoryMap, getRecommendedFirstTutorial, getLearningPath, loadAllTutorials } from '../../data/tutorials';
import { WikiSearch } from './WikiSearch';
import { UploadTutorialModal } from './UploadTutorialModal';
import { Sparkles, Lightbulb, ArrowRight, Loader2, X, ChevronRight, Zap, BookOpen, Target, TrendingUp } from 'lucide-react';

interface TutorialHomeProps {
  onSelectTutorial: (tutorial: TutorialMetadata) => void;
}

export const TutorialHome: React.FC<TutorialHomeProps> = ({ onSelectTutorial }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [allTutorials, setAllTutorials] = useState<TutorialMetadata[]>(tutorials);

  // 学习进度
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);

  // AI 推荐相关状态
  const [showAIRecommend, setShowAIRecommend] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{
    tutorial: TutorialMetadata;
    reason: string;
    type: 'continue' | 'advance' | 'review' | 'explore';
  } | null>(null);
  const [isGeneratingRecommend, setIsGeneratingRecommend] = useState(false);

  // 加载所有教程（包括用户上传的）
  useEffect(() => {
    loadAllTutorials().then(setAllTutorials).catch(console.error);
  }, [showUploadModal]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('duckdb_learn_progress');
      if (saved) {
        const progress = JSON.parse(saved);
        const completed = Object.entries(progress)
          .filter(([_, p]: [string, any]) => p.completedAt)
          .map(([id]) => id);
        setCompletedTutorials(completed);
      }
    } catch (e) { }
  }, []);

  // 过滤教程
  const filteredTutorials = useMemo(() => {
    let result = allTutorials;

    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }

    if (selectedDifficulty) {
      result = result.filter(t => t.difficulty === selectedDifficulty);
    }

    return result;
  }, [selectedCategory, selectedDifficulty, allTutorials]);

  // 获取所有分类（包括用户教程的分类）
  const categories = useMemo(() => {
    const cats = new Set(allTutorials.map(t => t.category));
    return Array.from(cats);
  }, [allTutorials]);
  const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  // 获取统计信息
  const stats = useMemo(() => ({
    total: allTutorials.length,
    completed: completedTutorials.length,
    beginner: allTutorials.filter(t => t.difficulty === 'Beginner').length,
    intermediate: allTutorials.filter(t => t.difficulty === 'Intermediate').length,
    advanced: allTutorials.filter(t => t.difficulty === 'Advanced').length,
  }), [completedTutorials, allTutorials]);

  // AI 智能推荐逻辑（MECE 原则）
  const generateAIRecommendation = useMemo(() => {
    if (allTutorials.length === 0) return null;

    const completedSet = new Set(completedTutorials);
    const incompleteTutorials = allTutorials.filter(t => !completedSet.has(t.id));

    // 策略 1：继续未完成的教程
    if (completedTutorials.length > 0 && incompleteTutorials.length > 0) {
      // 找到用户已开始但未完成的教程
      const inProgress = incompleteTutorials.filter(t =>
        t.category === allTutorials.find(ot => completedTutorials.includes(ot.id))?.category
      );
      if (inProgress.length > 0) {
        return {
          tutorial: inProgress[0],
          reason: '继续你未完成的课程，保持学习连贯性',
          type: 'continue' as const
        };
      }
    }

    // 策略 2：进阶学习 - 推荐同类别更高难度的教程
    if (completedTutorials.length > 0) {
      const lastCompleted = allTutorials.find(t => t.id === completedTutorials[completedTutorials.length - 1]);
      if (lastCompleted) {
        const difficultyOrder = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
        const currentIndex = difficultyOrder.indexOf(lastCompleted.difficulty);
        if (currentIndex < difficultyOrder.length - 1) {
          const nextDifficulty = difficultyOrder[currentIndex + 1];
          const advanceTutorials = allTutorials.filter(t =>
            t.category === lastCompleted.category && t.difficulty === nextDifficulty
          );
          if (advanceTutorials.length > 0) {
            return {
              tutorial: advanceTutorials[0],
              reason: `完成《${lastCompleted.title}》后，推荐进阶内容`,
              type: 'advance' as const
            };
          }
        }
      }
    }

    // 策略 3：推荐入门教程（首次学习）
    if (completedTutorials.length === 0) {
      const beginnerTutorials = allTutorials.filter(t => t.difficulty === 'Beginner');
      if (beginnerTutorials.length > 0) {
        return {
          tutorial: beginnerTutorials[0],
          reason: '从入门开始，逐步掌握 DuckDB',
          type: 'explore' as const
        };
      }
    }

    // 策略 4：探索新类别
    const completedCategories = new Set(
      allTutorials.filter(t => completedTutorials.includes(t.id)).map(t => t.category)
    );
    const unexploredCategories = allTutorials.filter(t => !completedCategories.has(t.category));
    if (unexploredCategories.length > 0) {
      return {
        tutorial: unexploredCategories[0],
        reason: '探索新的学习方向，拓宽知识面',
        type: 'explore' as const
      };
    }

    // 默认推荐
    return {
      tutorial: allTutorials[0],
      reason: '为你精选的学习内容',
      type: 'explore' as const
    };
  }, [allTutorials, completedTutorials]);

  // 手动触发 AI 推荐
  const handleGenerateAIRecommend = () => {
    setIsGeneratingRecommend(true);
    // 模拟 AI 生成延迟
    setTimeout(() => {
      const recommendation = generateAIRecommendation;
      if (recommendation) {
        setAiRecommendation(recommendation);
        setShowAIRecommend(true);
      }
      setIsGeneratingRecommend(false);
    }, 800);
  };

  // 关闭 AI 推荐
  const closeAIRecommend = () => {
    setShowAIRecommend(false);
  };

  // 推荐教程
  const recommendedTutorial = useMemo(() => {
    // 优先推荐内置教程
    const builtin = getRecommendedFirstTutorial();
    if (builtin) return builtin;
    // 如果没有内置教程，返回第一个用户教程
    return allTutorials[0] || null;
  }, [allTutorials]);

  const learningPath = useMemo(() => {
    // 只显示内置教程的学习路径
    const builtin = getLearningPath();
    return builtin;
  }, []);

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return { bg: 'bg-monokai-green/20', text: 'text-monokai-green', dot: 'bg-monokai-green' };
      case 'Intermediate': return { bg: 'bg-monokai-orange/20', text: 'text-monokai-orange', dot: 'bg-monokai-orange' };
      case 'Advanced': return { bg: 'bg-monokai-purple/20', text: 'text-monokai-purple', dot: 'bg-monokai-purple' };
      default: return { bg: 'bg-monokai-blue/20', text: 'text-monokai-blue', dot: 'bg-monokai-blue' };
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return '入门';
      case 'Intermediate': return '进阶';
      case 'Advanced': return '高级';
      default: return '专家';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-monokai-bg">
      {/* 顶部欢迎区 */}
      <div className="bg-gradient-to-r from-monokai-blue/10 via-monokai-purple/5 to-transparent border-b border-monokai-accent/30 p-6">
        <div className="flex items-start justify-between gap-6">
          {/* 左侧：标题 + 推荐 */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">
              DuckDB 学习中心
            </h1>
            <p className="text-[10px] text-monokai-comment mb-4">
              系统化学习，从入门到精通
            </p>

            {/* 推荐课程卡片 */}
            <button
              onClick={() => onSelectTutorial(recommendedTutorial)}
              className="w-full bg-monokai-bg/60 border border-monokai-accent/40 rounded-xl p-4 text-left hover:border-monokai-blue/50 hover:bg-monokai-bg/80 transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-medium text-monokai-blue bg-monokai-blue/20 px-2 py-0.5 rounded">推荐入门</span>
                <span className="text-[10px] text-monokai-comment">{recommendedTutorial.estimatedTime}</span>
              </div>
              <h3 className="text-base font-bold text-monokai-fg group-hover:text-monokai-blue transition-colors">
                {recommendedTutorial.title}
              </h3>
              <p className="text-[10px] text-monokai-comment mt-1 line-clamp-1">
                {recommendedTutorial.description}
              </p>
            </button>
          </div>

          {/* 右侧：统计 */}
          <div className="shrink-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-monokai-bg/50 rounded-lg p-3 text-center border border-monokai-accent/30 min-w-[70px]">
                <div className="text-xl font-bold text-monokai-blue">{stats.total}</div>
                <div className="text-[10px] text-monokai-comment uppercase">课程</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 text-center border border-monokai-accent/30 min-w-[70px]">
                <div className="text-xl font-bold text-monokai-green">{stats.completed}</div>
                <div className="text-[10px] text-monokai-comment uppercase">完成</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 text-center border border-monokai-accent/30 min-w-[70px]">
                <div className="text-xl font-bold text-monokai-purple">{stats.beginner}</div>
                <div className="text-[10px] text-monokai-comment uppercase">入门</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI 智能推荐按钮 */}
        <div className="mt-4">
          <button
            onClick={handleGenerateAIRecommend}
            disabled={isGeneratingRecommend}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              aiRecommendation
                ? 'bg-gradient-to-r from-monokai-purple/20 to-monokai-pink/20 border border-monokai-purple/40 text-monokai-fg hover:from-monokai-purple/30 hover:to-monokai-pink/30'
                : 'bg-monokai-purple/20 border border-monokai-purple/30 text-monokai-purple hover:bg-monokai-purple/30'
            }`}
          >
            {isGeneratingRecommend ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 正在为你推荐...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 智能推荐</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="px-6 py-4 border-b border-monokai-accent/20">
        <div className="flex items-center gap-4">
          {/* 上传教程按钮 */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-monokai-green/20 text-monokai-green border border-monokai-green/30 rounded-lg text-[10px] font-medium hover:bg-monokai-green/30 transition-colors shrink-0"
          >
            <span>+</span>
            <span>上传教程</span>
          </button>

          {/* 搜索框 */}
          <div className="flex-1 max-w-md">
            <WikiSearch onSelectTutorial={onSelectTutorial} />
          </div>

          {/* 筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-monokai-comment shrink-0">分类:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] transition-all ${selectedCategory === null
                    ? 'bg-monokai-blue text-white'
                    : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                  }`}
              >
                全部
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${selectedCategory === cat
                      ? 'bg-monokai-blue text-white'
                      : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-monokai-accent/30" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-monokai-comment shrink-0">难度:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedDifficulty(null)}
                className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${selectedDifficulty === null
                    ? 'bg-monokai-blue text-white'
                    : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                  }`}
              >
                全部
              </button>
              {difficulties.map(diff => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff === selectedDifficulty ? null : diff)}
                  className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${selectedDifficulty === diff
                      ? 'bg-monokai-blue text-white'
                      : 'bg-monokai-accent/20 text-monokai-comment hover:bg-monokai-accent/40'
                    }`}
                >
                  {getDifficultyLabel(diff)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 学习路径预览 */}
      <div className="px-6 py-3 bg-monokai-sidebar/20 border-b border-monokai-accent/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-monokai-comment">学习路径:</span>
          <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
            {learningPath.map((t, idx) => (
              <React.Fragment key={t.id}>
                <button
                  onClick={() => onSelectTutorial(t)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] truncate max-w-[120px] transition-colors ${completedTutorials.includes(t.id)
                      ? 'bg-monokai-green/10 text-monokai-green'
                      : 'bg-monokai-accent/10 text-monokai-fg hover:bg-monokai-accent/30'
                    }`}
                  title={t.title}
                >
                  {completedTutorials.includes(t.id) && <span className="shrink-0">✓</span>}
                  <span className="truncate">{t.title}</span>
                </button>
                {idx < learningPath.length - 1 && (
                  <span className="text-monokai-accent/40 shrink-0">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 教程列表 */}
      <div className="p-6">
        {filteredTutorials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTutorials.map(tutorial => {
              const diffStyle = getDifficultyStyle(tutorial.difficulty);
              const isCompleted = completedTutorials.includes(tutorial.id);

              return (
                <button
                  key={tutorial.id}
                  onClick={() => onSelectTutorial(tutorial)}
                  className={`bg-monokai-sidebar/40 border rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-monokai-blue/40 group ${isCompleted ? 'border-monokai-green/30' : 'border-monokai-accent/30'
                    }`}
                >
                  {/* 头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isCompleted && (
                          <span className="text-monokai-green text-xs">✓ 已完成</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${diffStyle.bg} ${diffStyle.text}`}>
                          {getDifficultyLabel(tutorial.difficulty)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-monokai-fg group-hover:text-monokai-blue transition-colors truncate">
                        {tutorial.title}
                      </h3>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${diffStyle.dot} shrink-0 ml-2`} />
                  </div>

                  {/* 描述 */}
                  <p className="text-[10px] text-monokai-comment line-clamp-2 mb-3">
                    {tutorial.description}
                  </p>

                  {/* 底部标签 */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {tutorial.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] text-monokai-comment bg-monokai-accent/10 px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-monokai-comment">
                      {tutorial.estimatedTime}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-monokai-comment mb-4">没有找到匹配的教程</p>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedDifficulty(null);
              }}
              className="text-sm text-monokai-blue hover:underline"
            >
              清除筛选条件
            </button>
          </div>
        )}
      </div>

      {/* 上传教程模态框 */}
      <UploadTutorialModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          // 刷新教程列表
          loadAllTutorials().then(setAllTutorials).catch(console.error);
        }}
      />

      {/* AI 推荐弹窗 */}
      {showAIRecommend && aiRecommendation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeAIRecommend}
          />

          {/* 推荐卡片 */}
          <div className="relative w-full max-w-md mx-4 bg-[#21222c] border border-monokai-purple/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* 装饰性渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-monokai-purple/10 via-transparent to-monokai-pink/10 pointer-events-none" />

            {/* 头部 */}
            <div className="relative p-5 border-b border-monokai-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monokai-purple to-monokai-pink flex items-center justify-center shadow-lg shadow-monokai-purple/25">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-monokai-fg">AI 智能推荐</h3>
                    <p className="text-[11px] text-monokai-comment">基于你的学习进度推荐</p>
                  </div>
                </div>
                <button
                  onClick={closeAIRecommend}
                  className="p-2 rounded-lg hover:bg-monokai-accent/20 text-monokai-comment hover:text-monokai-fg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 推荐内容 */}
            <div className="relative p-5">
              {/* 推荐类型标签 */}
              <div className="flex items-center gap-2 mb-3">
                {aiRecommendation.type === 'continue' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-monokai-blue/20 text-monokai-blue text-xs rounded-md">
                    <BookOpen className="w-3 h-3" /> 继续学习
                  </span>
                )}
                {aiRecommendation.type === 'advance' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-monokai-green/20 text-monokai-green text-xs rounded-md">
                    <TrendingUp className="w-3 h-3" /> 进阶推荐
                  </span>
                )}
                {aiRecommendation.type === 'review' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-monokai-orange/20 text-monokai-orange text-xs rounded-md">
                    <Lightbulb className="w-3 h-3" /> 复习巩固
                  </span>
                )}
                {aiRecommendation.type === 'explore' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-monokai-purple/20 text-monokai-purple text-xs rounded-md">
                    <Zap className="w-3 h-3" /> 探索新知
                  </span>
                )}
              </div>

              {/* 推荐理由 */}
              <p className="text-sm text-monokai-comment mb-4">{aiRecommendation.reason}</p>

              {/* 教程卡片 */}
              <button
                onClick={() => {
                  onSelectTutorial(aiRecommendation.tutorial);
                  closeAIRecommend();
                }}
                className="w-full p-4 bg-monokai-bg/60 border border-monokai-accent/40 rounded-xl text-left hover:border-monokai-purple/50 hover:bg-monokai-bg/80 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-monokai-fg group-hover:text-monokai-purple transition-colors">
                    {aiRecommendation.tutorial.title}
                  </h4>
                  <ArrowRight className="w-4 h-4 text-monokai-purple opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </div>
                <p className="text-[11px] text-monokai-comment line-clamp-2 mb-3">
                  {aiRecommendation.tutorial.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    aiRecommendation.tutorial.difficulty === 'Beginner' ? 'bg-monokai-green/20 text-monokai-green' :
                    aiRecommendation.tutorial.difficulty === 'Intermediate' ? 'bg-monokai-orange/20 text-monokai-orange' :
                    aiRecommendation.tutorial.difficulty === 'Advanced' ? 'bg-monokai-purple/20 text-monokai-purple' :
                    'bg-monokai-blue/20 text-monokai-blue'
                  }`}>
                    {aiRecommendation.tutorial.difficulty === 'Beginner' ? '入门' :
                     aiRecommendation.tutorial.difficulty === 'Intermediate' ? '进阶' :
                     aiRecommendation.tutorial.difficulty === 'Advanced' ? '高级' : '专家'}
                  </span>
                  <span className="text-[10px] text-monokai-comment">
                    {aiRecommendation.tutorial.estimatedTime}
                  </span>
                </div>
              </button>

              {/* 底部操作 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-monokai-accent/20">
                <button
                  onClick={handleGenerateAIRecommend}
                  disabled={isGeneratingRecommend}
                  className="flex items-center gap-1.5 text-xs text-monokai-comment hover:text-monokai-fg transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>换一批推荐</span>
                </button>
                <button
                  onClick={closeAIRecommend}
                  className="text-xs text-monokai-comment hover:text-monokai-fg transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialHome;
