// Tutorial Metadata Registry
// 教程元数据注册中心 - 用于管理所有教程的元信息

export interface TutorialSection {
  id: string;
  title: string;
  anchor: string;
}

export interface TutorialMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  tags: string[];
  order: number;
  docPath: string;           // 指向 docs/*.md 的路径
  sections?: TutorialSection[]; // 章节结构（可选，用于目录导航）
  estimatedTime?: string;    // 预计学习时长
  prerequisites?: string[];  // 前置教程 ID 列表
  learningOutcomes?: string[]; // 学习成果/目标
  isUserTutorial?: boolean;  // 是否为用户上传的教程
  userContent?: string;     // 用户教程的 Markdown 内容
}

// 从 Markdown 内容中自动提取章节
const extractSectionsFromContent = (content: string): TutorialSection[] => {
  const sections: TutorialSection[] = [];
  // 匹配 Markdown 标题 (# ## ### 等)
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // # = 1, ## = 2, ### = 3
    const title = match[2].trim();
    // 生成 anchor ID
    const id = title.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // 只提取二级和三级标题作为章节
    if (level >= 2 && level <= 3) {
      sections.push({ id, title, anchor: id });
    }
  }

  return sections;
};

// ============================================
// 1. 动态加载所有内嵌教程 (Vite Glob Import)
// ============================================
const mdFiles = import.meta.glob('../docs/*.md', { as: 'raw', eager: true });

export const EMBEDDED_CONTENT: Record<string, string> = {};

// YAML frontmatter 解析
function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {} as Record<string, any>, content };
  }

  const yamlStr = match[1];
  const body = match[2];

  const metadata: Record<string, any> = {};
  yamlStr.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      metadata[key] = value;
    }
  });

  return { metadata, content: body };
}

// 从文件内容提取标题
function extractTitle(content: string, filename: string) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1];
  return filename;
}

// 从文件内容提取描述
function extractDescription(content: string) {
  const lines = content.split('\n');
  let started = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('---')) {
      if (started) break;
      started = true;
      continue;
    }
    if (line.startsWith('## ')) break;
    if (line.trim() && !line.startsWith('\`\`\`')) {
      descLines.push(line.trim());
      if (descLines.length >= 2) break;
    }
  }

  const desc = descLines.join(' ').trim();
  return desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
}

// 自动生成内置教程列表
const builtinTutorials: TutorialMetadata[] = [];
let fileIndex = 0;

for (const [path, contentRaw] of Object.entries(mdFiles)) {
  const filename = path.split('/').pop()?.replace('.md', '') || 'unknown';
  const content = contentRaw as string;
  const { metadata, content: body } = parseFrontmatter(content);

  // 生成唯一 ID：优先使用 metadata.id，否则使用文件名（保留数字前缀以确保唯一性）
  const id = metadata.id || filename.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');

  // 提取章节
  const sections = extractSectionsFromContent(body);

  const tutorial: TutorialMetadata = {
    id,
    title: metadata.title || extractTitle(content, filename),
    description: metadata.description || extractDescription(content),
    category: metadata.category || (fileIndex === 0 ? '入门' : '进阶'),
    difficulty: metadata.difficulty || (fileIndex === 0 ? 'Beginner' : 'Intermediate'),
    tags: metadata.tags ? metadata.tags.split(',').map((t: string) => t.trim()) : ['DuckDB'],
    order: parseInt(metadata.order) || (fileIndex + 1),
    docPath: `/docs/${filename}.md`, // Keep as reference, but content is now in EMBEDDED_CONTENT
    estimatedTime: metadata.estimatedTime || '1-2小时',
    sections: sections.length > 0 ? sections : undefined,
    prerequisites: metadata.prerequisites ? metadata.prerequisites.split(',').map((t: string) => t.trim()) : [],
    learningOutcomes: metadata.learningOutcomes ? metadata.learningOutcomes.split('|').map((t: string) => t.trim()) : [],
  };

  builtinTutorials.push(tutorial);
  EMBEDDED_CONTENT[id] = body;
  fileIndex++;
}

// 按照 order 排序
builtinTutorials.sort((a, b) => a.order - b.order);

export const tutorials: TutorialMetadata[] = builtinTutorials;

// 分类映射
export const categoryMap: Record<string, TutorialMetadata[]> = tutorials.reduce((acc, t) => {
  if (!acc[t.category]) acc[t.category] = [];
  acc[t.category].push(t);
  return acc;
}, {} as Record<string, TutorialMetadata[]>);

// 按难度分组
export const difficultyGroups = {
  Beginner: tutorials.filter(t => t.difficulty === 'Beginner'),
  Intermediate: tutorials.filter(t => t.difficulty === 'Intermediate'),
  Advanced: tutorials.filter(t => t.difficulty === 'Advanced'),
  Expert: tutorials.filter(t => t.difficulty === 'Expert'),
};

export interface SearchResult extends TutorialMetadata {
  matchingExcerpt?: string;
  matchType: 'title' | 'description' | 'tag' | 'content';
}

