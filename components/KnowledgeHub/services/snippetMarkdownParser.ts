import { KnowledgeAsset, CodeAsset, MetricAsset, NoteAsset, CodeCategory, CodeParam, NoteTopic } from '../types';

/**
 * 将任意类型的 KnowledgeAsset (代码片段、业务口径、知识笔记) 序列化为规范的 Markdown 文本
 */
export function serializeAssetToMarkdown(asset: KnowledgeAsset): string {
  const yamlLines: string[] = ['---'];
  yamlLines.push(`id: "${escapeYamlString(asset.id)}"`);
  yamlLines.push(`type: "${asset.type}"`);
  yamlLines.push(`isFavorite: ${Boolean(asset.isFavorite)}`);
  yamlLines.push(`createdAt: "${asset.createdAt || new Date().toISOString()}"`);
  yamlLines.push(`updatedAt: "${asset.updatedAt || new Date().toISOString()}"`);

  if (asset.tags && asset.tags.length > 0) {
    yamlLines.push('tags:');
    asset.tags.forEach((tag: string) => {
      yamlLines.push(`  - "${escapeYamlString(tag)}"`);
    });
  }

  if (asset.type === 'code') {
    const code = asset as CodeAsset;
    yamlLines.push(`title: "${escapeYamlString(code.title)}"`);
    yamlLines.push(`category: "${code.category || 'snippet'}"`);
    yamlLines.push(`description: "${escapeYamlString(code.description || '')}"`);

    if (code.params && code.params.length > 0) {
      yamlLines.push('params:');
      code.params.forEach((param: CodeParam) => {
        yamlLines.push(`  - name: "${escapeYamlString(param.name)}"`);
        yamlLines.push(`    label: "${escapeYamlString(param.label || param.name)}"`);
        yamlLines.push(`    defaultValue: "${escapeYamlString(param.defaultValue || '')}"`);
        if (param.description) {
          yamlLines.push(`    description: "${escapeYamlString(param.description)}"`);
        }
      });
    }

    yamlLines.push('---');
    yamlLines.push('');
    yamlLines.push('```sql');
    yamlLines.push(code.sql.trim());
    yamlLines.push('```');
    yamlLines.push('');
    return yamlLines.join('\n');
  }

  if (asset.type === 'metric') {
    const metric = asset as MetricAsset;
    yamlLines.push(`name: "${escapeYamlString(metric.name)}"`);
    if (metric.owner) {
      yamlLines.push(`owner: "${escapeYamlString(metric.owner)}"`);
    }
    if (metric.sourceTables && metric.sourceTables.length > 0) {
      yamlLines.push('sourceTables:');
      metric.sourceTables.forEach((tbl) => {
        yamlLines.push(`  - "${escapeYamlString(tbl)}"`);
      });
    }
    if (metric.dimensions && metric.dimensions.length > 0) {
      yamlLines.push('dimensions:');
      metric.dimensions.forEach((dim) => {
        yamlLines.push(`  - "${escapeYamlString(dim)}"`);
      });
    }

    yamlLines.push('---');
    yamlLines.push('');
    yamlLines.push('## 业务定义与统计场景');
    yamlLines.push(metric.businessMeaning || '');
    yamlLines.push('');
    yamlLines.push('## 计算公式与度量逻辑');
    yamlLines.push(metric.calculationFormula || '');
    yamlLines.push('');
    yamlLines.push('## SQL 查询定义');
    yamlLines.push('```sql');
    yamlLines.push(metric.sqlExpression ? metric.sqlExpression.trim() : '');
    yamlLines.push('```');
    yamlLines.push('');
    return yamlLines.join('\n');
  }

  if (asset.type === 'note') {
    const note = asset as NoteAsset;
    yamlLines.push(`title: "${escapeYamlString(note.title)}"`);
    yamlLines.push(`topic: "${note.topic || 'pitfall'}"`);
    if (note.summary) {
      yamlLines.push(`summary: "${escapeYamlString(note.summary)}"`);
    }
    if (note.references && note.references.length > 0) {
      yamlLines.push('references:');
      note.references.forEach((ref) => {
        yamlLines.push(`  - "${escapeYamlString(ref)}"`);
      });
    }

    yamlLines.push('---');
    yamlLines.push('');
    yamlLines.push(note.content.trim());
    yamlLines.push('');
    return yamlLines.join('\n');
  }

  yamlLines.push('---');
  return yamlLines.join('\n');
}

