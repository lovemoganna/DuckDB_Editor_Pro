import { KnowledgeAsset } from '../types';
import { parseMarkdownToAsset } from '../services/snippetMarkdownParser';

import tutorial001 from '../../../docs/001 内嵌DuckDB教程_简单.md?raw';
import tutorial002 from '../../../docs/002 内嵌DuckDB教程_简单.md?raw';
import tutorial005 from '../../../docs/005 DuckDB电商供应链本体建模_L2.md?raw';
import tutorial003 from '../../../docs/003 DuckDB教程_自定义上传.md?raw';
import tutorial004 from '../../../docs/004 DuckDB教程_自定义上传.md?raw';

export const SEED_KNOWLEDGE_ASSETS: KnowledgeAsset[] = [
  parseMarkdownToAsset(tutorial001, '001 内嵌DuckDB教程_简单.md'),
  parseMarkdownToAsset(tutorial002, '002 内嵌DuckDB教程_简单.md'),
  parseMarkdownToAsset(tutorial005, '005 DuckDB电商供应链本体建模_L2.md'),
  parseMarkdownToAsset(tutorial003, '003 DuckDB教程_自定义上传.md'),
  parseMarkdownToAsset(tutorial004, '004 DuckDB教程_自定义上传.md'),
];
