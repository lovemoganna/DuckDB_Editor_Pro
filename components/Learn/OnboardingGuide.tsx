import React, { useState, useEffect, useMemo } from 'react';
import { getRecommendedFirstTutorial, tutorials, getLearningPath, TutorialMetadata } from '../../data/tutorials';

interface OnboardingGuideProps {
  onStartLearning: (tutorial?: TutorialMetadata) => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onStartLearning }) => {
  const [hasVisitedBefore, setHasVisitedBefore] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // 检查是否是首次访问
  useEffect(() => {
    const visited = localStorage.getItem('duckdb_learn_visited');
    setHasVisitedBefore(!!visited);
    if (!visited) {
      localStorage.setItem('duckdb_learn_visited', 'true');
    }
  }, []);
  
  const recommendedTutorial = useMemo(() => getRecommendedFirstTutorial(), []);
  const learningPath = useMemo(() => getLearningPath(), []);
  
  const handleStart = () => {
    onStartLearning(recommendedTutorial);
  };
  
  const handleExplore = () => {
    setIsExpanded(!isExpanded);
  };
  
  // 如果已经访问过且展开过，可以不显示或者最小化显示
  if (hasVisitedBefore && !isExpanded) {
    return (
      <div className="p-4 bg-monokai-sidebar/30 border-b border-monokai-accent">
        <button 
          onClick={handleExplore}
          className="flex items-center gap-2 text-sm text-monokai-blue hover:text-monokai-blue/80 transition-colors"
        >
          <span>▶</span>
          <span>展开学习引导</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-r from-monokai-blue/10 to-monokai-purple/10 border-b border-monokai-accent/50">
      {/* 主要引导区域 */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* 标题区 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-monokai-blue/20 flex items-center justify-center">
                <span className="text-xl">🚀</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {hasVisitedBefore ? '欢迎回来！继续学习之旅' : '开始您的 DuckDB 学习之旅'}
                </h2>
                <p className="text-sm text-monokai-comment">
                  系统化学习，从入门到精通
                </p>
              </div>
            </div>
            
            {/* 推荐课程卡片 */}
            <div className="bg-monokai-bg/50 rounded-xl p-4 border border-monokai-accent/30 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-monokai-comment mb-1">推荐入门课程</div>
                  <h3 className="text-lg font-bold text-monokai-fg">{recommendedTutorial.title}</h3>
                  <p className="text-sm text-monokai-comment mt-1 line-clamp-2">
                    {recommendedTutorial.description}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-xs text-monokai-green bg-monokai-green/20 px-2 py-1 rounded-full mb-2 inline-block">
                    {recommendedTutorial.difficulty}
                  </div>
                  <div className="text-xs text-monokai-comment">
                    ⏱️ {recommendedTutorial.estimatedTime}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 学习路径预览 */}
            <div className="mb-4">
              <div className="text-xs text-monokai-comment mb-2">完整学习路径</div>
              <div className="flex flex-wrap gap-2">
                {learningPath.slice(0, 4).map((t, idx) => (
                  <div 
                    key={t.id}
                    className="flex items-center gap-1 bg-monokai-accent/20 px-2 py-1 rounded text-xs"
                  >
                    <span className="text-monokai-blue font-bold">{idx + 1}.</span>
                    <span className="text-monokai-fg">{t.title}</span>
                    {t.difficulty === 'Beginner' && <span className="text-monokai-green">●</span>}
                    {t.difficulty === 'Intermediate' && <span className="text-monokai-orange">●</span>}
                  </div>
                ))}
                {learningPath.length > 4 && (
                  <div className="text-xs text-monokai-comment px-2 py-1">
                    +{learningPath.length - 4} 更多
                  </div>
                )}
              </div>
            </div>
            
            {/* 行动按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleStart}
                className="px-6 py-2.5 bg-monokai-blue hover:bg-monokai-blue/80 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <span>开始学习</span>
                <span>→</span>
              </button>
              <button
                onClick={handleExplore}
                className="px-4 py-2.5 bg-monokai-accent/30 hover:bg-monokai-accent/50 text-monokai-fg rounded-lg transition-colors"
              >
                探索课程
              </button>
            </div>
          </div>
          
          {/* 统计信息 */}
          <div className="shrink-0 ml-6 hidden lg:block">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-monokai-bg/50 rounded-lg p-3 text-center border border-monokai-accent/30">
                <div className="text-2xl font-bold text-monokai-blue">{tutorials.length}</div>
                <div className="text-xs text-monokai-comment">课程总数</div>
              </div>
              <div className="bg-monokai-bg/50 rounded-lg p-3 text-center border border-monokai-accent/30">
                <div className="text-2xl font-bold text-monokai-green">
                  {tutorials.filter(t => t.difficulty === 'Beginner').length}
                </div>
                <div className="text-xs text-monokai-comment">入门课程</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 可折叠：学习技巧 */}
      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-monokai-comment uppercase tracking-wider">学习建议</span>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-xs text-monokai-comment hover:text-monokai-fg"
            >
              收起 ▲
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-monokai-bg/30 rounded-lg p-3 border border-monokai-accent/20">
              <div className="text-sm font-bold text-monokai-fg mb-1">📖 循序渐进</div>
              <div className="text-xs text-monokai-comment">建议按顺序学习，先掌握基础概念</div>
            </div>
            <div className="bg-monokai-bg/30 rounded-lg p-3 border border-monokai-accent/20">
              <div className="text-sm font-bold text-monokai-fg mb-1">💻 动手实践</div>
              <div className="text-xs text-monokai-comment">每个知识点都配合实际操作加深理解</div>
            </div>
            <div className="bg-monokai-bg/30 rounded-lg p-3 border border-monokai-accent/20">
              <div className="text-sm font-bold text-monokai-fg mb-1">🎯 目标导向</div>
              <div className="text-xs text-monokai-comment">完成课程后可获得学习成就</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingGuide;
