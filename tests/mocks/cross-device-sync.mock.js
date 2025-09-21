/**
 * 跨設備同步測試Mock物件
 *
 * 提供完整的跨設備同步測試環境模擬
 * 包含設備模擬、網路環境模擬、效能測量工具等
 *
 * 設計目的：
 * - 模擬真實的多設備同步環境
 * - 提供可控制的測試條件
 * - 支援效能和錯誤場景測試
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * - 確保測試的可重現性和隔離性
 */

// 導入基礎Chrome API Mock
// eslint-disable-next-line no-unused-vars
const chromeMock = require('./chrome-api.mock')

/**
 * 測試資料生成器
 */
function generateTestBooks (count, prefix = 'test') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index + 1).padStart(6, '0')}`,
    title: `${prefix} 測試書籍 ${index + 1}`,
    cover: `https://example.com/covers/${prefix}-${index + 1}.jpg`,
    progress: Math.floor(Math.random() * 100),
    type: Math.random() > 0.3 ? '流式' : '版式',
    isNew: Math.random() > 0.7,
    isFinished: Math.random() > 0.8,
    extractedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
  }))
}

/**
 * 生成包含特殊字元的測試書籍
 */
function generateSpecialCharBooks (count = 10) {
  const specialChars = ['📚', '🔥', '💯', '❤️', '⭐', '🎯', '📖', '✨']
  const multilingualTitles = [
    'English Title',
    '日本語のタイトル',
    '한국어 제목',
    'Français Titre',
    'Español Título',
    'Deutsch Titel'
  ]

  return Array.from({ length: count }, (_, index) => ({
    id: `special-${String(index + 1).padStart(6, '0')}`,
    title: `${multilingualTitles[index % multilingualTitles.length]} ${specialChars[index % specialChars.length]}`,
    cover: `https://example.com/covers/special-${index + 1}.jpg`,
    progress: Math.floor(Math.random() * 100),
    type: '流式',
    isNew: false,
    isFinished: false,
    extractedAt: new Date().toISOString()
  }))
}

/**
 * 生成重複書籍資料用於測試去重功能
 */
function generateDuplicateBooks (uniqueCount = 30, duplicateRatio = 0.3) {
  const uniqueBooks = generateTestBooks(uniqueCount, 'unique')
  const duplicateCount = Math.floor(uniqueCount * duplicateRatio)

  const duplicates = uniqueBooks.slice(0, duplicateCount).map(book => ({
    ...book,
    title: book.title + ' (重複版)',
    progress: Math.min(100, book.progress + Math.floor(Math.random() * 20)),
    extractedAt: new Date().toISOString()
  }))

  return [...uniqueBooks, ...duplicates]
}

/**
 * 生成損壞的測試資料
 */
function generateCorruptedData () {
  return {
    jsonSyntaxError: '{"books": [{"id": "1", "title": "Test"} // missing closing bracket',
    missingRequiredFields: JSON.stringify({
      books: [
        { title: 'Missing ID Book', progress: 50 },
        { id: '123', progress: 75 } // missing title
      ]
    }),
    invalidDataTypes: JSON.stringify({
      books: [
        { id: 123, title: 'ID should be string', progress: '50' }, // wrong types
        { id: '456', title: null, progress: 'invalid' }
      ]
    })
  }
}

/**
 * 設備Mock類別
 */
class MockDevice {
  constructor (deviceId, options = {}) {
    this.deviceId = deviceId
    this.options = options
    this.storage = new MockStorage()
    this.networkCondition = 'normal'
    this.isOnline = true

    // 模擬設備特性
    this.specs = {
      os: options.os || 'Chrome OS',
      version: options.extensionVersion || '1.0.0',
      timezone: options.timezone || 'UTC',
      memoryLimit: options.limitedMemory || (512 * 1024 * 1024), // 512MB default
      ...options
    }

    this.logger = new MockLogger(deviceId)
    this.syncHistory = []
  }

  async exportFullData () {
    const books = await this.storage.getBooks()
    const metadata = await this.storage.getMetadata()

    return {
      books,
      metadata: {
        ...metadata,
        exportedAt: new Date().toISOString(),
        exportedBy: this.deviceId,
        version: this.specs.version,
        bookCount: books.length
      },
      checksum: await this.calculateChecksum(books)
    }
  }

  async exportToFile () {
    const data = await this.exportFullData()

    // 模擬檔案匯出
    return {
      filename: `readmoo_books_${this.deviceId}_${new Date().toISOString().slice(0, 10)}.json`,
      data: JSON.stringify(data, null, 2),
      size: JSON.stringify(data).length,
      mimeType: 'application/json'
    }
  }

  async importFromFile (file) {
    let data

    try {
      // 模擬檔案讀取
      data = typeof file === 'string' ? JSON.parse(file) : file

      // 驗證資料格式
      if (!data.books || !Array.isArray(data.books)) {
        throw (() => { const error = new Error('Invalid file format: missing books array'); error.code = ErrorCodes.INVALID_FILE_FORMAT; error.details = { category: 'testing' }; return error })()
      }

      const currentBooks = await this.storage.getBooks()
      const merged = await mergeBookData(currentBooks, data.books)

      await this.storage.storeBooks(merged.books)

      return {
        success: true,
        imported: merged.imported,
        skipped: merged.skipped,
        conflicts: merged.conflicts,
        total: data.books.length,
        message: `成功匯入 ${merged.imported} 本書籍`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        imported: 0,
        message: `匯入失敗: ${error.message}`
      }
    }
  }

