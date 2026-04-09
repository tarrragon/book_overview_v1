/**
 * UI Design System - 配色常數
 * @see docs/spec/design-system-spec.md Section 2-3
 */

const COLORS = {
  // 藍色主色調（Section 2.1）
  primary: '#2196F3',
  primaryLightest: '#E3F2FD',
  primaryLight: '#BBDEFB',
  primaryMedium: '#64B5F6',
  primaryDark: '#1976D2',
  primaryDarkest: '#0D47A1',
  // 正向色（Section 2.2）
  positive: '#4CAF50',
  positiveLight: '#C8E6C9',
  positiveDark: '#388E3C',
  // 負面色（Section 2.3）
  negative: '#FF9800',
  negativeLight: '#FFE0B2',
  negativeDark: '#F57C00',
  // 背景與表面色（Section 2.4）
  background: '#FAFAFA',
  surface: '#FFFFFF',
  onBackground: '#212121',
  onSurface: '#424242',
  onSurfaceMuted: '#757575',
  // 功能色（Section 2.5）
  tagDefault: '#808080',
};

const GRADIENT = {
  start: '#2196F3',
  end: '#1976D2',
  css: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
};

// ReadingStatus 配色映射（Section 3）
const STATUS_COLORS = {
  unread: { fg: '#E3F2FD', bg: 'rgba(227,242,253,0.15)' },
  queued: { fg: '#64B5F6', bg: 'rgba(100,181,246,0.15)' },
  reading: { fg: '#2196F3', bg: 'rgba(33,150,243,0.15)' },
  finished: { fg: '#4CAF50', bg: 'rgba(76,175,80,0.15)' },
  abandoned: { fg: '#FF9800', bg: 'rgba(255,152,0,0.15)' },
  reference: { fg: '#1976D2', bg: 'rgba(25,118,210,0.15)' },
};

export { COLORS, GRADIENT, STATUS_COLORS };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COLORS, GRADIENT, STATUS_COLORS };
}
