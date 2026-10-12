import React, { useState } from 'react';
import { OntologyPanel } from './OntologyPanel';

// 实验组件按需加载；原本体工作区保持默认视图。
const UserFiatSliceLab = React.lazy(() => import('../Learn/UserFiatSliceLab'));

interface OntologyAppProps {
  isOpen: boolean;
  isActive?: boolean;
  onClose: () => void;
  onInsertToEditor?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyApp: React.FC<OntologyAppProps> = ({
  isOpen,
  isActive,
  onInsertToEditor,
  onTablesReady,
}) => {
  const [view, setView] = useState<'ontology' | 'liveSlice'>('ontology');
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2"
           role="group" aria-label="本体工作区视图">
        <button type="button" onClick={() => setView('ontology')}
          aria-pressed={view === 'ontology'}
          className={`rounded-md px-3 py-1.5 text-sm ${view === 'ontology' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          本体工作区
        </button>
        <button type="button" onClick={() => setView('liveSlice')}
          aria-pressed={view === 'liveSlice'}
          className={`rounded-md px-3 py-1.5 text-sm ${view === 'liveSlice' ? 'bg-cyan-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          真实数据切片 · 第五课
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'ontology' ? (
          <OntologyPanel
            isActive={isActive}
            onInsert={onInsertToEditor}
            onTablesReady={onTablesReady}
          />
        ) : (
          <div className="h-full w-full overflow-y-auto p-4">
            <React.Suspense fallback={<p className="text-sm text-zinc-400">正在加载真实数据实验…</p>}>
              <UserFiatSliceLab />
            </React.Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default OntologyApp;
