import { describe, expect, it } from 'vitest';
import { resolveOntologyDrawerMode, resolveReadableCanvasZoom } from './ontologyViewportPolicy';

describe('ontology viewport policy', () => {
  it('keeps inline push layout on workbench widths so the graph stays visible', () => {
    expect(resolveOntologyDrawerMode(719)).toBe('overlay');
    expect(resolveOntologyDrawerMode(720)).toBe('inline');
    expect(resolveOntologyDrawerMode(1024)).toBe('inline');
    expect(resolveOntologyDrawerMode(1280)).toBe('inline');
  });

  it('keeps normal graphs readable but allows fit-all to zoom lower', () => {
    expect(resolveReadableCanvasZoom(0.42, 9)).toBe(0.6);
    expect(resolveReadableCanvasZoom(0.42, 9, true)).toBe(0.42);
    expect(resolveReadableCanvasZoom(0.42, 30)).toBe(0.42);
  });
});