/**
 * 兼容旧接口：将 CodeAsset 序列化为规范的 Markdown 文本
 */
export function serializeSnippetToMarkdown(asset: CodeAsset): string {
  return serializeAssetToMarkdown(asset);
}

// 已知 docs 目录核心讲义规范元数据映射表
const KNOWN_DOC_MANIFEST: Record<string, { id: string; category: string; difficulty: string }> = {
  '001 内嵌DuckDB教程_简单': { id: 'duckdb-sql-complete', category: '入门', difficulty: 'Beginner' },
  '002 内嵌DuckDB教程_简单': { id: 'duckdb-sql-lesson-1', category: '入门', difficulty: 'Beginner' },
  '003 DuckDB教程_自定义上传': { id: 'ontology-duckdb-complete', category: '本体建模', difficulty: 'Intermediate' },
  '004 DuckDB教程_自定义上传': { id: 'ontology-duckdb-runnable', category: '本体建模', difficulty: 'Intermediate' },
  'Quick_Tutorial': { id: 'sql-learning-path', category: '学习路径', difficulty: 'Beginner' },
};

function startsWithSqlKeywords(text: string): boolean {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('--') || l.startsWith('/*')) continue;
    return /^(?:SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|COPY|PRAGMA|EXPLAIN|DESCRIBE|ATTACH|DETACH|USE|ALTER)\b/i.test(l);
  }
  return false;
}

/**
 * 智能判定资产类型：
 * 1. 优先遵循 Frontmatter 声明；
 * 2. 若无 Frontmatter，通过全文大纲、代码段特征与篇幅结构精准推断。
 */
function detectAssetType(meta: Record<string, any>, bodyPart: string): 'code' | 'metric' | 'note' {
  if (meta.type === 'code' || meta.type === 'metric' || meta.type === 'note') {
    return meta.type;
  }
  if (meta.topic || meta.references) {
    return 'note';
  }
  if (meta.calculationFormula || meta.name || meta.businessMeaning) {
    return 'metric';
  }
  if (meta.params || meta.category === 'snippet' || meta.category === 'template' || meta.category === 'script') {
    return 'code';
  }

  const trimmed = bodyPart.trim();

  // A. 纯 SQL 或单个标题+单个代码块的纯片段
  const startsWithSql = startsWithSqlKeywords(trimmed);
  const isPureCodeBlock = /^```(?:sql)?\r?\n[\s\S]*?\r?\n```$/i.test(trimmed);
  const singleTitleAndSqlOnly = /^#\s+[^\r\n]+\r?\n+```(?:sql)?\r?\n[\s\S]*?\r?\n```\s*$/i.test(trimmed);

  if (startsWithSql || isPureCodeBlock || singleTitleAndSqlOnly) {
    return 'code';
  }

  // B. 指标口径文档
  if (/##\s*(?:业务定义|计算公式|度量逻辑)/.test(trimmed)) {
    return 'metric';
  }

  // C. 技术教程、长篇文档、含多级大纲或多段落文章 -> 归属于知识笔记 (Note)
  const headingCount = (trimmed.match(/^#{1,4}\s+.+$/gm) || []).length;
  const paragraphCount = trimmed.split(/\r?\n\r?\n/).filter((p) => p.trim().length > 0).length;
  if (headingCount >= 1 || paragraphCount >= 3 || trimmed.length > 250) {
    return 'note';
  }

  return 'code';
}

/**
 * 从 Markdown 正文中提取首个标题
 */
function extractMarkdownTitle(rawContent: string, fallback: string): string {
  const h1Match = rawContent.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].replace(/[*_`]/g, '').trim();
  }
  const h2Match = rawContent.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return h2Match[1].replace(/[*_`]/g, '').trim();
  }
  return fallback;
}

