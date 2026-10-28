import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChartViewport } from './ChartViewport';
import { computeSliceLabels } from '../../services/analysis/chartDisplay';

it('keeps a tiny slice name, value and percentage available with interactive visibility', () => {
  const toggle = vi.fn();
  render(<ChartViewport type="pie" labels={['主要分类', '小占比类别完整中文和EnglishLabel']}
    series={1} sliceValues={[1000000, 2]} sliceLabels={computeSliceLabels([{ category: '主要分类', value: 1000000 }, { category: '小占比类别完整中文和EnglishLabel', value: 2 }], 'category', 'value', {}).sliceLabels} onToggleSlice={toggle}><canvas /></ChartViewport>);
  const slice = screen.getByRole('button', { name: /小占比类别完整中文和EnglishLabel · 2 · 0.0002%/ });
  expect(slice.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(slice);
  expect(toggle).toHaveBeenCalledWith(1);
  expect(slice.getAttribute('aria-pressed')).toBe('false');
});

it('respects a user-hidden legend', () => {
  render(<ChartViewport type="pie" labels={['A']} series={1} sliceValues={[1]} showLegend={false}><canvas /></ChartViewport>);
  expect(screen.queryByLabelText('分类数值')).toBeNull();
});
