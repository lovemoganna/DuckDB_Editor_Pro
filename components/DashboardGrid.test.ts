import { describe, expect, it } from 'vitest';
import {
  HOME_BOARD_COLS,
  HOME_BOARD_MIN_H,
  HOME_BOARD_MIN_W,
  clampLayoutItem,
  needsReadableLayout,
} from './DashboardGrid';

describe('clampLayoutItem', () => {
  it('clamps width to [minW, cols] and keeps item inside the 12-col canvas', () => {
    expect(clampLayoutItem({ i: 'a', x: -2, y: -1, w: 1, h: 1 })).toEqual({
      i: 'a',
      x: 0,
      y: 0,
      w: HOME_BOARD_MIN_W,
      h: HOME_BOARD_MIN_H,
    });
    expect(clampLayoutItem({ i: 'b', x: 10, y: 0, w: 8, h: 3 })).toEqual({
      i: 'b',
      x: 4,
      y: 0,
      w: 8,
      h: HOME_BOARD_MIN_H,
    });
    expect(clampLayoutItem({ i: 'c', x: 0, y: 2, w: 99, h: 5 })).toEqual({
      i: 'c',
      x: 0,
      y: 2,
      w: HOME_BOARD_COLS,
      h: 5,
    });
  });

  it('rounds fractional grid units', () => {
    expect(clampLayoutItem({ i: 'd', x: 1.6, y: 2.4, w: 3.2, h: 2.8 })).toEqual({
      i: 'd',
      x: 2,
      y: 2,
      w: HOME_BOARD_MIN_W,
      h: HOME_BOARD_MIN_H,
    });
  });
});

it('adapts only at a fixed viewport boundary without mutating coordinates', () => {
  const items = [{ w: 4, h: 3 }]; const before = JSON.stringify(items);
  expect(needsReadableLayout(items, 1200)).toBe(false);
  expect(needsReadableLayout(items, 768)).toBe(true);
  expect(needsReadableLayout([{w:6,h:7}], 1200)).toBe(false);
  expect(JSON.stringify(items)).toBe(before);
});
