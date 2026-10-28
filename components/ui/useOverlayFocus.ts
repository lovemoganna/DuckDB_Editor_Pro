import { useEffect, useRef, type RefObject } from 'react';

const overlays: HTMLElement[] = [];
const focusableSelector = 'button, [href], input, select, textarea, [tabindex]';

function focusableItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(element => {
    if (element.matches(':disabled, [type="hidden"]') || element.tabIndex < 0) return false;
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current.hidden || current.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden') return false;
      if (current === panel) break;
    }
    return true;
  });
}

/** Modal and drawer share one stack: only the top overlay owns focus and Escape. */
export function useOverlayFocus(open: boolean, panelRef: RefObject<HTMLElement>, onClose: () => void, autoFocus = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const previous = document.activeElement as HTMLElement | null;
    overlays.push(panel);
    const initialItems = focusableItems(panel);
    if (autoFocus) {
      const alreadyFocused = document.activeElement as HTMLElement | null;
      const target = (alreadyFocused && initialItems.includes(alreadyFocused) ? alreadyFocused : null)
        || initialItems.find(item => item.hasAttribute('autofocus'))
        || initialItems.find(item => item.matches('input, textarea, select'))
        || initialItems[0] || panel;
      target.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (overlays[overlays.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = focusableItems(panel);
        const first = items[0] || panel;
        const last = items[items.length - 1] || panel;
        if (!panel.contains(document.activeElement) || !items.length) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      const wasTop = overlays[overlays.length - 1] === panel;
      const index = overlays.indexOf(panel);
      if (index >= 0) overlays.splice(index, 1);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (wasTop && previous?.isConnected) previous.focus();
    };
  }, [open, autoFocus, panelRef]);
}
