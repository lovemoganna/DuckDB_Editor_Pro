// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, STUDIO_COMMANDS } from './commandRegistry';

describe('CommandRegistry', () => {
  it('registers all studio commands with shortcuts and categories', () => {
    const all = CommandRegistry.getAll();
    expect(all.length).toBeGreaterThan(5);
    expect(CommandRegistry.getCommand('query.run')).toBeDefined();
    expect(CommandRegistry.getCommand('query.run')?.shortcut).toBe('Ctrl+Enter');
    expect(CommandRegistry.getCommand('query.format')?.shortcut).toBe('Ctrl+Shift+F');
  });

  it('groups commands by category correctly', () => {
    const queryCommands = CommandRegistry.getByCategory('query');
    expect(queryCommands.length).toBeGreaterThan(0);
    const globalCommands = CommandRegistry.getByCategory('global');
    expect(globalCommands.length).toBeGreaterThan(0);
  });

  it('dispatches custom event on command execution', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    CommandRegistry.dispatch('workbench-run-query');
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
