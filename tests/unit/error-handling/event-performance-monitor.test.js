/**
 * @fileoverview EventPerformanceMonitor 單元測試
 * TDD 循環 #34: 事件效能監控系統
 *
 * 測試範圍：
 * - 基本結構和初始化
 * - 效能指標收集
 * - 效能警告機制
 * - 統計和報告功能
 * - 記憶體管理
 */

const EventPerformanceMonitor = require('../../../src/error-handling/event-performance-monitor')

describe('EventPerformanceMonitor', () => {
  let mockEventBus
  let performanceMonitor

  beforeEach(() => {
    // 模擬 EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 模擬 performance API
    global.performance = {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn()
    }

    performanceMonitor = new EventPerformanceMonitor(mockEventBus)
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.performance
  })

  // ==================== 基本結構和初始化 ====================
  describe('基本結構和初始化', () => {
    test('應該正確繼承 EventHandler', () => {
      expect(performanceMonitor).toBeInstanceOf(
        require('../../../src/core/event-handler')
      )
      expect(performanceMonitor.name).toBe('EventPerformanceMonitor')
      expect(performanceMonitor.priority).toBe(5) // 中等優先級
    })

    test('應該正確初始化效能監控配置', () => {
      expect(performanceMonitor.isEnabled).toBe(true)
      expect(performanceMonitor.config).toBeDefined()
      expect(performanceMonitor.config.warningThresholds).toBeDefined()
      expect(performanceMonitor.config.sampleRate).toBe(1.0) // 預設 100% 採樣
    })

    test('應該支援自訂配置選項', () => {
      const customConfig = {
        warningThresholds: {
          eventProcessingTime: 100,
          memoryUsage: 50 * 1024 * 1024
        },
        sampleRate: 0.5,
        maxRecords: 500
      }

      const customMonitor = new EventPerformanceMonitor(
        mockEventBus,
        customConfig
      )
      expect(customMonitor.config.warningThresholds.eventProcessingTime).toBe(
        100
      )
      expect(customMonitor.config.sampleRate).toBe(0.5)
      expect(customMonitor.config.maxRecords).toBe(500)
    })

    test('應該正確註冊支援的事件類型', () => {
      const expectedEvents = [
        'EVENT.PROCESSING.STARTED',
        'EVENT.PROCESSING.COMPLETED',
        'EVENT.PROCESSING.FAILED',
        'PERFORMANCE.MONITOR.REQUEST'
      ]

      expect(performanceMonitor.supportedEvents).toEqual(expectedEvents)
    })

    test('應該初始化效能統計資料結構', () => {
      expect(performanceMonitor.performanceStats).toBeDefined()
      expect(performanceMonitor.performanceStats.totalEvents).toBe(0)
      expect(performanceMonitor.performanceStats.averageProcessingTime).toBe(0)
      expect(performanceMonitor.performanceStats.warningCount).toBe(0)
    })
  })

  // ==================== 效能指標收集 ====================
  describe('效能指標收集', () => {
    test('應該記錄事件處理開始時間', () => {
      const eventData = {
        eventType: 'TEST.EVENT',
        eventId: 'test-123',
        timestamp: Date.now()
      }

      performanceMonitor.process({
        type: 'EVENT.PROCESSING.STARTED',
        data: eventData
      })

      expect(performanceMonitor.activeEvents.has('test-123')).toBe(true)
      expect(global.performance.mark).toHaveBeenCalledWith(
        'event-start-test-123'
      )
    })

    test('應該計算事件處理完成時間', () => {
      const eventId = 'test-456'
      const startTime = 1000
      const endTime = 1050

      // 模擬開始事件
      global.performance.now.mockReturnValueOnce(startTime)
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.STARTED',
        data: { eventId, eventType: 'TEST.EVENT' }
      })

      // 模擬完成事件
      global.performance.now.mockReturnValueOnce(endTime)
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.COMPLETED',
        data: { eventId, eventType: 'TEST.EVENT' }
      })

      expect(performanceMonitor.performanceStats.totalEvents).toBe(1)
      expect(performanceMonitor.performanceStats.averageProcessingTime).toBe(
        50
      )
      expect(performanceMonitor.activeEvents.has(eventId)).toBe(false)
    })

    test('應該記錄事件處理失敗', () => {
      const eventId = 'test-failed'
      const error = new Error('處理失敗')

      // 先開始事件
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.STARTED',
        data: { eventId, eventType: 'TEST.EVENT' }
      })

      // 然後失敗
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.FAILED',
        data: { eventId, eventType: 'TEST.EVENT', error }
      })

      expect(performanceMonitor.performanceStats.failedEvents).toBe(1)
      expect(performanceMonitor.activeEvents.has(eventId)).toBe(false)
    })

    test('應該支援效能採樣', () => {
      const lowSampleMonitor = new EventPerformanceMonitor(mockEventBus, {
        sampleRate: 0.1 // 10% 採樣率
      })

      // 模擬隨機數生成
      const originalRandom = Math.random
      Math.random = jest.fn()

      // 測試採樣邏輯
      Math.random.mockReturnValue(0.05) // 小於 0.1，應該採樣
      expect(lowSampleMonitor._shouldSample()).toBe(true)

      Math.random.mockReturnValue(0.15) // 大於 0.1，不應該採樣
      expect(lowSampleMonitor._shouldSample()).toBe(false)

      Math.random = originalRandom
    })

    test('應該收集記憶體使用統計', () => {
      // 模擬 performance.memory API
      global.performance.memory = {
        usedJSHeapSize: 10 * 1024 * 1024, // 10MB
        totalJSHeapSize: 20 * 1024 * 1024, // 20MB
        jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
      }

      const memoryStats = performanceMonitor._collectMemoryStats()
      expect(memoryStats.usedMemory).toBe(10 * 1024 * 1024)
      expect(memoryStats.totalMemory).toBe(20 * 1024 * 1024)
      expect(memoryStats.memoryLimit).toBe(100 * 1024 * 1024)
      expect(memoryStats.memoryUsagePercent).toBe(50)
    })
  })

  // ==================== 效能警告機制 ====================
  describe('效能警告機制', () => {
    test('應該在處理時間超過閾值時發出警告', () => {
      const eventId = 'slow-event'
      const warningThreshold = 50 // 50ms 閾值

      performanceMonitor.config.warningThresholds.eventProcessingTime =
        warningThreshold

      // 模擬慢速事件
      global.performance.now.mockReturnValueOnce(1000)
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.STARTED',
        data: { eventId, eventType: 'SLOW.EVENT' }
      })

      global.performance.now.mockReturnValueOnce(1100) // 100ms 後完成
      performanceMonitor.process({
        type: 'EVENT.PROCESSING.COMPLETED',
        data: { eventId, eventType: 'SLOW.EVENT' }
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith('PERFORMANCE.WARNING', {
        type: 'SLOW_EVENT_PROCESSING',
        eventId,
        eventType: 'SLOW.EVENT',
        processingTime: 100,
        threshold: warningThreshold,
        timestamp: expect.any(Number)
      })
    })

    test('應該在記憶體使用過高時發出警告', () => {
      global.performance.memory = {
        usedJSHeapSize: 80 * 1024 * 1024, // 80MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 100 * 1024 * 1024
      }

      performanceMonitor.config.warningThresholds.memoryUsage =
        70 * 1024 * 1024 // 70MB 閾值

      performanceMonitor._checkMemoryWarnings()

      expect(mockEventBus.emit).toHaveBeenCalledWith('PERFORMANCE.WARNING', {
        type: 'HIGH_MEMORY_USAGE',
        usedMemory: 80 * 1024 * 1024,
        threshold: 70 * 1024 * 1024,
        memoryUsagePercent: 80,
        timestamp: expect.any(Number)
      })
    })

    test('應該在活躍事件數量過多時發出警告', () => {
      performanceMonitor.config.warningThresholds.activeEventCount = 5

      // 創建 6 個活躍事件
      for (let i = 0; i < 6; i++) {
        performanceMonitor.process({
          type: 'EVENT.PROCESSING.STARTED',
          data: { eventId: `event-${i}`, eventType: 'TEST.EVENT' }
        })
      }

      expect(mockEventBus.emit).toHaveBeenCalledWith('PERFORMANCE.WARNING', {
        type: 'HIGH_ACTIVE_EVENT_COUNT',
        activeEventCount: 6,
        threshold: 5,
        timestamp: expect.any(Number)
      })
    })

    test('應該追蹤警告統計', () => {
      performanceMonitor._emitWarning('TEST_WARNING', { test: 'data' })

      expect(performanceMonitor.performanceStats.warningCount).toBe(1)
      expect(performanceMonitor.performanceStats.lastWarningTime).toBeDefined()
      expect(performanceMonitor.warningHistory).toHaveLength(1)
    })
  })

  // ==================== 統計和報告功能 ====================
  describe('統計和報告功能', () => {
    test('應該生成效能報告', () => {
      // 模擬一些效能資料
      performanceMonitor.performanceStats = {
        totalEvents: 100,
        failedEvents: 5,
        averageProcessingTime: 25.5,
        warningCount: 3,
        lastWarningTime: Date.now()
      }

      const report = performanceMonitor.generatePerformanceReport()

      expect(report.summary.totalEvents).toBe(100)
      expect(report.summary.successRate).toBe(95)
      expect(report.summary.averageProcessingTime).toBe(25.5)
      expect(report.warnings.totalWarnings).toBe(3)
      expect(report.memory).toBeDefined()
      expect(report.timestamp).toBeDefined()
    })

    test('應該處理效能監控請求', () => {
      performanceMonitor.process({
        type: 'PERFORMANCE.MONITOR.REQUEST',
        data: { requestId: 'req-123', includeHistory: true }
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PERFORMANCE.MONITOR.RESPONSE',
        {
          requestId: 'req-123',
          report: expect.any(Object),
          history: expect.any(Array),
          timestamp: expect.any(Number)
        }
      )
    })

    test('應該提供效能統計查詢方法', () => {
      const stats = performanceMonitor.getPerformanceStats()

      expect(stats).toHaveProperty('totalEvents')
      expect(stats).toHaveProperty('averageProcessingTime')
      expect(stats).toHaveProperty('warningCount')
      expect(stats).toHaveProperty('uptime')
    })

    test('應該支援重置統計資料', () => {
      // 先設置一些資料
      performanceMonitor.performanceStats.totalEvents = 50
      performanceMonitor.performanceStats.warningCount = 5
      performanceMonitor.warningHistory.push({
        type: 'TEST',
        timestamp: Date.now()
      })

      performanceMonitor.resetStats()

      expect(performanceMonitor.performanceStats.totalEvents).toBe(0)
      expect(performanceMonitor.performanceStats.warningCount).toBe(0)
      expect(performanceMonitor.warningHistory).toHaveLength(0)
    })
  })

  // ==================== 記憶體管理 ====================
  describe('記憶體管理', () => {
    test('應該限制效能記錄數量', () => {
      performanceMonitor.config.maxRecords = 3

      // 添加超過限制的記錄
      for (let i = 0; i < 5; i++) {
        performanceMonitor._addPerformanceRecord({
          eventId: `event-${i}`,
          processingTime: 10 + i,
          timestamp: Date.now()
        })
      }

      expect(performanceMonitor.performanceHistory).toHaveLength(3)
      // 應該保留最新的記錄
      expect(performanceMonitor.performanceHistory[0].eventId).toBe('event-4')
      expect(performanceMonitor.performanceHistory[2].eventId).toBe('event-2')
    })

    test('應該清理過期的活躍事件', () => {
      const oldTimestamp = Date.now() - 60000 // 1 分鐘前

      // 添加過期事件
      performanceMonitor.activeEvents.set('old-event', {
        startTime: oldTimestamp,
        eventType: 'OLD.EVENT',
        timestamp: oldTimestamp
      })

      // 添加新事件
      performanceMonitor.activeEvents.set('new-event', {
        startTime: Date.now(),
        eventType: 'NEW.EVENT',
        timestamp: Date.now()
      })

      performanceMonitor._cleanupExpiredEvents()

      expect(performanceMonitor.activeEvents.has('old-event')).toBe(false)
      expect(performanceMonitor.activeEvents.has('new-event')).toBe(true)
    })

    test('應該定期執行清理任務', () => {
      jest.useFakeTimers()

      const cleanupSpy = jest.spyOn(performanceMonitor, '_performCleanup')

      // 啟動定期清理
      performanceMonitor._startPeriodicCleanup()

      // 快進 5 分鐘
      jest.advanceTimersByTime(5 * 60 * 1000)

      expect(cleanupSpy).toHaveBeenCalled()

      jest.useRealTimers()
    })

    test('應該在停用時清理資源', () => {
      performanceMonitor.activeEvents.set('test', { startTime: Date.now() })
      performanceMonitor.performanceHistory.push({ eventId: 'test' })

      performanceMonitor.disable()

      expect(performanceMonitor.isEnabled).toBe(false)
      expect(performanceMonitor.activeEvents.size).toBe(0)
      expect(performanceMonitor.performanceHistory).toHaveLength(0)
    })
  })
})
