export interface ERDiagramColumn {
  name: string;
  type: string;
}

export interface ERDiagramTable {
  table: string;
  columns: ERDiagramColumn[];
}

export interface ERDiagramRelationship {
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
}

const TYPE_ALIASES: Record<string, string> = {
  bigint: 'bigint',
  blob: 'blob',
  bool: 'boolean',
  boolean: 'boolean',
  char: 'string',
  date: 'date',
  decimal: 'decimal',
  double: 'double',
  float: 'float',
  hugeint: 'bigint',
  int: 'integer',
  integer: 'integer',
  json: 'json',
  numeric: 'decimal',
  real: 'float',
  smallint: 'integer',
  text: 'string',
  time: 'time',
  timestamp: 'timestamp',
  tinyint: 'integer',
  ubigint: 'bigint',
  uhugeint: 'bigint',
  uint: 'integer',
  usmallint: 'integer',
  utinyint: 'integer',
  uuid: 'string',
  varchar: 'string',
};

function safeType(type: unknown): string {
  const baseType = String(type ?? '')
    .trim()
    .split(/[<(]/, 1)[0]
    .toLowerCase();
  return TYPE_ALIASES[baseType] ?? 'string';
}

/**
 * Builds Mermaid from generated tokens only. Real database identifiers remain
 * in the React-rendered table list and never enter Mermaid's parser.
 */
export function buildSafeERDiagramDefinition(
  schemas: ERDiagramTable[],
  relationships: ERDiagramRelationship[],
): string {
  const entityIds = new Map<string, string>();
  const lines = ['erDiagram'];

  schemas.forEach((schema, tableIndex) => {
    const entityId = `entity_${tableIndex}`;
    entityIds.set(schema.table, entityId);
    lines.push(`  ${entityId} {`);
    (Array.isArray(schema.columns) ? schema.columns : []).forEach((column, columnIndex) => {
      lines.push(`    ${safeType(column.type)} field_${tableIndex}_${columnIndex}`);
    });
    lines.push('  }');
  });

  relationships.forEach((relationship, relationshipIndex) => {
    const from = entityIds.get(relationship.fromTable);
    const to = entityIds.get(relationship.toTable);
    if (from && to) {
      lines.push(`  ${from} }|--|| ${to} : relation_${relationshipIndex}`);
    }
  });

  return `${lines.join('\n')}\n`;
}
