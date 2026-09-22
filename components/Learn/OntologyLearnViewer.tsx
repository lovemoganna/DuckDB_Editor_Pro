/**
 * OntologyLearnViewer - 本体课程综合学习视图
 * 
 * 功能：
 * - 检测是否为本体课程
 * - 自动加载对应的 seed-lesson-*.json 数据
 * - 集成 OntologyInteractiveViewer
 * - 与 MarkdownViewer 配合展示课程内容
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, ExternalLink, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { OntologyInteractiveViewer, OntologyLessonData } from './OntologyInteractiveViewer';
import { useOntologyLessons } from '../../hooks/useOntologyLessons';
import { useLearningProgress } from '../../hooks/useLearningProgress';

interface OntologyLearnViewerProps {
  /** 课程 ID (如 ontology-0001) */
  lessonId: string;
  /** 课程标题 */
  lessonTitle: string;
  /** 课程描述 */
  lessonDescription?: string;
  /** 父组件回调 */
  onTryCode?: (code: string) => void;
  onOpenTable?: (tableName: string) => void;
}

/**
 * 检测课程 ID 是否为本体课程
 */
export const isOntologyLesson = (lessonId: string): boolean => {
  return /^ontology-\d{4}$/i.test(lessonId);
};

/**
 * 从课程 ID 获取对应的 seed 文件编号
 */
export const getSeedNumber = (lessonId: string): string | null => {
  const match = lessonId.match(/^ontology-(\d{4})$/i);
  if (match) {
    return match[1];
  }
  return null;
};

/**
 * 主组件
 */
export const OntologyLearnViewer: React.FC<OntologyLearnViewerProps> = ({
  lessonId,
  lessonTitle,
  lessonDescription,
  onTryCode,
  onOpenTable,
}) => {
  // Hooks
  const { loadLessonData, getLesson } = useOntologyLessons();
  const { markTutorialComplete, isTutorialCompleted } = useLearningProgress();

  // 本地状态
  const [ontologyData, setOntologyData] = useState<OntologyLessonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInteractive, setShowInteractive] = useState(false);

  // 获取课程元数据
  const lessonMeta = getLesson(lessonId);
  const isCompleted = isTutorialCompleted(lessonId);

  // 加载本体数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await loadLessonData(lessonId);
        if (data) {
          setOntologyData(data);
        } else {
          setError('无法加载本体课程数据');
        }
      } catch (e) {
        console.error('[OntologyLearnViewer] Load error:', e);
        setError('加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOntologyLesson(lessonId)) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [lessonId, loadLessonData]);

  // 处理完成课程
  const handleCompleteLesson = useCallback(() => {
    markTutorialComplete(lessonId);
  }, [lessonId, markTutorialComplete]);

  // 如果不是本体课程，返回 null
  if (!isOntologyLesson(lessonId)) {
    return null;
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-monokai-cyan animate-spin" />
          <div className="text-monokai-comment text-sm">正在加载本体课程...</div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !ontologyData) {
    return (
      <div className="p-6 bg-monokai-pink/10 border border-monokai-pink/30 rounded-lg">
        <div className="flex items-center gap-3 text-monokai-pink">
          <Sparkles className="w-5 h-5" />
          <span>{error || '本体课程数据不可用'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 本体课程头部信息 */}
      <div className="bg-gradient-to-r from-monokai-cyan/10 via-monokai-blue/5 to-transparent border border-monokai-cyan/30 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* 核心概念标签 */}
            {ontologyData._meta.core_concept && (
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 text-[10px] font-bold bg-monokai-cyan/20 text-monokai-cyan rounded-full border border-monokai-cyan/30 uppercase tracking-wider">
                  {ontologyData._meta.core_concept}
                </span>
                {isCompleted && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-monokai-green/20 text-monokai-green rounded-full border border-monokai-green/30">
                    ✓ 已完成
                  </span>
                )}
              </div>
            )}

            {/* 标题和描述 */}
            <h2 className="text-lg font-bold text-monokai-fg mb-2">
              {ontologyData._meta.name}
            </h2>
            <p className="text-sm text-monokai-comment leading-relaxed">
              {ontologyData._meta.description}
            </p>

            {/* 案例背景 */}
            {ontologyData._meta.case_background && (
              <div className="mt-4 p-3 bg-monokai-yellow/10 border border-monokai-yellow/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-monokai-yellow text-monokai-bg rounded shrink-0 uppercase tracking-wider">
                    案例
                  </span>
                  <p className="text-xs text-monokai-fg/90 leading-relaxed">
                    {ontologyData._meta.case_background}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 统计数据 */}
          <div className="shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-monokai-surface/50 rounded-lg border border-monokai-border/30">
              <span className="text-xs text-monokai-comment">实体</span>
              <span className="text-sm font-bold text-monokai-cyan">{ontologyData.objects?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-monokai-surface/50 rounded-lg border border-monokai-border/30">
              <span className="text-xs text-monokai-comment">关系</span>
              <span className="text-sm font-bold text-monokai-blue">{ontologyData.links?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-monokai-surface/50 rounded-lg border border-monokai-border/30">
              <span className="text-xs text-monokai-comment">类型</span>
              <span className="text-sm font-bold text-monokai-green">{ontologyData.objectTypes?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setShowInteractive(!showInteractive)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showInteractive
                ? 'bg-monokai-cyan text-monokai-bg'
                : 'bg-monokai-cyan/20 text-monokai-cyan border border-monokai-cyan/30 hover:bg-monokai-cyan/30'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{showInteractive ? '隐藏交互视图' : '打开交互视图'}</span>
          </button>

          {!isCompleted && (
            <button
              onClick={handleCompleteLesson}
              className="flex items-center gap-2 px-4 py-2.5 bg-monokai-green/20 text-monokai-green border border-monokai-green/30 rounded-lg text-sm font-medium hover:bg-monokai-green/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>标记完成</span>
            </button>
          )}

          {lessonMeta && (
            <div className="ml-auto text-xs text-monokai-comment flex items-center gap-2">
              <span>下一课:</span>
              <span className="text-monokai-fg">待定</span>
            </div>
          )}
        </div>
      </div>

      {/* 交互式本体编辑器 */}
      {showInteractive && ontologyData && (
        <OntologyInteractiveViewer data={ontologyData} />
      )}

      {/* 洞察卡片 */}
      {ontologyData.insights && ontologyData.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-monokai-green" />
            关键洞察
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ontologyData.insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-4 bg-monokai-green/5 border border-monokai-green/20 rounded-lg"
              >
                {insight.tag && (
                  <span className="inline-block px-2 py-0.5 text-[9px] font-bold bg-monokai-green/20 text-monokai-green rounded mb-2 uppercase tracking-wider">
                    {insight.tag}
                  </span>
                )}
                <p className="text-sm text-monokai-fg leading-relaxed">
                  {insight.insight}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 反思探针卡片 */}
      {ontologyData.introspections && ontologyData.introspections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-monokai-comment uppercase tracking-wider flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-monokai-cyan/20 text-monokai-cyan flex items-center justify-center text-[10px]">?</span>
            反思探针
          </h3>
          <div className="space-y-2">
            {ontologyData.introspections.map((intro, idx) => (
              <div
                key={idx}
                className="p-4 bg-monokai-cyan/5 border border-monokai-cyan/20 rounded-lg"
              >
                <p className="text-sm text-monokai-cyan font-medium mb-2">
                  {intro.question}
                </p>
                <p className="text-xs text-monokai-comment leading-relaxed">
                  {intro.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OntologyLearnViewer;
