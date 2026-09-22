import { describe, expect, it } from 'vitest';
import { Tab } from '../types';
import {
  WORKSPACE_FEATURES,
  getWorkspaceFeature,
  resolveWorkspaceTab,
} from './workspaceNavigation';

describe('workspace navigation intent resolution', () => {
  it.each([
    ['dashboard', Tab.DASHBOARD],
    ['sql', Tab.SQL],
    ['schema', Tab.STRUCTURE],
    ['history', Tab.HISTORY],
    ['logs', Tab.AUDIT],
    ['plugins', Tab.EXTENSIONS],
    ['learn', Tab.TUTORIALS],
    ['analysis_hub', Tab.ANALYSIS_HUB],
    ['ai_skills', Tab.AI_SKILLS],
    ['compositional_deduction', Tab.COMPOSITIONAL_DEDUCTION],
  ])('resolves %s to the matching workspace tab', (intent, expected) => {
    expect(resolveWorkspaceTab(intent)).toBe(expected);
  });

  it('rejects unknown navigation intents instead of blanking the workspace', () => {
    expect(resolveWorkspaceTab('not-a-real-screen')).toBeNull();
  });

  it('has one active-only feature destination for every workspace tab', () => {
    const tabs = Object.values(Tab);

    expect(WORKSPACE_FEATURES).toHaveLength(tabs.length);
    expect(new Set(WORKSPACE_FEATURES.map(feature => feature.tab)).size).toBe(tabs.length);

    for (const tab of tabs) {
      expect(getWorkspaceFeature(tab)).toMatchObject({
        tab,
        lifecycle: 'active-only',
      });
      expect(getWorkspaceFeature(tab).icon).not.toBe('');
    }
  });

  it('keeps route aliases unique across the registry', () => {
    const aliases = WORKSPACE_FEATURES.flatMap(feature => feature.aliases);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('derives every navigation section count from the feature registry', () => {
    const counts = WORKSPACE_FEATURES.reduce<Record<string, number>>((acc, feature) => {
      acc[feature.section] = (acc[feature.section] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({ database: 5, analytics: 4, knowledge: 3, capability: 4 });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(WORKSPACE_FEATURES.length);
  });
});
