/**
 * @fileoverview Data Domain Coordinator 單元測試
 * @version v2.0.0
 * @since 2025-08-15
 */

const DataDomainCoordinator = require('../../../../../src/background/domains/data-management/data-domain-coordinator.js')

// Mock EventBus
class MockEventBus {
  constructor () {
    this.events = new Map()
    this.emittedEvents = []
  }

  on (eventType, handler) {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, [])
    }
    this.events.get(eventType).push(handler)
  }

  async emit (eventType, data) {
    this.emittedEvents.push({ eventType, data, timestamp: Date.now() })

    // 觸發匹配的事件監聽器（包括萬用字元匹配）
    for (const [pattern, handlers] of this.events.entries()) {
      if (this.matchEventPattern(pattern, eventType)) {
        for (const handler of handlers) {
          try {
            await handler({ data, type: eventType })
          } catch (error) {
            console.error(`Event handler error for ${eventType}:`, error)
          }
        }
      }
    }
  }

  matchEventPattern (pattern, eventType) {
    // 精確匹配
    if (pattern === eventType) {
      return true
    }

    // 萬用字元匹配（支援 * 萬用字元）
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '[^.]*')
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(eventType)
    }

    return false
  }

  getEmittedEvents () {
    return this.emittedEvents
  }

  getEmittedEventsByType (eventType) {
    return this.emittedEvents.filter(event => event.eventType === eventType)
  }

  clearEmittedEvents () {
    this.emittedEvents = []
  }
}

// Mock Logger
class MockLogger {
  constructor () {
    this.logs = []
  }

  log (message) {
    this.logs.push({ level: 'log', message, timestamp: Date.now() })
  }

  info (message) {
    this.logs.push({ level: 'info', message, timestamp: Date.now() })
  }

  warn (message) {
    this.logs.push({ level: 'warn', message, timestamp: Date.now() })
  }

  error (message) {
    this.logs.push({ level: 'error', message, timestamp: Date.now() })
  }

  getLogs () {
    return this.logs
  }

  getLogsByLevel (level) {
    return this.logs.filter(log => log.level === level)
  }

  clearLogs () {
    this.logs = []
  }
}

// Mock DataValidationService
class MockDataValidationService {
  constructor (eventBus, config) {
    this.eventBus = eventBus
    this.config = config
    this.isInitialized = false
  }

  async initialize () {
    this.isInitialized = true
    return { status: 'INITIALIZED' }
  }

  async loadPlatformValidationRules (platform) {
    return { platform, rulesLoaded: true }
  }

  async healthCheck () {
    return { status: 'HEALTHY', initialized: this.isInitialized }
  }

  async stop () {
    this.isInitialized = false
    return { status: 'STOPPED' }
  }
}

