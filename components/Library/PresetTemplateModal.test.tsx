import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresetTemplateModal } from './PresetTemplateModal';
import { PRESET_RULE_TEMPLATES } from '../../services/ontology/presetRuleTemplates';

describe('PresetTemplateModal', () => {
  afterEach(cleanup);

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PresetTemplateModal isOpen={false} onClose={vi.fn()} onSelectTemplate={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders preset templates and allows selecting a template', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <PresetTemplateModal isOpen={true} onClose={handleClose} onSelectTemplate={handleSelect} />,
    );

    expect(screen.getByText(/特征组合典型示例模板库/)).toBeTruthy();
    expect(PRESET_RULE_TEMPLATES.length).toBeGreaterThan(0);

    // Default template should be visible
    expect(screen.getAllByText('高风险交易识别').length).toBeGreaterThan(0);
    expect(screen.getByText(/载入此模板并编辑/)).toBeTruthy();


    fireEvent.click(screen.getByText(/载入此模板并编辑/));

    expect(handleSelect).toHaveBeenCalledWith(PRESET_RULE_TEMPLATES[0]);
    expect(handleClose).toHaveBeenCalled();
  });

  it('filters templates by category', () => {
    render(
      <PresetTemplateModal isOpen={true} onClose={vi.fn()} onSelectTemplate={vi.fn()} />,
    );

    const ecomBtn = screen.getByRole('button', { name: '电商' });
    fireEvent.click(ecomBtn);

    expect(screen.getByText('黑产刷单团伙预警')).toBeTruthy();
  });
});
