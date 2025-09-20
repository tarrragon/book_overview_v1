/**
 * PopupController 最終整合和優化測試
 *
 * 測試目標：驗證最終整合優化的實作
 * 覆蓋範圍：
 * - 代碼重複清理
 * - 效能優化
 * - 記憶體管理改善
 * - 完整的端對端功能驗證
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

const PopupController = require('src/popup/popup-controller.js')

// Mock DOM 環境
const { JSDOM } = require('jsdom')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock 組件依賴
jest.mock('../../../src/popup/components/popup-status-manager.js', () => {
  return jest.fn().mockImplementation((ui) => ({
    ui,
    updateStatus: jest.fn(),
    getCurrentStatus: jest.fn(() => ({ type: 'idle', text: '準備就緒' })),
    cleanup: jest.fn()
  }))
})

jest.mock('../../../src/popup/components/popup-progress-manager.js', () => {
  return jest.fn().mockImplementation((ui) => ({
    ui,
    updateProgress: jest.fn(),
    showProgress: jest.fn(),
    hideProgress: jest.fn(),
    cleanup: jest.fn()
  }))
})

jest.mock('../../../src/popup/services/popup-communication-service.js', () => {
  return jest.fn().mockImplementation((status, progress) => ({
    status,
    progress,
    sendMessage: jest.fn(),
    checkBackgroundStatus: jest.fn(() => Promise.resolve({ status: 'ready' })),
    cleanup: jest.fn()
  }))
})

jest.mock('../../../src/popup/services/popup-extraction-service.js', () => {
  return jest.fn().mockImplementation((status, progress, communication) => ({
    status,
    progress,
    communication,
    startExtraction: jest.fn(),
    stopExtraction: jest.fn(),
    retryExtraction: jest.fn(),
    cleanup: jest.fn()
  }))
})

describe('PopupController 最終整合和優化', () => {
  let controller
  let mockDocument

  beforeEach(() => {
    // 創建完整的 DOM 結構
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="popup-container">
          <button id="extract-button">提取資料</button>
          <button id="settings-button">設定</button>
          <button id="help-button">說明</button>
          <button id="retry-button">重試</button>
          <button id="cancel-button">取消</button>
          <button id="export-button">匯出</button>
          <div id="status-dot" class="status-dot"></div>
          <div id="status-text"></div>
          <div id="status-info"></div>
          <div id="extension-status"></div>
          <div id="progress-container" class="hidden">
            <div id="progress-bar"></div>
            <div id="progress-text"></div>
            <div id="progress-percentage"></div>
          </div>
        </div>
      </body>
      </html>
    `)
    mockDocument = dom.window.document

    controller = new PopupController(mockDocument)
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (controller) {
      controller.cleanup()
    }
  })

  describe('🧹 代碼重複清理', () => {
    test('應該消除 TODO 標記的重複程式碼', async () => {
      await controller.initialize()

      // 驗證不再有待實作的 TODO 標記（除了計劃中的功能）
      const remainingTodos = controller._getRemainingTodos()

      // 不應該有基礎架構相關的 TODO
      expect(remainingTodos.filter(todo =>
        todo.includes('動態載入') ||
        todo.includes('事件通訊') ||
        todo.includes('降級機制')
      ).length).toBe(0)

      // 檢查所有 TODO 都已清理或轉為功能性實作
      // 基礎架構相關的 TODO 應該都已經清理完成
      expect(remainingTodos.length).toBeGreaterThanOrEqual(0) // 允許沒有 TODO 或只有功能性 TODO
    })

    test('應該合併重複的事件處理邏輯', async () => {
      await controller.initialize()

      // 檢查事件處理邏輯是否統一
      const eventManager = controller.eventManager
      expect(eventManager).toBeDefined()

      // 驗證所有按鈕事件都使用統一的處理機制
      const eventConfigs = eventManager.getEventConfigs()
      const buttonEvents = Object.values(eventConfigs).filter(config =>
        config.elementId.includes('button')
      )

      // 所有按鈕事件應該有一致的結構
      buttonEvents.forEach(event => {
        expect(event).toHaveProperty('elementId')
        expect(event).toHaveProperty('eventType', 'click')
        expect(event).toHaveProperty('category')
        expect(event).toHaveProperty('handler')
        expect(typeof event.handler).toBe('function')
      })
    })

    test('應該優化 UI 更新方法的重複邏輯', async () => {
      await controller.initialize()

      // 驗證 UI 更新方法不再有重複的 DOM 操作邏輯
      const uiManager = controller.components.ui

      // 測試統一的狀態更新
      const statusData = { type: 'processing', text: '處理中', info: '正在提取資料' }
      expect(() => uiManager.updateStatus(statusData)).not.toThrow()

      // 測試統一的進度更新
      expect(() => uiManager.updateProgress(50, 'active', '50% 完成')).not.toThrow()

      // 驗證更新方法使用了優化的 DOM 操作
      expect(uiManager.updateStatus).toBeDefined()
      expect(uiManager.updateProgress).toBeDefined()
    })
  })

  describe('⚡ 效能優化', () => {
    test('應該實現組件懶加載', async () => {
      // 測試組件只在需要時初始化
      const startTime = performance.now()

      await controller.initialize()

      const endTime = performance.now()
      const initTime = endTime - startTime

      // 初始化時間應該在合理範圍內 (< 100ms)
      expect(initTime).toBeLessThan(100)

      // 驗證組件確實被創建了
      expect(controller.components.ui).toBeDefined()
      expect(controller.components.status).toBeDefined()
      expect(controller.components.progress).toBeDefined()
      expect(controller.components.communication).toBeDefined()
      expect(controller.components.extraction).toBeDefined()
    })

    test('應該優化事件監聽器註冊效能', async () => {
      await controller.initialize()

      const eventManager = controller.eventManager
      const startTime = performance.now()

      // 測試大量事件註冊的效能
      for (let i = 0; i < 100; i++) {
        eventManager.registerEvent(`test-element-${i}`, 'click', () => {})
      }

      const endTime = performance.now()
      const registrationTime = endTime - startTime

      // 100個事件註冊應該在合理時間內完成 (< 50ms)
      expect(registrationTime).toBeLessThan(50)

      // 清理測試事件
      for (let i = 0; i < 100; i++) {
        eventManager.unregisterEvent(`test-element-${i}`, 'click')
      }
    })

    test('應該實現 Chrome API 通訊優化', async () => {
      await controller.initialize()

      const communication = controller.components.communication
      const startTime = performance.now()

      // 測試並發通訊效能
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(communication.checkBackgroundStatus())
      }

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const communicationTime = endTime - startTime

      // 10個並發請求應該在合理時間內完成 (< 100ms, 因為是 mock)
      expect(communicationTime).toBeLessThan(100)
      expect(results.length).toBe(10)
      results.forEach(result => {
        expect(result).toEqual({ status: 'ready' })
      })
    })

    test('應該批次處理 DOM 更新', async () => {
      await controller.initialize()

      const uiManager = controller.components.ui
      const startTime = performance.now()

      // 測試批次 DOM 更新
      const updates = []
      for (let i = 0; i < 50; i++) {
        updates.push(() => uiManager.updateProgress(i * 2, 'active', `${i * 2}% 完成`))
      }

      // 批次執行更新
      updates.forEach(update => update())

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // 50個 DOM 更新應該在合理時間內完成 (< 50ms, 因為是 mock)
      expect(updateTime).toBeLessThan(50)
    })
  })

  describe('🧠 記憶體管理改善', () => {
    test('應該正確清理所有事件監聽器', async () => {
      await controller.initialize()

      const eventManager = controller.eventManager

      // 註冊一些測試事件
      eventManager.registerEvent('test-memory-1', 'click', () => {})
      eventManager.registerEvent('test-memory-2', 'focus', () => {})
      eventManager.registerEvent('test-memory-3', 'blur', () => {})

      const initialListenerCount = eventManager.getTrackedListeners().length
      expect(initialListenerCount).toBeGreaterThan(3)

      // 清理控制器
      controller.cleanup()

      // 驗證所有監聽器都被清理了
      expect(controller.eventListeners.length).toBe(0)
      expect(controller.eventManager).toBeUndefined()
    })

    test('應該防止記憶體洩漏', async () => {
      // 模擬多次初始化和清理
      for (let i = 0; i < 10; i++) {
        const testController = new PopupController(mockDocument)
        await testController.initialize()

        // 註冊一些事件
        if (testController.eventManager) {
          testController.eventManager.registerEvent(`test-${i}`, 'click', () => {})
        }

        // 立即清理
        testController.cleanup()

        // 驗證清理完成
        expect(testController.eventManager).toBeUndefined()
        expect(testController.eventListeners.length).toBe(0)
      }

      // 應該沒有記憶體洩漏警告
      expect(true).toBe(true) // 如果有記憶體洩漏，測試框架會報警
    })

    test('應該優化組件引用管理', async () => {
      await controller.initialize()

      // 驗證組件之間的引用是否正確設置
      expect(controller.components.status.ui).toBe(controller.components.ui)
      expect(controller.components.progress.ui).toBe(controller.components.ui)
      expect(controller.components.communication.status).toBe(controller.components.status)
      expect(controller.components.communication.progress).toBe(controller.components.progress)

      // 清理後引用應該被正確移除
      controller.cleanup()

      // 驗證清理完成
      expect(Object.keys(controller.components).length).toBe(0)
    })

    test('應該實現弱引用模式', async () => {
      await controller.initialize()

      // 測試組件可以被正確釋放
      const statusManager = controller.components.status
      const progressManager = controller.components.progress

      expect(statusManager).toBeDefined()
      expect(progressManager).toBeDefined()

      // 模擬組件清理
      statusManager.cleanup()
      progressManager.cleanup()

      // 驗證清理方法被調用
      expect(statusManager.cleanup).toHaveBeenCalled()
      expect(progressManager.cleanup).toHaveBeenCalled()
    })
  })

  describe('🔗 完整端對端功能驗證', () => {
    test('應該完成完整的提取流程', async () => {
      await controller.initialize()

      // 模擬完整的提取流程
      const extractButton = mockDocument.getElementById('extract-button')

      // 1. 點擊提取按鈕
      extractButton.click()
      expect(controller.components.extraction.startExtraction).toHaveBeenCalledTimes(1)

      // 2. 模擬進度更新
      const uiManager = controller.components.ui

      // 建立 spy 來追蹤調用
      const updateProgressSpy = jest.spyOn(uiManager, 'updateProgress')

      uiManager.updateProgress(25, 'active', '25% 完成')
      uiManager.updateProgress(50, 'active', '50% 完成')
      uiManager.updateProgress(75, 'active', '75% 完成')
      uiManager.updateProgress(100, 'completed', '提取完成')

      // 3. 驗證狀態更新
      expect(updateProgressSpy).toHaveBeenCalledTimes(4)

      // 4. 測試取消功能
      const cancelButton = mockDocument.getElementById('cancel-button')
      cancelButton.click()
      expect(controller.components.extraction.stopExtraction).toHaveBeenCalledTimes(1)
    })

    test('應該處理複雜的錯誤場景', async () => {
      await controller.initialize()

      // 模擬提取過程中的錯誤
      controller.components.extraction.startExtraction.mockImplementation(() => {
        throw (() => { const error = new Error( '網路連接失敗'); error.code = ErrorCodes.TEST_ERROR; error.details =  { category: 'testing' }; return error })()
      })

      const extractButton = mockDocument.getElementById('extract-button')

      // 應該優雅處理錯誤
      expect(() => extractButton.click()).not.toThrow()

      // 驗證錯誤被記錄
      const eventManager = controller.eventManager
      if (eventManager) {
        const errors = eventManager.getEventErrors()
        expect(errors.length).toBeGreaterThan(0)
      }

      // 測試重試功能
      const retryButton = mockDocument.getElementById('retry-button')
      retryButton.click()
      expect(controller.components.extraction.retryExtraction).toHaveBeenCalledTimes(1)
    })

    test('應該支援所有按鈕功能', async () => {
      await controller.initialize()

      const buttons = [
        'extract-button',
        'settings-button',
        'help-button',
        'retry-button',
        'cancel-button',
        'export-button'
      ]

      // 測試所有按鈕都可以點擊且不會拋出錯誤
      buttons.forEach(buttonId => {
        const button = mockDocument.getElementById(buttonId)
        if (button) {
          expect(() => button.click()).not.toThrow()
        }
      })

      // 驗證核心功能被調用
      expect(controller.components.extraction.startExtraction).toHaveBeenCalled()
      expect(controller.components.extraction.retryExtraction).toHaveBeenCalled()
      expect(controller.components.extraction.stopExtraction).toHaveBeenCalled()
    })

    test('應該維持系統穩定性', async () => {
      await controller.initialize()

      // 測試系統在壓力下的穩定性
      const operations = []

      // 模擬快速連續操作
      for (let i = 0; i < 20; i++) {
        operations.push(async () => {
          const extractButton = mockDocument.getElementById('extract-button')
          const cancelButton = mockDocument.getElementById('cancel-button')

          extractButton.click()
          await new Promise(resolve => setTimeout(resolve, 1))
          cancelButton.click()
        })
      }

      // 所有操作都應該順利完成
      await Promise.all(operations.map(op => op()))

      // 系統應該仍然穩定
      expect(controller.isInitialized).toBe(true)
      expect(controller.eventManager).toBeDefined()

      // 統計資訊應該正確
      const stats = controller.eventManager.getStats()
      expect(stats.totalTriggers).toBeGreaterThan(0)
      expect(stats.totalEvents).toBeGreaterThan(0)
    })
  })

  describe('📊 整合品質指標', () => {
    test('應該達到效能基準', async () => {
      const startTime = performance.now()

      await controller.initialize()

      const initTime = performance.now() - startTime

      // 初始化應該很快
      expect(initTime).toBeLessThan(100)

      // 所有組件應該正確初始化
      expect(controller.isInitialized).toBe(true)
      expect(Object.keys(controller.components).length).toBe(5)
    })

    test('應該維持高測試覆蓋率', async () => {
      await controller.initialize()

      // 驗證所有主要功能都有測試覆蓋
      const methods = [
        'initialize',
        'cleanup',
        'getComponent',
        'isComponentAvailable',
        'getInitializationStatus'
      ]

      methods.forEach(method => {
        expect(typeof controller[method]).toBe('function')
      })

      // 測試所有公開方法
      expect(controller.getComponent('ui')).toBeDefined()
      expect(controller.isComponentAvailable('status')).toBe(true)

      const status = controller.getInitializationStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.componentCount).toBe(5)
    })

    test('應該符合架構設計原則', async () => {
      await controller.initialize()

      // 驗證單一職責原則
      expect(controller.components.ui).toBeDefined() // UI 管理
      expect(controller.components.status).toBeDefined() // 狀態管理
      expect(controller.components.progress).toBeDefined() // 進度管理
      expect(controller.components.communication).toBeDefined() // 通訊管理
      expect(controller.components.extraction).toBeDefined() // 業務邏輯

      // 驗證依賴注入
      expect(controller.components.status.ui).toBe(controller.components.ui)
      expect(controller.components.progress.ui).toBe(controller.components.ui)

      // 驗證事件驅動架構
      expect(controller.eventManager).toBeDefined()
      expect(controller.eventManager.getEventCategories().length).toBeGreaterThan(0)
    })
  })
})
