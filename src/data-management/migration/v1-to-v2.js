/**
 * Schema Migration v1 → v2 (Tag-based Book Model)
 *
 * 需求：將 v1 書籍格式（isNew/isFinished 欄位）遷移為 v2 格式（readingStatus/tagIds）
 *
 * 遷移步驟（依序）：
 * 0. 備份 readmoo_books → migration_backup
 * 1. 建立 tag_categories 預設資料
 * 2. 建立 tags 空陣列
 * 3. 轉換書籍欄位
 * 4. 寫入 schema_version: '3.0.0'
 * 5. 刪除 migration_backup
 *
 * 失敗處理：
 * - 備份失敗 → 中止遷移
 * - 單本書失敗 → 跳過繼續
 * - 寫入失敗 → 從 backup 還原
 * - 配額不足 → 中止遷移
 */

const { mapV1StatusToV2, normalizeV1Progress, SCHEMA_VERSION } = require('../BookSchemaV2')

const TARGET_SCHEMA_VERSION = SCHEMA_VERSION
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

/**
 * 預設 tag 分類資料
 * 需求：遷移時自動建立系統類型分類和自訂標籤分類
 */
const DEFAULT_TAG_CATEGORIES = [
  { id: 'cat_system_type', name: '書籍類型' },
  { id: 'cat_user_custom', name: '自訂標籤' }
]

/**
 * 正規化 progress 值為 0~100 的數字
 *
 * 委派至 BookSchemaV2.normalizeV1Progress 進行核心正規化（拆包、NaN 處理），
 * 再以 clampProgress 限制在 0~100 範圍內。
 *
 * 需求：支援多種輸入格式，統一為 number 0~100
 *
 * @param {*} value - 任意格式的 progress 值
 * @returns {number} 正規化後的 progress（0~100）
 */
function normalizeProgress (value) {
  return clampProgress(normalizeV1Progress(value))
}

/**
 * 將 progress 值限制在 0~100 範圍
 * @param {number} value
 * @returns {number}
 */
