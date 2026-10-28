import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useContainerSize } from './useContainerWidth';
afterEach(() => vi.unstubAllGlobals());
it('remeasures height-only changes and panels shown after being hidden', () => {
  let notify = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback; }
    observe() {} disconnect() {}
  });
  const element = document.createElement('div');
  let dimensions = { width: 600, height: 320 };
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => dimensions as DOMRect);
  const ref = { current: element };
  const { result } = renderHook(() => useContainerSize(ref));
  expect(result.current).toEqual(dimensions);
  act(() => { dimensions = { width: 600, height: 720 }; notify(); });
  expect(result.current.height).toBe(720);
  act(() => { dimensions = { width: 0, height: 0 }; notify(); });
  act(() => { dimensions = { width: 480, height: 400 }; notify(); });
  expect(result.current).toEqual(dimensions);
});
