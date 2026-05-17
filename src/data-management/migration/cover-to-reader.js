/**
 * Schema Migration cover-XXX → reader-XXX (Real ID Recovery)
 *
 * 需求：v1 提取器將 cover image URL 截出的片段作為 book.id（`cover-XXX`），
 * 此 id 無法反查 Readmoo 真實書籍（深連結 / sync / 書城跳轉皆失效）。
 * 本 migration 將 id 由 `cover-XXX` 升級為 `reader-{privacyBookId}`，
 * privacyBookId 來自 v0.18.0 提取器補抓的 SPA 內部欄位。
 *
 * 5 案例合併規則（W6-012.2.2 Solution）：
 *   Case 1 正常遷移：cover-XXX + identifiers.privacyBookId 存在
 *     → 新 id=reader-{privacyBookId}，保留所有自訂欄位
 *   Case 2 privacyBookId 為空：cover-XXX + identifiers.privacyBookId=''
 *     → 保留舊 id，標記 requires_manual_review=true
 *   Case 3 cover-openbook 共用：多本 id=cover-openbook（corrupt）
 *     → 以 title + extractedAt 作 secondary key 去重，標記 legacy_duplicate
 *   Case 4 同 privacyBookId 多筆：遷移後同 reader-XXX ID 有舊新兩條
 *     → 採時間較新為主，tagIds 等自訂欄位採並集
 *   Case 5 跨裝置 sync 衝突：屬範圍外 follow-up，本 module 不處理
 *
 * 流程（仿 v1-to-v2.js）：
 *   1. 備份 readmoo_books → migration_backup_v3_1
 *   2. 套用合併規則（純函式 transformBooks）
 *   3. 寫入 readmoo_books + schema_version='3.1.0'
 *   4. 任一階段失敗 → 從 backup 還原
 *
 * 範圍邊界：
 * - 本 module 僅實作 cover→reader id 轉換 + 4 個案例合併
 * - 不處理 cross-device sync conflict（case 5）
 * - 不變更 UI 標記呈現方式（屬後續 W6-012.5 UI ticket）
 */

const TARGET_SCHEMA_VERSION = '3.1.0'
const BACKUP_KEY = 'migration_backup_v3_1'
const COVER_PREFIX = 'cover-'
const COVER_OPENBOOK_ID = 'cover-openbook'
const READER_PREFIX = 'reader-'

/**
 * 判斷書籍 id 是否屬於 cover-XXX 模式（需要遷移的舊格式）
 */
function isCoverIdBook (book) {
  return typeof book.id === 'string' && book.id.startsWith(COVER_PREFIX)
}

/**
 * 取得書籍的 privacyBookId（容錯讀取 identifiers）
 *
 * @returns {string} privacyBookId 字串，缺失時回傳空字串
 */
function getPrivacyBookId (book) {
  if (!book.identifiers || typeof book.identifiers !== 'object') return ''
  const value = book.identifiers.privacyBookId
  return typeof value === 'string' ? value : ''
}

/**
 * 取得書籍時間欄位用於 case 4 新舊比對
 * 優先序：updatedAt > extractedAt > addedAt > '' （空字串 < 任何 ISO 字串）
 */
function getBookTimestamp (book) {
  return book.updatedAt || book.extractedAt || book.addedAt || ''
}

/**
 * 合併兩本同 reader-id 書籍（Case 4）
 * 規則：較新時間為主體，tagIds 採並集
 */
function mergeDuplicateReader (existing, incoming) {
  const existingTs = getBookTimestamp(existing)
  const incomingTs = getBookTimestamp(incoming)
  const newer = incomingTs >= existingTs ? incoming : existing
  const older = newer === incoming ? existing : incoming

  const tagIds = unionTagIds(newer.tagIds, older.tagIds)
  return { ...newer, tagIds }
}

/**
 * tagIds 並集（保序：先 a 後 b，去重）
 */
function unionTagIds (a, b) {
  const result = []
  const seen = new Set()
  for (const list of [a, b]) {
    if (!Array.isArray(list)) continue
    for (const tag of list) {
      if (!seen.has(tag)) {
        seen.add(tag)
        result.push(tag)
      }
    }
  }
  return result
}

/**
 * 轉換單本 cover-XXX 書籍（Case 1）
 */
function migrateCoverToReaderBook (book, privacyBookId) {
  return {
    ...book,
    id: `${READER_PREFIX}${privacyBookId}`,
    legacy_cover_id: book.id,
    updatedAt: new Date().toISOString()
  }
}

/**
 * 標記書籍為需手動審核（Case 2）
 */
function markRequiresManualReview (book) {
  return {
    ...book,
    requires_manual_review: true,
    updatedAt: new Date().toISOString()
  }
}

/**
 * 處理 cover-openbook 共用 id 群組（Case 3）
 * 以 title + extractedAt 作 secondary key 去重，標記 legacy_duplicate
 */
function handleCoverOpenbookGroup (group, logger) {
  if (group.length === 0) return []
  const dedup = new Map()
  for (const book of group) {
    const secondaryKey = `${book.title || ''}__${book.extractedAt || ''}`
    if (!dedup.has(secondaryKey)) {
      dedup.set(secondaryKey, book)
    } else {
      logger.warn(`cover-openbook 去重：secondaryKey=${secondaryKey} 重複，保留首個`)
    }
  }
  return Array.from(dedup.values()).map(book => ({
    ...book,
    legacy_duplicate: true,
    requires_manual_review: true,
    updatedAt: new Date().toISOString()
  }))
}

/**
 * 將書籍加入 by-id Map；若 id 已存在則套用 Case 4 合併規則
 */
