/**
 * 既有無 ID 書目修復遷移（UUID 補生成）
 *
 * 需求：stable-id-generator 實裝前提取的書目可能 id/bookId 皆為 falsy，
 * 導致 Overview checkbox 不顯示（1.6.0-W3-007 根因）。W4-002 已在
 * event-coordinator 正規化層修復「新提取書目」，本 module 修復既有
 * storage 中已殘留的無 ID 書目。
 *
 * 流程（仿 v1-to-v2.js 備份 → 轉換 → 寫回模式）：
 *   1. 遍歷 PLATFORM_IDS 對應的 storage key（readmoo_books 等）
 *   2. 找出 id 為 falsy 的書目
 *   3. 若書目有 bookId，先映射為 platformBookId（對齊 W4-002 正規化邏輯）
 *   4. 補生成 UUID 作為 id
 *   5. 寫回 storage；任一階段失敗 → 從 backup 還原
 */

const { PLATFORM_IDS, platformBooksKey } = require('../../background/constants/module-constants')

const BACKUP_KEY = 'migration_backup_missing_ids'

/**
 * 修復單本書籍缺失的 id
 * 需求：bookId 存在時映射為 platformBookId，再補生成 UUID
 *
 * @param {object} book - 缺失 id 的書籍
 * @returns {object} 修復後的書籍（新物件）
 */
function fixBookId (book) {
  const fixed = { ...book }
  if (fixed.bookId) {
    fixed.platformBookId = fixed.bookId
  }
  fixed.id = globalThis.crypto.randomUUID()
  return fixed
}

/**
 * 修復單一 platform 書目陣列中所有缺失 id 的書籍
 * 需求：已有 truthy id 的書籍原樣保留（不修改）
 *
 * @param {Array} books - 書目陣列
 * @param {object} logger
 * @returns {{books: Array<object>, fixedCount: number}}
 */
function fixBooksMissingIds (books, logger) {
  let fixedCount = 0
  const fixedBooks = books.map(book => {
    if (book === null || book === undefined) {
      logger.warn('跳過 null/undefined 書籍')
      return book
    }
    if (book.id) return book
    fixedCount++
    return fixBookId(book)
  })
  return { books: fixedBooks, fixedCount }
}

/**
 * 備份指定 platform keys 的原始書目資料
 *
 * @param {object} storage - Chrome Storage API
 * @param {object} snapshot - { [platformBooksKey]: books[] }
 * @param {object} logger
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createBackup (storage, snapshot, logger) {
  try {
    await storage.set({ [BACKUP_KEY]: snapshot })
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
 * 從備份還原所有 platform 書目資料
 *
 * @param {object} storage - Chrome Storage API
 * @param {object} logger
 * @returns {Promise<{restored: boolean, reason?: string}>}
 */
async function rollbackMigration (storage, logger) {
  const backupData = await storage.get([BACKUP_KEY])
  const snapshot = backupData[BACKUP_KEY]

  if (!snapshot) {
    logger.warn(`回滾失敗：找不到 ${BACKUP_KEY}`)
    return { restored: false, reason: 'no_backup' }
  }

  await storage.set(snapshot)
  await storage.remove([BACKUP_KEY])

  logger.info('回滾成功：已從 backup 還原')
  return { restored: true }
}

/**
 * 讀取所有 platform 書目並找出含缺失 id 書目的 snapshot
 *
 * @param {object} storageData - storage.get(platformKeys) 結果
 * @param {Array<string>} platformKeys
 * @returns {{snapshot: object, hasMissing: boolean}}
 */
function collectSnapshot (storageData, platformKeys) {
  const snapshot = {}
  let hasMissing = false
  for (const key of platformKeys) {
    const books = storageData[key]
    if (!Array.isArray(books) || books.length === 0) continue
    snapshot[key] = books
    if (books.some(book => book && !book.id)) {
      hasMissing = true
    }
  }
  return { snapshot, hasMissing }
}

/**
 * 對 snapshot 中每個 platform 套用修復，彙整寫回資料與統計
 *
 * @param {object} snapshot - { [platformBooksKey]: books[] }
 * @param {object} logger
 * @returns {{updates: object, stats: object, totalFixed: number}}
 */
function applyFixes (snapshot, logger) {
  const updates = {}
  const stats = {}
  let totalFixed = 0

  for (const key of Object.keys(snapshot)) {
    const { books, fixedCount } = fixBooksMissingIds(snapshot[key], logger)
    updates[key] = books
    if (fixedCount > 0) stats[key] = fixedCount
    totalFixed += fixedCount
  }

  return { updates, stats, totalFixed }
}

/**
 * 主修復函式：掃描所有 platform 書目，補生成缺失的 UUID
 *
 * @param {object} storage - Chrome Storage API（get/set/remove）
 * @param {object} logger - 日誌記錄器（info/warn/error/debug）
 * @returns {Promise<{fixed: boolean, error?: string, reason?: string, stats?: object, totalFixed?: number}>}
 */
async function fixMissingBookIds (storage, logger) {
  logger.info('開始修復既有無 ID 書目')

  const platformKeys = Object.values(PLATFORM_IDS).map(platformBooksKey)
  const storageData = await storage.get(platformKeys)
  const { snapshot, hasMissing } = collectSnapshot(storageData, platformKeys)

  if (!hasMissing) {
    logger.info('無缺失 ID 書目，跳過修復')
    return { fixed: false, reason: 'no_missing_ids' }
  }

  const backupResult = await createBackup(storage, snapshot, logger)
  if (!backupResult.success) {
    return { fixed: false, error: backupResult.error }
  }

  try {
    const { updates, stats, totalFixed } = applyFixes(snapshot, logger)
    await storage.set(updates)
    await storage.remove([BACKUP_KEY])

    logger.info(`修復完成：共 ${totalFixed} 本書補生成 ID`)
    return { fixed: true, stats, totalFixed }
  } catch (migrationError) {
    logger.error(`修復失敗: ${migrationError.message}`)
    try {
      await rollbackMigration(storage, logger)
    } catch (rollbackError) {
      logger.error(`回滾失敗: ${rollbackError.message}`)
    }
    return { fixed: false, error: migrationError.message }
  }
}

module.exports = {
  fixMissingBookIds,
  fixBooksMissingIds,
  rollbackMigration
}
