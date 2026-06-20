/**
 * JSON 匯入模組（App→Web 反向同步的 Extension 端，PROP-012 §2.2）
 *
 * 三公開函式：
 *   parseAndValidate(fileContent)     — 同步，純函式（解析 + 格式驗證 + metadata 提取 + 空書攔截）
 *   checkStaleness(exportedAt)        — async，讀 chrome.storage.local 防舊蓋新
 *   executeImport(fileContent, opts?) — async，編排完整匯入流程
 *
 * 設計邊界：本模組為 export/storage 公開 API 的純消費者，不修改其介面。
 * 合併摘要採前後快照比對（mergeAllData 黑盒），TD-IMP-1 追蹤未來內部回傳 diff。
 */

// 以模組物件持有依賴（非解構），使下游具名 export 可被測試 spy 攔截，
// 同時保留實際呼叫行為不變。
const formatDetector = require('../export/format-version-detector')
const bookAdapter = require('../export/book-interchange-v1-adapter')
const v1v2Converter = require('../export/v1-to-v2-converter')
const TagStorageAdapter = require('../storage/adapters/tag-storage-adapter')
const { Logger } = require('../core/logging/Logger')

const { STORAGE_KEYS } = TagStorageAdapter

const logger = new Logger('[json-importer]', 'INFO')

const IMPORT_ERROR_CODES = {
  PARSE_ERROR: 'IMPORT_PARSE_ERROR',
  UNKNOWN_FORMAT: 'IMPORT_UNKNOWN_FORMAT',
  STALE_DATA: 'IMPORT_STALE_DATA',
  STORAGE_ERROR: 'IMPORT_STORAGE_ERROR',
  FILE_READ_ERROR: 'IMPORT_FILE_READ_ERROR',
  EMPTY_BOOKS: 'IMPORT_EMPTY_BOOKS'
}

const LAST_IMPORTED_AT_KEY = 'last_imported_at'

function makeError (code, message) {
  return { code, message: message || code }
}

/**
 * 從解析後資料依來源格式取出 books 陣列。
 * v1 可能是純陣列；其餘為 { books: [...] } 結構。
 */
function extractBooksArray (data, source) {
  if (source === 'v1' && Array.isArray(data)) return data
  if (data && Array.isArray(data.books)) return data.books
  return []
}

/**
 * 解析 JSON 字串並驗證結構。
 *
 * @param {string} fileContent - File API 讀取的原始文字內容
 * @returns {Object} ParseResult { data, source, metadata, bookCount } 或 ImportError { code, message }
 */
function parseAndValidate (fileContent) {
  if (typeof fileContent !== 'string' || fileContent.length === 0) {
    logger.warn('IMPORT_PARSE_INVALID_INPUT', { component: 'json-importer' })
    return makeError(IMPORT_ERROR_CODES.PARSE_ERROR, '檔案格式錯誤，無法解析 JSON')
  }

  let parsedData
  try {
    parsedData = JSON.parse(fileContent)
  } catch (err) {
    logger.warn('IMPORT_PARSE_FAILED', { component: 'json-importer', error: err.message })
    return makeError(IMPORT_ERROR_CODES.PARSE_ERROR, '檔案格式錯誤，無法解析 JSON')
  }

  const source = formatDetector.detectInterchangeSource(parsedData)
  if (source === null) {
    logger.warn('IMPORT_UNKNOWN_FORMAT', { component: 'json-importer' })
    return makeError(IMPORT_ERROR_CODES.UNKNOWN_FORMAT, '無法識別的檔案格式')
  }

  const metadata = { exportedAt: null, sourceApp: null, totalBooks: null }
  if (source === 'canonical' && parsedData.metadata) {
    metadata.exportedAt = parsedData.metadata.exportedAt != null ? parsedData.metadata.exportedAt : null
    metadata.sourceApp = parsedData.metadata.sourceApp != null ? parsedData.metadata.sourceApp : null
    metadata.totalBooks = parsedData.metadata.totalBooks != null ? parsedData.metadata.totalBooks : null
  }

  const books = extractBooksArray(parsedData, source)
  if (books.length === 0) {
    return makeError(IMPORT_ERROR_CODES.EMPTY_BOOKS, '匯入檔案中沒有書籍資料')
  }

  if (metadata.totalBooks !== null && metadata.totalBooks !== books.length) {
    logger.warn('IMPORT_TOTAL_BOOKS_MISMATCH', {
      component: 'json-importer',
      declared: metadata.totalBooks,
      actual: books.length
    })
  }

  return { data: parsedData, source, metadata, bookCount: books.length }
}

/**
 * Promise 包裝 chrome.storage.local.get（mock 為 callback-only，需顯式包裝避免永久 pending）。
 */
function getFromLocal (key) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn, v) => { if (!settled) { settled = true; fn(v) } }
    const maybePromise = chrome.storage.local.get([key], (result) => {
      const lastError = chrome.runtime && chrome.runtime.lastError
      if (lastError) settle(reject, new Error(lastError.message || String(lastError)))
      else settle(resolve, (result && result[key]) != null ? result[key] : null)
    })
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(
        (result) => settle(resolve, (result && result[key]) != null ? result[key] : null),
        (err) => settle(reject, err)
      )
    }
  })
}

function setToLocal (items) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn, v) => { if (!settled) { settled = true; fn(v) } }
    const maybePromise = chrome.storage.local.set(items, () => {
      const lastError = chrome.runtime && chrome.runtime.lastError
      if (lastError) settle(reject, new Error(lastError.message || String(lastError)))
      else settle(resolve)
    })
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(() => settle(resolve), (err) => settle(reject, err))
    }
  })
}

