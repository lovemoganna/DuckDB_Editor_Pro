import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import lesson0006 from '../../data/ontology/seed-lesson-0006.json';
import { OntologySimulationLab } from './OntologySimulationLab';

afterEach(cleanup);

describe('OntologySimulationLab', () => {
  it('keeps tutorial presets inside the existing 14-lesson course', () => {
    const view = render(
      <OntologySimulationLab
        activeTemplateId="lesson-0006"
        ontologyState={lesson0006}
        onClose={() => undefined}
      />,
    );

    const sourceSelector = view.getByLabelText('推演材料来源') as HTMLSelectElement;
    const optionLabels = Array.from(sourceSelector.options).map(option => option.textContent);

    expect(optionLabels).toHaveLength(15);
    expect(optionLabels[0]).toBe('当前本体');
    expect(optionLabels).toContain('第 14 课：让模型结论回到证据');
    expect(optionLabels).not.toContain('电商运营图谱');
    expect(view.queryByText('置信度')).toBeNull();
    expect(view.queryByText(/推荐/)).toBeNull();
  });

  it('adds, copies and removes scenarios for side-by-side comparison without leaving the lab', () => {
    const view = render(
      <OntologySimulationLab
        activeTemplateId="lesson-0006"
        ontologyState={lesson0006}
        onClose={() => undefined}
      />,
    );

    expect(view.getAllByTestId('simulation-scenario-card')).toHaveLength(1);

    fireEvent.click(view.getByRole('button', { name: '添加对比场景' }));
    expect(view.getAllByTestId('simulation-scenario-card')).toHaveLength(2);
    expect(view.getByText('2 个场景并排比较')).toBeTruthy();

    fireEvent.click(view.getAllByRole('button', { name: '复制场景' })[0]);
    expect(view.getAllByTestId('simulation-scenario-card')).toHaveLength(3);
    expect((view.getByRole('button', { name: '添加对比场景' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(view.getAllByRole('button', { name: '删除场景' })[1]);
    expect(view.getAllByTestId('simulation-scenario-card')).toHaveLength(2);
  });

  it('distinguishes rule incompatibility from evidence conflict', () => {
    const view = render(
      <OntologySimulationLab
        activeTemplateId="lesson-0006"
        ontologyState={lesson0006}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(view.getByLabelText('推演材料来源'), {
      target: { value: 'lesson-0013' },
    });

    expect(view.getByText('规则互斥 0 · 证据冲突 1')).toBeTruthy();
    expect(view.queryByText(/规则冲突 \d/)).toBeNull();
  });
});
