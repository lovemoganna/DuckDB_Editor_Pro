// Tutorial Metadata Registry
// 教程元数据注册中心 - 用于管理所有教程的元信息

// 教程文件映射 - 用于解析文档路径
export const tutorialFileMap: Record<string, string> = {
  'duckdb-basics': '/docs/001 内嵌DuckDB教程_简单.md',
  'philosophy-db': '/docs/002 内嵌DuckDB教程_简单.md',
};

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

// 教程元数据注册表
// 新增教程只需在此数组中添加配置，无需修改代码
export const tutorials: TutorialMetadata[] = [
  {
    id: 'duckdb-basics',
    title: 'DuckDB SQL 完整使用教程',
    description: '从环境准备到高级特性，系统掌握 DuckDB。包含数据库操作、增删改查、JOIN、视图、事务等核心知识。本教程专为小白用户设计，是入门 DuckDB 的首选课程。',
    category: '入门',
    difficulty: 'Beginner',
    tags: ['SQL', 'DuckDB', '数据库', 'CRUD', 'JOIN', '事务', '入门必学'],
    order: 1,
    docPath: tutorialFileMap['duckdb-basics'],
    estimatedTime: '2-3小时',
    sections: [
      { id: 'env', title: '环境准备', anchor: '1-环境准备' },
      { id: 'ddl', title: '数据库与表操作', anchor: '2-数据库与表操作' },
      { id: 'crud', title: '增删改查 (CRUD)', anchor: '3-增删改查-crud' },
      { id: 'join', title: '连接操作 (JOIN)', anchor: '4-连接操作-join' },
      { id: 'view', title: '视图 (VIEW)', anchor: '5-视图-view' },
      { id: 'transaction', title: '事务 (TRANSACTION)', anchor: '6-事务-transaction' },
      { id: 'advanced', title: '高级特性', anchor: '7-高级特性' },
    ],
    prerequisites: [],
    learningOutcomes: [
      '掌握 DuckDB 环境安装与配置',
      '熟练使用 SQL 进行数据库操作',
      '理解关系型数据库设计原则',
      '能够独立完成增删改查操作',
    ]
  },
  {
    id: 'philosophy-db',
    title: '哲学数据库入门',
    description: '通过哲学案例学习数据库设计，建立最小可运行宇宙，理解本体论概念。',
    category: '进阶',
    difficulty: 'Intermediate',
    tags: ['数据库设计', '哲学', 'DDL', '递归查询'],
    order: 2,
    docPath: tutorialFileMap['philosophy-db'],
    estimatedTime: '1-2小时',
    prerequisites: ['duckdb-basics'],
    learningOutcomes: [
      '理解实体、属性、关系的设计方法',
      '掌握多对多关系的建模技巧',
      '学会使用视图简化复杂查询',
    ]
  }
];

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

import { EMBEDDED_CONTENT } from './tutorialContent';

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
    userTutorialsCache = userTutorials.map(ut => ({
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
    }));
    
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
