/**
 * BaseModule 單元測試
 *
 * 測試範圍：
 * - 基本建構和初始化
 * - 生命週期方法 (initialize, start, stop, cleanup)
 * - 錯誤處理和驗證
 * - 健康狀態檢查
 * - 依賴注入功能
 */

const BaseModule = require('src/background/lifecycle/base-module')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('BaseModule', () => {
  let mockEventBus
  let mockLogger
  let mockConfig
  let dependencies
  let baseModule

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

    mockConfig = {
      moduleEnabled: true,
      timeout: 5000,
      retryCount: 3
    }

    dependencies = {
      eventBus: mockEventBus,
      logger: mockLogger,
      config: mockConfig
    }

    baseModule = new BaseModule(dependencies)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ==================== 基本建構和初始化 ====================
  describe('基本建構和初始化', () => {
    test('應該正確建構 BaseModule 實例', () => {
      expect(baseModule).toBeInstanceOf(BaseModule)
      expect(baseModule.eventBus).toBe(mockEventBus)
      expect(baseModule.logger).toBe(mockLogger)
      expect(baseModule.config).toBe(mockConfig)
    })

    test('應該設定正確的模組名稱和ID', () => {
      expect(baseModule.moduleName).toBe('BaseModule')
      expect(baseModule.moduleId).toMatch(/^BaseModule_\d+_[a-z0-9]+$/)
    })

    test('應該初始化為未啟動狀態', () => {
      expect(baseModule.isInitialized).toBe(false)
      expect(baseModule.isRunning).toBe(false)
      expect(baseModule.initializationError).toBe(null)
    })

    test('應該使用預設的 console 當 logger 未提供', () => {
      const moduleWithoutLogger = new BaseModule({ eventBus: mockEventBus })
      expect(moduleWithoutLogger.logger).toBe(console)
    })

    test('應該允許空的依賴項', () => {
      const moduleWithEmptyDeps = new BaseModule()
      expect(moduleWithEmptyDeps.eventBus).toBe(null)
      expect(moduleWithEmptyDeps.logger).toBe(console)
      expect(moduleWithEmptyDeps.config).toEqual({})
    })
  })

  // ==================== 初始化方法 ====================
  describe('初始化方法', () => {
    test('應該正確執行基本初始化', async () => {
      await baseModule.initialize()

      expect(baseModule.isInitialized).toBe(true)
      expect(baseModule.initializationError).toBe(null)
      expect(mockLogger.log).toHaveBeenCalledWith('✅ BaseModule 模組初始化完成')
    })

    test('應該防止重複初始化', async () => {
      await baseModule.initialize()
      const firstState = baseModule.isInitialized

      await baseModule.initialize()
      expect(baseModule.isInitialized).toBe(firstState)
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ BaseModule 模組已初始化，跳過重複初始化')
    })

    test('應該處理初始化錯誤', async () => {
      // 模擬初始化失敗
      baseModule._doInitialize = jest.fn().mockRejectedValue(new Error('初始化失敗'))

      await expect(baseModule.initialize()).rejects.toThrow('初始化失敗')
      expect(baseModule.isInitialized).toBe(false)
      expect(baseModule.initializationError).toEqual(expect.any(Error))
    })

    test('應該觸發初始化完成事件', async () => {
      await baseModule.initialize()

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.INITIALIZED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number)
      })
    })

    test('應該觸發初始化失敗事件', async () => {
      baseModule._doInitialize = jest.fn().mockRejectedValue(new Error('初始化失敗'))

      try {
        await baseModule.initialize()
      } catch (error) {
        // 預期的錯誤
      }

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.INITIALIZATION.FAILED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        error: '初始化失敗',
        timestamp: expect.any(Number)
      })
    })
  })

  // ==================== 啟動方法 ====================
  describe('啟動方法', () => {
    test('應該拋出錯誤當模組未初始化時嘗試啟動', async () => {
      await expect(baseModule.start()).rejects.toMatchObject({
        code: ErrorCodes.SERVICE_INITIALIZATION_ERROR,
        message: 'BaseModule 模組尚未初始化，無法啟動',
        details: expect.objectContaining({
          category: 'general',
          component: 'BaseModule',
          moduleName: 'BaseModule'
        })
      })
    })

    test('應該正確啟動已初始化的模組', async () => {
      await baseModule.initialize()
      await baseModule.start()

      expect(baseModule.isRunning).toBe(true)
      expect(baseModule.startTime).toBeDefined()
      expect(mockLogger.log).toHaveBeenCalledWith('✅ BaseModule 模組啟動完成')
    })

    test('應該跳過重複啟動', async () => {
      await baseModule.initialize()
      await baseModule.start()
      const firstStartTime = baseModule.startTime

      await baseModule.start()
      expect(baseModule.startTime).toBe(firstStartTime)
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ BaseModule 模組已啟動，跳過重複啟動')
    })

    test('應該處理啟動錯誤', async () => {
      await baseModule.initialize()
      baseModule._doStart = jest.fn().mockRejectedValue(new Error('啟動失敗'))

      await expect(baseModule.start()).rejects.toThrow('啟動失敗')
      expect(baseModule.isRunning).toBe(false)
    })

    test('應該觸發啟動完成事件', async () => {
      await baseModule.initialize()
      await baseModule.start()

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.STARTED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number)
      })
    })

    test('應該觸發啟動失敗事件', async () => {
      await baseModule.initialize()
      baseModule._doStart = jest.fn().mockRejectedValue(new Error('啟動失敗'))

      try {
        await baseModule.start()
      } catch (error) {
        // 預期的錯誤
      }

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.START.FAILED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        error: '啟動失敗',
        timestamp: expect.any(Number)
      })
    })
  })

  // ==================== 停止方法 ====================
  describe('停止方法', () => {
    test('應該正確停止運行中的模組', async () => {
      await baseModule.initialize()
      await baseModule.start()
      await baseModule.stop()

      expect(baseModule.isRunning).toBe(false)
      expect(mockLogger.log).toHaveBeenCalledWith('✅ BaseModule 模組停止完成')
    })

    test('應該跳過停止未運行的模組', async () => {
      await baseModule.stop()
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ BaseModule 模組未啟動，跳過停止')
    })

    test('應該處理停止錯誤', async () => {
      await baseModule.initialize()
      await baseModule.start()
      baseModule._doStop = jest.fn().mockRejectedValue(new Error('停止失敗'))

      await expect(baseModule.stop()).rejects.toThrow('停止失敗')
    })

    test('應該觸發停止完成事件', async () => {
      await baseModule.initialize()
      await baseModule.start()
      await baseModule.stop()

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.STOPPED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number)
      })
    })

    test('應該觸發停止失敗事件', async () => {
      await baseModule.initialize()
      await baseModule.start()
      baseModule._doStop = jest.fn().mockRejectedValue(new Error('停止失敗'))

      try {
        await baseModule.stop()
      } catch (error) {
        // 預期的錯誤
      }

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.STOP.FAILED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        error: '停止失敗',
        timestamp: expect.any(Number)
      })
    })
  })

  // ==================== 健康狀態檢查 ====================
  describe('健康狀態檢查', () => {
    test('應該返回基本健康狀態', () => {
      const health = baseModule.getHealthStatus()

      expect(health).toEqual({
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        isInitialized: false,
        isRunning: false,
        hasInitializationError: false,
        initializationError: null,
        lastHealthCheck: expect.any(Number),
        uptime: 0,
        overall: 'unhealthy'
      })
    })

    test('應該計算正確的運行時間', async () => {
      await baseModule.initialize()
      await baseModule.start()

      // 等待一小段時間
      await new Promise(resolve => setTimeout(resolve, 10))

      const health = baseModule.getHealthStatus()
      expect(health.uptime).toBeGreaterThan(0)
      expect(health.isRunning).toBe(true)
      expect(health.overall).toBe('healthy')
    })

    test('應該正確報告模組狀態', async () => {
      await baseModule.initialize()
      const health = baseModule.getHealthStatus()

      expect(health.isInitialized).toBe(true)
      expect(health.isRunning).toBe(false)
      expect(health.overall).toBe('degraded')
    })

    test('應該在初始化錯誤時報告 unhealthy', async () => {
      baseModule._doInitialize = jest.fn().mockRejectedValue(new Error('初始化失敗'))

      try {
        await baseModule.initialize()
      } catch (error) {
        // 預期的錯誤
      }

      const health = baseModule.getHealthStatus()
      expect(health.hasInitializationError).toBe(true)
      expect(health.initializationError).toBe('初始化失敗')
      expect(health.overall).toBe('unhealthy')
    })
  })

  // ==================== 清理方法 ====================
  describe('清理方法', () => {
    test('應該正確清理模組資源', async () => {
      await baseModule.initialize()
      await baseModule.start()
      await baseModule.cleanup()

      expect(baseModule.isRunning).toBe(false)
      expect(baseModule.isInitialized).toBe(false)
      expect(mockLogger.log).toHaveBeenCalledWith('✅ BaseModule 模組清理完成')
    })

    test('應該清理運行時間統計', async () => {
      await baseModule.initialize()
      await baseModule.start()
      await baseModule.cleanup()

      const health = baseModule.getHealthStatus()
      expect(health.uptime).toBe(0)
    })

    test('應該處理清理錯誤', async () => {
      baseModule._doCleanup = jest.fn().mockRejectedValue(new Error('清理失敗'))

      await expect(baseModule.cleanup()).rejects.toThrow('清理失敗')
    })

    test('應該觸發清理完成事件', async () => {
      await baseModule.initialize()
      await baseModule.cleanup()

      expect(mockEventBus.emit).toHaveBeenCalledWith('MODULE.CLEANED', {
        moduleName: 'BaseModule',
        moduleId: expect.stringMatching(/^BaseModule_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number)
      })
    })

    test('應該在清理時先停止模組', async () => {
      await baseModule.initialize()
      await baseModule.start()

      const stopSpy = jest.spyOn(baseModule, 'stop')
      await baseModule.cleanup()

      expect(stopSpy).toHaveBeenCalled()
    })
  })

  // ==================== 抽象方法 ====================
  describe('抽象方法', () => {
    test('_doInitialize 方法應該可以被子類別覆寫', async () => {
      class TestModule extends BaseModule {
        async _doInitialize() {
          this.customInitialized = true
        }
      }

      const testModule = new TestModule(dependencies)
      await testModule.initialize()

      expect(testModule.customInitialized).toBe(true)
    })

    test('_doStart 方法應該可以被子類別覆寫', async () => {
      class TestModule extends BaseModule {
        async _doStart() {
          await super._doStart()
          this.customStarted = true
        }
      }

      const testModule = new TestModule(dependencies)
      await testModule.initialize()
      await testModule.start()

      expect(testModule.customStarted).toBe(true)
    })

    test('_doStop 方法應該可以被子類別覆寫', async () => {
      class TestModule extends BaseModule {
        async _doStop() {
          this.customStopped = true
        }
      }

      const testModule = new TestModule(dependencies)
      await testModule.initialize()
      await testModule.start()
      await testModule.stop()

      expect(testModule.customStopped).toBe(true)
    })

    test('_doCleanup 方法應該可以被子類別覆寫', async () => {
      class TestModule extends BaseModule {
        async _doCleanup() {
          this.customCleaned = true
        }
      }

      const testModule = new TestModule(dependencies)
      await testModule.cleanup()

      expect(testModule.customCleaned).toBe(true)
    })

    test('_getCustomHealthStatus 方法應該可以被子類別覆寫', () => {
      class TestModule extends BaseModule {
        _getCustomHealthStatus() {
          return { customHealth: 'excellent' }
        }
      }

      const testModule = new TestModule(dependencies)
      const health = testModule.getHealthStatus()

      expect(health.customHealth).toBe('excellent')
    })
  })

  // ==================== 錯誤處理 ====================
  describe('錯誤處理', () => {
    test('應該使用正確的錯誤格式', async () => {
      try {
        await baseModule.start() // 未初始化就啟動
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.SERVICE_INITIALIZATION_ERROR)
        expect(error.details).toMatchObject({
          category: 'general',
          component: 'BaseModule',
          moduleName: 'BaseModule'
        })
      }
    })
  })
})