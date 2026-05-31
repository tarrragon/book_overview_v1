/**
 * UI Design System - 配色常數
 * @see docs/spec/design-system-spec.md Section 2-3
 */

const COLORS = Object.freeze({
  // 藍色主色調（Section 2.1）
  primary: '#2196F3',
  primaryLightest: '#E3F2FD',
  primaryLight: '#BBDEFB',
  primaryMedium: '#64B5F6',
  primaryDark: '#1976D2',
  primaryDarkest: '#0D47A1',
  // 成功色（Section 2.2）
  success: '#4CAF50',
  successLight: '#C8E6C9',
  successDark: '#388E3C',
  // 警告色（Section 2.3）
  warning: '#FF9800',
  warningLight: '#FFE0B2',
  warningDark: '#F57C00',
  // 背景與表面色（Section 2.4）
  background: '#FAFAFA',
  surface: '#FFFFFF',
  onBackground: '#212121',
  onSurface: '#424242',
  onSurfaceMuted: '#757575',
  // 錯誤色
  error: '#F44336',
  errorLight: '#FFCDD2',
  // 邊框色
  border: '#E0E0E0',
  borderDark: '#424242',
  // Dark Theme 色
  darkBackground: '#121212',
  // 功能色（Section 2.5）
  tagDefault: '#808080'
})

const GRADIENT = Object.freeze({
  start: COLORS.primary,
  end: COLORS.primaryDark,
  css: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`
})

// rgba 背景色生成（從 hex fg 色值產生 15% alpha 背景）
function hexToRgba (hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
}

// ReadingStatus 配色映射（Section 3）
const STATUS_COLORS = Object.freeze({
  unread: Object.freeze({ fg: COLORS.primaryLightest, bg: hexToRgba(COLORS.primaryLightest, 0.15) }),
  queued: Object.freeze({ fg: COLORS.primaryMedium, bg: hexToRgba(COLORS.primaryMedium, 0.15) }),
  reading: Object.freeze({ fg: COLORS.primary, bg: hexToRgba(COLORS.primary, 0.15) }),
  finished: Object.freeze({ fg: COLORS.success, bg: hexToRgba(COLORS.success, 0.15) }),
  abandoned: Object.freeze({ fg: COLORS.warning, bg: hexToRgba(COLORS.warning, 0.15) }),
  reference: Object.freeze({ fg: COLORS.primaryDark, bg: hexToRgba(COLORS.primaryDark, 0.15) })
})

module.exports = { COLORS, GRADIENT, STATUS_COLORS }
