import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TutorialMetadata, getTutorialById, tutorials, getRecommendedFirstTutorial, getUserTutorialContent } from '../../data/tutorials';
import { TutorialHome } from './TutorialHome';
import { MarkdownViewer } from './MarkdownViewer';
import { NavigationPanel, Breadcrumb } from './NavigationPanel';
import { ProgressTracker } from './ProgressTracker';

import { EMBEDDED_CONTENT } from '../../data/tutorialContent';

interface LearnAppProps {
  onTryCode?: (code: string) => void;
  onOpenTable?: (tableName: string) => void;
}

export const LearnApp: React.FC<LearnAppProps> = ({ onTryCode, onOpenTable }) => {
  const [view, setView] = useState<'home' | 'tutorial' | 'onboarding'>('home');
  const [selectedTutorial, setSelectedTutorial] = useState<TutorialMetadata | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 加载教程文档内容
  useEffect(() => {
    if (selectedTutorial) {
      setLoading(true);
      setLoadError(null);

      // 判断是否为用户教程
      if (selectedTutorial.isUserTutorial) {
        // 用户教程从 IndexedDB 加载
        console.log('[LearnApp] Loading user tutorial:', selectedTutorial.id);
        getUserTutorialContent(selectedTutorial.id)
          .then(content => {
            if (content && content.length > 100) {
              setDocContent(content);
              console.log('[LearnApp] User tutorial loaded, length:', content.length);
            } else {
              setLoadError('无法加载教程内容，请稍后重试。');
            }
            setLoading(false);
          })
          .catch(err => {
            console.error('[LearnApp] Load user tutorial failed:', err);
            setLoadError('加载教程失败，请重试。');
            setLoading(false);
          });
        return;
      }

      // 内置教程：尝试从 public 目录加载
      console.log('[LearnApp] Loading document from:', selectedTutorial.docPath);

      fetch(selectedTutorial.docPath)
        .then(res => {
          console.log('[LearnApp] Fetch response:', res.status, res.statusText);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.text();
        })
        .then(content => {
          console.log('[LearnApp] Document loaded, length:', content.length);
          if (content && content.length > 100) {
            setDocContent(content);
          } else {
            throw new Error('Document content too short');
          }
          setLoading(false);
        })
        .catch((err) => {
          console.warn('[LearnApp] Fetch failed, trying fallback:', err.message);
          // 尝试内嵌方式
          const embedded = getEmbeddedDoc(selectedTutorial.id);
          if (embedded && embedded.length > 100) {
            setDocContent(embedded);
            console.log('[LearnApp] Using embedded content, length:', embedded.length);
          } else {
            setLoadError('无法加载教程内容，请稍后重试或联系支持。');
            console.error('[LearnApp] All loading methods failed');
          }
          setLoading(false);
        });
    }
  }, [selectedTutorial]);

  // 处理选择教程
  const handleSelectTutorial = useCallback((tutorial: TutorialMetadata) => {
    setSelectedTutorial(tutorial);
    setView('tutorial');
    setCurrentSection('');
  }, []);

  // 处理返回首页
  const handleGoHome = useCallback(() => {
    setView('home');
    setSelectedTutorial(null);
    setCurrentSection('');
    setDocContent('');
    setLoadError(null);
  }, []);

  // 处理章节导航
  const handleNavigateSection = useCallback((anchor: string) => {
    setCurrentSection(anchor);
    // 滚动到对应标题
    setTimeout(() => {
      const element = document.getElementById(anchor);
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // 处理推荐教程导航
  const handleNavigateToTutorial = useCallback((tutorialId: string) => {
    const tutorial = getTutorialById(tutorialId);
    if (tutorial) {
      handleSelectTutorial(tutorial);
    }
  }, [handleSelectTutorial]);

  return (
    <div className="h-full flex bg-monokai-bg overflow-hidden">
      {/* Navigation Panel - Always visible */}
      <NavigationPanel
        selectedTutorial={selectedTutorial}
        onSelectTutorial={handleSelectTutorial}
        currentSection={currentSection}
        onNavigateSection={handleNavigateSection}
      />

      {/* Main Content Area */}
      {view === 'home' ? (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-hidden">
            <TutorialHome onSelectTutorial={handleSelectTutorial} />
          </div>
          <ProgressTracker
            selectedTutorial={null}
            onNavigateToTutorial={handleNavigateToTutorial}
            onTryCode={onTryCode}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Breadcrumb Header */}
            <div className="shrink-0 p-4 border-b border-monokai-accent bg-monokai-sidebar/30 backdrop-blur-sm z-10">
              <Breadcrumb
                items={[
                  { label: 'Learn', onClick: handleGoHome },
                  { label: selectedTutorial?.title || '' },
                ]}
              />
              {selectedTutorial && (
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white truncate">{selectedTutorial.title}</h1>
                  <span className={`text-xs px-2 py-1 rounded shrink-0 ${selectedTutorial.difficulty === 'Beginner' ? 'bg-monokai-green/20 text-monokai-green' :
                    selectedTutorial.difficulty === 'Intermediate' ? 'bg-monokai-orange/20 text-monokai-orange' :
                      selectedTutorial.difficulty === 'Advanced' ? 'bg-monokai-purple/20 text-monokai-purple' :
                        'bg-monokai-blue/20 text-monokai-blue'
                    }`}>
                    {selectedTutorial.difficulty}
                  </span>
                  {selectedTutorial.estimatedTime && (
                    <span className="text-xs text-monokai-comment shrink-0">
                      ⏱️ {selectedTutorial.estimatedTime}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Markdown Content - Scrollable */}
            <div className="flex-1 overflow-hidden relative">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-monokai-blue border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-monokai-comment">Loading content...</div>
                  </div>
                </div>
              ) : docContent ? (
                <MarkdownViewer
                  content={docContent}
                  onTryCode={onTryCode}
                  onOpenTable={onOpenTable}
                />
              ) : loadError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md p-6 bg-monokai-sidebar/50 rounded-lg border border-monokai-pink/30">
                    <div className="text-4xl mb-4 text-monokai-orange">⚠️</div>
                    <p className="text-monokai-comment mb-4">{loadError}</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setLoadError(null);
                          setSelectedTutorial(prev => prev);
                        }}
                        className="block w-full px-4 py-2 bg-monokai-blue text-white rounded hover:bg-monokai-blue/80 transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={handleGoHome}
                        className="block w-full px-4 py-2 bg-monokai-accent text-white rounded hover:bg-monokai-comment transition-colors"
                      >
                        Back to Home
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-monokai-comment mb-4">Content not available</p>
                    <button
                      onClick={handleGoHome}
                      className="px-4 py-2 bg-monokai-blue text-white rounded"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Progress */}
          <ProgressTracker
            selectedTutorial={selectedTutorial}
            onNavigateSection={handleNavigateSection}
            onNavigateToTutorial={handleNavigateToTutorial}
            onTryCode={onTryCode}
          />
        </>
      )}
    </div>
  );
};

// 从 markdown 文档中提取内容
function getEmbeddedDoc(tutorialId: string): string {
  // 优先从嵌入内容获取
  if (EMBEDDED_CONTENT[tutorialId]) {
    return EMBEDDED_CONTENT[tutorialId];
  }

  // 尝试使用全局变量（如果在 index.html 中预加载了文档）
  const docMap = (window as any).__DOC_CONTENT__;
  if (docMap && docMap[tutorialId]) {
    return docMap[tutorialId];
  }

  // 返回默认提示
  return `
# 教程加载中...

请确保文档文件已正确配置。

## 当前教程 ID: ${tutorialId}

### 如何添加教程内容：

1. 在 \`components/Learn/LearnApp.tsx\` 中的 \`EMBEDDED_CONTENT\` 对象添加内容
2. 或者通过 \`(window as any).__DOC_CONTENT__\` 注入内容
3. 或者将 markdown 文件放入 \`public/docs/\` 目录

---

### 推荐学习路径

建议从「DuckDB SQL 完整使用教程」开始，这是为小白用户设计的入门课程。

### 下一章预告

完成本教程后，可以继续学习：
- 哲学数据库入门 - 通过哲学案例学习数据库设计
`;
}

export default LearnApp;
