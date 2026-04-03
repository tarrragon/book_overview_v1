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

const TARGET_SCHEMA_VERSION = '3.0.0'
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
 * 需求：支援多種輸入格式，統一為 number 0~100
 * - number 0~100 → 保留
 * - object {progress: N} → 提取 N
 * - string → parseInt
 * - null/undefined → 0
 * - 負數 → 0
 * - 超過 100 → 100
 *
 * @param {*} value - 任意格式的 progress 值
 * @returns {number} 正規化後的 progress（0~100）
 */
function normalizeProgress (value) {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === 'object' && value !== null && 'progress' in value) {
    return normalizeProgress(value.progress)
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? 0 : clampProgress(parsed)
  }

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : clampProgress(value)
  }

  return 0
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
 * 需求：轉換規則（優先順序由高到低）
 * 1. isFinished === true → 'finished'
 * 2. progress >= 100 → 'finished'
 * 3. progress > 0 → 'reading'
 * 4. 其餘 → 'unread'
 *
 * @param {object} book - v1 格式書籍
 * @returns {'finished'|'reading'|'unread'} 閱讀狀態
 */
function migrateReadingStatus (book) {
  if (book.isFinished === true) {
    return 'finished'
  }

  const progress = normalizeProgress(book.progress)

  if (progress >= 100) {
    return 'finished'
  }

  if (progress > 0) {
    return 'reading'
  }

  return 'unread'
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

  // 步驟 0: 檢查是否需要遷移
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

  // 步驟 1: 備份原始資料
  try {
    await storage.set({
      migration_backup: { readmoo_books: books }
    })
  } catch (backupError) {
    const isQuotaError = backupError.message &&
      backupError.message.includes('QUOTA_BYTES')
    if (isQuotaError) {
      logger.error(`配額不足: ${backupError.message}`)
    } else {
      logger.error(`備份失敗: ${backupError.message}`)
    }
    return { migrated: false, error: backupError.message }
  }

  // 步驟 2-4: 執行遷移（在 try-catch 中，失敗時從 backup 還原）
  try {
    // 步驟 2: 建立 tag_categories 預設資料
    await storage.set({ tag_categories: DEFAULT_TAG_CATEGORIES })

    // 步驟 3: 建立 tags 空陣列
    await storage.set({ tags: [] })

    // 步驟 4: 轉換書籍
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

      // 已是 v2 格式的書籍保持不變
      if (isV2Book(book)) {
        migratedBooks.push(book)
        continue
      }

      try {
        migratedBooks.push(migrateBook(book))
      } catch (bookError) {
        logger.error(`書籍 ${book.id} 遷移失敗: ${bookError.message}`)
        // 單本書失敗不影響其他
      }
    }

    await storage.set({ readmoo_books: migratedBooks })

    // 步驟 5: 寫入 schema_version
    await storage.set({ schema_version: TARGET_SCHEMA_VERSION })

    // 步驟 6: 刪除備份
    await storage.remove(['migration_backup'])

    logger.info(`遷移完成：${migratedBooks.length} 本書已轉換`)
    return { migrated: true }
  } catch (migrationError) {
    // 遷移失敗 — 嘗試從 backup 還原
    const isQuotaError = migrationError.message &&
      migrationError.message.includes('QUOTA_BYTES')
    if (isQuotaError) {
      logger.error(`配額不足: ${migrationError.message}`)
    } else {
      logger.error(`遷移失敗: ${migrationError.message}`)
    }

    try {
      await rollbackMigration(storage, logger)
    } catch (rollbackError) {
      logger.error(`回滾失敗: ${rollbackError.message}`)
    }

    return { migrated: false, error: migrationError.message }
  }
}

module.exports = {
  migrateV1ToV2,
  migrateReadingStatus,
  normalizeProgress,
  rollbackMigration
}
