/**
 * AI Skill Executor
 * 
 * Handles skill execution by coordinating with AI service,
 * prompt building, and result processing.
 */

import { AISkill, SkillExecutionContext, SkillResult, SkillInvokeRequest, SkillInputField } from '../types';
import { getSkill, BUILT_IN_SKILLS } from './skillRegistry';
import { aiService } from './aiService';
import { duckDBService } from './duckdbService';

/**
 * Skill Prompt Templates for different skill types
 */

// 示例数据生成函数
function getSampleData(tableName: string, columns: any[]): string | null {
  const sampleData: Record<string, string> = {
    users: `INSERT INTO "${tableName}" (username, email, real_name, gender, status) VALUES
  ('admin', 'admin@example.com', '管理员', 'male', 'active'),
  ('john_doe', 'john@example.com', '张三', 'male', 'active'),
  ('jane_smith', 'jane@example.com', '李四', 'female', 'active'),
  ('bob_wilson', 'bob@example.com', '王五', 'male', 'inactive');\n`,
    categories: `INSERT INTO "${tableName}" (category_name, level, sort_order) VALUES
  ('电子产品', 1, 1),
  ('服装', 1, 2),
  ('图书', 1, 3),
  ('食品', 1, 4);\n`,
    products: `INSERT INTO "${tableName}" (product_code, product_name, category_id, price, cost_price, stock_quantity, status) VALUES
  ('P001', 'iPhone 15 Pro', 1, 8999.00, 6500.00, 100, 'active'),
  ('P002', 'MacBook Pro', 1, 15999.00, 12000.00, 50, 'active'),
  ('P003', '纯棉T恤', 2, 99.00, 30.00, 500, 'active'),
  ('P004', 'Java编程思想', 3, 108.00, 50.00, 200, 'active');\n`
  };
  
  return sampleData[tableName.toLowerCase()] || null;
}

