/**
 * InstallHandler 單元測試
 *
 * 測試範圍：
 * - 基本建構和初始化
 * - 安裝事件處理
 * - 更新事件處理
 * - 預設配置設定
 * - 版本遷移處理
 * - Chrome API 相容性檢查
 * - 錯誤處理和復原
 */

// eslint-disable-next-line no-unused-vars
const InstallHandler = require('src/background/lifecycle/install-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('InstallHandler', () => {
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger
  // eslint-disable-next-line no-unused-vars
  let mockStorageService
  // eslint-disable-next-line no-unused-vars
  let mockConfigService
  // eslint-disable-next-line no-unused-vars
  let mockMigrationService
  // eslint-disable-next-line no-unused-vars
  let mockChrome
  let dependencies
  let installHandler

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

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue()
    }

    mockConfigService = {
      initialize: jest.fn().mockResolvedValue()
    }

    mockMigrationService = {
      initialize: jest.fn().mockResolvedValue(),
      migrate: jest.fn().mockResolvedValue()
    }

    // 模擬 Chrome API
    mockChrome = {
      storage: {
        local: {
          set: jest.fn().mockImplementation((data, callback) => {
            if (callback) callback()
            return Promise.resolve()
          }),
          get: jest.fn().mockImplementation((keys, callback) => {
            if (callback) callback({})
            return Promise.resolve({})
          })
        }
      },
      tabs: {},
      runtime: {
        getManifest: jest.fn().mockReturnValue({
          version: '1.0.0',
          manifest_version: 3
        })
      }
    }

    global.chrome = mockChrome

    dependencies = {
      eventBus: mockEventBus,
      logger: mockLogger,
      storageService: mockStorageService,
      configService: mockConfigService,
      migrationService: mockMigrationService
    }

    installHandler = new InstallHandler(dependencies)
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.chrome
  })

  // ==================== 基本建構和初始化 ====================
  describe('基本建構和初始化', () => {
    test('應該正確建構 InstallHandler 實例', () => {
      expect(installHandler).toBeInstanceOf(InstallHandler)
      expect(installHandler.moduleName).toBe('InstallHandler')
      expect(installHandler.storageService).toBe(mockStorageService)
      expect(installHandler.migrationService).toBe(mockMigrationService)
    })

    test('應該初始化安裝狀態', () => {
      expect(installHandler.installationInProgress).toBe(false)
      expect(installHandler.lastInstallDetails).toBe(null)
      expect(installHandler.installationStartTime).toBe(null)
    })

    test('應該設定預設配置', () => {
      expect(installHandler.defaultConfig).toEqual({
        isEnabled: true,
        extractionSettings: {
          autoExtract: false,
          progressTracking: true,
          dataValidation: true
        },
        version: null
      })
    })
  })

  // ==================== 初始化方法 ====================
  describe('初始化方法', () => {
    test('應該正確初始化安裝處理器', async () => {
      await installHandler.initialize()

      expect(installHandler.isInitialized).toBe(true)
      expect(mockLogger.log).toHaveBeenCalledWith('📦 初始化安裝處理器')
      expect(mockLogger.log).toHaveBeenCalledWith('✅ 安裝處理器初始化完成')
    })

    test('應該設定版本號', async () => {
      await installHandler.initialize()

      expect(installHandler.defaultConfig.version).toBe('1.0.0')
    })

    test('應該初始化相關服務', async () => {
      await installHandler.initialize()

      expect(mockStorageService.initialize).toHaveBeenCalled()
      expect(mockConfigService.initialize).toHaveBeenCalled()
      expect(mockMigrationService.initialize).toHaveBeenCalled()
    })
  })

  // ==================== Chrome API 相容性檢查 ====================
  describe('Chrome API 相容性檢查', () => {
    test('應該通過完整的 API 相容性檢查', async () => {
      await installHandler.checkCompatibility()

      expect(mockLogger.log).toHaveBeenCalledWith('✅ 相容性檢查通過')
    })

    test('應該檢測缺少的 Chrome API', async () => {
      // 移除一個必要的 API
      delete mockChrome.storage

      await expect(installHandler.checkCompatibility()).rejects.toMatchObject({
        code: ErrorCodes.CHROME_ERROR,
        message: expect.stringContaining('缺少必要的 Chrome API: storage'),
        details: expect.objectContaining({
          category: 'general',
          component: 'InstallHandler',
          missingAPIs: ['storage']
        })
      })
    })

    test('應該檢測多個缺少的 API', async () => {
      delete mockChrome.storage
      delete mockChrome.tabs

      await expect(installHandler.checkCompatibility()).rejects.toMatchObject({
        details: expect.objectContaining({
          missingAPIs: ['storage', 'tabs']
        })
      })
    })

    test('應該警告非 Manifest V3 環境', async () => {
      mockChrome.runtime.getManifest.mockReturnValue({
        version: '1.0.0',
        manifest_version: 2
      })

      await installHandler.checkCompatibility()

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 非 Manifest V3 環境')
    })
  })

  // ==================== 安裝事件處理 ====================
  describe('安裝事件處理', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該處理新安裝事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const installDetails = {
        reason: 'install',
        previousVersion: undefined
      }

      await installHandler.handleInstall(installDetails)

      expect(installHandler.lastInstallDetails).toBe(installDetails)
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isEnabled: true,
          extractionSettings: expect.objectContaining({
            autoExtract: false,
            progressTracking: true,
            dataValidation: true
          }),
          version: '1.0.0'
        })
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.FIRST.INSTALL', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALLED', expect.any(Object))
    })

    test('應該處理擴展更新事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const updateDetails = {
        reason: 'update',
        previousVersion: '0.9.0'
      }

      await installHandler.handleInstall(updateDetails)

      expect(mockMigrationService.migrate).toHaveBeenCalledWith('0.9.0', '1.0.0')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.UPDATED', expect.any(Object))
    })

    test('應該處理 Chrome 更新事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const chromeUpdateDetails = {
        reason: 'chrome_update',
        previousVersion: undefined
      }

      await installHandler.handleInstall(chromeUpdateDetails)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.CHROME.UPDATED', expect.any(Object))
      expect(mockLogger.log).toHaveBeenCalledWith('✅ Chrome 瀏覽器更新處理完成')
    })

    test('應該處理共享模組更新事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const sharedModuleUpdateDetails = {
        reason: 'shared_module_update',
        previousVersion: undefined
      }

      await installHandler.handleInstall(sharedModuleUpdateDetails)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.SHARED.MODULE.UPDATED', expect.any(Object))
      expect(mockLogger.log).toHaveBeenCalledWith('✅ 共享模組更新處理完成')
    })

    test('應該處理未知安裝原因', async () => {
      // eslint-disable-next-line no-unused-vars
      const unknownDetails = {
        reason: 'unknown_reason',
        previousVersion: undefined
      }

      await installHandler.handleInstall(unknownDetails)

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 未知的安裝原因: unknown_reason')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.UNKNOWN.INSTALL', expect.any(Object))
    })

    test('應該防止重複安裝處理', async () => {
      // eslint-disable-next-line no-unused-vars
      const installDetails = { reason: 'install' }

      // 啟動第一個安裝
      // eslint-disable-next-line no-unused-vars
      const firstInstall = installHandler.handleInstall(installDetails)

      // 嘗試第二個安裝
      await installHandler.handleInstall(installDetails)

      await firstInstall

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 安裝處理已在進行中，跳過重複處理')
    })

    test('應該觸發安裝完成事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const installDetails = { reason: 'install' }

      await installHandler.handleInstall(installDetails)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALLED', {
        reason: 'install',
        previousVersion: undefined,
        version: '1.0.0',
        duration: expect.any(Number),
        timestamp: expect.any(Number)
      })
    })
  })

  // ==================== 預設配置設定 ====================
  describe('預設配置設定', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該設定預設配置', async () => {
      await installHandler.setupDefaultConfiguration()

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        isEnabled: true,
        extractionSettings: {
          autoExtract: false,
          progressTracking: true,
          dataValidation: true
        },
        version: '1.0.0'
      })
    })

    test('應該驗證配置設定', async () => {
      await installHandler.setupDefaultConfiguration()

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        'isEnabled',
        'extractionSettings',
        'version'
      ])
    })

    test('應該處理配置設定錯誤', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('儲存失敗'))

      await expect(installHandler.setupDefaultConfiguration()).rejects.toMatchObject(expect.objectContaining({ message: '儲存失敗' }))
      expect(mockLogger.error).toHaveBeenCalledWith('❌ 設定預設配置失敗:', expect.any(Error))
    })
  })

  // ==================== 儲存系統初始化 ====================
  describe('儲存系統初始化', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該初始化儲存結構', async () => {
      await installHandler.initializeStorage()

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        readmoo_books: null,
        extraction_history: [],
        last_extraction: null
      })
    })

    test('應該跳過已存在的儲存項目', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        if (callback) {
          callback({
            readmoo_books: 'existing_data',
            extraction_history: ['some_history']
          })
        }
        return Promise.resolve({
          readmoo_books: 'existing_data',
          extraction_history: ['some_history']
        })
      })

      await installHandler.initializeStorage()

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        last_extraction: null
      })
    })

    test('應該處理儲存初始化錯誤', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('儲存初始化失敗'))

      await expect(installHandler.initializeStorage()).rejects.toMatchObject(expect.objectContaining({ message: '儲存初始化失敗' }))
      expect(mockLogger.error).toHaveBeenCalledWith('❌ 初始化儲存系統失敗:', expect.any(Error))
    })
  })

  // ==================== 版本遷移處理 ====================
  describe('版本遷移處理', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該執行版本遷移', async () => {
      // eslint-disable-next-line no-unused-vars
      const updateDetails = {
        reason: 'update',
        previousVersion: '0.9.0'
      }

      await installHandler.handleUpdate(updateDetails)

      expect(mockMigrationService.migrate).toHaveBeenCalledWith('0.9.0', '1.0.0')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.UPDATED', {
        previousVersion: '0.9.0',
        currentVersion: '1.0.0',
        timestamp: expect.any(Number)
      })
    })

    test('應該更新配置版本號', async () => {
      await installHandler.updateConfigurationVersion()

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        version: '1.0.0'
      })
    })

    test('應該處理遷移錯誤', async () => {
      mockMigrationService.migrate.mockRejectedValue(new Error('遷移失敗'))

      // eslint-disable-next-line no-unused-vars
      const updateDetails = {
        reason: 'update',
        previousVersion: '0.9.0'
      }

      await expect(installHandler.handleUpdate(updateDetails)).rejects.toMatchObject(expect.objectContaining({ message: '遷移失敗' }))
    })
  })

  // ==================== 服務重新初始化 ====================
  describe('服務重新初始化', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該重新初始化所有服務', async () => {
      await installHandler.reinitializeServices()

      expect(mockStorageService.initialize).toHaveBeenCalled()
      expect(mockConfigService.initialize).toHaveBeenCalled()
      expect(mockMigrationService.initialize).toHaveBeenCalled()
    })

    test('應該處理服務重新初始化錯誤', async () => {
      mockStorageService.initialize.mockRejectedValue(new Error('服務初始化失敗'))

      await expect(installHandler.reinitializeServices()).rejects.toMatchObject(expect.objectContaining({ message: '服務初始化失敗' }))
      expect(mockLogger.error).toHaveBeenCalledWith('❌ 服務重新初始化失敗:', expect.any(Error))
    })
  })

  // ==================== 安裝狀態查詢 ====================
  describe('安裝狀態查詢', () => {
    test('應該返回正確的安裝狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const status = installHandler.getInstallStatus()

      expect(status).toEqual({
        installationInProgress: false,
        lastInstallDetails: null,
        installationStartTime: null,
        defaultConfig: {
          isEnabled: true,
          extractionSettings: {
            autoExtract: false,
            progressTracking: true,
            dataValidation: true
          },
          version: null
        },
        timestamp: expect.any(Number)
      })
    })

    test('應該在安裝過程中更新狀態', async () => {
      await installHandler.initialize()

      // 模擬慢速安裝以便檢查中間狀態
      mockChrome.storage.local.set.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      // eslint-disable-next-line no-unused-vars
      const installDetails = { reason: 'install' }
      // eslint-disable-next-line no-unused-vars
      const installPromise = installHandler.handleInstall(installDetails)

      // 檢查進行中的狀態
      await new Promise(resolve => setTimeout(resolve, 10))
      // eslint-disable-next-line no-unused-vars
      const statusDuringInstall = installHandler.getInstallStatus()
      expect(statusDuringInstall.installationInProgress).toBe(true)
      expect(statusDuringInstall.lastInstallDetails).toBe(installDetails)

      await installPromise

      // 檢查完成後狀態
      // eslint-disable-next-line no-unused-vars
      const statusAfterInstall = installHandler.getInstallStatus()
      expect(statusAfterInstall.installationInProgress).toBe(false)
    })
  })

  // ==================== 健康狀態檢查 ====================
  describe('健康狀態檢查', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該返回自訂健康狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const health = installHandler.getHealthStatus()

      expect(health.installationInProgress).toBe(false)
      expect(health.hasLastInstallDetails).toBe(false)
      expect(health.servicesAvailable).toBe(true)
      expect(health.health).toBe('healthy')
      expect(health.overall).toBe('degraded') // BaseModule 未啟動時為 degraded
    })

    test('應該在安裝進行中時報告 degraded', async () => {
      // 模擬慢速安裝
      mockChrome.storage.local.set.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      // eslint-disable-next-line no-unused-vars
      const installPromise = installHandler.handleInstall({ reason: 'install' })

      // 檢查安裝中的健康狀態
      await new Promise(resolve => setTimeout(resolve, 10))
      // eslint-disable-next-line no-unused-vars
      const health = installHandler.getHealthStatus()
      expect(health.installationInProgress).toBe(true)
      expect(health.health).toBe('degraded')

      await installPromise
    })

    test('應該檢測服務可用性', () => {
      // eslint-disable-next-line no-unused-vars
      const handlerWithoutServices = new InstallHandler({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      // eslint-disable-next-line no-unused-vars
      const health = handlerWithoutServices.getHealthStatus()
      expect(health.servicesAvailable).toBe(false)
    })
  })

  // ==================== 錯誤處理 ====================
  describe('錯誤處理', () => {
    beforeEach(async () => {
      await installHandler.initialize()
    })

    test('應該處理安裝過程中的錯誤', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('儲存失敗'))

      // eslint-disable-next-line no-unused-vars
      const installDetails = { reason: 'install' }

      await expect(installHandler.handleInstall(installDetails)).rejects.toMatchObject(expect.objectContaining({ message: '儲存失敗' }))

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALL.FAILED', {
        reason: 'install',
        error: '儲存失敗',
        timestamp: expect.any(Number)
      })
    })

    test('應該清理安裝狀態', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('儲存失敗'))

      try {
        await installHandler.handleInstall({ reason: 'install' })
      } catch (error) {
        // 預期的錯誤
      }

      expect(installHandler.installationInProgress).toBe(false)
      expect(installHandler.installationStartTime).toBe(null)
    })
  })

  // ==================== Chrome Extension 整合 ====================
  describe('Chrome Extension 整合', () => {
    test('應該處理 Chrome Runtime 安裝事件', async () => {
      await installHandler.initialize()

      // eslint-disable-next-line no-unused-vars
      const installDetails = {
        reason: 'install',
        previousVersion: undefined
      }

      await installHandler.handleInstall(installDetails)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALLED', expect.any(Object))
    })

    test('應該正確讀取 Manifest 版本', async () => {
      await installHandler.initialize()

      expect(installHandler.defaultConfig.version).toBe('1.0.0')
    })

    test('應該處理 Manifest 讀取錯誤', async () => {
      mockChrome.runtime.getManifest.mockReturnValue(null)

      // 應該拋出錯誤當 manifest 為 null
      await expect(installHandler.initialize()).rejects.toMatchObject({
        code: ErrorCodes.CHROME_ERROR,
        message: '無法取得 Chrome Extension Manifest',
        details: expect.objectContaining({
          category: 'general',
          component: 'InstallHandler',
          operation: 'getManifest'
        })
      })

      expect(installHandler.isInitialized).toBe(false)
    })
  })

  // ==================== 整合測試 ====================
  describe('整合測試', () => {
    test('應該執行完整的安裝流程', async () => {
      // eslint-disable-next-line no-unused-vars
      const installDetails = {
        reason: 'install',
        previousVersion: undefined
      }

      await installHandler.initialize()
      await installHandler.handleInstall(installDetails)

      // 驗證所有主要步驟
      expect(mockChrome.storage.local.set).toHaveBeenCalled() // 預設配置
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.FIRST.INSTALL', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALLED', expect.any(Object))
      expect(installHandler.installationInProgress).toBe(false)
    })

    test('應該執行完整的更新流程', async () => {
      // eslint-disable-next-line no-unused-vars
      const updateDetails = {
        reason: 'update',
        previousVersion: '0.9.0'
      }

      await installHandler.initialize()
      await installHandler.handleInstall(updateDetails)

      // 驗證更新特定步驟
      expect(mockMigrationService.migrate).toHaveBeenCalledWith('0.9.0', '1.0.0')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.UPDATED', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenCalledWith('SYSTEM.INSTALLED', expect.any(Object))
      expect(installHandler.installationInProgress).toBe(false)
    })
  })
})
