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

// ReadingStatus 配色映射（Section 3，D3 修正後）
//
// 設計變更（0.19.1-W2-001 D3 決策）：
//   舊設計「彩色文字 + 15% alpha 背景」對淺色狀態（unread 1.12:1）幾乎不可見，
//   違反 WCAG AA 4.5:1。新設計改為「深色文字 + 不透明淺色背景」，6 狀態
//   全達 WCAG AA（最低 unread 4.68:1）。同時廢棄 GRADIENT 常數與 hexToRgba
//   函式（漸層全面移除改扁平色，bg 改為不透明色不再需要 alpha 計算）。
const STATUS_COLORS = Object.freeze({
  unread: Object.freeze({ fg: '#546E7A', bg: '#ECEFF1' }),
  queued: Object.freeze({ fg: '#0D47A1', bg: '#BBDEFB' }),
  reading: Object.freeze({ fg: '#0D47A1', bg: '#E3F2FD' }),
  finished: Object.freeze({ fg: '#1B5E20', bg: '#C8E6C9' }),
  abandoned: Object.freeze({ fg: '#804000', bg: '#FFE0B2' }),
  reference: Object.freeze({ fg: '#311B92', bg: '#EDE7F6' })
})

module.exports = { COLORS, STATUS_COLORS }
