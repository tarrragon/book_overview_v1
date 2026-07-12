/**
 * popup.html 內嵌 `<style>` 收斂守護（1.5.0-W6-001）
 *
 * 目的：design-system 層級規則遷入 design-system.css 後，popup.html 內嵌
 *   `<style>` 僅允許保留 6 條頁面專屬佈局豁免規則。
 *
 * 三道守護：
 *   S1 完全相等斷言 — 同時攔「遷移不完整」（多於 6 條）與「回歸新增第 7 條」。
 *   S2 交集空集合斷言 — 攔「內嵌與生成規則長期並存」：design-system.css 於
 *      popup.html 先載入，同名規則內嵌者勝出會遮蔽生成值差異（cascade 風險），
 *      故遷入清單成員禁止再出現於內嵌 `<style>`。
 *   B1 雙向全等斷言（1.5.0-W6-011）— 攔「COMPONENT_RULES 新增規則而 helper
 *      未同步」：S1/S2 僅單向守護 popup.html，COMPONENT_RULES 頂層選擇器
 *      集合必須 === MIGRATED_SELECTORS，任一端漂移即紅燈。
 *
 * 讀檔為專案內靜態資產 fs 同步讀取，無網路/計時/隨機依賴
 * （test-assertion-design-rules 合規）。
 *
 * @see docs/work-logs/v1/v1.5/v1.5.0/tickets/1.5.0-W6-001.md Solution Phase 1/2
 */

const fs = require('fs')
const path = require('path')

const {
  MIGRATED_SELECTORS,
  EXEMPT_SELECTORS,
  parseTopLevelSelectors
} = require('./helpers/popup-migrated-selectors.js')
const { COMPONENT_RULES } = require('../../src/core/design-system/component-rules.js')

const POPUP_HTML_PATH = path.join(__dirname, '..', '..', 'src', 'popup', 'popup.html')

/**
 * 擷取 popup.html 內嵌 `<style>` 區塊並解析 top-level 選擇器清單。
 *
 * 解析語意委派 helper 的 parseTopLevelSelectors（與 B1 全等守護共用同一
 * 解析器，避免兩份平行實作漂移）。
 *
 * @param {string} html - popup.html 全文
 * @returns {string[]} top-level 選擇器（出現順序）
 */
function parseInlineStyleSelectors (html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
  if (!styleMatch) return []
  return parseTopLevelSelectors(styleMatch[1])
}

describe('popup.html 內嵌 style 收斂（1.5.0-W6-001）', () => {
  let inlineSelectors

  beforeAll(() => {
    const html = fs.readFileSync(POPUP_HTML_PATH, 'utf8')
    inlineSelectors = parseInlineStyleSelectors(html)
  })

  // S1：頂層選擇器集合 === 6 條豁免集合（完全相等，防漏刪與防回歸新增）
  test('popup.html style 頂層選擇器集合等於 6 條豁免集合', () => {
    const sortedInline = [...inlineSelectors].sort()
    const sortedExempt = [...EXEMPT_SELECTORS].sort()
    expect(sortedInline).toEqual(sortedExempt)
  })

  // S2：內嵌選擇器 ∩ 遷入清單 = 空集合（cascade 並存守護）
  test('內嵌選擇器與遷入清單不並存（cascade 守護）', () => {
    const migratedSet = new Set(MIGRATED_SELECTORS)
    const coexisting = inlineSelectors.filter((selector) => migratedSet.has(selector))
    // 失敗訊息直接列出並存選擇器清單
    expect(coexisting).toEqual([])
  })
})

describe('COMPONENT_RULES 與 MIGRATED_SELECTORS 雙向守護（1.5.0-W6-011）', () => {
  // B1：COMPONENT_RULES 頂層選擇器集合 === MIGRATED_SELECTORS（雙向全等）
  // EXEMPT_SELECTORS 不參與比對：依 helper 註解其為「頁面專屬佈局，非共用
  // 元件」，永不遷入 COMPONENT_RULES，全等對象僅遷入清單。
  test('COMPONENT_RULES 頂層選擇器集合等於 MIGRATED_SELECTORS', () => {
    const ruleSelectors = parseTopLevelSelectors(COMPONENT_RULES)
    const sortedRules = [...ruleSelectors].sort()
    const sortedMigrated = [...MIGRATED_SELECTORS].sort()
    expect(sortedRules).toEqual(sortedMigrated)
  })
})