/**
 * 比較匯出時間與本機上次匯入時間，防舊蓋新。
 *
 * @param {string|null} exportedAt - ISO8601 匯出時間
 * @returns {Promise<Object>} StalenessResult { isStale, exportedAt, lastImportedAt }
 */
async function checkStaleness (exportedAt) {
  let lastImportedAt = null
  try {
    lastImportedAt = await getFromLocal(LAST_IMPORTED_AT_KEY)
  } catch (err) {
    logger.warn('IMPORT_STALENESS_READ_FAILED', { component: 'json-importer', error: err.message })
    return { isStale: false, exportedAt: exportedAt || null, lastImportedAt: null }
  }

  if (exportedAt == null) {
    return { isStale: false, exportedAt: null, lastImportedAt }
  }
  if (lastImportedAt == null) {
    return { isStale: false, exportedAt, lastImportedAt: null }
  }

  const exp = new Date(exportedAt)
  const imp = new Date(lastImportedAt)
  if (isNaN(exp.getTime()) || isNaN(imp.getTime())) {
    logger.warn('IMPORT_STALENESS_INVALID_DATE', { component: 'json-importer', exportedAt, lastImportedAt })
    return { isStale: false, exportedAt, lastImportedAt }
  }

  return { isStale: exp < imp, exportedAt, lastImportedAt }
}

/**
 * 讀取本機書籍陣列（readmoo_books 可能是陣列或 { books: [...] }）。
 */
async function loadLocalBooks () {
  const raw = await getFromLocal(STORAGE_KEYS.READMOO_BOOKS)
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (raw.books && Array.isArray(raw.books)) return raw.books
  return []
}

/**
 * 依來源格式分流轉換為 mergeAllData 輸入 { books, tags, tagCategories }。
 */
function convertBySource (parseResult) {
  const { data, source } = parseResult
  if (source === 'canonical') {
    const books = data.books.map(b => bookAdapter.mapCanonicalToV1Book(b))
    // buildTagTree 產出 { ccl, custom }；mergeAllData 消費 flat tags/tagCategories，
    // canonical tagTree→category 映射為 TD-IMP-2，此處暫不展開（books 自帶 tags）。
    bookAdapter.buildTagTree(data.books)
    return { books, tags: [], tagCategories: [] }
  }
  if (source === 'app-legacy') {
    const converted = v1v2Converter.convertAppLegacyToV2Data(data)
    return {
      books: converted.books || [],
      tags: converted.tags || [],
      tagCategories: converted.tagCategories || []
    }
  }
  // v2 / v1：books 直接使用
  const books = extractBooksArray(data, source)
  return {
    books,
    tags: Array.isArray(data.tags) ? data.tags : [],
    tagCategories: Array.isArray(data.tagCategories) ? data.tagCategories : []
  }
}

/**
 * 比對合併前後本機書籍，計算新增/更新/不變摘要。
 */
function computeSummary (beforeMap, afterBooks) {
  let added = 0
  let updated = 0
  for (const book of afterBooks) {
    if (!beforeMap.has(book.id)) {
      added += 1
    } else if (beforeMap.get(book.id) !== book.updatedAt) {
      updated += 1
    }
  }
  const total = afterBooks.length
  const unchanged = total - added - updated
  return { added, updated, unchanged, total }
}

/**
 * 完整匯入流程編排。
 *
 * @param {string} fileContent - File API 讀取的原始文字內容
 * @param {Object} [options] - { skipStalenessCheck?: boolean }
 * @returns {Promise<Object>} ImportResult { success, summary?, source?, importedAt?, error? }
 */
async function executeImport (fileContent, options = {}) {
  const parseResult = parseAndValidate(fileContent)
  if (parseResult.code) {
    return { success: false, error: parseResult }
  }

  const staleness = await checkStaleness(parseResult.metadata.exportedAt)
  if (staleness.isStale && !options.skipStalenessCheck) {
    logger.warn('IMPORT_STALE_DATA', {
      component: 'json-importer',
      exportedAt: staleness.exportedAt,
      lastImportedAt: staleness.lastImportedAt
    })
    return {
      success: false,
      error: makeError(IMPORT_ERROR_CODES.STALE_DATA, '匯入檔案較舊（非終止，可確認繼續）'),
      staleness
    }
  }

  const { books, tags, tagCategories } = convertBySource(parseResult)

  const beforeBooks = await loadLocalBooks()
  const beforeMap = new Map(beforeBooks.map(b => [b.id, b.updatedAt]))

  const mergeResult = await TagStorageAdapter.mergeAllData({ books, tags, tagCategories })
  if (!mergeResult.success) {
    logger.error('IMPORT_STORAGE_FAILED', { component: 'json-importer', error: mergeResult.error })
    return {
      success: false,
      error: makeError(IMPORT_ERROR_CODES.STORAGE_ERROR, '儲存失敗，請重試')
    }
  }

  const afterBooks = await loadLocalBooks()
  const summary = computeSummary(beforeMap, afterBooks)

  const importedAt = new Date().toISOString()
  await setToLocal({ [LAST_IMPORTED_AT_KEY]: importedAt })

  return { success: true, summary, source: parseResult.source, importedAt }
}

module.exports = {
  parseAndValidate,
  checkStaleness,
  executeImport,
  IMPORT_ERROR_CODES
}
