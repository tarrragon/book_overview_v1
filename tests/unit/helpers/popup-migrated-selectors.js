/**
 * popup.html 內嵌 style 遷入 design-system.css 的選擇器清單（1.5.0-W6-001）
 *
 * 單一來源：design-system-css-snapshot.test.js（C1：遷入規則存在於生成 CSS）與
 * popup-style-scope.test.js（S2：內嵌與生成規則不並存）共用本清單，防兩份平行
 * 清單漂移。順序照 Phase 1 分類清單：卡片 3 → 狀態指示 4 + @keyframes → 按鈕 9
 * → 文字 2 → 標頭 3 → 進度條 3 → 佈局容器 1 → 摺疊 6，共 32 條 rule block。
 *
 * 字面即 popup.html 原選擇器（含合併選擇器逗號分隔全文），供 `toContain('<selector> {')`
 * 完整字面斷言使用。
 *
 * @see docs/work-logs/v1/v1.5/v1.5.0/tickets/1.5.0-W6-001.md Solution Phase 1/2
 */

const MIGRATED_SELECTORS = [
  // 卡片（3）
  '.status-card',
  '.status-card.primary-surface',
  '.error-card',
  // 狀態指示（4 + @keyframes）
  '.status-indicator',
  '.status-dot',
  '.status-dot.loading',
  '.status-dot.error',
  '@keyframes pulse',
  // 按鈕（9）
  '.button',
  '.button.primary',
  '.button.primary:hover',
  '.button.secondary',
  '.button.secondary:hover',
  '.button.danger',
  '.button.danger:hover',
  '.button:disabled',
  '.button.small',
  // 文字（2）
  '.info-text',
  '.error-message',
  // 進度 / 結果 / 錯誤標頭（3）
  '.progress-header, .results-header, .error-header',
  '.progress-header strong, .results-header strong, .error-header strong',
  '.progress-percentage',
  // 進度條（3）
  '.progress-bar-container',
  '.progress-bar',
  '.progress-fill',
  // 佈局容器（1）
  '.action-buttons',
  // 摺疊元件（6）
  '.collapsible-header',
  '.collapsible-header[aria-expanded="true"]',
  '.collapsible-chevron',
  '.collapsible-header[aria-expanded="true"] .collapsible-chevron',
  '.collapsible-body',
  '.collapsible-body.expanded'
]

/**
 * popup.html `<style>` 豁免保留清單（頁面專屬佈局，非共用元件）
 */
const EXEMPT_SELECTORS = [
  'body',
  '.header',
  '.header h1',
  '.header p',
  '.content',
  '.version'
]

module.exports = { MIGRATED_SELECTORS, EXEMPT_SELECTORS }
