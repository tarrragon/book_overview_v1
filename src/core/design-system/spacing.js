/**
 * UI Design System - 間距與圓角常數
 * @see docs/spec/design-system-spec.md Section 5-6
 */

const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export { SPACING, BORDER_RADIUS };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SPACING, BORDER_RADIUS };
}
