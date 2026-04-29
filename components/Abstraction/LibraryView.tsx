/**
 * LibraryView — 模板库视图
 *
 * 布局：两栏（列表 + 详情），AI 面板作为右侧可折叠抽屉
 * 配色：统一使用 monokai-border 作为分隔线
 */

import React, { useState } from 'react';
import { Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAnalysisHubStore } from '../../hooks/store/analysisHubStore';
import { TableList } from './TableList';
import { TableDetail } from './TableDetail';
import { AbstractionChatSession } from './AbstractionChatSession';

interface LibraryViewProps {
  onInsertSql?: (sql: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onInsertSql }) => {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const aiResult = useAnalysisHubStore(s => s.aiResult);

  return (
    <div className="h-full flex">
      {/* 左侧：列表 */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-monokai-border">
        <TableList onInsert={onInsertSql} />
      </div>

      {/* 中间：详情 */}
      <div className="flex-[2] min-w-0 border-r border-monokai-border">
        <TableDetail onInsert={onInsertSql} />
      </div>

      {/* 右侧：AI 抽屉 */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden flex-shrink-0 ${
          aiPanelOpen ? 'w-80' : 'w-0'
        }`}
      >
        {aiPanelOpen && (
          <div className="w-80 h-full">
            <AbstractionChatSession />
          </div>
        )}
      </div>

      {/* AI 切换按钮（浮动在右下角） */}
      <button
        onClick={() => setAiPanelOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 ${
          aiPanelOpen
            ? 'bg-monokai-surface border border-monokai-border text-monokai-fg-muted hover:text-monokai-fg'
            : 'bg-gradient-to-r from-monokai-purple to-monokai-blue text-white shadow-monokai-glow-purple'
        }`}
        style={{
          boxShadow: aiPanelOpen ? undefined : '0 0 24px rgba(189,147,249,0.35)',
        }}
        title={aiPanelOpen ? '收起 AI 面板' : 'AI 生成 SQL'}
      >
        {aiPanelOpen ? (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium">收起</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI 生成</span>
          </>
        )}
      </button>

      {/* AI 有结果时的提示 */}
      {!aiPanelOpen && aiResult?.sql && (
        <button
          onClick={() => setAiPanelOpen(true)}
          className="fixed bottom-6 right-36 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-monokai-purple/20 border border-monokai-purple/50 text-monokai-purple text-xs font-medium animate-pulse"
        >
          <Sparkles className="w-3 h-3" />
          AI 已生成结果
        </button>
      )}
    </div>
  );
};

export default LibraryView;
