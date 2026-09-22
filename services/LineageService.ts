import { EntityContextType, PostgreSQL } from 'dt-sql-parser';

export interface LineageNode {
  id: string;
  label: string;
  type: 'table' | 'column' | 'metric';
  table?: string;
  column?: string;
  scopeDepth?: number;
  expression?: string;
}

export interface LineageEdge {
  source: string;
  target: string;
  relationType: 'TRANSFORM' | 'DERIVED_FROM' | 'JOIN_ON' | 'AGGREGATED_BY';
}

export interface LineageDiagnostics {
  parser: 'dt-sql-parser/postgresql';
  confidence: 'exact' | 'partial' | 'blocked';
  errors: string[];
  warnings: string[];
}

export interface DataLineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  diagnostics: LineageDiagnostics;
}

const parser = new PostgreSQL();

const SQL_KEYWORDS = new Set([
  'all', 'and', 'as', 'asc', 'by', 'case', 'desc', 'distinct', 'else', 'end',
  'false', 'from', 'group', 'having', 'in', 'is', 'join', 'left', 'limit',
  'not', 'null', 'offset', 'on', 'or', 'order', 'outer', 'over', 'partition',
  'right', 'select', 'then', 'true', 'when', 'where', 'with',
]);

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^["`]|["`]$/g, '');
}

function extractCteNames(sql: string): string[] {
  const names: string[] = [];
  const pattern = /(?:\bWITH\b|,)\s*(?:"([^"]+)"|([a-zA-Z_][\w$]*))\s+AS\s*\(/gi;
  for (const match of sql.matchAll(pattern)) {
    names.push(normalizeIdentifier(match[1] || match[2]));
  }
  return names;
}

function outputName(expression: string, alias: string | undefined, index: number): string {
  if (alias) return normalizeIdentifier(alias);
  if (/^(?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?$/.test(expression.trim())) {
    return normalizeIdentifier(expression.trim().split('.').pop()!);
  }
  return `expression_${index + 1}`;
}

interface ColumnReference {
  qualifier?: string;
  column: string;
}

function extractColumnReferences(expression: string, alias?: string): ColumnReference[] {
  const withoutStrings = expression.replace(/'(?:''|[^'])*'/g, ' ');
  const references: ColumnReference[] = [];
  const occupied = new Set<string>();
  const qualified = /\b([a-zA-Z_][\w$]*)\s*\.\s*(?:"([^"]+)"|([a-zA-Z_][\w$]*))/g;

  for (const match of withoutStrings.matchAll(qualified)) {
    references.push({
      qualifier: normalizeIdentifier(match[1]),
      column: normalizeIdentifier(match[2] || match[3]),
    });
    for (let index = match.index!; index < match.index! + match[0].length; index += 1) {
      occupied.add(String(index));
    }
  }

  const identifier = /[a-zA-Z_][\w$]*/g;
  for (const match of withoutStrings.matchAll(identifier)) {
    const index = match.index!;
    if (occupied.has(String(index))) continue;
    const token = match[0];
    const lower = token.toLowerCase();
    const remainder = withoutStrings.slice(index + token.length);
    const prefix = withoutStrings.slice(0, index);
    if (
      SQL_KEYWORDS.has(lower)
      || lower === alias?.toLowerCase()
      || /^\s*\(/.test(remainder)
      || /\.\s*$/.test(prefix)
      || /^\s*\./.test(remainder)
    ) {
      continue;
    }
    references.push({ column: normalizeIdentifier(token) });
  }

  const unique = new Map<string, ColumnReference>();
  references.forEach(reference => {
    unique.set(`${reference.qualifier ?? ''}.${reference.column}`.toLowerCase(), reference);
  });
  return [...unique.values()];
}

export class LineageService {
  static parseSqlLineage(sql: string): DataLineageGraph {
    const validationErrors = parser.validate(sql);
    if (validationErrors.length > 0) {
      return {
        nodes: [],
        edges: [],
        diagnostics: {
          parser: 'dt-sql-parser/postgresql',
          confidence: 'blocked',
          errors: validationErrors.map(error => error.message),
          warnings: [],
        },
      };
    }

    const entities = parser.getAllEntities(sql) ?? [];
    const cteNames = extractCteNames(sql);
    const cteNameSet = new Set(cteNames.map(name => name.toLowerCase()));
    const queryResults = entities.filter(entity =>
      entity.entityContextType === EntityContextType.QUERY_RESULT,
    );
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const warnings: string[] = [];
    const cteOutputs = new Map<string, Map<string, string>>();

    const addNode = (node: LineageNode) => {
      if (nodeIds.has(node.id)) return;
      nodeIds.add(node.id);
      nodes.push(node);
    };
    const addEdge = (edge: LineageEdge) => {
      const id = `${edge.source}|${edge.target}|${edge.relationType}`;
      if (edgeIds.has(id)) return;
      edgeIds.add(id);
      edges.push(edge);
    };

    const physicalTables = entities
      .filter(entity => entity.entityContextType === EntityContextType.TABLE)
      .map(entity => normalizeIdentifier(entity.text))
      .filter(table => !cteNameSet.has(table.toLowerCase()));

    [...new Set(physicalTables)].forEach(table => {
      addNode({ id: `table:${table}`, label: table, type: 'table', table });
    });

    queryResults.forEach((queryResult: any, resultIndex) => {
      const scopeDepth = queryResult.belongStmt.scopeDepth as number;
      const relatedTables = (queryResult.relatedEntities ?? [])
        .filter((entity: any) => entity.entityContextType === EntityContextType.TABLE);
      const aliases = new Map<string, string>();
      relatedTables.forEach((table: any) => {
        const tableName = normalizeIdentifier(table.text);
        aliases.set(tableName.toLowerCase(), tableName);
        if (table._alias?.text) {
          aliases.set(normalizeIdentifier(table._alias.text).toLowerCase(), tableName);
        }
      });

      const currentCte = resultIndex < cteNames.length ? cteNames[resultIndex] : undefined;
      const currentOutputs = new Map<string, string>();

      (queryResult.columns ?? []).forEach((column: any, columnIndex: number) => {
        const expression = column.text as string;
        const alias = column._alias?.text as string | undefined;
        const name = outputName(expression, alias, columnIndex);
        const isAggregate = /\b(?:avg|count|max|min|sum|string_agg|array_agg)\s*\(/i.test(expression);
        const targetId = `output:${scopeDepth}:${resultIndex}:${name}`;
        addNode({
          id: targetId,
          label: name,
          type: isAggregate ? 'metric' : 'column',
          table: currentCte ?? 'result',
          column: name,
          scopeDepth,
          expression,
        });
        currentOutputs.set(name.toLowerCase(), targetId);

        const references = extractColumnReferences(expression, alias);
        references.forEach(reference => {
          let sourceTable: string | undefined;
          if (reference.qualifier) {
            sourceTable = aliases.get(reference.qualifier.toLowerCase());
          } else if (relatedTables.length === 1) {
            sourceTable = normalizeIdentifier(relatedTables[0].text);
          }

          if (!sourceTable) {
            warnings.push(`Ambiguous source for ${name}: ${reference.column}`);
            return;
          }

          let sourceId: string;
          if (cteNameSet.has(sourceTable.toLowerCase())) {
            const cteOutput = cteOutputs.get(sourceTable.toLowerCase())?.get(reference.column.toLowerCase());
            if (!cteOutput) {
              warnings.push(`Unresolved CTE column ${sourceTable}.${reference.column}`);
              return;
            }
            sourceId = cteOutput;
          } else {
            sourceId = `column:${sourceTable}.${reference.column}`;
            addNode({
              id: sourceId,
              label: `${sourceTable}.${reference.column}`,
              type: 'column',
              table: sourceTable,
              column: reference.column,
            });
            addEdge({
              source: `table:${sourceTable}`,
              target: sourceId,
              relationType: 'DERIVED_FROM',
            });
          }

          addEdge({
            source: sourceId,
            target: targetId,
            relationType: isAggregate ? 'AGGREGATED_BY' : 'DERIVED_FROM',
          });
        });
      });

      if (currentCte) {
        cteOutputs.set(currentCte.toLowerCase(), currentOutputs);
      }
    });

    return {
      nodes,
      edges,
      diagnostics: {
        parser: 'dt-sql-parser/postgresql',
        confidence: warnings.length > 0 ? 'partial' : 'exact',
        errors: [],
        warnings: [...new Set(warnings)],
      },
    };
  }
}

export default LineageService;
