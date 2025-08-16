/**
 * @fileoverview Conflict Resolution Service 單元測試
 * @version v2.0.0
 * @since 2025-08-16
 */

const ConflictResolutionService = require('../../../../../src/background/domains/data-management/services/conflict-resolution-service.js')

// Mock EventBus (複用已驗證的增強版本)
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

// 測試資料工廠
const createConflictTestData = () => ({
  // 基本進度衝突
  progressConflict: {
    sourceBook: {
      id: 'book_001',
      title: '測試書籍',
      progress: 45,
      lastUpdated: '2025-08-16T10:00:00Z',
      platform: 'READMOO'
    },
    targetBook: {
      id: 'book_001', 
      title: '測試書籍',
      progress: 75,
      lastUpdated: '2025-08-16T11:00:00Z',
      platform: 'KINDLE'
    },
    expectedType: 'PROGRESS_MISMATCH',
    expectedSeverity: 'MEDIUM'
  },

  // 標題差異衝突
  titleConflict: {
    sourceBook: {
      id: 'book_002',
      title: '原始書名',
      progress: 50,
      lastUpdated: '2025-08-16T10:00:00Z',
      platform: 'READMOO'
    },
    targetBook: {
      id: 'book_002',
      title: '修改後書名',
      progress: 50,
      lastUpdated: '2025-08-16T10:30:00Z',
      platform: 'KINDLE'
    },
    expectedType: 'TITLE_DIFFERENCE',
    expectedSeverity: 'HIGH'
  },

  // 時間戳衝突
  timestampConflict: {
    sourceBook: {
      id: 'book_003',
      title: '時間測試書',
      progress: 60,
      lastUpdated: '2025-08-15T10:00:00Z', // 1天前
      platform: 'READMOO'
    },
    targetBook: {
      id: 'book_003',
      title: '時間測試書',
      progress: 60,
      lastUpdated: '2025-08-16T10:00:00Z', // 現在
      platform: 'KINDLE'
    },
    expectedType: 'TIMESTAMP_CONFLICT',
    expectedSeverity: 'MEDIUM'
  },

  // 複合衝突（多種類型同時存在）
  complexConflict: {
    sourceBook: {
      id: 'book_004',
      title: '複雜衝突書籍',
      progress: 30,
      lastUpdated: '2025-08-15T08:00:00Z',
      tags: ['readmoo', 'fiction'],
      platform: 'READMOO'
    },
    targetBook: {
      id: 'book_004',
      title: '複雜衝突書籍(修改)',
      progress: 80,
      lastUpdated: '2025-08-16T12:00:00Z',
      tags: ['kindle', 'fiction', 'favorite'],
      platform: 'KINDLE'
    },
    expectedTypes: ['PROGRESS_MISMATCH', 'TITLE_DIFFERENCE', 'TAG_DIFFERENCE'],
    expectedSeverity: 'HIGH'
  },

  // 批次衝突測試資料
  batchConflicts: Array.from({ length: 50 }, (_, i) => ({
    sourceBook: {
      id: `batch_${i}`,
      title: `批次書籍 ${i}`,
      progress: i % 100,
      lastUpdated: '2025-08-16T09:00:00Z',
      platform: 'READMOO'
    },
    targetBook: {
      id: `batch_${i}`,
      title: `批次書籍 ${i}`,
      progress: (i + 25) % 100,
      lastUpdated: '2025-08-16T10:00:00Z',
      platform: 'KINDLE'
    }
  }))
})

