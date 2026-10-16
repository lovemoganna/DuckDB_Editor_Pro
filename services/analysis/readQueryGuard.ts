import { splitSqlStatements } from '../dataflow/sqlToWorkflowParser';

/** Refreshing or profiling an analysis must not execute a database mutation. */
export function requireAnalysisQuery(sql: string): string {
  const statements = splitSqlStatements(sql || '').filter(statement =>
    statement.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').trim(),
  );
  if (statements.length !== 1) throw new Error('图表与指标需要一条只读查询，请在 SQL 工作台执行多语句脚本');
  const statement = statements[0];
  const head = statement.replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/))*/g, '').trim();
  const tokens = head.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
  if (!/^(?:select|with|values)\b/i.test(head)
    || /\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|COPY|ATTACH|DETACH|USE|SET|CALL|PRAGMA|INSTALL|LOAD|EXPORT|IMPORT|TRUNCATE|MERGE)\b/i.test(tokens)) {
    throw new Error('图表与指标仅支持只读查询，请在 SQL 工作台执行数据修改');
  }
  return statement;
}
