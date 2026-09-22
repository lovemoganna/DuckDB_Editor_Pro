import { describe, expect, it, vi } from 'vitest';
import { AsyncDebouncer } from './asyncDebouncer';

describe('AsyncDebouncer', () => {
  it('settles every coalesced caller after running the latest task once', async () => {
    vi.useFakeTimers();
    const debouncer = new AsyncDebouncer(50);
    const firstTask = vi.fn().mockResolvedValue(undefined);
    const latestTask = vi.fn().mockResolvedValue(undefined);

    const first = debouncer.run(firstTask);
    const second = debouncer.run(latestTask);
    await vi.advanceTimersByTimeAsync(50);

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(firstTask).not.toHaveBeenCalled();
    expect(latestTask).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('rejects every coalesced caller when the latest task fails', async () => {
    vi.useFakeTimers();
    const debouncer = new AsyncDebouncer(10);

    const first = debouncer.run(async () => undefined);
    const second = debouncer.run(async () => {
      throw new Error('refresh failed');
    });
    const settled = Promise.allSettled([first, second]);
    await vi.advanceTimersByTimeAsync(10);

    await expect(settled).resolves.toEqual([
      expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ message: 'refresh failed' }) }),
      expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ message: 'refresh failed' }) }),
    ]);
    vi.useRealTimers();
  });
});
