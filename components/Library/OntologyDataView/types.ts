import React from 'react';

export type DataTab = 'objectType' | 'object' | 'linkType' | 'link' | 'action' | 'introspection' | 'insight';

export interface TabMeta {
  id: DataTab;
  label: string;
  icon: React.FC<any>;
  color: string;
  scenarioTitle: string;
  scenarioDesc: string;
  warningText: string;
}

export interface OntologyDataViewProps {
  onSelectObject?: (objectId: number) => void;
}
