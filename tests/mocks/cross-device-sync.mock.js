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
function generateTestBooks(count, prefix = 'test') {
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
function generateSpecialCharBooks(count = 10) {
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
function generateDuplicateBooks(uniqueCount = 30, duplicateRatio = 0.3) {
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
function generateCorruptedData() {
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
  constructor(deviceId, options = {}) {
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

  async exportFullData() {
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

  async exportToFile() {
    const data = await this.exportFullData()
    
    // 模擬檔案匯出
    return {
      filename: `readmoo_books_${this.deviceId}_${new Date().toISOString().slice(0, 10)}.json`,
      data: JSON.stringify(data, null, 2),
      size: JSON.stringify(data).length,
      mimeType: 'application/json'
    }
  }

  async importFromFile(file) {
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

  async validateImportFile(file) {
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

  // 模擬網路狀況
  setNetworkCondition(condition) {
    this.networkCondition = condition
    this.isOnline = condition !== 'disconnected'
  }

  // 模擬設備重啟
  async restart() {
    this.logger.log('INFO', 'Device restarting')
    await this.wait(100) // 模擬重啟時間
    return this
  }

  // 工具方法
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getLogger() {
    return this.logger
  }

  async getSyncHistory() {
    return [...this.syncHistory]
  }

  async getState() {
    return {
      deviceId: this.deviceId,
      online: this.isOnline,
      networkCondition: this.networkCondition,
      syncStatus: 'IDLE',
      lastSync: this.syncHistory[this.syncHistory.length - 1]?.timestamp || null
    }
  }

  async getStorageMetadata() {
    const books = await this.storage.getBooks()
    return {
      bookCount: books.length,
      lastModified: new Date().toISOString(),
      checksum: await this.calculateChecksum(books)
    }
  }

  async calculateChecksum(data) {
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
  constructor() {
    this.books = new Map()
    this.metadata = {}
  }

  async setBooks(books) {
    this.books.clear()
    books.forEach(book => {
      this.books.set(book.id, { ...book })
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async storeBooks(books) {
    // 別名方法，與setBooks功能相同
    return this.setBooks(books)
  }

  async getBooks() {
    return Array.from(this.books.values())
  }

  async addBooks(books) {
    books.forEach(book => {
      this.books.set(book.id, { ...book })
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async removeBooks(bookIds) {
    bookIds.forEach(id => {
      this.books.delete(id)
    })
    this.metadata.lastModified = new Date().toISOString()
  }

  async clear() {
    this.books.clear()
    this.metadata = {}
  }

  async getBookCount() {
    return this.books.size
  }

  async hasBook(bookId) {
    return this.books.has(bookId)
  }

  async getMetadata() {
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
  constructor(deviceId) {
    this.deviceId = deviceId
    this.logs = []
  }

  log(level, message, context = {}) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...context, deviceId: this.deviceId }
    })
  }

  getLogs() {
    return [...this.logs]
  }

  clear() {
    this.logs = []
  }

  analyzeDiagnosticValue() {
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
  constructor() {
    this.metrics = {}
    this.startTime = null
    this.memoryStart = null
  }

  start() {
    this.startTime = Date.now()
    this.memoryStart = this.getCurrentMemoryUsage()
  }

  stop() {
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

  getCurrentMemoryUsage() {
    // 模擬記憶體使用量，實際環境可能使用 process.memoryUsage()
    return Math.floor(Math.random() * 100 * 1024 * 1024) // 0-100MB
  }
}

/**
 * 網路狀況模擬器
 */
class NetworkSimulator {
  constructor() {
    this.condition = 'normal'
    this.latency = 100 // ms
    this.reliability = 1.0 // 0-1
    this.bandwidth = Infinity // bytes/s
  }

  setCondition(condition) {
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

  async simulateRequest(size = 1024) {
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
function validateDataIntegrity(originalData, comparedData) {
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
async function mergeBookData(targetBooks, sourceBooks) {
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
async function createSyncTestEnvironment() {
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

async function resetSyncTestEnvironment() {
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
async function measurePerformance(asyncFunction, options = {}) {
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
      import: Math.floor(metrics.duration * 0.7)   // 模擬匯入佔70%時間
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
async function simulateNetworkConditions(condition) {
  if (global.networkSimulator) {
    global.networkSimulator.setCondition(condition)
  }
}

/**
 * 建立損壞檔案的輔助函數
 */
function createCorruptedFile(corruptionType) {
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
    throw new Error(`executeSmartMergeSync function not implemented - awaiting TDD Phase 3`)
  },

  executeBidirectionalSync: async (deviceA, deviceB) => {
    throw new Error(`executeBidirectionalSync function not implemented - awaiting TDD Phase 3`)
  },

  executeBatchSync: async (sourceDevice, targetDevice) => {
    throw new Error(`executeBatchSync function not implemented - awaiting TDD Phase 3`)
  },

  executeTrackedSync: async (sourceDevice, targetDevice, stateTracker) => {
    throw new Error(`executeTrackedSync function not implemented - awaiting TDD Phase 3`)
  },

  getSyncHistory: async (device) => {
    throw new Error(`getSyncHistory function not implemented - awaiting TDD Phase 3`)
  },

  executeUserWorkflow: async (config) => {
    throw new Error(`executeUserWorkflow function not implemented - awaiting TDD Phase 3`)
  },

  calculateDataChecksum: async (data) => {
    throw new Error(`calculateDataChecksum function not implemented - awaiting TDD Phase 3`)
  },

  createDataSnapshot: async (deviceDataSets) => {
    throw new Error(`createDataSnapshot function not implemented - awaiting TDD Phase 3`)
  },

  compareDataSnapshots: async (preSyncSnapshot, postSyncSnapshot) => {
    throw new Error(`compareDataSnapshots function not implemented - awaiting TDD Phase 3`)
  },

  createExportData: async (books) => {
    throw new Error(`createExportData function not implemented - awaiting TDD Phase 3`)
  },

  validateSampleIntegrity: async (originalData, comparedData, options) => {
    throw new Error(`validateSampleIntegrity function not implemented - awaiting TDD Phase 3`)
  },

  checkDataRaceConditions: async (finalBooks) => {
    throw new Error(`checkDataRaceConditions function not implemented - awaiting TDD Phase 3`)
  },

  detectSyncConflicts: async (deviceA, deviceB) => {
    throw new Error(`detectSyncConflicts function not implemented - awaiting TDD Phase 3`)
  },

  setupConflictResolver: async () => {
    throw new Error(`setupConflictResolver function not implemented - awaiting TDD Phase 3`)
  },

  checkVersionCompatibility: async (fromDevice, toDevice) => {
    throw new Error(`checkVersionCompatibility function not implemented - awaiting TDD Phase 3`)
  },

  calculateUpgradePath: async (fromVersion, toVersion) => {
    throw new Error(`calculateUpgradePath function not implemented - awaiting TDD Phase 3`)
  },

  validateDataPropagation: async (devices) => {
    throw new Error(`validateDataPropagation function not implemented - awaiting TDD Phase 3`)
  }
}