// 搜索教程
export const searchTutorials = (query: string): SearchResult[] => {
  const lower = query.toLowerCase();

  if (!lower.trim()) return [];

  const results: SearchResult[] = [];

  tutorials.forEach(t => {
    // 1. Check metadata first (higher priority)
    if (t.title.toLowerCase().includes(lower)) {
      results.push({ ...t, matchType: 'title' });
      return;
    }
    if (t.description.toLowerCase().includes(lower)) {
      results.push({ ...t, matchType: 'description' });
      return;
    }
    if (t.tags.some(tag => tag.toLowerCase().includes(lower))) {
      results.push({ ...t, matchType: 'tag' });
      return;
    }

    // 2. Check full content
    const content = EMBEDDED_CONTENT[t.id];
    if (content) {
      const contentLower = content.toLowerCase();
      const index = contentLower.indexOf(lower);
      if (index !== -1) {
        // Extract snippet
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + query.length + 60);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        results.push({ ...t, matchingExcerpt: snippet, matchType: 'content' });
      }
    }
  });

  return results;
};

// 获取教程 by ID
export const getTutorialById = (id: string): TutorialMetadata | undefined => {
  return tutorials.find(t => t.id === id);
};

// 获取推荐的下一教程
export const getNextTutorial = (currentId: string): TutorialMetadata | undefined => {
  const current = tutorials.find(t => t.id === currentId);
  if (!current) return tutorials[0];

  const sameCategory = tutorials.filter(t => t.category === current.category && t.order > current.order);
  if (sameCategory.length > 0) return sameCategory[0];

  return tutorials.find(t => t.order > current.order) || tutorials[0];
};

// 获取推荐的入门教程（最适合初学者的第一课）
export const getRecommendedFirstTutorial = (): TutorialMetadata => {
  // 优先返回标记为"入门必学"的初级教程
  const beginnerTutorial = tutorials.find(t =>
    t.difficulty === 'Beginner' && t.tags.includes('入门必学')
  );
  if (beginnerTutorial) return beginnerTutorial;

  // 否则返回第一个初级教程
  return tutorials.find(t => t.difficulty === 'Beginner') || tutorials[0];
};

// 检查前置条件是否满足
export const arePrerequisitesMet = (tutorialId: string, completedTutorials: string[]): boolean => {
  const tutorial = getTutorialById(tutorialId);
  if (!tutorial || !tutorial.prerequisites || tutorial.prerequisites.length === 0) {
    return true;
  }
  return tutorial.prerequisites.every(prereq => completedTutorials.includes(prereq));
};

// 获取学习路径（拓扑排序）
export const getLearningPath = (completedTutorials: string[] = []): TutorialMetadata[] => {
  const path: TutorialMetadata[] = [];
  const visited = new Set<string>();

  const addToPath = (tutorial: TutorialMetadata) => {
    if (visited.has(tutorial.id)) return;
    visited.add(tutorial.id);

    // 先添加前置教程
    if (tutorial.prerequisites) {
      tutorial.prerequisites.forEach(prereqId => {
        const prereq = getTutorialById(prereqId);
        if (prereq) addToPath(prereq);
      });
    }

    // 再添加当前教程
    path.push(tutorial);
  };

  // 按难度和顺序添加所有教程
  const sortedTutorials = [...tutorials].sort((a, b) => {
    // 初级优先
    if (a.difficulty === 'Beginner' && b.difficulty !== 'Beginner') return -1;
    if (b.difficulty === 'Beginner' && a.difficulty !== 'Beginner') return 1;
    return a.order - b.order;
  });

  sortedTutorials.forEach(t => addToPath(t));

  return path;
};

// 获取入门级教程列表
export const getBeginnerTutorials = (): TutorialMetadata[] => {
  return tutorials.filter(t => t.difficulty === 'Beginner');
};

// 获取进阶教程列表（需要先完成入门）
export const getAdvancedTutorials = (completedTutorials: string[] = []): TutorialMetadata[] => {
  return tutorials.filter(t => {
    if (t.difficulty !== 'Intermediate' && t.difficulty !== 'Advanced') return false;
    return arePrerequisitesMet(t.id, completedTutorials);
  });
};

// 获取所有教程标签
export const getAllTags = (): string[] => {
  const tagSet = new Set<string>();
  tutorials.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
};

// ============================================
// 用户教程相关功能
// ============================================
import { UserTutorial, getAllUserTutorials, getUserTutorialById as getUserTutById } from '../services/userTutorialStorage';

// 缓存用户教程
let userTutorialsCache: TutorialMetadata[] = [];

// 加载所有教程（包括内置 + 用户上传）
export const loadAllTutorials = async (): Promise<TutorialMetadata[]> => {
  try {
    const userTutorials = await getAllUserTutorials();

    // 将用户教程转换为 TutorialMetadata 格式
    userTutorialsCache = userTutorials.map(ut => {
      // 自动从内容中提取章节
      const sections = extractSectionsFromContent(ut.content);

      return {
        id: ut.id,
        title: ut.title,
        description: ut.content.slice(0, 100) + (ut.content.length > 100 ? '...' : ''),
        category: ut.category,
        difficulty: ut.difficulty,
        tags: ut.tags,
        order: 999, // 用户教程排在后面
        docPath: '', // 用户教程不使用文件路径
        isUserTutorial: true,
        userContent: ut.content,
        sections: sections.length > 0 ? sections : undefined, // 只有在有章节时才添加
      };
    });

    return [...tutorials, ...userTutorialsCache];
  } catch (error) {
    console.error('Failed to load user tutorials:', error);
    return tutorials;
  }
};

// 获取用户教程内容
export const getUserTutorialContent = async (id: string): Promise<string | null> => {
  try {
    const userTut = await getUserTutById(id);
    return userTut?.content || null;
  } catch (error) {
    console.error('Failed to get user tutorial content:', error);
    return null;
  }
};

// 刷新用户教程缓存
export const refreshUserTutorials = async (): Promise<TutorialMetadata[]> => {
  return loadAllTutorials();
};
