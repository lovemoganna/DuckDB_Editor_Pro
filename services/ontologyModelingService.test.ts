import { describe, it, expect } from 'vitest';
import { ontologyModelingService } from './ontologyModelingService';

describe('ontologyModelingService - Workbench Engine', () => {
  it('generates rich four-element model (Object, Property, Link, Action) with rationale from concept', async () => {
    const result = await ontologyModelingService.modelFromConcept('电商订单履约配送');

    expect(result.objectTypes.length).toBeGreaterThan(0);
    expect(result.objects.length).toBeGreaterThan(0);
    expect(result.linkTypes.length).toBeGreaterThan(0);
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.rationale).toBeDefined();
    expect(result.rationale.length).toBeGreaterThan(10);
    expect(result.healthScore).toBeGreaterThanOrEqual(60);

    // Verify properties exist on objects
    const hasProps = result.objects.some(o => o.properties && Object.keys(o.properties).length > 0);
    expect(hasProps).toBe(true);

    // Verify actions have target object
    const validAction = result.actions[0];
    expect(validAction.name).toBeDefined();
    expect(validAction.objectName).toBeDefined();
  });

  it('correctly validates model and catches orphans, duplicates and vague links', () => {
    const badModel = {
      objectTypes: [{ name: 'Order', description: '订单' }],
      objects: [
        { name: 'Order-01', objectType: 'Order', properties: { status: 'paid' } },
        { name: 'Order-01', objectType: 'Order', properties: { status: 'paid' } }, // Duplicate!
        { name: '孤立节点', objectType: 'Order', properties: {} }, // Orphan and empty properties!
      ],
      linkTypes: [{ name: '关联', description: '', fromType: 'Order', toType: 'Order' }],
      links: [
        { from: 'Order-01', to: 'Order-01', linkType: '关联', weight: 0.5 }, // Loop and vague!
      ],
      actions: [],
    };

    const { issues, score } = ontologyModelingService.validateModel(badModel);
    expect(issues.some(i => i.category === 'duplicate')).toBe(true);
    expect(issues.some(i => i.category === 'orphan')).toBe(true);
    expect(issues.some(i => i.category === 'meaningless_link')).toBe(true);
    expect(issues.some(i => i.category === 'hierarchy')).toBe(true);
    expect(score).toBeLessThan(100);
  });

  it('autoFixes orphan nodes and duplicate objects', async () => {
    const draft = await ontologyModelingService.modelFromConcept('医疗挂号问诊');
    // Inject duplicate and orphan
    draft.objects.push({ name: draft.objects[0].name, objectType: draft.objects[0].objectType, properties: {} });
    draft.objects.push({ name: '孤立就诊人', objectType: 'Patient', properties: {} });

    const fixed = ontologyModelingService.autoFixIssues(draft);
    const orphanIssue = fixed.validationIssues.find(i => i.target === '孤立就诊人' && i.category === 'orphan');
    expect(orphanIssue).toBeUndefined(); // Should be connected or fixed
  });

  it('supports incremental refinement based on user instruction', async () => {
    const initial = await ontologyModelingService.modelFromConcept('电商订单系统');
    const initialActionCount = initial.actions.length;

    const refined = await ontologyModelingService.refineModel(initial, '为订单添加取消并退款动作');
    expect(refined.actions.length).toBeGreaterThanOrEqual(initialActionCount);
    expect(refined.actions.some(a => a.name.includes('Cancel') || a.name.includes('Refund') || a.description.includes('退款'))).toBe(true);
  });
});
