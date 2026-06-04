/**
 * UI Design System - 陰影與遮罩常數
 * @see docs/spec/design-system-spec.md Section 8（陰影系統）
 *
 * 設計決策（0.19.1-W2-002）：
 *   overview.css 與 popup.html 既有 5 處 box-shadow 與 1 處 modal overlay
 *   皆使用「中性純黑」rgba(0,0,0,*)，與品牌色無關（屬 CSS 慣用陰影 / scrim），
 *   且各 box-shadow 的 offset/blur 不同（0 0 10px、0 2px 8px、0 2px 4px、
 *   0 2px 10px、0 4px 20px）。故 token 只收斂「顏色」維度（兩級陰影 alpha
 *   0.1 / 0.25 + overlay scrim 0.5），offset/blur 仍由各 CSS 規則自行宣告，
 *   寫法為 box-shadow: 0 2px 8px var(--shadow-color-sm)。此設計避免強行統一
 *   不同元件的 offset/blur，同時讓純黑 rgba 完全收斂至 design-system SSOT。
 *
 * 命名對齊既有 --color-* / --status-* 慣例，產生器產出 --shadow-* / --overlay-*。
 */

// 中性陰影顏色（純黑 alpha，與品牌色無關的 CSS 慣用陰影）
//   sm（0.1）：輕陰影，用於容器 / 表格 / 卡片 / 書封 / header
//   md（0.25）：中陰影，用於 modal dialog 提升層級
const SHADOW_COLORS = Object.freeze({
  sm: 'rgba(0, 0, 0, 0.1)',
  md: 'rgba(0, 0, 0, 0.25)'
})

// 遮罩 scrim（modal backdrop 半透明黑底，0.5）
const OVERLAY_COLORS = Object.freeze({
  scrim: 'rgba(0, 0, 0, 0.5)'
})

module.exports = { SHADOW_COLORS, OVERLAY_COLORS }
