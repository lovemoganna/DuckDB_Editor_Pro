import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { multiTabCoordinator, type TabMessage } from './multiTabCoordinator';

describe('multiTabCoordinator', () => {
  it('generates a unique tab id', () => {
    expect(multiTabCoordinator.getTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
  });

  it('initially has no conflict in a single tab environment', () => {
    expect(multiTabCoordinator.getHasConflict()).toBe(false);
    expect(multiTabCoordinator.getActivePeersCount()).toBe(0);
  });

  it('notifies listeners when conflict state changes', () => {
    const listener = vi.fn();
    const unsubscribe = multiTabCoordinator.onConflictChange(listener);

    // Initial notification
    expect(listener).toHaveBeenCalledWith(false, 0);

    unsubscribe();
  });
});
