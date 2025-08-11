/**
 * @fileoverview EventTracker 單元測試
 * TDD 循環 #35: 事件記錄和追蹤系統
 *
 * 測試範圍：
 * - 基本結構和初始化
 * - 事件記錄和持久化
 * - 事件查詢和過濾
 * - 診斷資料匯出
 * - 記憶體管理和清理
 */

const EventTracker = require('../../../src/error-handling/event-tracker')

describe('EventTracker', () => {
  let mockEventBus
  let eventTracker

  beforeEach(() => {
    // 模擬 EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 模擬 localStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    }

    eventTracker = new EventTracker(mockEventBus)
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.localStorage
  })

  // ==================== 基本結構和初始化 ====================
  describe('基本結構和初始化', () => {
    test('應該正確繼承 EventHandler', () => {
      expect(eventTracker).toBeInstanceOf(
        require('../../../src/core/event-handler')
      )
      expect(eventTracker.name).toBe('EventTracker')
      expect(eventTracker.priority).toBe(3) // 較高優先級，確保事件記錄
    })

    test('應該正確初始化事件追蹤配置', () => {
      expect(eventTracker.isEnabled).toBe(true)
      expect(eventTracker.config).toBeDefined()
      expect(eventTracker.config.maxRecords).toBe(5000) // 預設最大記錄數
      expect(eventTracker.config.persistToDisk).toBe(true) // 預設持久化
    })

    test('應該支援自訂配置選項', () => {
      const customConfig = {
        maxRecords: 10000,
        persistToDisk: false,
        trackingLevel: 'detailed',
        retentionDays: 30
      }

      const customTracker = new EventTracker(mockEventBus, customConfig)
      expect(customTracker.config.maxRecords).toBe(10000)
      expect(customTracker.config.persistToDisk).toBe(false)
      expect(customTracker.config.trackingLevel).toBe('detailed')
      expect(customTracker.config.retentionDays).toBe(30)
    })

    test('應該正確註冊支援的事件類型', () => {
      const expectedEvents = [
        'EVENT.TRACKING.START',
        'EVENT.TRACKING.STOP',
        'EVENT.TRACKING.QUERY',
        'EVENT.TRACKING.EXPORT',
        'EVENT.TRACKING.CLEAR'
      ]

      expect(eventTracker.supportedEvents).toEqual(expectedEvents)
    })

    test('應該初始化事件記錄資料結構', () => {
      expect(eventTracker.eventRecords).toBeDefined()
      expect(Array.isArray(eventTracker.eventRecords)).toBe(true)
      expect(eventTracker.trackingStats).toBeDefined()
      expect(eventTracker.trackingStats.totalEvents).toBe(0)
      expect(eventTracker.trackingStats.startTime).toBeDefined()
    })

    test('應該從持久化儲存載入現有記錄', () => {
      const existingRecords = [
        { id: '1', type: 'TEST.EVENT', timestamp: Date.now() },
        { id: '2', type: 'ANOTHER.EVENT', timestamp: Date.now() }
      ]

      global.localStorage.getItem.mockReturnValue(
        JSON.stringify(existingRecords)
      )

      const tracker = new EventTracker(mockEventBus)
      expect(tracker.eventRecords).toHaveLength(2)
      expect(tracker.trackingStats.totalEvents).toBe(2)
    })
  })

  // ==================== 事件記錄和持久化 ====================
  describe('事件記錄和持久化', () => {
    test('應該記錄所有類型的事件', () => {
      const eventData = {
        type: 'TEST.EVENT',
        data: { message: 'test message', userId: '123' },
        source: 'test-component',
        timestamp: Date.now()
      }

      eventTracker._recordEvent(eventData)

      expect(eventTracker.eventRecords).toHaveLength(1)
      expect(eventTracker.eventRecords[0]).toMatchObject({
        type: 'TEST.EVENT',
        data: { message: 'test message', userId: '123' },
        source: 'test-component',
        id: expect.any(String),
        timestamp: expect.any(Number)
      })
    })

    test('應該為每個事件生成唯一 ID', () => {
      const event1 = { type: 'EVENT.ONE', data: {} }
      const event2 = { type: 'EVENT.TWO', data: {} }

      eventTracker._recordEvent(event1)
      eventTracker._recordEvent(event2)

      expect(eventTracker.eventRecords[0].id).toBeDefined()
      expect(eventTracker.eventRecords[1].id).toBeDefined()
      expect(eventTracker.eventRecords[0].id).not.toBe(
        eventTracker.eventRecords[1].id
      )
    })

    test('應該記錄事件的詳細上下文資訊', () => {
      const eventData = {
        type: 'USER.ACTION',
        data: { action: 'click', target: 'button' },
        source: 'ui-component',
        context: {
          url: 'https://example.com/page',
          userAgent: 'test-browser',
          sessionId: 'session-123'
        }
      }

      eventTracker._recordEvent(eventData)

      const record = eventTracker.eventRecords[0]
      expect(record.context).toEqual(eventData.context)
      expect(record.metadata).toBeDefined()
      expect(record.metadata.recordedAt).toBeDefined()
    })

    test('應該支援不同的追蹤級別', () => {
      const basicTracker = new EventTracker(mockEventBus, {
        trackingLevel: 'basic'
      })
      const detailedTracker = new EventTracker(mockEventBus, {
        trackingLevel: 'detailed'
      })

      const eventData = {
        type: 'TEST.EVENT',
        data: { largeData: 'x'.repeat(1000) },
        sensitiveData: { password: 'secret' }
      }

      basicTracker._recordEvent(eventData)
      detailedTracker._recordEvent(eventData)

      // 基本級別應該過濾敏感資料
      expect(basicTracker.eventRecords[0].sensitiveData).toBeUndefined()

      // 詳細級別應該包含所有資料
      expect(detailedTracker.eventRecords[0].sensitiveData).toBeDefined()
    })

    test('應該將事件記錄持久化到儲存', () => {
      eventTracker.config.persistToDisk = true

      const eventData = { type: 'PERSIST.TEST', data: {} }
      eventTracker._recordEvent(eventData)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'eventTracker_records',
        expect.any(String)
      )
    })

    test('應該處理持久化失敗的情況', () => {
      global.localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const eventData = { type: 'STORAGE.ERROR.TEST', data: {} }

      expect(() => {
        eventTracker._recordEvent(eventData)
      }).not.toThrow()

      // 應該記錄到記憶體中，即使持久化失敗
      expect(eventTracker.eventRecords).toHaveLength(1)
    })
  })

  // ==================== 事件查詢和過濾 ====================
  describe('事件查詢和過濾', () => {
    beforeEach(() => {
      // 準備測試資料
      const testEvents = [
        {
          type: 'USER.LOGIN',
          data: { userId: '123' },
          timestamp: Date.now() - 3600000
        },
        {
          type: 'USER.LOGOUT',
          data: { userId: '123' },
          timestamp: Date.now() - 1800000
        },
        {
          type: 'ERROR.OCCURRED',
          data: { error: 'Network timeout' },
          timestamp: Date.now() - 900000
        },
        {
          type: 'USER.LOGIN',
          data: { userId: '456' },
          timestamp: Date.now() - 300000
        },
        {
          type: 'DATA.PROCESSED',
          data: { count: 100 },
          timestamp: Date.now() - 60000
        }
      ]

      testEvents.forEach((event) => eventTracker._recordEvent(event))
    })

    test('應該支援按事件類型查詢', () => {
      const loginEvents = eventTracker.queryEvents({ type: 'USER.LOGIN' })

      expect(loginEvents).toHaveLength(2)
      expect(loginEvents.every((event) => event.type === 'USER.LOGIN')).toBe(
        true
      )
    })

    test('應該支援按時間範圍查詢', () => {
      const oneHourAgo = Date.now() - 3600000
      const thirtyMinutesAgo = Date.now() - 1800000

      const recentEvents = eventTracker.queryEvents({
        timeRange: {
          start: thirtyMinutesAgo,
          end: Date.now()
        }
      })

      expect(recentEvents).toHaveLength(4)
      expect(
        recentEvents.every((event) => event.timestamp >= thirtyMinutesAgo)
      ).toBe(true)
    })

    test('應該支援按資料內容查詢', () => {
      const userEvents = eventTracker.queryEvents({
        dataFilter: { userId: '123' }
      })

      expect(userEvents).toHaveLength(2)
      expect(userEvents.every((event) => event.data.userId === '123')).toBe(
        true
      )
    })

    test('應該支援複合查詢條件', () => {
      const complexQuery = eventTracker.queryEvents({
        type: 'USER.LOGIN',
        timeRange: {
          start: Date.now() - 1800000,
          end: Date.now()
        },
        dataFilter: { userId: '456' }
      })

      expect(complexQuery).toHaveLength(1)
      expect(complexQuery[0].type).toBe('USER.LOGIN')
      expect(complexQuery[0].data.userId).toBe('456')
    })

    test('應該支援分頁查詢', () => {
      const page1 = eventTracker.queryEvents({}, { page: 1, pageSize: 2 })
      const page2 = eventTracker.queryEvents({}, { page: 2, pageSize: 2 })

      expect(page1.results).toHaveLength(2)
      expect(page2.results).toHaveLength(2)
      expect(page1.pagination.totalPages).toBe(3)
      expect(page1.pagination.totalRecords).toBe(5)
    })

    test('應該支援排序查詢結果', () => {
      const ascendingResults = eventTracker.queryEvents(
        {},
        {
          sortBy: 'timestamp',
          sortOrder: 'asc'
        }
      )

      const descendingResults = eventTracker.queryEvents(
        {},
        {
          sortBy: 'timestamp',
          sortOrder: 'desc'
        }
      )

      expect(ascendingResults[0].timestamp).toBeLessThan(
        ascendingResults[1].timestamp
      )
      expect(descendingResults[0].timestamp).toBeGreaterThan(
        descendingResults[1].timestamp
      )
    })
  })

  // ==================== 診斷資料匯出 ====================
  describe('診斷資料匯出', () => {
    beforeEach(() => {
      // 準備測試資料
      const testEvents = [
        { type: 'ERROR.NETWORK', data: { url: '/api/data', status: 500 } },
        {
          type: 'ERROR.VALIDATION',
          data: { field: 'email', message: 'Invalid format' }
        },
        {
          type: 'USER.ACTION',
          data: { action: 'click', element: 'submit-button' }
        }
      ]

      testEvents.forEach((event) => eventTracker._recordEvent(event))
    })

    test('應該匯出 JSON 格式的事件資料', () => {
      const exportData = eventTracker.exportEvents('json')

      expect(exportData.format).toBe('json')
      expect(exportData.data).toBeDefined()
      expect(Array.isArray(JSON.parse(exportData.data))).toBe(true)
      expect(JSON.parse(exportData.data)).toHaveLength(3)
    })

    test('應該匯出 CSV 格式的事件資料', () => {
      const exportData = eventTracker.exportEvents('csv')

      expect(exportData.format).toBe('csv')
      expect(exportData.data).toBeDefined()
      expect(typeof exportData.data).toBe('string')
      expect(exportData.data).toContain('type,timestamp,data')
    })

    test('應該支援匯出過濾後的事件資料', () => {
      const exportData = eventTracker.exportEvents('json', {
        type: 'ERROR.NETWORK'
      })

      const parsedData = JSON.parse(exportData.data)
      expect(parsedData).toHaveLength(1)
      expect(parsedData[0].type).toBe('ERROR.NETWORK')
    })

    test('應該包含匯出元資料', () => {
      const exportData = eventTracker.exportEvents('json')

      expect(exportData.metadata).toBeDefined()
      expect(exportData.metadata.exportedAt).toBeDefined()
      expect(exportData.metadata.totalRecords).toBe(3)
      expect(exportData.metadata.exportedBy).toBe('EventTracker')
    })

    test('應該處理匯出請求事件', () => {
      eventTracker.process({
        type: 'EVENT.TRACKING.EXPORT',
        data: {
          requestId: 'export-123',
          format: 'json',
          filters: { type: 'ERROR.NETWORK' }
        }
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'EVENT.TRACKING.EXPORT.COMPLETED',
        {
          requestId: 'export-123',
          exportData: expect.any(Object),
          timestamp: expect.any(Number)
        }
      )
    })

    test('應該支援大量資料的分批匯出', () => {
      // 創建大量測試資料
      for (let i = 0; i < 1000; i++) {
        eventTracker._recordEvent({
          type: 'BULK.TEST',
          data: { index: i }
        })
      }

      const exportData = eventTracker.exportEvents(
        'json',
        {},
        { batchSize: 100 }
      )

      expect(exportData.batches).toBeDefined()
      expect(exportData.batches).toBeGreaterThan(1)
      expect(exportData.metadata.totalRecords).toBe(1003) // 3 + 1000
    })
  })

  // ==================== 記憶體管理和清理 ====================
  describe('記憶體管理和清理', () => {
    test('應該限制記憶體中的事件記錄數量', () => {
      eventTracker.config.maxRecords = 3

      // 添加超過限制的記錄
      for (let i = 0; i < 5; i++) {
        eventTracker._recordEvent({
          type: 'MEMORY.TEST',
          data: { index: i }
        })
      }

      expect(eventTracker.eventRecords).toHaveLength(3)
      // 應該保留最新的記錄
      expect(eventTracker.eventRecords[0].data.index).toBe(4)
      expect(eventTracker.eventRecords[2].data.index).toBe(2)
    })

    test('應該清理過期的事件記錄', () => {
      eventTracker.config.retentionDays = 7

      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 天前
      const recentTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 天前

      eventTracker._recordEvent({
        type: 'OLD.EVENT',
        data: {},
        timestamp: oldTimestamp
      })

      eventTracker._recordEvent({
        type: 'RECENT.EVENT',
        data: {},
        timestamp: recentTimestamp
      })

      eventTracker._cleanupExpiredRecords()

      expect(eventTracker.eventRecords).toHaveLength(1)
      expect(eventTracker.eventRecords[0].type).toBe('RECENT.EVENT')
    })

    test('應該定期執行清理任務', () => {
      jest.useFakeTimers()

      const cleanupSpy = jest.spyOn(eventTracker, '_performMaintenance')

      // 啟動定期清理
      eventTracker._startPeriodicMaintenance()

      // 快進 10 分鐘
      jest.advanceTimersByTime(10 * 60 * 1000)

      expect(cleanupSpy).toHaveBeenCalled()

      jest.useRealTimers()
    })

    test('應該處理清理請求事件', () => {
      // 添加一些測試資料
      for (let i = 0; i < 5; i++) {
        eventTracker._recordEvent({
          type: 'CLEANUP.TEST',
          data: { index: i }
        })
      }

      eventTracker.process({
        type: 'EVENT.TRACKING.CLEAR',
        data: {
          clearType: 'all',
          requestId: 'clear-123'
        }
      })

      expect(eventTracker.eventRecords).toHaveLength(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('EVENT.TRACKING.CLEARED', {
        requestId: 'clear-123',
        clearedCount: 5,
        timestamp: expect.any(Number)
      })
    })

    test('應該在停用時清理資源', () => {
      eventTracker._recordEvent({ type: 'TEST', data: {} })

      eventTracker.disable()

      expect(eventTracker.isEnabled).toBe(false)
      expect(eventTracker.eventRecords).toHaveLength(0)
      expect(global.localStorage.removeItem).toHaveBeenCalledWith(
        'eventTracker_records'
      )
    })

    test('應該監控記憶體使用情況', () => {
      const memoryStats = eventTracker.getMemoryStats()

      expect(memoryStats).toBeDefined()
      expect(memoryStats.recordCount).toBe(0)
      expect(memoryStats.estimatedMemoryUsage).toBeDefined()
      expect(memoryStats.maxRecords).toBe(eventTracker.config.maxRecords)
    })
  })

  // ==================== 追蹤控制 ====================
  describe('追蹤控制', () => {
    test('應該支援啟動和停止追蹤', () => {
      eventTracker.process({
        type: 'EVENT.TRACKING.STOP',
        data: { reason: 'user-request' }
      })

      expect(eventTracker.isEnabled).toBe(false)

      eventTracker.process({
        type: 'EVENT.TRACKING.START',
        data: { reason: 'user-request' }
      })

      expect(eventTracker.isEnabled).toBe(true)
    })

    test('應該在停止追蹤時不記錄新事件', () => {
      eventTracker.isEnabled = false

      const initialCount = eventTracker.eventRecords.length
      eventTracker._recordEvent({ type: 'DISABLED.TEST', data: {} })

      expect(eventTracker.eventRecords).toHaveLength(initialCount)
    })

    test('應該處理追蹤查詢請求', () => {
      eventTracker._recordEvent({
        type: 'QUERY.TEST',
        data: { value: 'test' }
      })

      eventTracker.process({
        type: 'EVENT.TRACKING.QUERY',
        data: {
          requestId: 'query-123',
          filters: { type: 'QUERY.TEST' },
          options: { limit: 10 }
        }
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'EVENT.TRACKING.QUERY.COMPLETED',
        {
          requestId: 'query-123',
          results: expect.any(Array),
          totalCount: 1,
          timestamp: expect.any(Number)
        }
      )
    })
  })
})
