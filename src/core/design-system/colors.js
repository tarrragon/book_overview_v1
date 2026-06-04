/**
 * UI Design System - 配色常數
 * @see docs/spec/design-system-spec.md Section 2-3
 */

// 配色策略（0.19.1-W3-001 Wave B D5 決策，Restrained commitment axis）：
//   原 Material 預設藍 #2196F3 大面積氾濫（按鈕 + 統計 + 表頭同色），屬
//   category-reflex（書庫工具 → 訓練資料預設天藍）。Wave B 改用偏 slate-indigo
//   的 primary #1A56DB（不換 hue family，離開飽和天藍 lane）+ 中性 surface
//   三級（canvas / surface / panel）承載 90% 面積，使藍退回 accent 角色
//   （僅 primary action / 當前選取 / 狀態指示，面積 < 10%）。
//   全部配色經 WCAG AA 驗證（見 W3-001 Solution §a 對比表）。
const COLORS = Object.freeze({
  // 藍色主色調（Section 2.1）
  primary: '#1A56DB', // primary action / 選取 / accent；白字其上 6.18:1
  primaryLightest: '#EAF0FD', // 選取列底 / 極淡 accent 底；ink 其上 13.92:1
  primaryLight: '#CBDBF8', // 選取列 hover 底；ink 其上 11.38:1
  primaryMedium: '#5B8DEF', // 中階 accent：white-on 3.23:1 / canvas 3.01:1，僅非文字 UI 與大文字用，禁用於 body 文字
  primaryDark: '#1442AE', // primary hover/active；白字其上 8.68:1
  primaryDarkest: '#0F317D', // 深階（罕用）
  // 成功色（Section 2.2）
  success: '#2E8B57', // sea green，離開 Material #4CAF50 反射；白字 4.25:1（大/UI）
  successLight: '#C8E6C9',
  successDark: '#388E3C',
  successText: '#1B6B3A', // 成功文字（新增）；白底 6.54:1
  // 警告色（Section 2.3）
  warning: '#B7791F', // 離開 Material amber 飽和；文字用深值
  warningLight: '#FFE0B2',
  warningDark: '#F57C00',
  // 背景與表面色（Section 2.4）
  background: '#F5F7FA', // 頁面主畫布 canvas（中性、略偏 primary hue）；ink 14.82:1 / muted 5.51:1
  surface: '#FFFFFF', // 卡片 / 表格 / 主表面；ink 15.90:1 / muted 5.91:1
  panel: '#EDF1F7', // 第二中性層（新增）：sidebar/toolbar/表頭/次要按鈕底；ink 14.03:1
  onBackground: '#1A2233', // 主文字 ink
  onSurface: '#34404F', // 次強文字；白底 > 4.5:1
  onSurfaceMuted: '#5B6573', // 弱文字 / 標籤 muted；白底 5.91:1 / canvas 5.51:1
  // 錯誤色
  error: '#C2342B', // 錯誤 / danger 按鈕；白字 5.50:1
  errorLight: '#FFCDD2',
  // 邊框色
  border: '#D9E0EA', // 預設邊框（裝飾，info-only）
  borderStrong: '#C4CDD9', // 強調邊框 / 分隔（新增）
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
