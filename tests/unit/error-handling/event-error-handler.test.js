/**
 * EventErrorHandler 測試
 * TDD 循環 #32: EventErrorHandler 核心錯誤系統
 *
 * 測試目標：
 * 1. 統一錯誤處理和分類系統
 * 2. 斷路器模式實現和自動恢復
 * 3. 錯誤捕獲和隔離機制
 * 4. 系統級錯誤監控和統計
 */

const EventHandler = require('src/core/event-handler')
const { StandardError } = require('src/core/errors/StandardError')

describe('EventErrorHandler - TDD 循環 #32', () => {
  let mockEventBus

  beforeEach(() => {
    // 模擬事件總線
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 清除所有模擬
    jest.clearAllMocks()
  })

  describe('🔧 基本結構和初始化', () => {
    test('應該能夠創建 EventErrorHandler 實例', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')

      expect(() => {
        new EventErrorHandler(mockEventBus)
      }).not.toThrow()
    })

    test('應該繼承 EventHandler 基底類別', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      expect(handler).toBeInstanceOf(EventHandler)
      expect(handler.name).toBe('EventErrorHandler')
    })

    test('應該正確設定優先級和支援的事件', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      expect(handler.priority).toBe(0) // 最高優先級
      expect(handler.supportedEvents).toContain('ERROR.SYSTEM')
      expect(handler.supportedEvents).toContain('ERROR.HANDLER')
      expect(handler.supportedEvents).toContain('ERROR.CIRCUIT_BREAKER')
    })

    test('應該初始化錯誤統計和斷路器狀態', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      expect(handler.errorStats).toBeDefined()
      expect(handler.errorStats.totalErrors).toBe(0)
      expect(handler.circuitBreakers).toBeDefined()
      expect(handler.circuitBreakers.size).toBe(0)
      expect(handler.systemHealthy).toBe(true)
    })
  })

  describe('🚨 統一錯誤處理系統', () => {
    test('應該處理 ERROR.SYSTEM 事件', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      const systemErrorEvent = {
        type: 'ERROR.SYSTEM',
        data: {
          error: new Error('系統錯誤'),
          component: 'EventBus',
          severity: 'HIGH',
          timestamp: Date.now()
        }
      }

      const result = await handler.handle(systemErrorEvent)

      expect(result.success).toBe(true)
      expect(handler.errorStats.totalErrors).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ERROR.CLASSIFIED',
        expect.any(Object)
      )
    })

    test('應該處理 ERROR.HANDLER 事件', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      const handlerErrorEvent = {
        type: 'ERROR.HANDLER',
        data: {
          error: new Error('處理器錯誤'),
          handlerName: 'MessageErrorHandler',
          eventType: 'MESSAGE.ERROR',
          timestamp: Date.now()
        }
      }

      const result = await handler.handle(handlerErrorEvent)

      expect(result.success).toBe(true)
      expect(handler.errorStats.handlerErrors).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ERROR.HANDLER_ISOLATED',
        expect.any(Object)
      )
    })

    test('應該分類錯誤嚴重程度', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      const criticalError = {
        type: 'ERROR.SYSTEM',
        data: {
          error: new Error('記憶體不足'),
          component: 'StorageManager',
          severity: 'CRITICAL'
        }
      }

      await handler.handle(criticalError)

      expect(handler.errorStats.criticalErrors).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'SYSTEM.ALERT',
        expect.objectContaining({
          level: 'CRITICAL'
        })
      )
    })
  })

  describe('⚡ 斷路器模式實現', () => {
    test('應該創建組件斷路器', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      handler.createCircuitBreaker('TestComponent', {
        failureThreshold: 5,
        timeout: 60000
      })

      expect(handler.circuitBreakers.has('TestComponent')).toBe(true)
      const breaker = handler.circuitBreakers.get('TestComponent')
      expect(breaker.state).toBe('CLOSED')
      expect(breaker.failureCount).toBe(0)
    })

    test('應該在錯誤達到閾值時開啟斷路器', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      handler.createCircuitBreaker('TestComponent', {
        failureThreshold: 3,
        timeout: 60000
      })

      // 模擬 3 次錯誤
      for (let i = 0; i < 3; i++) {
        await handler.handle({
          type: 'ERROR.SYSTEM',
          data: {
            error: new Error(`錯誤 ${i + 1}`),
            component: 'TestComponent'
          }
        })
      }

      const breaker = handler.circuitBreakers.get('TestComponent')
      expect(breaker.state).toBe('OPEN')
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'CIRCUIT_BREAKER.OPENED',
        expect.any(Object)
      )
    })

    test('應該在超時後嘗試半開狀態', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      handler.createCircuitBreaker('TestComponent', {
        failureThreshold: 2,
        timeout: 100 // 100ms 超時
      })

      // 觸發斷路器開啟
      for (let i = 0; i < 2; i++) {
        await handler.handle({
          type: 'ERROR.SYSTEM',
          data: {
            error: new Error(`錯誤 ${i + 1}`),
            component: 'TestComponent'
          }
        })
      }

      // 等待超時
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 檢查斷路器狀態
      const canExecute = handler.canExecute('TestComponent')
      expect(canExecute).toBe(true) // 應該允許嘗試執行

      const breaker = handler.circuitBreakers.get('TestComponent')
      expect(breaker.state).toBe('HALF_OPEN')
    })

    test('應該在成功執行後關閉斷路器', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      handler.createCircuitBreaker('TestComponent', {
        failureThreshold: 2,
        timeout: 100
      })

      // 先觸發斷路器開啟
      for (let i = 0; i < 2; i++) {
        await handler.handle({
          type: 'ERROR.SYSTEM',
          data: {
            error: new Error(`錯誤 ${i + 1}`),
            component: 'TestComponent'
          }
        })
      }

      // 等待進入半開狀態
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 記錄成功執行
      handler.recordSuccess('TestComponent')

      const breaker = handler.circuitBreakers.get('TestComponent')
      expect(breaker.state).toBe('CLOSED')
      expect(breaker.failureCount).toBe(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'CIRCUIT_BREAKER.CLOSED',
        expect.any(Object)
      )
    })
  })

  describe('🔍 錯誤隔離和恢復機制', () => {
    test('應該隔離有問題的事件處理器', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      const isolationEvent = {
        type: 'ERROR.HANDLER',
        data: {
          error: new Error('處理器持續失敗'),
          handlerName: 'ProblematicHandler',
          eventType: 'SOME.EVENT',
          consecutiveFailures: 5
        }
      }

      const result = await handler.handle(isolationEvent)

      expect(result.success).toBe(true)
      expect(handler.isHandlerIsolated('ProblematicHandler')).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'HANDLER.ISOLATED',
        expect.objectContaining({
          handlerName: 'ProblematicHandler'
        })
      )
    })

    test('應該提供處理器恢復機制', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      // 先隔離處理器
      handler.isolateHandler('TestHandler', 'Too many failures')
      expect(handler.isHandlerIsolated('TestHandler')).toBe(true)

      // 恢復處理器
      handler.restoreHandler('TestHandler')
      expect(handler.isHandlerIsolated('TestHandler')).toBe(false)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'HANDLER.RESTORED',
        expect.objectContaining({
          handlerName: 'TestHandler'
        })
      )
    })

    test('應該自動嘗試恢復隔離的處理器', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus, {
        autoRecoveryInterval: 100 // 100ms 自動恢復間隔
      })

      // 隔離處理器
      handler.isolateHandler('TestHandler', 'Test isolation')

      // 等待自動恢復嘗試
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 檢查是否嘗試恢復
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'HANDLER.RECOVERY_ATTEMPT',
        expect.any(Object)
      )
    })
  })

  describe('📊 系統健康監控', () => {
    test('應該追蹤系統整體健康狀態', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      // 初始狀態應該是健康的
      expect(handler.getSystemHealth().status).toBe('HEALTHY')

      // 添加一些錯誤
      await handler.handle({
        type: 'ERROR.SYSTEM',
        data: {
          error: new Error('輕微錯誤'),
          severity: 'LOW'
        }
      })

      const health = handler.getSystemHealth()
      expect(health.totalErrors).toBe(1)
      expect(health.status).toBe('HEALTHY') // 輕微錯誤不影響整體健康
    })

    test('應該在嚴重錯誤過多時標記系統不健康', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus, {
        healthThreshold: 2 // 2個嚴重錯誤就標記不健康
      })

      // 添加多個嚴重錯誤
      for (let i = 0; i < 3; i++) {
        await handler.handle({
          type: 'ERROR.SYSTEM',
          data: {
            error: new Error(`嚴重錯誤 ${i + 1}`),
            severity: 'CRITICAL'
          }
        })
      }

      const health = handler.getSystemHealth()
      expect(health.status).toBe('UNHEALTHY')
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'SYSTEM.HEALTH_DEGRADED',
        expect.any(Object)
      )
    })

    test('應該生成系統健康報告', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      // 添加一些統計資料
      handler.errorStats.totalErrors = 10
      handler.errorStats.criticalErrors = 2
      handler.errorStats.handlerErrors = 3

      const report = handler.generateHealthReport()

      expect(report).toContain('系統健康狀態報告')
      expect(report).toContain('總錯誤數: 10')
      expect(report).toContain('嚴重錯誤: 2')
      expect(report).toContain('處理器錯誤: 3')
    })
  })

  describe('⚡ 效能和記憶體管理', () => {
    test('應該限制錯誤記錄的數量', async () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus, {
        maxErrorRecords: 5
      })

      // 添加超過限制的錯誤記錄
      for (let i = 0; i < 10; i++) {
        await handler.handle({
          type: 'ERROR.SYSTEM',
          data: {
            error: new Error(`錯誤 ${i + 1}`)
          }
        })
      }

      expect(handler.recentErrors.length).toBeLessThanOrEqual(5)
    })

    test('應該清理過期的斷路器', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      // 創建一個斷路器並設置為過期
      handler.createCircuitBreaker('ExpiredComponent', {
        failureThreshold: 5,
        timeout: 1000
      })

      const breaker = handler.circuitBreakers.get('ExpiredComponent')
      breaker.lastFailureTime = Date.now() - 2000 // 2秒前
      breaker.state = 'OPEN'

      // 執行清理
      handler.cleanupExpiredCircuitBreakers()

      // 檢查是否已清理（或重置為半開狀態）
      const cleanedBreaker = handler.circuitBreakers.get('ExpiredComponent')
      expect(cleanedBreaker.state).toBe('HALF_OPEN')
    })

    test('應該提供記憶體使用統計', () => {
      const EventErrorHandler = require('src/error-handling/event-error-handler')
      const handler = new EventErrorHandler(mockEventBus)

      const memoryStats = handler.getMemoryUsage()

      expect(memoryStats).toHaveProperty('errorRecordsCount')
      expect(memoryStats).toHaveProperty('circuitBreakersCount')
      expect(memoryStats).toHaveProperty('estimatedMemoryUsage')
      expect(memoryStats).toHaveProperty('lastCleanupTime')
    })
  })
})
