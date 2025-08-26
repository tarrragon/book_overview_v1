/**
 * Chrome Extension 錯誤處理測試套件
 * 測試Chrome Extension特有的錯誤場景和處理機制
 *
 * @author UC-07 系統性錯誤處理測試 - TDD Phase 2設計
 * @date 2025-08-25
 */

const ErrorInjector = require('../../utils/error-injector')
const ChromeExtensionMocksEnhanced = require('../../utils/chrome-extension-mocks-enhanced')
const ErrorTestDataFactory = require('../../utils/error-test-data-factory')

// 這些測試設計為紅燈狀態，等待實作完成
describe('🏗️ Chrome Extension 錯誤處理測試套件', () => {
  let errorInjector
  let chromeMocks
  let testDataFactory
  let mockSystemErrorHandler

  // 測試輔助函數：設置儲存權限錯誤場景
  const setupStoragePermissionError = () => {
    const testData = testDataFactory.createChromeExtensionError('permission_revoked')
    chromeMocks.revokePermission('storage')
    return testData
  }

  // 測試輔助函數：執行儲存API操作並捕獲錯誤
  const attemptStorageOperation = async (operation = ['testKey']) => {
    try {
      await executeStorageGet(operation)
      return null
    } catch (error) {
      return error
    }
  }

  // 測試輔助函數：執行儲存取得操作
  const executeStorageGet = (operation) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(operation, (result) => {
        handleStorageResponse(result, resolve, reject)
      })
    })
  }

  // 測試輔助函數：處理儲存回應
  const handleStorageResponse = (result, resolve, reject) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message))
    } else {
      resolve(result)
    }
  }

  // 測試輔助函數：驗證權限錯誤處理期望
  const verifyPermissionErrorHandling = (error) => {
    expect(error).toBeTruthy()
    expect(error.message).toContain('Permission denied')
  }

  // 測試輔助函數：驗證錯誤處理器調用期望
  const verifyErrorHandlerCalls = () => {
    const expectedError = createPermissionErrorExpectation()
    expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(expectedError)
  }

  // 測試輔助函數：創建權限錯誤期望物件
  const createPermissionErrorExpectation = () => {
    return expect.objectContaining({
      type: 'permission_error',
      api: 'chrome.storage',
      recoverable: true
    })
  }

  // 測試輔助函數：驗證恢復策略調用期望
  const verifyRecoveryStrategyCalls = () => {
    const expectedStrategy = createRecoveryStrategyExpectation()
    expect(mockSystemErrorHandler.recoverFromError).toHaveBeenCalledWith(expectedStrategy)
  }

  // 測試輔助函數：創建恢復策略期望物件
  const createRecoveryStrategyExpectation = () => {
    return expect.objectContaining({
      strategy: 'request_permission',
      permission: 'storage'
    })
  }

  // 測試輔助函數：設置配額超限場景
  const setupQuotaExceededScenario = () => {
    const testData = testDataFactory.createChromeExtensionError('quota_exceeded')
    chromeMocks.setStorageQuotaUsed(5200000) // 接近5MB限制
    return testData
  }

  // 測試輔助函數：嘗試儲存大量資料
  const attemptLargeDataStorage = async () => {
    try {
      await executeStorageSet()
      return null
    } catch (error) {
      return error
    }
  }

  // 測試輔助函數：執行大資料儲存操作
  const executeStorageSet = () => {
    const largeData = createLargeDataSet()
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(largeData, () => {
        handleStorageResponse(null, resolve, reject)
      })
    })
  }

  // 測試輔助函數：創建大量測試資料
  const createLargeDataSet = () => {
    return { largeArray: new Array(100000).fill('data') }
  }

  // 測試輔助函數：驗證配額錯誤處理
  const verifyQuotaErrorHandling = (error) => {
    expect(error).toBeTruthy()
    expect(error.message).toContain('Quota exceeded')
  }

  // 測試輔助函數：驗證配額錯誤處理器調用
  const verifyQuotaErrorHandlerCalls = () => {
    const expectedQuotaError = createQuotaErrorExpectation()
    expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(expectedQuotaError)
  }

  // 測試輔助函數：創建配額錯誤期望物件
  const createQuotaErrorExpectation = () => {
    return expect.objectContaining({
      type: 'quota_exceeded',
      usedBytes: expect.any(Number),
      totalBytes: 5242880,
      recommendedAction: 'cleanup_storage'
    })
  }

  beforeAll(() => {
    errorInjector = new ErrorInjector()
    chromeMocks = new ChromeExtensionMocksEnhanced()
    testDataFactory = new ErrorTestDataFactory()

    // 清除jest-chrome的mock以避免衝突
    if (global.chrome) {
      delete global.chrome
    }

    // 初始化Chrome Extension環境
    chromeMocks.initializeAll()
  })

  beforeEach(() => {
    // 重置到預設狀態
    chromeMocks.resetToDefaults()

    // Mock系統錯誤處理器 (待實作)
    mockSystemErrorHandler = {
      handleError: jest.fn(),
      recoverFromError: jest.fn(),
      logError: jest.fn(),
      getErrorStats: jest.fn(() => ({ totalErrors: 0, recoveredErrors: 0 }))
    }
  })

  afterEach(() => {
    errorInjector.restoreAll()
    jest.clearAllMocks()
  })

  describe('🔐 權限相關錯誤處理', () => {
    test('CE001: 應該處理儲存權限被撤銷的情況', async () => {
      // Given: 使用者撤銷了儲存權限
      setupStoragePermissionError()

      // When: 嘗試訪問儲存API
      const error = await attemptStorageOperation()

      // Then: 應該檢測到權限錯誤並嘗試重新請求權限
      verifyPermissionErrorHandling(error)
      verifyErrorHandlerCalls()
      verifyRecoveryStrategyCalls()
    })

    test('CE002: 應該處理權限請求被使用者拒絕的情況', async () => {
      // Given: 系統需要請求新權限但使用者拒絕
      chromeMocks.revokePermission('tabs')

      // When: 嘗試請求權限
      const granted = await new Promise((resolve) => {
        chrome.permissions.request({ permissions: ['tabs'] }, resolve)
      })

      // Then: 應該優雅處理拒絕並提供降級服務
      expect(granted).toBe(false) // Mock有30%機會拒絕

      // 待實作: 應該記錄權限拒絕事件
      expect(mockSystemErrorHandler.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'permission_denied',
          permission: 'tabs',
          fallbackAvailable: true
        })
      )
    })
  })

  describe('🔄 擴展上下文錯誤處理', () => {
    test('CE003: 應該處理擴展上下文失效的情況', async () => {
      // Given: 擴展被重新載入導致上下文失效
      const testData = testDataFactory.createChromeExtensionError('context_invalidated')
      chromeMocks.invalidateContext()

      // When: 嘗試使用Runtime API
      let thrownError = null
      try {
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          // 回調函數
        })
      } catch (error) {
        thrownError = error
      }

      // Then: 應該檢測到上下文失效並重新初始化
      expect(chrome.runtime.lastError).toBeTruthy()
      expect(chrome.runtime.lastError.message).toContain('Extension context invalidated')

      // 待實作: 應該觸發重新初始化
      expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'context_invalidated',
          api: 'chrome.runtime',
          requiresReinit: true
        })
      )
    })

    test('CE004: 應該處理擴展更新期間的API不可用狀況', async () => {
      // Given: 擴展正在更新，某些API暫時不可用
      const testData = testDataFactory.createChromeExtensionError('api_not_available')

      // When: API不可用時嘗試訪問
      chromeMocks.invalidateContext()

      let connectionError = null
      try {
        chrome.runtime.connect({ name: 'test-connection' })
      } catch (error) {
        connectionError = error
      }

      // Then: 應該使用備用機制或顯示適當訊息
      expect(connectionError).toBeTruthy()
      expect(connectionError.message).toContain('Extension context invalidated')

      // 待實作: 應該觸發降級機制
      expect(mockSystemErrorHandler.recoverFromError).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'use_fallback_mechanism',
          originalAPI: 'chrome.runtime.connect'
        })
      )
    })
  })

  describe('💾 儲存配額錯誤處理', () => {
    test('CE005: 應該處理Chrome Storage配額超限的情況', async () => {
      // Given: 儲存空間即將或已經超限
      setupQuotaExceededScenario()

      // When: 嘗試儲存更多資料
      const error = await attemptLargeDataStorage()

      // Then: 應該檢測配額限制並提供清理選項
      verifyQuotaErrorHandling(error)
      verifyQuotaErrorHandlerCalls()
    })

    test('CE006: 應該提供儲存配額使用狀況監控', async () => {
      // Given: 系統需要監控儲存使用情況
      chromeMocks.setStorageQuotaUsed(2500000) // 約50%使用率

      // When: 查詢儲存使用情況
      const usedBytes = await new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, resolve)
      })

      // Then: 應該獲得準確的使用情況
      expect(usedBytes).toBe(2500000)

      // 待實作: 應該在超過閾值時發出警告
      const quota = chromeMocks.getStorageQuota()
      const usagePercent = (usedBytes / quota.total) * 100

      if (usagePercent > 80) {
        expect(mockSystemErrorHandler.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'storage_warning',
            usagePercent: expect.any(Number),
            threshold: 80
          })
        )
      }
    })
  })

  describe('🛡️ 內容安全政策 (CSP) 錯誤處理', () => {
    test('CE007: 應該處理CSP違規錯誤', async () => {
      // Given: 程式碼嘗試執行被CSP阻止的操作
      const testData = testDataFactory.createChromeExtensionError('csp_violation')

      // When: 嘗試執行動態程式碼（模擬CSP違規）
      let cspError = null
      try {
        // 模擬CSP阻止的操作
        eval('console.log("This should be blocked by CSP")')
      } catch (error) {
        cspError = error
      }

      // Then: 應該捕獲CSP錯誤並使用安全的替代方案
      // 注意：在實際測試環境中可能不會拋出錯誤，這裡主要測試處理邏輯

      // 待實作: CSP錯誤處理器
      expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'csp_violation',
          violationType: 'unsafe_eval',
          alternativeMethod: 'function_call'
        })
      )
    })

    test('CE008: 應該避免內聯腳本和樣式的CSP問題', () => {
      // Given: 系統需要動態添加樣式或腳本
      const testData = testDataFactory.createChromeExtensionError('csp_violation')

      // When: 使用CSP兼容的方法
      const styleElement = document.createElement('style')
      styleElement.textContent = '.test-class { color: red; }'

      // Then: 應該成功添加而不違反CSP
      expect(() => {
        document.head.appendChild(styleElement)
      }).not.toThrow()

      // 清理
      document.head.removeChild(styleElement)

      // 待實作: 應該記錄CSP兼容操作
      expect(mockSystemErrorHandler.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'csp_safe_operation',
          method: 'createElement_textContent',
          avoided: 'innerHTML'
        })
      )
    })
  })

  describe('📡 跨上下文通訊錯誤處理', () => {
    test('CE009: 應該處理Content Script通訊失敗', async () => {
      // Given: Content Script無法回應訊息
      chromeMocks.revokePermission('activeTab')

      // When: 嘗試向Content Script發送訊息
      let communicationError = null
      try {
        await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(1, { action: 'test' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response)
            }
          })
        })
      } catch (error) {
        communicationError = error
      }

      // Then: 應該處理通訊失敗並提供備用方案
      expect(communicationError).toBeTruthy()
      expect(communicationError.message).toContain('Permission denied')

      // 待實作: 通訊錯誤恢復
      expect(mockSystemErrorHandler.recoverFromError).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'retry_with_permission_check',
          targetTab: 1,
          originalMessage: { action: 'test' }
        })
      )
    })

    test('CE010: 應該處理Background Script連線中斷', () => {
      // Given: Background Script連線意外中斷
      const testData = testDataFactory.createChromeExtensionError('context_invalidated')

      // When: 建立連線後模擬中斷
      const port = chrome.runtime.connect({ name: 'test-port' })
      chromeMocks.invalidateContext()

      let disconnectionHandled = false
      port.onDisconnect.addListener(() => {
        disconnectionHandled = true
      })

      // 模擬連線中斷
      try {
        port.postMessage({ test: 'message' })
      } catch (error) {
        // 預期會拋出錯誤
      }

      // Then: 應該檢測連線中斷並重新建立連線
      // 待實作: 連線管理器
      expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_lost',
          portName: 'test-port',
          shouldReconnect: true
        })
      )
    })
  })

  describe('🔧 系統恢復與降級機制', () => {
    test('CE011: 應該在多重錯誤情況下優先處理關鍵錯誤', async () => {
      // Given: 同時發生多個Chrome Extension錯誤
      const compoundError = testDataFactory.createCompoundError([
        'chrome.permission_revoked',
        'chrome.quota_exceeded',
        'chrome.context_invalidated'
      ])

      // When: 觸發多重錯誤
      chromeMocks.revokePermission('storage')
      chromeMocks.setStorageQuotaUsed(5300000)
      chromeMocks.invalidateContext()

      // 嘗試多個操作
      const errors = []

      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.get(['test'], () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
            else resolve({})
          })
        })
      } catch (error) {
        errors.push({ type: 'permission', error })
      }

      try {
        chrome.runtime.sendMessage({ test: 'message' })
      } catch (error) {
        errors.push({ type: 'context', error })
      }

      // Then: 應該按優先級處理錯誤
      expect(errors.length).toBeGreaterThan(0)

      // 待實作: 錯誤優先級處理
      expect(mockSystemErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'compound_error',
          errorCount: expect.any(Number),
          highestPriority: 'context_invalidated'
        })
      )
    })

    test('CE012: 應該提供Chrome Extension健康狀態檢查', () => {
      // Given: 系統需要檢查Chrome Extension健康狀態

      // When: 執行健康檢查
      const healthCheck = {
        permissions: {
          storage: chromeMocks.permissions.storage,
          tabs: chromeMocks.permissions.tabs,
          activeTab: chromeMocks.permissions.activeTab
        },
        context: chromeMocks.contextValid,
        quota: chromeMocks.getStorageQuota()
      }

      // Then: 應該獲得完整的健康狀態報告
      expect(healthCheck.permissions.storage).toBeDefined()
      expect(healthCheck.context).toBeDefined()
      expect(healthCheck.quota).toHaveProperty('used')
      expect(healthCheck.quota).toHaveProperty('total')

      // 待實作: 健康狀態監控器
      expect(mockSystemErrorHandler.getErrorStats).toHaveBeenCalled()

      const stats = mockSystemErrorHandler.getErrorStats()
      expect(stats).toHaveProperty('totalErrors')
      expect(stats).toHaveProperty('recoveredErrors')
    })
  })
})

// 模擬未來會實作的系統錯誤處理器
class SystemErrorHandler {
  handleError (errorInfo) {
    // 待實作: 錯誤分類和處理邏輯
    throw new Error('SystemErrorHandler.handleError not implemented yet')
  }

  recoverFromError (recoveryInfo) {
    // 待實作: 錯誤恢復策略
    throw new Error('SystemErrorHandler.recoverFromError not implemented yet')
  }

  logError (logInfo) {
    // 待實作: 錯誤日誌記錄
    throw new Error('SystemErrorHandler.logError not implemented yet')
  }

  getErrorStats () {
    // 待實作: 錯誤統計
    throw new Error('SystemErrorHandler.getErrorStats not implemented yet')
  }
}

module.exports = SystemErrorHandler