const SKILL_PROMPTS = {
  sql: {
    select: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { description, conditions, orderBy, limit } = inputs;
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
    
    join: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { joinType, rightTable, joinCondition, selectColumns } = inputs;
      const leftTable = context.tableName || 'left_table';
      
      return `SELECT ${selectColumns || 'a.*, b.*'}
FROM "${leftTable}" a
${joinType} "${rightTable}" b ON ${joinCondition};`;
    },
    
    aggregation: (inputs: Record<string, any>, context: SkillExecutionContext) => {
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
    
    window: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { windowFunction, partitionBy, orderBy, frame } = inputs;
      const tableName = context.tableName || 'table_name';
      const col = context.columns?.[0]?.name || 'value';
      
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
    
    cte: (inputs: Record<string, any>) => {
      const { cteName, cteQuery, mainQuery } = inputs;
      
      return `WITH ${cteName} AS (
  ${cteQuery}
)
${mainQuery};`;
    },
    
    insert: (inputs: Record<string, any>, context: SkillExecutionContext) => {
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
    
    update: (inputs: Record<string, any>, context: SkillExecutionContext) => {
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
    
    delete: (inputs: Record<string, any>, context: SkillExecutionContext) => {
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
    
    createTable: (inputs: Record<string, any>) => {
      const { tableName, columns, primaryKey, foreignKeys, indexes, engine, ifNotExists } = inputs;
      const tableIdentifier = ifNotExists ? `IF NOT EXISTS "${tableName}"` : `"${tableName}"`;
      
      let sql = `CREATE TABLE ${tableIdentifier} (\n`;
      
      // Process columns
      const columnLines = columns.split('\n').filter(line => line.trim());
      sql += columnLines.map(col => `  ${col.trim()}`).join(',\n');
      
      // Add primary key
      if (primaryKey) {
        sql += `,\n  PRIMARY KEY (${primaryKey})`;
      }
      
      // Add foreign keys
      if (foreignKeys) {
        const fkLines = foreignKeys.split('\n').filter(line => line.trim());
        fkLines.forEach(fk => {
          sql += `,\n  ${fk.trim()}`;
        });
      }
      
      sql += '\n)';
      
      // Add engine options for DuckDB
      if (engine && engine !== '默认') {
        if (engine === 'Memory') {
          sql += ' USING MEMORY';
        } else if (engine === 'Parquet') {
          sql += ' USING PARQUET';
        }
      }
      
      sql += ';';
      
      // Add indexes if specified
      if (indexes) {
        const idxLines = indexes.split('\n').filter(line => line.trim());
        idxLines.forEach(idx => {
          sql += `\n\n-- 创建索引\nCREATE INDEX ${idx.trim()};`;
        });
      }
      
      return sql;
    },
    
    // 自然语言建表 - 根据业务需求生成表结构
    createTableNL: (inputs: Record<string, any>) => {
      const { description, businessDomain, includeSample, useAI } = inputs;
      
      // 根据业务领域和描述智能生成表结构
      const domainSchemas: Record<string, { tables: Record<string, any> }> = {
        '电商': {
          tables: {
            users: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'username', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'email', type: 'VARCHAR(255)', notNull: true, unique: true },
                { name: 'phone', type: 'VARCHAR(20)' },
                { name: 'password_hash', type: 'VARCHAR(255)', notNull: true },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'level', type: 'VARCHAR(20)', default: "'normal'" },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            addresses: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'user_id', type: 'BIGINT', notNull: true, fk: 'users(id)' },
                { name: 'recipient_name', type: 'VARCHAR(100)', notNull: true },
                { name: 'phone', type: 'VARCHAR(20)', notNull: true },
                { name: 'province', type: 'VARCHAR(50)' },
                { name: 'city', type: 'VARCHAR(50)' },
                { name: 'district', type: 'VARCHAR(50)' },
                { name: 'detail_address', type: 'VARCHAR(500)', notNull: true },
                { name: 'is_default', type: 'BOOLEAN', default: 'FALSE' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            orders: {
              columns: [
                { name: 'order_id', type: 'BIGINT', pk: true },
                { name: 'order_number', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'user_id', type: 'BIGINT', notNull: true, fk: 'users(id)' },
                { name: 'total_amount', type: 'DECIMAL(10,2)', notNull: true, default: '0' },
                { name: 'discount_amount', type: 'DECIMAL(10,2)', default: '0' },
                { name: 'pay_amount', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'status', type: 'VARCHAR(20)', default: "'pending'" },
                { name: 'pay_status', type: 'VARCHAR(20)', default: "'unpaid'" },
                { name: 'pay_method', type: 'VARCHAR(20)' },
                { name: 'shipping_address', type: 'VARCHAR(500)' },
                { name: 'receiver_phone', type: 'VARCHAR(20)' },
                { name: 'receiver_name', type: 'VARCHAR(100)' },
                { name: 'remark', type: 'TEXT' },
                { name: 'order_date', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'pay_date', type: 'TIMESTAMP' },
                { name: 'ship_date', type: 'TIMESTAMP' },
                { name: 'receive_date', type: 'TIMESTAMP' }
              ]
            },
            order_items: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'order_id', type: 'BIGINT', notNull: true, fk: 'orders(order_id)' },
                { name: 'product_id', type: 'BIGINT', notNull: true, fk: 'products(id)' },
                { name: 'product_name', type: 'VARCHAR(255)', notNull: true },
                { name: 'sku', type: 'VARCHAR(50)' },
                { name: 'price', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'quantity', type: 'INTEGER', notNull: true, default: '1' },
                { name: 'subtotal', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'discount', type: 'DECIMAL(10,2)', default: '0' }
              ]
            },
            products: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'name', type: 'VARCHAR(255)', notNull: true },
                { name: 'description', type: 'TEXT' },
                { name: 'category_id', type: 'BIGINT', fk: 'categories(id)' },
                { name: 'price', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'cost', type: 'DECIMAL(10,2)' },
                { name: 'stock_quantity', type: 'INTEGER', default: '0' },
                { name: 'sold_count', type: 'INTEGER', default: '0' },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'image_url', type: 'VARCHAR(500)' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            categories: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'name', type: 'VARCHAR(100)', notNull: true },
                { name: 'parent_id', type: 'BIGINT', fk: 'categories(id)' },
                { name: 'level', type: 'INTEGER', default: '1' },
                { name: 'sort_order', type: 'INTEGER', default: '0' },
                { name: 'description', type: 'TEXT' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            payments: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'order_id', type: 'BIGINT', notNull: true, fk: 'orders(order_id)' },
                { name: 'user_id', type: 'BIGINT', notNull: true, fk: 'users(id)' },
                { name: 'amount', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'payment_method', type: 'VARCHAR(50)', notNull: true },
                { name: 'transaction_id', type: 'VARCHAR(100)', unique: true },
                { name: 'status', type: 'VARCHAR(20)', default: "'pending'" },
                { name: 'pay_time', type: 'TIMESTAMP' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '用户管理': {
          tables: {
            users: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'username', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'email', type: 'VARCHAR(255)', notNull: true, unique: true },
                { name: 'phone', type: 'VARCHAR(20)', unique: true },
                { name: 'password_hash', type: 'VARCHAR(255)', notNull: true },
                { name: 'real_name', type: 'VARCHAR(100)' },
                { name: 'avatar', type: 'VARCHAR(500)' },
                { name: 'gender', type: 'VARCHAR(10)' },
                { name: 'birthday', type: 'DATE' },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'user_type', type: 'VARCHAR(20)', default: "'normal'" },
                { name: 'last_login_ip', type: 'VARCHAR(50)' },
                { name: 'last_login_time', type: 'TIMESTAMP' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            user_profiles: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'user_id', type: 'BIGINT', notNull: true, unique: true, fk: 'users(id)' },
                { name: 'bio', type: 'TEXT' },
                { name: 'location', type: 'VARCHAR(200)' },
                { name: 'website', type: 'VARCHAR(200)' },
                { name: 'company', type: 'VARCHAR(200)' },
                { name: 'occupation', type: 'VARCHAR(100)' },
                { name: 'social_links', type: 'JSON' },
                { name: 'preferences', type: 'JSON' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            user_roles: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'user_id', type: 'BIGINT', notNull: true, fk: 'users(id)' },
                { name: 'role', type: 'VARCHAR(50)', notNull: true },
                { name: 'scope', type: 'VARCHAR(50)' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '订单系统': {
          tables: {
            orders: {
              columns: [
                { name: 'order_id', type: 'BIGINT', pk: true },
                { name: 'order_no', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'user_id', type: 'BIGINT', notNull: true, fk: 'users(id)' },
                { name: 'order_type', type: 'VARCHAR(20)', default: "'normal'" },
                { name: 'total_amount', type: 'DECIMAL(12,2)', notNull: true },
                { name: 'discount', type: 'DECIMAL(12,2)', default: '0' },
                { name: 'pay_amount', type: 'DECIMAL(12,2)', notNull: true },
                { name: 'currency', type: 'VARCHAR(10)', default: "'CNY'" },
                { name: 'status', type: 'VARCHAR(20)', default: "'created'" },
                { name: 'remark', type: 'TEXT' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'completed_at', type: 'TIMESTAMP' },
                { name: 'cancelled_at', type: 'TIMESTAMP' }
              ]
            },
            order_items: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'order_id', type: 'BIGINT', notNull: true, fk: 'orders(order_id)' },
                { name: 'item_type', type: 'VARCHAR(30)', notNull: true },
                { name: 'item_id', type: 'BIGINT', notNull: true },
                { name: 'item_name', type: 'VARCHAR(255)', notNull: true },
                { name: 'quantity', type: 'INTEGER', notNull: true },
                { name: 'unit_price', type: 'DECIMAL(12,2)', notNull: true },
                { name: 'discount', type: 'DECIMAL(12,2)', default: '0' },
                { name: 'tax', type: 'DECIMAL(12,2)', default: '0' },
                { name: 'subtotal', type: 'DECIMAL(12,2)', notNull: true }
              ]
            },
            order_logs: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'order_id', type: 'BIGINT', notNull: true, fk: 'orders(order_id)' },
                { name: 'action', type: 'VARCHAR(50)', notNull: true },
                { name: 'operator_id', type: 'BIGINT' },
                { name: 'operator_type', type: 'VARCHAR(20)' },
                { name: 'content', type: 'TEXT' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '库存管理': {
          tables: {
            products: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'sku', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'name', type: 'VARCHAR(255)', notNull: true },
                { name: 'barcode', type: 'VARCHAR(50)', unique: true },
                { name: 'category_id', type: 'BIGINT', fk: 'categories(id)' },
                { name: 'unit', type: 'VARCHAR(20)', default: "'个'" },
                { name: 'cost_price', type: 'DECIMAL(10,2)' },
                { name: 'sale_price', type: 'DECIMAL(10,2)', notNull: true },
                { name: 'min_price', type: 'DECIMAL(10,2)' },
                { name: 'stock_quantity', type: 'INTEGER', default: '0' },
                { name: 'safe_stock', type: 'INTEGER', default: '10' },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            warehouses: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'code', type: 'VARCHAR(20)', notNull: true, unique: true },
                { name: 'name', type: 'VARCHAR(100)', notNull: true },
                { name: 'type', type: 'VARCHAR(20)', default: "'main'" },
                { name: 'province', type: 'VARCHAR(50)' },
                { name: 'city', type: 'VARCHAR(50)' },
                { name: 'address', type: 'VARCHAR(500)' },
                { name: 'manager', type: 'VARCHAR(100)' },
                { name: 'phone', type: 'VARCHAR(20)' },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            stock_records: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'product_id', type: 'BIGINT', notNull: true, fk: 'products(id)' },
                { name: 'warehouse_id', type: 'BIGINT', notNull: true, fk: 'warehouses(id)' },
                { name: 'operation_type', type: 'VARCHAR(20)', notNull: true },
                { name: 'quantity', type: 'INTEGER', notNull: true },
                { name: 'before_quantity', type: 'INTEGER', notNull: true },
                { name: 'after_quantity', type: 'INTEGER', notNull: true },
                { name: 'reference_no', type: 'VARCHAR(50)' },
                { name: 'remark', type: 'TEXT' },
                { name: 'operator_id', type: 'BIGINT' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '财务': {
          tables: {
            accounts: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'account_no', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'account_name', type: 'VARCHAR(100)', notNull: true },
                { name: 'account_type', type: 'VARCHAR(20)', notNull: true },
                { name: 'balance', type: 'DECIMAL(15,2)', default: '0', notNull: true },
                { name: 'currency', type: 'VARCHAR(10)', default: "'CNY'" },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            transactions: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'trans_no', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'account_id', type: 'BIGINT', notNull: true, fk: 'accounts(id)' },
                { name: 'trans_type', type: 'VARCHAR(20)', notNull: true },
                { name: 'amount', type: 'DECIMAL(15,2)', notNull: true },
                { name: 'balance_before', type: 'DECIMAL(15,2)', notNull: true },
                { name: 'balance_after', type: 'DECIMAL(15,2)', notNull: true },
                { name: 'reference_type', type: 'VARCHAR(30)' },
                { name: 'reference_id', type: 'BIGINT' },
                { name: 'remark', type: 'TEXT' },
                { name: 'trans_date', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '日志分析': {
          tables: {
            access_logs: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'trace_id', type: 'VARCHAR(50)' },
                { name: 'user_id', type: 'BIGINT' },
                { name: 'user_name', type: 'VARCHAR(100)' },
                { name: 'ip_address', type: 'VARCHAR(50)' },
                { name: 'method', type: 'VARCHAR(10)' },
                { name: 'path', type: 'VARCHAR(500)' },
                { name: 'query_params', type: 'JSON' },
                { name: 'request_body', type: 'TEXT' },
                { name: 'response_status', type: 'INTEGER' },
                { name: 'response_time', type: 'INTEGER' },
                { name: 'user_agent', type: 'VARCHAR(500)' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            error_logs: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'trace_id', type: 'VARCHAR(50)' },
                { name: 'level', type: 'VARCHAR(20)', notNull: true },
                { name: 'message', type: 'TEXT', notNull: true },
                { name: 'stack_trace', type: 'TEXT' },
                { name: 'file', type: 'VARCHAR(200)' },
                { name: 'line', type: 'INTEGER' },
                { name: 'user_id', type: 'BIGINT' },
                { name: 'extra', type: 'JSON' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        },
        '物联网': {
          tables: {
            devices: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'device_no', type: 'VARCHAR(50)', notNull: true, unique: true },
                { name: 'device_name', type: 'VARCHAR(100)', notNull: true },
                { name: 'device_type', type: 'VARCHAR(50)', notNull: true },
                { name: 'manufacturer', type: 'VARCHAR(100)' },
                { name: 'model', type: 'VARCHAR(100)' },
                { name: 'serial_number', type: 'VARCHAR(100)', unique: true },
                { name: 'firmware_version', type: 'VARCHAR(50)' },
                { name: 'status', type: 'VARCHAR(20)', default: "'offline'" },
                { name: 'last_online_time', type: 'TIMESTAMP' },
                { name: 'location', type: 'VARCHAR(200)' },
                { name: 'latitude', type: 'DOUBLE' },
                { name: 'longitude', type: 'DOUBLE' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            },
            telemetry_data: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'device_id', type: 'BIGINT', notNull: true, fk: 'devices(id)' },
                { name: 'metric_name', type: 'VARCHAR(50)', notNull: true },
                { name: 'metric_value', type: 'DOUBLE', notNull: true },
                { name: 'unit', type: 'VARCHAR(20)' },
                { name: 'quality', type: 'VARCHAR(20)' },
                { name: 'timestamp', type: 'TIMESTAMP', notNull: true }
              ]
            },
            device_alerts: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'device_id', type: 'BIGINT', notNull: true, fk: 'devices(id)' },
                { name: 'alert_type', type: 'VARCHAR(50)', notNull: true },
                { name: 'level', type: 'VARCHAR(20)', notNull: true },
                { name: 'message', type: 'TEXT', notNull: true },
                { name: 'metric_name', type: 'VARCHAR(50)' },
                { name: 'metric_value', type: 'DOUBLE' },
                { name: 'threshold', type: 'DOUBLE' },
                { name: 'status', type: 'VARCHAR(20)', default: "'pending'" },
                { name: 'resolved_at', type: 'TIMESTAMP' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        }
      };
      
      // 选择合适的业务领域模板
      const domain = businessDomain || '通用';
      let schema = domainSchemas[domain] || domainSchemas['通用'];
      
      // 如果没有匹配的业务领域，使用通用模板
      if (!schema) {
        schema = {
          tables: {
            generic: {
              columns: [
                { name: 'id', type: 'BIGINT', pk: true },
                { name: 'name', type: 'VARCHAR(100)', notNull: true },
                { name: 'code', type: 'VARCHAR(50)', unique: true },
                { name: 'description', type: 'TEXT' },
                { name: 'status', type: 'VARCHAR(20)', default: "'active'" },
                { name: 'sort_order', type: 'INTEGER', default: '0' },
                { name: 'created_by', type: 'BIGINT' },
                { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
              ]
            }
          }
        };
      }
      
      let sql = `-- =====================================================
-- 自然语言建表方案
-- 业务领域: ${domain}
-- 需求描述: ${description.substring(0, 100)}...
-- =====================================================\n\n`;
      
      // 生成建表语句
      const tableEntries = Object.entries(schema.tables);
      tableEntries.forEach(([tableName, tableDef], tableIdx) => {
        const columns = tableDef.columns as any[];
        sql += `-- ${tableIdx + 1}. ${tableName}\n`;
        sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
        
        const columnDefs = columns.map(col => {
          let def = `  ${col.name} ${col.type}`;
          if (col.notNull) def += ' NOT NULL';
          if (col.unique) def += ' UNIQUE';
          if (col.default) def += ` DEFAULT ${col.default}`;
          if (col.pk) def += ' PRIMARY KEY';
          return def;
        });
        
        sql += columnDefs.join(',\n');
        
        // 添加外键约束
        const fkColumns = columns.filter(col => col.fk);
        if (fkColumns.length > 0) {
          sql += ',\n';
          sql += fkColumns.map(col => `  FOREIGN KEY (${col.name}) REFERENCES ${col.fk}`).join(',\n');
        }
        
        sql += '\n);\n\n';
        
        // 添加索引
        const indexedColumns = columns.filter(col => !col.pk && (col.unique || col.name.includes('_id') || col.name.includes('_name')));
        if (indexedColumns.length > 0) {
          indexedColumns.forEach(col => {
            const idxName = `idx_${tableName}_${col.name}`;
            sql += `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${tableName}" (${col.name});\n`;
          });
          sql += '\n';
        }
      });
      
      // 添加示例数据
      if (includeSample) {
        sql += `-- =====================================================
-- 示例数据
-- =====================================================\n\n`;
        
        tableEntries.forEach(([tableName, tableDef]) => {
          const columns = tableDef.columns as any[];
          if (tableName === 'users' || tableName === 'categories' || tableName === 'products') {
            const sampleData = getSampleData(tableName, columns);
            if (sampleData) {
              sql += sampleData;
            }
          }
        });
      }
      
      return sql;
    },
    
    // 模板建表 - 使用预定义模板
    createTableTemplate: (inputs: Record<string, any>) => {
      const { templateType, tableName, customizeFields, addStatus, addTimestamps } = inputs;
      
      // 模板定义
      const templates: Record<string, { name: string; columns: any[] }> = {
        '用户表': {
          name: 'users',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'username', type: 'VARCHAR(50)', notNull: true, unique: true },
            { name: 'email', type: 'VARCHAR(255)', notNull: true, unique: true },
            { name: 'phone', type: 'VARCHAR(20)' },
            { name: 'password_hash', type: 'VARCHAR(255)', notNull: true },
            { name: 'real_name', type: 'VARCHAR(100)' },
            { name: 'avatar', type: 'VARCHAR(500)' },
            { name: 'gender', type: 'VARCHAR(10)' },
            { name: 'birthday', type: 'DATE' }
          ]
        },
        '订单表': {
          name: 'orders',
          columns: [
            { name: 'order_id', type: 'BIGINT', pk: true },
            { name: 'order_number', type: 'VARCHAR(50)', notNull: true, unique: true },
            { name: 'user_id', type: 'BIGINT', notNull: true },
            { name: 'total_amount', type: 'DECIMAL(12,2)', notNull: true, default: '0' },
            { name: 'discount_amount', type: 'DECIMAL(12,2)', default: '0' },
            { name: 'pay_amount', type: 'DECIMAL(12,2)', notNull: true },
            { name: 'pay_method', type: 'VARCHAR(20)' },
            { name: 'status', type: 'VARCHAR(20)', default: "'pending'" },
            { name: 'remark', type: 'TEXT' }
          ]
        },
        '商品表': {
          name: 'products',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'product_code', type: 'VARCHAR(50)', notNull: true, unique: true },
            { name: 'product_name', type: 'VARCHAR(255)', notNull: true },
            { name: 'category_id', type: 'BIGINT' },
            { name: 'description', type: 'TEXT' },
            { name: 'price', type: 'DECIMAL(10,2)', notNull: true },
            { name: 'cost_price', type: 'DECIMAL(10,2)' },
            { name: 'stock_quantity', type: 'INTEGER', default: '0' },
            { name: 'image_url', type: 'VARCHAR(500)' },
            { name: 'unit', type: 'VARCHAR(20)', default: "'个'" }
          ]
        },
        '分类表': {
          name: 'categories',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'category_name', type: 'VARCHAR(100)', notNull: true },
            { name: 'parent_id', type: 'BIGINT' },
            { name: 'level', type: 'INTEGER', default: '1' },
            { name: 'sort_order', type: 'INTEGER', default: '0' },
            { name: 'icon', type: 'VARCHAR(100)' },
            { name: 'description', type: 'TEXT' }
          ]
        },
        '支付记录表': {
          name: 'payments',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'order_id', type: 'BIGINT', notNull: true },
            { name: 'user_id', type: 'BIGINT', notNull: true },
            { name: 'amount', type: 'DECIMAL(12,2)', notNull: true },
            { name: 'payment_method', type: 'VARCHAR(50)', notNull: true },
            { name: 'transaction_id', type: 'VARCHAR(100)', unique: true },
            { name: 'status', type: 'VARCHAR(20)', default: "'pending'" },
            { name: 'pay_time', type: 'TIMESTAMP' }
          ]
        },
        '日志表': {
          name: 'logs',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'log_type', type: 'VARCHAR(30)', notNull: true },
            { name: 'level', type: 'VARCHAR(20)', default: "'info'" },
            { name: 'message', type: 'TEXT', notNull: true },
            { name: 'user_id', type: 'BIGINT' },
            { name: 'ip_address', type: 'VARCHAR(50)' },
            { name: 'request_url', type: 'VARCHAR(500)' },
            { name: 'request_method', type: 'VARCHAR(10)' },
            { name: 'execution_time', type: 'INTEGER' },
            { name: 'extra', type: 'JSON' }
          ]
        },
        '配置表': {
          name: 'configs',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'config_key', type: 'VARCHAR(100)', notNull: true, unique: true },
            { name: 'config_value', type: 'TEXT', notNull: true },
            { name: 'config_type', type: 'VARCHAR(20)', default: "'string'" },
            { name: 'description', type: 'VARCHAR(200)' },
            { name: 'is_system', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
          ]
        },
        '关系表': {
          name: 'relations',
          columns: [
            { name: 'id', type: 'BIGINT', pk: true },
            { name: 'source_type', type: 'VARCHAR(30)', notNull: true },
            { name: 'source_id', type: 'BIGINT', notNull: true },
            { name: 'target_type', type: 'VARCHAR(30)', notNull: true },
            { name: 'target_id', type: 'BIGINT', notNull: true },
            { name: 'relation_type', type: 'VARCHAR(50)', notNull: true },
            { name: 'metadata', type: 'JSON' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
          ]
        }
      };
      
      const template = templates[templateType] || templates['用户表'];
      let finalTableName = tableName || template.name;
      
      let sql = `-- =====================================================
-- 模板建表: ${templateType}
-- 表名: ${finalTableName}
-- =====================================================\n\n`;
      
      sql += `CREATE TABLE IF NOT EXISTS "${finalTableName}" (\n`;
      
      // 添加模板列
      let columnDefs = template.columns.map(col => {
        let def = `  ${col.name} ${col.type}`;
        if (col.notNull) def += ' NOT NULL';
        if (col.unique) def += ' UNIQUE';
        if (col.default) def += ` DEFAULT ${col.default}`;
        if (col.pk) def += ' PRIMARY KEY';
        return def;
      });
      
      // 添加状态字段
      if (addStatus) {
        columnDefs.push(`  status VARCHAR(20) DEFAULT 'active'`);
      }
      
      // 添加时间戳
      if (addTimestamps) {
        columnDefs.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        columnDefs.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      }
      
      // 添加自定义字段
      if (customizeFields) {
        const customLines = customizeFields.split('\n').filter(line => line.trim());
        customLines.forEach(line => {
          const match = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/);
          if (match) {
            columnDefs.push(`  ${match[1]} ${match[2]}`);
          }
        });
      }
      
      sql += columnDefs.join(',\n');
      sql += '\n);\n';
      
      // 添加索引
      sql += `\n-- 索引\n`;
      sql += `CREATE INDEX IF NOT EXISTS "idx_${finalTableName}_status" ON "${finalTableName}" (status);\n`;
      if (addTimestamps) {
        sql += `CREATE INDEX IF NOT EXISTS "idx_${finalTableName}_created_at" ON "${finalTableName}" (created_at);\n`;
      }
      
      return sql;
    },
    
    // 导入建表 - 从 JSON/CSV 导入
    createTableImport: (inputs: Record<string, any>) => {
      const { importSource, importData, tableName, inferTypes } = inputs;
      
      let columns: any[] = [];
      
      try {
        if (importSource === 'JSON') {
          columns = JSON.parse(importData);
        } else if (importSource === 'CSV') {
          // 解析 CSV
          const lines = importData.trim().split('\n');
          if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim());
            columns = lines.slice(1).map(line => {
              const values = line.split(',');
              const col: any = { name: values[0]?.trim() || 'column' };
              if (headers.includes('type') && values[headers.indexOf('type')]) {
                col.type = values[headers.indexOf('type')].trim();
              }
              if (headers.includes('pk') && values[headers.indexOf('pk')]?.toLowerCase() === 'true') {
                col.pk = true;
              }
              if (headers.includes('notNull') && values[headers.indexOf('notNull')]?.toLowerCase() === 'true') {
                col.notNull = true;
              }
              if (headers.includes('unique') && values[headers.indexOf('unique')]?.toLowerCase() === 'true') {
                col.unique = true;
              }
              if (headers.includes('default') && values[headers.indexOf('default')]) {
                col.default = values[headers.indexOf('default')].trim();
              }
              return col;
            });
          }
        } else if (importSource === '剪切板') {
          // 尝试解析为 JSON
          try {
            columns = JSON.parse(importData);
          } catch {
            // 尝试解析为 CSV
            const lines = importData.trim().split('\n');
            if (lines.length >= 2) {
              const headers = lines[0].split('\t');
              columns = lines.slice(1).map(line => {
                const values = line.split('\t');
                return { name: values[0]?.trim() || 'column' };
              });
            }
          }
        }
        
        // 智能推断类型
        if (inferTypes) {
          columns = columns.map(col => {
            if (!col.type) {
              // 根据字段名推断类型
              const typeMap: Record<string, string> = {
                'id': 'BIGINT',
                'user_id': 'BIGINT',
                'order_id': 'BIGINT',
                'product_id': 'BIGINT',
                'category_id': 'BIGINT',
                'amount': 'DECIMAL(12,2)',
                'price': 'DECIMAL(10,2)',
                'cost': 'DECIMAL(10,2)',
                'quantity': 'INTEGER',
                'count': 'INTEGER',
                'status': "VARCHAR(20)",
                'type': "VARCHAR(30)",
                'name': 'VARCHAR(100)',
                'title': 'VARCHAR(200)',
                'description': 'TEXT',
                'content': 'TEXT',
                'email': 'VARCHAR(255)',
                'phone': 'VARCHAR(20)',
                'address': 'VARCHAR(500)',
                'url': 'VARCHAR(500)',
                'image': 'VARCHAR(500)',
                'avatar': 'VARCHAR(500)',
                'remark': 'VARCHAR(500)',
                'created_at': 'TIMESTAMP',
                'updated_at': 'TIMESTAMP',
                'date': 'DATE',
                'time': 'TIME',
                'datetime': 'TIMESTAMP',
                'is_': 'BOOLEAN',
                'has_': 'BOOLEAN',
                'can_': 'BOOLEAN',
                'enable': 'BOOLEAN',
                'active': 'BOOLEAN'
              };
              
              const lowerName = col.name?.toLowerCase() || '';
              for (const [key, type] of Object.entries(typeMap)) {
                if (lowerName.includes(key)) {
                  col.type = type;
                  break;
                }
              }
              col.type = col.type || 'VARCHAR(255)';
            }
            return col;
          });
        }
      } catch (e) {
        return `-- 导入解析失败
-- 请检查导入数据格式是否正确
-- JSON 示例: [{"name": "id", "type": "INTEGER", "pk": true}]
-- CSV 示例: name,type,pk,notNull
--         id,INTEGER,true,false`;
      }
      
      let sql = `-- =====================================================
-- 导入建表
-- 来源: ${importSource}
-- 表名: ${tableName}
-- 列数: ${columns.length}
-- =====================================================\n\n`;
      
      sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      
      const columnDefs = columns.map(col => {
        let def = `  ${col.name} ${col.type || 'VARCHAR(255)'}`;
        if (col.notNull) def += ' NOT NULL';
        if (col.unique) def += ' UNIQUE';
        if (col.default) def += ` DEFAULT ${col.default}`;
        if (col.pk) def += ' PRIMARY KEY';
        return def;
      });
      
      sql += columnDefs.join(',\n');
      sql += '\n);\n';
      
      return sql;
    },
    
    alterTable: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { alterType, columnName, columnDefinition, constraint, ifExists } = inputs;
      const tableName = context.tableName || 'table_name';
      const ifClause = ifExists ? 'IF EXISTS ' : '';
      
      let sql = `ALTER TABLE ${ifClause}"${tableName}"\n`;
      
      switch (alterType) {
        case '添加列':
          sql += `  ADD COLUMN ${columnName} ${columnDefinition || 'VARCHAR(255)'};`;
          break;
        case '修改列':
          sql += `  ALTER COLUMN ${columnName} SET DATA TYPE ${columnDefinition || 'VARCHAR(255)'};`;
          break;
        case '删除列':
          sql += `  DROP COLUMN ${ifClause}${columnName};`;
          break;
        case '添加约束':
          sql += `  ADD CONSTRAINT ${constraint || 'constraint_name'};`;
          break;
        case '删除约束':
          sql += `  DROP CONSTRAINT ${ifClause}${constraint || 'constraint_name'};`;
          break;
        case '重命名表':
          sql += `  RENAME TO new_table_name;`;
          break;
      }
      
      return sql;
    },
    
    dropTable: (inputs: Record<string, any>) => {
      const { tableName, mode, cascade } = inputs;
      const cascadeStr = cascade ? ' CASCADE' : '';
      
      if (mode === 'TRUNCATE') {
        return `TRUNCATE TABLE "${tableName}";`;
      }
      
      return `${mode} "${tableName}"${cascadeStr};`;
    },
    
    createView: (inputs: Record<string, any>) => {
      const { viewName, query, replace, recursive } = inputs;
      
      let sql = 'CREATE ';
      if (replace) sql += 'OR REPLACE ';
      if (recursive) sql += 'RECURSIVE ';
      sql += `VIEW "${viewName}" AS\n`;
      sql += `${query};`;
      
      return sql;
    },
    
    createIndex: (inputs: Record<string, any>) => {
      const { indexName, tableName, columns, indexType, unique, ifNotExists } = inputs;
      const ifClause = ifNotExists ? 'IF NOT EXISTS ' : '';
      const uniqueStr = unique ? 'UNIQUE ' : '';
      const typeStr = indexType && indexType !== '默认' ? ` USING ${indexType}` : '';
      
      return `CREATE ${uniqueStr}INDEX ${ifClause}"${indexName}" ON "${tableName}"${typeStr} (${columns});`;
    },
    
    tableDesign: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { businessObject, tables, relationships, includeSample } = inputs;
      
      let sql = `-- =====================================================
-- 表结构设计方案
-- 业务对象: ${businessObject}
-- =====================================================\n\n`;
      
      // Parse table definitions
      const tableLines = tables.split('\n').filter(line => line.trim());
      const tableDefs: Record<string, string> = {};
      
      tableLines.forEach(line => {
        const match = line.match(/^(\w+)\s*-\s*(.+)$/);
        if (match) {
          tableDefs[match[1].trim()] = match[2].trim();
        }
      });
      
      // Generate table creation SQL based on business object
      const tableNames = Object.keys(tableDefs);
      
      tableNames.forEach((tableName, idx) => {
        const purpose = tableDefs[tableName];
        sql += `-- ${idx + 1}. ${tableName} - ${purpose}\n`;
        
        // Generate common table structures based on naming conventions
        if (tableName.toLowerCase().includes('user')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id INTEGER PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        } else if (tableName.toLowerCase().includes('order')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id BIGINT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_number VARCHAR(50) UNIQUE,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipping_address VARCHAR(500),
  notes TEXT
);\n\n`;
        } else if (tableName.toLowerCase().includes('product') || tableName.toLowerCase().includes('item')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category_id INTEGER,
  stock_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        } else if (tableName.toLowerCase().includes('category')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        } else if (tableName.toLowerCase().includes('payment') || tableName.toLowerCase().includes('transaction')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id BIGINT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        } else if (tableName.toLowerCase().includes('address')) {
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  detail_address VARCHAR(500),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        } else {
          // Generic table
          sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);\n\n`;
        }
      });
      
      // Add relationships
      if (relationships) {
        sql += `-- =====================================================
-- 表关系定义
-- =====================================================\n\n`;
        
        const relLines = relationships.split('\n').filter(line => line.trim());
        relLines.forEach(rel => {
          const match = rel.match(/(\w+)\s+(\d+)-n\s+(\w+)/);
          if (match) {
            const [_, leftTable, , rightTable] = match;
            sql += `-- ${leftTable} 1-n ${rightTable}\n`;
            sql += `ALTER TABLE "${rightTable}" ADD FOREIGN KEY (${leftTable}_id) REFERENCES ${leftTable}(id);\n\n`;
          }
        });
      }
      
      // Add sample data if requested
      if (includeSample) {
        sql += `-- =====================================================
-- 示例数据
-- =====================================================\n\n`;
        
        tableNames.forEach(tableName => {
          if (tableName.toLowerCase().includes('user')) {
            sql += `INSERT INTO "${tableName}" (username, email, password_hash) VALUES
  ('admin', 'admin@example.com', 'hashed_password'),
  ('testuser', 'test@example.com', 'hashed_password');\n\n`;
          } else if (tableName.toLowerCase().includes('category')) {
            sql += `INSERT INTO "${tableName}" (name, sort_order) VALUES
  ('Electronics', 1),
  ('Clothing', 2),
  ('Books', 3);\n\n`;
          }
        });
      }
      
      return sql;
    }
  },
  
  analysis: {
    timeSeries: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { timeColumn, valueColumn, granularity, analysisType } = inputs;
      const tableName = context.tableName || 'table_name';
      
      const granularityMap: Record<string, string> = {
        '日': "DATE_TRUNC('day', {timeColumn})",
        '周': "DATE_TRUNC('week', {timeColumn})",
        '月': "DATE_TRUNC('month', {timeColumn})",
        '季度': "DATE_TRUNC('quarter', {timeColumn})",
        '年': "DATE_TRUNC('year', {timeColumn})"
      };
      
      const truncatedTime = granularityMap[granularity]?.replace('{timeColumn}', timeColumn) || timeColumn;
      
      let sql = `SELECT 
  ${truncatedTime} AS period,
  ${analysisType === '移动平均' 
    ? `AVG(${valueColumn}) OVER (ORDER BY ${timeColumn} ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`
    : `SUM(${valueColumn}) AS total_${valueColumn}`}
FROM "${tableName}"
ORDER BY period;`;
      
      return sql;
    },
    
    comparison: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { dimension, metrics, comparisonType } = inputs;
      const tableName = context.tableName || 'table_name';
      
      let sql = '';
      
      if (comparisonType === '占比分析') {
        sql = `SELECT 
  ${dimension},
  ${metrics},
  ROUND(100.0 * ${metrics} / SUM(${metrics}) OVER (), 2) AS percentage
FROM "${tableName}"
ORDER BY percentage DESC;`;
      } else if (comparisonType === '排名分析') {
        sql = `SELECT 
  ${dimension},
  ${metrics},
  RANK() OVER (ORDER BY ${metrics} DESC) AS rank
FROM "${tableName}";`;
      } else {
        sql = `SELECT 
  ${dimension},
  ${metrics}
FROM "${tableName}"
ORDER BY ${dimension};`;
      }
      
      return sql;
    },
    
    funnel: (inputs: Record<string, any>) => {
      const { steps, userIdColumn } = inputs;
      
      return `-- 漏斗分析模板
-- 步骤: ${steps}
SELECT 
  step_name,
  COUNT(DISTINCT ${userIdColumn}) AS user_count,
  ROUND(100.0 * COUNT(DISTINCT ${userIdColumn}) / LAG(COUNT(DISTINCT ${userIdColumn})) OVER (ORDER BY step_order), 2) AS conversion_rate
FROM (
  -- 在此定义各步骤
  ${steps}
) funnel
GROUP BY step_name
ORDER BY step_order;`;
    },
    
    retention: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { eventColumn, userColumn, timeColumn, periods } = inputs;
      const tableName = context.tableName || 'table_name';
      const periodList = periods.split(',').map(p => parseInt(p.trim()));
      const maxPeriod = Math.max(...periodList);
      
      return `-- 留存分析模板
WITH cohort AS (
  SELECT 
    ${userColumn} AS user_id,
    DATE_TRUNC('day', ${timeColumn}) AS cohort_date
  FROM "${tableName}"
  GROUP BY ${userColumn}, DATE_TRUNC('day', ${timeColumn})
),
users AS (
  SELECT DISTINCT ${userColumn} AS user_id
  FROM "${tableName}"
)
SELECT 
  DATE_TRUNC('day', ${timeColumn}) AS activity_date,
  ${periods.split(',').map(p => `
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN DATE_TRUNC('day', ${timeColumn}) <= DATE_ADD('day', ${parseInt(p.trim())}, cohort_date) THEN ${userColumn} END) 
    / NULLIF(COUNT(DISTINCT ${userColumn}) OVER (PARTITION BY cohort_date), 0), 2) AS day_${p.trim()}`).join(',')}
FROM cohort
JOIN "${tableName}" t ON cohort.user_id = t.${userColumn}
GROUP BY DATE_TRUNC('day', ${timeColumn}), cohort_date
ORDER BY activity_date;`;
    }
  },
  
  transformation: {
    pivot: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { rows, columns, values, aggregation } = inputs;
      const tableName = context.tableName || 'table_name';
      
      return `PIVOT "${tableName}"
ON ${columns}
USING ${aggregation}(${values})
GROUP BY ${rows}
ORDER BY ${rows};`;
    },
    
    unpivot: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { columns, nameColumn, valueColumn } = inputs;
      const tableName = context.tableName || 'table_name';
      
      return `SELECT 
  *,
  UNPIVOT(${columns}) AS (${nameColumn}, ${valueColumn});`;
    },
    
    typeConversion: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { column, targetType, format } = inputs;
      const tableName = context.tableName || 'table_name';
      
      if (format) {
        return `SELECT 
  ${column},
  CAST(${column} AS ${targetType}) AS ${column}_converted,
  STRFTIME(CAST(${column} AS ${targetType}), '${format}') AS formatted
FROM "${tableName}";`;
      }
      
      return `SELECT 
  ${column},
  CAST(${column} AS ${targetType}) AS ${column}_converted
FROM "${tableName}";`;
    },
    
    stringManipulation: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { column, operation, params } = inputs;
      const tableName = context.tableName || 'table_name';
      
      const operations: Record<string, string> = {
        '字符串拼接': `CONCAT(${column}, '${params || ''}')`,
        '大小写转换': `UPPER(${column})`,
        '去空格': `TRIM(${column})`,
        '截取子串': `SUBSTRING(${column}, 1, ${params || 10})`,
        '替换': `REPLACE(${column}, '${params || 'old'}', '${params || 'new'}')`,
        '正则提取': `REGEXP_EXTRACT(${column}, '${params || '.*'}', 0)`,
        '分割': `STR_SPLIT(${column}, '${params || ','}')`
      };
      
      return `SELECT 
  ${column} AS original,
  ${operations[operation] || column} AS result
FROM "${tableName}";`;
    },
    
    dateHandling: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { column, operation, params } = inputs;
      const tableName = context.tableName || 'table_name';
      
      const operations: Record<string, string> = {
        '提取年月日': `EXTRACT(YEAR FROM ${column}) AS year, EXTRACT(MONTH FROM ${column}) AS month, EXTRACT(DAY FROM ${column}) AS day`,
        '日期加减': `DATE_ADD('${params || 'day'}', ${params || 1}, ${column}) AS new_date`,
        '日期差计算': `DATEDIFF('${params || 'day'}', ${column}, CURRENT_DATE) AS days_diff`,
        '日期格式化': `STRFTIME(${column}, '${params || '%Y-%m-%d'}') AS formatted`,
        '日期截断': `DATE_TRUNC('${params || 'month'}', ${column}) AS truncated`,
        '星期计算': `EXTRACT(DOW FROM ${column}) AS day_of_week`
      };
      
      return `SELECT 
  ${column} AS original,
  ${operations[operation] || column} AS result
FROM "${tableName}";`;
    }
  },
  
  optimization: {
    explain: (inputs: Record<string, any>) => {
      const { sql, analyze } = inputs;
      const prefix = analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
      return `${prefix}\n${sql};`;
    },
    
    index: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { query } = inputs;
      const tableName = context.tableName || 'table_name';
      
      return `-- 索引建议 (DuckDB 原生不支持传统索引，但可以使用以下优化)
-- 基于查询: ${query}

-- 1. 使用物化视图优化频繁查询
CREATE MATERIALIZED VIEW mv_${tableName}_optimized AS
${query};

-- 2. 考虑使用 COPY TO 预计算结果
COPY (
  ${query}
) TO 'optimized_result.parquet' (FORMAT PARQUET);`;
    },
    
    queryRewrite: (inputs: Record<string, any>) => {
      const { originalSql, optimizationGoals } = inputs;
      
      return `-- 优化建议
-- 原始查询: ${originalSql}

-- 优化版本:
SELECT * FROM (
  ${originalSql}
) AS optimized_query

-- 建议优化点:
-- 1. 确保 WHERE 条件使用索引列
-- 2. 避免 SELECT *，只选择需要的列
-- 3. 考虑使用 LIMIT 限制结果集
-- 4. 使用 EXPLAIN ANALYZE 分析执行计划`;
    }
  },
  
  utility: {
    testData: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { rowCount, pattern } = inputs;
      const tableName = context.tableName || 'table_name';
      const columns = context.columns || [];
      
      const getRandomValue = (colType: string): string => {
        const type = colType.toUpperCase();
        if (type.includes('INT')) return 'FLOOR(RANDOM() * 1000)::INT';
        if (type.includes('DOUBLE') || type.includes('FLOAT')) return 'RANDOM() * 1000';
        if (type.includes('VARCHAR') || type.includes('TEXT')) return "'test_' || FLOOR(RANDOM() * 1000)";
        if (type.includes('DATE')) return "DATE '2024-01-01' + INTERVAL (FLOOR(RANDOM() * 365)) DAY";
        return 'NULL';
      };
      
      const values = columns.length > 0
        ? columns.map(c => getRandomValue(c.type)).join(', ')
        : 'FLOOR(RANDOM() * 1000), \'test_\' || FLOOR(RANDOM() * 1000)';
      
      return `-- 生成 ${rowCount} 行测试数据
INSERT INTO "${tableName}"
SELECT 
  ${Array.from({ length: Math.min(columns.length, 5) }, (_, i) => 
    getRandomValue(columns[i]?.type || 'INTEGER')
  ).join(',\n  ')}
FROM GENERATE_SERIES(1, ${rowCount});`;
    },
    
    summarize: (inputs: Record<string, any>) => {
      const { table, includeHistograms } = inputs;
      
      return `-- 数据摘要查询
SUMMARIZE "${table}";

-- 或使用详细统计
SELECT 
  column_name,
  data_type,
  null_percentage,
  distinct_count,
  avg,
  min,
  max,
  ${includeHistograms ? 'histogram' : 'NULL as histogram'}
FROM (
  DESCRIBE "${table}"
) info
JOIN LATERAL (
  SELECT 
    COUNT(*) FILTER (WHERE column_name IS NULL) * 100.0 / COUNT(*) AS null_percentage
  FROM "${table}"
) null_stats ON true;`;
    },
    
    sampleQuery: (inputs: Record<string, any>, context: SkillExecutionContext) => {
      const { sampleType, sampleSize, stratifyBy } = inputs;
      const tableName = context.tableName || 'table_name';
      
      if (sampleType === '随机抽样') {
        return `SELECT * FROM "${tableName}"
USING SAMPLE ${sampleSize} ROWS
REPEATABLE (42);`;
      }
      
      if (sampleType === '分层抽样' && stratifyBy) {
        return `SELECT * FROM "${tableName}"
USING SAMPLE 
  (SELECT FLOOR(${sampleSize} * 1.0 / COUNT(*) * 100) FROM "${tableName}" GROUP BY ${stratifyBy})
PERCENT
REPEATABLE (42);`;
      }
      
      return `SELECT * FROM "${tableName}"
LIMIT ${sampleSize};`;
    }
  }
};