function clampProgress (value) {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

/**
 * 依 v1 書籍欄位推斷閱讀狀態
 *
 * 委派至 BookSchemaV2.mapV1StatusToV2，消除 DRY 違反。
 * 保留此函式作為向後相容的包裝器。
 *
 * @param {object} book - v1 格式書籍
 * @returns {'finished'|'reading'|'unread'} 閱讀狀態
 */
function migrateReadingStatus (book) {
  return mapV1StatusToV2(book)
}

/**
 * 判斷書籍是否已是 v2 格式
 * 需求：已有 readingStatus 欄位的書籍視為已遷移，跳過轉換
 *
 * @param {object} book
 * @returns {boolean}
 */
function isV2Book (book) {
  return 'readingStatus' in book && 'tagIds' in book
}

/**
 * 轉換單本書籍從 v1 → v2 格式
 *
 * 需求：
 * - 刪除 isNew, isFinished
 * - 新增 readingStatus（依轉換規則）
 * - 新增 tagIds: []
 * - 新增 isManualStatus: false
 * - 新增 updatedAt: 遷移時間
 * - 保留原有欄位（id, title, author, coverUrl, addedAt, progress）
 *
 * @param {object} book - v1 格式書籍
 * @returns {object} v2 格式書籍
 */
function migrateBook (book) {
  const { isNew, isFinished, ...preserved } = book
  return {
    ...preserved,
    readingStatus: migrateReadingStatus(book),
    tagIds: [],
    isManualStatus: false,
    updatedAt: new Date().toISOString()
  }
}

/**
 * 判斷是否需要執行遷移
 *
 * 需求：
 * - schema_version === '3.0.0' → 跳過
 * - 其他任何值（null, '2.0.0', 未知, 無效格式）→ 觸發遷移
 *
 * @param {string|null|undefined} schemaVersion
 * @param {object} logger
 * @returns {{shouldMigrate: boolean, reason: string}}
 */
function checkMigrationNeeded (schemaVersion, logger) {
  if (schemaVersion === TARGET_SCHEMA_VERSION) {
    return { shouldMigrate: false, reason: 'already_migrated' }
  }

  if (schemaVersion !== null && schemaVersion !== undefined) {
    if (!SEMVER_PATTERN.test(schemaVersion)) {
      logger.error(`schema_version 格式無效: ${schemaVersion}`)
    } else if (schemaVersion !== '2.0.0') {
      logger.warn(`未知版本: ${schemaVersion}，將嘗試遷移`)
    }
  }

  return { shouldMigrate: true, reason: 'needs_migration' }
}

/**
 * 從備份還原資料
 *
 * @param {object} storage - Chrome Storage API mock
 * @param {object} logger
 * @returns {Promise<{restored: boolean, reason?: string}>}
 */
async function rollbackMigration (storage, logger) {
  const backupData = await storage.get(['migration_backup'])

  if (!backupData.migration_backup) {
    logger.warn('回滾失敗：找不到 migration_backup')
    return { restored: false, reason: 'no_backup' }
  }

  const backup = backupData.migration_backup

  // 還原 readmoo_books
  await storage.set({ readmoo_books: backup.readmoo_books })

  // 刪除遷移過程中建立的新 key
  await storage.remove(['tag_categories', 'tags', 'schema_version', 'migration_backup'])

  logger.info('回滾成功：已從 backup 還原')
  return { restored: true }
}

/**
 * 備份原始書籍資料至 migration_backup
 *
 * @param {object} storage - Chrome Storage API
 * @param {Array} books - 原始書籍陣列
 * @param {object} logger
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createBackup (storage, books, logger) {
  try {
    await storage.set({ migration_backup: { readmoo_books: books } })
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
 * 批量轉換書籍從 v1 → v2 格式
 * 需求：單本書失敗不影響其他書籍，null/無 id 書籍跳過
 *
 * @param {Array} books - v1 格式書籍陣列
 * @param {object} logger
 * @returns {Array} 轉換後的 v2 書籍陣列
 */
function convertBooks (books, logger) {
  const migratedBooks = []
  for (const book of books) {
    if (book === null || book === undefined) {
      logger.warn('跳過 null/undefined 書籍')
      continue
    }
    if (!book.id) {
      logger.error(`書籍缺少 id，跳過: ${JSON.stringify(book)}`)
      continue
    }
    if (isV2Book(book)) {
      migratedBooks.push(book)
      continue
    }
    try {
      migratedBooks.push(migrateBook(book))
    } catch (bookError) {
      logger.error(`書籍 ${book.id} 遷移失敗: ${bookError.message}`)
    }
  }
  return migratedBooks
}

/**
 * 記錄遷移錯誤並嘗試回滾
 *
 * @param {Error} migrationError - 遷移過程中的錯誤
 * @param {object} storage
 * @param {object} logger
 */
async function handleMigrationError (migrationError, storage, logger) {
  const isQuotaError = migrationError.message &&
    migrationError.message.includes('QUOTA_BYTES')
  logger.error(isQuotaError
    ? `配額不足: ${migrationError.message}`
    : `遷移失敗: ${migrationError.message}`)

  try {
    await rollbackMigration(storage, logger)
  } catch (rollbackError) {
    logger.error(`回滾失敗: ${rollbackError.message}`)
  }
}

/**
 * 主遷移函式：v1 → v2
 *
 * 需求：完整遷移流程（備份 → 建立預設資料 → 轉換書籍 → 更新版本 → 清除備份）
 *
 * @param {object} storage - Chrome Storage API（get/set/remove）
 * @param {object} logger - 日誌記錄器（info/warn/error/debug）
 * @returns {Promise<{migrated: boolean, error?: string, reason?: string}>}
 */
async function migrateV1ToV2 (storage, logger) {
  logger.info('開始 Schema Migration v1 → v2')

  const storageData = await storage.get(['schema_version', 'readmoo_books'])
  const schemaVersion = storageData.schema_version !== undefined
    ? storageData.schema_version
    : null

  const { shouldMigrate, reason } = checkMigrationNeeded(schemaVersion, logger)
  if (!shouldMigrate) {
    logger.info('遷移已完成，跳過')
    return { migrated: false, reason }
  }

  const books = storageData.readmoo_books || []

  const backupResult = await createBackup(storage, books, logger)
  if (!backupResult.success) {
    return { migrated: false, error: backupResult.error }
  }

  try {
    await storage.set({ tag_categories: DEFAULT_TAG_CATEGORIES })
    await storage.set({ tags: [] })

    const migratedBooks = convertBooks(books, logger)
    await storage.set({ readmoo_books: migratedBooks })
    await storage.set({ schema_version: TARGET_SCHEMA_VERSION })
    await storage.remove(['migration_backup'])

    logger.info(`遷移完成：${migratedBooks.length} 本書已轉換`)
    return { migrated: true }
  } catch (migrationError) {
    await handleMigrationError(migrationError, storage, logger)
    return { migrated: false, error: migrationError.message }
  }
}

module.exports = {
  migrateV1ToV2,
  migrateReadingStatus,
  normalizeProgress,
  rollbackMigration
}
