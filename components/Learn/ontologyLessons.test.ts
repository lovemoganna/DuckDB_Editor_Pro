import { describe, expect, it } from 'vitest';
import { 
  getSeedDataForLesson, 
  ONTOLOGY_LESSONS_DATA, 
  ONTOLOGY_STAGES, 
  ONTOLOGY_STAGE_LABELS 
} from '../../hooks/useOntologyLessons';

describe('Ontology Lessons Seed Data & Architecture', () => {
  it('contains exactly 14 lessons across 4 stages', () => {
    expect(ONTOLOGY_LESSONS_DATA).toHaveLength(14);
    
    const stageIds = ONTOLOGY_STAGES.map(s => s.id);
    expect(stageIds).toEqual(['recognition', 'topology', 'assembly', 'evolution']);
    
    // Each lesson has required fields
    ONTOLOGY_LESSONS_DATA.forEach(lesson => {
      expect(lesson.id).toMatch(/^ontology-lesson-\d{4}$/);
      expect(lesson.number).toBeGreaterThanOrEqual(1);
      expect(lesson.number).toBeLessThanOrEqual(14);
      expect(lesson.title).toBeTruthy();
      expect(lesson.coreConcept).toBeTruthy();
      expect(lesson.caseBackground).toBeTruthy();
      expect(stageIds).toContain(lesson.stage);
      expect(lesson.sections.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('loads synchronous seed data for all 14 lessons without null', () => {
    for (let i = 1; i <= 14; i++) {
      const data = getSeedDataForLesson(i);
      expect(data).not.toBeNull();
      expect(data?._meta).toBeDefined();
      expect(data?._meta.name).toBeTruthy();
      expect(Array.isArray(data?.objectTypes)).toBe(true);
      expect(Array.isArray(data?.objects)).toBe(true);
      expect(Array.isArray(data?.linkTypes)).toBe(true);
      expect(Array.isArray(data?.links)).toBe(true);
      expect(Array.isArray(data?.actions)).toBe(true);
      expect(Array.isArray(data?.introspections)).toBe(true);
      expect(Array.isArray(data?.insights)).toBe(true);
      expect(data!.objects.length).toBeGreaterThan(0);
      expect(data!.objectTypes.length).toBeGreaterThan(0);
    }
  });

  it('loads seed data by string lesson ID', () => {
    const dataLesson1 = getSeedDataForLesson('ontology-lesson-0001');
    expect(dataLesson1).not.toBeNull();
    expect(dataLesson1?._meta.name).toContain('只写材料真正告诉你的事');

    const dataLesson14 = getSeedDataForLesson('ontology-lesson-0014');
    expect(dataLesson14).not.toBeNull();
    expect(dataLesson14?._meta.name).toContain('让模型结论回到证据');
  });

  it('has human-readable stage labels for all 4 stages', () => {
    expect(ONTOLOGY_STAGE_LABELS.recognition).toBe('阶段一：识别与边界');
    expect(ONTOLOGY_STAGE_LABELS.topology).toBe('阶段二：拓扑与变迁');
    expect(ONTOLOGY_STAGE_LABELS.assembly).toBe('阶段三：组装与验证');
    expect(ONTOLOGY_STAGE_LABELS.evolution).toBe('阶段四：演进与证据');
  });

  it('contains comprehensive 5-step interactive curriculum for all 14 lessons with complete pedagogical scaffold', async () => {
    const { LESSON_STEP_FLOWS } = await import('../../data/ontologyCurriculum');
    for (let i = 1; i <= 14; i++) {
      const flow = LESSON_STEP_FLOWS[i];
      expect(flow).toBeDefined();
      expect(flow.lessonNumber).toBe(i);

      // New Scaffold fields
      expect(flow.stageGoal).toBeTruthy();
      expect(flow.whyThisOrder).toBeTruthy();
      expect(flow.coreMethod).toBeTruthy();
      expect(flow.caseConnection).toBeTruthy();
      expect(flow.modelingDecision).toBeDefined();
      expect(flow.modelingDecision.objectVsProperty).toBeTruthy();
      expect(flow.modelingDecision.linkCondition).toBeTruthy();
      expect(flow.modelingDecision.actionTrigger).toBeTruthy();
      expect(Array.isArray(flow.verificationChecklist)).toBe(true);
      expect(flow.verificationChecklist.length).toBeGreaterThanOrEqual(3);

      // Step 1: Story
      expect(flow.story.scenario).toBeTruthy();
      expect(flow.story.quote).toBeTruthy();
      expect(flow.story.dilemma).toBeTruthy();
      // Step 2: Trap vs Aha
      expect(flow.trapVsAha.trap.title).toContain('❌');
      expect(flow.trapVsAha.trap.danger).toBeTruthy();
      expect(flow.trapVsAha.aha.title).toContain('💡');
      expect(flow.trapVsAha.aha.rule).toBeTruthy();
      // Step 3: Model
      expect(flow.model.keyEntities.length).toBeGreaterThanOrEqual(2);
      expect(flow.model.goldenRule).toBeTruthy();
      // Step 4: Lab
      expect(flow.lab.actionLabel).toBeTruthy();
      expect(flow.lab.simulationResult.stats.length).toBeGreaterThan(0);
      expect(flow.lab.duckdbSql).toContain('SELECT');
      // Step 5: Challenge
      expect(flow.challenge.question).toBeTruthy();
      expect(flow.challenge.options.length).toBeGreaterThanOrEqual(2);
      expect(flow.challenge.correctIndex).toBeGreaterThanOrEqual(0);
      expect(flow.challenge.correctIndex).toBeLessThan(flow.challenge.options.length);
      expect(flow.challenge.explanation).toBeTruthy();
      expect(flow.challenge.takeaway).toBeTruthy();
    }
  });
});

