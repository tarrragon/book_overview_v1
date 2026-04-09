/**
 * UI Design System - 統一匯出
 * @see docs/spec/design-system-spec.md
 */

export { COLORS, GRADIENT, STATUS_COLORS } from './colors.js';
export { SPACING, BORDER_RADIUS } from './spacing.js';
export { FONT_FAMILY, FONT_SIZES, FONT_WEIGHTS } from './typography.js';

// CJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  const colors = require('./colors.js');
  const spacing = require('./spacing.js');
  const typography = require('./typography.js');
  module.exports = { ...colors, ...spacing, ...typography };
}
