import { GoogleGenAI } from "@google/genai";

class GeminiService {
  
  private getAI(): GoogleGenAI | null {
      const key = localStorage.getItem('duckdb_gemini_api_key') || process.env.API_KEY;
      if (!key) return null;
      return new GoogleGenAI({ apiKey: key });
  }

  async generateSql(prompt: string, schemaContext: string): Promise<string> {
    const ai = this.getAI();
    if (!ai) {
        return "-- Error: API Key not configured. Please add your Gemini API Key in Settings.";
    }

    try {
      const model = 'gemini-3-flash-preview'; 
      const systemInstruction = `You are a DuckDB SQL expert. 
      Given the database schema provided, write a valid DuckDB SQL query to answer the user's question. 
      Return ONLY the raw SQL query without markdown formatting (no \`\`\`sql). 
      Do not explain the code.`;
      
      const fullPrompt = `Schema:\n${schemaContext}\n\nQuestion: ${prompt}`;

      const response = await ai.models.generateContent({
        model: model,
        contents: fullPrompt,
        config: {
            systemInstruction: systemInstruction
        }
      });

      return response.text?.trim() || "-- No SQL generated";
    } catch (error: any) {
      console.error("Gemini Error:", error);
      return `-- Error generating SQL: ${error.message}`;
    }
  }

  async fixSql(wrongSql: string, errorMsg: string, schemaContext: string): Promise<string> {
    const ai = this.getAI();
    if (!ai) return "-- Error: API Key not configured";

    try {
        const model = 'gemini-3-flash-preview';
        const systemInstruction = `You are a SQL Debugger for DuckDB. 
        Fix the provided SQL query based on the error message and schema. 
        Return ONLY the corrected SQL query. No explanation.`;

        const fullPrompt = `Schema:\n${schemaContext}\n\nBroken SQL:\n${wrongSql}\n\nError Message:\n${errorMsg}`;

        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: { systemInstruction }
        });

        return response.text?.replace(/```sql|```/g, '').trim() || wrongSql;
    } catch (error: any) {
        return `-- AI Fix Failed: ${error.message}`;
    }
  }
}

export const geminiService = new GeminiService();