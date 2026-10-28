import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCopilotStore } from './useCopilotStore';

describe('useCopilotStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to hidden (isOpen = false) when no localStorage value is set', () => {
    // When reset or initialized without localStorage saved value
    expect(useCopilotStore.getState().isOpen).toBe(false);
  });

  it('toggles open state and saves preference to localStorage', () => {
    useCopilotStore.setState({ isOpen: false });
    expect(useCopilotStore.getState().isOpen).toBe(false);

    useCopilotStore.getState().toggleOpen();
    expect(useCopilotStore.getState().isOpen).toBe(true);
    expect(localStorage.getItem('copilot_sidebar_open')).toBe('true');

    useCopilotStore.getState().toggleOpen();
    expect(useCopilotStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem('copilot_sidebar_open')).toBe('false');
  });

  it('allows explicit setIsOpen', () => {
    useCopilotStore.getState().setIsOpen(true);
    expect(useCopilotStore.getState().isOpen).toBe(true);
    expect(localStorage.getItem('copilot_sidebar_open')).toBe('true');

    useCopilotStore.getState().setIsOpen(false);
    expect(useCopilotStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem('copilot_sidebar_open')).toBe('false');
  });
});
