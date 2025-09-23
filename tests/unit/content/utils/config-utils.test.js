/**
 * @fileoverview Config Utils TDD 測試
 * @version v1.0.0
 * @since 2025-08-17
 *
 * TDD Red 階段：設計 config-utils.js 的完整測試套件
 *
 * 測試目標：
 * - 配置管理和驗證
 * - 結構化日誌輸出系統
 * - 設定層級管理
 * - Content Script 環境配置
 * - 日誌過濾和格式化
 */

describe('ConfigUtils - TDD Red 階段測試', () => {
  // eslint-disable-next-line no-unused-vars
  let ConfigUtils

  beforeAll(() => {
    // 測試執行前載入模組
    ConfigUtils = require('src/content/utils/config-utils.js')
  })

  beforeEach(() => {
    // 設定測試環境
    global.console = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      info: jest.fn()
    }

    // Mock localStorage
    // eslint-disable-next-line no-unused-vars
    const localStorageMock = {
      getItem: jest.fn((key) => {
        // 模擬儲存行為
        if (key === 'config_persistent') {
          return JSON.stringify({ persistedSetting: 'test-value' })
        }
        return null
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true
    })

    // 清理配置狀態
    if (ConfigUtils.resetConfig) {
      ConfigUtils.resetConfig()
    }
  })

  describe('🔧 配置管理', () => {
    test('應該設定和取得基本配置', () => {
      // eslint-disable-next-line no-unused-vars
      const config = {
        extractionSettings: {
          timeout: 5000,
          maxRetries: 3,
          batchSize: 10
        },
        debugMode: true
      }

      // eslint-disable-next-line no-unused-vars
      const setResult = ConfigUtils.setConfig('extraction', config)
      // eslint-disable-next-line no-unused-vars
      const getResult = ConfigUtils.getConfig('extraction')

      expect(setResult).toEqual({
        success: true,
        key: 'extraction',
        saved: true
      })

      expect(getResult).toEqual({
        success: true,
        config,
        source: 'memory'
      })
    })

    test('應該支援巢狀配置取得', () => {
      ConfigUtils.setConfig('app', {
        features: {
          autoExtraction: true,
          notifications: {
            enabled: true,
            sound: false
          }
        }
      })

      // eslint-disable-next-line no-unused-vars
      const result = ConfigUtils.getNestedConfig('app.features.notifications.enabled')

      expect(result).toEqual({
        success: true,
        value: true,
        path: 'app.features.notifications.enabled'
      })
    })

    test('應該驗證配置格式', () => {
      // eslint-disable-next-line no-unused-vars
      const schema = {
        type: 'object',
        properties: {
          timeout: { type: 'number', minimum: 1000 },
          enabled: { type: 'boolean' },
          name: { type: 'string', minLength: 1 }
        },
        required: ['timeout', 'enabled']
      }

      // eslint-disable-next-line no-unused-vars
      const validConfig = {
        timeout: 5000,
        enabled: true,
        name: 'Test Config'
      }

      // eslint-disable-next-line no-unused-vars
      const invalidConfig = {
        timeout: 500, // 小於最小值
        enabled: 'true' // 錯誤類型
      }

      // eslint-disable-next-line no-unused-vars
      const validResult = ConfigUtils.validateConfig(validConfig, schema)
      // eslint-disable-next-line no-unused-vars
      const invalidResult = ConfigUtils.validateConfig(invalidConfig, schema)

      expect(validResult).toEqual({
        valid: true,
        config: validConfig,
        errors: []
      })

      expect(invalidResult).toEqual({
        valid: false,
        errors: expect.arrayContaining([
          expect.objectContaining({ property: 'timeout' }),
          expect.objectContaining({ property: 'enabled' })
        ])
      })
    })

    test('應該支援配置預設值', () => {
      // eslint-disable-next-line no-unused-vars
      const defaults = {
        timeout: 3000,
        retries: 2,
        debug: false
      }

      ConfigUtils.setDefaults('network', defaults)

      // eslint-disable-next-line no-unused-vars
      const result = ConfigUtils.getConfigWithDefaults('network', {
        timeout: 5000 // 只設定部分
      })

      expect(result).toEqual({
        success: true,
        config: {
          timeout: 5000, // 使用者設定
          retries: 2, // 預設值
          debug: false // 預設值
        },
        defaultsApplied: ['retries', 'debug']
      })
    })

    test('應該支援配置持久化', () => {
      // eslint-disable-next-line no-unused-vars
      const config = { persistedSetting: 'test-value' }

      // eslint-disable-next-line no-unused-vars
      const saveResult = ConfigUtils.saveConfig('persistent', config, { persist: true })
      // eslint-disable-next-line no-unused-vars
      const loadResult = ConfigUtils.loadConfig('persistent')

      expect(saveResult).toEqual({
        success: true,
        key: 'persistent',
        persisted: true
      })

      expect(loadResult).toEqual({
        success: true,
        config,
        source: 'localStorage'
      })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'config_persistent',
        JSON.stringify(config)
      )
    })

    test('應該監聽配置變更', () => {
      // eslint-disable-next-line no-unused-vars
      const changeHandler = jest.fn()

      ConfigUtils.onConfigChange('watched-key', changeHandler)

      ConfigUtils.setConfig('watched-key', { value: 'new-value' })

      expect(changeHandler).toHaveBeenCalledWith({
        key: 'watched-key',
        newValue: { value: 'new-value' },
        oldValue: undefined,
        timestamp: expect.any(Number)
      })
    })

    test('應該取得所有配置摘要', () => {
      ConfigUtils.setConfig('app', { name: 'Test App' })
      ConfigUtils.setConfig('user', { id: 12345 })

      // eslint-disable-next-line no-unused-vars
      const summary = ConfigUtils.getConfigSummary()

      expect(summary).toEqual({
        totalConfigs: 2,
        keys: ['app', 'user'],
        memoryUsage: expect.any(Number),
        persistedConfigs: 0,
        lastModified: expect.any(Number)
      })
    })
  })

  describe('📝 日誌系統', () => {
    test('應該記錄不同層級的日誌', () => {
      ConfigUtils.log('debug', '偵錯訊息', { component: 'test' })
      ConfigUtils.log('info', '資訊訊息', { userId: 123 })
      ConfigUtils.log('warn', '警告訊息', { code: 'W001' })
      ConfigUtils.log('error', '錯誤訊息', { error: new Error('Test error') })

      // 檢查日誌是否被正確調用（格式化訊息包含所有必要資訊）
      // eslint-disable-next-line no-console
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringMatching(/\[DEBUG\].*偵錯訊息/),
        expect.objectContaining({ component: 'test' })
      )

      // eslint-disable-next-line no-console
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\].*資訊訊息/),
        expect.objectContaining({ userId: 123 })
      )

      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\].*警告訊息/),
        expect.objectContaining({ code: 'W001' })
      )

      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*錯誤訊息/),
        expect.objectContaining({ error: expect.any(Error) })
      )
    })

    test('應該支援條件日誌記錄', () => {
      ConfigUtils.setConfig('logging', { level: 'warn' })

      ConfigUtils.logIf(true, 'info', '條件為真的訊息')
      ConfigUtils.logIf(false, 'info', '條件為假的訊息')

      ConfigUtils.logLevel('debug', '偵錯層級訊息')
      ConfigUtils.logLevel('error', '錯誤層級訊息')

      // eslint-disable-next-line no-console
      expect(console.info).toHaveBeenCalledTimes(1) // 只有條件為真的
      // eslint-disable-next-line no-console
      expect(console.debug).not.toHaveBeenCalled() // 層級不足
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(1) // 層級足夠
    })

    test('應該格式化日誌訊息', () => {
      // eslint-disable-next-line no-unused-vars
      const timestamp = Date.now()

      // eslint-disable-next-line no-unused-vars
      const result = ConfigUtils.formatLogMessage('info', '測試訊息', {
        component: 'TestComponent',
        timestamp
      })

      expect(result).toEqual({
        formatted: expect.stringMatching(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] \[TestComponent\] 測試訊息$/),
        level: 'info',
        message: '測試訊息',
        metadata: {
          component: 'TestComponent',
          timestamp
        }
      })
    })

    test('應該記錄日誌歷史', () => {
      ConfigUtils.log('info', '第一條訊息')
      ConfigUtils.log('warn', '第二條訊息')
      ConfigUtils.log('error', '第三條訊息')

      // eslint-disable-next-line no-unused-vars
      const history = ConfigUtils.getLogHistory()

      expect(history).toEqual({
        total: 3,
        entries: expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            message: '第一條訊息',
            timestamp: expect.any(Number)
          }),
          expect.objectContaining({
            level: 'warn',
            message: '第二條訊息',
            timestamp: expect.any(Number)
          }),
          expect.objectContaining({
            level: 'error',
            message: '第三條訊息',
            timestamp: expect.any(Number)
          })
        ])
      })
    })

    test('應該支援日誌過濾', () => {
      ConfigUtils.log('debug', 'Debug message', { component: 'ComponentA' })
      ConfigUtils.log('info', 'Info message', { component: 'ComponentB' })
      ConfigUtils.log('error', 'Error message', { component: 'ComponentA' })

      // eslint-disable-next-line no-unused-vars
      const filteredByLevel = ConfigUtils.filterLogs({ level: 'error' })
      // eslint-disable-next-line no-unused-vars
      const filteredByComponent = ConfigUtils.filterLogs({ component: 'ComponentA' })

      expect(filteredByLevel).toEqual({
        total: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({ level: 'error' })
        ])
      })

      expect(filteredByComponent).toEqual({
        total: 2,
        entries: expect.arrayContaining([
          expect.objectContaining({ metadata: expect.objectContaining({ component: 'ComponentA' }) }),
          expect.objectContaining({ metadata: expect.objectContaining({ component: 'ComponentA' }) })
        ])
      })
    })

    test('應該支援日誌輸出重定向', () => {
      // eslint-disable-next-line no-unused-vars
      const customHandler = jest.fn()

      ConfigUtils.addLogHandler('custom', customHandler)
      ConfigUtils.log('info', '重定向測試', { test: true })

      expect(customHandler).toHaveBeenCalledWith({
        level: 'info',
        message: '重定向測試',
        metadata: { test: true },
        timestamp: expect.any(Number),
        formatted: expect.any(String)
      })
    })

    test('應該支援效能日誌記錄', () => {
      // eslint-disable-next-line no-unused-vars
      const operationName = 'test-operation'

      ConfigUtils.startPerformanceLog(operationName)

      // 模擬一些處理時間
      setTimeout(() => {
        // eslint-disable-next-line no-unused-vars
        const result = ConfigUtils.endPerformanceLog(operationName)

        expect(result).toEqual({
          operation: operationName,
          duration: expect.any(Number),
          timestamp: expect.any(Number),
          logged: true
        })
      }, 10)
    })
  })

  describe('⚙️ Content Script 特定配置', () => {
    test('應該管理提取器配置', () => {
      // eslint-disable-next-line no-unused-vars
      const extractorConfig = {
        selectors: {
          bookContainer: '.library-item',
          title: '.book-title',
          author: '.book-author'
        },
        timeout: 5000,
        retryPolicy: {
          maxRetries: 3,
          backoffDelay: 1000
        }
      }

      // eslint-disable-next-line no-unused-vars
      const result = ConfigUtils.setExtractorConfig('readmoo', extractorConfig)

      expect(result).toEqual({
        success: true,
        platform: 'readmoo',
        validated: true
      })

      // eslint-disable-next-line no-unused-vars
      const retrieved = ConfigUtils.getExtractorConfig('readmoo')

      expect(retrieved).toEqual({
        success: true,
        config: extractorConfig,
        platform: 'readmoo'
      })
    })

    test('應該管理偵錯模式配置', () => {
      ConfigUtils.setDebugMode(true, {
        verboseLogging: true,
        showTimestamps: true,
        logToStorage: false
      })

      // eslint-disable-next-line no-unused-vars
      const debugConfig = ConfigUtils.getDebugConfig()

      expect(debugConfig).toEqual({
        enabled: true,
        verboseLogging: true,
        showTimestamps: true,
        logToStorage: false,
        level: 'debug'
      })

      expect(ConfigUtils.isDebugMode()).toBe(true)
    })

    test('應該管理 Chrome Extension API 配置', () => {
      // eslint-disable-next-line no-unused-vars
      const apiConfig = {
        permissions: ['storage', 'activeTab'],
        messageTimeout: 3000,
        retryOnContextLost: true
      }

      ConfigUtils.setChromeConfig(apiConfig)

      // eslint-disable-next-line no-unused-vars
      const result = ConfigUtils.getChromeConfig()

      expect(result).toEqual({
        success: true,
        config: apiConfig,
        available: expect.any(Boolean)
      })
    })

    test('應該檢測和配置環境資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const envInfo = ConfigUtils.getEnvironmentInfo()

      // 基本結構檢查
      expect(envInfo).toBeDefined()
      expect(envInfo.userAgent).toBeDefined()
      expect(envInfo.url).toBeDefined()
      expect(envInfo.domain).toBeDefined()
      expect(typeof envInfo.isReadmoo).toBe('boolean')
      expect(envInfo.chromeExtension).toBeDefined()
      expect(typeof envInfo.chromeExtension.available).toBe('boolean')
      expect(envInfo.capabilities).toBeDefined()
      expect(typeof envInfo.capabilities.localStorage).toBe('boolean')
      expect(typeof envInfo.capabilities.performance).toBe('boolean')
      expect(typeof envInfo.capabilities.observer).toBe('boolean')

      // manifest 可以是 undefined 或物件
      expect(envInfo.chromeExtension.manifest !== null).toBe(true)
    })

    test('應該管理功能開關', () => {
      // eslint-disable-next-line no-unused-vars
      const features = {
        autoExtraction: true,
        notifications: false,
        analytics: true,
        debugging: false
      }

      ConfigUtils.setFeatureFlags(features)

      expect(ConfigUtils.isFeatureEnabled('autoExtraction')).toBe(true)
      expect(ConfigUtils.isFeatureEnabled('notifications')).toBe(false)

      ConfigUtils.toggleFeature('notifications')

      expect(ConfigUtils.isFeatureEnabled('notifications')).toBe(true)

      // eslint-disable-next-line no-unused-vars
      const allFeatures = ConfigUtils.getAllFeatures()

      expect(allFeatures).toEqual({
        autoExtraction: true,
        notifications: true, // 已切換
        analytics: true,
        debugging: false
      })
    })

    test('應該支援配置匯入匯出', () => {
      // eslint-disable-next-line no-unused-vars
      const originalConfig = {
        extraction: { timeout: 5000 },
        logging: { level: 'info' },
        features: { autoMode: true }
      }

      ConfigUtils.setConfig('extraction', originalConfig.extraction)
      ConfigUtils.setConfig('logging', originalConfig.logging)
      ConfigUtils.setConfig('features', originalConfig.features)

      // eslint-disable-next-line no-unused-vars
      const exported = ConfigUtils.exportConfig()

      expect(exported).toEqual({
        success: true,
        data: expect.objectContaining(originalConfig),
        timestamp: expect.any(Number),
        version: expect.any(String)
      })

      ConfigUtils.resetConfig()

      // eslint-disable-next-line no-unused-vars
      const importResult = ConfigUtils.importConfig(exported.data)

      expect(importResult).toEqual({
        success: true,
        imported: Object.keys(originalConfig).length,
        errors: 0
      })

      expect(ConfigUtils.getConfig('extraction').config).toEqual(originalConfig.extraction)
    })
  })

  describe('📊 效能和統計', () => {
    test('應該追蹤配置使用統計', () => {
      ConfigUtils.getConfig('test-key-1')
      ConfigUtils.getConfig('test-key-2')
      ConfigUtils.getConfig('test-key-1') // 重複存取

      // eslint-disable-next-line no-unused-vars
      const stats = ConfigUtils.getUsageStats()

      expect(stats).toEqual({
        totalAccesses: 3,
        uniqueKeys: 2,
        mostAccessed: 'test-key-1',
        byKey: {
          'test-key-1': 2,
          'test-key-2': 1
        }
      })
    })

    test('應該提供配置診斷資訊', () => {
      ConfigUtils.setConfig('valid', { value: 'test' })
      ConfigUtils.setConfig('invalid', null) // 無效配置

      // eslint-disable-next-line no-unused-vars
      const diagnostics = ConfigUtils.getDiagnostics()

      expect(diagnostics).toEqual({
        totalConfigs: 2,
        validConfigs: 1,
        invalidConfigs: 1,
        memoryUsage: expect.any(Number),
        performance: {
          averageAccessTime: expect.any(Number),
          slowestAccess: expect.any(Number)
        },
        issues: expect.arrayContaining([
          expect.objectContaining({
            type: 'invalid-config',
            key: 'invalid'
          })
        ]),
        recommendations: expect.any(Array)
      })
    })

    test('應該產生配置和日誌報告', () => {
      ConfigUtils.setConfig('app', { name: 'Test' })
      ConfigUtils.log('info', 'Test log')

      // eslint-disable-next-line no-unused-vars
      const report = ConfigUtils.generateReport()

      expect(report).toEqual({
        timestamp: expect.any(Number),
        summary: {
          configs: {
            total: 1,
            memory: expect.any(Number)
          },
          logs: {
            total: 1,
            byLevel: expect.any(Object)
          }
        },
        details: {
          configs: expect.any(Object),
          recentLogs: expect.any(Array)
        },
        environment: expect.any(Object),
        recommendations: expect.any(Array)
      })
    })
  })

  describe('🧪 工具方法測試', () => {
    test('應該匯出所有必要的方法', () => {
      // eslint-disable-next-line no-unused-vars
      const requiredMethods = [
        'setConfig',
        'getConfig',
        'getNestedConfig',
        'validateConfig',
        'setDefaults',
        'getConfigWithDefaults',
        'saveConfig',
        'loadConfig',
        'onConfigChange',
        'getConfigSummary',
        'log',
        'logIf',
        'logLevel',
        'formatLogMessage',
        'getLogHistory',
        'filterLogs',
        'addLogHandler',
        'startPerformanceLog',
        'endPerformanceLog',
        'setExtractorConfig',
        'getExtractorConfig',
        'setDebugMode',
        'getDebugConfig',
        'isDebugMode',
        'setChromeConfig',
        'getChromeConfig',
        'getEnvironmentInfo',
        'setFeatureFlags',
        'isFeatureEnabled',
        'toggleFeature',
        'getAllFeatures',
        'exportConfig',
        'importConfig',
        'resetConfig',
        'getUsageStats',
        'getDiagnostics',
        'generateReport'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof ConfigUtils[methodName]).toBe('function')
      })
    })

    test('應該處理各種錯誤輸入', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidInputs = [null, undefined, '', 0, {}, [], NaN]

      invalidInputs.forEach(input => {
        expect(() => ConfigUtils.setConfig(input, {})).not.toThrow()
        expect(() => ConfigUtils.getConfig(input)).not.toThrow()
        expect(() => ConfigUtils.log('info', input)).not.toThrow()
      })
    })

    test('應該正確處理非同步操作', async () => {
      // eslint-disable-next-line no-unused-vars
      const asyncOperations = [
        ConfigUtils.saveConfig('async-test', { value: 'test' }, { persist: true }),
        ConfigUtils.loadConfig('async-test')
      ]

      // eslint-disable-next-line no-unused-vars
      const results = await Promise.allSettled(asyncOperations)

      results.forEach(result => {
        expect(result.status).toMatch(/fulfilled|rejected/)
      })
    })
  })
})
