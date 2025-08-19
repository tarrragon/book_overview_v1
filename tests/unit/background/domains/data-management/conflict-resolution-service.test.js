/**
 * @fileoverview Conflict Resolution Service 單元測試
 * @version v2.0.0
 * @since 2025-08-16
 *
 * 測試架構設計：
 * - 61 個完整測試案例覆蓋所有核心功能
 * - 基於 BaseModule 繼承模式的生命週期測試
 * - 完整的 Mock 服務隔離設計
 * - 事件驅動架構的完整驗證
 * - 多類型衝突檢測和智能解決策略測試
 */

const ConflictResolutionService = require('../../../../../src/background/domains/data-management/services/conflict-resolution-service.js')

// ==================== Mock 服務設計 ====================

/**
 * Mock EventBus - 完整事件系統模擬
 * 功能：事件註冊、發送、萬用字元匹配、歷史追蹤
 */
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
    if (pattern === eventType) {
      return true
    }

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

/**
 * Mock Logger - 完整日誌系統模擬
 * 功能：多層級日誌記錄、查詢、清理
 */
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

/**
 * 測試資料工廠 - 衝突情境資料生成
 * 功能：產生各種類型的衝突測試資料
 */
class ConflictTestDataFactory {
  static createProgressConflict () {
    return {
      type: 'PROGRESS_MISMATCH',
      bookId: 'test-book-001',
      sourceData: {
        title: '測試書籍',
        progress: 75,
        lastUpdated: Date.now() - 3600000 // 1小時前
      },
      targetData: {
        title: '測試書籍',
        progress: 45,
        lastUpdated: Date.now() - 7200000 // 2小時前
      },
      details: {
        progressDiff: 30,
        timeDiff: 3600000
      }
    }
  }

  static createTitleConflict () {
    return {
      type: 'TITLE_DIFFERENCE',
      bookId: 'test-book-002',
      sourceData: {
        title: '原版書名：完整指南',
        progress: 30,
        lastUpdated: Date.now() - 1800000
      },
      targetData: {
        title: '縮版書名：指南',
        progress: 30,
        lastUpdated: Date.now() - 1800000
      },
      details: {
        similarity: 0.65,
        titleDiff: '原版書名：完整指南 vs 縮版書名：指南'
      }
    }
  }

  static createTimestampConflict () {
    return {
      type: 'TIMESTAMP_CONFLICT',
      bookId: 'test-book-003',
      sourceData: {
        title: '時間衝突測試',
        progress: 60,
        lastUpdated: Date.now()
      },
      targetData: {
        title: '時間衝突測試',
        progress: 60,
        lastUpdated: Date.now() - 86400000 // 1天前
      },
      details: {
        timeDiff: 86400000,
        timestampGap: '24 hours'
      }
    }
  }

  static createTagConflict () {
    return {
      type: 'TAG_DIFFERENCE',
      bookId: 'test-book-004',
      sourceData: {
        title: '標籤衝突書籍',
        progress: 20,
        tags: ['readmoo', 'tech', 'programming'],
        lastUpdated: Date.now() - 900000
      },
      targetData: {
        title: '標籤衝突書籍',
        progress: 20,
        tags: ['readmoo', 'technology'],
        lastUpdated: Date.now() - 900000
      },
      details: {
        tagDiff: {
          added: ['tech', 'programming'],
          removed: ['technology'],
          common: ['readmoo']
        }
      }
    }
  }

  static createComplexConflict () {
    return {
      type: 'MULTIPLE_CONFLICTS',
      bookId: 'test-book-005',
      sourceData: {
        title: '複雜衝突測試書籍（完整版）',
        progress: 85,
        tags: ['readmoo', 'fiction', 'bestseller'],
        lastUpdated: Date.now() - 1800000
      },
      targetData: {
        title: '複雜衝突測試書籍',
        progress: 60,
        tags: ['readmoo', 'novel'],
        lastUpdated: Date.now() - 3600000
      },
      details: {
        titleSimilarity: 0.75,
        progressDiff: 25,
        timeDiff: 1800000,
        tagConflicts: {
          added: ['fiction', 'bestseller'],
          removed: ['novel']
        }
      },
      severity: 'HIGH',
      confidence: 0.3
    }
  }

  static createBatchConflictData (count = 10) {
    const conflicts = []
    for (let i = 0; i < count; i++) {
      if (i % 4 === 0) {
        conflicts.push(this.createProgressConflict())
      } else if (i % 4 === 1) {
        conflicts.push(this.createTitleConflict())
      } else if (i % 4 === 2) {
        conflicts.push(this.createTimestampConflict())
      } else {
        conflicts.push(this.createTagConflict())
      }
      // 確保每個衝突都有唯一的 bookId
      conflicts[i].bookId = `batch-book-${String(i).padStart(3, '0')}`
    }
    return conflicts
  }
}

// ==================== 測試套件開始 ====================

