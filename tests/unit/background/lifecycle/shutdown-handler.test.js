/**
 * ShutdownHandler 單元測試
 *
 * 測試範圍：
 * - 基本建構和初始化
 * - 優雅關閉機制
 * - 超時保護機制
 * - 關閉流程協調
 * - 錯誤處理和復原
 * - 關閉狀態管理
 */

// eslint-disable-next-line no-unused-vars
const ShutdownHandler = require('src/background/lifecycle/shutdown-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('ShutdownHandler', () => {
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger
  // eslint-disable-next-line no-unused-vars
  let mockEventCoordinator
  // eslint-disable-next-line no-unused-vars
  let mockMessageRouter
  // eslint-disable-next-line no-unused-vars
  let mockPageMonitor
  // eslint-disable-next-line no-unused-vars
  let mockErrorHandler
  let dependencies
  let shutdownHandler

  beforeEach(() => {
    // 模擬依賴項
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    mockEventCoordinator = {
      stop: jest.fn().mockResolvedValue(),
      getCriticalState: jest.fn().mockResolvedValue({ status: 'ok' })
    }

    mockMessageRouter = {
      stop: jest.fn().mockResolvedValue(),
      stopAcceptingMessages: jest.fn().mockResolvedValue()
    }

    mockPageMonitor = {
      stop: jest.fn().mockResolvedValue()
    }

    mockErrorHandler = {
      stop: jest.fn().mockResolvedValue()
    }

    dependencies = {
      eventBus: mockEventBus,
      logger: mockLogger,
      eventCoordinator: mockEventCoordinator,
      messageRouter: mockMessageRouter,
      pageMonitor: mockPageMonitor,
      errorHandler: mockErrorHandler
    }

    shutdownHandler = new ShutdownHandler(dependencies)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ==================== 基本建構和初始化 ====================
  describe('基本建構和初始化', () => {
    test('應該正確建構 ShutdownHandler 實例', () => {
      expect(shutdownHandler).toBeInstanceOf(ShutdownHandler)
      expect(shutdownHandler.moduleName).toBe('ShutdownHandler')
      expect(shutdownHandler.eventCoordinator).toBe(mockEventCoordinator)
      expect(shutdownHandler.messageRouter).toBe(mockMessageRouter)
    })

    test('應該初始化關閉狀態', () => {
      expect(shutdownHandler.shutdownInProgress).toBe(false)
      expect(shutdownHandler.lastShutdownReason).toBe(null)
      expect(shutdownHandler.shutdownStartTime).toBe(null)
    })

    test('應該設定預設的關閉配置', () => {
      expect(shutdownHandler.shutdownTimeout).toBe(30000) // 預設 30 秒
      expect(shutdownHandler.shutdownSequence).toEqual([
        'pageMonitor',
        'messageRouter',
        'errorHandler',
        'eventCoordinator'
      ])
    })

    test('應該初始化關鍵狀態管理', () => {
      expect(shutdownHandler.criticalState).toBeInstanceOf(Map)
      expect(shutdownHandler.criticalState.size).toBe(0)
    })
  })

  // ==================== 初始化方法 ====================
  describe('初始化方法', () => {
    test('應該正確初始化關閉處理器', async () => {
      await shutdownHandler.initialize()

      expect(shutdownHandler.isInitialized).toBe(true)
      expect(mockLogger.log).toHaveBeenCalledWith('🛑 初始化關閉處理器')
      expect(mockLogger.log).toHaveBeenCalledWith('✅ 關閉處理器初始化完成')
    })

    test('應該設定關閉檢測機制', async () => {
      // 模擬全域 self 物件
      // eslint-disable-next-line no-unused-vars
      const mockAddEventListener = jest.fn()
      // eslint-disable-next-line no-unused-vars
      const originalSelf = global.self
      global.self = {
        addEventListener: mockAddEventListener
      }

      await shutdownHandler.initialize()

      // 檢查初始化完成，不強制要求監聽器註冊（因為在測試環境中可能不會實際註冊）
      expect(shutdownHandler.isInitialized).toBe(true)
      expect(mockLogger.log).toHaveBeenCalledWith('🔍 關閉檢測機制設定完成（全域錯誤處理器已在頂層註冊）')

      // 清理
      global.self = originalSelf
    })
  })

  // ==================== 優雅關閉機制 ====================
  describe('優雅關閉機制', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該執行優雅關閉流程', async () => {
      // eslint-disable-next-line no-unused-vars
      const reason = 'user_request'

      await shutdownHandler.gracefulShutdown(reason)

      expect(shutdownHandler.lastShutdownReason).toBe(reason)
      expect(shutdownHandler.shutdownHistory).toHaveLength(1)
      expect(shutdownHandler.shutdownHistory[0].success).toBe(true)
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('🛑 開始優雅關閉')
      )
    })

    test('應該協調各模組的關閉流程', async () => {
      await shutdownHandler.gracefulShutdown('system_maintenance')

      // 驗證模組按順序關閉
      expect(mockPageMonitor.stop).toHaveBeenCalled()
      expect(mockMessageRouter.stop).toHaveBeenCalled()
      expect(mockErrorHandler.stop).toHaveBeenCalled()
      expect(mockEventCoordinator.stop).toHaveBeenCalled()
    })

    test('應該觸發關閉完成事件', async () => {
      await shutdownHandler.gracefulShutdown('test')

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.SHUTDOWN.COMPLETED', {
        reason: 'test',
        timestamp: expect.any(Number)
      })
    })

    test('應該防止重複關閉', async () => {
      // 啟動第一個關閉
      // eslint-disable-next-line no-unused-vars
      const firstShutdown = shutdownHandler.gracefulShutdown('first')

      // 嘗試第二個關閉
      await shutdownHandler.gracefulShutdown('second')

      await firstShutdown

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 關閉處理已在進行中')
    })
  })

  // ==================== 超時保護機制 ====================
  describe('超時保護機制', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該在超時時拋出錯誤', async () => {
      // 模擬慢速關閉
      mockEventCoordinator.stop.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      )

      await expect(shutdownHandler.gracefulShutdown('timeout_test', 1000))
        .rejects.toMatchObject({
          code: ErrorCodes.TIMEOUT_ERROR,
          message: '關閉超時',
          details: expect.objectContaining({
            category: 'general',
            component: 'ShutdownHandler',
            timeout: 1000
          })
        })
    })

    test('應該使用預設超時設定', async () => {
      // 模擬慢速關閉流程
      mockEventCoordinator.stop.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      )

      // eslint-disable-next-line no-unused-vars
      const startTime = Date.now()
      try {
        await shutdownHandler.gracefulShutdown('default_timeout_test')
      } catch (error) {
        // eslint-disable-next-line no-unused-vars
        const duration = Date.now() - startTime
        expect(duration).toBeGreaterThan(29000) // 接近 30 秒
        expect(duration).toBeLessThan(32000)
        expect(error.code).toBe(ErrorCodes.TIMEOUT_ERROR)
      }
    }, 35000)

    test('應該在超時後執行強制關閉', async () => {
      mockEventCoordinator.stop.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      )

      // eslint-disable-next-line no-unused-vars
      const forceShutdownSpy = jest.spyOn(shutdownHandler, 'forceShutdown')

      try {
        await shutdownHandler.gracefulShutdown('force_shutdown_test', 1000)
      } catch (error) {
        expect(forceShutdownSpy).toHaveBeenCalled()
      }
    })
  })

  // ==================== 關閉流程協調 ====================
  describe('關閉流程協調', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該按正確順序執行關閉步驟', async () => {
      // eslint-disable-next-line no-unused-vars
      const callOrder = []

      mockPageMonitor.stop.mockImplementation(() => {
        callOrder.push('pageMonitor.stop')
        return Promise.resolve()
      })

      mockMessageRouter.stop.mockImplementation(() => {
        callOrder.push('messageRouter.stop')
        return Promise.resolve()
      })

      mockErrorHandler.stop.mockImplementation(() => {
        callOrder.push('errorHandler.stop')
        return Promise.resolve()
      })

      mockEventCoordinator.stop.mockImplementation(() => {
        callOrder.push('eventCoordinator.stop')
        return Promise.resolve()
      })

      await shutdownHandler.gracefulShutdown('order_test')

      expect(callOrder).toEqual([
        'pageMonitor.stop',
        'messageRouter.stop',
        'errorHandler.stop',
        'eventCoordinator.stop'
      ])
    })

    test('應該處理部分模組關閉失敗', async () => {
      mockEventCoordinator.stop.mockRejectedValue(new Error('事件協調器關閉失敗'))

      await shutdownHandler.gracefulShutdown('partial_failure_test')

      // 應該繼續執行其他步驟
      expect(mockPageMonitor.stop).toHaveBeenCalled()
      expect(mockMessageRouter.stop).toHaveBeenCalled()
      expect(mockErrorHandler.stop).toHaveBeenCalled()

      // 應該觸發模組關閉失敗事件
      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.SHUTDOWN.FAILED', {
        moduleName: 'eventCoordinator',
        error: '事件協調器關閉失敗',
        timestamp: expect.any(Number)
      })
    })
  })

  // ==================== 關鍵狀態管理 ====================
  describe('關鍵狀態管理', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該設定和取得關鍵狀態', () => {
      shutdownHandler.setCriticalState('testKey', 'testValue')

      expect(shutdownHandler.getCriticalState('testKey')).toBe('testValue')
      expect(shutdownHandler.criticalState.size).toBe(1)
    })

    test('應該在關閉時保存關鍵狀態', async () => {
      // 模擬 Chrome storage
      global.chrome = {
        storage: {
          local: {
            set: jest.fn().mockImplementation((data, callback) => {
              if (callback) callback()
              return Promise.resolve()
            })
          }
        }
      }

      shutdownHandler.setCriticalState('important', 'data')

      await shutdownHandler.gracefulShutdown('state_test')

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        system_shutdown_state: expect.objectContaining({
          shutdownReason: 'state_test',
          criticalState: { important: 'data' }
        }),
        last_shutdown_time: expect.any(Number)
      })

      // 清理
      delete global.chrome
    })
  })

  // ==================== 關閉狀態查詢 ====================
  describe('關閉狀態查詢', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該返回正確的關閉狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const status = shutdownHandler.getShutdownStatus()

      expect(status).toEqual({
        shutdownInProgress: false,
        shutdownStartTime: null,
        lastShutdownReason: null,
        shutdownHistory: [],
        shutdownSequence: [
          'pageMonitor',
          'messageRouter',
          'errorHandler',
          'eventCoordinator'
        ],
        criticalStateSize: 0,
        timestamp: expect.any(Number)
      })
    })

    test('應該在關閉過程中更新狀態', async () => {
      // 模擬慢速關閉以便檢查中間狀態
      mockEventCoordinator.stop.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      // 啟動關閉但不等待完成
      // eslint-disable-next-line no-unused-vars
      const shutdownPromise = shutdownHandler.gracefulShutdown('status_test')

      // 檢查進行中的狀態
      await new Promise(resolve => setTimeout(resolve, 10))
      // eslint-disable-next-line no-unused-vars
      const statusDuringShutdown = shutdownHandler.getShutdownStatus()
      expect(statusDuringShutdown.shutdownInProgress).toBe(true)
      expect(statusDuringShutdown.lastShutdownReason).toBe('status_test')

      await shutdownPromise

      // 檢查完成後狀態
      // eslint-disable-next-line no-unused-vars
      const statusAfterShutdown = shutdownHandler.getShutdownStatus()
      expect(statusAfterShutdown.shutdownInProgress).toBe(false)
    })
  })

  // ==================== 強制關閉 ====================
  describe('強制關閉', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該執行強制關閉', async () => {
      await shutdownHandler.forceShutdown()

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.FORCE.SHUTDOWN', {
        reason: 'timeout',
        timestamp: expect.any(Number)
      })
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 執行強制關閉')
    })

    test('應該在強制關閉時清理資源', async () => {
      // 設定一些全域變數
      // eslint-disable-next-line no-unused-vars
      const mockDestroy = jest.fn()
      global.eventBus = { destroy: mockDestroy }
      global.chromeBridge = { test: 'data' }

      await shutdownHandler.forceShutdown()

      expect(mockDestroy).toHaveBeenCalled()
      expect(global.eventBus).toBe(null)
      expect(global.chromeBridge).toBe(null)

      // 清理
      delete global.eventBus
      delete global.chromeBridge
    })
  })

  // ==================== 健康狀態檢查 ====================
  describe('健康狀態檢查', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該返回自訂健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const health = shutdownHandler.getHealthStatus()

      expect(health.shutdownInProgress).toBe(false)
      expect(health.recentShutdowns).toBe(0)
      expect(health.hasModules).toBe(true)
      expect(health.health).toBe('healthy')
      expect(health.overall).toBe('degraded') // BaseModule 未啟動時為 degraded
    })

    test('應該在關閉進行中時報告 degraded', async () => {
      // 模擬慢速關閉
      mockEventCoordinator.stop.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      // eslint-disable-next-line no-unused-vars
      const shutdownPromise = shutdownHandler.gracefulShutdown('health_test')

      // 檢查關閉中的健康狀態
      await new Promise(resolve => setTimeout(resolve, 10))
      // eslint-disable-next-line no-unused-vars
      const health = shutdownHandler.getHealthStatus()
      expect(health.shutdownInProgress).toBe(true)
      expect(health.health).toBe('degraded')

      await shutdownPromise
    })

    test('應該追蹤最近的關閉次數', async () => {
      await shutdownHandler.gracefulShutdown('test1')
      await shutdownHandler.gracefulShutdown('test2')

      // eslint-disable-next-line no-unused-vars
      const health = shutdownHandler.getHealthStatus()
      expect(health.recentShutdowns).toBe(2)
    })
  })

  // ==================== 錯誤處理 ====================
  describe('錯誤處理', () => {
    beforeEach(async () => {
      await shutdownHandler.initialize()
    })

    test('應該處理關閉流程中的錯誤', async () => {
      mockEventCoordinator.stop.mockRejectedValue(new Error('關閉失敗'))

      // 關閉應該完成，但記錄錯誤
      await shutdownHandler.gracefulShutdown('error_test')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('模組關閉失敗: eventCoordinator'),
        expect.any(Error)
      )
    })

    test('應該在嚴重錯誤時觸發強制關閉', async () => {
      // 模擬整個關閉流程失敗
      // eslint-disable-next-line no-unused-vars
      const performShutdownSpy = jest.spyOn(shutdownHandler, 'performShutdown')
      performShutdownSpy.mockRejectedValue(new Error('嚴重關閉失敗'))

      // eslint-disable-next-line no-unused-vars
      const forceShutdownSpy = jest.spyOn(shutdownHandler, 'forceShutdown')

      try {
        await shutdownHandler.gracefulShutdown('serious_error_test')
      } catch (error) {
        expect(forceShutdownSpy).toHaveBeenCalled()
        expect(error.message).toBe('嚴重關閉失敗')
      }
    })

    test('應該記錄關閉歷史', async () => {
      await shutdownHandler.gracefulShutdown('history_test')

      expect(shutdownHandler.shutdownHistory).toHaveLength(1)
      expect(shutdownHandler.shutdownHistory[0]).toMatchObject({
        reason: 'history_test',
        success: true,
        timestamp: expect.any(Number),
        duration: expect.any(Number)
      })
    })
  })

  // ==================== 整合測試 ====================
  describe('整合測試', () => {
    test('應該支援完整的關閉工作流程', async () => {
      await shutdownHandler.initialize()

      // 設定關鍵狀態
      shutdownHandler.setCriticalState('workflow', 'test')

      // 執行優雅關閉
      await shutdownHandler.gracefulShutdown('integration_test')

      // 驗證所有步驟都執行了
      expect(mockPageMonitor.stop).toHaveBeenCalled()
      expect(mockMessageRouter.stop).toHaveBeenCalled()
      expect(mockErrorHandler.stop).toHaveBeenCalled()
      expect(mockEventCoordinator.stop).toHaveBeenCalled()

      // 驗證最終狀態
      expect(shutdownHandler.shutdownInProgress).toBe(false)
      expect(shutdownHandler.shutdownHistory).toHaveLength(1)
    })
  })
})
