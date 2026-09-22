/**
 * sqlAutocompleteTheme.ts — Autocomplete UI for CodeMirror 6 in SQL Workbench.
 * Uses Monokai design tokens + --font-sql-editor for visual unity with the editor.
 *
 * CodeMirror maps completion `type` → `.cm-completionIcon-{type}`:
 *   class → tables, property → columns, keyword / function / text → as named
 */

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

const FONT_FAMILY = 'var(--font-sql-editor)';

export const sqlAutocompleteTheme: Extension = EditorView.theme({
  '.cm-tooltip-autocomplete': {
    fontFamily: `${FONT_FAMILY} !important`,
    fontSize: '8px !important',
    lineHeight: '1.45 !important',
    backgroundColor: 'var(--monokai-bg) !important',
    color: 'var(--monokai-fg) !important',
    border: '1px solid var(--monokai-border) !important',
    borderRadius: '8px !important',
    boxShadow: 'var(--shadow-lg) !important',
    backdropFilter: 'blur(12px) !important',
    zIndex: '9999 !important',
    padding: '4px !important',
    minWidth: '260px !important',
    maxWidth: '520px !important',
    maxHeight: '280px !important',
    overflowY: 'auto !important',
    scrollbarWidth: 'thin !important',
    scrollbarColor: 'rgba(255, 255, 255, 0.18) transparent !important',
  },

  '.cm-tooltip-autocomplete > ul': {
    fontFamily: `${FONT_FAMILY} !important`,
    margin: '0 !important',
    padding: '0 !important',
    listStyle: 'none !important',
  },

  '.cm-tooltip-autocomplete > ul > li': {
    fontFamily: `${FONT_FAMILY} !important`,
    fontSize: '8px !important',
    height: '28px !important',
    lineHeight: '28px !important',
    padding: '0 8px !important',
    borderRadius: '5px !important',
    display: 'flex !important',
    alignItems: 'center !important',
    gap: '8px !important',
    cursor: 'pointer !important',
    color: 'var(--monokai-fg-muted) !important',
    transition: 'background-color 0.1s ease, color 0.1s ease !important',
  },

  '.cm-tooltip-autocomplete > ul > li:hover:not([aria-selected="true"])': {
    backgroundColor: 'var(--monokai-hover) !important',
    color: 'var(--monokai-fg) !important',
  },

  '.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-cyan) 16%, transparent) !important',
    color: 'var(--monokai-fg) !important',
    outline: '1px solid color-mix(in srgb, var(--monokai-cyan) 45%, transparent) !important',
    boxShadow: 'inset 0 0 8px color-mix(in srgb, var(--monokai-cyan) 15%, transparent) !important',
  },

  /* Hide default CM glyph; we render text badges via ::after */
  '.cm-completionIcon': {
    display: 'inline-flex !important',
    alignItems: 'center !important',
    justifyContent: 'center !important',
    minWidth: '42px !important',
    height: '16px !important',
    padding: '0 4px !important',
    fontSize: '9px !important',
    fontWeight: '700 !important',
    letterSpacing: '0.04em !important',
    textTransform: 'uppercase !important',
    borderRadius: '3px !important',
    flexShrink: '0 !important',
    opacity: '1 !important',
    marginRight: '2px !important',
    borderWidth: '1px !important',
    borderStyle: 'solid !important',
    backgroundColor: 'var(--monokai-elevated) !important',
    color: 'var(--monokai-comment) !important',
    borderColor: 'var(--monokai-border) !important',
    fontFamily: `${FONT_FAMILY} !important`,
  },

  /* Tables (type: class) — one mapping per type; no alias duplicates */
  '.cm-completionIcon-class': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-cyan) 18%, transparent) !important',
    color: 'var(--monokai-cyan) !important',
    borderColor: 'color-mix(in srgb, var(--monokai-cyan) 40%, transparent) !important',
  },
  '.cm-completionIcon-class::after': { content: '"TABLE" !important' },

  /* Columns (type: property) */
  '.cm-completionIcon-property': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-accent) 18%, transparent) !important',
    color: 'var(--monokai-accent) !important',
    borderColor: 'color-mix(in srgb, var(--monokai-accent) 40%, transparent) !important',
  },
  '.cm-completionIcon-property::after': { content: '"COL" !important' },

  '.cm-completionIcon-keyword': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-pink) 18%, transparent) !important',
    color: 'var(--monokai-pink) !important',
    borderColor: 'color-mix(in srgb, var(--monokai-pink) 40%, transparent) !important',
  },
  '.cm-completionIcon-keyword::after': { content: '"KEYWORD" !important' },

  '.cm-completionIcon-function': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-purple) 18%, transparent) !important',
    color: 'var(--monokai-purple) !important',
    borderColor: 'color-mix(in srgb, var(--monokai-purple) 40%, transparent) !important',
  },
  '.cm-completionIcon-function::after': { content: '"FUNC" !important' },

  '.cm-completionIcon-text': {
    backgroundColor: 'color-mix(in srgb, var(--monokai-orange) 18%, transparent) !important',
    color: 'var(--monokai-orange) !important',
    borderColor: 'color-mix(in srgb, var(--monokai-orange) 40%, transparent) !important',
  },
  '.cm-completionIcon-text::after': { content: '"SNIPPET" !important' },

  '.cm-completionMatchedText': {
    color: 'var(--monokai-yellow) !important',
    textDecoration: 'none !important',
    fontWeight: '700 !important',
  },

  '.cm-completionLabel': {
    fontFamily: `${FONT_FAMILY} !important`,
    fontSize: '8px !important',
  },

  '.cm-completionDetail': {
    fontFamily: `${FONT_FAMILY} !important`,
    fontSize: '8px !important',
    color: 'var(--monokai-comment) !important',
    marginLeft: 'auto !important',
    padding: '0 6px !important',
    borderRadius: '3px !important',
    background: 'var(--monokai-elevated) !important',
    border: '1px solid var(--monokai-border-subtle) !important',
  },

  '.cm-tooltip.cm-completionInfo': {
    fontFamily: 'var(--font-sans) !important',
    fontSize: '11px !important',
    lineHeight: '1.45 !important',
    backgroundColor: 'var(--monokai-elevated) !important',
    color: 'var(--monokai-fg-muted) !important',
    border: '1px solid var(--monokai-border) !important',
    borderRadius: '8px !important',
    boxShadow: 'var(--shadow-md) !important',
    padding: '8px 10px !important',
    maxWidth: '320px !important',
    zIndex: '10000 !important',
  },
});
