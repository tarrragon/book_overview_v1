'use strict'

/**
 * Export 格式版本偵測模組
 * 偵測匯入 JSON/CSV 資料的來源格式：
 * - 四來源辨識（detectInterchangeSource）：canonical / 內部 v2 / APP legacy / flat v1
 * - 既有二值辨識（detectFormatVersion）：v1 / v2 / null（ContentParser DI 消費，簽名不變）
 *
 * 設計依據：docs/spec/book-interchange-v1.md v3.0.0 §8（detector 四來源優先序）；
 * ticket 0.19.0-W4-031.2 §Phase 1 §2.1 / §Phase 3a §2（ADR-2 / H1 / H2）。
 *
 * @module format-version-detector
 */

/**
 * 判斷值是否為可用於屬性查找的 object（含陣列，排除 null）
 *
 * @param {*} value
 * @returns {boolean}
 */
function isLookupableObject (value) {
  return value !== null && value !== undefined && typeof value === 'object'
}

/**
 * 偵測匯入 JSON 資料的來源格式（四來源優先序，spec §8）
 *
 * 四來源唯一真值來源（ADR-2）：detectFormatVersion 委派本函式做值域收斂，
 * 避免兩 detector 判定邏輯各自演化漂移（ARCH-020）。
 *
 * 優先序（高→低，逐規則短路 return 即互斥）：
 * 1. data.format === 'book-interchange-v1' → 'canonical'（凌駕 formatVersion / backup_info）
 * 2. data.metadata.formatVersion 以 '2.' 開頭 → 'v2'
 * 3. 含 backup_info 或 export_info wrapper + books 陣列 → 'app-legacy'（止血關鍵）
 * 4. 純陣列 或 {books:[]} 無版本標記 → 'v1'
 * 5. 皆不符 → null
 *
 * @param {*} data - 解析後的 JSON 資料（any）
 * @returns {'canonical' | 'v2' | 'app-legacy' | 'v1' | null} 來源格式標記
 */
function detectInterchangeSource (data) {
  // 型別守衛：非物件且非陣列一律 null（與既有 detectFormatVersion 一致）
  if (!isLookupableObject(data)) {
    return null
  }

  // 優先序 1（最高）：canonical 字面標記 → 凌駕 formatVersion / backup_info（B3/B4）
  if (data.format === 'book-interchange-v1') {
    return 'canonical'
  }

  // 優先序 2：內部 v2（formatVersion 以 '2.' 開頭）
  //   到此處 format 必不等於 canonical 字面（Rule 1 已短路），故 !format 為死條件，移除（H2）
  const formatVersion = data?.metadata?.formatVersion
  if (typeof formatVersion === 'string' && formatVersion.startsWith('2.')) {
    return 'v2'
  }

  // 優先序 3：APP legacy wrapper（止血關鍵）→ 不再誤命中 flat v1
  const hasLegacyWrapper = data.backup_info !== undefined || data.export_info !== undefined
  if (hasLegacyWrapper && Array.isArray(data.books)) {
    return 'app-legacy'
  }

  // 優先序 4：flat v1（純陣列 或 {books:[]} 無版本標記）
  if (Array.isArray(data)) {
    return 'v1'
  }
  if (Array.isArray(data.books)) {
    return 'v1'
  }

  // 優先序 5：皆不符
  return null
}

/**
 * 偵測 JSON 匯入資料的格式版本（既有二值語意，ContentParser DI 消費）
 *
 * 委派 detectInterchangeSource 做四來源辨識後收斂值域（H1，ADR-2，單一真值來源）：
 * - 'v2' / 'v1' → 原樣回傳
 * - 'canonical' / 'app-legacy' → null（既有二值消費端不消費這兩個新來源，由
 *   .2.2 注入的 detectInterchangeSource 分流；TD-1：未來消費端需區分時重評）
 *
 * 既有「v2 隱含偵測」（metadata + books 含 readingStatus）為 detectFormatVersion
 * 專屬啟發式（非四來源 canonical 辨識的一部分），保留為委派回 'v1'/null 後的 fallback，
 * 確保既有測試（B5 回歸）行為不變且不污染四來源真值來源。
 *
 * @param {*} data - 解析後的 JSON 資料
 * @returns {'v1' | 'v2' | null} 格式版本
 */
function detectFormatVersion (data) {
  const source = detectInterchangeSource(data)

  switch (source) {
    case 'v2':
      return 'v2'
    case 'v1':
      // 四來源判為 flat v1；再套用 detectFormatVersion 專屬的 v2 隱含偵測啟發式
      return hasImplicitV2Signal(data) ? 'v2' : 'v1'
    case 'canonical':
    case 'app-legacy':
      // 四來源新語意，既有二值消費端不消費（由新 detector 分流）
      return null
    default:
      // source === null；無四來源標記，仍套用 v2 隱含偵測啟發式
      return hasImplicitV2Signal(data) ? 'v2' : null
  }
}

/**
 * detectFormatVersion 專屬的「v2 隱含偵測」啟發式：
 * 有 metadata + books 陣列且任一 book 含 readingStatus → 視為內部 v2。
 *
 * 此啟發式非四來源 canonical 辨識的一部分（detectInterchangeSource 不含此規則），
 * 僅為保護既有 ContentParser 消費行為（B5 回歸）而保留於 detectFormatVersion。
 *
 * @param {*} data
 * @returns {boolean}
 */
function hasImplicitV2Signal (data) {
  if (!isLookupableObject(data) || Array.isArray(data)) {
    return false
  }
  if (!data.metadata || !Array.isArray(data.books)) {
    return false
  }
  return data.books.some(
    book => book && typeof book === 'object' && 'readingStatus' in book
  )
}

/**
 * 偵測 CSV 匯入資料的格式版本
 *
 * @param {string[]} headers - CSV 標題行欄位名稱陣列
 * @returns {'v1' | 'v2'} 格式版本（預設降級為 v1）
 */
function detectCsvFormatVersion (headers) {
  if (!Array.isArray(headers)) {
    return 'v1'
  }

  if (headers.includes('readingStatus')) {
    return 'v2'
  }

  // isNew/isFinished 是 v1 特徵，但即使沒有也降級為 v1
  return 'v1'
}

module.exports = {
  detectInterchangeSource,
  detectFormatVersion,
  detectCsvFormatVersion
}
