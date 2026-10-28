import { describe, expect, it } from 'vitest';
import {
  anyOutsidePieLabels,
  cartesianValueLabelAlign,
  cartesianValueLabelAnchor,
  formatPieSliceLabelText,
  pieLayoutPadding,
  pieSliceCanFitInside,
  pieSliceLabelDisplay,
  resolvePieLabelPlacement,
  truncateLabel,
} from './chartStyleRules';
import { CHART_THEME } from './chartTheme';

describe('chartStyleRules', () => {
  it('resolves pie placement: hide / outside / inside by share', () => {
    expect(resolvePieLabelPlacement(2, 'auto')).toBe('outside');
    expect(resolvePieLabelPlacement(5, 'auto')).toBe('outside');
    expect(resolvePieLabelPlacement(CHART_THEME.pieLabelInsideMinPercent, 'auto')).toBe('inside');
    expect(resolvePieLabelPlacement(50, 'never')).toBe(false);
    expect(resolvePieLabelPlacement(1, 'always')).toBe('outside');
  });

  it('keeps pieSliceLabelDisplay compatible with auto/always/never', () => {
    expect(pieSliceLabelDisplay(2, 'auto')).toBe('auto');
    expect(pieSliceLabelDisplay(CHART_THEME.pieLabelMinPercent, 'auto')).toBe('auto');
    expect(pieSliceLabelDisplay(1, 'always')).toBe(true);
    expect(pieSliceLabelDisplay(50, 'never')).toBe(false);
  });

  it('formats inside labels as value, percent and outside as short text', () => {
    expect(
      formatPieSliceLabelText(
        { key: '华东', value: 83, percent: 20, label: '83, 20%' },
        '华东',
        '83',
        'inside',
      ),
    ).toBe('83, 20%');
    expect(
      formatPieSliceLabelText(
        { key: '华东', value: 10, percent: 5, label: '10, 5%' },
        '华东',
        '10',
        'outside',
      ),
    ).toBe('10\n5%');
    expect(
      formatPieSliceLabelText(
        { key: '西南大区很长名字', value: 80, percent: 40, label: '80, 40%' },
        '西南大区很长名字',
        '80',
        'outside',
      ),
    ).toMatch(/40%/);
    expect(truncateLabel('abcdefghijk', 8)).toBe('abcdefg…');
  });

  it('detects whether any outside labels are needed for padding', () => {
    expect(
      anyOutsidePieLabels(
        [{ percent: 40 }, { percent: 5 }, { percent: 2 }],
        'auto',
      ),
    ).toBe(true);
    expect(anyOutsidePieLabels([{ percent: 40 }, { percent: 30 }], 'auto')).toBe(false);
  });

  it('estimates sector capacity for inside labels', () => {
    expect(pieSliceCanFitInside(5, 80, 40, 40, 12)).toBe(false);
    expect(pieSliceCanFitInside(30, 100, 50, 30, 12)).toBe(true);
  });

  it('reserves outside padding for pie labels', () => {
    expect(pieLayoutPadding(true, true).left).toBeGreaterThanOrEqual(18);
    expect(pieLayoutPadding(false, false).bottom).toBeGreaterThanOrEqual(8);
  });

  it('places short bar labels outside and tall ones inside', () => {
    expect(cartesianValueLabelAnchor(5, 100)).toBe('end');
    expect(cartesianValueLabelAnchor(50, 100)).toBe('center');
    expect(cartesianValueLabelAlign(5, 100, false)).toBe('end');
    expect(cartesianValueLabelAlign(50, 100, false)).toBe('center');
  });
});
