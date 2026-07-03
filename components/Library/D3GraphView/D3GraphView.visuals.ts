/**
 * D3GraphView.visuals — SVG path constants and color palettes used by D3GraphView.
 *
 * Extracted so the main component does not need to inline 100+ lines of
 * visual constants and they can be reused across other graph consumers.
 */

/** Hexagon — semantically represents a TYPE / CATEGORY node */
export const ICON_HEXAGON = `M 8.66,-5 L 0,-10 L -8.66,-5 L -8.66,5 L 0,10 L 8.66,5 Z`;

/** Box — represents a concrete DATA ENTITY / INSTANCE */
export const ICON_BOX = `M -7,-4 L 0,-8 L 7,-4 L 7,4 L 0,8 L -7,4 Z`;

/** Lightning bolt — represents an ACTION node */
export const ICON_BOLT = `M 2,-9 L -5,1 L -1,1 L -2,9 L 5,-1 L 1,-1 Z`;

/** Type palette: WARM colors for TypeHub (parent) */
export const TYPE_COLORS_WARM = [
  '#FF6B35', '#F7C59F', '#E63946', '#F4A261', '#D62828',
  '#FF9F1C', '#E76F51', '#BC4749', '#A8DADC',
];

/** Type palette: COOL colors for Instance (child) */
export const TYPE_COLORS_COOL = [
  '#4CC9F0', '#4361EE', '#3A86FF', '#06D6A0', '#00B4D8',
  '#48CAE4', '#90E0EF', '#0096C7', '#023E8A',
];

/** Legacy fallback alias kept for older consumers */
export const TYPE_COLORS = TYPE_COLORS_WARM;