/**
 * 从 Markdown 正文中提取核心论述摘要
 */
function extractMarkdownSummary(content: string): string {
  const lines = content.split(/\r?\n/);
  const candidates: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('---') || trimmed.startsWith('|')) {
      continue;
    }
    // 优先捕获引用块
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>+\s*/, '').replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, '').trim();
      if (quoteText.length > 10) {
        return quoteText.length > 200 ? quoteText.slice(0, 197) + '...' : quoteText;
      }
    }
    // 过滤目录跳转链接
    if (/^\d+\.\s*\[.+\]\(#.+\)/.test(trimmed)) {
      continue;
    }
    if (trimmed.length > 15) {
      candidates.push(trimmed.replace(/[*_`]/g, ''));
      if (candidates.length >= 2) break;
    }
  }

  const combined = candidates.join(' ').trim();
  if (!combined) return 'DuckDB 知识库核心技术讲义与实践笔记';
  return combined.length > 200 ? combined.slice(0, 197) + '...' : combined;
}

/**
 * 自动推断智能标签
 */
function inferTags(content: string, filename: string, explicitTags?: string[]): string[] {
  if (explicitTags && explicitTags.length > 0) return explicitTags;

  const set = new Set<string>();
  const text = `${filename} ${content}`.toLowerCase();

  set.add('DuckDB');

  if (text.includes('sql')) set.add('SQL');
  if (text.includes('教程') || text.includes('tutorial') || text.includes('lesson')) set.add('教程');
  if (text.includes('ontology') || text.includes('本体')) set.add('本体建模');
  if (text.includes('palantir')) set.add('Palantir');
  if (text.includes('入门') || text.includes('beginner') || text.includes('简单')) set.add('入门教程');
  if (text.includes('进阶') || text.includes('高级') || text.includes('intermediate')) set.add('进阶实战');
  if (text.includes('调优') || text.includes('内存') || text.includes('oom') || text.includes('performance')) set.add('性能调优');
  if (text.includes('parquet')) set.add('Parquet');
  if (text.includes('pivot')) set.add('透视分析');
  if (text.includes('学习路径')) set.add('学习路径');

  return Array.from(set).slice(0, 5);
}

/**
 * 生成规范统一的资产 ID
 */
function generateAssetId(
  metaId: string | undefined, 
  defaultId: string | undefined, 
  detectedType: string, 
  filename?: string
): string {
  if (metaId && metaId.trim()) return metaId.trim();

  const rawKey = (defaultId || filename || '').replace(/\.md$/, '').trim();
  if (KNOWN_DOC_MANIFEST[rawKey]) {
    return KNOWN_DOC_MANIFEST[rawKey].id;
  }

  if (defaultId && defaultId.trim()) {
    return defaultId.trim();
  }

  if (rawKey) {
    const slug = rawKey
      .replace(/[\s\/\\?%*:|"<>]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) return `${detectedType}-${slug}`;
  }

  return `${detectedType}-${Date.now()}`;
}

/**
 * 将 Markdown 文本内容解析为任意 KnowledgeAsset (自动识别 type)
 */
export function parseMarkdownToAsset(rawContent: string, defaultId?: string): KnowledgeAsset {
  const trimmed = rawContent.trim();
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = trimmed.match(frontmatterRegex);

  let metaPart = '';
  let bodyPart = trimmed;

  if (match) {
    metaPart = match[1];
    bodyPart = match[2].trim();
  }

  const meta = parseSimpleYaml(metaPart);
  const detectedType = detectAssetType(meta, bodyPart);
  const now = new Date().toISOString();
  const id = generateAssetId(meta.id, defaultId, detectedType);
  const isFavorite = Boolean(meta.isFavorite);
  const createdAt = meta.createdAt || now;
  const updatedAt = meta.updatedAt || now;

  const rawKey = (defaultId || '').replace(/\.md$/, '').trim();
  const manifestMeta = KNOWN_DOC_MANIFEST[rawKey];
  const tags: string[] = inferTags(
    bodyPart, 
    defaultId || '', 
    Array.isArray(meta.tags) ? meta.tags : manifestMeta ? [manifestMeta.category, 'DuckDB', '教程'] : undefined
  );

  // 1. 解析知识笔记 (NoteAsset)
  if (detectedType === 'note') {
    const title = meta.title || extractMarkdownTitle(bodyPart, id.replace(/^note-/, ''));
    const topic: NoteTopic = (['pitfall', 'optimization', 'best_practice', 'faq'].includes(meta.topic)
      ? meta.topic
      : 'best_practice') as NoteTopic;
    const summary = meta.summary || extractMarkdownSummary(bodyPart);
    const references: string[] = Array.isArray(meta.references) ? meta.references : [];

    const noteAsset: NoteAsset = {
      id,
      type: 'note',
      title,
      topic,
      summary,
      content: bodyPart,
      tags,
      references,
      isFavorite,
      createdAt,
      updatedAt,
    };
    return noteAsset;
  }

  // 2. 解析业务指标口径 (MetricAsset)
  if (detectedType === 'metric') {
    const name = meta.name || meta.title || extractMarkdownTitle(bodyPart, id.replace(/^metric-/, ''));
    const owner = meta.owner || '';
    const sourceTables: string[] = Array.isArray(meta.sourceTables) ? meta.sourceTables : [];
    const dimensions: string[] = Array.isArray(meta.dimensions) ? meta.dimensions : [];

    // 从正文中解析各二级标题段落与 SQL 代码块
    let businessMeaning = meta.businessMeaning || '';
    let calculationFormula = meta.calculationFormula || '';
    let sqlExpression = '';

    const sqlCodeBlockRegex = /```sql\b[^\r\n]*\r?\n([\s\S]*?)\r?\n```/i;
    const codeMatch = bodyPart.match(sqlCodeBlockRegex);
    if (codeMatch) {
      sqlExpression = codeMatch[1].trim();
    }

    const meaningMatch = bodyPart.match(/## 业务定义与统计场景\r?\n([\s\S]*?)(?=\r?\n##|$)/i);
    if (meaningMatch) {
      businessMeaning = meaningMatch[1].trim();
    }

    const formulaMatch = bodyPart.match(/## 计算公式与度量逻辑\r?\n([\s\S]*?)(?=\r?\n##|$)/i);
    if (formulaMatch) {
      calculationFormula = formulaMatch[1].trim();
    }

    const metricAsset: MetricAsset = {
      id,
      type: 'metric',
      name,
      businessMeaning: businessMeaning || name,
      calculationFormula: calculationFormula || 'SUM(value)',
      sqlExpression,
      sourceTables,
      dimensions,
      owner,
      tags,
      isFavorite,
      createdAt,
      updatedAt,
    };
    return metricAsset;
  }

  // 3. 解析代码片段 (CodeAsset - 默认)
  let sql = bodyPart;
  // 严格限定 ```sql 防止误匹配 ```bash 等非 SQL 语言块
  const sqlCodeBlockRegex = /```sql\b[^\r\n]*\r?\n([\s\S]*?)\r?\n```/i;
  const codeMatch = bodyPart.match(sqlCodeBlockRegex);
  if (codeMatch) {
    sql = codeMatch[1].trim();
  } else if (bodyPart.startsWith('```')) {
    sql = bodyPart.replace(/^```[a-zA-Z]*\r?\n/, '').replace(/\r?\n```$/, '').trim();
  }

  const title = meta.title || extractMarkdownTitle(bodyPart, id.replace(/^code-/, ''));
  const category: CodeCategory = (['snippet', 'template', 'script'].includes(meta.category)
    ? meta.category
    : 'snippet') as CodeCategory;
  
  let description = meta.description || '';
  if (!description) {
    const textBeforeCode = bodyPart.split('```')[0].trim();
    if (textBeforeCode && !textBeforeCode.startsWith('#')) {
      description = textBeforeCode;
    } else {
      description = extractMarkdownSummary(bodyPart);
    }
  }

  const params: CodeParam[] = Array.isArray(meta.params) ? meta.params : [];

  const codeAsset: CodeAsset = {
    id,
    type: 'code',
    title,
    category,
    description: description || '自定义 SQL 片段',
    sql,
    params,
    tags,
    isFavorite,
    createdAt,
    updatedAt,
  };
  return codeAsset;
}

/**
 * 兼容旧接口：将 Markdown 文本解析为 CodeAsset
 */
export function parseMarkdownToSnippet(rawContent: string, defaultId?: string): CodeAsset {
  const asset = parseMarkdownToAsset(rawContent, defaultId);
  if (asset.type === 'code') {
    return asset as CodeAsset;
  }
  return {
    id: asset.id,
    type: 'code',
    title: (asset as any).title || (asset as any).name || asset.id,
    category: 'snippet',
    description: (asset as any).description || '',
    sql: (asset as any).sql || (asset as any).sqlExpression || '',
    tags: asset.tags || [],
    isFavorite: asset.isFavorite,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function escapeYamlString(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function parseSimpleYaml(yamlText: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!yamlText.trim()) return result;

  const lines = yamlText.split(/\r?\n/);
  let currentKey = '';
  let inTagsList = false;
  let inParamsList = false;
  let inSourceTablesList = false;
  let inDimensionsList = false;
  let inReferencesList = false;
  let currentParam: Partial<CodeParam> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 解析一级键值
    const topKeyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (topKeyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      currentKey = topKeyMatch[1];
      const valStr = topKeyMatch[2].trim();

      inTagsList = currentKey === 'tags';
      inParamsList = currentKey === 'params';
      inSourceTablesList = currentKey === 'sourceTables';
      inDimensionsList = currentKey === 'dimensions';
      inReferencesList = currentKey === 'references';

      if (inTagsList) {
        result.tags = [];
        continue;
      } else if (inParamsList) {
        result.params = [];
        continue;
      } else if (inSourceTablesList) {
        result.sourceTables = [];
        continue;
      } else if (inDimensionsList) {
        result.dimensions = [];
        continue;
      } else if (inReferencesList) {
        result.references = [];
        continue;
      } else {
        result[currentKey] = cleanYamlValue(valStr);
        continue;
      }
    }

    // 解析列表项
    if (inTagsList && trimmed.startsWith('-')) {
      const tagVal = cleanYamlValue(trimmed.slice(1).trim());
      if (tagVal) result.tags.push(tagVal);
      continue;
    }
    if (inSourceTablesList && trimmed.startsWith('-')) {
      const val = cleanYamlValue(trimmed.slice(1).trim());
      if (val) result.sourceTables.push(val);
      continue;
    }
    if (inDimensionsList && trimmed.startsWith('-')) {
      const val = cleanYamlValue(trimmed.slice(1).trim());
      if (val) result.dimensions.push(val);
      continue;
    }
    if (inReferencesList && trimmed.startsWith('-')) {
      const val = cleanYamlValue(trimmed.slice(1).trim());
      if (val) result.references.push(val);
      continue;
    }

    // 解析 params 列表项
    if (inParamsList) {
      if (trimmed.startsWith('-')) {
        currentParam = {};
        result.params.push(currentParam);
        const subLine = trimmed.slice(1).trim();
        const subMatch = subLine.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (subMatch && currentParam) {
          (currentParam as any)[subMatch[1]] = cleanYamlValue(subMatch[2].trim());
        }
        continue;
      } else if (currentParam && line.startsWith('   ')) {
        const subMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (subMatch) {
          (currentParam as any)[subMatch[1]] = cleanYamlValue(subMatch[2].trim());
        }
        continue;
      }
    }
  }

  return result;
}

function cleanYamlValue(val: string): any {
  if (!val) return '';
  if (val === 'true') return true;
  if (val === 'false') return false;
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return val;
}

/**
 * 从 Markdown 文本中提取所有可执行的 SQL / DuckDB 代码块
 */
export function extractSqlBlocksFromMarkdown(markdown: string): string[] {
  if (!markdown) return [];
  const regex = /```(?:sql|duckdb)\b([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1].trim();
    if (code) blocks.push(code);
  }
  return blocks;
}

