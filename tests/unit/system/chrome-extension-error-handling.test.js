/**
 * Chrome Extension 錯誤處理測試套件
 * 測試實際的 MessageErrorHandler 和基礎 Chrome API 錯誤處理機制
 *
 * @author UC-07 系統性錯誤處理測試 - Phase 2 重寫版本
 * @date 2025-08-26
 */

const MessageErrorHandler = require('src/error-handling/message-error-handler')

describe('🏗️ Chrome Extension 錯誤處理測試套件', () => {
  let messageErrorHandler
  let mockEventBus

  beforeEach(() => {
    // Mock 事件總線
    mockEventBus = {
      emit: jest.fn()
    }

    // 創建 MessageErrorHandler 實例
    messageErrorHandler = new MessageErrorHandler(mockEventBus)

    // 設置基本的 Chrome API mock
    global.chrome = {
      runtime: {
        lastError: null,
        onMessage: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          clear: jest.fn()
        }
      },
      permissions: {
        request: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
    // 重置 chrome.runtime.lastError
    if (global.chrome && global.chrome.runtime) {
      global.chrome.runtime.lastError = null
    }
  })

  describe('🔐 權限相關錯誤處理', () => {
    test('CE001: 應該處理儲存權限被撤銷的情況', async () => {
      // Given: 設置權限被撤銷錯誤
      global.chrome.runtime.lastError = {
        message: 'Permission denied for chrome.storage'
      }

      // When: 檢查 Chrome 錯誤
      const hasError = messageErrorHandler.checkChromeLastError()

      // Then: 應該檢測到錯誤並發送事件
      expect(hasError).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith('MESSAGE.ERROR', expect.objectContaining({
        error: expect.any(Error),
        context: 'chrome-runtime'
      }))
    })

    test('CE002: 應該處理權限請求被使用者拒絕的情況', () => {
      // Given: Mock 權限請求被拒絕
      global.chrome.permissions.request.mockImplementation((permissions, callback) => {
        callback(null, false) // 權限被拒絕
      })

      // When & Then: 測試權限請求處理
      global.chrome.permissions.request({ permissions: ['storage'] }, (error, granted) => {
        expect(error).toBeNull()
        expect(granted).toBe(false)
        expect(global.chrome.permissions.request).toHaveBeenCalledWith(
          { permissions: ['storage'] },
          expect.any(Function)
        )
      })
    })
  })

  describe('🔄 擴展上下文錯誤處理', () => {
    test('CE003: 應該處理擴展上下文失效的情況', () => {
      // Given: 設置上下文失效錯誤
      global.chrome.runtime.lastError = {
        message: 'Extension context invalidated'
      }

      // When: 檢查 Chrome 健康狀態
      const health = messageErrorHandler.getChromeExtensionHealth()

      // Then: 應該正確識別上下文失效
      expect(health.messageSystemWorking).toBe(false)
      expect(health.lastErrorStatus).toContain('Extension context invalidated')
    })

    test('CE004: 應該處理擴展更新期間的API不可用狀況', () => {
      // Given: 設置 API 不可用錯誤
      global.chrome.runtime.lastError = {
        message: 'Extension context invalidated'
      }

      // When: 檢查錯誤
      const hasError = messageErrorHandler.checkChromeLastError()

      // Then: 應該檢測到錯誤並處理
      expect(hasError).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith('MESSAGE.ERROR', expect.objectContaining({
        error: expect.objectContaining({
          message: 'Extension context invalidated'
        }),
        context: 'chrome-runtime'
      }))
    })
  })

  describe('💾 儲存配額錯誤處理', () => {
    test('CE005: 應該處理Chrome Storage配額超限的情況', async () => {
      // Given: 設置配額超限錯誤
      global.chrome.runtime.lastError = {
        message: 'Quota exceeded'
      }

      // When: 檢查錯誤
      const hasError = messageErrorHandler.checkChromeLastError()

      // Then: 應該檢測到配額錯誤
      expect(hasError).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith('MESSAGE.ERROR', expect.objectContaining({
        error: expect.objectContaining({
          message: 'Quota exceeded'
        }),
        context: 'chrome-runtime'
      }))
    })

    test('CE006: 應該提供儲存配額使用狀況監控', () => {
      // Given: 正常的 Chrome API 狀態
      global.chrome.runtime.lastError = null

      // When: 獲取記憶體使用統計
      const memoryUsage = messageErrorHandler.getMemoryUsage()

      // Then: 應該提供記憶體使用資訊
      expect(memoryUsage).toHaveProperty('errorRecordsCount')
      expect(memoryUsage).toHaveProperty('estimatedMemoryUsage')
      expect(typeof memoryUsage.errorRecordsCount).toBe('number')
      expect(typeof memoryUsage.estimatedMemoryUsage).toBe('number')
    })
  })

  describe('🛡️ 內容安全政策 (CSP) 錯誤處理', () => {
    test('CE007: 應該處理CSP違規錯誤', async () => {
      // Given: CSP 錯誤事件
      const cspErrorEvent = {
        type: 'MESSAGE.ERROR',
        data: {
          error: new Error('Refused to evaluate a string as JavaScript because CSP'),
          message: 'CSP Violation detected',
          context: 'content-script',
          timestamp: Date.now()
        }
      }

      // When: 處理 CSP 錯誤事件
      const result = await messageErrorHandler.process(cspErrorEvent)

      // Then: 應該成功處理並記錄錯誤
      expect(result.success).toBe(true)
      expect(result.errorId).toBeDefined()
      expect(mockEventBus.emit).toHaveBeenCalledWith('ERROR.LOGGED', expect.objectContaining({
        type: 'MESSAGE_ERROR',
        error: expect.stringContaining('CSP'),
        context: 'content-script'
      }))
    })

    test('CE008: 應該避免內聯腳本和樣式的CSP問題', () => {
      // Given: 正常的 Chrome Extension 環境
      const health = messageErrorHandler.getChromeExtensionHealth()

      // When & Then: 驗證基礎環境可用性
      expect(health.runtimeAvailable).toBe(true)
      expect(health.messageSystemWorking).toBe(true)
      expect(health.lastErrorStatus).toBe(null)
    })
  })

  describe('📡 跨上下文通訊錯誤處理', () => {
    test('CE009: 應該處理Content Script通訊失敗', async () => {
      // Given: Content Script 通訊失敗事件
      const commErrorEvent = {
        type: 'MESSAGE.ROUTING_ERROR',
        data: {
          source: 'popup',
          target: 'content-script',
          message: 'START_EXTRACTION',
          error: new Error('No receiving end'),
          timestamp: Date.now()
        }
      }

      // When: 處理路由錯誤
      const result = await messageErrorHandler.process(commErrorEvent)

      // Then: 應該分析路由問題並提供建議
      expect(result.success).toBe(true)
      expect(result.analysis).toBeDefined()
      expect(result.analysis.issue).toBe('CONTENT_SCRIPT_NOT_READY')
      expect(result.analysis.suggestions).toContain('確認 Content Script 已載入')
    })

    test('CE010: 應該處理Background Script連線中斷', async () => {
      // Given: Background Script 連線中斷事件
      const connectionErrorEvent = {
        type: 'MESSAGE.ROUTING_ERROR',
        data: {
          source: 'content-script',
          target: 'background',
          message: 'DATA_EXTRACTED',
          error: new Error('No receiving end'),
          timestamp: Date.now()
        }
      }

      // When: 處理路由錯誤
      const result = await messageErrorHandler.process(connectionErrorEvent)

      // Then: 應該識別 Background 連線問題
      expect(result.success).toBe(true)
      expect(result.analysis.issue).toBe('BACKGROUND_NOT_READY')
      expect(result.analysis.suggestions).toContain('確認 Background Service Worker 正在運行')
    })
  })

  describe('🔧 系統恢復與降級機制', () => {
    test('CE011: 應該在多重錯誤情況下優先處理關鍵錯誤', async () => {
      // Given: 多個錯誤事件
      const errors = [
        {
          type: 'MESSAGE.ERROR',
          data: {
            error: new Error('Permission denied'),
            context: 'critical-operation',
            timestamp: Date.now()
          }
        },
        {
          type: 'MESSAGE.UNKNOWN_TYPE',
          data: {
            messageType: 'UNKNOWN_MESSAGE',
            context: 'non-critical',
            timestamp: Date.now()
          }
        }
      ]

      // When: 處理多個錯誤
      const results = await Promise.all(
        errors.map(error => messageErrorHandler.process(error))
      )

      // Then: 應該處理所有錯誤
      expect(results.length).toBe(2)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // 驗證統計資訊
      const stats = messageErrorHandler.getErrorStatistics()
      expect(stats.totalErrors).toBe(2)
    })

    test('CE012: 應該提供Chrome Extension健康狀態檢查', () => {
      // Given: 正常運行的 Chrome Extension 環境
      global.chrome.runtime.lastError = null

      // When: 獲取健康狀態
      const health = messageErrorHandler.getChromeExtensionHealth()

      // Then: 應該提供完整的健康狀態資訊
      expect(health).toHaveProperty('runtimeAvailable')
      expect(health).toHaveProperty('messageSystemWorking')
      expect(health).toHaveProperty('lastErrorStatus')

      expect(health.runtimeAvailable).toBe(true)
      expect(health.messageSystemWorking).toBe(true)
      expect(health.lastErrorStatus).toBe(null)
    })
  })

  describe('📊 錯誤統計與診斷', () => {
    test('應該正確記錄和統計錯誤', async () => {
      // Given: 清空統計
      const initialStats = messageErrorHandler.getErrorStatistics()
      expect(initialStats.totalErrors).toBe(0)

      // When: 處理多種類型的錯誤
      await messageErrorHandler.process({
        type: 'MESSAGE.ERROR',
        data: { error: new Error('Test error'), context: 'test' }
      })

      await messageErrorHandler.process({
        type: 'MESSAGE.UNKNOWN_TYPE',
        data: { messageType: 'UNKNOWN', availableTypes: ['KNOWN'] }
      })

      // Then: 統計應該正確更新
      const finalStats = messageErrorHandler.getErrorStatistics()
      expect(finalStats.totalErrors).toBe(2)
      expect(finalStats.unknownMessageTypes).toBe(1)
    })

    test('應該生成有用的錯誤報告', () => {
      // When: 生成錯誤報告
      const report = messageErrorHandler.generateErrorReport()

      // Then: 報告應該包含必要資訊
      expect(report).toContain('訊息錯誤統計報告')
      expect(report).toContain('總錯誤數')
      expect(report).toContain('診斷模式')
    })
  })
})
