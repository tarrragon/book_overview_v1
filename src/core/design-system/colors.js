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
  tagDefault: '#808080',
  // 文字用深值與淡底容器（UI 改版，與 APP AppColors.light 共用，PROP-014 2026-11-26 決策）：
  //   warning #B7791F 白底只有 3.64:1，只能用於圖示與線條；文字改用 warningText。
  warningText: '#8A5A12', // 白底 5.91:1
  warningContainer: '#FFF3E0', // 其上 onWarningContainer 7.71:1
  onWarningContainer: '#6B4510',
  errorText: '#8C1D17', // errorContainer 上 7.97:1
  errorContainer: '#FDECEA',
  successContainer: '#E3F2E7', // 其上 onSuccessContainer 7.86:1
  onSuccessContainer: '#14532D'
})

// 暗色值（UI 改版，與 APP AppColors.dark 共用）。
//   只覆寫白底工作區用到的色；popup 與總覽頁頂欄是深藍底，亮暗都不變，
//   所以這組值由 design-system.css 的 [data-color-scope="workspace"] 套用，不放在 :root。
//   深藍明度階梯在暗色下反轉：primaryDarkest（選中列、深藍實體鍵的鍵面）變成淺色，
//   surface 變成深色，所以「深藍底白字」的組合在暗色下成為「淺藍底深字」。
//   每組前景與背景都達 WCAG 2.1 AA（APP test/unit/core/design_system/app_colors_test.dart）。
const DARK_COLORS = Object.freeze({
  primary: '#7EA6F7', // 焦點、進度填色；surface 上 7.04:1
  primaryLightest: '#1B2C52', // 選中列、滑過的淡底
  primaryLight: '#2A4478', // 停用鍵面、選取底、書口淺線
  primaryMedium: '#5B8DEF',
  primaryDark: '#9DBBF9', // 墨水藍文字（停用鍵字、標籤 N 連結）
  primaryDarkest: '#CBDBF8', // 選中列與深藍實體鍵的鍵面（其上用 surface 深字）
  background: '#0D1320',
  surface: '#151C2B',
  panel: '#1C2536',
  onBackground: '#E6EBF3',
  onSurface: '#C5CEDB',
  onSurfaceMuted: '#98A3B4',
  border: '#2A3447',
  borderStrong: '#3A4660',
  error: '#F28B82',
  errorLight: '#3A1A1A',
  errorText: '#FFCDD2',
  errorContainer: '#3A1A1A',
  warning: '#E3B05C',
  warningText: '#E3B05C',
  warningContainer: '#33260F',
  onWarningContainer: '#FFE0B2',
  success: '#6CC48F',
  successText: '#6CC48F',
  successContainer: '#12301F',
  onSuccessContainer: '#C8E6C9'
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

// ReadingStatus 暗色配色（與 APP AppColors.dark 的 status* 共用，各組 ≥ 8:1）
const DARK_STATUS_COLORS = Object.freeze({
  unread: Object.freeze({ fg: '#CFD8DC', bg: '#263238' }),
  queued: Object.freeze({ fg: '#BBDEFB', bg: '#123A6B' }),
  reading: Object.freeze({ fg: '#E3F2FD', bg: '#1A3557' }),
  finished: Object.freeze({ fg: '#C8E6C9', bg: '#1B3B22' }),
  abandoned: Object.freeze({ fg: '#FFE0B2', bg: '#4A2E0A' }),
  reference: Object.freeze({ fg: '#E1D8F7', bg: '#2E2350' })
})

// 重要程度 1–7 級分級色（資料分類色，與 APP AppColors.importanceLevels 共用）。
//   同一個藍色明度階梯，亮色級數越高越深、暗色越高越亮；每級在 surface 與
//   primaryLightest 上 ≥ 3:1，只用在星號、圓點這類非文字圖形。
const IMPORTANCE_COLORS = Object.freeze({
  light: Object.freeze(['#5B6573', '#4677E6', '#2F66E0', '#1A56DB', '#1442AE', '#0F317D', '#0A2259']),
  dark: Object.freeze(['#98A3B4', '#5B8DEF', '#7EA6F7', '#9DBBF9', '#B5CCFA', '#CBDBF8', '#EAF0FD'])
})

module.exports = { COLORS, STATUS_COLORS, DARK_COLORS, DARK_STATUS_COLORS, IMPORTANCE_COLORS }
