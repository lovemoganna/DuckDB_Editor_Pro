import React from 'react';
import { OntologyPanel } from './OntologyPanel';

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
  onClose,
  onInsertToEditor,
  onTablesReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <OntologyPanel
        isActive={isActive}
        onInsert={onInsertToEditor}
        onTablesReady={onTablesReady}
      />
    </div>
  );
};

export default OntologyApp;

