/**
 * Readmoo 頁面類型偵測 — 共用純函式工具
 *
 * 收斂 tab-state-tracking-service 與 content-script-coordinator-service 重複的
 * detectPageType 邏輯（W1-039）。提供 isReadmooPage / detectReadmooPageType 兩個
 * 純函式，無副作用、無外部依賴，可被任何 service 引用。
 *
 * URL pattern 支援範圍（W1-029.1 同步）：
 * - 真實書庫頁：https://read.readmoo.com/#/library（Vue SPA hash route）
 * - 舊版 path 形式：https://member.readmoo.com/library
 * - 書籍詳情：readmoo.com/book/{id}
 * - 閱讀器：readmoo.com/reader
 * - 其他 readmoo.com 頁面歸類為 readmoo_main
 *
 * 設計考量：
 * - 純函式設計（無 this、無 state），便於跨 service 共享與單元測試
 * - URL pattern 變更只需修一處，避免兩個 service 漂移（DRY 收斂的核心動機）
 * - 與既有 service detectPageType 簽名相容（return 'readmoo_library' | 'readmoo_book_detail'
 *   | 'readmoo_reader' | 'readmoo_main' | null）
 */

/**
 * 判斷 URL 是否屬於 Readmoo 網域
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isReadmooPage (url) {
  if (!url) return false
  return url.includes('readmoo.com')
}

/**
 * 偵測 Readmoo 頁面類型
 *
 * @param {string|null|undefined} url
 * @returns {('readmoo_library'|'readmoo_book_detail'|'readmoo_reader'|'readmoo_main'|null)}
 *   非 Readmoo 頁面或空 URL 回傳 null。
 */
function detectReadmooPageType (url) {
  if (!isReadmooPage(url)) return null

  // W1-029.1: 真實書庫頁為 https://read.readmoo.com/#/library
  // （Vue SPA hash route），不含子字串 readmoo.com/library。
  // 同時相容舊版 path 形式（如 member.readmoo.com/library）。
  if (
    (url.includes('read.readmoo.com') && url.includes('#/library')) ||
    url.includes('readmoo.com/library')
  ) {
    return 'readmoo_library'
  }
  if (url.match(/readmoo\.com\/book\/\d+/)) return 'readmoo_book_detail'
  if (url.includes('readmoo.com/reader')) return 'readmoo_reader'
  return 'readmoo_main'
}

module.exports = {
  isReadmooPage,
  detectReadmooPageType
}
