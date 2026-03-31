/**
 * LearningPathPanel - 学习路径面板
 *
 * 基于 Quick_Tutorial 方法论的四阶段学习路径
 * 优化：AI 一键填充、快速清除、背景说明
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Check,
  Circle,
  Clock,
  BookOpen,
  GraduationCap,
  Lock,
  Play,
  Sparkles,
  Wand2,
  RotateCcw,
  Lightbulb,
  Loader2,
  X
} from 'lucide-react';
import { LearningStage, LearningNode } from '../../types';

interface LearningPathPanelProps {
  stages: LearningStage[];
  onMarkCompleted: (stageId: string, nodeId: string, completed: boolean) => void;
  onNavigateToSkill?: (skillId: string) => void;
}

export const LearningPathPanel: React.FC<LearningPathPanelProps> = ({
  stages,
  onMarkCompleted,
  onNavigateToSkill
}) => {
  const [expandedStage, setExpandedStage] = useState<string | null>(
    stages.find(s => s.isUnlocked)?.id || null
  );
  const [selectedNode, setSelectedNode] = useState<LearningNode | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isAIRecommending, setIsAIRecommending] = useState(false);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        handleAIRecommend();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // AI 推荐下一个学习节点
  const handleAIRecommend = useCallback(() => {
    setIsAIRecommending(true);

    // 模拟 AI 推荐延迟
    setTimeout(() => {
      // 找到最近完成但未完全掌握的学习阶段
      const completedStages = stages.filter(s => s.isUnlocked && s.nodes.some(n => n.isCompleted));
      const unlockedStages = stages.filter(s => s.isUnlocked);

      if (completedStages.length > 0) {
        // 推荐当前阶段中未完成的节点
        const currentStage = completedStages[completedStages.length - 1];
        const incompleteNode = currentStage.nodes.find(n => !n.isCompleted);
        if (incompleteNode) {
          setAiRecommendation(`建议继续学习「${currentStage.title}」中的「${incompleteNode.title}」`);
          setSelectedNode(incompleteNode);
          setIsAIRecommending(false);
          return;
        }
      }

      if (unlockedStages.length > 0) {
        // 推荐第一个解锁阶段
        const firstStage = unlockedStages[0];
        const firstNode = firstStage.nodes[0];
        if (firstNode) {
          setAiRecommendation(`建议从「${firstStage.title}」开始学习「${firstNode.title}」`);
          setSelectedNode(firstNode);
          setIsAIRecommending(false);
          return;
        }
      }

      setAiRecommendation('已完成所有学习内容！恭喜你！');
      setIsAIRecommending(false);
    }, 500);
  }, [stages]);

  // 快速重置学习进度
  const handleQuickReset = useCallback(() => {
    if (confirm('确定要重置所有学习进度吗？此操作不可恢复。')) {
      stages.forEach(stage => {
        stage.nodes.forEach(node => {
          if (node.isCompleted) {
            onMarkCompleted(stage.id, node.id, false);
          }
        });
      });
    }
  }, [stages, onMarkCompleted]);

  const toggleStage = useCallback((stageId: string) => {
    setExpandedStage(prev => prev === stageId ? null : stageId);
  }, []);

  const handleMarkCompleted = useCallback((stageId: string, nodeId: string, completed: boolean) => {
    onMarkCompleted(stageId, nodeId, completed);
  }, [onMarkCompleted]);

  // 计算进度
  const getProgress = (stage: LearningStage) => {
    const completed = stage.nodes.filter(n => n.isCompleted).length;
    return Math.round((completed / stage.nodes.length) * 100);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 学习路径头部 */}
      <div className="mb-6 p-4 bg-gradient-to-r from-monokai-purple/20 to-monokai-pink/20 border border-monokai-purple/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-monokai-purple" />
            <div>
              <h3 className="text-lg font-bold text-monokai-fg">SQL 学习路径</h3>
              <p className="text-xs text-monokai-comment">基于 Quick_Tutorial 方法论</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* AI 推荐按钮 */}
            <button
              onClick={handleAIRecommend}
              disabled={isAIRecommending}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-monokai-purple to-monokai-pink text-white rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              title="AI 智能推荐下一个学习内容（Ctrl+Shift+A）"
            >
              {isAIRecommending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              <span>{isAIRecommending ? '推荐中...' : 'AI 推荐'}</span>
            </button>
            {/* 快速重置按钮 */}
            <button
              onClick={handleQuickReset}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 rounded transition-colors"
              title="重置学习进度"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
        {/* AI 推荐提示 */}
        {aiRecommendation && (
          <div className="mt-2 p-2 bg-monokai-purple/10 rounded flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-monokai-yellow" />
            <span className="text-xs text-monokai-fg">{aiRecommendation}</span>
            <button
              onClick={() => setAiRecommendation(null)}
              className="ml-auto text-monokai-comment hover:text-monokai-fg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm mt-2">
          <span className="text-monokai-comment">
            共 <span className="text-monokai-fg font-medium">{stages.length}</span> 个阶段
          </span>
          <span className="text-monokai-comment">
            已解锁 <span className="text-monokai-fg font-medium">{stages.filter(s => s.isUnlocked).length}</span> 个
          </span>
        </div>
      </div>

      {/* 阶段列表 */}
      <div className="space-y-4">
        {stages.sort((a, b) => a.order - b.order).map((stage, index) => {
          const progress = getProgress(stage);
          const isExpanded = expandedStage === stage.id;
          const isUnlocked = stage.isUnlocked;

          return (
            <div
              key={stage.id}
              className={`border rounded-lg transition-colors ${
                isUnlocked
                  ? 'border-monokai-purple/30 bg-monokai-sidebar'
                  : 'border-monokai-accent/30 bg-monokai-bg opacity-60'
              }`}
            >
              {/* 阶段头部 */}
              <button
                onClick={() => isUnlocked && toggleStage(stage.id)}
                disabled={!isUnlocked}
                className={`w-full p-4 flex items-center gap-3 ${
                  isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                {/* 序号/锁图标 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  !isUnlocked
                    ? 'bg-monokai-accent/20'
                    : stage.nodes.every(n => n.isCompleted)
                    ? 'bg-monokai-green/20'
                    : 'bg-monokai-purple/20'
                }`}>
                  {!isUnlocked ? (
                    <Lock className="w-4 h-4 text-monokai-comment" />
                  ) : stage.nodes.every(n => n.isCompleted) ? (
                    <Check className="w-4 h-4 text-monokai-green" />
                  ) : (
                    <span className="text-sm font-bold text-monokai-purple">{index + 1}</span>
                  )}
                </div>

                {/* 阶段信息 */}
                <div className="flex-1 text-left">
                  <h4 className={`text-sm font-medium ${
                    isUnlocked ? 'text-monokai-fg' : 'text-monokai-comment'
                  }`}>
                    {stage.title}
                  </h4>
                  <p className="text-xs text-monokai-comment">{stage.description}</p>
                </div>

                {/* 进度条 */}
                {isUnlocked && (
                  <div className="w-24">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-monokai-comment">{progress}%</span>
                      <span className="text-xs text-monokai-comment">
                        {stage.nodes.filter(n => n.isCompleted).length}/{stage.nodes.length}
                      </span>
                    </div>
                    <div className="h-1.5 bg-monokai-accent/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-monokai-purple to-monokai-pink rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 展开图标 */}
                {isUnlocked && (
                  <div className="text-monokai-comment">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                )}
              </button>

              {/* 节点列表 */}
              {isExpanded && isUnlocked && (
                <div className="px-4 pb-4 space-y-2">
                  {stage.nodes.sort((a, b) => a.order - b.order).map(node => (
                    <div
                      key={node.id}
                      className={`p-3 border rounded-lg transition-colors ${
                        node.isCompleted
                          ? 'border-monokai-green/30 bg-monokai-green/5'
                          : 'border-monokai-accent/20 hover:border-monokai-purple/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 完成状态 */}
                        <button
                          onClick={() => handleMarkCompleted(stage.id, node.id, !node.isCompleted)}
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            node.isCompleted
                              ? 'bg-monokai-green text-white'
                              : 'border-2 border-monokai-accent hover:border-monokai-purple'
                          }`}
                        >
                          {node.isCompleted && <Check className="w-3 h-3" />}
                        </button>

                        {/* 节点内容 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className={`text-sm font-medium ${
                              node.isCompleted ? 'text-monokai-green' : 'text-monokai-fg'
                            }`}>
                              {node.title}
                            </h5>
                            <span className="flex items-center gap-1 text-xs text-monokai-comment">
                              <Clock className="w-3 h-3" />
                              {node.duration} 分钟
                            </span>
                          </div>
                          <p className="text-xs text-monokai-comment mb-2">{node.description}</p>

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedNode(node)}
                              className="text-xs text-monokai-blue hover:underline flex items-center gap-1"
                            >
                              <BookOpen className="w-3 h-3" />
                              开始学习
                            </button>
                            {node.skills.length > 0 && onNavigateToSkill && (
                              <button
                                onClick={() => onNavigateToSkill(node.skills[0])}
                                className="text-xs text-monokai-purple hover:underline flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" />
                                相关技能
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {stages.length === 0 && (
          <div className="text-center py-12">
            <GraduationCap className="w-12 h-12 text-monokai-comment mx-auto mb-3" />
            <p className="text-sm text-monokai-comment">暂无学习路径</p>
            <p className="text-xs text-monokai-comment mt-1">系统正在准备学习内容...</p>
          </div>
        )}
      </div>

      {/* 节点详情弹窗 */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-monokai-bg border border-monokai-purple/30 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-monokai-accent flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-monokai-fg">{selectedNode.title}</h3>
                <p className="text-xs text-monokai-comment">
                  预计时长 {selectedNode.duration} 分钟
                </p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded hover:bg-monokai-accent/20 text-monokai-comment"
              >
                ✕
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="prose prose-invert prose-sm max-w-none">
                {/* 简单渲染 Markdown */}
                {selectedNode.content.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-xl font-bold text-monokai-fg mt-4 mb-2">{line.slice(2)}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-lg font-bold text-monokai-fg mt-3 mb-2">{line.slice(3)}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-md font-medium text-monokai-fg mt-2 mb-1">{line.slice(4)}</h3>;
                  }
                  if (line.startsWith('```')) {
                    return null;
                  }
                  if (line.trim() === '') {
                    return <br key={idx} />;
                  }
                  return <p key={idx} className="text-sm text-monokai-comment mb-1">{line}</p>;
                })}
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 border-t border-monokai-accent flex justify-between">
              <button
                onClick={() => handleMarkCompleted(
                  stages.find(s => s.nodes.some(n => n.id === selectedNode.id))?.id || '',
                  selectedNode.id,
                  true
                )}
                className="flex items-center gap-2 px-4 py-2 bg-monokai-green text-white rounded-lg text-sm hover:bg-monokai-green/80 transition-colors"
              >
                <Check className="w-4 h-4" />
                标记为已完成
              </button>
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 bg-monokai-accent/20 text-monokai-comment rounded-lg text-sm hover:bg-monokai-accent/30 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPathPanel;
