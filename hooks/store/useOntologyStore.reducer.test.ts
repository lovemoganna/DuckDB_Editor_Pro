/**
 * useOntologyStore.reducer.test.ts — Unit tests for Ontology Store reducer
 *
 * Tests the reducer's handling of:
 * 1. SET_INIT_STATE / SET_INITTING / SET_DATA
 * 2. View state actions (SET_ACTIVE_TAB, TOGGLE_DRAWER, etc.)
 * 3. P0: Optimistic update actions (ADD/COMMIT/ROLLBACK_PENDING_MUTATION)
 * 4. SET_ERROR and CLEAR_DRAFT
 * 5. Canvas state actions (SET_CANVAS_LAYER, PUSH/POP_CANVAS_SNAPSHOT)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Inline the reducer for testing (copied from useOntologyStore.ts for isolation)
type InitState = 'loading' | 'no-tables' | 'need-seed' | 'ready';
type ViewTab = 'graph' | 'data' | 'canvas' | 'schema';
type DrawerTab = 'example' | 'templates' | 'schema' | 'crud' | 'insights' | 'mapping';
type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

interface CanvasSnapshot {
  timestamp: number;
  layer: MECELayer;
  itemsJson: string;
  spacesJson: string;
  edgesJson: string;
}

export interface OntologyStoreState {
  initState: InitState;
  initting: boolean;
  objectTypes: any[];
  objects: any[];
  linkTypes: any[];
  links: any[];
  actions: any[];
  introspections: any[];
  insights: any[];
  activeTab: ViewTab;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  insightsOpen: boolean;
  search: string;
  aiTopic: string;
  isGenerating: boolean;
  draftPayload: any | null;
  draftJsonStr: string;
  error: string | null;
  stats: {
    objectTypes: number;
    objects: number;
    linkTypes: number;
    links: number;
    actions: number;
    introspections: number;
    insights: number;
  };
  mapping: {
    namespace: string;
    objectTable: string;
    objectTypeTable: string;
    linkTable: string;
    linkTypeTable: string;
    actionTable: string;
  };
  canvasActiveLayer: MECELayer;
  canvasAiFillLoading: boolean;
  canvasSnapshots: CanvasSnapshot[];
  pendingMutations: PendingMutation[];
}

type PendingMutation = {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'object' | 'link' | 'objectType' | 'linkType' | 'action' | 'introspection' | 'insight';
  optimisticData?: any;
  tempId?: number;
};

type OntologyAction =
  | { type: 'SET_INIT_STATE'; state: InitState }
  | { type: 'SET_INITTING'; value: boolean }
  | { type: 'SET_DATA'; objectTypes: any[]; objects: any[]; linkTypes: any[]; links: any[]; actions: any[]; introspections: any[]; insights: any[] }
  | { type: 'SET_ACTIVE_TAB'; tab: ViewTab }
  | { type: 'SET_DRAWER_TAB'; tab: DrawerTab }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'TOGGLE_INSIGHTS' }
  | { type: 'SET_SEARCH'; term: string }
  | { type: 'SET_AI_TOPIC'; topic: string }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_DRAFT'; payload: any | null; jsonStr?: string }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_INTROSPECTIONS'; introspections: any[] }
  | { type: 'SET_INSIGHTS'; insights: any[] }
  | { type: 'UPDATE_MAPPING'; mapping: Partial<OntologyStoreState['mapping']> }
  | { type: 'SET_CANVAS_LAYER'; layer: MECELayer }
  | { type: 'SET_CANVAS_AI_FILL_LOADING'; value: boolean }
  | { type: 'PUSH_CANVAS_SNAPSHOT'; snapshot: CanvasSnapshot }
  | { type: 'POP_CANVAS_SNAPSHOT' }
  | { type: 'ADD_PENDING_MUTATION'; mutation: PendingMutation }
  | { type: 'COMMIT_PENDING_MUTATION'; mutationId: string }
  | { type: 'ROLLBACK_PENDING_MUTATION'; mutationId: string };

const initState: OntologyStoreState = {
  initState: 'loading',
  initting: false,
  objectTypes: [],
  objects: [],
  linkTypes: [],
  links: [],
  actions: [],
  introspections: [],
  insights: [],
  activeTab: 'graph',
  drawerOpen: true,
  drawerTab: 'example',
  insightsOpen: false,
  search: '',
  aiTopic: '',
  isGenerating: false,
  draftPayload: null,
  draftJsonStr: '',
  error: null,
  stats: {
    objectTypes: 0, objects: 0, linkTypes: 0, links: 0,
    actions: 0, introspections: 0, insights: 0,
  },
  mapping: {
    namespace: 'life',
    objectTable: 'life_object',
    objectTypeTable: 'life_object_type',
    linkTable: 'life_link',
    linkTypeTable: 'life_link_type',
    actionTable: 'life_action',
  },
  canvasActiveLayer: 'foundation',
  canvasAiFillLoading: false,
  canvasSnapshots: [],
  pendingMutations: [],
};

function reducer(state: OntologyStoreState, action: OntologyAction): OntologyStoreState {
  switch (action.type) {
    case 'SET_INIT_STATE':
      return { ...state, initState: action.state };
    case 'SET_INITTING':
      return { ...state, initting: action.value };
    case 'SET_DATA': {
      const stats = {
        objectTypes: action.objectTypes?.length || 0,
        objects: action.objects?.length || 0,
        linkTypes: action.linkTypes?.length || 0,
        links: action.links?.length || 0,
        actions: action.actions?.length || 0,
        introspections: action.introspections?.length || 0,
        insights: action.insights?.length || 0,
      };
      return {
        ...state,
        objectTypes: action.objectTypes || [],
        objects: action.objects || [],
        linkTypes: action.linkTypes || [],
        links: action.links || [],
        actions: action.actions || [],
        introspections: action.introspections || [],
        insights: action.insights || [],
        stats,
        initState: 'ready',
        error: null,
      };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_DRAWER_TAB':
      return { ...state, drawerTab: action.tab };
    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: !state.drawerOpen };
    case 'TOGGLE_INSIGHTS':
      return { ...state, insightsOpen: !state.insightsOpen };
    case 'SET_SEARCH':
      return { ...state, search: action.term };
    case 'SET_AI_TOPIC':
      return { ...state, aiTopic: action.topic };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value };
    case 'SET_DRAFT':
      return { ...state, draftPayload: action.payload, draftJsonStr: action.jsonStr ?? '' };
    case 'CLEAR_DRAFT':
      return { ...state, draftPayload: null, draftJsonStr: '', aiTopic: '' };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_INTROSPECTIONS':
      return {
        ...state,
        introspections: action.introspections || [],
        stats: { ...state.stats, introspections: action.introspections?.length || 0 },
      };
    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: action.insights || [],
        stats: { ...state.stats, insights: action.insights?.length || 0 },
      };
    case 'UPDATE_MAPPING':
      return { ...state, mapping: { ...state.mapping, ...action.mapping } };
    case 'SET_CANVAS_LAYER':
      return { ...state, canvasActiveLayer: action.layer };
    case 'SET_CANVAS_AI_FILL_LOADING':
      return { ...state, canvasAiFillLoading: action.value };
    case 'PUSH_CANVAS_SNAPSHOT':
      return {
        ...state,
        canvasSnapshots: [...state.canvasSnapshots, action.snapshot].slice(-5),
      };
    case 'POP_CANVAS_SNAPSHOT': {
      if (state.canvasSnapshots.length === 0) return state;
      return {
        ...state,
        canvasSnapshots: state.canvasSnapshots.slice(0, -1),
      };
    }
    case 'ADD_PENDING_MUTATION': {
      const mut = action.mutation;
      let newState = { ...state, pendingMutations: [...state.pendingMutations, mut] };
      switch (mut.entity) {
        case 'object': newState = { ...newState, objects: [mut.optimisticData, ...newState.objects] }; break;
        case 'link': newState = { ...newState, links: [mut.optimisticData, ...newState.links] }; break;
        case 'objectType': newState = { ...newState, objectTypes: [mut.optimisticData, ...newState.objectTypes] }; break;
        case 'linkType': newState = { ...newState, linkTypes: [mut.optimisticData, ...newState.linkTypes] }; break;
        case 'action': newState = { ...newState, actions: [mut.optimisticData, ...newState.actions] }; break;
        case 'introspection': newState = { ...newState, introspections: [mut.optimisticData, ...newState.introspections] }; break;
        case 'insight': newState = { ...newState, insights: [mut.optimisticData, ...newState.insights] }; break;
      }
      return newState;
    }
    case 'COMMIT_PENDING_MUTATION':
      return { ...state, pendingMutations: state.pendingMutations.filter(m => m.id !== action.mutationId) };
    case 'ROLLBACK_PENDING_MUTATION': {
      const mut = state.pendingMutations.find(m => m.id === action.mutationId);
      if (!mut) return state;
      const filtered = state.pendingMutations.filter(m => m.id !== action.mutationId);
      switch (mut.entity) {
        case 'object': return { ...state, objects: state.objects.filter(o => o.id !== mut.tempId), pendingMutations: filtered };
        case 'link': return { ...state, links: state.links.filter(l => l.id !== mut.tempId), pendingMutations: filtered };
        case 'objectType': return { ...state, objectTypes: state.objectTypes.filter(ot => ot.id !== mut.tempId), pendingMutations: filtered };
        case 'linkType': return { ...state, linkTypes: state.linkTypes.filter(lt => lt.id !== mut.tempId), pendingMutations: filtered };
        case 'action': return { ...state, actions: state.actions.filter(a => a.id !== mut.tempId), pendingMutations: filtered };
        case 'introspection': return { ...state, introspections: state.introspections.filter(i => i.id !== mut.tempId), pendingMutations: filtered };
        case 'insight': return { ...state, insights: state.insights.filter(i => i.id !== mut.tempId), pendingMutations: filtered };
        default: return { ...state, pendingMutations: filtered };
      }
    }
    default:
      return state;
  }
}

// ============================================================
// Test helpers
// ============================================================

const makeMockObject = (id: number, name = `obj-${id}`) => ({ id, object_type_id: 1, name, properties: '{}', annotations: '' });
const makeMockMutation = (id = `mut-${Date.now()}`, entity: PendingMutation['entity'] = 'object', tempId = -1): PendingMutation => ({
  id,
  type: 'create' as const,
  entity,
  tempId,
  optimisticData: makeMockObject(tempId, `temp-${tempId}`),
});

let state: OntologyStoreState;
beforeEach(() => { state = { ...initState }; });

// ============================================================
// SET_INIT_STATE / SET_INITTING / SET_DATA
// ============================================================

describe('SET_INIT_STATE', () => {
  it('transitions to no-tables', () => {
    const next = reducer(state, { type: 'SET_INIT_STATE', state: 'no-tables' });
    expect(next.initState).toBe('no-tables');
  });

  it('transitions to ready', () => {
    const next = reducer(state, { type: 'SET_INIT_STATE', state: 'ready' });
    expect(next.initState).toBe('ready');
  });

  it('does not reset other state', () => {
    state.activeTab = 'canvas';
    state.search = 'user';
    const next = reducer(state, { type: 'SET_INIT_STATE', state: 'loading' });
    expect(next.activeTab).toBe('canvas');
    expect(next.search).toBe('user');
  });
});

describe('SET_INITTING', () => {
  it('sets initting to true', () => {
    const next = reducer(state, { type: 'SET_INITTING', value: true });
    expect(next.initting).toBe(true);
  });

  it('sets initting to false', () => {
    state.initting = true;
    const next = reducer(state, { type: 'SET_INITTING', value: false });
    expect(next.initting).toBe(false);
  });
});

describe('SET_DATA', () => {
  it('populates all five core tables', () => {
    const objects = [makeMockObject(1), makeMockObject(2)];
    const linkTypes = [{ id: 1, name: 'links_to', description: '' }];
    const links = [{ id: 1, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.8 }];
    const next = reducer(state, {
      type: 'SET_DATA',
      objectTypes: [{ id: 1, name: 'Type1', description: '' }],
      objects,
      linkTypes,
      links,
      actions: [],
      introspections: [],
      insights: [],
    });
    expect(next.objects).toHaveLength(2);
    expect(next.links).toHaveLength(1);
    expect(next.initState).toBe('ready');
    expect(next.error).toBeNull();
  });

  it('computes stats correctly', () => {
    const next = reducer(state, {
      type: 'SET_DATA',
      objectTypes: [{ id: 1, name: 'T1', description: '' }],
      objects: [makeMockObject(1), makeMockObject(2)],
      linkTypes: [{ id: 1, name: 'L1', description: '' }],
      links: [makeMockObject(1) as any],
      actions: [makeMockObject(1) as any],
      introspections: [],
      insights: [],
    });
    expect(next.stats.objectTypes).toBe(1);
    expect(next.stats.objects).toBe(2);
    expect(next.stats.linkTypes).toBe(1);
  });

  it('handles empty arrays', () => {
    const next = reducer(state, {
      type: 'SET_DATA',
      objectTypes: [], objects: [], linkTypes: [], links: [], actions: [], introspections: [], insights: [],
    });
    expect(next.objects).toHaveLength(0);
    expect(next.stats.objects).toBe(0);
    expect(next.initState).toBe('ready');
  });

  it('handles undefined arrays (treats as empty)', () => {
    const next = reducer(state, {
      type: 'SET_DATA',
      objectTypes: undefined as any, objects: undefined as any,
      linkTypes: undefined as any, links: undefined as any,
      actions: undefined as any, introspections: undefined as any, insights: undefined as any,
    } as any);
    expect(next.objects).toHaveLength(0);
    expect(next.stats.objects).toBe(0);
  });
});

// ============================================================
// View state actions
// ============================================================

describe('SET_ACTIVE_TAB', () => {
  it('switches to canvas', () => {
    const next = reducer(state, { type: 'SET_ACTIVE_TAB', tab: 'canvas' });
    expect(next.activeTab).toBe('canvas');
  });

  it('switches to graph', () => {
    state.activeTab = 'canvas';
    const next = reducer(state, { type: 'SET_ACTIVE_TAB', tab: 'graph' });
    expect(next.activeTab).toBe('graph');
  });

  (['graph', 'data', 'canvas', 'schema'] as ViewTab[]).forEach(tab => {
    it(`accepts all valid tabs: ${tab}`, () => {
      const next = reducer(state, { type: 'SET_ACTIVE_TAB', tab });
      expect(next.activeTab).toBe(tab);
    });
  });
});

describe('TOGGLE_DRAWER', () => {
  it('toggles drawer from open to closed', () => {
    state.drawerOpen = true;
    const next = reducer(state, { type: 'TOGGLE_DRAWER' });
    expect(next.drawerOpen).toBe(false);
  });

  it('toggles drawer from closed to open', () => {
    state.drawerOpen = false;
    const next = reducer(state, { type: 'TOGGLE_DRAWER' });
    expect(next.drawerOpen).toBe(true);
  });
});

describe('TOGGLE_INSIGHTS', () => {
  it('toggles insightsOpen', () => {
    state.insightsOpen = false;
    const next = reducer(state, { type: 'TOGGLE_INSIGHTS' });
    expect(next.insightsOpen).toBe(true);
  });
});

describe('SET_SEARCH', () => {
  it('sets search term', () => {
    const next = reducer(state, { type: 'SET_SEARCH', term: '张三' });
    expect(next.search).toBe('张三');
  });
});

describe('SET_ERROR', () => {
  it('sets error message', () => {
    const next = reducer(state, { type: 'SET_ERROR', error: 'Table not found' });
    expect(next.error).toBe('Table not found');
  });

  it('clears error with null', () => {
    state.error = 'Previous error';
    const next = reducer(state, { type: 'SET_ERROR', error: null });
    expect(next.error).toBeNull();
  });
});

describe('CLEAR_DRAFT', () => {
  it('resets draft state', () => {
    state.draftPayload = { objects: [] } as any;
    state.draftJsonStr = '{"key":"value"}';
    state.aiTopic = 'some topic';
    const next = reducer(state, { type: 'CLEAR_DRAFT' });
    expect(next.draftPayload).toBeNull();
    expect(next.draftJsonStr).toBe('');
    expect(next.aiTopic).toBe('');
  });
});

// ============================================================
// P0: Optimistic Update — ADD_PENDING_MUTATION
// ============================================================

describe('ADD_PENDING_MUTATION', () => {
  it('adds mutation to pendingMutations list', () => {
    const mut = makeMockMutation();
    const next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: mut });
    expect(next.pendingMutations).toHaveLength(1);
    expect(next.pendingMutations[0].id).toBe(mut.id);
  });

  it('adds optimistic object to objects array', () => {
    const mut = makeMockMutation('m1', 'object', -42);
    const next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: mut });
    expect(next.objects).toHaveLength(1);
    expect(next.objects[0].id).toBe(-42);
    expect(next.objects[0].name).toBe('temp--42');
  });

  it('adds optimistic link to links array', () => {
    const mut = makeMockMutation('m2', 'link', -99);
    mut.optimisticData = { id: -99, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.5 };
    const next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: mut });
    expect(next.links).toHaveLength(1);
    expect(next.links[0].id).toBe(-99);
  });

  it('adds optimistic objectType to objectTypes array', () => {
    const mut = makeMockMutation('m3', 'objectType', -7);
    mut.optimisticData = { id: -7, name: 'NewType', description: 'test' };
    const next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: mut });
    expect(next.objectTypes).toHaveLength(1);
    expect(next.objectTypes[0].id).toBe(-7);
  });

  it('adds optimistic linkType to linkTypes array', () => {
    const mut = makeMockMutation('m4', 'linkType', -8);
    mut.optimisticData = { id: -8, name: 'NewLinkType', description: '' };
    const next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: mut });
    expect(next.linkTypes).toHaveLength(1);
    expect(next.linkTypes[0].id).toBe(-8);
  });

  it('accumulates multiple mutations', () => {
    const m1 = makeMockMutation('m1', 'object', -1);
    const m2 = makeMockMutation('m2', 'object', -2);
    let next = reducer(state, { type: 'ADD_PENDING_MUTATION', mutation: m1 });
    next = reducer(next, { type: 'ADD_PENDING_MUTATION', mutation: m2 });
    expect(next.pendingMutations).toHaveLength(2);
    expect(next.objects).toHaveLength(2);
  });
});

// ============================================================
// P0: Optimistic Update — COMMIT_PENDING_MUTATION
// ============================================================

describe('COMMIT_PENDING_MUTATION', () => {
  it('removes mutation from pendingMutations', () => {
    const mut = makeMockMutation('to-commit', 'object', -1);
    state.pendingMutations = [mut];
    state.objects = [{ id: -1, name: 'temp', object_type_id: 1, properties: '{}', annotations: '' }];
    const next = reducer(state, { type: 'COMMIT_PENDING_MUTATION', mutationId: 'to-commit' });
    expect(next.pendingMutations).toHaveLength(0);
  });

  it('keeps optimistic data in place on commit (DB is source of truth)', () => {
    const mut = makeMockMutation('to-commit', 'object', -1);
    state.pendingMutations = [mut];
    state.objects = [{ id: -1, name: 'temp', object_type_id: 1, properties: '{}', annotations: '' }];
    const next = reducer(state, { type: 'COMMIT_PENDING_MUTATION', mutationId: 'to-commit' });
    // Commit just removes the pending record; data stays (DB refresh will replace temp data)
    expect(next.objects).toHaveLength(1);
    expect(next.objects[0].id).toBe(-1);
  });

  it('ignores unknown mutationId', () => {
    const mut = makeMockMutation('real', 'object', -1);
    state.pendingMutations = [mut];
    state.objects = [{ id: -1, name: 'temp', object_type_id: 1, properties: '{}', annotations: '' }];
    const next = reducer(state, { type: 'COMMIT_PENDING_MUTATION', mutationId: 'unknown-id' });
    expect(next.pendingMutations).toHaveLength(1);
    expect(next.objects).toHaveLength(1);
  });
});

// ============================================================
// P0: Optimistic Update — ROLLBACK_PENDING_MUTATION
// ============================================================

describe('ROLLBACK_PENDING_MUTATION', () => {
  it('removes optimistic object from objects array', () => {
    const mut = makeMockMutation('to-rollback', 'object', -1);
    state.pendingMutations = [mut];
    state.objects = [{ id: -1, name: 'temp', object_type_id: 1, properties: '{}', annotations: '' }];
    const next = reducer(state, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: 'to-rollback' });
    expect(next.objects).toHaveLength(0);
    expect(next.pendingMutations).toHaveLength(0);
  });

  it('removes optimistic link from links array', () => {
    const mut = makeMockMutation('to-rollback', 'link', -2);
    state.pendingMutations = [mut];
    state.links = [{ id: -2, link_type_id: 1, source_object_id: 1, target_object_id: 2, weight: 0.5 }];
    const next = reducer(state, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: 'to-rollback' });
    expect(next.links).toHaveLength(0);
    expect(next.pendingMutations).toHaveLength(0);
  });

  it('removes optimistic objectType from objectTypes array', () => {
    const mut = makeMockMutation('to-rollback', 'objectType', -3);
    state.pendingMutations = [mut];
    state.objectTypes = [{ id: -3, name: 'temp', description: '' }];
    const next = reducer(state, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: 'to-rollback' });
    expect(next.objectTypes).toHaveLength(0);
  });

  it('ignores unknown mutationId', () => {
    const mut = makeMockMutation('real', 'object', -1);
    state.pendingMutations = [mut];
    state.objects = [{ id: -1, name: 'temp', object_type_id: 1, properties: '{}', annotations: '' }];
    const next = reducer(state, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: 'unknown-id' });
    expect(next.objects).toHaveLength(1);
    expect(next.pendingMutations).toHaveLength(1);
  });

  it('does nothing when mutation not found in list', () => {
    state.pendingMutations = [];
    const next = reducer(state, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: 'any-id' });
    expect(next).toEqual(state);
  });

  it('handles all entity types on rollback', () => {
    const entities: PendingMutation['entity'][] = ['action', 'introspection', 'insight'];
    for (const entity of entities) {
      const mut = makeMockMutation(`rb-${entity}`, entity, -999);
      mut.optimisticData = { id: -999, name: `temp-${entity}` };
      const s = {
        ...state,
        pendingMutations: [mut],
        actions: entity === 'action' ? [{ id: -999 }] : [],
        introspections: entity === 'introspection' ? [{ id: -999 }] : [],
        insights: entity === 'insight' ? [{ id: -999 }] : [],
      };
      const next = reducer(s, { type: 'ROLLBACK_PENDING_MUTATION', mutationId: `rb-${entity}` });
      expect(next.pendingMutations).toHaveLength(0);
    }
  });
});

// ============================================================
// Canvas State Actions
// ============================================================

describe('SET_CANVAS_LAYER', () => {
  it('switches to patterns layer', () => {
    const next = reducer(state, { type: 'SET_CANVAS_LAYER', layer: 'patterns' });
    expect(next.canvasActiveLayer).toBe('patterns');
  });

  (['foundation', 'relations', 'methodology', 'patterns', 'domains'] as MECELayer[]).forEach(layer => {
    it(`accepts all valid layers: ${layer}`, () => {
      const next = reducer(state, { type: 'SET_CANVAS_LAYER', layer });
      expect(next.canvasActiveLayer).toBe(layer);
    });
  });
});

describe('PUSH_CANVAS_SNAPSHOT', () => {
  it('adds snapshot to history', () => {
    const snap: CanvasSnapshot = { timestamp: Date.now(), layer: 'foundation', itemsJson: '{}', spacesJson: '{}', edgesJson: '[]' };
    const next = reducer(state, { type: 'PUSH_CANVAS_SNAPSHOT', snapshot: snap });
    expect(next.canvasSnapshots).toHaveLength(1);
    expect(next.canvasSnapshots[0].layer).toBe('foundation');
  });

  it('caps history at 5 entries', () => {
    for (let i = 0; i < 7; i++) {
      state = reducer(state, {
        type: 'PUSH_CANVAS_SNAPSHOT',
        snapshot: { timestamp: i, layer: 'foundation', itemsJson: '{}', spacesJson: '{}', edgesJson: '[]' },
      });
    }
    expect(state.canvasSnapshots).toHaveLength(5);
    expect(state.canvasSnapshots[0].timestamp).toBe(2); // oldest remaining
  });
});

describe('POP_CANVAS_SNAPSHOT', () => {
  it('removes last snapshot', () => {
    state.canvasSnapshots = [
      { timestamp: 1, layer: 'foundation', itemsJson: '{}', spacesJson: '{}', edgesJson: '[]' },
      { timestamp: 2, layer: 'foundation', itemsJson: '{}', spacesJson: '{}', edgesJson: '[]' },
    ];
    const next = reducer(state, { type: 'POP_CANVAS_SNAPSHOT' });
    expect(next.canvasSnapshots).toHaveLength(1);
    expect(next.canvasSnapshots[0].timestamp).toBe(1);
  });

  it('does nothing when history is empty', () => {
    const next = reducer(state, { type: 'POP_CANVAS_SNAPSHOT' });
    expect(next.canvasSnapshots).toHaveLength(0);
  });
});

describe('SET_CANVAS_AI_FILL_LOADING', () => {
  it('sets loading true', () => {
    const next = reducer(state, { type: 'SET_CANVAS_AI_FILL_LOADING', value: true });
    expect(next.canvasAiFillLoading).toBe(true);
  });
});

describe('SET_INTROSPECTIONS / SET_INSIGHTS', () => {
  it('SET_INTROSPECTIONS updates introspections and stats', () => {
    const intros = [{ id: 1, question: 'Q1', answer: 'A1' }];
    const next = reducer(state, { type: 'SET_INTROSPECTIONS', introspections: intros });
    expect(next.introspections).toHaveLength(1);
    expect(next.stats.introspections).toBe(1);
  });

  it('SET_INSIGHTS updates insights and stats', () => {
    const insights = [{ id: 1, insight: 'I1', tag: 'test' }];
    const next = reducer(state, { type: 'SET_INSIGHTS', insights });
    expect(next.insights).toHaveLength(1);
    expect(next.stats.insights).toBe(1);
  });
});

describe('UPDATE_MAPPING', () => {
  it('updates namespace', () => {
    const next = reducer(state, { type: 'UPDATE_MAPPING', mapping: { namespace: 'work' } });
    expect(next.mapping.namespace).toBe('work');
  });

  it('preserves other mapping fields', () => {
    const next = reducer(state, { type: 'UPDATE_MAPPING', mapping: { namespace: 'work' } });
    expect(next.mapping.objectTable).toBe('life_object');
    expect(next.mapping.actionTable).toBe('life_action');
  });
});

describe('SET_DRAFT', () => {
  it('sets payload and jsonStr', () => {
    const payload = { objects: [], links: [] };
    const next = reducer(state, { type: 'SET_DRAFT', payload, jsonStr: '{"test":true}' });
    expect(next.draftPayload).toEqual(payload);
    expect(next.draftJsonStr).toBe('{"test":true}');
  });

  it('defaults jsonStr to empty string', () => {
    const next = reducer(state, { type: 'SET_DRAFT', payload: null });
    expect(next.draftJsonStr).toBe('');
  });
});