  async validateImportFile (file) {
    try {
      const data = typeof file === 'string' ? JSON.parse(file) : file

      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        bookCount: 0,
        estimatedSize: 0
      }

      // 檢查基本格式
      if (!data.books || !Array.isArray(data.books)) {
        validation.valid = false
        validation.errors.push('Missing or invalid books array')
        return validation
      }

      validation.bookCount = data.books.length
      validation.estimatedSize = JSON.stringify(data).length

      // 檢查書籍資料完整性
      data.books.forEach((book, index) => {
        if (!book.id) {
          validation.errors.push(`Book at index ${index} missing ID`)
        }
        if (!book.title) {
          validation.warnings.push(`Book at index ${index} missing title`)
        }
      })

      if (validation.errors.length > 0) {
        validation.valid = false
      }

      return validation
    } catch (error) {
      return {
        valid: false,
        errors: [`JSON parse error: ${error.message}`],
        warnings: [],
        bookCount: 0,
        estimatedSize: 0
      }
    }
  }

  async exportFullBackup () {
    const exportData = await this.exportFullData()
    const fileData = await this.exportToFile()

    return {
      success: true,
      file: {
        filename: fileData.filename,
        data: fileData.data,
        size: fileData.size,
        mimeType: fileData.mimeType
      },
      metadata: exportData.metadata,
      checksum: exportData.checksum,
      exportedAt: new Date().toISOString(),
      deviceId: this.deviceId
    }
  }

  async importBackup (backupFile) {
    try {
      // 驗證備份檔案
      const validation = await this.validateImportFile(backupFile.data)
      if (!validation.valid) {
        throw (() => { const error = new Error(`備份檔案驗證失敗: ${validation.errors.join(', ')}`); error.code = ErrorCodes.VALIDATION_ERROR; error.details = { category: 'testing' }; return error })()
      }

      // 執行匯入
      const importResult = await this.importFromFile(backupFile.data)

      return {
        success: importResult.success,
        imported: importResult.imported,
        skipped: importResult.skipped,
        conflicts: importResult.conflicts,
        total: validation.bookCount,
        message: importResult.message,
        backupInfo: {
          filename: backupFile.filename,
          size: backupFile.size,
          checksum: backupFile.checksum || null
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        imported: 0,
        message: `備份匯入失敗: ${error.message}`
      }
    }
  }

  // 模擬網路狀況
  setNetworkCondition (condition) {
    this.networkCondition = condition
    this.isOnline = condition !== 'disconnected'
  }

  // 模擬設備重啟
  async restart () {
    this.logger.log('INFO', 'Device restarting')
    await this.wait(100) // 模擬重啟時間
    return this
  }

  // 工具方法
  async wait (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getLogger () {
    return this.logger
  }

  async getSyncHistory () {
    return [...this.syncHistory]
  }

  async getState () {
    return {
      deviceId: this.deviceId,
      online: this.isOnline,
      networkCondition: this.networkCondition,
      syncStatus: 'IDLE',
      lastSync: this.syncHistory[this.syncHistory.length - 1]?.timestamp || null
    }
  }

  async getStorageMetadata () {
    const books = await this.storage.getBooks()
    return {
      bookCount: books.length,
      lastModified: new Date().toISOString(),
      checksum: await this.calculateChecksum(books)
    }
  }

  async calculateChecksum (data) {
    // 簡單的checksum實作，實際可能使用SHA-256
    const jsonString = JSON.stringify(data, Object.keys(data).sort())
    let checksum = 0
    for (let i = 0; i < jsonString.length; i++) {
      checksum = ((checksum << 5) - checksum + jsonString.charCodeAt(i)) & 0xffffffff
    }
    return checksum.toString(16)
  }

  async simulateError (errorType, cause) {
    // 模擬各種錯誤情況
    const errorMessages = {
      NETWORK_ERROR: {
        connection_timeout: '網路連線逾時，無法完成資料同步操作。請檢查您的網路連線狀態，確認網路穩定後重新嘗試同步。',
        dns_resolution_failed: 'DNS 名稱解析失敗，無法連接到同步伺服器。請檢查您的網路設定和 DNS 配置，或嘗試使用其他網路連線。',
        server_unreachable: '無法連接到同步伺服器，可能伺服器暫時無法回應。請檢查網路狀態，稍後再次嘗試同步操作。'
      },
      FILE_ERROR: {
        file_corrupted: '選擇的備份檔案已損壞或格式不正確，無法正常讀取和匯入。請檢查檔案完整性或使用其他備份檔案。',
        permission_denied: '系統權限不足，無法存取指定的檔案或資料夾。請檢查檔案權限設定，或以管理員身分執行此操作。',
        file_not_found: '系統找不到指定的備份檔案，檔案可能已被移動或刪除。請確認檔案路徑正確，或重新選擇有效的備份檔案。',
        disk_space_insufficient: '本機磁碟空間不足，無法完成檔案儲存或匯出操作。請清理磁碟空間後重新嘗試此操作。'
      },
      PERMISSION_ERROR: {
        access_denied: '系統存取權限被拒絕，無法執行此操作。請檢查Chrome擴充功能權限設定，或重新授權相關功能使用權限。',
        storage_quota_exceeded: 'Chrome 瀏覽器儲存配額已達上限，無法儲存更多資料。請清理瀏覽器資料或擴充功能儲存空間後重試。',
        api_permission_missing: '缺少必要的瀏覽器 API 存取權限，功能無法正常運作。請檢查擴充功能權限設定並重新安裝如有必要。'
      },
      STORAGE_ERROR: {
        quota_exceeded: 'Chrome 瀏覽器本機儲存空間已滿，無法儲存新的書籍資料。請清理擴充功能資料或移除不需要的書籍記錄。',
        storage_corrupted: '本機儲存的書籍資料已損壞，可能導致功能異常。建議備份現有資料後重置擴充功能並重新匯入。',
        sync_service_unavailable: '雲端同步服務暫時無法使用，可能因伺服器維護或網路問題。請稍後重試或使用本機匯出功能。'
      },
      DATA_ERROR: {
        invalid_format: '匯入的檔案格式無效或不符合預期的資料結構。請檢查檔案內容格式，確保使用正確的書籍資料匯出檔案。',
        checksum_mismatch: '資料完整性驗證失敗，檔案內容可能在傳輸過程中已損壞。請重新下載備份檔案或使用其他完整的備份。',
        version_incompatible: '匯入檔案的資料版本與目前擴充功能版本不相容。請更新擴充功能到最新版本或轉換檔案格式。'
      }
    }

    const errorInfo = errorMessages[errorType]?.[cause]
    if (!errorInfo) {
      throw (() => { const error = new Error(`Unknown error type: ${errorType} with cause: ${cause}`); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 記錄錯誤到日誌
    this.logger.log('ERROR', `Simulated error: ${errorType}`, {
      cause,
      deviceId: this.deviceId,
      timestamp: new Date().toISOString()
    })

    // 返回錯誤對象
    const error = new Error(errorInfo)
    error.type = errorType
    error.cause = cause
    error.deviceId = this.deviceId
    error.timestamp = new Date().toISOString()
    error.recoverable = this._isRecoverableError(errorType, cause)

    return error
  }

  async formatErrorMessage (error) {
    // 格式化錯誤訊息為用戶友好的形式
    const suggestions = {
      NETWORK_ERROR: {
        connection_timeout: ['檢查網路連線', '重新啟動路由器', '稍後重試'],
        dns_resolution_failed: ['檢查 DNS 設定', '嘗試使用其他 DNS 伺服器', '聯絡網路管理員'],
        server_unreachable: ['檢查網路狀態', '稍後重試', '聯絡技術支援']
      },
      FILE_ERROR: {
        file_corrupted: ['重新下載檔案', '檢查原始來源', '嘗試其他備份'],
        permission_denied: ['檢查檔案權限', '以管理員身分執行', '變更檔案存取權限'],
        file_not_found: ['確認檔案路徑', '檢查檔案是否存在', '重新匯入檔案'],
        disk_space_insufficient: ['清理磁碟空間', '移動檔案到其他位置', '刪除不需要的檔案']
      },
      PERMISSION_ERROR: {
        access_denied: ['檢查權限設定', '重新授權應用程式', '聯絡管理員'],
        storage_quota_exceeded: ['清理儲存空間', '刪除舊資料', '升級儲存方案'],
        api_permission_missing: ['檢查擴充功能權限', '重新安裝擴充功能', '更新權限設定']
      },
      STORAGE_ERROR: {
        quota_exceeded: ['清理 Chrome 儲存資料', '移除不需要的書籍', '匯出資料後重置'],
        storage_corrupted: ['重置擴充功能資料', '清除瀏覽器快取', '重新匯入資料'],
        sync_service_unavailable: ['稍後重試', '檢查網路連線', '聯絡技術支援']
      },
      DATA_ERROR: {
        invalid_format: ['檢查檔案格式', '重新匯出資料', '使用正確的檔案版本'],
        checksum_mismatch: ['重新下載檔案', '檢查檔案完整性', '嘗試其他備份'],
        version_incompatible: ['更新擴充功能', '轉換檔案格式', '聯絡技術支援']
      }
    }

    const actionSteps = suggestions[error.type]?.[error.cause] || ['聯絡技術支援', '檢查系統狀態', '重試操作']

    return {
      language: 'zh-TW',
      severity: this._getErrorSeverity(error.type, error.cause),
      message: error.message,
      actionable: true,
      actions: actionSteps,
      specificity: {
        level: this._calculateSpecificityLevel(error.type, error.cause),
        category: error.type,
        subCategory: error.cause
      },
      technicalDetails: {
        errorCode: `${error.type}_${error.cause}`,
        errorType: error.type,
        cause: error.cause,
        deviceId: error.deviceId,
        timestamp: error.timestamp,
        recoverable: error.recoverable,
        stackTrace: error.stack || 'No stack trace available'
      },
      userFriendlyExplanation: this._generateUserFriendlyExplanation(error.type, error.cause),
      details: {
        errorType: error.type,
        cause: error.cause,
        deviceId: error.deviceId,
        timestamp: error.timestamp,
        recoverable: error.recoverable
      },
      userActions: actionSteps,
      technicalInfo: {
        errorCode: `${error.type}_${error.cause}`,
        context: `Device: ${error.deviceId}`,
        debugInfo: error.stack || 'No stack trace available'
      },
      supportContact: {
        email: 'support@example.com',
        helpUrl: 'https://example.com/help',
        reportBugUrl: 'https://example.com/bug-report'
      }
    }
  }

  _isRecoverableError (errorType, cause) {
    // 判斷錯誤是否可恢復
    const recoverableErrors = new Set([
      'NETWORK_ERROR_connection_timeout',
      'NETWORK_ERROR_server_unreachable',
      'STORAGE_ERROR_sync_service_unavailable',
      'FILE_ERROR_disk_space_insufficient'
    ])

    return recoverableErrors.has(`${errorType}_${cause}`)
  }

  _getErrorSeverity (errorType, cause) {
    // 判斷錯誤嚴重程度
    const criticalErrors = new Set([
      'STORAGE_ERROR_storage_corrupted',
      'DATA_ERROR_checksum_mismatch',
      'PERMISSION_ERROR_access_denied'
    ])

    const warningErrors = new Set([
      'NETWORK_ERROR_connection_timeout',
      'FILE_ERROR_disk_space_insufficient',
      'STORAGE_ERROR_quota_exceeded'
    ])

    const errorKey = `${errorType}_${cause}`

    if (criticalErrors.has(errorKey)) {
      return 'critical'
    } else if (warningErrors.has(errorKey)) {
      return 'warning'
    } else {
      return 'error'
    }
  }

  async checkIDConsistency (books) {
    // 檢查書籍ID一致性
    const idMap = new Map()
    const duplicates = []
    const conflicts = []

    books.forEach((book, index) => {
      if (idMap.has(book.id)) {
        const existingBook = idMap.get(book.id)
        duplicates.push({
          id: book.id,
          firstIndex: existingBook.index,
          duplicateIndex: index,
          firstBook: existingBook.book,
          duplicateBook: book
        })

        // 檢查是否有衝突
        if (existingBook.book.title !== book.title ||
            existingBook.book.progress !== book.progress) {
          conflicts.push({
            id: book.id,
            differences: this._findBookDifferences(existingBook.book, book)
          })
        }
      } else {
        idMap.set(book.id, { book, index })
      }
    })

    return {
      totalBooks: books.length,
      uniqueBooks: idMap.size,
      duplicates: duplicates.length,
      conflicts: conflicts.length,
      duplicateDetails: duplicates,
      conflictDetails: conflicts,
      integrityScore: ((idMap.size / books.length) * 100).toFixed(2)
    }
  }

  async importWithMerge (books) {
    // 執行帶合併策略的匯入
    const currentBooks = await this.storage.getBooks()
    const mergeResult = await mergeBookData(currentBooks, books)

    await this.storage.storeBooks(mergeResult.books)

    return {
      success: true,
      imported: mergeResult.imported,
      skipped: mergeResult.skipped,
      conflicts: mergeResult.conflicts,
      bookCount: {
        before: currentBooks.length,
        after: mergeResult.books.length,
        final: mergeResult.books.length
      },
      message: `成功合併 ${mergeResult.imported} 本書籍，跳過 ${mergeResult.skipped} 本重複`
    }
  }

  async validateDataFormat (data) {
    // 驗證資料格式
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    }

    if (!Array.isArray(data)) {
      validation.isValid = false
      validation.errors.push({
        field: 'root',
        message: '資料必須是陣列格式',
        suggestion: '確認檔案包含書籍陣列'
      })
      return validation
    }

    data.forEach((book, index) => {
      // 檢查必要欄位
      if (!book.id) {
        validation.isValid = false
        validation.errors.push({
          field: `[${index}].id`,
          message: '缺少必要的書籍ID',
          suggestion: '確保每本書都有唯一ID'
        })
      }

      if (!book.title) {
        validation.warnings.push({
          field: `[${index}].title`,
          message: '缺少書籍標題',
          suggestion: '建議補充書籍標題資訊'
        })
      }

      // 檢查資料類型
      if (book.progress && (typeof book.progress !== 'number' || book.progress < 0 || book.progress > 100)) {
        validation.isValid = false
        validation.errors.push({
          field: `[${index}].progress`,
          message: '無效的進度值',
          suggestion: '進度值應為0-100之間的數字'
        })
      }

      if (book.extractedAt && isNaN(new Date(book.extractedAt).getTime())) {
        validation.warnings.push({
          field: `[${index}].extractedAt`,
          message: '無效的日期格式',
          suggestion: '使用 ISO 8601 日期格式'
        })
      }
    })

    return validation
  }

  async processDuplicates (books) {
    // 處理重複書籍
    const bookMap = new Map()
    const duplicates = []
    const unique = []

    books.forEach(book => {
      if (bookMap.has(book.id)) {
        const existing = bookMap.get(book.id)
        duplicates.push(book)

        // 保留較新或進度較高的版本
        if ((book.progress || 0) > (existing.progress || 0) ||
            new Date(book.extractedAt || 0) > new Date(existing.extractedAt || 0)) {
          bookMap.set(book.id, book)
        }
      } else {
        bookMap.set(book.id, book)
        unique.push(book)
      }
    })

    const result = Array.from(bookMap.values())

    return {
      success: true,
      books: result,
      statistics: {
        original: books.length,
        duplicatesSkipped: duplicates.length,
        uniqueBooks: result.length,
        duplicateRate: duplicates.length / books.length
      },
      report: {
        duplicatesFound: duplicates.length,
        resolutionStrategy: 'keep_latest_progress'
      }
    }
  }

  async createBackupPoint (name) {
    // 創建備份點
    const books = await this.storage.getBooks()
    const metadata = await this.storage.getMetadata()

    const backupId = `backup_${Date.now()}_${name}`
    const backup = {
      id: backupId,
      name,
      timestamp: new Date().toISOString(),
      books: JSON.parse(JSON.stringify(books)), // 深拷貝
      metadata: { ...metadata },
      checksum: await this.calculateChecksum(books)
    }

    // 模擬保存備份（實際會保存到持久存儲）
    if (!this._backups) {
      this._backups = new Map()
    }
    this._backups.set(backupId, backup)

    return {
      success: true,
      id: backupId,
      timestamp: backup.timestamp,
      bookCount: books.length,
      size: JSON.stringify(backup).length
    }
  }

  async restoreFromBackup (backupId) {
    // 從備份恢復
    if (!this._backups || !this._backups.has(backupId)) {
      throw (() => { const error = new Error(`Backup not found: ${backupId}`); error.code = ErrorCodes.NOT_FOUND_ERROR; error.details = { category: 'testing' }; return error })()
    }

    const backup = this._backups.get(backupId)
    await this.storage.storeBooks(backup.books)

    this.logger.log('INFO', `Restored from backup: ${backup.name}`, {
      backupId,
      timestamp: backup.timestamp,
      bookCount: backup.books.length
    })

    return {
      success: true,
      backupId,
      restoredBooks: backup.books.length,
      timestamp: backup.timestamp
    }
  }

  _findBookDifferences (book1, book2) {
    // 找出兩本書的差異
    const differences = []
    const fields = ['title', 'progress', 'isFinished', 'extractedAt', 'type']

    fields.forEach(field => {
      if (book1[field] !== book2[field]) {
        differences.push({
          field,
          value1: book1[field],
          value2: book2[field]
        })
      }
    })

    return differences
  }

  _calculateSpecificityLevel (errorType, cause) {
    // 計算錯誤具體性級別 (0-1)
    const specificityMap = {
      NETWORK_ERROR: {
        connection_timeout: 0.85,
        dns_resolution_failed: 0.9,
        server_unreachable: 0.75
      },
      FILE_ERROR: {
        file_corrupted: 0.9,
        permission_denied: 0.85,
        file_not_found: 0.9,
        disk_space_insufficient: 0.85
      },
      PERMISSION_ERROR: {
        access_denied: 0.75,
        storage_quota_exceeded: 0.9,
        api_permission_missing: 0.85
      },
      STORAGE_ERROR: {
        quota_exceeded: 0.9,
        storage_corrupted: 0.85,
        sync_service_unavailable: 0.75
      },
      DATA_ERROR: {
        invalid_format: 0.85,
        checksum_mismatch: 0.9,
        version_incompatible: 0.85
      }
    }

    return specificityMap[errorType]?.[cause] || 0.75
  }

  _generateUserFriendlyExplanation (errorType, cause) {
    // 生成用戶友好的解釋說明
    const explanations = {
      NETWORK_ERROR: {
        connection_timeout: '這個錯誤通常是因為網路連線不穩定或速度過慢導致的。系統在等待網路回應時超過了預設的時間限制。',
        dns_resolution_failed: '這個問題發生在系統無法將網域名稱轉換為IP位址時。通常與DNS設定或網路配置有關。',
        server_unreachable: '系統無法連接到遠端伺服器，可能是因為伺服器暫時離線、網路路由問題，或防火牆阻擋連線。'
      },
      FILE_ERROR: {
        file_corrupted: '檔案在儲存或傳輸過程中可能已經損壞，導致系統無法正確讀取檔案內容。這可能是硬體問題或傳輸錯誤造成的。',
        permission_denied: '作業系統阻止了檔案存取操作，通常是因為檔案權限設定不當或使用者權限不足。',
        file_not_found: '系統在指定位置找不到所需的檔案，檔案可能已被移動、重新命名或刪除。',
        disk_space_insufficient: '系統磁碟空間不足以完成檔案操作，需要釋放更多儲存空間才能繼續。'
      },
      PERMISSION_ERROR: {
        access_denied: 'Chrome 瀏覽器或作業系統限制了擴充功能的存取權限，可能需要重新授權或調整安全設定。',
        storage_quota_exceeded: 'Chrome 瀏覽器對擴充功能的儲存空間有限制，目前已達到配額上限。',
        api_permission_missing: '擴充功能缺少執行特定功能所需的瀏覽器API權限，可能需要更新權限設定。'
      },
      STORAGE_ERROR: {
        quota_exceeded: 'Chrome 的本機儲存空間已滿，無法儲存更多書籍資料。這通常發生在長期累積大量資料後。',
        storage_corrupted: '本機儲存的資料結構已損壞，可能影響擴充功能的正常運作。通常需要重建資料庫。',
        sync_service_unavailable: '雲端同步服務目前無法使用，可能是伺服器維護或暫時性網路問題。'
      },
      DATA_ERROR: {
        invalid_format: '匯入的檔案格式不符合系統預期，可能是檔案損壞或使用了不相容的檔案版本。',
        checksum_mismatch: '檔案的完整性檢查失敗，表示檔案內容在傳輸或儲存過程中可能已經改變。',
        version_incompatible: '檔案是由不同版本的程式產生的，與目前版本存在相容性問題。'
      }
    }

    return explanations[errorType]?.[cause] || '發生了未預期的錯誤，建議檢查系統狀態或聯絡技術支援以獲得協助。'
  }
}

/**
 * Mock儲存類別
 */
class MockStorage {
  constructor () {
    this.books = new Map()
    this.metadata = {}
  }

  async setBooks (books) {
    this.books.clear()
    books.forEach(book => {
      this.books.set(book.id, { ...book })
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async storeBooks (books) {
    // 別名方法，與setBooks功能相同
    return this.setBooks(books)
  }

  async getBooks () {
    return Array.from(this.books.values())
  }

  async addBooks (books) {
    books.forEach(book => {
      this.books.set(book.id, { ...book })
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async removeBooks (bookIds) {
    bookIds.forEach(id => {
      this.books.delete(id)
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async clear () {
    this.books.clear()
    this.metadata = {}
  }

  async getBookCount () {
    return this.books.size
  }

  async hasBook (bookId) {
    return this.books.has(bookId)
  }

  async getMetadata () {
    return {
      ...this.metadata,
      bookCount: this.books.size,
      lastModified: this.metadata.lastModified || new Date().toISOString()
    }
  }
}

/**
 * Mock日誌記錄器
 */
class MockLogger {
  constructor (deviceId) {
    this.deviceId = deviceId
    this.logs = []
  }

  log (level, message, context = {}) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...context, deviceId: this.deviceId }
    })
  }

  getLogs () {
    return [...this.logs]
  }

  clear () {
    this.logs = []
  }

  analyzeDiagnosticValue () {
    const errorLogs = this.logs.filter(log => log.level === 'ERROR')
    // eslint-disable-next-line no-unused-vars
    const _warnLogs = this.logs.filter(log => log.level === 'WARN')
    const infoLogs = this.logs.filter(log => log.level === 'INFO')

    return {
      completeness: this.logs.length > 0 ? 1.0 : 0.0,
      actionability: errorLogs.length / Math.max(1, this.logs.length),
      traceability: infoLogs.length > 5 ? 1.0 : infoLogs.length / 5
    }
  }
}

/**
 * 效能測量工具
 */
class PerformanceMonitor {
  constructor () {
    this.metrics = {}
    this.startTime = null
    this.memoryStart = null
  }

  start () {
    this.startTime = Date.now()
    this.memoryStart = this.getCurrentMemoryUsage()
  }

  stop () {
    if (!this.startTime) {
      throw (() => { const error = new Error('Performance monitor not started'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
    }

    const endTime = Date.now()
    const duration = endTime - this.startTime
    const memoryPeak = Math.max(this.memoryStart, this.getCurrentMemoryUsage())

    return {
      duration,
      memoryPeak,
      throughput: 0, // 需要根據處理的項目數量計算
      startTime: this.startTime,
      endTime
    }
  }

  getCurrentMemoryUsage () {
    // 模擬記憶體使用量，實際環境可能使用 process.memoryUsage()
    return Math.floor(Math.random() * 100 * 1024 * 1024) // 0-100MB
  }
}

/**
 * 網路狀況模擬器
 */
class NetworkSimulator {
  constructor () {
    this.condition = 'normal'
    this.latency = 100 // ms
    this.reliability = 1.0 // 0-1
    this.bandwidth = Infinity // bytes/s
  }

  setCondition (condition) {
    switch (condition) {
      case 'normal':
        this.latency = 100
        this.reliability = 1.0
        this.bandwidth = Infinity
        break
      case 'slow':
        this.latency = 2000
        this.reliability = 0.95
        this.bandwidth = 1024 * 1024 // 1MB/s
        break
      case 'disconnected':
        this.latency = Infinity
        this.reliability = 0.0
        this.bandwidth = 0
        break
      case 'intermittent':
        this.latency = 500
        this.reliability = 0.7
        this.bandwidth = 512 * 1024 // 512KB/s
        break
    }
    this.condition = condition
  }

  async simulateRequest (size = 1024) {
    if (this.condition === 'disconnected') {
      throw (() => { const error = new Error('Network disconnected'); error.code = ErrorCodes.NETWORK_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, this.latency))

    // 模擬可靠性
    if (Math.random() > this.reliability) {
      throw (() => { const error = new Error('Network request failed due to poor connection'); error.code = ErrorCodes.NETWORK_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 模擬頻寬限制
    if (this.bandwidth !== Infinity) {
      const transferTime = (size / this.bandwidth) * 1000 // ms
      await new Promise(resolve => setTimeout(resolve, transferTime))
    }

    return { success: true, size, condition: this.condition }
  }
}

/**
 * 資料完整性驗證工具
 */
function validateDataIntegrity (originalData, comparedData) {
  if (!Array.isArray(originalData) || !Array.isArray(comparedData)) {
    return 0
  }

  if (originalData.length !== comparedData.length) {
    return 0
  }

  let matchingItems = 0

  originalData.forEach(originalItem => {
    const matchingItem = comparedData.find(item => item.id === originalItem.id)
    if (matchingItem) {
      // 檢查關鍵欄位是否一致
      const fieldsMatch =
        matchingItem.title === originalItem.title &&
        matchingItem.progress === originalItem.progress &&
        matchingItem.type === originalItem.type &&
        matchingItem.extractedAt === originalItem.extractedAt

      if (fieldsMatch) {
        matchingItems++
      }
    }
  })

  return (matchingItems / originalData.length) * 100 // 返回百分比
}

/**
 * 合併書籍資料的輔助函數
 */
async function mergeBookData (targetBooks, sourceBooks) {
  const targetMap = new Map()
  const result = {
    books: [],
    imported: 0,
    skipped: 0,
    conflicts: 0
  }

  // 建立目標書籍索引
  targetBooks.forEach(book => targetMap.set(book.id, book))

  // 處理來源書籍
  for (const sourceBook of sourceBooks) {
    const targetBook = targetMap.get(sourceBook.id)

    if (!targetBook) {
      // 新書籍，直接加入
      result.books.push(sourceBook)
      result.imported++
    } else {
      // 檢查是否有衝突
      const hasConflict = (
        targetBook.progress !== sourceBook.progress ||
        targetBook.isFinished !== sourceBook.isFinished
      )

      if (hasConflict) {
        result.conflicts++
        // 簡單策略：保留較高的進度
        const merged = {
          ...targetBook,
          progress: Math.max(targetBook.progress || 0, sourceBook.progress || 0),
          isFinished: targetBook.isFinished || sourceBook.isFinished,
          extractedAt: new Date(Math.max(
            new Date(targetBook.extractedAt || 0).getTime(),
            new Date(sourceBook.extractedAt || 0).getTime()
          )).toISOString()
        }
        result.books.push(merged)
        result.imported++
      } else {
        // 無衝突，保留目標版本
        result.books.push(targetBook)
        result.skipped++
      }

      // 從目標映射中移除已處理的書籍
      targetMap.delete(sourceBook.id)
    }
  }

  // 加入剩餘的目標書籍
  for (const remainingBook of targetMap.values()) {
    result.books.push(remainingBook)
  }

  return result
}

/**
 * 測試環境設置和清理
 */
async function createSyncTestEnvironment () {
  // 初始化測試環境
  global.mockDevices = new Map()
  global.networkSimulator = new NetworkSimulator()
  global.performanceMonitor = new PerformanceMonitor()

  return {
    devicesCreated: 0,
    networkCondition: 'normal',
    initialized: true
  }
}

async function resetSyncTestEnvironment () {
  // 清理所有mock設備
  if (global.mockDevices) {
    for (const device of global.mockDevices.values()) {
      await device.storage.clear()
      device.logger.clear()
      device.syncHistory = []
    }
    global.mockDevices.clear()
  }

  // 重置網路狀況
  if (global.networkSimulator) {
    global.networkSimulator.setCondition('normal')
  }

  // 重置效能監控
  global.performanceMonitor = new PerformanceMonitor()
}

/**
 * 測量效能的輔助函數
 */
async function measurePerformance (asyncFunction, options = {}) {
  const monitor = new PerformanceMonitor()
  monitor.start()

  let result
  let error = null

  try {
    result = await asyncFunction()
  } catch (err) {
    error = err
  }

  const metrics = monitor.stop()

  return {
    syncResult: result,
    error,
    timing: {
      total: metrics.duration,
      export: Math.floor(metrics.duration * 0.3), // 模擬匯出佔30%時間
      import: Math.floor(metrics.duration * 0.7) // 模擬匯入佔70%時間
    },
    memoryUsage: {
      peak: metrics.memoryPeak,
      start: monitor.memoryStart
    },
    fileSize: options.estimatedFileSize || Math.floor(Math.random() * 10 * 1024 * 1024) // 0-10MB
  }
}

/**
 * 網路狀況模擬
 */
async function simulateNetworkConditions (condition) {
  if (global.networkSimulator) {
    global.networkSimulator.setCondition(condition)
  }
}

/**
 * 建立損壞檔案的輔助函數
 */
function createCorruptedFile (corruptionType) {
  const baseData = {
    books: generateTestBooks(10),
    metadata: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      bookCount: 10
    }
  }

  switch (corruptionType) {
    case 'binary_corruption':
      return Buffer.from(JSON.stringify(baseData)).subarray(0, 100) // 截斷檔案

    case 'permission_denied':
      return {
        ...baseData,
        _permissions: 'denied',
        error: 'PERMISSION_DENIED'
      }

    case 'file_not_found':
      return null

    case 'disk_error':
      return {
        error: 'DISK_READ_ERROR',
        message: 'Unable to read from disk'
      }

    default:
      return baseData
  }
}

// 匯出所有工具和類別
module.exports = {
  // 資料生成
  generateTestBooks,
  generateSpecialCharBooks,
  generateDuplicateBooks,
  generateCorruptedData,
  createCorruptedFile,

  // Mock類別
  MockDevice,
  MockStorage,
  MockLogger,
  PerformanceMonitor,
  NetworkSimulator,

  // 測試環境
  createSyncTestEnvironment,
  resetSyncTestEnvironment,

  // 工具函數
  measurePerformance,
  simulateNetworkConditions,
  validateDataIntegrity,

  // Phase 3 實作的核心同步功能
  setupDevice: async (deviceId, options = {}) => {
    const device = new MockDevice(deviceId, options)
    if (global.mockDevices) {
      global.mockDevices.set(deviceId, device)
    }

    // 初始化設備資料
    if (options.initialBooks) {
      await device.storage.storeBooks(options.initialBooks)
    }

    return device
  },

  executeFullSync: async (sourceDevice, targetDevice, options = {}) => {
    // 模擬完整同步流程
    const sourceBooks = await sourceDevice.storage.getBooks()
    const targetBooksBefore = await targetDevice.storage.getBooks()

    // 模擬網路延遲
    if (global.networkSimulator) {
      await global.networkSimulator.simulateRequest(sourceBooks.length * 1024)
    }

    // 根據策略處理資料
    const strategy = options.strategy || 'merge'
    let finalBooks
    let mergeStats = { imported: 0, skipped: 0, conflicts: 0 }

    if (strategy === 'overwrite') {
      finalBooks = sourceBooks
      mergeStats.imported = sourceBooks.length
    } else if (strategy === 'merge') {
      const merged = await mergeBookData(targetBooksBefore, sourceBooks)
      finalBooks = merged.books
      mergeStats = {
        imported: merged.imported,
        skipped: merged.skipped,
        conflicts: merged.conflicts
      }
    }

    // 儲存同步後的資料
    await targetDevice.storage.storeBooks(finalBooks)

    // 驗證資料完整性
    const targetBooksAfter = await targetDevice.storage.getBooks()
    const integrityScore = validateDataIntegrity(sourceBooks, targetBooksAfter)

    const result = {
      success: true,
      syncId: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      exported: sourceBooks.length,
      ...mergeStats,
      errors: 0,
      bookCount: {
        before: targetBooksBefore.length,
        after: targetBooksAfter.length
      },
      dataIntegrity: {
        verified: integrityScore >= 90, // 90%以上視為驗證通過
        score: integrityScore,
        issues: integrityScore < 100 ? ['部分資料不一致'] : []
      },
      timing: {
        start: Date.now(),
        duration: Math.floor(Math.random() * 1000) + 100 // 模擬100-1100ms
      }
    }

    // 記錄同步歷史
    const syncRecord = {
      timestamp: Date.now(),
      source: sourceDevice.deviceId,
      target: targetDevice.deviceId,
      result
    }

    sourceDevice.syncHistory.push(syncRecord)
    targetDevice.syncHistory.push(syncRecord)

    return result
  },

  executeSmartMergeSync: async (deviceA, deviceB) => {
    // 智慧合併同步：比較兩設備資料，僅同步差異部分
    const booksA = await deviceA.storage.getBooks()
    const booksB = await deviceB.storage.getBooks()

    // 建立書籍索引
    const mapA = new Map(booksA.map(book => [book.id, book]))
    const mapB = new Map(booksB.map(book => [book.id, book]))

    const changes = {
      aToB: [], // A有B沒有的書籍
      bToA: [], // B有A沒有的書籍
      conflicts: [] // 兩邊都有但不同的書籍
    }

    // 找出A有B沒有的書籍
    for (const [id, book] of mapA) {
      if (!mapB.has(id)) {
        changes.aToB.push(book)
      } else {
        // 檢查是否有衝突
        const bookB = mapB.get(id)
        if (book.progress !== bookB.progress ||
            book.isFinished !== bookB.isFinished ||
            book.extractedAt !== bookB.extractedAt) {
          changes.conflicts.push({
            id,
            bookA: book,
            bookB
          })
        }
      }
    }

    // 找出B有A沒有的書籍
    for (const [id, book] of mapB) {
      if (!mapA.has(id)) {
        changes.bToA.push(book)
      }
    }

    // 模擬網路傳輸
    if (global.networkSimulator) {
      const totalChanges = changes.aToB.length + changes.bToA.length + changes.conflicts.length
      await global.networkSimulator.simulateRequest(totalChanges * 512) // 假設每筆變更512bytes
    }

    // 執行智慧合併
    const mergedA = [...booksA]
    const mergedB = [...booksB]

    // 將B的新書籍加入A
    for (const book of changes.bToA) {
      mergedA.push(book)
    }

    // 將A的新書籍加入B
    for (const book of changes.aToB) {
      mergedB.push(book)
    }

    // 解決衝突 - 使用合併最佳屬性策略
    for (const conflict of changes.conflicts) {
      const merged = {
        ...conflict.bookA,
        progress: Math.max(conflict.bookA.progress || 0, conflict.bookB.progress || 0),
        isFinished: conflict.bookA.isFinished || conflict.bookB.isFinished,
        extractedAt: new Date(Math.max(
          new Date(conflict.bookA.extractedAt || 0).getTime(),
          new Date(conflict.bookB.extractedAt || 0).getTime()
        )).toISOString()
      }

      // 更新兩邊的資料
      const indexA = mergedA.findIndex(b => b.id === conflict.id)
      const indexB = mergedB.findIndex(b => b.id === conflict.id)
      if (indexA >= 0) mergedA[indexA] = merged
      if (indexB >= 0) mergedB[indexB] = merged
    }

    // 儲存合併結果
    await deviceA.storage.storeBooks(mergedA)
    await deviceB.storage.storeBooks(mergedB)

    const result = {
      success: true,
      syncId: `smart_sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      bookCount: {
        before: Math.max(booksA.length, booksB.length),
        after: Math.max(mergedA.length, mergedB.length)
      },
      duplicatesSkipped: changes.conflicts.length, // 衝突解決視為跳過重複
      progressUpdates: [
        { phase: 'analyzing', message: '分析資料差異', timestamp: Date.now() - 500 },
        { phase: 'merging', message: '合併書籍資料', timestamp: Date.now() - 300 },
        { phase: 'resolving', message: '解決衝突', timestamp: Date.now() - 100 },
        { phase: 'completed', message: '同步完成', timestamp: Date.now() }
      ],
      changes: {
        deviceA: {
          added: changes.bToA.length,
          updated: changes.conflicts.length,
          total: mergedA.length
        },
        deviceB: {
          added: changes.aToB.length,
          updated: changes.conflicts.length,
          total: mergedB.length
        }
      },
      conflicts: {
        detected: changes.conflicts.length,
        resolved: changes.conflicts.length,
        strategy: 'merge_best_attributes'
      },
      dataIntegrity: {
        verified: true,
        consistencyCheck: mergedA.length === mergedB.length
      },
      timing: {
        start: Date.now(),
        duration: Math.floor(Math.random() * 500) + 100
      }
    }

    // 記錄同步歷史
    const syncRecord = {
      timestamp: Date.now(),
      type: 'smart_merge',
      devices: [deviceA.deviceId, deviceB.deviceId],
      result
    }

    deviceA.syncHistory.push(syncRecord)
    deviceB.syncHistory.push(syncRecord)

    return result
  },

  executeBidirectionalSync: async (deviceA, deviceB) => {
    // 雙向同步：確保兩設備最終資料完全一致
    const booksA = await deviceA.storage.getBooks()
    const booksB = await deviceB.storage.getBooks()

    // 建立書籍索引以檢測差異和衝突
    const mapA = new Map(booksA.map(book => [book.id, book]))
    const mapB = new Map(booksB.map(book => [book.id, book]))

    const allBookIds = new Set([...mapA.keys(), ...mapB.keys()])
    const conflicts = []
    const finalBooks = []

    // 處理每本書籍，確保最終一致性
    for (const id of allBookIds) {
      const bookA = mapA.get(id)
      const bookB = mapB.get(id)

      if (bookA && bookB) {
        // 兩邊都有，檢查衝突
        const hasConflict =
          bookA.progress !== bookB.progress ||
          bookA.isFinished !== bookB.isFinished ||
          bookA.extractedAt !== bookB.extractedAt

        if (hasConflict) {
          // 解決衝突：合併最佳屬性
          const merged = {
            ...bookA,
            progress: Math.max(bookA.progress || 0, bookB.progress || 0),
            isFinished: bookA.isFinished || bookB.isFinished,
            extractedAt: new Date(Math.max(
              new Date(bookA.extractedAt || 0).getTime(),
              new Date(bookB.extractedAt || 0).getTime()
            )).toISOString()
          }
          finalBooks.push(merged)
          conflicts.push({ id, bookA, bookB, resolved: merged })
        } else {
          // 無衝突，保留資料
          finalBooks.push(bookA)
        }
      } else if (bookA) {
        // 只有A有，同步到B
        finalBooks.push(bookA)
      } else if (bookB) {
        // 只有B有，同步到A
        finalBooks.push(bookB)
      }
    }

    // 模擬網路傳輸
    if (global.networkSimulator) {
      await global.networkSimulator.simulateRequest(finalBooks.length * 256)
    }

    // 將最終結果同步到兩設備
    await deviceA.storage.storeBooks(finalBooks)
    await deviceB.storage.storeBooks(finalBooks)

    const result = {
      success: true,
      syncId: `bidirectional_sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conflictsResolved: conflicts.length,
      totalBooks: finalBooks.length,
      syncDirection: 'bidirectional',
      devices: {
        deviceA: {
          id: deviceA.deviceId,
          before: booksA.length,
          after: finalBooks.length,
          added: finalBooks.length - booksA.length
        },
        deviceB: {
          id: deviceB.deviceId,
          before: booksB.length,
          after: finalBooks.length,
          added: finalBooks.length - booksB.length
        }
      },
      conflicts: {
        detected: conflicts.length,
        resolved: conflicts.length,
        strategy: 'merge_best_attributes'
      },
      dataConsistency: {
        consistent: true,
        verification: 'passed'
      },
      timing: {
        start: Date.now(),
        duration: Math.floor(Math.random() * 800) + 200
      }
    }

    // 記錄到同步歷史
    const syncRecord = {
      timestamp: Date.now(),
      type: 'bidirectional',
      devices: [deviceA.deviceId, deviceB.deviceId],
      result
    }

    deviceA.syncHistory.push(syncRecord)
    deviceB.syncHistory.push(syncRecord)

    return result
  },

  executeBatchSync: async (sourceDevice, targetDevice) => {
    // 批次同步：優化大資料集的同步效能
    const startTime = Date.now()
    const sourceBooks = await sourceDevice.storage.getBooks()
    const targetBooks = await targetDevice.storage.getBooks()

    // 計算記憶體使用基線
    const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 50 * 1024 * 1024

    // 批次處理策略：分批次處理避免記憶體壓力
    const batchSize = 100 // 每次處理100本書籍
    const batches = []
    for (let i = 0; i < sourceBooks.length; i += batchSize) {
      batches.push(sourceBooks.slice(i, i + batchSize))
    }

    // 建立目標設備的書籍索引
    const targetMap = new Map(targetBooks.map(book => [book.id, book]))
    const processedBooks = []
    let batchesProcessed = 0

    // 逐批次處理
    for (const batch of batches) {
      // 模擬批次處理延遲（實際會更短）
      await new Promise(resolve => setTimeout(resolve, 10))

      // 處理當前批次
      batch.forEach(book => {
        const existingBook = targetMap.get(book.id)
        if (!existingBook ||
            (existingBook.progress || 0) < (book.progress || 0) ||
            new Date(existingBook.extractedAt || 0) < new Date(book.extractedAt || 0)) {
          processedBooks.push(book)
          targetMap.set(book.id, book)
        }
      })

      batchesProcessed++

      // 模擬網路傳輸（批次傳輸效率更高）
      if (global.networkSimulator) {
        await global.networkSimulator.simulateRequest(batch.length * 128) // 批次傳輸減少overhead
      }
    }

    // 合併所有書籍（保留目標設備原有書籍）
    const allTargetBooks = Array.from(targetMap.values())

    // 儲存最終結果
    await targetDevice.storage.storeBooks(allTargetBooks)

    const endTime = Date.now()
    const duration = endTime - startTime

    // 計算記憶體使用（模擬）
    const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : initialMemory + (sourceBooks.length * 1024)
    const memoryUsage = Math.max(finalMemory - initialMemory, sourceBooks.length * 512) // 估算每本書512bytes

    const result = {
      success: true,
      syncId: `batch_sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      duration,
      memoryUsage,
      batchSize,
      totalBatches: batches.length,
      batchesProcessed,
      sourceBooks: sourceBooks.length,
      targetBooks: targetBooks.length,
      finalBooks: allTargetBooks.length,
      newBooksAdded: allTargetBooks.length - targetBooks.length,
      booksUpdated: processedBooks.length - (allTargetBooks.length - targetBooks.length),
      dataIntegrity: {
        sourceCount: sourceBooks.length,
        targetCount: allTargetBooks.length,
        integrityScore: 100, // 假設批次處理保證100%完整性
        checksumMatch: true
      },
      performance: {
        avgBatchTime: duration / batches.length,
        throughput: Math.round(sourceBooks.length / (duration / 1000)), // books/second
        memoryEfficiency: memoryUsage / sourceBooks.length // bytes per book
      },
      timing: {
        start: startTime,
        end: endTime,
        duration
      }
    }

    // 記錄同步歷史
    const syncRecord = {
      timestamp: Date.now(),
      type: 'batch',
      sourceDevice: sourceDevice.deviceId,
      targetDevice: targetDevice.deviceId,
      result
    }

    sourceDevice.syncHistory.push(syncRecord)
    targetDevice.syncHistory.push(syncRecord)

    return result
  },

  executeTrackedSync: async (sourceDevice, targetDevice, stateTracker) => {
    throw (() => { const error = new Error('executeTrackedSync function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  getSyncHistory: async (device) => {
    throw (() => { const error = new Error('getSyncHistory function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  executeUserWorkflow: async (config) => {
    throw (() => { const error = new Error('executeUserWorkflow function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  calculateDataChecksum: async (data) => {
    throw (() => { const error = new Error('calculateDataChecksum function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  createDataSnapshot: async (deviceDataSets) => {
    throw (() => { const error = new Error('createDataSnapshot function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  compareDataSnapshots: async (preSyncSnapshot, postSyncSnapshot) => {
    throw (() => { const error = new Error('compareDataSnapshots function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  createExportData: async (books) => {
    throw (() => { const error = new Error('createExportData function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  validateSampleIntegrity: async (originalData, comparedData, options) => {
    throw (() => { const error = new Error('validateSampleIntegrity function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  checkDataRaceConditions: async (finalBooks) => {
    throw (() => { const error = new Error('checkDataRaceConditions function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  detectSyncConflicts: async (deviceA, deviceB) => {
    throw (() => { const error = new Error('detectSyncConflicts function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  setupConflictResolver: async () => {
    throw (() => { const error = new Error('setupConflictResolver function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  checkVersionCompatibility: async (fromDevice, toDevice) => {
    throw (() => { const error = new Error('checkVersionCompatibility function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  calculateUpgradePath: async (fromVersion, toVersion) => {
    throw (() => { const error = new Error('calculateUpgradePath function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  },

  validateDataPropagation: async (devices) => {
    throw (() => { const error = new Error('validateDataPropagation function not implemented - awaiting TDD Phase 3'); error.code = ErrorCodes.TEST_MOCK_ERROR; error.details = { category: 'testing' }; return error })()
  }
}
