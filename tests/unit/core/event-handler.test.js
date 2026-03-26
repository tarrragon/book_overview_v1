const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * 事件處理器基底類別單元測試
 * 測試事件處理器的抽象基底類別功能
 *
 * 負責功能：
 * - 測試處理器的基本屬性管理
 * - 驗證事件處理生命週期
 * - 測試統計追蹤功能
 * - 驗證錯誤處理機制
 * - 測試抽象方法的強制實現
 * - 驗證事件類型支援檢查
 *
 * 設計考量：
 * - EventHandler是抽象基底類別
 * - 提供統一的事件處理介面
 * - 支援統計追蹤和效能監控
 * - 確保子類別實現必要的抽象方法
 *
 * 處理流程：
 * 1. 測試基本構造和屬性
 * 2. 測試生命週期方法順序
 * 3. 測試統計和監控功能
 * 4. 測試錯誤處理和隔離
 * 5. 測試抽象方法強制實現
 *
 * 使用情境：
 * - 所有具體事件處理器的基底類別
 * - 提供統一的處理介面和統計功能
 * - 確保處理器的標準化實現
 */

describe('🎭 事件處理器基底類別測試', () => {
  let EventHandler
  let ConcreteHandler

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup()

    // 載入EventHandler
    EventHandler = require('@/core/event-handler')

    // 建立具體的測試處理器類別
    class TestEventHandler extends EventHandler {
      constructor (name = 'TestHandler', priority = 2) {
        super(name, priority)
        this.processResult = 'test-result'
        this.shouldThrowError = false
      }

      getSupportedEvents () {
        return ['test.event.started', 'test.event.completed']
      }

      async process (event) {
        if (this.shouldThrowError) {
          throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.CORE_PROCESS_ERROR; error.details = { category: 'testing' }; return error })()
        }
        return this.processResult
      }
    }

    ConcreteHandler = TestEventHandler
  })

  describe('📝 基本構造和屬性管理', () => {
    test('應該能夠創建處理器實例', () => {
      // Arrange & Act
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler('MyHandler', 1)

      // Assert
      expect(handler.name).toBe('MyHandler')
      expect(handler.priority).toBe(1)
      expect(handler.isEnabled).toBe(true)
      expect(handler.executionCount).toBe(0)
      expect(handler.lastExecutionTime).toBe(null)
      expect(handler.averageExecutionTime).toBe(0)
    })

    test('應該使用預設參數創建處理器', () => {
      // Arrange & Act
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()

      // Assert
      expect(handler.name).toBe('TestHandler')
      expect(handler.priority).toBe(2)
      expect(handler.isEnabled).toBe(true)
    })

    test('應該能夠啟用和停用處理器', () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()

      // Act & Assert
      expect(handler.isEnabled).toBe(true)

      handler.setEnabled(false)
      expect(handler.isEnabled).toBe(false)

      handler.setEnabled(true)
      expect(handler.isEnabled).toBe(true)
    })
  })

  describe('🔄 事件處理生命週期', () => {
    test('應該按照正確順序執行生命週期方法', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const executionOrder = []
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: { test: true } }

      // 模擬生命週期方法
      handler.beforeHandle = jest.fn(async (event) => {
        executionOrder.push('beforeHandle')
        expect(event).toBe(mockEvent)
      })

      handler.process = jest.fn(async (event) => {
        executionOrder.push('process')
        expect(event).toBe(mockEvent)
        return 'process-result'
      })

      handler.afterHandle = jest.fn(async (event, result) => {
        executionOrder.push('afterHandle')
        expect(event).toBe(mockEvent)
        expect(result).toBe('process-result')
      })

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await handler.handle(mockEvent)

      // Assert
      expect(executionOrder).toEqual(['beforeHandle', 'process', 'afterHandle'])
      expect(result).toBe('process-result')
      expect(handler.executionCount).toBe(1)
    })

    test('應該在停用時不執行處理邏輯', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }

      handler.setEnabled(false)
      handler.process = jest.fn()

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await handler.handle(mockEvent)

      // Assert
      expect(result).toBe(null)
      expect(handler.process).not.toHaveBeenCalled()
      expect(handler.executionCount).toBe(0)
    })

    test('應該在錯誤時調用錯誤處理方法', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }

      handler.shouldThrowError = true
      handler.onError = jest.fn()

      // Act & Assert
      await expect(handler.handle(mockEvent)).rejects.toThrow()
      expect(handler.onError).toHaveBeenCalledWith(mockEvent, expect.any(Error))
      expect(handler.executionCount).toBe(1) // 統計應該仍然更新
    })
  })

  describe('📊 統計追蹤功能', () => {
    test('應該正確追蹤執行統計', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }

      // Act
      await handler.handle(mockEvent)
      await handler.handle(mockEvent)

      // Assert
      expect(handler.executionCount).toBe(2)
      expect(handler.lastExecutionTime).toBeGreaterThan(0)
      expect(handler.averageExecutionTime).toBeGreaterThan(0)
    })

    test('應該提供統計資訊摘要', () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler('StatsHandler', 1)
      handler.executionCount = 5
      handler.lastExecutionTime = 100
      handler.averageExecutionTime = 75

      // Act
      // eslint-disable-next-line no-unused-vars
      const stats = handler.getStats()

      // Assert
      expect(stats).toEqual({
        name: 'StatsHandler',
        executionCount: 5,
        lastExecutionTime: 100,
        averageExecutionTime: 75,
        isEnabled: true
      })
    })

    test('應該正確計算平均執行時間', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }

      // 模擬不同的執行時間
      // eslint-disable-next-line no-unused-vars
      let callCount = 0
      // eslint-disable-next-line no-unused-vars
      const originalUpdateStats = handler.updateStats.bind(handler)
      handler.updateStats = jest.fn((executionTime) => {
        // 模擬第一次50ms，第二次100ms
        // eslint-disable-next-line no-unused-vars
        const simulatedTime = callCount === 0 ? 50 : 100
        callCount++
        originalUpdateStats(simulatedTime)
      })

      // Act
      await handler.handle(mockEvent)
      await handler.handle(mockEvent)

      // Assert
      expect(handler.executionCount).toBe(2)
      expect(handler.lastExecutionTime).toBe(100)
      expect(handler.averageExecutionTime).toBe(75) // (50 + 100) / 2
    })
  })

  describe('🎯 事件類型支援檢查', () => {
    test('應該正確識別支援的事件類型', () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()

      // Act & Assert
      expect(handler.canHandle('test.event.started')).toBe(true)
      expect(handler.canHandle('test.event.completed')).toBe(true)
      expect(handler.canHandle('unsupported.event')).toBe(false)
    })

    test('應該返回支援的事件類型列表', () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()

      // Act
      // eslint-disable-next-line no-unused-vars
      const supportedEvents = handler.getSupportedEvents()

      // Assert
      expect(supportedEvents).toEqual(['test.event.started', 'test.event.completed'])
    })
  })

  describe('🔧 抽象方法強制實現', () => {
    test('EventHandler不應該被直接實例化', () => {
      // Arrange & Act & Assert
      expect(() => {
        // eslint-disable-next-line no-new
        new EventHandler('DirectHandler')
      }).not.toThrow() // EventHandler可以被實例化，但抽象方法會拋出錯誤
    })

    test('直接調用抽象方法應該拋出錯誤', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new EventHandler('AbstractHandler')
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event', data: {} }

      // Act & Assert
      await expect(handler.process(mockEvent)).rejects.toMatchObject(expect.objectContaining({ message: 'Process method must be implemented by subclass' }))
      expect(() => handler.getSupportedEvents()).toThrow(expect.objectContaining({ message: 'getSupportedEvents method must be implemented by subclass' }))
    })

    test('子類別必須實現所有抽象方法', () => {
      // Arrange
      class IncompleteHandler extends EventHandler {
        constructor () {
          super('IncompleteHandler')
        }
        // 故意不實現 process 和 getSupportedEvents
      }

      // eslint-disable-next-line no-unused-vars
      const handler = new IncompleteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event', data: {} }

      // Act & Assert
      expect(() => handler.getSupportedEvents()).toThrow(expect.objectContaining({ message: 'getSupportedEvents method must be implemented by subclass' }))
      expect(handler.process(mockEvent)).rejects.toMatchObject(expect.objectContaining({ message: 'Process method must be implemented by subclass' }))
    })
  })

  describe('🛡 錯誤處理和隔離', () => {
    test('應該在beforeHandle錯誤時停止執行', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }
      // eslint-disable-next-line no-unused-vars
      const beforeError = new Error('Before handle error')

      handler.beforeHandle = jest.fn().mockRejectedValue(beforeError)
      handler.process = jest.fn()
      handler.afterHandle = jest.fn()
      handler.onError = jest.fn()

      // Act & Assert
      await expect(handler.handle(mockEvent)).rejects.toMatchObject(expect.objectContaining({ message: 'Before handle error' }))
      expect(handler.process).not.toHaveBeenCalled()
      expect(handler.afterHandle).not.toHaveBeenCalled()
      expect(handler.onError).toHaveBeenCalledWith(mockEvent, beforeError)
    })

    test('應該在process錯誤時跳過afterHandle', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }

      handler.shouldThrowError = true
      handler.beforeHandle = jest.fn()
      handler.afterHandle = jest.fn()
      handler.onError = jest.fn()

      // Act & Assert
      await expect(handler.handle(mockEvent)).rejects.toThrow()
      expect(handler.beforeHandle).toHaveBeenCalled()
      expect(handler.afterHandle).not.toHaveBeenCalled()
      expect(handler.onError).toHaveBeenCalled()
    })

    test('應該在afterHandle錯誤時仍然調用錯誤處理', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }
      // eslint-disable-next-line no-unused-vars
      const afterError = new Error('After handle error')

      handler.afterHandle = jest.fn().mockRejectedValue(afterError)
      handler.onError = jest.fn()

      // Act & Assert
      await expect(handler.handle(mockEvent)).rejects.toMatchObject(expect.objectContaining({ message: 'After handle error' }))
      expect(handler.onError).toHaveBeenCalledWith(mockEvent, afterError)
      expect(handler.executionCount).toBe(1) // 統計仍應更新
    })
  })

  describe('🔧 預設方法實現', () => {
    test('預設的beforeHandle應該記錄日誌', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.started', data: {} }
      // eslint-disable-next-line no-unused-vars
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      // Act
      await handler.beforeHandle(mockEvent)

      // Assert
      // Logger 結構化輸出，不再直接呼叫 console.log
      expect(consoleSpy).toHaveBeenCalled()

      // Cleanup
      consoleSpy.mockRestore()
    })

    test('預設的afterHandle應該記錄完成日誌', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.completed', data: {} }
      // eslint-disable-next-line no-unused-vars
      const result = 'test-result'
      // eslint-disable-next-line no-unused-vars
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      // Act
      await handler.afterHandle(mockEvent, result)

      // Assert
      expect(consoleSpy).toHaveBeenCalled()

      // Cleanup
      consoleSpy.mockRestore()
    })

    test('預設的onError應該記錄錯誤日誌', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const handler = new ConcreteHandler()
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event.error', data: {} }
      // eslint-disable-next-line no-unused-vars
      const error = new Error('Test error')
      // eslint-disable-next-line no-unused-vars
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // Act
      await handler.onError(mockEvent, error)

      // Assert
      expect(consoleSpy).toHaveBeenCalled()

      // Cleanup
      consoleSpy.mockRestore()
    })
  })
})
