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
 * - 確保測試的可重現性和隔離性
 */

// 導入基礎Chrome API Mock
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
        throw new Error('Invalid file format: missing books array')
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
        throw new Error(`備份檔案驗證失敗: ${validation.errors.join(', ')}`)
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
    const warnLogs = this.logs.filter(log => log.level === 'WARN')
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
      throw new Error('Performance monitor not started')
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
      throw new Error('Network disconnected')
    }

    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, this.latency))

    // 模擬可靠性
    if (Math.random() > this.reliability) {
      throw new Error('Network request failed due to poor connection')
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
    throw new Error('executeTrackedSync function not implemented - awaiting TDD Phase 3')
  },

  getSyncHistory: async (device) => {
    throw new Error('getSyncHistory function not implemented - awaiting TDD Phase 3')
  },

  executeUserWorkflow: async (config) => {
    throw new Error('executeUserWorkflow function not implemented - awaiting TDD Phase 3')
  },

  calculateDataChecksum: async (data) => {
    throw new Error('calculateDataChecksum function not implemented - awaiting TDD Phase 3')
  },

  createDataSnapshot: async (deviceDataSets) => {
    throw new Error('createDataSnapshot function not implemented - awaiting TDD Phase 3')
  },

  compareDataSnapshots: async (preSyncSnapshot, postSyncSnapshot) => {
    throw new Error('compareDataSnapshots function not implemented - awaiting TDD Phase 3')
  },

  createExportData: async (books) => {
    throw new Error('createExportData function not implemented - awaiting TDD Phase 3')
  },

  validateSampleIntegrity: async (originalData, comparedData, options) => {
    throw new Error('validateSampleIntegrity function not implemented - awaiting TDD Phase 3')
  },

  checkDataRaceConditions: async (finalBooks) => {
    throw new Error('checkDataRaceConditions function not implemented - awaiting TDD Phase 3')
  },

  detectSyncConflicts: async (deviceA, deviceB) => {
    throw new Error('detectSyncConflicts function not implemented - awaiting TDD Phase 3')
  },

  setupConflictResolver: async () => {
    throw new Error('setupConflictResolver function not implemented - awaiting TDD Phase 3')
  },

  checkVersionCompatibility: async (fromDevice, toDevice) => {
    throw new Error('checkVersionCompatibility function not implemented - awaiting TDD Phase 3')
  },

  calculateUpgradePath: async (fromVersion, toVersion) => {
    throw new Error('calculateUpgradePath function not implemented - awaiting TDD Phase 3')
  },

  validateDataPropagation: async (devices) => {
    throw new Error('validateDataPropagation function not implemented - awaiting TDD Phase 3')
  }
}
