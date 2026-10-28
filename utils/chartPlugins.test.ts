import { describe, expect, it, vi } from 'vitest';
import { doughnutCenterPlugin, pieLabelPlugin } from './chartPlugins';

describe('pieLabelPlugin', () => {
  it.each(['pie', 'doughnut'])('%s outside labels and leaders avoid the reserved title area', type => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 6 }),
      beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
    };
    const chart = {
      config: { type }, width: 264, height: 240, ctx,
      chartArea: { left: 20, right: 244, top: 60, bottom: 220 },
      data: { labels: ['ach'], datasets: [{ data: [2270] }] },
      getDataVisibility: () => true,
      getDatasetMeta: () => ({
        data: [{
          x: 132, y: 130, startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + 0.14,
          innerRadius: type === 'pie' ? 0 : 30, outerRadius: 60,
        }],
      }),
    };
    pieLabelPlugin.afterDatasetsDraw?.(
      chart as any, {} as any,
      { slices: [{ key: 'ach', value: 2270, percent: 2.2, label: '2,270 USD, 2.2%' }] } as any,
    );
    expect(ctx.fillText.mock.calls.length).toBeGreaterThan(0);
    for (const [, , y] of ctx.fillText.mock.calls) expect(y).toBeGreaterThanOrEqual(60);
    for (const [, y] of ctx.lineTo.mock.calls) expect(y).toBeGreaterThanOrEqual(60);
  });

  it('promotes inside labels to outside when sectors collide and bounds leader lines', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 7 }),
      beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
    };
    const chart = {
      config: { type: 'pie' }, width: 300, height: 300, ctx,
      chartArea: { left: 20, right: 280, top: 20, bottom: 280 },
      data: { labels: ['A', 'B'], datasets: [{ data: [50, 50] }] },
      getDataVisibility: () => true,
      getDatasetMeta: () => ({
        data: [
          { x: 150, y: 150, startAngle: 0, endAngle: Math.PI, innerRadius: 0, outerRadius: 70 },
          { x: 150, y: 150, startAngle: Math.PI, endAngle: 2 * Math.PI, innerRadius: 0, outerRadius: 70 },
        ],
      }),
    };
    pieLabelPlugin.afterDatasetsDraw?.(
      chart as any, {} as any,
      {
        slices: [
          { key: 'A', value: 50, percent: 50, label: 'Very Long Label Name A, 50%' },
          { key: 'B', value: 50, percent: 50, label: 'Very Long Label Name B, 50%' },
        ],
      } as any,
    );
    expect(ctx.fillText.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('doughnutCenterPlugin', () => {
  it('centers caption and total value symmetrically on arc geometric center', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillText: vi.fn(),
    };
    const chart = {
      config: { type: 'doughnut' }, width: 300, height: 300, ctx,
      chartArea: { left: 20, right: 280, top: 20, bottom: 280 },
      getDatasetMeta: () => ({
        data: [
          { x: 150, y: 150, startAngle: 0, endAngle: Math.PI, innerRadius: 50, outerRadius: 80 },
          { x: 150, y: 150, startAngle: Math.PI, endAngle: 2 * Math.PI, innerRadius: 50, outerRadius: 80 },
        ],
      }),
    };

    doughnutCenterPlugin.afterDraw?.(
      chart as any, {} as any,
      { valueText: '1,234,567', labelText: '合计' },
    );

    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    const [labelCall, valueCall] = ctx.fillText.mock.calls;
    // Both label and value should be horizontally centered at cx = 150
    expect(labelCall[1]).toBe(150);
    expect(valueCall[1]).toBe(150);
    expect(labelCall[0]).toBe('合计');
    expect(valueCall[0]).toBe('1,234,567');
    // Vertical midpoint between label and value must be around cy = 150
    const labelY = labelCall[2];
    const valueY = valueCall[2];
    expect(labelY).toBeLessThan(150);
    expect(valueY).toBeGreaterThan(150);
    const midPoint = (labelY + valueY) / 2;
    expect(Math.abs(midPoint - 150)).toBeLessThan(10);
  });

  it('centers single value directly at cy when no labelText', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillText: vi.fn(),
    };
    const chart = {
      config: { type: 'doughnut' }, width: 300, height: 300, ctx,
      chartArea: { left: 20, right: 280, top: 20, bottom: 280 },
      getDatasetMeta: () => ({
        data: [
          { x: 150, y: 150, startAngle: 0, endAngle: 2 * Math.PI, innerRadius: 50, outerRadius: 80 },
        ],
      }),
    };

    doughnutCenterPlugin.afterDraw?.(
      chart as any, {} as any,
      { valueText: '42,000' },
    );

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledWith('42,000', 150, 150, expect.any(Number));
  });
});

