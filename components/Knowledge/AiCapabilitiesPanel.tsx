import React from 'react';
import { AiCapabilityLibraryApp } from '../AiCapabilityLibrary/AiCapabilityLibraryApp';
import { AiCapabilityDefinition } from '../../services/aiCapabilitiesStorage';

interface AiCapabilitiesPanelProps {
  onExecuteCapability?: (capability: AiCapabilityDefinition) => void;
}

export const AiCapabilitiesPanel: React.FC<AiCapabilitiesPanelProps> = ({ onExecuteCapability }) => {
  return <AiCapabilityLibraryApp onExecuteCapabilityInEditor={onExecuteCapability} />;
};
