/**
 * 同步 JSON 建構模組 — Web→App 同步格式的 Domain 知識（純計算，無 DOM / 狀態）
 *
 * 職責：將書庫 books 陣列包裝為 App 端約定的同步 JSON 字串
 * （format_version 2.0 + sync_meta）。格式契約對應 PROP-014 同步協定。
 */

/**
 * 包裝 books 為同步用 JSON 字串。
 *
 * @param {Array} books - 書庫書籍陣列
 * @returns {string} 同步 JSON 字串（format_version 2.0 + sync_meta）
 */
export function buildSyncJSON (books) {
  return JSON.stringify({
    format_version: '2.0',
    books,
    sync_meta: {
      exported_at: new Date().toISOString(),
      source_app: 'chrome-extension',
      book_count: books.length
    }
  })
}
