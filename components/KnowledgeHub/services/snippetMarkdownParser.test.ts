import { describe, it, expect } from 'vitest';
import { 
  serializeSnippetToMarkdown, 
  parseMarkdownToSnippet,
  serializeAssetToMarkdown,
  parseMarkdownToAsset,
  extractSqlBlocksFromMarkdown
} from './snippetMarkdownParser';
import { CodeAsset, MetricAsset, NoteAsset } from '../types';

describe('snippetMarkdownParser', () => {
  const sampleCodeAsset: CodeAsset = {
    id: 'code-test-1',
    type: 'code',
    title: '用户复购周期分布统计',
    category: 'template',
    description: '计算用户首次下单与二次下单之间的自然天数间隔分布',
    sql: `SELECT 
    datediff('day', first_order_date, second_order_date) AS repurchased_days,
    count(*) AS user_count
FROM {{repurchase_table}}
GROUP BY 1
ORDER BY 1;`,
    params: [
      { name: 'repurchase_table', label: '复购分析汇总表', defaultValue: 'fact_user_repurchase' },
    ],
    tags: ['电商', '复购分析', 'DuckDB'],
    isFavorite: true,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  };

  const sampleNoteAsset: NoteAsset = {
    id: 'note-duckdb-limits',
    type: 'note',
    title: 'DuckDB 生产环境内存配额调优',
    topic: 'optimization',
    summary: '显式设置 max_memory 避免受限容器 OOM',
    content: `# 核心配置\n\n> [!NOTE]\n> 容器环境下建议收紧为 70%\n\n\`\`\`sql\nSET max_memory = '2GB';\n\`\`\``,
    tags: ['DuckDB', '调优'],
    references: ['https://duckdb.org'],
    isFavorite: true,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  };

  const sampleMetricAsset: MetricAsset = {
    id: 'metric-net-gmv',
    type: 'metric',
    name: '净成交 GMV',
    owner: 'BI 团队',
    businessMeaning: '统计在统计周期内剔除退款后的成功支付净额。',
    calculationFormula: 'SUM(支付流水) - SUM(退款金额)',
    sqlExpression: 'SELECT sum(amount) FROM fact_pay;',
    sourceTables: ['fact_pay'],
    dimensions: ['stat_date'],
    tags: ['GMV', '电商'],
    isFavorite: false,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  };

  it('serializes CodeAsset to Markdown with Frontmatter and SQL block', () => {
    const md = serializeSnippetToMarkdown(sampleCodeAsset);
    expect(md).toContain('---');
    expect(md).toContain('id: "code-test-1"');
    expect(md).toContain('title: "用户复购周期分布统计"');
    expect(md).toContain('category: "template"');
    expect(md).toContain('tags:');
    expect(md).toContain('- "电商"');
    expect(md).toContain('params:');
    expect(md).toContain('name: "repurchase_table"');
    expect(md).toContain('```sql');
    expect(md).toContain('SELECT');
    expect(md).toContain('FROM {{repurchase_table}}');
    expect(md).toContain('```');
  });

  it('parses Markdown content back into identical CodeAsset', () => {
    const md = serializeSnippetToMarkdown(sampleCodeAsset);
    const parsed = parseMarkdownToSnippet(md);

    expect(parsed.id).toBe(sampleCodeAsset.id);
    expect(parsed.title).toBe(sampleCodeAsset.title);
    expect(parsed.category).toBe(sampleCodeAsset.category);
    expect(parsed.description).toBe(sampleCodeAsset.description);
    expect(parsed.isFavorite).toBe(true);
    expect(parsed.tags).toEqual(sampleCodeAsset.tags);
    expect(parsed.params?.length).toBe(1);
    expect(parsed.params?.[0].name).toBe('repurchase_table');
    expect(parsed.params?.[0].defaultValue).toBe('fact_user_repurchase');
    expect(parsed.sql.trim()).toBe(sampleCodeAsset.sql.trim());
  });

  it('gracefully parses bare SQL markdown without frontmatter', () => {
    const bareMd = `
# 简单的 SQL 查询
\`\`\`sql
SELECT current_date, version();
\`\`\`
    `;
    const parsed = parseMarkdownToSnippet(bareMd, 'bare-sql-id');
    expect(parsed.id).toBe('bare-sql-id');
    expect(parsed.sql).toBe('SELECT current_date, version();');
    expect(parsed.category).toBe('snippet');
  });

  it('serializes and parses NoteAsset correctly', () => {
    const md = serializeAssetToMarkdown(sampleNoteAsset);
    expect(md).toContain('type: "note"');
    expect(md).toContain('topic: "optimization"');
    expect(md).toContain('summary: "显式设置 max_memory 避免受限容器 OOM"');
    expect(md).toContain('# 核心配置');

    const parsed = parseMarkdownToAsset(md) as NoteAsset;
    expect(parsed.type).toBe('note');
    expect(parsed.id).toBe(sampleNoteAsset.id);
    expect(parsed.title).toBe(sampleNoteAsset.title);
    expect(parsed.topic).toBe('optimization');
    expect(parsed.summary).toBe(sampleNoteAsset.summary);
    expect(parsed.content).toContain('# 核心配置');
    expect(parsed.content).toContain('SET max_memory');
    expect(parsed.tags).toEqual(['DuckDB', '调优']);
    expect(parsed.references).toEqual(['https://duckdb.org']);
  });

  it('serializes and parses MetricAsset correctly', () => {
    const md = serializeAssetToMarkdown(sampleMetricAsset);
    expect(md).toContain('type: "metric"');
    expect(md).toContain('name: "净成交 GMV"');
    expect(md).toContain('owner: "BI 团队"');
    expect(md).toContain('## 业务定义与统计场景');
    expect(md).toContain('## 计算公式与度量逻辑');
    expect(md).toContain('```sql');

    const parsed = parseMarkdownToAsset(md) as MetricAsset;
    expect(parsed.type).toBe('metric');
    expect(parsed.id).toBe(sampleMetricAsset.id);
    expect(parsed.name).toBe('净成交 GMV');
    expect(parsed.owner).toBe('BI 团队');
    expect(parsed.businessMeaning).toContain('统计在统计周期内剔除退款后的成功支付净额');
    expect(parsed.calculationFormula).toBe('SUM(支付流水) - SUM(退款金额)');
    expect(parsed.sqlExpression).toBe('SELECT sum(amount) FROM fact_pay;');
    expect(parsed.sourceTables).toEqual(['fact_pay']);
    expect(parsed.dimensions).toEqual(['stat_date']);
  });

  it('correctly parses real docs directory Markdown tutorials into rich NoteAssets', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const docsDir = path.resolve(process.cwd(), 'docs');

    // 1. 验证 001 内嵌DuckDB教程_简单.md
    const doc001 = fs.readFileSync(path.join(docsDir, '001 内嵌DuckDB教程_简单.md'), 'utf-8');
    const asset001 = parseMarkdownToAsset(doc001, '001 内嵌DuckDB教程_简单.md') as NoteAsset;
    expect(asset001.type).toBe('note');
    expect(asset001.id).toBe('duckdb-sql-complete');
    expect(asset001.title).toBe('DuckDB SQL 完整使用教程');
    expect(asset001.content.length).toBeGreaterThan(10000);
    expect(asset001.tags).toContain('DuckDB');
    expect(asset001.summary).toBeTruthy();

    // 2. 验证 002 内嵌DuckDB教程_简单.md
    const doc002 = fs.readFileSync(path.join(docsDir, '002 内嵌DuckDB教程_简单.md'), 'utf-8');
    const asset002 = parseMarkdownToAsset(doc002, '002 内嵌DuckDB教程_简单.md') as NoteAsset;
    expect(asset002.type).toBe('note');
    expect(asset002.id).toBe('duckdb-sql-lesson-1');
    expect(asset002.title).toBe('Lesson 1 · DuckDB SQL 入门');
    expect(asset002.content).toContain('哲学知识图谱');

    // 3. 验证 003 DuckDB教程_自定义上传.md
    const doc003 = fs.readFileSync(path.join(docsDir, '003 DuckDB教程_自定义上传.md'), 'utf-8');
    const asset003 = parseMarkdownToAsset(doc003, '003 DuckDB教程_自定义上传.md') as NoteAsset;
    expect(asset003.type).toBe('note');
    expect(asset003.id).toBe('ontology-duckdb-complete');
    expect(asset003.title).toContain('Palantir Ontology');

    // 4. 验证 Quick_Tutorial.md
    const docQuick = fs.readFileSync(path.join(docsDir, 'Quick_Tutorial.md'), 'utf-8');
    const assetQuick = parseMarkdownToAsset(docQuick, 'Quick_Tutorial.md') as NoteAsset;
    expect(assetQuick.type).toBe('note');
    expect(assetQuick.id).toBe('sql-learning-path');
    expect(assetQuick.title).toBe('SQL 学习路径：基于领导建议的系统化方案');
  });

  it('correctly extracts SQL and DuckDB code blocks from markdown text', () => {
    const text = `
# Title
Here is some text.

\`\`\`sql
SELECT 1;
\`\`\`

More text...

\`\`\`duckdb
SELECT * FROM range(10);
\`\`\`

\`\`\`python
print("ignore python")
\`\`\`
`;
    const sqls = extractSqlBlocksFromMarkdown(text);
    expect(sqls.length).toBe(2);
    expect(sqls[0]).toBe('SELECT 1;');
    expect(sqls[1]).toBe('SELECT * FROM range(10);');
  });
});