describe('ConflictResolutionService', () => {
  let conflictService
  let mockEventBus
  let mockLogger
  let testConfig
  let testData

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockLogger = new MockLogger()
    testData = createConflictTestData()
    
    testConfig = {
      conflictDetection: {
        progressThreshold: 10, // 進度差異 10% 以上視為衝突
        titleSimilarityThreshold: 0.8, // 標題相似度 80% 以下視為衝突
        timestampThreshold: 3600000, // 1小時以上時間差視為衝突
        enableComplexDetection: true
      },
      resolutionStrategies: {
        autoResolveThreshold: 0.8, // 信心度 80% 以上自動解決
        enableUserLearning: false, // 測試中關閉用戶學習
        batchProcessingLimit: 100
      },
      performance: {
        enableMetrics: true,
        cleanupInterval: 0 // 測試中關閉自動清理
      }
    }

    conflictService = new ConflictResolutionService(mockEventBus, {
      logger: mockLogger,
      config: testConfig
    })
  })

  afterEach(async () => {
    if (conflictService && conflictService.isRunning) {
      await conflictService.stop()
    }
  })

  describe('Construction & Initialization', () => {
    test('should create service with proper dependencies', () => {
      expect(conflictService).toBeDefined()
      expect(conflictService.eventBus).toBe(mockEventBus)
      expect(conflictService.logger).toBe(mockLogger)
      expect(conflictService.isInitialized).toBe(false)
      expect(conflictService.isRunning).toBe(false)
    })

    test('should merge configuration correctly', () => {
      expect(conflictService.effectiveConfig.conflictDetection.progressThreshold).toBe(10)
      expect(conflictService.effectiveConfig.resolutionStrategies.autoResolveThreshold).toBe(0.8)
      expect(conflictService.effectiveConfig.performance.enableMetrics).toBe(true)
    })

    test('should initialize successfully', async () => {
      await conflictService.initialize()

      expect(conflictService.isInitialized).toBe(true)
      
      // 檢查初始化事件發送
      const initEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.SERVICE.INITIALIZED')
      expect(initEvents).toHaveLength(1)
      expect(initEvents[0].data.detectionTypes).toEqual(
        expect.arrayContaining(['PROGRESS_MISMATCH', 'TITLE_DIFFERENCE', 'TIMESTAMP_CONFLICT'])
      )
      expect(initEvents[0].data.strategyCount).toBeGreaterThan(0)
    })

    test('should register event listeners', async () => {
      await conflictService.initialize()

      // 檢查關鍵事件監聽器註冊
      expect(mockEventBus.events.has('DATA.CONFLICT.DETECTED')).toBe(true)
      expect(mockEventBus.events.has('DATA.CONFLICT.RESOLUTION.REQUESTED')).toBe(true)
      expect(mockEventBus.events.has('DATA.SYNC.CONFLICT.FOUND')).toBe(true)
      expect(mockEventBus.events.has('USER.CONFLICT.MANUAL.RESOLUTION')).toBe(true)
    })

    test('should load conflict detection rules', async () => {
      await conflictService.initialize()

      expect(conflictService.detectionRules).toBeDefined()
      expect(conflictService.detectionRules.size).toBeGreaterThan(0)
      
      // 檢查核心規則存在
      expect(conflictService.detectionRules.has('PROGRESS_MISMATCH')).toBe(true)
      expect(conflictService.detectionRules.has('TITLE_DIFFERENCE')).toBe(true)
      expect(conflictService.detectionRules.has('TIMESTAMP_CONFLICT')).toBe(true)
    })

    test('should load resolution strategies', async () => {
      await conflictService.initialize()

      expect(conflictService.resolutionStrategies).toBeDefined()
      expect(conflictService.resolutionStrategies.size).toBeGreaterThan(0)
      
      // 檢查核心策略存在
      expect(conflictService.resolutionStrategies.has('USE_LATEST_TIMESTAMP')).toBe(true)
      expect(conflictService.resolutionStrategies.has('USE_SOURCE_PRIORITY')).toBe(true)
      expect(conflictService.resolutionStrategies.has('MANUAL_REVIEW')).toBe(true)
    })

    test('should handle initialization failure gracefully', async () => {
      const badService = new ConflictResolutionService(null, {
        logger: mockLogger,
        config: testConfig
      })

      await expect(badService.initialize()).rejects.toThrow()
      expect(badService.isInitialized).toBe(false)
    })
  })

  describe('Conflict Detection Engine', () => {
    beforeEach(async () => {
      await conflictService.initialize()
    })

    test('should detect progress mismatch conflicts', async () => {
      const { sourceBook, targetBook } = testData.progressConflict
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      expect(conflicts).toBeDefined()
      expect(conflicts.length).toBeGreaterThan(0)
      
      const progressConflict = conflicts.find(c => c.type === 'PROGRESS_MISMATCH')
      expect(progressConflict).toBeDefined()
      expect(progressConflict.severity).toBe('MEDIUM')
      expect(progressConflict.confidence).toBeGreaterThan(0.7)
    })

    test('should detect title difference conflicts', async () => {
      const { sourceBook, targetBook } = testData.titleConflict
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const titleConflict = conflicts.find(c => c.type === 'TITLE_DIFFERENCE')
      expect(titleConflict).toBeDefined()
      expect(titleConflict.severity).toBe('HIGH')
      expect(titleConflict.details.sourceTitle).toBe('原始書名')
      expect(titleConflict.details.targetTitle).toBe('修改後書名')
    })

    test('should detect timestamp conflicts', async () => {
      const { sourceBook, targetBook } = testData.timestampConflict
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const timestampConflict = conflicts.find(c => c.type === 'TIMESTAMP_CONFLICT')
      expect(timestampConflict).toBeDefined()
      expect(timestampConflict.severity).toBe('MEDIUM')
      expect(timestampConflict.details.timeDifference).toBeGreaterThan(0)
    })

    test('should handle complex multi-type conflicts', async () => {
      const { sourceBook, targetBook } = testData.complexConflict
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      expect(conflicts.length).toBeGreaterThan(1)
      
      const detectedTypes = conflicts.map(c => c.type)
      expect(detectedTypes).toEqual(expect.arrayContaining(['PROGRESS_MISMATCH', 'TITLE_DIFFERENCE']))
    })

    test('should calculate conflict severity correctly', async () => {
      const highSeverityData = {
        sourceBook: { id: 'test', progress: 0, title: 'Original' },
        targetBook: { id: 'test', progress: 100, title: 'Completely Different' }
      }
      
      const conflicts = await conflictService.detectConflicts(
        highSeverityData.sourceBook, 
        highSeverityData.targetBook
      )
      
      const severities = conflicts.map(c => c.severity)
      expect(severities).toContain('HIGH')
    })

    test('should return no conflicts for identical books', async () => {
      const identicalBook = {
        id: 'identical',
        title: '相同書籍',
        progress: 50,
        lastUpdated: '2025-08-16T10:00:00Z'
      }
      
      const conflicts = await conflictService.detectConflicts(identicalBook, identicalBook)
      
      expect(conflicts).toEqual([])
    })

    test('should handle missing or invalid data gracefully', async () => {
      const invalidCases = [
        { sourceBook: null, targetBook: testData.progressConflict.targetBook },
        { sourceBook: testData.progressConflict.sourceBook, targetBook: null },
        { sourceBook: {}, targetBook: testData.progressConflict.targetBook },
        { sourceBook: { id: 'test' }, targetBook: { differentId: 'test2' } }
      ]
      
      for (const { sourceBook, targetBook } of invalidCases) {
        const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
        // 應該優雅處理而不拋出錯誤
        expect(Array.isArray(conflicts)).toBe(true)
      }
    })

    test('should support custom detection rules', async () => {
      // 新增自定義檢測規則
      const customRule = {
        type: 'CUSTOM_FIELD_CONFLICT',
        detector: (source, target) => source.customField !== target.customField,
        severityCalculator: () => 'LOW',
        confidence: 0.6
      }
      
      conflictService.addDetectionRule(customRule)
      
      const sourceBook = { id: 'test', customField: 'value1' }
      const targetBook = { id: 'test', customField: 'value2' }
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const customConflict = conflicts.find(c => c.type === 'CUSTOM_FIELD_CONFLICT')
      expect(customConflict).toBeDefined()
    })

    test('should handle large-scale conflict detection efficiently', async () => {
      const startTime = Date.now()
      
      // 批次檢測多個衝突
      const batchResults = await Promise.all(
        testData.batchConflicts.map(({ sourceBook, targetBook }) =>
          conflictService.detectConflicts(sourceBook, targetBook)
        )
      )
      
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(5000) // 5秒內完成
      expect(batchResults.length).toBe(testData.batchConflicts.length)
    })

    test('should provide detailed conflict metadata', async () => {
      const { sourceBook, targetBook } = testData.progressConflict
      
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      const conflict = conflicts[0]
      
      expect(conflict.id).toBeDefined()
      expect(conflict.bookId).toBe(sourceBook.id)
      expect(conflict.detectedAt).toBeDefined()
      expect(conflict.platforms).toEqual(expect.arrayContaining([sourceBook.platform, targetBook.platform]))
      expect(conflict.details).toBeDefined()
    })

    test('should track detection performance metrics', async () => {
      const initialMetrics = conflictService.performanceMetrics
      const initialDetectionCount = initialMetrics.conflictsDetected
      
      await conflictService.detectConflicts(
        testData.progressConflict.sourceBook,
        testData.progressConflict.targetBook
      )
      
      const updatedMetrics = conflictService.performanceMetrics
      expect(updatedMetrics.conflictsDetected).toBeGreaterThan(initialDetectionCount)
      expect(updatedMetrics.avgDetectionTime).toBeGreaterThan(0)
    })

    test('should emit conflict detection events', async () => {
      mockEventBus.clearEmittedEvents()
      
      await conflictService.detectConflicts(
        testData.progressConflict.sourceBook,
        testData.progressConflict.targetBook
      )
      
      const detectionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.DETECTED')
      expect(detectionEvents.length).toBeGreaterThan(0)
      
      const event = detectionEvents[0]
      expect(event.data.conflicts).toBeDefined()
      expect(event.data.bookId).toBe(testData.progressConflict.sourceBook.id)
    })
  })

  describe('Resolution Strategy Engine', () => {
    beforeEach(async () => {
      await conflictService.initialize()
    })

    test('should generate resolution recommendations', async () => {
      const { sourceBook, targetBook } = testData.progressConflict
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const recommendations = await conflictService.generateResolutionRecommendations(conflicts)
      
      expect(recommendations).toBeDefined()
      expect(recommendations.length).toBeGreaterThan(0)
      
      const recommendation = recommendations[0]
      expect(recommendation.strategy).toBeDefined()
      expect(recommendation.confidence).toBeGreaterThan(0)
      expect(recommendation.description).toBeDefined()
      expect(recommendation.expectedOutcome).toBeDefined()
    })

    test('should recommend USE_LATEST_TIMESTAMP strategy for progress conflicts', async () => {
      const progressConflictData = {
        id: 'test_conflict',
        type: 'PROGRESS_MISMATCH',
        bookId: 'book_001',
        details: {
          sourceProgress: 45,
          targetProgress: 75,
          sourceTimestamp: '2025-08-16T10:00:00Z',
          targetTimestamp: '2025-08-16T11:00:00Z'
        }
      }
      
      const recommendations = await conflictService.generateResolutionRecommendations([progressConflictData])
      
      const timestampStrategy = recommendations.find(r => r.strategy === 'USE_LATEST_TIMESTAMP')
      expect(timestampStrategy).toBeDefined()
      expect(timestampStrategy.confidence).toBeGreaterThan(0.8)
    })

    test('should recommend MANUAL_REVIEW for complex conflicts', async () => {
      const { sourceBook, targetBook } = testData.complexConflict
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const recommendations = await conflictService.generateResolutionRecommendations(conflicts)
      
      const manualReview = recommendations.find(r => r.strategy === 'MANUAL_REVIEW')
      expect(manualReview).toBeDefined()
      expect(manualReview.reason).toContain('複雜')
    })

    test('should execute automatic resolution for high-confidence strategies', async () => {
      const highConfidenceConflict = {
        id: 'auto_resolve_test',
        type: 'PROGRESS_MISMATCH',
        bookId: 'book_001',
        details: {
          sourceProgress: 45,
          targetProgress: 75,
          sourceTimestamp: '2025-08-16T09:00:00Z',
          targetTimestamp: '2025-08-16T11:00:00Z'
        }
      }
      
      const resolutionResult = await conflictService.executeAutoResolution(highConfidenceConflict)
      
      expect(resolutionResult.success).toBe(true)
      expect(resolutionResult.strategy).toBeDefined()
      expect(resolutionResult.resolvedValue).toBeDefined()
      expect(resolutionResult.confidence).toBeGreaterThan(conflictService.effectiveConfig.resolutionStrategies.autoResolveThreshold)
    })

    test('should support custom resolution strategies', async () => {
      const customStrategy = {
        name: 'CUSTOM_AVERAGE_STRATEGY',
        applicable: (conflict) => conflict.type === 'PROGRESS_MISMATCH',
        confidence: 0.7,
        execute: (conflict) => ({
          resolvedValue: Math.round((conflict.details.sourceProgress + conflict.details.targetProgress) / 2),
          reasoning: '使用平均值解決進度衝突'
        })
      }
      
      conflictService.addResolutionStrategy(customStrategy)
      
      const progressConflict = {
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 40, targetProgress: 60 }
      }
      
      const recommendations = await conflictService.generateResolutionRecommendations([progressConflict])
      
      const customRecommendation = recommendations.find(r => r.strategy === 'CUSTOM_AVERAGE_STRATEGY')
      expect(customRecommendation).toBeDefined()
      expect(customRecommendation.confidence).toBe(0.7)
    })

    test('should track resolution success rates', async () => {
      const initialMetrics = conflictService.performanceMetrics
      
      const testConflict = {
        id: 'metrics_test',
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 30, targetProgress: 70 }
      }
      
      await conflictService.executeAutoResolution(testConflict)
      
      const updatedMetrics = conflictService.performanceMetrics
      expect(updatedMetrics.resolutionsAttempted).toBeGreaterThan(initialMetrics.resolutionsAttempted)
    })

    test('should handle resolution failures gracefully', async () => {
      const problematicConflict = {
        id: 'failure_test',
        type: 'UNKNOWN_CONFLICT',
        details: {} // 缺少必要資料
      }
      
      const resolutionResult = await conflictService.executeAutoResolution(problematicConflict)
      
      expect(resolutionResult.success).toBe(false)
      expect(resolutionResult.error).toBeDefined()
      expect(resolutionResult.fallbackStrategy).toBe('MANUAL_REVIEW')
    })

    test('should provide resolution confidence scoring', async () => {
      const testCases = [
        { type: 'PROGRESS_MISMATCH', expectedConfidence: 'high' },
        { type: 'TITLE_DIFFERENCE', expectedConfidence: 'medium' },
        { type: 'COMPLEX_MULTI', expectedConfidence: 'low' }
      ]
      
      for (const testCase of testCases) {
        const conflict = { type: testCase.type, details: {} }
        const recommendations = await conflictService.generateResolutionRecommendations([conflict])
        
        if (recommendations.length > 0) {
          const confidence = recommendations[0].confidence
          
          switch (testCase.expectedConfidence) {
            case 'high':
              expect(confidence).toBeGreaterThan(0.8)
              break
            case 'medium':
              expect(confidence).toBeGreaterThanOrEqual(0.5)
              expect(confidence).toBeLessThanOrEqual(0.8)
              break
            case 'low':
              expect(confidence).toBeLessThan(0.5)
              break
          }
        }
      }
    })

    test('should generate detailed resolution explanations', async () => {
      const { sourceBook, targetBook } = testData.progressConflict
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const recommendations = await conflictService.generateResolutionRecommendations(conflicts)
      const recommendation = recommendations[0]
      
      expect(recommendation.explanation).toBeDefined()
      expect(recommendation.explanation.reasoning).toBeDefined()
      expect(recommendation.explanation.pros).toBeDefined()
      expect(recommendation.explanation.cons).toBeDefined()
      expect(recommendation.explanation.riskAssessment).toBeDefined()
    })

    test('should support batch resolution processing', async () => {
      const multipleConflicts = testData.batchConflicts.slice(0, 10).map((conflict, i) => ({
        id: `batch_conflict_${i}`,
        type: 'PROGRESS_MISMATCH',
        bookId: conflict.sourceBook.id,
        details: {
          sourceProgress: conflict.sourceBook.progress,
          targetProgress: conflict.targetBook.progress
        }
      }))
      
      const batchResults = await conflictService.executeBatchResolution(multipleConflicts)
      
      expect(batchResults.totalProcessed).toBe(multipleConflicts.length)
      expect(batchResults.successfulResolutions).toBeGreaterThan(0)
      expect(batchResults.results.length).toBe(multipleConflicts.length)
    })

    test('should emit resolution events', async () => {
      mockEventBus.clearEmittedEvents()
      
      const testConflict = {
        id: 'event_test',
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 25, targetProgress: 75 }
      }
      
      await conflictService.executeAutoResolution(testConflict)
      
      const resolutionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.RESOLVED')
      expect(resolutionEvents.length).toBeGreaterThan(0)
      
      const event = resolutionEvents[0]
      expect(event.data.conflictId).toBe(testConflict.id)
      expect(event.data.strategy).toBeDefined()
      expect(event.data.result).toBeDefined()
    })

    test('should validate resolution results', async () => {
      const testConflict = {
        id: 'validation_test',
        type: 'PROGRESS_MISMATCH',
        bookId: 'book_001',
        details: {
          sourceProgress: 30,
          targetProgress: 80,
          sourceTimestamp: '2025-08-16T10:00:00Z',
          targetTimestamp: '2025-08-16T11:00:00Z'
        }
      }
      
      const resolutionResult = await conflictService.executeAutoResolution(testConflict)
      
      if (resolutionResult.success) {
        expect(resolutionResult.validation.isValid).toBe(true)
        expect(resolutionResult.validation.confidence).toBeDefined()
        expect(resolutionResult.resolvedValue).toBeGreaterThanOrEqual(0)
        expect(resolutionResult.resolvedValue).toBeLessThanOrEqual(100)
      }
    })

    test('should learn from resolution outcomes', async () => {
      // 模擬解決方案執行和結果回饋
      const testConflict = {
        id: 'learning_test',
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 40, targetProgress: 60 }
      }
      
      const resolution = await conflictService.executeAutoResolution(testConflict)
      
      // 提供成功回饋
      const feedback = {
        conflictId: testConflict.id,
        strategy: resolution.strategy,
        userSatisfaction: 0.9,
        actualOutcome: 'success'
      }
      
      await conflictService.recordResolutionFeedback(feedback)
      
      // 檢查策略庫是否更新
      const strategyMetrics = conflictService.getStrategyMetrics(resolution.strategy)
      expect(strategyMetrics.successRate).toBeGreaterThan(0)
    })
  })

  describe('Batch Processing', () => {
    beforeEach(async () => {
      await conflictService.initialize()
    })

    test('should handle large batch conflict detection', async () => {
      const batchSize = 100
      const largeBatch = Array.from({ length: batchSize }, (_, i) => ({
        sourceBook: { id: `batch_${i}`, progress: i % 100, platform: 'READMOO' },
        targetBook: { id: `batch_${i}`, progress: (i + 30) % 100, platform: 'KINDLE' }
      }))
      
      const startTime = Date.now()
      const results = await conflictService.detectBatchConflicts(largeBatch)
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(10000) // 10秒內完成
      expect(results.totalProcessed).toBe(batchSize)
      expect(results.conflictsFound).toBeGreaterThan(0)
    })

    test('should support batch processing with progress tracking', async () => {
      const batchData = testData.batchConflicts.slice(0, 20)
      
      mockEventBus.clearEmittedEvents()
      
      const results = await conflictService.detectBatchConflicts(batchData, {
        enableProgressTracking: true,
        progressInterval: 5 // 每5個項目報告一次進度
      })
      
      // 檢查進度事件
      const progressEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH.PROGRESS')
      expect(progressEvents.length).toBeGreaterThan(0)
      
      expect(results.processingTime).toBeDefined()
      expect(results.successRate).toBeGreaterThan(0)
    })

    test('should handle batch processing errors gracefully', async () => {
      const batchWithErrors = [
        { sourceBook: { id: 'valid', progress: 50 }, targetBook: { id: 'valid', progress: 60 } },
        { sourceBook: null, targetBook: { id: 'invalid' } }, // 無效資料
        { sourceBook: { id: 'another_valid', progress: 30 }, targetBook: { id: 'another_valid', progress: 80 } }
      ]
      
      const results = await conflictService.detectBatchConflicts(batchWithErrors)
      
      expect(results.totalProcessed).toBe(3)
      expect(results.errors.length).toBe(1)
      expect(results.successfullyProcessed).toBe(2)
    })

    test('should support batch resolution with different strategies', async () => {
      const conflicts = [
        { id: 'conf_1', type: 'PROGRESS_MISMATCH', details: { sourceProgress: 30, targetProgress: 70 } },
        { id: 'conf_2', type: 'PROGRESS_MISMATCH', details: { sourceProgress: 45, targetProgress: 55 } },
        { id: 'conf_3', type: 'TITLE_DIFFERENCE', details: { sourceTitle: 'A', targetTitle: 'B' } }
      ]
      
      const batchOptions = {
        strategy: 'AUTO_RESOLVE_HIGH_CONFIDENCE',
        fallbackStrategy: 'MANUAL_REVIEW',
        confidenceThreshold: 0.7
      }
      
      const results = await conflictService.executeBatchResolution(conflicts, batchOptions)
      
      expect(results.autoResolved).toBeGreaterThanOrEqual(0)
      expect(results.manualReviewRequired).toBeGreaterThanOrEqual(0)
      expect(results.autoResolved + results.manualReviewRequired).toBe(conflicts.length)
    })

    test('should optimize memory usage during batch processing', async () => {
      // 模擬記憶體使用監控
      const largeBatch = Array.from({ length: 500 }, (_, i) => ({
        sourceBook: { id: `memory_${i}`, progress: i % 100 },
        targetBook: { id: `memory_${i}`, progress: (i + 20) % 100 }
      }))
      
      const results = await conflictService.detectBatchConflicts(largeBatch, {
        batchSize: 50, // 分批處理
        enableMemoryOptimization: true
      })
      
      expect(results.memoryUsage).toBeDefined()
      expect(results.memoryUsage.peakUsage).toBeDefined()
      expect(results.processingBatches).toBe(Math.ceil(largeBatch.length / 50))
    })

    test('should support batch cancellation', async () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        sourceBook: { id: `cancel_${i}`, progress: i % 100 },
        targetBook: { id: `cancel_${i}`, progress: (i + 10) % 100 }
      }))
      
      // 開始批次處理
      const batchPromise = conflictService.detectBatchConflicts(largeBatch)
      
      // 短暫延遲後取消
      setTimeout(() => {
        conflictService.cancelBatchProcessing('test_batch')
      }, 100)
      
      const results = await batchPromise
      
      expect(results.cancelled).toBe(true)
      expect(results.processedBeforeCancel).toBeGreaterThanOrEqual(0)
    })

    test('should provide batch processing statistics', async () => {
      const batch = testData.batchConflicts.slice(0, 15)
      
      const results = await conflictService.detectBatchConflicts(batch)
      
      expect(results.statistics).toBeDefined()
      expect(results.statistics.conflictsByType).toBeDefined()
      expect(results.statistics.severityDistribution).toBeDefined()
      expect(results.statistics.avgProcessingTime).toBeGreaterThan(0)
      expect(results.statistics.resourceUsage).toBeDefined()
    })

    test('should emit batch completion events', async () => {
      mockEventBus.clearEmittedEvents()
      
      const batch = testData.batchConflicts.slice(0, 5)
      await conflictService.detectBatchConflicts(batch)
      
      const completionEvents = mockEventBus.getEmittedEventsByType('DATA.CONFLICT.BATCH.COMPLETED')
      expect(completionEvents.length).toBe(1)
      
      const event = completionEvents[0]
      expect(event.data.totalProcessed).toBe(5)
      expect(event.data.batchId).toBeDefined()
    })
  })

  describe('User Interaction & Manual Resolution', () => {
    beforeEach(async () => {
      await conflictService.initialize()
    })

    test('should handle manual resolution requests', async () => {
      const manualResolutionData = {
        conflictId: 'manual_test_001',
        userChoice: {
          strategy: 'USE_SOURCE_VALUE',
          selectedValue: 75,
          reasoning: '用戶選擇源平台數值'
        },
        userConfidence: 0.9
      }
      
      await mockEventBus.emit('USER.CONFLICT.MANUAL.RESOLUTION', manualResolutionData)
      
      // 檢查手動解決處理
      expect(typeof conflictService.handleManualResolution).toBe('function')
      
      // TODO: 驗證手動解決處理結果
    })

    test('should record user resolution preferences', async () => {
      const userPreference = {
        conflictType: 'PROGRESS_MISMATCH',
        preferredStrategy: 'USE_LATEST_TIMESTAMP',
        confidence: 0.85,
        conditions: ['timeDifference > 1 hour']
      }
      
      await conflictService.recordUserPreference(userPreference)
      
      // 檢查偏好是否被記錄
      const preferences = conflictService.getUserPreferences('PROGRESS_MISMATCH')
      expect(preferences).toContainEqual(expect.objectContaining({
        preferredStrategy: 'USE_LATEST_TIMESTAMP'
      }))
    })

    test('should provide conflict resolution history', async () => {
      // 模擬一些解決歷史
      const testConflicts = [
        { id: 'hist_1', type: 'PROGRESS_MISMATCH', resolved: true, strategy: 'USE_LATEST_TIMESTAMP' },
        { id: 'hist_2', type: 'TITLE_DIFFERENCE', resolved: true, strategy: 'MANUAL_REVIEW' }
      ]
      
      for (const conflict of testConflicts) {
        await conflictService.recordResolutionHistory(conflict)
      }
      
      const history = await conflictService.getResolutionHistory()
      
      expect(history.length).toBeGreaterThanOrEqual(2)
      expect(history[0].resolvedAt).toBeDefined()
      expect(history[0].strategy).toBeDefined()
    })

    test('should generate user-friendly conflict summaries', async () => {
      const { sourceBook, targetBook } = testData.complexConflict
      const conflicts = await conflictService.detectConflicts(sourceBook, targetBook)
      
      const summary = await conflictService.generateUserSummary(conflicts)
      
      expect(summary.totalConflicts).toBe(conflicts.length)
      expect(summary.description).toBeDefined()
      expect(summary.recommendations).toBeDefined()
      expect(summary.estimatedResolutionTime).toBeDefined()
      expect(summary.userActionRequired).toBeDefined()
    })

    test('should support conflict resolution workflows', async () => {
      const workflowData = {
        conflictId: 'workflow_test',
        currentStep: 'DETECTION_COMPLETE',
        availableActions: ['AUTO_RESOLVE', 'MANUAL_REVIEW', 'IGNORE'],
        userContext: { experience: 'BEGINNER' }
      }
      
      const nextSteps = await conflictService.getWorkflowNextSteps(workflowData)
      
      expect(nextSteps.recommended).toBeDefined()
      expect(nextSteps.alternatives).toBeDefined()
      expect(nextSteps.guidance).toBeDefined()
    })

    test('should track user satisfaction with resolutions', async () => {
      const satisfactionData = {
        conflictId: 'satisfaction_test',
        strategy: 'USE_LATEST_TIMESTAMP',
        userRating: 4, // 1-5 scale
        feedback: '解決方案符合預期',
        wouldUseAgain: true
      }
      
      await conflictService.recordUserSatisfaction(satisfactionData)
      
      const strategyMetrics = conflictService.getStrategyMetrics('USE_LATEST_TIMESTAMP')
      expect(strategyMetrics.userSatisfaction.averageRating).toBeGreaterThan(0)
      expect(strategyMetrics.userSatisfaction.totalRatings).toBeGreaterThan(0)
    })

    test('should provide personalized resolution suggestions', async () => {
      // 設定用戶歷史偏好
      const userProfile = {
        userId: 'test_user',
        resolutionHistory: [
          { type: 'PROGRESS_MISMATCH', chosenStrategy: 'USE_LATEST_TIMESTAMP' },
          { type: 'PROGRESS_MISMATCH', chosenStrategy: 'USE_LATEST_TIMESTAMP' }
        ],
        preferences: { riskTolerance: 'LOW', automationLevel: 'MEDIUM' }
      }
      
      await conflictService.setUserProfile(userProfile)
      
      const progressConflict = {
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 40, targetProgress: 80 }
      }
      
      const personalizedSuggestions = await conflictService.getPersonalizedSuggestions(progressConflict)
      
      expect(personalizedSuggestions.primaryRecommendation.strategy).toBe('USE_LATEST_TIMESTAMP')
      expect(personalizedSuggestions.confidence).toBeGreaterThan(0.8)
      expect(personalizedSuggestions.reasoning).toContain('歷史偏好')
    })

    test('should handle conflict escalation procedures', async () => {
      const escalationCriteria = {
        conflictId: 'escalation_test',
        reasons: ['HIGH_COMPLEXITY', 'USER_UNCERTAINTY', 'POTENTIAL_DATA_LOSS'],
        escalationLevel: 'EXPERT_REVIEW'
      }
      
      const escalationResult = await conflictService.escalateConflict(escalationCriteria)
      
      expect(escalationResult.escalated).toBe(true)
      expect(escalationResult.assignedTo).toBeDefined()
      expect(escalationResult.priority).toBeDefined()
      expect(escalationResult.estimatedResponseTime).toBeDefined()
    })

    test('should generate resolution audit trails', async () => {
      const auditableResolution = {
        conflictId: 'audit_test',
        userId: 'test_user',
        strategy: 'MANUAL_REVIEW',
        decision: 'USE_TARGET_VALUE',
        reasoning: '目標平台資料較新',
        timestamp: new Date().toISOString()
      }
      
      await conflictService.recordAuditableResolution(auditableResolution)
      
      const auditTrail = await conflictService.getAuditTrail('audit_test')
      
      expect(auditTrail.length).toBeGreaterThan(0)
      expect(auditTrail[0].action).toBeDefined()
      expect(auditTrail[0].actor).toBe('test_user')
      expect(auditTrail[0].timestamp).toBeDefined()
      expect(auditTrail[0].reasoning).toBeDefined()
    })

    test('should support undo/redo for manual resolutions', async () => {
      const originalConflict = {
        id: 'undo_test',
        originalState: { progress: 50 },
        resolvedState: { progress: 75 }
      }
      
      // 執行解決
      await conflictService.recordResolutionHistory(originalConflict)
      
      // 撤銷解決
      const undoResult = await conflictService.undoResolution('undo_test')
      
      expect(undoResult.success).toBe(true)
      expect(undoResult.restoredState).toEqual(originalConflict.originalState)
      
      // 重做解決
      const redoResult = await conflictService.redoResolution('undo_test')
      
      expect(redoResult.success).toBe(true)
      expect(redoResult.appliedState).toEqual(originalConflict.resolvedState)
    })
  })

  describe('Integration & Event Handling', () => {
    beforeEach(async () => {
      await conflictService.initialize()
      mockEventBus.clearEmittedEvents()
    })

    test('should handle sync conflict events from Data Synchronization Service', async () => {
      const syncConflictData = {
        syncId: 'sync_123',
        conflicts: [
          {
            bookId: 'book_001',
            type: 'PROGRESS_MISMATCH',
            sourcePlatform: 'READMOO',
            targetPlatform: 'KINDLE',
            details: { sourceProgress: 30, targetProgress: 70 }
          }
        ],
        priority: 'HIGH'
      }
      
      await mockEventBus.emit('DATA.SYNC.CONFLICT.FOUND', syncConflictData)
      
      // 檢查事件處理器被觸發
      expect(typeof conflictService.handleSyncConflict).toBe('function')
      
      // TODO: 驗證同步衝突處理結果
    })

    test('should coordinate with Data Domain Coordinator', async () => {
      const coordinatorRequest = {
        operationId: 'coord_789',
        requestType: 'BULK_CONFLICT_RESOLUTION',
        conflicts: testData.batchConflicts.slice(0, 5).map(c => ({
          sourceBook: c.sourceBook,
          targetBook: c.targetBook
        }))
      }
      
      await mockEventBus.emit('DATA.COORDINATOR.CONFLICT.REQUEST', coordinatorRequest)
      
      // 檢查協調器整合
      expect(typeof conflictService.handleCoordinatorRequest).toBe('function')
      
      // TODO: 驗證協調器請求處理
    })

    test('should emit resolution lifecycle events', async () => {
      const testConflict = {
        id: 'lifecycle_test',
        type: 'PROGRESS_MISMATCH',
        details: { sourceProgress: 25, targetProgress: 75 }
      }
      
      // 開始解決流程
      await conflictService.initiateResolution(testConflict)
      
      const lifecycleEvents = mockEventBus.getEmittedEvents()
        .filter(e => e.eventType.startsWith('DATA.CONFLICT.'))
      
      expect(lifecycleEvents.length).toBeGreaterThan(0)
      
      const eventTypes = lifecycleEvents.map(e => e.eventType)
      expect(eventTypes).toContain('DATA.CONFLICT.RESOLUTION.STARTED')
    })

    test('should handle resolution status updates', async () => {
      const statusUpdate = {
        conflictId: 'status_test',
        status: 'IN_PROGRESS',
        progress: 50,
        estimatedCompletion: '2025-08-16T12:30:00Z'
      }
      
      await mockEventBus.emit('DATA.CONFLICT.RESOLUTION.STATUS', statusUpdate)
      
      // 檢查狀態更新處理
      expect(typeof conflictService.handleResolutionStatusUpdate).toBe('function')
      
      // TODO: 驗證狀態更新處理
    })

    test('should support cross-service error handling', async () => {
      const errorData = {
        sourceService: 'DATA_SYNCHRONIZATION_SERVICE',
        errorType: 'CONFLICT_DETECTION_FAILED',
        errorDetails: {
          bookId: 'error_test',
          error: 'Invalid data format'
        },
        recoveryOptions: ['RETRY', 'SKIP', 'MANUAL_INTERVENTION']
      }
      
      await mockEventBus.emit('DATA.SERVICE.ERROR', errorData)
      
      // 檢查跨服務錯誤處理
      expect(typeof conflictService.handleServiceError).toBe('function')
      
      // TODO: 驗證錯誤處理和恢復
    })

    test('should maintain event ordering in complex workflows', async () => {
      mockEventBus.clearEmittedEvents()
      
      // 模擬複雜的事件序列
      const eventSequence = [
        { type: 'DATA.CONFLICT.DETECTED', data: { conflictId: 'seq_001' } },
        { type: 'DATA.CONFLICT.RESOLUTION.REQUESTED', data: { conflictId: 'seq_001' } },
        { type: 'USER.CONFLICT.MANUAL.RESOLUTION', data: { conflictId: 'seq_001' } }
      ]
      
      for (const event of eventSequence) {
        await mockEventBus.emit(event.type, event.data)
      }
      
      const emittedEvents = mockEventBus.getEmittedEvents()
      
      // 檢查事件順序和完整性
      expect(emittedEvents.length).toBeGreaterThanOrEqual(eventSequence.length)
      
      // 驗證時間戳遞增（事件順序正確）
      for (let i = 1; i < emittedEvents.length; i++) {
        expect(emittedEvents[i].timestamp).toBeGreaterThanOrEqual(emittedEvents[i-1].timestamp)
      }
    })
  })

  describe('Performance & Analytics', () => {
    beforeEach(async () => {
      await conflictService.initialize()
    })

    test('should track detailed performance metrics', () => {
      const metrics = conflictService.performanceMetrics
      
      expect(metrics.conflictsDetected).toBe(0)
      expect(metrics.resolutionsAttempted).toBe(0)
      expect(metrics.successfulResolutions).toBe(0)
      expect(metrics.averageDetectionTime).toBe(0)
      expect(metrics.averageResolutionTime).toBe(0)
      expect(metrics.strategySuccessRates).toBeDefined()
    })

    test('should handle large-scale conflict processing efficiently', async () => {
      const startTime = Date.now()
      
      // 處理大量衝突
      const largeConflictSet = Array.from({ length: 1000 }, (_, i) => ({
        sourceBook: { id: `perf_${i}`, progress: i % 100 },
        targetBook: { id: `perf_${i}`, progress: (i + 25) % 100 }
      }))
      
      const results = await conflictService.detectBatchConflicts(largeConflictSet)
      
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(15000) // 15秒內完成
      expect(results.totalProcessed).toBe(1000)
    })

    test('should monitor memory usage during processing', async () => {
      const initialMemory = process.memoryUsage()
      
      // 處理記憶體密集的衝突檢測
      const memoryIntensiveData = Array.from({ length: 500 }, (_, i) => ({
        sourceBook: {
          id: `memory_${i}`,
          title: `Memory Test Book ${i}`.repeat(10), // 較大的字串
          progress: i % 100,
          metadata: new Array(100).fill(`data_${i}`) // 額外記憶體佔用
        },
        targetBook: {
          id: `memory_${i}`,
          title: `Memory Test Book ${i}`.repeat(10),
          progress: (i + 30) % 100,
          metadata: new Array(100).fill(`data_${i}_modified`)
        }
      }))
      
      await conflictService.detectBatchConflicts(memoryIntensiveData)
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // 記憶體增長應該在合理範圍內
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB
    })

    test('should provide strategy effectiveness analytics', async () => {
      // 模擬多種策略的使用和結果
      const strategyTests = [
        { strategy: 'USE_LATEST_TIMESTAMP', success: true },
        { strategy: 'USE_LATEST_TIMESTAMP', success: true },
        { strategy: 'USE_SOURCE_PRIORITY', success: false },
        { strategy: 'MANUAL_REVIEW', success: true }
      ]
      
      for (const test of strategyTests) {
        await conflictService.recordStrategyResult(test.strategy, test.success)
      }
      
      const analytics = await conflictService.getStrategyAnalytics()
      
      expect(analytics.USE_LATEST_TIMESTAMP.successRate).toBeGreaterThan(0.8)
      expect(analytics.USE_SOURCE_PRIORITY.successRate).toBeLessThan(0.5)
      expect(analytics.MANUAL_REVIEW.successRate).toBe(1.0)
    })

    test('should generate performance reports', async () => {
      // 模擬一段時間的活動
      const activity = {
        detectedConflicts: 50,
        resolvedConflicts: 45,
        averageResolutionTime: 1500, // ms
        strategyDistribution: {
          'USE_LATEST_TIMESTAMP': 20,
          'MANUAL_REVIEW': 15,
          'USE_SOURCE_PRIORITY': 10
        }
      }
      
      conflictService.performanceMetrics = { ...conflictService.performanceMetrics, ...activity }
      
      const report = await conflictService.generatePerformanceReport()
      
      expect(report.timeRange).toBeDefined()
      expect(report.summary.totalConflicts).toBe(50)
      expect(report.summary.resolutionRate).toBeCloseTo(0.9)
      expect(report.recommendations).toBeDefined()
      expect(report.trends).toBeDefined()
    })
  })
})