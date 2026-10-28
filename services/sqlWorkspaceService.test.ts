import { describe, expect, it } from 'vitest';
import { declaredSqlTables } from './sqlWorkspaceService';

describe('SQL source ownership', () => {
  it('retains the first table after separated comment headers and ignores fake DDL in strings/comments', () => {
    const sql = `-- actual snapshot; comment delimiter

-- four original tables

CREATE TABLE users(id BIGINT);
INSERT INTO users VALUES (1);
/* CREATE TABLE fake(id INT); */
CREATE TABLE "交易记录"(text VARCHAR);
INSERT INTO "交易记录" VALUES ('CREATE TABLE fake2(id INT);');`;
    expect(declaredSqlTables(sql)).toEqual(['users', '交易记录']);
  });
  it('recognizes qualified and escaped identifiers without including unrelated tables', () => {
    expect(declaredSqlTables('CREATE OR REPLACE TABLE main."a""b"(id INT); UPDATE unrelated SET id=1;')) .toEqual(['a"b']);
  });
});
