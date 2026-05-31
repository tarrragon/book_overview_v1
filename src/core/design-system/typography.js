/**
 * UI Design System - 字體常數
 * @see docs/spec/design-system-spec.md Section 7
 */

const FONT_FAMILY = "'PingFang SC', 'Microsoft YaHei', sans-serif"

const FONT_SIZES = Object.freeze({
  headline3: 24,
  titleLarge: 20,
  titleMedium: 18,
  titleSmall: 16,
  bodyLarge: 16,
  bodyMedium: 14,
  bodySmall: 12,
  caption: 12,
  overline: 10
})

const FONT_WEIGHTS = Object.freeze({
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700
})

module.exports = { FONT_FAMILY, FONT_SIZES, FONT_WEIGHTS }
