/* eslint-disable no-console */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * EventBus getStats 整合測試
 * 驗證getStats在實際場景中的行為
 *
 * 負責功能：
 * - 測試getStats與背景事件系統的整合
 * - 驗證在跨模組通訊中的統計正確性
 * - 測試統計資料在實際使用場景的準確性
 *
 * 設計考量：
 * - 模擬真實的Chrome Extension環境
 * - 測試多個模組同時使用事件系統時的統計
 * - 驗證統計資料的持久性和正確性
 *
 * 處理流程：
 * 1. 初始化事件系統並註冊真實處理器
 * 2. 觸發跨模組事件流程
 * 3. 驗證統計資料反映真實活動
 * 4. 測試極端情況和邊界條件
 *
 * 使用情境：
 * - Background Service Worker健康檢查
 * - 開發階段的系統監控
 * - 效能問題診斷
 */

describe('🔍 EventBus getStats 整合測試', () => {
  // eslint-disable-next-line no-unused-vars
  let eventBus

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup()

    // 初始化EventBus
    // eslint-disable-next-line no-unused-vars
    const EventBus = require('@/core/event-bus')
    eventBus = new EventBus()

    // 模擬Chrome Extension環境
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        }
      }
    }

    // 重置處理器
  })

  afterEach(() => {
    if (eventBus && typeof eventBus.destroy === 'function') {
      eventBus.destroy()
    }
  })

  describe('🏗 背景事件系統統計', () => {
    test('應該正確統計背景事件處理流程', async () => {
      // Arrange - 模擬真實的Background handlers
      // eslint-disable-next-line no-unused-vars
      const extractionCompletedHandler = jest.fn(async (data) => {
        // 模擬儲存操作
        await new Promise(resolve => setTimeout(resolve, 10))
        return { saved: true, bookCount: data.books?.length || 0 }
      })

      // eslint-disable-next-line no-unused-vars
      const uiUpdateHandler = jest.fn((data) => {
        return { uiUpdated: true, progress: data.progress }
      })

      // eslint-disable-next-line no-unused-vars
      const errorHandler = jest.fn((error) => {
        // eslint-disable-next-line no-console
        console.log('處理錯誤:', error.message)
        return { errorHandled: true }
      })

      // 註冊關鍵事件處理器
      eventBus.on('EXTRACTION.COMPLETED', extractionCompletedHandler, { priority: 1 })
      eventBus.on('UI.UPDATE.PROGRESS', uiUpdateHandler, { priority: 2 })
      eventBus.on('SYSTEM.ERROR', errorHandler, { priority: 0 })

      // 檢查初始統計
      // eslint-disable-next-line no-unused-vars
      const initialStats = eventBus.getStats()
      expect(initialStats).toEqual({
        totalEventTypes: 3,
        totalListeners: 3,
        eventTypes: ['EXTRACTION.COMPLETED', 'UI.UPDATE.PROGRESS', 'SYSTEM.ERROR'],
        listenerCounts: {
          'EXTRACTION.COMPLETED': 1,
          'UI.UPDATE.PROGRESS': 1,
          'SYSTEM.ERROR': 1
        },
        totalEvents: 0,
        totalEmissions: 0,
        totalExecutionTime: 0,
        lastActivity: null
      })

      // Act - 模擬完整的資料提取流程
      // eslint-disable-next-line no-unused-vars
      const extractionData = {
        books: [
          { id: 1, title: '測試書籍1', progress: 45 },
          { id: 2, title: '測試書籍2', progress: 78 }
        ],
        source: 'readmoo'
      }

      // 1. 觸發資料提取完成事件
      // eslint-disable-next-line no-unused-vars
      const extractionResults = await eventBus.emit('EXTRACTION.COMPLETED', extractionData)

      // 2. 觸發UI更新事件
      // eslint-disable-next-line no-unused-vars
      const uiResults = await eventBus.emit('UI.UPDATE.PROGRESS', { progress: 100 })

      // 3. 觸發錯誤處理事件
      // eslint-disable-next-line no-unused-vars
      const errorResults = await eventBus.emit('SYSTEM.ERROR', new Error('測試錯誤'))

      // Assert - 驗證處理器都被正確調用
      expect(extractionCompletedHandler).toHaveBeenCalledWith(extractionData)
      expect(uiUpdateHandler).toHaveBeenCalledWith({ progress: 100 })
      // eslint-disable-next-line no-unused-vars
      const testError = new Error('測試錯誤')
      expect(errorHandler).toHaveBeenCalledWith(testError)

      // 驗證處理結果
      expect(extractionResults).toHaveLength(1)
      expect(extractionResults[0]).toEqual({ saved: true, bookCount: 2 })
      expect(uiResults[0]).toEqual({ uiUpdated: true, progress: 100 })
      expect(errorResults[0]).toEqual({ errorHandled: true })

      // 驗證最終統計
      // eslint-disable-next-line no-unused-vars
      const finalStats = eventBus.getStats()
      expect(finalStats.totalEventTypes).toBe(3)
      expect(finalStats.totalListeners).toBe(3)
      expect(finalStats.totalEvents).toBe(3) // 3次emit
      expect(finalStats.totalEmissions).toBe(3) // 向後相容
      expect(finalStats.totalExecutionTime).toBeGreaterThan(0) // 有實際執行時間
      expect(finalStats.lastActivity).toBeTruthy()

      // 驗證活動時間戳格式
      // eslint-disable-next-line no-unused-vars
      const lastActivityDate = new Date(finalStats.lastActivity)
      expect(lastActivityDate).toBeInstanceOf(Date)
      expect(lastActivityDate.getTime()).not.toBeNaN()
    })

    test('應該在高負載情況下正確統計', async () => {
      // Arrange - 模擬高負載場景
      // eslint-disable-next-line no-unused-vars
      const handlers = []
      // eslint-disable-next-line no-unused-vars
      const eventTypes = []

      // 建立多個處理器
      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-unused-vars
        const eventType = `HIGH.LOAD.EVENT.${i}`
        // eslint-disable-next-line no-unused-vars
        const handler = jest.fn((data) => ({ processed: true, id: i, data }))

        eventBus.on(eventType, handler)
        handlers.push(handler)
        eventTypes.push(eventType)
      }

      // eslint-disable-next-line no-unused-vars
      const initialStats = eventBus.getStats()
      expect(initialStats.totalEventTypes).toBe(10)
      expect(initialStats.totalListeners).toBe(10)

      // Act - 高頻觸發事件
      // eslint-disable-next-line no-unused-vars
      const emitPromises = []
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 10; i++) {
          emitPromises.push(
            eventBus.emit(`HIGH.LOAD.EVENT.${i}`, { round, eventId: i })
          )
        }
      }

      // 等待所有事件處理完成
      // eslint-disable-next-line no-unused-vars
      const allResults = await Promise.all(emitPromises)

      // Assert - 驗證統計正確性
      // eslint-disable-next-line no-unused-vars
      const finalStats = eventBus.getStats()
      expect(finalStats.totalEvents).toBe(50) // 5 rounds * 10 events
      expect(finalStats.totalEmissions).toBe(50)
      expect(finalStats.totalEventTypes).toBe(10) // 事件類型數不變
      expect(finalStats.totalListeners).toBe(10) // 監聽器數不變
      expect(finalStats.totalExecutionTime).toBeGreaterThan(0)
      expect(finalStats.lastActivity).toBeTruthy()

      // 驗證所有處理器都被正確呼叫
      handlers.forEach((handler, index) => {
        expect(handler).toHaveBeenCalledTimes(5) // 每個處理器被呼叫5次
      })

      // 驗證返回結果
      expect(allResults).toHaveLength(50)
      allResults.forEach(result => {
        expect(result).toHaveLength(1) // 每個事件有一個處理器
        expect(result[0]).toEqual(expect.objectContaining({
          processed: true,
          id: expect.any(Number),
          data: expect.any(Object)
        }))
      })
    })
  })

  describe('📊 統計資料一致性', () => {
    test('應該在動態監聽器變更中保持統計一致性', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handlers = [
        jest.fn(() => 'handler1'),
        jest.fn(() => 'handler2'),
        jest.fn(() => 'handler3')
      ]

      // 初始註冊
      eventBus.on('DYNAMIC.EVENT', handlers[0])
      eventBus.on('DYNAMIC.EVENT', handlers[1])

      // eslint-disable-next-line no-unused-vars
      let stats = eventBus.getStats()
      expect(stats.totalEventTypes).toBe(1)
      expect(stats.totalListeners).toBe(2)
      expect(stats.listenerCounts['DYNAMIC.EVENT']).toBe(2)

      // Act & Assert - 動態添加監聽器
      eventBus.on('DYNAMIC.EVENT', handlers[2])
      stats = eventBus.getStats()
      expect(stats.totalListeners).toBe(3)
      expect(stats.listenerCounts['DYNAMIC.EVENT']).toBe(3)

      // 觸發事件
      // eslint-disable-next-line no-unused-vars
      const results = await eventBus.emit('DYNAMIC.EVENT', { test: 'data' })
      expect(results).toHaveLength(3)

      stats = eventBus.getStats()
      expect(stats.totalEvents).toBe(1)
      expect(stats.lastActivity).toBeTruthy()

      // 移除一個監聽器
      eventBus.off('DYNAMIC.EVENT', handlers[1])
      stats = eventBus.getStats()
      expect(stats.totalListeners).toBe(2)
      expect(stats.listenerCounts['DYNAMIC.EVENT']).toBe(2)

      // 再次觸發事件
      // eslint-disable-next-line no-unused-vars
      const results2 = await eventBus.emit('DYNAMIC.EVENT', { test: 'data2' })
      expect(results2).toHaveLength(2)

      // eslint-disable-next-line no-unused-vars
      const finalStats = eventBus.getStats()
      expect(finalStats.totalEvents).toBe(2)
      expect(finalStats.totalListeners).toBe(2)

      // 確認只有兩個處理器在第二次被呼叫
      expect(handlers[0]).toHaveBeenCalledTimes(2)
      expect(handlers[1]).toHaveBeenCalledTimes(1) // 被移除前只執行一次
      expect(handlers[2]).toHaveBeenCalledTimes(2)
    })

    test('應該正確處理錯誤情況下的統計', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const workingHandler = jest.fn(() => 'success')
      // eslint-disable-next-line no-unused-vars
      const errorHandler = jest.fn(() => {
        throw (() => { const error = new Error('處理器錯誤'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      })

      eventBus.on('ERROR.TEST', workingHandler)
      eventBus.on('ERROR.TEST', errorHandler)

      // eslint-disable-next-line no-unused-vars
      const initialStats = eventBus.getStats()
      expect(initialStats.totalEvents).toBe(0)

      // Act - 觸發會產生錯誤的事件
      // eslint-disable-next-line no-unused-vars
      const results = await eventBus.emit('ERROR.TEST', { data: 'test' })

      // Assert - 即使有錯誤，統計也應該正確
      expect(results).toHaveLength(2)
      expect(results[0]).toBe('success')
      expect(results[1]).toBeInstanceOf(Error)
      expect(results[1].message).toBe('處理器錯誤')

      // eslint-disable-next-line no-unused-vars
      const finalStats = eventBus.getStats()
      expect(finalStats.totalEvents).toBe(1) // 錯誤不影響事件計數
      expect(finalStats.totalEmissions).toBe(1)
      expect(finalStats.lastActivity).toBeTruthy()
      expect(finalStats.totalExecutionTime).toBeGreaterThan(0)

      // 處理器調用次數
      expect(workingHandler).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('🔄 Chrome Extension 整合場景', () => {
    test('應該支援跨上下文統計追蹤', async () => {
      // Arrange - 模擬Background/Content/Popup間的事件流
      // eslint-disable-next-line no-unused-vars
      const backgroundHandler = jest.fn((data) => ({
        processed: 'background',
        timestamp: Date.now(),
        data
      }))

      // eslint-disable-next-line no-unused-vars
      const contentHandler = jest.fn((data) => ({
        processed: 'content',
        extracted: data.books?.length || 0
      }))

      // eslint-disable-next-line no-unused-vars
      const popupHandler = jest.fn((data) => ({
        processed: 'popup',
        uiUpdated: true
      }))

      // 註冊不同上下文的處理器
      eventBus.on('CONTENT.EVENT.FORWARD', backgroundHandler, { priority: 0 })
      eventBus.on('EXTRACTION.COMPLETED', contentHandler, { priority: 1 })
      eventBus.on('UI.UPDATE.REQUIRED', popupHandler, { priority: 2 })

      // eslint-disable-next-line no-unused-vars
      const initialStats = eventBus.getStats()
      expect(initialStats.totalEventTypes).toBe(3)
      expect(initialStats.totalListeners).toBe(3)

      // Act - 模擬完整的跨上下文事件流程
      // 1. Content Script 轉發事件到 Background
      await eventBus.emit('CONTENT.EVENT.FORWARD', {
        type: 'EXTRACTION.COMPLETED',
        books: [{ id: 1, title: 'Test Book' }],
        source: 'content-script'
      })

      // 2. Background 處理後觸發資料完成事件
      await eventBus.emit('EXTRACTION.COMPLETED', {
        books: [{ id: 1, title: 'Test Book' }],
        processedBy: 'background'
      })

      // 3. UI 更新事件
      await eventBus.emit('UI.UPDATE.REQUIRED', {
        action: 'refresh',
        source: 'background'
      })

      // Assert - 驗證跨上下文統計
      // eslint-disable-next-line no-unused-vars
      const finalStats = eventBus.getStats()
      expect(finalStats.totalEvents).toBe(3)
      expect(finalStats.totalEmissions).toBe(3)
      expect(finalStats.totalEventTypes).toBe(3)
      expect(finalStats.totalListeners).toBe(3)
      expect(finalStats.lastActivity).toBeTruthy()

      // 驗證每個上下文的處理器都被正確調用
      expect(backgroundHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EXTRACTION.COMPLETED',
        source: 'content-script'
      }))

      expect(contentHandler).toHaveBeenCalledWith(expect.objectContaining({
        processedBy: 'background'
      }))

      expect(popupHandler).toHaveBeenCalledWith(expect.objectContaining({
        action: 'refresh',
        source: 'background'
      }))

      // 驗證統計資料可用於系統健康檢查
      // eslint-disable-next-line no-unused-vars
      const systemHealth = {
        eventSystemActive: finalStats.totalListeners > 0,
        eventsProcessed: finalStats.totalEvents,
        lastActivity: finalStats.lastActivity,
        performanceIndicator: finalStats.totalExecutionTime / finalStats.totalEvents
      }

      expect(systemHealth.eventSystemActive).toBe(true)
      expect(systemHealth.eventsProcessed).toBe(3)
      expect(systemHealth.lastActivity).toBeTruthy()
      expect(systemHealth.performanceIndicator).toBeGreaterThan(0)
    })
  })
})
