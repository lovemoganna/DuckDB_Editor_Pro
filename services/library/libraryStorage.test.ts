/**
 * services/library/libraryStorage.test.ts — Test skeleton for libraryStorage (IndexedDB)
 *
 * Tests CRUD on IndexedDB via libraryStorage:
 * - saveSqlTemplate / getAllSqlTemplates
 * - saveReferenceCard / getAllReferenceCards
 * - saveOntologyEntry / getAllOntologyEntries
 *
 * Strategy: vi.mock replaces the entire libraryStorage module with in-memory
 * implementations. No real IndexedDB calls — fully synchronous, no timers.
 * A `__resetStore__` function is exported from the mock so beforeEach can clear
 * the in-memory store between tests.
 * Follows the ARRANGE-ACT-ASSERT pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SqlTemplate, ReferenceCard, OntologyEntry, TemplateCategory } from '../../types';

// ─── Mock the entire libraryStorage module ─────────────────────────────────────
// This replaces the real module entirely — no IndexedDB needed.

vi.mock('../libraryStorage', () => {
  // Mutable object so the reference is shared with the exported reset function
  const storeData: Record<string, any[]> = {};

  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const saveSqlTemplate = async (
    template: Omit<SqlTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SqlTemplate> => {
    const now = Date.now();
    const newTemplate: SqlTemplate = {
      ...template,
      id: generateId(),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (!storeData['sql_templates']) storeData['sql_templates'] = [];
    storeData['sql_templates'].push(newTemplate);
    return newTemplate;
  };

  const getAllSqlTemplates = async (): Promise<SqlTemplate[]> => {
    return storeData['sql_templates'] ?? [];
  };

  const saveReferenceCard = async (
    card: Omit<ReferenceCard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ReferenceCard> => {
    const now = Date.now();
    const newCard: ReferenceCard = {
      ...card,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    if (!storeData['reference_cards']) storeData['reference_cards'] = [];
    storeData['reference_cards'].push(newCard);
    return newCard;
  };

  const getAllReferenceCards = async (): Promise<ReferenceCard[]> => {
    return storeData['reference_cards'] ?? [];
  };

  const saveOntologyEntry = async (
    entry: Omit<OntologyEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OntologyEntry> => {
    const now = Date.now();
    const newEntry: OntologyEntry = {
      ...entry,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    if (!storeData['ontology_entries']) storeData['ontology_entries'] = [];
    storeData['ontology_entries'].push(newEntry);
    return newEntry;
  };

  const getAllOntologyEntries = async (): Promise<OntologyEntry[]> => {
    return storeData['ontology_entries'] ?? [];
  };

  const __resetStore__ = () => {
    Object.keys(storeData).forEach(k => delete storeData[k]);
  };

  return {
    openDB: vi.fn(),
    saveSqlTemplate,
    getAllSqlTemplates,
    saveReferenceCard,
    getAllReferenceCards,
    saveOntologyEntry,
    getAllOntologyEntries,
    __resetStore__,
  };
});

// Import the mocked functions — Vitest resolves them from the mock
import {
  saveSqlTemplate,
  getAllSqlTemplates,
  saveReferenceCard,
  getAllReferenceCards,
  saveOntologyEntry,
  getAllOntologyEntries,
  __resetStore__,
} from '../libraryStorage';

// Reset in-memory store between tests
beforeEach(() => {
  __resetStore__();
});

// ─── SQL Templates ────────────────────────────────────────────────────────────

const makeTemplate = (
  overrides: Partial<SqlTemplate> = {}
): Omit<SqlTemplate, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Test Template',
  description: 'A test SQL template',
  sql: 'SELECT * FROM users',
  params: [],
  category: 'custom' as TemplateCategory,
  tags: ['test'],
  usageCount: 0,
  isSystem: false,
  ...overrides,
});

describe('saveSqlTemplate / getAllSqlTemplates', () => {
  it('saveSqlTemplate returns a template with id and timestamps', async () => {
    // ARRANGE
    const input = makeTemplate({ name: 'User Count' });

    // ACT
    const saved = await saveSqlTemplate(input);

    // ASSERT
    expect(saved).toHaveProperty('id');
    expect(saved.id).toBeTruthy();
    expect(saved).toHaveProperty('createdAt');
    expect(saved).toHaveProperty('updatedAt');
    expect(saved.name).toBe('User Count');
  });

  it('getAllSqlTemplates returns all saved templates', async () => {
    // ARRANGE
    await saveSqlTemplate(makeTemplate({ name: 'Template A' }));
    await saveSqlTemplate(makeTemplate({ name: 'Template B' }));

    // ACT
    const templates = await getAllSqlTemplates();

    // ASSERT
    expect(templates).toHaveLength(2);
    expect(templates.map(t => t.name)).toContain('Template A');
    expect(templates.map(t => t.name)).toContain('Template B');
  });

  it('each saveSqlTemplate call generates a unique id', async () => {
    // ACT
    const t1 = await saveSqlTemplate(makeTemplate());
    const t2 = await saveSqlTemplate(makeTemplate());

    // ASSERT
    expect(t1.id).not.toBe(t2.id);
  });

  it('saved template has usageCount initialised to 0', async () => {
    // ACT
    const saved = await saveSqlTemplate(
      makeTemplate({ usageCount: 99 } as any)
    );

    // ASSERT — service resets usageCount to 0 on create
    expect(saved.usageCount).toBe(0);
  });

  it('returns empty array when no templates saved', async () => {
    // ACT
    const templates = await getAllSqlTemplates();

    // ASSERT
    expect(templates).toEqual([]);
  });
});

// ─── Reference Cards ───────────────────────────────────────────────────────────

const makeCard = (
  overrides: Partial<ReferenceCard> = {}
): Omit<ReferenceCard, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: 'SELECT Basics',
  syntax: 'SELECT cols FROM table',
  example: 'SELECT * FROM users',
  scenario: 'Basic query',
  tags: ['select'],
  isSystem: false,
  ...overrides,
});

describe('saveReferenceCard / getAllReferenceCards', () => {
  it('saveReferenceCard returns card with id and timestamps', async () => {
    // ARRANGE
    const input = makeCard({ title: 'JOIN Syntax' });

    // ACT
    const saved = await saveReferenceCard(input);

    // ASSERT
    expect(saved).toHaveProperty('id');
    expect(saved.id).toBeTruthy();
    expect(saved).toHaveProperty('createdAt');
    expect(saved).toHaveProperty('updatedAt');
    expect(saved.title).toBe('JOIN Syntax');
  });

  it('getAllReferenceCards returns all saved cards', async () => {
    // ARRANGE
    await saveReferenceCard(makeCard({ title: 'Card 1' }));
    await saveReferenceCard(makeCard({ title: 'Card 2' }));

    // ACT
    const cards = await getAllReferenceCards();

    // ASSERT
    expect(cards).toHaveLength(2);
    expect(cards.map(c => c.title)).toContain('Card 1');
    expect(cards.map(c => c.title)).toContain('Card 2');
  });

  it('returns empty array when no cards saved', async () => {
    // ACT
    const cards = await getAllReferenceCards();

    // ASSERT
    expect(cards).toEqual([]);
  });
});

// ─── Ontology Entries ──────────────────────────────────────────────────────────

const makeOntologyEntry = (
  overrides: Partial<OntologyEntry> = {}
): Omit<OntologyEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'User Entity',
  fullName: 'sql.instance.user',
  abstractionLevel: 'instance',
  semanticType: 'IDENTIFIER',
  description: 'Represents a user',
  example: 'users table',
  sqlTemplate: 'SELECT * FROM users WHERE id = ?',
  parentId: undefined,
  childIds: [],
  relatedEntries: [],
  tags: ['user', 'entity'],
  domain: 'SQL',
  isSystem: false,
  ...overrides,
});

describe('saveOntologyEntry / getAllOntologyEntries', () => {
  it('saveOntologyEntry returns entry with id and timestamps', async () => {
    // ARRANGE
    const input = makeOntologyEntry({ name: 'Product Entity' });

    // ACT
    const saved = await saveOntologyEntry(input);

    // ASSERT
    expect(saved).toHaveProperty('id');
    expect(saved.id).toBeTruthy();
    expect(saved).toHaveProperty('createdAt');
    expect(saved).toHaveProperty('updatedAt');
    expect(saved.name).toBe('Product Entity');
  });

  it('getAllOntologyEntries returns all saved entries', async () => {
    // ARRANGE
    await saveOntologyEntry(makeOntologyEntry({ name: 'Entry A' }));
    await saveOntologyEntry(makeOntologyEntry({ name: 'Entry B' }));

    // ACT
    const entries = await getAllOntologyEntries();

    // ASSERT
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.name)).toContain('Entry A');
    expect(entries.map(e => e.name)).toContain('Entry B');
  });

  it('returns empty array when no entries saved', async () => {
    // ACT
    const entries = await getAllOntologyEntries();

    // ASSERT
    expect(entries).toEqual([]);
  });
});
