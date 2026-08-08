import React from 'react';
import { useOntologyStore } from '../../hooks/useOntologyStore';
import { OntologySimulationLab } from './OntologySimulationLab';
import { ConfirmDialogProvider } from '../ui/ConfirmDialog';

interface CompositionalDeductionAppProps {
  isOpen?: boolean;
  isActive?: boolean;
  onClose?: () => void;
}

const CompositionalDeductionContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { state: ontologyState, activeTemplateId } = useOntologyStore();

  return (
    <div className="w-full h-full bg-[#0c0d12] flex flex-col overflow-hidden">
      <OntologySimulationLab
        activeTemplateId={activeTemplateId}
        ontologyState={ontologyState}
        onClose={onClose || (() => {})}
      />
    </div>
  );
};

export const CompositionalDeductionApp: React.FC<CompositionalDeductionAppProps> = ({
  isOpen = true,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <ConfirmDialogProvider>
      <CompositionalDeductionContent onClose={onClose} />
    </ConfirmDialogProvider>
  );
};

export default CompositionalDeductionApp;
