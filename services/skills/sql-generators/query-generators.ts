/**
 * SQL Query Generators
 *
 * Template-based SQL generation for query skills:
 * SELECT, JOIN, Aggregation, Window, CTE, INSERT, UPDATE, DELETE
 */

import { SkillExecutionContext } from '../../../types';

export const sqlQueryGenerators = {
  select(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { conditions, orderBy, limit } = inputs;
    let sql = `SELECT * FROM "${context.tableName || 'table_name'}"`;

    if (conditions) {
      sql += ` WHERE ${conditions}`;
    }

    if (orderBy && orderBy !== '不排序') {
      const order = orderBy === '升序' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${context.columns?.[0]?.name || 'id'} ${order}`;
    }

    sql += ` LIMIT ${limit || 100};`;
    return sql;
  },

  join(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { joinType, rightTable, joinCondition, selectColumns } = inputs;
    const leftTable = context.tableName || 'left_table';

    return `SELECT ${selectColumns || 'a.*, b.*'}
FROM "${leftTable}" a
${joinType} "${rightTable}" b ON ${joinCondition};`;
  },

  aggregation(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { aggregationType, groupBy, having } = inputs;
    const tableName = context.tableName || 'table_name';

    let sql = `SELECT `;

    if (aggregationType === '多聚合') {
      sql += 'COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)';
    } else {
      const aggFunc = aggregationType === 'COUNT' ? 'COUNT(*)' : `${aggregationType}(col)`;
      sql += aggFunc;
    }

    sql += ` FROM "${tableName}"`;

    if (groupBy) {
      sql += ` GROUP BY ${groupBy}`;
    }

    if (having) {
      sql += ` HAVING ${having}`;
    }

    sql += ';';
    return sql;
  },

  window(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { windowFunction, partitionBy, orderBy, frame } = inputs;
    const tableName = context.tableName || 'table_name';

    let sql = `SELECT *,
  ${windowFunction}() OVER (`;

    if (partitionBy) {
      sql += `PARTITION BY ${partitionBy}`;
    }

    if (orderBy) {
      sql += (partitionBy ? ' ' : '') + `ORDER BY ${orderBy}`;
    }

    if (frame && frame !== '无') {
      sql += ` ${frame}`;
    }

    sql += `) AS result
FROM "${tableName}";`;

    return sql;
  },

  cte(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { cteName, cteQuery, mainQuery } = inputs;

    return `WITH ${cteName} AS (
  ${cteQuery}
)
${mainQuery};`;
  },

  insert(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { values, mode, conflictAction } = inputs;
    const tableName = context.tableName || 'table_name';
    const columns = context.columns?.map(c => c.name).join(', ') || 'col1, col2';

    let sql = `INSERT INTO "${tableName}" (${columns})`;

    if (mode === 'INSERT ... RETURNING') {
      sql += ` VALUES (${values}) RETURNING *;`;
    } else if (mode === 'INSERT ... ON CONFLICT') {
      sql += ` VALUES (${values}) ON CONFLICT DO ${conflictAction || 'NOTHING'};`;
    } else {
      sql += ` VALUES (${values});`;
    }

    return sql;
  },

  update(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { setClause, whereCondition, returning } = inputs;
    const tableName = context.tableName || 'table_name';

    let sql = `UPDATE "${tableName}"
SET ${setClause}
WHERE ${whereCondition}`;

    if (returning) {
      sql += ' RETURNING *';
    }

    sql += ';';
    return sql;
  },

  delete(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { whereCondition, limit, returning } = inputs;
    const tableName = context.tableName || 'table_name';

    let sql = `DELETE FROM "${tableName}"
WHERE ${whereCondition}`;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (returning) {
      sql += ' RETURNING *';
    }

    sql += ';';
    return sql;
  },
};
