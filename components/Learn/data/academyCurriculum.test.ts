import { describe, it, expect } from 'vitest';
import { 
  getBuiltinAcademyCourses, 
  getAllAcademyCourses, 
  getCoursesByDifficulty, 
  getCourseById,
  getRecommendedNextCourse
} from './academyCurriculum';

describe('academyCurriculum', () => {
  it('loads builtin courses covering Beginner, Intermediate, and Advanced tiers', () => {
    const courses = getBuiltinAcademyCourses();
    expect(courses.length).toBeGreaterThan(15);

    const beginners = getCoursesByDifficulty('Beginner', courses);
    const intermediates = getCoursesByDifficulty('Intermediate', courses);
    const advanceds = getCoursesByDifficulty('Advanced', courses);

    expect(beginners.length).toBeGreaterThan(0);
    expect(intermediates.length).toBeGreaterThan(0);
    expect(advanceds.length).toBeGreaterThan(0);

    // Verify all courses have required properties
    for (const c of courses) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.difficulty).toMatch(/^(Beginner|Intermediate|Advanced)$/);
      expect(c.categoryType).toBeTruthy();
      expect(c.initialSql).toBeTruthy();
    }
  });

  it('correctly maps and resolves by ID or refId', () => {
    const courses = getBuiltinAcademyCourses();
    const first = courses[0];
    const found = getCourseById(first.id, courses);
    expect(found).toBeDefined();
    expect(found?.id).toBe(first.id);

    // Check refId resolution for ontology lesson
    const ontologyCourse = courses.find(c => c.categoryType === 'lesson');
    if (ontologyCourse && ontologyCourse.refId) {
      const byRef = getCourseById(ontologyCourse.refId, courses);
      expect(byRef?.id).toBe(ontologyCourse.id);
    }
  });

  it('merges custom user tutorials into curriculum with custom badge and difficulty shelf', () => {
    const customTutorials = [
      {
        id: 'my-custom-doc-1',
        title: '用户自建 DuckDB 时序调优',
        difficulty: 'Advanced',
        description: '时序分析高阶调优指南',
        tags: ['性能', '时序'],
        userContent: '# 自定义内容\nSELECT 1;'
      }
    ];

    const merged = getAllAcademyCourses(customTutorials);
    const found = merged.find(c => c.id === 'custom_my-custom-doc-1');
    expect(found).toBeDefined();
    expect(found?.isCustom).toBe(true);
    expect(found?.difficulty).toBe('Advanced');
    expect(found?.categoryLabel).toBe('自建课程');
  });

  it('recommends next course sequentially', () => {
    const courses = getBuiltinAcademyCourses();
    const first = courses[0];
    const second = courses[1];
    const next = getRecommendedNextCourse(first.id, [first.id], courses);
    expect(next?.id).toBe(second.id);
  });
});