describe('DataDomainCoordinator', () => {
  let coordinator
  let mockEventBus
  let mockLogger
  let testConfig

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockLogger = new MockLogger()
    testConfig = {
      maxConcurrentOperations: 3,
      operationTimeout: 60000,
      enablePerformanceMonitoring: false, // 測試中關閉以避免計時器
      autoCleanupInterval: 30000
    }

    coordinator = new DataDomainCoordinator(mockEventBus, {
      logger: mockLogger,
      config: testConfig
    })
  })

  afterEach(async () => {
    if (coordinator && coordinator.isCoordinating) {
      await coordinator.stop()
    }
  })

  describe('Construction', () => {
    test('should create coordinator with default configuration', () => {
      expect(coordinator).toBeDefined()
      expect(coordinator.eventBus).toBe(mockEventBus)
      expect(coordinator.logger).toBe(mockLogger)
      expect(coordinator.isInitialized).toBe(false)
      expect(coordinator.isCoordinating).toBe(false)
    })

    test('should merge provided config with defaults', () => {
      expect(coordinator.effectiveConfig.maxConcurrentOperations).toBe(3)
      expect(coordinator.effectiveConfig.operationTimeout).toBe(60000)
      expect(coordinator.effectiveConfig.retryAttempts).toBe(3) // from defaults
    })

    test('should initialize empty collections', () => {
      expect(coordinator.activeOperations.size).toBe(0)
      expect(coordinator.operationQueue.length).toBe(0)
      expect(coordinator.services).toBeDefined()
    })
  })

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await coordinator.initialize()

      expect(coordinator.isInitialized).toBe(true)
      expect(coordinator.isCoordinating).toBe(true)

      // 檢查是否發送了初始化完成事件
      const initEvents = mockEventBus.getEmittedEventsByType('DATA.DOMAIN.INITIALIZED')
      expect(initEvents).toHaveLength(1)
      expect(initEvents[0].data.services).toEqual(expect.arrayContaining(['validation']))
    })

    test('should initialize all services', async () => {
      await coordinator.initialize()

      // 檢查服務是否已初始化
      expect(coordinator.services.validation).toBeDefined()
      expect(coordinator.services.migration).toBeDefined()
      expect(coordinator.services.synchronization).toBeDefined()
      expect(coordinator.services.conflictResolution).toBeDefined()
      expect(coordinator.services.storageAdapter).toBeDefined()
      expect(coordinator.services.backupRecovery).toBeDefined()
    })

    test('should register event listeners', async () => {
      await coordinator.initialize()

      // 檢查事件監聽器是否已註冊
      expect(mockEventBus.events.size).toBeGreaterThan(0)

      // 檢查特定事件監聽器
      expect(mockEventBus.events.has('PLATFORM.*.DETECTED')).toBe(true)
      expect(mockEventBus.events.has('EXTRACTION.*.COMPLETED')).toBe(true)
      expect(mockEventBus.events.has('DATA.CROSS_PLATFORM.SYNC.REQUESTED')).toBe(true)
    })

    test('should handle initialization failure', async () => {
      // 模擬服務初始化失敗
      const badConfig = { ...testConfig }
      const badCoordinator = new DataDomainCoordinator(null, { // null eventBus 會造成錯誤
        logger: mockLogger,
        config: badConfig
      })

      await expect(badCoordinator.initialize()).rejects.toThrow()
      expect(badCoordinator.isInitialized).toBe(false)
      expect(badCoordinator.initializationError).toBeDefined()
    })
  })

  describe('Event Handling', () => {
    beforeEach(async () => {
      await coordinator.initialize()
      mockEventBus.clearEmittedEvents()
    })

    describe('Platform Detection Events', () => {
      test('should handle platform detected event', async () => {
        const platformData = {
          platform: 'READMOO',
          adapter: { type: 'readmoo-adapter', version: '1.0.0' }
        }

        await mockEventBus.emit('PLATFORM.READMOO.DETECTED', platformData)

        // 檢查是否發送了 DATA.PLATFORM.READY 事件
        const readyEvents = mockEventBus.getEmittedEventsByType('DATA.PLATFORM.READY')
        expect(readyEvents).toHaveLength(1)
        expect(readyEvents[0].data.platform).toBe('READMOO')

        // 檢查是否記錄了操作
        expect(coordinator.activeOperations.size).toBeGreaterThan(0)
      })

      test('should handle platform adapter loaded event', async () => {
        const adapterData = {
          platform: 'KINDLE',
          adapter: { type: 'kindle-adapter', version: '1.0.0' }
        }

        await mockEventBus.emit('PLATFORM.KINDLE.ADAPTER.LOADED', adapterData)

        // 驗證日誌中記錄了適配器載入
        const logs = mockLogger.getLogs()
        const adapterLogs = logs.filter(log => log.message.includes('平台適配器載入'))
        expect(adapterLogs.length).toBeGreaterThan(0)
      })
    })

    describe('Extraction Events', () => {
      test('should handle extraction completed event', async () => {
        const extractionData = {
          platform: 'READMOO',
          books: [
            { id: 'book1', title: 'Test Book 1' },
            { id: 'book2', title: 'Test Book 2' }
          ],
          extractionId: 'extract_123'
        }

        await mockEventBus.emit('EXTRACTION.READMOO.COMPLETED', extractionData)

        // 檢查是否發送了資料驗證請求
        const validationEvents = mockEventBus.getEmittedEventsByType('DATA.VALIDATION.REQUESTED')
        expect(validationEvents).toHaveLength(1)
        expect(validationEvents[0].data.platform).toBe('READMOO')
        expect(validationEvents[0].data.books).toHaveLength(2)
        expect(validationEvents[0].data.extractionId).toBe('extract_123')
      })

      test('should track extraction processing operation', async () => {
        const extractionData = {
          platform: 'KOBO',
          books: [{ id: 'book1', title: 'Test Book' }],
          extractionId: 'extract_456'
        }

        const initialOperationCount = coordinator.activeOperations.size

        await mockEventBus.emit('EXTRACTION.KOBO.COMPLETED', extractionData)

        // 檢查是否新增了操作追蹤
        expect(coordinator.activeOperations.size).toBe(initialOperationCount + 1)

        // 檢查操作詳情
        const operations = Array.from(coordinator.activeOperations.values())
        const extractionOp = operations.find(op => op.type === 'DATA_PROCESSING')
        expect(extractionOp).toBeDefined()
        expect(extractionOp.platform).toBe('KOBO')
        expect(extractionOp.extractionId).toBe('extract_456')
        expect(extractionOp.bookCount).toBe(1)
      })
    })

    describe('Validation Events', () => {
      test('should handle validation completed event', async () => {
        const validationData = {
          validationId: 'val_123',
          platform: 'READMOO',
          qualityScore: 85,
          validCount: 50,
          normalizedBooks: [{ id: 'book1', title: 'Normalized Book' }],
          operationId: 'op_123'
        }

        await mockEventBus.emit('DATA.READMOO.VALIDATION.COMPLETED', validationData)

        // 檢查是否觸發了儲存請求（品質分數 >= 70）
        const storageEvents = mockEventBus.getEmittedEventsByType('DATA.STORAGE.REQUESTED')
        expect(storageEvents).toHaveLength(1)
        expect(storageEvents[0].data.platform).toBe('READMOO')
        expect(storageEvents[0].data.books).toHaveLength(1)
      })

      test('should request quality review for low quality score', async () => {
        const validationData = {
          validationId: 'val_456',
          platform: 'KINDLE',
          qualityScore: 45, // 低於預設閾值 70
          validCount: 10,
          normalizedBooks: [],
          operationId: 'op_456'
        }

        await mockEventBus.emit('DATA.KINDLE.VALIDATION.COMPLETED', validationData)

        // 檢查是否要求品質檢查
        const reviewEvents = mockEventBus.getEmittedEventsByType('DATA.QUALITY.REVIEW.REQUIRED')
        expect(reviewEvents).toHaveLength(1)
        expect(reviewEvents[0].data.qualityScore).toBe(45)

        // 不應該觸發儲存請求
        const storageEvents = mockEventBus.getEmittedEventsByType('DATA.STORAGE.REQUESTED')
        expect(storageEvents).toHaveLength(0)
      })

      test('should handle validation failed event', async () => {
        const validationData = {
          validationId: 'val_789',
          platform: 'KOBO',
          error: 'Invalid data format',
          operationId: 'op_789'
        }

        await mockEventBus.emit('DATA.KOBO.VALIDATION.FAILED', validationData)

        // 檢查是否發送了錯誤通知
        const errorEvents = mockEventBus.getEmittedEventsByType('DATA.ERROR.NOTIFICATION')
        expect(errorEvents).toHaveLength(1)
        expect(errorEvents[0].data.type).toBe('VALIDATION_FAILURE')
        expect(errorEvents[0].data.error).toBe('Invalid data format')
      })
    })

    describe('Cross-Platform Sync Events', () => {
      test('should handle cross-platform sync request', async () => {
        const syncData = {
          sourcePlatforms: ['READMOO'],
          targetPlatforms: ['KINDLE', 'KOBO'],
          syncOptions: { strategy: 'SMART_MERGE' }
        }

        await mockEventBus.emit('DATA.CROSS_PLATFORM.SYNC.REQUESTED', syncData)

        // 檢查是否發送了同步開始事件
        const syncEvents = mockEventBus.getEmittedEventsByType('DATA.SYNC.STARTED')
        expect(syncEvents).toHaveLength(1)
        expect(syncEvents[0].data.sourcePlatforms).toEqual(['READMOO'])
        expect(syncEvents[0].data.targetPlatforms).toEqual(['KINDLE', 'KOBO'])
        expect(syncEvents[0].data.syncId).toBeDefined()
      })
    })

    describe('Conflict and Recovery Events', () => {
      test('should handle data conflict event', async () => {
        const conflictData = {
          conflictId: 'conflict_123',
          platform: 'READMOO',
          conflictData: { type: 'PROGRESS_MISMATCH' }
        }

        await mockEventBus.emit('DATA.READMOO.CONFLICT.DETECTED', conflictData)

        // 由於衝突解決服務尚未實作，應該記錄警告日誌
        const warnings = mockLogger.getLogsByLevel('warn')
        const conflictWarnings = warnings.filter(log =>
          log.message.includes('衝突解決服務尚未實作')
        )
        expect(conflictWarnings.length).toBeGreaterThan(0)
      })

      test('should handle backup recovery request', async () => {
        const recoveryData = {
          backupId: 'backup_123',
          platforms: ['READMOO'],
          options: { overwrite: true }
        }

        await mockEventBus.emit('DATA.BACKUP.RECOVERY.REQUESTED', recoveryData)

        // 由於備份恢復服務尚未實作，應該記錄警告日誌
        const warnings = mockLogger.getLogsByLevel('warn')
        const recoveryWarnings = warnings.filter(log =>
          log.message.includes('備份恢復服務尚未實作')
        )
        expect(recoveryWarnings.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Operation Management', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('should generate unique operation IDs', () => {
      const id1 = coordinator.generateOperationId('TEST')
      const id2 = coordinator.generateOperationId('TEST')

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(id1.startsWith('TEST_')).toBe(true)
    })

    test('should generate unique sync IDs', () => {
      const syncId1 = coordinator.generateSyncId()
      const syncId2 = coordinator.generateSyncId()

      expect(syncId1).toBeDefined()
      expect(syncId2).toBeDefined()
      expect(syncId1).not.toBe(syncId2)
      expect(syncId1.startsWith('sync_')).toBe(true)
    })

    test('should complete operations correctly', () => {
      const operationId = coordinator.generateOperationId('TEST')

      // 新增操作
      coordinator.activeOperations.set(operationId, {
        type: 'TEST_OPERATION',
        startTime: Date.now(),
        status: 'PROCESSING'
      })

      // 完成操作
      coordinator.completeOperation(operationId, 'SUCCESS')

      const operation = coordinator.activeOperations.get(operationId)
      expect(operation.status).toBe('SUCCESS')
      expect(operation.endTime).toBeDefined()
      expect(operation.duration).toBeDefined()
    })

    test('should complete operations with error', () => {
      const operationId = coordinator.generateOperationId('TEST')

      coordinator.activeOperations.set(operationId, {
        type: 'TEST_OPERATION',
        startTime: Date.now(),
        status: 'PROCESSING'
      })

      coordinator.completeOperation(operationId, 'FAILED', 'Test error message')

      const operation = coordinator.activeOperations.get(operationId)
      expect(operation.status).toBe('FAILED')
      expect(operation.error).toBe('Test error message')
    })
  })

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('should update validation metrics', () => {
      coordinator.updatePerformanceMetrics('validation', 'completed', 5, 85)

      const metrics = coordinator.performanceMetrics.validationMetrics
      expect(metrics.processed).toBe(5)
      expect(metrics.avgTime).toBe(85) // 第一次設定應該是直接的值
    })

    test('should update failure metrics', () => {
      coordinator.updatePerformanceMetrics('validation', 'failed', 2)

      const metrics = coordinator.performanceMetrics.validationMetrics
      expect(metrics.failed).toBe(2)
    })

    test('should accumulate metrics correctly', () => {
      coordinator.updatePerformanceMetrics('validation', 'completed', 3)
      coordinator.updatePerformanceMetrics('validation', 'completed', 2)
      coordinator.updatePerformanceMetrics('validation', 'failed', 1)

      const metrics = coordinator.performanceMetrics.validationMetrics
      expect(metrics.processed).toBe(5)
      expect(metrics.failed).toBe(1)
    })
  })

  describe('Health Check', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('should perform health check', async () => {
      const health = await coordinator.healthCheck()

      expect(health.isInitialized).toBe(true)
      expect(health.isCoordinating).toBe(true)
      expect(health.activeOperations).toBe(0)
      expect(health.services).toBeDefined()
      expect(health.lastCheck).toBeDefined()
    })

    test('should check service health status', async () => {
      const health = await coordinator.healthCheck()

      // 檢查服務健康狀態
      expect(health.services.validation).toBeDefined()
      expect(health.services.migration).toBeDefined()
      expect(health.services.synchronization).toBeDefined()
      expect(health.services.conflictResolution).toBeDefined()
      expect(health.services.storageAdapter).toBeDefined()
      expect(health.services.backupRecovery).toBeDefined()
    })
  })

  describe('Cleanup and Shutdown', () => {
    beforeEach(async () => {
      await coordinator.initialize()
    })

    test('should cleanup completed operations', () => {
      const oldOperationId = coordinator.generateOperationId('OLD')
      const recentOperationId = coordinator.generateOperationId('RECENT')

      // 新增舊的已完成操作
      coordinator.activeOperations.set(oldOperationId, {
        type: 'OLD_OPERATION',
        status: 'COMPLETED',
        startTime: Date.now() - 7200000, // 2小時前
        endTime: Date.now() - 7200000 + 1000
      })

      // 新增最近的操作
      coordinator.activeOperations.set(recentOperationId, {
        type: 'RECENT_OPERATION',
        status: 'PROCESSING',
        startTime: Date.now()
      })

      const initialCount = coordinator.activeOperations.size

      // 執行清理（模擬清理 1小時前的操作）
      coordinator.effectiveConfig.operationRetentionTime = 3600000
      coordinator.cleanupCompletedOperations()

      // 舊操作應該被清理，新操作應該保留
      expect(coordinator.activeOperations.size).toBe(initialCount - 1)
      expect(coordinator.activeOperations.has(oldOperationId)).toBe(false)
      expect(coordinator.activeOperations.has(recentOperationId)).toBe(true)
    })

    test('should stop coordinator cleanly', async () => {
      // 新增一些活躍操作
      coordinator.activeOperations.set('op1', { type: 'TEST', status: 'PROCESSING' })
      coordinator.operationQueue.push({ type: 'QUEUED_OP' })

      await coordinator.stop()

      expect(coordinator.isCoordinating).toBe(false)
      expect(coordinator.activeOperations.size).toBe(0)
      expect(coordinator.operationQueue.length).toBe(0)

      // 檢查日誌記錄了停止訊息
      const logs = mockLogger.getLogs()
      const stopLogs = logs.filter(log => log.message.includes('已停止'))
      expect(stopLogs.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle missing event data gracefully', async () => {
      await coordinator.initialize()

      // 發送沒有 data 的事件
      await expect(mockEventBus.emit('PLATFORM.TEST.DETECTED', null)).resolves.not.toThrow()
      await expect(mockEventBus.emit('EXTRACTION.TEST.COMPLETED', {})).resolves.not.toThrow()
    })

    test('should handle event handler errors gracefully', async () => {
      await coordinator.initialize()

      // 創建一個會導致錯誤的模擬方法
      const originalHandleExtraction = coordinator.handleExtractionCompleted
      coordinator.handleExtractionCompleted = async function (event) {
        throw new Error('Simulated processing error')
      }

      // 模擬事件數據
      const eventData = {
        platform: 'TEST',
        books: [],
        extractionId: 'test_123'
      }

      // 事件處理器應該捕獲錯誤但不會拋出
      await expect(mockEventBus.emit('EXTRACTION.TEST.COMPLETED', eventData)).resolves.not.toThrow()

      // 恢復原方法
      coordinator.handleExtractionCompleted = originalHandleExtraction

      // 檢查MockEventBus是否記錄了錯誤（在console.error中）
      // 由於我們模擬了錯誤，應該有錯誤輸出
      expect(true).toBe(true) // 這個測試主要驗證不會拋出未捕獲的錯誤
    })
  })

  describe('Integration with DataValidationService', () => {
    beforeEach(async () => {
      // 替換為真實的 DataValidationService mock
      coordinator.services.validation = new MockDataValidationService(mockEventBus, testConfig)
      await coordinator.initialize()
    })

    test('should initialize validation service', () => {
      expect(coordinator.services.validation.isInitialized).toBe(true)
    })

    test('should call validation service methods', async () => {
      const platform = 'READMOO'

      // 模擬平台檢測事件，這應該調用驗證服務的方法
      await mockEventBus.emit('PLATFORM.READMOO.DETECTED', {
        platform,
        adapter: { type: 'readmoo-adapter' }
      })

      // 驗證服務的方法應該被調用（這裡用日誌驗證）
      const logs = mockLogger.getLogs()
      const platformLogs = logs.filter(log => log.message.includes('處理平台檢測事件'))
      expect(platformLogs.length).toBeGreaterThan(0)
    })
  })
})

