/**
 * SQL DDL Generators
 *
 * Template-based SQL generation for DDL skills:
 * CREATE TABLE (4 variants), ALTER TABLE, DROP TABLE, CREATE VIEW, CREATE INDEX, Table Design
 */

import { SkillExecutionContext } from '../../../types';
import { DOMAIN_SCHEMAS, TABLE_TEMPLATES, getSampleData, isColumnDefArray, ColumnDef } from './domain-schemas';

export const sqlDdlGenerators = {
  createTable(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { tableName, columns, primaryKey, foreignKeys, indexes, engine, ifNotExists } = inputs;
    const tableIdentifier = ifNotExists ? `IF NOT EXISTS "${tableName}"` : `"${tableName}"`;

    let sql = `CREATE TABLE ${tableIdentifier} (\n`;

    if (!columns) {
      return sql + '  -- columns not provided\n);';
    }

    const columnLines = columns.split('\n').filter((line: string) => line.trim());
    sql += columnLines.map((col: string) => `  ${col.trim()}`).join(',\n');

    if (primaryKey) {
      sql += `,\n  PRIMARY KEY (${primaryKey})`;
    }

    if (foreignKeys) {
      const fkLines = foreignKeys.split('\n').filter((line: string) => line.trim());
      fkLines.forEach((fk: string) => {
        sql += `,\n  ${fk.trim()}`;
      });
    }

    sql += '\n)';

    if (engine && engine !== '默认') {
      if (engine === 'Memory') sql += ' USING MEMORY';
      else if (engine === 'Parquet') sql += ' USING PARQUET';
    }

    sql += ';';

    if (indexes) {
      const idxLines = indexes.split('\n').filter((line: string) => line.trim());
      idxLines.forEach((idx: string) => {
        sql += `\n\n-- 创建索引\nCREATE INDEX ${idx.trim()};`;
      });
    }

    return sql;
  },

  createTableNL(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { description, businessDomain, includeSample } = inputs;

    const domain = businessDomain || '通用';
    let schema = DOMAIN_SCHEMAS[domain];

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
              { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
            ],
          },
        },
      };
    }

    let sql = `-- =====================================================
-- 自然语言建表方案
-- 业务领域: ${domain}
${description ? `-- 需求描述: ${description.substring(0, 100)}...` : '-- 需求描述: (未提供)'}
-- =====================================================\n\n`;

    const tableEntries = Object.entries(schema.tables);
    tableEntries.forEach(([tableName, tableDef], tableIdx) => {
      const columns = isColumnDefArray(tableDef.columns) ? tableDef.columns : [];
      sql += `-- ${tableIdx + 1}. ${tableName}\n`;
      sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

      const columnDefs = (columns as ColumnDef[]).map((col: ColumnDef) => {
        let def = `  ${col.name} ${col.type}`;
        if (col.notNull) def += ' NOT NULL';
        if (col.unique) def += ' UNIQUE';
        if (col.default) def += ` DEFAULT ${col.default}`;
        if (col.pk) def += ' PRIMARY KEY';
        return def;
      });

      sql += columnDefs.join(',\n');

      const fkColumns = columns.filter((col: any) => col.fk);
      if (fkColumns.length > 0) {
        sql += ',\n';
        sql += fkColumns.map((col: any) => `  FOREIGN KEY (${col.name}) REFERENCES ${col.fk}`).join(',\n');
      }

      sql += '\n);\n\n';

      const indexedColumns = columns.filter((col: any) => !col.pk && (col.unique || col.name.includes('_id') || col.name.includes('_name')));
      if (indexedColumns.length > 0) {
        indexedColumns.forEach((col: any) => {
          const idxName = `idx_${tableName}_${col.name}`;
          sql += `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${tableName}" (${col.name});\n`;
        });
        sql += '\n';
      }
    });

    if (includeSample) {
      sql += `-- =====================================================
-- 示例数据
-- =====================================================\n\n`;

      tableEntries.forEach(([tableName]) => {
        if (['users', 'categories', 'products'].includes(tableName)) {
          const sampleData = getSampleData(tableName);
          if (sampleData) {
            sql += sampleData;
          }
        }
      });
    }

    return sql;
  },

  createTableTemplate(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { templateType, tableName, customizeFields, addStatus, addTimestamps } = inputs;

    const template = TABLE_TEMPLATES[templateType] || TABLE_TEMPLATES['用户表'];
    const finalTableName = tableName || template.name;

    let sql = `-- =====================================================
-- 模板建表: ${templateType}
-- 表名: ${finalTableName}
-- =====================================================\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS "${finalTableName}" (\n`;

    let columnDefs = template.columns.map((col: any) => {
      let def = `  ${col.name} ${col.type}`;
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.default) def += ` DEFAULT ${col.default}`;
      if (col.pk) def += ' PRIMARY KEY';
      return def;
    });

    if (addStatus) {
      columnDefs.push(`  status VARCHAR(20) DEFAULT 'active'`);
    }

    if (addTimestamps) {
      columnDefs.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      columnDefs.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    }

    if (customizeFields) {
      const customLines = customizeFields.split('\n').filter((line: string) => line.trim());
      customLines.forEach((line: string) => {
        const match = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/);
        if (match) {
          columnDefs.push(`  ${match[1]} ${match[2]}`);
        }
      });
    }

    sql += columnDefs.join(',\n');
    sql += '\n);\n';

    sql += `\n-- 索引\n`;
    sql += `CREATE INDEX IF NOT EXISTS "idx_${finalTableName}_status" ON "${finalTableName}" (status);\n`;
    if (addTimestamps) {
      sql += `CREATE INDEX IF NOT EXISTS "idx_${finalTableName}_created_at" ON "${finalTableName}" (created_at);\n`;
    }

    return sql;
  },

  createTableImport(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { importSource, importData, tableName, inferTypes } = inputs;

    let columns: any[] = [];

    try {
      if (importSource === 'JSON') {
        columns = JSON.parse(importData);
      } else if (importSource === 'CSV') {
        const lines = importData.trim().split('\n');
        if (lines.length >= 2) {
          const headers = lines[0].split(',').map((h: string) => h.trim());
          columns = lines.slice(1).map((line: string) => {
            const values = line.split(',');
            const col: any = { name: values[0]?.trim() || 'column' };
            if (headers.includes('type') && values[headers.indexOf('type')]) col.type = values[headers.indexOf('type')].trim();
            if (headers.includes('pk') && values[headers.indexOf('pk')]?.toLowerCase() === 'true') col.pk = true;
            if (headers.includes('notNull') && values[headers.indexOf('notNull')]?.toLowerCase() === 'true') col.notNull = true;
            if (headers.includes('unique') && values[headers.indexOf('unique')]?.toLowerCase() === 'true') col.unique = true;
            if (headers.includes('default') && values[headers.indexOf('default')]) col.default = values[headers.indexOf('default')].trim();
            return col;
          });
        }
      } else if (importSource === '剪切板') {
        try {
          columns = JSON.parse(importData);
        } catch {
          const lines = importData.trim().split('\n');
          if (lines.length >= 2) {
            columns = lines.slice(1).map((line: string) => {
              const values = line.split('\t');
              return { name: values[0]?.trim() || 'column' };
            });
          }
        }
      }

      if (inferTypes) {
        const TYPE_INFERENCE_MAP: Record<string, string> = {
          'id': 'BIGINT', 'user_id': 'BIGINT', 'order_id': 'BIGINT', 'product_id': 'BIGINT', 'category_id': 'BIGINT',
          'amount': 'DECIMAL(12,2)', 'price': 'DECIMAL(10,2)', 'cost': 'DECIMAL(10,2)',
          'quantity': 'INTEGER', 'count': 'INTEGER',
          'status': 'VARCHAR(20)', 'type': 'VARCHAR(30)', 'name': 'VARCHAR(100)', 'title': 'VARCHAR(200)',
          'description': 'TEXT', 'content': 'TEXT',
          'email': 'VARCHAR(255)', 'phone': 'VARCHAR(20)', 'address': 'VARCHAR(500)',
          'url': 'VARCHAR(500)', 'image': 'VARCHAR(500)', 'avatar': 'VARCHAR(500)', 'remark': 'VARCHAR(500)',
          'created_at': 'TIMESTAMP', 'updated_at': 'TIMESTAMP', 'date': 'DATE', 'time': 'TIME', 'datetime': 'TIMESTAMP',
          'is_': 'BOOLEAN', 'has_': 'BOOLEAN', 'can_': 'BOOLEAN', 'enable': 'BOOLEAN', 'active': 'BOOLEAN',
        };

        columns = columns.map((col: any) => {
          if (!col.type) {
            const lowerName = col.name?.toLowerCase() || '';
            for (const [key, type] of Object.entries(TYPE_INFERENCE_MAP)) {
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
    } catch {
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

    const columnDefs = columns.map((col: any) => {
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

  alterTable(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { alterType, columnName, columnDefinition, constraint, ifExists } = inputs;
    const tableName = context.tableName || 'table_name';
    const ifClause = ifExists ? 'IF EXISTS ' : '';

    let sql = `ALTER TABLE ${ifClause}"${tableName}"\n`;

    switch (alterType) {
      case '添加列': sql += `  ADD COLUMN ${columnName} ${columnDefinition || 'VARCHAR(255)'};`; break;
      case '修改列': sql += `  ALTER COLUMN ${columnName} SET DATA TYPE ${columnDefinition || 'VARCHAR(255)'};`; break;
      case '删除列': sql += `  DROP COLUMN ${ifClause}${columnName};`; break;
      case '添加约束': sql += `  ADD CONSTRAINT ${constraint || 'constraint_name'};`; break;
      case '删除约束': sql += `  DROP CONSTRAINT ${ifClause}${constraint || 'constraint_name'};`; break;
      case '重命名表': sql += `  RENAME TO new_table_name;`; break;
    }

    return sql;
  },

  dropTable(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { tableName, mode, cascade } = inputs;
    const cascadeStr = cascade ? ' CASCADE' : '';
    if (mode === 'TRUNCATE') return `TRUNCATE TABLE "${tableName}";`;
    return `${mode} "${tableName}"${cascadeStr};`;
  },

  createView(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { viewName, query, replace, recursive } = inputs;
    let sql = 'CREATE ';
    if (replace) sql += 'OR REPLACE ';
    if (recursive) sql += 'RECURSIVE ';
    sql += `VIEW "${viewName}" AS\n${query};`;
    return sql;
  },

  createIndex(inputs: Record<string, any>, _context: SkillExecutionContext): string {
    const { indexName, tableName, columns, indexType, unique, ifNotExists } = inputs;
    const ifClause = ifNotExists ? 'IF NOT EXISTS ' : '';
    const uniqueStr = unique ? 'UNIQUE ' : '';
    const typeStr = indexType && indexType !== '默认' ? ` USING ${indexType}` : '';
    return `CREATE ${uniqueStr}INDEX ${ifClause}"${indexName}" ON "${tableName}"${typeStr} (${columns});`;
  },

  tableDesign(inputs: Record<string, any>, context: SkillExecutionContext): string {
    const { businessObject, tables, relationships, includeSample } = inputs;

    let sql = `-- =====================================================
-- 表结构设计方案
${businessObject ? `-- 业务对象: ${businessObject}` : '-- 业务对象: (未提供)'}
-- =====================================================\n\n`;

    const tableLines = (tables || '').split('\n').filter((line: string) => line.trim());
    const tableDefs: Record<string, string> = {};

    tableLines.forEach((line: string) => {
      const match = line.match(/^(\w+)\s*-\s*(.+)$/);
      if (match) {
        tableDefs[match[1].trim()] = match[2].trim();
      }
    });

    const tableNames = Object.keys(tableDefs);

    const TABLE_PATTERNS: Record<string, string> = {
      user: `  id INTEGER PRIMARY KEY,\n  username VARCHAR(100) NOT NULL UNIQUE,\n  email VARCHAR(255) NOT NULL UNIQUE,\n  password_hash VARCHAR(255) NOT NULL,\n  status VARCHAR(20) DEFAULT 'active',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      order: `  id BIGINT PRIMARY KEY,\n  user_id INTEGER NOT NULL,\n  order_number VARCHAR(50) UNIQUE,\n  total_amount DECIMAL(10,2) DEFAULT 0,\n  status VARCHAR(20) DEFAULT 'pending',\n  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  shipping_address VARCHAR(500),\n  notes TEXT`,
      product: `  id INTEGER PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  description TEXT,\n  price DECIMAL(10,2),\n  category_id INTEGER,\n  stock_quantity INTEGER DEFAULT 0,\n  status VARCHAR(20) DEFAULT 'active',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      item: `  id INTEGER PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  description TEXT,\n  price DECIMAL(10,2),\n  category_id INTEGER,\n  stock_quantity INTEGER DEFAULT 0,\n  status VARCHAR(20) DEFAULT 'active',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      category: `  id INTEGER PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  parent_id INTEGER,\n  description TEXT,\n  sort_order INTEGER DEFAULT 0,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      payment: `  id BIGINT PRIMARY KEY,\n  order_id INTEGER NOT NULL,\n  user_id INTEGER NOT NULL,\n  amount DECIMAL(10,2) NOT NULL,\n  payment_method VARCHAR(50),\n  transaction_id VARCHAR(100) UNIQUE,\n  status VARCHAR(20) DEFAULT 'pending',\n  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      transaction: `  id BIGINT PRIMARY KEY,\n  order_id INTEGER NOT NULL,\n  user_id INTEGER NOT NULL,\n  amount DECIMAL(10,2) NOT NULL,\n  payment_method VARCHAR(50),\n  transaction_id VARCHAR(100) UNIQUE,\n  status VARCHAR(20) DEFAULT 'pending',\n  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      address: `  id INTEGER PRIMARY KEY,\n  user_id INTEGER NOT NULL,\n  recipient_name VARCHAR(100) NOT NULL,\n  phone VARCHAR(20),\n  province VARCHAR(50),\n  city VARCHAR(50),\n  district VARCHAR(50),\n  detail_address VARCHAR(500),\n  is_default BOOLEAN DEFAULT FALSE,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    };

    const GENERIC_COLUMNS = `  id INTEGER PRIMARY KEY,\n  name VARCHAR(255),\n  description TEXT,\n  status VARCHAR(20) DEFAULT 'active',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;

    tableNames.forEach((tName, idx) => {
      const purpose = tableDefs[tName];
      sql += `-- ${idx + 1}. ${tName} - ${purpose}\n`;

      const lower = tName.toLowerCase();
      let matched = GENERIC_COLUMNS;
      for (const [pattern, cols] of Object.entries(TABLE_PATTERNS)) {
        if (lower.includes(pattern)) { matched = cols; break; }
      }

      sql += `CREATE TABLE IF NOT EXISTS "${tName}" (\n${matched}\n);\n\n`;
    });

    if (relationships) {
      sql += `-- =====================================================\n-- 表关系定义\n-- =====================================================\n\n`;
      const relLines = relationships.split('\n').filter((line: string) => line.trim());
      relLines.forEach((rel: string) => {
        const match = rel.match(/(\w+)\s+(\d+)-n\s+(\w+)/);
        if (match) {
          const [, leftTable, , rightTable] = match;
          sql += `-- ${leftTable} 1-n ${rightTable}\n`;
          sql += `ALTER TABLE "${rightTable}" ADD FOREIGN KEY (${leftTable}_id) REFERENCES ${leftTable}(id);\n\n`;
        }
      });
    }

    if (includeSample) {
      sql += `-- =====================================================\n-- 示例数据\n-- =====================================================\n\n`;
      tableNames.forEach(tName => {
        if (tName.toLowerCase().includes('user')) {
          sql += `INSERT INTO "${tName}" (username, email, password_hash) VALUES\n  ('admin', 'admin@example.com', 'hashed_password'),\n  ('testuser', 'test@example.com', 'hashed_password');\n\n`;
        } else if (tName.toLowerCase().includes('category')) {
          sql += `INSERT INTO "${tName}" (name, sort_order) VALUES\n  ('Electronics', 1),\n  ('Clothing', 2),\n  ('Books', 3);\n\n`;
        }
      });
    }

    return sql;
  },
};
