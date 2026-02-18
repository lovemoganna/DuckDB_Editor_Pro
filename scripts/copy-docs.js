/**
 * 文档自动发现与索引脚本
 * 将 docs/ 目录下的教程文件自动复制到 public/docs/ 并生成索引
 * 支持 YAML frontmatter 元数据解析
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'docs');
const destDir = path.join(__dirname, '..', 'public', 'docs');

// 确保目标目录存在
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// YAML frontmatter 解析
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, content };
  }

  const yamlStr = match[1];
  const body = match[2];

  // 简单解析 YAML (仅支持基本键值对)
  const metadata = {};
  yamlStr.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();
      // 去掉引号
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      metadata[key] = value;
    }
  });

  return { metadata, content: body };
}

// 从文件名生成 ID
function generateId(filename) {
  const basename = path.basename(filename, '.md');
  // 去掉前缀数字和空格
  return basename
    .replace(/^\d+\s*/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// 从文件内容提取标题
function extractTitle(content, filename) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1];
  return path.basename(filename, '.md');
}

// 从文件内容提取章节
function extractSections(content) {
  const sections = [];
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    if (level >= 2) { // 只处理 ## 及以下标题
      const title = match[2];
      const anchor = title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '');
      sections.push({
        id: anchor,
        title,
        anchor
      });
    }
  }

  return sections;
}

// 从文件内容提取描述
function extractDescription(content) {
  // 跳过 frontmatter 和第一个 # 标题
  const lines = content.split('\n');
  let started = false;
  const descLines = [];

  for (const line of lines) {
    if (line.startsWith('# ')) continue; // 跳过主标题
    if (line.startsWith('---')) {
      if (started) break;
      started = true;
      continue;
    }
    if (line.startsWith('## ')) {
      // 找到第一个二级标题，提取其后面的一些内容作为描述
      break;
    }
    if (line.trim() && !line.startsWith('```')) {
      descLines.push(line.trim());
      if (descLines.length >= 2) break;
    }
  }

  return descLines.join(' ').slice(0, 200);
}

// 扫描 docs 目录
console.log('🔍 扫描文档目录...');

// Check if srcDir exists
if (!fs.existsSync(srcDir)) {
  console.log(`⚠️  Warning: Documentation source directory not found at ${srcDir}`);
  // Create empty index to prevent build failure
  fs.writeFileSync(
    path.join(destDir, 'index.json'),
    JSON.stringify({ version: '1.0', generatedAt: new Date().toISOString(), count: 0, tutorials: [] }, null, 2)
  );
  console.log(`   - Populated empty index.json`);
} else {
  const files = fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  console.log(`   找到 ${files.length} 个 markdown 文件`);

  const tutorials = [];

  files.forEach((file, index) => {
    const srcPath = path.join(srcDir, file);
    const content = fs.readFileSync(srcPath, 'utf-8');
    const { metadata, content: body } = parseFrontmatter(content);

    // 生成教程对象
    const tutorial = {
      id: metadata.id || generateId(file),
      title: metadata.title || extractTitle(content, file),
      description: metadata.description || extractDescription(content),
      category: metadata.category || (index === 0 ? '入门' : '进阶'),
      difficulty: metadata.difficulty || (index === 0 ? 'Beginner' : 'Intermediate'),
      tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : ['DuckDB'],
      order: index + 1,
      docPath: `/docs/${file}`,
      estimatedTime: metadata.estimatedTime || '1-2小时',
      sections: extractSections(body),
      prerequisites: metadata.prerequisites ? metadata.prerequisites.split(',').map(t => t.trim()) : [],
      learningOutcomes: metadata.learningOutcomes ? metadata.learningOutcomes.split('|').map(t => t.trim()) : [],
    };

    tutorials.push(tutorial);

    // 复制文件到 public/docs
    const destPath = path.join(destDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`   ✓ 已处理: ${file}`);
  });

  // 生成教程注册表 (Optional: Generate TS file if needed, but for now just JSON index)
  /*
  const registryContent = ...
  */

  // 保存索引文件
  const indexContent = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    count: tutorials.length,
    tutorials: tutorials.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category,
      difficulty: t.difficulty,
      docPath: t.docPath,
    }))
  };

  fs.writeFileSync(
    path.join(destDir, 'index.json'),
    JSON.stringify(indexContent, null, 2)
  );

  console.log('\n✅ 文档处理完成！');
  console.log(`   - 处理了 ${tutorials.length} 个教程`);
  console.log(`   - 索引已保存到 public/docs/index.json`);
}