function addOrMerge (byId, book, logger) {
  if (byId.has(book.id)) {
    const existing = byId.get(book.id)
    const merged = mergeDuplicateReader(existing, book)
    logger.info(`同 id=${book.id} 合併：取新版本 + tagIds 並集`)
    byId.set(book.id, merged)
  } else {
    byId.set(book.id, book)
  }
}

/**
 * 核心轉換邏輯：套用 5 案例合併規則（純函式，無 IO）
 *
 * 流程：
 *   1. 分離 cover-openbook 群組（Case 3），其餘進入主流程
 *   2. 主流程逐本判斷：
 *      - 非 cover-XXX → 原樣保留（已遷移書籍）
 *      - cover-XXX + privacyBookId 空 → Case 2
 *      - cover-XXX + privacyBookId 存在 → Case 1 轉成 reader-XXX
 *   3. 將所有轉換結果以 id 為 key 合併（Case 4 同 reader-id 並集）
 *   4. 附加 Case 3 群組結果
 *
 * @returns {{books: Array<object>, stats: object}}
 */
function transformBooks (books, logger) {
  const stats = { migrated: 0, manualReview: 0, duplicates: 0, unchanged: 0 }
  const openbookGroup = []
  const mainBooks = []

  for (const book of books) {
    if (book === null || book === undefined) {
      logger.warn('跳過 null/undefined 書籍')
      continue
    }
    if (!book.id) {
      logger.error(`書籍缺少 id，跳過: ${JSON.stringify(book)}`)
      continue
    }
    if (book.id === COVER_OPENBOOK_ID) {
      openbookGroup.push(book)
    } else {
      mainBooks.push(book)
    }
  }

  // Case 3：cover-openbook 共用群組
  const openbookResults = handleCoverOpenbookGroup(openbookGroup, logger)
  stats.duplicates = openbookResults.length

  // 主流程：Case 1 / Case 2 / 已遷移書籍
  const byId = new Map()
  for (const book of mainBooks) {
    if (!isCoverIdBook(book)) {
      addOrMerge(byId, book, logger)
      stats.unchanged++
      continue
    }
    const privacyBookId = getPrivacyBookId(book)
    if (!privacyBookId) {
      addOrMerge(byId, markRequiresManualReview(book), logger)
      stats.manualReview++
      continue
    }
    addOrMerge(byId, migrateCoverToReaderBook(book, privacyBookId), logger)
    stats.migrated++
  }

  return {
    books: [...byId.values(), ...openbookResults],
    stats
  }
}

/**
 * 備份原始書籍資料至 BACKUP_KEY
 */
async function createBackup (storage, books, logger) {
  try {
    await storage.set({ [BACKUP_KEY]: { readmoo_books: books } })
    return { success: true }
  } catch (backupError) {
    const isQuotaError = backupError.message &&
      backupError.message.includes('QUOTA_BYTES')
    logger.error(isQuotaError
      ? `配額不足: ${backupError.message}`
      : `備份失敗: ${backupError.message}`)
    return { success: false, error: backupError.message }
  }
}

/**
 * 從備份還原資料（任何階段失敗時呼叫）
 */
async function rollbackMigration (storage, logger) {
  const backupData = await storage.get([BACKUP_KEY])
  const backup = backupData[BACKUP_KEY]
  if (!backup) {
    logger.warn(`回滾失敗：找不到 ${BACKUP_KEY}`)
    return { restored: false, reason: 'no_backup' }
  }
  await storage.set({ readmoo_books: backup.readmoo_books })
  await storage.remove([BACKUP_KEY])
  logger.info('cover-to-reader 回滾成功：已從 backup 還原')
  return { restored: true }
}

/**
 * 主遷移函式：cover-XXX → reader-XXX
 *
 * @param {object} storage - Chrome Storage API（get/set/remove）
 * @param {object} logger
 * @returns {Promise<{migrated: boolean, error?: string, stats?: object, reason?: string}>}
 */
async function migrateCoverToReader (storage, logger) {
  logger.info('開始 Schema Migration cover-XXX → reader-XXX (3.1.0)')

  const storageData = await storage.get(['schema_version', 'readmoo_books'])
  const currentVersion = storageData.schema_version

  if (currentVersion === TARGET_SCHEMA_VERSION) {
    logger.info(`cover-to-reader 已完成 (schema_version=${TARGET_SCHEMA_VERSION})，跳過`)
    return { migrated: false, reason: 'already_migrated' }
  }

  const books = storageData.readmoo_books || []
  if (books.length === 0) {
    await storage.set({ schema_version: TARGET_SCHEMA_VERSION })
    logger.info('空書庫，直接升至 3.1.0')
    return { migrated: true, stats: { migrated: 0, manualReview: 0, duplicates: 0, unchanged: 0 } }
  }

  const backupResult = await createBackup(storage, books, logger)
  if (!backupResult.success) {
    return { migrated: false, error: backupResult.error }
  }

  try {
    const { books: transformed, stats } = transformBooks(books, logger)
    await storage.set({ readmoo_books: transformed })
    await storage.set({ schema_version: TARGET_SCHEMA_VERSION })
    await storage.remove([BACKUP_KEY])

    logger.info(
      `cover-to-reader 完成：migrated=${stats.migrated} ` +
      `manualReview=${stats.manualReview} duplicates=${stats.duplicates} ` +
      `unchanged=${stats.unchanged}`
    )
    return { migrated: true, stats }
  } catch (migrationError) {
    logger.error(`cover-to-reader 失敗: ${migrationError.message}`)
    try {
      await rollbackMigration(storage, logger)
    } catch (rollbackError) {
      logger.error(`回滾失敗: ${rollbackError.message}`)
    }
    return { migrated: false, error: migrationError.message }
  }
}

module.exports = {
  migrateCoverToReader,
  transformBooks,
  rollbackMigration,
  TARGET_SCHEMA_VERSION
}
