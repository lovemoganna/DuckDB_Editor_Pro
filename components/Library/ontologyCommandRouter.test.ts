import { describe, expect, it } from 'vitest';
import { planOntologyCommand } from './ontologyCommandRouter';

describe('ontology command routing', () => {
  it('routes view and drawer commands to visible ontology state', () => {
    expect(planOntologyCommand({ action: 'open-view', view: 'canvas' })).toEqual({
      view: 'canvas',
    });
    expect(planOntologyCommand({ action: 'open-drawer', drawer: 'mapping' })).toEqual({
      drawer: 'mapping',
      ensureDrawerOpen: true,
    });
  });

  it.each([
    ['create-object-type', 'objectType'],
    ['create-object', 'object'],
    ['create-link-type', 'linkType'],
    ['create-link', 'link'],
    ['create-action', 'action'],
  ] as const)('maps %s to the matching inspector mode', (mode, inspectorMode) => {
    expect(planOntologyCommand({ action: 'open-inspector', mode })).toEqual({
      drawer: 'crud',
      ensureDrawerOpen: true,
      inspectorMode,
    });
  });

  it.each(['init', 'reseed', 'refresh'] as const)('preserves %s as an operation', operation => {
    expect(planOntologyCommand({ action: operation })).toEqual({ operation });
  });
});
