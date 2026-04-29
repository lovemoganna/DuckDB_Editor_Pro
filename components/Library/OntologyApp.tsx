/**
 * OntologyApp - 本体论知识管理主组件
 *
 * 重构后：复用新的 OntologyPanel 统一入口，删除 MECE 五层结构，
 * 改为直觉化的三视图导航（图谱 / 数据 / 画布）。
 */

import React from 'react';
import { OntologyPanel } from './OntologyPanel';

interface OntologyAppProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToEditor?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyApp: React.FC<OntologyAppProps> = ({
  isOpen,
  onClose,
  onInsertToEditor,
  onTablesReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <OntologyPanel
        onInsert={onInsertToEditor}
        onTablesReady={onTablesReady}
      />
    </div>
  );
};

export default OntologyApp;
