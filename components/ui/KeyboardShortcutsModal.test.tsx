import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('does not throw when window receives a key event without closest on target', () => {
    render(<KeyboardShortcutsModal open={false} />);
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).not.toThrow();
  });

  it('renders modal content when open is true and calls onClose on Escape', () => {
    const handleClose = vi.fn();
    render(<KeyboardShortcutsModal open={true} onClose={handleClose} />);

    expect(screen.getByText('快捷键速查指南')).toBeInTheDocument();
    expect(screen.getByText('全局通用快捷键')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(handleClose).toHaveBeenCalled();
  });
});
