/**
 * ChromeApiWrapper 單元測試
 *
 * 測試覆蓋率目標：
 * 1. Chrome API 可用性檢查錯誤處理
 * 2. API 路徑不存在錯誤處理
 * 3. chrome.runtime.lastError 處理
 * 4. API 函數類型錯誤處理
 * 5. 重試邏輯驗證
 * 6. Manifest V3 版本相容性檢查
 */

const ChromeApiWrapper = require('src/background/messaging/chrome-api-wrapper')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { StandardError } = require('src/core/errors/StandardError')

describe('ChromeApiWrapper', () => {
  let chromeApiWrapper
  let mockChrome
  let mockLogger

  beforeEach(async () => {
    // Mock Chrome APIs
    mockChrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        create: jest.fn(),
        sendMessage: jest.fn()
      },
      runtime: {
        getManifest: jest.fn().mockReturnValue({ manifest_version: 3 }),
        lastError: null,
        sendMessage: jest.fn()
      },
      notifications: {
        create: jest.fn(),
        clear: jest.fn()
      }
    }

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    }

    // 設置全域 chrome 物件
    global.chrome = mockChrome

    chromeApiWrapper = new ChromeApiWrapper({ logger: mockLogger })

    // 初始化模組 (避免使用實際的 Chrome 環境檢查)
    await chromeApiWrapper._doInitialize()
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.chrome
  })

  describe('Chrome API 可用性檢查', () => {
    test('應該在缺少必要 API 時拋出 CHROME_ERROR', async () => {
      // 移除必要的 API
      delete global.chrome.storage

      await expect(chromeApiWrapper.checkChromeApiAvailability())
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: expect.stringContaining('缺少必要的 Chrome API: storage'),
          details: {
            category: 'chrome-api',
            missingApis: ['storage']
          }
        })
    })

    test('應該在多個 API 缺少時列出所有缺少的 API', async () => {
      // 移除多個必要的 API
      delete global.chrome.storage
      delete global.chrome.tabs

      await expect(chromeApiWrapper.checkChromeApiAvailability())
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: expect.stringContaining('storage, tabs'),
          details: {
            category: 'chrome-api',
            missingApis: ['storage', 'tabs']
          }
        })
    })

    test('應該在所有必要 API 可用時通過檢查', async () => {
      await expect(chromeApiWrapper.checkChromeApiAvailability())
        .resolves
        .toBeUndefined()

      expect(mockLogger.log).toHaveBeenCalledWith('✅ Chrome API 可用性檢查通過')
    })

    test('應該在非 Manifest V3 環境中發出警告', async () => {
      mockChrome.runtime.getManifest.mockReturnValue({ manifest_version: 2 })

      await chromeApiWrapper.checkChromeApiAvailability()

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ 非 Manifest V3 環境')
    })
  })

  describe('API 路徑處理', () => {
    test('應該在不支援的 API 時拋出 CHROME_ERROR', async () => {
      await expect(chromeApiWrapper.callChromeApi('nonexistent.api', []))
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: '不支援的 API: nonexistent.api',
          details: {
            category: 'chrome-api',
            apiPath: 'nonexistent.api'
          }
        })
    })

    test('應該在 API 路徑不存在時拋出錯誤', async () => {
      await expect(chromeApiWrapper.executeApiCall('storage.local.nonexistent', []))
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: 'API 不存在: storage.local.nonexistent',
          details: {
            category: 'chrome-api',
            apiPath: 'storage.local.nonexistent'
          }
        })
    })

    test('應該在 API 不是函數時拋出錯誤', async () => {
      // 將 API 設為非函數值
      mockChrome.storage.local.notAFunction = 'not a function'

      await expect(chromeApiWrapper.executeApiCall('storage.local.notAFunction', []))
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: 'storage.local.notAFunction 不是一個函數',
          details: {
            category: 'chrome-api',
            apiPath: 'storage.local.notAFunction',
            expectedType: 'function'
          }
        })
    })
  })

  describe('chrome.runtime.lastError 處理', () => {
    test('應該在 chrome.runtime.lastError 存在時拋出 CHROME_ERROR', async () => {
      // 模擬 chrome.runtime.lastError
      mockChrome.runtime.lastError = { message: 'Extension context invalidated.' }
      mockChrome.storage.local.get.mockReturnValue(undefined) // 非 Promise 回應

      await expect(chromeApiWrapper.executeApiCall('storage.local.get', [{}]))
        .rejects
        .toMatchObject({
          code: ErrorCodes.CHROME_ERROR,
          message: 'Extension context invalidated.',
          details: {
            category: 'chrome-api',
            source: 'chrome_runtime'
          }
        })
    })

    test('應該在沒有 lastError 時正常回傳結果', async () => {
      const mockResult = { data: 'test' }
      mockChrome.runtime.lastError = null
      mockChrome.storage.local.get.mockReturnValue(mockResult)

      const result = await chromeApiWrapper.executeApiCall('storage.local.get', [{}])

      expect(result).toBe(mockResult)
    })
  })

  describe('Promise 處理', () => {
    test('應該正確處理 Promise 回應', async () => {
      const mockResult = { data: 'test' }
      mockChrome.storage.local.get.mockReturnValue(Promise.resolve(mockResult))

      const result = await chromeApiWrapper.executeApiCall('storage.local.get', [{}])

      expect(result).toBe(mockResult)
    })

    test('應該正確處理 Promise 拒絕', async () => {
      const mockError = new Error('Storage error')
      mockChrome.storage.local.get.mockReturnValue(Promise.reject(mockError))

      await expect(chromeApiWrapper.executeApiCall('storage.local.get', [{}]))
        .rejects
        .toBe(mockError)
    })
  })

  describe('重試邏輯', () => {
    test('應該在禁用重試時不重試', () => {
      const error = new Error('Network error')
      const options = { noRetry: true }

      const result = chromeApiWrapper.shouldRetry(error, options)

      expect(result).toBe(false)
    })

    test('應該在達到最大重試次數時不重試', () => {
      const error = new Error('Network error')
      const options = { retryCount: 3, maxRetries: 3 }

      const result = chromeApiWrapper.shouldRetry(error, options)

      expect(result).toBe(false)
    })

    test('應該在錯誤可重試時允許重試', () => {
      const error = new Error('Network error')
      const options = { retryCount: 1, maxRetries: 3 }

      // 設置可重試錯誤配置
      chromeApiWrapper.retryConfig = {
        maxRetries: 3,
        retryableErrors: ['Network error', 'Timeout']
      }

      const result = chromeApiWrapper.shouldRetry(error, options)

      expect(result).toBe(true)
    })

    test('應該在錯誤不可重試時拒絕重試', () => {
      const error = new Error('Permission denied')
      const options = { retryCount: 1, maxRetries: 3 }

      // 設置可重試錯誤配置
      chromeApiWrapper.retryConfig = {
        maxRetries: 3,
        retryableErrors: ['Network error', 'Timeout']
      }

      const result = chromeApiWrapper.shouldRetry(error, options)

      expect(result).toBe(false)
    })
  })

  describe('API 方法測試', () => {
    test('storageGet 應該正確調用 callChromeApi', async () => {
      const mockResult = { key: 'value' }
      const spy = jest.spyOn(chromeApiWrapper, 'callChromeApi')
        .mockResolvedValue(mockResult)

      const result = await chromeApiWrapper.storageGet({ key: null })

      expect(spy).toHaveBeenCalledWith('storage.local.get', [{ key: null }])
      expect(result).toBe(mockResult)

      spy.mockRestore()
    })

    test('tabsQuery 應該正確調用 callChromeApi', async () => {
      const mockTabs = [{ id: 1, url: 'https://example.com' }]
      const spy = jest.spyOn(chromeApiWrapper, 'callChromeApi')
        .mockResolvedValue(mockTabs)

      const query = { active: true }
      const result = await chromeApiWrapper.tabsQuery(query)

      expect(spy).toHaveBeenCalledWith('tabs.query', [query])
      expect(result).toBe(mockTabs)

      spy.mockRestore()
    })

    test('runtimeSendMessage 應該正確調用 callChromeApi', async () => {
      const mockResponse = { success: true }
      const spy = jest.spyOn(chromeApiWrapper, 'callChromeApi')
        .mockResolvedValue(mockResponse)

      const message = { type: 'test' }
      const result = await chromeApiWrapper.runtimeSendMessage(message)

      expect(spy).toHaveBeenCalledWith('runtime.sendMessage', [message, {}])
      expect(result).toBe(mockResponse)

      spy.mockRestore()
    })
  })

  describe('錯誤統計與狀態管理', () => {
    test('updateApiStats 應該正確更新統計資料', () => {
      const apiPath = 'storage.local.get'

      // 先調用 attempt，再調用 success
      chromeApiWrapper.updateApiStats(apiPath, 'attempt')
      chromeApiWrapper.updateApiStats(apiPath, 'success', 100)

      const stats = chromeApiWrapper.apiStats
      expect(stats.byApi.get(apiPath)).toBeDefined()
      expect(stats.success).toBe(1)
      expect(stats.total).toBe(1)
    })

    test('updateErrorStats 應該正確更新錯誤統計', () => {
      const errorMessage = 'Network connection failed'

      chromeApiWrapper.updateErrorStats(errorMessage)

      const stats = chromeApiWrapper.apiStats
      expect(stats.byError.size).toBeGreaterThan(0)
    })

    test('getChromeApiStatus 應該回傳正確的狀態', () => {
      // 設置一些統計資料
      chromeApiWrapper.apiStats.total = 10
      chromeApiWrapper.apiStats.success = 8
      chromeApiWrapper.apiStats.failed = 2

      const status = chromeApiWrapper.getChromeApiStatus()

      expect(status.stats.total).toBe(10)
      expect(status.stats.success).toBe(8)
      expect(status.stats.failed).toBe(2)
    })
  })
})
