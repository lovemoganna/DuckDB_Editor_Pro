import { describe, expect, it } from 'vitest';
import { buildSafeERDiagramDefinition } from './erDiagramDefinition';

describe('buildSafeERDiagramDefinition', () => {
  it('keeps database-controlled identifiers out of Mermaid source', () => {
    const definition = buildSafeERDiagramDefinition(
      [
        {
          table: 'users<script>alert(1)</script>',
          columns: [
            { name: 'id"}; click entity_0 callback', type: 'INTEGER' },
            { name: 'display name', type: 'VARCHAR(255)' },
          ],
        },
        {
          table: 'orders',
          columns: [{ name: 'user_id', type: 'INTEGER' }],
        },
      ],
      [
        {
          fromTable: 'orders',
          fromCol: 'user_id"}; click entity_1 callback',
          toTable: 'users<script>alert(1)</script>',
          toCol: 'id',
        },
      ],
    );

    expect(definition).toContain('entity_0');
    expect(definition).toContain('entity_1');
    expect(definition).toContain('field_0_0');
    expect(definition).toContain('relation_0');
    expect(definition).not.toContain('users<script>');
    expect(definition).not.toContain('orders');
    expect(definition).not.toContain('click');
    expect(definition).not.toContain('display name');
  });

  it('drops relationships that do not resolve to known entities', () => {
    const definition = buildSafeERDiagramDefinition(
      [{ table: 'known', columns: [] }],
      [{ fromTable: 'known', fromCol: 'id', toTable: 'missing', toCol: 'id' }],
    );

    expect(definition).not.toContain('relation_0');
    expect(definition).not.toContain('missing');
  });
});
