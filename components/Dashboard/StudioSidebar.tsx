import React, { useState } from 'react';
import {
  Home,
  Terminal,
  Database,
  Table2,
  ListTree,
  FolderInput,
  Box,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Tab } from '../../types';

interface StudioSidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onShowImportModal: () => void;
  onLoadDemo: () => void;
}

const navIdle =
  'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';
const navActive =
  'bg-monokai-accent/15 text-monokai-accent font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';
const navChildIdle =
  'text-monokai-comment hover:text-monokai-fg hover:bg-monokai-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';
const navChildActive =
  'bg-monokai-accent/15 text-monokai-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monokai-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-monokai-bg';

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  activeTab,
  setActiveTab,
  onShowImportModal,
  onLoadDemo,
}) => {
  const [isDataExpanded, setIsDataExpanded] = useState(true);
  const [isKnowledgeExpanded, setIsKnowledgeExpanded] = useState(true);

  return (
    <aside className="w-48 shrink-0 flex flex-col bg-monokai-sidebar border-r border-monokai-border select-none text-xs font-sans">
      <nav className="flex flex-col p-2 space-y-1" aria-label="侧边栏主导航">
        <button
          type="button"
          onClick={() => setActiveTab(Tab.DASHBOARD)}
          aria-current={activeTab === Tab.DASHBOARD ? 'page' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === Tab.DASHBOARD ? navActive : navIdle
          }`}
        >
          <Home className={`w-4 h-4 ${activeTab === Tab.DASHBOARD ? 'text-monokai-accent' : 'text-monokai-comment'}`} />
          <span>首页</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(Tab.SQL)}
          aria-current={activeTab === Tab.SQL ? 'page' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === Tab.SQL ? navActive : navIdle
          }`}
        >
          <Terminal className={`w-4 h-4 ${activeTab === Tab.SQL ? 'text-monokai-accent' : 'text-monokai-comment'}`} />
          <span>SQL 工作台</span>
        </button>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setIsDataExpanded(!isDataExpanded)}
            aria-expanded={isDataExpanded}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${navIdle}`}
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-monokai-comment" />
              <span>数据</span>
            </div>
            {isDataExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
            )}
          </button>

          {isDataExpanded && (
            <div className="flex flex-col pl-6 pr-1 space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => setActiveTab(Tab.DATA)}
                aria-current={activeTab === Tab.DATA ? 'page' : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-meta font-medium transition-colors cursor-pointer ${
                  activeTab === Tab.DATA ? navChildActive : navChildIdle
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>表</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(Tab.STRUCTURE)}
                aria-current={activeTab === Tab.STRUCTURE ? 'page' : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-meta font-medium transition-colors cursor-pointer ${
                  activeTab === Tab.STRUCTURE ? navChildActive : navChildIdle
                }`}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>Schema</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onShowImportModal}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${navIdle}`}
        >
          <FolderInput className="w-4 h-4 text-monokai-comment" />
          <span>文件导入</span>
        </button>

        <button
          type="button"
          onClick={onLoadDemo}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${navIdle}`}
        >
          <Box className="w-4 h-4 text-monokai-comment" />
          <span>示例数据</span>
        </button>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setIsKnowledgeExpanded(!isKnowledgeExpanded)}
            aria-expanded={isKnowledgeExpanded}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${navIdle}`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-monokai-comment" />
              <span>知识沉淀</span>
            </div>
            {isKnowledgeExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-monokai-comment" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-monokai-comment" />
            )}
          </button>

          {isKnowledgeExpanded && (
            <div className="flex flex-col pl-6 pr-1 space-y-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => setActiveTab(Tab.LIBRARY)}
                aria-current={activeTab === Tab.LIBRARY || activeTab === Tab.TUTORIALS ? 'page' : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-meta font-medium transition-colors cursor-pointer ${
                  activeTab === Tab.LIBRARY || activeTab === Tab.TUTORIALS ? navChildActive : navChildIdle
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>知识资产</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(Tab.ONTOLOGY)}
                aria-current={activeTab === Tab.ONTOLOGY || activeTab === Tab.AI_SKILLS ? 'page' : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-meta font-medium transition-colors cursor-pointer ${
                  activeTab === Tab.ONTOLOGY || activeTab === Tab.AI_SKILLS ? navChildActive : navChildIdle
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 认知</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};
