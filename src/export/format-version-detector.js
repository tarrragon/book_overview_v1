'use strict'

/**
 * Export 格式版本偵測模組
 * 偵測匯入 JSON/CSV 資料是 v1（category-based）還是 v2（tag-based）格式
 *
 * @module format-version-detector
 */

/**
 * 偵測 JSON 匯入資料的格式版本
 *
 * @param {*} data - 解析後的 JSON 資料
 * @returns {'v1' | 'v2' | null} 格式版本
 */
function detectFormatVersion (data) {
  if (data === null || data === undefined || typeof data !== 'object') {
    return null
  }

  // Rule 1: 明確版本號
  const formatVersion = data?.metadata?.formatVersion
  if (typeof formatVersion === 'string' && formatVersion.startsWith('2.')) {
    return 'v2'
  }

  // Rule 2: 有 metadata + books 含 readingStatus
  if (data?.metadata && Array.isArray(data?.books)) {
    const hasReadingStatus = data.books.some(
      book => book && typeof book === 'object' && 'readingStatus' in book
    )
    if (hasReadingStatus) {
      return 'v2'
    }
  }

  // Rule 3: 純陣列 → v1
  if (Array.isArray(data)) {
    return 'v1'
  }

  // Rule 4: 有 books 但無 formatVersion → v1
  if (Array.isArray(data?.books)) {
    return 'v1'
  }

  // Rule 5: 無法辨識
  return null
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

module.exports = { detectFormatVersion, detectCsvFormatVersion }
