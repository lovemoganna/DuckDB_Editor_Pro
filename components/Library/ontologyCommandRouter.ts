import type { DrawerTab, OntologyCommand, ViewTab } from '../../hooks/useOntologyStore';

export type OntologyInspectorMode = 'objectType' | 'object' | 'linkType' | 'link' | 'action';
export type OntologyCommandOperation = 'init' | 'reseed' | 'refresh';

export interface OntologyCommandPlan {
  view?: ViewTab;
  drawer?: DrawerTab;
  ensureDrawerOpen?: boolean;
  inspectorMode?: OntologyInspectorMode;
  operation?: OntologyCommandOperation;
}

const INSPECTOR_MODES: Record<
  Extract<OntologyCommand, { action: 'open-inspector' }>['mode'],
  OntologyInspectorMode
> = {
  'create-object-type': 'objectType',
  'create-object': 'object',
  'create-link-type': 'linkType',
  'create-link': 'link',
  'create-action': 'action',
};

export function planOntologyCommand(command: OntologyCommand): OntologyCommandPlan {
  switch (command.action) {
    case 'open-view':
      return { view: command.view };
    case 'open-drawer':
      return { drawer: command.drawer, ensureDrawerOpen: true };
    case 'open-inspector':
      return {
        drawer: 'crud',
        ensureDrawerOpen: true,
        inspectorMode: INSPECTOR_MODES[command.mode],
      };
    case 'init':
    case 'reseed':
    case 'refresh':
      return { operation: command.action };
  }
}
