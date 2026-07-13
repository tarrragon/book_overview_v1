/**
 * popup.html 內嵌 style 遷入 design-system.css 的選擇器清單（1.5.0-W6-001）
 *
 * 單一來源：design-system-css-snapshot.test.js（C1：遷入規則存在於生成 CSS）與
 * popup-style-scope.test.js（S2：內嵌與生成規則不並存）共用本清單，防兩份平行
 * 清單漂移。順序照 Phase 1 分類清單：卡片 3 → 狀態指示 4 + @keyframes → 按鈕 14
 * → 文字 2 → 標頭 3 → 進度條 2 → 佈局容器 1 → 摺疊 6 → 分割陰影 4 → 徽章 5，
 * 共 45 條 rule block（原 32 條，1.5.0-W6-012 合併 .progress-bar/.progress-fill；
 * 1.5.0-W6-003 命名契約對齊新增 confirm/ghost/large 5 條；1.5.0-W6-004 新增
 * divider 4 條；1.5.0-W6-023 新增 badge 5 條——divider/badge 皆非 popup.html
 * 遷移，僅供 B1 全等守護計數對齊）。
 *
 * 字面即 popup.html 原選擇器（含合併選擇器逗號分隔全文），供 `toContain('<selector> {')`
 * 完整字面斷言使用。例外：`.progress-bar, .progress-fill` 為 W6-012 遷入後
 * 合併產物，`.badge, .reading-status-badge` 為 W6-023 收斂產物，皆非
 * popup.html 原字面。
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
  // 按鈕（14，1.5.0-W6-003 命名契約對齊補 confirm/ghost/large）
  '.button',
  '.button.primary',
  '.button.primary:hover',
  '.button.secondary',
  '.button.secondary:hover',
  '.button.danger',
  '.button.danger:hover',
  '.button.confirm',
  '.button.confirm:hover',
  '.button.ghost',
  '.button.ghost:hover',
  '.button:disabled',
  '.button.small',
  '.button.large',
  // 文字（2）
  '.info-text',
  '.error-message',
  // 進度 / 結果 / 錯誤標頭（3）
  '.progress-header, .results-header, .error-header',
  '.progress-header strong, .results-header strong, .error-header strong',
  '.progress-percentage',
  // 進度條（2；原 3，1.5.0-W6-012 合併 .progress-bar/.progress-fill 逐字重複宣告）
  '.progress-bar-container',
  '.progress-bar, .progress-fill',
  // 佈局容器（1）
  '.action-buttons',
  // 摺疊元件（6）
  '.collapsible-header',
  '.collapsible-header[aria-expanded="true"]',
  '.collapsible-chevron',
  '.collapsible-header[aria-expanded="true"] .collapsible-chevron',
  '.collapsible-body',
  '.collapsible-body.expanded',
  // 分割陰影（4，1.5.0-W6-004，新增元件非 popup.html 遷移，B1 全等守護仍納入計數）
  '.divider',
  '.divider.divider-subtle',
  '.divider.divider-normal',
  '.divider.divider-strong',
  // 徽章（5，1.5.0-W6-023，新增元件非 popup.html 遷移，基礎樣式與 overview
  // .reading-status-badge 合併選擇器收斂，B1 全等守護仍納入計數）
  '.badge, .reading-status-badge',
  '.badge--success',
  '.badge--warning',
  '.badge--info',
  '.badge--muted'
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

/**
 * 解析 CSS 字串的 top-level 選擇器清單（1.5.0-W6-011）
 *
 * 規則：剝除 CSS 註解後以大括號深度掃描，深度 0 遇 `{` 前的文字即一個
 * top-level 選擇器（空白摺疊為單一空格）；@keyframes 視為一個 top-level 項，
 * 其內層 0%/100% 因深度 > 0 不計。
 *
 * 供雙向守護共用：popup-style-scope.test.js 以此解析 popup.html 內嵌
 * `<style>`（S1/S2 單向守護）與 component-rules.js COMPONENT_RULES 字串
 * （B1 全等守護），確保兩端使用同一解析語意。
 *
 * @param {string} cssText - CSS 字串（不含 `<style>` 標籤）
 * @returns {string[]} top-level 選擇器（出現順序）
 */
function parseTopLevelSelectors (cssText) {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = []
  let depth = 0
  let buffer = ''

  for (const char of stripped) {
    if (char === '{') {
      if (depth === 0) {
        selectors.push(buffer.replace(/\s+/g, ' ').trim())
        buffer = ''
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      buffer = ''
    } else if (depth === 0) {
      buffer += char
    }
  }

  return selectors
}

module.exports = { MIGRATED_SELECTORS, EXEMPT_SELECTORS, parseTopLevelSelectors }
