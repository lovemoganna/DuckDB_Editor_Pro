/**
 * sqlEditorThemes.ts — High-Contrast Monokai Semantic Syntax Themes
 *
 * Core Principle: Stable Dark Background (#1e1f1c), maximum foreground contrast.
 * High-vibrancy semantic colors for keywords, functions, strings, numbers, operators,
 * and status/risk indicators so every semantic type is instantly distinguishable.
 *
 * Font size: 11.5px, Line height: 1.45.
 */

import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

const FONT_FAMILY = "'Victor Mono', 'JetBrains Mono', Consolas, Menlo, Monaco, monospace";
const FONT_SIZE = '12px';
const LINE_HEIGHT = '1.6';

export type EditorThemeId = 'monokai-pro' | 'monokai-emerald' | 'monokai-dracula';

export interface EditorThemeMeta {
  id: EditorThemeId;
  label: string;
  preview: { bg: string; keyword: string; fn: string; string: string };
}

export const EDITOR_THEMES: EditorThemeMeta[] = [
  { id: 'monokai-pro',     label: 'Monokai Pro',     preview: { bg: '#1e1f1c', keyword: '#ff2d55', fn: '#00e5ff', string: '#ffd60a' } },
  { id: 'monokai-emerald', label: 'Monokai Emerald', preview: { bg: '#1e1f1c', keyword: '#ff3b30', fn: '#30d158', string: '#ffcc00' } },
  { id: 'monokai-dracula', label: 'Monokai Dracula', preview: { bg: '#1e1f1c', keyword: '#ff79c6', fn: '#50fa7b', string: '#f1fa8c' } },
];

function createCssVarTheme(vars: Record<string, string>): Extension {
  return EditorView.theme({
    '&': {
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      '--cm-bg-color': vars.bg,
      '--cm-fg-color': vars.fg,
      '--cm-gutter-bg': vars.gutterBg,
      '--cm-gutter-fg': vars.gutterFg,
      '--cm-keyword-color': vars.keyword,
      '--cm-keyword-weight': vars.keywordWeight || '700',
      '--cm-function-color': vars.fn,
      '--cm-function-weight': vars.fnWeight || '600',
      '--cm-string-color': vars.string,
      '--cm-number-color': vars.number,
      '--cm-operator-color': vars.operator,
      '--cm-comment-color': vars.comment,
      '--cm-comment-style': vars.commentStyle || 'italic',
    },
    '.cm-content': {
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      fontVariantLigatures: 'none',
      fontFeatureSettings: '"liga" 0, "calt" 0',
    },
    '.cm-line': { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
    '.cm-gutters': { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, border: 'none' },
  }, { dark: true });
}

// Stable Dark IDE Background across all schemes
const STABLE_BG = '#1e1f1c';
const STABLE_GUTTER_BG = '#252623';

// ============================================================
// Scheme 1: Monokai Pro (Default — Vivid Magenta / Cyan / Yellow)
// ============================================================
const monokaiProVars = {
  bg: STABLE_BG, fg: '#ffffff', gutterBg: STABLE_GUTTER_BG, gutterFg: '#8e8e93',
  keyword: '#ff2d55', keywordWeight: '700', // Vivid Neon Pink / Magenta
  fn: '#00e5ff', fnWeight: '600',          // Vivid Electric Cyan
  string: '#ffd60a',                       // Bright Warm Yellow
  number: '#bf5af2',                       // Vivid Violet Purple
  operator: '#ff9500',                     // Vivid Tangerine Orange
  comment: '#8e8e93', commentStyle: 'italic', // Readable Medium Slate
};

export const monokaiProTheme = [
  createTheme({
    theme: 'dark',
    settings: {
      background: STABLE_BG, foreground: '#ffffff', caret: '#ff2d55',
      selection: '#3a3b36', selectionMatch: '#3a3b36', lineHighlight: 'rgba(255, 255, 255, 0.05)',
      gutterBackground: STABLE_GUTTER_BG, gutterForeground: '#8e8e93', gutterActiveForeground: '#ffd60a',
    },
    styles: [],
  }),
  createCssVarTheme(monokaiProVars),
];

// ============================================================
// Scheme 2: Monokai Emerald (High Crimson / Emerald Green / Yellow)
// ============================================================
const monokaiEmeraldVars = {
  bg: STABLE_BG, fg: '#ffffff', gutterBg: STABLE_GUTTER_BG, gutterFg: '#8e8e93',
  keyword: '#ff3b30', keywordWeight: '700', // Bright Crimson Red
  fn: '#30d158', fnWeight: '600',          // Bright Emerald Green
  string: '#ffcc00',                       // Warm Gold
  number: '#64d2ff',                       // Vibrant Sky Blue
  operator: '#ff9500',                     // Tangerine Orange
  comment: '#8e8e93', commentStyle: 'italic',
};

export const monokaiEmeraldTheme = [
  createTheme({
    theme: 'dark',
    settings: {
      background: STABLE_BG, foreground: '#ffffff', caret: '#ff3b30',
      selection: '#2c352d', selectionMatch: '#2c352d', lineHighlight: 'rgba(255, 255, 255, 0.05)',
      gutterBackground: STABLE_GUTTER_BG, gutterForeground: '#8e8e93', gutterActiveForeground: '#30d158',
    },
    styles: [],
  }),
  createCssVarTheme(monokaiEmeraldVars),
];

// ============================================================
// Scheme 3: Monokai Dracula (Vivid Pink / Neon Green / Yellow)
// ============================================================
const monokaiDraculaVars = {
  bg: STABLE_BG, fg: '#f8f8f2', gutterBg: STABLE_GUTTER_BG, gutterFg: '#8e8e93',
  keyword: '#ff79c6', keywordWeight: '700', // Vivid Hot Pink
  fn: '#50fa7b', fnWeight: '600',          // Vivid Neon Green
  string: '#f1fa8c',                       // Bright Yellow
  number: '#bd93f9',                       // Soft Amethyst Purple
  operator: '#ffb86c',                     // Apricot Orange
  comment: '#7c8cae', commentStyle: 'italic',
};

export const monokaiDraculaTheme = [
  createTheme({
    theme: 'dark',
    settings: {
      background: STABLE_BG, foreground: '#f8f8f2', caret: '#ff79c6',
      selection: '#44475a', selectionMatch: '#44475a', lineHighlight: 'rgba(255, 255, 255, 0.05)',
      gutterBackground: STABLE_GUTTER_BG, gutterForeground: '#8e8e93', gutterActiveForeground: '#50fa7b',
    },
    styles: [],
  }),
  createCssVarTheme(monokaiDraculaVars),
];

// ============================================================
// Theme resolver
// ============================================================
export function getEditorTheme(id: EditorThemeId): Extension[] {
  switch (id) {
    case 'monokai-emerald':
      return monokaiEmeraldTheme;
    case 'monokai-dracula':
      return monokaiDraculaTheme;
    case 'monokai-pro':
    default:
      return monokaiProTheme;
  }
}