/**
 * Build schema context for AI prompts
 */
function buildSchemaContext(context: SkillExecutionContext): string {
  const parts: string[] = [];
  
  if (context.tableName) {
    parts.push(`表名: ${context.tableName}`);
  }
  
  if (context.columns && context.columns.length > 0) {
    const columnList = context.columns.map(col => 
      `  - ${col.name} (${col.type}${col.pk ? ', 主键' : ''})`
    ).join('\n');
    parts.push(`列信息:\n${columnList}`);
  }
  
  if (context.schema) {
    parts.push(`Schema: ${context.schema}`);
  }
  
  return parts.join('\n\n');
}

/**
 * Generate AI-powered SQL using skill context
 */
async function generateWithAI(
  skill: AISkill,
  inputs: Record<string, any>,
  context: SkillExecutionContext
): Promise<SkillResult> {
  const startTime = Date.now();
  
  try {
    const schemaContext = buildSchemaContext(context);
    
    // Build prompt based on skill type
    let prompt = '';
    let systemInstruction = 'You are a DuckDB SQL expert. Generate valid SQL queries.';
    
    // Format inputs as description
    const inputDescription = Object.entries(inputs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    switch (skill.category) {
      case 'sql':
        prompt = `基于以下需求生成 DuckDB SQL 查询：
需求: ${inputs.description || inputDescription}
表结构: ${schemaContext}

请生成完整、可执行的 SQL 语句。`;
        break;
        
      case 'analysis':
        prompt = `基于以下需求生成 DuckDB 分析查询：
需求: ${inputDescription}
表结构: ${schemaContext}

请生成包含适当聚合、窗口函数的分析查询。`;
        break;
        
      case 'transformation':
        prompt = `基于以下需求生成 DuckDB 数据转换 SQL：
需求: ${inputDescription}
表结构: ${schemaContext}

请生成相应的转换语句。`;
        break;
        
      case 'optimization':
        prompt = `基于以下需求生成 DuckDB 优化查询：
需求: ${inputDescription}
表结构: ${schemaContext}

请提供优化建议和对应的 SQL。`;
        break;
        
      default:
        prompt = `生成 DuckDB SQL: ${inputDescription}\n表结构: ${schemaContext}`;
    }
    
    // Call AI service
    const sql = await aiService.generateSql(prompt, schemaContext);
    
    return {
      success: true,
      sql: sql.trim(),
      explanation: `基于 ${skill.name} 生成的 SQL 查询`,
      executionTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'SQL generation failed',
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * SkillExecutor class
 */
class SkillExecutor {
  private executionHistory: { skillId: string; result: SkillResult; timestamp: number }[] = [];
  private maxHistorySize = 50;
  
  /**
   * Execute a skill with given inputs
   */
  async execute(request: SkillInvokeRequest): Promise<SkillResult> {
    const { skillId, inputs, context, simulateOnly } = request;
    const skill = getSkill(skillId);
    
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillId}`
      };
    }
    
    const startTime = Date.now();
    
    try {
      // First, try template-based generation
      let result = this.generateFromTemplate(skill, inputs, context);
      
      // If template returns empty or needs AI enhancement, use AI
      if (!result.sql || result.sql.includes('col') || result.sql.includes('table_name')) {
        // Try AI generation as fallback
        try {
          const aiResult = await generateWithAI(skill, inputs, context);
          if (aiResult.success && aiResult.sql) {
            result = {
              ...result,
              sql: aiResult.sql,
              explanation: result.explanation + ' (AI 增强)',
              executionTime: aiResult.executionTime
            };
          }
        } catch (e) {
          // Keep template result if AI fails
          console.warn('AI generation failed, using template:', e);
        }
      }
      
      // Add execution to history
      this.addToHistory(skillId, result);
      
      // If simulateOnly, return without actual execution
      if (simulateOnly) {
        return {
          ...result,
          metadata: {
            ...result.metadata,
            simulated: true,
            executionTime: Date.now() - startTime
          }
        };
      }
      
      return {
        ...result,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      const errorResult = {
        success: false,
        error: error.message || 'Execution failed',
        executionTime: Date.now() - startTime
      };
      
      this.addToHistory(skillId, errorResult);
      
      return errorResult;
    }
  }
  
  /**
   * Generate SQL from template
   */
  private generateFromTemplate(
    skill: AISkill,
    inputs: Record<string, any>,
    context: SkillExecutionContext
  ): SkillResult {
    const skillId = skill.id;
    let sql = '';
    
    // SQL Generation Skills
    if (skillId === 'sql-select-generator') {
      sql = SKILL_PROMPTS.sql.select(inputs, context);
    } else if (skillId === 'sql-join-generator') {
      sql = SKILL_PROMPTS.sql.join(inputs, context);
    } else if (skillId === 'sql-aggregation-generator') {
      sql = SKILL_PROMPTS.sql.aggregation(inputs, context);
    } else if (skillId === 'sql-window-function') {
      sql = SKILL_PROMPTS.sql.window(inputs, context);
    } else if (skillId === 'sql-cte-generator') {
      sql = SKILL_PROMPTS.sql.cte(inputs);
    } else if (skillId === 'sql-insert-generator') {
      sql = SKILL_PROMPTS.sql.insert(inputs, context);
    } else if (skillId === 'sql-update-generator') {
      sql = SKILL_PROMPTS.sql.update(inputs, context);
    } else if (skillId === 'sql-delete-generator') {
      sql = SKILL_PROMPTS.sql.delete(inputs, context);
    } else if (skillId === 'sql-create-table-generator') {
      sql = SKILL_PROMPTS.sql.createTable(inputs);
    } else if (skillId === 'sql-create-table-nl') {
      sql = SKILL_PROMPTS.sql.createTableNL(inputs);
    } else if (skillId === 'sql-create-table-template') {
      sql = SKILL_PROMPTS.sql.createTableTemplate(inputs);
    } else if (skillId === 'sql-create-table-import') {
      sql = SKILL_PROMPTS.sql.createTableImport(inputs);
    } else if (skillId === 'sql-alter-table-generator') {
      sql = SKILL_PROMPTS.sql.alterTable(inputs, context);
    } else if (skillId === 'sql-drop-table-generator') {
      sql = SKILL_PROMPTS.sql.dropTable(inputs);
    } else if (skillId === 'sql-view-generator') {
      sql = SKILL_PROMPTS.sql.createView(inputs);
    } else if (skillId === 'sql-index-generator') {
      sql = SKILL_PROMPTS.sql.createIndex(inputs);
    } else if (skillId === 'sql-table-design') {
      sql = SKILL_PROMPTS.sql.tableDesign(inputs, context);
    }
    // Analysis Skills
    else if (skillId === 'analysis-time-series') {
      sql = SKILL_PROMPTS.analysis.timeSeries(inputs, context);
    } else if (skillId === 'analysis-comparison') {
      sql = SKILL_PROMPTS.analysis.comparison(inputs, context);
    } else if (skillId === 'analysis-funnel') {
      sql = SKILL_PROMPTS.analysis.funnel(inputs);
    } else if (skillId === 'analysis-retention') {
      sql = SKILL_PROMPTS.analysis.retention(inputs, context);
    }
    // Transformation Skills
    else if (skillId === 'transform-pivot') {
      sql = SKILL_PROMPTS.transformation.pivot(inputs, context);
    } else if (skillId === 'transform-unpivot') {
      sql = SKILL_PROMPTS.transformation.unpivot(inputs, context);
    } else if (skillId === 'transform-type-conversion') {
      sql = SKILL_PROMPTS.transformation.typeConversion(inputs, context);
    } else if (skillId === 'transform-string-manipulation') {
      sql = SKILL_PROMPTS.transformation.stringManipulation(inputs, context);
    } else if (skillId === 'transform-date-handling') {
      sql = SKILL_PROMPTS.transformation.dateHandling(inputs, context);
    }
    // Optimization Skills
    else if (skillId === 'optimization-explain') {
      sql = SKILL_PROMPTS.optimization.explain(inputs);
    } else if (skillId === 'optimization-index') {
      sql = SKILL_PROMPTS.optimization.index(inputs, context);
    } else if (skillId === 'optimization-query-rewrite') {
      sql = SKILL_PROMPTS.optimization.queryRewrite(inputs);
    }
    // Utility Skills
    else if (skillId === 'utility-test-data') {
      sql = SKILL_PROMPTS.utility.testData(inputs, context);
    } else if (skillId === 'utility-summarize') {
      sql = SKILL_PROMPTS.utility.summarize(inputs);
    } else if (skillId === 'utility-sample-query') {
      sql = SKILL_PROMPTS.utility.sampleQuery(inputs, context);
    }
    // Fallback - use AI
    else {
      return generateWithAI(skill, inputs, context).then(result => ({
        ...result,
        metadata: { ...result.metadata, fromAI: true }
      })) as Promise<SkillResult>;
    }
    
    return {
      success: true,
      sql,
      explanation: `基于 ${skill.name} 模板生成的 SQL`
    };
  }
  
  /**
   * Add execution to history
   */
  private addToHistory(skillId: string, result: SkillResult): void {
    this.executionHistory.unshift({
      skillId,
      result,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * Get execution history
   */
  getHistory() {
    return this.executionHistory;
  }
  
  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }
}

// Singleton instance
export const skillExecutor = new SkillExecutor();

// Export convenience functions
export const executeSkill = (request: SkillInvokeRequest) => skillExecutor.execute(request);
export const getSkillHistory = () => skillExecutor.getHistory();
export const clearSkillHistory = () => skillExecutor.clearHistory();
