import { aiService } from './aiService';

export interface GeneratedSnippet {
  title: string;
  sql: string;
  description: string;
  tags: string[];
}

/**
 * AI SQL Knowledge Base Helper Service
 */
export const libraryAiService = {
  /**
   * Generates custom DuckDB SQL templates based on the provided table schema.
   */
  async generateTemplatesForTable(
    tableName: string,
    columns: Array<{ name: string; type: string }>
  ): Promise<GeneratedSnippet[]> {
    const columnsStr = columns.map(c => `  - ${c.name} (${c.type})`).join('\n');

    const systemInstruction = `You are a Senior Database Engineer and DuckDB SQL expert.
Your job is to analyze the columns of a DuckDB table and write highly practical, production-grade DuckDB SQL code snippets for the user.
Generate exactly 4 to 5 distinct, useful snippets that cover different operational areas:
1. Analytical Query (DQL aggregation, grouping, or CTE)
2. Window Function (ranking, rolling sum, or running percentages)
3. Data Cleaning/Formatting (date parsing, NULL handling with COALESCE, JSON/string manipulations, casting)
4. Advanced DuckDB Features (e.g. SELECT * EXCLUDE/REPLACE, ASOF joins, or sample queries specific to DuckDB)

Output STRICTLY a JSON array of objects. Do not include markdown code block syntax (like \`\`\`json) in your raw output.
Each object must have the following structure:
{
  "title": "Short title describing the query (Chinese, e.g. 窗口函数：用户消费排名)",
  "sql": "The SQL query block targeting the table \\"${tableName}\\\"",
  "description": "A clear, helpful 1-2 sentence description explaining what the query does and its importance (Chinese)",
  "tags": ["dql", "window", "aggregation", "cleaning", "duckdb"] (choose 2-3 appropriate tags in lowercase)
}`;

    const prompt = `Table Name: "${tableName}"
Columns:
${columnsStr}

Generate the 4-5 custom SQL snippets in JSON format now. Ensure all table and column names referenced in the queries are spelled exactly as provided.`;

    try {
      // Use Robust AI Call to execute the request
      const rawResponse = await aiService.robustCall<string>(
        'sql_lifecycle', // Reuse an appropriate validation stage
        prompt,
        systemInstruction,
        false // Treat as text to get raw string, then parse it robustly ourselves
      );

      // Clean response if LLM accidentally wrapped it in markdown codeblocks
      let cleanJson = rawResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
      }

      const snippets = JSON.parse(cleanJson);
      if (!Array.isArray(snippets)) {
        throw new Error('Response is not a JSON array');
      }

      return snippets.map(s => ({
        title: String(s.title || 'AI Generated Query'),
        sql: String(s.sql || ''),
        description: String(s.description || ''),
        tags: Array.isArray(s.tags) ? s.tags.map(String) : ['ai-generated']
      }));
    } catch (error) {
      console.error('[LibraryAIService] Error generating templates:', error);
      throw error;
    }
  }
};
