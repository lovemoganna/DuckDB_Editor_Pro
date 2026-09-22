/**
 * Schema retrieval and pruning.
 *
 * Uses weighted BM25 over table names, column names, types, and descriptions.
 * Chinese text is represented by character bigrams so schema descriptions can
 * be retrieved without a heavyweight language-specific tokenizer.
 */

export interface SchemaTableColumn {
  name: string;
  type: string;
  description?: string;
}

export interface SchemaTreeContext {
  [tableName: string]: SchemaTableColumn[];
}

export interface ScoredSchemaTable {
  tableName: string;
  columns: SchemaTableColumn[];
  score: number;
  matchedKeywords: string[];
}

interface SearchDocument {
  tableName: string;
  columns: SchemaTableColumn[];
  terms: Map<string, number>;
  length: number;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

function tokenize(text: string): string[] {
  if (!text.trim()) return [];

  const normalized = text
    .normalize('NFKC')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./-]+/g, ' ')
    .toLowerCase();
  const groups = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  const tokens: string[] = [];

  groups.forEach(group => {
    if (/^[\u4e00-\u9fff]+$/.test(group)) {
      if (group.length <= 4) tokens.push(group);
      for (let index = 0; index < group.length - 1; index += 1) {
        tokens.push(group.slice(index, index + 2));
      }
      return;
    }
    if (group.length > 1) tokens.push(group);
  });

  return [...new Set(tokens)];
}

function addWeightedTerms(target: Map<string, number>, text: string, weight: number): void {
  tokenize(text).forEach(term => {
    target.set(term, (target.get(term) ?? 0) + weight);
  });
}

function createDocument(tableName: string, columns: SchemaTableColumn[]): SearchDocument {
  const terms = new Map<string, number>();
  addWeightedTerms(terms, tableName, 4);
  columns.forEach(column => {
    addWeightedTerms(terms, column.name, 2.5);
    addWeightedTerms(terms, column.type, 0.25);
    if (column.description) addWeightedTerms(terms, column.description, 1.5);
  });
  return {
    tableName,
    columns,
    terms,
    length: [...terms.values()].reduce((sum, value) => sum + value, 0),
  };
}

function exactFieldBoost(document: SearchDocument, term: string): number {
  const normalizedTable = document.tableName.toLowerCase();
  let boost = normalizedTable === term ? 6 : normalizedTable.includes(term) ? 3 : 0;

  document.columns.forEach(column => {
    const name = column.name.toLowerCase();
    const description = column.description?.toLowerCase() ?? '';
    if (name === term) boost += 2.5;
    else if (name.includes(term)) boost += 1.25;
    if (description.includes(term)) boost += 0.5;
  });
  return boost;
}

export class SchemaRagEngine {
  /**
   * Return a deterministic, explainable BM25 ranking for the complete schema.
   */
  public static rankSchema(
    schemaTree: SchemaTreeContext,
    userPrompt: string = '',
  ): ScoredSchemaTable[] {
    const documents = Object.entries(schemaTree).map(([tableName, columns]) =>
      createDocument(tableName, columns),
    );
    const queryTerms = tokenize(userPrompt);
    const averageLength = documents.length === 0
      ? 1
      : documents.reduce((sum, document) => sum + document.length, 0) / documents.length;

    return documents
      .map(document => {
        if (queryTerms.length === 0) {
          return {
            tableName: document.tableName,
            columns: document.columns,
            score: 1,
            matchedKeywords: [],
          };
        }

        const matchedKeywords: string[] = [];
        let score = 0;
        queryTerms.forEach(term => {
          const termFrequency = document.terms.get(term) ?? 0;
          if (termFrequency <= 0) return;
          matchedKeywords.push(term);

          const documentFrequency = documents.filter(candidate =>
            (candidate.terms.get(term) ?? 0) > 0,
          ).length;
          const inverseDocumentFrequency = Math.log(
            1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
          );
          const lengthNormalization = BM25_K1 * (
            1 - BM25_B + BM25_B * (document.length / Math.max(averageLength, 1))
          );
          score += inverseDocumentFrequency
            * ((termFrequency * (BM25_K1 + 1)) / (termFrequency + lengthNormalization));
          score += exactFieldBoost(document, term);
        });

        return {
          tableName: document.tableName,
          columns: document.columns,
          score,
          matchedKeywords,
        };
      })
      .sort((left, right) =>
        right.score - left.score || left.tableName.localeCompare(right.tableName),
      );
  }

  /**
   * Compatibility helper for callers that score one table in isolation.
   */
  public static scoreTable(
    tableName: string,
    columns: SchemaTableColumn[],
    queryTokens: string[],
  ): { score: number; matchedKeywords: string[] } {
    const [result] = this.rankSchema(
      { [tableName]: columns },
      queryTokens.join(' '),
    );
    return {
      score: result?.score ?? 0,
      matchedKeywords: result?.matchedKeywords ?? [],
    };
  }

  /**
   * Keep the top ranked tables while preserving explicitly active tables.
   */
  public static pruneSchema(
    schemaTree: SchemaTreeContext,
    userPrompt: string = '',
    topK: number = 5,
    alwaysIncludeTables: string[] = [],
  ): SchemaTreeContext {
    const tableNames = Object.keys(schemaTree);
    if (tableNames.length <= topK) return schemaTree;

    const selectedTables = new Set<string>();
    alwaysIncludeTables.forEach(tableName => {
      if (schemaTree[tableName]) selectedTables.add(tableName);
    });

    for (const result of this.rankSchema(schemaTree, userPrompt)) {
      if (selectedTables.size >= Math.max(topK, alwaysIncludeTables.length)) break;
      selectedTables.add(result.tableName);
    }

    return Object.fromEntries(
      [...selectedTables].map(tableName => [tableName, schemaTree[tableName]]),
    );
  }
}