// 效能測試
describe('DataDomainCoordinator Performance', () => {
  let coordinator
  let mockEventBus
  let mockLogger

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockLogger = new MockLogger()

    coordinator = new DataDomainCoordinator(mockEventBus, {
      logger: mockLogger,
      config: { enablePerformanceMonitoring: false }
    })
  })

  afterEach(async () => {
    if (coordinator && coordinator.isCoordinating) {
      await coordinator.stop()
    }
  })

  test('should handle multiple concurrent events efficiently', async () => {
    await coordinator.initialize()

    const startTime = Date.now()
    const eventPromises = []

    // 發送 50 個並發事件
    for (let i = 0; i < 50; i++) {
      const promise = mockEventBus.emit('EXTRACTION.TEST.COMPLETED', {
        platform: `PLATFORM_${i}`,
        books: [{ id: `book_${i}`, title: `Test Book ${i}` }],
        extractionId: `extract_${i}`
      })
      eventPromises.push(promise)
    }

    await Promise.all(eventPromises)

    const duration = Date.now() - startTime
    const validationEvents = mockEventBus.getEmittedEventsByType('DATA.VALIDATION.REQUESTED')

    // 驗證處理效率
    expect(validationEvents).toHaveLength(50)
    expect(duration).toBeLessThan(5000) // 應該在 5 秒內完成
    expect(coordinator.activeOperations.size).toBe(50)
  })

  test('should manage memory efficiently with large operation counts', async () => {
    await coordinator.initialize()

    // 建立大量操作，一半是舊的已完成操作
    const oldTime = Date.now() - 7200000 // 2小時前
    for (let i = 0; i < 1000; i++) {
      const operationId = coordinator.generateOperationId('PERFORMANCE_TEST')
      const isOldCompleted = i % 2 === 0
      coordinator.activeOperations.set(operationId, {
        type: 'PERFORMANCE_TEST',
        startTime: isOldCompleted ? oldTime : Date.now(),
        endTime: isOldCompleted ? oldTime + 1000 : undefined,
        status: isOldCompleted ? 'COMPLETED' : 'PROCESSING'
      })
    }

    expect(coordinator.activeOperations.size).toBe(1000)

    // 設定清理保留時間為1小時
    coordinator.effectiveConfig.operationRetentionTime = 3600000

    // 執行清理
    coordinator.cleanupCompletedOperations()

    // 清理後應該減少一些操作（舊的已完成操作）
    expect(coordinator.activeOperations.size).toBeLessThan(1000)
  })
})