describe('Conflict Resolution Service', () => {
  let service
  let mockEventBus
  let mockLogger
  let defaultConfig

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockLogger = new MockLogger()
    defaultConfig = {
      detectionThresholds: {
        progressThreshold: 10,
        titleSimilarityThreshold: 0.8,
        timestampThreshold: 3600000, // 1小時
        tagDifferenceThreshold: 0.5
      },
      resolutionStrategies: {
        enableAutoResolution: true,
        defaultStrategy: 'USE_LATEST_TIMESTAMP',
        maxBatchSize: 100
      },
      performance: {
        maxProcessingTime: 30000,
        memoryLimit: 100 * 1024 * 1024 // 100MB
      }
    }

    service = new ConflictResolutionService({
      eventBus: mockEventBus,
      logger: mockLogger,
      config: defaultConfig
    })
  })

  afterEach(() => {
    if (service && service.isRunning) {
      service.shutdown()
    }
  })

  // ==================== 1. Construction & Initialization Tests (6 tests) ====================

  describe('1. Construction & Initialization', () => {
    test('1.1 應該正確建立服務實例並繼承 BaseModule', () => {
      expect(service).toBeDefined()
      expect(service.moduleName).toBe('ConflictResolutionService')
      expect(service.moduleId).toMatch(/ConflictResolutionService_\d+_[a-z0-9]+/)
      expect(service.eventBus).toBe(mockEventBus)
      expect(service.logger).toBe(mockLogger)
      expect(service.config).toEqual(defaultConfig)
    })

    test('1.2 應該正確初始化衝突檢測引擎', async () => {
      await service.initialize()

      expect(service.isInitialized).toBe(true)
      expect(service.conflictDetector).toBeDefined()
      expect(service.resolutionEngine).toBeDefined()
      expect(service.performanceMetrics).toBeDefined()

      // 驗證衝突類型定義
      expect(service.conflictTypes).toHaveProperty('PROGRESS_MISMATCH')
      expect(service.conflictTypes).toHaveProperty('TITLE_DIFFERENCE')
      expect(service.conflictTypes).toHaveProperty('TIMESTAMP_CONFLICT')
      expect(service.conflictTypes).toHaveProperty('TAG_DIFFERENCE')
    })

    test('1.3 應該正確註冊事件監聽器', async () => {
      await service.initialize()

      // 驗證事件監聽器註冊
      expect(mockEventBus.events.has('DATA.SYNC.CONFLICT_DETECTED')).toBe(true)
      expect(mockEventBus.events.has('DATA.CONFLICT.RESOLUTION_REQUESTED')).toBe(true)
      expect(mockEventBus.events.has('DATA.CONFLICT.BATCH_PROCESS_REQUESTED')).toBe(true)
    })

    test('1.4 應該正確載入解決策略庫', async () => {
      await service.initialize()

      expect(service.resolutionStrategies).toBeDefined()
      expect(service.resolutionStrategies).toHaveProperty('USE_LATEST_TIMESTAMP')
      expect(service.resolutionStrategies).toHaveProperty('USE_SOURCE_PRIORITY')
      expect(service.resolutionStrategies).toHaveProperty('MANUAL_REVIEW')
      expect(service.resolutionStrategies).toHaveProperty('INTELLIGENT_MERGE')

      // 驗證策略結構
      const strategy = service.resolutionStrategies.USE_LATEST_TIMESTAMP
      expect(strategy).toHaveProperty('confidence')
      expect(strategy).toHaveProperty('applicable')
      expect(strategy).toHaveProperty('execute')
    })

    test('1.5 應該正確處理初始化錯誤', async () => {
      // 模擬配置錯誤
      const badService = new ConflictResolutionService({
        eventBus: null, // 故意傳入錯誤的依賴
        logger: mockLogger,
        config: {}
      })

      await expect(badService.initialize()).rejects.toThrow()
      expect(badService.isInitialized).toBe(false)
      expect(badService.initializationError).toBeDefined()
    })

    test('1.6 應該支援配置自定義檢測閾值和策略', async () => {
      const customConfig = {
        detectionThresholds: {
          progressThreshold: 5,
          titleSimilarityThreshold: 0.9,
          timestampThreshold: 1800000,
          tagDifferenceThreshold: 0.3
        },
        resolutionStrategies: {
          enableAutoResolution: false,
          defaultStrategy: 'MANUAL_REVIEW',
          maxBatchSize: 50
        }
      }

      const customService = new ConflictResolutionService({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: customConfig
      })

      await customService.initialize()

      expect(customService.config.detectionThresholds.progressThreshold).toBe(5)
      expect(customService.config.resolutionStrategies.defaultStrategy).toBe('MANUAL_REVIEW')
      expect(customService.config.resolutionStrategies.maxBatchSize).toBe(50)
    })
  })

  // ==================== 2. Conflict Detection Engine Tests (12 tests) ====================

  describe('2. Conflict Detection Engine', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('2.1 應該正確檢測進度不匹配衝突', async () => {
      const conflictData = ConflictTestDataFactory.createProgressConflict()
      const conflicts = await service.detectConflicts([conflictData])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('PROGRESS_MISMATCH')
      expect(conflicts[0].severity).toBeDefined()
      expect(conflicts[0].details.progressDiff).toBe(30)
    })

    test('2.2 應該正確檢測標題差異衝突', async () => {
      const conflictData = ConflictTestDataFactory.createTitleConflict()
      const conflicts = await service.detectConflicts([conflictData])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('TITLE_DIFFERENCE')
      expect(conflicts[0].details.similarity).toBe(0.65)
      expect(conflicts[0].severity).toMatch(/^(LOW|MEDIUM|HIGH)$/)
    })

    test('2.3 應該正確檢測時間戳衝突', async () => {
      const conflictData = ConflictTestDataFactory.createTimestampConflict()
      const conflicts = await service.detectConflicts([conflictData])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('TIMESTAMP_CONFLICT')
      expect(conflicts[0].details.timeDiff).toBe(86400000)
      expect(conflicts[0].severity).toBeDefined()
    })

    test('2.4 應該正確檢測標籤差異衝突', async () => {
      const conflictData = ConflictTestDataFactory.createTagConflict()
      const conflicts = await service.detectConflicts([conflictData])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('TAG_DIFFERENCE')
      expect(conflicts[0].details.tagDiff).toBeDefined()
      expect(conflicts[0].details.tagDiff.added).toContain('tech')
      expect(conflicts[0].details.tagDiff.removed).toContain('technology')
    })

    test('2.5 應該正確評估衝突嚴重程度', async () => {
      const progressConflict = ConflictTestDataFactory.createProgressConflict()
      progressConflict.details.progressDiff = 60 // 高嚴重程度

      const conflicts = await service.detectConflicts([progressConflict])
      expect(conflicts[0].severity).toBe('HIGH')

      // 測試中等嚴重程度
      progressConflict.details.progressDiff = 25
      const mediumConflicts = await service.detectConflicts([progressConflict])
      expect(mediumConflicts[0].severity).toBe('MEDIUM')

      // 測試低嚴重程度
      progressConflict.details.progressDiff = 5
      const lowConflicts = await service.detectConflicts([progressConflict])
      expect(lowConflicts[0].severity).toBe('LOW')
    })

    test('2.6 應該正確處理複合類型衝突', async () => {
      const complexConflict = ConflictTestDataFactory.createComplexConflict()
      const conflicts = await service.detectConflicts([complexConflict])

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('MULTIPLE_CONFLICTS')
      expect(conflicts[0].severity).toBe('HIGH')
      expect(conflicts[0].details).toHaveProperty('titleSimilarity')
      expect(conflicts[0].details).toHaveProperty('progressDiff')
      expect(conflicts[0].details).toHaveProperty('tagConflicts')
    })

    test('2.7 應該正確發送衝突檢測事件', async () => {
      const conflictData = ConflictTestDataFactory.createProgressConflict()
      await service.detectConflicts([conflictData])

      const detectionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.DETECTED')
      expect(detectionEvents).toHaveLength(1)
      expect(detectionEvents[0].data.conflictCount).toBe(1)
      expect(detectionEvents[0].data.conflicts[0].type).toBe('PROGRESS_MISMATCH')
    })

    test('2.8 應該支援自定義檢測規則', async () => {
      // 新增自定義檢測規則
      service.addCustomDetectionRule('CUSTOM_RULE', {
        detector: (source, target) => source.customField !== target.customField,
        severity: () => 'MEDIUM'
      })

      const customData = {
        type: 'CUSTOM_CONFLICT',
        bookId: 'custom-001',
        sourceData: { customField: 'value1' },
        targetData: { customField: 'value2' }
      }

      const conflicts = await service.detectConflicts([customData])
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('CUSTOM_RULE')
    })

    test('2.9 應該正確處理無衝突情況', async () => {
      const noConflictData = {
        type: 'NO_CONFLICT',
        bookId: 'no-conflict-001',
        sourceData: {
          title: '無衝突書籍',
          progress: 50,
          lastUpdated: Date.now()
        },
        targetData: {
          title: '無衝突書籍',
          progress: 50,
          lastUpdated: Date.now()
        }
      }

      const conflicts = await service.detectConflicts([noConflictData])
      expect(conflicts).toHaveLength(0)
    })

    test('2.10 應該正確更新檢測效能指標', async () => {
      const conflictData = ConflictTestDataFactory.createProgressConflict()
      await service.detectConflicts([conflictData])

      const metrics = service.getPerformanceMetrics()
      expect(metrics.conflictsDetected).toBe(1)
      expect(metrics.avgDetectionTime).toBeGreaterThan(0)
      expect(metrics.detectionCount).toBe(1)
    })

    test('2.11 應該正確處理批次衝突檢測', async () => {
      const batchData = ConflictTestDataFactory.createBatchConflictData(5)
      const conflicts = await service.detectConflicts(batchData)

      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts.length).toBeLessThanOrEqual(5)

      // 驗證批次處理事件
      const batchEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH_DETECTED')
      expect(batchEvents).toHaveLength(1)
      expect(batchEvents[0].data.batchSize).toBe(5)
    })

    test('2.12 應該正確處理檢測過程中的錯誤', async () => {
      const invalidData = {
        type: 'INVALID_DATA',
        bookId: null, // 故意傳入無效資料
        sourceData: null,
        targetData: undefined
      }

      await expect(service.detectConflicts([invalidData])).rejects.toThrow()

      // 驗證錯誤日誌記錄
      const errorLogs = mockLogger.getLogsByLevel('error')
      expect(errorLogs.length).toBeGreaterThan(0)
    })
  })

  // ==================== 3. Resolution Strategy Engine Tests (15 tests) ====================

  describe('3. Resolution Strategy Engine', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('3.1 應該正確推薦 USE_LATEST_TIMESTAMP 策略', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const recommendations = await service.generateResolutionRecommendations(conflict)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].strategy).toBe('USE_LATEST_TIMESTAMP')
      expect(recommendations[0].confidence).toBeGreaterThan(0.8)
      expect(recommendations[0].reason).toContain('時間戳')
    })

    test('3.2 應該正確推薦 MANUAL_REVIEW 策略對複雜衝突', async () => {
      const complexConflict = ConflictTestDataFactory.createComplexConflict()
      const recommendations = await service.generateResolutionRecommendations(complexConflict)

      expect(recommendations.some(r => r.strategy === 'MANUAL_REVIEW')).toBe(true)
      const manualReview = recommendations.find(r => r.strategy === 'MANUAL_REVIEW')
      expect(manualReview.reason).toBeDefined()
      expect(manualReview.confidence).toBeLessThan(0.7)
    })

    test('3.3 應該正確執行自動解決策略', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const result = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

      expect(result.success).toBe(true)
      expect(result.resolvedData).toBeDefined()
      expect(result.strategyUsed).toBe('USE_LATEST_TIMESTAMP')
      expect(result.resolvedData.progress).toBe(75) // 使用較新的進度

      // 驗證解決事件發送
      const resolutionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.RESOLVED')
      expect(resolutionEvents).toHaveLength(1)
    })

    test('3.4 應該正確執行 USE_SOURCE_PRIORITY 策略', async () => {
      const conflict = ConflictTestDataFactory.createTitleConflict()
      const result = await service.executeAutoResolution(conflict, 'USE_SOURCE_PRIORITY')

      expect(result.success).toBe(true)
      expect(result.resolvedData.title).toBe(conflict.sourceData.title)
      expect(result.strategyUsed).toBe('USE_SOURCE_PRIORITY')
    })

    test('3.5 應該支援自定義解決策略', async () => {
      // 新增自定義策略
      service.addCustomResolutionStrategy('CUSTOM_MERGE', {
        confidence: 0.8,
        applicable: (conflict) => conflict.type === 'PROGRESS_MISMATCH',
        execute: (conflict) => ({
          ...conflict.sourceData,
          progress: Math.max(conflict.sourceData.progress, conflict.targetData.progress)
        })
      })

      const conflict = ConflictTestDataFactory.createProgressConflict()
      const result = await service.executeAutoResolution(conflict, 'CUSTOM_MERGE')

      expect(result.success).toBe(true)
      expect(result.resolvedData.progress).toBe(75) // 取較大值
      expect(result.strategyUsed).toBe('CUSTOM_MERGE')
    })

    test('3.6 應該正確評估策略信心度', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const confidence = await service.evaluateStrategyConfidence(conflict, 'USE_LATEST_TIMESTAMP')

      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
      expect(typeof confidence).toBe('number')
    })

    test('3.7 應該正確處理策略執行失敗', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()

      // 測試不適用的策略
      const result = await service.executeAutoResolution(conflict, 'INVALID_STRATEGY')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.strategyUsed).toBe('INVALID_STRATEGY')
    })

    test('3.8 應該支援批次策略執行', async () => {
      const conflicts = ConflictTestDataFactory.createBatchConflictData(3)
      const results = await service.executeBatchResolution(conflicts, 'USE_LATEST_TIMESTAMP')

      expect(results).toHaveLength(3)
      expect(results.every(r => r.strategyUsed === 'USE_LATEST_TIMESTAMP')).toBe(true)

      // 驗證批次事件發送
      const batchEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH_RESOLVED')
      expect(batchEvents).toHaveLength(1)
      expect(batchEvents[0].data.resolvedCount).toBe(3)
    })

    test('3.9 應該正確更新策略效能指標', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

      const metrics = service.getStrategyMetrics()
      expect(metrics).toHaveProperty('USE_LATEST_TIMESTAMP')
      expect(metrics.USE_LATEST_TIMESTAMP.executionCount).toBe(1)
      expect(metrics.USE_LATEST_TIMESTAMP.successRate).toBe(1)
    })

    test('3.10 應該支援智能策略選擇', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const bestStrategy = await service.selectBestStrategy(conflict)

      expect(bestStrategy).toBeDefined()
      expect(bestStrategy.strategy).toBeDefined()
      expect(bestStrategy.confidence).toBeGreaterThan(0)
      expect(bestStrategy.reason).toBeDefined()
    })

    test('3.11 應該正確處理 INTELLIGENT_MERGE 策略', async () => {
      const tagConflict = ConflictTestDataFactory.createTagConflict()
      const result = await service.executeAutoResolution(tagConflict, 'INTELLIGENT_MERGE')

      expect(result.success).toBe(true)
      expect(result.resolvedData.tags).toBeDefined()
      expect(Array.isArray(result.resolvedData.tags)).toBe(true)
      // 應該包含所有唯一標籤
      expect(result.resolvedData.tags).toContain('readmoo')
    })

    test('3.12 應該支援策略推薦排序', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()
      const recommendations = await service.generateResolutionRecommendations(conflict)

      expect(recommendations.length).toBeGreaterThan(1)
      // 驗證按信心度排序
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].confidence).toBeGreaterThanOrEqual(recommendations[i].confidence)
      }
    })

    test('3.13 應該支援策略學習和優化', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()

      // 執行解決並提供回饋
      const result = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')
      await service.provideFeedback(result.resolutionId, {
        satisfaction: 4,
        effectiveness: 'good',
        suggestions: 'Strategy worked well for this type of conflict'
      })

      // 驗證學習效果
      const updatedMetrics = service.getStrategyMetrics()
      expect(updatedMetrics.USE_LATEST_TIMESTAMP.userSatisfaction).toBeDefined()
      expect(updatedMetrics.USE_LATEST_TIMESTAMP.userSatisfaction.averageRating).toBe(4)
    })

    test('3.14 應該正確處理策略適用性檢查', async () => {
      const progressConflict = ConflictTestDataFactory.createProgressConflict()
      const titleConflict = ConflictTestDataFactory.createTitleConflict()

      // USE_LATEST_TIMESTAMP 應該適用於進度衝突但不適用於標題衝突
      expect(await service.isStrategyApplicable(progressConflict, 'USE_LATEST_TIMESTAMP')).toBe(true)
      expect(await service.isStrategyApplicable(titleConflict, 'USE_LATEST_TIMESTAMP')).toBe(false)
    })

    test('3.15 應該支援策略結果驗證', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const result = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

      const validation = await service.validateResolutionResult(result)
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.confidence).toBeGreaterThan(0.8)
    })
  })

  // ==================== 4. Batch Processing Tests (8 tests) ====================

  describe('4. Batch Processing', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('4.1 應該正確執行大規模衝突批次檢測', async () => {
      const largeBatch = ConflictTestDataFactory.createBatchConflictData(50)
      const conflicts = await service.detectConflictsBatch(largeBatch)

      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts.length).toBeLessThanOrEqual(50)

      // 驗證批次處理指標
      const metrics = service.getBatchProcessingStatistics()
      expect(metrics.totalBatches).toBe(1)
      expect(metrics.totalItemsProcessed).toBe(50)
    })

    test('4.2 應該支援批次處理進度追蹤', async () => {
      const batch = ConflictTestDataFactory.createBatchConflictData(20)

      const progressEvents = []
      mockEventBus.on('DATA.CONFLICT.BATCH_PROGRESS', (event) => {
        progressEvents.push(event.data)
      })

      await service.executeBatchResolution(batch, 'USE_LATEST_TIMESTAMP')

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[progressEvents.length - 1].completed).toBe(20)
      expect(progressEvents[progressEvents.length - 1].total).toBe(20)
    })

    test('4.3 應該支援批次處理取消機制', async () => {
      const largeBatch = ConflictTestDataFactory.createBatchConflictData(100)

      // 開始批次處理
      const batchPromise = service.executeBatchResolution(largeBatch, 'USE_LATEST_TIMESTAMP')

      // 立即取消
      setTimeout(() => {
        service.cancelBatchProcessing('current')
      }, 10)

      const result = await batchPromise
      expect(result.cancelled).toBe(true)
      expect(result.processedCount).toBeLessThan(100)

      // 驗證取消事件
      const cancelEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH_CANCELLED')
      expect(cancelEvents).toHaveLength(1)
    })

    test('4.4 應該正確處理批次處理記憶體優化', async () => {
      // 設置記憶體限制
      service.config.performance.memoryLimit = 50 * 1024 * 1024 // 50MB

      const largeBatch = ConflictTestDataFactory.createBatchConflictData(200)
      const results = await service.executeBatchResolution(largeBatch, 'USE_LATEST_TIMESTAMP')

      // 驗證記憶體使用監控
      const memoryMetrics = service.getMemoryUsageMetrics()
      expect(memoryMetrics.peakUsage).toBeLessThan(service.config.performance.memoryLimit)
      expect(memoryMetrics.cleanupCount).toBeGreaterThan(0)
    })

    test('4.5 應該支援批次處理錯誤恢復', async () => {
      const mixedBatch = ConflictTestDataFactory.createBatchConflictData(10)

      // 故意破壞其中一個資料
      mixedBatch[5] = {
        type: 'INVALID_DATA',
        bookId: null,
        sourceData: null,
        targetData: null
      }

      const results = await service.executeBatchResolution(mixedBatch, 'USE_LATEST_TIMESTAMP')

      expect(results.successCount).toBe(9)
      expect(results.errorCount).toBe(1)
      expect(results.errors).toHaveLength(1)
      expect(results.errors[0].bookId).toBeNull()
    })

    test('4.6 應該正確分割大型批次以提升效能', async () => {
      // 設置小的批次大小
      service.config.resolutionStrategies.maxBatchSize = 10

      const largeBatch = ConflictTestDataFactory.createBatchConflictData(35)
      const results = await service.executeBatchResolution(largeBatch, 'USE_LATEST_TIMESTAMP')

      // 應該分成 4 個子批次處理 (10 + 10 + 10 + 5)
      const batchEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.SUB_BATCH_COMPLETED')
      expect(batchEvents.length).toBe(4)

      expect(results.successCount).toBe(35)
      expect(results.subBatchCount).toBe(4)
    })

    test('4.7 應該提供詳細的批次處理統計分析', async () => {
      const batch1 = ConflictTestDataFactory.createBatchConflictData(15)
      const batch2 = ConflictTestDataFactory.createBatchConflictData(25)

      await service.executeBatchResolution(batch1, 'USE_LATEST_TIMESTAMP')
      await service.executeBatchResolution(batch2, 'USE_SOURCE_PRIORITY')

      const statistics = service.getBatchProcessingStatistics()

      expect(statistics.totalBatches).toBe(2)
      expect(statistics.totalItemsProcessed).toBe(40)
      expect(statistics.averageBatchSize).toBe(20)
      expect(statistics.averageProcessingTime).toBeGreaterThan(0)
      expect(statistics.successRate).toBeGreaterThan(0.9)
    })

    test('4.8 應該支援批次處理完成通知和清理', async () => {
      const batch = ConflictTestDataFactory.createBatchConflictData(10)
      const results = await service.executeBatchResolution(batch, 'USE_LATEST_TIMESTAMP')

      // 驗證完成事件
      const completionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH_COMPLETED')
      expect(completionEvents).toHaveLength(1)
      expect(completionEvents[0].data.batchId).toBeDefined()
      expect(completionEvents[0].data.totalProcessed).toBe(10)

      // 驗證資源清理
      expect(service.activeBatches.size).toBe(0)
      expect(service.getMemoryUsageMetrics().currentUsage).toBeLessThan(1024 * 1024) // < 1MB
    })
  })

  // ==================== 5. User Interaction & Manual Resolution Tests (10 tests) ====================

  describe('5. User Interaction & Manual Resolution', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('5.1 應該正確處理手動解決請求', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()
      const manualResult = await service.requestManualResolution(conflict, {
        userId: 'test-user-001',
        priority: 'HIGH',
        deadline: Date.now() + 86400000 // 24小時後
      })

      expect(manualResult.resolutionId).toBeDefined()
      expect(manualResult.status).toBe('PENDING_USER_INPUT')
      expect(manualResult.assignedUser).toBe('test-user-001')

      // 驗證手動解決事件
      const manualEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.MANUAL_RESOLUTION_REQUESTED')
      expect(manualEvents).toHaveLength(1)
    })

    test('5.2 應該支援用戶偏好記錄和學習', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()

      // 記錄用戶偏好
      await service.recordUserPreference('test-user-001', {
        conflictType: 'PROGRESS_MISMATCH',
        preferredStrategy: 'USE_LATEST_TIMESTAMP',
        reasoning: 'Always trust the most recent update',
        confidence: 0.9
      })

      // 驗證偏好已記錄
      const userPreferences = service.getUserPreferences('test-user-001')
      expect(userPreferences).toHaveLength(1)
      expect(userPreferences[0].preferredStrategy).toBe('USE_LATEST_TIMESTAMP')

      // 測試基於偏好的推薦
      const recommendations = await service.generatePersonalizedRecommendations(conflict, 'test-user-001')
      expect(recommendations[0].strategy).toBe('USE_LATEST_TIMESTAMP')
      expect(recommendations[0].confidence).toBeGreaterThan(0.8)
    })

    test('5.3 應該支援個性化解決建議', async () => {
      const user = 'power-user-001'
      const conflict = ConflictTestDataFactory.createTitleConflict()

      // 建立用戶歷史
      await service.recordUserPreference(user, {
        conflictType: 'TITLE_DIFFERENCE',
        preferredStrategy: 'INTELLIGENT_MERGE',
        confidence: 0.85
      })

      const personalizedSuggestions = await service.generatePersonalizedRecommendations(conflict, user)

      expect(personalizedSuggestions).toHaveLength(1)
      expect(personalizedSuggestions[0].strategy).toBe('INTELLIGENT_MERGE')
      expect(personalizedSuggestions[0].personalized).toBe(true)
      expect(personalizedSuggestions[0].basedOnHistory).toBe(true)
    })

    test('5.4 應該支援解決工作流程管理', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()

      // 建立解決工作流程
      const workflowId = await service.createResolutionWorkflow(conflict, {
        reviewers: ['reviewer-001', 'reviewer-002'],
        approvalRequired: true,
        escalationRules: {
          timeoutHours: 24,
          escalateToManager: true
        }
      })

      expect(workflowId).toBeDefined()

      // 驗證工作流程狀態
      const workflow = service.getResolutionWorkflow(workflowId)
      expect(workflow.status).toBe('PENDING_REVIEW')
      expect(workflow.reviewers).toHaveLength(2)
      expect(workflow.currentStep).toBe('INITIAL_REVIEW')
    })

    test('5.5 應該支援解決歷程記錄和審計追蹤', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()

      // 執行解決並記錄歷程
      const resolution = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')
      await service.recordResolutionAudit(resolution.resolutionId, {
        action: 'AUTO_RESOLUTION_EXECUTED',
        user: 'system',
        strategy: 'USE_LATEST_TIMESTAMP',
        reason: 'Automatic resolution based on timestamp priority',
        timestamp: Date.now()
      })

      // 獲取審計記錄
      const auditTrail = service.getResolutionAuditTrail(resolution.resolutionId)
      expect(auditTrail).toHaveLength(1)
      expect(auditTrail[0].action).toBe('AUTO_RESOLUTION_EXECUTED')
      expect(auditTrail[0].strategy).toBe('USE_LATEST_TIMESTAMP')
    })

    test('5.6 應該支援用戶滿意度追蹤', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const resolution = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

      // 提供用戶滿意度回饋
      await service.trackUserSatisfaction(resolution.resolutionId, {
        userId: 'test-user-001',
        rating: 4,
        feedback: 'Resolution worked well, saved time',
        wouldRecommend: true,
        strategyEffectiveness: 'high'
      })

      // 驗證滿意度已記錄
      const satisfactionData = service.getUserSatisfactionMetrics('USE_LATEST_TIMESTAMP')
      expect(satisfactionData.totalRatings).toBe(1)
      expect(satisfactionData.averageRating).toBe(4)
      expect(satisfactionData.recommendationRate).toBe(1)
    })

    test('5.7 應該支援衝突解決的撤銷和重做', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()
      const resolution = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

      // 撤銷解決方案
      const undoResult = await service.undoResolution(resolution.resolutionId, {
        reason: 'User requested change',
        userId: 'test-user-001'
      })

      expect(undoResult.success).toBe(true)
      expect(undoResult.previousState).toBeDefined()

      // 重做解決方案
      const redoResult = await service.redoResolution(resolution.resolutionId)
      expect(redoResult.success).toBe(true)
      expect(redoResult.restoredState).toEqual(resolution.resolvedData)

      // 驗證撤銷/重做事件
      const undoEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.RESOLUTION_UNDONE')
      const redoEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.RESOLUTION_REDONE')
      expect(undoEvents).toHaveLength(1)
      expect(redoEvents).toHaveLength(1)
    })

    test('5.8 應該支援衝突升級機制', async () => {
      const highPriorityConflict = ConflictTestDataFactory.createComplexConflict()

      // 嘗試自動解決失敗，觸發升級
      const escalationResult = await service.escalateConflict(highPriorityConflict, {
        reason: 'AUTO_RESOLUTION_FAILED',
        targetRole: 'SENIOR_ANALYST',
        urgency: 'HIGH',
        businessImpact: 'Data inconsistency affecting user experience'
      })

      expect(escalationResult.escalated).toBe(true)
      expect(escalationResult.assignedTo).toBe('SENIOR_ANALYST')
      expect(escalationResult.escalationLevel).toBe(1)

      // 驗證升級事件
      const escalationEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.ESCALATED')
      expect(escalationEvents).toHaveLength(1)
      expect(escalationEvents[0].data.urgency).toBe('HIGH')
    })

    test('5.9 應該支援解決方案驗證和確認', async () => {
      const conflict = ConflictTestDataFactory.createTitleConflict()
      const resolution = await service.executeAutoResolution(conflict, 'INTELLIGENT_MERGE')

      // 請求用戶確認
      const confirmationRequest = await service.requestUserConfirmation(resolution.resolutionId, {
        userId: 'test-user-001',
        showDetails: true,
        requireJustification: true
      })

      expect(confirmationRequest.confirmationId).toBeDefined()
      expect(confirmationRequest.status).toBe('PENDING_CONFIRMATION')

      // 用戶確認解決方案
      const confirmation = await service.confirmResolution(confirmationRequest.confirmationId, {
        approved: true,
        justification: 'Merge result looks correct',
        additionalNotes: 'No further action needed'
      })

      expect(confirmation.confirmed).toBe(true)
      expect(confirmation.finalStatus).toBe('CONFIRMED')
    })

    test('5.10 應該提供用戶解決統計和績效分析', async () => {
      const user = 'analyst-001'

      // 模擬多次解決活動
      for (let i = 0; i < 5; i++) {
        const conflict = ConflictTestDataFactory.createProgressConflict()
        conflict.bookId = `perf-test-${i}`
        const resolution = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')

        await service.trackUserSatisfaction(resolution.resolutionId, {
          userId: user,
          rating: 4 + (i % 2), // 4或5分
          feedback: `Resolution ${i} feedback`
        })
      }

      // 獲取用戶績效統計
      const userStats = service.getUserPerformanceStats(user)
      expect(userStats.totalResolutions).toBe(5)
      expect(userStats.averageRating).toBeGreaterThan(4)
      expect(userStats.activityPeriod).toBeDefined()
      expect(userStats.mostUsedStrategy).toBe('USE_LATEST_TIMESTAMP')
    })
  })

  // ==================== 6. Integration & Event Handling Tests (6 tests) ====================

  describe('6. Integration & Event Handling', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('6.1 應該正確處理來自 Data Synchronization Service 的衝突事件', async () => {
      const conflictData = ConflictTestDataFactory.createProgressConflict()

      // 模擬來自同步服務的衝突檢測事件
      await mockEventBus.emit('DATA.SYNC.CONFLICT_DETECTED', {
        conflicts: [conflictData],
        syncJobId: 'sync-job-001',
        source: 'DataSynchronizationService'
      })

      // 等待處理完成
      await new Promise(resolve => setTimeout(resolve, 100))

      // 驗證衝突已被處理
      const processedEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.PROCESSED')
      expect(processedEvents).toHaveLength(1)
      expect(processedEvents[0].data.syncJobId).toBe('sync-job-001')
    })

    test('6.2 應該正確與 Data Domain Coordinator 協作', async () => {
      const batchConflicts = ConflictTestDataFactory.createBatchConflictData(5)

      // 模擬來自協調器的批次處理請求
      await mockEventBus.emit('DATA.CONFLICT.BATCH_PROCESS_REQUESTED', {
        conflicts: batchConflicts,
        requestId: 'coord-request-001',
        priority: 'HIGH',
        requestedBy: 'DataDomainCoordinator'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // 驗證協作響應
      const responseEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH_COMPLETED')
      expect(responseEvents).toHaveLength(1)
      expect(responseEvents[0].data.requestId).toBe('coord-request-001')
      expect(responseEvents[0].data.processedCount).toBe(5)
    })

    test('6.3 應該正確處理跨服務狀態同步', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()

      // 執行解決並驗證狀態同步事件
      const resolution = await service.executeAutoResolution(conflict, 'INTELLIGENT_MERGE')

      // 驗證狀態同步事件序列
      const events = mockEventBus.getEmittedEvents()
      const relevantEvents = events.filter(e =>
        e.eventType.startsWith('DATA.CONFLICT.') &&
        e.data.resolutionId === resolution.resolutionId
      )

      expect(relevantEvents.length).toBeGreaterThan(2)

      // 驗證事件順序
      const eventTypes = relevantEvents.map(e => e.eventType)
      expect(eventTypes).toContain('DATA.CONFLICT.RESOLUTION_STARTED')
      expect(eventTypes).toContain('DATA.CONFLICT.RESOLVED')
    })

    test('6.4 應該支援複雜的事件工作流程和狀態機', async () => {
      const conflict = ConflictTestDataFactory.createComplexConflict()

      // 啟動複雜的解決工作流程
      const workflowId = await service.createResolutionWorkflow(conflict, {
        requiresApproval: true,
        reviewers: ['reviewer-001'],
        maxRetries: 3
      })

      // 推進工作流程狀態
      await service.progressWorkflow(workflowId, 'APPROVE', {
        reviewerId: 'reviewer-001',
        comments: 'Approved with minor concerns'
      })

      // 驗證工作流程事件序列
      const workflowEvents = mockEventBus.getEmittedEvents().filter(e =>
        e.eventType.includes('WORKFLOW') && e.data.workflowId === workflowId
      )

      expect(workflowEvents.length).toBeGreaterThan(1)
      expect(workflowEvents.some(e => e.eventType.includes('CREATED'))).toBe(true)
      expect(workflowEvents.some(e => e.eventType.includes('APPROVED'))).toBe(true)
    })

    test('6.5 應該正確處理事件驅動的錯誤恢復', async () => {
      const conflicts = ConflictTestDataFactory.createBatchConflictData(3)

      // 故意破壞中間的資料以觸發錯誤
      conflicts[1] = { invalid: 'data' }

      // 執行批次處理並監控錯誤恢復
      const results = await service.executeBatchResolution(conflicts, 'USE_LATEST_TIMESTAMP')

      // 驗證錯誤恢復事件
      const errorEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.PROCESSING_ERROR')
      const recoveryEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.ERROR_RECOVERED')

      expect(errorEvents).toHaveLength(1)
      expect(recoveryEvents).toHaveLength(1)
      expect(results.successCount).toBe(2) // 成功處理2個
      expect(results.errorCount).toBe(1)
    })

    test('6.6 應該支援事件生命週期的完整追蹤', async () => {
      const conflict = ConflictTestDataFactory.createProgressConflict()

      // 清除之前的事件記錄
      mockEventBus.clearEmittedEvents()

      // 執行完整的衝突解決生命週期
      const resolution = await service.executeAutoResolution(conflict, 'USE_LATEST_TIMESTAMP')
      await service.trackUserSatisfaction(resolution.resolutionId, {
        userId: 'test-user',
        rating: 5,
        feedback: 'Excellent resolution'
      })

      // 分析完整的事件生命週期
      const allEvents = mockEventBus.getEmittedEvents()
      const lifecycleEvents = allEvents.filter(e =>
        e.data.resolutionId === resolution.resolutionId ||
        e.data.conflictId === conflict.bookId
      )

      // 驗證生命週期完整性
      expect(lifecycleEvents.length).toBeGreaterThan(3)

      // 檢查時間順序
      for (let i = 1; i < lifecycleEvents.length; i++) {
        expect(lifecycleEvents[i].timestamp).toBeGreaterThanOrEqual(lifecycleEvents[i - 1].timestamp)
      }

      // 驗證關鍵事件存在
      const eventTypes = lifecycleEvents.map(e => e.eventType)
      expect(eventTypes.some(t => t.includes('STARTED'))).toBe(true)
      expect(eventTypes.some(t => t.includes('RESOLVED'))).toBe(true)
      expect(eventTypes.some(t => t.includes('SATISFACTION'))).toBe(true)
    })
  })

  // ==================== 7. Performance & Analytics Tests (4 tests) ====================

  describe('7. Performance & Analytics', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    test('7.1 應該正確追蹤和報告大規模處理效能', async () => {
      const largeBatch = ConflictTestDataFactory.createBatchConflictData(100)

      const startTime = Date.now()
      await service.executeBatchResolution(largeBatch, 'USE_LATEST_TIMESTAMP')
      const processingTime = Date.now() - startTime

      // 驗證效能指標
      const performanceMetrics = service.getPerformanceMetrics()
      expect(performanceMetrics.avgDetectionTime).toBeGreaterThan(0)
      expect(performanceMetrics.avgResolutionTime).toBeGreaterThan(0)
      expect(performanceMetrics.totalProcessingTime).toBeGreaterThan(0)
      expect(performanceMetrics.conflictsDetected).toBe(100)

      // 驗證效能符合要求 (應該在30秒內完成)
      expect(processingTime).toBeLessThan(30000)
    })

    test('7.2 應該提供策略效果統計和分析功能', async () => {
      // 使用不同策略處理多個衝突
      const conflicts = ConflictTestDataFactory.createBatchConflictData(20)

      for (let i = 0; i < conflicts.length; i++) {
        const strategy = i % 2 === 0 ? 'USE_LATEST_TIMESTAMP' : 'USE_SOURCE_PRIORITY'
        await service.executeAutoResolution(conflicts[i], strategy)
      }

      // 獲取策略效果分析
      const strategyAnalysis = service.generateStrategyEffectivenessReport()

      expect(strategyAnalysis.strategies).toHaveProperty('USE_LATEST_TIMESTAMP')
      expect(strategyAnalysis.strategies).toHaveProperty('USE_SOURCE_PRIORITY')

      const timestampStrategy = strategyAnalysis.strategies.USE_LATEST_TIMESTAMP
      expect(timestampStrategy.executionCount).toBe(10)
      expect(timestampStrategy.successRate).toBeGreaterThan(0.8)
      expect(timestampStrategy.averageExecutionTime).toBeGreaterThan(0)
    })

    test('7.3 應該支援記憶體使用監控和優化', async () => {
      // 執行記憶體密集的操作
      const largeBatch = ConflictTestDataFactory.createBatchConflictData(200)

      // 監控記憶體使用
      const beforeMemory = service.getMemoryUsageMetrics()
      await service.executeBatchResolution(largeBatch, 'INTELLIGENT_MERGE')
      const afterMemory = service.getMemoryUsageMetrics()

      // 驗證記憶體監控
      expect(afterMemory.peakUsage).toBeGreaterThan(beforeMemory.currentUsage)
      expect(afterMemory.cleanupCount).toBeGreaterThan(0)

      // 驗證記憶體清理機制
      await service.performMemoryCleanup()
      const cleanedMemory = service.getMemoryUsageMetrics()
      expect(cleanedMemory.currentUsage).toBeLessThan(afterMemory.peakUsage)
    })

    test('7.4 應該生成comprehensive performance report', async () => {
      // 執行多種操作以產生豐富的效能資料
      const conflicts1 = ConflictTestDataFactory.createBatchConflictData(15)
      const conflicts2 = ConflictTestDataFactory.createBatchConflictData(25)

      await service.executeBatchResolution(conflicts1, 'USE_LATEST_TIMESTAMP')
      await service.executeBatchResolution(conflicts2, 'INTELLIGENT_MERGE')

      // 添加一些用戶滿意度資料
      const resolution = await service.executeAutoResolution(
        ConflictTestDataFactory.createProgressConflict(),
        'USE_LATEST_TIMESTAMP'
      )
      await service.trackUserSatisfaction(resolution.resolutionId, {
        userId: 'test-user',
        rating: 4,
        feedback: 'Good performance'
      })

      // 生成綜合效能報告
      const report = service.generatePerformanceReport()

      // 驗證報告完整性
      expect(report.summary).toBeDefined()
      expect(report.summary.totalConflictsProcessed).toBe(41) // 15 + 25 + 1
      expect(report.summary.totalResolutionsExecuted).toBe(41)
      expect(report.summary.overallSuccessRate).toBeGreaterThan(0.9)

      expect(report.strategyPerformance).toBeDefined()
      expect(report.memoryUsage).toBeDefined()
      expect(report.userSatisfaction).toBeDefined()
      expect(report.recommendations).toBeDefined()
      expect(report.recommendations.length).toBeGreaterThan(0)
    })
  })

  // ==================== 整合驗證測試 ====================

  describe('Integration Verification', () => {
    test('應該完整驗證 Conflict Resolution Service 與整體架構的整合', async () => {
      await service.initialize()

      // 驗證 BaseModule 繼承
      expect(service.isInitialized).toBe(true)
      expect(service.moduleName).toBe('ConflictResolutionService')
      expect(typeof service.getHealthStatus).toBe('function')

      // 驗證事件系統整合
      expect(mockEventBus.events.size).toBeGreaterThan(0)

      // 驗證配置管理
      expect(service.config).toBeDefined()
      expect(service.config.detectionThresholds).toBeDefined()

      // 驗證核心功能模組
      expect(service.conflictDetector).toBeDefined()
      expect(service.resolutionEngine).toBeDefined()
      expect(service.performanceMetrics).toBeDefined()

      // 驗證日誌記錄
      const logs = mockLogger.getLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some(log => log.message.includes('ConflictResolutionService'))).toBe(true)
    })
  })
})
